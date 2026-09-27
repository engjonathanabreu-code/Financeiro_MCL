/* Financeiro MCL — Recebimentos: relatório mensal por município em Word (.docx).
   O usuário escolhe o município e o mês; o sistema apura entradas, inadimplentes, total que entrou e quanto faltou;
   a IA financeira (/api/ai-municipio-report) escreve a análise; o arquivo .docx é montado no navegador com o JSZip. */
(()=>{'use strict';
const C=window.MCL_SUPABASE||{};if(!window.supabase?.createClient)return;
const sb=window.supabase.createClient(C.url,C.publishableKey,{auth:{persistSession:true,autoRefreshToken:true}});
const q=(s,r=document)=>r.querySelector(s),qa=(s,r=document)=>[...r.querySelectorAll(s)];
const E=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const M=v=>Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const D=v=>v?new Date(String(v).slice(0,10)+'T12:00:00').toLocaleDateString('pt-BR'):'—';
const localToday=()=>new Date(Date.now()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,10);
const monthLabel=m=>{const s=new Date(m+'-01T12:00:00').toLocaleDateString('pt-BR',{month:'long',year:'numeric'});return s.charAt(0).toUpperCase()+s.slice(1)};
const lastDay=m=>{const [y,mm]=m.split('-').map(Number);return `${m}-${String(new Date(y,mm,0).getDate()).padStart(2,'0')}`};
const PAID=['Pago','Parcial'];

/* ---------- apuração ---------- */
async function inChunks(table,col,ids,build){const out=[];for(let i=0;i<ids.length;i+=150){let from=0;for(;;){const r=await build(sb.from(table).select('*').in(col,ids.slice(i,i+150))).order('id').range(from,from+999);if(r.error)throw r.error;out.push(...(r.data||[]));if(!r.data||r.data.length<1000)break;from+=1000}}return out}
async function apurar(municipioId,mes){
  const m=await sb.from('fin_receb_municipios').select('*').eq('id',municipioId).maybeSingle();if(m.error)throw m.error;if(!m.data)throw new Error('Município não encontrado.');
  const cr=await sb.from('fin_receb_clientes').select('*').eq('municipio_id',municipioId);if(cr.error)throw cr.error;
  const clientes=(cr.data||[]).filter(c=>c.ativo!==false),byId=new Map(clientes.map(c=>[c.id,c])),ids=clientes.map(c=>c.id);
  const ini=`${mes}-01`,fim=lastDay(mes),hoje=localToday();
  const doMes=ids.length?await inChunks('fin_receb_parcelas','cliente_id',ids,x=>x.gte('vencimento',ini).lte('vencimento',fim)):[];
  const pagasNoMes=ids.length?await inChunks('fin_receb_parcelas','cliente_id',ids,x=>x.gte('pago_em',ini).lte('pago_em',fim)):[];
  const validas=doMes.filter(p=>p.status!=='Cancelado');
  const valorPago=p=>Number(p.valor_liquidado||p.valor_previsto||0);
  const nome=p=>byId.get(p.cliente_id)?.nome||'—',codigo=p=>byId.get(p.cliente_id)?.codigo||'';
  // Entradas do mês: pagamentos com data no mês (inclui parcelas de outros meses) + parcelas do mês pagas sem data registrada
  const entradasMap=new Map();
  for(const p of pagasNoMes)if(PAID.includes(p.status))entradasMap.set(p.id,p);
  for(const p of validas)if(PAID.includes(p.status)&&!p.pago_em)entradasMap.set(p.id,p);
  const entradas=[...entradasMap.values()].sort((a,b)=>String(a.pago_em||a.vencimento).localeCompare(String(b.pago_em||b.vencimento)));
  const previsto=validas.reduce((s,p)=>s+Number(p.valor_previsto||0),0);
  const recebidoDoMes=validas.filter(p=>PAID.includes(p.status)).reduce((s,p)=>s+Math.min(valorPago(p),Number(p.valor_previsto||0)||valorPago(p)),0);
  const totalEntradas=entradas.reduce((s,p)=>s+valorPago(p),0);
  const entradasOutrosMeses=entradas.filter(p=>String(p.vencimento||'').slice(0,7)!==mes).reduce((s,p)=>s+valorPago(p),0);
  const abertas=validas.filter(p=>!PAID.includes(p.status));
  const inad=abertas.filter(p=>p.status==='Inadimplente'||(p.vencimento&&p.vencimento<hoje)).map(p=>({...p,dias:Math.max(0,Math.round((new Date(hoje+'T12:00:00')-new Date(p.vencimento+'T12:00:00'))/86400000))})).sort((a,b)=>b.dias-a.dias||Number(b.valor_previsto)-Number(a.valor_previsto));
  const aVencer=abertas.filter(p=>!inad.includes(p)&&!inad.some(i=>i.id===p.id));
  const faltou=Math.max(0,previsto-recebidoDoMes);
  const pagasQtd=validas.filter(p=>PAID.includes(p.status)).length;
  return {
    municipio:m.data,mes,hoje,clientes,
    entradas:entradas.map(p=>({cliente:nome(p),codigo:codigo(p),parcela:p.numero,vencimento:p.vencimento,pago_em:p.pago_em,valor:valorPago(p),outroMes:String(p.vencimento||'').slice(0,7)!==mes})),
    inadimplentes:inad.map(p=>({cliente:nome(p),codigo:codigo(p),parcela:p.numero,vencimento:p.vencimento,valor:Number(p.valor_previsto||0),dias_atraso:p.dias,status:p.status||'Pendente'})),
    aVencer:aVencer.map(p=>({cliente:nome(p),codigo:codigo(p),parcela:p.numero,vencimento:p.vencimento,valor:Number(p.valor_previsto||0)})),
    totais:{clientes:clientes.length,parcelas:validas.length,previsto,recebidoDoMes,faltou,entradas:totalEntradas,entradasOutrosMeses,
      inadimplentesQtd:inad.length,inadimplentesValor:inad.reduce((s,p)=>s+Number(p.valor_previsto||0),0),
      aVencerQtd:aVencer.length,aVencerValor:aVencer.reduce((s,p)=>s+Number(p.valor_previsto||0),0),
      adimplencia:validas.length?Math.round(pagasQtd/validas.length*100):0}
  };
}

/* ---------- IA ---------- */
async function analisar(r){
  const {data:{session}}=await sb.auth.getSession();
  const resp=await fetch('/api/ai-municipio-report',{method:'POST',headers:{'Content-Type':'application/json',...(session?.access_token?{Authorization:`Bearer ${session.access_token}`}:{})},body:JSON.stringify({municipio:`${r.municipio.nome}/${r.municipio.uf||''}`,mes:r.mes,mesLabel:monthLabel(r.mes),hoje:r.hoje,totais:r.totais,inadimplentes:r.inadimplentes})});
  const j=await resp.json().catch(()=>({}));
  if(!resp.ok||!j.ok)throw new Error(j.details||j.error||`HTTP ${resp.status}`);
  return j;
}
function analiseAutomatica(r){const t=r.totais;return{
  resumo_executivo:`Em ${monthLabel(r.mes)}, ${r.municipio.nome} tinha ${t.parcelas} parcela(s) previstas, somando ${M(t.previsto)}. Entraram ${M(t.entradas)} no mês e faltaram ${M(t.faltou)} das parcelas com vencimento no período. A adimplência das parcelas do mês foi de ${t.adimplencia}%.`,
  analise_entradas:`Das parcelas que venciam no mês foram recebidos ${M(t.recebidoDoMes)}.${t.entradasOutrosMeses?` Além disso, entraram ${M(t.entradasOutrosMeses)} referentes a parcelas de outros meses.`:''}`,
  analise_inadimplencia:t.inadimplentesQtd?`${t.inadimplentesQtd} parcela(s) estão vencidas e não pagas, totalizando ${M(t.inadimplentesValor)}.`:'Não há parcelas vencidas sem pagamento neste mês.',
  recomendacoes:[]}}

/* ---------- Word (.docx) com JSZip ---------- */
const X=v=>String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const run=(t,o={})=>`<w:r><w:rPr>${o.b?'<w:b/>':''}${o.color?`<w:color w:val="${o.color}"/>`:''}${o.sz?`<w:sz w:val="${o.sz}"/><w:szCs w:val="${o.sz}"/>`:''}</w:rPr><w:t xml:space="preserve">${X(t)}</w:t></w:r>`;
const para=(content,o={})=>`<w:p><w:pPr>${o.style?`<w:pStyle w:val="${o.style}"/>`:''}${o.align?`<w:jc w:val="${o.align}"/>`:''}${o.after!=null?`<w:spacing w:after="${o.after}"/>`:''}</w:pPr>${typeof content==='string'?run(content,o):content.join('')}</w:p>`;
const bullet=t=>`<w:p><w:pPr><w:pStyle w:val="ListParagraph"/><w:ind w:left="360" w:hanging="240"/></w:pPr>${run('•  ')}${run(t)}</w:p>`;
function table(headers,rows,widths,alignRight=[]){
  const cell=(t,w,head,right)=>`<w:tc><w:tcPr><w:tcW w:w="${w}" w:type="dxa"/>${head?'<w:shd w:val="clear" w:color="auto" w:fill="1D2139"/>':''}<w:vAlign w:val="center"/></w:tcPr><w:p><w:pPr><w:spacing w:before="40" w:after="40"/>${right?'<w:jc w:val="right"/>':''}</w:pPr>${run(t,{b:head,color:head?'FFFFFF':null,sz:18})}</w:p></w:tc>`;
  const border='<w:top w:val="single" w:sz="4" w:color="D9DCE3"/><w:left w:val="single" w:sz="4" w:color="D9DCE3"/><w:bottom w:val="single" w:sz="4" w:color="D9DCE3"/><w:right w:val="single" w:sz="4" w:color="D9DCE3"/><w:insideH w:val="single" w:sz="4" w:color="D9DCE3"/><w:insideV w:val="single" w:sz="4" w:color="D9DCE3"/>';
  return `<w:tbl><w:tblPr><w:tblW w:w="${widths.reduce((a,b)=>a+b,0)}" w:type="dxa"/><w:tblBorders>${border}</w:tblBorders><w:tblCellMar><w:left w:w="80" w:type="dxa"/><w:right w:w="80" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid>${widths.map(w=>`<w:gridCol w:w="${w}"/>`).join('')}</w:tblGrid>
  <w:tr><w:trPr><w:tblHeader/></w:trPr>${headers.map((h,i)=>cell(h,widths[i],true,alignRight.includes(i))).join('')}</w:tr>
  ${rows.map(r=>`<w:tr><w:trPr><w:cantSplit/></w:trPr>${r.map((c,i)=>cell(c,widths[i],false,alignRight.includes(i))).join('')}</w:tr>`).join('')}</w:tbl>${para('',{after:120})}`;
}
function documentXml(r,a,iaInfo){
  const t=r.totais,title=`Relatório de Recebimentos — ${r.municipio.nome}${r.municipio.uf?`/${r.municipio.uf}`:''}`;
  const body=[];
  body.push(para([run('MINHA CASA LEGAL',{b:true,color:'EF5841',sz:18})],{after:40}));
  body.push(para(title,{style:'Title'}));
  body.push(para([run(`Competência: ${monthLabel(r.mes)}   •   Emitido em ${D(r.hoje)}`,{color:'5F6377',sz:20})],{after:240}));
  body.push(para('Resumo do mês',{style:'Heading1'}));
  body.push(table(['Indicador','Valor'],[
    ['Clientes ativos no município',String(t.clientes)],
    ['Parcelas com vencimento no mês',String(t.parcelas)],
    ['Total previsto no mês',M(t.previsto)],
    ['Total que entrou no mês',M(t.entradas)],
    ['   • referente às parcelas do mês',M(t.recebidoDoMes)],
    ['   • referente a parcelas de outros meses',M(t.entradasOutrosMeses)],
    ['Quanto faltou (previsto − recebido das parcelas do mês)',M(t.faltou)],
    ['Inadimplentes (parcelas vencidas sem pagamento)',`${t.inadimplentesQtd} • ${M(t.inadimplentesValor)}`],
    ['Parcelas a vencer no mês',`${t.aVencerQtd} • ${M(t.aVencerValor)}`],
    ['Adimplência das parcelas do mês',`${t.adimplencia}%`]
  ],[6400,3200],[1]));
  body.push(para('Análise',{style:'Heading1'}));
  body.push(para(a.resumo_executivo||''));
  body.push(para('Entradas',{style:'Heading2'}));body.push(para(a.analise_entradas||''));
  body.push(para('Inadimplência',{style:'Heading2'}));body.push(para(a.analise_inadimplencia||''));
  if((a.recomendacoes||[]).length){body.push(para('Recomendações',{style:'Heading2'}));for(const x of a.recomendacoes)body.push(bullet(x))}
  body.push(para([run(iaInfo,{color:'5F6377',sz:16})],{after:200}));
  body.push(para(`Entradas do mês (${r.entradas.length})`,{style:'Heading1'}));
  body.push(r.entradas.length?table(['Cliente','Código','Parcela','Vencimento','Pago em','Valor pago'],r.entradas.map(e=>[e.cliente+(e.outroMes?' *':''),e.codigo,`#${e.parcela}`,D(e.vencimento),D(e.pago_em),M(e.valor)]),[3000,1200,900,1300,1300,1900],[5]):para('Nenhuma entrada registrada no mês.'));
  if(r.entradas.some(e=>e.outroMes))body.push(para([run('* Pagamento no mês de parcela com vencimento em outro mês.',{color:'5F6377',sz:16})]));
  body.push(para(`Inadimplentes (${r.inadimplentes.length})`,{style:'Heading1'}));
  body.push(r.inadimplentes.length?table(['Cliente','Código','Parcela','Vencimento','Dias em atraso','Valor'],r.inadimplentes.map(e=>[e.cliente,e.codigo,`#${e.parcela}`,D(e.vencimento),String(e.dias_atraso),M(e.valor)]),[3000,1200,900,1300,1400,1800],[4,5]):para('Nenhuma parcela vencida sem pagamento no mês.'));
  if(r.aVencer.length){body.push(para(`Parcelas do mês ainda a vencer (${r.aVencer.length})`,{style:'Heading1'}));body.push(table(['Cliente','Código','Parcela','Vencimento','Valor'],r.aVencer.map(e=>[e.cliente,e.codigo,`#${e.parcela}`,D(e.vencimento),M(e.valor)]),[3600,1400,1000,1600,2000],[4]))}
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>${body.join('')}<w:sectPr><w:footerReference w:type="default" r:id="rIdFooter"/><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="567" w:footer="567" w:gutter="0"/></w:sectPr></w:body></w:document>`;
}
const STYLES=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:color w:val="1D2139"/><w:sz w:val="21"/><w:szCs w:val="21"/><w:lang w:val="pt-BR"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>
<w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:after="60"/></w:pPr><w:rPr><w:b/><w:color w:val="1D2139"/><w:sz w:val="36"/><w:szCs w:val="36"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:pPr><w:keepNext/><w:spacing w:before="280" w:after="120"/><w:pBdr><w:bottom w:val="single" w:sz="8" w:space="2" w:color="00ADF2"/></w:pBdr><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b/><w:caps/><w:color w:val="1D2139"/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:pPr><w:keepNext/><w:spacing w:before="160" w:after="60"/><w:outlineLvl w:val="1"/></w:pPr><w:rPr><w:b/><w:color w:val="EF5841"/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="ListParagraph"><w:name w:val="List Paragraph"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:after="60"/></w:pPr></w:style></w:styles>`;
const footerXml=txt=>`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p><w:pPr><w:jc w:val="center"/></w:pPr>${run(txt,{color:'5F6377',sz:16})}<w:r><w:rPr><w:color w:val="5F6377"/><w:sz w:val="16"/></w:rPr><w:t xml:space="preserve">  •  Página </w:t></w:r><w:r><w:rPr><w:color w:val="5F6377"/><w:sz w:val="16"/></w:rPr><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:rPr><w:color w:val="5F6377"/><w:sz w:val="16"/></w:rPr><w:instrText xml:space="preserve"> PAGE </w:instrText></w:r><w:r><w:rPr><w:color w:val="5F6377"/><w:sz w:val="16"/></w:rPr><w:fldChar w:fldCharType="end"/></w:r></w:p></w:ftr>`;
async function buildDocx(r,a,iaInfo){
  if(!window.JSZip)throw new Error('Biblioteca de arquivos não carregou. Recarregue a página.');
  const zip=new window.JSZip(),add=zip.file.bind(zip);zip.file=(name,data)=>add(name,data,{createFolders:false});/* sem entradas de pasta no pacote */
  zip.file('[Content_Types].xml','<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>');
  zip.file('_rels/.rels','<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>');
  zip.file('word/_rels/document.xml.rels','<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rIdFooter" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/></Relationships>');
  zip.file('word/styles.xml',STYLES);
  zip.file('word/footer1.xml',footerXml(`Minha Casa Legal • Financeiro MCL • ${r.municipio.nome} • ${monthLabel(r.mes)}`));
  zip.file('word/document.xml',documentXml(r,a,iaInfo));
  zip.file('docProps/core.xml',`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${X(`Relatório de Recebimentos — ${r.municipio.nome} — ${monthLabel(r.mes)}`)}</dc:title><dc:creator>Financeiro MCL</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${new Date().toISOString().slice(0,19)}Z</dcterms:created></cp:coreProperties>`);
  return zip.generateAsync({type:'blob',mimeType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',compression:'DEFLATE'});
}
function download(blob,name){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.append(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},1000)}
const slug=s=>String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-zA-Z0-9]+/g,'-').replace(/^-|-$/g,'').toLowerCase();

/* ---------- tela ---------- */
async function openModal(){
  const {data,error}=await sb.from('fin_receb_municipios').select('id,nome,uf,ativo').order('nome');if(error)return alert(error.message);
  const munis=(data||[]).filter(m=>m.ativo!==false);if(!munis.length)return alert('Cadastre um município primeiro.');
  const mes=q('#recebMonth')?.value||localToday().slice(0,7);
  const x=document.createElement('div');x.className='modal-backdrop';x.style.zIndex='10040';
  x.innerHTML=`<section class="modal" style="width:min(560px,96vw)"><div class="modal-head"><h3>Relatório do município</h3><button type="button" class="btn ghost small" data-x>Fechar</button></div><form id="mclMuniReport"><div class="modal-body"><div class="form-grid"><div class="field full"><label>Município</label><select name="municipio" required><option value="">Selecione o município</option>${munis.map(m=>`<option value="${E(m.id)}">${E(m.nome)}${m.uf?`/${E(m.uf)}`:''}</option>`).join('')}</select></div><div class="field full"><label>Mês de referência</label><input name="mes" type="month" value="${E(mes)}" required></div></div><div class="notice" style="margin-top:12px">O relatório traz as entradas do mês, os inadimplentes, o total que entrou e quanto faltou, com análise escrita pela IA financeira. O arquivo é gerado em Word (.docx).</div><div class="muted" data-status style="margin-top:12px;min-height:20px"></div></div><div class="modal-foot"><button class="btn" type="submit">Gerar relatório</button></div></form></section>`;
  document.body.append(x);qa('[data-x]',x).forEach(b=>b.onclick=()=>x.remove());
  const form=q('#mclMuniReport',x),status=q('[data-status]',x),btn=q('[type=submit]',x);
  form.onsubmit=async e=>{e.preventDefault();const f=Object.fromEntries(new FormData(form));if(!f.municipio)return;btn.disabled=true;
    try{
      status.textContent='Apurando entradas e inadimplentes...';
      const r=await apurar(f.municipio,f.mes);
      status.textContent='A IA está escrevendo a análise...';
      let a,iaInfo;
      try{a=await analisar(r);iaInfo=`Análise gerada pela IA financeira (${a.model||'modelo configurado'}) a partir dos números apurados no sistema.`}
      catch(err){console.warn('Relatório do município: IA indisponível',err);a=analiseAutomatica(r);iaInfo=`A IA financeira não respondeu (${err.message||err}); a análise acima foi montada automaticamente a partir dos números.`;
        if(!confirm(`A IA financeira não respondeu:\n${err.message||err}\n\nGerar o relatório com uma análise automática, sem IA?`)){status.textContent='Relatório cancelado.';btn.disabled=false;return}}
      status.textContent='Montando o arquivo Word...';
      const blob=await buildDocx(r,a,iaInfo);
      download(blob,`relatorio-recebimentos-${slug(r.municipio.nome)}-${r.mes}.docx`);
      status.innerHTML=`<b>Relatório gerado.</b> Entrou ${E(M(r.totais.entradas))} • faltou ${E(M(r.totais.faltou))} • ${r.totais.inadimplentesQtd} inadimplente(s).`;
    }catch(err){console.error(err);status.textContent='Não foi possível gerar o relatório: '+(err.message||err)}
    finally{btn.disabled=false}};
}
function install(){
  if((q('#title')?.textContent||'').trim()!=='Recebimentos')return;
  const right=q('#content .receb-toolbar .right')||q('#content .toolbar .right');if(!right||q('#mclMuniReportBtn',right))return;
  const b=document.createElement('button');b.type='button';b.id='mclMuniReportBtn';b.className='btn orange';b.textContent='Relatório do município';b.onclick=openModal;right.prepend(b);
}
new MutationObserver(()=>queueMicrotask(install)).observe(document.documentElement,{childList:true,subtree:true});
window.MCLRelatorioMunicipio={open:openModal,apurar,buildDocx};
})();

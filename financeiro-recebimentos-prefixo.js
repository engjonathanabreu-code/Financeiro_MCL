(function(){
'use strict';
const cfg=window.MCL_SUPABASE||{};
const sb=window.supabase?.createClient?.(cfg.url,cfg.publishableKey,{auth:{persistSession:true,autoRefreshToken:true}});
if(!sb)return;
const q=(s,r=document)=>r.querySelector(s),qa=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const norm=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toUpperCase();
const cleanPrefix=v=>norm(v).replace(/[^A-Z0-9]/g,'');
const uid=()=>crypto.randomUUID();

function closeModal(){q('#recebModal')?.remove()}
function modal(title,body,footer=''){
 closeModal();
 const d=document.createElement('div');d.id='recebModal';d.className='modal-backdrop';
 d.innerHTML=`<section class="modal"><header class="modal-head"><h3>${esc(title)}</h3><button class="btn icon ghost" data-prefix-close>×</button></header><div class="modal-body">${body}</div><footer class="modal-foot"><button class="btn ghost" data-prefix-close>Fechar</button>${footer}</footer></section>`;
 document.body.appendChild(d);qa('[data-prefix-close]',d).forEach(x=>x.onclick=closeModal);return d;
}
async function municipios(){const r=await sb.from('fin_receb_municipios').select('*').order('nome');if(r.error)throw r.error;return r.data||[]}
function matchMunicipio(code,list){const c=cleanPrefix(code);const valid=list.filter(m=>cleanPrefix(m.prefixo)).sort((a,b)=>cleanPrefix(b.prefixo).length-cleanPrefix(a.prefixo).length);return valid.find(m=>c.startsWith(cleanPrefix(m.prefixo)))||null}
function extractRemessa(code,fileName){
 const raw=norm(code),base=norm(String(fileName||'').replace(/\.[^.]+$/,''));
 const pick=s=>{const m=s.match(/([A-Z]+\d{1,4})/);return m?.[1]||null};
 return pick(raw)||pick(base)||null;
}
function xlsDate(v){if(v==null||v==='')return null;if(v instanceof Date&&!isNaN(v))return v;if(typeof v==='number'&&window.XLSX?.SSF?.parse_date_code){const d=window.XLSX.SSF.parse_date_code(v);if(d)return new Date(d.y,d.m-1,d.d||1,12)}const d=new Date(v);return isNaN(d)?null:d}
function ymd15(d){return d?`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-15`:null}
function monthCount(a,b){if(!a||!b)return 1;return Math.max(1,(b.getFullYear()-a.getFullYear())*12+b.getMonth()-a.getMonth()+1)}
function findHeader(rows){for(let i=0;i<Math.min(rows.length,30);i++){const r=(rows[i]||[]).map(norm);if(r.some(x=>['COD','CODIGO','CÓDIGO'].includes(x))&&r.some(x=>['NOME','CLIENTE'].includes(x)))return i}return -1}
function col(headers,aliases){const h=headers.map(norm);for(const a of aliases){const i=h.indexOf(norm(a));if(i>=0)return i}return -1}
async function parseWorkbook(file){
 if(!window.XLSX)throw new Error('Leitor Excel não carregado.');
 const munis=await municipios(),buf=await file.arrayBuffer(),wb=window.XLSX.read(buf,{type:'array',cellDates:false});let entries=[];
 wb.SheetNames.forEach(sheet=>{
  const rows=window.XLSX.utils.sheet_to_json(wb.Sheets[sheet],{header:1,raw:true,defval:null}),hi=findHeader(rows);if(hi<0)return;
  const h=rows[hi]||[],ci=col(h,['COD','CÓDIGO','CODIGO']),ni=col(h,['NOME','CLIENTE']),ii=col(h,['INÍCIO','INICIO','1º VENCIMENTO','PRIMEIRO VENCIMENTO']),fi=col(h,['FIM','ÚLTIMO VENCIMENTO','ULTIMO VENCIMENTO']),vi=col(h,['VLR.PARC.','VLR PARC','VALOR PARCELA','PARCELA','VALOR']);
  if(ci<0||ni<0)return;
  for(let r=hi+1;r<rows.length;r++){
   const row=rows[r]||[],codigo=String(row[ci]??'').trim(),nome=String(row[ni]??'').trim();if(!codigo||!nome)continue;
   if(['JUROS','MULTA','TOTAL','OBS','OBSERVAÇÃO','OBSERVACAO'].includes(norm(codigo)))continue;
   const start=xlsDate(row[ii]),end=xlsDate(row[fi]??row[ii]),vp=Number(row[vi]||0);if(!start||!vp)continue;
   const m=matchMunicipio(codigo,munis)||matchMunicipio(file.name,munis),remessa=extractRemessa(codigo,file.name);
   entries.push({codigo,nome,municipio:m,remessa,primeiro_vencimento:ymd15(start),numero_parcelas:monthCount(start,end||start),valor_parcela:vp});
  }
 });
 return {entries,munis};
}
async function ensureRemessa(m,codigo,fileName,first){if(!codigo)return null;const r=await sb.from('fin_receb_remessas').select('*').eq('municipio_id',m.id).eq('codigo',codigo).limit(1);if(r.error)throw r.error;if(r.data?.length)return r.data[0];const ins=await sb.from('fin_receb_remessas').insert({municipio_id:m.id,codigo,nome:String(fileName||'').replace(/\.[^.]+$/,'')||codigo,data_emissao:first||new Date().toISOString().slice(0,10),observacoes:'Criada automaticamente na importação de planilha.',ativo:true}).select().single();if(ins.error)throw ins.error;return ins.data}
async function importEntries(entries,fileName,status){let imported=0,skipped=0,failed=0;for(const e of entries){try{const m=e.municipio;if(!m)throw new Error('Município sem prefixo reconhecido');const ex=await sb.from('fin_receb_clientes').select('id').eq('municipio_id',m.id).eq('codigo',e.codigo).limit(1);if(ex.error)throw ex.error;if(ex.data?.length){skipped++;continue}const rem=await ensureRemessa(m,e.remessa,fileName,e.primeiro_vencimento),count=e.numero_parcelas,vp=e.valor_parcela;const client=await sb.from('fin_receb_clientes').insert({municipio_id:m.id,remessa_id:rem?.id||null,codigo:e.codigo,nome:e.nome,valor_global:Number((vp*count).toFixed(2)),valor_entrada:0,numero_parcelas:count,valor_parcela:vp,primeiro_vencimento:e.primeiro_vencimento,dia_vencimento:15,ativo:true}).select().single();if(client.error)throw client.error;const d0=new Date(e.primeiro_vencimento+'T12:00:00'),ps=[];for(let i=0;i<count;i++){const d=new Date(d0.getFullYear(),d0.getMonth()+i,15,12);ps.push({id:uid(),cliente_id:client.data.id,numero:i+1,vencimento:d.toISOString().slice(0,10),valor_previsto:vp,status:'Pendente',valor_liquidado:0,diferenca:0})}const pr=await sb.from('fin_receb_parcelas').insert(ps);if(pr.error){await sb.from('fin_receb_clientes').delete().eq('id',client.data.id);throw pr.error}imported++}catch(_){failed++}if(status)status.textContent=`Importando... ${imported} incluído(s), ${skipped} já existente(s), ${failed} falha(s).`}return{imported,skipped,failed}}

async function openPrefixes(){
 const list=await municipios();
 const rows=list.map(m=>`<tr><td><b>${esc(m.nome)}</b><small class="muted">${esc(m.uf)}</small></td><td><input class="prefix-input" data-id="${m.id}" value="${esc(m.prefixo||'')}" maxlength="12" placeholder="Ex.: AGRO"></td></tr>`).join('');
 const d=modal('Prefixos dos municípios',`<div class="notice">Defina o código que identifica cada município nas planilhas. O importador compara o início do COD e também o nome do arquivo. Ex.: prefixo <b>AGRO</b> reconhece códigos como <b>AGRO4</b>, <b>AGRO04A</b> e arquivos como <b>AGRO4.xlsx</b>.</div><div class="table-wrap" style="margin-top:14px"><table class="table"><thead><tr><th>Município</th><th>Prefixo para Excel</th></tr></thead><tbody>${rows||'<tr><td colspan="2">Nenhum município cadastrado.</td></tr>'}</tbody></table></div>`,`<button class="btn" id="savePrefixes">Salvar prefixos</button>`);
 q('#savePrefixes',d).onclick=async()=>{const vals=qa('.prefix-input',d).map(x=>({id:x.dataset.id,prefixo:cleanPrefix(x.value)||null}));const used=new Map();for(const v of vals){if(!v.prefixo)continue;if(used.has(v.prefixo))return alert(`O prefixo ${v.prefixo} está repetido.`);used.set(v.prefixo,v.id)}q('#savePrefixes',d).disabled=true;for(const v of vals){const r=await sb.from('fin_receb_municipios').update({prefixo:v.prefixo}).eq('id',v.id);if(r.error){q('#savePrefixes',d).disabled=false;return alert(r.error.message)}}closeModal();alert('Prefixos salvos. A importação Excel já usará esses códigos.')};
}
function openNewMunicipio(){
 const d=modal('Novo município',`<form id="prefixMuniForm" class="form-grid"><div class="field full"><label>Município</label><input name="nome" required></div><div class="field"><label>UF</label><input name="uf" value="SC" maxlength="2"></div><div class="field"><label>Prefixo para Excel</label><input name="prefixo" maxlength="12" placeholder="Ex.: AGRO" required><small class="muted">Será usado para identificar o município pelo COD ou pelo nome do arquivo.</small></div></form>`,`<button class="btn" id="savePrefixMuni">Salvar</button>`);
 q('#savePrefixMuni',d).onclick=async()=>{const f=Object.fromEntries(new FormData(q('#prefixMuniForm',d))),prefixo=cleanPrefix(f.prefixo);if(!String(f.nome||'').trim()||!prefixo)return alert('Informe município e prefixo.');const dup=await sb.from('fin_receb_municipios').select('id,nome').eq('prefixo',prefixo).limit(1);if(dup.error)return alert(dup.error.message);if(dup.data?.length)return alert(`O prefixo ${prefixo} já está sendo usado.`);const r=await sb.from('fin_receb_municipios').insert({nome:String(f.nome).trim(),uf:String(f.uf||'SC').toUpperCase(),prefixo,ativo:true});if(r.error)return alert(r.error.message);closeModal();document.querySelector('.nav [data-view="receivables"]')?.click()};
}
async function openImport(){
 const list=await municipios();if(!list.length)return alert('Cadastre ao menos um município e seu prefixo antes de importar.');if(!list.some(m=>cleanPrefix(m.prefixo)))return alert('Cadastre o prefixo do município antes de importar a planilha.');
 const d=modal('Importar dados clientes',`<div class="form-grid"><div class="field full"><label>Planilha Excel</label><input id="prefixClientsFile" type="file" accept=".xlsx,.xls,.xlsb,.csv"></div><div class="field full"><div class="notice">O sistema identifica o município pelo <b>prefixo cadastrado</b>, comparando o início da coluna COD e o nome do arquivo.</div></div><div id="prefixPreview" class="field full"></div><div id="prefixStatus" class="field full"></div></div>`,`<button class="btn" id="prefixImportSave">Importar</button>`);
 const input=q('#prefixClientsFile',d),preview=q('#prefixPreview',d),status=q('#prefixStatus',d),save=q('#prefixImportSave',d);let parsed=[];
 input.onchange=async()=>{parsed=[];preview.textContent='Lendo planilha...';try{const out=await parseWorkbook(input.files[0]);parsed=out.entries;const unknown=parsed.filter(x=>!x.municipio),found=[...new Set(parsed.filter(x=>x.municipio).map(x=>`${x.municipio.nome} (${x.municipio.prefixo})`))];preview.innerHTML=`<div class="receb-import-preview"><b>${parsed.length}</b> linha(s) reconhecida(s)<br>Município(s): ${esc(found.join(', ')||'nenhum')}${unknown.length?`<br><span style="color:#a33"><b>${unknown.length}</b> linha(s) sem prefixo reconhecido.</span>`:''}</div>`}catch(e){preview.innerHTML=`<div class="notice danger">${esc(e.message)}</div>`}};
 save.onclick=async()=>{if(!input.files[0])return alert('Selecione a planilha.');if(!parsed.length){try{parsed=(await parseWorkbook(input.files[0])).entries}catch(e){return alert(e.message)}}if(!parsed.length)return alert('Nenhum cliente reconhecido na planilha.');const unknown=parsed.filter(x=>!x.municipio);if(unknown.length)return alert(`Há ${unknown.length} linha(s) cujo prefixo não corresponde a nenhum município cadastrado. Corrija os prefixos antes de importar.`);save.disabled=true;status.textContent='Importando clientes e parcelas...';const r=await importEntries(parsed,input.files[0].name,status);status.innerHTML=`<div class="notice ok"><b>${r.imported}</b> cliente(s) importado(s); <b>${r.skipped}</b> já existente(s); <b>${r.failed}</b> falha(s).</div>`;save.disabled=false};
}
function injectButton(){const toolbar=q('.receb-toolbar .right');if(!toolbar||q('#prefixMuni',toolbar))return;const b=document.createElement('button');b.id='prefixMuni';b.className='btn secondary';b.textContent='Prefixos Excel';const ref=q('#importClients',toolbar);toolbar.insertBefore(b,ref||toolbar.firstChild);b.onclick=e=>{e.preventDefault();e.stopPropagation();openPrefixes().catch(x=>alert(x.message))}}

document.addEventListener('click',e=>{
 const imp=e.target.closest?.('#importClients');if(imp){e.preventDefault();e.stopImmediatePropagation();openImport().catch(x=>alert(x.message));return}
 const nm=e.target.closest?.('#newMuni');if(nm){e.preventDefault();e.stopImmediatePropagation();openNewMunicipio()}
},true);
const obs=new MutationObserver(injectButton);obs.observe(document.documentElement,{subtree:true,childList:true});window.addEventListener('load',injectButton);setTimeout(injectButton,300);
})();
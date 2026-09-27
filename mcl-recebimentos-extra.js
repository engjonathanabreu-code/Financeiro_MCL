/* Financeiro MCL — Recebimentos: botões que faltavam.
   • Município: Editar (nome, UF, prefixo) e Arquivar.
   • Cliente: Arquivar (no lugar de excluir quando há histórico).
   • Arquivados: lista de municípios e clientes arquivados, com Reativar.
   • Parcela: Editar (número, vencimento, valor, status, pagamento) e "+ Parcela" no histórico.
   Arquivar usa a coluna "ativo" das tabelas; nenhum registro é apagado. */
(()=>{'use strict';
const C=window.MCL_SUPABASE||{};if(!window.supabase?.createClient)return;
const sb=window.supabase.createClient(C.url,C.publishableKey,{auth:{persistSession:true,autoRefreshToken:true}});
const q=(s,r=document)=>r.querySelector(s),qa=(s,r=document)=>[...r.querySelectorAll(s)];
const E=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const M=v=>Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const D=v=>v?new Date(String(v).slice(0,10)+'T12:00:00').toLocaleDateString('pt-BR'):'—';
const isAdmin=()=>/Administrador/i.test(q('.user-mini')?.textContent||'');
const refresh=async()=>{try{await window.MCLRecebimentos?.open?.()}catch(e){console.error(e)}};
function modal(title,body,foot=''){const x=document.createElement('div');x.className='modal-backdrop';x.style.zIndex='10040';x.innerHTML=`<section class="modal" style="width:min(640px,96vw)"><div class="modal-head"><h3>${E(title)}</h3><button type="button" class="btn ghost small" data-x>Fechar</button></div><div class="modal-body">${body}</div>${foot?`<div class="modal-foot">${foot}</div>`:''}</section>`;document.body.append(x);qa('[data-x]',x).forEach(b=>b.onclick=()=>x.remove());return x}
const msg=(x,t)=>{const n=q('[data-msg]',x);if(n){n.hidden=false;n.textContent=t}};

/* ---------- Município: editar e arquivar ---------- */
async function editMunicipio(id){
  const {data:m,error}=await sb.from('fin_receb_municipios').select('*').eq('id',id).maybeSingle();if(error||!m)return alert(error?.message||'Município não encontrado.');
  const x=modal('Editar município',`<form id="mclMuniForm"><div class="form-grid"><div class="field full"><label>Município</label><input name="nome" value="${E(m.nome)}" required></div><div class="field"><label>UF</label><input name="uf" value="${E(m.uf||'SC')}" maxlength="2"></div><div class="field"><label>Prefixo</label><input name="prefixo" value="${E(m.prefixo||'')}"></div></div><div class="notice danger" data-msg hidden></div></form>`,'<button class="btn" form="mclMuniForm">Salvar</button>');
  q('#mclMuniForm',x).onsubmit=async e=>{e.preventDefault();const f=Object.fromEntries(new FormData(e.target)),prefixo=String(f.prefixo||'').trim().toUpperCase()||null,nome=String(f.nome).trim();
    const all=await sb.from('fin_receb_municipios').select('id,nome,prefixo');if(all.error)return msg(x,all.error.message);
    if(prefixo&&(all.data||[]).some(o=>o.id!==m.id&&String(o.prefixo||'').toUpperCase()===prefixo))return msg(x,`O prefixo ${prefixo} já está em uso por outro município.`);
    if((all.data||[]).some(o=>o.id!==m.id&&String(o.nome||'').trim().toLowerCase()===nome.toLowerCase()))return msg(x,'Já existe outro município com esse nome.');
    const r=await sb.from('fin_receb_municipios').update({nome,uf:String(f.uf||'').toUpperCase()||null,prefixo}).eq('id',m.id);if(r.error)return msg(x,r.error.message);x.remove();refresh()};
}
async function archiveMunicipio(id,name){
  if(!confirm(`Arquivar o município ${name}?\n\nEle e seus clientes deixam de aparecer nos totais, mas nenhum dado é apagado. Você pode reativar em "Arquivados".`))return;
  const r=await sb.from('fin_receb_municipios').update({ativo:false}).eq('id',id);if(r.error)return alert(r.error.message);refresh();
}
function decorateMunicipios(){
  if((q('#title')?.textContent||'').trim()!=='Recebimentos'||!isAdmin())return;
  qa('#content [data-open]').forEach(b=>{const td=b.closest('td');if(!td||q('[data-mcl-muni-edit]',td))return;const tr=b.closest('tr'),name=(q('td b',tr)?.textContent||'').trim();
    const ed=document.createElement('button');ed.type='button';ed.className='btn small ghost';ed.dataset.mclMuniEdit=b.dataset.open;ed.textContent='Editar';ed.onclick=e=>{e.stopPropagation();editMunicipio(b.dataset.open)};
    const ar=document.createElement('button');ar.type='button';ar.className='btn small ghost';ar.textContent='Arquivar';ar.onclick=e=>{e.stopPropagation();archiveMunicipio(b.dataset.open,name)};
    td.style.whiteSpace='nowrap';b.after(ed,ar);ed.style.marginLeft='6px';ar.style.marginLeft='6px'});
  const right=q('#content .receb-toolbar .right')||q('#content .toolbar .right');
  if(right&&!q('#mclRecebArchived',right)){const b=document.createElement('button');b.type='button';b.id='mclRecebArchived';b.className='btn ghost';b.textContent='Arquivados';b.onclick=openArchived;right.append(b)}
}

/* ---------- Arquivados ---------- */
async function openArchived(){
  const [m,c,all]=await Promise.all([sb.from('fin_receb_municipios').select('*').eq('ativo',false).order('nome'),sb.from('fin_receb_clientes').select('*').eq('ativo',false).order('nome'),sb.from('fin_receb_municipios').select('id,nome')]);
  const err=[m,c,all].find(r=>r.error);if(err)return alert(err.error.message);
  const muniName=id=>(all.data||[]).find(x=>x.id===id)?.nome||'—';
  const row=(t,id,label,sub)=>`<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--line)"><span><b>${E(label)}</b><br><small class="muted">${E(sub)}</small></span><button type="button" class="btn small" data-react="${t}:${id}">Reativar</button></div>`;
  const x=modal('Arquivados',`<h4>Municípios</h4>${(m.data||[]).map(o=>row('m',o.id,o.nome,(o.uf||'')+(o.prefixo?` • prefixo ${o.prefixo}`:''))).join('')||'<div class="empty">Nenhum município arquivado.</div>'}<h4 style="margin-top:20px">Clientes</h4>${(c.data||[]).map(o=>row('c',o.id,o.nome,`${o.codigo||o.cpf_cnpj||''} • ${muniName(o.municipio_id)}`)).join('')||'<div class="empty">Nenhum cliente arquivado.</div>'}`);
  qa('[data-react]',x).forEach(b=>b.onclick=async()=>{const [t,id]=b.dataset.react.split(':');const r=await sb.from(t==='m'?'fin_receb_municipios':'fin_receb_clientes').update({ativo:true}).eq('id',id);if(r.error)return alert(r.error.message);b.closest('div').remove();refresh()});
}

/* ---------- Cliente: arquivar ---------- */
function decorateClientDetail(){
  const del=q('#recebModal #delC');if(!del||q('#mclArchC'))return;
  const title=(q('#recebModal .modal-head h3, #recebModal h3')?.textContent||'').replace(/^Cliente\s*—\s*/,'').trim();
  const b=document.createElement('button');b.type='button';b.id='mclArchC';b.className='btn secondary';b.textContent='Arquivar';del.before(b);
  b.onclick=async()=>{const {data,error}=await sb.from('fin_receb_clientes').select('id,nome').eq('nome',title);if(error)return alert(error.message);if(!data?.length)return alert('Cliente não encontrado.');if(data.length>1)return alert('Há mais de um cliente com este nome. Arquive pelo cartão do cliente no município.');if(!confirm(`Arquivar ${data[0].nome}?\n\nO cliente e o histórico de parcelas são mantidos; ele só deixa de aparecer nos totais. Você pode reativar em "Arquivados".`))return;const r=await sb.from('fin_receb_clientes').update({ativo:false}).eq('id',data[0].id);if(r.error)return alert(r.error.message);q('#recebModal')?.remove();refresh()};
}

function decorateClientCards(){
  if(!isAdmin())return;
  qa(".receb-client-card[data-client-id]").forEach(card=>{if(q("[data-mcl-card-arch]",card))return;const del=[...card.querySelectorAll("button")].find(b=>/^Excluir$/i.test(b.textContent.trim()));if(!del)return;
    const b=document.createElement("button");b.type="button";b.className=del.className.replace(/danger/,"").trim()||"btn small ghost";b.dataset.mclCardArch="1";b.textContent="Arquivar";
    b.onclick=async e=>{e.stopPropagation();const id=card.dataset.clientId,name=(q("h4",card)?.textContent||"cliente").trim();if(!confirm(`Arquivar ${name}?

O cliente e o histórico de parcelas são mantidos; ele só deixa de aparecer nos totais. Você pode reativar em "Arquivados".`))return;const r=await sb.from("fin_receb_clientes").update({ativo:false}).eq("id",id);if(r.error)return alert(r.error.message);card.remove();refresh()};
    del.before(b)});
}

/* ---------- Parcelas: editar e lançar ---------- */
const STATUS=['Pendente','Aberto','Pago','Parcial','Inadimplente','Cancelado'];
function parcelForm(clientId,parcel=null,nextNumero=1,nextDue=''){
  const p=parcel||{};const statuses=[...new Set([...STATUS,...(p.status?[p.status]:[])])];
  const x=modal(parcel?`Editar parcela #${p.numero}`:'Nova parcela',`<form id="mclParcelForm"><div class="form-grid"><div class="field"><label>Número</label><input name="numero" type="number" min="1" value="${E(p.numero??nextNumero)}" required></div><div class="field"><label>Vencimento</label><input name="vencimento" type="date" value="${E(p.vencimento||nextDue)}" required></div><div class="field"><label>Valor previsto</label><input name="valor_previsto" type="number" step="0.01" min="0" value="${E(p.valor_previsto??'')}" required></div><div class="field"><label>Status</label><select name="status">${statuses.map(s=>`<option ${s===(p.status||'Pendente')?'selected':''}>${E(s)}</option>`).join('')}</select></div><div class="field"><label>Pago em</label><input name="pago_em" type="date" value="${E(p.pago_em||'')}"></div><div class="field"><label>Valor pago</label><input name="valor_liquidado" type="number" step="0.01" min="0" value="${E(p.valor_liquidado??'')}"></div><div class="field full"><label>Nosso número / documento</label><input name="nosso_numero" value="${E(p.nosso_numero||'')}"></div></div><div class="notice danger" data-msg hidden></div></form>`,'<button class="btn" form="mclParcelForm">Salvar parcela</button>');
  q('#mclParcelForm',x).onsubmit=async e=>{e.preventDefault();const f=Object.fromEntries(new FormData(e.target)),paid=['Pago','Parcial'].includes(f.status);
    if(paid&&!f.pago_em)return msg(x,'Informe a data do pagamento.');
    const prev=Number(f.valor_previsto||0),liq=paid?Number(f.valor_liquidado||prev):null;
    const row={numero:Number(f.numero),vencimento:f.vencimento,valor_previsto:prev,status:f.status,pago_em:paid?f.pago_em:null,valor_liquidado:liq,diferenca:paid?liq-prev:0,nosso_numero:String(f.nosso_numero||'').trim()||null};
    if(parcel&&['Pago','Parcial'].includes(parcel.status)&&!paid&&!confirm('A parcela deixará de constar como paga e o valor pago será apagado. Continuar?'))return;
    const r=parcel?await sb.from('fin_receb_parcelas').update(row).eq('id',parcel.id):await sb.from('fin_receb_parcelas').insert({id:crypto.randomUUID(),cliente_id:clientId,...row});
    if(r.error)return msg(x,r.error.message);x.remove();try{await window.MCLRecebHistory?.(clientId)}catch{}refresh()};
}
function decorateHistory(){
  const hm=q('#recebHistoryModal');if(!hm||!isAdmin())return;
  const rows=qa('tbody tr[data-parcela-id]',hm);if(!rows.length)return;
  const clientId=rows[0].dataset.clienteId;
  if(!q('[data-mcl-add-parcel]',hm)){const head=q('.modal-body',hm)||hm;const b=document.createElement('button');b.type='button';b.className='btn small';b.dataset.mclAddParcel='1';b.textContent='+ Parcela';b.style.margin='0 0 12px';b.onclick=async()=>{const {data,error}=await sb.from('fin_receb_parcelas').select('*').eq('cliente_id',clientId);if(error)return alert(error.message);const ps=data||[],num=Math.max(0,...ps.map(p=>Number(p.numero||0)))+1,last=[...ps].sort((a,b)=>String(b.vencimento||'').localeCompare(String(a.vencimento||'')))[0];let next='';if(last?.vencimento){const [y,m,d]=last.vencimento.split('-').map(Number),t=new Date(y,m,1,12);t.setDate(Math.min(d,new Date(y,m+1,0).getDate()));next=t.toISOString().slice(0,10)}parcelForm(clientId,null,num,next)};head.prepend(b)}
  rows.forEach(tr=>{/* aguarda a coluna Ação (botão de pagamento) para não misturar com a coluna Valor pago */const cell=q('.receb-pay-toggle',tr)?.closest('td');if(!cell||q('[data-mcl-parcel-edit]',tr))return;const b=document.createElement('button');b.type='button';b.className='btn small ghost';b.dataset.mclParcelEdit=tr.dataset.parcelaId;b.textContent='Editar';b.style.marginLeft='4px';b.onclick=async e=>{e.stopPropagation();const {data,error}=await sb.from('fin_receb_parcelas').select('*').eq('id',tr.dataset.parcelaId).maybeSingle();if(error||!data)return alert(error?.message||'Parcela não encontrada.');parcelForm(tr.dataset.clienteId,data)};cell.append(b)});
}

let queued=false;
new MutationObserver(()=>{if(queued)return;queued=true;queueMicrotask(()=>{queued=false;try{decorateMunicipios();decorateClientDetail();decorateClientCards();decorateHistory()}catch(e){console.error('Recebimentos extra:',e)}})}).observe(document.documentElement,{childList:true,subtree:true});
})();

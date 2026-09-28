(function(){
'use strict';
const cfg=window.MCL_SUPABASE||{};
const sb=window.supabase?.createClient(cfg.url,cfg.publishableKey,{auth:{persistSession:true,autoRefreshToken:true}});
const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]/g,'');
const digits=s=>String(s||'').replace(/\D/g,'');
const fileData=file=>new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=rej;r.readAsDataURL(file)});
function close(){document.querySelector('#mclSmartReport')?.remove()}
function modal(){
 close();
 const d=document.createElement('div');d.id='mclSmartReport';d.className='modal-backdrop';
 d.innerHTML=`<section class="modal"><header class="modal-head"><h3>Importar relatório de pagamentos</h3><button class="btn icon ghost" data-close>×</button></header><div class="modal-body"><div class="form-grid"><div class="field full"><label>Relatório PDF</label><input id="mclPayFile" type="file" accept="application/pdf"></div><div class="field full"><div class="notice">Cada título liquidado é conciliado com a <b>parcela do vencimento informado no relatório</b>, inclusive parcelas de meses futuros. Se o mesmo cliente pagar várias parcelas, cada vencimento é marcado separadamente. Juros e multa recalibram apenas a parcela correspondente.</div></div><div id="mclPayStatus" class="field full"></div></div></div><footer class="modal-foot"><button class="btn ghost" data-close>Fechar</button><button class="btn" id="mclPayImport">Importar</button></footer></section>`;
 document.body.appendChild(d);
 d.querySelectorAll('[data-close]').forEach(x=>x.onclick=close);
 d.querySelector('#mclPayImport').onclick=run;
}
async function responseJsonSafe(rr){
 const raw=await rr.text();let j=null;try{j=raw?JSON.parse(raw):null}catch{}
 if(j)return j;
 if(rr.status===504)throw new Error('O relatório demorou além do limite do servidor. Tente novamente com um período menor.');
 throw new Error(raw&&raw.length<240?raw:`Falha do servidor ao processar o relatório (HTTP ${rr.status}).`);
}
async function run(){
 const file=document.querySelector('#mclPayFile')?.files?.[0];
 const status=document.querySelector('#mclPayStatus');
 const btn=document.querySelector('#mclPayImport');
 if(!file)return alert('Selecione o PDF.');
 btn.disabled=true;status.textContent='Lendo relatório e conciliando parcelas...';
 try{
  const data=await fileData(file);
  const rr=await fetch('/api/ai-receivables',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({file:data,fileName:file.name,mode:'payments'})});
  const j=await responseJsonSafe(rr);
  if(!rr.ok||!j?.ok)throw new Error(j?.details||j?.error||'Falha na leitura do relatório');
  /* Lê todas as linhas (o Supabase devolve no máximo 1000 por consulta). */
  const allRows=async table=>{const out=[];for(let from=0;;from+=1000){const r=await sb.from(table).select('*').order('id').range(from,from+999);if(r.error)throw r.error;out.push(...(r.data||[]));if(!r.data||r.data.length<1000)break}return out};
  const [clients,parcels]=await Promise.all([allRows('fin_receb_clientes'),allRows('fin_receb_parcelas')]);
  let ok=0,pending=0,already=0,future=0;const misses=[],used=new Set();
  const safe=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
  for(const result of window.MCLReceivablesMatch.plan(j.entries||[],clients,parcels)){
   const x=result.entry;
   if(result.duplicate){already++;continue}
   const p=result.parcel;
   if(result.already){already++;continue}
   if(!p||used.has(p.id)){pending++;misses.push(`${x.pagador}: ${result.reason||'Mais de um boleto para a mesma parcela'}`);continue}
   const ur=await sb.from('fin_receb_parcelas').update(result.update).eq('id',p.id).eq('status',p.status).eq('valor_previsto',p.valor_previsto).eq('vencimento',p.vencimento).eq('valor_liquidado',p.valor_liquidado||0).select('id');
   if(ur.error||ur.data?.length!==1){pending++;misses.push(`${x.pagador}: ${ur.error?.message||'Registro alterado durante a importação'}`)}
   else{used.add(p.id);Object.assign(p,result.update);ok++;if(x.vencimento.slice(0,7)>new Date().toISOString().slice(0,7))future++}
  }
  status.innerHTML=`<div class="notice ok"><b>${ok}</b> de <b>${j.entries.length}</b> parcela(s) marcada(s) como paga(s), sendo <b>${future}</b> de vencimentos futuros. <b>${already}</b> já estavam pagas e foram mantidas. <b>${pending}</b> ficaram pendentes para conferência.${misses.length?`<br><small>Não conciliados: ${misses.map(safe).join(', ')}</small>`:''}</div>`;
  btn.disabled=false;
  try{await window.MCLRecebimentos?.open?.()}catch{}
 }catch(e){status.innerHTML=`<div class="notice danger">${String(e.message||e).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}</div>`;btn.disabled=false}
}
document.addEventListener('click',e=>{
 const b=e.target.closest?.('#importReport');if(!b)return;
 e.preventDefault();e.stopImmediatePropagation();modal();
},true);
})();
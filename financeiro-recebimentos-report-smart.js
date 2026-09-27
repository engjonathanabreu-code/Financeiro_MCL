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
  /* Só parcelas ainda não quitadas podem ser marcadas; reimportar o mesmo relatório não altera o que já foi pago. */
  const eligible=z=>z&&!used.has(z.id)&&z.status!=='Pago'&&z.status!=='Cancelado';
  const paidAlready=z=>z&&!used.has(z.id)&&z.status==='Pago';
  const sameValue=(z,nom)=>!nom||Math.abs(Number(z.valor_previsto||0)-nom)<0.03;
  const pick=(pred,clientId,due,nom)=>{const own=parcels.filter(z=>pred(z)&&z.cliente_id===clientId);if(!due)return own.find(z=>sameValue(z,nom))||own[0];const m=due.slice(0,7);return own.find(z=>z.vencimento===due&&sameValue(z,nom))||own.find(z=>z.vencimento===due)||own.find(z=>String(z.vencimento||'').slice(0,7)===m&&sameValue(z,nom))||own.find(z=>String(z.vencimento||'').slice(0,7)===m)};
  const byClientDue=(clientId,due,nom)=>pick(eligible,clientId,due,nom);
  for(const x of j.entries||[]){
   let p=null,c=null;
   const doc=norm(x.documento),nn=digits(x.nosso_numero),cpf=digits(x.cpf_cnpj),name=norm(x.pagador);
   const due=String(x.vencimento||'').slice(0,10);
   const nom=Number(x.valor_nominal||0),paid=Number(x.valor_liquidado||nom||0);
   if(nn)p=parcels.find(z=>eligible(z)&&digits(z.nosso_numero)===nn&&(!due||z.vencimento===due));
   if(!p&&doc)p=parcels.find(z=>eligible(z)&&norm(z.documento)===doc&&(!due||z.vencimento===due));
   if(!p&&doc){c=clients.find(z=>norm(z.codigo)===doc);if(c)p=byClientDue(c.id,due,nom)}
   if(!p&&cpf){c=clients.find(z=>digits(z.cpf_cnpj)===cpf);if(c)p=byClientDue(c.id,due,nom)}
   if(!p&&name){const exact=clients.filter(z=>norm(z.nome)===name);if(exact.length===1){c=exact[0];p=byClientDue(c.id,due,nom)}}
   if(!p&&name){const near=clients.filter(z=>{const n=norm(z.nome);return n&&name&&(n.startsWith(name)||name.startsWith(n))});if(near.length===1){c=near[0];p=byClientDue(c.id,due,nom)}}
   if(!p){const done=(nn&&parcels.find(z=>paidAlready(z)&&digits(z.nosso_numero)===nn))||(c&&pick(paidAlready,c.id,due,nom));if(done){used.add(done.id);already++;continue}}
   if(p){
    /* O valor previsto original é mantido; juros/multa ficam registrados em "diferenca". */
    const upd={status:'Pago',pago_em:x.pagamento||null,valor_liquidado:paid,diferenca:paid-Number(p.valor_previsto||0),nosso_numero:p.nosso_numero||x.nosso_numero||null,documento:p.documento||x.documento||null};
    const ur=await sb.from('fin_receb_parcelas').update(upd).eq('id',p.id);
    if(ur.error){pending++;misses.push(x.pagador||x.documento||'registro')}
    else{used.add(p.id);p.status='Pago';ok++;if(due&&due.slice(0,7)>new Date(Date.now()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,7))future++}
   }else{pending++;misses.push(x.pagador||x.documento||'registro')}
  }
  status.innerHTML=`<div class="notice ok"><b>${ok}</b> parcela(s) marcada(s) como paga(s), sendo <b>${future}</b> de vencimentos futuros. <b>${already}</b> já estavam pagas e foram mantidas. <b>${pending}</b> ficaram pendentes para conferência.${misses.length?`<br><small>Não conciliados: ${misses.slice(0,8).map(safe).join(', ')}${misses.length>8?'…':''}</small>`:''}</div>`;
  btn.disabled=false;
  try{await window.MCLRecebimentos?.open?.()}catch{}
 }catch(e){status.innerHTML=`<div class="notice danger">${String(e.message||e).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}</div>`;btn.disabled=false}
}
document.addEventListener('click',e=>{
 const b=e.target.closest?.('#importReport');if(!b)return;
 e.preventDefault();e.stopImmediatePropagation();modal();
},true);
})();
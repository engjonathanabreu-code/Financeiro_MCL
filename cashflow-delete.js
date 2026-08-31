/* Financeiro MCL — exclusão explícita de lançamentos do Fluxo de Caixa */
(()=>{'use strict';
const C=window.MCL_SUPABASE||{};if(!window.supabase?.createClient||!C.url||!C.publishableKey)return;
const sb=window.supabase.createClient(C.url,C.publishableKey,{auth:{persistSession:true,autoRefreshToken:true}});
const q=(s,r=document)=>r.querySelector(s),qa=(s,r=document)=>[...r.querySelectorAll(s)];
async function del(id,row){
  if(!id)return;
  const desc=row?.querySelector('td:nth-child(2)')?.textContent?.trim()||'este lançamento';
  if(!confirm(`Excluir “${desc}” do Fluxo de Caixa?`))return;
  const {error}=await sb.from('financeiro_fluxo').delete().eq('id',id);
  if(error)return alert(error.message);
  await window.MCLCashflowCanonical?.render?.();
}
function install(){
  if((q('#title')?.textContent||'').trim()!=='Fluxo de Caixa')return;
  qa('[data-mcl-cash-drag]').forEach(tr=>{
    const id=tr.dataset.mclCashDrag;if(!id||tr.querySelector('[data-mcl-cash-delete]'))return;
    const edit=tr.querySelector('[data-mcl-cash-edit]');
    const cell=edit?.closest('td')||tr.lastElementChild;if(!cell)return;
    cell.style.whiteSpace='nowrap';
    const b=document.createElement('button');b.className='icon-btn btn ghost small';b.dataset.mclCashDelete=id;b.title='Excluir';b.setAttribute('aria-label','Excluir lançamento');b.textContent='🗑';b.style.marginLeft='6px';
    b.onclick=e=>{e.preventDefault();e.stopPropagation();del(id,tr)};cell.appendChild(b);
  });
}
let timer;const schedule=()=>{clearTimeout(timer);timer=setTimeout(install,60)};
new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});window.addEventListener('load',schedule);setTimeout(schedule,400);
window.MCLCashflowDelete={install,delete:del};
})();
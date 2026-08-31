/* Financeiro MCL — resumo por Natureza no rodapé do Fluxo de Caixa */
(()=>{'use strict';
const q=(s,r=document)=>r.querySelector(s);
const esc=s=>String(s||'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const brl=n=>Number(n||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
let building=false,lastSignature='';
function ensureStyle(){if(q('#mclNatureSummaryStyle'))return;const s=document.createElement('style');s.id='mclNatureSummaryStyle';s.textContent=`
.mcl-nature-card{border:1px solid rgba(13,56,59,.12);border-radius:14px;background:#fff;overflow:hidden;min-width:0}
.mcl-nature-head{padding:14px 16px;border-bottom:1px solid rgba(13,56,59,.09);display:flex;justify-content:space-between;align-items:center;gap:14px}
.mcl-nature-head strong{font-size:15px}.mcl-nature-head .amount{font-size:17px;white-space:nowrap}
.mcl-nature-columns,.mcl-nature-row{display:grid;grid-template-columns:minmax(0,1fr) minmax(130px,auto);gap:18px;align-items:center}
.mcl-nature-columns{padding:8px 14px;background:rgba(13,56,59,.035);font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.04em;color:var(--muted)}
.mcl-nature-columns span:last-child{text-align:right}.mcl-nature-row{position:relative;padding:11px 14px;border-top:1px solid rgba(13,56,59,.075);min-height:42px;overflow:hidden}
.mcl-nature-row:first-child{border-top:0}.mcl-nature-row .name{position:relative;z-index:1;min-width:0;font-weight:700;overflow-wrap:anywhere}.mcl-nature-row .value{position:relative;z-index:1;text-align:right;font-weight:800;white-space:nowrap}
.mcl-nature-share{position:absolute;left:0;bottom:0;height:2px;background:currentColor;opacity:.20;max-width:100%}
.mcl-nature-empty{padding:24px 14px;text-align:center;color:var(--muted)}
.mcl-nature-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:16px;align-items:start}
.mcl-nature-summary-head{display:flex;justify-content:space-between;gap:18px;align-items:flex-end;flex-wrap:wrap;margin-bottom:16px}
.mcl-nature-balance{text-align:right;padding:9px 12px;border-radius:10px;background:rgba(13,56,59,.04);min-width:160px}.mcl-nature-balance b{font-size:18px;white-space:nowrap}
@media(max-width:980px){.mcl-nature-grid{grid-template-columns:1fr}.mcl-nature-summary-head{align-items:flex-start}.mcl-nature-balance{text-align:left}}
@media(max-width:560px){.mcl-nature-columns,.mcl-nature-row{grid-template-columns:minmax(0,1fr) auto;gap:10px}.mcl-nature-row{padding:10px 12px}.mcl-nature-head{padding:12px}.mcl-nature-head .amount{font-size:15px}}
`;document.head.appendChild(s)}
function section(title,items,type){const total=items.reduce((s,x)=>s+x.value,0),positive=type==='Entrada',max=Math.max(1,...items.map(x=>x.value)),cls=positive?'kpi-positive':'kpi-negative';return `<section class="mcl-nature-card"><div class="mcl-nature-head"><strong>${title}</strong><span class="amount ${cls}">${brl(total)}</span></div><div class="mcl-nature-columns"><span>Natureza</span><span>Total</span></div><div>${items.length?items.map(x=>`<div class="mcl-nature-row"><span class="name">${esc(x.nature)}</span><span class="value ${cls}">${brl(x.value)}</span><i class="mcl-nature-share ${cls}" style="width:${Math.max(2,(x.value/max)*100).toFixed(1)}%"></i></div>`).join(''):'<div class="mcl-nature-empty">Sem movimentações.</div>'}</div></section>`}
async function build(force=false){
  if(building)return;
  const content=q('#content'),title=q('#title')?.textContent?.trim();if(!content||title!=='Fluxo de Caixa')return;
  building=true;
  try{
    ensureStyle();
    const month=q('#mclCashMonth')?.value||new Date().toISOString().slice(0,7);
    let rows=[];
    try{const loaded=await window.MCLCashflowCanonical?.loadRows?.();rows=loaded?.rows||[]}catch(e){console.error('MCL resumo por natureza: falha ao carregar fluxo',e)}
    const incomeMap=new Map(),outMap=new Map();
    for(const r of rows){
      if(String(r.data_movimento||'').slice(0,7)!==month)continue;
      const nature=String(r.natureza||'').trim()||'Sem natureza',value=Math.abs(Number(r.valor||0));if(!value)continue;
      const map=r.direcao==='Entrada'?incomeMap:r.direcao==='Saída'?outMap:null;if(!map)continue;
      map.set(nature,(map.get(nature)||0)+value);
    }
    const make=map=>[...map.entries()].map(([nature,value])=>({nature,value})).sort((a,b)=>b.value-a.value||a.nature.localeCompare(b.nature,'pt-BR'));
    const ins=make(incomeMap),outs=make(outMap),totalIn=ins.reduce((s,x)=>s+x.value,0),totalOut=outs.reduce((s,x)=>s+x.value,0),balance=totalIn-totalOut;
    const signature=JSON.stringify({month,ins,outs,balance});
    const existing=q('#mclNatureSummary',content);
    if(!force&&existing&&lastSignature===signature)return;
    const html=`<div class="card" style="padding:18px"><div class="mcl-nature-summary-head"><div><h3 style="margin:0 0 4px">Resumo por Natureza</h3><div class="muted">Somatório do mês selecionado, separado entre receitas e despesas</div></div><div class="mcl-nature-balance"><div class="muted">Saldo do mês</div><b class="${balance>=0?'kpi-positive':'kpi-negative'}">${brl(balance)}</b></div></div><div class="mcl-nature-grid">${section('Entradas por Natureza',ins,'Entrada')}${section('Saídas por Natureza',outs,'Saída')}</div></div>`;
    if(existing){existing.innerHTML=html}else{const box=document.createElement('section');box.id='mclNatureSummary';box.style.marginTop='28px';box.innerHTML=html;content.appendChild(box)}
    lastSignature=signature;
  }finally{building=false}
}
let timer;
function schedule(force=false){clearTimeout(timer);timer=setTimeout(()=>build(force),160)}
const observer=new MutationObserver(records=>{
  if(building)return;
  const relevant=records.some(r=>{
    const target=r.target?.nodeType===1?r.target:r.target?.parentElement;
    if(target?.closest?.('#mclNatureSummary'))return false;
    return [...r.addedNodes,...r.removedNodes].some(n=>{
      const el=n.nodeType===1?n:null;
      if(!el)return true;
      return el.id!=='mclNatureSummary'&&!el.closest?.('#mclNatureSummary');
    });
  });
  if(relevant)schedule(false);
});
observer.observe(document.body,{childList:true,subtree:true});
document.addEventListener('change',e=>{if(e.target?.id==='mclCashMonth')schedule(true)});
window.addEventListener('load',()=>schedule(true));setTimeout(()=>schedule(true),500);
window.MCLNatureSummary={build:()=>build(true)};
})();
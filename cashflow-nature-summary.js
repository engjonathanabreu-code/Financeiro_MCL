/* Financeiro MCL — resumo por Natureza no rodapé do Fluxo de Caixa */
(()=>{'use strict';
const q=(s,r=document)=>r.querySelector(s),qa=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=s=>String(s||'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const brl=n=>Number(n||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
function parseMoney(s){let x=String(s||'').replace(/[^0-9,.-]/g,'').trim();if(!x)return 0;if(x.includes(',')&&x.includes('.'))x=x.replace(/\./g,'').replace(',','.');else if(x.includes(','))x=x.replace(',','.');return Math.abs(Number(x)||0)}
function build(){
  const content=q('#content'),title=q('#title')?.textContent?.trim();if(!content||title!=='Fluxo de Caixa')return;
  q('#mclNatureSummary',content)?.remove();
  const tables=qa('table',content),map=new Map();
  tables.forEach(table=>{
    const heads=qa('thead th',table).map(x=>x.textContent.trim().toLowerCase());
    const ni=heads.findIndex(x=>x.includes('natureza')),ti=heads.findIndex(x=>x.includes('tipo')||x.includes('direção')||x.includes('direcao')),vi=heads.findIndex(x=>x.includes('valor'));
    if(ni<0||ti<0||vi<0)return;
    qa('tbody tr',table).forEach(tr=>{const cells=qa('td',tr);if(cells.length<=Math.max(ni,ti,vi))return;const nature=cells[ni].textContent.trim()||'Sem natureza',type=cells[ti].textContent.trim(),value=parseMoney(cells[vi].textContent);if(!value)return;if(!map.has(nature))map.set(nature,{nature,income:0,out:0});const g=map.get(nature);if(/entrada/i.test(type))g.income+=value;else if(/sa[ií]da/i.test(type))g.out+=value;});
  });
  const items=[...map.values()].sort((a,b)=>(b.income+b.out)-(a.income+a.out)||a.nature.localeCompare(b.nature,'pt-BR'));
  const totalIn=items.reduce((s,x)=>s+x.income,0),totalOut=items.reduce((s,x)=>s+x.out,0);
  const box=document.createElement('section');box.id='mclNatureSummary';box.style.marginTop='28px';box.innerHTML=`<div class="card" style="padding:0;overflow:hidden"><div style="padding:16px 18px;border-bottom:1px solid rgba(0,0,0,.08);display:flex;justify-content:space-between;gap:12px;align-items:end;flex-wrap:wrap"><div><h3 style="margin:0 0 4px">Resumo por Natureza</h3><div class="muted">Somatório das movimentações exibidas no Fluxo de Caixa</div></div><div class="muted">${items.length} natureza(s)</div></div><div class="table-wrap" style="border:0;border-radius:0"><table class="table sheet-table" style="margin:0"><thead><tr><th>Natureza</th><th>Entradas</th><th>Saídas</th><th>Saldo</th></tr></thead><tbody>${items.map(x=>{const bal=x.income-x.out;return `<tr><td><b>${esc(x.nature)}</b></td><td class="kpi-positive"><b>${brl(x.income)}</b></td><td class="kpi-negative"><b>${brl(x.out)}</b></td><td><b class="${bal>=0?'kpi-positive':'kpi-negative'}">${brl(bal)}</b></td></tr>`}).join('')||'<tr><td colspan="4"><div class="empty">Sem movimentações para resumir.</div></td></tr>'}</tbody><tfoot><tr><th>Total</th><th class="kpi-positive">${brl(totalIn)}</th><th class="kpi-negative">${brl(totalOut)}</th><th><b class="${totalIn-totalOut>=0?'kpi-positive':'kpi-negative'}">${brl(totalIn-totalOut)}</b></th></tr></tfoot></table></div></div>`;content.appendChild(box);
}
let timer;const schedule=()=>{clearTimeout(timer);timer=setTimeout(build,120)};new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});window.addEventListener('load',schedule);setTimeout(schedule,500);
})();

/* Financeiro MCL — resumo por Natureza no rodapé do Fluxo de Caixa */
(()=>{'use strict';
const q=(s,r=document)=>r.querySelector(s),qa=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=s=>String(s||'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const brl=n=>Number(n||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
function parseMoney(s){let x=String(s||'').replace(/[^0-9,.-]/g,'').trim();if(!x)return 0;if(x.includes(',')&&x.includes('.'))x=x.replace(/\./g,'').replace(',','.');else if(x.includes(','))x=x.replace(',','.');return Math.abs(Number(x)||0)}
function section(title,items,type){const total=items.reduce((s,x)=>s+x.value,0),positive=type==='Entrada';return `<div style="border:1px solid rgba(0,0,0,.08);border-radius:12px;overflow:hidden;background:#fff"><div style="padding:12px 14px;border-bottom:1px solid rgba(0,0,0,.07);display:flex;justify-content:space-between;align-items:center;gap:12px"><b>${title}</b><b class="${positive?'kpi-positive':'kpi-negative'}">${brl(total)}</b></div><table class="table sheet-table" style="margin:0"><thead><tr><th>Natureza</th><th style="text-align:right">Total</th></tr></thead><tbody>${items.map(x=>`<tr><td><b>${esc(x.nature)}</b></td><td style="text-align:right" class="${positive?'kpi-positive':'kpi-negative'}"><b>${brl(x.value)}</b></td></tr>`).join('')||'<tr><td colspan="2"><div class="empty">Sem movimentações.</div></td></tr>'}</tbody></table></div>`}
function build(){
  const content=q('#content'),title=q('#title')?.textContent?.trim();if(!content||title!=='Fluxo de Caixa')return;
  q('#mclNatureSummary',content)?.remove();
  const tables=qa('table',content),incomeMap=new Map(),outMap=new Map();
  tables.forEach(table=>{
    const heads=qa('thead th',table).map(x=>x.textContent.trim().toLowerCase());
    const ni=heads.findIndex(x=>x.includes('natureza')),ti=heads.findIndex(x=>x.includes('tipo')||x.includes('direção')||x.includes('direcao')),vi=heads.findIndex(x=>x.includes('valor'));
    if(ni<0||ti<0||vi<0)return;
    qa('tbody tr',table).forEach(tr=>{const cells=qa('td',tr);if(cells.length<=Math.max(ni,ti,vi))return;const nature=cells[ni].textContent.trim()||'Sem natureza',type=cells[ti].textContent.trim(),value=parseMoney(cells[vi].textContent);if(!value)return;const map=/entrada/i.test(type)?incomeMap:/sa[ií]da/i.test(type)?outMap:null;if(map)map.set(nature,(map.get(nature)||0)+value)});
  });
  const make=map=>[...map.entries()].map(([nature,value])=>({nature,value})).sort((a,b)=>b.value-a.value||a.nature.localeCompare(b.nature,'pt-BR'));
  const ins=make(incomeMap),outs=make(outMap),totalIn=ins.reduce((s,x)=>s+x.value,0),totalOut=outs.reduce((s,x)=>s+x.value,0),balance=totalIn-totalOut;
  const box=document.createElement('section');box.id='mclNatureSummary';box.style.marginTop='28px';box.innerHTML=`<div class="card" style="padding:16px 18px"><div style="display:flex;justify-content:space-between;gap:12px;align-items:end;flex-wrap:wrap;margin-bottom:14px"><div><h3 style="margin:0 0 4px">Resumo por Natureza</h3><div class="muted">Somatório do mês selecionado, separado entre receitas e despesas</div></div><div style="text-align:right"><div class="muted">Saldo do mês</div><b class="${balance>=0?'kpi-positive':'kpi-negative'}">${brl(balance)}</b></div></div><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:14px">${section('Entradas por Natureza',ins,'Entrada')}${section('Saídas por Natureza',outs,'Saída')}</div></div>`;content.appendChild(box);
}
let timer;const schedule=()=>{clearTimeout(timer);timer=setTimeout(build,120)};new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});window.addEventListener('load',schedule);setTimeout(schedule,500);
})();

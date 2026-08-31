(()=>{'use strict';
const C=window.MCL_SUPABASE||{};
if(!window.supabase?.createClient||!C.url||!C.publishableKey)return;
const sb=window.supabase.createClient(C.url,C.publishableKey,{auth:{persistSession:true,autoRefreshToken:true}});
const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim();
const money=v=>Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c]));
const month=d=>String(d||'').slice(0,7);
const imported=r=>/extrato/i.test(String(r?.origem||''));
const bankFeeFamily=r=>{
  if(r?.direcao!=='Saída')return '';
  const s=norm(r.descricao);
  const hasTariff=/tarifa/.test(s);
  const hasBilling=/cobranca|boleto|liquidacao|baixa|pix/.test(s);
  return hasTariff&&hasBilling?'tarifas-cobranca-boletos':'';
};
const groupKey=r=>{
  if(!imported(r))return '';
  const family=bankFeeFamily(r);
  if(family)return `${month(r.data_movimento)}|${r.direcao}|${family}`;
  return `${month(r.data_movimento)}|${r.direcao}|nome:${norm(r.descricao)}`;
};
const partOf=r=>({id:r.id,data_movimento:r.data_movimento,descricao:r.descricao,natureza:r.natureza,direcao:r.direcao,valor:Number(r.valor||0),origem:r.origem,referencia_id:r.referencia_id||null});
async function consolidateImported(){
  const {data,error}=await sb.from('financeiro_fluxo').select('id,data_movimento,descricao,natureza,direcao,valor,origem,referencia_id,dados,created_by').order('data_movimento',{ascending:true});
  if(error||!data?.length)return false;
  const groups=new Map();
  for(const r of data){const k=groupKey(r);if(!k)continue;if(!groups.has(k))groups.set(k,[]);groups.get(k).push(r)}
  let changed=false;
  for(const rows of groups.values()){
    if(rows.length<2)continue;
    const target=rows[0],children=rows.slice(1),family=bankFeeFamily(target);
    const existing=Array.isArray(target.dados?.lancamentos_consolidados)?target.dados.lancamentos_consolidados:[];
    const details=[...existing,...rows.map(partOf)];
    const total=rows.reduce((s,r)=>s+Number(r.valor||0),0);
    const dates=details.map(x=>x.data_movimento).filter(Boolean).sort();
    const update={
      valor:Number(total.toFixed(2)),
      descricao:family?'Tarifas de cobrança e boletos':target.descricao,
      natureza:family?'Tarifas bancárias':target.natureza,
      data_movimento:dates[0]||target.data_movimento,
      dados:{...(target.dados||{}),consolidado:true,consolidacao:'automatica_ia',quantidade_lancamentos:details.length,lancamentos_consolidados:details,periodo_inicio:dates[0]||null,periodo_fim:dates.at(-1)||null}
    };
    const up=await sb.from('financeiro_fluxo').update(update).eq('id',target.id);if(up.error)continue;
    const del=await sb.from('financeiro_fluxo').delete().in('id',children.map(x=>x.id));if(del.error)continue;
    changed=true;
  }
  return changed;
}
function brNumber(text){let s=String(text||'').replace(/R\$/gi,'').replace(/\s/g,'').replace(/\./g,'').replace(',','.').replace(/[^0-9.-]/g,'');return Math.abs(Number(s)||0)}
async function rowsForDom(){const {data}=await sb.from('financeiro_fluxo').select('id,data_movimento,descricao,natureza,direcao,valor,origem,dados').order('data_movimento',{ascending:false});return data||[]}
function rowKey(r){return `${String(r.data_movimento).slice(0,10)}|${norm(r.descricao)}|${norm(r.direcao)}|${Number(r.valor||0).toFixed(2)}`}
async function bindDrag(){
  const table=document.querySelector('#content .sheet-table tbody');if(!table)return;
  const data=await rowsForDom();const buckets=new Map();for(const r of data){const k=rowKey(r);if(!buckets.has(k))buckets.set(k,[]);buckets.get(k).push(r)}
  const trs=[...table.querySelectorAll('tr')];
  for(const tr of trs){const td=tr.querySelectorAll('td');if(td.length<6)continue;const date=(td[0].textContent||'').trim().split('/').reverse().join('-'),desc=td[1].textContent.trim(),dir=/entrada/i.test(td[3].textContent)?'Entrada':/saída|saida/i.test(td[3].textContent)?'Saída':'',value=brNumber(td[5].textContent),k=`${date}|${norm(desc)}|${norm(dir)}|${Number(value).toFixed(2)}`,bucket=buckets.get(k);if(!bucket?.length)continue;const r=bucket.shift();tr.dataset.mclFlowId=r.id;tr.dataset.mclDirection=r.direcao;tr.draggable=true;tr.style.cursor='grab';if(r.dados?.quantidade_lancamentos>1){const small=document.createElement('small');small.className='muted';small.style.display='block';small.textContent=`${r.dados.quantidade_lancamentos} lançamentos somados`;td[1].appendChild(small)}}
  let dragging='';
  trs.filter(tr=>tr.dataset.mclFlowId).forEach(tr=>{
    tr.ondragstart=e=>{dragging=tr.dataset.mclFlowId;e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',dragging);tr.style.opacity='.45'};
    tr.ondragend=()=>{tr.style.opacity='';dragging='';trs.forEach(x=>x.style.outline='')};
    tr.ondragover=e=>{const source=dragging||e.dataTransfer.getData('text/plain');if(source&&source!==tr.dataset.mclFlowId){e.preventDefault();tr.style.outline='2px solid currentColor';tr.style.outlineOffset='-2px'}};
    tr.ondragleave=()=>tr.style.outline='';
    tr.ondrop=async e=>{e.preventDefault();tr.style.outline='';const sid=dragging||e.dataTransfer.getData('text/plain'),tid=tr.dataset.mclFlowId;if(!sid||!tid||sid===tid)return;const {data:rows,error}=await sb.from('financeiro_fluxo').select('*').in('id',[sid,tid]);if(error||rows?.length!==2)return alert('Não foi possível localizar os lançamentos.');const source=rows.find(x=>x.id===sid),target=rows.find(x=>x.id===tid);if(source.direcao!==target.direcao)return alert('Só é possível somar Entrada com Entrada ou Saída com Saída.');if(!confirm(`Somar “${source.descricao}” (${money(source.valor)}) em “${target.descricao}” (${money(target.valor)})?`))return;const a=Array.isArray(target.dados?.lancamentos_consolidados)?target.dados.lancamentos_consolidados:[partOf(target)],b=Array.isArray(source.dados?.lancamentos_consolidados)?source.dados.lancamentos_consolidados:[partOf(source)],details=[...a,...b],total=details.reduce((s,x)=>s+Number(x.valor||0),0),dates=details.map(x=>x.data_movimento).filter(Boolean).sort(),dados={...(target.dados||{}),consolidado:true,consolidacao:'manual_arrastar',quantidade_lancamentos:details.length,lancamentos_consolidados:details,periodo_inicio:dates[0]||null,periodo_fim:dates.at(-1)||null};const up=await sb.from('financeiro_fluxo').update({valor:Number(total.toFixed(2)),dados}).eq('id',tid);if(up.error)return alert(up.error.message);const del=await sb.from('financeiro_fluxo').delete().eq('id',sid);if(del.error)return alert(del.error.message);location.reload()};
  });
}
let running=false;
async function install(){if(running)return;const title=document.querySelector('#title')?.textContent||'';if(title!=='Fluxo de Caixa')return;running=true;try{const changed=await consolidateImported();if(changed){location.reload();return}await bindDrag();const note=document.querySelector('#content .sheet-toolbar .notice');if(note)note.textContent='Linhas equivalentes importadas são consolidadas automaticamente. Arraste uma linha sobre outra para somar manualmente.'}finally{running=false}}
const obs=new MutationObserver(()=>setTimeout(install,30));obs.observe(document.documentElement,{subtree:true,childList:true});setTimeout(install,500);
window.MCLCashflowConsolidation={consolidateImported,bindDrag};
})();
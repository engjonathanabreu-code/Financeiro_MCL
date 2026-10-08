(function(root){
'use strict';
const round=n=>Math.round((Number(n)+Number.EPSILON)*100)/100;
function amount(n){n=Number(n);if(!Number.isFinite(n)||n<0||n>1e12)throw new Error('Informe valores válidos, maiores ou iguais a zero.');return round(n)}
function itemTotal(i){const q=Number(i.quantidade);if(!Number.isFinite(q)||q<=0)throw new Error('A quantidade deve ser maior que zero.');const gross=amount(q*amount(i.unitario)),discount=amount(i.desconto||0);if(discount>gross)throw new Error('O desconto não pode superar o valor do item.');return round(gross-discount)}
function detail(b){return structuredClone(b.dados?.mcl_orcamento||{titulo:b.setor,status:'Em elaboração',inicio:'',fim:'',responsavel:'',observacoes:'',base:amount(b.realizado||0),etapas:[],documentos:[],historico:[]})}
function totals(d){const items=(d.etapas||[]).flatMap(s=>s.itens||[]);return{previsto:round(items.reduce((n,i)=>n+itemTotal(i),0)),realizado:round(amount(d.base||0)+items.reduce((n,i)=>n+(i.status==='Cancelado'?0:amount(i.realizado||0)),0)),itens:items.length}}
function stageTotals(s){return totals({base:0,etapas:[{...s,itens:(s.itens||[]).filter(i=>i.status!=='Cancelado')}]})}
const api={amount,itemTotal,detail,totals,stageTotals};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.MCLBudgetTools=api;
})(typeof window!=='undefined'?window:globalThis);

(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MCLReceivablesMatch=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]/g,'');
 const digits=s=>String(s||'').replace(/\D/g,'');
 const prefix=s=>norm(String(s||'').split(/[_/]/)[0]);
 function match(entry,clients,parcels){
  const due=entry.vencimento,amount=Number(entry.valor_nominal),paid=Number(entry.valor_liquidado),name=norm(entry.pagador);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(due)||!/^\d{4}-\d{2}-\d{2}$/.test(entry.pagamento)||!(amount>0)||!(paid>0))return {reason:'Dados do pagamento incompletos'};
  let candidates=[];const nn=digits(entry.nosso_numero),cpf=digits(entry.cpf_cnpj),remessa=prefix(entry.documento);
  const byNumber=nn?parcels.filter(p=>digits(p.nosso_numero)===nn&&p.vencimento===due):[];
  if(byNumber.length===1){const p=byNumber[0],c=clients.find(c=>c.id===p.cliente_id);if(c&&name&&!(norm(c.nome).startsWith(name)||name.startsWith(norm(c.nome))))return {reason:'Boleto vinculado a outro nome'};candidates=byNumber;}
  else{
   let cs=cpf?clients.filter(c=>digits(c.cpf_cnpj)===cpf):[];
   if(!cs.length&&name){cs=clients.filter(c=>norm(c.nome).startsWith(name));}
   if(remessa&&cs.length){const scoped=cs.filter(c=>prefix(c.codigo)===remessa);if(scoped.length)cs=scoped;else return {reason:'Remessa não corresponde ao cliente'};}
   if(cs.length!==1)return {reason:cs.length?'Nome ambíguo':'Cliente não localizado'};
   candidates=parcels.filter(p=>p.cliente_id===cs[0].id&&p.vencimento===due&&Math.abs(Number(p.valor_previsto)-amount)<.03);
  }
  if(candidates.length!==1)return {reason:candidates.length?'Parcela ambígua':'Sem parcela com mesmo vencimento e valor'};
  const p=candidates[0];if(p.status==='Cancelado'||p.status==='Parcial')return {reason:'Parcela cancelada ou com pagamento parcial'};
  if(nn&&digits(p.nosso_numero)&&digits(p.nosso_numero)!==nn)return {reason:'Parcela vinculada a outro boleto'};
  if(p.status==='Pago')return {parcel:p,already:true};
  return {parcel:p,update:{status:'Pago',pago_em:entry.pagamento,valor_liquidado:paid,diferenca:Math.round((paid-Number(p.valor_previsto))*100)/100,nosso_numero:p.nosso_numero||entry.nosso_numero||null,documento:p.documento||entry.documento||null}};
 }
 function plan(entries,clients,parcels){
  const seen=new Set();const rows=entries.map(entry=>{const key=JSON.stringify([entry.nosso_numero,entry.documento,entry.pagador,entry.vencimento,entry.pagamento,entry.valor_liquidado]);if(seen.has(key))return {entry,duplicate:true};seen.add(key);return {entry,...match(entry,clients,parcels)};});
  const count=new Map();for(const r of rows)if(r.parcel)count.set(r.parcel.id,(count.get(r.parcel.id)||0)+1);
  return rows.map(r=>r.parcel&&count.get(r.parcel.id)>1?{entry:r.entry,reason:'Mais de um boleto para a mesma parcela'}:r);
 }
 return {match,plan};
});

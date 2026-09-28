const money=s=>Math.round(Number(s.replace(/\./g,'').replace(',','.'))*100)/100;
const date=s=>s.split('/').reverse().join('-');
function parseMovement(text){
 if(!/MOVIMENTA[CÇ][AÃ]O DE COBRAN[CÇ]A COM REGISTRO/i.test(text))return null;
 let section='',expected=null;const entries=[];let failed=0;
 const period=text.match(/Periodo de:\s*(\d{2}\/\d{2}\/\d{4})\s*-\s*(\d{2}\/\d{2}\/\d{4})/i);
 for(const line of text.split('\n')){
  const occurrence=line.match(/Ocorr[eê]ncia:\s*(\d+)/i);if(occurrence)section=occurrence[1];
  if(section!=='6')continue;
  const total=line.match(/TOTAL\s+(\d+)\s+Boleto\(s\)\s+(.+)/i);
  if(total){const values=total[2].match(/[\d.]+,\d{2}/g)||[];expected={count:Number(total[1]),paid:money(values[6]||'0,00')};continue;}
  if(!/^(COMPE|INTERNET)\s+\d+\s/.test(line))continue;
  const row=line.match(/^(?:COMPE|INTERNET)\s+(\d+)\s+(\S+)\s+(.+?)\s+(\d{2}\/\d{2}\/\d{4})\s+(\d{2}\/\d{2}\/\d{4})\s+(.+)$/);
  if(!row){failed++;continue;}
  const tail=row[6].match(/^((?:[\d.]+,\d{2}\s+){8})(\S+)\s+(\d{2}\/\d{2}\/\d{4})\s+(\d{2}\/\d{2}\/\d{4})/);
  if(!tail){failed++;continue;}
  const amounts=tail[1].trim().split(/\s+/).map(money);
  if(amounts[6]<=0){failed++;continue;}
  entries.push({pagador:row[3].trim(),cpf_cnpj:'',nosso_numero:row[1],documento:row[2],vencimento:date(row[5]),pagamento:date(tail[3]),valor_nominal:amounts[0],valor_liquidado:amounts[6]});
 }
 const sum=Math.round(entries.reduce((s,x)=>s+x.valor_liquidado,0)*100)/100;
 if(failed||!expected||expected.count!==entries.length||Math.abs(expected.paid-sum)>.01)throw new Error('Relatório incompleto: quantidade ou total de liquidações não confere. Nenhum pagamento foi importado.');
 return {periodo_inicio:period?date(period[1]):'',periodo_fim:period?date(period[2]):'',entries,validation:{count:entries.length,total:sum},reader:'pdf-text-validated'};
}
async function readMovement(buffer){
 const {getDocument}=await import('pdfjs-dist/legacy/build/pdf.mjs');
 const doc=await getDocument({data:new Uint8Array(buffer),isEvalSupported:false,useSystemFonts:true}).promise;
 try{let text='';for(let n=1;n<=doc.numPages;n++){
  const page=await doc.getPage(n),vp=page.getViewport({scale:1}),content=await page.getTextContent();const rows=new Map();
  for(const item of content.items){if(!item.str?.trim())continue;const [x,y]=vp.convertToViewportPoint(item.transform[4],item.transform[5]);const key=Math.round(y*2)/2;if(!rows.has(key))rows.set(key,[]);rows.get(key).push({x,s:item.str});}
  text+=[...rows].sort((a,b)=>a[0]-b[0]).map(([,r])=>r.sort((a,b)=>a.x-b.x).map(i=>i.s).join(' ')).join('\n')+'\n';
 }return parseMovement(text);}finally{await doc.destroy();}
}
module.exports={parseMovement,readMovement};

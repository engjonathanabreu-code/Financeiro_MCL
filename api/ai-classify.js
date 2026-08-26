module.exports=async function handler(req,res){
  if(req.method!=='POST')return res.status(405).json({ok:false,error:'METHOD_NOT_ALLOWED'});
  if(!process.env.OPENAI_API_KEY)return res.status(500).json({ok:false,error:'OPENAI_API_KEY_NOT_CONFIGURED'});
  try{
    const {rows=[],natures=[]}=req.body||{};if(!Array.isArray(rows)||!rows.length)return res.status(400).json({ok:false,error:'ROWS_REQUIRED'});if(rows.length>250)return res.status(400).json({ok:false,error:'TOO_MANY_ROWS'});
    const allowed=Array.isArray(natures)&&natures.length?natures.map(String).filter(Boolean).slice(0,80):['Impostos','Custos fixos','Combustível','Seguros','Software','Alimentação','Hospedagem','Receita operacional'];
    const clean=rows.map((r,i)=>({index:i,date:String(r.date||''),description:String(r.description||'').slice(0,300),reference:String(r.reference||'').slice(0,120),value:Number(r.value||0),direction:r.direction==='Entrada'?'Entrada':'Saída'}));
    const schema={type:'object',additionalProperties:false,properties:{classifications:{type:'array',items:{type:'object',additionalProperties:false,properties:{index:{type:'integer'},nature:{type:'string',enum:allowed},normalized_description:{type:'string'},confidence:{type:'integer',minimum:0,maximum:100},reason:{type:'string'}},required:['index','nature','normalized_description','confidence','reason']}}},required:['classifications']};
    const prompt=['Você é o agente financeiro interno da Minha Casa Legal.','Classifique movimentações bancárias brasileiras usando SOMENTE as naturezas fornecidas.','Não invente vínculo, fornecedor ou finalidade que não esteja sustentada pela descrição.','normalized_description deve ser curta e útil no fluxo de caixa.',`Naturezas permitidas: ${allowed.join(' | ')}`,'Movimentações:',JSON.stringify(clean)].join('\n');
    const model=String(process.env.OPENAI_FINANCE_MODEL||'').trim()||'gpt-5.6-luna';
    const response=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:`Bearer ${process.env.OPENAI_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({model,input:prompt,text:{format:{type:'json_schema',name:'mcl_bank_classification',strict:true,schema}}})});
    const data=await response.json();if(!response.ok)return res.status(response.status).json({ok:false,error:'OPENAI_ERROR',details:data?.error?.message||'Falha na OpenAI'});
    const outputText=data.output_text||(data.output||[]).flatMap(i=>i.content||[]).filter(i=>i.type==='output_text').map(i=>i.text).join('');return res.status(200).json({ok:true,model:data.model||model,...JSON.parse(outputText||'{}')});
  }catch(error){console.error('ai-classify error',error);return res.status(500).json({ok:false,error:'INTERNAL_ERROR',details:String(error?.message||error)});}
};
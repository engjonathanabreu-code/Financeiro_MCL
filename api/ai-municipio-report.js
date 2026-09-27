// Relatório de recebimentos por município: a IA financeira escreve a análise a partir dos números já apurados.
// Exige usuário logado no Supabase do Financeiro MCL (token enviado pelo navegador).
const SUPABASE_URL=process.env.MCL_SUPABASE_URL||'https://jeuecmmnxvlzpruyoraw.supabase.co';
const SUPABASE_KEY=process.env.MCL_SUPABASE_PUBLISHABLE_KEY||'sb_publishable_u20s-DDf1dtPwKE1uSaFbA_VDAI7PYL';

async function authenticated(req){
  const auth=String(req.headers?.authorization||'');
  if(!/^Bearer\s+\S+/.test(auth))return false;
  try{
    const r=await fetch(`${SUPABASE_URL}/auth/v1/user`,{headers:{apikey:SUPABASE_KEY,Authorization:auth}});
    return r.ok;
  }catch{return false}
}

const money=v=>Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});

module.exports=async function handler(req,res){
  if(req.method!=='POST')return res.status(405).json({ok:false,error:'METHOD_NOT_ALLOWED'});
  if(!await authenticated(req))return res.status(401).json({ok:false,error:'UNAUTHORIZED',details:'Entre novamente no sistema.'});
  if(!process.env.OPENAI_API_KEY)return res.status(500).json({ok:false,error:'OPENAI_API_KEY_NOT_CONFIGURED'});
  try{
    const b=req.body||{};
    const t=b.totais||{};
    const municipio=String(b.municipio||'').slice(0,120),mes=String(b.mesLabel||b.mes||'').slice(0,40);
    if(!municipio||!mes)return res.status(400).json({ok:false,error:'DADOS_INCOMPLETOS'});
    const lista=(arr,n)=>(Array.isArray(arr)?arr:[]).slice(0,n).map(x=>({cliente:String(x.cliente||'').slice(0,80),parcela:x.parcela,vencimento:x.vencimento,valor:Number(x.valor||0),dias_atraso:x.dias_atraso??null}));
    const payload={
      municipio,mes,
      data_referencia:String(b.hoje||''),
      totais:{
        clientes_ativos:Number(t.clientes||0),parcelas_do_mes:Number(t.parcelas||0),
        previsto_no_mes:Number(t.previsto||0),recebido_das_parcelas_do_mes:Number(t.recebidoDoMes||0),
        faltou_receber:Number(t.faltou||0),total_que_entrou_no_mes:Number(t.entradas||0),
        entradas_de_outros_meses:Number(t.entradasOutrosMeses||0),
        inadimplentes_qtd:Number(t.inadimplentesQtd||0),inadimplentes_valor:Number(t.inadimplentesValor||0),
        a_vencer_qtd:Number(t.aVencerQtd||0),a_vencer_valor:Number(t.aVencerValor||0),
        adimplencia_percentual:Number(t.adimplencia||0)
      },
      maiores_inadimplencias:lista(b.inadimplentes,40)
    };
    const schema={type:'object',additionalProperties:false,properties:{
      resumo_executivo:{type:'string'},
      analise_entradas:{type:'string'},
      analise_inadimplencia:{type:'string'},
      recomendacoes:{type:'array',items:{type:'string'}}
    },required:['resumo_executivo','analise_entradas','analise_inadimplencia','recomendacoes']};
    const prompt=[
      'Você é o analista financeiro da Minha Casa Legal (MCL), empresa de regularização fundiária que recebe parcelas de moradores por município.',
      'Escreva, em português do Brasil, a análise do relatório mensal de recebimentos do município informado.',
      'Use SOMENTE os números fornecidos; não invente valores, clientes nem causas. Cite valores em reais no formato brasileiro.',
      '"faltou_receber" é o previsto no mês menos o que foi pago das parcelas que venciam no mês. "total_que_entrou_no_mes" inclui pagamentos feitos no mês de parcelas de outros meses.',
      'resumo_executivo: 1 parágrafo curto. analise_entradas: 1 parágrafo. analise_inadimplencia: 1 parágrafo, mencionando os casos mais relevantes pelo nome quando houver. recomendacoes: de 3 a 5 ações objetivas de cobrança e acompanhamento.',
      `Referência de valores: previsto ${money(payload.totais.previsto_no_mes)}, entrou ${money(payload.totais.total_que_entrou_no_mes)}, faltou ${money(payload.totais.faltou_receber)}.`,
      'Dados:',JSON.stringify(payload)
    ].join('\n');
    const configured=String(process.env.OPENAI_FINANCE_MODEL||'').trim(),model=!configured||configured==='gpt-5.6-luna'?'gpt-5-mini':configured;
    const r=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:`Bearer ${process.env.OPENAI_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({model,input:prompt,text:{format:{type:'json_schema',name:'mcl_relatorio_municipio',strict:true,schema}}})});
    const data=await r.json();
    if(!r.ok)return res.status(r.status).json({ok:false,error:'OPENAI_ERROR',details:data?.error?.message||'Falha na IA',model});
    const out=data.output_text||(data.output||[]).flatMap(i=>i.content||[]).filter(i=>i.type==='output_text').map(i=>i.text).join('');
    return res.status(200).json({ok:true,model:data.model||model,...JSON.parse(out||'{}')});
  }catch(e){
    return res.status(500).json({ok:false,error:'INTERNAL_ERROR',details:String(e?.message||e)});
  }
};

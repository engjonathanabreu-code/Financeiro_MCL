export default async function handler(req,res){
  if(req.method!=='GET') return res.status(405).json({ok:false,error:'Method not allowed'});
  const base=String(process.env.CHATWOOT_BASE_URL||'').replace(/\/$/,'');
  const token=process.env.CHATWOOT_API_TOKEN;
  if(!base||!token) return res.status(503).json({ok:false,configured:false,error:'CHATWOOT_BASE_URL ou CHATWOOT_API_TOKEN não configurado'});
  const headers={'api_access_token':token,'Content-Type':'application/json'};
  try{
    const accountsR=await fetch(`${base}/api/v1/accounts`,{headers});
    if(!accountsR.ok) throw new Error(`Chatwoot accounts: HTTP ${accountsR.status}`);
    const accounts=await accountsR.json();
    const accountList=Array.isArray(accounts)?accounts:(accounts?.payload||accounts?.data||[]);
    const preferred=Number(process.env.CHATWOOT_ACCOUNT_ID||0);
    const account=accountList.find(a=>Number(a.id)===preferred)||accountList[0];
    if(!account) return res.status(200).json({ok:true,configured:true,accounts:[],inboxes:[],templates:[]});
    const accountId=Number(account.id);
    const inboxesR=await fetch(`${base}/api/v1/accounts/${accountId}/inboxes`,{headers});
    if(!inboxesR.ok) throw new Error(`Chatwoot inboxes: HTTP ${inboxesR.status}`);
    const inboxesJ=await inboxesR.json();
    const inboxes=Array.isArray(inboxesJ)?inboxesJ:(inboxesJ?.payload||inboxesJ?.data||[]);
    const preferredInbox=Number(process.env.CHATWOOT_INBOX_ID||0);
    const whatsappInboxes=inboxes.filter(i=>String(i.channel_type||i.channel?.type||'').toLowerCase().includes('whatsapp')||String(i.name||'').toLowerCase().includes('whatsapp'));
    const inbox=whatsappInboxes.find(i=>Number(i.id)===preferredInbox)||whatsappInboxes[0]||inboxes.find(i=>Number(i.id)===preferredInbox)||inboxes[0];
    let templates=[];
    if(inbox){
      const tR=await fetch(`${base}/api/v1/accounts/${accountId}/inboxes/${inbox.id}/message_templates`,{headers});
      if(tR.ok){
        const tj=await tR.json();
        templates=Array.isArray(tj)?tj:(tj?.payload||tj?.data||[]);
      }
    }
    res.status(200).json({
      ok:true,
      configured:true,
      account:{id:accountId,name:account.name||null},
      inboxes:whatsappInboxes.map(i=>({id:i.id,name:i.name,channel_type:i.channel_type||i.channel?.type||null,provider:i.provider||i.channel?.provider||null})),
      selected_inbox:inbox?{id:inbox.id,name:inbox.name}:null,
      templates:templates.map(t=>({name:t.name||t.template_name||null,language:t.language||t.locale||null,status:t.status||null,category:t.category||null,components:t.components||null}))
    });
  }catch(e){
    res.status(502).json({ok:false,configured:true,error:e.message});
  }
}

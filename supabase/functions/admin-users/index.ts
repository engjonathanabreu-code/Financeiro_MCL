// Edge Function admin-users do Financeiro MCL (projeto jeuecmmnxvlzpruyoraw).
// Cria e edita usuários com a service role. Quem pode chamar é decidido pela tabela de permissões
// (aba Usuários: "criar" para action=create, "editar" para action=update), via mcl_pode_de.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors={
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods':'POST, OPTIONS'
}
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json'}})

Deno.serve(async(req)=>{
  if(req.method==='OPTIONS') return new Response('ok',{headers:cors})
  if(req.method!=='POST') return json({ok:false,error:'METHOD_NOT_ALLOWED'},405)
  try{
    const url=Deno.env.get('SUPABASE_URL')!
    const service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const authHeader=req.headers.get('Authorization')||''
    const serviceClient=createClient(url,service,{auth:{persistSession:false}})
    const token=authHeader.replace(/^Bearer\s+/i,'')
    const {data:userData,error:userError}=await serviceClient.auth.getUser(token)
    if(userError||!userData.user) return json({ok:false,error:'UNAUTHORIZED'},401)
    const {data:caller,error:profileError}=await serviceClient.from('profiles').select('ativo').eq('id',userData.user.id).maybeSingle()
    if(profileError||!caller||caller.ativo===false) return json({ok:false,error:'INACTIVE_USER'},403)
    const body=await req.json().catch(()=>({}))
    const action=String(body.action||'create')
    if(action!=='create'&&action!=='update') return json({ok:false,error:'UNKNOWN_ACTION'},400)
    const {data:permitido,error:permError}=await serviceClient.rpc('mcl_pode_de',{p_usuario:userData.user.id,p_aba:'users',p_acao:action==='create'?'criar':'editar'})
    if(permError) return json({ok:false,error:'PERMISSION_CHECK_FAILED',details:permError.message},500)
    if(!permitido) return json({ok:false,error:'PERMISSION_REQUIRED'},403)
    if(action==='create'){
      const email=String(body.email||'').trim().toLowerCase(),password=String(body.password||''),nome=String(body.nome||'').trim(),tipo=String(body.tipo||'Funcionário').trim(),setor=String(body.setor||tipo).trim()
      if(!/^\S+@\S+\.\S+$/.test(email)||password.length<8||!nome) return json({ok:false,error:'INVALID_DATA'},400)
      const {data,error}=await serviceClient.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{nome,tipo,setor}})
      if(error) throw error
      await serviceClient.from('profiles').upsert({id:data.user.id,nome,email,tipo,setor,ativo:true})
      return json({ok:true,userId:data.user.id})
    }
    const userId=String(body.userId||'')
    if(!userId) return json({ok:false,error:'INVALID_DATA'},400)
    const authChanges:Record<string,string>={}
    if(body.email) authChanges.email=String(body.email).trim().toLowerCase()
    if(body.password) authChanges.password=String(body.password)
    if(Object.keys(authChanges).length){ const {error}=await serviceClient.auth.admin.updateUserById(userId,authChanges); if(error) throw error }
    const profile:Record<string,unknown>={}
    if(body.nome!=null) profile.nome=String(body.nome).trim()
    if(body.email!=null) profile.email=String(body.email).trim().toLowerCase()
    if(body.tipo!=null) profile.tipo=String(body.tipo)
    if(body.setor!=null) profile.setor=String(body.setor)
    if(body.ativo!=null) profile.ativo=!!body.ativo
    if(Object.keys(profile).length){ const {error}=await serviceClient.from('profiles').update(profile).eq('id',userId); if(error) throw error }
    return json({ok:true,userId})
  }catch(e){return json({ok:false,error:String((e as Error)?.message||e)},500)}
})

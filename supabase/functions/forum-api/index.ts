import {SCHOOL_USER,gmail,bounded,displayName,password,loginPassword,uuid,page} from './validation.ts';
import {recoveryAction} from './recovery.ts';
import {sendForumMail} from './mailer.ts';

const origin='https://1ch666.github.io';
const base=Deno.env.get('SUPABASE_URL')!;
const secret=JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')||'{}').default||Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const enabled=()=>Deno.env.get('FORUM_SIGNUP_ENABLED')==='true';
const backupEnabled=()=>Deno.env.get('FORUM_BACKUP_ENABLED')==='true'&&!!Deno.env.get('FORUM_SMTP_USER')&&!!Deno.env.get('FORUM_SMTP_PASS')&&(Deno.env.get('FORUM_RECOVERY_HMAC_KEY')||'').length>=32;
const recoveryDeps=()=>({db,upstream,send:sendForumMail,hmacKey:Deno.env.get('FORUM_RECOVERY_HMAC_KEY')||''});
const headers={'Content-Type':'application/json','Cache-Control':'no-store','Access-Control-Allow-Origin':origin,
  'Access-Control-Allow-Headers':'authorization,apikey,content-type,x-forum-token','Access-Control-Allow-Methods':'POST,OPTIONS','Vary':'Origin'};
const reply=(status:number,data:unknown)=>new Response(JSON.stringify(data),{status,headers});
class HttpError extends Error {constructor(public status:number,message:string){super(message)}}
async function upstream(path:string,options:RequestInit={}){
  return fetch(base+path,{...options,headers:{apikey:secret,'Content-Type':'application/json',...options.headers},signal:AbortSignal.timeout(15000)});
}
async function user(token:string){
  if(!token||token.length>8192)throw new HttpError(401,'請重新登入');
  const res=await upstream('/auth/v1/user',{headers:{Authorization:'Bearer '+token}});
  if(!res.ok)throw new HttpError(401,'登入已失效，請重新登入');return await res.json();
}
async function db(path:string,options:RequestInit={}){
  const res=await upstream('/rest/v1/'+path,options);
  if(!res.ok){
    const failure=await res.json().catch(()=>({}));
    if(String(failure.message).includes('15 seconds'))throw new HttpError(429,'發言間隔至少 15 秒，請稍後再試');
    if(failure.code==='23505')throw new HttpError(409,'這個信箱 已有論壇帳號');
    throw new HttpError(503,'論壇資料服務暫時無法使用');
  }
  return res.status===204?null:await res.json();
}
function clientIP(req:Request){
  const ip=req.headers.get('cf-connecting-ip')?.trim()||'';
  if(/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)&&ip.split('.').every(x=>Number(x)<=255))return ip;
  if(/^[0-9a-f:]+$/i.test(ip)&&ip.includes(':')){try{new URL('http://['+ip+']/');return ip}catch{}}
  throw new HttpError(503,'來源驗證暫時無法使用');
}
async function readBody(req:Request){
  const reader=req.body?.getReader();if(!reader)throw new HttpError(400,'缺少請求內容');
  let size=0;const chunks:Uint8Array[]=[];
  while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>100000){await reader.cancel();throw new HttpError(413,'內容過長')}chunks.push(value)}
  const bytes=new Uint8Array(size);let i=0;for(const chunk of chunks){bytes.set(chunk,i);i+=chunk.length}
  return JSON.parse(new TextDecoder().decode(bytes));
}
function sessionResult(data:any){
  if(data.user?.id===SCHOOL_USER)throw new HttpError(403,'此信箱屬於同校共用帳號，不能作為個人會員；這不是信箱未驗證。若個人 Google 被誤綁，請聯絡管理員拆分。');
  if(!data.access_token||!data.user?.email_confirmed_at)throw new HttpError(403,'請先驗證信箱，再使用個人帳號登入');
  gmail(data.user.email);
  return {access_token:data.access_token,expires_at:data.expires_at||Math.floor(Date.now()/1000)+data.expires_in};
}
Deno.serve(async req=>{
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
  if(req.method!=='POST')return reply(405,{error:'Method not allowed'});
  if(req.headers.get('origin')&&req.headers.get('origin')!==origin)return reply(403,{error:'Forbidden'});
  try{
    if(!secret)throw new HttpError(503,'論壇尚未設定完成');
    const schoolToken=(req.headers.get('authorization')||'').replace(/^Bearer /i,'');
    const school=await user(schoolToken);
    if(school.id!==SCHOOL_USER)throw new HttpError(403,'請先通過同校識別');
    const allow=await db('site_members?user_id=eq.'+SCHOOL_USER+'&enabled=eq.true&select=user_id');
    if(!allow.length)throw new HttpError(403,'同校識別已停用');
    const input=await readBody(req),action=input.action;
    if(action==='status')return reply(200,{signup_enabled:enabled(),backup_enabled:backupEnabled()});
    if(action==='google_exchange'){
      if(typeof input.code!=='string'||input.code.length>2048||!input.code||typeof input.verifier!=='string'||! /^[A-Za-z0-9_-]{43,128}$/.test(input.verifier))throw new HttpError(400,'Google 登入資料不完整');
      const res=await upstream('/auth/v1/token?grant_type=pkce',{method:'POST',headers:{'Sb-Forwarded-For':clientIP(req)},body:JSON.stringify({auth_code:input.code,code_verifier:input.verifier})});
      if(!res.ok)throw new HttpError(401,'Google 登入已過期或驗證失敗，請重新登入');
      return reply(200,sessionResult(await res.json()));
    }
    if(['backup_recover','backup_reset'].includes(action)){
      if(!backupEnabled())throw new HttpError(503,'備援信箱功能尚未開放');
      try{return reply(200,await recoveryAction(action,input,null,recoveryDeps()))}
      catch(error){if(error instanceof HttpError)throw error;throw new HttpError(400,error instanceof Error?error.message:'備援驗證失敗')}
    }
    if(['register','login','verify','resend','recover'].includes(action)){
      let email=gmail(input.email);const ip=clientIP(req);
      // Google may retain dots in its address. Password login/recovery targets
      // the verified canonical member's Auth address, without exposing it.
      if(action==='login'||action==='recover'||(action==='verify'&&input.type==='recovery')){
        const owners=await db('forum_identities?gmail_key=eq.'+encodeURIComponent(email)+'&select=user_id');
        if(owners.length===1){
          const found=await upstream('/auth/v1/admin/users/'+owners[0].user_id);
          if(found.ok){const existing=await found.json();const account=existing.user||existing;
            if(account.email_confirmed_at&&gmail(account.email)===email)email=account.email;
          }
        }
      }
      let path='',body:any;
      if(action==='register'){
        if(!enabled())throw new HttpError(503,'註冊尚未開放，正在設定驗證信服務');
        path='/auth/v1/signup';body={email,password:password(input.password),data:{display_name:displayName(input.name)}};
      }else if(action==='login'){
        path='/auth/v1/token?grant_type=password';body={email,password:loginPassword(input.password)};
      }else if(action==='verify'){
        if(!['signup','recovery'].includes(input.type)||!/^\d{6,10}$/.test(input.code))throw new HttpError(400,'請輸入信件中的驗證碼');
        path='/auth/v1/verify';body={email,token:input.code,type:input.type};
      }else if(action==='resend'){
        path='/auth/v1/resend';body={email,type:'signup'};
      }else{path='/auth/v1/recover';body={email};}
      const res=await upstream(path,{method:'POST',headers:{'Sb-Forwarded-For':ip},body:JSON.stringify(body)});
      const data=await res.json();
      if(res.status===429)throw new HttpError(429,'請求過於頻繁，請稍後再試');
      if(res.status>=500)throw new HttpError(503,'驗證信或登入服務暫時無法使用');
      if(['register','resend','recover'].includes(action)){
        // Do not reveal whether a mailbox is registered to a visitor.
        if(action==='register'&&data.access_token)throw new HttpError(503,'信箱驗證設定異常，請聯絡管理員');
        return reply(200,{message:'若此信箱可執行這項操作，將收到驗證信。請查看收件匣與垃圾郵件。已註冊者請使用登入或忘記密碼。'});
      }
      if(!res.ok)throw new HttpError(401,action==='verify'?'驗證碼錯誤或已過期':'信箱、密碼錯誤，或尚未完成信箱驗證');
      return reply(200,sessionResult(data));
    }
    if(action==='list'){
      const offset=page(input.page)*20;
      const posts=await db('forum_posts?select=id,title,created_at,author:forum_profiles(display_name)&order=created_at.desc,id.desc&limit=21&offset='+offset);
      return reply(200,{posts:posts.slice(0,20),more:posts.length>20});
    }
    if(action==='thread'){
      const id=uuid(input.id),offset=page(input.page)*30;
      const posts=await db('forum_posts?id=eq.'+id+'&select=id,author_id,title,body,created_at,author:forum_profiles(display_name)');
      if(!posts.length)throw new HttpError(404,'文章不存在');
      const comments=await db('forum_comments?post_id=eq.'+id+'&select=id,body,created_at,author:forum_profiles(display_name)&order=created_at.asc,id.asc&limit=31&offset='+offset);
      return reply(200,{post:posts[0],comments:comments.slice(0,30),more:comments.length>30});
    }
    const personal=await user(req.headers.get('x-forum-token')||'');
    if(personal.id===SCHOOL_USER||!personal.email_confirmed_at)throw new HttpError(403,'請先登入已驗證的個人信箱帳號');
    const canonical=gmail(personal.email);
    const links=await db('forum_auth_links?auth_user_id=eq.'+personal.id+'&select=user_id');
    if(links.length!==1)throw new HttpError(403,'論壇會員身分不符');
    const memberId=links[0].user_id;
    const identities=await db('forum_identities?user_id=eq.'+memberId+'&select=gmail_key');
    if(identities.length!==1||identities[0].gmail_key!==canonical)throw new HttpError(403,'論壇會員身分不符');
    // Read claims only AFTER Auth has verified this exact bearer token.
    let sessionKey:string;
    try{const part=req.headers.get('x-forum-token')!.split('.')[1];sessionKey=uuid(JSON.parse(atob(part.replace(/-/g,'+').replace(/_/g,'/'))).session_id)}
    catch{throw new HttpError(401,'請重新登入個人帳號')}
    const sessionAllowed=await db('rpc/forum_session_allowed',{method:'POST',body:JSON.stringify({actor_id:personal.id,session_key:sessionKey})});
    if(!sessionAllowed)throw new HttpError(401,'此登入已失效，請重新登入個人帳號');
    if(action==='delete_post'){
      // Ownership is part of the atomic DELETE, never trusted from client input.
      // Existing FK cascade also removes replies belonging to this thread.
      const removed=await db('forum_posts?id=eq.'+uuid(input.id)+'&author_id=eq.'+memberId+'&select=id',{
        method:'DELETE',headers:{Prefer:'return=representation'}
      });
      if(!removed?.length)throw new HttpError(404,'文章不存在，或你不是文章作者');
      return reply(200,{ok:true});
    }
    if(['backup_start','backup_confirm'].includes(action)){
      if(!backupEnabled())throw new HttpError(503,'備援信箱功能尚未開放');
      try{return reply(200,await recoveryAction(action,input,{...personal,id:memberId},recoveryDeps()))}
      catch(error){if(error instanceof HttpError)throw error;throw new HttpError(400,error instanceof Error?error.message:'備援驗證失敗')}
    }
    if(action==='logout'){
      await upstream('/auth/v1/logout?scope=local',{method:'POST',headers:{Authorization:'Bearer '+req.headers.get('x-forum-token')}});
      return reply(200,{ok:true});
    }
    if(action==='password'){
      const res=await upstream('/auth/v1/admin/users/'+memberId,{method:'PUT',body:JSON.stringify({password:password(input.password)})});
      if(!res.ok)throw new HttpError(400,'密碼更新失敗，請確認密碼長度並稍後重試');
      return reply(200,{ok:true});
    }
    if(action==='me'){
      const profiles=await db('forum_profiles?user_id=eq.'+memberId+'&select=display_name,created_at,updated_at');
      const backup=await db('forum_backup?user_id=eq.'+memberId+'&select=email,verified_at');
      return reply(200,{member_id:memberId,email:canonical,profile:profiles[0]||null,suggested_name:personal.user_metadata?.display_name||'',backup:backup[0]||null,backup_enabled:backupEnabled()});
    }
    let payload:any;
    if(action==='profile')payload={display_name:displayName(input.name)};
    else if(action==='post')payload={title:bounded(input.title,'標題',2,120),body:bounded(input.body,'內容',1,20000)};
    else if(action==='comment')payload={post_id:uuid(input.id),body:bounded(input.body,'留言',1,10000)};
    else throw new HttpError(400,'不支援的操作');
    const result=await db('rpc/forum_write',{method:'POST',body:JSON.stringify({actor_id:memberId,operation:action,payload})});
    return reply(200,result);
  }catch(error){
    if(error instanceof HttpError)return reply(error.status,{error:error.message});
    if(error instanceof SyntaxError)return reply(400,{error:'請求格式錯誤'});
    if(error instanceof Error&&/Gmail|信箱|名稱|密碼|標題|內容|留言|頁碼|識別碼/.test(error.message))return reply(400,{error:error.message});
    return reply(503,{error:'論壇服務暫時無法使用，請稍後重試'});
  }
});

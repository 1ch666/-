import {gmail,password,uuid} from './validation.ts';

export function backupEmail(value:unknown):string {
  if(typeof value!=='string'||value.length>254)throw new Error('備援信箱格式錯誤');
  const email=value.trim().toLowerCase();
  if(!/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/.test(email))throw new Error('備援信箱格式錯誤');
  if(email.endsWith('@googlemail.com'))return gmail(email.replace(/@googlemail\.com$/,'@gmail.com'));
  return email.endsWith('@gmail.com')?gmail(email):email;
}
export function newCode():string {
  // Rejection sampling avoids modulo bias.
  const values=new Uint32Array(1);do{crypto.getRandomValues(values)}while(values[0]>=4200000000);
  return String(values[0]%100000000).padStart(8,'0');
}
export async function proof(secret:string,id:string,purpose:string,code:string):Promise<string>{
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const bytes=await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(JSON.stringify([id,purpose,code])));
  return Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');
}
type Dependencies={db:(path:string,options?:RequestInit)=>Promise<any>;upstream:(path:string,options?:RequestInit)=>Promise<Response>;
 send:(email:string,subject:string,text:string)=>Promise<void>;hmacKey:string};
const generic='若帳號與備援信箱相符，將寄送驗證碼。請查看收件匣及垃圾郵件。';
const rpc=(data:unknown)=>({method:'POST',body:JSON.stringify(data)});
export async function recoveryAction(action:string,input:any,actor:any,deps:Dependencies){
  const {db,upstream,send,hmacKey}=deps;
  if(!hmacKey||hmacKey.length<32)throw new Error('備援信箱服務尚未設定');
  if(action==='backup_start'||action==='backup_recover'){
    const email=backupEmail(input.backup_email),id=crypto.randomUUID(),code=newCode(),primaryCode=newCode();
    let uid=actor?.id;
    if(action==='backup_recover')uid=await db('rpc/forum_recovery_target',rpc({primary_email:gmail(input.email),backup_email:email}));
    if(uid){
      const kind=action==='backup_start'?'bind':'recover';
      const accepted=await db('rpc/forum_mail_issue',rpc({actor_id:uid,ticket_id:id,kind,target_email:email,
        proof:await proof(hmacKey,id,kind,code),primary_proof:kind==='bind'?await proof(hmacKey,id,'primary',primaryCode):null}));
      if(accepted){
        try{
          if(kind==='bind')await send(actor.email,'確認新增論壇備援信箱',`原信箱驗證碼：${primaryCode}\n10 分鐘內有效。只有你正在新增備援信箱時才可輸入，請勿提供給他人。`);
          await send(email,kind==='bind'?'驗證論壇備援信箱':'重設論壇密碼',`驗證碼：${code}\n10 分鐘內有效，最多嘗試 5 次。請勿提供給他人。若非本人操作，請忽略。`);
        }catch{
          await db('forum_mail_challenges?id=eq.'+id,{method:'PATCH',body:JSON.stringify({consumed_at:new Date().toISOString()})});
          // Do not expose whether the recovery account matched through SMTP errors.
          if(kind==='bind')throw new Error('驗證信寄送失敗，請稍後重試');
        }
      }else if(kind==='bind')throw new Error('暫時無法綁定，請檢查信箱或稍後重試');
    }
    return {ticket:id,message:action==='backup_start'?'請輸入原登入信箱 與備援信箱各自收到的驗證碼。':generic};
  }
  const id=uuid(input.ticket),kind=action==='backup_confirm'?'bind':'recover';
  if(!/^\d{8}$/.test(input.code)||(kind==='bind'&&!/^\d{8}$/.test(input.primary_code)))throw new Error('請輸入 8 位驗證碼');
  // Validate password before consuming a one-time code.
  const nextPassword=kind==='recover'?password(input.password):null;
  const uid=await db('rpc/forum_mail_consume',rpc({ticket_id:id,kind,proof:await proof(hmacKey,id,kind,input.code),
    primary_proof:kind==='bind'?await proof(hmacKey,id,'primary',input.primary_code):null,actor_id:actor?.id||null}));
  if(!uid)throw new Error('驗證碼錯誤、已過期或已使用，請重新申請');
  if(kind==='recover'){
    const links=await db('forum_auth_links?user_id=eq.'+uid+'&select=auth_user_id');
    if(!links?.length)throw new Error('密碼更新未完成，請重新申請備援驗證碼');
    let data:any;
    for(const link of links){
      const res=await upstream('/auth/v1/admin/users/'+link.auth_user_id,{method:'PUT',body:JSON.stringify({password:nextPassword})});
      if(!res.ok)throw new Error('密碼更新未完成，請重新申請備援驗證碼');
      const updated=await res.json();if(link.auth_user_id===uid)data=updated;
    }
    // Keep all previously issued sessions invalid even if Auth JWTs have not expired.
    await db('forum_recovery_guard?user_id=eq.'+uid,{method:'PATCH',body:JSON.stringify({blocked:false,revoked_before:new Date().toISOString()})});
    try{await send(data.email||data.user?.email,'論壇密碼已重設','你的論壇密碼已透過備援信箱重設。舊論壇登入已失效；若非本人操作，請立即取回帳號並檢查信箱安全。')}catch{/* notification failure must not repeat password update */}
    return {message:'密碼已重設，請用原登入信箱 與新論壇密碼重新登入。'};
  }
  try{await send(actor.email,'論壇備援信箱已變更','你的論壇備援信箱已通過雙信箱驗證並更新，可用來重設論壇密碼。若非本人操作，請立即檢查原登入信箱 的安全性並聯絡管理員。')}catch{/* binding remains committed */}
  return {message:'備援信箱已驗證並綁定，可用來重設論壇密碼。'};
}

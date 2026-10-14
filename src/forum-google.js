const base='https://jfrmuqvfuxxoqfjvvnex.supabase.co';
const origin='https://1ch666.github.io';
const callback=origin+'/-/cpp_competitive_multi_page/forum-callback.html';
const base64=bytes=>btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
let cancelPending;
export function cancelGoogle(){cancelPending?.();}
export async function googleLogin(request){
  cancelGoogle();
  // Open synchronously on the user's click; never persist verifier or tokens.
  const popup=window.open('about:blank','_blank','popup,width=520,height=720');
  if(!popup)throw new Error('請允許 Google 登入彈出視窗');
  const verifier=base64(crypto.getRandomValues(new Uint8Array(32)));
  const challenge=base64(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier))));
  const code=await new Promise((resolve,reject)=>{
    const finish=(error,value)=>{clearTimeout(timer);window.removeEventListener('message',receive);cancelPending=null;popup.close();error?reject(error):resolve(value)};
    const receive=event=>{
      if(event.origin!==origin||event.source!==popup||event.data?.type!=='forum-google-callback')return;
      if(typeof event.data.code==='string'&&event.data.code.length>0&&event.data.code.length<=2048)finish(null,event.data.code);
      else finish(new Error('Google 登入未完成，請重新嘗試'));
    };
    const timer=setTimeout(()=>finish(new Error('Google 登入逾時；請重新開啟登入視窗')),180000);
    cancelPending=()=>finish(new Error('Google 登入已取消'));
    window.addEventListener('message',receive);
    const url=new URL(base+'/auth/v1/authorize');
    url.search=new URLSearchParams({provider:'google',redirect_to:callback,code_challenge:challenge,code_challenge_method:'s256',scopes:'email profile',prompt:'select_account'}).toString();
    popup.location.replace(url.href);
  });
  return request('google_exchange',{code,verifier});
}

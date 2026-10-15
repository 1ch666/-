(()=>{
  'use strict';
  const base='https://jfrmuqvfuxxoqfjvvnex.supabase.co';
  // Public anon key: access is enforced by Auth and database RLS, not this key.
  const key='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impmcm11cXZmdXh4b3FmanZ2bmV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE0NTQ5NDMsImV4cCI6MjEwNzAzMDk0M30.Bdd9s0_XAhfVt0SmcNcvVENphTHyQkxliWpwvkJn8dw';
  const storageKey='practice.session.v1';
  // A new document is a new visit. Internal navigation never runs this again.
  const home=new URL('index.html',location.href);
  try{sessionStorage.removeItem(storageKey);localStorage.removeItem(storageKey)}catch{}
  if(location.pathname!==home.pathname){location.replace(home.href);return;}
  if(location.search||location.hash)history.replaceState(null,'',home.href);
  const keys=['PROBLEMS','COMBINED_GROUPS','ROADMAP_STAGES','CODEFORCES_GROUPS','CSES_GROUPS','ATCODER_GROUPS','PLATFORMS'];
  let session, timer;
  const shell=document.querySelector('.site-layout'), nav=document.querySelector('.topnav');
  function syncCurrentPage(url){
    const normalize=path=>path.endsWith('/')?path+'index.html':path;
    nav.querySelectorAll('a').forEach(a=>{
      const target=new URL(a.href);
      if(target.origin===url.origin&&normalize(target.pathname)===normalize(url.pathname))a.setAttribute('aria-current','page');
      else a.removeAttribute('aria-current');
    });
  }
  syncCurrentPage(new URL(location.href));
  const panel=document.createElement('main');
  panel.className='auth-panel';
panel.innerHTML='<h1>同校識別</h1><p>這是進站識別，不是個人論壇帳號。</p><form><label for="username">進入識別帳號</label><input id="username" name="username" autocomplete="username" required maxlength="64"><label for="password">進入識別密碼</label><div class="auth-password-wrap"><input id="password" name="password" type="password" autocomplete="current-password" required maxlength="128"><button class="auth-password-toggle" type="button" aria-controls="password" aria-label="顯示密碼" aria-pressed="false" title="顯示密碼"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/><path class="auth-eye-slash" d="m3 3 18 18"/></svg></button></div><button type="submit">進入網站</button><p class="auth-status" role="status" aria-live="polite"></p></form>';
  document.body.append(panel);
  const form=panel.querySelector('form'), message=panel.querySelector('.auth-status'), submit=form.querySelector('button[type="submit"]');
  const passwordToggle=panel.querySelector('.auth-password-toggle');
  function showPassword(visible){form.password.type=visible?'text':'password';passwordToggle.setAttribute('aria-pressed',String(visible));passwordToggle.setAttribute('aria-label',visible?'隱藏密碼':'顯示密碼');passwordToggle.title=visible?'隱藏密碼':'顯示密碼';}
  passwordToggle.addEventListener('click',()=>showPassword(form.password.type==='password'));
  const logout=document.createElement('button'); logout.type='button'; logout.textContent='離開網站'; logout.className='auth-logout'; nav.append(logout);
  const clear=()=>{session=null;clearTimeout(timer);window.resetForumSession?.();window.resetCompilerSession?.();try{sessionStorage.removeItem(storageKey)}catch{}};
  function locked(text='') {showPassword(false);shell.hidden=true;nav.hidden=true;panel.hidden=false;message.textContent=text;document.body.classList.remove('auth-loading');}
  async function request(url,options={}) {
    const response=await fetch(url,{...options,cache:'no-store',credentials:'omit',signal:AbortSignal.timeout(45000)});
    return response;
  }
  window.practiceForumRequest=async(action,data={},forumToken)=>{
    if(!session?.access_token||session.expires_at*1000<=Date.now())throw new Error('同校識別已到期，請重新整理並登入');
    const response=await request(base+'/functions/v1/forum-api',{
      method:'POST',headers:{'Content-Type':'application/json',apikey:key,Authorization:'Bearer '+session.access_token,...(forumToken?{'x-forum-token':forumToken}:{})},
      body:JSON.stringify({...data,action})
    });
    const result=await response.json();if(!response.ok)throw new Error(result.error||'論壇服務尚未就緒');return result;
  };
  async function load() {
    if(!session?.access_token || !Number.isFinite(session.expires_at) || session.expires_at*1000<=Date.now()+5000) {clear();locked('請登入');return;}
    message.textContent='讀取題庫';message.classList.add('waiting-dots');
    const response=await request(base+'/storage/v1/object/authenticated/practice-private/curriculum.json',{
      headers:{apikey:key,Authorization:'Bearer '+session.access_token}
    });
    if(!response.ok){clear();locked('登入已失效或沒有讀取權限，請重新登入。');return;}
    const data=await response.json();
    if(!keys.every(k=>Array.isArray(data[k]))) throw new Error('題庫格式錯誤');
    keys.forEach(k=>window[k]=data[k]);
    const script=document.createElement('script');script.src='app.js?v=20261014-compiler';
    await new Promise((resolve,reject)=>{script.onload=resolve;script.onerror=()=>reject(new Error('頁面載入失敗'));document.head.append(script)});
    panel.hidden=true;shell.hidden=false;nav.hidden=false;document.body.classList.remove('auth-loading');
    if(location.hash)window.scrollPracticeSection?.(location.hash);
    timer=setTimeout(()=>{clear();location.reload()},Math.max(0,session.expires_at*1000-Date.now()));
  }
  form.addEventListener('submit',async event=>{
    event.preventDefault();showPassword(false);submit.disabled=true;passwordToggle.disabled=true;message.textContent='登入中';message.classList.add('waiting-dots');
    try{
      const response=await request(base+'/functions/v1/site-login',{
        method:'POST',headers:{'Content-Type':'application/json',apikey:key,Authorization:'Bearer '+key},
        body:JSON.stringify({username:form.username.value.trim(),password:form.password.value})
      });
      const data=await response.json();
      form.password.value='';
      if(!response.ok){message.textContent=data.error||'登入失敗，請稍後重試。';return;}
      session={access_token:data.access_token,expires_at:data.expires_at};
      await load();
    }catch{message.textContent='連線或載入失敗，請稍後重試。'}finally{message.classList.remove('waiting-dots');form.password.value='';showPassword(false);passwordToggle.disabled=false;submit.disabled=false;}
  });
  logout.addEventListener('click',async()=>{
    const token=session?.access_token;clear();
    if(token) request(base+'/auth/v1/logout?scope=local',{method:'POST',headers:{apikey:key,Authorization:'Bearer '+token}}).catch(()=>{});
    location.reload();
  });
  // Keep the authenticated document alive for same-tab site navigation only.
  // No token is written to storage, URLs, or history; a real reload starts locked.
  const siteRoot=new URL('./',location.href);
  // Accordion heights change; native restoration would override section positioning.
  history.scrollRestoration='manual';
  const sitePages=new Set(['index.html','cses.html','zerojudge.html','codeforces.html','atcoder.html','tioj.html','forum.html','profile.html','compiler.html']);
  let navigationId=0, navigationRequest;
  let renderedPage=location.pathname+location.search;
  function isSitePage(url){return url.origin===siteRoot.origin&&url.pathname.startsWith(siteRoot.pathname)&&sitePages.has(url.pathname.slice(siteRoot.pathname.length))}
  async function navigate(url,fromHistory=false){
    const id=++navigationId;
    navigationRequest?.abort();
    navigationRequest=new AbortController();
    nav.setAttribute('aria-busy','true');
    try{
      if(!session?.access_token||session.expires_at*1000<=Date.now()+5000){clear();location.reload();return;}
      const response=await fetch(url.href,{cache:'no-store',credentials:'omit',signal:navigationRequest.signal});
      if(!response.ok)throw new Error('頁面載入失敗');
      const parsed=new DOMParser().parseFromString(await response.text(),'text/html');
      const nextShell=parsed.querySelector('.site-layout');
      if(!nextShell||!['roadmap','platform','forum','compiler'].includes(parsed.body.dataset.page))throw new Error('頁面格式錯誤');
      if(id!==navigationId||!session)return;
      window.leaveForumPage?.();
      window.leaveCompilerPage?.();
      shell.replaceChildren(...Array.from(nextShell.childNodes).map(n=>document.importNode(n,true)));
      document.body.dataset.page=parsed.body.dataset.page;
      document.body.dataset.platform=parsed.body.dataset.platform||'';
      document.title=parsed.title;
      document.body.classList.remove('toc-collapsed');
      if(!fromHistory)history.pushState(null,'',url.href);
      renderedPage=url.pathname+url.search;
      window.renderPracticePage();
      syncCurrentPage(url);
      if(!url.hash||!window.scrollPracticeSection?.(url.hash))window.scrollTo(0,0);
    }catch(error){
      if(id!==navigationId||error.name==='AbortError')return;
      if(fromHistory){location.reload();return;}
      alert('頁面載入失敗，已保留目前頁面與登入狀態，請重試。');
    }finally{if(id===navigationId)nav.removeAttribute('aria-busy')}
  }
  nav.addEventListener('click',event=>{
    const link=event.target.closest('a');
    if(!link||!session||event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey||link.hasAttribute('download')||(link.target&&link.target!=='_self'))return;
    const url=new URL(link.href);
    if(!isSitePage(url))return;
    event.preventDefault();
    navigate(url);
  });
  addEventListener('popstate',()=>{
    const url=new URL(location.href);
    if(!session||!isSitePage(url)){location.reload();return;}
    if(url.pathname+url.search===renderedPage){
      // Fragment history is an in-page jump, not a page fetch or re-render.
      ++navigationId;navigationRequest?.abort();nav.removeAttribute('aria-busy');
      if(!url.hash||!window.scrollPracticeSection?.(url.hash))window.scrollTo(0,0);
      return;
    }
    navigate(url,true);
  });
  addEventListener('pagehide',()=>{
    ++navigationId;navigationRequest?.abort();clear();locked('請重新登入');form.reset();
    keys.forEach(k=>delete window[k]);shell.replaceChildren();
  });
  addEventListener('pageshow',event=>{if(event.persisted){clear();locked('請重新登入');location.reload()}});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&session?.expires_at*1000<=Date.now()){clear();location.reload()}});
  // Login tokens live only in this document's memory; discard legacy cached sessions.
  clear();
  locked('請登入');
})();

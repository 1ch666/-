(()=>{
  'use strict';
  const base='https://jfrmuqvfuxxoqfjvvnex.supabase.co';
  // Public anon key: access is enforced by Auth and database RLS, not this key.
  const key='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impmcm11cXZmdXh4b3FmanZ2bmV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE0NTQ5NDMsImV4cCI6MjEwNzAzMDk0M30.Bdd9s0_XAhfVt0SmcNcvVENphTHyQkxliWpwvkJn8dw';
  const storageKey='practice.session.v1';
  const keys=['PROBLEMS','COMBINED_GROUPS','ROADMAP_STAGES','CODEFORCES_GROUPS','CSES_GROUPS','ATCODER_GROUPS','PLATFORMS'];
  let session, timer;
  const shell=document.querySelector('.site-layout'), nav=document.querySelector('.topnav');
  const panel=document.createElement('main');
  panel.className='auth-panel';
  panel.innerHTML='<h1>題庫登入</h1><form><label for="username">帳號</label><input id="username" name="username" autocomplete="username" required maxlength="64"><label for="password">密碼</label><input id="password" name="password" type="password" autocomplete="current-password" required maxlength="128"><button type="submit">登入</button><p class="auth-status" role="status" aria-live="polite"></p></form>';
  document.body.append(panel);
  const form=panel.querySelector('form'), message=panel.querySelector('.auth-status'), submit=form.querySelector('button');
  const logout=document.createElement('button'); logout.type='button'; logout.textContent='登出'; logout.className='auth-logout'; nav.append(logout);
  const clear=()=>{session=null;clearTimeout(timer);try{sessionStorage.removeItem(storageKey)}catch{}};
  function locked(text='') {shell.hidden=true;nav.hidden=true;panel.hidden=false;message.textContent=text;document.body.classList.remove('auth-loading');}
  async function request(url,options={}) {
    const response=await fetch(url,{...options,cache:'no-store',credentials:'omit',signal:AbortSignal.timeout(45000)});
    return response;
  }
  async function load() {
    if(!session?.access_token || !Number.isFinite(session.expires_at) || session.expires_at*1000<=Date.now()+5000) {clear();locked('請登入');return;}
    message.textContent='讀取題庫…';
    const response=await request(base+'/storage/v1/object/authenticated/practice-private/curriculum.json',{
      headers:{apikey:key,Authorization:'Bearer '+session.access_token}
    });
    if(!response.ok){clear();locked('登入已失效或沒有讀取權限，請重新登入。');return;}
    const data=await response.json();
    if(!keys.every(k=>Array.isArray(data[k]))) throw new Error('題庫格式錯誤');
    keys.forEach(k=>window[k]=data[k]);
    const script=document.createElement('script');script.src='app.js?v=20261010-toc';
    await new Promise((resolve,reject)=>{script.onload=resolve;script.onerror=()=>reject(new Error('頁面載入失敗'));document.head.append(script)});
    panel.hidden=true;shell.hidden=false;nav.hidden=false;document.body.classList.remove('auth-loading');
    if(location.hash)window.scrollPracticeSection(location.hash);
    timer=setTimeout(()=>{clear();location.reload()},Math.max(0,session.expires_at*1000-Date.now()));
  }
  form.addEventListener('submit',async event=>{
    event.preventDefault();submit.disabled=true;message.textContent='驗證中…';
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
    }catch{message.textContent='連線或載入失敗，請稍後重試。'}finally{submit.disabled=false;}
  });
  logout.addEventListener('click',async()=>{
    const token=session?.access_token;clear();
    if(token) request(base+'/auth/v1/logout?scope=local',{method:'POST',headers:{apikey:key,Authorization:'Bearer '+token}}).catch(()=>{});
    location.reload();
  });
  // Keep the authenticated document alive for same-tab site navigation only.
  // No token is written to storage, URLs, or history; a real reload starts locked.
  const siteRoot=new URL('./',location.href);
  const sitePages=new Set(['index.html','cses.html','zerojudge.html','codeforces.html','atcoder.html','tioj.html']);
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
      if(!nextShell||!['roadmap','platform'].includes(parsed.body.dataset.page))throw new Error('頁面格式錯誤');
      if(id!==navigationId||!session)return;
      shell.replaceChildren(...Array.from(nextShell.childNodes).map(n=>document.importNode(n,true)));
      document.body.dataset.page=parsed.body.dataset.page;
      document.body.dataset.platform=parsed.body.dataset.platform||'';
      document.title=parsed.title;
      document.body.classList.remove('toc-collapsed');
      if(!fromHistory)history.pushState(null,'',url.href);
      renderedPage=url.pathname+url.search;
      window.renderPracticePage();
      nav.querySelectorAll('a').forEach(a=>{if(new URL(a.href).pathname===url.pathname)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current')});
      if(!url.hash||!window.scrollPracticeSection(url.hash))window.scrollTo(0,0);
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
      if(!url.hash||!window.scrollPracticeSection(url.hash))window.scrollTo(0,0);
      return;
    }
    navigate(url,true);
  });
  addEventListener('pagehide',()=>{clear();locked('請重新登入');form.reset()});
  addEventListener('pageshow',event=>{if(event.persisted){clear();locked('請重新登入');location.reload()}});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&session?.expires_at*1000<=Date.now()){clear();location.reload()}});
  // Login tokens live only in this document's memory; discard legacy cached sessions.
  clear();
  locked('請登入');
})();

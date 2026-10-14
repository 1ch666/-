import {renderMarkdown} from './forum-markdown.js';
import {googleLogin,cancelGoogle} from './forum-google.js';
import {avatarMarkup,prepareAvatar} from './forum-avatar.js';

(()=>{
  let member=null,expiryTimer,me=null,root,screen='list',listPage=0,threadId='',commentPage=0,verifyType='signup',pendingEmail='',generation=0,backupTicket='';
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const date=s=>new Date(s).toLocaleString('zh-TW',{dateStyle:'medium',timeStyle:'short'});
  const field=(label,name,type='text',extra='')=>`<label>${label}<input name="${name}" type="${type}" required ${extra}></label>`;
  const emailField=()=>field('會員信箱','email','email','autocomplete="email" maxlength="254" placeholder="name@gmail.com"');
  const passwordField=(fresh=false)=>field('論壇密碼（不是 Google 密碼）','password','password',`autocomplete="${fresh?'new-password':'current-password'}" ${fresh?'minlength="12"':''} maxlength="128"`);
  const message=(text,error=false)=>{const node=root?.querySelector('#forumStatus');if(node){const waiting=!error&&/(?:…|\.{3})$/.test(text);node.textContent=waiting?text.replace(/(?:…|\.{3})$/,''):text;node.classList.toggle('waiting-dots',waiting);node.classList.toggle('error',error)}};
  const request=(action,data={})=>{
    if(member&&member.expires_at*1000<=Date.now()){member=null;me=null;throw new Error('論壇登入已到期，請重新登入')}
    return window.practiceForumRequest(action,data,member?.access_token);
  };
  function accountSession(data){
    member=data;clearTimeout(expiryTimer);
    expiryTimer=setTimeout(()=>{member=null;me=null;if(document.body.dataset.page==='forum'){screen='login';render()}},Math.max(0,data.expires_at*1000-Date.now()));
  }
  window.resetForumSession=()=>{cancelGoogle();member=null;me=null;clearTimeout(expiryTimer);generation++;pendingEmail='';backupTicket='';};
  window.leaveForumPage=()=>{generation++;root=null;};
  function editor(max=20000){return `<label>內容（Markdown）<textarea name="body" rows="12" maxlength="${max}" required aria-describedby="markdownHelp"></textarea></label><p id="markdownHelp" class="forum-help">支援標題、粗體、清單、引用、表格、連結與程式碼區塊。不支援 HTML、圖片或附件。</p><button type="button" data-preview>預覽 Markdown</button><section class="markdown-body forum-preview" aria-label="Markdown 預覽" hidden></section>`}
  function pager(current,more,kind){return `<div class="forum-pager"><button data-page="${kind}" data-delta="-1" ${current===0?'disabled':''}>上一頁</button><span>第 ${current+1} 頁</span><button data-page="${kind}" data-delta="1" ${more?'':'disabled'}>下一頁</button></div>`}
  function needAccount(){return '<p>發文與留言須登入個人帳號；同校識別不等於論壇登入。</p><button data-screen="login">論壇登入</button> <button data-screen="register">註冊</button>'}
  function needProfile(){return '<p>發言前請先設定公開名稱。</p><button data-screen="profile">設定名稱</button>'}
  const backupField=()=>field('備援信箱','backup_email','email','autocomplete="email" maxlength="254"');
  const codeField=(label,name)=>field(label,name,'text','inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{8}" minlength="8" maxlength="8"');
  function profileForm(){return `<form data-form="profile">${field('公開名稱','name','text',`minlength="2" maxlength="30" autocomplete="nickname" value="${esc(me?.profile?.display_name||me?.suggested_name||'')}"`)}<p class="forum-help">2–30 字。名稱會顯示在文章與留言旁，不會公開信箱；名稱不是唯一識別碼。</p><button>儲存名稱</button></form>`}
  async function render(){
    if(!root?.isConnected)return;
    if(member&&me&&!me.profile&&!['reset','login'].includes(screen))screen='onboarding';
    const ticket=++generation;
    root.innerHTML=`<header class="hero compact"><h1>討論論壇</h1><p>發言須登入個人會員。Google 登入不另寄驗證信；信箱／密碼註冊須驗證信箱。</p></header><nav class="forum-nav" aria-label="論壇功能"><button data-screen="list">全部文章</button><button data-screen="compose">發表文章</button>${member?'<button data-screen="profile">個人資料</button><button data-action="logout">論壇登出</button>':'<button data-screen="login">論壇登入</button><button data-screen="register">註冊</button>'}</nav><p id="forumStatus" class="forum-status" role="status" aria-live="polite"></p><section id="forumContent"></section>`;
    const content=root.querySelector('#forumContent');
    if(screen==='profile'){root.querySelector('h1').textContent='個人資料';document.title='個人資料｜競賽題單';}
    try{
      if(screen==='onboarding'){
        root.querySelector('.forum-nav').hidden=true;
        root.querySelector('.hero').innerHTML='<h1>設定公開名稱</h1>';
        content.innerHTML=`<form data-form="profile">${field('名稱','name','text','minlength="2" maxlength="30" autocomplete="nickname"')}<button>完成註冊</button></form>`;
      }else if(screen==='list'){
        message('讀取文章…');const data=await request('list',{page:listPage});if(ticket!==generation)return;
        content.innerHTML=`<h2>全部文章</h2>${data.posts.length?'<ol class="forum-list">'+data.posts.map(p=>`<li><button class="forum-title" data-thread="${esc(p.id)}">${esc(p.title)}</button><p>${avatarMarkup(p.author?.avatar_data)}${esc(p.author?.display_name||'會員')} · ${esc(date(p.created_at))}</p></li>`).join('')+'</ol>':'<p>尚無文章。</p>'}${pager(listPage,data.more,'list')}`;message('');
      }else if(screen==='thread'){
        message('讀取文章…');const data=await request('thread',{id:threadId,page:commentPage});if(ticket!==generation)return;
        content.innerHTML=`<article class="forum-post"><h2>${esc(data.post.title)}</h2><p class="forum-meta">${avatarMarkup(data.post.author?.avatar_data)}${esc(data.post.author?.display_name||'會員')} · ${esc(date(data.post.created_at))}</p><div class="markdown-body">${renderMarkdown(data.post.body)}</div></article><h2>留言</h2><ol class="forum-comments">${data.comments.map(c=>`<li><p class="forum-meta">${avatarMarkup(c.author?.avatar_data)}${esc(c.author?.display_name||'會員')} · ${esc(date(c.created_at))}</p><div class="markdown-body">${renderMarkdown(c.body)}</div></li>`).join('')}</ol>${data.comments.length?'':'<p>尚無留言。</p>'}${pager(commentPage,data.more,'comments')}<h2>新增留言</h2>${member?`<form data-form="comment">${editor(10000)}<button>送出留言</button></form>`:needAccount()}`;message('');
        if(member&&me?.member_id===data.post.author_id){
          content.querySelector('.forum-meta').insertAdjacentHTML('afterend','<button type="button" data-action="delete-post" aria-label="刪除自己的文章" title="刪除自己的文章">🗑 刪除文章</button>');
        }
      }else if(screen==='compose'){
        content.innerHTML='<h2>發表文章</h2>'+(member?`<form data-form="post">${field('標題','title','text','minlength="2" maxlength="120"')}${editor()}<button>發布文章</button></form>`:needAccount());
      }else if(screen==='profile'){
        if(!member){screen='login';return render()}
        message('讀取個人資料…');const currentMe=await request('me');if(ticket!==generation)return;me=currentMe;
        content.innerHTML=`<h2>個人資料</h2><p>信箱：${esc(me.email)}（僅本人可見）</p>${profileForm()}<h2>修改論壇密碼</h2><form data-form="password">${passwordField(true)}<button>修改密碼</button></form>`;message('');
      }else if(screen==='register'){
        const status=await request('status');if(ticket!==generation)return;
        content.innerHTML=`<h2>註冊論壇帳號</h2><p>接受 Gmail 或 @stu.tcssh.tc.edu.tw。同一信箱只能有一個會員；只有 Gmail 的句點與 +標籤視為同一信箱。</p><form data-form="register">${emailField()}${field('公開名稱','name','text','minlength="2" maxlength="30" autocomplete="nickname"')}${passwordField(true)}<p class="forum-help">密碼至少 12 字元。請使用與 Google 帳號不同的密碼。</p><button ${status.signup_enabled?'':'disabled'}>寄送驗證碼</button></form><button data-screen="verify">我已有驗證碼</button>`;
        if(!status.signup_enabled)message('註冊尚未開放，正在設定驗證信服務。');
      }else if(screen==='login'){
        content.innerHTML=`<h2>論壇登入</h2><form data-form="login">${emailField()}${passwordField()}<button>登入論壇</button></form><button data-screen="recover">忘記密碼</button> <button data-screen="verify">驗證信箱／重寄驗證碼</button>`;
      }else if(screen==='recover'){
        content.innerHTML=`<h2>重設論壇密碼</h2><form data-form="recover">${emailField()}<button>寄送重設驗證碼</button></form><button data-screen="backup_recover">無法使用原信箱：以備援信箱取回</button>`;
      }else if(screen==='backup_recover'){
        const status=await request('status');if(ticket!==generation)return;
        content.innerHTML=`<h2>以備援信箱取回帳號</h2><p>必須使用先前已驗證綁定的備援信箱。取回後仍以原登入信箱 登入。</p><form data-form="backup_recover">${emailField()}${backupField()}<button ${status.backup_enabled?'':'disabled'}>寄送備援驗證碼</button></form>`;
        if(!status.backup_enabled)message('備援信箱功能尚未開放。');
      }else if(screen==='backup_confirm'){
        content.innerHTML=`<h2>驗證備援信箱</h2><p>兩組驗證碼有效期限 10 分鐘；合計最多嘗試 5 次。</p><form data-form="backup_confirm">${codeField('原登入信箱 收到的驗證碼','primary_code')}${codeField('備援信箱收到的驗證碼','code')}<button>確認綁定</button></form>`;
      }else if(screen==='backup_reset'){
        content.innerHTML=`<h2>以備援信箱重設密碼</h2><form data-form="backup_reset">${codeField('備援信箱收到的驗證碼','code')}${passwordField(true)}<button>重設密碼並使舊登入失效</button></form>`;
      }else if(screen==='verify'){
        content.innerHTML=`<h2>${verifyType==='recovery'?'重設密碼驗證':'驗證信箱'}</h2><form data-form="verify">${emailField()}${field('信件中的驗證碼','code','text','inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6,10}" minlength="6" maxlength="10"')}<button>驗證</button></form><button data-action="resend">重新寄送驗證碼</button>`;
        content.querySelector('[name=email]').value=pendingEmail;
      }else if(screen==='reset'){
        content.innerHTML=`<h2>設定新的論壇密碼</h2><form data-form="password">${passwordField(true)}<button>儲存新密碼</button></form>`;
      }
      if(['login','register'].includes(screen))content.insertAdjacentHTML('afterbegin','<button data-action="google">使用 Google 登入</button><p>同一個已驗證信箱 共用會員。Google 首次登入後須設定公開名稱；可在個人資料設定論壇密碼。</p>');
      if(screen==='profile'&&me){
        content.insertAdjacentHTML('afterbegin',`<section class="profile-avatar"><h2>頭像</h2><div id="avatarPreview">${avatarMarkup(me.profile?.avatar_data)}</div><form data-form="avatar"><label>選擇 JPG／PNG 圖片<input type="file" name="picture" accept="image/jpeg,image/png" required></label><p>上限 5 MB；儲存時置中裁成正方形並縮小為 128 × 128。頭像會顯示在文章與留言旁，供可閱讀論壇的人查看。</p><button>儲存頭像</button></form><button data-action="reset-avatar">使用預設頭像</button></section>`);
        const picker=content.querySelector('[name=picture]');
        let previewVersion=0;
        picker.addEventListener('change',async()=>{const version=++previewVersion;try{const image=await prepareAvatar(picker.files[0]);if(ticket===generation&&version===previewVersion)content.querySelector('#avatarPreview').innerHTML=avatarMarkup(image)}catch(error){if(ticket===generation)message(error.message,true)}});
        content.insertAdjacentHTML('beforeend',`<h2>備援信箱</h2><p>${me.backup?'已驗證：'+esc(me.backup.email):'尚未綁定'}</p><p>可用來重設論壇密碼。新增或更換時，須同時驗證原登入信箱 與備援信箱。</p><form data-form="backup_start">${backupField()}<button ${me.backup_enabled?'':'disabled'}>寄送兩組驗證碼</button></form>`);
        if(!me.backup_enabled)message('備援信箱功能尚未開放。');
      }
      if(member&&!me?.profile){
        for(const form of content.querySelectorAll('form[data-form="post"],form[data-form="comment"]'))form.outerHTML=needProfile();
      }
    }catch(error){if(ticket===generation)message(error.message,true)}
  }
  async function submit(event){
    const form=event.target.closest('form[data-form]');if(!form)return;event.preventDefault();
    const data=Object.fromEntries(new FormData(form)),action=form.dataset.form;
    const buttons=form.querySelectorAll('button');buttons.forEach(b=>b.disabled=true);message('處理中…');
    const ticket=generation;
    try{
      if(action==='avatar'){
        const avatar=await prepareAvatar(form.querySelector('[name=picture]').files[0]);
        if(ticket!==generation)return;
        const profile=await request('avatar',{avatar});if(ticket!==generation)return;
        me={...me,profile};await render();message('頭像已更新，既有文章與留言也會顯示新頭像。');
      }else if(['backup_start','backup_recover'].includes(action)){
        const result=await request(action,data);if(ticket!==generation)return;
        backupTicket=result.ticket;screen=action==='backup_start'?'backup_confirm':'backup_reset';await render();message(result.message);
      }else if(['backup_confirm','backup_reset'].includes(action)){
        const result=await request(action,{...data,ticket:backupTicket});if(ticket!==generation)return;
        backupTicket='';if(action==='backup_reset'){window.resetForumSession();screen='login'}else screen='profile';
        await render();message(result.message);
      }else if(['register','recover'].includes(action)){
        const result=await request(action,data);if(ticket!==generation)return;
        pendingEmail=data.email;verifyType=action==='recover'?'recovery':'signup';screen='verify';await render();message(result.message);
      }else if(action==='login'||action==='verify'){
        const result=await request(action,{...data,type:verifyType});if(ticket!==generation)return;accountSession(result);
        const currentMe=await request('me');if(ticket!==generation)return;me=currentMe;
        if(action==='verify'&&verifyType==='recovery')screen='reset';
        else if(!me.profile||location.pathname.endsWith('/profile.html')){screen='profile'}else screen='list';
        await render();if(!me.profile&&screen==='profile')message('請確認並儲存公開名稱，完成會員設定後即可發言。');
      }else if(action==='profile'){
        const profile=await request('profile',data);if(ticket!==generation)return;
        me={...me,profile};const first=screen==='onboarding';if(first)screen='list';await render();
        if(!first)message('名稱已更新，既有文章與留言會顯示新名稱。');
      }else if(action==='password'){
        await request('password',data);if(ticket!==generation)return;form.reset();screen='profile';await render();message('論壇密碼已更新。');
      }else{
        if(!me?.profile){screen='profile';await render();message('請先儲存公開名稱。');return;}
        const result=await request(action,{...data,id:threadId});if(ticket!==generation)return;
        if(action==='post'){threadId=result.id;commentPage=0;}screen='thread';await render();message('已發布。');
      }
    }catch(error){if(ticket===generation)message(error.message,true)}
    finally{form.querySelector('[name=password]')?.setAttribute('value','');const p=form.querySelector('[name=password]');if(p)p.value='';buttons.forEach(b=>b.disabled=false)}
  }
  async function click(event){
    const button=event.target.closest('button');if(!button)return;
    if(button.dataset.action==='reset-avatar'){
      const ticket=generation;button.disabled=true;message('更新頭像…');
      try{const profile=await request('avatar',{avatar:null});if(ticket!==generation)return;me={...me,profile};await render();message('已改用預設頭像。')}
      catch(error){if(ticket===generation)message(error.message,true)}finally{button.disabled=false}return;
    }
    if(button.dataset.action==='delete-post'){
      if(!member||!window.confirm('確定刪除這篇文章？文章及其所有留言將永久刪除，無法復原。'))return;
      const ticket=generation,id=threadId;button.disabled=true;message('刪除中…');
      try{
        await request('delete_post',{id});if(ticket!==generation)return;
        screen='list';listPage=0;threadId='';await render();message('文章及其留言已刪除。');
      }catch(error){if(ticket===generation){message(error.message,true);button.disabled=false}}
      return;
    }
    if(button.dataset.action==='google'){
      const ticket=generation;button.disabled=true;message('請在 Google 視窗完成登入…');
      try{const data=await googleLogin(request);if(ticket!==generation)return;accountSession(data);
        const currentMe=await request('me');if(ticket!==generation)return;me=currentMe;screen=me.profile&&!location.pathname.endsWith('/profile.html')?'list':'profile';await render();
      }catch(error){if(ticket===generation)message(error.message,true)}finally{button.disabled=false}return;
    }
    if(button.dataset.screen){
      if(button.dataset.screen==='profile'&&!location.pathname.endsWith('/profile.html')){document.querySelector('.topnav a[href="profile.html"]').click();return;}
      screen=button.dataset.screen;if(screen==='verify')verifyType='signup';return render();
    }
    if(button.dataset.thread){threadId=button.dataset.thread;commentPage=0;screen='thread';return render()}
    if(button.dataset.page){if(button.dataset.page==='list')listPage+=Number(button.dataset.delta);else commentPage+=Number(button.dataset.delta);return render()}
    if(button.hasAttribute('data-preview')){const form=button.closest('form'),preview=form.querySelector('.forum-preview');preview.innerHTML=renderMarkdown(form.elements.body.value);preview.hidden=!preview.hidden;button.textContent=preview.hidden?'預覽 Markdown':'收合預覽';return}
    if(button.dataset.action==='logout'){
      button.disabled=true;try{await request('logout')}catch{}window.resetForumSession();screen='list';await render();return;
    }
    if(button.dataset.action==='resend'){
      button.disabled=true;
      try{const email=root.querySelector('[name=email]').value;const result=await request(verifyType==='recovery'?'recover':'resend',{email});message(result.message)}catch(error){message(error.message,true)}finally{button.disabled=false}
    }
  }
  window.renderForumPage=()=>{
    root=document.querySelector('#forumRoot');if(!root)return;
    // New shell each time; listeners are attached only to that shell.
    root.addEventListener('submit',submit);root.addEventListener('click',click);screen=location.pathname.endsWith('/profile.html')||new URLSearchParams(location.search).get('view')==='profile'?'profile':'list';render();
  };
})();

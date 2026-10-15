import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const source=readFileSync('cpp_competitive_multi_page/auth.js','utf8');
const base='https://example.com/site/';
function boot(path='index.html'){
  const events={},calls=[],removed=[];let reloads=0,renders=0,resets=0;
  const node=()=>({hidden:false,value:'',dataset:{},classList:{add(){},remove(){}},setAttribute(){},removeAttribute(){},addEventListener(n,f){this[n]=f},append(){},replaceChildren(){this.emptied=true},querySelectorAll(){return []}});
  const shell=node(),nav=node(),panel=node(),form=node(),button=node(),status=node();
  form.username={value:'test'};form.password={value:'test'};form.reset=()=>{};form.querySelector=()=>button;
  panel.querySelector=s=>s==='form'?form:status;
  const location={href:base+path,get pathname(){return new URL(this.href).pathname},get search(){return new URL(this.href).search},get hash(){return new URL(this.href).hash},replace(url){this.replaced=url},reload(){reloads++}};
  const storage={removeItem(k){removed.push(k)},setItem(){throw Error('Must not persist sessions')}};
  const context={URL,AbortSignal,AbortController,console,location,sessionStorage:storage,localStorage:storage,setTimeout(){},clearTimeout(){},alert:assert.fail,
    history:{pushState(a,b,url){location.href=url},replaceState(a,b,url){location.href=url}},
    addEventListener(n,f){events[n]=f},
    document:{body:node(),head:{append(s){s.onload()}},querySelector:s=>s==='.site-layout'?shell:nav,createElement:t=>t==='main'?panel:node(),addEventListener(n,f){events[n]=f},importNode:n=>n},
    DOMParser:class{parseFromString(){return {body:{dataset:{page:'platform'}},title:'page',querySelector:()=>({childNodes:[]})}}},
    fetch:async url=>{calls.push(String(url));if(String(url).includes('site-login'))return {ok:true,json:async()=>({access_token:'mock',expires_at:Date.now()/1000+3600})};if(String(url).includes('curriculum.json'))return {ok:true,json:async()=>Object.fromEntries(['PROBLEMS','COMBINED_GROUPS','ROADMAP_STAGES','CODEFORCES_GROUPS','CSES_GROUPS','ATCODER_GROUPS','PLATFORMS'].map(k=>[k,[]]))};return {ok:true,text:async()=>''}}
  };
  context.window={renderPracticePage(){renders++},scrollTo(){},resetForumSession(){resets++},resetCompilerSession(){resets++}};
  runInNewContext(source,context);
  return {context,events,calls,removed,location,panel,nav,form,shell,get reloads(){return reloads},get renders(){return renders},get resets(){return resets}};
}
test('Fresh visits and reloads on every secondary page redirect to clean roadmap',()=>{
  for(const page of ['forum','profile','compiler','cses','zerojudge','codeforces','atcoder','tioj']){
    const b=boot(page+'.html?v=old#section');assert.equal(b.location.replaced,base+'index.html');assert.equal(b.calls.length,0);assert.equal(b.removed.length,2);
  }
  const b=boot('index.html?v=old#section');assert.equal(b.location.href,base+'index.html');assert.equal(b.panel.hidden,false);
});
test('Internal navigation preserves login; leaving clears memory; BFCache return reloads',async()=>{
  const b=boot();await b.form.submit({preventDefault(){}});const resets=b.resets;
  for(const page of ['cses','forum','compiler','index']){
    b.nav.click({target:{closest:()=>({href:base+page+'.html',hasAttribute:()=>false,target:''})},button:0,preventDefault(){}});
    await new Promise(r=>setImmediate(r));assert.equal(b.location.href,base+page+'.html');assert.equal(b.panel.hidden,true);
  }
  assert.equal(b.resets,resets);assert.equal(b.renders,4);assert.equal(b.calls.filter(x=>x.includes('site-login')).length,1);
  b.events.pagehide();assert.equal(b.resets,resets+2);assert.equal(b.shell.emptied,true);assert.equal(b.shell.hidden,true);assert.equal(b.context.window.PROBLEMS,undefined);
  await assert.rejects(()=>b.context.window.practiceForumRequest('list'),/重新整理/);
  b.events.pageshow({persisted:true});assert.equal(b.reloads,1);
});
test('Google popup callback stays separate from entry reset',()=>{
  assert.ok(!readFileSync('cpp_competitive_multi_page/forum-callback.html','utf8').includes('auth.js'));
});
test('Forum view and unsent DOM drafts survive internal switches but not session reset',async()=>{
  const forum=readFileSync('src/forum.js','utf8').replace(/^import .*;\r?\n/gm,'');
  const makeRoot=()=>({isConnected:true,dataset:{},draft:'',innerHTML:'',addEventListener(){},querySelector(s){return s==='.waiting-dots'?null:{innerHTML:'',classList:{toggle(){}}}},replaceWith(old){this.restored=old}});
  let current=makeRoot();const original=current;
  const context={window:{practiceForumRequest:async()=>({posts:[],more:false})},document:{querySelector:()=>current,body:{dataset:{page:'forum'}}},location:{pathname:'/site/forum.html',search:''},URLSearchParams,cancelGoogle(){},clearTimeout(){},setTimeout(){}};
  runInNewContext(forum,context);
  context.window.renderForumPage();await new Promise(r=>setImmediate(r));
  original.draft='未送出的內容';context.window.leaveForumPage();current=makeRoot();context.window.renderForumPage();
  assert.equal(current.restored,original);assert.equal(current.restored.draft,'未送出的內容');
  context.window.leaveForumPage();context.window.resetForumSession();current=makeRoot();context.window.renderForumPage();
  assert.equal(current.restored,undefined);
});

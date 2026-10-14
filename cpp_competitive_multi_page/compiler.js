(()=>{
  'use strict';
  const endpoint='https://wandbox.org/api/compile.json';
  const initial='# include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    \n}\n';
  let draft={code:initial,standard:'c++17'},root=null,job=null,nextRun=0,cancelInput=null;
  function save(){if(root?.isConnected){draft={code:root.querySelector('#cppCode').value,standard:root.querySelector('#cppStandard').value}}}
  window.leaveCompilerPage=()=>{save();cancelInput?.();job?.abort();job=null;root=null};
  window.resetCompilerSession=()=>{window.leaveCompilerPage();draft={code:initial,standard:'c++17'}};
  async function boundedJson(response){
    if(!response.ok)throw new Error(response.status===429?'服務忙碌或超過頻率限制，請稍後重試。':'編譯服務暫時無法使用（HTTP '+response.status+'）。');
    const reader=response.body.getReader();let size=0;const chunks=[];
    try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>512000)throw new Error('回傳內容超過 500 KB，已停止接收。');chunks.push(value)}}
    catch(error){await reader.cancel().catch(()=>{});throw error}
    const data=new Uint8Array(size);let offset=0;for(const chunk of chunks){data.set(chunk,offset);offset+=chunk.length}
    return JSON.parse(new TextDecoder().decode(data));
  }
  window.renderCompilerPage=()=>{
    root=document.querySelector('#compilerRoot');if(!root)return;
    root.innerHTML=`<header class="hero compact"><h1>C++ 線上編譯器</h1><p>GCC 13.2 · 單一程式檔 · 標準輸出</p></header>
      <p class="compiler-note">按下執行會將程式碼送至 <a href="https://wandbox.org/" target="_blank" rel="noopener noreferrer">Wandbox</a>。不傳送本站帳密或登入權杖，也不建立公開分享連結；請勿輸入機密資料。服務可能限流或暫停。</p>
      <form id="cppForm"><div class="compiler-toolbar"><label for="cppStandard">標準</label><select id="cppStandard"><option value="c++17">C++17</option><option value="c++2a">C++20</option></select><button id="cppRun" type="submit">編譯並執行</button><button id="cppStop" type="button" disabled>取消等待</button><button id="cppDownload" type="button">下載 .cpp</button></div>
      <div class="compiler-editors"><label for="cppCode">程式碼<textarea id="cppCode" spellcheck="false" autocapitalize="off" autocomplete="off" autocorrect="off" maxlength="65536" rows="20" required></textarea></label></div></form>
      <p class="compiler-note">程式碼限 64 KB；按執行後輸入測資，不需輸入可留空；最多等待 30 秒。切換站內頁面保留草稿，重新載入會清除；請先下載保存。Enter 自動縮排，Ctrl／⌘ + Enter 執行，Tab 可切換欄位。</p>
      <dialog id="cppInputDialog" aria-labelledby="cppInputTitle"><form id="cppInputForm"><h2 id="cppInputTitle">輸入測資</h2><p>請一次填入所有輸入內容；不需要輸入可留空。測資會與程式碼一起送至 Wandbox。</p><label for="cppStdin">標準輸入（stdin）</label><textarea id="cppStdin" rows="8" maxlength="65536" spellcheck="false" autofocus></textarea><p id="cppInputError" role="alert"></p><div class="compiler-toolbar"><button type="submit">開始執行</button><button id="cppInputCancel" type="button">取消</button></div></form></dialog>
      <p id="cppStatus" role="status" aria-live="polite">尚未執行。</p>
      <section class="compiler-results"><h2>標準輸出（stdout）</h2><pre id="cppOutput" tabindex="0">—</pre><h2>錯誤輸出（stderr）</h2><pre id="cppError" tabindex="0">—</pre><h2>編譯訊息</h2><pre id="cppDiagnostics" tabindex="0">—</pre></section>`;
    const current=root,code=root.querySelector('#cppCode'),standard=root.querySelector('#cppStandard'),form=root.querySelector('#cppForm'),run=root.querySelector('#cppRun'),stop=root.querySelector('#cppStop'),status=root.querySelector('#cppStatus');
    code.value=draft.code;standard.value=draft.standard;
    const enter=event=>{
      if(event.isComposing||!window.cppEnterEdit)return;
      const edit=window.cppEnterEdit(code.value,code.selectionStart,code.selectionEnd);
      if(code.value.length-(edit.end-edit.start)+edit.insert.length>code.maxLength)return;
      event.preventDefault();
      code.setSelectionRange(edit.start,edit.end);
      // Native insertion preserves browser undo history where supported.
      if(!document.execCommand('insertText',false,edit.insert))code.setRangeText(edit.insert,edit.start,edit.end,'end');
      code.setSelectionRange(edit.caret,edit.caret);
      code.dispatchEvent(new Event('input',{bubbles:true}));
    };
    code.addEventListener('keydown',event=>{
      if(event.key==='Enter'&&!event.ctrlKey&&!event.metaKey&&!event.altKey&&!event.shiftKey)enter(event);
    });
    // Mobile keyboards do not always emit a usable keydown event.
    code.addEventListener('beforeinput',event=>{if(event.inputType==='insertLineBreak'&&event.cancelable)enter(event)});
    // The textarea remains the accessible editing surface; highlighting is inert.
    if(window.highlightCpp){
      const shell=document.createElement('div'),paint=document.createElement('pre');
      shell.className='cpp-color-editor';paint.className='cpp-highlight';paint.setAttribute('aria-hidden','true');
      code.parentNode.insertBefore(shell,code);shell.append(paint,code);code.wrap='off';
      const sync=()=>{paint.scrollTop=code.scrollTop;paint.scrollLeft=code.scrollLeft};
      const color=()=>{try{paint.innerHTML=window.highlightCpp(code.value.slice(0,65536))+'\n';shell.classList.add('highlight-ready');sync()}catch{shell.classList.remove('highlight-ready')}};
      code.addEventListener('input',color);code.addEventListener('scroll',sync);color();
    }
    const copy=document.createElement('button'),online=document.createElement('a');
    copy.type='button';copy.textContent='複製程式碼';online.textContent='開啟 OnlineGDB';
    online.href='https://www.onlinegdb.com/online_c++_compiler';online.target='_blank';online.rel='noopener noreferrer';
    root.querySelector('.compiler-toolbar').append(copy,online);
    copy.addEventListener('click',async()=>{
      try{await navigator.clipboard.writeText(code.value);status.textContent='已複製。開啟 OnlineGDB 後貼上程式碼，再執行。'}
      catch{status.textContent='無法存取剪貼簿，請在程式碼區手動全選並複製。'}
    });
    const output=(id,value)=>{current.querySelector(id).textContent=typeof value==='string'&&value.length?value.slice(0,200000):'—'};
    current.querySelector('#cppDownload').addEventListener('click',()=>{
      const url=URL.createObjectURL(new Blob([code.value],{type:'text/plain;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='main.cpp';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    });
    stop.addEventListener('click',()=>job?.abort());
    const askInput=()=>new Promise(resolve=>{
      const dialog=current.querySelector('#cppInputDialog'),input=current.querySelector('#cppStdin'),inputForm=current.querySelector('#cppInputForm');
      const finish=value=>{dialog.close();inputForm.onsubmit=null;dialog.oncancel=null;cancelInput=null;resolve(value)};
      cancelInput=()=>finish(null);
      current.querySelector('#cppInputCancel').onclick=cancelInput;
      current.querySelector('#cppInputError').textContent='';
      dialog.oncancel=event=>{event.preventDefault();finish(null)};
      inputForm.onsubmit=event=>{
        event.preventDefault();
        if(new TextEncoder().encode(input.value).length>65536){current.querySelector('#cppInputError').textContent='測資超過 64 KB。';return;}
        finish(input.value);
      };
      dialog.showModal();
    });
    form.addEventListener('keydown',event=>{if((event.ctrlKey||event.metaKey)&&event.key==='Enter'){event.preventDefault();if(!run.disabled)form.requestSubmit()}});
    form.addEventListener('submit',async event=>{
      event.preventDefault();if(job||cancelInput)return;
      if(Date.now()<nextRun){status.textContent='請稍等 5 秒再執行。';return}
      if(!code.value.trim()){status.textContent='請輸入程式碼。';return}
      if(new TextEncoder().encode(code.value).length>65536){status.textContent='程式碼超過 64 KB。';return}
      if(!['c++17','c++2a'].includes(standard.value))return;
      const stdin=await askInput();
      if(stdin===null||!current.isConnected)return;
      save();const controller=new AbortController();job=controller;nextRun=Date.now()+5000;
      let timedOut=false;const timer=setTimeout(()=>{timedOut=true;controller.abort()},30000);
      run.disabled=true;stop.disabled=false;status.textContent='編譯／執行中';status.classList.remove('error');status.classList.add('waiting-dots');
      for(const id of ['#cppOutput','#cppError','#cppDiagnostics'])output(id,'');
      try{
        const result=await boundedJson(await fetch(endpoint,{method:'POST',credentials:'omit',referrerPolicy:'no-referrer',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify({compiler:'gcc-13.2.0',code:code.value,stdin,options:'warning,'+standard.value+',boost-nothing-gcc-13.2.0',save:false}),signal:controller.signal}));
        if(job!==controller||!current.isConnected)return;
        output('#cppOutput',result.program_output);output('#cppError',result.program_error);output('#cppDiagnostics',result.compiler_message||result.compiler_error||result.compiler_output);
        if(result.status===undefined&&!result.signal)throw new Error('編譯服務未回傳有效的執行狀態。');
        status.textContent=result.signal?'程式被服務終止：'+String(result.signal).slice(0,100):String(result.status)==='0'?'執行完成 · 結束碼 0':'編譯或執行失敗 · 結束碼 '+String(result.status).slice(0,30);
        status.classList.toggle('error',!!result.signal||String(result.status)!=='0');
      }catch(error){
        if(job!==controller||!current.isConnected)return;
        status.textContent=controller.signal.aborted?(timedOut?'等待超過 30 秒，已停止接收；遠端工作不一定立即停止。':'已取消等待；遠端工作不一定立即停止。'):(error instanceof TypeError?'無法連線到 Wandbox；請檢查網路或稍後重試。':error.message);
        status.classList.add('error');
      }finally{clearTimeout(timer);status.classList.remove('waiting-dots');if(job===controller){job=null;run.disabled=false;stop.disabled=true}}
    });
  };
})();

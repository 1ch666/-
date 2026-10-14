(()=>{
  'use strict';
  const endpoint='https://wandbox.org/api/compile.json';
  const initial='#include <iostream>\nusing namespace std;\n\nint main() {\n    long long a, b;\n    if (cin >> a >> b) cout << a + b << "\\n";\n    return 0;\n}\n';
  let draft={code:initial,input:'3 5\n',standard:'c++17'},root=null,job=null,nextRun=0;
  function save(){if(root?.isConnected){draft={code:root.querySelector('#cppCode').value,input:root.querySelector('#cppInput').value,standard:root.querySelector('#cppStandard').value}}}
  window.leaveCompilerPage=()=>{save();job?.abort();job=null;root=null};
  window.resetCompilerSession=()=>{window.leaveCompilerPage();draft={code:initial,input:'3 5\n',standard:'c++17'}};
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
    root.innerHTML=`<header class="hero compact"><h1>C++ 線上編譯器</h1><p>GCC 13.2 · 單一程式檔 · 標準輸入／輸出</p></header>
      <p class="compiler-note">按下執行會將程式碼與輸入送至 <a href="https://wandbox.org/" target="_blank" rel="noopener noreferrer">Wandbox</a>。不傳送本站帳密或登入權杖，也不建立公開分享連結；請勿輸入機密資料。服務可能限流或暫停。</p>
      <form id="cppForm"><div class="compiler-toolbar"><label for="cppStandard">標準</label><select id="cppStandard"><option value="c++17">C++17</option><option value="c++2a">C++20</option></select><button id="cppRun" type="submit">編譯並執行</button><button id="cppStop" type="button" disabled>取消等待</button><button id="cppDownload" type="button">下載 .cpp</button></div>
      <div class="compiler-editors"><label for="cppCode">程式碼<textarea id="cppCode" spellcheck="false" autocapitalize="off" autocomplete="off" autocorrect="off" maxlength="65536" rows="20" required></textarea></label><label for="cppInput">標準輸入（stdin）<textarea id="cppInput" spellcheck="false" maxlength="65536" rows="10"></textarea></label></div></form>
      <p class="compiler-note">程式碼與輸入各限 64 KB；最多等待 30 秒。切換站內頁面保留草稿，重新載入會清除；請先下載保存。Ctrl／⌘ + Enter 執行，Tab 可切換欄位。</p>
      <p id="cppStatus" role="status" aria-live="polite">尚未執行。</p>
      <section class="compiler-results"><h2>標準輸出（stdout）</h2><pre id="cppOutput" tabindex="0">—</pre><h2>錯誤輸出（stderr）</h2><pre id="cppError" tabindex="0">—</pre><h2>編譯訊息</h2><pre id="cppDiagnostics" tabindex="0">—</pre></section>`;
    const current=root,code=root.querySelector('#cppCode'),input=root.querySelector('#cppInput'),standard=root.querySelector('#cppStandard'),form=root.querySelector('#cppForm'),run=root.querySelector('#cppRun'),stop=root.querySelector('#cppStop'),status=root.querySelector('#cppStatus');
    code.value=draft.code;input.value=draft.input;standard.value=draft.standard;
    const output=(id,value)=>{current.querySelector(id).textContent=typeof value==='string'&&value.length?value.slice(0,200000):'—'};
    current.querySelector('#cppDownload').addEventListener('click',()=>{
      const url=URL.createObjectURL(new Blob([code.value],{type:'text/plain;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='main.cpp';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    });
    stop.addEventListener('click',()=>job?.abort());
    form.addEventListener('keydown',event=>{if((event.ctrlKey||event.metaKey)&&event.key==='Enter'){event.preventDefault();if(!run.disabled)form.requestSubmit()}});
    form.addEventListener('submit',async event=>{
      event.preventDefault();if(job)return;
      if(Date.now()<nextRun){status.textContent='請稍等 5 秒再執行。';return}
      if(!code.value.trim()){status.textContent='請輸入程式碼。';return}
      if(new TextEncoder().encode(code.value).length>65536||new TextEncoder().encode(input.value).length>65536){status.textContent='程式碼或輸入超過 64 KB。';return}
      if(!['c++17','c++2a'].includes(standard.value))return;
      save();const controller=new AbortController();job=controller;nextRun=Date.now()+5000;
      let timedOut=false;const timer=setTimeout(()=>{timedOut=true;controller.abort()},30000);
      run.disabled=true;stop.disabled=false;status.textContent='編譯／執行中…';status.classList.remove('error');
      for(const id of ['#cppOutput','#cppError','#cppDiagnostics'])output(id,'');
      try{
        const result=await boundedJson(await fetch(endpoint,{method:'POST',credentials:'omit',referrerPolicy:'no-referrer',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify({compiler:'gcc-13.2.0',code:code.value,stdin:input.value,options:'warning,'+standard.value+',boost-nothing-gcc-13.2.0',save:false}),signal:controller.signal}));
        if(job!==controller||!current.isConnected)return;
        output('#cppOutput',result.program_output);output('#cppError',result.program_error);output('#cppDiagnostics',result.compiler_message||result.compiler_error||result.compiler_output);
        if(result.status===undefined&&!result.signal)throw new Error('編譯服務未回傳有效的執行狀態。');
        status.textContent=result.signal?'程式被服務終止：'+String(result.signal).slice(0,100):String(result.status)==='0'?'執行完成 · 結束碼 0':'編譯或執行失敗 · 結束碼 '+String(result.status).slice(0,30);
        status.classList.toggle('error',!!result.signal||String(result.status)!=='0');
      }catch(error){
        if(job!==controller||!current.isConnected)return;
        status.textContent=controller.signal.aborted?(timedOut?'等待超過 30 秒，已停止接收；遠端工作不一定立即停止。':'已取消等待；遠端工作不一定立即停止。'):(error instanceof TypeError?'無法連線到 Wandbox；請檢查網路或稍後重試。':error.message);
        status.classList.add('error');
      }finally{clearTimeout(timer);if(job===controller){job=null;run.disabled=false;stop.disabled=true}}
    });
  };
})();

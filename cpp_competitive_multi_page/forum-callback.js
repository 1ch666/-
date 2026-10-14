(()=>{
 const query=new URLSearchParams(location.search),code=query.get('code');
 history.replaceState(null,'',location.pathname);
 if(window.opener){
   window.opener.postMessage({type:'forum-google-callback',code:code||null},'https://1ch666.github.io');
   document.getElementById('status').textContent='已回傳登入結果，請返回原論壇分頁。';
 }else document.getElementById('status').textContent='無法連回原登入視窗。請關閉此頁，返回論壇重新登入；登入資料不會儲存在瀏覽器。';
})();

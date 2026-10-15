import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
test('Every page marks its own navigation link before scripts run',async()=>{
  const dir='cpp_competitive_multi_page';
  for(const name of await readdir(dir)){
    if(!name.endsWith('.html'))continue;
    const html=await readFile(`${dir}/${name}`,'utf8');
    const nav=html.match(/<nav class="topnav">([\s\S]*?)<\/nav>/)?.[1];
    if(!nav)continue;
    const current=[...nav.matchAll(/<a\b[^>]*aria-current="page"[^>]*>/g)].map(m=>m[0]);
    assert.equal(current.length,1,name);
    assert.ok(current[0].includes(`href="${name}"`),name);
  }
});
test('Current-page state ignores query/hash, normalizes index, and removes old selection',async()=>{
  const source=await readFile('cpp_competitive_multi_page/auth.js','utf8');
  const fn=source.slice(source.indexOf('  function syncCurrentPage('),source.indexOf('  syncCurrentPage(new URL(location.href));'));
  const links=['index.html','forum.html','compiler.html','profile.html'].map(name=>({href:'https://example.com/site/'+name,current:false,setAttribute(){this.current=true},removeAttribute(){this.current=false}}));
  const context={nav:{querySelectorAll:()=>links},URL};runInNewContext(fn,context);
  context.syncCurrentPage(new URL('https://example.com/site/compiler.html?v=123#test'));
  assert.deepEqual(links.map(x=>x.current),[false,false,true,false]);
  context.syncCurrentPage(new URL('https://example.com/site/'));
  assert.deepEqual(links.map(x=>x.current),[true,false,false,false]);
  context.syncCurrentPage(new URL('https://example.com/site/profile.html'));
  assert.deepEqual(links.map(x=>x.current),[false,false,false,true]);
});

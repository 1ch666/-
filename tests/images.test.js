import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {readFile} from 'node:fs/promises';
import {renderMarkdown} from '../src/forum-markdown.js';
import {prepareImage,loadImages} from '../src/forum-images.js';
const result=await build({entryPoints:['supabase/functions/forum-api/images.ts'],bundle:true,format:'esm',write:false});
const {imageBytes,imagePaths,uploadImage,signImages}=await import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].contents).toString('base64'));
const member='11111111-1111-4111-8111-111111111111',path=member+'/'+member+'.jpg';
// Minimal marker fixture exercises header validation, not a decoder test.
const fixture=(width=100,height=50)=>'data:image/jpeg;base64,'+Buffer.from([255,216,255,192,0,8,8,height>>8,height&255,width>>8,width&255,1,255,217]).toString('base64');
test('Image validation rejects external URLs, traversal, active formats, size and metadata',()=>{
  assert.equal(imageBytes(fixture()).length,14);
  for(const bad of [null,'https://x/a.jpg','data:image/svg+xml;base64,AAAA',fixture(1601),fixture(0),'x'.repeat(700001),'data:image/jpeg;base64,AAAA'])assert.throws(()=>imageBytes(bad));
  for(const paths of [[],['../practice-private/curriculum.json'],['https://x'],Array(21).fill(path),[path+'?x=1']])assert.throws(()=>imagePaths(paths));
  assert.deepEqual(imagePaths([path,path]),[path]);
});
test('Uploads derive owner path on server, never overwrite; signing confined to private bucket',async()=>{
  const calls=[];const upstream=async(p,options)=>{calls.push({p,options});return {ok:true,json:async()=>[{path,signedURL:'/object/sign/forum-images/'+path+'?token=test'}]}};
  const image=await uploadImage(upstream,member,fixture());assert.ok(image.path.startsWith(member+'/'));
  assert.equal(calls[0].options.headers['Content-Type'],'image/jpeg');assert.equal(calls[0].options.headers['x-upsert'],'false');
  assert.equal((await signImages(upstream,[path])).images.length,1);assert.equal(JSON.parse(calls[1].options.body).expiresIn,300);
  await assert.rejects(()=>uploadImage(async()=>({ok:false}),member,fixture()),/上傳失敗/);
  const source=await readFile('supabase/functions/forum-api/index.ts','utf8');
  assert.ok(source.indexOf("if(action==='image_upload')")>source.indexOf('if(!sessionAllowed)'));
  assert.ok(source.indexOf("if(action==='image_urls')")>source.indexOf('if(!allow.length)'));
});
test('Markdown renders only private image references, escapes attributes and caps image count',()=>{
  const html=renderMarkdown(`![測試](forum-image:${path})`);assert.match(html,/data-forum-image=/);assert.doesNotMatch(html,/src=/);
  assert.doesNotMatch(renderMarkdown('![x](https://tracker.example/a.jpg)'),/<img|data-forum-image/);
  assert.doesNotMatch(renderMarkdown('`![x](forum-image:'+path+')`'),/data-forum-image/);
  assert.equal((renderMarkdown(Array(12).fill(`![x](forum-image:${path})`).join('\n')).match(/data-forum-image=/g)||[]).length,10);
});
test('Picker rejects SVG/oversize before decoding; image loader signs and mounts a bounded URL',async()=>{
  await assert.rejects(()=>prepareImage(new File(['<svg/>'],'x.svg',{type:'image/svg+xml'})),/JPG/);
  const node={dataset:{forumImage:path},isConnected:true,querySelector(){return this.img},replaceChildren(img){this.img=img}};
  const previous=globalThis.document;globalThis.document={createElement:()=>({})};
  try{
    await loadImages({querySelectorAll:()=>[node]},async()=>({images:[{path,url:'/object/sign/forum-images/'+path+'?token=test'}]}));
    assert.match(node.img.src,/^https:\/\/jfrmuqvfuxxoqfjvvnex.supabase.co\/storage\/v1\/object\/sign\/forum-images\//);
  }finally{globalThis.document=previous}
});

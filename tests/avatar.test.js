import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {avatarMarkup} from '../src/forum-avatar.js';
const bundled=await build({entryPoints:['supabase/functions/forum-api/avatar.ts'],bundle:true,format:'esm',write:false});
const {avatarData}=await import('data:text/javascript;base64,'+Buffer.from(bundled.outputFiles[0].contents).toString('base64'));
test('Avatar validation rejects remote links, SVG, oversize and wrong dimensions',()=>{
  assert.equal(avatarData(null),null);
  for(const bad of ['https://example.com/avatar.jpg','data:image/svg+xml;base64,AAAA','data:image/jpeg;base64,AAAA','x'.repeat(45001)])assert.throws(()=>avatarData(bad));
  assert.match(avatarMarkup(null),/forum-avatar-default/);
  assert.doesNotMatch(avatarMarkup('x" onerror="alert(1)'),/<img/);
});

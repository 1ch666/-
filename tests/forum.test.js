import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {build} from 'esbuild';
import {PGlite} from '@electric-sql/pglite';
import {renderMarkdown} from '../src/forum-markdown.js';

const validationBuild=await build({entryPoints:['supabase/functions/forum-api/validation.ts'],bundle:true,format:'esm',write:false});
const {gmail,displayName,password,loginPassword,SCHOOL_USER}=await import('data:text/javascript;base64,'+Buffer.from(validationBuild.outputFiles[0].contents).toString('base64'));
test('Password validation preserves exact credentials including whitespace',()=>{
  const value='  long password with spaces  ';
  assert.equal(password(value),value);
  assert.equal(loginPassword(value),value);
  for(const bad of ['',null,{},'x'.repeat(129),'a\u0000b'])assert.throws(()=>loginPassword(bad));
});
test('Gmail aliases normalize to one mailbox; other domains are rejected',()=>{
  assert.equal(gmail(' Test.Person+class@gmail.com '),'testperson@gmail.com');
  assert.equal(gmail('testperson@gmail.com'),gmail('test.person@gmail.com'));
  assert.equal(gmail(' S141244@stu.tcssh.tc.edu.tw '),'s141244@stu.tcssh.tc.edu.tw');
  assert.notEqual(gmail('a.b@stu.tcssh.tc.edu.tw'),gmail('ab@stu.tcssh.tc.edu.tw'));
  for(const bad of ['a+tag@stu.tcssh.tc.edu.tw','a@stu.tcssh.tc.edu.tw.evil','a@tcssh.tc.edu.tw'])assert.throws(()=>gmail(bad));
  for(const bad of ['test@outlook.com','test@gmail.com.evil','test@googlemail.com','@gmail.com',null])assert.throws(()=>gmail(bad));
  assert.throws(()=>password('tcsshac'));assert.throws(()=>displayName('a\u202eb'));
});
test('Markdown allows formatting and code, blocks executable HTML and unsafe URLs',()=>{
  assert.match(renderMarkdown('講義 https://usaco.guide/general'),/href="https:\/\/usaco.guide\/general"/);
  assert.match(renderMarkdown('http://example.com/test'),/target="_blank"/);
  assert.doesNotMatch(renderMarkdown('`https://example.com`'),/<a /);
  assert.doesNotMatch(renderMarkdown('name@example.com javascript:alert(1)'),/<a /);
  const html=renderMarkdown('# 標題\n\n**粗體**\n\n```cpp\ncout << "x";\n```\n\n[講義](https://usaco.guide/general)');
  assert.match(html,/<h1>標題<\/h1>/);assert.match(html,/<strong>粗體/);assert.match(html,/language-cpp/);assert.match(html,/noopener noreferrer nofollow ugc/);
  for(const text of ['<script>alert(1)</script>','<img src=x onerror=alert(1)>','[x](javascript:alert(1))','[x](data:text/html;base64,xxx)','![track](https://example.com/pixel.png)','<iframe src="https://example.com"></iframe>']){
    const output=renderMarkdown(text);assert.doesNotMatch(output,/<script|<img|<iframe|href="(?:javascript|data):/i);
  }
});
test('Resource-list posts render each plain URL as a safe clickable link',()=>{
  const urls=['https://emanlaicepsa.github.io/','https://usaco.guide/','https://codeforces.com/problemset','https://zerojudge.tw/','https://cses.fi/problemset/','https://atcoder.jp/','https://usaco.org/'];
  const body='# 演算法教材\n\n'+urls.map(url=>'學習平台\n'+url).join('\n\n');
  const html=renderMarkdown(body);
  assert.equal((html.match(/<a /g)||[]).length,urls.length);
  for(const url of urls)assert.ok(html.includes(`href="${url}" target="_blank" rel="noopener noreferrer nofollow ugc"`));
  assert.doesNotMatch(renderMarkdown('```text\n'+urls.join('\n')+'\n```'),/<a /);
});

test('Database enforces identity uniqueness, verification, ownership and private access',async()=>{
  const db=new PGlite();
  try{
    await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
      create schema auth;
      create table auth.users(id uuid primary key,email text unique,email_confirmed_at timestamptz,banned_until timestamptz);
      insert into auth.users(id,email,email_confirmed_at) values('${SCHOOL_USER}','school-owner@gmail.com',now());`);
    await db.exec(await readFile('supabase/migrations/202610140001_forum.sql','utf8'));
    await db.exec(await readFile('supabase/migrations/202610140003_school_email.sql','utf8'));
    await db.exec(await readFile('supabase/migrations/202610140004_avatar.sql','utf8'));
    const student='44444444-4444-4444-8444-444444444444';
    await db.query('insert into auth.users(id,email) values($1,$2)',[student,'s141244@stu.tcssh.tc.edu.tw']);
    assert.equal((await db.query('select count(*)::int n from public.forum_auth_links where auth_user_id=$1',[student])).rows[0].n,0);
    await db.query('update auth.users set email_confirmed_at=now() where id=$1',[student]);
    assert.equal((await db.query('select user_id from public.forum_auth_links where auth_user_id=$1',[student])).rows[0].user_id,student);
    await db.query('delete from auth.users where id=$1',[student]);
    const a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222',c='33333333-3333-4333-8333-333333333333';
    await db.query('insert into auth.users(id,email) values($1,$2)',[a,'test.person@gmail.com']);
    await db.query('insert into auth.users(id,email) values($1,$2)',[b,'testperson+new@gmail.com']);
    await assert.rejects(db.query('insert into auth.users(id,email) values($1,$2)',[c,'test@example.com']),/Gmail/);
    await assert.rejects(db.query("select public.forum_write($1,'profile',$2)",[a,{display_name:'同學甲'}]),/Verified/);
    await db.query('update auth.users set email_confirmed_at=now() where id=$1',[a]);
    await db.query('update auth.users set email_confirmed_at=now() where id=$1',[b]);
    assert.equal((await db.query('select user_id from public.forum_auth_links where auth_user_id=$1',[b])).rows[0].user_id,a);
    assert.equal((await db.query('select count(*)::int as n from public.forum_identities')).rows[0].n,1);
    await db.query("select public.forum_write($1,'profile',$2)",[a,{display_name:'同學甲'}]);
    await db.query("select public.forum_write($1,'profile',$2)",[a,{display_name:'修改名稱'}]);
    assert.equal((await db.query('select display_name from public.forum_profiles')).rows[0].display_name,'修改名稱');
    await assert.rejects(db.query('update public.forum_profiles set avatar_data=$1 where user_id=$2',['https://example.com/a.svg',a]),/forum_avatar_size/);
    assert.equal((await db.query('select avatar_data from public.forum_profiles where user_id=$1',[a])).rows[0].avatar_data,null);
    await assert.rejects(db.query("select public.forum_write($1,'profile',$2)",[SCHOOL_USER,{display_name:'共用帳號'}]),/Personal/);
    const post=(await db.query("select public.forum_write($1,'post',$2) as value",[a,{title:'測試文章',body:'# Markdown'}])).rows[0].value;
    assert(post.id);
    await assert.rejects(db.query("select public.forum_write($1,'comment',$2)",[a,{post_id:post.id,body:'太快'}]),/15 seconds/);
    await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())',[c,'otherperson@gmail.com']);
    await db.query("select public.forum_write($1,'profile',$2)",[c,{display_name:'同學乙'}]);
    await db.query("select public.forum_write($1,'comment',$2)",[c,{post_id:post.id,body:'正常留言'}]);
    await assert.rejects(db.query('update auth.users set email=$1 where id=$2',['newperson@gmail.com',a]),/changes are disabled/);
    // Same atomic id+author predicate as the API: another member cannot delete.
    assert.equal((await db.query('delete from public.forum_posts where id=$1 and author_id=$2 returning id',[post.id,c])).rows.length,0);
    assert.equal((await db.query('select count(*)::int n from public.forum_comments where post_id=$1',[post.id])).rows[0].n,1);
    assert.equal((await db.query('delete from public.forum_posts where id=$1 and author_id=$2 returning id',[post.id,a])).rows.length,1);
    assert.equal((await db.query('select count(*)::int n from public.forum_comments where post_id=$1',[post.id])).rows[0].n,0);
    for(const role of ['anon','authenticated']){
      await db.exec('set role '+role);
      for(const table of ['forum_auth_links','forum_identities','forum_profiles','forum_posts','forum_comments'])await assert.rejects(db.query('select * from public.'+table),/permission denied/);
      await assert.rejects(db.query("select public.forum_write($1,'post',$2)",[a,{title:'偽造',body:'不可偽造身分'}]),/permission denied/);
      await db.exec('reset role');
    }
  }finally{await db.close()}
});

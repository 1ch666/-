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
  for(const bad of ['test@outlook.com','test@gmail.com.evil','test@googlemail.com','@gmail.com',null])assert.throws(()=>gmail(bad));
  assert.throws(()=>password('tcsshac'));assert.throws(()=>displayName('a\u202eb'));
});
test('Markdown allows formatting and code, blocks executable HTML and unsafe URLs',()=>{
  const html=renderMarkdown('# 標題\n\n**粗體**\n\n```cpp\ncout << "x";\n```\n\n[講義](https://usaco.guide/general)');
  assert.match(html,/<h1>標題<\/h1>/);assert.match(html,/<strong>粗體/);assert.match(html,/language-cpp/);assert.match(html,/noopener noreferrer nofollow ugc/);
  for(const text of ['<script>alert(1)</script>','<img src=x onerror=alert(1)>','[x](javascript:alert(1))','[x](data:text/html;base64,xxx)','![track](https://example.com/pixel.png)','<iframe src="https://example.com"></iframe>']){
    const output=renderMarkdown(text);assert.doesNotMatch(output,/<script|<img|<iframe|href="(?:javascript|data):/i);
  }
});
test('Database enforces identity uniqueness, verification, ownership and private access',async()=>{
  const db=new PGlite();
  try{
    await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
      create schema auth;
      create table auth.users(id uuid primary key,email text unique,email_confirmed_at timestamptz,banned_until timestamptz);
      insert into auth.users(id,email,email_confirmed_at) values('${SCHOOL_USER}','school-owner@gmail.com',now());`);
    await db.exec(await readFile('supabase/migrations/202610140001_forum.sql','utf8'));
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
    await assert.rejects(db.query("select public.forum_write($1,'profile',$2)",[SCHOOL_USER,{display_name:'共用帳號'}]),/Personal/);
    const post=(await db.query("select public.forum_write($1,'post',$2) as value",[a,{title:'測試文章',body:'# Markdown'}])).rows[0].value;
    assert(post.id);
    await assert.rejects(db.query("select public.forum_write($1,'comment',$2)",[a,{post_id:post.id,body:'太快'}]),/15 seconds/);
    await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())',[c,'otherperson@gmail.com']);
    await db.query("select public.forum_write($1,'profile',$2)",[c,{display_name:'同學乙'}]);
    await db.query("select public.forum_write($1,'comment',$2)",[c,{post_id:post.id,body:'正常留言'}]);
    await assert.rejects(db.query('update auth.users set email=$1 where id=$2',['newperson@gmail.com',a]),/changes are disabled/);
    for(const role of ['anon','authenticated']){
      await db.exec('set role '+role);
      for(const table of ['forum_auth_links','forum_identities','forum_profiles','forum_posts','forum_comments'])await assert.rejects(db.query('select * from public.'+table),/permission denied/);
      await assert.rejects(db.query("select public.forum_write($1,'post',$2)",[a,{title:'偽造',body:'不可偽造身分'}]),/permission denied/);
      await db.exec('reset role');
    }
  }finally{await db.close()}
});

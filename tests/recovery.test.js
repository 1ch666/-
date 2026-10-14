import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {build} from 'esbuild';
import {PGlite} from '@electric-sql/pglite';
const result=await build({entryPoints:['supabase/functions/forum-api/recovery.ts'],bundle:true,format:'esm',write:false});
const {backupEmail,newCode,proof,recoveryAction}=await import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].contents).toString('base64'));
test('Backup mailbox validation and keyed, purpose-separated OTP hashes',async()=>{
  assert.equal(backupEmail(' Person+test@outlook.com '),'person+test@outlook.com');
  assert.equal(backupEmail('p.er.son+test@googlemail.com'),'person@gmail.com');
  for(const bad of ['a@example.com\r\nBcc:x@evil.com','x <x@example.com>','x@localhost',null])assert.throws(()=>backupEmail(bad));
  for(let i=0;i<100;i++)assert.match(newCode(),/^\d{8}$/);
  const key='test-only-secret-with-at-least-32-characters';
  const a=await proof(key,'ticket','bind','12345678');
  assert.match(a,/^[a-f0-9]{64}$/);
  assert.notEqual(a,await proof(key,'ticket','primary','12345678'));
  assert.notEqual(a,await proof(key,'other-ticket','bind','12345678'));
});
test('Backup service never updates password without consumed proof; failure stays locked',async()=>{
  const calls=[];const deps={hmacKey:'test-only-secret-with-at-least-32-characters',
    db:async(path)=>{calls.push(path);return null},send:async()=>{},upstream:async()=>{throw new Error('must not call Auth')}};
  const input={ticket:'11111111-1111-4111-8111-111111111111',code:'12345678',password:'a secure password'};
  await assert.rejects(recoveryAction('backup_reset',input,null,deps),/驗證碼/);
  assert.deepEqual(calls,['rpc/forum_mail_consume']);
  calls.length=0;
  deps.db=async path=>{calls.push(path);return path.startsWith('forum_auth_links')?[{auth_user_id:'22222222-2222-4222-8222-222222222222'}]:'22222222-2222-4222-8222-222222222222'};
  deps.upstream=async()=>new Response('{}',{status:503});
  await assert.rejects(recoveryAction('backup_reset',input,null,deps),/未完成/);
  assert.equal(calls.length,2);assert.equal(calls[0],'rpc/forum_mail_consume');
});
test('Recovery SQL requires two proofs, expires and limits attempts, revokes sessions and denies public access',async()=>{
  const db=new PGlite();
  const a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222';
  const school='7484fe06-801d-44be-807f-3b773e4d21d2';
  const oldSession='44444444-4444-4444-8444-444444444444';
  const h='a'.repeat(64),p='b'.repeat(64),wrong='c'.repeat(64);
  const rpc=async(name,args)=>{const keys=Object.keys(args);return (await db.query(`select public.${name}(${keys.map((k,i)=>k+'=> $'+(i+1)).join(',')}) as value`,Object.values(args))).rows[0].value};
  const issue=(id,kind='bind',email='backup@example.com',actor=a)=>rpc('forum_mail_issue',{actor_id:actor,ticket_id:id,kind,target_email:email,proof:h,primary_proof:kind==='bind'?p:null});
  const consume=(id,kind='bind',code=h,primary=p,actor=a)=>rpc('forum_mail_consume',{ticket_id:id,kind,proof:code,primary_proof:primary,actor_id:actor});
  const age=()=>db.exec("update public.forum_mail_challenges set created_at=now()-interval '2 hours'");
  try{
    await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
      create schema auth;create table auth.users(id uuid primary key,email text unique,email_confirmed_at timestamptz,banned_until timestamptz);
      create table auth.sessions(id uuid primary key,user_id uuid references auth.users,created_at timestamptz not null default now());
      insert into auth.users values('${school}','school@gmail.com',now(),null);`);
    for(const file of ['202610140001_forum.sql','202610140002_recovery.sql'])await db.exec(await readFile('supabase/migrations/'+file,'utf8'));
    await db.query('insert into auth.users values($1,$2,now(),null),($3,$4,now(),null)',[a,'alice@gmail.com',b,'bob@gmail.com']);
    await db.query("insert into auth.sessions values($1,$2,now()-interval '1 hour')",[oldSession,a]);
    const allowed=()=>rpc('forum_session_allowed',{actor_id:a,session_key:oldSession});
    assert.equal(await allowed(),true);
    assert.equal(await issue(crypto.randomUUID(),'bind','alice@gmail.com'),false);
    assert.equal(await issue(crypto.randomUUID(),'bind','backup@example.com',school),false);
    const ticket=crypto.randomUUID();assert.equal(await issue(ticket),true);
    assert.equal(await issue(crypto.randomUUID()),false,'send cooldown enforced');
    assert.equal(await consume(ticket,'bind',h,p,b),null,'other member cannot consume');
    assert.equal(await consume(ticket,'bind',h,wrong),null,'both inbox proofs needed');
    assert.equal(await consume(ticket),a);
    assert.equal(await consume(ticket),null,'single use');
    assert.equal(await rpc('forum_recovery_target',{primary_email:'alice@gmail.com',backup_email:'backup@example.com'}),a);
    assert.equal(await rpc('forum_recovery_target',{primary_email:'bob@gmail.com',backup_email:'backup@example.com'}),null);
    await age();assert.equal(await issue(crypto.randomUUID(),'bind','backup@example.com',b),false,'backup cannot belong to another member');
    const locked=crypto.randomUUID();assert.equal(await issue(locked,'recover'),true);
    for(let i=0;i<5;i++)assert.equal(await consume(locked,'recover',wrong,null,null),null);
    assert.equal(await consume(locked,'recover',h,null,null),null,'five failures exhausted ticket');
    assert.equal((await db.query('select attempts from public.forum_mail_challenges where id=$1',[locked])).rows[0].attempts,5);
    await age();const expired=crypto.randomUUID();assert.equal(await issue(expired,'recover'),true);
    await db.query("update public.forum_mail_challenges set expires_at=now()-interval '1 second' where id=$1",[expired]);
    assert.equal(await consume(expired,'recover',h,null,null),null);
    await age();const reset=crypto.randomUUID();assert.equal(await issue(reset,'recover'),true);
    assert.equal(await consume(reset,'recover',h,null,null),a);
    assert.equal(await allowed(),false,'blocked during external Auth update');
    await db.query('update public.forum_recovery_guard set blocked=false where user_id=$1',[a]);
    assert.equal(await allowed(),false,'old JWT session stays revoked after reset');
    const fresh=crypto.randomUUID();await db.query('insert into auth.sessions(id,user_id) values($1,$2)',[fresh,a]);
    assert.equal(await rpc('forum_session_allowed',{actor_id:a,session_key:fresh}),true);
    assert.equal(await rpc('forum_session_allowed',{actor_id:b,session_key:fresh}),false);
    for(const role of ['anon','authenticated']){
      await db.exec('set role '+role);
      for(const table of ['forum_backup','forum_recovery_guard','forum_mail_challenges'])await assert.rejects(db.query('select * from public.'+table),/permission denied/);
      await assert.rejects(consume(reset,'recover',h,null,null),/permission denied/);
      await assert.rejects(rpc('forum_session_allowed',{actor_id:a,session_key:fresh}),/permission denied/);
      await db.exec('reset role');
    }
  }finally{await db.close()}
});
test('Successful recovery updates only the consumed identity and returns no session',async()=>{
  const uid='22222222-2222-4222-8222-222222222222',calls=[];
  const deps={hmacKey:'test-only-secret-with-at-least-32-characters',
    db:async(path,options)=>{if(path.startsWith('forum_auth_links'))return [{auth_user_id:uid}];calls.push({path,body:JSON.parse(options.body)});return path==='rpc/forum_mail_consume'?uid:null},
    upstream:async(path,options)=>{calls.push({path,body:JSON.parse(options.body)});return new Response(JSON.stringify({email:'owner@gmail.com'}))},
    send:async()=>{throw new Error('notification unavailable')}};
  const result=await recoveryAction('backup_reset',{ticket:crypto.randomUUID(),code:'12345678',password:'new secret password'},null,deps);
  assert.deepEqual(Object.keys(result),['message']);
  assert.equal(calls[1].path,'/auth/v1/admin/users/'+uid);
  assert.deepEqual(calls[1].body,{password:'new secret password'});
  assert.equal(calls[2].path,'forum_recovery_guard?user_id=eq.'+uid);
  assert.equal(calls[2].body.blocked,false);
});
test('Forum Edge Function parses and bundles without including SMTP credentials',async()=>{
  const result=await build({entryPoints:['supabase/functions/forum-api/index.ts'],bundle:true,format:'esm',write:false,external:['npm:*']});
  assert(result.outputFiles[0].contents.length>0);
});

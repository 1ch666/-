import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {PGlite} from '@electric-sql/pglite';
const code=await build({entryPoints:['supabase/functions/forum-api/edit-comment.ts'],bundle:true,format:'esm',write:false});
const {changeComment}=await import('data:text/javascript;base64,'+Buffer.from(code.outputFiles[0].contents).toString('base64'));
test('Only the verified author can edit or delete old comments',async()=>{
  const db=new PGlite(),author='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222',id='33333333-3333-4333-8333-333333333333';
  try{
    await db.exec('create table forum_comments(id uuid primary key,author_id uuid,body text,created_at date)');
    await db.query("insert into forum_comments values($1,$2,'原留言','2000-01-01')",[id,author]);
    const rest=async(path,options)=>{
      const q=new URL('https://local/'+path).searchParams;
      const ids=[q.get('id').slice(3),q.get('author_id').slice(3)];
      if(options.method==='DELETE')return (await db.query('delete from forum_comments where id=$1 and author_id=$2 returning id',ids)).rows;
      assert.equal(options.method,'PATCH');
      const values=JSON.parse(options.body);assert.deepEqual(Object.keys(values),['body']);
      return (await db.query('update forum_comments set body=$3 where id=$1 and author_id=$2 returning id',[...ids,values.body])).rows;
    };
    const input={id,body:'**修改留言**',author_id:author};
    assert.equal((await changeComment(rest,other,input)).length,0);
    assert.equal((await changeComment(rest,other,input,true)).length,0);
    assert.equal((await changeComment(rest,author,input)).length,1);
    assert.deepEqual((await db.query('select body,created_at::text as d from forum_comments')).rows[0],{body:input.body,d:'2000-01-01'});
    for(const invalid of [{...input,body:''},{...input,body:'x'.repeat(10001)},{...input,id:'bad'}])await assert.rejects(()=>changeComment(rest,author,invalid));
    assert.equal((await changeComment(rest,author,input,true)).length,1);
  }finally{await db.close()}
});

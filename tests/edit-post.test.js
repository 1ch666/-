import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {PGlite} from '@electric-sql/pglite';
const code=await build({entryPoints:['supabase/functions/forum-api/edit-post.ts'],bundle:true,format:'esm',write:false});
const {editPost}=await import('data:text/javascript;base64,'+Buffer.from(code.outputFiles[0].contents).toString('base64'));
test('Only the verified author can edit old posts; comments and created time remain',async()=>{
  const db=new PGlite(),author='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222',id='33333333-3333-4333-8333-333333333333';
  try{
    await db.exec('create table forum_posts(id uuid primary key,author_id uuid,title text,body text,created_at date);create table comments(post_id uuid references forum_posts(id),body text)');
    await db.query("insert into forum_posts values($1,$2,'原標題','原內容','2000-01-01')",[id,author]);
    await db.query("insert into comments values($1,'保留留言')",[id]);
    const rest=async(path,options)=>{
      assert.equal(options.method,'PATCH');
      const query=new URL('https://local/'+path).searchParams;
      const values=JSON.parse(options.body);
      assert.deepEqual(Object.keys(values),['title','body']);
      return (await db.query('update forum_posts set title=$1,body=$2 where id=$3 and author_id=$4 returning id',[values.title,values.body,query.get('id').slice(3),query.get('author_id').slice(3)])).rows;
    };
    const input={id,title:'修改標題',body:'**修改內容**',author_id:author};
    assert.equal((await editPost(rest,other,input)).length,0);
    assert.equal((await editPost(rest,author,input)).length,1);
    assert.equal((await db.query('select title from forum_posts')).rows[0].title,'修改標題');
    assert.equal((await db.query('select created_at::text as d from forum_posts')).rows[0].d,'2000-01-01');
    assert.equal((await db.query('select count(*)::int as n from comments')).rows[0].n,1);
    for(const invalid of [{...input,title:''},{...input,body:' '},{...input,body:'x'.repeat(20001)},{...input,id:'bad'}])await assert.rejects(()=>editPost(rest,author,invalid));
  }finally{await db.close()}
});

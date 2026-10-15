import {bounded,uuid} from './validation.ts';
export async function editPost(db:any,memberId:string,input:any){
  // The server supplies memberId after verifying the personal session.
  // No age/date filter: authors may edit their posts at any time.
  const title=bounded(input.title,'標題',2,120),body=bounded(input.body,'內容',1,20000);
  return db('forum_posts?id=eq.'+uuid(input.id)+'&author_id=eq.'+uuid(memberId)+'&select=id',{
    method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({title,body})
  });
}

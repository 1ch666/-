import {bounded,uuid} from './validation.ts';
// memberId comes from the verified personal session, never from the request body.
// The atomic ownership filter applies regardless of the comment's age.
export async function changeComment(db:any,memberId:string,input:any,remove=false){
  const body=remove?undefined:JSON.stringify({body:bounded(input.body,'內容',1,10000)});
  return db('forum_comments?id=eq.'+uuid(input.id)+'&author_id=eq.'+uuid(memberId)+'&select=id',{
    method:remove?'DELETE':'PATCH',headers:{Prefer:'return=representation'},...(remove?{}:{body})
  });
}

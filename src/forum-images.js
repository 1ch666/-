const base='https://jfrmuqvfuxxoqfjvvnex.supabase.co';
const id='[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
export const imagePathPattern=new RegExp('^'+id+'/'+id+'\\.jpg$');
export async function prepareImage(file){
  if(!(file instanceof File)||!['image/jpeg','image/png','image/webp'].includes(file.type)||!file.size||file.size>5*1024*1024)throw new Error('請選擇 5 MB 以下的 JPG、PNG 或 WebP 圖片');
  const bitmap=await createImageBitmap(file);
  try{
    if(!bitmap.width||!bitmap.height||bitmap.width*bitmap.height>40000000)throw new Error('圖片尺寸過大，請先縮小');
    const scale=Math.min(1,1600/Math.max(bitmap.width,bitmap.height));
    const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));
    const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);
    for(const quality of [0.85,0.7,0.5,0.35]){const data=canvas.toDataURL('image/jpeg',quality);if(data.length<=699000)return data;}
    throw new Error('圖片壓縮後仍超過 512 KB，請先縮小');
  }finally{bitmap.close()}
}
export async function loadImages(container,request){
  const nodes=[...container.querySelectorAll('[data-forum-image]')].filter(n=>!n.dataset.loading&&!n.querySelector('img'));
  nodes.forEach(n=>{n.dataset.loading='true'});
  for(let start=0;start<nodes.length;start+=20){
    const batch=nodes.slice(start,start+20);
    try{
      const {images}=await request('image_urls',{paths:[...new Set(batch.map(n=>n.dataset.forumImage))]});
      for(const node of batch){
        if(!node.isConnected)continue;
        const item=images.find(i=>i.path===node.dataset.forumImage);
        if(!item)throw new Error('圖片不存在');
        const url=new URL(item.url.startsWith('/object/')?'/storage/v1'+item.url:item.url,base);
        if(url.origin!==base||url.pathname!=='/storage/v1/object/sign/forum-images/'+node.dataset.forumImage)throw new Error('圖片網址錯誤');
        const img=document.createElement('img');img.alt=node.dataset.alt||'論壇圖片';img.decoding='async';img.referrerPolicy='no-referrer';
        img.onerror=()=>{node.textContent='圖片載入失敗，點此重試';delete node.dataset.loading};
        img.src=url.href;node.replaceChildren(img);delete node.dataset.loading;
      }
    }catch{batch.forEach(n=>{if(!n.querySelector('img')){n.textContent='圖片載入失敗，點此重試';delete n.dataset.loading}})}
  }
}

export const defaultAvatar='<span class="forum-avatar forum-avatar-default" aria-label="預設頭像"><svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="23" r="12"/><path d="M9 60v-5a23 23 0 0 1 46 0v5Z"/></svg></span>';
export function avatarMarkup(value){
  return typeof value==='string'&&value.length<=45000&&/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(value)
    ?`<img class="forum-avatar" src="${value}" alt="作者頭像" width="48" height="48" loading="lazy" decoding="async">`:defaultAvatar;
}
export async function prepareAvatar(file){
  if(!(file instanceof File)||!['image/jpeg','image/png'].includes(file.type)||!file.size||file.size>5*1024*1024)throw new Error('請選擇 5 MB 以下的 JPG 或 PNG 圖片');
  const bitmap=await createImageBitmap(file);
  try{
    if(!bitmap.width||!bitmap.height||bitmap.width*bitmap.height>40000000)throw new Error('圖片尺寸過大，請先縮小');
    const canvas=document.createElement('canvas');canvas.width=canvas.height=128;
    const ctx=canvas.getContext('2d');ctx.fillStyle='#eeeeee';ctx.fillRect(0,0,128,128);
    const side=Math.min(bitmap.width,bitmap.height);
    ctx.drawImage(bitmap,(bitmap.width-side)/2,(bitmap.height-side)/2,side,side,0,0,128,128);
    const result=canvas.toDataURL('image/jpeg',0.85);
    if(result.length>45000)throw new Error('圖片壓縮後仍過大，請選擇其他圖片');
    return result;
  }finally{bitmap.close()}
}

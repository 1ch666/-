import {uuid} from './validation.ts';
export const IMAGE_BUCKET='forum-images';
const id='[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
export const imagePathPattern=new RegExp('^'+id+'/'+id+'\\.jpg$');
export function imagePaths(value:unknown):string[]{
  if(!Array.isArray(value)||!value.length||value.length>20||value.some(p=>typeof p!=='string'||!imagePathPattern.test(p)))throw new Error('圖片識別碼錯誤');
  return [...new Set(value)];
}
// Require bounded, baseline/progressive JPEG, not SVG/HTML or arbitrary URLs.
export function imageBytes(value:unknown):Uint8Array{
  if(typeof value!=='string'||value.length>700000||!/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(value))throw new Error('圖片格式錯誤');
  let bytes:Uint8Array;try{bytes=Uint8Array.from(atob(value.slice(23)),c=>c.charCodeAt(0))}catch{throw new Error('圖片格式錯誤')}
  if(bytes.length>524288||bytes[0]!==255||bytes[1]!==216||bytes.at(-2)!==255||bytes.at(-1)!==217)throw new Error('圖片格式或大小錯誤');
  let i=2,valid=false;
  while(i+3<bytes.length){
    if(bytes[i++]!==255)break;while(bytes[i]===255)i++;
    const marker=bytes[i++];if(marker===218||marker===217)break;
    const n=(bytes[i]<<8)|bytes[i+1];if(n<2||i+n>bytes.length)break;
    // Browser canvas output has no EXIF, GPS or comments; reject injected metadata.
    if(marker===254||(marker>=225&&marker<=239))throw new Error('圖片須重新轉換後上傳');
    if([192,193,194].includes(marker)){
      const h=(bytes[i+3]<<8)|bytes[i+4],w=(bytes[i+5]<<8)|bytes[i+6];
      valid=n>=8&&w>0&&h>0&&w<=1600&&h<=1600;
      if(!valid)break;
    }
    i+=n;
  }
  if(!valid)throw new Error('圖片尺寸錯誤');return bytes;
}
export async function uploadImage(upstream:any,memberId:string,value:unknown){
  const bytes=imageBytes(value),path=uuid(memberId)+'/'+crypto.randomUUID()+'.jpg';
  const res=await upstream('/storage/v1/object/'+IMAGE_BUCKET+'/'+path,{method:'POST',headers:{'Content-Type':'image/jpeg','x-upsert':'false','Cache-Control':'max-age=0'},body:bytes});
  if(!res.ok)throw new Error('圖片上傳失敗，請稍後再試');
  return {path};
}
export async function signImages(upstream:any,paths:unknown){
  const requested=imagePaths(paths);
  const res=await upstream('/storage/v1/object/sign/'+IMAGE_BUCKET,{method:'POST',body:JSON.stringify({paths:requested,expiresIn:300})});
  if(!res.ok)throw new Error('圖片讀取失敗，請稍後再試');
  const rows=await res.json();
  return {images:rows.filter((r:any)=>requested.includes(r.path)&&typeof r.signedURL==='string').map((r:any)=>({path:r.path,url:r.signedURL}))};
}

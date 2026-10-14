// Store only small JPEG images, not remote URLs or active SVG/HTML content.
export function avatarData(value:unknown):string|null{
  if(value===null)return null;
  if(typeof value!=='string'||value.length>45000||!/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(value))throw new Error('頭像格式錯誤');
  let bytes:Uint8Array;try{bytes=Uint8Array.from(atob(value.slice(23)),c=>c.charCodeAt(0))}catch{throw new Error('頭像格式錯誤')}
  if(bytes[0]!==255||bytes[1]!==216||bytes.at(-2)!==255||bytes.at(-1)!==217)throw new Error('頭像格式錯誤');
  let i=2,valid=false;
  while(i+3<bytes.length){
    if(bytes[i++]!==255)break;
    while(bytes[i]===255)i++;
    const marker=bytes[i++];if(marker===218||marker===217)break;
    const length=(bytes[i]<<8)|bytes[i+1];if(length<2||i+length>bytes.length)break;
    if([192,193,194].includes(marker)){
      const height=(bytes[i+3]<<8)|bytes[i+4],width=(bytes[i+5]<<8)|bytes[i+6];
      valid=length>=8&&width===128&&height===128;break;
    }
    i+=length;
  }
  if(!valid)throw new Error('頭像必須為 128 × 128 JPEG');
  return value;
}

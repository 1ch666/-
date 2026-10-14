export const SCHOOL_USER = '7484fe06-801d-44be-807f-3b773e4d21d2';
export function gmail(value: unknown): string {
  if(typeof value!=='string'||value.length>254)throw new Error('請輸入有效信箱');
  // Workspace addresses do not inherit Gmail dot/plus alias semantics.
  const school=value.trim().toLowerCase();
  if(/^[a-z0-9]+(?:[._-][a-z0-9]+)*@stu\.tcssh\.tc\.edu\.tw$/.test(school)){
    if(school.split('@')[0].length>64)throw new Error('信箱格式錯誤');
    return school;
  }
  const match=value.trim().toLowerCase().match(/^([a-z0-9.]+)(?:\+[a-z0-9._-]+)?@gmail\.com$/);
  if(!match)throw new Error('只接受 @gmail.com 或 @stu.tcssh.tc.edu.tw 信箱');
  const local=match[1].replaceAll('.','');
  if(local.length<1||local.length>64)throw new Error('Gmail 格式錯誤');
  return local+'@gmail.com';
}
export function bounded(value: unknown, label: string, min: number, max: number): string {
  if(typeof value!=='string')throw new Error(label+'格式錯誤');
  const text=value.trim();
  if([...text].length<min||[...text].length>max||text.includes('\u0000'))throw new Error(`${label}須為 ${min}–${max} 字`);
  return text;
}
export function displayName(value: unknown): string {
  const text=bounded(value,'名稱',2,30);
  if(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/u.test(text))throw new Error('名稱不可包含控制字元');
  return text;
}
export function password(value: unknown): string {
  if(typeof value!=='string'||value.length<12||value.length>128)throw new Error('論壇密碼須為 12–128 字元');
  return value;
}
export function loginPassword(value: unknown): string {
  if(typeof value!=='string'||value.length<1||value.length>128||value.includes('\u0000'))throw new Error('密碼格式錯誤');
  return value;
}
export function uuid(value: unknown): string {
  if(typeof value!=='string'||! /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value))throw new Error('文章識別碼錯誤');
  return value;
}
export function page(value: unknown): number {
  const number=Number(value??0);if(!Number.isInteger(number)||number<0||number>10000)throw new Error('頁碼錯誤');return number;
}

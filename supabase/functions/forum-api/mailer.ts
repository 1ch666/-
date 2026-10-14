import nodemailer from 'npm:nodemailer@10.1.1';

export async function sendForumMail(to:string,subject:string,text:string){
  const user=Deno.env.get('FORUM_SMTP_USER');
  const pass=Deno.env.get('FORUM_SMTP_PASS');
  if(!user||!pass)throw new Error('寄信服務尚未設定');
  const transport=nodemailer.createTransport({host:'smtp.gmail.com',port:465,secure:true,
    auth:{user,pass},tls:{minVersion:'TLSv1.2',rejectUnauthorized:true},
    connectionTimeout:10000,greetingTimeout:10000,socketTimeout:15000,
    disableFileAccess:true,disableUrlAccess:true});
  try{await transport.sendMail({from:{name:'TCSSH 討論論壇',address:user},to,subject,text})}
  finally{transport.close()}
}

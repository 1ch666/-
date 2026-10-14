import {build} from 'esbuild';
import {writeFile} from 'node:fs/promises';
const result=await build({entryPoints:['supabase/functions/forum-api/index.ts'],bundle:true,format:'esm',write:false,external:['npm:*']});
await writeFile('../forum-api-deploy.ts',result.outputFiles[0].contents);
console.log('Edge deployment bundle prepared outside public site.');

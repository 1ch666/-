import {build} from 'esbuild';
import {writeFile,readFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const result=await build({entryPoints:['src/forum.js'],bundle:true,minify:true,format:'iife',write:false});
await writeFile('cpp_competitive_multi_page/forum.js',result.outputFiles[0].contents);
// Every entry page loads the forum (internal navigation keeps its JS alive).
// Change asset URLs whenever content changes so a cached bundle cannot persist.
const directory='cpp_competitive_multi_page';
const version=bytes=>createHash('sha256').update(bytes).digest('hex').slice(0,12);
const jsVersion=version(result.outputFiles[0].contents);
const cssVersion=version(await readFile(`${directory}/forum.css`));
for(const name of await readdir(directory)){
  if(!name.endsWith('.html'))continue;
  const path=`${directory}/${name}`,before=await readFile(path,'utf8');
  const after=before.replace(/src="forum\.js(?:\?[^"\s]*)?"/g,`src="forum.js?v=${jsVersion}"`)
    .replace(/href="forum\.css(?:\?[^"\s]*)?"/g,`href="forum.css?v=${cssVersion}"`);
  if(after!==before)await writeFile(path,after);
}
console.log('Forum bundle:',result.outputFiles[0].contents.length,'bytes');

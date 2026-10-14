import {build} from 'esbuild';
import {writeFile} from 'node:fs/promises';
const result=await build({entryPoints:['src/forum.js'],bundle:true,minify:true,format:'iife',write:false});
await writeFile('cpp_competitive_multi_page/forum.js',result.outputFiles[0].contents);
console.log('Forum bundle:',result.outputFiles[0].contents.length,'bytes');

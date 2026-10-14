import {build} from 'esbuild';
await build({entryPoints:['src/compiler-highlight.js'],bundle:true,minify:true,format:'iife',outfile:'cpp_competitive_multi_page/compiler-highlight.js'});

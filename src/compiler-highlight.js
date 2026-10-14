import hljs from 'highlight.js/lib/core';
import cpp from 'highlight.js/lib/languages/cpp';
hljs.registerLanguage('cpp',cpp);
window.highlightCpp=code=>hljs.highlight(code,{language:'cpp',ignoreIllegals:true}).value;

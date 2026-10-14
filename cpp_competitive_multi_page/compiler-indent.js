(()=>{
  'use strict';
  // Return one replacement edit; selected text is replaced, not duplicated.
  window.cppEnterEdit=(text,start,end)=>{
    const line=text.slice(text.lastIndexOf('\n',start-1)+1,start);
    const indent=line.match(/^[\t ]*/)[0];
    // Ignore braces in comments and quoted strings, including raw strings.
    const prefix=text.slice(0,start).replace(/R"([^\s()\\]{0,16})\([\s\S]*?\)\1"|\/\*[\s\S]*?(?:\*\/|$)|\/\/[^\n]*|"(?:\\[\s\S]|[^"\\])*"|'(?:\\[\s\S]|[^'\\])*'/g,'');
    const opens=!!line.trim()&&prefix.slice(prefix.lastIndexOf('\n')+1).trimEnd().endsWith('{');
    const unit=indent.includes('\t')?'\t':'    ';
    let insert='\n'+indent+(opens?unit:'');
    const caret=start+insert.length;
    const closing=text.slice(end).match(/^[\t ]*}/);
    if(opens&&closing){end+=closing[0].length-1;insert+='\n'+indent;}
    return {start,end,insert,caret};
  };
})();

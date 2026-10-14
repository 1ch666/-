import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
const window={};
runInNewContext(await readFile('cpp_competitive_multi_page/compiler-indent.js','utf8'),{window});
const edit=(input)=>{
  const start=input.indexOf('|'),text=input.replace('|','');
  const e=window.cppEnterEdit(text,start,start);
  const result=text.slice(0,e.start)+e.insert+text.slice(e.end);
  return result.slice(0,e.caret)+'|'+result.slice(e.caret);
};
test('Enter inherits indent and adds one level after an opening brace',()=>{
  assert.equal(edit('    cout << 1;|'),'    cout << 1;\n    |');
  assert.equal(edit('int main() {|}'),'int main() {\n    |\n}');
  assert.equal(edit('    if (x) {|  }'),'    if (x) {\n        |\n    }');
  assert.equal(edit('\tif (x) {|}'),'\tif (x) {\n\t\t|\n\t}');
  assert.equal(edit('    // {|'),'    // {\n    |');
  assert.equal(edit('int main() {\n    |'),'int main() {\n    \n    |');
  assert.equal(edit('    cout << "{";|'),'    cout << "{";\n    |');
});
test('Enter replaces the selection and keeps remaining code',()=>{
  const e=window.cppEnterEdit('    old text',4,7);
  assert.equal(e.insert,'\n    ');
  assert.equal(e.end,7);
});

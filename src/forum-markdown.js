import MarkdownIt from 'markdown-it';
import {imagePathPattern} from './forum-images.js';

// No raw HTML, remote images, embedded media or inline styles from users.
const parser = new MarkdownIt({html:false,linkify:true,typographer:false,breaks:true});
// Only explicit HTTP(S) URLs; do not turn emails or ambiguous bare domains into links.
parser.linkify.set({fuzzyLink:false,fuzzyEmail:false,fuzzyIP:false});
parser.validateLink = value => /^https?:\/\//i.test(value)||imagePathPattern.test(value.replace(/^forum-image:/,''));
parser.renderer.rules.image=(tokens,index,options,env)=>{
  const token=tokens[index],src=token.attrGet('src')||'',path=src.replace(/^forum-image:/,'');
  if(!src.startsWith('forum-image:')||!imagePathPattern.test(path))return parser.utils.escapeHtml(token.content||'不支援外部圖片');
  if(++env.imageCount>10)return '（每則內容最多顯示 10 張圖片）';
  const alt=parser.utils.escapeHtml(token.content||'論壇圖片');
  return `<button type="button" class="forum-image" data-forum-image="${path}" data-alt="${alt}" aria-label="${alt}">載入圖片</button>`;
};
const originalLink = parser.renderer.rules.link_open;
parser.renderer.rules.link_open = (tokens, index, options, env, renderer) => {
  if(!/^https?:\/\//i.test(tokens[index].attrGet('href')||''))tokens[index].attrSet('href','#');
  tokens[index].attrSet('target','_blank');
  tokens[index].attrSet('rel','noopener noreferrer nofollow ugc');
  return originalLink ? originalLink(tokens,index,options,env,renderer) : renderer.renderToken(tokens,index,options);
};
export function renderMarkdown(text) { return parser.render(String(text).slice(0,20000),{imageCount:0}); }

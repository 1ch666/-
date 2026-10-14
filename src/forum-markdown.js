import MarkdownIt from 'markdown-it';

// No raw HTML, images, embedded media, plugins, or inline styles from users.
const parser = new MarkdownIt({html:false,linkify:true,typographer:false,breaks:true});
// Only explicit HTTP(S) URLs; do not turn emails or ambiguous bare domains into links.
parser.linkify.set({fuzzyLink:false,fuzzyEmail:false,fuzzyIP:false});
parser.disable('image');
parser.validateLink = value => /^https?:\/\//i.test(value);
const originalLink = parser.renderer.rules.link_open;
parser.renderer.rules.link_open = (tokens, index, options, env, renderer) => {
  tokens[index].attrSet('target','_blank');
  tokens[index].attrSet('rel','noopener noreferrer nofollow ugc');
  return originalLink ? originalLink(tokens,index,options,env,renderer) : renderer.renderToken(tokens,index,options);
};
export function renderMarkdown(text) { return parser.render(String(text).slice(0,20000)); }

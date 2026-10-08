(()=>{
  window.renderPracticePage=()=>{
  const P=window.PROBLEMS||[],groups=window.COMBINED_GROUPS||[],roadmap=window.ROADMAP_STAGES||[],cfGroups=window.CODEFORCES_GROUPS||[],csesGroups=window.CSES_GROUPS||[],atcoderGroups=window.ATCODER_GROUPS||[],platforms=window.PLATFORMS||[],page=document.body.dataset.page;
  const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const idOf=x=>(x.url.match(/[?&]problemid=([^&]+)/)||[])[1];
  const byKey=new Map(P.map(x=>[x.key,x]));
  const lazyTables=new Map();
  const lectures={
  "io": [
    [
      "中文：Hello World",
      "https://emanlaicepsa.github.io/2020/10/21/0-0/"
    ],
    [
      "中文：變數",
      "https://emanlaicepsa.github.io/2020/10/23/0-1/"
    ],
    [
      "中文：基本輸入輸出",
      "https://emanlaicepsa.github.io/2020/10/26/0-2/"
    ],
    [
      "中文：四則運算",
      "https://emanlaicepsa.github.io/2020/10/26/0-3/"
    ],
    [
      "中文：進階輸入輸出",
      "https://emanlaicepsa.github.io/2020/11/04/0-6/"
    ],
    [
      "USACO：資料型態",
      "https://usaco.guide/general/data-types"
    ],
    [
      "USACO：輸入輸出",
      "https://usaco.guide/general/input-output"
    ]
  ],
  "control": [
    [
      "中文：條件與邏輯",
      "https://emanlaicepsa.github.io/2020/10/27/0-4/"
    ],
    [
      "中文：進階運算",
      "https://emanlaicepsa.github.io/2020/10/29/0-5/"
    ],
    [
      "中文：陣列",
      "https://emanlaicepsa.github.io/2020/11/05/0-7/"
    ],
    [
      "中文：迴圈",
      "https://emanlaicepsa.github.io/2020/11/06/0-8/"
    ],
    [
      "USACO：基礎必備知識",
      "https://usaco.guide/general/expected-knowledge"
    ]
  ],
  "simulation": [
    [
      "USACO：時間複雜度",
      "https://usaco.guide/bronze/time-comp"
    ],
    [
      "USACO：模擬",
      "https://usaco.guide/bronze/simulation"
    ],
    [
      "USACO：分類討論",
      "https://usaco.guide/bronze/casework"
    ],
    [
      "USACO：Ad Hoc",
      "https://usaco.guide/bronze/ad-hoc"
    ]
  ],
  "complete-search": [
    [
      "中文：函式",
      "https://emanlaicepsa.github.io/2020/11/09/0-9/"
    ],
    [
      "中文：遞迴",
      "https://emanlaicepsa.github.io/2020/11/09/0-10/"
    ],
    [
      "中文：變數作用範圍",
      "https://emanlaicepsa.github.io/2020/11/13/0-12/"
    ],
    [
      "USACO：完整搜尋",
      "https://usaco.guide/bronze/intro-complete"
    ],
    [
      "USACO：遞迴搜尋與回溯",
      "https://usaco.guide/bronze/complete-rec"
    ]
  ],
  "sort-set": [
    [
      "中文：排序",
      "https://emanlaicepsa.github.io/2020/11/16/0-13/"
    ],
    [
      "中文：set",
      "https://emanlaicepsa.github.io/2020/12/07/0-20"
    ],
    [
      "中文：map",
      "https://emanlaicepsa.github.io/2020/12/09/0-21"
    ],
    [
      "USACO：排序入門",
      "https://usaco.guide/bronze/intro-sorting"
    ],
    [
      "USACO：集合與映射",
      "https://usaco.guide/bronze/intro-sets"
    ],
    [
      "USACO：貪心入門",
      "https://usaco.guide/bronze/intro-greedy"
    ]
  ],
  "intro-graph": [
    [
      "USACO：圖論入門",
      "https://usaco.guide/bronze/intro-graphs"
    ],
    [
      "USACO：矩形幾何",
      "https://usaco.guide/bronze/rect-geo"
    ]
  ],
  "silver-core": [
    [
      "中文：struct",
      "https://emanlaicepsa.github.io/2020/11/11/0-11/"
    ],
    [
      "中文：常用工具函式",
      "https://emanlaicepsa.github.io/2020/11/18/0-14/"
    ],
    [
      "中文：STL 入門",
      "https://emanlaicepsa.github.io/2020/11/30/0-16/"
    ],
    [
      "中文：vector",
      "https://emanlaicepsa.github.io/2020/11/30/0-17/"
    ],
    [
      "中文：pair",
      "https://emanlaicepsa.github.io/2020/12/02/0-18/"
    ],
    [
      "USACO：字串與基礎語法",
      "https://usaco.guide/general/expected-knowledge"
    ],
    [
      "USACO：遞迴完整搜尋",
      "https://usaco.guide/bronze/complete-rec"
    ]
  ],
  "prefix": [
    [
      "USACO：前綴和",
      "https://usaco.guide/silver/prefix-sums"
    ],
    [
      "USACO：二維前綴和與差分",
      "https://usaco.guide/silver/more-prefix-sums"
    ]
  ],
  "sort-search": [
    [
      "USACO：雙指標",
      "https://usaco.guide/silver/two-pointers"
    ],
    [
      "USACO：自訂排序",
      "https://usaco.guide/silver/sorting-custom"
    ],
    [
      "USACO：排序與貪心",
      "https://usaco.guide/silver/greedy-sorting"
    ],
    [
      "USACO：有序陣列二分",
      "https://usaco.guide/silver/binary-search-sorted-array"
    ],
    [
      "USACO：二分答案",
      "https://usaco.guide/silver/binary-search"
    ]
  ],
  "traversal": [
    [
      "USACO：圖遍歷",
      "https://usaco.guide/silver/graph-traversal"
    ],
    [
      "USACO：Flood Fill",
      "https://usaco.guide/silver/flood-fill"
    ],
    [
      "USACO：BFS 與無權最短路",
      "https://usaco.guide/gold/unweighted-shortest-paths"
    ],
    [
      "USACO：樹入門",
      "https://usaco.guide/silver/intro-tree"
    ],
    [
      "USACO：功能圖",
      "https://usaco.guide/silver/func-graphs"
    ]
  ],
  "bitwise-ds": [
    [
      "中文：queue 與 stack",
      "https://emanlaicepsa.github.io/2020/12/03/0-19"
    ],
    [
      "中文：priority_queue",
      "https://emanlaicepsa.github.io/2020/12/10/0-22"
    ],
    [
      "中文：deque",
      "https://emanlaicepsa.github.io/2020/12/14/0-23"
    ],
    [
      "中文：bitset",
      "https://emanlaicepsa.github.io/2020/12/14/0-25"
    ],
    [
      "USACO：位元運算",
      "https://usaco.guide/silver/intro-bitwise"
    ],
    [
      "USACO：優先佇列",
      "https://usaco.guide/silver/priority-queues"
    ]
  ],
  "math": [
    [
      "USACO：整除與因數",
      "https://usaco.guide/gold/divisibility"
    ],
    [
      "USACO：模運算",
      "https://usaco.guide/gold/modular"
    ],
    [
      "USACO：組合計數",
      "https://usaco.guide/gold/combo"
    ]
  ],
  "dp": [
    [
      "USACO：DP 入門",
      "https://usaco.guide/gold/intro-dp"
    ],
    [
      "USACO：背包",
      "https://usaco.guide/gold/knapsack"
    ],
    [
      "USACO：網格路徑 DP",
      "https://usaco.guide/gold/paths-grids"
    ],
    [
      "USACO：LIS",
      "https://usaco.guide/gold/lis"
    ],
    [
      "USACO：位元遮罩 DP",
      "https://usaco.guide/gold/dp-bitmasks"
    ],
    [
      "USACO：區間 DP",
      "https://usaco.guide/gold/dp-ranges"
    ],
    [
      "USACO：數位 DP",
      "https://usaco.guide/gold/digit-dp"
    ]
  ],
  "weighted-graph": [
    [
      "USACO：最短路",
      "https://usaco.guide/gold/shortest-paths"
    ],
    [
      "USACO：並查集",
      "https://usaco.guide/gold/dsu"
    ],
    [
      "USACO：拓撲排序",
      "https://usaco.guide/gold/toposort"
    ],
    [
      "USACO：最小生成樹",
      "https://usaco.guide/gold/mst"
    ]
  ],
  "range-tree": [
    [
      "USACO：BIT 與線段樹",
      "https://usaco.guide/gold/PURS"
    ],
    [
      "USACO：樹 DP",
      "https://usaco.guide/gold/dp-trees"
    ],
    [
      "USACO：換根 DP",
      "https://usaco.guide/gold/all-roots"
    ],
    [
      "USACO：Euler Tour",
      "https://usaco.guide/gold/tree-euler"
    ],
    [
      "USACO：LCA",
      "https://usaco.guide/gold/lca-euler"
    ]
  ],
  "gold-extra": [
    [
      "USACO：字串雜湊",
      "https://usaco.guide/gold/hashing"
    ],
    [
      "USACO：雜湊表",
      "https://usaco.guide/gold/hashmaps"
    ],
    [
      "USACO：Meet in the Middle",
      "https://usaco.guide/gold/meet-in-the-middle"
    ],
    [
      "USACO：三分搜尋",
      "https://usaco.guide/gold/ternary-search"
    ]
  ],
  "advanced-range": [
    [
      "USACO：線段樹延伸",
      "https://usaco.guide/plat/segtree-ext"
    ],
    [
      "USACO：區間更新與查詢",
      "https://usaco.guide/plat/RURQ"
    ],
    [
      "USACO：動態開點線段樹",
      "https://usaco.guide/plat/sparse-segtree"
    ],
    [
      "USACO：二維區間查詢",
      "https://usaco.guide/plat/2DRQ"
    ],
    [
      "USACO：離線區間查詢",
      "https://usaco.guide/plat/range-sweep"
    ],
    [
      "USACO：平方根分解",
      "https://usaco.guide/plat/sqrt"
    ]
  ],
  "advanced-tree": [
    [
      "USACO：倍增",
      "https://usaco.guide/plat/binary-jump"
    ],
    [
      "USACO：小併大",
      "https://usaco.guide/plat/merging"
    ],
    [
      "USACO：重鏈剖分",
      "https://usaco.guide/plat/hld"
    ],
    [
      "USACO：重心分解",
      "https://usaco.guide/plat/centroid"
    ],
    [
      "USACO：虛樹",
      "https://usaco.guide/plat/VT"
    ],
    [
      "USACO：Kruskal 重構樹",
      "https://usaco.guide/plat/kruskal-tree"
    ]
  ],
  "platinum-graph": [
    [
      "USACO：負權最短路",
      "https://usaco.guide/adv/sp-neg"
    ],
    [
      "USACO：歐拉路徑",
      "https://usaco.guide/adv/eulerian-tours"
    ],
    [
      "USACO：強連通分量",
      "https://usaco.guide/adv/SCC"
    ],
    [
      "USACO：雙連通分量",
      "https://usaco.guide/adv/BCC-2CC"
    ]
  ],
  "geometry": [
    [
      "USACO：幾何基礎",
      "https://usaco.guide/plat/geo-pri"
    ],
    [
      "USACO：掃描線",
      "https://usaco.guide/plat/sweep-line"
    ],
    [
      "USACO：凸包",
      "https://usaco.guide/plat/convex-hull"
    ]
  ],
  "advanced-dp": [
    [
      "USACO：凸包最佳化",
      "https://usaco.guide/plat/convex-hull-trick"
    ],
    [
      "USACO：分治 DP",
      "https://usaco.guide/plat/DC-DP"
    ],
    [
      "USACO：SOS DP",
      "https://usaco.guide/plat/dp-sos"
    ],
    [
      "USACO：矩陣快速冪",
      "https://usaco.guide/plat/matrix-expo"
    ],
    [
      "USACO：容斥原理",
      "https://usaco.guide/plat/PIE"
    ],
    [
      "USACO：bitset 最佳化",
      "https://usaco.guide/plat/bitsets"
    ]
  ],
  "platinum-mixed": [
    [
      "USACO：字串雜湊",
      "https://usaco.guide/gold/hashing"
    ],
    [
      "USACO：折半搜尋",
      "https://usaco.guide/gold/meet-in-the-middle"
    ],
    [
      "USACO：字串匹配（延伸）",
      "https://usaco.guide/adv/string-search"
    ],
    [
      "USACO：隨機化（延伸）",
      "https://usaco.guide/adv/random"
    ]
  ],
  "advanced-ds": [
    [
      "USACO：持久化資料結構",
      "https://usaco.guide/adv/persistent"
    ],
    [
      "USACO：Treap",
      "https://usaco.guide/adv/treaps"
    ],
    [
      "USACO：Segment Tree Beats",
      "https://usaco.guide/adv/segtree-beats"
    ],
    [
      "USACO：Wavelet Tree",
      "https://usaco.guide/adv/wavelet"
    ],
    [
      "USACO：動態凸包最佳化",
      "https://usaco.guide/adv/line-container"
    ]
  ],
  "advanced-graph": [
    [
      "USACO：最大流",
      "https://usaco.guide/adv/max-flow"
    ],
    [
      "USACO：最小割",
      "https://usaco.guide/adv/min-cut"
    ],
    [
      "USACO：上下界流",
      "https://usaco.guide/adv/flow-lb"
    ],
    [
      "USACO：最小費用流",
      "https://usaco.guide/adv/min-cost-flow"
    ],
    [
      "USACO：離線刪除",
      "https://usaco.guide/adv/offline-del"
    ],
    [
      "USACO：Link-Cut Tree",
      "https://usaco.guide/adv/link-cut-tree"
    ]
  ],
  "advanced-string": [
    [
      "USACO：進階字串匹配",
      "https://usaco.guide/adv/string-search"
    ],
    [
      "USACO：後綴陣列",
      "https://usaco.guide/adv/suffix-array"
    ],
    [
      "USACO：後綴結構與應用",
      "https://usaco.guide/adv/string-suffix"
    ]
  ],
  "advanced-math": [
    [
      "USACO：進階 DP",
      "https://usaco.guide/adv/dp-more"
    ],
    [
      "USACO：輪廓 DP",
      "https://usaco.guide/adv/dp-broken-profile"
    ],
    [
      "USACO：FFT",
      "https://usaco.guide/adv/fft"
    ],
    [
      "USACO：博弈論",
      "https://usaco.guide/adv/game-theory"
    ],
    [
      "USACO：擴展歐幾里得",
      "https://usaco.guide/adv/extend-euclid"
    ],
    [
      "USACO：線性基",
      "https://usaco.guide/adv/xor-basis"
    ],
    [
      "USACO：拉格朗日插值",
      "https://usaco.guide/adv/lagrange"
    ]
  ]
};
  const lectureAnchor=([label,url])=>'<a href="'+esc(url)+'" target="_blank" rel="noopener noreferrer">'+esc(label)+'</a>';
  function lectureBlock(id){const links=lectures[id];return links?'<nav class="lecture-links" aria-label="本模組講義"><b>講義</b>'+links.map(lectureAnchor).join('')+'</nav>':''}
  function lectureOverview(){return '<section class="lecture-overview" id="lecture-resources"><h2>講義索引</h2><p>'+lectureAnchor(['USACO Guide（英文）','https://usaco.guide/general'])+'：基礎到進階演算法。各模組下方附對應章節。</p><p>'+lectureAnchor(['從零開始的演算法競賽入門教學（中文）','https://emanlaicepsa.github.io/2020/10/21/0-index/'])+'：C++ 基礎語法、函式、遞迴與 STL。</p></section>'}
  const stageSlug={general:'general',bronze:'bronze',silver:'silver',gold:'gold',platinum:'plat',advanced:'adv'};
  const statHtml=pairs=>pairs.map(([label,value])=>'<div class="stat"><b>'+value+'</b><span>'+label+'</span></div>').join('');
  const levelRank=x=>Number(String(x.level||'L9').slice(1))||9;
  function stats(items){const topics=new Set(items.map(x=>x.topic)).size,basic=items.filter(x=>levelRank(x)<=2).length;return statHtml([['唯一題目',items.length],['主題',topics],['L1–L2',basic],['L3–L5',items.length-basic]])}
  function row(x,i){return '<tr><td class="order">'+i+'</td><td><a class="title" target="_blank" rel="noopener" href="'+x.url+'">'+esc(x.title)+'</a></td><td>'+esc(x.topic)+'<span class="sub">'+esc(x.subtopic||'')+'</span></td><td><span class="pill">'+esc(x.level)+'</span></td><td>'+esc(x.difficulty||x.type||'—')+'</td><td>'+esc(x.minutes)+' 分</td></tr>'}
  function table(items){return '<div class="table-wrap"><table><thead><tr><th>順序</th><th>題目</th><th>主題</th><th>階段</th><th>難度</th><th>限時</th></tr></thead><tbody>'+items.map((x,i)=>row(x,i+1)).join('')+'</tbody></table></div>'}
  function filtered(items){const q=(document.querySelector('#search')?.value||'').trim().toLowerCase(),l=document.querySelector('#level')?.value||'all';return items.filter(x=>(l==='all'||x.level===l)&&(!q||[x.title,x.topic,x.subtopic,x.difficulty,x.method].join(' ').toLowerCase().includes(q)))}
  function section(id,name,desc,items){return '<section class="method" id="'+id+'"><div class="method-head"><div><h2>'+esc(name)+'</h2><p>'+esc(desc)+'</p></div><span>'+items.length+' 題</span></div>'+table(items)+'</section>'}
  function moduleDetails(id,name,desc,items,open,lectureId){lazyTables.set(id,items);return '<details class="roadmap-module" id="'+id+'" '+(open?'open':'')+'><summary><div><h3>'+esc(name)+'</h3><p>'+esc(desc)+'</p></div><span>'+items.length+' 題</span></summary>'+lectureBlock(lectureId)+'<div class="lazy-table">'+(open?table(items):'')+'</div></details>'}
  function hydrateOne(details){const body=details?.querySelector('.lazy-table');if(details?.open&&body&&!body.childElementCount)body.innerHTML=table(lazyTables.get(details.id)||[])}
  function hydrateDetails(root){root?.querySelectorAll('details.roadmap-module').forEach(details=>{details.ontoggle=()=>{const body=details.querySelector('.lazy-table');if(!details.open){if(body)body.innerHTML='';return}root.querySelectorAll('details.roadmap-module[open]').forEach(other=>{if(other!==details){other.open=false;const otherBody=other.querySelector('.lazy-table');if(otherBody)otherBody.innerHTML=''}});hydrateOne(details)};hydrateOne(details)})}
  function setToc(entries){const root=document.querySelector('#tocLinks');if(!root)return;root.innerHTML=entries.map(([id,label])=>'<a href="#'+id+'">'+esc(label)+'</a>').join('');root.querySelectorAll('a').forEach(a=>a.onclick=()=>{const target=document.querySelector(a.getAttribute('href'));if(target?.tagName==='DETAILS'){target.open=true;hydrateOne(target)}if(innerWidth<=850)document.body.classList.add('toc-collapsed')})}
  function renderRoadmap(){let shown=0,html=lectureOverview(),toc=[['lecture-resources','講義索引']],opened=false;lazyTables.clear();roadmap.forEach(stage=>{let modules='',moduleToc=[];stage.modules.forEach(m=>{const rows=filtered(m.keys.map(k=>byKey.get(k)).filter(Boolean));if(!rows.length)return;shown+=rows.length;const id='roadmap-'+stage.id+'-'+m.id,isOpen=!opened;opened=true;moduleToc.push([id,'　'+m.name]);modules+=moduleDetails(id,m.name,m.desc,rows,isOpen,m.id)});if(modules){const sid='stage-'+stage.id;toc.push([sid,stage.name],...moduleToc);html+='<section class="roadmap-stage" id="'+sid+'"><header class="stage-head"><div><h2>'+esc(stage.name)+'</h2><p>'+esc(stage.desc)+'</p><p class="stage-lecture">'+lectureAnchor(['USACO Guide：本階段講義目錄','https://usaco.guide/'+stageSlug[stage.id]])+'</p></div><span class="stage-level">'+esc(stage.level)+'</span></header>'+modules+'</section>'}});const root=document.querySelector('#roadmapRoot');root.innerHTML=html+'<p class="source-note">課綱層級參考 USACO Guide；題目依本題庫主題與難度重新映射。</p>';hydrateDetails(root);document.querySelector('#summary').innerHTML=statHtml([['唯一題目',shown],['階段',roadmap.length],['模組',roadmap.reduce((n,s)=>n+s.modules.length,0)],['平台',platforms.length]]);document.querySelector('#empty').style.display=shown?'none':'block';setToc(toc)}
  function render(){const platform=document.body.dataset.platform,items=P.filter(x=>x.platform===platform),rows=filtered(items);lazyTables.clear();document.querySelector('#summary').innerHTML=stats(items);let html='',toc=[],opened=false;if(platform==='ZeroJudge'){groups.forEach(g=>{const ids=new Set(g.ids),part=rows.filter(x=>ids.has(idOf(x)));if(part.length){const sid='group-'+g.id,isOpen=!opened;html+=moduleDetails(sid,g.name,g.desc,part,isOpen);toc.push([sid,g.name]);opened=true}})}else if(platform==='Codeforces'||platform==='CSES'||platform==='AtCoder'){const visible=new Set(rows.map(x=>x.key)),platformGroups=platform==='Codeforces'?cfGroups:platform==='CSES'?csesGroups:atcoderGroups;platformGroups.forEach(g=>{const part=g.keys.map(k=>byKey.get(k)).filter(x=>x&&visible.has(x.key));if(!part.length)return;const sid='platform-group-'+g.id,isOpen=!opened;html+=moduleDetails(sid,g.name,g.desc,part,isOpen);toc.push([sid,g.name]);opened=true})}else{const visible=new Set(rows.map(x=>x.key));roadmap.forEach(stage=>{let modules='',moduleToc=[];stage.modules.forEach(m=>{const part=m.keys.map(k=>byKey.get(k)).filter(x=>x&&x.platform===platform&&visible.has(x.key));if(!part.length)return;const id='platform-'+platform.toLowerCase()+'-'+stage.id+'-'+m.id,isOpen=!opened;modules+=moduleDetails(id,m.name,m.desc,part,isOpen);moduleToc.push([id,'　'+m.name]);opened=true});if(modules){const sid='platform-'+platform.toLowerCase()+'-'+stage.id;html+='<section class="roadmap-stage" id="'+sid+'"><header class="stage-head"><div><h2>'+esc(stage.name)+'</h2><p>'+esc(stage.desc)+'</p></div><span class="stage-level">'+esc(stage.level)+'</span></header>'+modules+'</section>';toc.push([sid,stage.name],...moduleToc)}})}const root=document.querySelector('#problemRoot');root.innerHTML=html;hydrateDetails(root);document.querySelector('#empty').style.display=rows.length?'none':'block';setToc(toc)}
  function setupToc(){document.querySelector('#tocClose')?.addEventListener('click',()=>document.body.classList.add('toc-collapsed'));document.querySelector('#tocOpen')?.addEventListener('click',()=>document.body.classList.remove('toc-collapsed'));if(innerWidth<=850)document.body.classList.add('toc-collapsed')}
  setupToc();
  if(page==='roadmap'){renderRoadmap();['search','level'].forEach(id=>document.querySelector('#'+id).addEventListener(id==='search'?'input':'change',renderRoadmap))}
  else{render();['search','level'].forEach(id=>document.querySelector('#'+id).addEventListener(id==='search'?'input':'change',render))}
  };
  window.renderPracticePage();
})();

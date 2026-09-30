"use strict";
const GROUPS = {united:{title:"聯合王國",subtitle:"3位主要君王 · 掃羅、大衛、所羅門"},north:{title:"北國 · 以色列",subtitle:"19位君王 · 王朝屢次更替，最終被亞述征服"},south:{title:"南國 · 猶大",subtitle:"19位男性君王＋亞他利雅女王 · 大衛王朝與被擄歷史"}};
const BOOKS = {撒上:"撒母耳記上",撒下:"撒母耳記下",王上:"列王紀上",王下:"列王紀下",代上:"歷代志上",代下:"歷代志下",申:"申命記",詩:"詩篇",賽:"以賽亞書",耶:"耶利米書",摩:"阿摩司書",何:"何西阿書",彌:"彌迦書",徒:"使徒行傳",羅:"羅馬書",林前:"哥林多前書",提後:"提摩太後書",結:"以西結書"};
const MILESTONES = [
{year:1050,title:"從士師到君王",text:"百姓求立王；撒母耳受命膏立掃羅。神對君王的要求，始終是遵行祂的話。",refs:["撒上8–10","申17:14–20"]},
{year:930,title:"王國分裂",text:"耶羅波安領北方十支派；羅波安保有猶大與便雅憫。從此兩國歷史同時展開。",refs:["王上11:29–39","王上12"]},
{year:841,title:"王朝更迭與王室危機",text:"北國耶戶推翻亞哈家；南國亞哈謝被殺，亞他利雅奪權，約阿施蒙救。",refs:["王下9–11"]},
{year:722,title:"北國滅亡 · 撒馬利亞陷落",text:"亞述圍城、擄走居民。猶大仍存，繼續走向希西家與約西亞的改革時期。",refs:["王下17","王下18:9–12"]},
{year:622,title:"重新聽見律法書",text:"約西亞在位第十八年修殿得書，向神自卑，招聚百姓立約。",refs:["王下22–23"]},
{year:597,title:"約雅斤被擄",text:"巴比倫擄去王室與工匠，取走財寶，另立西底家；聖殿此時尚未被焚毀。",refs:["王下24:10–17"]},
{year:586,title:"猶大亡國 · 聖殿焚毀",text:"耶路撒冷城破，西底家被擒，同年五月聖殿被焚。列王紀最後仍留下約雅斤獲釋的記載。",refs:["王下25","代下36:11–21"]}
];
let selectedKing="david";
let currentView="timeline";
const escapeHTML = value => String(value).replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function bibleURL(ref){const m=ref.match(/^([^0-9]+)(\d+)/);if(!m || !BOOKS[m[1]])return "https://joy.org.tw/bible_book.php";return "https://joy.org.tw/bible.php?"+new URLSearchParams({book:BOOKS[m[1]],chapter:m[2]});}
function scriptureRefs(refs){return '<div class="refs">'+refs.map(ref=>`<a href="${escapeHTML(bibleURL(ref))}" target="_blank" rel="noopener noreferrer" title="在喜信聖經開啟此段首章">${escapeHTML(ref)} ↗</a>`).join("")+"</div>";}
function dateLabel(k){return k.start===k.end?`約主前 ${k.start} 年`:`約主前 ${k.start}–${k.end} 年`;}
function badge(k){return `<span class="badge ${k.status}">${escapeHTML(k.label)}</span>`;}
function kingCard(k){return `<button class="king-card ${k.group}" data-king="${k.id}" aria-pressed="${selectedKing===k.id}" aria-label="${GROUPS[k.group].title} ${escapeHTML(k.name)}，${escapeHTML(k.label)}，閱讀詳情"><span class="card-top"><span class="king-name">${escapeHTML(k.name)}</span>${badge(k)}</span><span class="card-meta">${dateLabel(k)}</span><span class="card-story">${escapeHTML(k.tagline)}</span></button>`;}
function renderTimeline(){
 const years=[...new Set([...KINGS.map(k=>k.start),...MILESTONES.map(m=>m.year)])].sort((a,b)=>b-a);
 document.getElementById("timeline").innerHTML=years.map(year=>{
  const milestone=MILESTONES.find(m=>m.year===year);let rows="";
  if(milestone)rows+=`<div class="time-row era-row" id="year-${year}"><span class="year">${year}</span><div class="milestone"><strong>${escapeHTML(milestone.title)}</strong><p>${escapeHTML(milestone.text)}</p>${scriptureRefs(milestone.refs)}</div></div>`;
  const kings=KINGS.filter(k=>k.start===year);
  const united=kings.filter(k=>k.group==="united");
  if(united.length)united.forEach((k,i)=>{rows+=`<div class="time-row" ${!milestone&&i===0?`id="year-${year}"`:""}><span class="year">${milestone?"":year}</span><div class="united-slot">${kingCard(k)}</div></div>`;});
  const north=kings.filter(k=>k.group==="north").sort((a,b)=>a.order-b.order),south=kings.filter(k=>k.group==="south").sort((a,b)=>a.order-b.order);
  if(north.length||south.length)rows+=`<div class="time-row" ${!milestone?`id="year-${year}"`:""}><span class="year">${milestone?"":year}</span><div class="king-stack">${north.map(kingCard).join("")}</div><div class="king-stack">${south.map(kingCard).join("")}</div></div>`;
  return rows;
 }).join("");
}
function renderKing(id){
 const k=KINGS.find(x=>x.id===id);if(!k)return;
 selectedKing=k.id;
 const article=document.getElementById("king-detail");
 article.innerHTML=`<div class="detail-top"><p class="eyebrow">${GROUPS[k.group].title} / 第 ${String(k.order).padStart(2,"0")} 位</p><div>${badge(k)}</div><h2>${escapeHTML(k.name)}</h2>${k.alias?`<p class="minor">${escapeHTML(k.alias)}</p>`:""}<p class="subtitle">${escapeHTML(k.turn)}</p><p class="minor">${dateLabel(k)}</p></div><div class="detail-body"><dl class="facts"><div><dt>聖經記載任期</dt><dd>${escapeHTML(k.years)}</dd></div><div><dt>登基年齡</dt><dd>${escapeHTML(k.age)}</dd></div><div><dt>家族／身分</dt><dd>${escapeHTML(k.family)}</dd></div><div><dt>都城／主要所在地</dt><dd>${escapeHTML(k.capital)}</dd></div><div style="grid-column:1/-1"><dt>相關先知與屬靈人物</dt><dd>${escapeHTML(k.prophets)}</dd></div></dl><section><h3><span class="section-number">01</span>聖經的評語</h3><div class="verdict">${escapeHTML(k.verdict)}${scriptureRefs(k.vrefs)}</div></section><section><h3><span class="section-number">02</span>主要事蹟與結局</h3><ol class="events">${k.events.map(([title,text,...refs])=>`<li><h4>${escapeHTML(title)}</h4><p>${escapeHTML(text)}</p>${scriptureRefs(refs)}</li>`).join("")}</ol></section><section><h3><span class="section-number">03</span>查經省思</h3><p class="note">${escapeHTML(k.lesson)}</p></section><section><div class="caution"><strong>讀經時留意</strong><br>${escapeHTML(k.caution)}</div></section><section><h3><span class="section-number">04</span>真耶穌教會延伸查考</h3>${k.sources.map(id=>{const s=SOURCES.find(s=>s.id===id);return s?`<a class="tjc-source" href="${s.url}" target="_blank" rel="noopener noreferrer">${escapeHTML(s.title)} ↗<small>${escapeHTML(s.author)} · 《${s.collection}》</small></a>`:"";}).join("")}<p class="source-footnote">事蹟與評語按經文摘要；省思為本站整理。教會講章供延伸閱讀，經文連結開啟所引段落的首章。</p></section><section><h3>同讀相關人物</h3><div class="related">${k.related.map(id=>{const r=KINGS.find(k=>k.id===id);return r?`<button data-king="${id}">${escapeHTML(r.name)}${r.group!=="united"?` · ${r.group==="north"?"北國":"南國"}`:""}</button>`:"";}).join("")}</div></section><button class="back-timeline" data-back-timeline>返回時間軸</button></div>`;
 article.scrollTop=0;
 document.querySelectorAll(".king-card").forEach(button=>button.setAttribute("aria-pressed",String(button.dataset.king===id)));
 document.title=`${k.name}（${GROUPS[k.group].title}）｜聖經列王誌`;
}
function renderDirectory(){document.getElementById("directory").innerHTML=Object.entries(GROUPS).map(([group,meta])=>`<section class="directory-group"><h3>${meta.title}</h3><p>${meta.subtitle}</p><div class="directory-grid">${KINGS.filter(k=>k.group===group).sort((a,b)=>a.order-b.order).map(kingCard).join("")}</div></section>`).join("")+`<section class="directory-group"><h3>另外四位：爭立與叛亂人物</h3><p>另列於42位主要統治者之外，保留不同王權的性質；資料不足者不勉強貼上善惡標籤。</p><div class="rival-grid">${RIVALS.map(r=>`<article class="rival-card">${badge(r)}<h3>${r.name}</h3><p class="card-meta">${r.when}</p><p>${r.text}</p>${scriptureRefs(r.refs)}<p class="source-footnote">${r.note}</p></article>`).join("")}</div></section>`;}
function renderSources(){
document.getElementById("sources").innerHTML=`<div class="sources-layout">
<article class="source-section"><h3>整理範圍與判斷順序</h3><p>主體是掃羅、大衛、所羅門，以及王國分裂後的以色列、猶大統治者；不包含聖經出現的所有外邦君王、希律家族或啟示錄象徵性的王。</p><p><strong>計數：3＋19＋20＝42。</strong>南國20位含19位男性君王與亞他利雅女王。伊施波設、押沙龍、亞多尼雅、提比尼另列，因其爭立或叛亂的性質不同。</p><p>人物事蹟依聖經各段自行摘要，並附經節；教會講章協助掌握查經方向。「查經省思」與簡短分類是本站的整理，不宣稱是教會正式頒定的排名或個人得救判決。</p><p>首先看聖經的直接評語，再看具體行為，最後並讀歷代志、先知書補充的悔改與偏離。</p></article>
<article class="source-section"><h3>「好王／壞王」怎麼看？</h3><ul><li><span class="badge good">好王</span> 經文整體肯定其敬拜與所行；仍可能有犯罪和未完成的改革。</li><li><span class="badge bad">壞王</span> 經文整體否定，或明載嚴重惡行；不抹去其一時謙卑或善行。</li><li><span class="badge mixed">善惡轉折</span> 特別凸顯好轉壞、壞後悔改，或長期行正後重大失腳；請讀完整評語。</li><li>沙龍、亞他利雅沒有獨立的善惡公式句，依弒君、剿滅王室等記載歸類。提比尼、伊施波設則不硬加一生總評。</li><li>疆土、富強、任期長短與戰爭勝敗，都不能單獨當作善惡標準。</li></ul>${scriptureRefs(["王上15:5","王下10:28–31","王下14:24–27","代下33:12–16"])}</article>
<article class="source-section wide"><h3>值得一起讀的轉折</h3><div class="table-scroll"><table class="source-table"><thead><tr><th>人物</th><th>肯定或初期表現</th><th>不可省略的記載</th></tr></thead><tbody>${[
["大衛","合神心意、願意認罪","拔示巴、烏利亞事件與家庭的創傷","david"],
["所羅門","愛神、求智慧、建殿","晚年隨從別神；經文未明載臨終悔改","solomon"],
["亞撒","除偶像、仰賴神","晚年倚人、囚禁先見、病中不求神","asa"],
["約阿施","耶何耶大在世時行正、修殿","後來棄神，殺害撒迦利亞","joash-s"],
["亞瑪謝","起初按律法行事","心不專誠，戰勝後拜西珥神像","amaziah"],
["烏西雅","尋求神、國勢強盛","驕傲越權燒香，患大痲瘋","uzziah"],
["希西家","專靠神、恢復敬拜","向巴比倫使者炫耀財富，驕傲後自卑","hezekiah"],
["瑪拿西","後來自卑、禱告、除偶像","先前流無辜血與引民犯罪仍有長遠影響","manasseh"],
["約西亞","盡心回轉、重得律法書","最後不聽神藉尼哥的警告而出戰","josiah"],
["耶戶","按神旨意對付亞哈家","仍拜金牛犢，沒有盡心遵守律法","jehu"]
].map(([name,good,bad,id])=>`<tr><td><button class="text-button" data-king="${id}">${name}</button></td><td>${good}</td><td>${bad}</td></tr>`).join("")}</tbody></table></div></article>
<article class="source-section"><h3>年代與時間軸的使用方式</h3><p>聖經通常記「某王第幾年」，主前年份是後來歷史年表的換算。本站採常見年代的約數作閱讀定位，<strong>不是教會統一年表，也不是精確到年的聖經原文</strong>。</p><p>王國分裂約主前931/930年；北國滅亡約722/721年；猶大聖殿被毀約587/586年。頁面採930、722與586作定位。掃羅、大衛、所羅門的絕對年代尤其屬概略重建。</p><p>共治、登基年是否算第一年、曆年起點不同，都會影響年數。條目保留聖經的任期，另列主前年份；兩者不可直接相減驗算。約坦、比加、希西家等還有較複雜的起算爭議，已在個別條目說明。</p><p>時間軸是<strong>按登基約年排序的事件軸</strong>。列距不是年數比例；同列不代表同時退位。涉及共治者，卡片年代可能重疊。</p><p>教會《列王略傳導讀》使用北國亡於721年；其他君王文章亦見不同約年。本站將差異保留於說明，不強稱各來源完全一致。</p><p class="source-footnote">年代補充核對：<a href="https://en.wikipedia.org/wiki/The_Mysterious_Numbers_of_the_Hebrew_Kings" target="_blank" rel="noopener noreferrer">Thiele年表整理（非教會資料）</a>。此連結僅輔助比較年代，不作信仰評語依據。</p></article>
<article class="source-section"><h3>幾個容易讀錯的地方</h3><ul><li><strong>同名不同人：</strong>南北國的約蘭、亞哈謝、約阿施、約哈斯都分開；亞撒利雅是烏西雅另一名，亞比央是亞比雅另一名。</li><li><strong>年齡文本差異：</strong>南國亞哈謝採王下8:26的22歲；約雅斤採王下24:8的18歲，並註明歷代志異文。掃羅登基年齡不作武斷推定。</li><li><strong>希西家25歲登基：</strong>29年是任期。相關講章的個別誤植不照抄。</li><li><strong>約雅斤時先掠器物：</strong>王下24:13不是整座聖殿已遭焚毀；焚殿在西底家末年（王下25:8–9）。</li><li><strong>城破、焚殿在同一年：</strong>西底家第十一年四月城破、五月焚殿，並非相隔八年。</li><li><strong>約坦「不入殿」：</strong>放在父親越權燒香的背景理解，不能直接寫成他從不敬拜。</li></ul><p>引用講章時，採取其與經文相符的查考要點；遇到誤植、推論或不同年表，以經文為優先並標示差別。</p></article>
<article class="source-section wide"><h3>聖經主要查考範圍</h3><p>以中文和合本名稱與章節為主。點選經文會開啟喜信聖經的相應首章，跨章段落請接續閱讀。</p><div class="source-list">${[
["撒母耳記上 8–31","立王、掃羅與大衛早年","撒上8"],["撒母耳記下 1–24","大衛統治、約、罪與家庭","撒下1"],["列王紀上 1–22","所羅門、國分裂與早期南北王","王上1"],["列王紀下 1–25","北國末期、猶大改革、被擄","王下1"],["歷代志上 10–29","掃羅結局、大衛與建殿預備","代上10"],["歷代志下 1–36","所羅門及南國敬拜、悔改與敗壞","代下1"],["先知書的時代背景","以賽亞、耶利米、何西阿、阿摩司等，依條目列出的段落查考","賽1"],["立王的律法與歷史的用意","申命記17章的王權界限；羅馬書15:4、哥林多前書10:11的鑑戒","申17"]
].map(([title,note,ref])=>`<div><a href="${escapeHTML(bibleURL(ref))}" target="_blank" rel="noopener noreferrer">${title} ↗</a><p>${note}</p></div>`).join("")}</div></article>
<article class="source-section wide"><h3>真耶穌教會參考文章 · ${SOURCES.length}篇</h3><p>以下為本次實際查閱的喜信網路家庭《靈糧集》文章。保留作者、篇名與原文連結，便於回到教會資料繼續查考。</p><div class="source-list">${SOURCES.map(s=>`<div><a href="${s.url}" target="_blank" rel="noopener noreferrer">${escapeHTML(s.title)} ↗</a><p>${escapeHTML(s.note)}</p><small>${escapeHTML(s.author)} · 《${s.collection}》 · 真耶穌教會臺灣總會</small></div>`).join("")}</div><p class="source-footnote">資料查閱：2026年9月。本站未逐字重製講章；人物摘要、排列、標示與省思均為本次查經整理。</p></article>
</div>`;
}
function showView(view){
 currentView=["timeline","directory","sources"].includes(view)?view:"timeline";
 document.querySelectorAll(".view").forEach(el=>{el.hidden=el.id!==currentView+"-view";});
 document.querySelectorAll("[data-view]").forEach(el=>{if(el.dataset.view===currentView)el.setAttribute("aria-current","page");else el.removeAttribute("aria-current");});
 if(currentView!=="timeline")document.title=(currentView==="directory"?"列王總覽":"查考依據")+"｜聖經列王誌";
}
function routeHash(){const hash=location.hash.slice(1);if(hash.startsWith("king/")){const id=hash.slice(5);showView("timeline");renderKing(KINGS.some(k=>k.id===id)?id:"david");}else{showView(hash||"timeline");if(currentView==="timeline")renderKing(selectedKing);}}
function selectKing(id){
 if(!KINGS.some(k=>k.id===id))return;
 const fromOtherView=currentView!=="timeline";
 showView("timeline");renderKing(id);
 history.pushState(null,"","#king/"+id);
 const panel=document.getElementById("king-detail");
 if(matchMedia("(max-width: 860px)").matches)panel.scrollIntoView({behavior:"auto",block:"start"});
 else if(fromOtherView)document.querySelector(".atlas-layout").scrollIntoView({behavior:"auto",block:"start"});
 panel.focus({preventScroll:true});
}
document.addEventListener("click",event=>{
 const kingButton=event.target.closest("[data-king]");if(kingButton){selectKing(kingButton.dataset.king);return;}
 const yearButton=event.target.closest("[data-year]");if(yearButton){const row=document.getElementById("year-"+yearButton.dataset.year);const timeline=document.getElementById("timeline");if(row)timeline.scrollTo({top:row.getBoundingClientRect().top-timeline.getBoundingClientRect().top+timeline.scrollTop,behavior:matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth"});return;}
 const back=event.target.closest("[data-back-timeline]");if(back){document.querySelector(".timeline-panel").scrollIntoView({behavior:"auto",block:"start"});const selected=document.querySelector(`#timeline [data-king="${selectedKing}"]`);if(selected){selected.scrollIntoView({behavior:"auto",block:"nearest"});selected.focus({preventScroll:true});}return;}
 const nav=event.target.closest('a[href="#timeline"],a[href="#directory"],a[href="#sources"]');if(nav){event.preventDefault();const view=nav.getAttribute("href").slice(1);history.pushState(null,"","#"+view);showView(view);document.getElementById(view+"-view").scrollIntoView({behavior:"auto",block:"start"});}
});
window.addEventListener("hashchange",routeHash);
window.addEventListener("popstate",routeHash);
renderTimeline();renderDirectory();renderSources();routeHash();

/* 循環路徑複習 | 原創 SVG／純前端／離線可用；生理數據皆為概念示意 */
(() => {
'use strict';
const $ = id => document.getElementById(id);
const names = ['左心室','大動脈','各器官動脈','組織微血管','各器官靜脈','大靜脈','右心房','右心室','肺動脈','肺部微血管','肺靜脈','左心房'];
const cycle = [0,1,2,3,4,5,6,7,8,9,10,11,0];
// A route step may illuminate several branching SVG path elements.
const routeSegments = [[0],[1],[2],[3],[4],[5],[6],[7],[8,9],[10],[11],[12]];
const distractors = [[7,6,11],[2,5,8],[4,9,6],[2,8,5],[1,10,8],[11,7,3],[11,0,1],[10,5,1],[10,3,2],[8,11,3],[6,8,0],[7,1,10]];
const explanations = {
  0:'左心室將血液送入大動脈，進入體循環。',
  1:'大動脈會分支，將血液輸送到不同器官。',
  2:'動脈逐級分支後，血液進入組織微血管進行物質交換。',
  3:'血液離開組織微血管後，匯入靜脈系統。',
  4:'來自各器官的靜脈血，逐步匯入大靜脈。',
  5:'體循環回流的血液先進入右心房。',
  6:'右心房的血液經房室瓣流入右心室。',
  7:'右心室將血液送入肺動脈。注意：肺動脈主要運送含氧較低的血液。',
  8:'肺部微血管與肺泡進行氣體交換，使血液含氧量提高。',
  9:'交換後的血液匯入肺靜脈。注意：肺靜脈運送含氧較高的血液。',
  10:'肺靜脈將血液送回左心房。',
  11:'左心房的血液流入左心室，完成完整的循環路徑。'
};
const state = { mode: 'integrated', step: 0, errors: 0, hint: false, candidates: [], advancedTab: 'double', bossStep: 0, bossSelected: [null,null] };
const bossSystem = [0,1,3,5,6], bossPulmonary = [7,8,9,10,11];
const tabDefs = [ ['double','雙循環同步'],['o2','血氧'],['bp','血壓'],['vel','血流速度'] ];
let errorTimer = null;

function shuffle(items) { const out = items.slice(); for(let i=out.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[out[i],out[j]]=[out[j],out[i]];} return out; }
function getChoices(){if(state.step>=12)return[];const target = cycle[state.step+1];return shuffle([target,...distractors[state.step]]);}
function setMessage(msg, warn=false){const e=$('message');e.textContent=msg;e.classList.toggle('warn',warn);}
function setMode(mode){
  state.mode=mode; state.hint=false; $('hint-names').checked=false;
  document.body.classList.remove('mode-text','mode-image','mode-integrated','hints-on');
  document.body.classList.add('mode-'+mode);
  document.querySelectorAll('[data-mode]').forEach(b=>{b.classList.toggle('active',b.dataset.mode===mode);b.setAttribute('aria-pressed',String(b.dataset.mode===mode));});
  updateUI();
}
function reset(){state.step=0;state.errors=0;setMessage('從左心室出發，選出血液流經的下一個構造。');updateUI();}
function updateUI(){
  const complete=state.step>=12;
  $('progress').textContent=`${state.step} / 12`;
  $('progress-bar').style.width = `${state.step/12*100}%`;
  $('question-label').textContent=complete?'路徑挑戰完成':'完整循環｜第 '+(state.step+1)+' 步';
  $('question-title').textContent=complete?'完整循環，成功接回左心室！':`目前位置：${names[cycle[state.step]]}`;
  $('question-desc').textContent=complete?'你已完成一次閉合的循環路徑。可切換模式再練，或到進階挑戰探索。':state.mode==='image'?'直接點選左側圖中代表「下一站」的 A～D 位置。':state.mode==='text'?'請只根據構造名稱，選出血液的下一站。':'選擇下一個構造，觀察名稱與圖上位置如何連結。';
  $('mode-guide').textContent=state.mode==='image'?'請點圖中的 A～D 標記':state.mode==='text'?'這個模式先練熟名稱順序':'構造將隨答題逐步亮起';
  renderMap();renderOptions();renderTrail();
}
function renderMap(){
  const visited=new Set(cycle.slice(0,Math.min(state.step+1,cycle.length)));
  const current=cycle[Math.min(state.step,11)];
  for(let i=0;i<13;i++){
    const e=$('edge-'+i);if(e)e.classList.toggle('done',routeSegments.slice(0,state.step).flat().includes(i));
  }
  const isImage = state.mode==='image' && state.step<12;
  if(isImage){state.candidates=getChoices();}else{state.candidates=[];}
  const lookups=state.candidates;
  for(let i=0;i<12;i++){
    const g=$('node-'+i);if(!g)continue;
    g.classList.toggle('seen',visited.has(i));
    g.classList.toggle('current',state.step<12 && i===current);
    g.classList.toggle('candidate',isImage && lookups.includes(i));
    g.classList.remove('wrong');
    const letter=g.querySelector('.candidate-letter');
    if(letter)letter.textContent=isImage && lookups.includes(i)?String.fromCharCode(65+lookups.indexOf(i)):'';
  }
  document.body.classList.toggle('hints-on',state.hint && isImage);
  $('map-caption').textContent='原創結構示意圖：用於學習血流方向，非依比例繪製的實際解剖圖。';
}
function renderOptions(){
  const box=$('options');box.textContent='';
  if(state.step>=12){
    box.style.display='flex';box.style.flexDirection='column';box.style.justifyContent='center';box.style.gap='10px';
    const win=document.createElement('div');win.className='success';win.innerHTML='<h3>🎉 完成完整循環！</h3><div>血液已回到左心室。這次的練習包含了體循環與肺循環，沒有中途斷開。</div>';
    const again=document.createElement('button');again.className='primary';again.textContent='再練一次';again.addEventListener('click',reset);
    const adv=document.createElement('button');adv.className='quiet-btn';adv.textContent='探索進階挑戰';adv.addEventListener('click',()=>{const a=$('advanced');a.open=true;a.scrollIntoView({behavior:'smooth',block:'start'});});
    win.append(again,adv);box.append(win);return;
  }
  box.style.display='grid';box.style.flexDirection='';box.style.justifyContent='';box.style.gap='';
  if(state.mode==='image'){
    const guide=document.createElement('div');guide.style.cssText='grid-column:1/-1;align-self:center;text-align:center;color:#65829a;font-weight:850;line-height:1.9;font-size:19px;';
    guide.innerHTML='👆 請直接點選左側示意圖的 A、B、C、D<br><span style="font-size:13px;color:#94a2b1">圖上的四個圓圈是本題候選位置，不代表血液的先後順序。</span>';
    box.append(guide);return;
  }
  const choices=getChoices();
  choices.forEach(id=>{
    const b=document.createElement('button');b.className='choice';b.textContent=names[id];b.dataset.answer=String(id);
    b.addEventListener('click',()=>answer(id,b));box.append(b);
  });
}
function renderTrail(){
  const box=$('trail');box.textContent='';
  const count=Math.min(state.step+1,13);
  for(let i=0;i<count;i++){
    if(i){const sep=document.createElement('span');sep.textContent='→';sep.className='sep';box.append(sep);}
    const chip=document.createElement('span');chip.className='chip';chip.textContent=names[cycle[i]];box.append(chip);
  }
  box.scrollTop=box.scrollHeight;
}
function answer(id,btnOrNode){
  if(state.step>=12)return;
  const right=cycle[state.step+1];
  if(id===right){
    const old=state.step;
    state.step++;
    setMessage(explanations[old]);
    updateUI();
  }else{
    state.errors++;
    const item=btnOrNode || $('node-'+id);
    if(item){item.classList.add('wrong');if(errorTimer)clearTimeout(errorTimer);errorTimer=setTimeout(()=>item.classList.remove('wrong'),520);}
    setMessage('這個構造不是血液的下一站。再觀察目前位置與流向，試一次！',true);
  }
}
function onMapClick(e){
  if(state.mode!=='image'||state.step>=12)return;
  const node=e.target.closest('[data-node]');if(!node)return;
  const id=Number(node.dataset.node);
  if(state.candidates.includes(id))answer(id,node);
}
const physiology = {
  o2:{title:'血氧變化：在兩組微血管進行交換',color:'#d95169',values:[90,90,90,78,30,30,30,30,30,62,90,90,90],desc:'概念示意：全身組織處氧氣由血液進入細胞；肺部微血管處氧氣由肺泡進入血液。'},
  bp:{title:'血壓變化：左心室與大動脈較高',color:'#8e67c8',values:[88,85,72,45,22,11,8,36,32,18,12,9,88],desc:'概念示意：體循環動脈壓較高，經微血管與靜脈逐漸降低；肺循環的壓力整體較體循環低。心臟腔室壓力會隨心搏週期改變。'},
  vel:{title:'流速變化：微血管處較慢',color:'#229b92',values:[70,82,64,18,42,53,60,65,69,18,42,48,70],desc:'概念示意：毛細血管的「總橫截面積」很大，因此平均流速相對較慢；不是單看某一條血管的直徑。'}
};
function renderChart(type){
 const data=physiology[type];const box=$('advanced-content');box.innerHTML='';
 const title=document.createElement('h3');title.textContent=data.title;
 const desc=document.createElement('p');desc.textContent=data.desc;
 const extra=document.createElement('p');extra.style.color='#ae5364';extra.style.fontWeight='850';extra.textContent='※ 此圖只有相對變化方向，沒有實測數值、單位或時間軸，不能直接作為臨床數據。';
 const chart=document.createElement('div');chart.className='chart-wrap';
 const points=data.values.map((v,i)=>[44+i*66,190-v*1.35]);
 const poly=points.map(p=>p.join(',')).join(' ');
 const lines=[25,65,105,145,185].map(y=>`<line x1="44" y1="${y}" x2="840" y2="${y}" stroke="#e4ebf0" stroke-dasharray="4 5"/>`).join('');
 const dots=points.map(([x,y],i)=>`<circle cx="${x}" cy="${y}" r="${i===0||i===12?6:4}" fill="#fff" stroke="${data.color}" stroke-width="3"/>`).join('');
 const xs=cycle.map((node,i)=>`<text x="${44+i*66}" y="225" transform="rotate(-42 ${44+i*66} 225)" font-size="10" fill="#7890a5">${names[node].replace('各器官','').replace('部','')}</text>`).join('');
 chart.innerHTML=`<svg viewBox="0 0 900 300" role="img" aria-label="${data.title}（相對趨勢示意）"><text x="44" y="15" font-size="13" font-weight="800" fill="#70859b">相對高低 ↑</text>${lines}<polyline points="${poly}" fill="none" stroke="${data.color}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"/>${dots}${xs}</svg>`;
 box.append(title,desc,chart,extra);
}
function renderAdvanced(){
  const tabs=$('advanced-tabs');tabs.textContent='';
  tabDefs.forEach(([id,label])=>{const btn=document.createElement('button');btn.className='advanced-tab'+(state.advancedTab===id?' active':'');btn.textContent=label;btn.addEventListener('click',()=>{state.advancedTab=id;renderAdvanced();});tabs.append(btn);});
  if(state.advancedTab==='double')renderBoss();else renderChart(state.advancedTab);
}
function renderBoss(){
  const box=$('advanced-content');box.textContent='';
  const h=document.createElement('h3');h.textContent='雙循環同步挑戰';
  const p=document.createElement('p');p.textContent='同時推理體循環與肺循環的下一站。兩邊都選好後再確認；此挑戰不會改動主要練習的進度。';
  box.append(h,p);
  if(state.bossStep>=4){const win=document.createElement('div');win.className='success';win.innerHTML='<h3>雙循環挑戰完成！</h3><div>兩條路徑同步前進，分別連結心臟與全身組織、肺部。</div>';const again=document.createElement('button');again.className='primary';again.textContent='再挑戰一次';again.onclick=()=>{state.bossStep=0;state.bossSelected=[null,null];renderBoss();};win.append(again);box.append(win);return;}
  const stage=document.createElement('div');stage.className='boss-grids';
  [0,1].forEach(side=>{
    const arr=side===0?bossSystem:bossPulmonary;const section=document.createElement('section');
    const title=document.createElement('h4');title.style.color=side===0?'#d74f65':'#3d84bd';title.textContent=(side===0?'體循環':'肺循環')+'：目前 '+names[arr[state.bossStep]];
    const options=document.createElement('div');options.className='boss-options';
    const goal=arr[state.bossStep+1];
    const pool=side===0?[1,3,5,6]:[8,9,10,11];
    pool.forEach(id=>{const btn=document.createElement('button');btn.textContent=names[id];btn.classList.toggle('selected',state.bossSelected[side]===id);btn.onclick=()=>{state.bossSelected[side]=id;renderBoss();};options.append(btn);});
    section.append(title,options);stage.append(section);
  });box.append(stage);
  const foot=document.createElement('div');foot.className='boss-foot';const confirm=document.createElement('button');confirm.className='primary';confirm.textContent='確認兩條路徑';confirm.disabled=state.bossSelected.some(x=>x===null);
  const note=document.createElement('span');note.className='smallprint';note.id='boss-feedback';note.textContent=`目前第 ${state.bossStep+1} / 4 組`;foot.append(confirm,note);box.append(foot);
  confirm.onclick=()=>{
    if(state.bossSelected[0]===bossSystem[state.bossStep+1]&&state.bossSelected[1]===bossPulmonary[state.bossStep+1]){
      state.bossStep++;state.bossSelected=[null,null];renderBoss();
    }else{note.textContent='至少有一條路徑不正確，請重新推理。';note.style.color='#d55262';}
  };
}
async function updateOfflineStatus(){
  const badge=$('offline-badge');
  const online=navigator.onLine;
  if(!('serviceWorker'in navigator)||!('caches'in window)){badge.textContent=online?'需網路':'目前離線';return;}
  let ready=false;try{const cache=await caches.open('blood-2d-v1');const keys=await cache.keys();ready=keys.length>=6;}catch(_){}
  badge.textContent=ready?(online?'✓ 可離線使用':'✓ 離線可用'):(online?'⟳ 離線資料準備中':'尚未完成離線快取');
  badge.style.color=ready?'#297b66':'#8b7282';
}
function init(){
  document.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener('click',()=>setMode(b.dataset.mode)));
  $('reset-btn').addEventListener('click',reset);
  $('circulation-map').addEventListener('click',onMapClick);
  $('hint-names').addEventListener('change',e=>{state.hint=e.target.checked;document.body.classList.toggle('hints-on',state.hint);});
  $('advanced').addEventListener('toggle',()=>{if($('advanced').open)renderAdvanced();});
  setMode('integrated');setMessage('從左心室出發，選出血液流經的下一個構造。');
  if('serviceWorker'in navigator && location.protocol.startsWith('http')){
    navigator.serviceWorker.register('./sw.js').then(()=>setTimeout(updateOfflineStatus,1100)).catch(updateOfflineStatus);
    navigator.serviceWorker.addEventListener('controllerchange',updateOfflineStatus);
  }
  window.addEventListener('online',updateOfflineStatus);window.addEventListener('offline',updateOfflineStatus);
  updateOfflineStatus();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();

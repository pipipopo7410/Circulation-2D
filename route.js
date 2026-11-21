/* Blood2D integrated 2.1 — route questions and evidence graphs on the same SVG circulation model. */
(()=>{
'use strict';
const api=window.__circulationQA;
if(!api){console.error('Circulation model is missing');return;}
const $=id=>document.getElementById(id),ns='http://www.w3.org/2000/svg';
const app=document.querySelector('.app'),stage=$('stage'),overlay=$('routeOverlay');
const status=$('routeMessage'),note=$('routeNote'),answers=$('routeAnswers'),nextBtn=$('scenarioNext'),task=$('routeTask');
const graphs=$('routeGraphs'),progress=$('routeProgress'),counter=$('routeCount');
const sceneTitle=$('scenarioTitle'),sceneDetail=$('scenarioDetail'),sceneLoc=$('scenarioLoc');
const wordBoard=$('routeWordBoard'),wordTrail=$('routeWordTrail'),wordOptions=$('routeWordOptions');
const svg=(tag,attrs={},parent)=>{const e=document.createElementNS(ns,tag);for(const [k,v] of Object.entries(attrs))e.setAttribute(k,String(v));if(parent)parent.appendChild(e);return e;};
const edge=id=>api.edges.get(id);
const MAIN={
 lv_out:['lv-aorta','aorta-up'],upper_a:['aorta-head'],lower_a:['aorta-down'],abd_a:['aorta-abd'],leg_a:['aorta-leg'],
 upper_v:['upper-v','upper-ra'],abd_v:['lower-v'],leg_v:['leg-v'],lower_v:['venous-trunk','lower-ra'],
 ra_rv:['ra-rv'],rv_pul:['rv-pulmonary'],pul_r_a:['p-left'],pul_l_a:['p-right'],
 pul_r_v:['left-pv'],pul_l_v:['right-pv'],la_lv:['la-lv']
};
const BEDS={upper_c:'head-bed',abd_c:'abd-bed',leg_c:'leg-bed',pul_r_c:'left-lung-bed',pul_l_c:'right-lung-bed'};
// 由早期「圖片點選、圖片＋文字、文字連結」三種練法恢復而來。
// 三階段使用完全相同的血流拓撲，僅改變學生作答時看見的資訊。
const LEVELS=['paired','visual','words'];
const LEVEL_NAMES={visual:'圖示',paired:'圖＋文',words:'文字'};
const ROUTE_WORDS={
 la_lv:'左心房 → 左心室',lv_out:'左心室 → 主動脈',
 upper_a:'主動脈 → 上半身動脈',upper_c:'上半身微血管',upper_v:'上大靜脈 → 右心房',
 lower_a:'主動脈 → 下行主動脈',abd_a:'腹腔小動脈',abd_c:'小腸微血管',abd_v:'腹腔靜脈',
 leg_a:'下肢小動脈',leg_c:'下肢微血管',leg_v:'下肢小靜脈',lower_v:'下大靜脈 → 右心房',
 ra_rv:'右心房 → 右心室',rv_pul:'右心室 → 肺動脈',
 pul_r_a:'肺動脈 → 右肺',pul_l_a:'肺動脈 → 左肺',
 pul_r_c:'右肺微血管',pul_l_c:'左肺微血管',
 pul_r_v:'右肺靜脈 → 左心房',pul_l_v:'左肺靜脈 → 左心房'
};

const RED='#d75e64',DARK='#784544';
const rkind={};
for(const id of Object.keys(MAIN))rkind[id]=['lv_out','upper_a','lower_a','abd_a','leg_a','pul_r_v','pul_l_v','la_lv'].includes(id)?'red':'blue';
for(const id of Object.keys(BEDS))rkind[id]=id.startsWith('pul_')?'lung':'tissue';
const PRESET={
 upper:['la_lv','lv_out','upper_a','upper_c','upper_v','ra_rv','rv_pul','pul_r_a','pul_r_c','pul_r_v'],
 lower:['la_lv','lv_out','lower_a','leg_a','leg_c','leg_v','lower_v','ra_rv','rv_pul','pul_r_a','pul_r_c','pul_r_v']
};
const MISSIONS=[
 {id:'m01',title:'💪 上臂的血液要抵達腹部',detail:'血液從上半身靜脈回流後，如何經過心肺到達腹腔？',organ:'none',from:'上半身靜脈',to:'腹腔微血管出口',steps:['upper_v','ra_rv','rv_pul','pul_r_a','pul_r_c','pul_r_v','la_lv','lv_out','lower_a','abd_a','abd_c']},
 {id:'m02',title:'💊 吃頭痛藥之後',detail:'藥物經腸道吸收且已進入體循環；從腹部回流的血，如何再抵達頭部？',organ:'intestine',from:'腹腔靜脈',to:'上半身微血管出口',steps:['abd_v','lower_v','ra_rv','rv_pul','pul_r_a','pul_r_c','pul_r_v','la_lv','lv_out','upper_a','upper_c']},
 {id:'m03',title:'🏃 跑步時的腿部供氧',detail:'從左心室出發，含氧較多的血液如何到達腿部微血管？',organ:'none',from:'左心室',to:'下肢微血管出口',steps:['lv_out','lower_a','leg_a','leg_c']},
 {id:'m04',title:'🌬️ 肺部交換',detail:'右心室射出的血液，如何經肺部回到左心房？',organ:'none',from:'右心室',to:'左心房',steps:['rv_pul','pul_r_a','pul_r_c','pul_r_v']},
 {id:'m05',title:'🍚 飯後腸道供血',detail:'血液從肺靜脈出發，如何到達腹部的消化器官微血管？',organ:'intestine',from:'右肺靜脈',to:'腹腔微血管出口',steps:['pul_r_v','la_lv','lv_out','lower_a','abd_a','abd_c']},
 {id:'m06',title:'🧪 肝臟與含氮廢物',detail:'沿腸道回流路線，觀察肝臟處理氨後的變化。',organ:'liver',from:'左心室',to:'左心房',steps:['lv_out','lower_a','abd_a','abd_c','abd_v','lower_v','ra_rv','rv_pul','pul_r_a','pul_r_c','pul_r_v']},
 {id:'m07',title:'💉 接種疫苗後的手臂',detail:'接種後，手臂流出的血如何經過心肺回到左心房？',organ:'none',from:'上半身小動脈',to:'左心房',steps:['upper_a','upper_c','upper_v','ra_rv','rv_pul','pul_r_a','pul_r_c','pul_r_v']},
 {id:'m08',title:'🚶 腳部運動後',detail:'下肢小動脈的血液流經肌肉後，如何回到右心房？',organ:'none',from:'下肢小動脈',to:'右心房',steps:['leg_a','leg_c','leg_v','lower_v']},
 {id:'m09',title:'🍞 午餐之後',detail:'追蹤血液從左心房經過腹部組織再回到右心房；觀察葡萄糖在腸道吸收時的變化。',organ:'intestine',from:'左心房',to:'右心房',steps:['la_lv','lv_out','lower_a','abd_a','abd_c','abd_v','lower_v']},
 {id:'m10',title:'🫁 吸入氧氣之後',detail:'肺部微血管的血液完成氣體交換後，如何抵達左心室？',organ:'none',from:'右肺微血管入口',to:'左心室',steps:['pul_r_c','pul_r_v','la_lv']},
 {id:'m11',title:'🏀 打球後的上半身血液',detail:'從上半身靜脈回流的血，經過哪些路徑進入左心房？',organ:'none',from:'上半身靜脈',to:'左心房',steps:['upper_v','ra_rv','rv_pul','pul_r_a','pul_r_c','pul_r_v']},
 {id:'m12',title:'🧗 爬樓梯以後',detail:'小腿肌肉流出的血液，經過心肺後如何返回左心房？',organ:'none',from:'下肢靜脈',to:'左心房',steps:['leg_v','lower_v','ra_rv','rv_pul','pul_r_a','pul_r_c','pul_r_v']},
 {id:'m13',title:'🫁 二氧化碳排出',detail:'從右心房出發，經過任一側肺部交換氣體後，如何回到左心房？',organ:'none',from:'右心房',to:'左心房',steps:['ra_rv','rv_pul','pul_l_a','pul_l_c','pul_l_v']},
 {id:'m14',title:'🏃 脚底需要氧氣',detail:'左心房中的血液，如何經過心室抵達腳底組織？',organ:'none',from:'左心房',to:'下肢微血管出口',steps:['la_lv','lv_out','lower_a','leg_a','leg_c']},
 {id:'m15',title:'🔬 肝臟處理廢物後',detail:'當含氮廢物已在肝臟轉換，血液從腹部回流，如何經肺回到左心房？',organ:'liver',from:'腹腔微血管出口',to:'左心房',steps:['abd_v','lower_v','ra_rv','rv_pul','pul_r_a','pul_r_c','pul_r_v']},
 {id:'m16',title:'🚰 腎臟與尿素',detail:'在腎臟情境中，觀察血液經過微血管後如何回心臟。',organ:'kidney',from:'左心室',to:'右心房',steps:['lv_out','lower_a','leg_a','leg_c','leg_v','lower_v']},
 {id:'m17',title:'🏃 下肢血液送回頭部',detail:'腳部的血液回流後，要再抵達頭部，會經過哪些心肺路徑？',organ:'none',from:'下肢微血管出口',to:'上半身微血管出口',steps:['leg_v','lower_v','ra_rv','rv_pul','pul_r_a','pul_r_c','pul_r_v','la_lv','lv_out','upper_a','upper_c']},
 {id:'m18',title:'🍎 消化器官需要氧氣',detail:'從右心室出發，血液如何先經過肺，再流向腹部微血管？',organ:'none',from:'右心室',to:'腹腔微血管出口',steps:['rv_pul','pul_l_a','pul_l_c','pul_l_v','la_lv','lv_out','lower_a','abd_a','abd_c']}
];

const MATS={
 o2:{name:'氧氣',color:'#ed6997',initialRed:80,initialBlue:28},
 co2:{name:'二氧化碳',color:'#9471d4',initialRed:24,initialBlue:77},
 glucose:{name:'葡萄糖',color:'#d49b3a',initialRed:59,initialBlue:58,plotMin:35,plotMax:90},
 ammonia:{name:'氨',color:'#648fc2',initialRed:19,initialBlue:19,plotMin:0,plotMax:35},
 urea:{name:'尿素',color:'#a55caf',initialRed:49,initialBlue:50}
};
const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
const kinds={};
for(const id of Object.keys(MAIN))kinds[id]=['lv_out','upper_a','lower_a','abd_a','leg_a','pul_r_v','pul_l_v','la_lv'].includes(id)?'red':'blue';
for(const id of Object.keys(BEDS))kinds[id]=id.startsWith('pul_')?'lung':'tissue';
const routes={};let visuals,hits,pulse,dot,hintPath,startPin,endPin,organLayer;
const S={active:false,mode:'upper',level:'paired',levelPassed:{upper:0,lower:0},nextLevel:null,steps:[],step:0,phase:'intro',run:0,demo:false,mission:null,deck:[],lastMission:null,
 missed:[],wrong:false,errors:0,values:[],events:[],materials:['o2','co2']};
window.BloodRoute={get active(){return S.active},state:S,tryRoute:attempt,setMode,allRoutes:routes,missions:MISSIONS};
function edgeGroup(prefix){return (api.bedGroups.find(b=>b.prefix===prefix)?.ids||[]).map(edge).filter(Boolean);}
function getMainPath(id){return (MAIN[id]||[]).map(edge).filter(Boolean);}
function traceMesh(prefix){
 const parts=edgeGroup(prefix),first=parts.find(p=>!p.from.startsWith(prefix+'-node')&&p.to.endsWith('-2'))||parts.find(p=>!p.from.startsWith(prefix+'-node'));
 if(!first)return [];
 const result=[first],visited=new Set([first.id]);let node=first.to;
 while(node.includes('-node-')&&result.length<80){
  const options=parts.filter(p=>p.from===node&&!visited.has(p.id));
  const chosen=options.find(p=>p.to.endsWith('-2'))||options[0];
  if(!chosen)break;
  result.push(chosen);visited.add(chosen.id);node=chosen.to;
 }
 return result;
}
function buildOverlay(){
 // Colored route traces share the same SVG centerlines with the observation mode.
 const defs=svg('defs',{},overlay);
 for(const [id,props,fromColor,toColor] of [
   ['routeBodyOxygen',{x1:650,y1:0,x2:470,y2:0},'#eb657c','#895063'],
   ['routeLungOxygen',{x1:0,y1:252,x2:0,y2:415},'#895063','#eb657c']
 ]){
   const grad=svg('linearGradient',{id,gradientUnits:'userSpaceOnUse',...props},defs);
   svg('stop',{offset:'0%', 'stop-color':fromColor},grad);
   svg('stop',{offset:'100%','stop-color':toColor},grad);
 }
 organLayer=svg('g',{id:'routeOrganGuides',class:'organ-guide'},overlay);
 visuals=svg('g',{id:'routeChosenPaths'},overlay);
 hintPath=svg('g',{id:'routeHintPaths'},overlay);
 hits=svg('g',{id:'routeTouchPaths'},overlay);
 for(const id of Object.keys({...MAIN,...BEDS})){
  const bed=BEDS[id],parts=bed?edgeGroup(bed):getMainPath(id);
  routes[id]={id,parts,track:bed?traceMesh(bed):parts,kind:kinds[id]};
  for(const part of parts){
   const hit=svg('path',{d:part.d,class:'route-hit'+(bed?' route-cap-hit':''),'data-route':id,'aria-label':part.id,tabindex:'-1'},hits);
   hit.addEventListener('click',ev=>{
    ev.stopPropagation();
    let clicked=id;
    if(S.phase==='route'){
     const expected=S.steps[S.step],related=routes[expected]?.parts||[];
     if(related.some(x=>x.id===part.id))clicked=expected;
     else{
      const rect=stage.getBoundingClientRect(),st=api.state;
      const x=(ev.clientX-rect.left-st.panX)/st.zoom,y=(ev.clientY-rect.top-st.panY)/st.zoom;
      let near=Infinity;
      for(const seg of related)for(let k=0;k<=seg.sampleN;k++)near=Math.min(near,Math.hypot(x-seg.sampleX[k],y-seg.sampleY[k]));
      if(near<11)clicked=expected;
     }
    }
    attempt(clicked);
   });
  }
 }
 pulse=svg('circle',{r:11,class:'route-marker'},overlay);
 dot=svg('circle',{r:8,fill:'#ffd169',stroke:'#fff','stroke-width':3,'pointer-events':'none'},overlay);
 dot.setAttribute('visibility','hidden');
 startPin=svg('g',{'pointer-events':'none'},overlay);
 endPin=svg('g',{'pointer-events':'none'},overlay);
}
function routeTrack(id){return routes[id]?.track||[];}
function startPoint(id){const p=routeTrack(id)[0];return p?.el.getPointAtLength(0)||{x:550,y:350};}
function endPoint(id){const t=routeTrack(id),p=t[t.length-1];return p?.el.getPointAtLength(p.length)||{x:550,y:350};}
function paintFlag(group,p,label,color){
 group.replaceChildren();
 // The small dot marks the EXACT path endpoint. The readable label floats above it,
 // so the Chinese characters do not hide the vessel junction or intercept clicks.
 svg('circle',{cx:p.x,cy:p.y,r:5.2,fill:color,stroke:'#fff','stroke-width':2.5},group);
 svg('path',{d:`M ${p.x} ${p.y-6} L ${p.x} ${p.y-14}`,fill:'none',stroke:color,'stroke-width':1.5,'stroke-linecap':'round',opacity:'.9'},group);
 const start=p.x-23,top=p.y-36;
 svg('rect',{x:start,y:top,width:46,height:22,rx:10,fill:'#fffaff',stroke:color,'stroke-width':2,opacity:'.97',...(label==='終點'?{class:'route-end-pill'}:{})},group);
 const text=svg('text',{x:p.x,y:top+15.0,'text-anchor':'middle',fill:'#704785',class:'route-pin-label'},group);text.textContent=label;
}
function showMarkers(){
 if(!S.active||!S.steps.length){pulse.setAttribute('visibility','hidden');return;}
 paintFlag(startPin,startPoint(S.steps[0]),'起點','#efb65b');
 paintFlag(endPin,endPoint(S.steps[S.steps.length-1]),'終點','#945cc7');
 const current=S.step>=S.steps.length?null:S.step>0?endPoint(S.steps[S.step-1]):startPoint(S.steps[0]);
 if(!current){pulse.setAttribute('visibility','hidden');return;}
 pulse.setAttribute('cx',current.x);pulse.setAttribute('cy',current.y);pulse.setAttribute('visibility',S.phase==='route'?'visible':'hidden');
}
function clearOverlay(){visuals.replaceChildren();hintPath.replaceChildren();dot.setAttribute('visibility','hidden');}
function pendingMission(){
 for(const m of S.missed)m.wait--;
 const i=S.missed.findIndex(x=>x.wait<=0&&x.id!==S.lastMission);
 if(i>=0){const [retry]=S.missed.splice(i,1);const m=MISSIONS.find(x=>x.id===retry.id);S.lastMission=m.id;return m;}
 if(!S.deck.length){S.deck=MISSIONS.map(x=>x.id);for(let i=S.deck.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[S.deck[i],S.deck[j]]=[S.deck[j],S.deck[i]];}
  if(S.deck[0]===S.lastMission&&S.deck.length>1)S.deck.reverse();}
 const id=S.deck.shift();S.lastMission=id;return MISSIONS.find(m=>m.id===id);
}
function currentOrgan(){return S.mode==='challenge'?(S.mission?.organ||'none'):'none';}
function renderEndpoints(from,to){
 sceneLoc.replaceChildren();
 const a=document.createElement('span');a.className='endpoint-chip';a.textContent=from;
 const arrow=document.createElement('span');arrow.className='endpoint-arrow';arrow.textContent='→';arrow.setAttribute('aria-hidden','true');
 const b=document.createElement('span');b.className='endpoint-chip';b.textContent=to;
 sceneLoc.append(a,arrow,b);
}
function setNarrative(){
 if(S.mode==='challenge'){
  sceneTitle.textContent=S.mission.title;
  sceneDetail.textContent=S.mission.detail;
  renderEndpoints(S.mission.from,S.mission.to);
 }else{
  const upper=S.mode==='upper';
  sceneTitle.textContent=upper?'血液經過頭部，再回到心臟':'血液經過腳底，再回到心臟';
  sceneDetail.textContent=upper?'沿上半身循環與肺循環，完成一圈。':'沿下半身循環與肺循環，完成一圈。';
  renderEndpoints('左心房','左心房');
 }
 task.textContent='';
}
function initialValues(){
 const startsRed=kinds[S.steps[0]]==='red'||kinds[S.steps[0]]==='tissue';
 const x={};for(const [k,m] of Object.entries(MATS))x[k]=startsRed?m.initialRed:m.initialBlue;
 // 情境起點已在肝臟處理後：不是在這條血管路徑中重新做一次尿素循環。
 if(S.mode==='challenge'&&S.mission.id==='m15'){x.ammonia=9;x.urea=76;}
 if(S.mode==='challenge'&&S.mission.id==='m02'){x.glucose=76;}
 return x;
}
function updateSubstances(prev,id){
 const x={...prev},kind=kinds[id];let event='';
 if(kind==='lung'){x.o2+=48;x.co2-=43;event='肺部氣體交換';}
 else if(kind==='tissue'){
  x.o2-=43;x.co2+=37;x.glucose-=9;x.ammonia+=2;
  event=id==='upper_c'?'上半身':id==='leg_c'?'下方微血管':'小腸';
  if(id==='abd_c'&&currentOrgan()==='intestine'){
   x.glucose+=32;event='小腸吸收葡萄糖（示意）';
  }
  if(id==='leg_c'&&currentOrgan()==='kidney'){
   x.urea-=31;event='腎臟清除尿素（情境示意）';
  }
 }
 // Liver is indicated near the vena cava; this uses a relative-amount event,
 // not an invented portal vein or an independent new liver vascular network.
 if(id==='abd_v'&&currentOrgan()==='liver'&&S.mission?.id!=='m15'){
  x.ammonia-=20;x.urea+=28;event='肝臟將氨轉換為尿素（示意）';
 }
 for(const k of Object.keys(x))x[k]=Math.round(clamp(x[k],5,95));
 return {values:x,event};
}
// 圖文→圖示→純文字；先建立器官名稱，再逐步撤除支援。
function updateLevelUI(){
 document.querySelectorAll('.route-level').forEach(btn=>{
  const selected=btn.dataset.level===S.level;
  btn.classList.toggle('selected',selected);btn.setAttribute('aria-pressed',String(selected));
 });
 app.classList.toggle('route-icon-only',S.active&&S.level==='visual');
 app.classList.toggle('route-paired',S.active&&S.level==='paired');
 app.classList.toggle('route-words',S.active&&S.level==='words');
 // 純文字題仍保留情境與右側的圖表證據，但不顯示原本循環圖。
 wordBoard.hidden=!(S.active&&S.level==='words');
 renderWordPractice();
}
function wordOptionsFor(expected){
 if(!expected)return [];
 // 同一個肺循環可選右肺或左肺，兩者都是正確的連通路徑。
 const alt=expected==='pul_r_a'?'pul_l_a':expected==='pul_l_a'?'pul_r_a':null;
 const pool=Object.keys(ROUTE_WORDS).filter(id=>id!==expected&&id!==alt);
 // 每題提供血流上相近但不等同的選項，避免只有一個看起來相關。
 const i=(S.step*7+S.mode.length*3)%pool.length;
 const first=pool[i],second=pool[(i+11)%pool.length];
 const choices=alt?[expected,alt,first]:[expected,first,second];
 const shift=(S.step+3)%choices.length;
 return choices.slice(shift).concat(choices.slice(0,shift));
}
function renderWordPractice(){
 if(!wordBoard||!S.active||S.level!=='words')return;
 const shown=S.steps.slice(0,S.step);
 wordTrail.replaceChildren();
 const lead=document.createElement('span');lead.className='word-path-start';lead.textContent='起點';wordTrail.appendChild(lead);
 for(const id of shown){const chip=document.createElement('span');chip.className='word-path-chip';chip.textContent=ROUTE_WORDS[id]||id;wordTrail.appendChild(chip);}
 if(S.phase==='done'){
  const end=document.createElement('span');end.className='word-path-end';end.textContent='✓ 終點';wordTrail.appendChild(end);
 }
 wordOptions.replaceChildren();
 if(S.phase==='done'){
  const text=document.createElement('div');text.className='word-finished';text.textContent='已完成整段路徑！';wordOptions.appendChild(text);return;
 }
 if(S.phase==='intro'){
  const text=document.createElement('div');text.className='word-finished';text.textContent='按「開始挑戰」後選擇下一站';wordOptions.appendChild(text);return;
 }
 if(S.phase==='animating'){
  const text=document.createElement('div');text.className='word-finished';text.textContent='血液繼續前進…';wordOptions.appendChild(text);return;
 }
 for(const id of wordOptionsFor(S.steps[S.step])){
  const b=document.createElement('button');b.type='button';b.className='word-answer';b.textContent=ROUTE_WORDS[id];
  b.addEventListener('click',()=>attempt(id));wordOptions.appendChild(b);
 }
}
function setLevel(level){
 if(!LEVELS.includes(level)||level===S.level)return;
 S.level=level;
 setMode(S.mode);
}
function setMode(mode,newChallenge=false){
 if(!PRESET[mode]&&mode!=='challenge')return;
 S.run++;S.demo=false;S.mode=mode;
 if(mode==='challenge'&&(newChallenge||!S.mission))S.mission=pendingMission();
 S.steps=mode==='challenge'?[...S.mission.steps]:[...PRESET[mode]];
 S.step=0;S.phase=mode==='challenge'?'route':'intro';S.errors=0;S.wrong=false;S.nextLevel=null;S.values=[initialValues()];S.events=[];
 clearOverlay();setNarrative();showMarkers();drawOrganLabels();renderAll();
 answers.hidden=true;nextBtn.hidden=true;note.textContent='';
 status.textContent='';
 $('routeIntro').hidden=!(S.active && mode!=='challenge');
 $('introQuestion').textContent=mode==='upper'?'讓血液從左心房出發，經過頭部再回來。':'讓血液從左心房出發，經過腳底再回來。';
 document.querySelectorAll('.route-mode').forEach(b=>b.classList.toggle('selected',b.dataset.mode===mode));
 $('routeDemo').textContent='▶ 示範';updateLevelUI();
}
function renderProgress(){progress.replaceChildren();for(let i=0;i<S.steps.length;i++){
 const item=document.createElement('span');item.className=i<S.step?'done':i===S.step?'now':'';progress.appendChild(item);
 }counter.textContent=`${S.step} / ${S.steps.length}`;}
function chartFor(key){
 const m=MATS[key],card=document.createElement('div');card.className='graph-card';card.dataset.material=key;
 const hd=document.createElement('div');hd.className='graph-heading';
 const strong=document.createElement('strong'),badge=document.createElement('i');badge.style.background=m.color;strong.appendChild(badge);strong.append(m.name);
 const meta=document.createElement('span');meta.textContent=m.plotMin!=null?'局部刻度 · 相對量':'相對變化';hd.append(strong,meta);card.appendChild(hd);
 const plot=svg('svg',{viewBox:'0 0 300 124',class:'graph-svg','aria-label':`${m.name}沿途相對量的示意變化`});card.appendChild(plot);
 for(const v of [25,50,75]){const y=104-v*.90;svg('line',{x1:29,y1:y,x2:292,y2:y,stroke:'#eee4f1','stroke-width':1.2,'stroke-dasharray':'3 5'},plot);}
 svg('line',{x1:29,y1:11,x2:29,y2:107,stroke:'#dacbdf','stroke-width':1.2},plot);
 svg('line',{x1:29,y1:107,x2:292,y2:107,stroke:'#dacbdf','stroke-width':1.2},plot);
 for(const [txt,y] of [['高',21],['低',104]]){const t=svg('text',{x:5,y,fill:'#9a83a7','font-size':13,'font-weight':750},plot);t.textContent=txt;}
 const values=S.values.map(v=>v[key]);
 // A single 0–100 scale made glucose and especially low-concentration
 // ammonia virtually flat. Keep a *fixed range per substance* across routes,
 // and label it explicitly as a relative, not measured, classroom comparison.
 const min=m.plotMin??0,max=m.plotMax??100;
 const pt=(i,v)=>({x:29+i/Math.max(1,S.steps.length)*261,y:104-clamp((v-min)/(max-min),0,1)*90});
 const d=values.map((v,i)=>{const p=pt(i,v);return `${i?'L':'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`;}).join(' ');
 if(d)svg('path',{d,stroke:m.color,'stroke-width':3.5,fill:'none','stroke-linecap':'round','stroke-linejoin':'round'},plot);
 values.forEach((v,i)=>{const p=pt(i,v);svg('circle',{cx:p.x,cy:p.y,r:i===values.length-1?5:3.5,fill:m.color,stroke:'#fff','stroke-width':1.7},plot);});
 const f=document.createElement('div');f.className='graph-footer';
 const last=S.events.slice().reverse().find(Boolean);
 const before=values[0]??0,after=values[values.length-1]??before;
 const movement=after-before;
 const sign=Math.abs(movement)>=2?(movement>0?'↑':'↓'):'—';
 f.textContent=S.step?`${sign} ${m.name}（相對量）${last?' · '+last:''}`:'隨路徑逐段顯示';
 card.appendChild(f);
 return card;
}
function renderGraphs(){graphs.replaceChildren();for(const k of S.materials)graphs.appendChild(chartFor(k));
 $('matterCount').textContent=`${S.materials.length} / 3`;
 for(const b of document.querySelectorAll('.matter-choice')){
  const has=S.materials.includes(b.dataset.matter);b.classList.toggle('picked',has);b.setAttribute('aria-pressed',String(has));
  b.disabled=!has&&S.materials.length>=3;
 }
 drawOrganLabels();
}
function renderAll(){renderProgress();renderGraphs();}
function drawOrganLabels(){
 if(!organLayer)return;
 organLayer.replaceChildren();
 const isQuestion=S.active&&S.mode==='challenge';
 const organ=isQuestion?(S.mission?.organ||'none'):'none';
 const nitrogen=S.active&&(S.materials.includes('ammonia')||S.materials.includes('urea'));
 const urea=S.active&&S.materials.includes('urea');
 const footMode=S.active&&S.mode==='lower';
 // Outlines only appear for relevant matter selections or A→B scenarios.
 // Foot circulation keeps its own label; never call it a kidney in that mode.
 window.setTeachingOrgans?.({
   liver:S.active&&(organ==='liver'||nitrogen),
   intestine:S.active&&(organ==='intestine'||nitrogen),
   kidney:S.active&&!footMode&&(organ==='kidney'||urea),
   foot:footMode
 });
}

function errorFeedback(message){S.errors++;S.wrong=true;status.textContent=message;if(S.errors>=2)showHint();}
function showHint(){hintPath.replaceChildren();const id=S.steps[S.step];routeTrack(id).forEach(p=>svg('path',{d:p.d,class:'route-hint'},hintPath));}
function attempt(id){
 if(!S.active||S.phase!=='route'||!routes[id])return;
 const expected=S.steps[S.step];
 if(id!==expected){
  if(expected==='pul_r_a'&&id==='pul_l_a')S.steps.splice(S.step,3,'pul_l_a','pul_l_c','pul_l_v');
  else if(expected==='pul_l_a'&&id==='pul_r_a')S.steps.splice(S.step,3,'pul_r_a','pul_r_c','pul_r_v');
  else{errorFeedback('再找找血液接下來流向哪裡');return;}
  // Either lung is a correct physiological choice; keep B as original destination when route does not end at a lung.
 }
 S.errors=0;hintPath.replaceChildren();runSegment(S.steps[S.step]);
}
function drawCompleted(id){
 const cap=!!BEDS[id];
 const kind=kinds[id];
 const color=kind==='red'?'#eb657c':kind==='blue'?'#895063':
   kind==='tissue'?'url(#routeBodyOxygen)':'url(#routeLungOxygen)';
 for(const p of routes[id].parts){
   svg('path',{d:p.d,stroke:color,class:'route-selected'+(cap?' cap':''),'stroke-width':cap?4.6:15,
     'data-oxygen-state':kind},visuals);
 }
}
function runSegment(id){
 S.phase='animating';status.textContent='';renderWordPractice();
 const token=++S.run,parts=routeTrack(id),lengths=parts.map(p=>p.length),total=lengths.reduce((a,b)=>a+b,0)||1;
 const start=performance.now(),duration=Math.max(450,Math.min(1200,total*2.25));
 dot.setAttribute('visibility','visible');pulse.setAttribute('visibility','hidden');
 function frame(now){
  if(token!==S.run||!S.active)return;
  let remaining=Math.min(1,(now-start)/duration)*total,pt=null;
  for(let i=0;i<parts.length;i++){
   if(remaining<=lengths[i]||i===parts.length-1){pt=parts[i].el.getPointAtLength(Math.min(remaining,lengths[i]));break;}
   remaining-=lengths[i];
  }
  if(pt){dot.setAttribute('cx',pt.x);dot.setAttribute('cy',pt.y);}
  if(now-start<duration){requestAnimationFrame(frame);return;}
  dot.setAttribute('visibility','hidden');drawCompleted(id);
  const upd=updateSubstances(S.values[S.values.length-1],id);
  S.values.push(upd.values);S.events.push(upd.event);S.step++;S.phase='route';
  renderAll();showMarkers();renderWordPractice();
  if(S.step>=S.steps.length)finishRoute();
  else{status.textContent='';if(S.demo)setTimeout(autoStep,160);}
 }
 requestAnimationFrame(frame);
}
function finishRoute(){
 S.demo=false;$('routeDemo').textContent='▶ 重播';
 S.phase='done';nextBtn.hidden=false;answers.hidden=true;pulse.setAttribute('visibility','hidden');
 status.textContent='✓ 抵達終點！看看右側圖表';
 note.textContent='';
 if(S.mode==='challenge'&&S.wrong&&!S.missed.some(x=>x.id===S.mission.id))S.missed.push({id:S.mission.id,wait:3});
 S.nextLevel=null;
 if(S.mode!=='challenge'&&!S.wrong){
  const current=LEVELS.indexOf(S.level);
  S.levelPassed[S.mode]=Math.max(S.levelPassed[S.mode],current+1);
  if(current<LEVELS.length-1)S.nextLevel=LEVELS[current+1];
 }
 nextBtn.textContent=S.mode==='challenge'?'下一個生活情境 ↻':S.nextLevel?`下一階段：${LEVEL_NAMES[S.nextLevel]} →`:'再走一圈 ↻';
 renderWordPractice();
}
function autoStep(){if(!S.active||!S.demo)return;if(S.phase==='route')attempt(S.steps[S.step]);}
function toggleDemo(){
 // v1.9 regression: S.phase==='done' made autoStep() immediately return.
 // Replay the SAME mission/path from A rather than creating another question.
 if(S.phase==='done'){
  const replay=[...S.steps];
  setMode(S.mode,false);
  S.steps=replay;renderAll();showMarkers();
 }
 if(S.phase==='intro'){$('routeIntro').hidden=true;S.phase='route';showMarkers();}
 if(S.phase==='animating'&&S.demo){S.demo=false;$('routeDemo').textContent='▶ 繼續';return;}
 S.demo=!S.demo;
 $('routeDemo').textContent=S.demo?'■ 停止':'▶ 示範';
 renderWordPractice();
 if(S.demo)autoStep();
}
function pickMatter(key){
 if(!Object.hasOwn(MATS,key))return;
 if(S.materials.includes(key)){
  if(S.materials.length===1){status.textContent='至少保留一種物質';return;}
  S.materials=S.materials.filter(k=>k!==key);
 }else if(S.materials.length<3)S.materials.push(key);
 renderGraphs();
}
async function switchTop(tab){
 if(tab==='route'){
  if(S.active)return;
  if(api.state.view!=='circulation')await api.setView('circulation');
  S.active=true;app.classList.add('challenge-active');
  $('toRoute').classList.add('selected');$('toRoute').setAttribute('aria-pressed','true');
  $('toObserve').classList.remove('selected');$('toObserve').setAttribute('aria-pressed','false');
  api.state.tracking=false;api.state.running=false;
  $('particles').style.visibility='hidden';
  setMode(S.mode);requestAnimationFrame(()=>api.fit());
 }else{
  S.run++;S.active=false;S.demo=false;$('routeIntro').hidden=true;app.classList.remove('challenge-active');
  $('toRoute').classList.remove('selected');$('toRoute').setAttribute('aria-pressed','false');
  $('toObserve').classList.add('selected');$('toObserve').setAttribute('aria-pressed','true');
  window.setTeachingOrgans?.({});
  updateLevelUI();
  $('particles').style.visibility='';api.state.running=true;
  requestAnimationFrame(()=>api.fit());
 }
}
function init(){
 buildOverlay();
 $('toRoute').addEventListener('click',()=>switchTop('route'));
 $('toObserve').addEventListener('click',()=>switchTop('observe'));
 document.querySelectorAll('.route-mode').forEach(b=>b.addEventListener('click',()=>setMode(b.dataset.mode,b.dataset.mode==='challenge')));
 document.querySelectorAll('.route-level').forEach(b=>b.addEventListener('click',()=>setLevel(b.dataset.level)));
 document.querySelectorAll('.matter-choice').forEach(b=>b.addEventListener('click',()=>pickMatter(b.dataset.matter)));
 $('routeReset').addEventListener('click',()=>setMode(S.mode));
 $('routeDemo').addEventListener('click',toggleDemo);
 $('routeIntroStart').addEventListener('click',()=>{if(!S.active||S.phase!=='intro')return;$('routeIntro').hidden=true;S.phase='route';showMarkers();renderWordPractice();status.textContent='從起點開始，走向終點';});
 nextBtn.addEventListener('click',()=>{const next=S.nextLevel;if(next)S.level=next;setMode(S.mode,S.mode==='challenge');});
 setMode('upper');
}
init();
})();

/*
 * 血液循環互動模型 — 獨立原創實作／v1.5 心搏節律、外型透明度、肺循環與微血管網
 * 以可共用的 SVG 連續曲線繪製血管與計算血球位置。
 * 依原站公開的相對布局觀察重新繪製，未複製原作者的 XML 網路或程式碼。
 */
(() => {
'use strict';
const W = 1100, H = 820, NS = 'http://www.w3.org/2000/svg';
const $ = id => document.getElementById(id);
const stage = $('stage'), world = $('world'), svg = $('diagram'), canvas = $('particles');
const ctx = canvas.getContext('2d', { alpha:true });
const shadows = $('vesselShadows'), lumen = $('vesselLumen'), extras = $('microBranches');
const heartShape = $('heartShape'), backdrop = $('worldBackdrop'), labelLayer = $('anatomyLabels');
const ui = {
  count:$('cellCount'), countControl:$('countControl'), bpm:$('heartRate'), bpmText:$('heartRateValue'),
  heartOpacity:$('heartOpacity'), heartControl:$('heartShellControl'), labels:$('labelsBtn'), track:$('trackBtn'),
  legend:$('microLegend'), sugar:$('sugarDot'), sugarLabel:$('sugarLegend')
};
const state = { view:'circulation', count:800, bpm:60, heartOpacity:'half', labels:true, tracking:false, tracked:null,
  zoom:1, panX:0, panY:0, beat:0, particles:[], exchange:[], microRbcs:[], gas:[], airflow:[], running:true, clock:0, transitionBusy:false, cameraFlight:null, breathCycle:-1, exchangeClock:0, exchangeSeq:0, capillaryMolecules:[], capCooldown:{}, ejectionReady:true, prevEjectionPhase:0 };
const RED='#e95f67', BLUE='#7399c2', DARK='#8b3947';
// 路徑挑戰與血流觀察使用同一個循環拓撲與心臟骨架。
// Classroom simulation speed (SVG units / sec), NOT real human blood velocity.
// Restored v2.0 capillary speed. A regional display-sampling model below
// keeps the five capillary beds from accumulating most of the drawn RBCs.
// All numbers are animation units, not measured physiological velocities.
const FLOW_PX_PER_SECOND={artery:128, vein:84, capillary:11.5, atrium:24, ejection:115};
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const mix=(a,b,t)=>a+(b-a)*t;
const rnd=(a,b)=>a+Math.random()*(b-a);
const SVG=(tag, attributes={}, parent)=>{
  const n=document.createElementNS(NS,tag);
  Object.entries(attributes).forEach(([k,v])=>n.setAttribute(k,String(v)));
  if(parent)parent.appendChild(n);return n;
};
const line=(x1,y1,x2,y2,attrs={},parent=extras)=>SVG('line',{x1,y1,x2,y2,...attrs},parent);
const text=(x,y,s,attrs={},parent=labelLayer)=>{const el=SVG('text',{x,y,...attrs},parent);el.textContent=s;return el;};
// 血管本身以半透明中性色呈現；含氧程度只由紅血球的紅／深紅變化傳達。
const pathTypes={
 red:{stroke:'#f2a3a8',shadow:'#dc8f95'},
 blue:{stroke:'#f2a3a8',shadow:'#dc8f95'},
 capSystem:{stroke:'#caa4a1',shadow:'#bfa4a2'},
 capLung:{stroke:'#c6a19f',shadow:'#bfa4a2'}
};
// 微血管網只需定性呈現紅球含氧變化；血管本身採柔和色彩過渡，勿混同動脈／靜脈名稱。
const tintAt=(kind,t)=>{
  const a=kind==='capSystem'?[222,154,157]:[151,107,104];
  const b=kind==='capSystem'?[151,107,104]:[222,154,157];
  const q=clamp(t,0,1);
  return `rgb(${Math.round(mix(a[0],b[0],q))} ${Math.round(mix(a[1],b[1],q))} ${Math.round(mix(a[2],b[2],q))})`;
};
// 每一條血管中心線只定義一次；SVG 用它畫，紅血球也讀取同一條實際曲線的弧長。
// 符合原網站的空間關係：肺部在心臟左右兩側，系統微血管在上、下方。
// 每組微血管由多條真正可選擇的流動分支組成，而非只有裝飾線。
// 原站 800×800 的器官相對位置為空間定位基準（轉入 1100×720 畫布），非讀取／複製原始路徑。
// 主幹拆成真正的分支節點，讓 SVG 與血球使用同一條可通行的中心線。
const definitions=[
  // 共用拓撲：主幹→細分支→微血管，透過 taperStart/taperEnd 連續漸細。
  // 右心房分別接收上、下大靜脈；兩條大靜脈在外部不合併。
  {id:'ra-rv',from:'ra',to:'rv',kind:'blue',width:16,d:'M 507 389 C 510 410 521 430 529 448'},
  {id:'la-lv',from:'la',to:'lv',kind:'red',width:16,d:'M 612 389 C 609 406 603 428 598 447'},
  // 肺動脈（褐紅）：中央上行，較高位置水平展至兩肺，與主動脈弓分層。
  {id:'rv-pulmonary',from:'rv',to:'pFork',kind:'blue',width:20,d:'M 529 448 C 535 418 536 392 530 367 C 525 343 517 325 524 303'},
  {id:'p-left',from:'pFork',to:'leftLungIn',kind:'blue',width:17,taperEnd:8.5,d:'M 524 303 C 486 286 436 270 387 261 C 358 255 339 255 325 262'},
  {id:'p-right',from:'pFork',to:'rightLungIn',kind:'blue',width:17,taperEnd:8.5,d:'M 524 303 C 566 286 615 273 672 266 C 719 260 751 260 775 262'},
  // 肺靜脈（淡紅）：肺內較細，向左心房漸粗。
  {id:'left-pv',from:'leftLungOut',to:'la',kind:'red',width:17,taperStart:8.5,d:'M 359 415 C 419 424 470 438 523 443 C 565 447 592 426 612 389'},
  {id:'right-pv',from:'rightLungOut',to:'la',kind:'red',width:17,taperStart:8.5,d:'M 741 415 C 697 415 658 407 636 399 C 626 394 620 391 612 389'},
  // 主動脈（淡紅）：左心室→中央上行→右側大弓→下行與頭部分支。
  {id:'lv-aorta',from:'lv',to:'aorticRoot',kind:'red',width:23,d:'M 598 447 C 579 429 576 404 580 379 C 583 359 587 347 593 342'},
  {id:'aorta-up',from:'aorticRoot',to:'aorticTop',kind:'red',width:22,d:'M 593 342 C 620 325 645 317 666 321'},
  {id:'aorta-head',from:'aorticTop',to:'upperIn',kind:'red',width:17,taperEnd:8.5,d:'M 666 321 C 683 274 678 196 635 145'},
  {id:'aorta-down',from:'aorticTop',to:'abdFork',kind:'red',width:22,d:'M 666 321 C 679 390 678 468 670 546'},
  {id:'aorta-abd',from:'abdFork',to:'abdIn',kind:'red',width:16,taperEnd:8.5,d:'M 670 546 C 664 571 658 583 650 584'},
  {id:'aorta-leg',from:'abdFork',to:'legIn',kind:'red',width:18,taperEnd:8.5,d:'M 670 546 C 684 620 680 683 650 730'},
  // 上大靜脈：上半身直接進右心房，不與下大靜脈外部合併。
  {id:'upper-v',from:'upperOut',to:'raUpperPort',kind:'blue',width:19,taperStart:8.5,d:'M 485 145 C 464 190 451 258 451 318 C 451 348 469 367 504 379'},
  {id:'upper-ra',from:'raUpperPort',to:'ra',kind:'blue',width:12,d:'M 504 379 Q 505 383 507 389'},
  // 下半身支流先匯入下大靜脈；下大靜脈獨立接入右心房。
  {id:'lower-v',from:'abdOut',to:'venousLower',kind:'blue',width:15,taperStart:8.5,d:'M 470 584 C 456 558 451 524 450 507'},
  {id:'leg-v',from:'legOut',to:'venousLower',kind:'blue',width:17,taperStart:8.5,d:'M 470 730 C 433 690 431 590 450 507'},
  {id:'venous-trunk',from:'venousLower',to:'raLowerPort',kind:'blue',width:20,d:'M 450 507 C 455 470 467 437 486 420 C 495 412 504 407 510 405'},
  {id:'lower-ra',from:'raLowerPort',to:'ra',kind:'blue',width:12,d:'M 510 405 Q 509 396 507 389'}
];

// v1.5 有機微血管網：先分出細小血管、途中互相吻合、最後匯回小靜脈。
// 每一段是真正可供血球通行的 SVG 曲線，而不是視覺裝飾線。
// 已正式由單一圖形資料提供兩分頁，所有路徑與血球皆沿同一網路。
const bedGroups=[];
function addMesh(prefix,from,to,kind,start,end,rows=6,columns=8,spread=47){
  const vx=end[0]-start[0],vy=end[1]-start[1],mag=Math.hypot(vx,vy)||1;
  const nx=-vy/mag,ny=vx/mag,pts={};
  // 弧形收放，不畫整齊平行的梯形網格；波幅採固定種子，確保每次畫面一致。
  const point=(c,r)=>{
    const t=c/columns,band=(r-(rows-1)/2)/((rows-1)/2),env=Math.pow(Math.sin(Math.PI*t),.64);
    const weave=Math.sin(c*1.32+r*1.74)*.13+Math.sin(c*2.05-r*.72)*.05;
    const cross=spread*env*(band+weave*(1-Math.abs(band)*.36));
    const long=2.1*Math.sin(c*.78+r*1.41)*env;
    return [start[0]+vx*t+nx*cross+vx/mag*long,start[1]+vy*t+ny*cross+vy/mag*long];
  };
  const nid=(c,r)=>`${prefix}-node-${c}-${r}`;
  for(let c=1;c<columns;c++)for(let r=0;r<rows;r++)pts[nid(c,r)]=point(c,r);
  let k=0;const ids=[];
  function link(a,b,pa,pb,width=3.6){
    const dx=pb[0]-pa[0],dy=pb[1]-pa[1];
    const bend=Math.sin((k+1)*1.41)*2.2;
    const c1=[pa[0]+dx*.31+nx*bend,pa[1]+dy*.31+ny*bend];
    const c2=[pa[0]+dx*.68-nx*bend,pa[1]+dy*.68-ny*bend];
    const d=`M ${pa[0].toFixed(2)} ${pa[1].toFixed(2)} C ${c1[0].toFixed(2)} ${c1[1].toFixed(2)} ${c2[0].toFixed(2)} ${c2[1].toFixed(2)} ${pb[0].toFixed(2)} ${pb[1].toFixed(2)}`;
    const id=`${prefix}-${k++}`,den=mag*mag;
    const projection=p=>clamp(((p[0]-start[0])*vx+(p[1]-start[1])*vy)/den,0,1);
    definitions.push({id,from:a,to:b,kind,width,d,capT0:projection(pa),capT1:projection(pb),bed:prefix});ids.push(id);
  }
  for(let r=0;r<rows;r++)link(from,nid(1,r),start,point(1,r),4.5);
  for(let c=1;c<columns-1;c++)for(let r=0;r<rows;r++){
    link(nid(c,r),nid(c+1,r),point(c,r),point(c+1,r),3.4);
    // 不規則交互吻合，避免每格都形成棋盤／菱形排列。
    if((c+r)%3===0 && r<rows-1)link(nid(c,r),nid(c+1,r+1),point(c,r),point(c+1,r+1),2.65);
    if((c*2+r)%5===0 && r>0)link(nid(c,r),nid(c+1,r-1),point(c,r),point(c+1,r-1),2.65);
  }
  for(let r=0;r<rows;r++)link(nid(columns-1,r),to,point(columns-1,r),end,4.3);
  bedGroups.push({prefix,kind,ids});
}
// 毛細血管網重新定位：離開心臟周邊，形成更穩定的五群版面。
addMesh('head-bed','upperIn','upperOut','capSystem',[635,145],[485,145],5,8,31);   // cx=560
addMesh('abd-bed','abdIn','abdOut','capSystem',[650,584],[470,584],5,7,27);   // cx=560
addMesh('leg-bed','legIn','legOut','capSystem',[650,730],[470,730],5,7,29);   // cx=560
// 肺動脈從上方進入微血管，肺靜脈由下方回流。
addMesh('left-lung-bed','leftLungIn','leftLungOut','capLung',[325,252],[359,415],6,7,40);
addMesh('right-lung-bed','rightLungIn','rightLungOut','capLung',[775,252],[741,415],6,7,40);
const edges=new Map(), outgoing=new Map();
// 沿同一條 SVG 路徑採樣，畫出漸細的血管外形；中心線仍供血球與點選使用。
function taperedOutline(path,base,small,atStart){
  const len=path.getTotalLength(),count=Math.max(14,Math.ceil(len/3.5));
  const a=[],b=[];
  const smooth=t=>t*t*(3-2*t);
  for(let i=0;i<=count;i++){
    const d=len*i/count,at=d/len;
    const q=atStart?1-smooth(Math.min(1,at/.52)):smooth(Math.max(0,(at-.48)/.52));
    const width=base+(small-base)*q;
    const p=path.getPointAtLength(d),p1=path.getPointAtLength(Math.max(0,d-1.5)),p2=path.getPointAtLength(Math.min(len,d+1.5));
    const dx=p2.x-p1.x,dy=p2.y-p1.y,m=Math.hypot(dx,dy)||1;
    const nx=-dy/m,ny=dx/m;
    a.push([p.x+nx*width/2,p.y+ny*width/2]);
    b.push([p.x-nx*width/2,p.y-ny*width/2]);
  }
  return 'M'+a.map(p=>p.map(v=>v.toFixed(2)).join(' ')).join(' L')+' L'+b.reverse().map(p=>p.map(v=>v.toFixed(2)).join(' ')).join(' L')+' Z';
}
// Tissue cells are DETAIL of the existing abdominal mesh, never a replacement network.
let interstitialLayer=null;
function buildInterstitialCells(){
  if(interstitialLayer)return;
  interstitialLayer=SVG('g',{id:'interstitialCells',class:'tissue-detail','pointer-events':'none'},svg);
  svg.insertBefore(interstitialLayer,lumen);
  const defs=svg.querySelector('defs');
  let clip=defs.querySelector('#abdTissueClip');
  if(!clip){
    clip=SVG('clipPath',{id:'abdTissueClip',clipPathUnits:'userSpaceOnUse'},defs);
    SVG('path',{d:'M 452 585 C 463 549 503 529 558 529 C 615 529 656 549 669 585 C 656 622 615 641 558 641 C 503 641 463 622 452 585 Z'},clip);
  }
  const region=SVG('g',{'clip-path':'url(#abdTissueClip)'},interstitialLayer);
  // 先鋪一層非常淡的組織底色，避免放大後仍露出背景。
  SVG('path',{class:'tissue-base',d:'M 448 585 C 461 546 503 522 560 522 C 619 522 662 545 674 585 C 661 626 618 648 560 648 C 503 648 460 625 448 585 Z',fill:'#f1e3f2',opacity:'.985'},region);
  const vessels=[...edges.values()].filter(seg=>seg.bed==='abd-bed');
  const vesselPoints=[];
  for(const seg of vessels){
    for(let i=0;i<=seg.sampleN;i++){
      vesselPoints.push([seg.sampleX[i],seg.sampleY[i]]);
    }
  }
  const inRegion=(cx,cy,margin=0)=>Math.pow((cx-560)/(111-margin*.08),2)+Math.pow((cy-585)/(56-margin*.05),2)<=1;
  const nearest2=(cx,cy)=>{
    let best=Infinity;
    for(const pt of vesselPoints){
      const d=(cx-pt[0])**2+(cy-pt[1])**2;
      if(d<best)best=d;
    }
    return best;
  };
  const cellLayer=SVG('g',{class:'tissue-cells','clip-path':'url(#abdTissueClip)'},region);
  let count=0;
  const addCell=(cx,cy,rx,ry,angle,klass,fill,stroke,nxFill,nxRx,nxRy,nxDx=0.4)=>{
    const g=SVG('g',{transform:`rotate(${angle.toFixed(2)} ${cx.toFixed(2)} ${cy.toFixed(2)})`,class:klass},cellLayer);
    SVG('ellipse',{cx:cx.toFixed(2),cy:cy.toFixed(2),rx:rx.toFixed(2),ry:ry.toFixed(2),fill,stroke,'stroke-width':klass==='tissue-cell' ? '.5' : klass==='tissue-cell-small' ? '.36' : '.22',opacity:klass==='tissue-cell' ? '.95' : klass==='tissue-cell-small' ? '.92' : '.88'},g);
    SVG('ellipse',{cx:(cx+nxDx).toFixed(2),cy:cy.toFixed(2),rx:nxRx.toFixed(2),ry:nxRy.toFixed(2),fill:nxFill,opacity:'.8'},g);
    count++;
  };
  // 大細胞：鋪滿主要空間。因為血管會畫在上層，所以細胞可以靠近血管，不留背景。
  for(let y=534;y<=636;y+=11.4){
    for(let x=456;x<=664;x+=12){
      const row=Math.round((y-534)/11.4),col=Math.round((x-456)/12);
      const cx=x+(row%2)*6.0+Math.sin(col*1.7+row*.8)*1.8;
      const cy=y+Math.cos(col*.9+row*1.35)*1.4;
      if(!inRegion(cx,cy,4))continue;
      const d2=nearest2(cx,cy);
      if(d2<7)continue;
      addCell(cx,cy,4.9+.35*Math.sin(row+col),4.0+.25*Math.cos(col*1.2-row),((col*13+row*19)%34)-17,'tissue-cell','#f0dff2','#c2aacd','#b89fc8',1.45,1.75,0.45);
    }
  }
  // 中細胞：補滿大細胞間的縫隙。
  for(let y=537;y<=633;y+=8.4){
    for(let x=460;x<=661;x+=8.8){
      const row=Math.round((y-537)/8.4),col=Math.round((x-460)/8.8);
      const cx=x+((row+1)%2)*4.1+Math.sin(col*2.15+row*.6)*1.1;
      const cy=y+Math.cos(col*.7+row*1.45)*1.0;
      if(!inRegion(cx,cy,1))continue;
      const d2=nearest2(cx,cy);
      if(d2<4.5)continue;
      addCell(cx,cy,3.5+.3*Math.sin(col+row),2.95+.22*Math.cos(col-row),((col*11+row*7)%28)-14,'tissue-cell-small','#efddf1','#c6afd1','#c2a9ce',1.05,1.2,0.32);
    }
  }
  // 極小細胞：只負責消除殘留空隙，讓背景不再露出。
  for(let y=533;y<=637;y+=5.7){
    for(let x=454;x<=666;x+=6.1){
      const row=Math.round((y-533)/5.7),col=Math.round((x-454)/6.1);
      const cx=x+(row%2)*2.8+Math.sin(col*1.1+row*1.9)*.55;
      const cy=y+Math.cos(col*.95+row*1.2)*.52;
      if(!inRegion(cx,cy,-2))continue;
      const d2=nearest2(cx,cy);
      if(d2<2.0)continue;
      addCell(cx,cy,1.95+.16*Math.sin(col),1.72+.14*Math.cos(row),((col*5+row*3)%24)-12,'tissue-cell-tiny','#f2e6f3','#d1bad9','#ccb3d5',0.62,0.62,0.18);
    }
  }
  interstitialLayer.dataset.count=String(count);
}
function showInterstitial(show){
  if(!interstitialLayer)return;
  interstitialLayer.classList.toggle('visible',show);
}
let crossingOcclusion=new Map();
function createNetwork(){
  // Main vessel centerlines are authoritative for BOTH animation and route clicks.
  // Separate colored vessels from the crossing treatment to preserve clean junctions.
  const undercoat=SVG('g',{id:'vesselUndercoat'},lumen);
  const vesselPaint=SVG('g',{id:'vesselPaint'},lumen);
  // Render main tubes opaque INSIDE one transparent group. Adjacent/connected
  // segments then share a seamless color instead of doubling alpha at joins.
  const mainPaint=SVG('g',{id:'mainVesselPaint',opacity:'.49'},vesselPaint);
  const capPaint=SVG('g',{id:'capillaryPaint',opacity:'.77'},vesselPaint);
  const svgDefs=svg.querySelector('defs');
  // True over/under crossings. Hints only identify which vicinity to inspect.
  // Do NOT excise the under-vessel with an ellipse: that creates artificial gaps.
  const crossingSpecs=[
    {under:'p-left',over:'upper-v',hint:[452,267]},
    {under:'p-right',over:'aorta-head',hint:[672,275]},
    {under:'right-pv',over:'aorta-down',hint:[668,418]},
    {under:'left-pv',over:'rv-pulmonary',hint:[530,442]},
    {under:'left-pv',over:'venous-trunk',hint:[473,436]},
    {under:'left-pv',over:'lv-aorta',hint:[583,426]}
  ];
  const definitionById=new Map(definitions.map(d=>[d.id,d]));
  const proximitySamples=(path,hint,radius=75)=>{
    const len=path.getTotalLength(),n=Math.max(15,Math.ceil(len/2.5)),pts=[];
    for(let i=0;i<=n;i++){
      const pt=path.getPointAtLength(len*i/n);
      if(Math.hypot(pt.x-hint[0],pt.y-hint[1])<=radius)pts.push([pt.x,pt.y]);
    }
    return pts;
  };
  const resolveCrossing=(spec)=>{
    const lower=definitionById.get(spec.under),upper=definitionById.get(spec.over);
    if(!lower||!upper)return null;
    // Temporary invisible paths make the crossing track the shared centerline
    // even if a later visual revision moves one of the vessels.
    const a=SVG('path',{d:lower.d,visibility:'hidden'},svgDefs),b=SVG('path',{d:upper.d,visibility:'hidden'},svgDefs);
    const aa=proximitySamples(a,spec.hint),bb=proximitySamples(b,spec.hint);
    a.remove();b.remove();
    let best={distance:Infinity};
    for(const x of aa)for(const y of bb){
      const distance=Math.hypot(x[0]-y[0],x[1]-y[1]);
      if(distance<best.distance)best={distance,x:(x[0]+y[0])/2,y:(x[1]+y[1])/2};
    }
    // No actual overlapping paint? Do not construct a false bridge.
    if(best.distance>(lower.width+upper.width)/2+1.5)return null;
    return {...spec,...best,upperWidth:upper.width};
  };
  const crossings=crossingSpecs.map(resolveCrossing).filter(Boolean);
  const maskByUnder=new Map();
  for(const c of crossings){
    if(!maskByUnder.has(c.under))maskByUnder.set(c.under,[]);
    maskByUnder.get(c.under).push(c);
  }
  const pathMask=new Map();
  for(const [name,locations] of maskByUnder){
    const id='vessel-bridge-mask-'+name;
    const mask=SVG('mask',{id,maskUnits:'userSpaceOnUse',maskContentUnits:'userSpaceOnUse',x:0,y:0,width:W,height:H},svgDefs);
    SVG('rect',{x:0,y:0,width:W,height:H,fill:'white'},mask);
    for(const c of locations){
      const over=definitionById.get(c.over);
      // Clip is merely a local window. The actual occlusion shape is the
      // FRONT VESSEL'S STROKE (with 0.8px clearance), NOT the window itself.
      const clipId='bridge-local-'+c.under+'-'+c.over;
      const clip=SVG('clipPath',{id:clipId,clipPathUnits:'userSpaceOnUse'},svgDefs);
      SVG('circle',{cx:c.x,cy:c.y,r:Math.max(over.width,definitionById.get(c.under).width)+16},clip);
      SVG('path',{d:over.d,fill:'none',stroke:'black','stroke-width':c.upperWidth+4.2,
        'stroke-linecap':'round','stroke-linejoin':'round','clip-path':`url(#${clipId})`},mask);
    }
    pathMask.set(name,`url(#${id})`);
  }
  // Use a continuous soft underlay instead of repeated thick white strokes;
  // this avoids bulky circular nodes at connected vessel ends.
  definitions.forEach(def=>{
    const colors=pathTypes[def.kind];
    const cap=def.kind.startsWith('cap');
    const stroke=cap?tintAt(def.kind,((def.capT0??0)+(def.capT1??1))/2):colors.stroke;
    const mask=pathMask.get(def.id);
    const props={d:def.d,fill:'none','stroke-linecap':'round','stroke-linejoin':'round'};
    if(!cap){
      SVG('path',{...props,stroke:colors.shadow,'stroke-width':def.width+5,opacity:'.06',...(mask?{mask}:{})},undercoat);
    }
    const taper=def.taperStart!=null||def.taperEnd!=null;
    const el=SVG('path',{...props,stroke,'stroke-width':def.width,opacity:taper?'0':cap?'.58':'1',...(mask?{mask}:{})},cap?capPaint:mainPaint);
    if(def.bed==='abd-bed')el.classList.add('abd-mesh-seg');
    if(taper){
      const shape=taperedOutline(el,def.width,def.taperStart??def.taperEnd,def.taperStart!=null);
      def.visual=SVG('path',{d:shape,fill:stroke,opacity:cap?'.58':'1',...(mask?{mask}:{})},cap?capPaint:mainPaint);
      if(def.bed==='abd-bed')def.visual.classList.add('abd-mesh-seg');
      def.visual.setAttribute('pointer-events','none');
    }
    const flowType=cap?'capillary':
      (['ra-rv','la-lv'].includes(def.id)?'atrium':
        (['rv-pulmonary','lv-aorta'].includes(def.id)?'ejection':
          (/^(left-pv|right-pv|upper-v|lower-v|leg-v|venous-|vena-cava)/.test(def.id)?'vein':'artery')));
    const segment={...def,flowType,el,length:el.getTotalLength()};
    const sampleN=Math.max(2,Math.ceil(segment.length/2));segment.sampleN=sampleN;
    segment.sampleX=new Float32Array(sampleN+1);segment.sampleY=new Float32Array(sampleN+1);
    for(let i=0;i<=sampleN;i++){
      const pt=el.getPointAtLength(segment.length*i/sampleN);
      segment.sampleX[i]=pt.x;segment.sampleY[i]=pt.y;
    }
    edges.set(def.id,segment);
    if(!outgoing.has(def.from))outgoing.set(def.from,[]);
    outgoing.get(def.from).push(segment);
  });
  // Over-vessels already paint on top through their regular SVG layers.
  // Extra opaque clipped repaint caused dark blocks: intentionally removed.
  const occludedAtCrossing=new Map();
  for(const c of crossings){
    if(!occludedAtCrossing.has(c.under))occludedAtCrossing.set(c.under,[]);
    const segment=edges.get(c.over);
    const points=[];
    // Sample only the small local crossing window for cheap RBC occlusion.
    for(let i=0;i<=segment.sampleN;i++){
      const x=segment.sampleX[i],y=segment.sampleY[i];
      if(Math.hypot(x-c.x,y-c.y)<c.upperWidth+18)points.push([x,y]);
    }
    occludedAtCrossing.get(c.under).push({...c,points});
  }
  // Keep this local list available for the RBC renderer without global masks.
  crossingOcclusion=occludedAtCrossing;
  drawBackdrop();
  buildHeart();
  // 主動脈與肺動脈在心房、心室的上方：顯示血管連續進出心臟。
  const front=SVG('g',{id:'heartFrontVessels',opacity:'.49','pointer-events':'none'},svg);
  // 高於心臟腔室、低於學生選取與提示圖層，避免高亮被血管蓋掉。
  svg.insertBefore(front,$('routeOverlay'));
  for(const id of ['rv-pulmonary','lv-aorta','aorta-up','aorta-head','aorta-down','aorta-abd','aorta-leg']){
    const segment=edges.get(id);
    if(segment)front.appendChild(segment.el);
  }
  makeLabels();
  addSharedOrganOverlays();
}
function drawBackdrop(){
  // 不畫肺的外輪廓：左右各自直接以微血管網呈現。
  // 大片器官填色亦取消，避免血管重疊時辨識困難。
}
const hearts=[];let valves=[],heartShell=null,heartSolidMask=null;
function buildHeart(){
  // 四群體循環構造共同軸 x=560；愛心外框採左右對稱的標準幾何。
  const shellGroup=SVG('g',{id:'heartOuter','pointer-events':'none'},heartShape);
  heartShell=SVG('path',{
    d:'M 560 517 C 545 501 511 482 490 450 C 471 424 464 397 472 372 C 479 348 499 336 520 341 C 540 346 554 361 560 373 C 566 361 580 346 600 341 C 621 336 641 348 648 372 C 656 397 649 424 630 450 C 609 482 575 501 560 517 Z',
    fill:'#e7a1a5','fill-opacity':'.11',stroke:'#9d6770','stroke-opacity':'.72','stroke-width':4.6,
    'stroke-linecap':'round','stroke-linejoin':'round'
  },shellGroup);
  const chambers=[
    {id:'ra',x:507,y:389,rx:21,ry:22,fill:'#ead4dd',stroke:'#987587',label:'右心房'},
    {id:'rv',x:529,y:448,rx:27,ry:29,fill:'#e9d1dc',stroke:'#8f7182',label:'右心室'},
    {id:'la',x:612,y:389,rx:21,ry:22,fill:'#f7c7ce',stroke:'#cc7b84',label:'左心房'},
    {id:'lv',x:598,y:447,rx:27,ry:29,fill:'#f2bfc5',stroke:'#c57079',label:'左心室'}
  ];
  for(const ch of chambers){
    const group=SVG('g',{id:'chamber-'+ch.id,'pointer-events':'none'},heartShape);
    SVG('ellipse',{cx:ch.x,cy:ch.y,rx:ch.rx,ry:ch.ry,fill:ch.fill,stroke:ch.stroke,'stroke-width':2.1,opacity:'.94'},group);
    SVG('ellipse',{cx:ch.x-3,cy:ch.y-7,rx:ch.rx*.55,ry:ch.ry*.55,fill:'#fff',opacity:'.13'},group);
    hearts.push({...ch,group});
  }
  const valveData=[
    {x:523,y:417,angle:84,kind:'av'},{x:597,y:416,angle:84,kind:'av'},
    {x:525,y:343,angle:-35,kind:'semilunar'},{x:585,y:340,angle:-13,kind:'semilunar'}
  ];
  valveData.forEach(v=>{
    const g=SVG('g',{transform:`translate(${v.x} ${v.y}) rotate(${v.angle})`,opacity:'.66','pointer-events':'none'},heartShape);
    line(-5,0,0,-4,{stroke:'#fff','stroke-width':2.2,'stroke-linecap':'round'},g);
    line(0,-4,5,0,{stroke:'#fff','stroke-width':2.2,'stroke-linecap':'round'},g);
    valves.push({...v,group:g});
  });
}

// 教學示意層：圖像僅表示使用者標註的器官分區，不新增血流分支。
let sharedOrganRoot=null, liverRegion=null, intestineRegion=null, kidneyRegion=null, footRegion=null;
function addSharedOrganOverlays(){
  if(sharedOrganRoot)return;
  sharedOrganRoot=SVG('g',{id:'sharedOrganOverlay','pointer-events':'none'},svg);
  svg.insertBefore(sharedOrganRoot,$('routeOverlay'));
  // Liver: left of the vena-cava area, a recognizable but subdued silhouette.
  const lg=SVG('g',{class:'organ-liver-schematic'},sharedOrganRoot);
  liverRegion=lg;
  SVG('path',{d:'M 310 510 C 317 487 342 488 367 492 C 389 487 419 496 439 512 C 432 530 411 537 385 542 C 366 539 352 532 336 535 C 317 532 307 522 310 510 Z',class:'organ-liver-fill'},lg);
  SVG('path',{d:'M 348 497 Q 357 518 351 539',class:'organ-liver-seam'},lg);
  let tx=SVG('text',{x:365,y:522,class:'organ-division-label','text-anchor':'middle'},lg);
  tx.textContent='肝臟';
  // The upper lower-body capillary network is the small-intestine model.
  const gi=SVG('g',{class:'organ-intestine-schematic'},sharedOrganRoot);
  intestineRegion=gi;
  SVG('rect',{x:452,y:540,width:218,height:98,rx:23,class:'organ-intestine-outline'},gi);
  tx=SVG('text',{x:560,y:533,class:'organ-division-label intestine-label','text-anchor':'middle'},gi);
  tx.textContent='小腸';
  // When comparing urea or studying renal context, the lower teaching network
  // can represent a renal capillary bed. It is NOT an actual kidney at the feet.
  kidneyRegion=SVG('g',{id:'kidneyRegionSchematic'},sharedOrganRoot);
  SVG('rect',{x:446,y:677,width:228,height:107,rx:27,class:'organ-kidney-outline'},kidneyRegion);
  tx=SVG('text',{x:560,y:678,class:'organ-division-label kidney-label','text-anchor':'middle'},kidneyRegion);
  tx.textContent='腎臟';
  footRegion=SVG('g',{id:'footRegionSchematic'},sharedOrganRoot);
  tx=SVG('text',{x:560,y:680,class:'organ-division-label foot-label','text-anchor':'middle'},footRegion);
  tx.textContent='腳底';
  // The observation page should stay free of dashed teaching boxes.
  window.setTeachingOrgans({});
}
window.setTeachingOrgans=({liver=false,intestine=false,kidney=false,foot=false}={})=>{
  if(!sharedOrganRoot)return;
  liverRegion.style.display=liver?'':'none';
  intestineRegion.style.display=intestine?'':'none';
  kidneyRegion.style.display=kidney?'':'none';
  footRegion.style.display=foot?'':'none';
  sharedOrganRoot.style.display=(liver||intestine||kidney||foot)?'':'none';
};

function label(x,y,s,accent='#5d8390',font=14,align='middle'){
  const g=SVG('g',{class:'world-label'},labelLayer);
  text(x,y,s,{'font-size':font,'font-weight':700,'text-anchor':align,fill:accent},g); return g;
}
function makeLabels(){
  const mark=(x1,y1,x2,y2)=>{
    SVG('line',{x1,y1,x2,y2,stroke:'#988987','stroke-width':1.4,opacity:'.82','stroke-dasharray':'3 3','pointer-events':'none'},labelLayer);
    SVG('circle',{cx:x2,cy:y2,r:2.4,fill:'#988987','pointer-events':'none'},labelLayer);
  };
  // 四者中心軸均為 x=560：頭部、心臟、腹腔、下肢。
  label(560,92,'頭部與上肢微血管網','#447783',14);
  // 這兩群保留既有路徑：器官名稱改由下方的教學示意覆蓋層呈現。

  label(247,310,'肺部微血管網','#447783',13);
  label(855,310,'肺部微血管網','#447783',13);
  label(360,224,'肺動脈','#8b6661',13);mark(372,229,396,270);
  label(473,226,'上大靜脈','#977074',12);mark(473,235,456,256);
  label(400,474,'下大靜脈','#76524e',12);mark(426,480,452,506);
  label(710,356,'主動脈','#ad757d',13);mark(694,361,683,366);
  // 肺靜脈明確指向右肺回流支（right-pv），不再落在主動脈下行段。
  label(784,456,'肺靜脈','#a56e73',12);mark(769,445,729,414);
  const chamberLabelPos={ra:[491,385],rv:[514,466],la:[630,385],lv:[616,466]};
  for(const h of hearts){const pos=chamberLabelPos[h.id]||[h.x,h.y+4];const g=label(pos[0],pos[1],h.label,h.stroke,10);g.setAttribute('data-chamber-label','1');}
}

function switchWhole(show){
  svg.style.display=show?'block':'none';
  $('labelOverlay').style.display=show?'block':'none';
}
function tissueTarget(){
  const r=stage.getBoundingClientRect();
  const zoom=Math.min(5.3,(r.width-42)/204,(r.height-52)/132);
  return targetAt(560,584,Math.max(2.2,zoom));
}
function fitTarget(){
  if(state.view==='tissue')return tissueTarget();
  const r=stage.getBoundingClientRect();
  // Full microscope canvases need the entire 1100 × 720 coordinate space.
  if(state.view!=='circulation'){
    const zoom=Math.max(.24,Math.min((r.width-32)/W,(r.height-32)/H));
    return {zoom,panX:(r.width-W*zoom)/2,panY:(r.height-H*zoom)/2};
  }
  // The anatomy occupies only the central ~630 SVG units. Fit the ACTUAL
  // vessels instead of shrinking all 1100 units including empty side margins.
  const x0=195,x1=905,y0=70,y1=804;
  const clearance=document.querySelector('.app')?.classList.contains('challenge-active')?102:0;
  const usableH=Math.max(310,r.height-clearance);
  const zoom=Math.max(.24,Math.min((r.width-40)/(x1-x0),(usableH-32)/(y1-y0)));
  return {zoom,panX:r.width/2-(x0+x1)*zoom/2,panY:clearance+usableH/2-(y0+y1)*zoom/2};
}
function applyCamera(p){state.zoom=p.zoom;state.panX=p.panX;state.panY=p.panY;updateTransform();}
function setZoom(z,atX=stage.clientWidth/2,atY=stage.clientHeight/2){
  z=clamp(z,.24,4.5);const old=state.zoom;
  state.panX=atX-(atX-state.panX)*z/old;state.panY=atY-(atY-state.panY)*z/old;
  state.zoom=z;updateTransform();
}
function updateTransform(){
  world.style.transform=`translate(${state.panX}px,${state.panY}px) scale(${state.zoom})`;
  $('zoomReset').textContent=`${Math.round(state.zoom*100)}%`;
}
function fit(){stopFlight();applyCamera(fitTarget());}
function resetView(){stopFlight();applyCamera({zoom:1,panX:(stage.clientWidth-W)/2,panY:(stage.clientHeight-H)/2});}
const ease=t=>t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;
function stopFlight(){state.cameraFlight=null;}
function flyCamera(to,duration=720){
  return new Promise(resolve=>{
    const flight={start:performance.now(),from:{zoom:state.zoom,panX:state.panX,panY:state.panY},to,duration,resolve};
    if(state.cameraFlight?.resolve)state.cameraFlight.resolve();
    state.cameraFlight=flight;
  });
}
function tickCamera(now){
  const f=state.cameraFlight;if(!f)return;
  const t=clamp((now-f.start)/f.duration,0,1),e=ease(t);
  applyCamera({zoom:mix(f.from.zoom,f.to.zoom,e),panX:mix(f.from.panX,f.to.panX,e),panY:mix(f.from.panY,f.to.panY,e)});
  if(t===1){state.cameraFlight=null;f.resolve();}
}
function targetAt(x,y,z){return {zoom:z,panX:stage.clientWidth/2-x*z,panY:stage.clientHeight/2-y*z};}
function snapshot(){
  const shell=document.createElement('div');shell.className='fly-snapshot';
  const copy=world.cloneNode(true);
  copy.style.display='block';copy.style.transform=world.style.transform;
  // Canvas 本身不會隨 cloneNode 複製像素，因此手動複製現有畫面。
  const oldCanvases=[...world.querySelectorAll('canvas')],newCanvases=[...copy.querySelectorAll('canvas')];
  newCanvases.forEach((c,i)=>c.getContext('2d').drawImage(oldCanvases[i],0,0));
  copy.removeAttribute('id');copy.querySelectorAll('[id]').forEach(n=>n.removeAttribute('id'));
  shell.appendChild(copy);stage.appendChild(shell);return {shell,copy};
}
function fadeSnapshot(snap,duration=440){
  // Freeze the previous view at the exact same screen position and simply fade.
  // Scaling a copied translated world around its center used to slide the old body image sideways.
  return new Promise(resolve=>{
    const anim=snap.shell.animate([{opacity:1},{opacity:0}],{duration,easing:'ease-in-out',fill:'forwards'});
    const done=()=>{snap.shell.remove();resolve();};
    anim.onfinish=done;
    anim.oncancel=done;
  });
}
const choicesFrom=node=>outgoing.get(node)||[];
function chooseSegment(node){
  const options=choicesFrom(node);
  if(!options.length)return edges.get('ra-rv');
  return options[Math.floor(Math.random()*options.length)];
}
// Start with a visible population in every major region. The old seeding picked
// 272 tiny segments with equal probability, almost emptying long arterial trunks.
const RBC_ZONES=[
  {name:'體動脈',share:.19,ids:['lv-aorta','aorta-up','aorta-head','aorta-down','aorta-abd','aorta-leg']},
  {name:'體靜脈',share:.17,ids:['upper-v','upper-ra','lower-v','leg-v','venous-trunk','lower-ra']},
  {name:'肺動脈',share:.095,ids:['rv-pulmonary','p-left','p-right']},
  {name:'肺靜脈',share:.095,ids:['left-pv','right-pv']},
  {name:'心臟',share:.06,ids:['ra-rv','la-lv']},
  {name:'上半身微血管',share:.10,bed:'head-bed'},
  {name:'小腸微血管',share:.10,bed:'abd-bed'},
  {name:'下方微血管',share:.10,bed:'leg-bed'},
  {name:'左肺微血管',share:.045,bed:'left-lung-bed'},
  {name:'右肺微血管',share:.045,bed:'right-lung-bed'}
];
// Each drawn erythrocyte is a VISUAL FLOW TRACER, not one conserved human RBC.
// A steady exhibit needs a stable number of visible tracers per anatomical zone.
// The former continuous, unbounded particle transfer collected ~70% in the
// slow capillaries despite the user wanting to SEE slow motion, not congestion.
// We keep the original 11.5 px/s and recycle untracked display tracers WITHIN
// their zone once they reach its outlet. The explicitly tracked tracer is
// exempt: it still follows the true graph across every organ and chamber.
const RBC_ZONE_ENTRIES={
  '體動脈':['lv-aorta'],
  '體靜脈':['upper-v','lower-v','leg-v'],
  '肺動脈':['rv-pulmonary'],
  '肺靜脈':['left-pv','right-pv'],
  '心臟':['ra-rv','la-lv'],
  '上半身微血管':['upperIn'],
  '小腸微血管':['abdIn'],
  '下方微血管':['legIn'],
  '左肺微血管':['leftLungIn'],
  '右肺微血管':['rightLungIn']
};
let RBC_RUNTIME_ZONES=[];
let nextId=0;
function resetRbc(){
  // 追蹤期間調整血球數量，保留同一顆血球與它的實際血管位置。
  const previousTracked=state.tracking?state.particles.find(p=>p.id===state.tracked):null;
  const zones=RBC_ZONES.map(zone=>{
    const parts=(zone.bed?bedGroups.find(b=>b.prefix===zone.bed)?.ids:zone.ids)||[];
    const segments=parts.map(id=>edges.get(id)).filter(Boolean);
    return {...zone,segments,total:segments.reduce((sum,s)=>sum+s.length,0)};
  }).filter(z=>z.total>0);
  RBC_RUNTIME_ZONES=zones.map(zone=>{
    const ids=new Set(zone.segments.map(seg=>seg.id));
    const starters=RBC_ZONE_ENTRIES[zone.name]||[];
    const entrySegments=zone.segments.filter(seg=>starters.includes(seg.id)||starters.includes(seg.from));
    if(!entrySegments.length)throw new Error(`No inlet for RBC display zone: ${zone.name}`);
    return {...zone,ids,entrySegments};
  });
  // Largest-remainder allocation makes the sum exact for any count, including 0.
  const totalShare=zones.reduce((sum,z)=>sum+z.share,0)||1;
  const wanted=zones.map(z=>state.count*z.share/totalShare);
  const allocations=wanted.map(Math.floor);
  let remaining=state.count-allocations.reduce((a,b)=>a+b,0);
  const remainders=wanted.map((v,i)=>({i,fract:v-allocations[i]})).sort((a,b)=>b.fract-a.fract);
  for(let i=0;i<remaining;i++)allocations[remainders[i%remainders.length].i]++;
  const particles=[];
  zones.forEach((zone,zi)=>{
    const quota=allocations[zi];
    if(!quota)return;
    // Stratification over total path length avoids accidental empty artery sections.
    const cumulative=[];let acc=0;
    zone.segments.forEach(s=>{acc+=s.length;cumulative.push(acc);});
    const phase=Math.random();
    for(let i=0;i<quota;i++){
      let along=((i+phase+.22*(Math.random()-.5))/quota)*acc;
      along=Math.max(0,Math.min(acc-.0001,along));
      let segmentIndex=0;
      while(segmentIndex<cumulative.length-1&&along>=cumulative[segmentIndex])segmentIndex++;
      const seg=zone.segments[segmentIndex];
      const previous=segmentIndex?cumulative[segmentIndex-1]:0;
      const p={id:nextId++,seg,dist:Math.min(seg.length-.0001,Math.max(0,along-previous)),
        lane:rnd(-.28,.28),speed:rnd(.83,1.2),age:rnd(0,10),oxygen:seg.kind==='red',x:0,y:0,
        homeZone:zi,displayFade:1};
      rbcPosition(p);particles.push(p);
    }
  });
  if(previousTracked&&particles.length){
    // 以同一區的一個展示標記換回原本被追蹤的物件，不增加總數。
    const replaceIndex=Math.max(0,particles.findIndex(p=>p.homeZone===previousTracked.homeZone));
    previousTracked.displayFade=1;
    particles[replaceIndex]=previousTracked;
    state.tracked=previousTracked.id;
  }else if(!particles.length){
    state.tracking=false;state.tracked=null;flyCamera(fitTarget(),570);
  }else{
    state.tracking=false;state.tracked=null;
  }
  state.particles=particles;
  syncTracking();
}
function rbcPosition(p){
  const seg=p.seg;
  const index=clamp(p.dist/seg.length*seg.sampleN,0,seg.sampleN);
  const i=Math.floor(index),j=Math.min(i+1,seg.sampleN),fraction=index-i;
  const x=mix(seg.sampleX[i],seg.sampleX[j],fraction);
  const y=mix(seg.sampleY[i],seg.sampleY[j],fraction);
  const i0=Math.max(0,i-1),i1=Math.min(seg.sampleN,i+2);
  const nx=seg.sampleY[i0]-seg.sampleY[i1],ny=seg.sampleX[i1]-seg.sampleX[i0];
  const m=Math.hypot(nx,ny)||1;
  let hereWidth=seg.width;
  if(seg.taperStart!=null||seg.taperEnd!=null){
    const u=p.dist/Math.max(seg.length,1),smo=x=>x*x*(3-2*x);
    const q=seg.taperStart!=null?1-smo(Math.min(1,u/.52)):smo(Math.max(0,(u-.48)/.52));
    hereWidth=seg.width+((seg.taperStart??seg.taperEnd)-seg.width)*q;
  }
  const offset=p.lane*Math.min(hereWidth*.72,15);
  p.x=x+(nx/m)*offset;p.y=y+(ny/m)*offset;
  return p;
}
function oxygenPercent(p){
  // 以整個微血管網的血流進度計算含氧量，避免每走一小段分支顏色重置。
  const t=mix(p.seg.capT0??0,p.seg.capT1??1,p.dist/p.seg.length);
  if(p.seg.kind==='capSystem')return mix(.96,.12,t);
  if(p.seg.kind==='capLung')return mix(.12,.96,t);
  return p.seg.kind==='red'?.98:.10;
}
function oxygenColor(percent){
  const v=clamp(percent,0,1);
  return `rgb(${Math.round(mix(137,238,v))},${Math.round(mix(52,67,v))},${Math.round(mix(67,76,v))})`;
}
function heartBeatPhase(){return (state.clock%(60/state.bpm))/(60/state.bpm);}
function arteryPulse(phase){
  // 以快速收縮造成一波較快的血流，舒張期仍有向前流動；僅動脈強烈呈現此變化。
  const systolicWave=Math.pow(Math.max(0,Math.sin(2*Math.PI*(phase-.025))),3);
  return .48+1.75*systolicWave;
}
function atrialPulse(phase){
  // 教學示意：心房在心室收縮前短暫收縮，血球迅速進入心室；不是實際瞬時流速曲線。
  return .08 + 13*Math.exp(-Math.pow((phase-.83)/.082,2));
}
function ventriclePulse(phase){
  // A brief but wide systolic impulse: move blood distinctly out through the great arteries.
  if(phase<.14||phase>.57)return .13;
  const rise=clamp((phase-.14)/.07,0,1);
  const fall=clamp((.57-phase)/.09,0,1);
  return .13+5.2*Math.min(rise,fall);
}
function ejectVentricularParticles(){
  const phase=heartBeatPhase();
  if(phase<state.prevEjectionPhase)state.ejectionReady=true;
  state.prevEjectionPhase=phase;
  if(!state.ejectionReady||phase<.16)return;
  state.ejectionReady=false;
  // Only RBCs located in the ventricular half of each chamber transition to
  // the outgoing vessel. They never vanish; their segment assignment advances.
  for(const p of state.particles){
    const id=p.seg.id;
    if(id!=='ra-rv'&&id!=='la-lv')continue;
    if(p.dist/Math.max(p.seg.length,1)<.47)continue;
    const outlet=edges.get(id==='ra-rv'?'rv-pulmonary':'lv-aorta');
    if(!outlet)continue;
    p.seg=outlet;
    p.dist=rnd(0,Math.min(9,outlet.length*.11));
    rbcPosition(p);
  }
}
function flowSpeedAt(seg,phase){
  const basic=FLOW_PX_PER_SECOND[seg.flowType]||FLOW_PX_PER_SECOND.vein;
  const frequencyScaling=Math.pow(state.bpm/60,.38);
  if(seg.flowType==='atrium')return basic*frequencyScaling*atrialPulse(phase);
  if(seg.flowType==='ejection')return basic*frequencyScaling*ventriclePulse(phase);
  if(seg.flowType==='artery')return basic*frequencyScaling*arteryPulse(phase);
  if(seg.flowType==='vein')return basic*frequencyScaling*(.97+.035*Math.sin(2*Math.PI*phase));
  // The same slow motion is used at whole-body scale and tissue zoom.
  return basic*frequencyScaling*(1+.025*Math.sin(2*Math.PI*phase));
}
function nextDisplaySegment(p){
  // Tracking is deliberately different: the chosen RBC traverses the actual
  // connected circulation, never jumps back to an inlet while followed.
  if(state.tracking&&p.id===state.tracked)return chooseSegment(p.seg.to);
  const zone=RBC_RUNTIME_ZONES[p.homeZone];
  if(!zone)return chooseSegment(p.seg.to);
  const following=choicesFrom(p.seg.to).filter(seg=>zone.ids.has(seg.id));
  if(following.length)return following[Math.floor(Math.random()*following.length)];
  // At the last branch of a zone, recycle a *display sample* to its zone inlet.
  // That prevents an ever-growing visual queue in capillary networks, without
  // speeding up a single capillary particle. A small fade hides this reset.
  p.displayFade=0;
  const starts=zone.entrySegments;
  return starts[Math.floor(Math.random()*starts.length)];
}
function updateRbc(p,dt){
  const phase=heartBeatPhase();
  // During ventricular contraction, AV valves are functionally closed.
  // RBCs still in the atrial segment do not keep entering the contracting
  // ventricle. This prevents new apparently stranded ventricular RBCs.
  if((p.seg.id==='ra-rv'||p.seg.id==='la-lv')&&phase>=.16&&phase<.59){
    const threshold=p.seg.length*.46;
    if(p.dist>=threshold){
      const out=edges.get(p.seg.id==='ra-rv'?'rv-pulmonary':'lv-aorta');
      if(out){p.seg=out;p.dist=rnd(0,Math.min(8,out.length*.09));}
    }else{
      p.dist=Math.min(threshold-1,p.dist+Math.max(0,flowSpeedAt(p.seg,phase)*dt*p.speed));
      p.age+=dt;rbcPosition(p);return;
    }
  }
  // 因分支尺度短，每次跨過一條邊就以新血管類型重新計算剩餘時間。
  let left=dt*p.speed,guard=0;
  while(left>0&&guard++<40){
    const speed=Math.max(1,flowSpeedAt(p.seg,phase));
    const remain=p.seg.length-p.dist;
    const timeToEnd=remain/speed;
    if(left<timeToEnd){p.dist+=speed*left;left=0;break;}
    left-=timeToEnd;
    p.seg=nextDisplaySegment(p);p.dist=0;
  }
  p.displayFade=Math.min(1,(p.displayFade??1)+dt*2.2);
  p.age+=dt;rbcPosition(p);
}

function drawRbc(x,y,oxygen,diam=4,alpha=1,simple=false){
  ctx.globalAlpha=alpha;
  ctx.fillStyle=oxygenColor(oxygen);
  ctx.beginPath();ctx.ellipse(x,y,diam*1.4,diam,0,0,Math.PI*2);ctx.fill();
  if(!simple){ctx.fillStyle='rgba(80,0,25,.15)';ctx.beginPath();ctx.ellipse(x,y,diam*.65,diam*.42,0,0,Math.PI*2);ctx.fill();}
  ctx.globalAlpha=1;
}
function drawReticle(p){
  const r=17+2*Math.sin(state.clock*6);
  ctx.save();ctx.strokeStyle='#e9a43a';ctx.lineWidth=2.5;ctx.setLineDash([5,4]);
  ctx.beginPath();ctx.arc(p.x,p.y,r,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);
  ctx.beginPath();for(const a of [0,Math.PI/2,Math.PI,Math.PI*1.5]){
    ctx.moveTo(p.x+Math.cos(a)*(r-2),p.y+Math.sin(a)*(r-2));
    ctx.lineTo(p.x+Math.cos(a)*(r+7),p.y+Math.sin(a)*(r+7));
  }ctx.stroke();
  if(p.id===state.tracked){
    const text=oxygenPercent(p)>.55?'含氧較多':'含氧較少';
    ctx.font='bold 13px sans-serif';const tw=ctx.measureText(text).width;
    ctx.fillStyle='#173e49';roundRect(ctx,p.x-tw/2-10,p.y-r-35,tw+20,24,7);ctx.fill();
    ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#fff';ctx.fillText(text,p.x,p.y-r-23);
  }
  ctx.restore();
}
function roundRect(c,x,y,w,h,r){c.beginPath();if(c.roundRect)c.roundRect(x,y,w,h,r);else c.rect(x,y,w,h);}
function drawHeart(){
  const phase=(state.clock%(60/state.bpm))/(60/state.bpm);
  const atria=Math.exp(-Math.pow((phase-.83)/.085,2));
  const ventricles=Math.exp(-Math.pow((phase-.28)/.115,2));
  for(const ch of hearts){
    const ventricular=ch.id==='rv'||ch.id==='lv';
    const s=1-(ventricular?.075*ventricles:.045*atria);
    ch.group.setAttribute('transform',`translate(${ch.x} ${ch.y}) scale(${s.toFixed(3)}) translate(${-ch.x} ${-ch.y})`);
  }
  if(heartShell){
    const visible=state.heartOpacity==='half';
    heartShell.setAttribute('fill-opacity',visible?'.12':'0');
    heartShell.setAttribute('stroke-opacity',visible?'.43':'0');
    const s=1-.026*ventricles;
    heartShell.parentNode.setAttribute('transform',`translate(560 435) scale(${s.toFixed(3)}) translate(-560 -435)`);
  }
  // 房室瓣在充盈期相對開啟，半月瓣在心室收縮期相對開啟（教學簡化）。
  valves.forEach(v=>{v.group.setAttribute('opacity',v.kind==='av'?(phase>.48?'.8':'.18'):(phase<.44?'.8':'.18'));v.group.style.display='block';});
  heartShape.style.display='block';
}
function paintCirculation(dt){
  ctx.clearRect(0,0,W,H);drawHeart();labelLayer.style.display=(state.labels&&state.view==='circulation')?'block':'none';
  ejectVentricularParticles();

  for(const k of Object.keys(state.capCooldown))state.capCooldown[k]=Math.max(0,state.capCooldown[k]-dt);
  const simple=state.count>500;
  const dotSize=state.count>900?2.15:state.count>500?2.5:state.count>250?3.25:4.2;
  let focusedRbc=null;
  for(const p of state.particles){
    updateRbc(p,dt);
    const isTarget=state.tracking&&p.id===state.tracked;
    if(isTarget)focusedRbc=p;
    // 全不透明時的心臟外型是遮罩，內部血球仍依正確節奏運動，但不顯示。
    let alpha=.89;
    // Occlude only the RBCs physically behind a foreground vessel at a crossing.
    // Elsewhere the circulating RBCs remain visible along the entire vein.
    const zones=!isTarget?crossingOcclusion.get(p.seg.id):null;
    if(zones){
      for(const zone of zones){
        if(Math.abs(p.x-zone.x)>zone.upperWidth+17||Math.abs(p.y-zone.y)>zone.upperWidth+17)continue;
        for(const [x,y] of zone.points){
          if(Math.hypot(p.x-x,p.y-y)<=zone.upperWidth/2+1){alpha=0;break;}
        }
        if(alpha===0)break;
      }
    }
    // The display tracer fades only where its zone recycles; no data cell
    // is deleted and a tracked cell remains fully visible along the circuit.
    if(!isTarget)alpha*=p.displayFade??1;
    // Vanish gradually just before a display-only tracer reaches its zone
    // outlet. Re-entry likewise fades in, instead of visibly teleporting.
    if(!(state.tracking&&p.id===state.tracked)){
      const home=RBC_RUNTIME_ZONES[p.homeZone];
      if(home&&!choicesFrom(p.seg.to).some(seg=>home.ids.has(seg.id))){
        const blend=Math.min(12,Math.max(3,p.seg.length*.45));
        alpha*=clamp((p.seg.length-p.dist)/blend,0,1);
      }
    }
    // 被追蹤的血球最後再獨立繪製，避免其他血球或展示遮擋把它蓋掉。
    if(!isTarget)drawRbc(p.x,p.y,oxygenPercent(p),dotSize,alpha,simple);
    // 主圖的小型 O₂ 交換：綁定流經微血管的血球，只呈現少量事件。
    if(p.seg.flowType==='capillary'&&state.count>0&&
       (state.view!=='tissue'||p.seg.bed==='abd-bed')&&
       (state.capCooldown[p.seg.bed]??0)<=0&&state.capillaryMolecules.length<16){
      addWholeBodyOxygen(p);
      state.capCooldown[p.seg.bed]=rnd(.32,.65);
    }
  }
  paintWholeBodyOxygen(dt);
  if(state.tracking){
    // 不可用其他血球取代正在追蹤的身分；監看中保持連續可見。
    const p=focusedRbc;
    if(p){
      drawRbc(p.x,p.y,oxygenPercent(p),dotSize*1.2,1,false);
      drawReticle(p);
      if(!state.cameraFlight){
        const z=Math.max(fitTarget().zoom*2.55,1.36);
        state.panX=mix(state.panX,stage.clientWidth/2-p.x*state.zoom,.14);
        state.panY=mix(state.panY,stage.clientHeight/2-p.y*state.zoom,.14);
        updateTransform();
      }
    }
  }
}
// 使 O₂ 依濃度差從血管擴散至組織，或由肺泡擴散進血管。
// 數量刻意保持很少，避免全身圖被氣體文字淹沒。
function addWholeBodyOxygen(p){
  const seg=p.seg,bed=seg.bed;
  let tx=p.x,ty=p.y;
  const distance=state.view==='tissue'?rnd(8,15):rnd(24,39);
  if(seg.kind==='capSystem'){
    // 組織：氧氣由管腔出發，向周圍組織擴散，逐漸淡出。
    const sign=bed==='head-bed'?1:bed==='leg-bed'?-1:(Math.random()<.5?-1:1);
    ty+=sign*distance;
    tx+=rnd(-19,19);
    state.capillaryMolecules.push({fromX:p.x,fromY:p.y,toX:tx,toY:ty,t:0,kind:'out'});
    // 組織持續消耗氧氣、產生二氧化碳，CO₂ 從組織擴散回血管。
    if(state.view==='tissue')state.capillaryMolecules.push({fromX:tx+rnd(-6,6),fromY:ty+rnd(-5,5),toX:p.x+rnd(-3,3),toY:p.y+rnd(-3,3),t:0,kind:'co2'});
  }else{
    // 肺：氧氣從肺泡側（管外）擴散到微血管，最後淡出。
    const sign=bed==='left-lung-bed'?-1:1;
    state.capillaryMolecules.push({fromX:p.x+sign*distance,fromY:p.y+rnd(-11,11),toX:p.x,toY:p.y,t:0,kind:'in'});
    state.capillaryMolecules.push({fromX:p.x+sign*(distance+rnd(-5,5)),fromY:p.y+rnd(-13,13),toX:p.x+rnd(-3,3),toY:p.y+rnd(-3,3),t:0,kind:'in'});
  }
}
let tissueGasLayer=null, tissueGasPool=[];
function tissueGasText(index){
  if(!tissueGasLayer)tissueGasLayer=SVG('g',{id:'tissueGasLabels','pointer-events':'none'},$('labelOverlay'));
  while(tissueGasPool.length<=index){
    const t=SVG('text',{'text-anchor':'middle','dominant-baseline':'middle','font-family':'system-ui, sans-serif','font-size':'9.5','font-weight':'900','paint-order':'stroke','stroke':'#fff','stroke-width':'1.45','stroke-linejoin':'round'},tissueGasLayer);
    tissueGasPool.push(t);
  }
  return tissueGasPool[index];
}
function paintWholeBodyOxygen(dt){
  const magnified=state.view==='tissue';
  if(tissueGasLayer)tissueGasLayer.style.display=magnified?'':'none';
  let used=0;
  for(let i=state.capillaryMolecules.length-1;i>=0;i--){
    const m=state.capillaryMolecules[i];m.t+=dt/.94;
    if(m.t>=1){state.capillaryMolecules.splice(i,1);continue;}
    const k=m.t*m.t*(3-2*m.t),alpha=magnified?(m.t<.72?.98:Math.max(.13,.98*(1-m.t)/.28)):.86*Math.pow(1-m.t,.62);
    const x=mix(m.fromX,m.toX,k),y=mix(m.fromY,m.toY,k);
    const co2=m.kind==='co2',glyph=co2?'CO₂':'O₂';
    if(magnified){
      // Real SVG vector text stays sharp when the original mesh is zoomed.
      const t=tissueGasText(used++);t.textContent=glyph;
      t.setAttribute('x',x.toFixed(2));t.setAttribute('y',y.toFixed(2));
      t.setAttribute('opacity',alpha.toFixed(3));t.setAttribute('fill',co2?'#c98a09':'#0d789c');
    }else{
      ctx.save();ctx.globalAlpha=alpha;ctx.font='750 12px system-ui, sans-serif';
      ctx.textAlign='center';ctx.textBaseline='middle';ctx.lineWidth=2.7;ctx.lineJoin='round';
      ctx.strokeStyle='#fff';ctx.strokeText(glyph,x,y);
      ctx.fillStyle=co2?'#bc7c0b':'#137caa';ctx.fillText(glyph,x,y);ctx.restore();
    }
  }
  if(magnified)for(let i=used;i<tissueGasPool.length;i++)tissueGasPool[i].setAttribute('opacity','0');
}

function buildMicroState(){
  state.microRbcs=Array.from({length:24},(_,i)=>({t:i/24,offset:rnd(-3.3,3.3),lane:i%7,size:rnd(4.5,5.8)}));
  state.gas=Array.from({length:5},(_,i)=>{
    const a=i*2.399+.3,r=45+Math.sqrt((i+1)/6)*95;
    return {x:Math.cos(a)*r,y:Math.sin(a)*r,drift:rnd(-.2,.2),kind:i===4?'co2':'o2',age:0};
  });
  state.airflow=[];state.exchange=[];state.exchangeClock=0;state.exchangeSeq=0;state.breathCycle=-1;
}
function spawnMolecule(x,y,tx,ty,kind){
  if(state.exchange.length>=12)return;
  state.exchange.push({x,y,tx,ty,t:0,kind});
}
function molecules(dt){
  for(let i=state.exchange.length-1;i>=0;i--){
    const m=state.exchange[i];m.t+=dt*.73;
    if(m.t>=1){state.exchange.splice(i,1);continue;}
    const k=m.t*m.t*(3-2*m.t);
    const x=mix(m.x,m.tx,k),y=mix(m.y,m.ty,k);
    drawMoleculeText(x,y,m.kind,.90*Math.pow(1-m.t,.72));
  }
}
function drawMoleculeText(x,y,kind,alpha=1){
  const glyph=kind==='o2'?'O₂':kind==='co2'?'CO₂':'葡萄糖';
  ctx.save();ctx.globalAlpha=alpha;
  ctx.font=kind==='glucose'?'bold 14px system-ui, sans-serif':'bold 19px system-ui, sans-serif';
  ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.lineWidth=3.5;ctx.strokeStyle='#fff';ctx.lineJoin='round';
  ctx.strokeText(glyph,x,y);ctx.fillStyle=kind==='o2'?'#168cba':kind==='co2'?'#ad741b':'#238d64';ctx.fillText(glyph,x,y);
  ctx.restore();
}
function drawMicroLabel(x,y,t,accent='#315b68'){
  ctx.font='800 22px system-ui, sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
  const width=ctx.measureText(t).width+26;
  ctx.fillStyle='#fffffff0';roundRect(ctx,x-width/2,y-22,width,44,12);ctx.fill();
  ctx.strokeStyle='#d4e1e4';ctx.lineWidth=1.3;ctx.stroke();
  ctx.fillStyle=accent;ctx.fillText(t,x,y);
}
function drawMicroBackground(){
  ctx.fillStyle='#f4f9fa';ctx.fillRect(0,0,W,H);
  ctx.strokeStyle='rgba(167,202,210,.2)';ctx.lineWidth=1;
  for(let x=30;x<W;x+=48){for(let y=24;y<H;y+=48){ctx.beginPath();ctx.arc(x,y,1.1,0,Math.PI*2);ctx.stroke();}}
}
function tissueCells(){
  for(let side of [0,1])for(let i=0;i<8;i++){
    const x=115+i*125+(side?18:0),y=side?544:187;
    const w=105,h=116;
    ctx.fillStyle='#f0eefa';ctx.strokeStyle='#c7bedf';ctx.lineWidth=1.5;
    ctx.beginPath();ctx.ellipse(x,y,w*.49,h*.48,.10,0,Math.PI*2);ctx.fill();ctx.stroke();
    ctx.fillStyle='#b7a9d7';ctx.beginPath();ctx.ellipse(x+9,y-5,15,19,.2,0,Math.PI*2);ctx.fill();
    for(let k=0;k<3;k++){
      const a=k*2.2+state.clock*.12,rx=x-23+Math.cos(a)*9,ry=y+22+Math.sin(a)*8;
      ctx.fillStyle='#cfbfe5';ctx.beginPath();ctx.ellipse(rx,ry,13,5,a,0,Math.PI*2);ctx.fill();
    }
  }
}
function tissueLanePoint(lane,t){
  const x=160+780*t, k=(lane-3)/3;
  const offset=k*51*Math.sin(Math.PI*t);
  const wave=Math.sin(Math.PI*t)*Math.sin(t*5*Math.PI+lane*.65)*3;
  return {x,y:382+offset+wave};
}
function paintTissue(dt){
  ctx.clearRect(0,0,W,H);drawMicroBackground();tissueCells();
  // 兩端大血管連到七條真正的微血管分支，並有橫向側枝構成網狀結構。
  ctx.lineCap='round';ctx.lineJoin='round';
  const vesselStroke=(a,b,width,color)=>{ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.lineWidth=width;ctx.strokeStyle=color;ctx.stroke();};
  // 漸層血管：小動脈端較紅、小靜脈端較藍。
  const grad=ctx.createLinearGradient(160,0,940,0);grad.addColorStop(0,'#c1b3ae');grad.addColorStop(.5,'#b6b1ae');grad.addColorStop(1,'#c1b3ae');
  vesselStroke({x:48,y:382},{x:160,y:382},47,'#dbcecb');
  vesselStroke({x:940,y:382},{x:1050,y:382},47,'#dbcecb');
  for(let lane=0;lane<7;lane++){
    ctx.beginPath();for(let n=0;n<=100;n++){const p=tissueLanePoint(lane,n/100);if(n===0)ctx.moveTo(p.x,p.y);else ctx.lineTo(p.x,p.y);}
    ctx.strokeStyle='rgba(185,168,166,.33)';ctx.lineWidth=14;ctx.stroke();ctx.strokeStyle=grad;ctx.globalAlpha=.54;ctx.lineWidth=10;ctx.stroke();ctx.globalAlpha=1;
  }
  for(const tt of [.2,.33,.48,.62,.78])for(let lane=0;lane<6;lane++){
    const a=tissueLanePoint(lane,tt+(lane%2?.018:-.018)),b=tissueLanePoint(lane+1,tt+(lane%2?-.018:.018));
    vesselStroke(a,b,5.8,grad);
  }
  state.exchangeClock=Math.max(0,state.exchangeClock-dt);
  const speed=(state.bpm/60)*.017;
  for(const rbc of state.microRbcs){
    rbc.t=(rbc.t+dt*speed)%1;
    const pos=tissueLanePoint(rbc.lane,rbc.t);
    drawRbc(pos.x,pos.y+rbc.offset,1-clamp((rbc.t-.22)/.57,0,1),rbc.size,1);
    if(rbc.t>.25&&rbc.t<.77&&state.exchangeClock<=0&&Math.random()<.09){
      const up=Math.random()<.5,targetY=up?245:525;
      state.exchangeSeq++;
      if(state.exchangeSeq%4!==0)spawnMolecule(pos.x,pos.y,pos.x+rnd(-38,38),targetY,'o2');
      else spawnMolecule(pos.x,targetY,pos.x+rnd(-35,35),pos.y,'co2');
      state.exchangeClock=.41;
    }
  }
  molecules(dt);
  if(state.labels){
    drawMicroLabel(190,268,'組織細胞');drawMicroLabel(880,268,'細胞呼吸');
    drawMicroLabel(145,463,'小動脈端','#74686b');drawMicroLabel(950,463,'小靜脈端','#74686b');
    drawMicroLabel(548,381,'微血管網','#7d5e61');
  }
}
function paintAlveolus(dt){
  ctx.clearRect(0,0,W,H);drawMicroBackground();
  const cx=550,cy=372,period=6,cycle=state.clock/period,phase=cycle%1;
  const inhale=phase<.5,breath=Math.max(0,Math.min(1,(1-Math.cos(2*Math.PI*phase))/2));
  const r=169+31*breath; // 吸氣：擴張；吐氣：回縮
  // 支氣管連接肺泡，於呼氣顯示氣體往上被排出。
  ctx.lineCap='round';ctx.lineJoin='round';
  ctx.beginPath();ctx.moveTo(cx,6);ctx.lineTo(cx,132);ctx.quadraticCurveTo(cx,152,cx,cy-r+5);
  ctx.strokeStyle='#c0dce0';ctx.lineWidth=82;ctx.stroke();
  ctx.strokeStyle='#edf8fa';ctx.lineWidth=66;ctx.stroke();
  ctx.lineCap='butt';
  const brGrad=ctx.createRadialGradient(cx-30,cy-50,15,cx,cy,r);
  brGrad.addColorStop(0,'#fffaf0');brGrad.addColorStop(1,'#f7e3d1');
  ctx.fillStyle=brGrad;ctx.strokeStyle='#ddbcb0';ctx.lineWidth=6;
  ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.fill();ctx.stroke();
  for(let k=0;k<26;k++){
    const a=k*Math.PI/13,ax=cx+Math.cos(a)*(r+2),ay=cy+Math.sin(a)*(r+2);
    ctx.fillStyle='#f6e3b6';ctx.beginPath();ctx.arc(ax,ay,4.2,0,2*Math.PI);ctx.fill();
  }
  // 只顯示 O₂ / CO₂ 分子以比較方向：並未繪製占空氣多數的氮氣，不能據此推算空氣成分百分比。
  const cycleNum=Math.floor(cycle);
  if(cycleNum!==state.breathCycle){
    state.breathCycle=cycleNum;
    state.gas=Array.from({length:3},(_,i)=>{const a=i*2.40+.1,rr=43+Math.sqrt((i+1)/8)*103;
      return {x:Math.cos(a)*rr,y:Math.sin(a)*rr,kind:i===2?'co2':'o2',age:0};});
    state.airflow=[];
  }
  // 每次吸吐交替時，清楚地看見由支氣管往下的新氣體，以及往上排出的舊氣體。
  const win=inhale?(phase/.5):((phase-.5)/.5);
  const batch=inhale?['o2','o2','o2','o2']:['o2','o2','co2','co2'];
  for(let i=0;i<batch.length;i++){
    const t=(win-i*.13)/(.73);
    if(t<0||t>1)continue;
    const e=t*t*(3-2*t);
    const endX=cx+(i-1)*32,endY=cy-r*.46+((i%2)*18);
    const ax=inhale?mix(cx,endX,e):mix(endX,cx,e);
    const ay=inhale?mix(30+i*9,endY,e):mix(endY,-24-i*6,e);
    drawMoleculeText(ax,ay,batch[i],.9);
  }
  // 肺泡內只有少量的化學式，避免密集文字干擾辨識。
  for(const g of state.gas){
    g.age+=dt;
    const move=.035*Math.sin(state.clock*.8+g.x);
    const x=cx+g.x*(r/188)+Math.cos(g.age*.7)*move*70;
    const y=cy+g.y*(r/188)+Math.sin(g.age*.8)*move*70;
    if(y>cy-r*.81)drawMoleculeText(x,y,g.kind,.73);
  }
  // 外側毛細血管網隨呼吸略作彈性位移，紅血球沿弧線行進並獲得氧氣。
  const vascularR=r+34;
  const start=2.6,end=-.46;
  const grad=ctx.createLinearGradient(cx-vascularR,cy,cx+vascularR,cy);grad.addColorStop(0,'#c3b1ae');grad.addColorStop(.5,'#b9adaa');grad.addColorStop(1,'#c3b1ae');
  for(let lane=-1;lane<=1;lane++){
    ctx.beginPath();ctx.arc(cx,cy,vascularR+lane*13,end,start,false);
    ctx.strokeStyle='rgba(179,159,158,.30)';ctx.lineWidth=17;ctx.lineCap='round';ctx.stroke();
    ctx.strokeStyle=grad;ctx.globalAlpha=.62;ctx.lineWidth=11;ctx.stroke();ctx.globalAlpha=1;
  }
  for(let a=start-.21;a>end+.18;a-=.39){
    const x1=cx+Math.cos(a)*(vascularR-13),y1=cy+Math.sin(a)*(vascularR-13);
    const x2=cx+Math.cos(a+.11)*(vascularR+13),y2=cy+Math.sin(a+.11)*(vascularR+13);
    ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.strokeStyle='rgba(180,163,161,.55)';ctx.lineWidth=5;ctx.stroke();
  }
  ctx.lineCap='butt';
  const speed=(state.bpm/60)*.017;
  for(const cell of state.microRbcs){
    cell.t=(cell.t+speed*dt)%1;
    const theta=mix(start,end,cell.t);
    const rx=cx+Math.cos(theta)*(vascularR+(cell.lane%3-1)*13+cell.offset*.5);
    const ry=cy+Math.sin(theta)*(vascularR+(cell.lane%3-1)*13+cell.offset*.5);
    drawRbc(rx,ry,clamp((cell.t-.18)/.66,0,1),cell.size,1);
  }
  state.exchangeClock=Math.max(0,state.exchangeClock-dt);
  if(state.exchangeClock===0){
    const angle=rnd(.6,2.55),x0=cx+Math.cos(angle)*(r-24),y0=cy+Math.sin(angle)*(r-24);
    const bx=cx+Math.cos(angle)*(vascularR+3),by=cy+Math.sin(angle)*(vascularR+3);
    state.exchangeSeq++;
    if(state.exchangeSeq%4!==0)spawnMolecule(x0,y0,bx,by,'o2');
    else spawnMolecule(bx,by,x0,y0,'co2');
    state.exchangeClock=.42;
  }
  molecules(dt);
  if(state.labels){
    drawMicroLabel(550,103,inhale?'吸氣 ↓':'呼氣 ↑');
    drawMicroLabel(230,602,'肺動脈端','#74686b');drawMicroLabel(872,165,'肺靜脈端','#74686b');
  }
}
function syncTracking(){
  ui.track.textContent=`追蹤血球：${state.tracking?'開':'關'}`;
  ui.track.classList.toggle('enabled',state.tracking);
  ui.track.setAttribute('aria-pressed',String(state.tracking));
}
// 分頁飛入／飛出：先從全身圖運鏡到組織或肺泡，再與微觀圖交疊過渡。
function applyView(next){
  if(next==='tissue'&&state.view!=='tissue'){state.capillaryMolecules.length=0;state.capCooldown['abd-bed']=0;}
  state.view=next;
  const whole=next==='circulation';
  const actualVesselView=whole||next==='tissue';
  document.querySelectorAll('.tab').forEach(b=>{const on=b.dataset.view===next;b.classList.toggle('active',on);b.setAttribute('aria-pressed',on);});
  switchWhole(actualVesselView);
  // Organ outlines appear only for relevant route tasks, never in observation.
  window.setTeachingOrgans({});
  diagram.classList.toggle('tissue-zoomed',next==='tissue');
  showInterstitial(next==='tissue');
  ui.countControl.classList.toggle('hidden',!whole);
  ui.heartControl.classList.toggle('hidden',!whole);
  ui.track.classList.toggle('hidden',!whole);
  ui.legend.classList.toggle('hidden',whole);
  ui.sugar.classList.toggle('hidden',next!=='tissue');
  ui.sugarLabel.classList.add('hidden');
  state.tracking=false;state.tracked=null;syncTracking();
  document.querySelector('.state-swatch').classList.toggle('hidden',!whole);
  buildMicroState();
}
async function setView(next){
  if(state.transitionBusy||next===state.view)return;
  state.transitionBusy=true;stage.classList.add('transitioning');
  try{
    const old=state.view;
    // Tissue view is the SAME abdominal mesh at higher magnification; no
    // screenshot crossfade, new mesh, or substituted RBCs.
    if(old==='circulation'&&next==='tissue'){
      state.tracking=false;state.tracked=null;syncTracking();
      await flyCamera(tissueTarget(),1060);
      applyView('tissue');
    }else if(old==='tissue'&&next==='circulation'){
      applyView('circulation');
      await flyCamera(fitTarget(),920);
    }else if(old==='circulation'){
      state.tracking=false;syncTracking();
      await flyCamera(targetAt(772,336,Math.max(1.8,fitTarget().zoom*2.6)),780);
      const snap=snapshot();applyView(next);applyCamera(fitTarget());
      await fadeSnapshot(snap,480);
    }else if(next==='circulation'){
      const snap=snapshot();applyView(next);
      applyCamera(targetAt(772,336,Math.max(1.8,fitTarget().zoom*2.6)));
      await Promise.all([flyCamera(fitTarget(),890),fadeSnapshot(snap,650)]);
    }else{
      const snap=snapshot();applyView(next);applyCamera(fitTarget());
      await fadeSnapshot(snap,690);
    }
  }finally{stage.classList.remove('transitioning');state.transitionBusy=false;}
}

function connectControls(){
  document.querySelectorAll('.tab').forEach(btn=>btn.addEventListener('click',()=>setView(btn.dataset.view)));
  ui.count.addEventListener('change',()=>{
    state.count=clamp(Number.isFinite(Number(ui.count.value))?Math.round(Number(ui.count.value)):800,0,1600);
    ui.count.value=state.count;resetRbc();
  });
  ui.bpm.addEventListener('input',()=>{state.bpm=Number(ui.bpm.value);ui.bpmText.textContent=state.bpm;});
  ui.heartOpacity.addEventListener('change',()=>{state.heartOpacity=ui.heartOpacity.value;});
  for(const [btn,key,name] of [[ui.labels,'labels','構造標籤']]){
    btn.addEventListener('click',()=>{
      state[key]=!state[key];btn.textContent=`${name}：${state[key]?'開':'關'}`;
      btn.classList.toggle('enabled',state[key]);btn.setAttribute('aria-pressed',String(state[key]));
    });
  }
  ui.track.addEventListener('click',()=>{
    if(state.transitionBusy||state.view!=='circulation')return;
    if(!state.tracking){
      if(!state.particles.length)return;
      const p=state.particles[Math.floor(Math.random()*state.particles.length)];
      state.tracking=true;state.tracked=p.id;
      // 若剛好選到正在進行展示回繞的血球，也要立即恢復可見。
      p.displayFade=1;
      flyCamera(targetAt(p.x,p.y,Math.max(1.38,fitTarget().zoom*2.55)),740);
    }else{
      state.tracking=false;state.tracked=null;
      flyCamera(fitTarget(),780); // zoom out 回到全體適應視野
    }
    syncTracking();
  });
  $('zoomIn').addEventListener('click',()=>setZoom(state.zoom*1.18));
  $('zoomOut').addEventListener('click',()=>setZoom(state.zoom/1.18));
  $('zoomReset').addEventListener('click',()=>resetView());
  $('zoomFit').addEventListener('click',()=>fit());
  stage.addEventListener('wheel',e=>{
    e.preventDefault();if(state.transitionBusy)return;
    state.tracking=false;state.tracked=null;syncTracking();stopFlight();
    const r=stage.getBoundingClientRect();setZoom(state.zoom*(e.deltaY<0?1.12:1/1.12),e.clientX-r.left,e.clientY-r.top);
  },{passive:false});
  // Pointer Events 包含滑鼠、觸控筆、單指拖曳與雙指縮放。
  const pointers=new Map();let dragOrigin=null,pinchOrigin=null;
  stage.addEventListener('pointerdown',e=>{
    if(window.BloodRoute?.active)return;
    if(e.target.closest('.zoom-stack')||state.transitionBusy)return;
    if(e.pointerType==='mouse'&&e.button!==0)return;
    stage.setPointerCapture(e.pointerId);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(pointers.size===1){dragOrigin={x:e.clientX,y:e.clientY,panX:state.panX,panY:state.panY,moved:false};pinchOrigin=null;}
    if(pointers.size===2){
      const [a,b]=[...pointers.values()];
      pinchOrigin={distance:Math.hypot(a.x-b.x,a.y-b.y),zoom:state.zoom,panX:state.panX,panY:state.panY};
      dragOrigin=null;
    }
    stage.classList.add('dragging');
  });
  stage.addEventListener('pointermove',e=>{
    if(!pointers.has(e.pointerId))return;
    pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(pointers.size===2&&pinchOrigin){
      const [a,b]=[...pointers.values()];
      const r=stage.getBoundingClientRect();const cx=(a.x+b.x)/2-r.left,cy=(a.y+b.y)/2-r.top;
      const z=clamp(pinchOrigin.zoom*Math.hypot(a.x-b.x,a.y-b.y)/Math.max(1,pinchOrigin.distance),.24,4.5);
      state.panX=cx-(cx-pinchOrigin.panX)*z/pinchOrigin.zoom;
      state.panY=cy-(cy-pinchOrigin.panY)*z/pinchOrigin.zoom;
      state.zoom=z;state.tracking=false;state.tracked=null;syncTracking();stopFlight();updateTransform();
    }else if(pointers.size===1&&dragOrigin){
      const dx=e.clientX-dragOrigin.x,dy=e.clientY-dragOrigin.y;
      if(Math.hypot(dx,dy)>5){dragOrigin.moved=true;state.tracking=false;state.tracked=null;syncTracking();stopFlight();}
      if(dragOrigin.moved){state.panX=dragOrigin.panX+dx;state.panY=dragOrigin.panY+dy;updateTransform();}
    }
  });
  const release=e=>{
    if(!pointers.has(e.pointerId))return;
    pointers.delete(e.pointerId);
    if(pointers.size===1){const p=[...pointers.values()][0];dragOrigin={x:p.x,y:p.y,panX:state.panX,panY:state.panY,moved:true};pinchOrigin=null;}
    if(!pointers.size){stage.classList.remove('dragging');dragOrigin=null;pinchOrigin=null;}
  };
  stage.addEventListener('pointerup',release);stage.addEventListener('pointercancel',release);
  stage.addEventListener('keydown',e=>{
    if(e.key==='+'||e.key==='='){setZoom(state.zoom*1.16);e.preventDefault();}
    if(e.key==='-'){setZoom(state.zoom/1.16);e.preventDefault();}
    if(e.key==='0'){fit();e.preventDefault();}
  });
  let lastWidth=0,lastHeight=0;
  new ResizeObserver(entries=>{
    const r=entries[0].contentRect;
    if(Math.abs(r.width-lastWidth)>3||Math.abs(r.height-lastHeight)>3){
      lastWidth=r.width;lastHeight=r.height;if(!state.tracking&&!state.transitionBusy&&!state.cameraFlight)fit();
    }
  }).observe(stage);
}
let lastFrame=0;
function animate(now){
  const dt=lastFrame?Math.min((now-lastFrame)/1000,.055):.016;lastFrame=now;state.clock+=dt;
  tickCamera(now);
  if(!state.running){requestAnimationFrame(animate);return;}
  if(state.view==='circulation'||state.view==='tissue')paintCirculation(dt);
  else paintAlveolus(dt);
  requestAnimationFrame(animate);
}
function init(){
  createNetwork();buildInterstitialCells();connectControls();resetRbc();buildMicroState();fit();requestAnimationFrame(animate);
  if('serviceWorker'in navigator&&location.protocol!=='file:'){
    window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
  }
  window.__circulationQA={state,edges,setView,fit,fitTarget,bedGroups,flowSpeedAt,arteryPulse,atrialPulse,ventriclePulse,oxygenPercent,interstitialLayer:()=>interstitialLayer,tissueTarget,
    // Small deterministic step for regression checks of long-run regional occupancy.
    diagnosticAdvance:(seconds,dt=1/30)=>{for(let t=0;t<seconds;t+=dt){state.clock+=dt;ejectVentricularParticles();for(const p of state.particles)updateRbc(p,dt);}},
    diagnosticTracked:()=>{const p=state.particles.find(p=>p.id===state.tracked);return p?{id:p.id,segment:p.seg.id,bed:p.seg.bed||null,dist:p.dist,x:p.x,y:p.y,displayFade:p.displayFade}:null;},
    resetRbcForQA:resetRbc,
    diagnosticZones:()=>{const zones={};for(const p of state.particles){const z=p.seg.bed||p.seg.flowType;zones[z]=(zones[z]||0)+1;}return zones;},
    diagnosticDisplayZones:()=>{const zones={};for(const p of state.particles){const z=RBC_RUNTIME_ZONES[p.homeZone]?.name||'追蹤';zones[z]=(zones[z]||0)+1;}return zones;},
    flowSettings:FLOW_PX_PER_SECOND
  }; // 僅供自動測試與問題排查
}
init();
})();
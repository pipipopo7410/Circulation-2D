(() => {
'use strict';
const $ = id => document.getElementById(id);
const app=document.querySelector('.app'), frame=$('advancedFrame'), loading=$('advancedLoading');
const btn=$('toAdvanced'), original=$('toObserve'), route=$('toRoute');
let activated=false, loaded=false, ready=false, wantPlaying=true;
const standalone=!!$('advancedPayload');
const paused=()=>!app.classList.contains('advanced-active');
function syncPlayUi(){const b=$('advancedPlay');b.textContent=wantPlaying?'Ⅱ 暫停':'▶ 繼續';b.classList.toggle('enabled',wantPlaying);b.setAttribute('aria-pressed',String(wantPlaying));}
function showGuide(v){if(!v||!v.key){$('advancedGuideStatus').style.visibility='hidden';$('advancedGuideSideText').textContent='可拖曳或縮放，探索任何血管';return;}
 $('advancedGuideStatus').style.visibility='visible';
 $('advancedGuideName').textContent=v.name+'｜單顆血球';
 $('advancedGuidePhase').textContent=v.phase;
 $('advancedGuideProgress').style.width=v.percent+'%';
 $('advancedGuideSideText').textContent=v.done?'路徑已完成，可重新播放':v.key==='heart'?'右心房 → 肺 → 左心室':'左心房 → '+v.name+' → 肺 → 左心房';
}

function bridge(){try{return frame.contentWindow?.Blood2DM2Bridge||null;}catch(e){return null;}}
function controlsEnabled(on){document.querySelectorAll('.advanced-controls input,.advanced-controls button,.advanced-controls select').forEach(el=>el.disabled=!on);}
function syncControls(){const m=bridge();if(!m||!m.ready())return false;
 ready=true;loaded=true;loading.hidden=true;controlsEnabled(true);
 m.setCount(+$('advancedCount').value);m.setSpeed(+$('advancedSpeed').value);m.setMode('oxygen');
 m.setThreeLanes(true);m.setPlaying(!paused()&&wantPlaying);
 if(!paused()){const current=document.querySelector('.adv-zone.active')?.dataset.advancedZone;if(current)m.startGuide(current);else m.freeExplore();}
 showGuide(m.guideState());setFollowUi(m.following());return true;
}
function loadAdvanced(){if(loaded)return;
 loading.hidden=false;
 if(standalone){
   const encoded=$('advancedPayload').textContent.trim();
   frame.srcdoc=new TextDecoder('utf-8').decode(Uint8Array.from(atob(encoded),ch=>ch.charCodeAt(0)));
 }else frame.src='./advanced.html';
 loaded=true;
}
function resetNavButtons(){
 for(const [b,active] of [[original,false],[route,false],[btn,true]]){
  b.classList.toggle('selected',active);b.setAttribute('aria-pressed',String(active));
 }
}
function enter(){
 if(window.BloodRoute?.active)original.click();
 if(app.classList.contains('advanced-active'))return;
 activated=true;app.classList.add('advanced-active');
 frame.hidden=false;
 loading.hidden=!(!ready);
 window.__circulationQA?.state&&(window.__circulationQA.state.running=false);
 resetNavButtons();
 $('zoomReset').textContent='⌖';
 if(!loaded)loadAdvanced();
 else if(bridge()){bridge().setPlaying(wantPlaying);const key=document.querySelector('.adv-zone.active')?.dataset.advancedZone;if(key)bridge().startGuide(key);else bridge().freeExplore();}
}
function exit(){if(!app.classList.contains('advanced-active'))return;
 app.classList.remove('advanced-active');frame.hidden=true;loading.hidden=true;
 bridge()?.setPlaying(false);$('zoomReset').textContent=`${Math.round((window.__circulationQA?.state.zoom||1)*100)}%`;btn.classList.remove('selected');btn.setAttribute('aria-pressed','false');
}
btn.addEventListener('click',enter);
// Leave existing v2.3 route/observation handlers untouched.
original.addEventListener('click',exit,true);
route.addEventListener('click',exit,true);
frame.addEventListener('load',()=>{syncControls();});
window.addEventListener('message',e=>{if(e.source!==frame.contentWindow)return;
 if(e.data?.type==='blood2d:m2-ready')syncControls();
 if(e.data?.type==='blood2d:guide-progress')showGuide(e.data);
});
function command(fn){const m=bridge();if(m&&ready)fn(m);}
// Match the baseline heart-rate slider: live value label, throttled particle reseeding.
function bindCountSlider(sliderId,labelId,change){
 const input=$(sliderId),output=$(labelId);let last=-Infinity,timer=null;
 const commit=()=>{clearTimeout(timer);timer=null;last=performance.now();change(Number(input.value));};
 input.addEventListener('input',()=>{
  output.textContent=input.value;
  if(performance.now()-last>85)commit();
  else{clearTimeout(timer);timer=setTimeout(commit,92);}
 });
 input.addEventListener('change',()=>{output.textContent=input.value;commit();});
}
bindCountSlider('advancedCount','advancedCountText',v=>command(m=>m.setCount(v)));
// Baseline engine already listens for `change`; don't redispatch from the same change listener.
(()=>{const input=$('cellCount'),output=$('cellCountText');let last=-Infinity,timer=null;
 function commit(){clearTimeout(timer);timer=null;last=performance.now();input.dispatchEvent(new Event('change',{bubbles:true}));}
 input.addEventListener('input',()=>{output.textContent=input.value;
  if(performance.now()-last>85)commit();else{clearTimeout(timer);timer=setTimeout(commit,92);}
 });
 input.addEventListener('change',()=>{output.textContent=input.value;});
})();
$('advancedSpeed').addEventListener('input',e=>{$('advancedSpeedText').textContent=Number(e.target.value).toFixed(1);command(m=>m.setSpeed(Number(e.target.value)));});
$('advancedPlay').addEventListener('click',()=>{wantPlaying=!wantPlaying;syncPlayUi();command(m=>m.setPlaying(wantPlaying));});
function setFollowUi(enabled){const b=$('advancedFollow');b.textContent=`追蹤血球：${enabled?'開':'關'}`;b.classList.toggle('enabled',enabled);b.setAttribute('aria-pressed',String(enabled));}
function selectGuideButton(button){document.querySelectorAll('[data-advanced-zone]').forEach(x=>{const yes=x===button;x.classList.toggle('active',yes);x.setAttribute('aria-pressed',String(yes));});const free=$('advancedFreeObserve');free.classList.toggle('enabled',!button);free.setAttribute('aria-pressed',String(!button));}
$('advancedFollow').addEventListener('click',()=>command(m=>{if(!m.following()){m.stopGuide();selectGuideButton(null);}const now=m.setFollow(!m.following());setFollowUi(now);showGuide(m.guideState());if(now){$('advancedFreeObserve').classList.remove('enabled');$('advancedFreeObserve').setAttribute('aria-pressed','false');}else{$('advancedFreeObserve').classList.add('enabled');$('advancedFreeObserve').setAttribute('aria-pressed','true');}}));
$('advancedFreeObserve').addEventListener('click',()=>{selectGuideButton(null);setFollowUi(false);command(m=>{m.freeExplore();m.setPlaying(wantPlaying);showGuide(m.guideState());});});

document.querySelectorAll('[data-advanced-zone]').forEach(b=>b.addEventListener('click',()=>{selectGuideButton(b);command(m=>{m.startGuide(b.dataset.advancedZone);m.setPlaying(true);});wantPlaying=true;syncPlayUi();setFollowUi(false);}));
// Reuse the ORIGINAL zoom buttons and intercept only during the advanced mode.
for(const [id,action] of [['zoomIn','zoomIn'],['zoomOut','zoomOut'],['zoomReset','zoomReset'],['zoomFit','zoomReset']]){
  $(id).addEventListener('click',e=>{if(!app.classList.contains('advanced-active'))return;
   e.preventDefault();e.stopImmediatePropagation();
   if(id==='zoomFit'){command(m=>m.zoomReset());}
   else command(m=>m[action]());
  },true);
}
// Avoid native viewport pan in the parent while interacting with iframe.
controlsEnabled(false);
window.Blood2DIntegrated={enterAdvanced:enter,exitAdvanced:exit,ready:()=>ready,active:()=>app.classList.contains('advanced-active'),advanced:()=>bridge()};
})();

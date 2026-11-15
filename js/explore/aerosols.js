/* ORBEATS Explore: the interactive aerosol sound map (SVS 5669).
 *
 * Written by Reem (the script inside her
 * experiences/aerosol-sound-map.html). The tones, the color scoring, the
 * wording and the controls are hers, unchanged. Only the wiring was adapted:
 *   - it was a separate page in an <iframe>; it now runs inside the Explore
 *     viewer, in a function scope, as ORBEATS_EXPLORE.aerosols(root, host)
 *   - element ids have the prefix "aero-" so they cannot clash with the site
 *   - the image was embedded in her page as base64; it is now a lossless WebP
 *     with exactly the same pixels, loaded only when the experience is opened
 *   - the tones play through the site's shared AudioContext (host.audio()), so
 *     the Audio switch, the now-playing volume and the level meter all apply
 *   - the iframe messages (start, stop, volume, state) became the returned
 *     functions and host.onState(enabled)
 */
(function () {
'use strict';
window.ORBEATS_EXPLORE = window.ORBEATS_EXPLORE || {};
window.ORBEATS_EXPLORE.aerosols = function (root, host) {
const $=id=>root.querySelector('#aero-'+id);
const KEYS=['carbon','dust','salt','sulfate'];
// Edit these frequencies, waveform types and harmonics to change the instruments.
const TONES={
 carbon:{name:'Black carbon',hz:130.8128,type:'sine',harmonic:2,harmonicGain:.30},
 dust:{name:'Dust',hz:195.9977,type:'triangle',harmonic:2,harmonicGain:.12},
 salt:{name:'Sea salt',hz:329.6276,type:'sine',harmonic:3,harmonicGain:.12},
 sulfate:{name:'Sulfate',hz:523.2511,type:'sine',harmonic:2,harmonicGain:.22}
};
const image=$('image'),map=$('map'),canvas=document.createElement('canvas'),pixel=canvas.getContext('2d',{willReadFrequently:true});
let ready=false,enabled=false,active=false,audio=null,master=null,voices={},point=[.5,.5],levels={carbon:0,dust:0,salt:0,sulfate:0},preview=null,previewTimer=null,lastAnnounce=0;
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
function colorStrength(r,g,b){
 const hi=Math.max(r,g,b),lo=Math.min(r,g,b),chroma=hi-lo;
 const out={carbon:0,dust:0,salt:0,sulfate:0};
 if(hi<.12||chroma<.035)return out;
 let hue=0;if(hi===r)hue=60*((g-b)/chroma%6);else if(hi===g)hue=60*((b-r)/chroma+2);else hue=60*((r-g)/chroma+4);hue=(hue+360)%360;
 const affinity=(target,width)=>{let d=Math.abs(hue-target);d=Math.min(d,360-d);return Math.exp(-.5*(d/width)**2);};
 // The rendered colors are composited with a basemap: these are visual scores,
 // not aerosol optical depth or calibrated physical concentrations.
 if(r>g*1.20&&r>b*1.25)out.carbon=clamp(chroma/.52)*affinity(14,30);
 if(r>g*1.05&&b>g*1.08)out.dust=clamp(chroma/.24)*affinity(278,38);
 if(g>r*1.14&&g>b*1.15)out.sulfate=clamp(chroma/.58)*affinity(118,46);
 if(b>r*1.10&&g>r*1.06)out.salt=clamp(chroma/.30)*affinity(195,48);
 return out;
}
function analyze(x,y){
 const px=Math.round(clamp(x)*(canvas.width-1)),py=Math.round(clamp(y)*(canvas.height-1));
 const x0=Math.max(0,px-5),y0=Math.max(0,py-5),w=Math.min(11,canvas.width-x0),h=Math.min(11,canvas.height-y0);
 const data=pixel.getImageData(x0,y0,w,h).data,sum={carbon:0,dust:0,salt:0,sulfate:0};
 for(let i=0;i<data.length;i+=4){const q=colorStrength(data[i]/255,data[i+1]/255,data[i+2]/255);for(const k of KEYS)sum[k]+=q[k];}
 for(const k of KEYS)sum[k]=sum[k]/(w*h);return sum;
}
function refreshSound(){
 host.onState(enabled);
 if(!audio)return;const now=audio.currentTime;
 master.gain.setTargetAtTime(enabled?Number($('volume').value)/100:0,now,.035);
 for(const k of KEYS){const q=preview?(preview===k?.7:0):(active&&$(k+'-on').checked?levels[k]:0);const volume=q>.025?.065*Math.pow(q,.70):0;voices[k].gain.gain.setTargetAtTime(volume,now,.055);}
}
async function startAudio(){
 if(!audio){
  // The site's one shared AudioContext: master volume, Audio switch, level meter.
  const shared=host.audio();if(!shared){$('status').textContent='Audio is unavailable in this browser.';return false;}
  audio=shared.context;master=audio.createGain();master.gain.value=0;const limiter=audio.createDynamicsCompressor();master.connect(limiter);limiter.connect(shared.output);
  for(const k of KEYS){const spec=TONES[k],gain=audio.createGain();gain.gain.value=0;gain.connect(master);
   const a=audio.createOscillator();a.type=spec.type;a.frequency.value=spec.hz;a.connect(gain);a.start();
   const b=audio.createOscillator(),hg=audio.createGain();b.type='sine';b.frequency.value=spec.hz*spec.harmonic;hg.gain.value=spec.harmonicGain;b.connect(hg);hg.connect(gain);b.start();voices[k]={gain,a,b};
  }
 }
 await audio.resume();enabled=true;$('enable').textContent='Sound enabled';$('enable').setAttribute('aria-pressed','true');$('status').textContent='Sound is on. Move over a colored patch.';refreshSound();return true;
}
function stopAudio(){enabled=false;active=false;preview=null;clearTimeout(previewTimer);$('enable').textContent='Enable sound';$('enable').setAttribute('aria-pressed','false');$('status').textContent='Sound stopped.';refreshSound();}
function move(x,y){
 if(!ready)return;preview=null;clearTimeout(previewTimer);point=[clamp(x),clamp(y)];active=true;
 $('marker').hidden=false;$('marker').style.left=point[0]*100+'%';$('marker').style.top=point[1]*100+'%';
 levels=analyze(...point);let ranked=KEYS.slice().sort((a,b)=>levels[b]-levels[a]);
 for(const k of KEYS){const p=Math.round(levels[k]*100);$(k+'-meter').style.width=p+'%';$(k+'-value').textContent='Color strength: '+p+'%';}
 const found=ranked.filter(k=>levels[k]>.04);$('reading').textContent=found.length?found.map(k=>TONES[k].name).join(' + '):'No clear aerosol color at this point';
 $('position').textContent='Image position: '+Math.round(point[0]*100)+'% across · '+Math.round(point[1]*100)+'% down';
 if(performance.now()-lastAnnounce>1200){$('live').textContent=$('reading').textContent;lastAnnounce=performance.now();}refreshSound();
}
function fromPointer(e){const r=map.getBoundingClientRect();move((e.clientX-r.left)/r.width,(e.clientY-r.top)/r.height);}
map.addEventListener('pointermove',e=>{if(e.pointerType==='mouse'||e.buttons)fromPointer(e);});
map.addEventListener('pointerdown',async e=>{map.focus();if(e.pointerType!=='mouse')map.setPointerCapture(e.pointerId);if(!enabled)await startAudio();fromPointer(e);});
function leave(){active=false;preview=null;refreshSound();}
map.addEventListener('pointerleave',e=>{if(e.pointerType==='mouse')leave();});map.addEventListener('pointerup',e=>{if(e.pointerType!=='mouse')leave();});map.addEventListener('pointercancel',leave);map.addEventListener('blur',leave);
map.addEventListener('keydown',async e=>{
 const steps={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};
 if(e.code==='Space'){e.preventDefault();if(enabled)stopAudio();else{await startAudio();move(...point);}return;}
 if(steps[e.key]){e.preventDefault();const d=e.shiftKey?.04:.008;move(point[0]+steps[e.key][0]*d,point[1]+steps[e.key][1]*d);}
});
$('enable').onclick=()=>startAudio();$('stop').onclick=stopAudio;$('volume').oninput=refreshSound;
for(const k of KEYS)$(k+'-on').onchange=refreshSound;
for(const button of root.querySelectorAll('[data-tone]'))button.onclick=async()=>{if(!ready||!await startAudio())return;clearTimeout(previewTimer);preview=button.dataset.tone;active=false;refreshSound();$('status').textContent='Preview: '+TONES[preview].name;previewTimer=setTimeout(()=>{preview=null;refreshSound();$('status').textContent='Move over the image to listen.';},1000);};
for(const [id,dx,dy]of [['left',-1,0],['right',1,0],['up',0,-1],['down',0,1]])$(id).onclick=async()=>{await startAudio();move(point[0]+dx*.02,point[1]+dy*.02);};
function loaded(){canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;pixel.drawImage(image,0,0);ready=true;$('enable').disabled=false;$('enable').textContent='Enable sound';$('status').textContent='Ready. Enable sound, then explore the map.';}
image.addEventListener('load',loaded);image.addEventListener('error',()=>{$('status').textContent='The image could not load. Please reopen the downloaded file.';});if(image.complete&&image.naturalWidth)loaded();
document.addEventListener('visibilitychange',()=>{if(document.hidden&&enabled)stopAudio();});
window.addEventListener('pagehide',()=>{if(enabled)stopAudio();});

root.aerosolMap={getState:()=>({ready,enabled,active,point:point.slice(),levels:{...levels}}),classify:colorStrength};
return {
 // Load the image the first time the experience is opened (it is 2.4 MB).
 open(){root.hidden=false;if(!image.getAttribute('src'))image.src=image.dataset.src;},
 close(){if(enabled)stopAudio();root.hidden=true;},
 async start(){if(!ready)await new Promise(done=>image.addEventListener('load',done,{once:true}));await startAudio();move(...point);},
 stop(){if(enabled)stopAudio();},
 isPlaying(){return enabled;},
 setVolume(value){$('volume').value=Math.round(clamp(Number(value))*100);refreshSound();},
 getState:()=>({ready,enabled,active,point:point.slice(),levels:{...levels}})
};
};
})();

/* =====================================================================
   Part 6 · notes, region impacts, interaction and the main loop
   Nothing here is random: a note is sent only when a slider moves, a musical voice plays,
   a chapter changes or you tap Earth, and it always flies to the region of its own variable.
   ===================================================================== */
const boost=U.uBoost.value,focusState={yaw:0,pitch:0,hold:0,k:null};
const flying=[],queue=[],impacts=[],lastFire={},lastBeat={};let glyphN=0,ready=false,sunAz=-.7;
const glyphTex={};
function glyphTexture(k,ch){const id=k+ch;if(glyphTex[id])return glyphTex[id];const c=document.createElement('canvas');c.width=c.height=128;const g=c.getContext('2d'),col=COLOR[k];g.font='bold 92px Georgia,serif';g.textAlign='center';g.textBaseline='middle';g.shadowColor=col;g.shadowBlur=24;g.fillStyle=col;g.fillText(ch,64,70);g.shadowBlur=6;g.globalAlpha=.28;g.fillStyle='#fff';g.fillText(ch,64,70);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return glyphTex[id]=t}
const spritePool=[];
function getSprite(k,ch){const s=spritePool.pop()||new THREE.Sprite(new THREE.SpriteMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending}));s.material.map=glyphTexture(k,ch);s.material.needsUpdate=true;s.renderOrder=8;scene.add(s);return s}
const nowSec=()=>performance.now()/1000;

/* Choose where on Earth a note lands. 'slider' follows the variable's main region; 'beat' picks the region of that variable that faces us. */
function facing(obj){return _v.copy(obj).applyQuaternion(earthGroup.quaternion).normalize().z}   /* 1 = facing the camera */
function pickTarget(k,mode){const reg=REG[k];
  if(mode==='slider'&&focusOn()){const r=reg.primary;reg.cursor=(reg.cursor+.11)%.7;return r.samples[Math.floor(3+reg.cursor/.7*17)].clone()}
  let best=null,bs=-9;for(const r of reg.routes){const f=facing(r.center);if(f>bs){bs=f;best=r}}
  reg.cursor=(reg.cursor+.13)%1;return best.samples[Math.floor(2+reg.cursor*19)].clone()}
const focusOn=()=>$('follow').checked&&!reduced;

/* Send n notes of variable k. */
function fireNotes(k,n,opt={}){if(!ready)return;const now=nowSec();let delay=.12;
  if(opt.mode==='slider'||opt.turn){const c=REG[k].primary.center,f=Math.acos(Math.max(-1,Math.min(1,facing(c))));if(focusOn())delay=Math.min(1,.12+f*.32)}
  let tgt;for(let i=0;i<n;i++){tgt=opt.target||pickTarget(k,opt.mode||'slider');queue.push({at:now+delay+i*.09,k,target:tgt.clone(),glyph:glyphN++%2,value:opt.value})}
}
/* Slider moved: throttle, turn Earth to the region, fire. */
function onVariableChanged(k,old,val){if(!ready)return;const now=performance.now(),f=lastFire[k]||{t:0,v:old};if(now-f.t<130&&Math.abs(val-f.v)<4)return;
  const n=1+Math.min(2,Math.floor(Math.abs(val-f.v)/7));lastFire[k]={t:now,v:val};
  focusRegion(k);fireNotes(k,n,{mode:'slider',value:val,turn:true});if(running)playAccent(k,val)}
/* A musical voice played: a note leaves that variable's slider, at most every 0.5 s per variable. */
function fireFromBeat(e){const k=e.k;if(!ready||P[k]<8)return;const n=nowSec();if(n-(lastBeat[k]||0)<.5||n-(lastBeat.any||0)<.12)return;lastBeat[k]=lastBeat.any=n;fireNotes(k,1,{mode:'beat'})}
function onChapterChanged(c){if(!ready)return;const sc=scenes[c];lastFire.chapter=0;
  if(sc.focus){focusRegion(sc.focus);fireNotes(sc.focus,3,{mode:'slider',turn:true})}
  else{KEYS.filter(k=>P[k]>=25).forEach((k,i)=>{const at=nowSec()+.15+i*.16;fireNotes(k,1,{mode:'beat'});queue[queue.length-1].at=at})}}

/* Earth turns so the region faces us (slightly toward the controls, where the notes come from). */
function focusRegion(k){if(!focusOn()&&!reduced)return;const L=LABELS.find(l=>l.k===k);if(!L)return;
  const base=-Math.PI/2-L.lon*DEG+.2,cur=yaw;let y=base+TAU*Math.round((cur-base)/TAU);
  focusState.yaw=y;focusState.pitch=Math.max(-.9,Math.min(.9,L.lat*DEG*.9));focusState.hold=4.5;focusState.k=k;
  if(reduced){yaw=y;pitch=focusState.pitch}}

/* A note reached Earth: ripple, boost the variable, sparkle. */
function impact(k,obj){const dir=obj.clone().normalize();impacts.push({dir,k,age:0});if(impacts.length>10)impacts.shift();
  const bi=IDX[k];boost[bi]=Math.min(1.4,boost[bi]+.75);
  const w=earthGroup.localToWorld(obj.clone()),nrm=w.clone().sub(earthGroup.position).normalize(),col=COLOR[k];
  for(let i=0;i<18;i++){const a=i/18*TAU,t1=_v.copy(nrm).cross(UP).normalize(),t2=_v2.copy(nrm).cross(t1);const sp=.35+.25*((i*7)%5)/5;
    emit(w,(nrm.x*.9+(t1.x*Math.cos(a)+t2.x*Math.sin(a)))*sp,(nrm.y*.9+(t1.y*Math.cos(a)+t2.y*Math.sin(a)))*sp,(nrm.z*.9+(t1.z*Math.cos(a)+t2.z*Math.sin(a)))*sp,col,.9,.12,2)}
  const L=LABELS.find(l=>l.k===k);if(L){L.el.classList.add('hit');clearTimeout(L.ht);L.ht=setTimeout(()=>L.el.classList.remove('hit'),900)}}

/* Launch queued notes from the slider and fly them (curved path that follows the turning Earth). */
function launchDue(now){for(let i=queue.length-1;i>=0;i--){const q=queue[i];if(q.at>now)continue;queue.splice(i,1);
  pulseControl(q.k);
  if(reduced||!$('notes').checked){impact(q.k,q.target);continue}
  if(flying.length>46)continue;const start=sourcePoint(q.k);
  flying.push({k:q.k,target:q.target,start,p:0,dur:1.05,glyph:q.glyph?'♫':'♪',sprite:getSprite(q.k,q.glyph?'♫':'♪'),ctrl:new V3()});
  for(let j=0;j<8;j++)emit(start,(Math.random()-.5)*.5,(Math.random()-.2)*.5,(Math.random()-.5)*.5,COLOR[q.k],.5,.1,3);
  }}
const _a=new V3(),_b=new V3(),_c3=new V3(),_cam=new V3();
function updateFlying(dt){for(let i=flying.length-1;i>=0;i--){const n=flying[i];n.p+=dt/n.dur;const p=Math.min(1,n.p),e=p*p*(3-2*p);
  earthGroup.localToWorld(_b.copy(n.target));
  n.ctrl.copy(n.start).lerp(_b,.5);n.ctrl.y+=.7;n.ctrl.z+=.9;
  const u=1-e;_a.set(0,0,0).addScaledVector(n.start,u*u).addScaledVector(n.ctrl,2*u*e).addScaledVector(_b,e*e);
  _a.y+=Math.sin(p*Math.PI*3)*.1*(1-p);n.sprite.position.copy(_a);
  const s=.34*(1+.15*Math.sin(p*30));n.sprite.scale.set(s,s,1);n.sprite.material.opacity=Math.min(1,p*14)*Math.min(1,(1-p)*9);
  emit(_a,(Math.random()-.5)*.12,(Math.random()-.5)*.12,(Math.random()-.5)*.12,COLOR[n.k],.55,.075,2.5);
  if(n.p>=1){impact(n.k,n.target);scene.remove(n.sprite);spritePool.push(n.sprite);flying.splice(i,1)}}}

/* ---------- interaction: drag to turn Earth, pinch / wheel to zoom, tap Earth to play it ---------- */
let pointsDown=new Map(),dragLast,pinchDistance,dragMoved=0,dragging=false;const ray=new THREE.Raycaster(),_ndc=new THREE.Vector2();
canvas.addEventListener('pointerdown',e=>{canvas.setPointerCapture(e.pointerId);pointsDown.set(e.pointerId,[e.clientX,e.clientY]);dragLast=[e.clientX,e.clientY];if(pointsDown.size===1){dragMoved=0}dragging=true;focusState.hold=0});
canvas.addEventListener('pointermove',e=>{if(!pointsDown.has(e.pointerId))return;pointsDown.set(e.pointerId,[e.clientX,e.clientY]);
  if(pointsDown.size===2){const [a,b]=[...pointsDown.values()],dist=Math.hypot(a[0]-b[0],a[1]-b[1]);if(pinchDistance)zoom=Math.max(.65,Math.min(1.45,zoom*dist/pinchDistance));pinchDistance=dist;dragMoved=99}
  else{const dx=e.clientX-dragLast[0],dy=e.clientY-dragLast[1];dragMoved+=Math.abs(dx)+Math.abs(dy);yaw+=dx*.005;pitch=Math.max(-1.05,Math.min(1.05,pitch+dy*.004))}dragLast=[e.clientX,e.clientY]});
for(const evn of ['pointerup','pointercancel'])canvas.addEventListener(evn,e=>{const wasTap=evn==='pointerup'&&dragMoved<6&&pointsDown.size===1;pointsDown.delete(e.pointerId);pinchDistance=0;if(!pointsDown.size)dragging=false;if(wasTap)handleTap(e.clientX,e.clientY)});
canvas.addEventListener('wheel',e=>{if(width<761)return;e.preventDefault();zoom=Math.max(.65,Math.min(1.45,zoom-e.deltaY*.0008))},{passive:false});
document.addEventListener('keydown',e=>{if(['INPUT','SELECT','TEXTAREA','BUTTON'].includes(document.activeElement?.tagName)||$('source-dialog').open)return;if(e.key==='+'||e.key==='=')zoom=Math.min(1.45,zoom+.1);if(e.key==='-')zoom=Math.max(.65,zoom-.1)});
function handleTap(x,y){if(!ready)return;_ndc.set(x/width*2-1,-(y/height)*2+1);ray.setFromCamera(_ndc,camera);
  const hit=ray.ray.intersectSphere(new THREE.Sphere(earthGroup.position,R),new V3());
  if(hit){const obj=earthGroup.worldToLocal(hit.clone()).normalize().multiplyScalar(R*1.004),lat=Math.asin(obj.y/obj.length())/DEG;
    fireNotes(activeVar,1,{target:obj,mode:'click'});if(running)playAccent(activeVar,(lat+90)/180*100);return}
}
LABELS.forEach(l=>l.el.addEventListener('click',()=>{}));

/* ---------- labels that stay attached to their region ---------- */
const _lp=new V3();
function updateLabels(){const show=$('labels').checked&&width>760&&ready;labelLayer.style.display=show?'block':'none';if(!show)return;
  const placed=[];
  for(const l of LABELS){_lp.copy(l.pos).applyQuaternion(earthGroup.quaternion);const vis=_lp.z/R,w=_lp.clone();w.project(camera);
    let x=(w.x+1)/2*width+10,y=(1-w.y)/2*height-12;l.el.style.opacity=vis>.28?Math.min(1,(vis-.28)*5):0;
    if(vis>.28){for(let n=0;n<6;n++){const hit=placed.find(p=>Math.abs(p.x-x)<150&&Math.abs(p.y-y)<24);if(!hit)break;y=hit.y+26}placed.push({x,y})}
    l.el.style.transform=`translate(${x}px,${y}px)`;
    const b=labelBadge(l.k),txt=`${l.n} · ${Math.round(smooth[l.k])}${b}`;if(l.txt.textContent!==txt){l.txt.textContent=txt;l.el.classList.toggle('changed',!!b)}}}

/* ---------- the main loop ---------- */
const _sun=new V3(),_qi=new THREE.Quaternion();let renderAccum=0;
function frame(now){requestAnimationFrame(frame);const dt=Math.min(.06,(now-last)/1000||.016);last=now;if(!ready)return;
  renderAccum+=dt;if(reduced&&renderAccum<1/12)return;const step=renderAccum;renderAccum=0;
  if(!reduced)time+=step;
  for(const d of D)smooth[d.k]+=(P[d.k]-smooth[d.k])*(reduced?1:Math.min(1,step*3));
  for(let i=0;i<8;i++){boost[i]=Math.max(0,boost[i]-step*(reduced?3:.9));U.uV.value[i]=smooth[KEYS[i]]/100;strandU.uLevel.value[i]=U.uV.value[i]}
  /* audio level (for the glow and meter) and music-driven notes */
  if(running&&analyser){analyser.getByteFrequencyData(audioData);let s=0;for(let i=0;i<6;i++)s+=audioData[i];audioLevel+=((s/6/255)-audioLevel)*.25}else audioLevel*=.9;
  U.uBass.value=audioLevel;
  while(AC&&beatEvents.length&&beatEvents[0].t<=AC.currentTime){const e=beatEvents.shift();if(running)fireFromBeat(e)}
  /* Earth motion: manual drag > focus on a region > slow auto rotation */
  if(!dragging){if(focusState.hold>0){focusState.hold-=step;const k=Math.min(1,step*3);yaw+=(focusState.yaw-yaw)*k;pitch+=(focusState.pitch-pitch)*k}else if($('spin').checked&&!reduced)yaw+=step*.04}
  earthGroup.rotation.set(pitch,yaw,0,'XYZ');earthGroup.updateMatrixWorld(true);
  /* sun: slowly sweeps so the day/night line crosses the globe; the Earth-at-night scene pulls the sun behind */
  nightMix+=((chapter==='night'?1:0)-nightMix)*Math.min(1,step*1.5);
  const cyc=$('cycle').checked&&!reduced?Math.sin(time*.04)*.95:0;sunAz=-.7+cyc-nightMix*1.9;
  _sun.set(Math.sin(sunAz)*Math.cos(.32),Math.sin(.32),Math.cos(sunAz)*Math.cos(.32)).normalize();
  _qi.copy(earthGroup.quaternion).invert();U.uSun.value.copy(_sun).applyQuaternion(_qi);U.uCam.value.copy(camera.position).applyQuaternion(_qi);
  haloMesh.material.uniforms.uSunW.value.copy(_sun);
  U.uTime.value=time;strandU.uPart.value=$('particles').checked?1:0;strandMesh.visible=$('threads').checked;haloMesh.visible=$('glow').checked;
  /* impacts → shader arrays */
  for(let i=0;i<10;i++){const m=impacts[i];if(m){m.age+=step/(reduced?.9:1.7);if(m.age>=1){impacts.splice(i,1);i--;continue}U.uImp.value[i].set(m.dir.x,m.dir.y,m.dir.z,m.age);U.uImpCol.value[i].set(...RGB[m.k],IDX[m.k])}}
  for(let i=impacts.length;i<10;i++){U.uImp.value[i].w=2;U.uImpCol.value[i].w=-1}
  layoutCamera();updateColumns();updateMoon();updateMeter();launchDue(nowSec());updateFlying(reduced?0:step);updateParticles(step);updateLabels();
  renderer.render(scene,camera)}

/* ---------- NASA source catalogue (unchanged from Draft 02) ---------- */
const sources=[
{id:'3912',title:'Ocean currents & temperature',text:'Surface flows colored by temperature, generated with ECCO2 ocean model output. The sequence covers March 2007–March 2008.',use:'Ocean warmth and current-speed controls; blue and gold flow patterns.',img:'https://svs.gsfc.nasa.gov/vis/a000000/a003900/a003912/flat_global_ecco2_2028x1024.25000.jpg',credit:'NASA/Goddard Space Flight Center Scientific Visualization Studio; ECCO2, MIT/JPL.'},
{id:'5425',title:'Perpetual Ocean 2',text:'Western boundary currents, including the Kuroshio, Agulhas and Gulf Stream. The beauty version uses white for flows above 600 meters and blue–cyan tones below.',use:'Curving trails and the deep-flow scene.',img:'https://svs.gsfc.nasa.gov/vis/a000000/a005400/a005425/perpetual_ocean2_CLOSE_093_clean_noDate_1080p_carousel.jpg',credit:'NASA’s Scientific Visualization Studio; Greg Shirah and contributors.'},
{id:'5669',title:'GEOS aerosols',text:'A modeled still from 19 August 2025, 20:00 UTC. Blue is sea salt, magenta dust, orange/red smoke, and green sulfates.',use:'The aerosol variable and atmospheric flow textures.',img:'https://svs.gsfc.nasa.gov/vis/a000000/a005600/a005669/Aerosols_2025-08-19T20_00_00_1920x1080.png',credit:'NASA GMAO and NASA SVS; Joseph V. Ardizzone, Helen-Nicole Kostis.'},
{id:'5533',title:'Air quality model runs',text:'GEOS-CF shows transport of PM2.5, ozone, carbon monoxide and nitrogen oxides during July–August 2024.',use:'Air-pollutant haze and musical tension.',img:'https://svs.gsfc.nasa.gov/vis/a000000/a005500/a005533/AirQuality_Sphere_1920x1080_0000.png',credit:'NASA SVS and NASA GMAO; Helen-Nicole Kostis, Joseph V. Ardizzone.'},
{id:'5196',title:'DYAMOND carbon dioxide',text:'A modeled view of atmospheric CO₂ transport during January–March 2020, shaped by winds and atmospheric circulation.',use:'Amber carbon ribbons and a low bass voice.',img:'https://svs.gsfc.nasa.gov/vis/a000000/a005100/a005196/dyamondPointCloud_12-1-2023b_dyamond_co2_anim_globe_orbit_3x3Hyperwall.00200_print.jpg',credit:'NASA’s Scientific Visualization Studio; AJ Christensen and contributors.'},
{id:'4960',title:'Atmospheric rivers',text:'Clouds and precipitation from MERRA-2 reanalysis help reveal moisture transport through the atmosphere. Reanalysis combines models with observations.',use:'Water-vapor ribbons and sustained strings.',img:'https://svs.gsfc.nasa.gov/vis/a000000/a004900/a004960/atmos_rivers_narrated_4k.00090_print.jpg',credit:'NASA’s Scientific Visualization Studio; Greg Shirah and contributors.'},
{id:'4950',title:'GEDI forest height',text:'Forest-height observations collected April 2019–April 2020. Brown/dark green marks shorter vegetation; bright green/white marks taller vegetation. Displayed heights are exaggerated.',use:'Canopy marks, land greenness and woodwind pitch.',img:'https://svs.gsfc.nasa.gov/vis/a000000/a004900/a004950/GEDI_global_w_colorbar_0900_print.jpg',credit:'NASA’s Scientific Visualization Studio; Kel Elkins and contributors.'},
{id:'5313',title:'Night lights, 2012–2023',text:'Annual averages of night lights and their change. On NASA’s change map, purple means more light and orange means less light.',use:'City lights and sparkling bell tones.',img:'https://svs.gsfc.nasa.gov/vis/a000000/a005300/a005313/nightlights_flat_series_and_change_wZooms_13_EIC.02599_print.jpg',credit:'NASA SVS; Kel Elkins. Black Marble, NASA/NOAA VIIRS.'},
{id:'13786',title:'Caldwell 73 sonification',text:'This is a star cluster, not Earth data. NASA’s example maps distance from the cluster center to pitch, with choir, marimba and glockenspiel voices.',use:'Inspiration for translating visual properties into musical voices. This draft generates its own score.',img:'https://svs.gsfc.nasa.gov/vis/a010000/a013700/a013786/print.jpg',credit:'NASA’s Goddard Space Flight Center; SYSTEM Sounds (M. Russo, A. Santaguida).'}
];
sources.forEach(s=>{const card=document.createElement('article');card.className='source-card';card.innerHTML=`<h3>${s.title}</h3><p>${s.text}</p><p><strong>In this draft:</strong> ${s.use}</p><details><summary>Show original NASA image</summary><img data-source="${s.img}" alt="NASA original visualization: ${s.title}" loading="lazy"><small class="image-note">Original NASA imagery; internet required.</small></details><a href="https://svs.gsfc.nasa.gov/${s.id}/" target="_blank" rel="noopener">Open NASA visualization and films ↗</a><small>Credit: ${s.credit}</small>`;$('source-grid').appendChild(card);const detail=card.querySelector('details'),img=card.querySelector('img');detail.addEventListener('toggle',()=>{if(detail.open&&!img.src){img.src=s.img;img.onerror=()=>{img.hidden=true;card.querySelector('.image-note').textContent='Image could not load here. Open the NASA page using the link below.'}}})});
$('sources').onclick=()=>$('source-dialog').showModal();$('close-sources').onclick=()=>$('source-dialog').close();$('source-dialog').addEventListener('click',e=>{if(e.target===$('source-dialog')){const r=$('source-dialog').getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)$('source-dialog').close()}});

/* ---------- start-up: load the embedded NASA textures, then build the world ---------- */
resize();sync();requestAnimationFrame(frame);
$('start').disabled=$('play').disabled=true;$('start').textContent='Loading Earth…';
(async()=>{try{
  const [day,lights,water,topo]=await Promise.all([loadImg(TEX.day),loadImg(TEX.lights),loadImg(TEX.water),loadImg(TEX.topo)]);
  const layers=buildLayers(day);
  buildSky();buildParticles();buildEarth({day:mkTex(day),lights:mkTex(lights),water:mkTex(water),topo:mkTex(topo)},layers);buildStrands();buildColumns(layers.forestMap);buildMoon();
  ready=true;$('start').disabled=$('play').disabled=false;$('start').textContent='▶ Play music';
}catch(err){console.error(err);$('start').textContent='Earth could not load';$('music-state').textContent='Graphics could not start';announce('Graphics could not start in this browser. Try Chrome or Edge with hardware acceleration on.',false)}})();

/* =====================================================================
   Part 7 · "What's happening" dashboard: says in plain words what each change does to Earth
   ===================================================================== */
const LEVEL=v=>v<34?0:v<67?1:2,LEVEL_WORD=['Low','Medium','High'];
/* [low, medium, high] — what you SEE on Earth, then the sound, then where to look */
const INFO={
 heat:{see:['Ocean looks cool and deep blue','Ocean is blue with warm turquoise patches','Ocean glows warm gold and orange'],hear:['Brass sounds soft and dark','Brass sounds warm','Brass sounds bright and loud'],where:'Gulf Stream, Indian Ocean'},
 flow:{see:['Glowing strands drift slowly','Strands flow at a steady pace','Strands rush fast along the currents'],hear:['Strings play a slow rhythm','Strings play a steady rhythm','Strings play a fast rhythm'],where:'Indian Ocean gyre'},
 aero:{see:['Almost no dust or smoke','Some purple dust and smoke','Thick purple dust and smoke clouds'],hear:['Percussion is nearly silent','Percussion adds light texture','Percussion gets busy and rough'],where:'Sahara and Amazon'},
 air:{see:['Air looks clear','A light pink haze appears','Heavy pink haze covers the cities'],hear:['Harmony is calm and major','Some tension enters the harmony','Harmony turns tense and minor'],where:'India and China'},
 co2:{see:['Only a few orange ribbons','Several orange carbon ribbons','Many strong orange carbon ribbons'],hear:['Bass is light','Bass is steady','Bass is deep and heavy'],where:'Asia and the Pacific'},
 water:{see:['Few clouds, dry sky','A moderate amount of cloud and moisture','Many clouds and moisture rivers'],hear:['Strings are thin','Strings layer together','Strings swell into thick layers'],where:'North Atlantic'},
 forest:{see:['Short, sparse green forest columns','Medium green forest columns','Tall, dense green forest columns'],hear:['Woodwinds play low notes','Woodwinds play middle notes','Woodwinds play high notes'],where:'Amazon'},
 city:{see:['City lights are dim','City lights are moderate','City lights are bright on the night side'],hear:['Bells ring rarely','Bells sparkle sometimes','Bells sparkle constantly'],where:'Asia and Europe'}};
var dashPrev={...P},dashDelta={};
const dashEl=$('dash'),dashRows=$('dash-rows'),dashLast=$('dash-last');
D.forEach(d=>{const r=document.createElement('div');r.className='drow';r.style.setProperty('--c',d.c);r.innerHTML=`<div class="dhead"><b>${d.n}</b><span class="dlvl"></span><span class="dchip"></span></div><div class="dbar"><i></i></div><div class="dsee"></div>`;dashRows.appendChild(r);d.row=r});
function dashUpdate(){const changed=[];
  D.forEach(d=>{const v=P[d.k],ch=v-dashPrev[d.k];if(ch){changed.push(d);dashDelta[d.k]={d:ch,until:performance.now()+3500}}
    const L=LEVEL(v),r=d.row;r.querySelector('.dlvl').textContent=`${LEVEL_WORD[L]} · ${v}`;r.querySelector('.dbar i').style.width=v+'%';r.querySelector('.dsee').textContent=INFO[d.k].see[L];
    if(ch){const c=r.querySelector('.dchip');c.textContent=(ch>0?'▲ +':'▼ −')+Math.abs(ch);c.classList.add('show');r.classList.add('changed');clearTimeout(d.dt);d.dt=setTimeout(()=>{c.classList.remove('show');r.classList.remove('changed')},3500)}});
  if(changed.length===1){const d=changed[0],v=P[d.k],o=dashPrev[d.k],L=LEVEL(v),I=INFO[d.k],up=v>o;
    dashLast.style.setProperty('--c',d.c);
    dashLast.innerHTML=`<div class="eyebrow">Last change</div><div class="dtitle">${d.n}: ${o} → ${v} <span class="${up?'up':'down'}">${up?'▲ higher':'▼ lower'}</span></div><p><b>On Earth:</b> ${I.see[L]}.</p><p><b>You hear:</b> ${I.hear[L]}.</p><p><b>Look at:</b> ${I.where}.</p>`}
  else if(changed.length>1){dashLast.style.setProperty('--c','#8cc8ff');dashLast.innerHTML=`<div class="eyebrow">Scene changed</div><div class="dtitle">${scenes[chapter].name}</div><p>${changed.length} variables moved at once. Each row below shows what it now does to Earth.</p>`}
  dashPrev={...P}}
/* Small badge on the Earth label of whichever variable just changed, e.g. "Gulf Stream · 38 ▲+12". */
function labelBadge(k){const x=dashDelta[k];return x&&performance.now()<x.until?` ${x.d>0?'▲':'▼'}${Math.abs(x.d)}`:''}
dashUpdate();var dashReady=true;
$('dash-toggle').onclick=()=>{const open=!dashEl.classList.toggle('closed');$('dash-toggle').setAttribute('aria-expanded',open);$('dash-toggle').textContent=open?'Hide':'Show dashboard';document.body.classList.toggle('dash-closed',!open)};

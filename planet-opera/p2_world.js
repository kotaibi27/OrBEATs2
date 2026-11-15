/* =====================================================================
   Part 2 · geography: where each variable lives on Earth
   ===================================================================== */
/* longitude/latitude (degrees) -> point in the Earth's own space. lon 0 faces +X, lon -90 faces +Z. */
function ll(lon,lat,r=R){const a=lon*DEG,b=lat*DEG;return new V3(r*Math.cos(b)*Math.cos(a),r*Math.sin(b),-r*Math.cos(b)*Math.sin(a))}
function toLL(v){return [Math.atan2(-v.z,v.x)/DEG,Math.asin(Math.max(-1,Math.min(1,v.y/v.length())))/DEG]}
/* Great-circle points between two [lon,lat] places (used for the city network arcs). */
function greatCircle(a,b,n){const A=ll(a[0],a[1],1),B=ll(b[0],b[1],1),w=Math.acos(Math.max(-1,Math.min(1,A.dot(B)))),out=[];let prev=a[0];for(let i=0;i<=n;i++){const t=i/n,s=Math.sin(w)||1,v=A.clone().multiplyScalar(Math.sin((1-t)*w)/s).add(B.clone().multiplyScalar(Math.sin(t*w)/s));let [lo,la]=toLL(v);while(lo-prev>180)lo-=360;while(lo-prev<-180)lo+=360;prev=lo;out.push([lo,la])}return out}

/* Routes. f = variable, p = [lon,lat] waypoints, a = height above surface (fraction of R),
   h = extra arch height, k = threads in the bundle, s = bundle half-width in degrees, main = primary region.
   draw:false routes are only note targets (forest and city have no strands). Longitudes may run past 180 so lines never jump. */
const ROUTES=[
/* warm ocean currents (Ocean warmth) */
{f:'heat',n:'Gulf Stream',main:1,p:[[-82,25],[-80,28],[-76,34],[-68,39],[-55,43],[-40,47]],a:.004,h:0,k:14,s:1.1},
{f:'heat',n:'North Atlantic Drift',p:[[-45,45],[-28,52],[-15,56],[-5,61],[5,66],[15,71]],a:.004,h:0,k:12,s:1.2},
{f:'heat',n:'Brazil Current',p:[[-34,-10],[-37,-18],[-45,-27],[-52,-35],[-50,-40],[-40,-42]],a:.004,h:0,k:11,s:1},
{f:'heat',n:'Agulhas Current',p:[[42.5,-14],[40,-22],[35,-28],[31,-33],[24,-37.5],[18,-39],[28,-41],[45,-41]],a:.004,h:0,k:12,s:1},
{f:'heat',n:'Kuroshio',p:[[124,18],[124,24],[128,28],[134,32],[140,34.5],[150,37],[162,40],[175,41],[190,42]],a:.004,h:0,k:13,s:1.1},
{f:'heat',n:'East Australian Current',p:[[155,-14],[155,-22],[154.5,-28],[153,-34],[155,-38],[165,-40]],a:.004,h:0,k:10,s:1},
{f:'heat',n:'Pacific warm pool',p:[[135,2],[160,1],[185,0],[215,-1],[245,-3]],a:.004,h:0,k:13,s:1.3},
/* cooler currents and gyres (Current speed) */
{f:'flow',n:'Indian Ocean gyre',main:1,p:[[52,4],[58,9],[66,11],[74,8],[83,4],[92,3],[95,-3],[85,-8],[70,-9],[58,-6],[50,-1]],a:.004,h:0,k:14,s:1.2},
{f:'flow',n:'Canary & Caribbean',p:[[-14,43],[-17,35],[-22,27],[-33,20],[-48,16],[-62,15],[-76,15],[-84,21]],a:.004,h:0,k:12,s:1.1},
{f:'flow',n:'Benguela',p:[[12,-32],[8,-24],[5,-16],[-2,-9],[-15,-6],[-30,-4]],a:.004,h:0,k:10,s:1},
{f:'flow',n:'Antarctic Circumpolar',p:[[-65,-57.5],[-30,-53],[0,-51],[30,-52],[60,-55],[90,-56],[120,-58],[150,-60],[180,-61],[210,-61],[240,-60],[270,-59],[292,-58]],a:.004,h:0,k:16,s:2},
{f:'flow',n:'North Equatorial Pacific',p:[[255,12],[230,13],[200,13],[170,12],[145,12],[130,13]],a:.004,h:0,k:11,s:1.2},
{f:'flow',n:'California Current',p:[[195,43],[215,46],[232,44],[235,38],[240,30],[247,22],[255,15]],a:.004,h:0,k:11,s:1},
{f:'flow',n:'Humboldt',p:[[-75,-40],[-76,-30],[-80,-18],[-83,-8],[-88,-2],[-100,-2],[-120,-3],[-145,-4]],a:.004,h:0,k:11,s:1},
{f:'flow',n:'South Pacific gyre',p:[[155,-30],[175,-31],[200,-33],[225,-34],[250,-34],[270,-33],[283,-30]],a:.004,h:0,k:10,s:1.2},
{f:'flow',n:'Equatorial Atlantic',p:[[-10,2],[-25,3],[-40,5],[-50,8]],a:.004,h:0,k:8,s:1},
/* atmospheric rivers (Water vapor) */
{f:'water',n:'Atlantic river',main:1,p:[[-80,22],[-65,32],[-45,42],[-25,50],[-8,55],[5,58]],a:.02,h:.06,k:11,s:2},
{f:'water',n:'Pineapple Express',p:[[-165,18],[-150,25],[-138,32],[-128,40],[-122,46]],a:.02,h:.06,k:10,s:1.8},
{f:'water',n:'South Pacific river',p:[[165,-25],[185,-32],[215,-38],[245,-42],[283,-44]],a:.02,h:.06,k:10,s:2},
{f:'water',n:'Monsoon moisture',p:[[55,-5],[65,5],[75,12],[80,18],[90,22],[100,28]],a:.02,h:.06,k:10,s:2},
{f:'water',n:'Tropical belt',p:[[-170,8],[-130,8],[-90,9],[-50,8],[-10,5],[30,2],[70,6]],a:.03,h:.025,k:5,s:2},
{f:'water',n:'Southern river',p:[[20,-50],[50,-48],[85,-52],[120,-52],[150,-55]],a:.02,h:.05,k:9,s:2},
{f:'water',n:'North Pacific river',p:[[120,10],[135,22],[150,32],[165,40],[180,48]],a:.02,h:.06,k:9,s:2},
{f:'water',n:'Amazon flying river',p:[[-50,0],[-62,-3],[-70,-8],[-72,-15]],a:.02,h:.05,k:8,s:1.5},
/* aerosols: dust, smoke, sea salt */
{f:'aero',n:'Saharan dust',main:1,p:[[10,20],[-5,20],[-20,18],[-40,15],[-55,14],[-68,15]],a:.012,h:.045,k:12,s:2.5},
{f:'aero',n:'Sahara to Europe',p:[[5,28],[12,35],[18,42],[22,50]],a:.012,h:.04,k:8,s:2},
{f:'aero',n:'Asian dust',p:[[100,40],[115,40],[130,40],[150,42],[170,45],[190,48],[215,50]],a:.012,h:.045,k:11,s:2.2},
{f:'aero',n:'Arabian dust',p:[[45,25],[55,22],[65,18],[75,15]],a:.012,h:.04,k:9,s:2},
{f:'aero',n:'Amazon smoke',p:[[-62,-8],[-55,-15],[-50,-24],[-45,-32],[-35,-38]],a:.012,h:.04,k:9,s:2},
{f:'aero',n:'African smoke',p:[[20,-5],[10,-8],[0,-10],[-10,-12],[-20,-14]],a:.012,h:.04,k:9,s:2},
{f:'aero',n:'Siberian smoke',p:[[100,58],[130,60],[160,62],[190,62]],a:.012,h:.04,k:8,s:2},
/* air pollutants */
{f:'air',n:'Indo-Gangetic haze',main:1,p:[[77,28],[83,26],[88,22],[92,16],[96,10]],a:.01,h:.04,k:12,s:1.8},
{f:'air',n:'East China plume',p:[[115,34],[122,36],[130,36],[140,36],[155,34],[170,32]],a:.01,h:.04,k:12,s:1.8},
{f:'air',n:'Europe',p:[[5,48],[15,50],[28,52],[40,55],[55,57]],a:.01,h:.035,k:9,s:1.6},
{f:'air',n:'Eastern US',p:[[-85,38],[-75,40],[-60,40],[-45,42]],a:.01,h:.035,k:9,s:1.6},
{f:'air',n:'Mexico City',p:[[-99,19],[-92,22],[-85,25]],a:.01,h:.03,k:6,s:1.2},
{f:'air',n:'São Paulo',p:[[-47,-23],[-38,-25],[-28,-26]],a:.01,h:.03,k:6,s:1.2},
/* carbon dioxide ribbons riding the jet streams */
{f:'co2',n:'East Asia to Pacific',main:1,p:[[115,35],[140,38],[165,42],[195,44],[225,45],[250,42]],a:.03,h:.07,k:10,s:2.6},
{f:'co2',n:'North America to Europe',p:[[-100,40],[-75,42],[-45,46],[-15,50],[15,52],[40,54]],a:.03,h:.07,k:10,s:2.6},
{f:'co2',n:'Eurasia',p:[[10,50],[40,54],[70,55],[100,55],[130,52]],a:.03,h:.07,k:9,s:2.4},
{f:'co2',n:'Monsoon Asia',p:[[75,20],[90,15],[105,10],[120,5],[135,0]],a:.03,h:.06,k:8,s:2.2},
{f:'co2',n:'Southern jet',p:[[150,-35],[180,-42],[215,-45],[250,-45],[285,-42],[320,-40],[355,-38]],a:.03,h:.06,k:8,s:2.4},
{f:'co2',n:'Amazon plume',p:[[-62,-5],[-45,2],[-30,10],[-10,14]],a:.03,h:.06,k:7,s:2},
{f:'co2',n:'African fires',p:[[15,-10],[30,-8],[45,-5],[60,-3]],a:.03,h:.06,k:7,s:2},
/* forests and cities: note targets only */
{f:'forest',n:'Amazon',main:1,draw:false,p:[[-68,-6],[-62,-4],[-55,-3]]},
{f:'forest',n:'Congo',draw:false,p:[[18,0],[24,1],[28,-2]]},
{f:'forest',n:'Borneo & Sumatra',draw:false,p:[[102,0],[110,0],[116,1]]},
{f:'forest',n:'Pacific Northwest',draw:false,p:[[-124,45],[-122,48]]},
{f:'forest',n:'Siberian taiga',draw:false,p:[[85,60],[100,62],[120,62]]},
{f:'forest',n:'Canadian boreal',draw:false,p:[[-115,56],[-100,56]]},
{f:'city',n:'East Asia',main:1,draw:false,p:[[114,31],[121,31],[127,37],[135,35]]},
{f:'city',n:'India',draw:false,p:[[73,19],[77,28],[88,23]]},
{f:'city',n:'Europe',draw:false,p:[[-0.1,51],[2,49],[13,52]]},
{f:'city',n:'US East',draw:false,p:[[-87,42],[-74,41],[-77,39]]},
{f:'city',n:'Brazil',draw:false,p:[[-46,-23],[-43,-22]]},
{f:'city',n:'Middle East',draw:false,p:[[31,30],[44,33],[55,25]]}
];
/* City network: gold arcs between big city regions. */
const CITY_PAIRS=[[[-74,41],[-0.1,51]],[[-0.1,51],[55,25]],[[55,25],[73,19]],[[73,19],[103,1]],[[103,1],[139,36]],[[139,36],[-118,34]],[[-118,34],[-74,41]],[[-46,-23],[3,7]],[[31,30],[55,25]],[[116,40],[37,56]],[[151,-34],[103,1]],[[28,-26],[31,30]],[[-99,19],[-46,-23]],[[121,31],[127,38]]];
CITY_PAIRS.forEach(([a,b],i)=>ROUTES.push({f:'city',n:'City link '+i,p:greatCircle(a,b,10),a:.012,h:.05+Math.min(.14,Math.hypot(a[0]-b[0],a[1]-b[1])/900),k:3,s:.45,arc:true}));

/* Where the kid aims: for each variable, sample points along its routes (on the surface). */
function sampleRoute(p,n){if(p.length<3){const out=[];for(let i=0;i<n;i++){const t=i/(n-1),a=p[0],b=p[p.length-1];out.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t])}return out}const c=new THREE.SplineCurve(p.map(q=>new THREE.Vector2(q[0],q[1])));return c.getSpacedPoints(n-1).map(q=>[q.x,q.y])}
const REG={};KEYS.forEach(k=>REG[k]={routes:[],cursor:0});
ROUTES.forEach(r=>{if(r.arc)return;const s=sampleRoute(r.p,24),pts=s.map(q=>ll(q[0],q[1],R*1.004)),mid=s[12];REG[r.f].routes.push({name:r.n,samples:pts,center:ll(mid[0],mid[1],1),lon:mid[0],lat:mid[1],main:!!r.main})});
KEYS.forEach(k=>{REG[k].routes.sort((a,b)=>(b.main?1:0)-(a.main?1:0));REG[k].primary=REG[k].routes[0]});

/* Region labels shown on Earth (they hide when facing away). */
const LABELS=[{k:'heat',n:'Gulf Stream',lon:-70,lat:35},{k:'flow',n:'Indian Ocean gyre',lon:70,lat:5},{k:'aero',n:'Saharan dust',lon:-18,lat:19},{k:'air',n:'Indo-Gangetic haze',lon:84,lat:26},{k:'co2',n:'Carbon transport',lon:140,lat:40},{k:'water',n:'Atmospheric river',lon:-22,lat:52},{k:'forest',n:'Amazon canopy',lon:-62,lat:-4},{k:'city',n:'City lights',lon:118,lat:32}];
const labelLayer=$('labels-layer');LABELS.forEach(l=>{l.pos=ll(l.lon,l.lat,R*1.01);l.el=document.createElement('div');l.el.className='rlabel';l.el.style.setProperty('--c',COLOR[l.k]);l.el.innerHTML='<i></i><span></span>';l.txt=l.el.lastChild;labelLayer.appendChild(l.el)});

/* ---------- Layer maps: where dust, smoke, pollution, CO2 and tall forest sit (built once, in code) ---------- */
const LW=512,LH=256;
function blob(arr,lon,lat,rx,ry,amp){const cl=Math.max(.3,Math.cos(lat*DEG)),rl=rx/cl,x0=Math.floor((lon-rl*2.7+180)/360*LW),x1=Math.ceil((lon+rl*2.7+180)/360*LW),y0=Math.max(0,Math.floor((lat-ry*2.7+90)/180*LH)),y1=Math.min(LH-1,Math.ceil((lat+ry*2.7+90)/180*LH));for(let y=y0;y<=y1;y++){const dy=((y+.5)/LH*180-90-lat)/ry;for(let x=x0;x<=x1;x++){const dx=((x+.5)/LW*360-180-lon)/rl,xi=((x%LW)+LW)%LW;arr[y*LW+xi]+=amp*Math.exp(-(dx*dx+dy*dy))}}}
function buildLayers(dayImg){
  const mk=()=>new Float32Array(LW*LH),dust=mk(),smoke=mk(),salt=mk(),sulf=mk(),air=mk(),co2=mk(),forest=mk(),river=mk(),tall=mk();
  const add=(arr,list)=>list.forEach(b=>blob(arr,...b));
  add(dust,[[12,22,20,9,1],[-5,20,14,8,.7],[-28,17,16,7,.8],[-48,15,14,6,.55],[-65,15,9,5,.35],[45,24,12,8,.8],[58,25,10,6,.5],[92,40,16,6,.8],[115,41,14,5,.6],[140,42,15,5,.35],[135,-25,14,8,.3],[0,32,10,4,.3],[68,30,10,6,.4]]);
  add(smoke,[[-58,-9,12,7,.9],[-50,-15,9,6,.6],[22,-8,14,8,.9],[8,-9,10,6,.6],[-8,-11,9,5,.4],[110,60,22,6,.8],[150,62,18,5,.5],[-112,56,14,6,.7],[-120,38,6,4,.4],[118,-3,12,6,.7],[145,-30,9,6,.4],[-100,20,5,4,.25]]);
  add(sulf,[[115,32,10,7,.9],[80,24,12,6,.7],[12,50,8,5,.6],[-82,38,8,5,.6],[138,36,6,4,.4],[48,29,8,5,.4],[28,45,10,5,.35]]);
  add(air,[[82,26,10,5,1],[115,33,10,6,1],[110,24,7,4,.5],[12,50,9,5,.6],[-80,39,7,5,.55],[50,28,8,4,.5],[-99,19,4,3,.5],[3,7,5,3,.5],[107,-6,4,3,.45],[-46,-23,4,3,.45],[37,56,6,3,.35],[139,36,5,3,.45],[77,29,7,4,.6],[-118,34,5,3,.4],[31,30,5,3,.45],[100,14,6,4,.3]]);
  add(co2,[[115,34,22,10,1],[82,26,18,9,.8],[-82,39,18,9,.8],[12,50,16,8,.7],[48,28,10,6,.5],[140,37,18,8,.6],[165,40,25,6,.5],[200,44,25,6,.4],[240,44,20,6,.3],[-60,42,25,6,.5],[-20,48,20,6,.4],[60,52,25,6,.4],[-58,-8,14,8,.5],[22,-8,14,8,.45],[118,-3,12,6,.45]]);
  add(tall,[[-62,-4,16,9,1],[22,0,14,8,.95],[110,0,10,7,.9],[140,-5,8,4,.7],[-125,47,6,5,.9],[-80,38,8,6,.45],[100,62,30,8,.45],[-105,56,28,8,.4],[20,62,12,6,.4],[100,25,8,6,.5],[-75,5,6,5,.7],[-52,-24,5,4,.5],[145,-37,5,4,.6]]);
  for(let y=0;y<LH;y++){const lat=Math.abs((y+.5)/LH*180-90);for(let x=0;x<LW;x++){const j=Math.sin(x*12.9898+y*78.233)*43758.5453;salt[y*LW+x]=Math.exp(-Math.pow((lat-47)/12,2))*.55+Math.exp(-Math.pow((lat-20)/10,2))*.14+(j-Math.floor(j))*.1}}
  /* forest height = how green the NASA map is x how tall that biome is */
  const c=document.createElement('canvas');c.width=LW;c.height=LH;const g=c.getContext('2d',{willReadFrequently:true});g.drawImage(dayImg,0,0,LW,LH);const px=g.getImageData(0,0,LW,LH).data;
  for(let r=0;r<LH;r++){const y=LH-1-r;for(let x=0;x<LW;x++){const i=(r*LW+x)*4,gr=(px[i+1]-Math.max(px[i],px[i+2]))/255,green=Math.max(0,Math.min(1,(gr-.012)/.063));forest[y*LW+x]=green*(.25+.75*Math.min(1,tall[y*LW+x]))}}
  /* atmospheric-river density: draw the river routes as soft thick strokes */
  g.clearRect(0,0,LW,LH);g.lineCap='round';g.lineJoin='round';
  ROUTES.filter(r=>r.f==='water').forEach(r=>{const s=sampleRoute(r.p,60);[[18,.18],[11,.3],[5,.5]].forEach(([w,a])=>{g.strokeStyle=`rgba(255,255,255,${a})`;g.lineWidth=w;[-LW,0,LW].forEach(sh=>{g.beginPath();s.forEach((q,i)=>{const X=(q[0]+180)/360*LW+sh,Y=(90-q[1])/180*LH;i?g.lineTo(X,Y):g.moveTo(X,Y)});g.stroke()})})});
  const rp=g.getImageData(0,0,LW,LH).data;for(let r=0;r<LH;r++)for(let x=0;x<LW;x++)river[(LH-1-r)*LW+x]=rp[(r*LW+x)*4+3]/255;
  const pack=(a,b,c2,d)=>{const out=new Uint8Array(LW*LH*4);for(let i=0;i<LW*LH;i++){out[i*4]=Math.min(255,a[i]*255);out[i*4+1]=Math.min(255,b[i]*255);out[i*4+2]=Math.min(255,c2[i]*255);out[i*4+3]=Math.min(255,d[i]*255)}const t=new THREE.DataTexture(out,LW,LH,THREE.RGBAFormat,THREE.UnsignedByteType);t.wrapS=THREE.RepeatWrapping;t.wrapT=THREE.ClampToEdgeWrapping;t.minFilter=THREE.LinearMipmapLinearFilter;t.magFilter=THREE.LinearFilter;t.generateMipmaps=true;t.needsUpdate=true;return t};
  return {A:pack(dust,smoke,salt,sulf),B:pack(air,co2,forest,river),forestMap:forest}}

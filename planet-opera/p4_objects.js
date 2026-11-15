/* =====================================================================
   Part 4 · build the objects (runs once the NASA textures have loaded)
   ===================================================================== */
function resize(){width=innerWidth;height=innerHeight;dpr=Math.min(devicePixelRatio||1,width<761?1.5:1.75);renderer.setPixelRatio(dpr);renderer.setSize(width,height,false);camera.aspect=width/height;layoutCamera()}
/* Keeps Earth and the Moon in the free area (between the header, the control panel and the dock). */
function layoutCamera(){const mobile=width<761,top=document.querySelector('.site').offsetHeight,bot=mobile?height*.38:$('dock').offsetHeight,left=(mobile||document.body.classList.contains('dash-closed')||width<1100)?0:296,availW=(mobile?width:width-(width<1050?305:350))-left,availH=height-top-bot-(mobile?0:10);
  const visH=Math.max(7.0*height/availW,5.6*height/availH)/zoom;camDist=visH/(2*FOV_T);
  const cx=left+availW*.5,cy=top+availH*.5;
  camera.position.set(SCENE_CENTER.x,SCENE_CENTER.y+.4,camDist);camera.lookAt(SCENE_CENTER);
  camera.setViewOffset(width,height,width/2-cx,height/2-cy,width,height);camera.updateMatrixWorld()}
addEventListener('resize',resize);

function loadImg(src){return new Promise((res,rej)=>{const i=new Image();i.onload=()=>res(i);i.onerror=()=>rej(new Error('Texture failed to load'));i.src=src})}
function mkTex(img){const t=new THREE.Texture(img);t.colorSpace=THREE.NoColorSpace;t.wrapS=THREE.RepeatWrapping;t.wrapT=THREE.ClampToEdgeWrapping;t.minFilter=THREE.LinearMipmapLinearFilter;t.magFilter=THREE.LinearFilter;t.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());t.generateMipmaps=true;t.needsUpdate=true;return t}

let earthMesh,cloudMesh,haloMesh,strandMesh,columns,columnData=[],stars,nebula,particles;
const strandU={uTime:U.uTime,uPart:{value:1},uV:U.uV,uBoost:U.uBoost,uImp:U.uImp,uImpCol:U.uImpCol,uWidth:{value:.0058},uLevel:{value:new Array(8).fill(.4)},uCol:{value:D.map(d=>new V3(...hexRGB(STRAND_HEX[d.k])))}};

function buildEarth(tex,layers){
  const u={...U,uDay:{value:tex.day},uLights:{value:tex.lights},uWater:{value:tex.water},uTopo:{value:tex.topo},uLayA:{value:layers.A},uLayB:{value:layers.B}};
  const geo=new THREE.SphereGeometry(R,160,120);
  earthMesh=new THREE.Mesh(geo,new THREE.ShaderMaterial({uniforms:u,vertexShader:earthVS,fragmentShader:earthFS}));earthMesh.renderOrder=0;earthGroup.add(earthMesh);
  cloudMesh=new THREE.Mesh(new THREE.SphereGeometry(R*1.012,128,96),new THREE.ShaderMaterial({uniforms:{...U,uLayB:{value:layers.B}},vertexShader:earthVS,fragmentShader:cloudFS,transparent:true,depthWrite:false}));cloudMesh.renderOrder=1;earthGroup.add(cloudMesh);
  haloMesh=new THREE.Mesh(new THREE.SphereGeometry(R*1.16,64,48),new THREE.ShaderMaterial({uniforms:{uSunW:{value:new V3(0,0,1)},uBass:U.uBass,uV:U.uV},vertexShader:haloVS,fragmentShader:haloFS,transparent:true,blending:THREE.AdditiveBlending,side:THREE.BackSide,depthWrite:false}));haloMesh.renderOrder=3;scene.add(haloMesh)}

/* Strand ribbons: every route becomes a bundle of threads. */
function hash1(n){const v=Math.sin(n*127.1+311.7)*43758.5453;return v-Math.floor(v)}
function buildStrands(){
  const pos=[],tan=[],uvs=[],info=[],idx=[];let vb=0,sid=0;
  for(const r of ROUTES){if(r.draw===false)continue;
    const curve=new THREE.SplineCurve(r.p.map(q=>new THREE.Vector2(q[0],q[1])));
    const NS=Math.max(40,Math.min(240,Math.round(curve.getLength()/1.25))),base=curve.getSpacedPoints(NS);
    for(let j=0;j<r.k;j++,sid++){
      const off=r.k>1?(j-(r.k-1)/2)/((r.k-1)/2):0,seed=hash1(sid+1),rank=Math.min(.99,(j+.2+.6*hash1(sid+9))/r.k),wScale=.75+.5*hash1(sid+17),pts=[];
      for(let i=0;i<=NS;i++){const t=i/NS,p=base[i],pa=base[Math.max(0,i-1)],pb=base[Math.min(NS,i+1)],cl=Math.max(.25,Math.cos(p.y*DEG));
        let tx=(pb.x-pa.x)*cl,ty=pb.y-pa.y;const tl=Math.hypot(tx,ty)||1;tx/=tl;ty/=tl;
        const fan=.3+.7*Math.pow(Math.sin(Math.PI*t),.7),wig=Math.sin(t*Math.PI*(2+j%3)+seed*6.28)*.2*r.s*(.3+.7*Math.sin(Math.PI*t)),o=off*r.s*fan+wig;
        const lon=p.x+(-ty)*o/cl,lat=p.y+tx*o,rad=R*(1+r.a+r.h*Math.pow(Math.sin(Math.PI*t),1.2)+.002*j/r.k);pts.push(ll(lon,lat,rad))}
      for(let i=0;i<=NS;i++){const a=pts[Math.max(0,i-1)],b=pts[Math.min(NS,i+1)],tg=b.clone().sub(a).normalize(),p=pts[i];
        for(const sd of [-1,1]){pos.push(p.x,p.y,p.z);tan.push(tg.x,tg.y,tg.z);uvs.push(i/NS,sd);info.push(IDX[r.f],seed,rank,wScale)}}
      for(let i=0;i<NS;i++){const a=vb+i*2;idx.push(a,a+1,a+2,a+1,a+3,a+2)}vb+=(NS+1)*2}}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(new Float32Array(pos),3));g.setAttribute('aTan',new THREE.BufferAttribute(new Float32Array(tan),3));g.setAttribute('aUV',new THREE.BufferAttribute(new Float32Array(uvs),2));g.setAttribute('aInfo',new THREE.BufferAttribute(new Float32Array(info),4));g.setIndex(new THREE.BufferAttribute(new Uint32Array(idx),1));
  strandMesh=new THREE.Mesh(g,new THREE.ShaderMaterial({uniforms:strandU,vertexShader:strandVS,fragmentShader:strandFS,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide}));strandMesh.renderOrder=2;strandMesh.frustumCulled=false;earthGroup.add(strandMesh)}

/* Canopy columns: thin glowing bars over the tallest forests, like GEDI laser tracks. */
function buildColumns(forestMap){
  const pts=[];let seed=7;const rnd=()=>{seed=(seed*16807)%2147483647;return seed/2147483647};
  for(let tries=0;tries<60000&&pts.length<420;tries++){const lon=rnd()*360-180,lat=Math.asin(rnd()*2-1)/DEG;if(Math.abs(lat)>68)continue;const x=Math.floor((lon+180)/360*LW)%LW,y=Math.floor((lat+90)/180*LH),f=forestMap[y*LW+x];if(f>.38&&rnd()<f)pts.push({lon,lat,f})}
  const geo=new THREE.CylinderGeometry(.0035,.008,1,5,1);geo.translate(0,.5,0);
  const mat=new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.8,depthWrite:false});
  columns=new THREE.InstancedMesh(geo,mat,pts.length);columns.renderOrder=2;columns.frustumCulled=false;
  const c=new THREE.Color(),m=new THREE.Matrix4();
  columnData=pts.map((p,i)=>{const pos=ll(p.lon,p.lat,R*1.001),q=new THREE.Quaternion().setFromUnitVectors(UP,pos.clone().normalize());c.setHSL(.3-.04*p.f,.75,.4+.28*p.f);columns.setColorAt(i,c);return {pos,q,f:p.f,ph:rnd()*6.28}});
  earthGroup.add(columns)}
const _s=new V3(),_m=new THREE.Matrix4();
function updateColumns(){if(!columns)return;const fa=smooth.forest/100+boost[IDX.forest]*.3;for(let i=0;i<columnData.length;i++){const d=columnData[i],h=(.01+.1*d.f*fa)*(1+.12*Math.sin(time*1.5+d.ph))+boost[IDX.forest]*.03;_s.set(1,h,1);_m.compose(d.pos,d.q,_s);columns.setMatrixAt(i,_m)}columns.instanceMatrix.needsUpdate=true;columns.visible=fa>.04}

/* Stars + a faint blue nebula behind everything. */
function buildSky(){
  const n=1600,p=new Float32Array(n*3),c=new Float32Array(n*3);for(let i=0;i<n;i++){const u=hash1(i*3+1)*TAU,v=Math.acos(2*hash1(i*3+2)-1),r=70;p[i*3]=r*Math.sin(v)*Math.cos(u);p[i*3+1]=r*Math.cos(v);p[i*3+2]=r*Math.sin(v)*Math.sin(u)-10;const b=.35+.65*Math.pow(hash1(i*3+3),3),tint=hash1(i*7+1);c[i*3]=b*(.8+.2*tint);c[i*3+1]=b*.9;c[i*3+2]=b*(1-.2*tint)}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(p,3));g.setAttribute('color',new THREE.BufferAttribute(c,3));
  stars=new THREE.Points(g,new THREE.PointsMaterial({size:1.5*dpr,sizeAttenuation:false,vertexColors:true,transparent:true,opacity:.9,depthWrite:false}));scene.add(stars);
  const cv=document.createElement('canvas');cv.width=cv.height=256;const x=cv.getContext('2d'),gr=x.createRadialGradient(128,128,0,128,128,128);gr.addColorStop(0,'rgba(40,110,190,.38)');gr.addColorStop(.5,'rgba(24,60,120,.14)');gr.addColorStop(1,'rgba(10,20,50,0)');x.fillStyle=gr;x.fillRect(0,0,256,256);
  nebula=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(cv),transparent:true,depthWrite:false,blending:THREE.AdditiveBlending}));nebula.scale.set(16,16,1);nebula.position.set(-.3,0,-6);scene.add(nebula)}

/* Glow-particle pool: note trails, hand sparks, impact bursts. */
const PN=3200;let pHead=0;const pPos=new Float32Array(PN*3),pCol=new Float32Array(PN*4),pSize=new Float32Array(PN),pVel=new Float32Array(PN*3),pLife=new Float32Array(PN),pMax=new Float32Array(PN),pS0=new Float32Array(PN),pDrag=new Float32Array(PN);
function buildParticles(){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(pPos,3).setUsage(35048));g.setAttribute('aColor',new THREE.BufferAttribute(pCol,4).setUsage(35048));g.setAttribute('aSize',new THREE.BufferAttribute(pSize,1).setUsage(35048));
  particles=new THREE.Points(g,new THREE.ShaderMaterial({uniforms:{uScale:{value:600}},vertexShader:partVS,fragmentShader:partFS,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false}));particles.frustumCulled=false;particles.renderOrder=6;scene.add(particles)}
const _c=new THREE.Color();
function emit(p,vx,vy,vz,hex,life,size,drag=1.5){const i=pHead;pHead=(pHead+1)%PN;pPos[i*3]=p.x;pPos[i*3+1]=p.y;pPos[i*3+2]=p.z;pVel[i*3]=vx;pVel[i*3+1]=vy;pVel[i*3+2]=vz;const rgb=hexRGB(hex);pCol[i*4]=rgb[0];pCol[i*4+1]=rgb[1];pCol[i*4+2]=rgb[2];pCol[i*4+3]=1;pLife[i]=life;pMax[i]=life;pS0[i]=size;pSize[i]=size;pDrag[i]=drag}
function updateParticles(dt){for(let i=0;i<PN;i++){if(pLife[i]<=0){pSize[i]=0;continue}pLife[i]-=dt;const k=Math.max(0,pLife[i]/pMax[i]),dr=Math.exp(-pDrag[i]*dt);pVel[i*3]*=dr;pVel[i*3+1]*=dr;pVel[i*3+2]*=dr;pPos[i*3]+=pVel[i*3]*dt;pPos[i*3+1]+=pVel[i*3+1]*dt;pPos[i*3+2]+=pVel[i*3+2]*dt;pCol[i*4+3]=k;pSize[i]=pS0[i]*(.35+.65*k)}
  const a=particles.geometry.attributes;a.position.needsUpdate=a.aColor.needsUpdate=a.aSize.needsUpdate=true;particles.material.uniforms.uScale.value=renderer.domElement.height/(2*FOV_T)}

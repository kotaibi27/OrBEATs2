/* =====================================================================
   Part 3 · the 3D world: renderer, shaders for Earth / clouds / glow / strands
   ===================================================================== */
if(!document.createElement('canvas').getContext('webgl2')){$('music-state').textContent='3D needs WebGL 2 · try Chrome or Edge';$('start').textContent='▶ Play music (no 3D)';announce('This browser cannot draw the 3D Earth. Music still works; for the full experience open the file in Chrome or Edge.',false);throw new Error('WebGL 2 is not available')}
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
renderer.setClearColor(0x030711,1);
const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(30,1,.1,200),FOV_T=Math.tan(15*DEG);
const SCENE_CENTER=new V3(0,0,0);let width=1000,height=700,dpr=1,camDist=11;
onStop(()=>{try{renderer.dispose();renderer.forceContextLoss()}catch{}});
const earthGroup=new THREE.Group();scene.add(earthGroup);
const UP=new V3(0,1,0);

/* Uniforms shared by the Earth, clouds and strands so one number drives everything. */
const U={uTime:{value:0},uBass:{value:0},uSun:{value:new V3(0,0,1)},uCam:{value:new V3(0,0,5)},uBump:{value:.3},
  uV:{value:new Array(8).fill(.4)},uBoost:{value:new Array(8).fill(0)},
  uImp:{value:Array.from({length:10},()=>new THREE.Vector4(0,0,1,2))},uImpCol:{value:Array.from({length:10},()=>new THREE.Vector4(1,1,1,0))}};

/* Shared GLSL: noise and the equirectangular lookup. */
const GLSL_COMMON=`
float hash31(vec3 p){p=fract(p*.3183099+.1);p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
float vnoise(vec3 x){vec3 i=floor(x),f=fract(x);f=f*f*(3.-2.*f);
 return mix(mix(mix(hash31(i),hash31(i+vec3(1,0,0)),f.x),mix(hash31(i+vec3(0,1,0)),hash31(i+vec3(1,1,0)),f.x),f.y),
            mix(mix(hash31(i+vec3(0,0,1)),hash31(i+vec3(1,0,1)),f.x),mix(hash31(i+vec3(0,1,1)),hash31(i+vec3(1,1,1)),f.x),f.y),f.z);}
float fbm(vec3 p){float a=.5,s=0.;for(int i=0;i<5;i++){s+=a*vnoise(p);p=p*2.03+vec3(1.7,9.2,3.1);a*=.5;}return s;}
vec2 sphUV(vec3 n){return vec2(atan(-n.z,n.x)/6.2831853+.5,asin(clamp(n.y,-1.,1.))/3.14159265+.5);}
`;
/* Earth surface */
const earthVS=`varying vec3 vPos;void main(){vPos=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
const earthFS=`precision highp float;
uniform sampler2D uDay,uLights,uWater,uTopo,uLayA,uLayB;
uniform vec3 uSun,uCam;uniform float uTime,uBass,uBump;
uniform float uV[8];uniform float uBoost[8];uniform vec4 uImp[10];uniform vec4 uImpCol[10];
varying vec3 vPos;
${GLSL_COMMON}
vec3 sstRamp(float t){t=clamp(t,0.,1.);vec3 c0=vec3(.03,.13,.34),c1=vec3(.05,.32,.66),c2=vec3(.05,.60,.82),c3=vec3(.16,.82,.80),c4=vec3(.98,.80,.42),c5=vec3(1.,.42,.22);
 if(t<.28)return mix(c0,c1,t/.28);if(t<.5)return mix(c1,c2,(t-.28)/.22);if(t<.68)return mix(c2,c3,(t-.5)/.18);if(t<.86)return mix(c3,c4,(t-.68)/.18);return mix(c4,c5,(t-.86)/.14);}
vec3 gediRamp(float t){t=clamp(t,0.,1.);vec3 a=vec3(.42,.31,.16),b=vec3(.14,.36,.17),c=vec3(.25,.68,.28),d=vec3(.65,.93,.42),e=vec3(.96,1.,.88);
 if(t<.25)return mix(a,b,t/.25);if(t<.5)return mix(b,c,(t-.25)/.25);if(t<.75)return mix(c,d,(t-.5)/.25);return mix(d,e,(t-.75)/.25);}
void main(){
 vec3 N0=normalize(vPos),V=normalize(uCam-vPos);
 vec2 uv=sphUV(N0);vec2 uvB=vec2(fract(uv.x+.5)-.5,uv.y);
 vec2 dx=dFdx(uv),dy=dFdy(uv),dxB=dFdx(uvB),dyB=dFdy(uvB);
 if(dot(dxB,dxB)+dot(dyB,dyB)<dot(dx,dx)+dot(dy,dy)){dx=dxB;dy=dyB;}
 float lat=asin(clamp(N0.y,-1.,1.)),t=uTime;
 vec3 base=textureGrad(uDay,uv,dx,dy).rgb;
 float wat=smoothstep(.3,.7,textureGrad(uWater,uv,dx,dy).r);
 float h=textureGrad(uTopo,uv,dx,dy).r;
 vec4 LA=textureGrad(uLayA,uv,dx,dy),LB=textureGrad(uLayB,uv,dx,dy);
 float lum=dot(base,vec3(.3,.55,.15));
 /* relief: bump-map the land so mountains catch the light */
 vec3 dpx=dFdx(vPos),dpy=dFdy(vPos);float hx=dFdx(h),hy=dFdy(h);
 vec3 r1=cross(dpy,N0),r2=cross(N0,dpx);float det=dot(dpx,r1);
 vec3 grad=sign(det)*(hx*r1+hy*r2);
 vec3 N=normalize(abs(det)*N0-uBump*(1.-wat)*(.7+.8*uV[6])*grad*.6);
 vec3 alb=base;
 /* OCEAN WARMTH: sea-surface colour ramp, warm toward the tropics and with the slider */
 float nsst=fbm(N0*3.2+vec3(0.,t*.01,0.));
 float sst=pow(max(cos(lat),0.),1.6)*.5+uV[0]*.5-.02+(nsst-.5)*.12;
 float tint=(smoothstep(.04,.95,uV[0])*.6+uBoost[0]*.2)*wat;
 alb=mix(alb,sstRamp(sst)*(.62+lum*2.2),tint);
 /* FOREST HEIGHT: greener land and a GEDI-style canopy ramp */
 float green=smoothstep(.012,.075,base.g-max(base.r,base.b))*(1.-wat);
 float fa=uV[6]+uBoost[6]*.3;
 alb=mix(alb,gediRamp(green*(.22+.78*LB.b)*(.7+.9*fa))*(.62+lum*1.9),green*smoothstep(.04,.85,fa)*.78);
 /* AEROSOLS and AIR: drifting patches that live where dust, smoke and pollution really gather */
 vec3 wind=vec3(t*.012,0.,t*.004);
 float aeroA=uV[2]+uBoost[2]*.3,airA=uV[3]+uBoost[3]*.3;
 float nz=0.,nz2=0.,patchy=0.;
 if(aeroA+airA>.03){nz=fbm(N0*5.+wind);nz2=fbm(N0*11.-wind*1.7+vec3(3.,1.,2.));patchy=smoothstep(.3,.72,nz*.72+nz2*.42);}vec4 A=LA*aeroA*1.9;float tot=A.r+A.g+A.b+A.a+1e-4;
 vec3 aeroCol=(A.r*vec3(.95,.30,.82)+A.g*vec3(1.,.46,.16)+A.b*vec3(.30,.58,1.)+A.a*vec3(.45,.95,.45))/tot;
 alb=mix(alb,aeroCol*(.7+.5*lum),clamp(tot,0.,1.)*patchy*.88);
 alb=mix(alb,mix(vec3(.82,.62,.52),vec3(.95,.42,.55),airA),clamp(LB.r*airA*2.4,0.,1.)*smoothstep(.2,.7,nz*.8+nz2*.4+.14)*.72);
 /* LIGHTING */
 float ndl0=dot(N0,uSun),ndl=dot(N,uSun);
 float term=smoothstep(-.06,.26,ndl0),dif=clamp(ndl,0.,1.);
 vec3 col=alb*(vec3(.014,.022,.05)+term*vec3(1.,.97,.93)*(.42+.88*dif));
 col+=alb*vec3(.9,.4,.15)*exp(-pow(ndl0/.09,2.))*.14;
 /* sun glitter on the sea, gently animated by the current speed */
 vec3 Hh=normalize(uSun+V);float nh=max(dot(N0,Hh),0.);
 float wave=.5;if(nh>.93)wave=fbm(N0*70.+vec3(t*(.04+uV[1]*.1),t*.03,0.));
 col+=vec3(1.,.96,.88)*(pow(nh,160.)*(.5+1.1*wave)*1.3+pow(nh,18.)*.07)*wat*term;
 col+=vec3(.10,.18,.33)*pow(1.-max(dot(N0,V),0.),4.)*wat*(.2+term);
 /* CURRENT SPEED: fine streaks on the sea that slide faster as the slider rises */
 float streak=0.;if(uV[1]>.03&&wat>.01)streak=pow(1.-abs(2.*fbm(vec3(N0.x*30.+t*(.08+uV[1]*.5),N0.y*60.,N0.z*30.))-1.),7.);
 col+=vec3(.35,.8,1.)*streak*wat*uV[1]*.045*(.25+term);
 /* CARBON DIOXIDE: amber ribbons where the plumes travel */
 float co2A=uV[4]+uBoost[4]*.3,rib=0.;
 if(co2A>.03)rib=pow(1.-abs(2.*fbm(vec3(N0.x*3.2,N0.y*10.+t*.03,N0.z*3.2)+vec3(0.,0.,t*.01))-1.),3.);
 col+=vec3(1.,.6,.28)*LB.g*co2A*(.25+1.0*rib)*(.35+.65*term)*.8;
 /* NIGHT LIGHTS: faint by day, blazing on the dark side */
 float L=textureGrad(uLights,uv,dx,dy).r,Lb=textureGrad(uLights,uv,dx*9.,dy*9.).r;
 float cityA=uV[7]+uBoost[7]*.5,dark=smoothstep(.15,-.2,ndl0);
 col+=(vec3(1.,.76,.42)*L*1.15+vec3(1.,.6,.25)*Lb*.55)*cityA*(.22+2.4*dark);
 /* REGION RINGS: where a note lands, a ripple spreads across the surface in that variable's colour */
 for(int i=0;i<10;i++){if(uImp[i].w<1.){float ang=acos(clamp(dot(N0,uImp[i].xyz),-1.,1.)),age=uImp[i].w,rr=.04+age*.5;
   float ring=exp(-pow((ang-rr)/.03,2.))*(1.-age),core=exp(-ang*ang/(.012+.04*age))*(1.-age)*(1.-age);
   col+=uImpCol[i].rgb*(ring*1.1+core*1.5);}}
 /* THIN ATMOSPHERE at the limb */
 float fres=pow(1.-max(dot(N0,V),0.),3.4);
 vec3 atm=mix(vec3(.28,.55,1.),vec3(.95,.55,.5),clamp(uV[3]*.5+uV[2]*.3,0.,.6));
 col+=atm*fres*(.2+.9*term)*(.85+uBass*.4);
 col+=vec3(1.,.5,.25)*exp(-pow(ndl0/.1,2.))*fres*.3;
 col=col/(1.+.16*col);
 gl_FragColor=vec4(col,1.);}`;
/* Clouds (water vapor) */
const cloudFS=`precision highp float;
uniform sampler2D uLayB;uniform vec3 uSun,uCam;uniform float uTime;uniform float uV[8];uniform float uBoost[8];
varying vec3 vPos;
${GLSL_COMMON}
void main(){
 vec3 N0=normalize(vPos);vec2 uv=sphUV(N0);vec2 uvB=vec2(fract(uv.x+.5)-.5,uv.y);
 vec2 dx=dFdx(uv),dy=dFdy(uv),dxB=dFdx(uvB),dyB=dFdy(uvB);
 if(dot(dxB,dxB)+dot(dyB,dyB)<dot(dx,dx)+dot(dy,dy)){dx=dxB;dy=dyB;}
 float riv=textureGrad(uLayB,uv,dx,dy).a,lat=asin(clamp(N0.y,-1.,1.)),t=uTime,wv=uV[5]+uBoost[5]*.25;
 vec3 p=N0*2.6+vec3(t*.006,0.,t*.004);
 vec3 q=vec3(fbm(p+vec3(0.,3.1,1.7)),fbm(p+vec3(5.2,1.3,2.8)),fbm(p+vec3(2.2,7.4,6.1)));
 float d=fbm(p+1.8*q);
 float bands=.045*exp(-pow(lat/.25,2.))+.07*exp(-pow((abs(lat)-.85)/.22,2.));
 float ar=riv*wv*(.55+.9*fbm(p*3.+q));
 float thr=mix(.82,.5,clamp(wv,0.,1.));
 float c=smoothstep(thr,thr+.17,d+bands+ar*.45);
 float lit=smoothstep(-.12,.45,dot(N0,uSun));
 vec3 col=mix(vec3(.05,.07,.12),vec3(1.,.99,.97),lit)*(.78+.22*d);
 col+=vec3(1.,.5,.25)*exp(-pow(dot(N0,uSun)/.1,2.))*.25;
 gl_FragColor=vec4(col,c*.86);}`;
/* Atmosphere halo: brightness depends on how close the view ray passes to Earth's edge, so it fades smoothly to nothing */
const haloVS=`varying vec3 vWp;void main(){vWp=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*viewMatrix*vec4(vWp,1.);}`;
const haloFS=`precision highp float;uniform vec3 uSunW;uniform float uBass;uniform float uV[8];varying vec3 vWp;
void main(){vec3 rd=normalize(vWp-cameraPosition);vec3 pn=cameraPosition+rd*dot(-cameraPosition,rd);float rho=length(pn);
 float t=clamp((rho-1.6)/(.16*1.6),0.,1.);float i=pow(1.-t,3.2);float s=.25+.75*smoothstep(-.3,.6,dot(normalize(pn),uSunW));
 vec3 c=mix(vec3(.3,.58,1.),vec3(.95,.55,.5),clamp(uV[3]*.5+uV[2]*.3,0.,.6));gl_FragColor=vec4(c*(1.+uBass*.6),i*s*1.05);}`;
/* Strands: camera-facing ribbons with light pulses travelling along them */
const strandVS=`attribute vec3 aTan;attribute vec2 aUV;attribute vec4 aInfo;
uniform float uLevel[8];uniform float uBoost[8];uniform float uWidth;
varying vec2 vUV;varying vec4 vInfo;varying float vLevel;varying vec3 vObj;
void main(){int f=int(aInfo.x+.5);float lv=uLevel[f],bo=uBoost[f];vLevel=lv;vUV=aUV;vInfo=aInfo;vObj=position;
 vec3 wp=(modelMatrix*vec4(position,1.)).xyz;vec3 tw=normalize((modelMatrix*vec4(aTan,0.)).xyz);
 vec3 vd=normalize(cameraPosition-wp);vec3 side=normalize(cross(tw,vd));
 wp+=side*aUV.y*uWidth*aInfo.w*(.7+.7*lv+.5*bo);
 gl_Position=projectionMatrix*viewMatrix*vec4(wp,1.);}`;
const strandFS=`precision highp float;
uniform float uTime,uPart;uniform float uV[8];uniform float uBoost[8];uniform vec3 uCol[8];uniform vec4 uImp[10];uniform vec4 uImpCol[10];
varying vec2 vUV;varying vec4 vInfo;varying float vLevel;varying vec3 vObj;
void main(){int f=int(vInfo.x+.5);float lv=vLevel;
 float vis=smoothstep(vInfo.z-.02,vInfo.z+.14,lv*1.12);if(vis<.01)discard;
 /* local glow: strands light up near a region just hit with this variable's note */
 float loc=0.;vec3 on=normalize(vObj);
 for(int i=0;i<10;i++){if(uImp[i].w<1.&&abs(uImpCol[i].a-vInfo.x)<.5){float ang=acos(clamp(dot(on,uImp[i].xyz),-1.,1.));loc+=exp(-ang*ang/.22)*(1.-uImp[i].w);}}
 float t=vUV.x,across=vUV.y,prof=exp(-across*across*2.8);
 float spd=(.05+.07*(f==5?.7:1.))*(.35+1.7*uV[1])*(1.+loc*1.5);
 float phase=fract(vInfo.y+uTime*spd);
 float d=fract(phase-t*2.);float c=exp(-d*7.5),head=exp(-pow(d*16.,2.));
 float edge=smoothstep(0.,.06,t)*smoothstep(1.,.94,t);
 float inten=(.11+uPart*(c*.85+head*.9))*prof*edge;
 vec3 col=mix(uCol[f],vec3(1.),head*.5*uPart+.1);
 float a=inten*vis*(.4+.55*lv+.9*uBoost[f]+1.8*loc);
 gl_FragColor=vec4(col,a);}`;
/* Soft glowing particles (note trails, impact sparkles) */
const partVS=`attribute float aSize;attribute vec4 aColor;uniform float uScale;varying vec4 vC;void main(){vC=aColor;vec4 mv=modelViewMatrix*vec4(position,1.);gl_PointSize=max(0.,aSize*uScale/(-mv.z));gl_Position=projectionMatrix*mv;}`;
const partFS=`precision highp float;varying vec4 vC;void main(){float d=length(gl_PointCoord-.5)*2.;float a=smoothstep(1.,0.,d);a*=a;gl_FragColor=vec4(vC.rgb,vC.a*a);}`;

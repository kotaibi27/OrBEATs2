/* =====================================================================
   Part 5 · the Moon, and the "hand" that sends notes: the slider you are using
   ===================================================================== */
const _v=new V3(),_v2=new V3(),_v3=new V3();
let moon;const moonU={uSunW:{value:new V3(0,0,1)},uMoonC:{value:new V3()}};
const moonFS=`precision highp float;uniform vec3 uSunW,uMoonC;varying vec3 vP;varying vec3 vW;
${GLSL_COMMON}
vec3 h3(vec3 p){return vec3(hash31(p),hash31(p+7.3),hash31(p+19.1));}
void main(){vec3 n=normalize(vW-uMoonC),p=normalize(vP);
 float base=fbm(p*2.4),maria=smoothstep(.5,.62,fbm(p*1.25+4.));
 vec3 q=p*7.;vec3 ci=floor(q),cf=fract(q);float cr=0.;
 for(int x=-1;x<=1;x++)for(int y=-1;y<=1;y++)for(int z=-1;z<=1;z++){vec3 o=vec3(float(x),float(y),float(z)),h=h3(ci+o);float rc=.12+.26*h.x,d=length(o+h-cf);cr+=-.22*smoothstep(rc,rc*.5,d)*(.4+h.y)+.16*exp(-pow((d-rc)/.045,2.))*(.4+h.z);}
 vec3 alb=mix(vec3(.66,.65,.62),vec3(.28,.29,.32),maria)*(.7+.55*base)+cr*.55;
 float lit=smoothstep(-.04,.3,dot(n,uSunW));
 vec3 col=alb*(lit*1.1+.018)+vec3(.012,.02,.04)*(1.-lit);
 col+=vec3(.25,.5,1.)*pow(1.-abs(dot(n,normalize(cameraPosition-vW))),4.)*.12*lit;
 gl_FragColor=vec4(col/(1.+.15*col),1.);}`;
function buildMoon(){moon=new THREE.Mesh(new THREE.SphereGeometry(.42,64,48),new THREE.ShaderMaterial({uniforms:moonU,vertexShader:`varying vec3 vP;varying vec3 vW;void main(){vP=position;vW=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*viewMatrix*vec4(vW,1.);}`,fragmentShader:moonFS}));scene.add(moon)}
/* The Moon circles Earth about once every 90 seconds and always shows us the same face. */
function updateMoon(){const a=time*.07+2.2;moon.position.set(3*Math.cos(a),1.5*Math.sin(a),2.6*Math.sin(a));moon.lookAt(0,0,0);moonU.uSunW.value.copy(_sun);moonU.uMoonC.value.copy(moon.position)}
/* Where notes start: the edge of the control panel, level with the slider that owns the variable. */
const _ray=new THREE.Raycaster(),_ndc2=new THREE.Vector2();
function sourcePoint(k){const r=D[IDX[k]].div.getBoundingClientRect(),pr=$('controls').getBoundingClientRect(),cr=canvas.getBoundingClientRect(),top=0,bot=0;
  let x,y;if(width>760){x=pr.left-6-cr.left;y=r.top+r.height/2-cr.top}else{x=r.left+r.width/2-cr.left;y=height}
  y=Math.max(top+14,Math.min(height-bot-14,y));x=Math.max(8,Math.min(width-8,x));
  _ndc2.set(x/width*2-1,-(y/height)*2+1);_ray.setFromCamera(_ndc2,camera);const o=_ray.ray.origin,d=_ray.ray.direction,t=(.9-o.z)/d.z;return new V3().copy(o).addScaledVector(d,t)}
/* The slider lights up in its own colour each time it sends a note, and the caption says what the sound means. */
function pulseControl(k){const d=D[IDX[k]];d.div.classList.add('fire');clearTimeout(d.ft);d.ft=setTimeout(()=>d.div.classList.remove('fire'),450);
  const L=LABELS.find(l=>l.k===k);setCaption(`${d.n} (${d.voice}) → ${L.n}`)}
const meterEl=$('meter');for(let i=0;i<22;i++)meterEl.appendChild(document.createElement('span'));let meterOn=0;
function updateMeter(){const n=running?Math.round(Math.min(1,audioLevel*1.7)*22):0;if(n===meterOn)return;meterOn=n;[...meterEl.children].forEach((s,i)=>s.classList.toggle('on',i<n))}

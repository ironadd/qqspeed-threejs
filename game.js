'use strict';
const $=id=>document.getElementById(id);
const Q=new URLSearchParams(location.search);
const TAU=Math.PI*2, clamp=(v,a,b)=>v<a?a:v>b?b:v, lerp=(a,b,t)=>a+(b-a)*t;
let rng=1;const rand=()=>{rng=(rng*16807)%2147483647;return (rng-1)/2147483646;};
// ================= AUDIO =================
const Audio={ctx:null,muted:localStorage.qqs_mute==='1',
 init(){ if(this.ctx)return; const C=window.AudioContext||window.webkitAudioContext; if(!C)return;
  const c=this.ctx=new C(); this.master=c.createGain(); this.master.gain.value=this.muted?0:0.8; this.master.connect(c.destination);
  this.sfx=c.createGain(); this.sfx.gain.value=0.9; this.sfx.connect(this.master);
  this.mus=c.createGain(); this.mus.gain.value=0.32; this.mus.connect(this.master);
  const len=c.sampleRate*2, b=c.createBuffer(1,len,c.sampleRate), d=b.getChannelData(0); for(let i=0;i<len;i++)d[i]=Math.random()*2-1; this.noise=b;
  // engine
  this.eg=c.createGain(); this.eg.gain.value=0; this.ef=c.createBiquadFilter(); this.ef.type='lowpass'; this.ef.frequency.value=900;
  this.o1=c.createOscillator(); this.o1.type='sawtooth'; this.o2=c.createOscillator(); this.o2.type='square';
  const g2=c.createGain(); g2.gain.value=0.4; this.o1.connect(this.ef); this.o2.connect(g2); g2.connect(this.ef); this.ef.connect(this.eg); this.eg.connect(this.sfx);
  this.o1.start(); this.o2.start();
  // screech
  this.sn=c.createBufferSource(); this.sn.buffer=b; this.sn.loop=true; const bp=c.createBiquadFilter(); bp.type='bandpass'; bp.frequency.value=2400; bp.Q.value=3;
  this.sg=c.createGain(); this.sg.gain.value=0; this.sn.connect(bp); bp.connect(this.sg); this.sg.connect(this.sfx); this.sn.start();
  // wind (boost)
  this.wn=c.createBufferSource(); this.wn.buffer=b; this.wn.loop=true; this.wf=c.createBiquadFilter(); this.wf.type='lowpass'; this.wf.frequency.value=600;
  this.wg=c.createGain(); this.wg.gain.value=0; this.wn.connect(this.wf); this.wf.connect(this.wg); this.wg.connect(this.sfx); this.wn.start();
  this.musicStart();
 },
 resume(){ this.init(); if(this.ctx&&this.ctx.state!=='running')this.ctx.resume(); },
 setMute(m){this.muted=m; localStorage.qqs_mute=m?'1':'0'; if(this.master)this.master.gain.setTargetAtTime(m?0:0.8,this.ctx.currentTime,0.05);},
 engine(speed,on,drift,boost){ if(!this.ctx)return; const t=this.ctx.currentTime, s=Math.abs(speed);
  const gear=s%14/14; const f=55+s*3.2+gear*40;
  this.o1.frequency.setTargetAtTime(f,t,0.05); this.o2.frequency.setTargetAtTime(f*0.5,t,0.05);
  this.ef.frequency.setTargetAtTime(500+s*40,t,0.1); this.eg.gain.setTargetAtTime(on?0.10+s*0.002:0,t,0.1);
  this.sg.gain.setTargetAtTime(drift?0.12:0,t,0.05);
  this.wg.gain.setTargetAtTime(on?(boost?0.35:0.02+s*0.002):0,t,0.15); this.wf.frequency.setTargetAtTime(boost?2500:600,t,0.2);
 },
 tone(freq,dur,type='square',vol=0.3,when=0,slide=0,dest){ if(!this.ctx)return; const c=this.ctx,t=c.currentTime+when;
  const o=c.createOscillator(),g=c.createGain(); o.type=type; o.frequency.setValueAtTime(freq,t); if(slide)o.frequency.exponentialRampToValueAtTime(Math.max(20,freq*slide),t+dur);
  g.gain.setValueAtTime(vol,t); g.gain.exponentialRampToValueAtTime(0.001,t+dur); o.connect(g); g.connect(dest||this.sfx); o.start(t); o.stop(t+dur+0.05);},
 noiseHit(dur,freq,vol=0.5,when=0,type='lowpass',dest){ if(!this.ctx)return; const c=this.ctx,t=c.currentTime+when;
  const s=c.createBufferSource(); s.buffer=this.noise; const f=c.createBiquadFilter(); f.type=type; f.frequency.setValueAtTime(freq,t);
  const g=c.createGain(); g.gain.setValueAtTime(vol,t); g.gain.exponentialRampToValueAtTime(0.001,t+dur); s.connect(f); f.connect(g); g.connect(dest||this.sfx); s.start(t,Math.random()); s.stop(t+dur+0.05); return f;},
 whoosh(){ if(!this.ctx)return; const f=this.noiseHit(1.0,300,0.6); f.frequency.exponentialRampToValueAtTime(4000,this.ctx.currentTime+0.6); this.tone(200,0.6,'sawtooth',0.15,0,3);},
 jet(){ if(!this.ctx)return; const f=this.noiseHit(0.4,500,0.4); f.frequency.exponentialRampToValueAtTime(3000,this.ctx.currentTime+0.3);},
 pickup(){ [880,1175,1568].forEach((f,i)=>this.tone(f,0.12,'triangle',0.25,i*0.06)); },
 crash(){ this.noiseHit(0.35,700,0.7); this.tone(120,0.3,'square',0.25,0,0.3); },
 beep(hi){ this.tone(hi?1320:660,hi?0.6:0.25,'square',0.25); },
 charge(){ this.tone(1000,0.15,'sine',0.25,0,1.8); this.tone(1500,0.2,'sine',0.2,0.08,1.5);},
 fire(){ this.noiseHit(0.5,1500,0.4,0,'bandpass'); this.tone(600,0.4,'sawtooth',0.15,0,0.3);},
 explode(){ this.noiseHit(0.8,400,0.9); this.tone(80,0.6,'sine',0.5,0,0.3);},
 fanfare(win){ const n=win?[523,659,784,1047,784,1047]:[392,349,330,262]; n.forEach((f,i)=>{this.tone(f,0.35,'square',0.18,i*0.16);this.tone(f/2,0.35,'triangle',0.2,i*0.16);}); },
 click(){ this.tone(1200,0.05,'square',0.12); },
 musicStart(){ const c=this.ctx; const bpm=132, st=60/bpm/4; let step=0, next=c.currentTime+0.1;
  const prog=[[57,60,64],[53,57,60],[48,52,55],[55,59,62]]; // Am F C G
  const lead=[76,0,72,74,76,0,79,76,74,0,72,69,72,0,74,0, 72,0,69,72,74,0,76,74,72,0,67,69,67,0,0,0];
  const mf=m=>440*Math.pow(2,(m-69)/12);
  const tick=()=>{ while(next<c.currentTime+0.2){ const when=next-c.currentTime; const bar=Math.floor(step/16)%4, s=step%16, ch=prog[bar];
     if(s%4===0)this.kick(when); if(s%4===2)this.noiseHit(0.05,8000,0.12,when,'highpass',this.mus); if(s===4||s===12)this.noiseHit(0.15,1800,0.3,when,'bandpass',this.mus);
     if(s%2===0)this.tone(mf(ch[0]-24+(s%4===2?12:0)),st*1.8,'sawtooth',0.18,when,0,this.mus);
     if(s%8===0)ch.forEach(n=>this.tone(mf(n),st*7,'triangle',0.06,when,0,this.mus));
     const l=lead[(step%32)]; if(l&&Math.floor(step/32)%2===1)this.tone(mf(l),st*1.6,'square',0.06,when,0,this.mus);
     step++; next+=st; } };
  setInterval(()=>{ if(c.state==='running')tick(); else next=c.currentTime+0.1; },50);
 },
 kick(when){ const c=this.ctx,t=c.currentTime+when,o=c.createOscillator(),g=c.createGain(); o.frequency.setValueAtTime(150,t); o.frequency.exponentialRampToValueAtTime(40,t+0.15);
  g.gain.setValueAtTime(0.6,t); g.gain.exponentialRampToValueAtTime(0.001,t+0.2); o.connect(g); g.connect(this.mus); o.start(t); o.stop(t+0.25);}
};
// ================= RENDERER =================
let quality=localStorage.qqs_q||'high';
const renderer=new THREE.WebGLRenderer({antialias:quality==='high',powerPreference:'high-performance'});
renderer.outputColorSpace=THREE.SRGBColorSpace; renderer.toneMapping=THREE.ACESFilmicToneMapping; renderer.toneMappingExposure=1.05;
renderer.shadowMap.enabled=true; renderer.shadowMap.type=THREE.PCFSoftShadowMap;
$('game').appendChild(renderer.domElement);
const camera=new THREE.PerspectiveCamera(70,1,0.3,2500);
function applyQuality(){ renderer.setPixelRatio(Math.min(window.devicePixelRatio||1, quality==='high'?2:quality==='mid'?1.5:1)); renderer.shadowMap.enabled=quality!=='low'; onResize(); $('qbtn').textContent='画质: '+({high:'高',mid:'中',low:'低'})[quality]; }
function onResize(){ const w=innerWidth,h=innerHeight; renderer.setSize(w,h); camera.aspect=w/h; camera.updateProjectionMatrix(); sl.width=w; sl.height=h; }
const sl=$('speedlines'), slx=sl.getContext('2d');
addEventListener('resize',onResize);
function canvasTex(w,h,draw,rep){ const c=document.createElement('canvas'); c.width=w;c.height=h; draw(c.getContext('2d'),w,h); const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; t.anisotropy=4; if(rep){t.wrapS=t.wrapT=THREE.RepeatWrapping;} return t;}
// textures
const walkTex=canvasTex(128,128,(g,w,h)=>{g.fillStyle='#9a9aa2';g.fillRect(0,0,w,h);g.strokeStyle='#7c7c86';g.lineWidth=3;for(let i=0;i<=4;i++){g.beginPath();g.moveTo(i*32,0);g.lineTo(i*32,h);g.moveTo(0,i*32);g.lineTo(w,i*32);g.stroke();}},true);
const chevTex=canvasTex(256,64,(g,w,h)=>{g.fillStyle='#111';g.fillRect(0,0,w,h);g.fillStyle='#ffd23c';for(let i=0;i<4;i++){const x=20+i*60;g.beginPath();g.moveTo(x,6);g.lineTo(x+28,6);g.lineTo(x+52,32);g.lineTo(x+28,58);g.lineTo(x,58);g.lineTo(x+24,32);g.fill();}});
const zebraTex=canvasTex(128,32,(g,w,h)=>{for(let i=0;i<8;i++){g.fillStyle=i%2?'rgba(0,0,0,0)':'#f4f4f4';g.fillRect(i*16,0,16,h);}});
const dayTex=canvasTex(64,128,(g,w,h)=>{ g.fillStyle='#f2ece0'; g.fillRect(0,0,w,h); g.fillStyle='#d8cfbf'; for(let y=0;y<h;y+=16)g.fillRect(0,y,w,2); for(let y=5;y<h;y+=16)for(let x=5;x<w;x+=15){ g.fillStyle=Math.random()<0.15?'#ffe2a8':'#5d86ad'; g.fillRect(x,y,8,9); g.fillStyle='#fff'; g.fillRect(x,y+9,8,1);} },true);
const roadTex=canvasTex(256,256,(g,w,h)=>{ g.fillStyle='#3a3d44'; g.fillRect(0,0,w,h); for(let i=0;i<4000;i++){const v=40+Math.random()*50|0; g.fillStyle=`rgb(${v},${v},${v+6})`; g.fillRect(Math.random()*w,Math.random()*h,2,2);}
  g.fillStyle='#fff'; g.fillRect(6,0,6,h); g.fillRect(w-12,0,6,h); g.fillStyle='#ffd23c'; g.fillRect(w/2-4,0,8,h*0.55); },true);
const curbTex=canvasTex(64,64,(g,w,h)=>{ g.fillStyle='#e8263a'; g.fillRect(0,0,w,h/2); g.fillStyle='#fff'; g.fillRect(0,h/2,w,h/2); },true);
const wallTex=canvasTex(128,64,(g,w,h)=>{ const gr=g.createLinearGradient(0,0,0,h); gr.addColorStop(0,'#2f80ff'); gr.addColorStop(1,'#123a8a'); g.fillStyle=gr; g.fillRect(0,0,w,h);
  g.fillStyle='#fff'; g.font='bold 30px sans-serif'; g.fillText('QQ SPEED',4,44); g.fillStyle='#ffde3b'; g.fillRect(0,0,w,6); g.fillRect(0,h-6,w,6);},true);
const checkTex=canvasTex(128,32,(g,w,h)=>{ for(let x=0;x<16;x++)for(let y=0;y<4;y++){g.fillStyle=(x+y)%2?'#111':'#fff'; g.fillRect(x*8,y*8,8,8);} });
const padTex=canvasTex(128,128,(g,w,h)=>{ g.fillStyle='#08f'; g.fillRect(0,0,w,h); g.strokeStyle='#9ff'; g.lineWidth=14; for(let i=0;i<3;i++){g.beginPath(); g.moveTo(20,100-i*36+20); g.lineTo(64,60-i*36+20); g.lineTo(108,100-i*36+20); g.stroke();} });
const boxTex=canvasTex(128,128,(g,w,h)=>{ const gr=g.createLinearGradient(0,0,w,h); gr.addColorStop(0,'#ff6ad5'); gr.addColorStop(0.5,'#c774e8'); gr.addColorStop(1,'#94d0ff'); g.fillStyle=gr; g.fillRect(0,0,w,h); g.strokeStyle='#fff'; g.lineWidth=8; g.strokeRect(4,4,w-8,h-8); g.fillStyle='#fff'; g.font='bold 90px sans-serif'; g.textAlign='center'; g.fillText('?',64,98); });
const winTex=canvasTex(64,128,(g,w,h)=>{ g.fillStyle='#223'; g.fillRect(0,0,w,h); for(let y=4;y<h;y+=12)for(let x=4;x<w;x+=12){ const on=Math.random()<0.55; g.fillStyle=on?(Math.random()<0.5?'#ffd98a':'#fff2c4'):'#2a3550'; g.fillRect(x,y,7,8);} },true);
// ================= TRACKS =================
const TRACKS=[
 {name:'霓虹都市',sub:'Neon Downtown · 夜',type:'city',night:true,r:13,
  corners:[[0,-220],[80,-220],[80,-160],[140,-160],[140,-260],[240,-260],[240,-100],[190,-100],[190,-50],[280,-50],[280,60],[160,60],[160,0],[110,0],[110,60],[-40,60],[-40,-60],[0,-60]],
  sky:['#05031a','#3a1460','#ff4fa0'],fog:'#2a1240',fogD:[60,520],sun:[0.3,0.7,0.4],sunC:'#8aa0ff',sunI:0.7,hemi:['#6a5aff','#201030'],hemiI:0.9,ground:'#1c1a24',bh:[22,90]},
 {name:'阳光街区',sub:'Sunny Old Town · 日',type:'city',night:false,r:12,
  corners:[[0,-180],[70,-180],[70,-130],[110,-130],[110,-220],[200,-220],[200,-20],[150,-20],[150,30],[200,30],[200,110],[60,110],[60,40],[0,40]],
  sky:['#2f7fe0','#9fd0ff','#e8f4ff'],fog:'#cfe4f7',fogD:[120,800],sun:[0.5,0.8,-0.4],sunC:'#fff2d8',sunI:2.4,hemi:['#d8ecff','#7a8a6a'],hemiI:1.1,ground:'#8fb06a',bh:[10,36],park:true},
 {name:'雪域森林',sub:'Snow Forest',type:'spline',pts:[[0,0,0],[0,4,-150],[-60,10,-240],[-170,14,-250],[-230,10,-170],[-200,4,-80],[-260,0,10],[-240,6,120],[-150,12,180],[-60,8,140],[-90,4,60],[-30,0,40]],
  sky:['#4a78c0','#a9cdf0','#eef6ff'],fog:'#dfeaf5',fogD:[80,700],sun:[-0.4,0.6,-0.5],sunC:'#ffffff',hemi:['#dfefff','#8090a0'],ground:'#f2f6fa',water:false,snow:true}
];
function cityPath(C,R){ // polyline with tight fillets (quadratic bezier), starts mid of last->first segment
 const V=(p)=>new THREE.Vector3(p[0],0,p[1]); const n=C.length, pts=[]; const start=V(C[n-1]).add(V(C[0])).multiplyScalar(0.5); pts.push(start);
 for(let i=0;i<n;i++){ const c=V(C[i]), pv=V(C[(i-1+n)%n]), nx=V(C[(i+1)%n]); const a=c.clone().sub(pv), b=nx.clone().sub(c); const la=a.length(), lb=b.length(); a.normalize(); b.normalize();
   const th=Math.acos(clamp(a.dot(b),-1,1)); let t=R*Math.tan(th/2); t=Math.min(t,la*0.45,lb*0.45); const p1=c.clone().addScaledVector(a,-t), p2=c.clone().addScaledVector(b,t);
   for(let k=0;k<=14;k++){ const u=k/14; pts.push(new THREE.Vector3().addScaledVector(p1,(1-u)*(1-u)).addScaledVector(c,2*u*(1-u)).addScaledVector(p2,u*u)); } }
 // resample
 const cum=[0]; for(let i=1;i<=pts.length;i++)cum.push(cum[i-1]+pts[i%pts.length].distanceTo(pts[i-1])); const len=cum[cum.length-1]; const M=Math.floor(len/2.5); const out=[]; let j=0;
 for(let i=0;i<M;i++){ const d=i*len/M; while(cum[j+1]<d)j++; const f=(d-cum[j])/(cum[j+1]-cum[j]||1); out.push(pts[j].clone().lerp(pts[(j+1)%pts.length],f)); }
 return {out,len}; }
const W=16, HW=W/2;
let scene, T, N, P=[], TG=[], SD=[], BK=[], curv=[];
function buildTrack(def){
 scene=new THREE.Scene(); rng=7;
 const city=def.type==='city'; let len; P=[];TG=[];SD=[];BK=[];curv=[];
 if(city){ const r=cityPath(def.corners,def.r); P=r.out; len=r.len; N=P.length; for(let i=0;i<N;i++)TG.push(P[(i+1)%N].clone().sub(P[(i-1+N)%N]).normalize()); }
 else { const curve=new THREE.CatmullRomCurve3(def.pts.map(p=>new THREE.Vector3(p[0]*1.6,p[1],p[2]*1.6)),true,'centripetal');
 len=curve.getLength(); N=Math.floor(len/2.5);
 for(let i=0;i<N;i++){ P.push(curve.getPointAt(i/N)); TG.push(curve.getTangentAt(i/N)); } }
 for(let i=0;i<N;i++){ const a=TG[(i-6+N)%N],b=TG[(i+6)%N]; curv.push(a.x*b.z-a.z*b.x); }
 for(let i=0;i<N;i++){ let c=0; for(let k=-8;k<=8;k++)c+=curv[(i+k+N)%N]; c/=17; BK.push(city?0:clamp(-c*1.1,-0.28,0.28)); }
 for(let i=0;i<N;i++){ const t=TG[i], s=new THREE.Vector3(-t.z,0,t.x).normalize(); SD.push(s); }
 T={def,len};
 // sky
 const skyMat=new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,fog:false,uniforms:{a:{value:new THREE.Color(def.sky[0])},b:{value:new THREE.Color(def.sky[1])},c:{value:new THREE.Color(def.sky[2])},sd:{value:new THREE.Vector3(...def.sun).normalize()}},
  vertexShader:'varying vec3 vp;void main(){vp=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
  fragmentShader:'uniform vec3 a,b,c,sd;varying vec3 vp;void main(){float h=vp.y;vec3 col=h>0.?mix(b,a,pow(clamp(h*1.6,0.,1.),0.7)):mix(b,c,clamp(-h*4.,0.,1.));float s=max(dot(vp,sd),0.);col+=vec3(1.,.85,.6)*(pow(s,600.)*2.+pow(s,8.)*.35);gl_FragColor=vec4(col,1.);}'});
 const sky=new THREE.Mesh(new THREE.SphereGeometry(2000,32,16),skyMat); sky.renderOrder=-1; scene.add(sky); T.sky=sky;
 scene.fog=new THREE.Fog(def.fog,def.fogD[0],def.fogD[1]);
 scene.add(new THREE.HemisphereLight(def.hemi[0],def.hemi[1],def.hemiI||1.1));
 const sun=new THREE.DirectionalLight(def.sunC,def.sunI||2.2); const sv=new THREE.Vector3(...def.sun).normalize(); T.sunDir=sv; sun.castShadow=true;
 sun.shadow.mapSize.set(1024,1024); const sc=sun.shadow.camera; sc.left=-45;sc.right=45;sc.top=45;sc.bottom=-45;sc.near=1;sc.far=300; sun.shadow.bias=-0.0008; sun.shadow.normalBias=0.03;
 scene.add(sun); scene.add(sun.target); T.sun=sun;
 // road ribbons
 const ribbon=(o0,o1,y0,y1,tex,uScale,mat)=>{ const pos=[],uv=[],idx=[]; let v=0;
   for(let i=0;i<=N;i++){ const j=i%N,p=P[j],s=SD[j],b=BK[j]; if(i>0)v+=P[j].distanceTo(P[(i-1)%N])/uScale;
     for(const [o,y,u] of [[o0,y0,0],[o1,y1,1]]){ pos.push(p.x+s.x*o, p.y+o*Math.sin(b)+y, p.z+s.z*o); uv.push(u,v);} 
     if(i<N){const k=i*2; idx.push(k,k+1,k+2,k+1,k+3,k+2);} }
   const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3)); g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2)); g.setIndex(idx); g.computeVertexNormals();
   const m=new THREE.Mesh(g,mat||new THREE.MeshStandardMaterial({map:tex,roughness:0.85,side:THREE.DoubleSide})); m.receiveShadow=true; scene.add(m); return m; };
 const road=ribbon(-HW,HW,0.02,0.02,roadTex,W); if(def.night){road.material.roughness=0.35;road.material.metalness=0.35;}
 ribbon(-HW-1.4,-HW,0.06,0.06,curbTex,2); ribbon(HW,HW+1.4,0.06,0.06,curbTex,2);
 ribbon(-HW-1.4,-HW-1.4,0,1.3,wallTex,4); ribbon(HW+1.4,HW+1.4,0,1.3,wallTex,4);
 if(city){ ribbon(-HW-6,-HW-1.4,0.25,0.25,walkTex,4); ribbon(HW+1.4,HW+6,0.25,0.25,walkTex,4); }
 // road underside/embankment
 if(!city){ const emb=new THREE.MeshStandardMaterial({color:def.snow?'#c9d3dc':'#8a7a5a',roughness:1});
 ribbon(-HW-6,-HW-1.4,-4,0,null,1,emb); ribbon(HW+1.4,HW+6,0,-4,null,1,emb); }
 // ground
 const gm=new THREE.MeshStandardMaterial({color:def.ground,roughness:1});
 let cx=0,cz=0; P.forEach(p=>{cx+=p.x;cz+=p.z;}); cx/=N;cz/=N; let rad=0; P.forEach(p=>rad=Math.max(rad,Math.hypot(p.x-cx,p.z-cz))); T.c=[cx,cz,rad];
 const ground=new THREE.Mesh(new THREE.CircleGeometry(rad+(def.water?90:900),64),gm); ground.rotation.x=-Math.PI/2; ground.position.set(cx,city?-0.02:-3.5,cz); ground.receiveShadow=true; scene.add(ground);
 if(def.water){ const wm=new THREE.MeshStandardMaterial({color:'#2a5d9a',roughness:0.15,metalness:0.6,emissive:'#3a2040',emissiveIntensity:0.3});
   const water=new THREE.Mesh(new THREE.PlaneGeometry(5000,5000,1,1),wm); water.rotation.x=-Math.PI/2; water.position.set(cx,-3.8,cz); scene.add(water);
   // shore glints
   const gl=new THREE.Points(new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(Array.from({length:3000},(_,i)=>{const a=rand()*TAU,r=rad+100+rand()*900;return i%3===1?-3.7:(i%3===0?cx+Math.cos(a)*r:cz+Math.sin(a)*r);}),3)),new THREE.PointsMaterial({color:'#ffe0a0',size:1.4,transparent:true,opacity:0.8}));
   scene.add(gl); T.glint=gl; }
 const nearTrack=(x,z)=>{ let m=1e9; for(let i=0;i<N;i+=3){const d=(P[i].x-x)**2+(P[i].z-z)**2; if(d<m)m=d;} return Math.sqrt(m); };
 const scat=(count,minD,maxD,fn)=>{ let n=0,tries=0; while(n<count&&tries<count*30){ tries++; const i=rand()*N|0, side=rand()<0.5?-1:1, d=minD+rand()*(maxD-minD);
   const x=P[i].x+SD[i].x*side*d, z=P[i].z+SD[i].z*side*d; if(nearTrack(x,z)<minD-1)continue; if(Math.hypot(x-cx,z-cz)>rad+(def.water?80:600))continue; fn(x,z,P[i].y,i,side); n++; } };
 const inst=(geo,mat,list,shadow)=>{ const m=new THREE.InstancedMesh(geo,mat,list.length); list.forEach((mx,i)=>m.setMatrixAt(i,mx)); m.castShadow=!!shadow; m.receiveShadow=true; scene.add(m); return m; };
 const M=(x,y,z,sx,sy,sz,ry=0)=>new THREE.Matrix4().compose(new THREE.Vector3(x,y,z),new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),ry),new THREE.Vector3(sx,sy,sz));
 const trunks=[],crowns=[],crowns2=[],bld=[],roofs=[],poles=[],lamps=[],mtn=[],caps=[];
 const gy=city?0:-3.5;
 if(city) cityScenery(def,M,inst,nearTrack,trunks,crowns,mtn,caps,cx,cz,rad);
 else if(!def.snow){
   scat(150,14,70,(x,z)=>{ const h=6+rand()*5; trunks.push(M(x,gy+h/2,z,0.35,h,0.35,rand()*3)); for(let k=0;k<5;k++)crowns.push(M(x,gy+h,z,1,1,1,k/5*TAU+rand())); });
   scat(70,40,160,(x,z)=>{ const w=10+rand()*12,h=15+rand()*55; bld.push(M(x,gy+h/2,z,w,h,w*(0.7+rand()*0.6),rand()*3)); });
 } else {
   scat(420,13,140,(x,z)=>{ const s=0.8+rand()*1.0; trunks.push(M(x,gy+1.5*s,z,0.5*s,3*s,0.5*s)); crowns.push(M(x,gy+6*s,z,s,s,s,rand()*3)); crowns2.push(M(x,gy+9*s,z,s*0.7,s*0.8,s*0.7,rand()*3)); });
   scat(25,30,90,(x,z)=>{ const w=8+rand()*4,h=6+rand()*3; bld.push(M(x,gy+h/2,z,w,h,w,rand()*3)); roofs.push(M(x,gy+h+2,z,w*0.78,4,w*0.78,0)); });
 }
 for(let i=0;i<N;i+=14){ for(const sd of [-1,1]){ const o=(HW+2.2)*sd, p=P[i],s=SD[i]; const x=p.x+s.x*o,z=p.z+s.z*o,y=p.y+o*Math.sin(BK[i]); poles.push(M(x,y+4,z,0.15,8,0.15)); lamps.push(M(x-s.x*sd*1.2,y+8,z-s.z*sd*1.2,0.5,0.25,0.5)); } }
 for(let i=0;i<46;i++){ const a=i/46*TAU+rand()*0.1, r=rad+(city?520:def.water?650:420)+rand()*250, h=80+rand()*160, w=h*(1+rand()); mtn.push(M(cx+Math.cos(a)*r,gy-5+h/2,cz+Math.sin(a)*r,w,h,w,rand()*3)); if(!city)caps.push(M(cx+Math.cos(a)*r,gy-5+h*0.85,cz+Math.sin(a)*r,w*0.32,h*0.3,w*0.32,0)); }
 const trunkMat=new THREE.MeshStandardMaterial({color:'#6b4a2b',roughness:1});
 if(trunks.length) inst(new THREE.CylinderGeometry(0.7,1,1,6),trunkMat,trunks,true);
 if(city){ if(crowns.length)inst(new THREE.IcosahedronGeometry(2.6,0),new THREE.MeshStandardMaterial({color:'#3f9a4a',flatShading:true,roughness:0.9}),crowns,true); }
 else if(!def.snow){ const leaf=new THREE.ConeGeometry(0.6,5,4); leaf.translate(0,2.5,0); leaf.rotateZ(1.25); inst(leaf,new THREE.MeshStandardMaterial({color:'#2f8f4a',roughness:0.8,flatShading:true}),crowns,true);
   const bmat=new THREE.MeshStandardMaterial({map:winTex,emissive:'#ffffff',emissiveMap:winTex,emissiveIntensity:0.55,roughness:0.6}); const bg=new THREE.BoxGeometry(1,1,1); inst(bg,bmat,bld,quality==='high');
 } else { const pg=new THREE.ConeGeometry(3.2,7,7); const pm=new THREE.MeshStandardMaterial({color:'#2d5a3d',roughness:0.9,flatShading:true}); inst(pg,pm,crowns,true);
   const sg=new THREE.ConeGeometry(2.6,5,7); inst(sg,new THREE.MeshStandardMaterial({color:'#e9f2f8',roughness:0.9,flatShading:true}),crowns2,true);
   inst(new THREE.BoxGeometry(1,1,1),new THREE.MeshStandardMaterial({color:'#8a5a3a',map:winTex,emissive:'#ffcc88',emissiveMap:winTex,emissiveIntensity:0.4}),bld,true);
   inst(new THREE.ConeGeometry(0.75,1,4,1).rotateY(Math.PI/4),new THREE.MeshStandardMaterial({color:'#f4f8fb',flatShading:true}),roofs,true); }
 inst(new THREE.CylinderGeometry(1,1,1,6),new THREE.MeshStandardMaterial({color:'#555a66',metalness:0.6,roughness:0.4}),poles);
 inst(new THREE.BoxGeometry(1,1,1),new THREE.MeshBasicMaterial({color:'#fff3c0'}),lamps);
 inst(new THREE.ConeGeometry(0.5,1,7),new THREE.MeshStandardMaterial({color:def.snow?'#7c8ea8':def.night?'#1a1530':city?'#7d9a8a':'#6a5a7c',flatShading:true,roughness:1}),mtn);
 inst(new THREE.ConeGeometry(0.5,1,7),new THREE.MeshStandardMaterial({color:'#ffffff',flatShading:true}),caps);
 if(def.snow){ const n=1500, a=new Float32Array(n*3); for(let i=0;i<n;i++){a[i*3]=(Math.random()-0.5)*120;a[i*3+1]=Math.random()*50;a[i*3+2]=(Math.random()-0.5)*120;}
   const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.BufferAttribute(a,3)); T.snow=new THREE.Points(g,new THREE.PointsMaterial({color:'#fff',size:0.35,transparent:true,opacity:0.9,depthWrite:false})); scene.add(T.snow); }
 // start gate
 const g0=new THREE.Group(); const sp=P[0],ss=SD[0];
 const cl=new THREE.Mesh(new THREE.PlaneGeometry(W,2.5),new THREE.MeshStandardMaterial({map:checkTex})); cl.rotation.x=-Math.PI/2; cl.position.y=0.05; g0.add(cl);
 const pm=new THREE.MeshStandardMaterial({color:'#ff3a6a',metalness:0.4,roughness:0.4});
 for(const sd of [-1,1]){ const pl=new THREE.Mesh(new THREE.BoxGeometry(1,9,1),pm); pl.position.set(sd*(HW+1.5),4.5,0); pl.castShadow=true; g0.add(pl);} 
 const ban=new THREE.Mesh(new THREE.BoxGeometry(W+4,2.2,0.6),new THREE.MeshStandardMaterial({map:canvasTex(512,64,(g,w,h)=>{g.fillStyle='#1d1f4a';g.fillRect(0,0,w,h);g.fillStyle='#ffde3b';g.font='bold 44px sans-serif';g.textAlign='center';g.fillText('START  ★  QQ飞车  ★  FINISH',w/2,48);}),emissive:'#fff',emissiveIntensity:0.15}));
 ban.material.emissiveMap=ban.material.map; ban.position.y=9; g0.add(ban);
 g0.position.copy(sp); g0.rotation.y=Math.atan2(-TG[0].x,-TG[0].z); scene.add(g0);
 // boost pads & item boxes
 T.pads=[]; T.boxes=[];
 const padMat=new THREE.MeshBasicMaterial({map:padTex,transparent:true,opacity:0.9});
 for(let k=1;k<6;k++){ const i=Math.floor(N*k/6+N*0.05)%N; for(const lat of [k%2?-3.5:3.5]){ const m=new THREE.Mesh(new THREE.PlaneGeometry(4,6),padMat); placeOnTrack(m,i,lat,0.07); m.rotateX(-Math.PI/2); scene.add(m); T.pads.push({i,lat}); } }
 const boxGeo=new THREE.BoxGeometry(1.6,1.6,1.6), boxMat=new THREE.MeshStandardMaterial({map:boxTex,transparent:true,opacity:0.88,emissive:'#ff88ee',emissiveIntensity:0.3});
 for(let k=0;k<4;k++){ const i=Math.floor(N*(k+0.5)/4)%N; for(let l=-1.5;l<=1.5;l++){ const m=new THREE.Mesh(boxGeo,boxMat); placeOnTrack(m,i,l*3.6,1.4); scene.add(m); T.boxes.push({m,i,lat:l*3.6,t:0}); } }
}
function cityScenery(def,M,inst,nearTrack,trunks,crowns,mtn,caps,cx,cz,rad){
 const bld=[],cols=[],neon=[],neonC=[],chev=[],zeb=[];
 for(let i=0;i<N;i+=5){ const t=TG[i]; const ry=Math.atan2(-t.x,-t.z);
   for(const sd of [-1,1]){ const w=12+rand()*10, dp=12+rand()*12, h=def.bh[0]+rand()*(def.bh[1]-def.bh[0])*(rand()<0.25?1:0.5);
     const o=HW+7+dp/2; const x=P[i].x+SD[i].x*sd*o, z=P[i].z+SD[i].z*sd*o;
     if(nearTrack(x,z)<HW+6+Math.min(w,dp)/2)continue;
     if(def.park&&rand()<0.35){ for(let k=0;k<3;k++)crowns.push(M(x+(rand()-0.5)*10,3.5+rand(),z+(rand()-0.5)*10,1+rand()*0.5,1.2,1+rand()*0.5,rand()*3)), trunks.push(M(x,1.5,z,0.4,3,0.4)); continue; }
     bld.push(M(x,h/2,z,w,h,dp,ry));
     const c=new THREE.Color().setHSL(def.night?0.65+rand()*0.15:[0.07,0.1,0.55,0.95,0.13][rand()*5|0],def.night?0.4:0.5,def.night?0.45:0.8); cols.push(c);
     if(def.night&&rand()<0.7){ const ho=6+rand()*Math.min(20,h-8); const fx=x-SD[i].x*sd*(dp/2+0.3), fz=z-SD[i].z*sd*(dp/2+0.3);
       neon.push(M(fx,ho,fz,w*0.6,1.2+rand()*2,0.3,ry)); neonC.push(new THREE.Color().setHSL([0.92,0.5,0.83,0.13,0.3][rand()*5|0],1,0.55)); } } }
 const bm=def.night?new THREE.MeshStandardMaterial({map:winTex,emissive:'#ffffff',emissiveMap:winTex,emissiveIntensity:0.75,roughness:0.7}):new THREE.MeshStandardMaterial({map:dayTex,roughness:0.85});
 const bi=inst(new THREE.BoxGeometry(1,1,1),bm,bld,true); cols.forEach((c,i)=>bi.setColorAt(i,c));
 if(neon.length){ const nm=inst(new THREE.BoxGeometry(1,1,1),new THREE.MeshBasicMaterial({color:'#fff'}),neon); neonC.forEach((c,i)=>nm.setColorAt(i,c)); }
 // chevrons on outside of corners, zebra crossings on straights
 for(let i=0;i<N;i+=3){ const c=curv[i]; if(Math.abs(c)>0.55){ const so=c<0?1:-1; const m=new THREE.Mesh(new THREE.PlaneGeometry(5,1.3),new THREE.MeshBasicMaterial({map:chevTex,side:THREE.DoubleSide}));
   placeOnTrack(m,(i+2)%N,so*(HW+1.0),1.0); if(c<0)m.scale.x=-1; scene.add(m); }
   if(i%60===30&&Math.abs(c)<0.02&&Math.abs(curv[(i+12)%N])<0.02&&Math.abs(curv[(i-12+N)%N])<0.02){ const m=new THREE.Mesh(new THREE.PlaneGeometry(W-2,4),new THREE.MeshBasicMaterial({map:zebraTex,transparent:true,polygonOffset:true,polygonOffsetFactor:-1})); placeOnTrack(m,i,0,0.04); m.rotateX(-Math.PI/2); scene.add(m); } }
}
function trackPos(i,lat,out){ i=((i%N)+N)%N; const a=Math.floor(i),b=(a+1)%N,f=i-a; const p=P[a],q=P[b],s=SD[a];
 out.set(lerp(p.x,q.x,f)+s.x*lat, lerp(p.y,q.y,f)+lat*Math.sin(BK[a]), lerp(p.z,q.z,f)+s.z*lat); return out; }
function placeOnTrack(m,i,lat,h){ trackPos(i,lat,m.position); m.position.y+=h; m.rotation.set(0,Math.atan2(-TG[i].x,-TG[i].z),0); m.rotateZ(-BK[i]); }
// ================= KART MODEL =================
function makeKart(color,acc){
 const g=new THREE.Group(), body=new THREE.Group(); g.add(body);
 const paint=new THREE.MeshStandardMaterial({color,metalness:0.55,roughness:0.28}), dark=new THREE.MeshStandardMaterial({color:'#1a1c22',roughness:0.6,metalness:0.3}),
  chrome=new THREE.MeshStandardMaterial({color:'#dfe4ea',metalness:1,roughness:0.15}), accent=new THREE.MeshStandardMaterial({color:acc,metalness:0.4,roughness:0.35});
 const add=(geo,mat,x,y,z,rx=0,ry=0,rz=0,par=body)=>{const m=new THREE.Mesh(geo,mat); m.position.set(x,y,z); m.rotation.set(rx,ry,rz); m.castShadow=true; par.add(m); return m;};
 // chassis: extruded side profile
 const sh=new THREE.Shape(); sh.moveTo(-1.9,0.15); sh.lineTo(1.6,0.15); sh.quadraticCurveTo(2.1,0.2,2.15,0.45); sh.lineTo(1.2,0.75); sh.lineTo(-0.3,0.8); sh.lineTo(-1.4,1.0); sh.lineTo(-1.95,0.9); sh.lineTo(-1.9,0.15);
 const cg=new THREE.ExtrudeGeometry(sh,{depth:1.3,bevelEnabled:true,bevelThickness:0.12,bevelSize:0.1,bevelSegments:3}); cg.translate(0,0,-0.65); cg.rotateY(Math.PI/2);
 add(cg,paint,0,0.15,0);
 add(new THREE.BoxGeometry(2.3,0.18,3.6),dark,0,0.25,-0.1);
 // side pods
 for(const s of [-1,1]){ add(new THREE.CapsuleGeometry(0.28,1.6,4,10),accent,s*1.0,0.5,0.1,Math.PI/2); add(new THREE.BoxGeometry(0.06,0.3,1.2),chrome,s*1.3,0.5,0.1); }
 // nose bumper
 add(new THREE.CapsuleGeometry(0.16,1.8,4,8),accent,0,0.35,-2.2,0,0,Math.PI/2);
 // windscreen
 add(new THREE.BoxGeometry(1.0,0.4,0.05),new THREE.MeshStandardMaterial({color:'#9fdcff',transparent:true,opacity:0.5,metalness:0.9,roughness:0.05}),0,1.15,-0.6,-0.5);
 // seat + driver
 add(new THREE.BoxGeometry(0.9,0.9,0.25),dark,0,1.3,0.75,0.2);
 const suit=new THREE.MeshStandardMaterial({color:acc,roughness:0.6});
 add(new THREE.CapsuleGeometry(0.33,0.45,4,10),suit,0,1.45,0.35);
 for(const s of [-1,1]){ add(new THREE.CapsuleGeometry(0.1,0.5,4,6),suit,s*0.35,1.35,-0.05,1.1,0,s*0.3); add(new THREE.SphereGeometry(0.11,8,6),dark,s*0.22,1.25,-0.5);} 
 const helm=add(new THREE.SphereGeometry(0.36,20,14),paint,0,2.05,0.3);
 add(new THREE.SphereGeometry(0.3,16,10,Math.PI*1.2,Math.PI*0.6,Math.PI*0.3,Math.PI*0.35),new THREE.MeshStandardMaterial({color:'#111',metalness:1,roughness:0.05}),0,2.05,0.33,0,Math.PI,0);
 add(new THREE.BoxGeometry(0.06,0.06,0.7),new THREE.MeshStandardMaterial({color:'#fff'}),0,2.42,0.3);
 // steering wheel
 const sw=add(new THREE.TorusGeometry(0.22,0.04,6,16),dark,0,1.35,-0.55,-0.9);
 // spoiler
 add(new THREE.BoxGeometry(2.3,0.08,0.6),accent,0,1.75,1.85,-0.15);
 for(const s of [-1,1]){ add(new THREE.BoxGeometry(0.08,0.75,0.4),dark,s*0.6,1.35,1.8); add(new THREE.BoxGeometry(0.06,0.4,0.7),paint,s*1.15,1.82,1.85);} 
 // exhaust
 const flames=[]; const fm=new THREE.MeshBasicMaterial({color:'#5ad0ff',transparent:true,opacity:0.85,blending:THREE.AdditiveBlending,depthWrite:false});
 for(const s of [-0.35,0.35]){ add(new THREE.CylinderGeometry(0.13,0.16,0.6,10,1,true),chrome,s,0.75,2.0,Math.PI/2);
   const fg=new THREE.ConeGeometry(0.15,1,10,1,true); fg.translate(0,-0.5,0); const f=add(fg,fm,s,0.75,2.3,-Math.PI/2); f.castShadow=false; flames.push(f); }
 // wheels
 const wheels=[], steer=[]; const tg=new THREE.CylinderGeometry(0.48,0.48,0.45,20); tg.rotateZ(Math.PI/2); const rg=new THREE.CylinderGeometry(0.3,0.3,0.47,6); rg.rotateZ(Math.PI/2);
 const tire=new THREE.MeshStandardMaterial({color:'#15161a',roughness:0.9});
 for(const [x,z,f] of [[-1.15,-1.35,1],[1.15,-1.35,1],[-1.2,1.35,0],[1.2,1.35,0]]){ const piv=new THREE.Group(); piv.position.set(x,0.48,z); g.add(piv);
   const w=new THREE.Group(); piv.add(w); const t=new THREE.Mesh(tg,tire); t.castShadow=true; w.add(t); const r=new THREE.Mesh(rg,chrome); w.add(r);
   const sp=new THREE.Mesh(new THREE.BoxGeometry(0.48,0.08,0.5),accent); w.add(sp);
   if(!f){ piv.scale.set(1.15,1.1,1.1);} wheels.push(w); if(f)steer.push(piv); }
 // shield bubble
 const shield=new THREE.Mesh(new THREE.SphereGeometry(2.6,20,14),new THREE.MeshBasicMaterial({color:'#7ff',transparent:true,opacity:0.25,blending:THREE.AdditiveBlending,depthWrite:false})); shield.position.y=1; shield.visible=false; g.add(shield);
 g.userData={body,wheels,steer,flames,fm,shield,sw}; return g;
}
// ================= FX =================
const dotTex=canvasTex(64,64,(g,w,h)=>{const r=g.createRadialGradient(32,32,0,32,32,32);r.addColorStop(0,'rgba(255,255,255,1)');r.addColorStop(0.4,'rgba(255,255,255,0.6)');r.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=r;g.fillRect(0,0,w,h);});
class Particles{ constructor(n,size,blend=true){ this.n=n; this.p=new Float32Array(n*3); this.c=new Float32Array(n*3); this.v=new Float32Array(n*3); this.l=new Float32Array(n); this.k=0;
  const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.BufferAttribute(this.p,3)); g.setAttribute('color',new THREE.BufferAttribute(this.c,3));
  this.pts=new THREE.Points(g,new THREE.PointsMaterial({size,map:dotTex,alphaTest:0.01,vertexColors:true,transparent:true,depthWrite:false,blending:blend?THREE.AdditiveBlending:THREE.NormalBlending})); this.pts.frustumCulled=false; scene.add(this.pts); for(let i=0;i<n;i++)this.p[i*3+1]=-999; }
 emit(x,y,z,vx,vy,vz,r,g,b,life){ const i=this.k; this.k=(this.k+1)%this.n; this.p.set([x,y,z],i*3); this.v.set([vx,vy,vz],i*3); this.c.set([r,g,b],i*3); this.l[i]=life; }
 update(dt,grav){ for(let i=0;i<this.n;i++){ if(this.l[i]<=0)continue; this.l[i]-=dt; const j=i*3; if(this.l[i]<=0){this.p[j+1]=-999;continue;} this.v[j+1]-=grav*dt; this.p[j]+=this.v[j]*dt; this.p[j+1]+=this.v[j+1]*dt; this.p[j+2]+=this.v[j+2]*dt; this.c[j]*=0.96; this.c[j+1]*=0.96; this.c[j+2]*=0.96; }
  this.pts.geometry.attributes.position.needsUpdate=true; this.pts.geometry.attributes.color.needsUpdate=true; } }
class Skids{ constructor(n){ this.n=n; this.k=0; this.pos=new Float32Array(n*12); const idx=[]; for(let i=0;i<n;i++){const b=i*4; idx.push(b,b+1,b+2,b+1,b+3,b+2);} 
  const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.BufferAttribute(this.pos,3)); g.setIndex(idx);
  this.m=new THREE.Mesh(g,new THREE.MeshBasicMaterial({color:'#111',transparent:true,opacity:0.45,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2})); this.m.frustumCulled=false; scene.add(this.m); }
 add(a,b,side){ const i=this.k; this.k=(this.k+1)%this.n; const w=0.22; const o=i*12; const sx=side.x*w,sz=side.z*w;
  this.pos.set([a.x-sx,a.y+0.05,a.z-sz, a.x+sx,a.y+0.05,a.z+sz, b.x-sx,b.y+0.05,b.z-sz, b.x+sx,b.y+0.05,b.z+sz],o); this.m.geometry.attributes.position.needsUpdate=true; } }
// ================= GAME STATE =================
const COLORS=[['#ff2d55','#ffd23c'],['#1e90ff','#ffffff'],['#29d17a','#1d1f4a'],['#ffb300','#e8263a'],['#b04dff','#5ef0ff'],['#f5f5f5','#ff2d55']];
const NAMES=['你','小橘子','闪电','雪豹','夜鹰','流星'];
let G={state:'menu',track:+(localStorage.qqs_track||0),color:+(localStorage.qqs_color||0)};
let karts=[],player,sparks,smoke,skids,missiles=[],bananas=[],clock=new THREE.Clock();
const ITEMS={missile:'🚀',banana:'🍌',shield:'🛡️'};
function newRace(){
 buildTrack(TRACKS[G.track]);
 sparks=new Particles(500,0.35); smoke=new Particles(300,1.1,false); smoke.pts.material.opacity=0.5; skids=new Skids(700); missiles=[]; bananas=[];
 karts=[]; const nAI=quality==='low'?3:5;
 for(let k=0;k<=nAI;k++){ const c=k===0?COLORS[G.color]:COLORS[(G.color+k)%COLORS.length]; const m=makeKart(c[0],c[1]); scene.add(m);
   const row=Math.floor(k/2), lat=(k%2?3.2:-3.2); const idx=(N-6-row*5)%N; const p=trackPos(idx,lat,new THREE.Vector3());
   const yaw=Math.atan2(-TG[idx].x,-TG[idx].z);
   karts.push({m,ai:k>0,name:NAMES[k],pos:p,yaw,vyaw:yaw,speed:0,steer:0,idx,lat,lap:-1,half:true,prog:0,drift:false,driftDir:0,driftT:0,
    nitro:0,nitroN:0,boost:0,jet:0,item:null,shield:0,spin:0,finished:false,time:0,lapStart:0,laps:[],
    skill:0.9+k*0.012+Math.random()*0.03, aiLat:lat, aiT:Math.random()*10, aiItemT:2+Math.random()*5, lastW:[null,null], wspin:0});
 }
 player=karts[0]; G.raceT=-4; G.state='count'; G.count=4; G.finishOrder=[]; G.resultT=0;
 G.best=+(localStorage['qqs_best_'+G.track]||0); buildMinimap(); applyQuality(); hud(true);
 $('menu').style.display='none'; $('hud').style.display='block'; $('results').style.display='none'; $('pause').style.display='none';
}
// ================= INPUT =================
const K={}; const inp={left:0,right:0,drift:0,nitro:0,brake:0,item:0};
addEventListener('keydown',e=>{ K[e.code]=1; Audio.resume(); if(e.code==='KeyP'||e.code==='Escape')togglePause(); if(e.code==='Space'||e.code==='KeyN')useNitro(player); if(e.code==='KeyE'||e.code==='KeyQ')useItem(player); if(['Space','ArrowUp','ArrowDown'].includes(e.code))e.preventDefault(); });
addEventListener('keyup',e=>{K[e.code]=0;});
function bindBtn(id,key,tap){ const el=$(id); const on=e=>{e.preventDefault(); Audio.resume(); inp[key]=1; el.classList.add('on'); if(tap)tap();}; const off=e=>{e.preventDefault(); inp[key]=0; el.classList.remove('on');};
 el.addEventListener('touchstart',on,{passive:false}); el.addEventListener('touchend',off,{passive:false}); el.addEventListener('touchcancel',off,{passive:false}); el.addEventListener('mousedown',on); el.addEventListener('mouseup',off); el.addEventListener('mouseleave',off); }
bindBtn('bL','left'); bindBtn('bR','right'); bindBtn('bD','drift'); bindBtn('bB','brake'); bindBtn('bN','nitro',()=>useNitro(player)); bindBtn('bI','item',()=>useItem(player));
document.addEventListener('touchstart',()=>Audio.resume(),{passive:true}); document.addEventListener('click',()=>Audio.resume());
document.addEventListener('touchmove',e=>{ if(G.state!=='menu')e.preventDefault(); },{passive:false});
$('fsbtn').onclick=$('fsbtn2').onclick=async()=>{ Audio.resume(); const d=document.documentElement; try{ if(!document.fullscreenElement&&!document.webkitFullscreenElement){ await (d.requestFullscreen?d.requestFullscreen({navigationUI:'hide'}):d.webkitRequestFullscreen&&d.webkitRequestFullscreen()); try{await screen.orientation.lock('landscape');}catch(e){} } else { (document.exitFullscreen||document.webkitExitFullscreen).call(document);} }catch(e){} };
$('mutebtn').onclick=$('mutebtn2').onclick=()=>{ Audio.resume(); Audio.setMute(!Audio.muted); updMute(); };
function updMute(){ $('mutebtn').textContent=$('mutebtn2').textContent=Audio.muted?'🔇':'🔊'; } updMute();
$('qbtn').onclick=()=>{ quality=quality==='high'?'mid':quality==='mid'?'low':'high'; localStorage.qqs_q=quality; applyQuality(); Audio.click(); };
$('pausebtn').onclick=()=>togglePause();
function togglePause(){ if(G.state==='race'||G.state==='count'){ G.prev=G.state; G.state='paused'; $('pause').style.display='flex'; if(Audio.ctx)Audio.ctx.suspend(); } else if(G.state==='paused'){ G.state=G.prev; $('pause').style.display='none'; Audio.resume(); clock.getDelta(); } }
$('resume').onclick=togglePause; $('restart').onclick=$('again').onclick=()=>{ Audio.resume(); newRace(); }; $('tomenu').onclick=$('tomenu2').onclick=()=>{ Audio.resume(); showMenu(); };
// menu
function showMenu(){ G.state='menu'; $('menu').style.display='flex'; $('hud').style.display='none'; $('results').style.display='none'; $('pause').style.display='none';
 const tl=$('tracks'); tl.innerHTML=''; TRACKS.forEach((t,i)=>{ const d=document.createElement('div'); d.className='card'+(i===G.track?' sel':''); d.style.background=`linear-gradient(160deg,${t.sky[0]},${t.sky[1]} 60%,${t.sky[2]})`;
   const b=+(localStorage['qqs_best_'+i]||0); d.innerHTML=`<b>${t.name}</b><small>${t.sub}</small><small>最佳: ${b?fmt(b):'--'}</small>`; d.onclick=()=>{G.track=i; localStorage.qqs_track=i; Audio.click(); showMenu();}; tl.appendChild(d); });
 const cl=$('colors'); cl.innerHTML=''; COLORS.forEach((c,i)=>{ const d=document.createElement('div'); d.className='sw'+(i===G.color?' sel':''); d.style.background=`linear-gradient(135deg,${c[0]} 60%,${c[1]} 60%)`; d.onclick=()=>{G.color=i; localStorage.qqs_color=i; Audio.click(); showMenu();}; cl.appendChild(d); });
 if(!scene||!G.menuScene){ buildTrack(TRACKS[G.track]); G.menuScene=G.track; const k=makeKart(COLORS[G.color][0],COLORS[G.color][1]); scene.add(k); G.menuKart=k; placeOnTrack(k,10,0,0); }
 if(G.menuScene!==G.track){ G.menuScene=null; showMenu(); return; }
 const k=G.menuKart; const c=COLORS[G.color]; k.traverse(o=>{ if(o.material&&o.material.metalness===0.55)o.material.color.set(c[0]); });
}
$('startbtn').onclick=()=>{ Audio.resume(); Audio.click(); G.menuScene=null; newRace(); };
// ================= MINIMAP =================
let mm=$('minimap'),mmx=mm.getContext('2d'),mmBg,mmT;
function buildMinimap(){ let x0=1e9,x1=-1e9,z0=1e9,z1=-1e9; P.forEach(p=>{x0=Math.min(x0,p.x);x1=Math.max(x1,p.x);z0=Math.min(z0,p.z);z1=Math.max(z1,p.z);});
 const S=mm.width, sc=(S-24)/Math.max(x1-x0,z1-z0), ox=(S-(x1-x0)*sc)/2, oz=(S-(z1-z0)*sc)/2; mmT=(x,z)=>[ox+(x-x0)*sc, oz+(z-z0)*sc];
 const c=document.createElement('canvas'); c.width=c.height=S; const g=c.getContext('2d'); g.lineJoin='round';
 for(const [w,col] of [[10,'rgba(0,0,0,0.5)'],[6,'#fff']]){ g.strokeStyle=col; g.lineWidth=w; g.beginPath(); P.forEach((p,i)=>{const [a,b]=mmT(p.x,p.z); i?g.lineTo(a,b):g.moveTo(a,b);}); g.closePath(); g.stroke(); }
 const [a,b]=mmT(P[0].x,P[0].z); g.fillStyle='#ffde3b'; g.fillRect(a-4,b-4,8,8); mmBg=c; }
function drawMinimap(){ mmx.clearRect(0,0,mm.width,mm.height); mmx.drawImage(mmBg,0,0);
 for(let i=karts.length-1;i>=0;i--){ const k=karts[i]; const [a,b]=mmT(k.pos.x,k.pos.z); mmx.fillStyle=k.ai?COLORS[(G.color+i)%COLORS.length][0]:'#fff'; mmx.strokeStyle='#000'; mmx.lineWidth=2; mmx.beginPath(); mmx.arc(a,b,k.ai?5:8,0,TAU); mmx.fill(); mmx.stroke(); if(!k.ai){mmx.fillStyle=COLORS[G.color][0]; mmx.beginPath(); mmx.arc(a,b,4,0,TAU); mmx.fill();} } }
// ================= PHYSICS =================
const MAXS=48, BOOSTS=68, tmpV=new THREE.Vector3(), tmpV2=new THREE.Vector3();
function nearest(k){ let best=1e9,bi=k.idx|0; for(let d=-25;d<=25;d++){ const i=((k.idx|0)+d+N)%N; const p=P[i]; const dd=(p.x-k.pos.x)**2+(p.z-k.pos.z)**2; if(dd<best){best=dd;bi=i;} }
 const p=P[bi],t=TG[bi]; const along=(k.pos.x-p.x)*t.x+(k.pos.z-p.z)*t.z; let fi=bi+along/(T.len/N); const old=k.idx; k.idx=(fi+N)%N; 
 k.lat=(k.pos.x-p.x)*SD[bi].x+(k.pos.z-p.z)*SD[bi].z; 
 if(old>N*0.8&&k.idx<N*0.2){ if(k.half)lapDone(k); k.half=false; } else if(old<N*0.2&&k.idx>N*0.8){ k.lap--; k.half=true; }
 if(k.idx>N*0.45&&k.idx<N*0.55)k.half=true; return bi; }
function lapDone(k){ if(G.state!=='race'){k.lap++;return;} k.lap++; if(k.lap<1)return; const lt=G.raceT-k.lapStart; k.laps.push(lt); k.lapStart=G.raceT;
 if(!k.ai&&k.lap>=1&&k.lap<=3){ if(!G.best||lt<G.best){ G.best=lt; localStorage['qqs_best_'+G.track]=lt; if(k.lap>=1)flash('新纪录! '+fmt(lt));} else flash('第'+k.lap+'圈 '+fmt(lt)); if(k.lap===2)setTimeout(()=>flash('最后一圈!'),1200); Audio.beep(true); }
 if(k.lap>=3&&!k.finished){ k.finished=true; k.time=G.raceT; G.finishOrder.push(k); if(!k.ai){ Audio.fanfare(G.finishOrder.length<=3); G.resultT=2.5; } } }
function useNitro(k){ if(G.state!=='race'||k.nitroN<=0||k.boost>0.3)return; k.nitroN--; k.boost=3.2; if(!k.ai){Audio.whoosh(); flash('氮气加速!');} }
function useItem(k){ if(G.state!=='race'||!k.item)return; const it=k.item; k.item=null;
 if(it==='shield'){ k.shield=6; if(!k.ai)Audio.charge(); }
 else if(it==='banana'){ const b=new THREE.Group(); const m=new THREE.Mesh(new THREE.TorusGeometry(0.5,0.22,8,12,Math.PI*1.2),new THREE.MeshStandardMaterial({color:'#ffe135',roughness:0.5})); m.rotation.z=Math.PI*0.9; b.add(m);
   const fw=new THREE.Vector3(-Math.sin(k.yaw),0,-Math.cos(k.yaw)); b.position.copy(k.pos).addScaledVector(fw,-3.5); b.position.y+=0.5; scene.add(b); bananas.push({m:b,t:30}); Audio.tone(400,0.15,'triangle',0.2,0,0.5); }
 else if(it==='missile'){ const sorted=[...karts].sort((a,b)=>b.prog-a.prog); const r=sorted.indexOf(k); const tgt=r>0?sorted[r-1]:null;
   const m=new THREE.Group(); const bd=new THREE.Mesh(new THREE.CylinderGeometry(0.22,0.22,1.4,10).rotateX(Math.PI/2),new THREE.MeshStandardMaterial({color:'#e33',metalness:0.5,roughness:0.3})); m.add(bd);
   const tip=new THREE.Mesh(new THREE.ConeGeometry(0.22,0.5,10).rotateX(-Math.PI/2),new THREE.MeshStandardMaterial({color:'#fff'})); tip.position.z=-0.95; m.add(tip);
   m.position.copy(k.pos); m.position.y+=1.5; scene.add(m); missiles.push({m,tgt,owner:k,t:6,yaw:k.yaw,sp:k.speed+30}); if(!k.ai||tgt===player)Audio.fire(); if(tgt===player)flash('⚠ 导弹来袭!'); }
 if(!k.ai)updItem(); }
function hit(k){ if(k.shield>0){ k.shield=0; if(!k.ai||true)Audio.tone(1500,0.2,'sine',0.2,0,0.5); return; } k.spin=1.3; k.speed*=0.3; k.drift=false; k.boost=0; if(!k.ai){Audio.explode(); flash('被击中!'); shake=0.6;} 
 for(let i=0;i<40;i++)sparks.emit(k.pos.x,k.pos.y+1,k.pos.z,(Math.random()-0.5)*14,Math.random()*10,(Math.random()-0.5)*14,1,0.5,0.1,0.8); }
let shake=0;
function updateKart(k,dt){
 const racing=G.state==='race'&&!k.finished;
 let steer=0,accel=0,brake=0,drift=0;
 if(!k.ai&&!k.finished){ steer=(inp.left||K.ArrowLeft||K.KeyA?1:0)-(inp.right||K.ArrowRight||K.KeyD?1:0); accel=1; brake=(inp.brake||K.ArrowDown||K.KeyS)?1:0; drift=(inp.drift||K.ShiftLeft||K.ShiftRight)?1:0; }
 else { // AI
  k.aiT+=dt; const look=Math.floor(k.idx+4+k.speed*0.16)%N; const ahead=trackPos(look,k.aiLat,tmpV); if(Math.random()<0.005)k.aiLat=(Math.random()-0.5)*(W-7);
  const dx=ahead.x-k.pos.x,dz=ahead.z-k.pos.z; const want=Math.atan2(-dx,-dz); let d=want-k.yaw; d=Math.atan2(Math.sin(d),Math.cos(d)); steer=clamp(d*3.2,-1,1);
  const gap=(player.prog-k.prog)/N*T.len; const rb=clamp(1+gap*0.0018,0.86,1.16); let c=0; for(let q=3;q<=27;q+=3)c=Math.max(c,Math.abs(curv[Math.floor(k.idx+q)%N]));
  const target=MAXS*k.skill*rb*(1-clamp(c*0.42,0,0.42)); accel=k.speed<target?1:0; brake=k.speed>target+6?1:0;
  // visual drift on curves
  drift=c>0.45&&k.speed>24&&Math.abs(d)>0.12?1:0; if(drift&&!k.drift)steer=Math.sign(d)||1;
  if(racing){ if(k.nitroN>0&&c<0.05&&Math.random()<0.02)useNitro(k); k.aiItemT-=dt; if(k.item&&k.aiItemT<0){ useItem(k); k.aiItemT=3+Math.random()*6; } }
  if(k.finished){accel=0.4;}
 }
 if(!racing&&G.state!=='race'){ accel=0; if(G.state==='count'&&!k.ai&&(K.ArrowUp||inp.nitro))k.rev=1; }
 if(k.spin>0){ k.spin-=dt; steer=0; accel=0; drift=0; k.m.userData.body.rotation.y+=dt*14; } else k.m.userData.body.rotation.y*=0.8;
 k.steer=lerp(k.steer,steer,clamp(dt*10,0,1));
 // drift state
 if(drift&&!k.drift&&Math.abs(k.steer)>0.3&&k.speed>15){ k.drift=true; k.driftDir=Math.sign(k.steer); k.driftT=0; if(!k.ai)shake=0.08; }
 if(k.drift&&(!drift||k.speed<10)){ k.drift=false; if(k.driftT>0.45){ k.jet=0.7; if(!k.ai)Audio.jet(); } }
 let yawRate;
 if(k.drift){ k.driftT+=dt; yawRate=k.driftDir*(1.75+1.05*k.steer*k.driftDir); k.vyaw=lerpAngle(k.vyaw,k.yaw,dt*2.6);
   const slip=Math.abs(angDiff(k.yaw,k.vyaw)); k.nitro+=dt*slip*k.speed*0.03; k.speed-=dt*slip*1.6;
   if(k.nitro>=1){ k.nitro=0; if(k.nitroN<2){k.nitroN++; if(!k.ai){Audio.charge(); flash('氮气 +1');}} }
 } else { yawRate=k.steer*2.3*clamp(k.speed/16,0,1)*(1-k.speed/160); k.vyaw=lerpAngle(k.vyaw,k.yaw,dt*9); }
 k.yaw+=yawRate*dt;
 let maxs=MAXS*(k.ai?1:1); if(k.boost>0){ k.boost-=dt; maxs=BOOSTS; } if(k.jet>0){ k.jet-=dt; maxs=Math.max(maxs,MAXS*1.18); }
 const offroad=Math.abs(k.lat)>HW+0.5;
 if(accel)k.speed+=(k.speed<maxs? (k.boost>0||k.jet>0?45:28*(1-k.speed/(maxs*1.1))+6) : -30)*dt; else k.speed-=8*dt;
 if(brake)k.speed-=40*dt; if(k.speed<-8)k.speed=-8; if(!accel&&!brake&&Math.abs(k.speed)<0.5)k.speed=0;
 if(k.boost>0||k.jet>0)k.speed+=(maxs-k.speed)*dt*2;
 const fw=tmpV2.set(-Math.sin(k.vyaw),0,-Math.cos(k.vyaw)); k.pos.addScaledVector(fw,k.speed*dt);
 const bi=nearest(k);
 // walls
 const lim=HW+0.4; if(Math.abs(k.lat)>lim){ const s=Math.sign(k.lat), over=Math.abs(k.lat)-lim; k.pos.x-=SD[bi].x*s*over; k.pos.z-=SD[bi].z*s*over; k.lat=s*lim;
   const tYaw=Math.atan2(-TG[bi].x,-TG[bi].z); const into=Math.sin(angDiff(k.vyaw,tYaw))*-s; 
   if(k.speed>8&&Math.abs(angDiff(k.yaw,tYaw))>0.15){ k.speed*=0.97-Math.min(0.3,Math.abs(into)*0.4); if(!k.ai&&k.wallCD<=0){Audio.crash(); shake=0.25; k.wallCD=0.4;} for(let i=0;i<6;i++)sparks.emit(k.pos.x+SD[bi].x*s*1.2,k.pos.y+0.5,k.pos.z+SD[bi].z*s*1.2,(Math.random()-0.5)*8,Math.random()*5,(Math.random()-0.5)*8,1,0.8,0.3,0.4);} 
   k.yaw=lerpAngle(k.yaw,tYaw,dt*4); k.vyaw=lerpAngle(k.vyaw,tYaw,dt*6); }
 k.wallCD=(k.wallCD||0)-dt;
 const a=Math.floor(k.idx); const ty=lerp(P[a].y,P[(a+1)%N].y,k.idx-a)+k.lat*Math.sin(BK[a]); k.pos.y=ty;
 k.prog=k.lap*N+k.idx;
 // pads
 for(const p of T.pads){ let d=k.idx-p.i; if(d<-N/2)d+=N; if(d>=-1.2&&d<=1.2&&Math.abs(k.lat-p.lat)<2.3&&k.padCD<=0){ k.jet=1.0; k.speed=Math.max(k.speed,MAXS*1.1); k.padCD=0.8; if(!k.ai)Audio.jet(); } }
 k.padCD=(k.padCD||0)-dt;
 for(const b of T.boxes){ if(b.t>0)continue; const dx=b.m.position.x-k.pos.x,dz=b.m.position.z-k.pos.z; if(dx*dx+dz*dz<5){ b.t=3; b.m.visible=false; if(!k.item&&racing){ const r=Math.random(); k.item=r<0.4?'missile':r<0.7?'banana':'shield'; if(!k.ai){Audio.pickup(); updItem();} } else if(!k.ai)Audio.pickup();
    for(let i=0;i<20;i++)sparks.emit(b.m.position.x,b.m.position.y,b.m.position.z,(Math.random()-0.5)*10,Math.random()*8,(Math.random()-0.5)*10,1,0.5,1,0.6); } }
 if(k.shield>0)k.shield-=dt;
 // model
 const m=k.m, ud=m.userData; m.position.copy(k.pos); m.rotation.set(0,k.yaw,0); m.rotateZ(-BK[a]*Math.cos(angDiff(k.yaw,Math.atan2(-TG[a].x,-TG[a].z))));
 ud.body.rotation.z=lerp(ud.body.rotation.z,-k.steer*0.04*k.speed/MAXS+(k.drift?k.driftDir*0.06:0),dt*6); ud.body.rotation.x=lerp(ud.body.rotation.x,(k.boost>0?-0.05:0)+(brake?0.03:0),dt*5);
 k.wspin+=k.speed*dt/0.48; ud.wheels.forEach(w=>w.rotation.x=-k.wspin); ud.steer.forEach(s=>s.rotation.y=k.steer*0.45+(k.drift?-k.driftDir*0.3:0)); ud.sw.rotation.z=k.steer*1.2;
 const bo=k.boost>0, fl=bo?1.6+Math.random()*0.8:k.jet>0?1.0+Math.random()*0.4:0.25+Math.random()*0.15*(accel);
 ud.flames.forEach(f=>{ f.scale.set(1,fl,1); }); ud.fm.color.set(bo?'#7ad7ff':k.jet>0?'#ffd040':'#ff7a30');
 ud.shield.visible=k.shield>0; if(k.shield>0)ud.shield.rotation.y+=dt*2;
 // fx
 const rear=tmpV.set(Math.sin(k.yaw)*2.3,0.8,Math.cos(k.yaw)*2.3).add(k.pos);
 if(bo||k.jet>0){ for(let i=0;i<(quality==='low'?1:3);i++)sparks.emit(rear.x+(Math.random()-0.5)*0.6,rear.y,rear.z+(Math.random()-0.5)*0.6,(Math.random()-0.5)*2,Math.random()*1.5,(Math.random()-0.5)*2,bo?0.3:1,bo?0.7:0.7,bo?1:0.2,0.35); }
 const side=SD[bi];
 for(let w=0;w<2;w++){ const sx=w?1.2:-1.2; const wp=new THREE.Vector3(Math.cos(k.yaw)*sx+Math.sin(k.yaw)*1.35,0,-Math.sin(k.yaw)*sx+Math.cos(k.yaw)*1.35).add(k.pos);
   if(k.drift&&k.speed>10){ if(k.lastW[w]&&(k.ai?k.idx%1<0.5:true))skids.add(k.lastW[w],wp,side); k.lastW[w]=wp;
     const ch=k.driftT>0.45; if(Math.random()<(k.ai?0.3:0.9)){ sparks.emit(wp.x,wp.y+0.2,wp.z,(Math.random()-0.5)*5-fw.x*4,Math.random()*4+1,(Math.random()-0.5)*5-fw.z*4,1,ch?0.85:0.55,ch?0.3:0.1,0.4); smoke.emit(wp.x,wp.y+0.3,wp.z,(Math.random()-0.5)*2,1.5,(Math.random()-0.5)*2,0.8,0.8,0.82,0.8);} }
   else k.lastW[w]=null; }
 if(offroad&&k.speed>10&&Math.random()<0.4)smoke.emit(k.pos.x,k.pos.y+0.3,k.pos.z,0,1,0,0.7,0.65,0.55,0.6);
}
const angDiff=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b)); const lerpAngle=(a,b,t)=>a-angDiff(a,b)*clamp(t,0,1);
function kartCollisions(){ for(let i=0;i<karts.length;i++)for(let j=i+1;j<karts.length;j++){ const a=karts[i],b=karts[j]; const dx=b.pos.x-a.pos.x,dz=b.pos.z-a.pos.z,d=Math.hypot(dx,dz);
  if(d<3.2&&d>0.01){ const o=(3.2-d)/2, nx=dx/d,nz=dz/d; a.pos.x-=nx*o;a.pos.z-=nz*o;b.pos.x+=nx*o;b.pos.z+=nz*o; const s=(a.speed+b.speed)/2; a.speed=lerp(a.speed,s,0.3); b.speed=lerp(b.speed,s,0.3);
   if((a===player||b===player)&&(player.bumpCD||0)<=0){Audio.crash(); shake=0.2; player.bumpCD=0.5;} } } player.bumpCD=(player.bumpCD||0)-1/60; }
function updateItems(dt){
 for(let i=missiles.length-1;i>=0;i--){ const ms=missiles[i]; ms.t-=dt; let tp;
  if(ms.tgt){ tp=ms.tgt.pos; const want=Math.atan2(-(tp.x-ms.m.position.x),-(tp.z-ms.m.position.z)); ms.yaw=lerpAngle(ms.yaw,want,dt*4); } 
  ms.sp=Math.min(ms.sp+dt*30,95); ms.m.position.x-=Math.sin(ms.yaw)*ms.sp*dt; ms.m.position.z-=Math.cos(ms.yaw)*ms.sp*dt; if(tp)ms.m.position.y=lerp(ms.m.position.y,tp.y+1.2,dt*5); ms.m.rotation.y=ms.yaw;
  sparks.emit(ms.m.position.x,ms.m.position.y,ms.m.position.z,(Math.random()-0.5),Math.random(),(Math.random()-0.5),1,0.6,0.2,0.4); smoke.emit(ms.m.position.x,ms.m.position.y,ms.m.position.z,0,0.5,0,0.6,0.6,0.6,0.7);
  let done=ms.t<0; if(ms.tgt&&ms.m.position.distanceTo(tp)<2.2){ hit(ms.tgt); done=true; if(ms.tgt!==player&&player.pos.distanceTo(tp)<60)Audio.explode(); }
  if(done){ scene.remove(ms.m); missiles.splice(i,1);} }
 for(let i=bananas.length-1;i>=0;i--){ const b=bananas[i]; b.t-=dt; b.m.rotation.y+=dt*2; let gone=b.t<0;
  for(const k of karts){ if(k.pos.distanceTo(b.m.position)<2.0){ hit(k); gone=true; break; } }
  if(gone){ scene.remove(b.m); bananas.splice(i,1);} }
 for(const b of T.boxes){ if(b.t>0){ b.t-=dt; if(b.t<=0)b.m.visible=true; } b.m.rotation.y+=dt*1.5; b.m.rotation.x+=dt*0.7; }
}
// ================= HUD =================
const fmt=t=>{ t=Math.max(0,t); const m=Math.floor(t/60),s=t%60; return m+':'+(s<10?'0':'')+s.toFixed(2); };
let flashT=0; function flash(s){ const e=$('flash'); e.textContent=s; e.classList.remove('pop'); void e.offsetWidth; e.classList.add('pop'); }
function updItem(){ $('itembox').textContent=player.item?ITEMS[player.item]:''; $('bI').classList.toggle('has',!!player.item); }
function rankOf(k){ const sorted=[...karts].sort((a,b)=>{ if(a.finished&&b.finished)return a.time-b.time; if(a.finished)return -1; if(b.finished)return 1; return b.prog-a.prog;}); return sorted.indexOf(k)+1; }
function hud(force){ const p=player; $('speed').textContent=Math.round(Math.abs(p.speed)*3.6); $('lap').textContent=Math.min(3,Math.max(1,p.lap+1))+'/3';
 const r=rankOf(p); $('rank').innerHTML=r+'<small>/'+karts.length+'</small>'; $('time').textContent=fmt(Math.max(0,G.raceT)); $('best').textContent='最佳 '+(G.best?fmt(G.best):'--');
 $('nbar').style.width=(p.nitro*100)+'%'; $('n1').classList.toggle('on',p.nitroN>=1); $('n2').classList.toggle('on',p.nitroN>=2); $('bN').classList.toggle('has',p.nitroN>0);
 $('sneedle').style.transform=`rotate(${-120+Math.min(1.2,Math.abs(p.speed)/BOOSTS)*200}deg)`; if(force)updItem(); }
function drawSpeedLines(intensity){ slx.clearRect(0,0,sl.width,sl.height); if(intensity<=0.01)return; const w=sl.width,h=sl.height,cx=w/2,cy=h*0.45; slx.strokeStyle=`rgba(255,255,255,${0.5*intensity})`; slx.lineWidth=2;
 slx.beginPath(); for(let i=0;i<40*intensity;i++){ const a=Math.random()*TAU, r0=Math.max(w,h)*(0.3+Math.random()*0.3), r1=r0+60+Math.random()*120; slx.moveTo(cx+Math.cos(a)*r0,cy+Math.sin(a)*r0); slx.lineTo(cx+Math.cos(a)*r1,cy+Math.sin(a)*r1);} slx.stroke(); }
function showResults(){ G.state='results'; $('results').style.display='flex'; $('hud').style.display='none';
 const order=[...G.finishOrder]; karts.filter(k=>!k.finished).sort((a,b)=>b.prog-a.prog).forEach(k=>order.push(k));
 const r=order.indexOf(player)+1; $('rtitle').textContent=r===1?'🏆 冠军!':r<=3?'第 '+r+' 名 · 太棒了!':'第 '+r+' 名';
 $('rtable').innerHTML=order.map((k,i)=>`<tr class="${k===player?'me':''}"><td>${i+1}</td><td>${k.name}</td><td>${k.finished?fmt(k.time):'未完成'}</td><td>${k.laps.length?fmt(Math.min(...k.laps)):'--'}</td></tr>`).join('');
 $('rbest').textContent='赛道最佳单圈: '+(G.best?fmt(G.best):'--'); }
// ================= LOOP =================
const camPos=new THREE.Vector3(), camLook=new THREE.Vector3(); let fps=60, fpsAcc=0, fpsN=0;
function frame(){ requestAnimationFrame(frame); let dt=Math.min(clock.getDelta(),1/20); 
 fpsAcc+=dt;fpsN++; if(fpsAcc>0.5){fps=fpsN/fpsAcc; fpsAcc=0;fpsN=0; $('fps').textContent=Math.round(fps)+' FPS';}
 if(G.state==='menu'){ if(G.menuKart){ const t=performance.now()/1000, k=G.menuKart; camera.position.set(k.position.x+Math.sin(t*0.3)*9,k.position.y+3.5,k.position.z+Math.cos(t*0.3)*9); camera.lookAt(k.position.x,k.position.y+1,k.position.z); k.userData.flames.forEach(f=>f.scale.y=0.3+Math.random()*0.2);
   T.sun.position.copy(k.position).addScaledVector(T.sunDir,100); T.sun.target.position.copy(k.position); T.sky.position.copy(camera.position); renderer.render(scene,camera);} return; }
 if(G.state==='paused'){ return; }
 if(G.state==='count'){ const prev=Math.ceil(G.count); G.count-=dt; const c=Math.ceil(G.count); if(c!==prev&&c<=3&&c>=1){ Audio.beep(false); $('count').textContent=c; $('count').className='pop'; }
   if(G.count<=0){ G.state='race'; G.raceT=0; karts.forEach(k=>k.lapStart=0); $('count').textContent='GO!'; $('count').className='pop go'; Audio.beep(true); if(player.rev){player.jet=1;Audio.jet();flash('起步加速!');} setTimeout(()=>$('count').className='',900);} }
 if(G.state==='race'||G.state==='results'||G.state==='count'){ if(G.state==='race')G.raceT+=dt; karts.forEach(k=>updateKart(k,dt)); kartCollisions(); updateItems(dt); sparks.update(dt,9); smoke.update(dt,-1.5); }
 if(G.state==='race'&&G.resultT>0){ G.resultT-=dt; if(G.resultT<=0)showResults(); }
 // camera
 const p=player, fw=new THREE.Vector3(-Math.sin(p.yaw),0,-Math.cos(p.yaw)); const boost=p.boost>0?1:p.jet>0?0.5:0;
 const camYaw=lerpAngle(p.yaw,p.vyaw,0.4); const back=5.6+boost*1.2, up=2.5;
 const tgt=new THREE.Vector3(p.pos.x+Math.sin(camYaw)*back,p.pos.y+up,p.pos.z+Math.cos(camYaw)*back);
 camPos.lerp(tgt,clamp(dt*(G.raceT<0.1&&G.state==='count'&&G.count>3.9?60:8),0,1)); if(camPos.lengthSq()===0)camPos.copy(tgt);
 camLook.copy(p.pos).addScaledVector(fw,6); camLook.y+=1.0; camera.position.copy(camPos);
 if(shake>0){ shake-=dt; camera.position.x+=(Math.random()-0.5)*shake*1.5; camera.position.y+=(Math.random()-0.5)*shake; }
 camera.lookAt(camLook); camera.fov=lerp(camera.fov,68+Math.min(p.speed,70)*0.12+boost*14,dt*4); camera.updateProjectionMatrix();
 T.sun.position.copy(p.pos).addScaledVector(T.sunDir,120); T.sun.target.position.copy(p.pos).addScaledVector(fw,15); T.sky.position.copy(camera.position);
 if(T.snow){ const a=T.snow.geometry.attributes.position.array; for(let i=0;i<a.length;i+=3){ a[i+1]-=dt*4; a[i]+=Math.sin(i+performance.now()/900)*dt; if(a[i+1]<p.pos.y-5)a[i+1]+=50; } T.snow.position.set(Math.round(p.pos.x/120)*0,0,0); T.snow.geometry.attributes.position.needsUpdate=true;
   for(let i=0;i<a.length;i+=3){ if(a[i]-p.pos.x>60)a[i]-=120; else if(a[i]-p.pos.x<-60)a[i]+=120; if(a[i+2]-p.pos.z>60)a[i+2]-=120; else if(a[i+2]-p.pos.z<-60)a[i+2]+=120; } }
 Audio.engine(p.speed,G.state!=='menu',p.drift&&p.speed>10,p.boost>0);
 drawSpeedLines(p.boost>0?1:p.jet>0?0.5:0); hud(); drawMinimap(); renderer.render(scene,camera);
}
// ================= BOOT =================
onResize(); applyQuality();
if(Q.get('auto')){ G.track=+(Q.get('track')||0); newRace(); G.count=0.01; } else showMenu();
frame();
if(Q.get('auto')){ player.ai=true; player.skill=1.05; }

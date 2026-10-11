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
renderer.outputColorSpace=THREE.SRGBColorSpace; renderer.toneMapping=THREE.ACESFilmicToneMapping; renderer.toneMappingExposure=1.0;
renderer.shadowMap.enabled=true; renderer.shadowMap.type=THREE.PCFSoftShadowMap;
$('game').appendChild(renderer.domElement);
const camera=new THREE.PerspectiveCamera(70,1,0.3,2500);
function applyQuality(){ renderer.setPixelRatio(1); renderer.shadowMap.enabled=quality!=='low'; onResize(); $('qbtn').textContent='画质: '+({high:'高',mid:'中',low:'低'})[quality]; }
function onResize(){ const w=innerWidth,h=innerHeight; renderer.setPixelRatio(1); renderer.setSize(w,h); camera.aspect=w/h; camera.updateProjectionMatrix(); sl.width=w; sl.height=h; }
const sl=$('speedlines'), slx=sl.getContext('2d');
addEventListener('resize',onResize);
function canvasTex(w,h,draw,rep){ const c=document.createElement('canvas'); c.width=w;c.height=h; draw(c.getContext('2d'),w,h); const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; t.anisotropy=4; if(rep){t.wrapS=t.wrapT=THREE.RepeatWrapping;} return t;}
// textures
const walkTex=canvasTex(128,128,(g,w,h)=>{g.fillStyle='#9a9aa2';g.fillRect(0,0,w,h);g.strokeStyle='#7c7c86';g.lineWidth=3;for(let i=0;i<=4;i++){g.beginPath();g.moveTo(i*32,0);g.lineTo(i*32,h);g.moveTo(0,i*32);g.lineTo(w,i*32);g.stroke();}},true);
const chevTex=canvasTex(256,64,(g,w,h)=>{g.fillStyle='#111';g.fillRect(0,0,w,h);g.fillStyle='#ffd23c';for(let i=0;i<4;i++){const x=20+i*60;g.beginPath();g.moveTo(x,6);g.lineTo(x+28,6);g.lineTo(x+52,32);g.lineTo(x+28,58);g.lineTo(x,58);g.lineTo(x+24,32);g.fill();}});
const zebraTex=canvasTex(128,32,(g,w,h)=>{for(let i=0;i<8;i++){g.fillStyle=i%2?'rgba(0,0,0,0)':'#f4f4f4';g.fillRect(i*16,0,16,h);}});
const dayTex=canvasTex(64,128,(g,w,h)=>{ g.fillStyle='#f2ece0'; g.fillRect(0,0,w,h); g.fillStyle='#d8cfbf'; for(let y=0;y<h;y+=16)g.fillRect(0,y,w,2); for(let y=5;y<h;y+=16)for(let x=5;x<w;x+=15){ g.fillStyle=Math.random()<0.15?'#ffe2a8':'#5d86ad'; g.fillRect(x,y,8,9); g.fillStyle='#fff'; g.fillRect(x,y+9,8,1);} },true);
const tunTex=canvasTex(64,256,(g,w,h)=>{ g.fillStyle='#d8d4cc'; g.fillRect(0,0,w,h); g.fillStyle='#bdb7ad'; for(let y=0;y<h;y+=32)g.fillRect(0,y,w,2); g.fillStyle='#ffcc33'; g.fillRect(0,0,10,h); g.fillStyle='#222'; for(let y=0;y<h;y+=32)g.fillRect(0,y,10,14); },true);
const tunLbl=canvasTex(512,80,(g,w,h)=>{g.fillStyle='#1d1f4a';g.fillRect(0,0,w,h);g.fillStyle='#fff';g.font='bold 54px sans-serif';g.textAlign='center';g.fillText('极速隧道 · SPEED TUNNEL',w/2,60);});
const roadTex=canvasTex(256,256,(g,w,h)=>{ g.fillStyle='#3a3d44'; g.fillRect(0,0,w,h); for(let i=0;i<4000;i++){const v=40+Math.random()*50|0; g.fillStyle=`rgb(${v},${v},${v+6})`; g.fillRect(Math.random()*w,Math.random()*h,2,2);}
  g.fillStyle='#fff'; g.fillRect(6,0,6,h); g.fillRect(w-12,0,6,h); g.fillStyle='#ffd23c'; g.fillRect(w/2-4,0,8,h*0.55); },true);
const curbTex=canvasTex(64,64,(g,w,h)=>{ g.fillStyle='#e8263a'; g.fillRect(0,0,w,h/2); g.fillStyle='#fff'; g.fillRect(0,h/2,w,h/2); },true);
const wallTex=canvasTex(64,512,(g,w,h)=>{ const cols=[['#ff3a7a','QQ飞车'],['#2a7bff','NITRO'],['#ffcc00','极速'],['#22c27a','SPEED'],['#7a3cff','漂移'],['#ff7a1a','KART']];
  cols.forEach(([c,t],i)=>{ const y=i*h/6; g.fillStyle=c; g.fillRect(0,y,w,h/6); g.fillStyle='#fff'; g.fillRect(0,y,w,3); g.save(); g.translate(14,y+h/12); g.rotate(Math.PI/2); g.textAlign='center'; g.font='bold 30px sans-serif'; g.fillStyle='#fff'; g.fillText(t,0,-2); g.restore(); });
  g.fillStyle='#ffffff'; g.fillRect(w-8,0,8,h); g.fillStyle='#1d1f4a'; g.fillRect(0,0,6,h); },true);
const checkTex=canvasTex(128,32,(g,w,h)=>{ for(let x=0;x<16;x++)for(let y=0;y<4;y++){g.fillStyle=(x+y)%2?'#111':'#fff'; g.fillRect(x*8,y*8,8,8);} });
const padTex=canvasTex(128,128,(g,w,h)=>{ g.fillStyle='#08f'; g.fillRect(0,0,w,h); g.strokeStyle='#9ff'; g.lineWidth=14; for(let i=0;i<3;i++){g.beginPath(); g.moveTo(20,100-i*36+20); g.lineTo(64,60-i*36+20); g.lineTo(108,100-i*36+20); g.stroke();} });
const boxTex=canvasTex(128,128,(g,w,h)=>{ const gr=g.createLinearGradient(0,0,w,h); gr.addColorStop(0,'#ff6ad5'); gr.addColorStop(0.5,'#c774e8'); gr.addColorStop(1,'#94d0ff'); g.fillStyle=gr; g.fillRect(0,0,w,h); g.strokeStyle='#fff'; g.lineWidth=8; g.strokeRect(4,4,w-8,h-8); g.fillStyle='#fff'; g.font='bold 90px sans-serif'; g.textAlign='center'; g.fillText('?',64,98); });
const winTex=canvasTex(64,128,(g,w,h)=>{ g.fillStyle='#223'; g.fillRect(0,0,w,h); for(let y=4;y<h;y+=12)for(let x=4;x<w;x+=12){ const on=Math.random()<0.55; g.fillStyle=on?(Math.random()<0.5?'#ffd98a':'#fff2c4'):'#2a3550'; g.fillRect(x,y,7,8);} },true);
// ================= TRACKS =================
const TRACKS=QQ.TRACKS;
const W=17, HW=W/2;
let scene, T, N, P=[], TG=[], SD=[], BK=[], curv=[];
function buildTrack(def){
 scene=new THREE.Scene(); rng=7;
 const city=def.type==='city'; P=[];TG=[];SD=[];BK=[];curv=[];
 const sampled=QQ.sampleTrack(def);
 P=sampled.pts.map(p=>new THREE.Vector3(p.x,p.y,p.z)); N=P.length;
 TG=sampled.pts.map(p=>new THREE.Vector3(p.tx,0,p.tz));
 SD=sampled.pts.map(p=>new THREE.Vector3(p.sx,0,p.sz));
 BK=sampled.pts.map(p=>p.bank); curv=sampled.pts.map(p=>p.curv);
 const len=sampled.len;
 T={def,len,env:T&&T.env,sim:sampled};
 // sky
 const skyMat=new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,fog:false,uniforms:{a:{value:new THREE.Color(def.sky[0])},b:{value:new THREE.Color(def.sky[1])},c:{value:new THREE.Color(def.sky[2])},sd:{value:new THREE.Vector3(...def.sun).normalize()}},
  vertexShader:'varying vec3 vp;void main(){vp=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
  fragmentShader:'uniform vec3 a,b,c,sd;varying vec3 vp;void main(){float h=vp.y;vec3 col=h>0.?mix(b,a,pow(clamp(h*1.6,0.,1.),0.7)):mix(b,c,clamp(-h*4.,0.,1.));float s=max(dot(vp,sd),0.);col+=vec3(1.,.85,.6)*(pow(s,600.)*2.+pow(s,8.)*.35);gl_FragColor=vec4(col,1.);}'});
 const sky=new THREE.Mesh(new THREE.SphereGeometry(2000,32,16),skyMat); sky.renderOrder=-1; scene.add(sky); T.sky=sky;
 scene.fog=new THREE.Fog(def.fog,def.fogD[0],def.fogD[1]);
 { const es=new THREE.Scene(); es.add(new THREE.Mesh(new THREE.SphereGeometry(50,24,12),skyMat)); const lm=new THREE.MeshBasicMaterial({color:'#ffffff'});
   for(const [x,y,z,sx,sz] of [[0,40,0,30,30],[35,15,0,4,25],[-35,15,0,4,25],[0,15,35,25,4]]){ const b=new THREE.Mesh(new THREE.BoxGeometry(sx,2,sz),lm); b.position.set(x,y,z); es.add(b); }
   const gnd=new THREE.Mesh(new THREE.CircleGeometry(49,24).rotateX(-Math.PI/2),new THREE.MeshBasicMaterial({color:def.ground})); gnd.position.y=-5; es.add(gnd);
   if(T.env)T.env.dispose(); const pm=new THREE.PMREMGenerator(renderer); const rt=pm.fromScene(es,0.04); scene.environment=rt.texture; T.env=rt; pm.dispose(); }
 if(def.clouds){ for(let i=0;i<34;i++){ const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:cloudTex,fog:false,depthWrite:false,transparent:true,opacity:def.night?0.55:0.95,color:def.night?'#ffb0d0':'#ffffff'})); const a=rand()*TAU,r=900+rand()*700; sp.position.set(Math.cos(a)*r,160+rand()*320,Math.sin(a)*r); sp.scale.set(320+rand()*260,130+rand()*80,1); scene.add(sp); } }
 scene.add(new THREE.HemisphereLight(def.hemi[0],def.hemi[1],def.hemiI||1.1));
 const sun=new THREE.DirectionalLight(def.sunC,def.sunI||2.2); const sv=new THREE.Vector3(...def.sun).normalize(); T.sunDir=sv; sun.castShadow=true;
 sun.shadow.mapSize.set(1024,1024); const sc=sun.shadow.camera; sc.left=-45;sc.right=45;sc.top=45;sc.bottom=-45;sc.near=1;sc.far=300; sun.shadow.bias=-0.0008; sun.shadow.normalBias=0.03;
 scene.add(sun); scene.add(sun.target); T.sun=sun;
 // road ribbons
 const ribbon=(o0,o1,y0,y1,tex,uScale,mat,i0=0,i1=N)=>{ const pos=[],uv=[],idx=[]; let v=0;
   for(let i=i0;i<=i1;i++){ const j=i%N,p=P[j],s=SD[j],b=BK[j]; if(i>i0)v+=P[j].distanceTo(P[(i-1)%N])/uScale;
     for(let [o,y,u] of [[o0,y0,0],[o1,y1,1]]){ if(Math.abs(o)>HW+1.6){ let r=1e9; for(let q=-6;q<=6;q++)r=Math.min(r,1/Math.max(1e-5,Math.abs(curv[(j+q+N)%N]))); o=Math.sign(o)*Math.max(HW+1.6,Math.min(Math.abs(o),r*0.8)); } pos.push(p.x+s.x*o, p.y+o*Math.sin(b)+y, p.z+s.z*o); uv.push(u,v);} 
     if(i<i1){const k=(i-i0)*2; idx.push(k,k+1,k+2,k+1,k+3,k+2);} }
   const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3)); g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2)); g.setIndex(idx); g.computeVertexNormals();
   const m=new THREE.Mesh(g,mat||new THREE.MeshStandardMaterial({map:tex,roughness:0.85,side:THREE.DoubleSide})); m.receiveShadow=true; scene.add(m); return m; };
 const road=ribbon(-HW,HW,0.02,0.02,roadTex,W); if(def.night){road.material.roughness=0.35;road.material.metalness=0.35;}
 ribbon(-HW-1.4,-HW,0.06,0.06,curbTex,2); ribbon(HW,HW+1.4,0.06,0.06,curbTex,2);
 { const wl=wallTex.clone(); wl.repeat.set(1,-1); wl.needsUpdate=true; ribbon(-HW-1.4,-HW-1.4,0,1.3,wl,24); } ribbon(HW+1.4,HW+1.4,0,1.3,wallTex,24); if(city){ const gr=new THREE.MeshStandardMaterial({color:'#e8ecf2',metalness:0.8,roughness:0.25}); ribbon(-HW-1.45,-HW-1.45,1.3,1.5,null,1,gr); ribbon(HW+1.45,HW+1.45,1.3,1.5,null,1,gr); }
 if(city){ ribbon(-HW-8,-HW-1.4,0.25,0.25,walkTex,4); ribbon(HW+1.4,HW+8,0.25,0.25,walkTex,4);
   // tunnel on longest straight (not the start straight)
   let best=[0,0],run=0; for(let i=0;i<N;i++){ if(Math.abs(curv[i])<0.01)run++; else run=0; if(run>best[1]&&i-run>10&&i<N-30)best=[i,run]; }
   if(best[1]>60){ const i1=best[0]-12, i0=i1-Math.floor(best[1]*0.45); const tm=new THREE.MeshStandardMaterial({map:tunTex,roughness:0.8,side:THREE.DoubleSide});
     ribbon(-HW-1.5,-HW-1.5,0,8.5,null,1,tm,i0,i1); ribbon(HW+1.5,HW+1.5,0,8.5,null,1,tm,i0,i1);
     const roofM=ribbon(-HW-2.5,HW+2.5,8.5,8.5,null,1,new THREE.MeshStandardMaterial({color:'#6a6f7a',roughness:0.9,side:THREE.DoubleSide}),i0,i1); roofM.castShadow=true;
     ribbon(-0.6,0.6,8.4,8.4,null,1,new THREE.MeshBasicMaterial({color:'#fff2c0',side:THREE.DoubleSide}),i0,i1);
     ribbon(-HW+0.3,-HW+0.3,7.5,8.4,null,1,new THREE.MeshBasicMaterial({color:'#7ad7ff',side:THREE.DoubleSide}),i0,i1); ribbon(HW-0.3,HW-0.3,7.5,8.4,null,1,new THREE.MeshBasicMaterial({color:'#7ad7ff',side:THREE.DoubleSide}),i0,i1);
     for(const ii of [i0,i1]){ const pm=new THREE.Mesh(new THREE.BoxGeometry(W+8,3,2.5),new THREE.MeshPhysicalMaterial({color:def.night?'#ff4f9a':'#ff8a3a',roughness:0.3,clearcoat:1})); placeOnTrack(pm,ii,0,10); pm.castShadow=true; scene.add(pm);
       const lbl=new THREE.Mesh(new THREE.PlaneGeometry(14,2.2),new THREE.MeshBasicMaterial({map:tunLbl,side:THREE.DoubleSide})); placeOnTrack(lbl,ii,0,10); lbl.position.addScaledVector(TG[ii],ii===i0?-1.3:1.3); scene.add(lbl); }
     T.tunnel=[i0,i1]; }
 }
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
   scat(18,36,120,(x,z)=>{ const w=7+rand()*3,h=4+rand()*2; bld.push(M(x,gy+h/2,z,w,h,w*0.8,rand()*3)); roofs.push(M(x,gy+h+1.6,z,w*0.85,3.2,w*0.7,0)); });
   const chaletWall=new THREE.MeshStandardMaterial({color:'#f3ead8',roughness:0.88});
   const chaletRoof=new THREE.MeshStandardMaterial({color:'#8d342c',roughness:0.6});
   const chaletWood=new THREE.MeshStandardMaterial({color:'#6a3b22',roughness:0.72});
   const chaletGlass=new THREE.MeshStandardMaterial({color:'#b7e4f6',roughness:0.12,metalness:0.2});
   for(let i=24;i<N;i+=26){ const sd=(i/26|0)%2?1:-1; const o=(HW+12)*sd; const x=P[i].x+SD[i].x*o, z=P[i].z+SD[i].z*o; if(nearTrack(x,z)<HW+9)continue;
     const h=new THREE.Group(); const baseY=P[i].y;
     const walls=new THREE.Mesh(new THREE.BoxGeometry(5.4,2.7,4.2),chaletWall); walls.position.y=baseY+1.35; walls.castShadow=true; h.add(walls);
     const win=new THREE.Mesh(new THREE.BoxGeometry(1.35,1.05,0.12),chaletGlass); win.position.set(0.55,baseY+1.65,2.16); h.add(win);
     const door=new THREE.Mesh(new THREE.BoxGeometry(0.95,1.9,0.1),chaletWood); door.position.set(-1.35,baseY+0.95,2.16); h.add(door);
     for(const s of [-1,1]){ const slab=new THREE.Mesh(new THREE.BoxGeometry(6,0.16,2.7),chaletRoof); slab.position.set(0,baseY+3.05,s*0.95); slab.rotation.x=s*0.48; slab.castShadow=true; h.add(slab); }
     h.position.set(x,0,z); h.rotation.y=Math.atan2(-SD[i].x*sd,-SD[i].z*sd); scene.add(h); }
 }
 for(let i=0;i<N;i+=14){ for(const sd of [-1,1]){ const o=(HW+2.2)*sd, p=P[i],s=SD[i]; const x=p.x+s.x*o,z=p.z+s.z*o,y=p.y+o*Math.sin(BK[i]); poles.push(M(x,y+4,z,0.15,8,0.15)); lamps.push(M(x-s.x*sd*1.2,y+8,z-s.z*sd*1.2,0.5,0.25,0.5)); } }
 for(let i=0;i<(city?0:46);i++){ const a=i/46*TAU+rand()*0.1, r=rad+(city?520:def.water?650:420)+rand()*250, h=80+rand()*160, w=h*(1+rand()); mtn.push(M(cx+Math.cos(a)*r,gy-5+h/2,cz+Math.sin(a)*r,w,h,w,rand()*3)); if(!city)caps.push(M(cx+Math.cos(a)*r,gy-5+h*0.85,cz+Math.sin(a)*r,w*0.32,h*0.3,w*0.32,0)); }
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
 const ban=new THREE.Mesh(new THREE.BoxGeometry(W+4,2.2,0.6),new THREE.MeshStandardMaterial({map:canvasTex(512,64,(g,w,h)=>{g.fillStyle='#1d1f4a';g.fillRect(0,0,w,h);g.fillStyle='#ffde3b';g.font='bold 44px sans-serif';g.textAlign='center';g.fillText('QQ飞车  START',w/2,48);}),emissive:'#fff',emissiveIntensity:0.15}));
 ban.material.emissiveMap=ban.material.map; ban.position.y=9; g0.add(ban);
 g0.position.copy(sp); g0.rotation.y=Math.atan2(-TG[0].x,-TG[0].z); scene.add(g0);
 // boost pads & item boxes
 T.pads=[]; T.boxes=[];
 const padMat=new THREE.MeshBasicMaterial({map:padTex,transparent:true,opacity:0.9});
 for(let i=0;i<N;i++){ if(!sampled.pts[i].pad) continue; const lat=sampled.pts[i].padLat||0; const m=new THREE.Mesh(new THREE.PlaneGeometry(4,6),padMat); placeOnTrack(m,i,lat,0.08); m.rotateX(-Math.PI/2); scene.add(m); T.pads.push({i,lat}); }
 for(let i=0;i<N;i++){ const mk=sampled.pts[i].marker; if(!mk) continue; const m=new THREE.Mesh(new THREE.PlaneGeometry(5,1.3),new THREE.MeshBasicMaterial({map:chevTex,side:THREE.DoubleSide})); placeOnTrack(m,i,mk>0?(HW-2.4):-(HW-2.4),1.55); scene.add(m); }
 const boxGeo=new THREE.BoxGeometry(1.6,1.6,1.6), boxMat=new THREE.MeshStandardMaterial({map:boxTex,transparent:true,opacity:0.88,emissive:'#ff88ee',emissiveIntensity:0.3});
 for(let k=0;k<4;k++){ const i=Math.floor(N*(k+0.5)/4)%N; for(let l=-1.5;l<=1.5;l++){ const m=new THREE.Mesh(boxGeo,boxMat); placeOnTrack(m,i,l*3.6,1.4); scene.add(m); T.boxes.push({m,i,lat:l*3.6,t:0}); } }
}
// ---- city scenery (v3) ----
class MG{ constructor(){this.p=[];this.n=[];this.u=[];this.i=[];}
 quad(a,b,c,d,n,u0,v0,u1,v1){ const k=this.p.length/3; for(const q of [a,b,c,d])this.p.push(q.x,q.y,q.z); for(let j=0;j<4;j++)this.n.push(n.x,n.y,n.z); this.u.push(u0,v0,u1,v0,u1,v1,u0,v1); this.i.push(k,k+1,k+2,k,k+2,k+3); }
 mesh(mat,shadow){ if(!this.p.length)return null; const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute(this.p,3)); g.setAttribute('normal',new THREE.Float32BufferAttribute(this.n,3)); g.setAttribute('uv',new THREE.Float32BufferAttribute(this.u,2)); g.setIndex(this.i);
  const m=new THREE.Mesh(g,mat); m.castShadow=!!shadow; m.receiveShadow=true; scene.add(m); return m; } }
const V3=(x,y,z)=>new THREE.Vector3(x,y,z);
function boxSides(mg,cx,cz,t,s,w,d,y0,y1,tw,th,roof){ const hw=w/2,hd=d/2;
 const c=[[-hw,-hd],[hw,-hd],[hw,hd],[-hw,hd]].map(([a,b])=>[cx+t.x*a+s.x*b, cz+t.z*a+s.z*b]);
 const nrm=[V3(-s.x,0,-s.z),V3(t.x,0,t.z),V3(s.x,0,s.z),V3(-t.x,0,-t.z)], len=[w,d,w,d];
 for(let f=0;f<4;f++){ const A=c[f],B=c[(f+1)%4]; const ur=Math.max(1,Math.round(len[f]/tw)), vr=th?Math.max(1,Math.round((y1-y0)/th)):1;
   mg.quad(V3(A[0],y0,A[1]),V3(B[0],y0,B[1]),V3(B[0],y1,B[1]),V3(A[0],y1,A[1]),nrm[f],0,0,ur,vr); }
 if(roof)roof.quad(V3(c[0][0],y1,c[0][1]),V3(c[1][0],y1,c[1][1]),V3(c[2][0],y1,c[2][1]),V3(c[3][0],y1,c[3][1]),V3(0,1,0),0,0,w/4,d/4); }
const PAL=['#ff8fa3','#ffd166','#7bdff2','#b8f2a0','#f7f4ea','#c3a6ff','#ff9f5a','#9ad0ff'];
function facadeTex(wall,night,seed){ rng=seed; const tile=(g,w,h,emis)=>{ g.fillStyle=emis?'#000':wall; g.fillRect(0,0,w,h);
  if(!emis){ for(let i=0;i<300;i++){ g.fillStyle=`rgba(0,0,0,${rand()*0.05})`; g.fillRect(rand()*w,rand()*h,3,3);} g.fillStyle='rgba(255,255,255,0.35)'; g.fillRect(0,h/2-3,w,5); g.fillRect(0,h-5,w,5); g.fillStyle='rgba(0,0,0,0.12)'; g.fillRect(0,h/2+2,w,2); g.fillRect(0,0,w,2); }
  for(let fy=0;fy<2;fy++)for(let fx=0;fx<2;fx++){ const x=10+fx*64, y=12+fy*64, ww=44, wh=40;
    const lit=rand()<(night?0.55:0.12);
    if(emis){ if(lit){ g.fillStyle=rand()<0.5?'#ffd27a':'#fff1c8'; g.fillRect(x+3,y+3,ww-6,wh-6);} continue; }
    g.fillStyle='#ffffff'; g.fillRect(x-3,y-3,ww+6,wh+6); const gr=g.createLinearGradient(x,y,x+ww,y+wh); gr.addColorStop(0,lit?'#ffe9b0':'#3d78b8'); gr.addColorStop(0.55,lit?'#ffd27a':'#7fc0ee'); gr.addColorStop(1,lit?'#f0b860':'#2b5d97'); g.fillStyle=gr; g.fillRect(x,y,ww,wh);
    g.fillStyle='rgba(255,255,255,0.8)'; g.fillRect(x+ww/2-1,y,2,wh); g.fillStyle='rgba(255,255,255,0.35)'; g.beginPath(); g.moveTo(x+4,y+wh-4); g.lineTo(x+16,y+4); g.lineTo(x+22,y+4); g.lineTo(x+10,y+wh-4); g.fill();
    g.fillStyle='rgba(0,0,0,0.25)'; g.fillRect(x-4,y+wh+3,ww+8,4); } };
 const a=canvasTex(128,128,(g,w,h)=>tile(g,w,h,false),true); rng=seed; const e=night?canvasTex(128,128,(g,w,h)=>tile(g,w,h,true),true):null; return [a,e]; }
const shopTex=canvasTex(128,96,(g,w,h)=>{ g.fillStyle='#e9e4dc'; g.fillRect(0,0,w,h); const gr=g.createLinearGradient(0,20,0,h); gr.addColorStop(0,'#bfe6ff'); gr.addColorStop(1,'#5aa0d8'); g.fillStyle='#555'; g.fillRect(6,20,116,76); g.fillStyle=gr; g.fillRect(9,23,70,70); g.fillRect(84,23,35,73);
  g.fillStyle='#fff8'; for(let i=0;i<4;i++)g.fillRect(14+i*16,30,5,40); g.fillStyle='#ffcf6a'; g.fillRect(16,70,20,18); g.fillStyle='#ff7aa0'; g.fillRect(44,66,24,22); g.fillStyle='#ddd'; g.fillRect(0,0,w,18); },true);
const signTex=canvasTex(512,512,(g,w,h)=>{ const names=['奶茶 MILK TEA','便利店 24H','火锅 HOTPOT','咖啡 CAFÉ','书店 BOOKS','花店 FLOWERS','漂移网咖','面包房 BAKERY']; const cols=['#ff4f8b','#2fb3ff','#ff6a2b','#7a4cff','#22c27a','#ff8fc8','#ffcc00','#ff4f4f'];
  names.forEach((n,i)=>{ g.fillStyle=cols[i]; g.fillRect(0,i*64,w,64); g.fillStyle='#fff'; g.fillRect(0,i*64,w,4); g.fillRect(0,i*64+60,w,4); g.font='bold 40px sans-serif'; g.textAlign='center'; g.fillStyle='#fff'; g.strokeStyle='rgba(0,0,0,0.35)'; g.lineWidth=4; g.strokeText(n,w/2,i*64+46); g.fillText(n,w/2,i*64+46); }); });
const adTexs=[['#ff3a7a','#ffb03a','漂移大师赛','DRIFT MASTERS'],['#2a7bff','#5ef0ff','极速汽水','NITRO SODA'],['#7a3cff','#ff5ec8','QQ飞车','SPEED CUP 2026'],['#13b36a','#c4ff5e','绿色出行','CITY PARK']].map(([a,b,t1,t2])=>canvasTex(512,256,(g,w,h)=>{ const gr=g.createLinearGradient(0,0,w,h); gr.addColorStop(0,a); gr.addColorStop(1,b); g.fillStyle=gr; g.fillRect(0,0,w,h);
  g.fillStyle='rgba(255,255,255,0.18)'; for(let i=0;i<6;i++){g.beginPath();g.arc(rand()*w,rand()*h,30+rand()*60,0,TAU);g.fill();} g.fillStyle='#fff'; g.textAlign='center'; g.font='bold 86px sans-serif'; g.fillText(t1,w/2,130); g.font='bold 40px sans-serif'; g.fillText(t2,w/2,200); g.lineWidth=12; g.strokeStyle='#fff'; g.strokeRect(6,6,w-12,h-12); }));
const poolTex=canvasTex(128,128,(g,w,h)=>{ const r=g.createRadialGradient(64,64,0,64,64,64); r.addColorStop(0,'rgba(255,214,150,0.9)'); r.addColorStop(0.5,'rgba(255,190,120,0.35)'); r.addColorStop(1,'rgba(255,180,100,0)'); g.fillStyle=r; g.fillRect(0,0,w,h); });
const cloudTex=canvasTex(256,128,(g,w,h)=>{ for(let i=0;i<14;i++){ const x=40+rand()*176,y=50+rand()*40,r=20+rand()*30; const gr=g.createRadialGradient(x,y,0,x,y,r); gr.addColorStop(0,'rgba(255,255,255,0.95)'); gr.addColorStop(1,'rgba(255,255,255,0)'); g.fillStyle=gr; g.fillRect(0,0,w,h);} });
function cityScenery(def,M,inst,nearTrack,trunks,crowns,mtn,caps,cx,cz,rad){
 const night=def.night; const styles=PAL.map((c,i)=>facadeTex(c,night,11+i)); const fac=styles.map(()=>new MG()), shop=new MG(), roof=new MG(), sign=new MG();
 const placed=[]; const acs=[],tanks=[],awn=[],awnC=[],planters=[],ptr=[],pcr=[],pcrC=[],beds=[],bedC=[];
 const tmpT=new THREE.Vector3(), tmpS=new THREE.Vector3();
 const building=(x,z,t,s,w,d,h,far)=>{ const st=rand()*styles.length|0; const sh=far?0:4.5;
   if(!far){ boxSides(shop,x,z,t,s,w,d,0,sh,6,0,null); }
   const tower=!far&&h>22&&rand()<0.45; const h1=tower?h*0.6:h;
   boxSides(fac[st],x,z,t,s,w,d,sh,h1,6,6.4,roof);
   if(tower){ const st2=(st+1+rand()*3|0)%styles.length; boxSides(fac[st2],x+s.x*d*0.12,z+s.z*d*0.12,t,s,w*0.62,d*0.62,h1,h,6,6.4,roof); }
   if(!far){ const rise=Math.min(3.4,1.5+w*0.05), yR=h;
     const p=(ax,az,yy)=>V3(x+t.x*ax+s.x*az, yy, z+t.z*ax+s.z*az);
     const r0=p(-w*0.42,0,yR+rise), r1=p(w*0.42,0,yR+rise);
     roof.quad(p(-w*0.5,-d*0.52,yR), p(w*0.5,-d*0.52,yR), r1, r0, V3(-s.x,0.65,-s.z).normalize(),0,0,1,1);
     roof.quad(p(w*0.5,d*0.52,yR), p(-w*0.5,d*0.52,yR), r0, r1, V3(s.x,0.65,s.z).normalize(),0,0,1,1);
   }
   if(far)return;
   // awning + sign on road-facing side
   const fx=x-s.x*(d/2), fz=z-s.z*(d/2); const ry=Math.atan2(s.x,s.z);
   awn.push(new THREE.Matrix4().compose(V3(fx-s.x*0.9,4.1,fz-s.z*0.9),new THREE.Quaternion().setFromEuler(new THREE.Euler(0.35,ry,0,'YXZ')),V3(w*0.86,0.18,2.0))); awnC.push(new THREE.Color(['#ff4f6a','#2fb3ff','#ffcc00','#22c27a','#ff8a3a','#ffffff'][rand()*6|0]));
   const r=rand()*8|0, sw=Math.min(w*0.7,12), sx=fx-s.x*0.15, sz=fz-s.z*0.15; const R=V3(-t.x,0,-t.z).multiplyScalar(sw/2);
   // viewer right = -sd*t; s already includes sd, so right = (s.z,0,-s.x)
   const vr=V3(s.z,0,-s.x).multiplyScalar(sw/2);
   sign.quad(V3(sx+vr.x,4.6,sz+vr.z),V3(sx-vr.x,4.6,sz-vr.z),V3(sx-vr.x,6.0,sz-vr.z),V3(sx+vr.x,6.0,sz+vr.z),V3(-s.x,0,-s.z),0,1-(r+1)/8,1,1-r/8);
   for(let k=0;k<2;k++)acs.push(M(x+(rand()-0.5)*w*0.5,h+0.6,z+(rand()-0.5)*d*0.5,1.8,1.2,1.4,ry));
   if(rand()<0.35)tanks.push(M(x+(rand()-0.5)*w*0.4,h+1.5,z+(rand()-0.5)*d*0.4,1.4,3,1.4)); };
 // buildings set back from road
 for(let i=0;i<N;i+=6){ const t=TG[i];
   for(const sd of [-1,1]){ const w=13+rand()*15, d=12+rand()*12; const h=def.bh[0]+Math.pow(rand(),1.8)*(def.bh[1]-def.bh[0]);
     const o=HW+14+d/2; const s=tmpS.set(SD[i].x*sd,0,SD[i].z*sd).clone(), tt=t.clone(); const x=P[i].x+s.x*o, z=P[i].z+s.z*o;
     const R=Math.hypot(w,d)/2; if(placed.some(p=>Math.hypot(p[0]-x,p[1]-z)<p[2]+R*0.85))continue;
     let ok=nearTrack(x,z)>HW+13+Math.min(w,d)/2; for(const [a,b] of [[-1,-1],[1,-1],[1,1],[-1,1]]){ if(!ok)break; ok=nearTrack(x+tt.x*a*w/2+s.x*b*d/2,z+tt.z*a*w/2+s.z*b*d/2)>HW+12; }
     if(!ok)continue; placed.push([x,z,R]); building(x,z,tt,s,w,d,h,false); } }
 // distant skyline
 for(let i=0;i<70;i++){ const a=i/70*TAU+rand()*0.05, r=rad+260+rand()*260; const x=cx+Math.cos(a)*r, z=cz+Math.sin(a)*r; const t=V3(-Math.sin(a),0,Math.cos(a)), s=V3(Math.cos(a),0,Math.sin(a));
   building(x,z,t,s,30+rand()*30,30+rand()*20,40+rand()*(night?140:110),true); }
 // planters with trees + flower beds on sidewalks
 const treeCols=night?['#2f7a4a','#3b8f5a','#ff7ab8']:['#4caf50','#66c25a','#ff9ec8','#3d9a48','#8bd36a'];
 for(let i=0;i<N;i+=5){ if(Math.abs(curv[i])>0.25)continue; for(const sd of [-1,1]){ const o=(HW+5.3)*sd; const x=P[i].x+SD[i].x*o, z=P[i].z+SD[i].z*o; if(nearTrack(x,z)<HW+4.6)continue;
   if((i/5|0)%2===0){ planters.push(M(x,0.55,z,1.8,0.6,1.8)); ptr.push(M(x,2.2,z,0.25,3.2,0.25)); const sc=1.3+rand()*0.6; pcr.push(M(x,4.2+rand()*0.5,z,sc,sc*1.1,sc,rand()*3)); pcrC.push(new THREE.Color(treeCols[rand()*treeCols.length|0])); }
   else { const ry=Math.atan2(TG[i].x,TG[i].z); beds.push(M(x,0.45,z,1.3,0.4,3.2,ry)); bedC.push(new THREE.Color(['#ff4f8b','#ffd23c','#ff8a3a','#b07cff','#ff5e5e'][rand()*5|0])); } } }
 // materials
 styles.forEach((st,i)=>{ const m=new THREE.MeshStandardMaterial({map:st[0],roughness:0.75,metalness:0.0,side:THREE.DoubleSide}); if(st[1]){m.emissive=new THREE.Color('#ffffff');m.emissiveMap=st[1];m.emissiveIntensity=1.1;} fac[i].mesh(m,true); });
 shop.mesh(new THREE.MeshStandardMaterial({map:shopTex,roughness:0.5,side:THREE.DoubleSide,emissive:night?'#ffd9a0':'#000',emissiveMap:night?shopTex:null,emissiveIntensity:night?0.5:0}));
 roof.mesh(new THREE.MeshStandardMaterial({color:night?'#4a4660':'#c5ccd4',roughness:0.75,side:THREE.DoubleSide}));
 sign.mesh(new THREE.MeshStandardMaterial({map:signTex,emissive:'#ffffff',emissiveMap:signTex,emissiveIntensity:night?1.2:0.25,side:THREE.DoubleSide}));
 const ai=inst(new THREE.BoxGeometry(1,1,1),new THREE.MeshStandardMaterial({color:'#ffffff',roughness:0.6}),awn,true); awnC.forEach((c,i)=>ai.setColorAt(i,c));
 inst(new THREE.BoxGeometry(1,1,1),new THREE.MeshStandardMaterial({color:'#d0d4da',roughness:0.6}),acs);
 inst(new THREE.CylinderGeometry(0.5,0.5,1,10),new THREE.MeshStandardMaterial({color:'#5b8fd0',roughness:0.5,metalness:0.3}),tanks);
 inst(new THREE.BoxGeometry(1,1,1),new THREE.MeshStandardMaterial({color:'#c9c2b6',roughness:0.9}),planters);
 inst(new THREE.CylinderGeometry(1,1.2,1,6),new THREE.MeshStandardMaterial({color:'#7a5232'}),ptr);
 const crownGeo=new THREE.ConeGeometry(1.35,2.6,7); crownGeo.translate(0,1.1,0);
 const ci=inst(crownGeo,new THREE.MeshStandardMaterial({color:'#ffffff',roughness:0.85}),pcr,true); pcrC.forEach((c,i)=>ci.setColorAt(i,c));
 const bi=inst(new THREE.BoxGeometry(1,1,1),new THREE.MeshStandardMaterial({color:'#ffffff',roughness:0.8}),beds); bedC.forEach((c,i)=>bi.setColorAt(i,c));
 // chevrons, zebra crossings, traffic lights, bus stops, billboards, light pools
 const pole=new THREE.MeshStandardMaterial({color:'#3a3f4a',metalness:0.6,roughness:0.4});
 let lastCorner=-99;
 for(let i=0;i<N;i+=3){ const c=curv[i]; if(Math.abs(c)>0.5){ const so=c<0?1:-1; const m=new THREE.Mesh(new THREE.PlaneGeometry(5,1.3),new THREE.MeshBasicMaterial({map:chevTex,side:THREE.DoubleSide}));
     placeOnTrack(m,(i+2)%N,so*(HW+1.1),1.0); if(c<0)m.scale.x=-1; scene.add(m);
     if(i-lastCorner>40){ // traffic light before corner, outside
       const j=(i-10+N)%N, o=so*(HW+3); const g=new THREE.Group(); const p1=new THREE.Mesh(new THREE.CylinderGeometry(0.15,0.18,7,8),pole); p1.position.y=3.5; g.add(p1);
       const arm=new THREE.Mesh(new THREE.BoxGeometry(0.15,0.15,6),pole); arm.position.set(0,6.8,0); arm.rotation.y=Math.PI/2; arm.position.x=-so*3; g.add(arm);
       const hs=new THREE.Mesh(new THREE.BoxGeometry(0.6,1.8,0.5),new THREE.MeshStandardMaterial({color:'#222'})); hs.position.set(-so*5.5,6.2,0); g.add(hs);
       ['#ff3030','#ffcc00','#30ff60'].forEach((col,k)=>{ const l=new THREE.Mesh(new THREE.CircleGeometry(0.2,12),new THREE.MeshBasicMaterial({color:col})); l.position.set(-so*5.5,6.75-k*0.55,0.26); g.add(l); });
       trackPos(j,o,g.position); g.rotation.y=Math.atan2(-TG[j].x,-TG[j].z)+Math.PI; g.scale.x=-1; scene.add(g); }
     lastCorner=i; }
   const straight=Math.abs(c)<0.02&&Math.abs(curv[(i+15)%N])<0.02&&Math.abs(curv[(i-15+N)%N])<0.02;
   if(i%66===33&&straight){ const m=new THREE.Mesh(new THREE.PlaneGeometry(W-2,4),new THREE.MeshBasicMaterial({map:zebraTex,transparent:true,polygonOffset:true,polygonOffsetFactor:-1})); placeOnTrack(m,i,0,0.04); m.rotateX(-Math.PI/2); scene.add(m); }
   if(i%150===75&&straight){ const sd=(i/150|0)%2?1:-1, j=i; const g=new THREE.Group(); const glass=new THREE.MeshStandardMaterial({color:'#9fe0ff',transparent:true,opacity:0.45,roughness:0.1}), blue=new THREE.MeshStandardMaterial({color:'#2a7bff',roughness:0.4});
     const rf=new THREE.Mesh(new THREE.BoxGeometry(6,0.2,2.6),blue); rf.position.y=2.8; g.add(rf); const bk=new THREE.Mesh(new THREE.BoxGeometry(6,2.4,0.08),glass); bk.position.set(0,1.5,sd*1.2); g.add(bk);
     const ad=new THREE.Mesh(new THREE.PlaneGeometry(1.8,2.2),new THREE.MeshBasicMaterial({map:adTexs[i%4]})); ad.position.set(2.6,1.5,sd*1.15); ad.rotation.y=sd>0?Math.PI:0; g.add(ad);
     for(const px of [-2.9,2.9]){ const pp=new THREE.Mesh(new THREE.BoxGeometry(0.12,2.8,0.12),pole); pp.position.set(px,1.4,sd*1.2); g.add(pp);} const bench=new THREE.Mesh(new THREE.BoxGeometry(4,0.15,0.6),new THREE.MeshStandardMaterial({color:'#c08040'})); bench.position.set(-0.5,0.7,sd*0.8); g.add(bench);
     g.traverse(o=>o.castShadow=true); trackPos(j,sd*(HW+4.6),g.position); g.position.y=0.25; g.rotation.y=Math.atan2(-TG[j].x,-TG[j].z); scene.add(g); }
   if(i%111===54&&straight){ const sd=(i/111|0)%2?-1:1; const g=new THREE.Group(); const pan=new THREE.Mesh(new THREE.PlaneGeometry(12,6),new THREE.MeshStandardMaterial({map:adTexs[(i/111|0)%4],emissive:'#fff',emissiveMap:adTexs[(i/111|0)%4],emissiveIntensity:night?0.9:0.2,side:THREE.DoubleSide})); pan.position.y=9; g.add(pan);
     const frame=new THREE.Mesh(new THREE.BoxGeometry(12.6,6.6,0.3),pole); frame.position.set(0,9,0.2*sd); g.add(frame); for(const px of [-4,4]){ const pp=new THREE.Mesh(new THREE.CylinderGeometry(0.25,0.3,6,8),pole); pp.position.set(px,3,0.3*sd); g.add(pp);} 
     g.traverse(o=>o.castShadow=true); trackPos(i,sd*(HW+10),g.position); g.rotation.y=Math.atan2(-TG[i].x,-TG[i].z)+(sd>0?Math.PI/2:-Math.PI/2); if(nearTrack(g.position.x,g.position.z)>HW+8)scene.add(g); }
 }
 if(night){ const pools=[]; for(let i=0;i<N;i+=14)for(const sd of [-1,1]){ const p=trackPos(i,sd*(HW-2.5),V3(0,0,0)); pools.push(M(p.x,0.06,p.z,1,1,1)); }
   const pg=new THREE.PlaneGeometry(12,12).rotateX(-Math.PI/2); inst(pg,new THREE.MeshBasicMaterial({map:poolTex,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-3}),pools); }
}

function trackPos(i,lat,out){ i=((i%N)+N)%N; const a=Math.floor(i),b=(a+1)%N,f=i-a; const p=P[a],q=P[b],s=SD[a];
 out.set(lerp(p.x,q.x,f)+s.x*lat, lerp(p.y,q.y,f)+lat*Math.sin(BK[a]), lerp(p.z,q.z,f)+s.z*lat); return out; }
function placeOnTrack(m,i,lat,h){ trackPos(i,lat,m.position); m.position.y+=h; m.rotation.set(0,Math.atan2(-TG[i].x,-TG[i].z),0); m.rotateZ(-BK[i]); }
// ================= KART MODEL =================
function makeKart(color,acc){
 const g=new THREE.Group(), body=new THREE.Group(); g.add(body);
 const paint=new THREE.MeshPhysicalMaterial({color,metalness:0.35,roughness:0.32,clearcoat:1,clearcoatRoughness:0.08});
 const accent=new THREE.MeshPhysicalMaterial({color:acc,metalness:0.2,roughness:0.35,clearcoat:1});
 const dark=new THREE.MeshStandardMaterial({color:'#1c1f26',roughness:0.55,metalness:0.25});
 const chrome=new THREE.MeshStandardMaterial({color:'#d5dbe3',metalness:0.95,roughness:0.18});
 const glass=new THREE.MeshPhysicalMaterial({color:'#b9e6ff',transparent:true,opacity:0.45,roughness:0.05,metalness:0.1,clearcoat:1});
 const add=(geo,mat,x,y,z,rx=0,ry=0,rz=0,par=body,sh=true)=>{const m=new THREE.Mesh(geo,mat); m.position.set(x,y,z); m.rotation.set(rx,ry,rz); m.castShadow=sh; par.add(m); return m;};
 // low shell: wide tub, pointed nose, side pods. Local -z is the nose.
 const shell=new THREE.Shape();
 shell.moveTo(0,2.15); shell.lineTo(0.55,1.55); shell.lineTo(0.82,0.2); shell.lineTo(0.78,-1.15); shell.lineTo(0.35,-1.45); shell.lineTo(-0.35,-1.45); shell.lineTo(-0.78,-1.15); shell.lineTo(-0.82,0.2); shell.lineTo(-0.55,1.55); shell.closePath();
 const tub=new THREE.ExtrudeGeometry(shell,{depth:0.28,bevelEnabled:true,bevelThickness:0.08,bevelSize:0.08,bevelSegments:2,curveSegments:3});
 tub.rotateX(-Math.PI/2); add(tub,paint,0,0.34,0);
 add(new THREE.BoxGeometry(1.15,0.08,2.4),dark,0,0.22,0.05);
 // nose cone
 const nose=new THREE.ConeGeometry(0.42,1.15,6); nose.rotateX(-Math.PI/2); add(nose,paint,0,0.5,-2.15);
 add(new THREE.BoxGeometry(0.9,0.06,0.7),accent,0,0.36,-1.7);
 for(const s of [-1,1]){
   add(new THREE.BoxGeometry(0.28,0.16,1.5),accent,s*0.78,0.42,-0.15);
   add(new THREE.BoxGeometry(0.08,0.1,0.55),chrome,s*0.95,0.4,-1.85);
 }
 // cockpit opening and windshield
 add(new THREE.BoxGeometry(0.7,0.22,0.85),dark,0,0.5,0.15);
 const screen=add(new THREE.BoxGeometry(0.78,0.42,0.06),glass,0,0.82,-0.55); screen.rotation.x=-0.55;
 add(new THREE.TorusGeometry(0.18,0.035,6,12),dark,0,0.62,-0.15,-1.0);
 const sw=add(new THREE.TorusGeometry(0.16,0.028,6,10),chrome,0,0.66,-0.22,-1.05);
 // driver sitting in the tub
 const suit=new THREE.MeshStandardMaterial({color:acc,roughness:0.65});
 add(new THREE.CapsuleGeometry(0.16,0.28,4,8),suit,0,0.78,0.22);
 add(new THREE.SphereGeometry(0.2,16,12),new THREE.MeshStandardMaterial({color:'#f4f4f4',roughness:0.4}),0,1.12,0.18);
 add(new THREE.SphereGeometry(0.16,12,8,0,Math.PI*2,0.2,1.1),new THREE.MeshStandardMaterial({color:'#16324f',roughness:0.2,metalness:0.4}),0,1.1,0.02);
 // rear deck, wing, exhaust
 add(new THREE.BoxGeometry(0.9,0.22,0.55),dark,0,0.55,1.25);
 const flames=[]; const fm=new THREE.MeshBasicMaterial({color:'#7ad7ff',transparent:true,opacity:0.9,blending:THREE.AdditiveBlending,depthWrite:false});
 for(const s of [-0.28,0.28]){
   add(new THREE.CylinderGeometry(0.07,0.09,0.45,8),chrome,s,0.48,1.55,Math.PI/2);
   const flame=new THREE.ConeGeometry(0.09,0.55,8); flame.translate(0,-0.2,0); flames.push(add(flame,fm,s,0.48,1.85,-Math.PI/2,0,0,body,false));
 }
 add(new THREE.BoxGeometry(1.7,0.06,0.32),accent,0,1.15,1.35);
 for(const s of [-1,1]) add(new THREE.BoxGeometry(0.06,0.38,0.28),paint,s*0.62,0.92,1.32);
 const hl=new THREE.MeshBasicMaterial({color:'#fff6d0'});
 for(const s of [-0.22,0.22]) add(new THREE.BoxGeometry(0.16,0.08,0.06),hl,s,0.5,-2.45,0,0,0,body,false);
 const wheels=[], steer=[];
 const tire=new THREE.MeshStandardMaterial({color:'#15171b',roughness:0.9});
 const tg=new THREE.TorusGeometry(0.32,0.13,10,18).rotateY(Math.PI/2);
 const rim=new THREE.CylinderGeometry(0.18,0.18,0.16,12).rotateZ(Math.PI/2);
 for(const [x,z,front] of [[-0.95,-1.25,1],[0.95,-1.25,1],[-1.02,1.05,0],[1.02,1.05,0]]){
   const piv=new THREE.Group(); piv.position.set(x,0.34,z); g.add(piv);
   const w=new THREE.Group(); piv.add(w);
   const t=new THREE.Mesh(tg,tire); t.castShadow=true; w.add(t);
   w.add(new THREE.Mesh(rim,chrome));
   wheels.push(w); if(front)steer.push(piv);
 }
 const shield=new THREE.Mesh(new THREE.SphereGeometry(2.4,16,12),new THREE.MeshBasicMaterial({color:'#7ff',transparent:true,opacity:0.22,blending:THREE.AdditiveBlending,depthWrite:false}));
 shield.position.y=0.8; shield.visible=false; g.add(shield);
 g.userData={body,wheels,steer,flames,fm,shield,sw,paint}; return g;
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
   const row=Math.floor(k/2), lat=(k%2?3.2:-3.2); const idx=(N-8-row*6+N)%N;
   const b=QQ.createKart(T.sim, idx); const sp=T.sim.pts[Math.floor(b.idx)%N];
   b.x+=sp.sx*lat; b.z+=sp.sz*lat; b.lat=lat; b.y=sp.y+lat*Math.sin(sp.bank||0);
   karts.push(Object.assign(b,{m,ai:k>0,name:NAMES[k],pos:new THREE.Vector3(b.x,b.y,b.z),lap:-1,half:true,prog:0,
    item:null,shield:0,spin:0,finished:false,time:0,lapStart:0,laps:[],
    skill:0.9+k*0.012+Math.random()*0.03, aiLat:lat, aiT:Math.random()*10, aiItemT:2+Math.random()*5, lastW:[null,null], wspin:0, prevIdx:b.idx, goPulse:false}));
 }
 player=karts[0]; if(TRACKS[G.track].night){ const sl=new THREE.SpotLight('#fff1d0',900,90,0.55,0.5,1.4); sl.position.set(0,1.2,-2.6); const tg=new THREE.Object3D(); tg.position.set(0,0,-25); player.m.add(sl); player.m.add(tg); sl.target=tg; } G.raceT=-4; G.state='count'; G.count=4; G.finishOrder=[]; G.resultT=0;
 G.best=+(localStorage['qqs_best_'+G.track]||0); buildMinimap(); applyQuality(); hud(true);
 $('menu').style.display='none'; $('hud').style.display='block'; $('results').style.display='none'; $('pause').style.display='none';
}
// ================= INPUT =================
const K={}; const inp={left:0,right:0,drift:0,nitro:0,brake:0,item:0,spray:0};
addEventListener('keydown',e=>{ K[e.code]=1; Audio.resume(); if(e.code==='KeyP'||e.code==='Escape')togglePause(); if(e.code==='KeyE'||e.code==='KeyQ')useItem(player); if(['Space','ArrowUp','ArrowDown','KeyW','KeyN'].includes(e.code))e.preventDefault(); });
addEventListener('keyup',e=>{K[e.code]=0;});
function bindBtn(id,key,tap){ const el=$(id); const on=e=>{e.preventDefault(); Audio.resume(); inp[key]=1; el.classList.add('on'); if(tap)tap();}; const off=e=>{e.preventDefault(); inp[key]=0; el.classList.remove('on');};
 el.addEventListener('touchstart',on,{passive:false}); el.addEventListener('touchend',off,{passive:false}); el.addEventListener('touchcancel',off,{passive:false}); el.addEventListener('mousedown',on); el.addEventListener('mouseup',off); el.addEventListener('mouseleave',off); }
bindBtn('bL','left'); bindBtn('bR','right'); bindBtn('bD','drift'); bindBtn('bB','brake'); bindBtn('bW','spray'); bindBtn('bN','nitro'); bindBtn('bI','item',()=>useItem(player));
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
 const k=G.menuKart; const c=COLORS[G.color]; k.userData.paint.color.set(c[0]);
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
const MAXS=QQ.BASE_TOP, BOOSTS=QQ.BASE_TOP+QQ.NITRO_EXTRA+QQ.SMALL_HI, tmpV=new THREE.Vector3(), tmpV2=new THREE.Vector3();
function nearest(k){ let best=1e9,bi=k.idx|0; for(let d=-25;d<=25;d++){ const i=((k.idx|0)+d+N)%N; const p=P[i]; const dd=(p.x-k.pos.x)**2+(p.z-k.pos.z)**2; if(dd<best){best=dd;bi=i;} }
 const p=P[bi],t=TG[bi]; const along=(k.pos.x-p.x)*t.x+(k.pos.z-p.z)*t.z; let fi=bi+along/(T.len/N); const old=k.idx; k.idx=(fi+N)%N; 
 k.lat=(k.pos.x-p.x)*SD[bi].x+(k.pos.z-p.z)*SD[bi].z; 
 if(old>N*0.8&&k.idx<N*0.2){ if(k.half)lapDone(k); k.half=false; } else if(old<N*0.2&&k.idx>N*0.8){ k.lap--; k.half=true; }
 if(k.idx>N*0.45&&k.idx<N*0.55)k.half=true; return bi; }
function lapDone(k){ if(G.state!=='race'){k.lap++;return;} k.lap++; if(k.lap<1)return; const lt=G.raceT-k.lapStart; k.laps.push(lt); k.lapStart=G.raceT;
 if(!k.ai&&k.lap>=1&&k.lap<=3){ if(!G.best||lt<G.best){ G.best=lt; localStorage['qqs_best_'+G.track]=lt; if(k.lap>=1)flash('新纪录! '+fmt(lt));} else flash('第'+k.lap+'圈 '+fmt(lt)); if(k.lap===2)setTimeout(()=>flash('最后一圈!'),1200); Audio.beep(true); }
 if(k.lap>=3&&!k.finished){ k.finished=true; k.time=G.raceT; G.finishOrder.push(k); if(!k.ai){ Audio.fanfare(G.finishOrder.length<=3); G.resultT=2.5; } } }
function useNitro(){ /* 氮气在 QQ.stepKart 里按按下沿消耗，避免和叠喷各算一遍 */ }
function useItem(k){ if(G.state!=='race'||!k.item)return; const it=k.item; k.item=null;
 if(it==='shield'){ k.shield=6; if(!k.ai)Audio.charge(); }
 else if(it==='banana'){ const b=new THREE.Group(); const m=new THREE.Mesh(new THREE.TorusGeometry(0.5,0.22,8,12,Math.PI*1.2),new THREE.MeshStandardMaterial({color:'#ffe135',roughness:0.5})); m.rotation.z=Math.PI*0.9; b.add(m);
   const fw=new THREE.Vector3(-Math.sin(k.yaw),0,-Math.cos(k.yaw)); b.position.copy(k.pos).addScaledVector(fw,-3.5); b.position.y+=0.5; scene.add(b); bananas.push({m:b,t:30}); Audio.tone(400,0.15,'triangle',0.2,0,0.5); }
 else if(it==='missile'){ const sorted=[...karts].sort((a,b)=>b.prog-a.prog); const r=sorted.indexOf(k); const tgt=r>0?sorted[r-1]:null;
   const m=new THREE.Group(); const bd=new THREE.Mesh(new THREE.CylinderGeometry(0.22,0.22,1.4,10).rotateX(Math.PI/2),new THREE.MeshStandardMaterial({color:'#e33',metalness:0.5,roughness:0.3})); m.add(bd);
   const tip=new THREE.Mesh(new THREE.ConeGeometry(0.22,0.5,10).rotateX(-Math.PI/2),new THREE.MeshStandardMaterial({color:'#fff'})); tip.position.z=-0.95; m.add(tip);
   m.position.copy(k.pos); m.position.y+=1.5; scene.add(m); missiles.push({m,tgt,owner:k,t:6,yaw:k.yaw,sp:k.speed+30}); if(!k.ai||tgt===player)Audio.fire(); if(tgt===player)flash('⚠ 导弹来袭!'); }
 if(!k.ai)updItem(); }
function hit(k){ if(k.shield>0){ k.shield=0; if(!k.ai||true)Audio.tone(1500,0.2,'sine',0.2,0,0.5); return; } k.spin=1.3; k.speed*=0.3; k.drift=false; k.smallT=0; k.nitroT=0; k.startT=0; k.landT=0; if(!k.ai){Audio.explode(); flash('被击中!'); shake=0.6;} 
 for(let i=0;i<40;i++)sparks.emit(k.pos.x,k.pos.y+1,k.pos.z,(Math.random()-0.5)*14,Math.random()*10,(Math.random()-0.5)*14,1,0.5,0.1,0.8); }
let shake=0;
function noteLap(k){
 const old=k.prevIdx; if(old==null){ k.prevIdx=k.idx; return; }
 if(old>N*0.8&&k.idx<N*0.2){ if(k.half)lapDone(k); k.half=false; }
 else if(old<N*0.2&&k.idx>N*0.8){ k.lap--; k.half=true; }
 if(k.idx>N*0.45&&k.idx<N*0.55)k.half=true;
 k.prog=k.lap*N+k.idx; k.prevIdx=k.idx;
}
function updateKart(k,dt){
 const racing=G.state==='race'&&!k.finished;
 let steer=0, accel=false, brake=false, drift=false, nitro=false, spray=false;
 if(!k.ai){
  const left=inp.left||K.ArrowLeft||K.KeyA, right=inp.right||K.ArrowRight||K.KeyD;
  steer=(left?1:0)-(right?1:0);
  accel=!k.finished;
  spray=!!(inp.spray||K.ArrowUp||K.KeyW);
  brake=!!(inp.brake||K.ArrowDown||K.KeyS);
  drift=!!(inp.drift||K.ShiftLeft||K.ShiftRight);
  nitro=!!(inp.nitro||K.Space||K.KeyN);
 } else {
  k.aiT+=dt; const look=Math.floor(k.idx+6+k.speed*0.12)%N; const ahead=trackPos(look,k.aiLat,tmpV); if(Math.random()<0.004)k.aiLat=(Math.random()-0.5)*(W-7);
  const dx=ahead.x-k.pos.x,dz=ahead.z-k.pos.z; const want=Math.atan2(-dx,-dz); let d=want-k.yaw; d=Math.atan2(Math.sin(d),Math.cos(d)); steer=clamp(d*3.2,-1,1);
  const gap=(player.prog-k.prog)/N*T.len; const rb=clamp(1+gap*0.0018,0.86,1.16); let c=0; for(let q=4;q<=28;q+=4)c=Math.max(c,Math.abs(curv[Math.floor(k.idx+q)%N]||0));
  const target=MAXS*k.skill*rb*(1-clamp(Math.abs(c)*12,0,0.42)); accel=k.speed<target; brake=k.speed>target+8;
  drift=Math.abs(c)>0.018&&k.speed>18&&Math.abs(d)>0.18; if(drift) steer=Math.sign(d)||steer||1;
  if(racing&&k.bottles>0&&Math.abs(c)<0.008&&Math.random()<0.02) nitro=true;
  if(!drift&&k.sprayWindow>0&&k.smallT<=0&&Math.random()<0.35*k.skill) spray=true;
  if(k.finished) accel=false;
  if(racing){ k.aiItemT-=dt; if(k.item&&k.aiItemT<0){ useItem(k); k.aiItemT=3+Math.random()*6; } }
 }
 if(G.state==='count'&&k.ai){ accel=false; drift=false; nitro=false; brake=false; }
 if(k.spin>0){ k.spin-=dt; steer=0; accel=false; drift=false; nitro=false; brake=true; k.m.userData.body.rotation.y+=dt*14; }
 else k.m.userData.body.rotation.y*=0.8;
 const frozen=G.state==='count';
 const hold=frozen?{x:k.x,y:k.y,z:k.z,yaw:k.yaw,vyaw:k.vyaw,idx:k.idx,lat:k.lat}:null;
 if(k.pos){ k.x=k.pos.x; k.z=k.pos.z; }
 const go=!!k.goPulse; k.goPulse=false;
 const ev=QQ.stepKart(k,{steer:steer,accel:accel,brake:brake,drift:drift,nitro:nitro,spray:spray,go:go},T.sim,dt);
 if(frozen){ k.speed=0; k.x=hold.x; k.y=hold.y; k.z=hold.z; k.yaw=hold.yaw; k.vyaw=hold.vyaw; k.idx=hold.idx; k.lat=hold.lat; k.drift=false; k.airborne=false; k.vy=0; }
 k.pos.set(k.x,k.y,k.z);
 if(!frozen) noteLap(k);
 if(!k.ai){
  if(ev.bottle){ Audio.charge(); flash('氮气 +1'); }
  if(ev.double){ Audio.jet(); flash('双喷!'); }
  else if(ev.spray){ Audio.jet(); flash('小喷!'); }
  if(ev.nitro){ Audio.whoosh(); flash('氮气加速!'); }
  if(ev.start){ Audio.jet(); flash('起步喷!'); }
  if(ev.land){ Audio.jet(); flash('落地喷!'); }
  if(ev.wall){ Audio.crash(); shake=0.28; }
  if(ev.pad) Audio.jet();
 }
 const bi=Math.floor(((k.idx%N)+N)%N), a=bi;
 const offroad=Math.abs(k.lat)>HW+0.5;
 const fw=tmpV2.set(-Math.sin(k.vyaw),0,-Math.cos(k.vyaw));
 if(ev.wall){ const s=Math.sign(k.lat)||1; for(let i=0;i<6;i++)sparks.emit(k.pos.x+SD[bi].x*s*1.2,k.pos.y+0.5,k.pos.z+SD[bi].z*s*1.2,(Math.random()-0.5)*8,Math.random()*5,(Math.random()-0.5)*8,1,0.8,0.3,0.4); }
 for(const b of T.boxes){ if(b.t>0)continue; const dx=b.m.position.x-k.pos.x,dz=b.m.position.z-k.pos.z; if(dx*dx+dz*dz<5){ b.t=3; b.m.visible=false; if(!k.item&&racing){ const r=Math.random(); k.item=r<0.4?'missile':r<0.7?'banana':'shield'; if(!k.ai){Audio.pickup(); updItem();} } else if(!k.ai)Audio.pickup();
    for(let i=0;i<20;i++)sparks.emit(b.m.position.x,b.m.position.y,b.m.position.z,(Math.random()-0.5)*10,Math.random()*8,(Math.random()-0.5)*10,1,0.5,1,0.6); } }
 if(k.shield>0)k.shield-=dt;
 // model
 const m=k.m, ud=m.userData; poseKart(k,dt);
 ud.body.rotation.z=lerp(ud.body.rotation.z,-k.steer*0.04*k.speed/MAXS+(k.drift?k.driftDir*0.06:0),dt*6); ud.body.rotation.x=lerp(ud.body.rotation.x,(k.nitroT>0?-0.05:0)+(brake?0.03:0),dt*5);
 k.wspin+=k.speed*dt/0.48; ud.wheels.forEach(w=>w.rotation.x=-k.wspin); ud.steer.forEach(s=>s.rotation.y=k.steer*0.45+(k.drift?-k.driftDir*0.3:0)); ud.sw.rotation.z=k.steer*1.2;
 const bo=k.nitroT>0, jetOn=k.smallT>0||k.startT>0||k.landT>0||k.padT>0, fl=bo?1.6+Math.random()*0.8:jetOn?1.0+Math.random()*0.4:0.25+Math.random()*0.15*(accel?1:0);
 ud.flames.forEach(f=>{ f.scale.set(1,fl,1); }); ud.fm.color.set(bo?'#7ad7ff':jetOn?'#ffd040':'#ff7a30');
 ud.shield.visible=k.shield>0; if(k.shield>0)ud.shield.rotation.y+=dt*2;
 // fx
 const rear=tmpV.set(Math.sin(k.yaw)*2.3,0.8,Math.cos(k.yaw)*2.3).add(k.pos);
 if(bo||jetOn){ for(let i=0;i<(quality==='low'?1:3);i++)sparks.emit(rear.x+(Math.random()-0.5)*0.6,rear.y,rear.z+(Math.random()-0.5)*0.6,(Math.random()-0.5)*2,Math.random()*1.5,(Math.random()-0.5)*2,bo?0.3:1,bo?0.7:0.7,bo?1:0.2,0.35); }
 const side=SD[bi];
 for(let w=0;w<2;w++){ const sx=w?1.2:-1.2; const wp=new THREE.Vector3(Math.cos(k.yaw)*sx+Math.sin(k.yaw)*1.35,0,-Math.sin(k.yaw)*sx+Math.cos(k.yaw)*1.35).add(k.pos);
   if(k.drift&&k.speed>10){ if(k.lastW[w]&&(k.ai?k.idx%1<0.5:true))skids.add(k.lastW[w],wp,side); k.lastW[w]=wp;
     const ch=k.driftT>0.45; if(Math.random()<(k.ai?0.3:0.9)){ sparks.emit(wp.x,wp.y+0.2,wp.z,(Math.random()-0.5)*5-fw.x*4,Math.random()*4+1,(Math.random()-0.5)*5-fw.z*4,1,ch?0.85:0.55,ch?0.3:0.1,0.4); smoke.emit(wp.x,wp.y+0.3,wp.z,(Math.random()-0.5)*2,1.5,(Math.random()-0.5)*2,0.8,0.8,0.82,0.8);} }
   else k.lastW[w]=null; }
 if(offroad&&k.speed>10&&Math.random()<0.4)smoke.emit(k.pos.x,k.pos.y+0.3,k.pos.z,0,1,0,0.7,0.65,0.55,0.6);
}
function poseKart(k,dt,snap){ const m=k.m, n=N, fi=((k.idx%n)+n)%n, a=Math.floor(fi), f=fi-a, b2=(a+1)%n, sp=T.sim.spacing||2.5;
 // 与 QQ.groundAt 同源：插值倾角 + 前后 4 点中心差分坡度，再做阻尼，车身不跟着采样点抖
 const bank=lerp(BK[a],BK[b2],f); const yA=QQ.groundAt(T.sim,{idx:fi-2,lat:k.lat||0}).y, yB=QQ.groundAt(T.sim,{idx:fi+2,lat:k.lat||0}).y;
 const tYaw=Math.atan2(-TG[a].x,-TG[a].z), rel=angDiff(k.yaw,tYaw);
 let pitch=Math.atan2(yB-yA,4*sp)*Math.cos(rel), roll=-bank*Math.cos(rel)+Math.atan2(yB-yA,4*sp)*Math.sin(rel)*0;
 if(k.airborne){ pitch=clamp((k.vy||0)*0.02,-0.25,0.25); }
 const t=snap?1:clamp(dt*(k.airborne?3:9),0,1); k.pitchS=k.pitchS==null?pitch:lerp(k.pitchS,pitch,t); k.rollS=k.rollS==null?roll:lerp(k.rollS,roll,t);
 m.position.copy(k.pos); m.rotation.set(k.pitchS,k.yaw,k.rollS,'YXZ'); }
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
 $('nbar').style.width=(Math.max(0,Math.min(1,p.gauge||0))*100)+'%'; $('n1').classList.toggle('on',p.bottles>=1); $('n2').classList.toggle('on',p.bottles>=2); $('bN').classList.toggle('has',p.bottles>0); $('bW').classList.toggle('on',!!(inp.spray||K.ArrowUp||K.KeyW));
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
 if(G.state==='roam'){ roamFrame(dt); return; }
 if(G.state==='menu'){ if(G.menuKart){ const t=performance.now()/1000, k=G.menuKart; camera.position.set(k.position.x+Math.sin(t*0.3)*10,k.position.y+3.8,k.position.z+Math.cos(t*0.3)*9); camera.lookAt(k.position.x,k.position.y+1,k.position.z); k.userData.flames.forEach(f=>f.scale.y=0.3+Math.random()*0.2);
   T.sun.position.copy(k.position).addScaledVector(T.sunDir,100); T.sun.target.position.copy(k.position); T.sky.position.copy(camera.position); renderer.render(scene,camera);} return; }
 if(G.state==='paused'){ return; }
 if(G.state==='count'){ const prev=Math.ceil(G.count); G.count-=dt; const c=Math.ceil(G.count); if(c!==prev&&c<=3&&c>=1){ Audio.beep(false); $('count').textContent=c; $('count').className='pop'; }
   if(G.count<=0){ G.state='race'; G.raceT=0; karts.forEach(k=>k.lapStart=0); player.goPulse=true; $('count').textContent='GO!'; $('count').className='pop go'; Audio.beep(true); setTimeout(()=>$('count').className='',900);} }
 if(G.state==='race'||G.state==='results'||G.state==='count'){ if(G.state==='race')G.raceT+=dt; karts.forEach(k=>updateKart(k,dt)); kartCollisions(); updateItems(dt); sparks.update(dt,9); smoke.update(dt,-1.5); }
 if(G.state==='race'&&G.resultT>0){ G.resultT-=dt; if(G.resultT<=0)showResults(); }
 // camera
 const p=player, fw=new THREE.Vector3(-Math.sin(p.yaw),0,-Math.cos(p.yaw)); const boost=p.nitroT>0?1:(p.smallT>0||p.startT>0||p.landT>0)?0.5:0;
 const camYaw=lerpAngle(p.yaw,p.vyaw,0.4); const back=8.2+boost*1.3, up=3.6;
 const tgt=new THREE.Vector3(p.pos.x+Math.sin(camYaw)*back,p.pos.y+up,p.pos.z+Math.cos(camYaw)*back);
 camPos.lerp(tgt,clamp(dt*(G.raceT<0.1&&G.state==='count'&&G.count>3.9?60:8),0,1)); if(camPos.lengthSq()===0)camPos.copy(tgt);
 camLook.copy(p.pos).addScaledVector(fw,5); camLook.y+=1.6; camera.position.copy(camPos);
 if(shake>0){ shake-=dt; camera.position.x+=(Math.random()-0.5)*shake*1.5; camera.position.y+=(Math.random()-0.5)*shake; }
 camera.lookAt(camLook); camera.fov=lerp(camera.fov,70+clamp(p.speed/QQ.BASE_TOP,0,1.4)*7+boost*8,dt*4); camera.updateProjectionMatrix();
 T.sun.position.copy(p.pos).addScaledVector(T.sunDir,120); T.sun.target.position.copy(p.pos).addScaledVector(fw,15); T.sky.position.copy(camera.position);
 if(T.snow){ const a=T.snow.geometry.attributes.position.array; for(let i=0;i<a.length;i+=3){ a[i+1]-=dt*4; a[i]+=Math.sin(i+performance.now()/900)*dt; if(a[i+1]<p.pos.y-5)a[i+1]+=50; } T.snow.position.set(Math.round(p.pos.x/120)*0,0,0); T.snow.geometry.attributes.position.needsUpdate=true;
   for(let i=0;i<a.length;i+=3){ if(a[i]-p.pos.x>60)a[i]-=120; else if(a[i]-p.pos.x<-60)a[i]+=120; if(a[i+2]-p.pos.z>60)a[i+2]-=120; else if(a[i+2]-p.pos.z<-60)a[i+2]+=120; } }
 Audio.engine(p.speed,G.state!=='menu',p.drift&&p.speed>10,p.nitroT>0||p.smallT>0);
 drawSpeedLines(p.nitroT>0?1:(p.smallT>0||p.startT>0||p.landT>0)?0.5:0); hud(); drawMinimap(); renderer.render(scene,camera);
}
// ================= BOOT =================
onResize(); applyQuality();
if(Q.get('auto')){ G.track=+(Q.get('track')||0); newRace(); G.count=0.01; } else showMenu();
frame();
if(Q.get('auto')){ player.ai=true; player.skill=1.05; }

// ===== debug free-roam fly-through: ?roam=1&track=N  (R key toggles in race) =====
function roamPose(f){ const i=((f%N)+N)%N, a=Math.floor(i); const p=trackPos(i,0,new THREE.Vector3()), q=trackPos(i+10,0,new THREE.Vector3());
 camera.position.set(p.x,p.y+(G.roamH||4),p.z); camera.lookAt(q.x,q.y+2,q.z); camera.fov=70; camera.updateProjectionMatrix();
 if(player){ const k=player; const g=QQ.groundAt(T.sim,{idx:i+6,lat:0}); const pp=trackPos(i+6,0,new THREE.Vector3()); k.x=pp.x;k.z=pp.z;k.y=g.y;k.idx=(i+6)%N;k.lat=0;k.yaw=k.vyaw=Math.atan2(-TG[(a+6)%N].x,-TG[(a+6)%N].z); k.pos.set(k.x,k.y,k.z); poseKart(k,1/60,true); }
 T.sun.position.copy(camera.position).addScaledVector(T.sunDir,120); T.sun.target.position.copy(camera.position); T.sky.position.copy(camera.position); }
function roamFrame(dt){ if(!G.roamManual)G.roamIdx=(G.roamIdx||0)+dt*14; roamPose(G.roamIdx); renderer.render(scene,camera); }
window.roamTo=function(f){ G.roamManual=true; G.roamIdx=f; roamPose(f); renderer.render(scene,camera); };
window.roamLog=function(){ const out=[]; for(let i=0;i<N;i++){ const p=T.sim.pts[i]; const a=P[(i-1+N)%N],b=P[i],c=P[(i+1)%N]; const h=T.sim.spacing;
  const nrm=new THREE.Vector3(0,1,0).applyAxisAngle(TG[i].clone().normalize(),-BK[i]); out.push({i,y:+b.y.toFixed(3),d2:+((a.y-2*b.y+c.y)/(h*h)).toFixed(4),bank:+BK[i].toFixed(3),n:[+nrm.x.toFixed(3),+nrm.y.toFixed(3),+nrm.z.toFixed(3)],gap:!!p.gap,lip:!!p.lip}); } return out; };
addEventListener('keydown',e=>{ if(e.code==='KeyR'&&G.state==='race'){ G.state='roam'; G.roamIdx=player.idx; } else if(e.code==='KeyR'&&G.state==='roam'){ G.state='race'; } });
if(Q.get('roam')){ G.track=+(Q.get('track')||0); newRace(); G.state='roam'; G.roamIdx=0; $('hud').style.display='none'; }

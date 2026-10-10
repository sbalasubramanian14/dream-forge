import * as THREE from 'three';
import { OrbitControls } from '/OrbitControls.js';
import { randomGenerator, shapePoint } from '/geometry.js';

const $ = id => document.getElementById(id);
const viewport=$('viewport'), labelLayer=$('labels');
const error = message => {$('error').hidden=false; $('error').textContent=message;};
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
let paused = reduced, current, revision=-1, targetCamera=null, targetLook=null;
const camera = new THREE.PerspectiveCamera(48,innerWidth/innerHeight,.1,1000);
camera.position.set(0,3,19);
const scene=new THREE.Scene(); scene.fog=new THREE.FogExp2('#03070e',.012);
let renderer;
try {renderer=new THREE.WebGLRenderer({antialias:true,alpha:false});}
catch {error('WebGL is unavailable. Enable hardware acceleration or try another browser.'); throw new Error('WebGL unavailable');}
renderer.setPixelRatio(Math.min(devicePixelRatio,2)); renderer.setSize(innerWidth,innerHeight); renderer.setClearColor('#03070e'); viewport.prepend(renderer.domElement);
const controls=new OrbitControls(camera,renderer.domElement); controls.enableDamping=true; controls.dampingFactor=.06; controls.minDistance=2; controls.maxDistance=180;
controls.addEventListener('start',()=>{targetCamera=null;targetLook=null;});
const count=24000, random=randomGenerator(), positions=new Float32Array(count*3), targets=new Float32Array(count*3), colors=new Float32Array(count*3), desiredColors=new Float32Array(count*3), idle=new Float32Array(count*3);
for(let i=0;i<count;i++) {const j=i*3; idle[j]=(random()-.5)*25;idle[j+1]=(random()-.5)*15;idle[j+2]=(random()-.5)*16;positions.set(idle.subarray(j,j+3),j);targets.set(idle.subarray(j,j+3),j);colors.set([.16,.38,.48],j);desiredColors.set([.16,.38,.48],j);}
const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));
const dotCanvas=document.createElement('canvas');dotCanvas.width=64;dotCanvas.height=64;const ctx=dotCanvas.getContext('2d');const glow=ctx.createRadialGradient(32,32,0,32,32,32);glow.addColorStop(0,'rgba(255,255,255,1)');glow.addColorStop(.15,'rgba(255,255,255,.95)');glow.addColorStop(.4,'rgba(255,255,255,.22)');glow.addColorStop(1,'rgba(255,255,255,0)');ctx.fillStyle=glow;ctx.fillRect(0,0,64,64);
const texture=new THREE.CanvasTexture(dotCanvas);
const material=new THREE.PointsMaterial({size:.105,map:texture,vertexColors:true,transparent:true,opacity:.85,blending:THREE.AdditiveBlending,depthWrite:false});
const cloud=new THREE.Points(geometry,material);cloud.frustumCulled=false;scene.add(cloud);
let labels=[], edges=[], flows=[];
const flowGroup=new THREE.Group();scene.add(flowGroup);
async function send(path,body) {try {const response=await fetch(`/api/${path}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const result=await response.json();if(!response.ok)throw new Error(result.error);$('error').hidden=true;return result;}catch(e){error(e.message);}}
function focus(id) {send('focus',{id});}
function updateProjection() {
  camera.aspect=innerWidth/innerHeight;
  const captionTop=document.querySelector('.caption').getBoundingClientRect().top;
  const centerY=(110+captionTop)/2;
  camera.setViewOffset(innerWidth,innerHeight,0,Math.max(0,innerHeight/2-centerY),innerWidth,innerHeight);
  camera.updateProjectionMatrix();
}
function frame(id=null) {
  const objects=current?.objects || [];
  const selected=id?objects.filter(o=>o.id===id):objects;
  const bounds=new THREE.Box3();
  for(const o of selected) {const radius=o.scale*(o.shape==='helix'?2.3:1.8);const v=new THREE.Vector3(...o.position);bounds.expandByPoint(v.clone().addScalar(radius));bounds.expandByPoint(v.clone().addScalar(-radius));}
  const center=selected.length?bounds.getCenter(new THREE.Vector3()):new THREE.Vector3();
  const size=selected.length?bounds.getSize(new THREE.Vector3()):new THREE.Vector3(12,8,10);
  const distance=Math.max(7,Math.max(size.y,size.x/camera.aspect)/ (2*Math.tan(THREE.MathUtils.degToRad(24)))*1.5+size.z/2);
  targetLook=center; targetCamera=center.clone().add(new THREE.Vector3(0,distance*.14,distance));
  if(paused) {camera.position.copy(targetCamera);controls.target.copy(center);targetCamera=null;targetLook=null;}
  const o=objects.find(o=>o.id===id);$('detail').hidden=!o;
  if(o) {$('detail-title').textContent=o.label||o.id;$('detail-body').textContent=o.description||'No additional description provided.';}
}
function apply(state) {
  if(state.revision===revision)return;
  revision=state.revision;
  const changed=JSON.stringify(state.scene)!==JSON.stringify(current);
  current=state.scene;
  $('title').textContent=current.title;$('explanation').textContent=current.explanation;
  if(changed) {
    labelLayer.replaceChildren();labels=[];edges=[];
    for(const flow of flows) {flow.geometry.dispose();flow.material.dispose();}flows=[];flowGroup.clear();
    targets.set(idle);for(let i=0;i<count;i++)desiredColors.set([.16,.38,.48],i*3);
    const per=current.objects.length?Math.floor(count*.85/current.objects.length):0;
    current.objects.forEach((o,objectIndex)=>{
      let seed=0;for(const c of o.id)seed=(seed*31+c.charCodeAt(0))|0;
      const rng=randomGenerator(seed), color=new THREE.Color(o.color);
      for(let i=0;i<per;i++) {const j=(objectIndex*per+i)*3,p=shapePoint(o.shape,i,rng);for(let k=0;k<3;k++)targets[j+k]=p[k]*o.scale+o.position[k];const brightness=.55+rng()*.65;desiredColors.set([color.r*brightness,color.g*brightness,color.b*brightness],j);}
      const element=document.createElement('button');element.className='label';element.textContent=o.label||o.id;element.addEventListener('click',()=>focus(o.id));labelLayer.append(element);labels.push({element,point:new THREE.Vector3(o.position[0],o.position[1]-(o.shape==='helix'?2.2:1.8)*o.scale,o.position[2])});
    });
    for(const connection of current.connections) {
      const a=current.objects.find(o=>o.id===connection.from),b=current.objects.find(o=>o.id===connection.to);
      const start=new THREE.Vector3(...a.position),end=new THREE.Vector3(...b.position),middle=start.clone().lerp(end,.5);middle.y+=1.6;
      const curve=new THREE.QuadraticBezierCurve3(start,middle,end);
      const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(new Float32Array(100*3),3));
      const points=new THREE.Points(g,new THREE.PointsMaterial({color:'#70e0ed',size:.13,map:texture,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false}));points.userData.curve=curve;points.frustumCulled=false;flowGroup.add(points);flows.push(points);
      const element=document.createElement('span');element.className='edge-label';element.textContent=connection.label;labelLayer.append(element);edges.push({element,point:curve.getPoint(.5)});
    }
    document.querySelectorAll('[data-demo]').forEach(b=>b.classList.toggle('active',({portal:'An idea takes shape',architecture:'Follow a request',helix:'Two paths, intertwined'})[b.dataset.demo]===current.title));
    if(paused) {positions.set(targets);colors.set(desiredColors);geometry.attributes.position.needsUpdate=true;geometry.attributes.color.needsUpdate=true;}
  }
  updateProjection();frame(state.focus);
}
const events=new EventSource('/api/events');events.onopen=()=>{$('connection').textContent='Canvas connected';$('connection').className='live';$('error').hidden=true;};events.onerror=()=>{$('connection').textContent='Reconnecting…';$('connection').className='';};events.onmessage=event=>{try{apply(JSON.parse(event.data));}catch(e){error(`Unable to display scene: ${e.message}`);}};
const demos={
 portal:{title:'An idea takes shape',explanation:'A doorway assembled from light. Drag to explore the arch, or let an agent reshape this space.',objects:[{id:'portal',shape:'arch',label:'The doorway',description:'A procedural particle arch inspired by the original visual reference.',scale:2.4}]},
 architecture:{title:'Follow a request',explanation:'A browser sends a request to the API. The API queries the database. Follow the moving light between each construct.',objects:[{id:'browser',shape:'box',label:'Browser',description:'The interface sends a request.',position:[-5,0,0],scale:1.2},{id:'api',shape:'sphere',label:'API',description:'The server applies business logic.',scale:1.2},{id:'database',shape:'cylinder',label:'Database',description:'Persistent storage queried by the API.',position:[5,0,0],scale:1.2}],connections:[{from:'browser',to:'api',label:'request'},{from:'api',to:'database',label:'query'}]},
 helix:{title:'Two paths, intertwined',explanation:'A stylized double helix. Rotate to explore the structure. An illustrative construct, rather than a molecular simulation.',objects:[{id:'helix',shape:'helix',label:'Double helix',description:'Two spiraling strands joined by rungs.',scale:1.8}]}
};
document.querySelectorAll('[data-demo]').forEach(button=>button.addEventListener('click',()=>send('scene',demos[button.dataset.demo])));
$('reset').onclick=()=>send('clear',{});$('frame').onclick=()=>focus(null);$('close-detail').onclick=()=>focus(null);
function motionButton() {$('motion').textContent=paused?'Resume motion':'Pause motion';$('motion').setAttribute('aria-pressed',String(paused));}
$('motion').onclick=()=>{paused=!paused;motionButton();};motionButton();
addEventListener('resize',()=>{updateProjection();renderer.setSize(innerWidth,innerHeight);});
let last=performance.now(),elapsed=0;
function animate(now) {
  requestAnimationFrame(animate);const dt=Math.min((now-last)/1000,.05);last=now;
  if(!paused) {
    elapsed+=dt;const blend=1-Math.exp(-dt*2.8);
    for(let i=0;i<count;i++) {const j=i*3;for(let k=0;k<3;k++){const drift=current?.objects.length?0:Math.sin(elapsed*.2+i*.02+k)*.18;positions[j+k]+=(targets[j+k]+drift-positions[j+k])*blend;colors[j+k]+=(desiredColors[j+k]-colors[j+k])*blend;}}
    geometry.attributes.position.needsUpdate=true;geometry.attributes.color.needsUpdate=true;
  }
  for(const flow of flows) {const p=flow.geometry.attributes.position;for(let i=0;i<p.count;i++){const t=((i%25)/25*.12+Math.floor(i/25)*.25+elapsed*.22)%1;const v=flow.userData.curve.getPoint(t);p.setXYZ(i,v.x,v.y,v.z);}p.needsUpdate=true;}
  if(targetCamera) {camera.position.lerp(targetCamera,1-Math.exp(-dt*4));controls.target.lerp(targetLook,1-Math.exp(-dt*4));if(camera.position.distanceTo(targetCamera)<.01){targetCamera=null;targetLook=null;}}
  controls.update();
  for(const item of [...labels,...edges]) {const v=item.point.clone().project(camera);item.element.style.left=`${(v.x*.5+.5)*innerWidth}px`;item.element.style.top=`${(-v.y*.5+.5)*innerHeight}px`;item.element.hidden=v.z>1||v.z< -1;}
  renderer.render(scene,camera);
}
requestAnimationFrame(animate);

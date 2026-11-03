// Lingkungan lab 3D, model perangkat, kabel (TubeGeometry), picking & drag. Semua data dari Sim.
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
export const DESK_Y=1.08, LIM_X=5, LIM_Z=2.5, AR_SCALE=0.3;
const clamp=(v,m)=>Math.max(-m,Math.min(m,v));
const disp=o=>o.traverse(n=>{n.geometry?.dispose();const m=n.material;(Array.isArray(m)?m:m?[m]:[]).forEach(x=>{x.map?.dispose();x.dispose();});});
const mk=(w,h,d,c,x,y,z,p)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),new THREE.MeshStandardMaterial({color:c,roughness:.65,metalness:.1}));m.position.set(x,y,z);p.add(m);return m;};

export class Lab{
  constructor(el,sim,hooks){
    Object.assign(this,{el,sim,hooks,mode:'select',cableType:'straight',sel:null,pending:null,snap:true,arOn:false,drag:null,xrHook:null});
    this.gmap=new Map();this.cmap=new Map();this.pmap=new Map();
    const r=this.r=new THREE.WebGLRenderer({antialias:true,alpha:true});r.setPixelRatio(Math.min(devicePixelRatio,2));el.appendChild(r.domElement);
    this.scene=new THREE.Scene();this.scene.background=new THREE.Color(0x0b1226);
    this.cam=new THREE.PerspectiveCamera(55,1,.05,200);
    this.world=new THREE.Group();this.env=new THREE.Group();this.devRoot=new THREE.Group();this.items=new THREE.Group();
    this.world.add(this.env,this.devRoot);this.devRoot.add(this.items);this.scene.add(this.world);
    this.scene.add(new THREE.HemisphereLight(0xcfe8ff,0x1e293b,2.2));const dl=new THREE.DirectionalLight(0xffffff,2);dl.position.set(5,10,7);this.scene.add(dl);
    this.buildEnv();
    this.selRing=new THREE.Mesh(new THREE.RingGeometry(1.1,1.25,40).rotateX(-Math.PI/2),new THREE.MeshBasicMaterial({color:0xfacc15,side:2}));this.selRing.visible=false;this.devRoot.add(this.selRing);
    this.prev=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),new THREE.Vector3()]),new THREE.LineBasicMaterial({color:0xfacc15}));this.prev.visible=false;this.prev.raycast=()=>{};this.devRoot.add(this.prev);
    const g=[];for(let x=-5.5;x<=5.5;x+=.5)g.push(x,0,-3,x,0,3);for(let z=-3;z<=3;z+=.5)g.push(-5.5,0,z,5.5,0,z);
    this.grid=new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(g,3)),new THREE.LineBasicMaterial({color:0x22d3ee,transparent:true,opacity:.25}));
    this.grid.position.y=DESK_Y+.01;this.grid.visible=false;this.grid.raycast=()=>{};this.devRoot.add(this.grid);
    this.controls=new OrbitControls(this.cam,r.domElement);this.controls.enableDamping=true;this.controls.maxPolarAngle=1.52;this.resetView();
    this.ray=new THREE.Raycaster();this.plane=new THREE.Plane(new THREE.Vector3(0,1,0),-DESK_Y);
    this.bind();new ResizeObserver(()=>this.resize()).observe(el);this.resize();
    sim.on((t,id)=>{if(t==='change')this.sync();else if(t==='move')this.place(id);});
    this.sync();r.setAnimationLoop((t,f)=>this.frame(t,f));
  }
  resetView(){this.cam.position.set(9,8,11);this.controls.target.set(0,1,0);this.cam.lookAt(0,1,0);}
  resize(){const w=this.el.clientWidth||innerWidth,h=this.el.clientHeight||innerHeight;this.r.setSize(w,h);this.cam.aspect=w/h;this.cam.updateProjectionMatrix();}
  frame(t,f){this.xrHook?.(t,f);if(this.controls.enabled)this.controls.update();this.r.render(this.scene,this.cam);}
  buildEnv(){
    const e=this.env;mk(14,.3,12,0x1f2a44,0,-.15,0,e);mk(14,4.5,.2,0x2b3a5c,0,2.2,-6,e);mk(.2,4.5,12,0x25324f,-7,2.2,0,e);
    mk(5,1.4,.08,0x0f2a3a,0,2.7,-5.88,e);mk(5.2,.08,.1,0x22d3ee,0,3.45,-5.85,e);
    mk(11.2,.16,6,0xcbd5e1,0,DESK_Y-.08,0,e);
    for(const [x,z] of [[-5.3,-2.8],[5.3,-2.8],[-5.3,2.8],[5.3,2.8]])mk(.15,DESK_Y-.16,.15,0x64748b,x,(DESK_Y-.16)/2,z,e);
    for(const x of [-3.5,-1.2,1.2,3.5]){mk(.8,.1,.8,0x334155,x,.55,4.2,e);mk(.8,.7,.1,0x334155,x,.95,4.6,e);mk(.1,.5,.1,0x64748b,x,.28,4.2,e);}
    mk(1.2,3,1,0x111827,6.2,1.5,-4.5,e);for(let i=0;i<8;i++)mk(.9,.05,.02,i%3?0x22d3ee:0x22c55e,6.2,.5+i*.3,-3.98,e);
  }
  // ---- model perangkat ----
  buildDevice(d){
    const g=new THREE.Group(),t=d.type,on=d.power;g.userData.dev=d.id;
    const port=(i,x,y,z)=>{const m=mk(.16,.16,.06,0x94a3b8,x,y,z,g);m.material=new THREE.MeshStandardMaterial({color:0x94a3b8});m.userData.port={d:d.id,p:d.ports[i].id};this.pmap.set(d.id+':'+d.ports[i].id,m);};
    let ly=1.6;
    if(t==='pc'){mk(.5,.04,.35,0x475569,0,.02,-.2,g);mk(.1,.4,.1,0x475569,0,.22,-.2,g);mk(1.1,.7,.08,0x0f172a,0,.8,-.2,g);mk(.96,.56,.02,on?0x38bdf8:0x111827,0,.8,-.155,g);
      mk(.9,.04,.3,0x94a3b8,0,.02,.35,g);mk(.12,.04,.2,0x94a3b8,.7,.02,.35,g);mk(.4,.85,.6,0x1e293b,1.05,.43,-.1,g);port(0,1.05,.5,.21);}
    if(t==='switch'){mk(2.2,.28,.8,0x1e3a5f,0,.14,0,g);d.ports.forEach((_,i)=>port(i,-.9+i*.257,.14,.41));ly=.8;}
    if(t==='router'){mk(1.5,.3,.8,0x7c2d12,0,.15,0,g);mk(.05,.5,.05,0x111827,-.55,.55,-.2,g);mk(.05,.5,.05,0x111827,.55,.55,-.2,g);d.ports.forEach((_,i)=>port(i,-.5+i*.33,.15,.41));ly=1.1;}
    if(t==='ap'){const c=new THREE.Mesh(new THREE.CylinderGeometry(.55,.55,.18,24),new THREE.MeshStandardMaterial({color:0x0e7490}));c.position.y=.09;g.add(c);mk(.06,.5,.06,0x111827,0,.4,-.1,g);port(0,0,.09,.56);ly=1;}
    if(t==='server'){mk(.9,1.5,1,0x334155,0,.75,0,g);for(let i=0;i<4;i++)mk(.7,.06,.02,on?0x22d3ee:0x1e293b,0,.8+i*.15,.51,g);port(0,0,.3,.52);ly=1.9;}
    const cv=document.createElement('canvas');cv.width=256;cv.height=64;const x=cv.getContext('2d');x.fillStyle='rgba(11,18,38,.85)';x.fillRect(0,0,256,64);x.strokeStyle=on?'#22d3ee':'#ef4444';x.strokeRect(1,1,254,62);
    x.fillStyle='#fff';x.font='bold 30px Arial';x.textAlign='center';x.fillText(d.name+(on?'':' (OFF)'),128,42);
    const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(cv)}));sp.scale.set(1.6,.4,1);sp.position.set(t==='pc'?.5:0,ly,0);g.add(sp);
    g.position.set(d.x,DESK_Y,d.z);g.rotation.y=d.rot;return g;
  }
  lp(m){const v=new THREE.Vector3();m.getWorldPosition(v);return this.devRoot.worldToLocal(v);}
  cable(c){
    const old=this.cmap.get(c.id);if(old){this.items.remove(old);disp(old);}
    const pa=this.pmap.get(c.a.d+':'+c.a.p),pb=this.pmap.get(c.b.d+':'+c.b.p);if(!pa||!pb)return;
    const A=this.lp(pa),B=this.lp(pb),oa=new THREE.Vector3(0,0,1).applyQuaternion(this.gmap.get(c.a.d).quaternion),ob=new THREE.Vector3(0,0,1).applyQuaternion(this.gmap.get(c.b.d).quaternion);
    const M=A.clone().add(B).multiplyScalar(.5);M.y=DESK_Y+.04;
    const cu=new THREE.CatmullRomCurve3([A,A.clone().addScaledVector(oa,.5),M,B.clone().addScaledVector(ob,.5),B]);
    const g=new THREE.Group();g.userData.cable=c.id;
    const t=new THREE.Mesh(new THREE.TubeGeometry(cu,48,.04,6),new THREE.MeshStandardMaterial({color:c.type==='crossover'?0xfb923c:0x38bdf8,roughness:.5}));t.userData.cable=c.id;g.add(t);
    const up=this.sim.linkUp(c);for(const P of [A,B]){const s=new THREE.Mesh(new THREE.SphereGeometry(.075,10,8),new THREE.MeshBasicMaterial({color:up?0x22c55e:0xef4444}));s.position.copy(P);s.userData.cable=c.id;g.add(s);}
    this.items.add(g);this.cmap.set(c.id,g);
  }
  sync(){
    for(const c of [...this.items.children]){this.items.remove(c);disp(c);}
    this.gmap.clear();this.cmap.clear();this.pmap.clear();
    if(this.sel&&!this.sim.dev(this.sel))this.sel=null;
    for(const d of this.sim.devices){const g=this.buildDevice(d);this.gmap.set(d.id,g);this.items.add(g);}
    this.world.updateMatrixWorld(true);this.sim.cables.forEach(c=>this.cable(c));this.ring();this.refreshPorts();
  }
  place(id){const d=this.sim.dev(id),g=this.gmap.get(id);if(!g)return;g.position.set(d.x,DESK_Y,d.z);g.rotation.y=d.rot;this.world.updateMatrixWorld(true);
    this.sim.cables.filter(c=>c.a.d===id||c.b.d===id).forEach(c=>this.cable(c));this.ring();}
  ring(){const d=this.sim.dev(this.sel);this.selRing.visible=!!d;if(d)this.selRing.position.set(d.x,DESK_Y+.02,d.z);}
  refreshPorts(){
    for(const [k,m] of this.pmap){const [d,p]=k.split(':'),u=this.sim.cableAt(d,p);let c=0x94a3b8;
      if(u)c=this.sim.linkUp(u)?0x22c55e:0xef4444;
      if(this.pending){if(this.pending.d===d&&this.pending.p===p)c=0xfacc15;else if(!u)c=this.sim.canConnect(this.cableType,this.pending,{d,p}).ok?0x22d3ee:0xf87171;}
      m.material.color.setHex(c);m.material.emissive=new THREE.Color(c).multiplyScalar(.5);}
  }
  select(id){this.sel=id;this.ring();this.hooks.onSelect?.(id);}
  setMode(m){this.mode=m;this.pending=null;this.prev.visible=false;this.grid.visible=m==='move'&&!this.arOn;this.refreshPorts();this.hooks.onMode?.();}
  cancel(){this.pending=null;this.prev.visible=false;this.refreshPorts();this.hooks.onMode?.();}
  // ---- picking ----
  rayE(e){const b=this.r.domElement.getBoundingClientRect();this.ray.setFromCamera(new THREE.Vector2((e.clientX-b.left)/b.width*2-1,-(e.clientY-b.top)/b.height*2+1),this.cam);return this.ray;}
  pick(ray){
    for(const h of ray.intersectObjects(this.items.children,true))for(let o=h.object;o;o=o.parent){
      if(o.userData.port)return {k:'port',...o.userData.port};if(o.userData.cable)return {k:'cable',id:o.userData.cable};if(o.userData.dev)return {k:'device',d:o.userData.dev};}
    return null;
  }
  free(x,z,ig){return !this.sim.devices.some(d=>d.id!==ig&&Math.hypot(d.x-x,d.z-z)<1.5);}
  freeSpot(){for(let z=-1.5;z<=2;z+=1.5)for(let x=-4.5;x<=4.5;x+=1.5)if(this.free(x,z))return [x,z];return [0,0];}
  handle(h){
    const {sim}=this,T=(m,k)=>this.hooks.toast?.(m,k);
    if(h.k==='cable'){if(this.mode==='disconnect'){sim.disconnect(h.id);T('Kabel dilepas — link putus.','ok');}
      else{const c=sim.cables.find(x=>x.id===h.id);T(`Kabel ${c.type}: ${sim.pn(c.a)} ↔ ${sim.pn(c.b)} — link ${sim.linkUp(c)?'UP':'DOWN'}`,'info');}return;}
    if(h.k==='device'){if(this.mode==='connect')T('Klik salah satu PORT (kotak kecil) pada perangkat.','warn');this.select(h.d);return;}
    if(this.mode==='disconnect'){const c=sim.cableAt(h.d,h.p);if(c){sim.disconnect(c.id);T('Kabel dilepas — link putus.','ok');}else T('Port ini belum memakai kabel.','warn');return;}
    if(this.mode!=='connect'){this.select(h.d);return;}
    const P={d:h.d,p:h.p};
    if(!this.pending){if(sim.cableAt(P.d,P.p)){T(`Port ${sim.pn(P)} sudah dipakai. Lepas dulu dengan Disconnect Cable.`,'warn');return;}this.pending=P;this.refreshPorts();this.hooks.onMode?.();return;}
    if(this.pending.d===P.d&&this.pending.p===P.p){this.cancel();return;}
    const r=sim.connect(this.cableType,this.pending,P);
    if(r.ok){T(`Kabel ${this.cableType} terpasang: ${sim.pn(r.cable.a)} ↔ ${sim.pn(r.cable.b)}`,'ok');this.cancel();}
    else T(`${r.reason} ${r.fix}`,'bad');
  }
  bind(){
    const el=this.r.domElement;el.style.touchAction='none';
    el.addEventListener('pointerdown',e=>{this.down={x:e.clientX,y:e.clientY,t:performance.now()};
      if(this.mode==='move'&&!this.arOn){const h=this.pick(this.rayE(e));if(h&&(h.k==='device'||h.k==='port')){this.select(h.d);this.drag=h.d;this.controls.enabled=false;e.stopImmediatePropagation();}}},{capture:true});
    el.addEventListener('pointermove',e=>{
      if(this.drag){const p=this.planePt(e);if(p){let x=clamp(p.x,LIM_X),z=clamp(p.z,LIM_Z);if(this.snap){x=Math.round(x*2)/2;z=Math.round(z*2)/2;}if(this.free(x,z,this.drag))this.sim.moveDevice(this.drag,x,z);}}
      else if(this.pending&&!this.arOn){const p=this.planePt(e),a=this.lp(this.pmap.get(this.pending.d+':'+this.pending.p));if(p){p.y=DESK_Y+.1;this.prev.geometry.setFromPoints([a,p]);this.prev.visible=true;}}});
    const end=()=>{if(this.drag){this.drag=null;this.controls.enabled=!this.arOn;this.sim.emit('change');}};
    el.addEventListener('pointercancel',end);
    el.addEventListener('pointerup',e=>{if(this.drag){end();return;}const d=this.down;this.down=null;
      if(!d||Math.hypot(e.clientX-d.x,e.clientY-d.y)>6||performance.now()-d.t>500)return;
      const ray=this.rayE(e),h=this.pick(ray);if(h)this.handle(h);else this.hooks.empty?.(ray);});
  }
  planePt(e){const p=new THREE.Vector3();if(!this.rayE(e).ray.intersectPlane(this.plane,p))return null;return this.devRoot.worldToLocal(p);}
  // ---- mode AR: model & logika sama, hanya skala/lingkungan berbeda ----
  enterAR(){this.arOn=true;this.env.visible=false;this.scene.background=null;this.controls.enabled=false;this.drag=null;this.world.scale.setScalar(AR_SCALE);this.devRoot.position.y=-DESK_Y;this.world.visible=false;this.grid.visible=false;this.cancel();}
  exitAR(){this.arOn=false;this.env.visible=true;this.scene.background=new THREE.Color(0x0b1226);this.world.scale.setScalar(1);this.world.position.set(0,0,0);this.devRoot.position.y=0;this.world.visible=true;this.controls.enabled=true;this.cam.fov=55;this.cam.updateProjectionMatrix();this.resetView();this.setMode(this.mode);this.resize();}
}

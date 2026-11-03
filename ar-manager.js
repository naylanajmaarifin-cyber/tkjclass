// Mode AR. Dua pendekatan nyata:
//  A) WebXR immersive-ar + hit-test (Chrome Android/ARCore) – penempatan di permukaan nyata.
//  B) Fallback kamera: getUserMedia + sensor orientasi (3DoF). TANPA tracking permukaan/anchor – dinyatakan jujur di UI.
import * as THREE from 'three';
import {LIM_X,LIM_Z} from './scene.js';
const $=i=>document.getElementById(i),clamp=(v,m)=>Math.max(-m,Math.min(m,v));
const PLANE_Y=-0.6; // asumsi: bidang meja ±60 cm di bawah kamera (hanya untuk fallback kamera)
export class AR{
  constructor(lab,sim,ui){this.lab=lab;this.sim=sim;this.ui=ui;this.active=false;this.anchored=false;this.tool='select';this.rc=new THREE.Raycaster();this.bindUI();sim.on(()=>this.fill());}
  async check(){let xr=false;try{xr=!!(navigator.xr&&await navigator.xr.isSessionSupported('immersive-ar'));}catch{}
    return {secure:isSecureContext,cam:!!navigator.mediaDevices?.getUserMedia,xr};}
  status(t){$('arStatus').textContent=t;}
  async start(){
    const s=await this.check();
    if(!s.xr&&!s.cam){this.ui.toast('Browser ini tidak mendukung AR maupun kamera. Gunakan Mode 3D.','bad');return false;}
    if(!s.secure){this.ui.toast('Kamera/AR butuh HTTPS atau localhost (secure context).','bad');return false;}
    this.stopped=false;
    if(s.xr){try{await this.startXR();return true;}catch(e){console.warn('WebXR gagal',e);this.cleanup(true);this.ui.toast('WebXR gagal ('+(e.message||e.name)+'). Beralih ke AR kamera.','warn');}}
    if(s.cam)return this.startCam();
    return false;
  }
  begin(mode){this.mode=mode;this.active=true;this.anchored=false;this.sim.arActive=true;this.lab.enterAR();document.body.classList.add('ar');$('arOverlay').classList.add('on');
    this.lab.hooks.empty=r=>this.onTap(r,null);this.setTool($('arTool').value);this.fill();this.lab.resize();}
  async startXR(){
    const lab=this.lab,r=lab.r;r.xr.enabled=true;const ov=$('arOverlay');ov.classList.add('on');
    const ses=await navigator.xr.requestSession('immersive-ar',{requiredFeatures:['hit-test'],optionalFeatures:['dom-overlay'],domOverlay:{root:ov}});
    await r.xr.setSession(ses);this.ses=ses;this.begin('xr');
    this.reticle=new THREE.Mesh(new THREE.RingGeometry(.08,.1,32).rotateX(-Math.PI/2),new THREE.MeshBasicMaterial({color:0x22d3ee}));this.reticle.matrixAutoUpdate=false;this.reticle.visible=false;lab.scene.add(this.reticle);
    const vs=await ses.requestReferenceSpace('viewer');this.hit=await ses.requestHitTestSource({space:vs});
    const c=r.xr.getController(0);lab.scene.add(c);this.ctrl=c;const tm=new THREE.Matrix4();
    c.addEventListener('select',()=>{tm.identity().extractRotation(c.matrixWorld);this.rc.ray.origin.setFromMatrixPosition(c.matrixWorld);this.rc.ray.direction.set(0,0,-1).applyMatrix4(tm);
      const h=lab.pick(this.rc);if(h){lab.handle(h);return;}this.onTap(this.rc,this.reticle.visible?new THREE.Vector3().setFromMatrixPosition(this.reticle.matrix):null);});
    $('arOverlay').addEventListener('beforexrselect',e=>e.preventDefault());
    this.lastHit=performance.now();this.status('WebXR AR aktif — arahkan ke lantai/meja, ketuk untuk menempatkan area kerja.');
    lab.xrHook=(t,f)=>{if(!f||!this.hit)return;const res=f.getHitTestResults(this.hit);
      if(res.length){const p=res[0].getPose(r.xr.getReferenceSpace());if(p){this.reticle.visible=true;this.reticle.matrix.fromArray(p.transform.matrix);this.lastHit=t;if(this.lost){this.lost=false;this.status('Tracking pulih.');}}}
      else{this.reticle.visible=false;if(t-this.lastHit>1500&&!this.lost){this.lost=true;this.status('⚠ Tracking hilang / permukaan tidak terdeteksi — gerakkan HP perlahan. Posisi objek mungkin tidak akurat.');}}};
    ses.addEventListener('end',()=>{if(!this.stopped)this.stop();});
  }
  async startCam(){
    let stream;
    try{stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}},audio:false});}
    catch(e){const m={NotAllowedError:'Izin kamera ditolak. Izinkan kamera di pengaturan browser lalu coba lagi.',NotFoundError:'Kamera tidak ditemukan.',NotReadableError:'Kamera sedang dipakai aplikasi lain.'}[e.name]||'Kamera gagal dibuka: '+e.message;this.ui.toast(m,'bad');return false;}
    this.stream=stream;const v=$('camVideo');v.srcObject=stream;try{await v.play();}catch{}v.classList.add('on');
    this.begin('cam');this.lab.cam.position.set(0,0,0);this.lab.cam.rotation.set(0,0,0);this.lab.cam.fov=60;this.lab.cam.updateProjectionMatrix();
    this.sensor=false;this.lastOri=0;this.yaw=0;this.pitch=0;
    try{if(typeof DeviceOrientationEvent!=='undefined'&&DeviceOrientationEvent.requestPermission)await DeviceOrientationEvent.requestPermission();}catch{}
    const zee=new THREE.Vector3(0,0,1),eu=new THREE.Euler(),q0=new THREE.Quaternion(),q1=new THREE.Quaternion(-Math.sqrt(.5),0,0,Math.sqrt(.5)),D=Math.PI/180;
    this.onOri=e=>{if(e.alpha==null)return;this.sensor=true;this.lastOri=performance.now();const o=(screen.orientation?.angle||window.orientation||0)*D,q=this.lab.cam.quaternion;
      eu.set(e.beta*D,e.alpha*D,-e.gamma*D,'YXZ');q.setFromEuler(eu);q.multiply(q1);q.multiply(q0.setFromAxisAngle(zee,-o));};
    addEventListener('deviceorientation',this.onOri);
    this.onMove=e=>{if(this.sensor||!(e.buttons&1))return;this.yaw-=e.movementX*.005;this.pitch=clamp(this.pitch-e.movementY*.005,1.4);this.lab.cam.rotation.set(this.pitch,this.yaw,0,'YXZ');};
    this.lab.r.domElement.addEventListener('pointermove',this.onMove);
    this.status('AR kamera (orientasi saja, TANPA tracking permukaan). Arahkan ke bawah, ketuk untuk menempatkan area kerja.');
    this.tm=setInterval(()=>{if(this.sensor&&performance.now()-this.lastOri>1500){this.sensor=false;this.status('⚠ Sensor orientasi berhenti — posisi objek tidak akurat. Seret layar untuk memutar pandangan.');}
      else if(!this.sensor&&performance.now()-this.t0>2500&&!this.warned){this.warned=true;this.status('Sensor orientasi tidak tersedia (mis. laptop): seret layar untuk memutar pandangan. Objek tidak terkunci ke dunia nyata.');}},700);
    this.t0=performance.now();this.warned=false;return true;
  }
  onTap(ray,surf){
    const lab=this.lab;
    if(!surf&&this.mode==='cam'){const p=new THREE.Vector3();if(ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,1,0),-PLANE_Y),p))surf=p;}
    if(!surf){this.ui.toast(this.mode==='cam'?'Arahkan kamera ke bawah (ke arah meja/lantai).':'Permukaan belum terdeteksi.','warn');return;}
    if(!this.anchored){lab.world.position.copy(surf);lab.world.visible=true;this.anchored=true;this.status('Area kerja ditempatkan. Pilih alat: Tempatkan perangkat / Hubungkan / Pindahkan.');return;}
    const l=lab.world.worldToLocal(surf.clone()),x=clamp(Math.round(l.x*2)/2,LIM_X),z=clamp(Math.round(l.z*2)/2,LIM_Z);
    if(this.tool==='place'){if(!lab.free(x,z))return this.ui.toast('Terlalu dekat dengan perangkat lain.','warn');const d=this.sim.addDevice($('arType').value,x,z);lab.select(d.id);}
    if(this.tool==='move'&&lab.sel){if(!lab.free(x,z,lab.sel))return this.ui.toast('Terlalu dekat dengan perangkat lain.','warn');this.sim.moveDevice(lab.sel,x,z);this.sim.emit('change');}
  }
  setTool(v){this.tool=v;const m={select:'select',connect:'connect',disconnect:'disconnect',place:'select',move:'select'}[v];this.lab.setMode(m);}
  fill(){
    if(!this.active)return;const s=this.sim,o=(sel,list,keep)=>{const cur=$(sel).value;$(sel).innerHTML=list.map(([v,t])=>`<option value="${v}">${t}</option>`).join('');if([...$(sel).options].some(x=>x.value===cur))$(sel).value=cur;};
    const free=s.devices.flatMap(d=>d.ports.filter(p=>!s.cableAt(d.id,p.id)).map(p=>[d.id+'|'+p.id,`${d.name}:${p.name}`]));
    o('arSrc',free);o('arDst',free);o('arPSrc',s.devices.filter(d=>d.type==='pc'||d.type==='server').map(d=>[d.id,d.name]));
  }
  bindUI(){
    $('arTool').onchange=e=>this.setTool(e.target.value);
    $('arExit').onclick=()=>this.stop();
    $('arAnchor').onclick=()=>{this.anchored=false;this.lab.world.visible=false;this.status('Ketuk permukaan untuk menempatkan ulang area kerja.');};
    $('arConnect').onclick=()=>{const [ad,ap]=$('arSrc').value.split('|'),[bd,bp]=$('arDst').value.split('|');if(!ad||!bd)return this.ui.toast('Tidak ada port bebas.','warn');
      const r=this.sim.connect($('arCab').value,{d:ad,p:ap},{d:bd,p:bp});this.ui.toast(r.ok?'Kabel terpasang.':`${r.reason} ${r.fix}`,r.ok?'ok':'bad');};
    $('arPing').onclick=()=>{const id=$('arPSrc').value;if(!id)return;const r=this.sim.run(id,'ping '+$('arPIp').value.trim());
      $('arOut').textContent=(r.ok?'✔ Reply (simulasi)':'✘ Gagal (simulasi)')+'\n'+(r.lines.find((_,i)=>i>=2)||'')+'\n'+r.ex;this.sim.emit('change');};
  }
  cleanup(){try{this.hit?.cancel?.();}catch{}this.hit=null;if(this.reticle){this.lab.scene.remove(this.reticle);this.reticle=null;}if(this.ctrl){this.lab.scene.remove(this.ctrl);this.ctrl=null;}
    this.stream?.getTracks().forEach(t=>t.stop());this.stream=null;const v=$('camVideo');v.srcObject=null;v.classList.remove('on');
    if(this.onOri)removeEventListener('deviceorientation',this.onOri);this.onOri=null;if(this.onMove)this.lab.r.domElement.removeEventListener('pointermove',this.onMove);clearInterval(this.tm);
    this.lab.r.xr.enabled=false;this.lab.xrHook=null;}
  async stop(){
    if(this.stopped)return;this.stopped=true;const ses=this.ses;this.ses=null;this.cleanup();try{await ses?.end();}catch{}
    this.active=false;this.sim.arActive=false;this.lab.hooks.empty=null;document.body.classList.remove('ar');$('arOverlay').classList.remove('on');
    this.lab.exitAR();this.ui.onExit?.();this.ui.toast('Kamera dihentikan. Kembali ke simulasi 3D.','ok');
  }
}

// Penghubung UI <-> model simulasi (Sim) <-> scene 3D <-> AR.
import {Sim,DEV} from './network-engine.js';
import {build,TOPO,status as topoStatus} from './topologies.js';
import {MISSIONS,evaluate} from './missions.js';
import * as store from './storage.js';
const $=s=>document.querySelector(s),esc=t=>String(t??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const sim=new Sim();sim.progress=store.loadProgress();sim.sample();
let lab=null,ar=null,sel=null,tab='props',learn=true,termSrc=null;const termLog=[];
const TABS={props:'Perangkat',topo:'Topologi',term:'Terminal',miss:'Misi',learn:'Belajar',proj:'Proyek',guide:'Panduan'};
const toast=(m,k='info')=>{const t=$('#toast');t.textContent=m;t.className='on '+k;clearTimeout(toast.t);toast.t=setTimeout(()=>t.className='',5000);};
const fail=m=>{const e=$('#err');e.hidden=false;e.innerHTML=`<b>Modul 3D/AR gagal dimuat.</b><br>${esc(m)}<br><small>Periksa koneksi internet (Three.js dimuat dari CDN jsDelivr) dan jalankan lewat server lokal (python server.py). Panel, terminal, dan misi tetap bisa dipakai.</small><br><button onclick="this.parentNode.hidden=true">Tutup</button>`;};

// ---------- Panel ----------
function setTab(t){tab=t;$('#side').classList.remove('hide');render();}
function render(){
  $('#tabs').innerHTML=Object.entries(TABS).map(([k,v])=>`<button data-act="tab" data-v="${k}" class="${k===tab?'on':''}">${v}</button>`).join('');
  const f={props:rProps,topo:rTopo,term:rTerm,miss:rMiss,learn:rLearn,proj:rProj,guide:rGuide}[tab];$('#panel').innerHTML=f();
  if(tab==='term'){const p=$('#term');if(p)p.scrollTop=p.scrollHeight;}
  badge();hint();
}
function badge(){const up=sim.cables.filter(c=>sim.linkUp(c)).length,b=$('#badge'),n=sim.cables.length;
  b.textContent=`${sim.devices.length} perangkat · ${n} kabel · ${up}/${n} link UP`;b.className='badge '+(n?(up===n?'ok':'bad'):'');}
function hint(){
  const m=lab?.mode,p=lab?.pending;let t='Klik perangkat untuk melihat info. Putar: seret · Zoom: scroll/cubit · Geser: klik kanan/dua jari.';
  if(m==='move')t='Mode Pindah: seret perangkat di atas meja (grid aktif). Perangkat tidak boleh saling menumpuk.';
  if(m==='connect')t=p?`Port sumber: ${sim.pn(p)}. Sekarang klik port TUJUAN — cyan = valid, merah = tidak valid, abu = terpakai. Esc untuk batal.`:`Mode Sambung (${lab.cableType}): langkah 1 — klik port pertama (kotak kecil) pada sebuah perangkat. Tip: PC↔Switch = straight, sejenis = crossover.`;
  if(m==='disconnect')t='Mode Lepas: klik kabel (atau port berkabel) untuk memutuskannya.';
  $('#hint').textContent=t;document.querySelectorAll('#modes button').forEach(b=>b.classList.toggle('on',b.dataset.v===m));
}
function rProps(){
  const d=sim.dev(sel);if(!d)return '<p class="muted">Pilih perangkat di ruang 3D (mode Pilih). Info fungsi, port, dan konfigurasi IP akan muncul di sini.</p>';
  const k=DEV[d.type],ipc=k.ip;
  const rows=d.ports.map(p=>{const c=sim.cableAt(d.id,p.id),o=c&&sim.other(c,d.id,p.id);
    return `<tr><td>${esc(p.name)}</td><td>${c?`<span class="${sim.linkUp(c)?'ok':'bad'}">${sim.linkUp(c)?'UP':'DOWN'}</span> → ${esc(sim.pn(o))}`:'<span class="muted">kosong</span>'}</td></tr>`+
      (ipc?`<tr><td colspan=2><div class="row"><input data-ip="${p.id}" placeholder="IPv4" value="${esc(p.ip)}"><input data-mask="${p.id}" placeholder="Subnet mask" value="${esc(p.mask)}"></div></td></tr>`:'');}).join('');
  return `<h3>${esc(d.name)} <small class="muted">${k.label}</small></h3>
  <div class="row"><input id="pname" value="${esc(d.name)}"><button data-act="rename">Ubah nama</button></div>
  <div class="row"><button data-act="power">${d.power?'🟢 Hidup — matikan':'🔴 Mati — nyalakan'}</button><button data-act="rotate">↻ Putar</button><button data-act="home">⌂ Reset posisi</button><button data-act="del">🗑 Hapus</button></div>
  <p class="muted">MAC (simulasi): ${d.mac}</p><table>${rows}</table>
  ${ipc?`<div class="row"><input id="gw" placeholder="Default gateway" value="${esc(d.gw)}"><input id="dns" placeholder="DNS (opsional)" value="${esc(d.dns)}"></div><button class="accent full" data-act="apply">Terapkan konfigurasi IP</button><div id="cfgmsg"></div>
  <p class="muted">Contoh: PC-01 192.168.10.1, PC-02 192.168.10.2, mask 255.255.255.0.</p>`:'<p class="muted">Perangkat Layer-2: tidak memakai IP pada simulasi ini.</p>'}
  <h3>Info perangkat</h3><p><b>Fungsi:</b> ${k.fn}</p><p><b>Komponen:</b> ${k.parts}</p><p><b>Cara menghubungkan:</b> ${k.how}</p><p><b>Contoh:</b> ${k.ex}</p><p><b>Kesalahan umum:</b> ${k.err}</p>`;
}
function rTopo(){
  const st=topoStatus(sim),t=sim.topology?TOPO[sim.topology.kind]:null;
  const X=x=>160+x*26,Z=z=>90+z*26,pos=id=>{const d=sim.dev(id);return [X(d.x),Z(d.z)];};
  const svg=`<svg class="dg" viewBox="0 0 320 180">${sim.cables.map(c=>{const [a,b]=[pos(c.a.d),pos(c.b.d)];return `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="${sim.linkUp(c)?'#22c55e':'#ef4444'}" stroke-width="2" ${c.type==='crossover'?'stroke-dasharray="5 3"':''}/>`;}).join('')}
  ${sim.devices.map(d=>{const [x,y]=pos(d.id);return `<circle cx="${x}" cy="${y}" r="8" fill="${{pc:'#3b82f6',switch:'#22d3ee',router:'#fb923c',ap:'#a78bfa',server:'#f472b6'}[d.type]}"/><text x="${x}" y="${y-11}" fill="#fff" font-size="8" text-anchor="middle">${esc(d.name)}</text>`;}).join('')}</svg>`;
  return `<h3>Template topologi</h3><div class="row"><select id="tk">${Object.entries(TOPO).map(([k,v])=>`<option value="${k}">${v.name}</option>`).join('')}</select><input id="tn" type="number" min="2" max="7" value="4" style="max-width:70px" title="Jumlah PC"><label class="chk"><input type="checkbox" id="tf" checked>Full mesh</label></div>
  <button class="accent full" data-act="topoBuild">Buat topologi (mengganti isi meja)</button>
  <h3>${st.name}</h3><p class="${st.ok===null?'muted':st.ok?'ok':'wn'}">${st.txt}</p><p>Perangkat: <b>${sim.devices.length}</b> · Kabel: <b>${sim.cables.length}</b></p>${svg}
  <p class="muted">Diagram digambar dari kabel yang tersimpan di model (hijau = link UP, putus-putus = crossover).</p>
  ${t?`<p><b>Kelebihan:</b> ${t.pros}</p><p><b>Kekurangan:</b> ${t.cons}</p><p><b>Dunia nyata:</b> ${t.use}</p>`:'<p class="muted">Pilih template untuk melihat kelebihan, kekurangan, dan kegunaannya.</p>'}`;
}
function rTerm(){
  const hosts=sim.devices.filter(d=>d.type==='pc'||d.type==='server');if(!hosts.find(d=>d.id===termSrc))termSrc=hosts[0]?.id;
  return `<h3>Terminal simulasi</h3><div class="row"><select id="tsrc">${hosts.map(d=>`<option value="${d.id}" ${d.id===termSrc?'selected':''}>${esc(d.name)}</option>`).join('')}</select><label class="chk"><input type="checkbox" id="tlearn" ${learn?'checked':''}>Mode belajar</label></div>
  <pre class="term" id="term">${termLog.map(l=>l.c?`<span class="${l.c}">${esc(l.t)}</span>`:esc(l.t)).join('\n')||'Ketik help. Contoh: ping 192.168.10.2'}</pre>
  <div class="row"><input id="tin" placeholder="ping 192.168.10.2" autocomplete="off"><button data-act="tgo">Jalankan</button></div>
  <p class="muted">Perintah: ping, ipconfig, tracert, arp -a, clear. Seluruhnya simulasi internal (bukan perintah OS asli).</p>`;
}
function rMiss(){
  const P=sim.progress;
  return MISSIONS.map(m=>{const r=evaluate(sim,m),n=r.filter(x=>x[1]).length,sc=Math.round(100*n/r.length),p=P[m.id];
    return `<div class="mc ${p?.done?'done':''}"><b>Misi ${m.id}: ${m.title}</b> ${p?.done?'✅':''} <span class="muted">skor terbaik ${p?.score??0}</span>
    <p>${m.goal}</p><p class="muted"><b>Butuh:</b> ${m.needs}<br><b>Langkah:</b> ${m.steps}</p>
    <div>${r.map(([l,o])=>`<div class="${o?'ok':'bad'}">${o?'✔':'✘'} ${l}</div>`).join('')}</div>
    <div class="row"><button data-act="mEval" data-v="${m.id}">Evaluasi (${sc}%)</button>${m.setup?`<button data-act="mSetup" data-v="${m.id}">Muat skenario</button>`:''}<button data-act="mHint" data-v="${m.id}">Petunjuk</button></div><div class="muted" id="mh${m.id}"></div></div>`;}).join('');
}
const LEARN=[['Komputer klien','Perangkat pengguna yang meminta layanan.'],['Switch','Menyambung perangkat dalam satu LAN memakai tabel MAC.'],['Router','Menghubungkan subnet berbeda berdasarkan IP.'],['Access Point','Menghubungkan klien Wi-Fi ke jaringan kabel.'],['Server','Menyediakan layanan (web, DNS, DHCP, file).'],
 ['Jenis kabel','Straight-through: perangkat berbeda jenis (PC–Switch). Crossover: sejenis (PC–PC, Switch–Switch). Fiber & console: pengembangan.'],['Port Ethernet','Konektor RJ-45 dengan LED link; hijau = link aktif.'],['IPv4 & subnet mask','Alamat 4 oktet; mask menentukan bagian jaringan vs host (mis. /24 = 255.255.255.0).'],
 ['Default gateway','IP router untuk menuju jaringan lain; harus satu subnet dengan PC.'],['DHCP & DNS','DHCP memberi IP otomatis; DNS menerjemahkan nama ke IP. (Di simulator ini IP diatur manual.)'],['Ping & troubleshooting','Periksa urut: daya → kabel/link → IP/mask → gateway → tujuan. Fisik dulu, baru logika.'],['Topologi','Star, Bus, Ring, Mesh, Point-to-Point — lihat tab Topologi.']];
function rLearn(){return LEARN.map(([a,b])=>`<details><summary>${a}</summary><p>${b}</p></details>`).join('')+'<p class="muted">Pilih perangkat untuk info lengkap di tab Perangkat.</p>';}
function rProj(){return `<h3>Proyek</h3><div class="row"><button data-act="save">💾 Simpan</button><button data-act="load">📂 Muat</button><button data-act="newp">📄 Proyek baru</button></div>
  <div class="row"><button data-act="dup">⧉ Gandakan topologi</button><button data-act="resetSim">↺ Reset simulasi</button></div>
  <div class="row"><button data-act="exportP">⬇ Ekspor JSON</button><button data-act="importP">⬆ Impor JSON</button><input type="file" id="imp" accept=".json" hidden></div>
  <p class="muted">Tersimpan: posisi, jenis perangkat, port, kabel, IP, topologi, progres misi. Video/gambar kamera tidak pernah disimpan.</p>`;}
function rGuide(){return `<h3>Panduan singkat</h3><ol><li><b>Tambah</b> perangkat dari palet.</li><li>Mode <b>Sambung</b>: pilih jenis kabel → klik port 1 → klik port 2.</li><li>Pilih PC → isi IP &amp; mask → <b>Terapkan</b>.</li><li>Tab <b>Terminal</b>: <code>ping 192.168.10.2</code>.</li><li>Kerjakan <b>Misi</b>; skor dari kondisi simulasi nyata.</li><li><b>Mulai AR</b>: izinkan kamera, tempatkan area kerja, tambah &amp; sambung perangkat.</li></ol>
  <h3>Aturan kabel</h3><p>Perangkat berbeda jenis → <b>straight</b>. Sejenis → <b>crossover</b>.</p><h3>Kamera</h3><p>Perlu HTTPS atau localhost. Kamera mati saat keluar AR.</p>`;}

// ---------- Terminal ----------
function runTerm(){
  const i=$('#tin');if(!i||!termSrc)return;const cmd=i.value.trim();if(!cmd)return;
  if(cmd.toLowerCase()==='clear'){termLog.length=0;}
  else{termLog.push({t:`${sim.dev(termSrc).name}> ${cmd}`,c:'wn'});const r=sim.run(termSrc,cmd);r.lines.forEach(t=>termLog.push({t}));
    if(learn&&r.ex)termLog.push({t:'📘 '+r.ex,c:r.ok===false?'bad':'ok'});termLog.push({t:''});}
  i.value='';render();$('#tin')?.focus();
}

// ---------- Aksi ----------
const ACT={
  tab:b=>setTab(b.dataset.v),dash:()=>$('#dash').classList.add('on'),toggleSide:()=>$('#side').classList.toggle('hide'),
  mode:b=>{lab?.setMode(b.dataset.v);},
  add:b=>{if(!lab)return toast('Modul 3D tidak tersedia.','bad');const [x,z]=lab.freeSpot(),d=sim.addDevice(b.dataset.v,x,z);lab.select(d.id);toast(`${d.name} ditambahkan di meja.`,'ok');},
  rename:()=>{const d=sim.dev(sel);if(d&&$('#pname').value.trim()){d.name=$('#pname').value.trim();sim.emit('change');}},
  power:()=>{const d=sim.dev(sel);d.power=!d.power;sim.emit('change');},
  rotate:()=>{const d=sim.dev(sel);d.rot+=Math.PI/4;sim.moveDevice(d.id,d.x,d.z);sim.emit('change');},
  home:()=>{const d=sim.dev(sel);d.x=d.hx;d.z=d.hz;d.rot=0;sim.emit('change');},
  del:()=>{const d=sim.dev(sel);if(d&&confirm(`Hapus ${d.name} beserta kabelnya?`)){sim.removeDevice(d.id);sel=null;render();}},
  apply:()=>{const d=sim.dev(sel),cfg={ports:{},gw:$('#gw')?.value||'',dns:$('#dns')?.value||''};
    d.ports.forEach(p=>{const a=$(`[data-ip="${p.id}"]`),m=$(`[data-mask="${p.id}"]`);if(a)cfg.ports[p.id]={ip:a.value,mask:m.value};});
    const {E,W}=sim.checkCfg(d,cfg);if(E.length){$('#cfgmsg').innerHTML=E.map(e=>`<div class="bad">✘ ${esc(e)}</div>`).join('');return;}
    sim.applyCfg(d.id,cfg);$('#cfgmsg').innerHTML='<div class="ok">✔ Konfigurasi disimpan.</div>'+W.map(w=>`<div class="wn">⚠ ${esc(w)}</div>`).join('');},
  topoBuild:()=>{if(sim.devices.length&&!confirm('Isi meja saat ini akan diganti template. Lanjut?'))return;build(sim,$('#tk').value,+$('#tn').value||4,$('#tf').checked);sel=null;lab?.select(null);setTab('topo');toast('Topologi dibuat — Anda masih bisa memindahkan perangkat & mengubah kabel.','ok');},
  tgo:runTerm,
  mEval:b=>{const m=MISSIONS.find(x=>x.id==b.dataset.v),r=evaluate(sim,m),sc=Math.round(100*r.filter(x=>x[1]).length/r.length),all=r.every(x=>x[1]),o=sim.progress[m.id]||{score:0,done:false};
    sim.progress[m.id]={score:Math.max(o.score,sc),done:o.done||all};store.saveProgress(sim.progress);toast(all?`Misi ${m.id} selesai! Skor ${sc}.`:`Misi ${m.id} belum memenuhi semua kriteria (${sc}%).`,all?'ok':'warn');render();},
  mSetup:b=>{if(!confirm('Skenario akan mengganti isi meja. Lanjut?'))return;MISSIONS.find(x=>x.id==b.dataset.v).setup(sim);sim.topology=null;sim.emit('change');sel=null;lab?.select(null);toast('Skenario dimuat. Selidiki dengan ping di Terminal.','info');setTab('term');},
  mHint:b=>{$('#mh'+b.dataset.v).textContent='💡 '+MISSIONS.find(x=>x.id==b.dataset.v).hint;},
  save:()=>{const r=store.save(sim);toast(r.msg,r.ok?'ok':'bad');},
  load:()=>{const r=store.load(sim);toast(r.msg,r.ok?'ok':'bad');},
  newp:()=>{if(confirm('Buat proyek baru? Perubahan yang belum disimpan akan hilang.')){const p=sim.progress;sim.reset();sim.progress=p;sim.sample();sel=null;render();}},
  resetSim:()=>{if(confirm('Reset simulasi ke kondisi awal?')){sim.clear(true);sim.flags={};sim.sample();sel=null;render();}},
  exportP:()=>store.exportFile(sim),importP:()=>$('#imp').click(),
  dup:()=>{if(!sim.devices.length)return;const m=new Map(),cl=(v,l)=>Math.max(-l,Math.min(l,v));
    for(const d of [...sim.devices]){const n=sim.addDevice(d.type,cl(d.x+.5,5),cl(d.z+.5,2.5),true);n.rot=d.rot;m.set(d.id,n);}
    for(const c of [...sim.cables])sim.connect(c.type,{d:m.get(c.a.d).id,p:c.a.p},{d:m.get(c.b.d).id,p:c.b.p},true);sim.topology=null;sim.emit('change');toast('Digandakan (IP dikosongkan agar tidak duplikat). Geser salinannya di mode Pindah.','ok');},
  arStart:async()=>{if(!ar)return toast('Modul AR tidak termuat (lihat pesan error).','bad');const s=await ar.check();
    $('#arSupport').innerHTML=`<li class="${s.secure?'ok':'bad'}">Secure context (HTTPS/localhost): ${s.secure?'ya':'TIDAK — kamera diblokir browser'}</li><li class="${s.xr?'ok':'wn'}">WebXR AR (penempatan di permukaan nyata): ${s.xr?'tersedia':'tidak tersedia → memakai AR kamera (orientasi saja)'}</li><li class="${s.cam?'ok':'bad'}">API kamera: ${s.cam?'tersedia':'tidak tersedia'}</li>`;
    $('#arConsent').classList.add('on');}
};
document.addEventListener('click',e=>{const b=e.target.closest('[data-act]');if(b)ACT[b.dataset.act]?.(b);
  const g=e.target.closest('[data-go]');if(g)go(g.dataset.go);});
function go(k){$('#dash').classList.remove('on');
  if(k==='ar')return ACT.arStart();if(k==='ip'){setTab('props');toast('Pilih sebuah PC lalu isi IP & subnet mask di panel.','info');return;}
  const t={sim:null,learn:'learn',topo:'topo',diag:'term',miss:'miss',proj:'proj',guide:'guide'}[k];if(t)setTab(t);}
document.addEventListener('keydown',e=>{if(e.key==='Escape')lab?.cancel();if(e.key==='Enter'&&e.target.id==='tin')runTerm();});
document.addEventListener('change',e=>{
  if(e.target.id==='cableSel'){if(lab){lab.cableType=e.target.value;lab.refreshPorts();hint();}}
  if(e.target.id==='snap'&&lab)lab.snap=e.target.checked;
  if(e.target.id==='tsrc')termSrc=e.target.value;if(e.target.id==='tlearn')learn=e.target.checked;
  if(e.target.id==='imp'&&e.target.files[0])store.importFile(sim,e.target.files[0]).then(r=>{toast(r.msg,r.ok?'ok':'bad');e.target.value='';});});
$('#arNo').onclick=()=>$('#arConsent').classList.remove('on');
$('#arGo').onclick=async()=>{$('#arConsent').classList.remove('on');await ar.start();};
function dashProg(){const P=Object.values(sim.progress),n=P.filter(p=>p.done).length;$('#prog').innerHTML=`<span>Level <b>${1+Math.floor(n/2)}</b></span><span>Misi selesai <b>${n}/${MISSIONS.length}</b></span><span>Total skor <b>${P.reduce((a,p)=>a+p.score,0)}</b></span>`;}

// ---------- Inisialisasi ----------
let raf=0;sim.on(t=>{if(t==='change'){cancelAnimationFrame(raf);raf=requestAnimationFrame(()=>{if(!(document.activeElement?.closest('#panel')&&['INPUT','SELECT'].includes(document.activeElement.tagName)))render();dashProg();});}});
const ui={toast,onExit:()=>{render();}};
(async()=>{
  try{
    const {Lab}=await import('./scene.js');
    lab=new Lab($('#view'),sim,{toast,onMode:hint,onSelect:id=>{sel=id;const d=sim.dev(id);if(d){(sim.flags.sel=sim.flags.sel||[]);if(!sim.flags.sel.includes(d.type))sim.flags.sel.push(d.type);if(!ar?.active){tab='props';$('#side').classList.remove('hide');}}render();}});
    try{const {AR}=await import('./ar-manager.js');ar=new AR(lab,sim,ui);}catch(e){fail('AR: '+e.message);}
  }catch(e){fail(e.message);}
  render();dashProg();
})();

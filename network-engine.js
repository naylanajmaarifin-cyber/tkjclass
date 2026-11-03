// Mesin simulasi jaringan (JS murni, tanpa DOM). Dipakai bersama oleh mode 3D dan AR.
// Semua hasil ping/tracert adalah SIMULASI INTERNAL: tidak ada paket yang dikirim ke jaringan nyata.
export const DEV = {
  pc:{label:'PC',prefix:'PC',ports:['eth0'],mdix:false,ip:true,
    fn:'Komputer klien: perangkat pengguna akhir yang meminta layanan jaringan.',parts:'NIC (kartu jaringan), CPU, RAM, sistem operasi.',
    how:'Port eth0 → port switch (straight). PC ↔ PC langsung memakai crossover.',ex:'PC siswa membuka web atau berbagi file di lab.',
    err:'IP/subnet tidak sama, kabel salah jenis, IP duplikat, kabel belum terpasang.'},
  switch:{label:'Switch',prefix:'SW',ports:Array.from({length:8},(_,i)=>`Fa0/${i+1}`),mdix:true,ip:false,
    fn:'Menyambungkan banyak perangkat dalam satu jaringan lokal (LAN) berdasarkan MAC address.',parts:'Port Ethernet, tabel MAC, LED link.',
    how:'Port switch → PC/Server/AP/Router dengan straight. Switch ↔ switch dengan crossover.',ex:'Switch pusat pada topologi Star.',
    err:'Memakai kabel crossover ke PC, port penuh, loop kabel antar-switch.'},
  router:{label:'Router',prefix:'R',ports:['Gi0/0','Gi0/1','Gi0/2','Gi0/3'],mdix:false,ip:true,
    fn:'Menghubungkan jaringan berbeda (subnet berbeda) dan meneruskan paket berdasarkan alamat IP.',parts:'Interface ber-IP, tabel routing.',
    how:'Port router → switch (straight). IP port router biasanya menjadi default gateway PC.',ex:'Router antar-VLAN/subnet atau ke internet.',
    err:'Port router belum diberi IP, gateway PC tidak sama dengan IP router.'},
  ap:{label:'Access Point',prefix:'AP',ports:['LAN'],mdix:false,ip:false,
    fn:'Memancarkan jaringan nirkabel (Wi-Fi) dan menghubungkannya ke jaringan kabel.',parts:'Antena, port LAN (PoE opsional).',
    how:'Port LAN AP → port switch dengan straight.',ex:'Wi-Fi ruang kelas.',err:'Tidak tersambung ke switch, SSID/keamanan salah (di luar simulasi ini).'},
  server:{label:'Server',prefix:'SRV',ports:['eth0'],mdix:false,ip:true,
    fn:'Menyediakan layanan (web, DHCP, DNS, file) untuk klien.',parts:'NIC, penyimpanan, layanan jaringan.',
    how:'Port eth0 → switch (straight).',ex:'Server web/DNS sekolah.',err:'IP berubah-ubah, gateway salah, daya mati.'}
};
export const isIp=s=>typeof s==='string'&&/^\d{1,3}(\.\d{1,3}){3}$/.test(s)&&s.split('.').every(o=>+o<=255);
export const toInt=s=>s.split('.').reduce((a,o)=>a*256+ +o,0);
export const isMask=s=>{if(!isIp(s))return false;const b=toInt(s).toString(2).padStart(32,'0');return /^1+0*$/.test(b)};
const net=(ip,m)=>(toInt(ip)&toInt(m))>>>0;
const same=(a,b,m)=>net(a,m)===net(b,m);
const hex=()=>Math.floor(Math.random()*256).toString(16).padStart(2,'0').toUpperCase();

export class Sim{
  constructor(){this.ls=[];this.arActive=false;this.reset();}
  reset(){this.clear(true);this.flags={};this.progress={};this.n=0;}
  clear(silent){this.devices=[];this.cables=[];this.topology=null;this.cnt={};if(!silent)this.emit('change');}
  on(f){this.ls.push(f);} emit(t,d){this.ls.forEach(f=>f(t,d));}
  dev(id){return this.devices.find(d=>d.id===id);}
  pn(e){const d=this.dev(e.d);return `${d.name}:${d.ports.find(p=>p.id===e.p).name}`;}
  addDevice(type,x=0,z=0,silent){
    const k=DEV[type];this.cnt[type]=(this.cnt[type]||0)+1;const n=++this.n;
    const d={id:'d'+n,type,name:`${k.prefix}-${String(this.cnt[type]).padStart(2,'0')}`,x,z,hx:x,hz:z,rot:0,power:true,gw:'',dns:'',
      mac:`02:54:4B:${hex()}:${hex()}:${hex()}`,ports:k.ports.map((nm,i)=>({id:'p'+i,name:nm,ip:'',mask:''}))};
    this.devices.push(d);if(this.arActive)this.flags.arPlaced=(this.flags.arPlaced||0)+1;
    if(!silent)this.emit('change');return d;
  }
  sample(){
    [['pc',-4,1.6],['pc',-1,1.6],['server',4.2,1.6],['switch',2,-1.5],['router',-2,-1.5],['ap',4.4,-1.5]].forEach(a=>this.addDevice(...a,true));
    this.emit('change');
  }
  removeDevice(id){this.cables=this.cables.filter(c=>c.a.d!==id&&c.b.d!==id);this.devices=this.devices.filter(d=>d.id!==id);this.emit('change');}
  moveDevice(id,x,z){const d=this.dev(id);d.x=x;d.z=z;this.emit('move',id);}
  cableAt(d,p){return this.cables.find(c=>(c.a.d===d&&c.a.p===p)||(c.b.d===d&&c.b.p===p));}
  other(c,d,p){return (c.a.d===d&&c.a.p===p)?c.b:c.a;}
  linkUp(c){return this.dev(c.a.d).power&&this.dev(c.b.d).power;}
  // Aturan UTP klasik: perangkat sekelas (sama-sama MDI atau sama-sama MDI-X) butuh crossover.
  need(a,b){return DEV[this.dev(a.d).type].mdix===DEV[this.dev(b.d).type].mdix?'crossover':'straight';}
  canConnect(type,a,b){
    const no=(reason,fix)=>({ok:false,reason,fix});
    if(type!=='straight'&&type!=='crossover')return no('Jenis kabel ini belum didukung (fiber & console masih pengembangan).','Pilih UTP straight-through atau crossover.');
    if(a.d===b.d)return no('Kedua port berada di perangkat yang sama.','Pilih port di perangkat lain.');
    for(const e of [a,b])if(this.cableAt(e.d,e.p))return no(`Port ${this.pn(e)} sudah dipakai kabel.`,'Pilih port bebas atau lepas kabel lama (mode Disconnect Cable).');
    const need=this.need(a,b);
    if(type!==need)return no(`${this.dev(a.d).name} ↔ ${this.dev(b.d).name}: ${need==='crossover'?'perangkat sejenis butuh kabel crossover':'perangkat berbeda jenis butuh kabel straight-through'}.`,`Ganti jenis kabel menjadi ${need}.`);
    return {ok:true};
  }
  connect(type,a,b,silent){
    const v=this.canConnect(type,a,b);if(!v.ok)return v;
    const c={id:'c'+(++this.n),type,a:{...a},b:{...b}};this.cables.push(c);
    if(this.arActive)this.flags.arCable=(this.flags.arCable||0)+1;
    if(!silent)this.emit('change');return {ok:true,cable:c};
  }
  autoConnect(A,B,silent=true){
    const f=d=>d.ports.find(p=>!this.cableAt(d.id,p.id));const pa=f(A),pb=f(B);if(!pa||!pb)return {ok:false,reason:'Port habis.'};
    const a={d:A.id,p:pa.id},b={d:B.id,p:pb.id};return this.connect(this.need(a,b),a,b,silent);
  }
  disconnect(id){this.cables=this.cables.filter(c=>c.id!==id);this.emit('change');}
  ifaces(onlyOn){const o=[];for(const d of this.devices)if(DEV[d.type].ip&&(!onlyOn||d.power))for(const p of d.ports)if(p.ip)o.push({dev:d,port:p,ip:p.ip,mask:p.mask});return o;}
  // Validasi konfigurasi IP. E = error (ditolak), W = peringatan (disimpan, tapi jaringan bermasalah)
  checkCfg(d,cfg){
    const E=[],W=[];
    d.ports.forEach(p=>{const c=cfg.ports?.[p.id];if(!c)return;const ip=c.ip.trim(),m=c.mask.trim();if(!ip&&!m)return;
      if(!isIp(ip))E.push(`${p.name}: format IPv4 salah. Contoh benar: 192.168.10.1 (4 angka 0–255 dipisah titik).`);
      if(!isMask(m))E.push(`${p.name}: subnet mask tidak valid. Contoh: 255.255.255.0.`);
      if(isIp(ip)&&isMask(m)){const n=net(ip,m),b=(n|(~toInt(m)>>>0))>>>0,v=toInt(ip);
        if(v===n)E.push(`${p.name}: ${ip} adalah alamat jaringan, tidak boleh dipakai host.`);
        if(v===b)E.push(`${p.name}: ${ip} adalah alamat broadcast, tidak boleh dipakai host.`);}
      if(isIp(ip)&&this.devices.some(o=>o!==d&&o.ports.some(q=>q.ip===ip)))W.push(`IP ${ip} sudah dipakai perangkat lain → akan terjadi IP conflict.`);
    });
    const gw=(cfg.gw||'').trim(),p0=cfg.ports?.[d.ports[0].id];
    if(gw&&!isIp(gw))E.push('Default gateway: format salah.');
    else if(gw&&p0&&isIp(p0.ip)&&isMask(p0.mask)&&!same(p0.ip,gw,p0.mask))W.push('Default gateway di luar subnet PC → tidak bisa dijangkau.');
    if((cfg.dns||'').trim()&&!isIp(cfg.dns.trim()))E.push('DNS Server: format salah.');
    if(DEV[d.type].ip&&p0&&isIp(p0.ip)&&isMask(p0.mask)&&!gw)W.push('Default gateway kosong: hanya bisa komunikasi dalam subnet yang sama.');
    return {E,W};
  }
  applyCfg(id,cfg){const d=this.dev(id);d.ports.forEach(p=>{const c=cfg.ports?.[p.id];if(c){p.ip=c.ip.trim();p.mask=c.mask.trim();}});
    if(cfg.gw!==undefined)d.gw=cfg.gw.trim();if(cfg.dns!==undefined)d.dns=cfg.dns.trim();this.emit('change');}
  // Jalur Layer-2: kabel → switch/AP (meneruskan frame) → port tujuan. Router/PC tidak meneruskan.
  l2(sd,sp,td,tp){
    const c0=this.cableAt(sd,sp);if(!c0||!this.linkUp(c0))return null;
    const q=[{e:this.other(c0,sd,sp),path:[]}],seen=new Set();
    while(q.length){const {e,path}=q.shift();
      if(e.d===td&&e.p===tp)return path;
      const d=this.dev(e.d);if(!(d.type==='switch'||d.type==='ap')||seen.has(d.id))continue;seen.add(d.id);
      for(const p of d.ports){if(p.id===e.p)continue;const c=this.cableAt(d.id,p.id);
        if(c&&this.linkUp(c))q.push({e:this.other(c,d.id,p.id),path:[...path,d.name]});}}
    return null;
  }
  // Inti uji konektivitas: memeriksa daya, kabel, link, IP, konflik, subnet, gateway, routing.
  probe(src,target){
    const F=(code,msg,reason,fix)=>({ok:false,code,msg,reason,fix,hops:[]});
    const O=hops=>({ok:true,code:'ok',hops,reason:'Link fisik aktif dan konfigurasi IP/subnet/gateway cocok, sehingga ICMP echo dibalas.',fix:''});
    const TO=(r,f)=>F('timeout','Request timed out.',r,f);
    if(!src.power)return F('off','Transmit failed. Perangkat mati.','Perangkat sumber dalam keadaan mati.','Nyalakan perangkat di panel properti.');
    const ic=src.ports[0];
    if(!ic.ip||!ic.mask)return F('noip','PING: transmit failed. General failure.','IP address / subnet mask belum dikonfigurasi (konfigurasi tidak lengkap).','Isi IPv4 dan subnet mask di panel properti.');
    if(!isIp(target))return F('badip',`Ping request could not find host ${target}. Please check the name and try again.`,'Alamat tujuan bukan IPv4 yang valid.','Gunakan format x.x.x.x dengan oktet 0–255.');
    const cab=this.cableAt(src.id,ic.id);
    if(!cab)return F('nocable','Network cable disconnected.','Koneksi FISIK putus: port belum tersambung kabel (tanpa link, IP tidak berguna).','Sambungkan kabel dengan mode Connect Cable.');
    if(!this.linkUp(cab))return TO('Link down: perangkat di ujung kabel mati.','Nyalakan perangkat di ujung kabel lainnya.');
    const on=this.ifaces(true);
    if(on.filter(i=>i.ip===ic.ip).length>1)return F('conflict',`IP address conflict: ${ic.ip} dipakai lebih dari satu perangkat.`,'Dua perangkat aktif memakai IP yang sama.','Ubah salah satu IP menjadi alamat unik.');
    if(target===ic.ip)return O([target]);
    if(on.filter(i=>i.ip===target).length>1)return F('conflict',`IP address conflict: ${target} dipakai lebih dari satu perangkat.`,'IP tujuan dimiliki lebih dari satu perangkat.','Ubah salah satu IP menjadi unik.');
    const dst=this.ifaces(false).find(i=>i.ip===target);
    if(same(ic.ip,target,ic.mask)){ // satu subnet → langsung via L2
      if(!dst)return F('unreach',`Reply from ${ic.ip}: Destination host unreachable.`,'Tidak ada perangkat ber-IP tersebut di segmen yang sama.','Periksa IP tujuan atau konfigurasi perangkat tujuan.');
      if(!this.l2(src.id,ic.id,dst.dev.id,dst.port.id))return TO('Tidak ada jalur fisik aktif (kabel/switch/daya) menuju tujuan.','Periksa kabel, switch, dan daya sepanjang jalur.');
      if(!isMask(dst.mask)||!same(dst.ip,ic.ip,dst.mask))return TO(`Subnet mask tujuan (${dst.mask}) membuat ${ic.ip} dianggap berada di jaringan lain, balasan tidak dikirim langsung.`,'Samakan subnet mask kedua perangkat.');
      return O([target]);
    }
    const gw=src.gw;
    if(!gw)return F('unreach',`Reply from ${ic.ip}: Destination host unreachable.`,'Tujuan di subnet lain tetapi default gateway belum diisi.','Isi default gateway dengan IP port router.');
    if(!same(ic.ip,gw,ic.mask))return F('unreach',`Reply from ${ic.ip}: Destination host unreachable.`,'Default gateway berada di luar subnet PC.','Gateway harus satu subnet dengan IP PC.');
    const rg=this.ifaces(false).find(i=>i.ip===gw&&i.dev.type==='router');
    if(!rg)return F('unreach',`Reply from ${ic.ip}: Destination host unreachable.`,'Tidak ada router dengan IP gateway tersebut.','Beri IP gateway pada port router atau ubah gateway PC.');
    if(!this.l2(src.id,ic.id,rg.dev.id,rg.port.id))return TO('Gateway tidak terjangkau secara fisik (kabel/switch/daya router).','Periksa kabel ke router dan daya router.');
    const out=this.ifaces(true).find(i=>i.dev===rg.dev&&isMask(i.mask)&&same(i.ip,target,i.mask));
    if(!out)return F('unreach',`Reply from ${gw}: Destination net unreachable.`,'Router tidak punya interface pada subnet tujuan.','Beri IP pada port router yang mengarah ke subnet tujuan.');
    if(!dst)return F('unreach',`Reply from ${gw}: Destination host unreachable.`,'Host tujuan tidak ditemukan di subnet tujuan.','Periksa IP tujuan.');
    if(!this.l2(rg.dev.id,out.port.id,dst.dev.id,dst.port.id))return TO('Tujuan tidak terjangkau dari port router (kabel/switch/daya).','Periksa kabel sisi tujuan.');
    if(dst.dev.gw!==out.ip||!same(dst.ip,out.ip,dst.mask))return TO('Tujuan menerima paket tetapi tidak punya default gateway yang benar untuk membalas.',`Set gateway tujuan = ${out.ip}.`);
    return O([gw,target]);
  }
  // Parser perintah terminal simulasi.
  run(id,line){
    const s=this.dev(id),t=line.trim().split(/\s+/),c=(t[0]||'').toLowerCase(),L=[];let ex='',ok=null;
    if(!s)return {lines:['Perangkat tidak ditemukan.'],ex,ok};
    const p=s.ports[0];
    if(c==='ping'){
      if(!t[1])L.push('Usage: ping <alamat-ip>');
      else{const r=this.probe(s,t[1]);L.push(`Pinging ${t[1]} with 32 bytes of data:`,'');
        for(let i=0;i<4;i++)L.push(r.ok?`Reply from ${t[1]}: bytes=32 time=${1+Math.floor(Math.random()*3)}ms TTL=${r.hops.length>1?126:128}`:r.msg);
        L.push('',`Ping statistics for ${t[1]}:`,`    Packets: Sent = 4, Received = ${r.ok?4:0}, Lost = ${r.ok?0:4}`);
        ok=r.ok;if(r.ok){if(this.arActive)this.flags.arPing=true;}else this.flags.pingFail=true;
        ex=r.ok?r.reason:`Penyebab: ${r.reason} Solusi: ${r.fix}`;}
    }else if(c==='ipconfig'){
      L.push('Windows IP Configuration (simulasi)','',`Ethernet adapter ${p.name}:`,'');
      if(!s.power)L.push('   Perangkat mati.');
      else if(!this.cableAt(s.id,p.id))L.push('   Media State . . . . . . . . . . . : Media disconnected');
      else L.push(`   Physical Address. . . . . . . . . : ${s.mac}`,`   IPv4 Address. . . . . . . . . . . : ${p.ip||'(belum diatur)'}`,`   Subnet Mask . . . . . . . . . . . : ${p.mask||'-'}`,`   Default Gateway . . . . . . . . . : ${s.gw||'-'}`,`   DNS Server. . . . . . . . . . . . : ${s.dns||'-'}`);
      ex='ipconfig menampilkan konfigurasi antarmuka. "Media disconnected" berarti masalah FISIK (kabel), bukan IP.';
    }else if(c==='tracert'){
      if(!t[1])L.push('Usage: tracert <alamat-ip>');
      else{const r=this.probe(s,t[1]);L.push(`Tracing route to ${t[1]} (simulasi), max 30 hops:`,'');
        if(r.ok){r.hops.forEach((h,i)=>L.push(`  ${i+1}    <1 ms    <1 ms    <1 ms  ${h}`));L.push('','Trace complete.');}
        else L.push('  1     *        *        *     Request timed out.','','Trace gagal.');
        ok=r.ok;ex=r.ok?'Hop pertama adalah default gateway bila tujuan berada di subnet lain; satu hop berarti satu subnet.':`Penyebab: ${r.reason} Solusi: ${r.fix}`;}
    }else if(c==='arp'&&t[1]==='-a'){
      L.push(`Interface: ${p.ip||'-'} --- ${p.name}`,'  Internet Address      Physical Address      Type');
      const es=p.ip&&isMask(p.mask)?this.ifaces(false).filter(o=>o.dev!==s&&same(p.ip,o.ip,p.mask)&&this.l2(s.id,p.id,o.dev.id,o.port.id)):[];
      es.forEach(o=>L.push(`  ${o.ip.padEnd(22)}${o.dev.mac.toLowerCase().replaceAll(':','-').padEnd(22)}dynamic`));
      if(!es.length)L.push('No ARP Entries Found.');
      ex='Simulasi: menampilkan tetangga satu subnet yang terjangkau lewat kabel/switch.';
    }else if(c==='help'||!c)L.push('Perintah: ping <ip> | ipconfig | tracert <ip> | arp -a | clear');
    else L.push(`'${t[0]}' tidak dikenali. Ketik help.`);
    return {lines:L,ex,ok};
  }
  toJSON(){return {v:1,devices:this.devices,cables:this.cables,topology:this.topology,flags:this.flags,progress:this.progress,n:this.n,cnt:this.cnt};}
  load(o){
    try{
      if(!o||!Array.isArray(o.devices)||!Array.isArray(o.cables))return {ok:false,msg:'Data proyek tidak lengkap (devices/cables hilang).'};
      const ids=new Set();
      for(const d of o.devices){if(!DEV[d.type]||!d.id||!Array.isArray(d.ports)||d.ports.length!==DEV[d.type].ports.length||!isFinite(d.x)||!isFinite(d.z))return {ok:false,msg:`Perangkat rusak: ${d.name||d.id||'?'}`};ids.add(d.id);}
      const used=new Set();
      for(const c of o.cables){for(const e of [c.a,c.b]){const d=o.devices.find(x=>x.id===e?.d);if(!d||!d.ports.some(p=>p.id===e.p))return {ok:false,msg:`Kabel ${c.id} merujuk port yang tidak ada.`};const k=e.d+e.p;if(used.has(k))return {ok:false,msg:`Port ganda pada kabel ${c.id}.`};used.add(k);}}
      Object.assign(this,JSON.parse(JSON.stringify({devices:o.devices,cables:o.cables,topology:o.topology||null,flags:o.flags||{},progress:o.progress||{},n:o.n||1000,cnt:o.cnt||{}})));
      this.emit('change');return {ok:true,msg:'Proyek dimuat.'};
    }catch(e){return {ok:false,msg:'Gagal memuat: '+e.message};}
  }
}

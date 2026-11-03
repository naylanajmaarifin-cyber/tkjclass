// Misi: penilaian memeriksa kondisi simulasi yang sebenarnya, bukan klik tombol "selesai".
const pcs=s=>s.devices.filter(d=>d.type==='pc');
const ip0=d=>d.ports[0].ip;
const pingOk=(s,a,b)=>!!ip0(b)&&s.probe(a,ip0(b)).ok;
const pairOk=s=>{const p=pcs(s);return p.some(a=>p.some(b=>a!==b&&pingOk(s,a,b)&&pingOk(s,b,a)));};
const base=s=>{s.clear(true);const sw=s.addDevice('switch',0,0,true),a=s.addDevice('pc',-3,0,true),b=s.addDevice('pc',3,0,true);s.autoConnect(a,sw);s.autoConnect(b,sw);return {sw,a,b};};
const cfg=(d,ip,m,gw='')=>{d.ports[0].ip=ip;d.ports[0].mask=m;d.gw=gw;};
const swPCs=s=>s.devices.filter(d=>d.type==='switch').map(sw=>s.cables.filter(c=>[c.a,c.b].some(e=>e.d===sw.id)).map(c=>s.dev((c.a.d===sw.id?c.b:c.a).d)));
export const MISSIONS=[
 {id:1,title:'Kenali perangkat jaringan',goal:'Mengenal fungsi tiap perangkat.',needs:'Perangkat bawaan lab.',steps:'Mode Select Device → klik minimal 4 jenis perangkat berbeda dan baca info-nya di panel.',hint:'Klik PC, Switch, Router, Access Point, atau Server.',
  crit:[['Memilih ≥ 4 jenis perangkat berbeda',s=>new Set(s.flags.sel||[]).size>=4]]},
 {id:2,title:'Hubungkan dua komputer secara langsung',goal:'Membuat koneksi PC ke PC.',needs:'2 PC, 1 kabel crossover.',steps:'Mode Connect Cable → pilih crossover → klik port PC-01 lalu port PC-02.',hint:'Perangkat sejenis membutuhkan kabel crossover.',
  crit:[['Ada kabel crossover PC↔PC',s=>s.cables.some(c=>c.type==='crossover'&&s.dev(c.a.d).type==='pc'&&s.dev(c.b.d).type==='pc')],['Link fisik aktif',s=>s.cables.some(c=>s.dev(c.a.d).type==='pc'&&s.dev(c.b.d).type==='pc'&&s.linkUp(c))]]},
 {id:3,title:'Buat topologi Star menggunakan switch',goal:'Menyusun Star dengan kabel nyata.',needs:'1 switch, ≥3 PC, kabel straight.',steps:'Tambah PC (palet kiri) atau pakai tab Topologi → Star. Hubungkan tiap PC ke switch dengan straight.',hint:'Port PC → port switch memakai straight-through.',
  crit:[['Satu switch terhubung ke ≥ 3 PC',s=>swPCs(s).some(l=>l.filter(d=>d.type==='pc').length>=3)],['Semua link aktif',s=>s.cables.length>0&&s.cables.every(c=>s.linkUp(c))]]},
 {id:4,title:'Atur IP Address dua komputer',goal:'Dua PC saling ping.',needs:'2 PC terhubung, IP satu subnet.',steps:'Hubungkan dua PC, isi IP mis. 192.168.10.1 dan .2 mask 255.255.255.0, lalu ping dari tab Terminal.',hint:'Gunakan contoh 192.168.10.1 & 192.168.10.2.',
  crit:[['Dua PC saling ping berhasil',pairOk]]},
 {id:5,title:'Perbaiki kesalahan subnet mask',goal:'Memperbaiki mask yang tidak cocok.',needs:'Skenario bermasalah (tombol Muat Skenario).',steps:'Muat skenario, ping dari PC-01 ke PC-02, lihat penyebabnya, perbaiki mask PC-02.',hint:'Bandingkan subnet mask kedua PC.',
  setup:s=>{const {a,b}=base(s);cfg(a,'192.168.10.1','255.255.255.0');cfg(b,'192.168.10.130','255.255.255.128');},
  crit:[['Subnet mask kedua PC sama',s=>{const p=pcs(s);return p.length>=2&&p[0].ports[0].mask&&p.every(d=>d.ports[0].mask===p[0].ports[0].mask);}],['Dua PC saling ping berhasil',pairOk]]},
 {id:6,title:'Temukan penyebab ping gagal',goal:'Diagnosis masalah fisik + IP.',needs:'Skenario bermasalah.',steps:'Muat skenario, jalankan ping (akan gagal), baca penjelasan, perbaiki semua kesalahan sampai ping berhasil.',hint:'Ada lebih dari satu masalah: kabel dan IP.',
  setup:s=>{const {sw,a,b}=base(s);s.cables=s.cables.filter(c=>![c.a,c.b].some(e=>e.d===b.id));cfg(a,'192.168.10.1','255.255.255.0');cfg(b,'192.168.10.1','255.255.255.0');},
  crit:[['Pernah menjalankan ping yang gagal',s=>!!s.flags.pingFail],['Tidak ada IP duplikat',s=>{const ips=s.ifaces(false).map(i=>i.ip);return ips.length>0&&new Set(ips).size===ips.length;}],['Dua PC saling ping berhasil',pairOk]]},
 {id:7,title:'Bangun jaringan laboratorium sederhana',goal:'LAN lengkap: PC + server + switch.',needs:'1 switch, ≥3 PC, 1 server.',steps:'Hubungkan 3 PC dan 1 server ke switch, beri IP unik satu subnet, lalu ping server dari tiap PC.',hint:'Gunakan 192.168.10.x /24.',
  crit:[['≥ 3 PC + 1 server terhubung ke switch',s=>swPCs(s).some(l=>l.filter(d=>d.type==='pc').length>=3&&l.some(d=>d.type==='server'))],['Semua PC berhasil ping server',s=>{const v=s.devices.find(d=>d.type==='server');return !!v&&pcs(s).length>=3&&pcs(s).every(p=>pingOk(s,p,v));}]]},
 {id:8,title:'Susun topologi & uji konektivitas dalam mode AR',goal:'Praktik di AR dengan model yang sama.',needs:'HP/browser dengan kamera (WebXR atau kamera).',steps:'Mulai Mode AR → tempatkan area kerja → tambah perangkat → hubungkan kabel → ping dari panel AR.',hint:'Gunakan panel AR bila menyentuh port sulit.',
  crit:[['Menempatkan ≥ 2 perangkat dalam AR',s=>(s.flags.arPlaced||0)>=2],['Menyambung ≥ 1 kabel dalam AR',s=>(s.flags.arCable||0)>=1],['Ping berhasil saat AR aktif',s=>!!s.flags.arPing]]}
];
export const evaluate=(s,m)=>m.crit.map(([l,f])=>{let ok=false;try{ok=!!f(s);}catch{}return [l,ok];});

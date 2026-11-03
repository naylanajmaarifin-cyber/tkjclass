// Template topologi: membuat perangkat + kabel NYATA di model simulasi (bukan sekadar gambar).
export const TOPO={
  star:{name:'Star (Bintang)',pros:'Mudah ditambah/dilepas; satu kabel putus hanya memutus satu PC; mudah dilacak.',cons:'Switch pusat = single point of failure; butuh banyak kabel.',use:'Hampir semua LAN kantor, sekolah, dan lab.'},
  bus:{name:'Bus',pros:'Hemat kabel, sederhana.',cons:'Backbone putus = jaringan terpecah; sulit di-troubleshoot; kinerja turun saat padat.',use:'Konsep tradisional (kabel koaksial). Di sini diwakili rantai switch sebagai backbone.'},
  ring:{name:'Ring (Cincin)',pros:'Ada jalur alternatif arah sebaliknya; akses merata.',cons:'Loop Layer-2 butuh STP agar tidak terjadi broadcast storm; menambah node mengubah cincin.',use:'Jaringan metro/backbone (mis. FDDI, ring fiber).'},
  mesh:{name:'Mesh',pros:'Redundansi tinggi; banyak jalur.',cons:'Mahal dan kompleks (full mesh: n(n−1)/2 link).',use:'Backbone WAN, jaringan inti yang butuh keandalan.'},
  p2p:{name:'Point-to-Point',pros:'Sederhana, jalur khusus dua perangkat.',cons:'Hanya untuk dua perangkat.',use:'Hubungan langsung dua komputer atau dua kantor.'}
};
const el=(i,m,rx,rz)=>{const a=2*Math.PI*i/m-Math.PI/2;return [rx*Math.cos(a),rz*Math.sin(a)];};
export function build(s,kind,n=4,full=true){
  s.clear(true);const pc=[];let N=n;
  const mkpc=(x,z)=>{const d=s.addDevice('pc',x,z,true);pc.push(d);return d;};
  if(kind==='p2p'){const a=mkpc(-2.5,0),b=mkpc(2.5,0);s.autoConnect(a,b);}
  else if(kind==='star'){N=Math.min(7,Math.max(2,n));const sw=s.addDevice('switch',0,0,true);for(let i=0;i<N;i++){const [x,z]=el(i,N,4,2.1);s.autoConnect(mkpc(x,z),sw);}}
  else{
    const lim={bus:[2,5],ring:[3,6],mesh:[3,5]}[kind];N=Math.min(lim[1],Math.max(lim[0],n));const sw=[];
    for(let i=0;i<N;i++){
      let a,b;
      if(kind==='bus'){a=[-4.5+9*i/(N-1),-1.2];b=[a[0],1.8];}else{a=el(i,N,2.4,1.1);b=el(i,N,4.3,2.3);}
      sw.push(s.addDevice('switch',a[0],a[1],true));s.autoConnect(mkpc(b[0],b[1]),sw[i]);
    }
    if(kind==='bus')for(let i=0;i<N-1;i++)s.autoConnect(sw[i],sw[i+1]);
    if(kind==='ring')for(let i=0;i<N;i++)s.autoConnect(sw[i],sw[(i+1)%N]);
    if(kind==='mesh'){if(full)for(let i=0;i<N;i++)for(let j=i+1;j<N;j++)s.autoConnect(sw[i],sw[j]);
      else{for(let i=0;i<N-1;i++)s.autoConnect(sw[i],sw[i+1]);s.autoConnect(sw[0],sw[2]);}}
  }
  pc.forEach((d,i)=>(d.ports[0].ip=`192.168.10.${i+1}`,d.ports[0].mask="255.255.255.0"));
  s.topology={kind,full,dev:s.devices.length,cab:s.cables.length};s.emit('change');
}
// Status kelengkapan berdasarkan kabel yang BENAR-BENAR ada di model.
export function status(s){
  const t=s.topology;if(!t)return {name:'Kustom',txt:`${s.devices.length} perangkat, ${s.cables.length} kabel (tanpa template)`,ok:null};
  const up=s.cables.filter(c=>s.linkUp(c)).length,miss=t.cab-s.cables.length;
  const ok=miss<=0&&s.devices.length>=t.dev&&up===s.cables.length;
  return {name:TOPO[t.kind].name,ok,txt:ok?'Lengkap: semua kabel template terpasang & link aktif.':miss>0?`Belum lengkap: kurang ${miss} kabel.`:`Ada ${s.cables.length-up} link mati (periksa daya perangkat).`};
}

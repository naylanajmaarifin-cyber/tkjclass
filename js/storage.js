// Penyimpanan proyek di LocalStorage. Video/gambar kamera TIDAK pernah disimpan.
const K='tkj_project',P='tkj_progress';
export const hasSaved=()=>!!localStorage.getItem(K);
export function save(sim){try{localStorage.setItem(K,JSON.stringify({...sim.toJSON(),saved:new Date().toISOString()}));return {ok:true,msg:'Proyek disimpan di browser ini.'};}catch(e){return {ok:false,msg:'Gagal menyimpan: '+e.message};}}
export function load(sim){try{const r=localStorage.getItem(K);if(!r)return {ok:false,msg:'Belum ada proyek tersimpan.'};return sim.load(JSON.parse(r));}catch(e){return {ok:false,msg:'Data proyek rusak: '+e.message};}}
export function exportFile(sim){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(sim.toJSON(),null,2)],{type:'application/json'}));a.download='tkjclass-proyek.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);}
export async function importFile(sim,file){try{return sim.load(JSON.parse(await file.text()));}catch(e){return {ok:false,msg:'File bukan JSON proyek yang valid.'};}}
export const saveProgress=p=>{try{localStorage.setItem(P,JSON.stringify(p));}catch{}};
export const loadProgress=()=>{try{return JSON.parse(localStorage.getItem(P))||{};}catch{return {};}};

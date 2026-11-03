# TKJClass Simulator
Simulator lab Teknik Komputer & Jaringan: 3D (Three.js) + AR kamera. Tanpa Unity, tanpa build step.

## Menjalankan
1. Butuh Python 3 (atau server statis lain) dan internet (Three.js r180 dimuat dari CDN jsDelivr via import map).
2. `python server.py` → buka **http://localhost:8000** (localhost termasuk secure context, kamera boleh).
3. **HP / perangkat lain**: kamera & WebXR wajib **HTTPS**. Buat sertifikat lalu jalankan:
   `openssl req -x509 -newkey rsa:2048 -nodes -keyout key.pem -out cert.pem -days 30 -subj "/CN=tkj"`
   `python server.py https` → buka `https://IP-KOMPUTER:8443` (terima peringatan sertifikat). Alternatif: tunnel HTTPS (mis. ngrok/cloudflared).
4. Offline penuh: unduh three@0.180.0 ke `js/vendor/` dan ubah import map di `index.html`.

## Struktur
`js/network-engine.js` (model & mesin simulasi, tanpa DOM) · `topologies.js` · `missions.js` · `storage.js` · `scene.js` (3D, kabel TubeGeometry, picking) · `ar-manager.js` · `main.js` (UI).
Mode 3D dan AR memakai **satu objek `Sim`** dan **satu scene**; AR hanya mengubah skala/lingkungan.

## AR — yang sebenarnya diimplementasikan
- **WebXR immersive-ar + hit-test** (Chrome Android dengan ARCore): reticle, tempatkan area kerja, tambah/pindah perangkat, ketuk port atau pakai panel UI. Tanpa WebXR Anchors API: bila tracking hilang, status ditampilkan dan objek tidak dijamin akurat.
- **Fallback AR kamera** (iOS Safari, browser tanpa WebXR): `getUserMedia` + sensor orientasi (3DoF). **Tidak ada tracking permukaan/anchor**: objek ditaruh di bidang asumsi ±60 cm di bawah kamera dan bisa bergeser bila HP dipindah. Di laptop: seret layar untuk memutar pandangan.
- **Marker-based AR (AR.js/MindAR) belum dibuat.** Fiber & console cable ditandai "segera".
- Kamera hanya menyala setelah dialog izin; semua stream dihentikan saat keluar. Video tidak diunggah/disimpan.

## Catatan simulasi
Ping/tracert/arp/ipconfig adalah simulasi internal. Aturan: straight untuk perangkat berbeda jenis, crossover untuk sejenis (tanpa auto-MDIX). Switch diasumsikan meneruskan frame antar-port (loop tidak dimodelkan/STP).

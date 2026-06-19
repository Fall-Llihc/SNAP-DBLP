# Analisis Jaringan Ko-Autoran DBLP (Kelompok 10)

Visual essay hasil analisis jaringan sosial (social network analysis) atas data
ko-autoran DBLP. Proyek ini merupakan tugas akhir mata kuliah Analisis Media
Sosial, disusun sebagai static site (HTML, CSS, JavaScript murni tanpa build
step) dengan D3.js v7 untuk seluruh visualisasi.

## Tentang Proyek

Analisis menelaah struktur jaringan ko-autoran dari data dump XML resmi DBLP
(dblp.org/xml/), dengan cakupan publikasi tahun 2010 sampai 2024. Fokus
analisis adalah tiga komunitas riset terbesar hasil deteksi komunitas
(algoritma Louvain), masing-masing beranggotakan 1.000 peneliti, sehingga
total jaringan terdiri atas 3.000 node dan 106.054 edge kolaborasi.

Tujuan analisis adalah mengidentifikasi aktor sentral dalam jaringan,
menjelaskan sumber pengaruh tiap aktor melalui empat metrik sentralitas
(degree, betweenness, closeness, PageRank), serta memetakan keterhubungan
antar-komunitas melalui peran hub dan broker.

### Ringkasan Temuan

- Dataset berisi 3.000 peneliti dan 106.054 kolaborasi, dengan densitas graf
  0,0236.
- Ketiga komunitas berukuran sama (1.000 peneliti), namun profil
  sentralitasnya berbeda. Komunitas A dan C jauh lebih padat (rata-rata
  derajat 94,03 dan 98,75) dibandingkan Komunitas B (19,37).
- Jaringan bersifat scale-free, distribusi derajat mengikuti power-law dengan
  eksponen α ≈ 2,3, dan bersifat small-world, dengan koefisien σ = 8,55,
  jauh di atas ambang σ = 1.
- Struktur komunitas signifikan secara statistik, dengan modularitas Q = 0,697
  pada komponen terhubung terbesar.
- Peran ekstrem tetap langka di antara 3.000 peneliti. Hanya 245 yang
  tergolong hub murni, 243 broker murni, dan 57 yang merangkap kedua peran
  sekaligus.

Rincian metodologi, batasan, dan seluruh visualisasi interaktif tersedia pada
situs itu sendiri (bagian Metode dan Properti Jaringan).

## Struktur Repo

```
docs/                    <- root yang dideploy/diserve (lihat bagian Deploy)
├── index.html
├── favicon.svg / favicon.ico / apple-touch-icon.png / icon-192.png / icon-512.png
├── site.webmanifest
├── assets/             app.css, main.js, viz-charts.js, viz-graph.js
└── data/network.json   data yang dipakai situs (lihat bagian Data)

raw/                    <- GEXF asli (taruh 3 file komunitas di sini)
├── Komunitas_A.gexf
├── Komunitas_B.gexf
└── Komunitas_C.gexf

scripts/
├── build_network_json.py   konversi raw/*.gexf -> docs/data/network.json
└── requirements.txt
```

Folder dinamai `docs/`, bukan `public/`, agar dapat dideploy tanpa
konfigurasi tambahan di beberapa platform gratis sekaligus. Rincian platform
tersedia pada bagian Deploy di bawah.

## Data

`docs/data/network.json` berisi data riil (`"meta.generated": "dblp-xml"`),
hasil langsung dari pipeline `MAIN.ipynb` (parsing DBLP XML 2010–2024,
sampling 3.000 node dari tiga komunitas terbesar; lihat skill `dblp-sna`).
Tidak ada langkah tambahan yang diperlukan untuk men-deploy data ini.

`scripts/build_network_json.py` tidak lagi diperlukan untuk alur kerja saat
ini. Script tersebut hanya berfungsi sebagai fallback untuk kasus ketika
hanya tersedia file GEXF mentah, tanpa notebook yang sudah menghasilkan
`network.json` secara langsung. Karena `MAIN.ipynb` sudah memproduksi
`network.json` dengan skema yang tepat sebagai salah satu output pipeline-nya
(lihat Tabel V dan XV pada laporan), script ini bersifat opsional. Folder
`raw/` dan `scripts/` dapat dihapus dengan aman apabila ingin merampingkan
repo, tanpa memengaruhi fungsi situs jika dibiarkan.

Apabila notebook dijalankan ulang dengan rentang tahun atau sampling yang
berbeda, `docs/data/network.json` cukup ditimpa dengan output baru. Seluruh
visualisasi (chart, leaderboard, graf eksplorer) menyesuaikan secara otomatis
karena seluruhnya dibaca dari satu berkas ini, tanpa nilai yang di-hardcode
pada kode JavaScript.

## Menjalankan Secara Lokal

```bash
npx serve -s docs
```

## Deploy

Tiga opsi gratis berikut tidak membutuhkan kartu kredit maupun risiko kuota
habis.

### Opsi A: GitHub Pages (paling sederhana, gratis selamanya, langsung dari repo ini)

1. Push repo ke GitHub.
2. Repo → Settings → Pages → Source: **Deploy from a branch** → Branch:
   `main`, folder: **/docs** → Save.
3. Tunggu sekitar satu menit hingga URL muncul di halaman yang sama
   (`https://<username>.github.io/<repo>/`).
4. Custom domain bersifat opsional melalui field "Custom domain" pada
   halaman yang sama.

Opsi ini tidak membutuhkan build command maupun akun pihak ketiga, dan tidak
memiliki batas waktu atau biaya seperti pada Railway.

### Opsi B: Vercel (CDN lebih cepat, preview deploy per PR)

1. vercel.com → Add New → Project → Import dari GitHub, pilih repo ini.
2. Framework Preset: **Other**. Root Directory: **docs**.
3. Build Command dikosongkan. Output Directory memakai nilai default.
   Deploy.

### Opsi C: Cloudflare Pages (alternatif untuk bandwidth tak terbatas)

1. Cloudflare dashboard → Workers & Pages → Create → Pages → Connect to
   Git.
2. Build command dikosongkan. Build output directory: **docs**. Deploy.

Ketiga opsi tersebut tidak membutuhkan environment variable, karena situs
bersifat fully static dan memuat `data/network.json` secara relatif.

## Tim

Proyek mata kuliah Analisis Media Sosial, disusun oleh Kelompok 10:

- Almira Faradhita Alifah (103052330069)
- Arkhan Falih Fahrie Puspita (103052330051)
- Keisha Hernantya Zahra (103052330063)

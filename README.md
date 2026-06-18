# DBLP Social Network Analysis — Kelompok 10

Visual essay analisis jaringan ko-autoran DBLP (3 komunitas riset, ~3000
peneliti). Static site (HTML/CSS/JS, tanpa build step) + D3.js v7.

## Struktur

```
docs/                    <- root yang di-deploy/serve (lihat catatan struktur di bawah)
├── index.html
├── favicon.svg / favicon.ico / apple-touch-icon.png / icon-192.png / icon-512.png
├── site.webmanifest
├── assets/             app.css, main.js, viz-charts.js, viz-graph.js
└── data/network.json   data yang dipakai website (lihat catatan di bawah)

raw/                    <- GEXF asli (taruh 3 file komunitas di sini)
├── Komunitas_A.gexf
├── Komunitas_B.gexf
└── Komunitas_C.gexf

scripts/
├── build_network_json.py   konversi raw/*.gexf -> docs/data/network.json
└── requirements.txt
```

Folder dinamai `docs/` (bukan `public/`) supaya bisa dideploy **tanpa
konfigurasi tambahan** di beberapa platform gratis sekaligus — lihat di
bawah.

## Data

`docs/data/network.json` sekarang berisi **data riil** (`"meta.generated": "dblp-xml"`) — hasil langsung dari pipeline `MAIN.ipynb` (parsing DBLP XML 2010–2024, sampling 3.000 node dari 3 komunitas terbesar, lihat skill `dblp-sna`). Tidak perlu menjalankan apa pun lagi untuk men-deploy data ini.

`scripts/build_network_json.py` **tidak lagi diperlukan** untuk alur kerja saat ini — script ini hanya fallback untuk kasus di mana kamu HANYA punya file GEXF mentah (tanpa notebook yang sudah menghasilkan `network.json` langsung). Karena `MAIN.ipynb` sudah memproduksi `network.json` dengan skema yang tepat sebagai salah satu output pipeline-nya (lihat Tabel V & XV pada laporan), script ini jadi opsional. Folder `raw/` dan `scripts/` aman untuk dihapus kalau mau merampingkan repo, tapi tidak mengganggu apa pun jika dibiarkan.

Kalau suatu saat kamu re-run notebook dengan rentang tahun/sampling berbeda, cukup timpa `docs/data/network.json` dengan output baru — seluruh visualisasi (chart, leaderboard, graf eksplorer) menyesuaikan otomatis karena semuanya dibaca dari satu file ini, tanpa nilai yang di-hardcode di JS.

## Jalankan lokal

```bash
npx serve -s docs
```

## Deploy — pilihan gratis tanpa kartu kredit, tanpa kuota habis

### Opsi A — GitHub Pages (paling sederhana, gratis selamanya, langsung dari repo ini)

1. Push repo ke GitHub.
2. Repo → Settings → Pages → Source: **Deploy from a branch** → Branch:
   `main`, folder: **/docs** → Save.
3. Tunggu ~1 menit, URL muncul di halaman yang sama
   (`https://<username>.github.io/<repo>/`).
4. Custom domain opsional lewat field "Custom domain" di halaman yang sama.

Tidak perlu build command, tidak perlu akun pihak ketiga, tidak ada limit
waktu/uang seperti Railway.

### Opsi B — Vercel (CDN lebih cepat, preview deploy per PR)

1. vercel.com → Add New → Project → Import dari GitHub, pilih repo ini.
2. Framework Preset: **Other**. Root Directory: **docs**.
3. Build Command: kosongkan. Output Directory: default. Deploy.

### Opsi C — Cloudflare Pages (alternatif kalau ingin bandwidth tak terbatas)

1. Cloudflare dashboard → Workers & Pages → Create → Pages → Connect to Git.
2. Build command: kosongkan. Build output directory: **docs**. Deploy.

Ketiganya tidak butuh environment variable — situs full static, fetch
`data/network.json` secara relatif.

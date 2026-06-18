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

## ⚠️ Data masih sintetis

`docs/data/network.json` saat ini `"meta.generated": "synthetic"` —
masih placeholder Barabási–Albert, BUKAN data DBLP asli. Generate ulang
dari 3 GEXF komunitasmu sebelum deploy final:

```bash
pip install -r scripts/requirements.txt
python scripts/build_network_json.py \
  --communities raw/Komunitas_A.gexf raw/Komunitas_B.gexf raw/Komunitas_C.gexf \
  --out docs/data/network.json
```

Kalau punya `G_3000.gexf` (gabungan dengan edge cross-community),
tambahkan `--g3000 raw/G_3000.gexf` — tanpa ini, edge antar-komunitas
kemungkinan tidak lengkap (lihat docstring di script).

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

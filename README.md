# DBLP Social Network Analysis — Kelompok 10

Visual essay analisis jaringan ko-autoran DBLP (3 komunitas riset, ~3000
peneliti). Static site (HTML/CSS/JS, tanpa build step) + D3.js v7.

## Struktur

```
public/                 <- root yang di-deploy/serve
├── index.html
├── assets/             app.css, main.js, viz-charts.js, viz-graph.js
└── data/network.json   data yang dipakai website (lihat catatan di bawah)

raw/                    <- GEXF asli (taruh 3 file komunitas di sini)
├── Komunitas_A.gexf
├── Komunitas_B.gexf
└── Komunitas_C.gexf

scripts/
├── build_network_json.py   konversi raw/*.gexf -> public/data/network.json
└── requirements.txt
```

## ⚠️ Data masih sintetis

`public/data/network.json` saat ini `"meta.generated": "synthetic"` —
masih placeholder Barabási–Albert, BUKAN data DBLP asli. Generate ulang
dari 3 GEXF komunitasmu sebelum deploy final:

```bash
pip install -r scripts/requirements.txt
python scripts/build_network_json.py \
  --communities raw/Komunitas_A.gexf raw/Komunitas_B.gexf raw/Komunitas_C.gexf \
  --out public/data/network.json
```

Kalau punya `G_3000.gexf` (gabungan dengan edge cross-community),
tambahkan `--g3000 raw/G_3000.gexf` — tanpa ini, edge antar-komunitas
kemungkinan tidak lengkap (lihat docstring di script).

## Jalankan lokal

```bash
npx serve -s public
```

## Deploy ke Railway (via GitHub)

1. Push repo ini ke GitHub.
2. Railway → New Project → Deploy from GitHub repo → pilih repo ini.
3. Railway otomatis deteksi `package.json` (Nixpacks) dan jalankan
   `npm install` → `npm start` (`serve -s public -l $PORT`).
   `railway.json` sudah set start command secara eksplisit kalau
   auto-detect gagal.
4. Generate domain publik: Settings → Networking → Generate Domain.

Tidak perlu environment variable apa pun — situs full static, fetch
`data/network.json` secara relatif.

"""
build_network_json.py
======================
Konversi 3 file GEXF per-komunitas (masing-masing ~1000 node, hasil
migrasi.ipynb §4-7) menjadi public/data/network.json sesuai skema yang
dipakai assets/main.js, viz-charts.js, viz-graph.js.

Asumsi tiap node di GEXF SUDAH punya atribut (lihat SKILL.md §"GEXF Export"):
  label, community, community_letter, degree, degree_centrality,
  betweenness_centrality, closeness_centrality, pagerank,
  composite_score, first_year

PENTING — keterbatasan edge cross-community:
  Export per-komunitas biasanya cuma induced subgraph (edge HANYA antar
  node di komunitas yang sama). Edge yang menghubungkan dua komunitas
  berbeda kemungkinan TIDAK ada di 3 file ini, karena salah satu endpoint-nya
  tidak termasuk di file tersebut. Kalau ada `G_3000.gexf` (gabungan, hasil
  §7 migrasi.ipynb) yang juga menyimpan edge cross-community, pass lewat
  --g3000 supaya edge itu ikut terhitung di meta.n_edges, degreeDistribution,
  dan graph.edges (flag cross=1). Tanpa --g3000, n_edges & graph cuma
  merefleksikan edge intra-komunitas.

Pakai:
  python scripts/build_network_json.py \
      --communities raw/Komunitas_A.gexf raw/Komunitas_B.gexf raw/Komunitas_C.gexf \
      --labels "Data Mining & Basis Data" "Machine Learning & Visi Komputer" "Jaringan & Sistem Terdistribusi" \
      --g3000 raw/G_3000.gexf \
      --out public/data/network.json
"""
import argparse
import json
from collections import Counter

import networkx as nx
import numpy as np
from scipy.stats import pearsonr, spearmanr

PALETTE = [
    {"color": "#5b8fc9"},  # Komunitas A
    {"color": "#d98a8a"},  # Komunitas B
    {"color": "#8a82c0"},  # Komunitas C
]
GRAPH_SAMPLE_PER_COMM = 165  # ~495 total node di subgraph eksplorasi (samakan dgn proyek nyata)


def load_communities(paths, labels):
    """Baca tiap GEXF komunitas, kembalikan list of nx.Graph + override id komunitas (0,1,2)."""
    graphs = []
    for i, p in enumerate(paths):
        g = nx.read_gexf(p)
        for _, attrs in g.nodes(data=True):
            attrs["community"] = i  # pastikan konsisten 0/1/2 sesuai urutan argumen
        graphs.append(g)
    return graphs


def merge_graphs(graphs, g3000_path=None):
    """Gabung semua node + edge intra-komunitas. Tambah edge cross dari G_3000 kalau tersedia."""
    G = nx.Graph()
    for g in graphs:
        G.add_nodes_from(g.nodes(data=True))
        G.add_edges_from(g.edges())

    if g3000_path:
        g3000 = nx.read_gexf(g3000_path)
        # cuma tambahkan edge yang endpoint-nya sudah ada di node set kita
        for u, v in g3000.edges():
            if u in G.nodes and v in G.nodes:
                G.add_edge(u, v)
    return G


def normalize(values):
    mx = max(values) if values else 1.0
    return [v / mx if mx else 0.0 for v in values]


def build_network_json(G, labels, shorts):
    nodes_raw = list(G.nodes(data=True))
    ids = list(G.nodes())
    id_index = {nid: i for i, nid in enumerate(ids)}

    deg = [G.degree(n) for n in ids]
    bc = [float(a.get("betweenness_centrality", 0)) for _, a in nodes_raw]
    cc = [float(a.get("closeness_centrality", 0)) for _, a in nodes_raw]
    pr = [float(a.get("pagerank", 0)) for _, a in nodes_raw]
    comm = [int(a.get("community", 0)) for _, a in nodes_raw]
    name = [a.get("label", str(n)) for n, a in nodes_raw]

    degN, bcN, ccN, prN = normalize(deg), normalize(bc), normalize(cc), normalize(pr)
    comp = [degN[i] + bcN[i] + ccN[i] + prN[i] for i in range(len(ids))]

    nodes = []
    for i, nid in enumerate(ids):
        nodes.append({
            "id": i, "name": name[i], "comm": comm[i], "deg": deg[i],
            "bc": round(bc[i], 4), "cc": round(cc[i], 4), "pr": round(pr[i], 7),
            "degN": round(degN[i], 4), "bcN": round(bcN[i], 4),
            "ccN": round(ccN[i], 4), "prN": round(prN[i], 4),
            "comp": round(comp[i], 4),
        })

    # ---- communities + profile ----
    communities, profile = [], []
    for cid in range(len(labels)):
        idxs = [i for i in range(len(ids)) if comm[i] == cid]
        size = len(idxs)
        base = {"id": cid, "label": labels[cid], "short": shorts[cid],
                "color": PALETTE[cid % 3]["color"], "size": size}
        communities.append(base)
        profile.append({
            **base,
            "avgDeg": round(float(np.mean([deg[i] for i in idxs])), 2) if idxs else 0,
            "avgDegN": round(float(np.mean([degN[i] for i in idxs])), 4) if idxs else 0,
            "avgBc": round(float(np.mean([bc[i] for i in idxs])), 4) if idxs else 0,
            "avgCc": round(float(np.mean([cc[i] for i in idxs])), 4) if idxs else 0,
            "avgPr": round(float(np.mean([pr[i] for i in idxs])), 6) if idxs else 0,
        })

    # ---- correlations ----
    metrics_raw = {"Degree": deg, "Betweenness": bc, "Closeness": cc, "PageRank": pr}
    mkeys = list(metrics_raw.keys())
    pear = [[round(float(pearsonr(metrics_raw[a], metrics_raw[b])[0]), 3) for b in mkeys] for a in mkeys]
    spear = [[round(float(spearmanr(metrics_raw[a], metrics_raw[b])[0]), 3) for b in mkeys] for a in mkeys]

    # ---- degree distribution ----
    dist = Counter(deg)
    degree_distribution = [{"deg": k, "count": v} for k, v in sorted(dist.items())]

    # ---- leaderboard (top 15 by composite) ----
    order = sorted(range(len(ids)), key=lambda i: comp[i], reverse=True)[:15]
    leaderboard = [{
        "rank": r + 1, "id": i, "name": name[i], "comm": comm[i], "deg": deg[i],
        "degN": round(degN[i], 4), "bcN": round(bcN[i], 4),
        "ccN": round(ccN[i], 4), "prN": round(prN[i], 4), "comp": round(comp[i], 4),
    } for r, i in enumerate(order)]

    # ---- graph subsample (untuk render Canvas+d3-force, BUKAN full 3000) ----
    sample_idx = []
    for cid in range(len(labels)):
        idxs = [i for i in range(len(ids)) if comm[i] == cid]
        idxs.sort(key=lambda i: comp[i], reverse=True)
        sample_idx += idxs[:GRAPH_SAMPLE_PER_COMM]
    sample_set = set(sample_idx)
    graph_nodes = [{
        "id": i, "name": name[i], "comm": comm[i], "deg": deg[i],
        "bcN": round(bcN[i], 4), "prN": round(prN[i], 4), "comp": round(comp[i], 4),
    } for i in sample_idx]
    graph_edges = []
    for u, v in G.edges():
        iu, iv = id_index[u], id_index[v]
        if iu in sample_set and iv in sample_set:
            graph_edges.append([iu, iv, int(comm[iu] != comm[iv])])

    return {
        "meta": {
            "generated": "real",
            "seed": None,
            "model": "Louvain community detection + DC/BC/CC/PR centrality (migrasi.ipynb)",
            "n_nodes": len(ids), "n_edges": G.number_of_edges(),
            "n_communities": len(labels),
            "betweenness_sources": None,
            "closeness_landmarks": None,
            "note": "Data asli dari pipeline DBLP. Edge cross-community hanya lengkap jika --g3000 disertakan.",
        },
        "communities": communities,
        "profile": profile,
        "correlations": {"metrics": mkeys, "pearson": pear, "spearman": spear},
        "degreeDistribution": degree_distribution,
        "leaderboard": leaderboard,
        "nodes": nodes,
        "graph": {"nodes": graph_nodes, "edges": graph_edges},
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--communities", nargs=3, required=True, help="3 path GEXF: A B C")
    ap.add_argument("--labels", nargs=3, default=[
        "Data Mining & Basis Data", "Machine Learning & Visi Komputer", "Jaringan & Sistem Terdistribusi"])
    ap.add_argument("--shorts", nargs=3, default=["Data Mining", "Machine Learning", "Jaringan & Sistem"])
    ap.add_argument("--g3000", default=None, help="Opsional: GEXF gabungan utk edge cross-community")
    ap.add_argument("--out", default="public/data/network.json")
    args = ap.parse_args()

    graphs = load_communities(args.communities, args.labels)
    G = merge_graphs(graphs, args.g3000)
    data = build_network_json(G, args.labels, args.shorts)

    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"OK: {args.out} | {data['meta']['n_nodes']} node, {data['meta']['n_edges']} edge")
    if not args.g3000:
        print("PERINGATAN: --g3000 tidak diisi -> edge cross-community kemungkinan hilang.")


if __name__ == "__main__":
    main()

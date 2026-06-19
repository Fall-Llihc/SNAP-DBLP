/* ============================================================
   viz-graph.js — canvas node-link renderer with d3-force
   Used by: hero (ambient) + interactive exploration section
   ============================================================ */
(function(){
  // Theme-aware color readers. Dark-mode community B (coral) is boosted a few
  // shades brighter than its light-mode counterpart: at the same lightness it
  // reads as a dull grey-pink against the near-black canvas, especially in the
  // "Semua komunitas" overview where it sits next to the brighter blue/violet.
  function isDark(){ return document.documentElement.classList.contains('dark'); }
  function ccol(){ return isDark() ? ['#6ba0d8','#f0a08c','#a89ee0'] : ['#5b8fc9','#d98a8a','#8a82c0']; }
  function cink(){ return isDark() ? ['#8dbde6','#f5b8a4','#c0b8ec'] : ['#2f5e93','#b25a5a','#5d559a']; }
  function edgeColor(cross, alpha){
    // Edges sedikit dinaikkan kontrasnya supaya tetap terbaca setelah node
    // diperkecil; cross-edges (antar-komunitas) selalu lebih terang sedikit
    // daripada edge internal supaya peran broker tetap terlihat.
    if(isDark()) return cross ? `rgba(150,180,220,${alpha})` : `rgba(125,150,190,${alpha})`;
    return cross ? `rgba(100,115,140,${alpha})` : `rgba(120,135,160,${alpha})`;
  }
  function labelBg(){ return isDark() ? 'rgba(17,24,39,0.85)' : 'rgba(255,255,255,0.85)'; }

  // Data riil (DBLP XML) jauh lebih padat daripada data sintetis lama (avg
  // degree puluhan, bukan sekitar 5). Menggambar SEMUA edge pada subgraf
  // padat membuat layout jadi gumpalan abu-abu solid yang menutupi titik
  // node — terlihat seperti "komunitas tidak muncul". Edge dibatasi acak
  // demi keterbacaan; node TIDAK pernah dikurangi, hanya garis koneksinya
  // yang disampling untuk digambar.
  //
  // Catatan revisi (Juni 2026): batas edge solo dinaikkan dibanding mode
  // multi karena pada mode solo kanvas hanya menampung satu komunitas, jadi
  // ada lebih banyak ruang dan kepadatan edge "asli" relatif terbaca tanpa
  // mengubur node-nya.
  const MAX_RENDER_EDGES_MULTI = 1500;
  const MAX_RENDER_EDGES_SOLO  = 2200;
  function sampleEdges(pool, max){
    if(pool.length<=max) return pool;
    const arr=pool.slice();
    for(let i=arr.length-1;i>0;i--){ const j=(Math.random()*(i+1))|0; const t=arr[i]; arr[i]=arr[j]; arr[j]=t; }
    return arr.slice(0, max);
  }

  // Force-layout parameters: pada mode solo kita longgarkan jaringan secara
  // signifikan (charge lebih repulsif, link lebih panjang, collide lebih
  // longgar) supaya edges tidak tertutup oleh kerumunan node. Pada mode
  // multi kita pertahankan pemisahan tiga gugus tapi tetap dengan node
  // yang lebih kecil daripada versi sebelumnya.
  function buildSim(nodes, links, w, h, solo){
    return d3.forceSimulation(nodes)
      .force('link', d3.forceLink(links).id(d=>d.id)
        .distance(l=> l.cross ? 110 : (solo ? 58 : 32))
        .strength(l=> l.cross ? 0.05 : (solo ? 0.07 : 0.13)))
      .force('charge', d3.forceManyBody()
        .strength(solo ? -150 : -55)
        .distanceMax(solo ? 480 : 320))
      .force('x', d3.forceX(d=> solo ? w*0.5 : w*0.5 + (d.comm===0?-1:d.comm===2?1:0)*w*0.20)
        .strength(solo ? 0.04 : 0.05))
      .force('y', d3.forceY(d=> solo ? h*0.5 : h*0.5 + (d.comm===1?-1:0.4)*h*0.16)
        .strength(solo ? 0.04 : 0.05))
      .force('collide', d3.forceCollide(d=> d.r + (solo ? 2.6 : 1.5)).strength(0.85))
      .force('center', d3.forceCenter(w*0.5, h*0.5).strength(0.012));
  }

  // ---- seeded PRNG (mulberry32) so the decorative hero scene is stable across reloads ----
  function mulberry32(seed){
    return function(){
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ---- HERO: ambient, non-interactive, decorative network ----
  // Deliberately NOT the real 3.000-node dataset: a force layout over the
  // actual graph looks cluttered at hero scale and is wasted weight for a
  // purely atmospheric background. This generates a small synthetic
  // "constellation" instead (seed=42, matching the analysis's reproducibility
  // seed) with three clusters sized and shaped to echo the real findings:
  // communities A and C are dense, B is comparatively sparse, with a handful
  // of cross-community bridges standing in for brokers.
  window.initHeroGraph = function(canvas){
    const ctx = canvas.getContext('2d');
    let W,H,dpr;
    const rnd = mulberry32(42);
    const CLUSTERS = [
      {comm:0, n:72, density:0.15, cx:0.30, cy:0.56, spread:0.17},
      {comm:1, n:44, density:0.045, cx:0.63, cy:0.20, spread:0.13},
      {comm:2, n:80, density:0.14, cx:0.75, cy:0.58, spread:0.19},
    ];
    const nodes=[], links=[];
    CLUSTERS.forEach(cl=>{
      const start=nodes.length;
      for(let i=0;i<cl.n;i++){
        nodes.push({ id:nodes.length, comm:cl.comm, tx:cl.cx, ty:cl.cy, r: 1.8 + rnd()*3.4 });
      }
      for(let i=start;i<nodes.length;i++){
        for(let j=i+1;j<nodes.length;j++){
          if(rnd()<cl.density) links.push({source:i, target:j, cross:false});
        }
      }
    });
    // a handful of cross-cluster bridge edges, echoing the broker role
    const bridgePairs=[[0,1],[1,2],[2,0],[0,1],[1,2],[2,0],[0,2]];
    bridgePairs.forEach(([ca,cb],k)=>{
      const A=CLUSTERS[ca], B=CLUSTERS[cb];
      const aStart=CLUSTERS.slice(0,ca).reduce((s,c)=>s+c.n,0);
      const bStart=CLUSTERS.slice(0,cb).reduce((s,c)=>s+c.n,0);
      links.push({ source: aStart + Math.floor(rnd()*A.n), target: bStart + Math.floor(rnd()*B.n), cross:true });
    });

    function resize(){
      dpr = Math.min(window.devicePixelRatio||1, 2);
      W = canvas.clientWidth; H = canvas.clientHeight;
      canvas.width = W*dpr; canvas.height = H*dpr;
      ctx.setTransform(dpr,0,0,dpr,0,0);
    }
    resize();

    function buildHeroSim(){
      return d3.forceSimulation(nodes)
        .force('link', d3.forceLink(links).id(d=>d.id).distance(l=> l.cross? 130:34).strength(l=> l.cross?0.04:0.1))
        .force('charge', d3.forceManyBody().strength(-16).distanceMax(140))
        .force('x', d3.forceX(d=> d.tx*W).strength(0.055))
        .force('y', d3.forceY(d=> d.ty*H).strength(0.055))
        .force('collide', d3.forceCollide(d=> d.r+2).strength(0.7));
    }
    const sim = buildHeroSim().alpha(0.9).alphaDecay(0.014);
    sim.stop();
    // pre-settle synchronously so a static layout renders even if rAF is throttled
    for(let i=0;i<180;i++) sim.tick();

    function draw(){
      ctx.clearRect(0,0,W,H);
      const CC=ccol();
      ctx.lineWidth = 0.7;
      for(const l of links){
        const s=l.source, t=l.target;
        ctx.strokeStyle = edgeColor(l.cross, l.cross?0.20:0.13);
        ctx.beginPath(); ctx.moveTo(s.x,s.y); ctx.lineTo(t.x,t.y); ctx.stroke();
      }
      for(const n of nodes){
        ctx.beginPath(); ctx.arc(n.x,n.y,n.r,0,6.2832);
        ctx.fillStyle = CC[n.comm]; ctx.globalAlpha = 0.85;
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    sim.on('tick', draw);
    draw(); // render the pre-settled layout immediately
    // gentle perpetual drift
    let raf;
    function breathe(){ sim.alphaTarget(0.01); raf=requestAnimationFrame(breathe); }
    setTimeout(()=>{ sim.alphaTarget(0); sim.restart(); breathe(); }, 3500);
    window.addEventListener('resize', ()=>{
      resize();
      sim.force('x', d3.forceX(d=> d.tx*W).strength(0.055));
      sim.force('y', d3.forceY(d=> d.ty*H).strength(0.055));
      sim.alpha(0.4).restart();
    });
    return sim;
  };

  // ---- INTERACTIVE EXPLORER ----
  // Catatan desain (Juni 2026): versi sebelumnya menyimpan SATU simulasi
  // berisi seluruh node, lalu "menyembunyikan" komunitas non-aktif dengan
  // memaksa posisinya ke (-9999,-9999) sambil tetap menyertakan seluruh edge
  // (puluhan ribu pada data riil) di setiap tick. Ini rapuh dan berat —
  // saat hanya 1 komunitas aktif, kepadatan edge yang sangat tinggi pada
  // data riil membuat layout terlihat seperti error/kosong. Versi ini
  // membangun ULANG simulasi yang HANYA berisi node+edge dari komunitas
  // yang sedang aktif — lebih sederhana, lebih ringan, dan tidak punya
  // mode "setengah jadi" yang bisa pecah.
  window.initExplorer = function(canvas, data, opts){
    opts = opts||{};
    const ctx = canvas.getContext('2d');
    let W,H,dpr;

    const allEdges = data.graph.edges;
    // Node radius bergantung pada view aktif. Pada mode multi (3 komunitas)
    // skala derajat dipampatkan supaya tidak ada lingkaran raksasa yang
    // menutup tetangganya; pada mode solo skala dilonggarkan sedikit
    // sehingga hub lokal masih terlihat tapi tetap jauh lebih kecil
    // daripada versi sebelumnya (yang membuat node "meledak" saat ganti
    // komunitas dan menutupi seluruh edges).
    function nodeRadius(deg, solo){
      const d = Math.max(0, deg||0);
      return solo
        ? 1.8 + Math.sqrt(d)*0.42
        : 1.8 + Math.min(Math.sqrt(d), 10)*0.32;
    }
    const allNodes = data.graph.nodes.map(n=>({...n, r: nodeRadius(n.deg, false)}));

    let nodes = allNodes, links = [];
    let sim = null;
    let activeComm = new Set([0,1,2]);
    let hovered=null, focused=null, search='';
    let transform = d3.zoomIdentity;

    function resize(){
      dpr = Math.min(window.devicePixelRatio||1,2);
      W=canvas.clientWidth; H=canvas.clientHeight;
      canvas.width=W*dpr; canvas.height=H*dpr;
      ctx.setTransform(dpr,0,0,dpr,0,0);
    }
    resize();

    const tip = document.getElementById('tip');
    function showTip(n, mx, my){
      tip.innerHTML = `<div class="t-name">${n.name}</div>`+
        `<div class="t-comm" style="color:${ccol()[n.comm]}">${data.communities[n.comm].short}</div>`+
        `<div class="t-row"><span>Derajat</span><b>${n.deg}</b></div>`+
        `<div class="t-row"><span>Skor pengaruh</span><b>${n.comp.toFixed(2)}</b></div>`;
      tip.style.opacity=1;
      const tw=tip.offsetWidth, th=tip.offsetHeight;
      let x=mx+16, y=my+16;
      if(x+tw>window.innerWidth-12) x=mx-tw-16;
      if(y+th>window.innerHeight-12) y=my-th-16;
      tip.style.left=x+'px'; tip.style.top=y+'px';
    }
    function hideTip(){ tip.style.opacity=0; }
    function matchSearch(n){ return search && n.name.toLowerCase().includes(search); }

    function draw(){
      ctx.save();
      ctx.clearRect(0,0,W,H);
      ctx.translate(transform.x, transform.y); ctx.scale(transform.k, transform.k);
      const CC=ccol(), CI=cink();
      const neigh = new Set();
      const hl = focused||hovered;
      if(hl){ neigh.add(hl.id); for(const l of links){ if(l.source.id===hl.id) neigh.add(l.target.id); if(l.target.id===hl.id) neigh.add(l.source.id); } }
      // edges
      for(const l of links){
        const s=l.source,t=l.target;
        // alpha dasar dinaikkan dari versi sebelumnya (0.11/0.18) supaya
        // garis koneksi tetap terbaca di belakang node yang sudah lebih
        // kecil. Saat ada node yang di-hover/di-klik, edges yang tidak
        // bertetangga tetap diredam supaya neighborhood-nya menonjol.
        let alpha = l.cross? 0.34 : 0.22;
        if(hl){ alpha = (neigh.has(s.id)&&neigh.has(t.id)) ? 0.55 : 0.04; }
        const hlEdge = hl&&neigh.has(s.id)&&neigh.has(t.id);
        ctx.strokeStyle = hlEdge ? (isDark()?'rgba(107,160,216,0.65)':'rgba(74,127,192,0.55)') : edgeColor(l.cross, alpha);
        ctx.lineWidth = hlEdge?1.3:0.85;
        ctx.beginPath(); ctx.moveTo(s.x,s.y); ctx.lineTo(t.x,t.y); ctx.stroke();
      }
      // nodes (array `nodes` sudah berisi hanya komunitas aktif — tidak perlu filter lagi)
      for(const n of nodes){
        const isMatch = matchSearch(n);
        let alpha = 0.9;
        if(hl){ alpha = neigh.has(n.id)?1:0.12; }
        if(search){ alpha = isMatch?1:(alpha*0.25); }
        ctx.globalAlpha = alpha;
        ctx.beginPath(); ctx.arc(n.x,n.y,n.r,0,6.2832);
        ctx.fillStyle = CC[n.comm]; ctx.fill();
        if((hl&&n.id===hl.id)||isMatch){ ctx.lineWidth=1.6; ctx.strokeStyle=isDark()?'#111827':'#fff'; ctx.stroke(); ctx.lineWidth=2.4; ctx.strokeStyle=CI[n.comm]; ctx.stroke(); }
      }
      ctx.globalAlpha=1;
      // labels untuk top-N (di-tandai _label saat rebuild), node yang
      // di-hover/klik, dan node yang cocok dengan pencarian.
      ctx.font='600 11px "Helvetica Neue",Helvetica,Arial';
      ctx.textBaseline='middle';
      for(const n of nodes){
        const isMatch = matchSearch(n);
        const show = (hl&&n.id===hl.id) || isMatch || (!hl&&!search&&n._label);
        if(!show) continue;
        ctx.globalAlpha = 1;
        const tx=n.x+n.r+4, ty=n.y;
        ctx.fillStyle=labelBg();
        const tw=ctx.measureText(n.name).width;
        ctx.fillRect(tx-2,ty-7,tw+4,14);
        ctx.fillStyle=CI[n.comm]; ctx.fillText(n.name,tx,ty);
      }
      ctx.restore();
    }

    function buildLinksFor(nodeArr, solo){
      const idSet = new Set(nodeArr.map(n=>n.id));
      const pool = [];
      for(const e of allEdges){ if(idSet.has(e[0]) && idSet.has(e[1])) pool.push(e); }
      const cap = solo ? MAX_RENDER_EDGES_SOLO : MAX_RENDER_EDGES_MULTI;
      return sampleEdges(pool, cap).map(e=>({source:e[0],target:e[1],cross:e[2]===1}));
    }

    // (re)build a fresh simulation scoped to exactly the active communities.
    // animate=false -> synchronous pre-settle (used on first load, no jank).
    // animate=true  -> live d3 transition (used on filter changes, feels responsive).
    function rebuild(animate){
      if(sim) sim.stop();
      const solo = activeComm.size===1;
      nodes = allNodes.filter(n=>activeComm.has(n.comm));
      for(const n of nodes) n.r = nodeRadius(n.deg, solo);
      links = buildLinksFor(nodes, solo);
      // Tandai node mana yang layak diberi label permanen — dibatasi
      // top-12 (multi) / top-10 (solo) berdasarkan composite score di
      // dalam scope view aktif. Tanpa pembatasan ini, mode solo Komunitas
      // A akan menampilkan ~36 label sekaligus dan saling tumpang tindih.
      const N_LABELS = solo ? 10 : 12;
      const ranked = nodes.slice().sort((a,b)=>(b.comp||0)-(a.comp||0));
      const labelSet = new Set(ranked.slice(0, N_LABELS).map(n=>n.id));
      for(const n of nodes) n._label = labelSet.has(n.id);
      sim = buildSim(nodes, links, W, H, solo);
      if(animate){
        // alpha lebih lama supaya layout punya waktu menyebar setelah
        // collide+charge yang baru lebih longgar; tanpa ini node baru
        // berhenti saat masih bertumpuk
        sim.alpha(1).alphaDecay(solo?0.018:0.020);
      } else {
        sim.stop();
        const ticks = solo ? 280 : 240;
        for(let i=0;i<ticks;i++) sim.tick();
      }
      sim.on('tick', draw);
      draw();
      if(animate) sim.restart();
    }
    rebuild(false);

    function findNode(mx,my){
      const x=(mx-transform.x)/transform.k, y=(my-transform.y)/transform.k;
      let best=null,bd=1e9;
      for(const n of nodes){ const dx=n.x-x,dy=n.y-y,d=dx*dx+dy*dy; const rr=(n.r+4)*(n.r+4); if(d<rr&&d<bd){bd=d;best=n;} }
      return best;
    }
    const rect=()=>canvas.getBoundingClientRect();
    canvas.addEventListener('mousemove', ev=>{
      const r=rect(); const mx=ev.clientX-r.left, my=ev.clientY-r.top;
      const n=findNode(mx,my);
      if(n){ hovered=n; canvas.style.cursor='pointer'; showTip(n, ev.clientX, ev.clientY); }
      else{ hovered=null; canvas.style.cursor='grab'; hideTip(); }
      draw();
    });
    canvas.addEventListener('mouseleave', ()=>{ hovered=null; hideTip(); draw(); });
    canvas.addEventListener('click', ev=>{
      const r=rect(); const n=findNode(ev.clientX-r.left, ev.clientY-r.top);
      focused = (focused&&n&&focused.id===n.id)?null:n;
      draw();
    });

    // zoom/pan
    d3.select(canvas).call(d3.zoom().scaleExtent([0.5,5]).on('zoom', ev=>{ transform=ev.transform; draw(); }));

    // controls API
    const api = {
      setComm(set){
        activeComm = new Set(set);
        api.reset();
        rebuild(true);
      },
      setSearch(s){ search=(s||'').toLowerCase().trim(); draw(); },
      reset(){ transform=d3.zoomIdentity; d3.select(canvas).call(d3.zoom().transform, d3.zoomIdentity); focused=null; draw(); },
      restart(){ if(sim) sim.alpha(0.5).restart(); }
    };
    window.addEventListener('resize', ()=>{ resize(); if(sim) sim.force('center', d3.forceCenter(W*0.5,H*0.5)); if(sim) sim.alpha(0.3).restart(); });
    return api;
  };
})();

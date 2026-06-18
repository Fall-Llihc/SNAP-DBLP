/* ============================================================
   viz-graph.js — canvas node-link renderer with d3-force
   Used by: hero (ambient) + interactive exploration section
   ============================================================ */
(function(){
  // Theme-aware color readers
  function isDark(){ return document.documentElement.classList.contains('dark'); }
  function ccol(){ return isDark() ? ['#6ba0d8','#e09e9e','#9d96d0'] : ['#5b8fc9','#d98a8a','#8a82c0']; }
  function cink(){ return isDark() ? ['#8dbde6','#e8b0b0','#b5afe0'] : ['#2f5e93','#b25a5a','#5d559a']; }
  function edgeColor(cross, alpha){
    if(isDark()) return cross ? `rgba(100,120,160,${alpha})` : `rgba(80,95,130,${alpha})`;
    return cross ? `rgba(120,130,150,${alpha})` : `rgba(140,150,168,${alpha})`;
  }
  function labelBg(){ return isDark() ? 'rgba(17,24,39,0.85)' : 'rgba(255,255,255,0.85)'; }

  // Data riil (DBLP XML) jauh lebih padat daripada data sintetis lama (avg
  // degree puluhan, bukan sekitar 5). Menggambar SEMUA edge pada subgraf
  // padat membuat layout jadi gumpalan abu-abu solid yang menutupi titik
  // node — terlihat seperti "komunitas tidak muncul". Edge dibatasi acak
  // demi keterbacaan; node TIDAK pernah dikurangi, hanya garis koneksinya
  // yang disampling untuk digambar.
  const MAX_RENDER_EDGES = 1500;
  function sampleEdges(pool){
    if(pool.length<=MAX_RENDER_EDGES) return pool;
    const arr=pool.slice();
    for(let i=arr.length-1;i>0;i--){ const j=(Math.random()*(i+1))|0; const t=arr[i]; arr[i]=arr[j]; arr[j]=t; }
    return arr.slice(0, MAX_RENDER_EDGES);
  }

  function buildSim(nodes, links, w, h, solo){
    return d3.forceSimulation(nodes)
      .force('link', d3.forceLink(links).id(d=>d.id).distance(l=> l.cross? 90:26).strength(l=> l.cross?0.06:0.16))
      .force('charge', d3.forceManyBody().strength(solo? -42 : -26).distanceMax(solo?360:260))
      .force('x', d3.forceX(d=> solo ? w*0.5 : w*0.5 + (d.comm===0?-1:d.comm===2?1:0)*w*0.20).strength(solo?0.07:0.045))
      .force('y', d3.forceY(d=> solo ? h*0.5 : h*0.5 + (d.comm===1?-1:0.4)*h*0.16).strength(solo?0.07:0.045))
      .force('collide', d3.forceCollide(d=> d.r+1.2).strength(0.7))
      .force('center', d3.forceCenter(w*0.5, h*0.5).strength(0.02));
  }

  // ---- HERO: ambient, non-interactive, slow drift ----
  window.initHeroGraph = function(canvas, data){
    const ctx = canvas.getContext('2d');
    let W,H,dpr;
    const nodes = data.graph.nodes.map(n=>({...n, r: 1.6 + Math.sqrt(n.deg)*0.62}));
    const links = sampleEdges(data.graph.edges).map(e=>({source:e[0],target:e[1],cross:e[2]===1}));

    function resize(){
      dpr = Math.min(window.devicePixelRatio||1, 2);
      W = canvas.clientWidth; H = canvas.clientHeight;
      canvas.width = W*dpr; canvas.height = H*dpr;
      ctx.setTransform(dpr,0,0,dpr,0,0);
    }
    resize();
    const sim = buildSim(nodes, links, W, H, false).alpha(0.9).alphaDecay(0.012);
    sim.stop();
    // pre-settle synchronously so a static layout renders even if rAF is throttled
    for(let i=0;i<160;i++) sim.tick();

    function draw(){
      ctx.clearRect(0,0,W,H);
      // edges
      const CC=ccol();
      ctx.lineWidth = 0.6;
      for(const l of links){
        const s=l.source, t=l.target;
        ctx.strokeStyle = edgeColor(l.cross, l.cross?0.16:0.10);
        ctx.beginPath(); ctx.moveTo(s.x,s.y); ctx.lineTo(t.x,t.y); ctx.stroke();
      }
      // nodes
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
    function breathe(){ sim.alphaTarget(0.012); raf=requestAnimationFrame(breathe); }
    setTimeout(()=>{ sim.alphaTarget(0); sim.restart(); breathe(); }, 3500);
    window.addEventListener('resize', ()=>{ resize(); sim.force('center', d3.forceCenter(W*0.5,H*0.5).strength(0.02)); sim.force('x', d3.forceX(d=> W*0.5 + (d.comm===0?-1:d.comm===2?1:0)*W*0.20).strength(0.045)); sim.force('y', d3.forceY(d=> H*0.5 + (d.comm===1?-1:0.4)*H*0.16).strength(0.045)); sim.alpha(0.4).restart(); });
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
    const allNodes = data.graph.nodes.map(n=>({...n, r: 2.2 + Math.sqrt(n.deg)*0.78}));

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
        let alpha = l.cross? 0.18:0.11;
        if(hl){ alpha = (neigh.has(s.id)&&neigh.has(t.id)) ? 0.55 : 0.04; }
        const hlEdge = hl&&neigh.has(s.id)&&neigh.has(t.id);
        ctx.strokeStyle = hlEdge ? (isDark()?'rgba(107,160,216,0.6)':'rgba(74,127,192,0.5)') : edgeColor(l.cross, alpha);
        ctx.lineWidth = hlEdge?1.1:0.6;
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
      // labels for top nodes / hovered / matches
      ctx.font='600 11px "Helvetica Neue",Helvetica,Arial';
      ctx.textBaseline='middle';
      for(const n of nodes){
        const isMatch = matchSearch(n);
        const big = n.comp>2.0;
        const show = (hl&&n.id===hl.id) || isMatch || (!hl&&!search&&big);
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

    function buildLinksFor(nodeArr){
      const idSet = new Set(nodeArr.map(n=>n.id));
      const pool = [];
      for(const e of allEdges){ if(idSet.has(e[0]) && idSet.has(e[1])) pool.push(e); }
      return sampleEdges(pool).map(e=>({source:e[0],target:e[1],cross:e[2]===1}));
    }

    // (re)build a fresh simulation scoped to exactly the active communities.
    // animate=false -> synchronous pre-settle (used on first load, no jank).
    // animate=true  -> live d3 transition (used on filter changes, feels responsive).
    function rebuild(animate){
      if(sim) sim.stop();
      nodes = allNodes.filter(n=>activeComm.has(n.comm));
      links = buildLinksFor(nodes);
      const solo = activeComm.size===1;
      sim = buildSim(nodes, links, W, H, solo);
      if(animate){
        sim.alpha(0.9).alphaDecay(solo?0.022:0.018);
      } else {
        sim.stop();
        for(let i=0;i<220;i++) sim.tick();
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

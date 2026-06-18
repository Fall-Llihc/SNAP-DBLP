/* ============================================================
   main.js — orchestration: load data, scrollytelling, controls
   ============================================================ */
(function(){
  const CCOL_L=['#5b8fc9','#d98a8a','#8a82c0'];
  const CCOL_D=['#6ba0d8','#e09e9e','#9d96d0'];
  function CC(){ return document.documentElement.classList.contains('dark')?CCOL_D:CCOL_L; }
  let DATA=null, explorer=null;

  // Track which charts have been built (for rebuild on theme change)
  const builtCharts=new Set();

  // ---------- DARK MODE ----------
  const dmToggle=document.getElementById('dm-toggle');
  function applyDark(on){
    document.documentElement.classList.toggle('dark', on);
    try{ localStorage.setItem('sa-dark', on?'1':'0'); }catch(e){}
    // update canvas backgrounds
    document.querySelectorAll('#explorer-canvas').forEach(c=>c.style.background= on?'#151d2e':'#fcfdfe');
    // rebuild all rendered charts so they pick up new theme colors
    rebuildCharts();
    // force canvas redraws (canvas reads isDark() on each draw call)
    if(explorer) explorer.restart();
  }
  function rebuildCharts(){
    if(!DATA) return;
    if(builtCharts.has('komunitas')){ communitySizeBar('#chart-size',DATA); communityProfileHeatmap('#chart-profile',DATA); }
    if(builtCharts.has('aktor')){ leaderboardBar('#chart-leaderboard',DATA); buildLeaderboardLegend(); }
    if(builtCharts.has('broker')) hubBrokerScatter('#chart-scatter',DATA);
    if(builtCharts.has('sentralitas')){ parallelCoords('#chart-parallel',DATA); correlationHeatmaps('#chart-pearson','#chart-spearman',DATA); }
    if(builtCharts.has('properti')) degreeCCDF('#chart-ccdf',DATA);
    // rebuild community cards (they have inline colors)
    buildCommCards();
  }
  // restore preference
  (function(){
    let stored=null; try{ stored=localStorage.getItem('sa-dark'); }catch(e){}
    if(stored==='1') applyDark(true);
    else if(stored===null && window.matchMedia('(prefers-color-scheme:dark)').matches) applyDark(true);
  })();
  dmToggle.addEventListener('click',()=>applyDark(!document.documentElement.classList.contains('dark')));

  // ---------- INFO POPOVERS ----------
  const INFO_TEXT={
    'graph': '<p class="ip-title">Mengapa graf node-link?</p><p>Graf node-link secara natural merepresentasikan jaringan sosial — titik = aktor, garis = relasi. Layout <em>force-directed</em> memposisikan node terhubung berdekatan sehingga kluster komunitas terungkap secara organik tanpa harus menentukan posisi manual.</p>',
    'size-bar': '<p class="ip-title">Mengapa bar chart?</p><p>Untuk membandingkan magnitudo antar kategori, panjang bar adalah encoding paling akurat secara persepsi (Cleveland &amp; McGill, 1984). Pembaca langsung menangkap perbandingan ukuran relatif tiap komunitas.</p>',
    'profile-heatmap': '<p class="ip-title">Mengapa heatmap?</p><p>Data berbentuk matriks (metrik × komunitas). Heatmap memetakan nilai ke intensitas warna sehingga pola "komunitas mana paling sentral di metrik apa" langsung terbaca dalam satu grid — lebih ringkas daripada beberapa bar chart terpisah.</p>',
    'leaderboard': '<p class="ip-title">Mengapa stacked horizontal bar?</p><p>Bar horizontal memudahkan membaca label nama yang panjang. <em>Stacking</em> komponen ternormalisasi (DC/BC/CC/PR) menjawab bukan hanya "siapa peringkat 1" tapi "mengapa" — apakah ia kuat karena populer, broker, atau merata.</p>',
    'scatter': '<p class="ip-title">Mengapa scatter plot?</p><p>Pertanyaan "populer = penghubung?" adalah relasi dua variabel kontinu. Scatter mengungkap pola sebaran: node di kuadran berbeda menunjukkan peran berbeda (hub lokal vs broker murni vs keduanya).</p>',
    'parallel': '<p class="ip-title">Mengapa parallel coordinates?</p><p>Untuk membandingkan empat metrik pada entitas yang sama, scatter hanya menampung 2 sumbu. Parallel coordinates menempatkan tiap metrik sebagai sumbu vertikal — garis naik-turun menunjukkan aktor dominan di satu metrik namun biasa di metrik lain.</p>',
    'correlation': '<p class="ip-title">Mengapa heatmap korelasi?</p><p>Matriks simetris paling efisien divisualisasikan sebagai grid warna. Menampilkan Pearson (linear) dan Spearman (peringkat) berdampingan mengungkap di mana <em>outlier</em> mendistorsi hubungan — perbedaan keduanya sendiri menjadi temuan.</p>',
    'ccdf': '<p class="ip-title">Mengapa CCDF log-log?</p><p>CCDF (fungsi distribusi kumulatif komplementer) pada skala log-log adalah standar uji power-law (Clauset dkk., 2009). Lebih halus dari histogram karena tidak terganggu <em>binning noise</em> di ekor, dan power-law sejati tampak sebagai garis lurus.</p>'
  };
  let openPopover=null;
  function closePopover(){ if(openPopover){ openPopover.remove(); openPopover=null; } }
  document.addEventListener('click', function(e){
    const btn=e.target.closest('.info-btn');
    if(!btn){ closePopover(); return; }
    e.stopPropagation();
    const key=btn.dataset.info;
    if(openPopover && openPopover._key===key){ closePopover(); return; }
    closePopover();
    const pop=document.createElement('div');
    pop.className='info-popover';
    pop._key=key;
    pop.innerHTML=INFO_TEXT[key]||'<p>Info tidak tersedia.</p>';
    btn.style.position='relative';
    btn.appendChild(pop);
    requestAnimationFrame(()=>requestAnimationFrame(()=>pop.classList.add('open')));
    openPopover=pop;
  });
  document.addEventListener('keydown',e=>{ if(e.key==='Escape') closePopover(); });

  // ---------- unified scroll-driven engine (IntersectionObserver is unreliable here) ----------
  const progress=document.getElementById('progress');
  const topbar=document.getElementById('topbar');
  const navLinks=[...document.querySelectorAll('#nav a')];
  const navMap=new Map(navLinks.map(a=>[a.getAttribute('href').slice(1),a]));
  const sectionIds=['jaringan','komunitas','aktor','broker','sentralitas','properti','metode','kontributor'];
  let revealEls=[];
  const chartBuilders={};  // id -> fn, registered after data load

  function refreshReveals(){ revealEls=[...document.querySelectorAll('.reveal:not(.in)')]; }

  let ticking=false;
  function tick(){
    ticking=false;
    const winH=window.innerHeight;
    const st=window.scrollY||document.documentElement.scrollTop;
    const docH=document.documentElement.scrollHeight-winH;
    progress.style.width=(docH>0?(st/docH)*100:0)+'%';
    topbar.classList.toggle('scrolled', st>30);
    // reveals
    for(let i=revealEls.length-1;i>=0;i--){ const el=revealEls[i]; const r=el.getBoundingClientRect(); if(r.top < winH*0.90 && r.bottom>0){ el.classList.add('in'); revealEls.splice(i,1); } }
    // lazy chart init
    for(const id in chartBuilders){ const el=document.getElementById(id); if(!el) continue; const r=el.getBoundingClientRect(); if(r.top < winH*0.92 && r.bottom>0){ const fn=chartBuilders[id]; delete chartBuilders[id]; fn(); } }
    // nav active
    const mid=winH*0.42; let activeId=null;
    for(const id of sectionIds){ const el=document.getElementById(id); if(!el) continue; const r=el.getBoundingClientRect(); if(r.top<=mid && r.bottom>mid){ activeId=id; break; } }
    navLinks.forEach(a=>a.classList.toggle('active', activeId && a.getAttribute('href').slice(1)===activeId));
  }
  function onScroll(){ if(!ticking){ ticking=true; requestAnimationFrame(tick); } }
  window.addEventListener('scroll', onScroll, {passive:true});
  window.addEventListener('resize', onScroll, {passive:true});
  refreshReveals(); tick();
  // safety re-checks (layout/fonts settling)
  [120,400,900].forEach(d=>setTimeout(()=>{ refreshReveals(); tick(); }, d));

  // ---------- count-up (hero stats) ----------
  function countUp(el){
    const target=+el.dataset.count; const dur=1300; const start=performance.now();
    function step(t){ const p=Math.min((t-start)/dur,1); const e=1-Math.pow(1-p,3); el.textContent=Math.round(target*e).toLocaleString('id'); if(p<1) requestAnimationFrame(step); }
    requestAnimationFrame(step);
  }

  // ---------- register lazy chart builders ----------
  function registerCharts(){
    chartBuilders['jaringan']=()=>{ builtCharts.add('jaringan'); initExplorerSection(); };
    chartBuilders['komunitas']=()=>{ builtCharts.add('komunitas'); communitySizeBar('#chart-size',DATA); communityProfileHeatmap('#chart-profile',DATA); };
    chartBuilders['aktor']=()=>{ builtCharts.add('aktor'); leaderboardBar('#chart-leaderboard',DATA); buildLeaderboardLegend(); };
    chartBuilders['broker']=()=>{ builtCharts.add('broker'); hubBrokerScatter('#chart-scatter',DATA); };
    chartBuilders['sentralitas']=()=>{ builtCharts.add('sentralitas'); parallelCoords('#chart-parallel',DATA); correlationHeatmaps('#chart-pearson','#chart-spearman',DATA); };
    chartBuilders['properti']=()=>{ builtCharts.add('properti'); degreeCCDF('#chart-ccdf',DATA); };
  }

  // ---------- community cards ----------
  function buildCommCards(){
    const wrap=document.getElementById('comm-cards'); if(!wrap||!DATA) return;
    const dark=document.documentElement.classList.contains('dark');
    const ci=dark?['#8dbde6','#e8b0b0','#b5afe0']:['#2f5e93','#b25a5a','#5d559a'];
    const cc=dark?['#6ba0d8','#e09e9e','#9d96d0']:['#5b8fc9','#d98a8a','#8a82c0'];
    const desc=['Basis data, penambangan pola, sistem rekomendasi.','Pembelajaran mesin, jaringan saraf, visi komputer.','Protokol, sistem terdistribusi, keamanan jaringan.'];
    wrap.innerHTML=DATA.profile.map((p,i)=>`
      <div class="comm-card">
        <div class="bar" style="background:${cc[i]}"></div>
        <div class="ctag" style="color:${ci[i]}">Komunitas ${String.fromCharCode(65+i)}</div>
        <h3>${p.short}</h3>
        <div class="csize">${p.size.toLocaleString('id')}</div>
        <div class="cdesc">peneliti · derajat rata-rata ${p.avgDeg}</div>
        <div class="cdesc" style="margin-top:10px;color:var(--body)">${desc[i]}</div>
      </div>`).join('');
  }

  function buildLeaderboardLegend(){
    const dark=document.documentElement.classList.contains('dark');
    const comps=[['Derajat',dark?'#6ba0d8':'#5b8fc9'],['Betweenness',dark?'#7dadd4':'#7BA5D6'],['Closeness',dark?'#e09e9e':'#d98a8a'],['PageRank',dark?'#9d96d0':'#8a82c0']];
    document.getElementById('leaderboard-legend').innerHTML=comps.map(c=>`<span class="item"><span class="dot" style="background:${c[1]}"></span>${c[0]}</span>`).join('');
  }

  // ---------- explorer section ----------
  function initExplorerSection(){
    const canvas=document.getElementById('explorer-canvas');
    explorer=initExplorer(canvas, DATA);
    const active=new Set([0,1,2]);
    // view tabs (per-community focus)
    const views=document.getElementById('explorer-views');
    const cc=CC();
    const tabs=[{v:'all',l:'Semua komunitas',c:'#1b2330'}].concat(DATA.communities.map((c,i)=>({v:String(i),l:c.short,c:cc[i]})));
    views.innerHTML=tabs.map(t=>`<span class="vtab${t.v==='all'?' active':''}" data-view="${t.v}"><span class="vdot" style="background:${t.c}"></span>${t.l}</span>`).join('');
    const leg=document.getElementById('explorer-legend');
    leg.innerHTML=DATA.communities.map((c,i)=>`<span class="item" data-c="${i}"><span class="dot" style="background:${cc[i]}"></span>${c.label}</span>`).join('');

    function syncLegend(){ leg.querySelectorAll('.item').forEach(it=>{ it.classList.toggle('off', !active.has(+it.dataset.c)); }); }
    function syncTabs(){
      views.querySelectorAll('.vtab').forEach(t=>{
        const v=t.dataset.view;
        const on = v==='all' ? active.size===3 : (active.size===1 && active.has(+v));
        t.classList.toggle('active', on);
      });
    }
    function apply(){ explorer.setComm(new Set(active)); syncLegend(); syncTabs(); }

    views.querySelectorAll('.vtab').forEach(t=>{
      t.addEventListener('click',()=>{
        const v=t.dataset.view;
        active.clear();
        if(v==='all'){ [0,1,2].forEach(x=>active.add(x)); }
        else { active.add(+v); }
        explorer.setSearch(''); const sb=document.getElementById('explorer-search'); if(sb) sb.value='';
        apply();
      });
    });
    leg.querySelectorAll('.item').forEach(it=>{
      it.addEventListener('click',()=>{
        const c=+it.dataset.c;
        if(active.has(c)){ active.delete(c); } else { active.add(c); }
        if(active.size===0){ active.add(c); }
        apply();
      });
    });
    document.getElementById('explorer-search').addEventListener('input', e=>explorer.setSearch(e.target.value));
    document.getElementById('explorer-reset').addEventListener('click',()=>{ active.clear(); [0,1,2].forEach(x=>active.add(x)); document.getElementById('explorer-search').value=''; explorer.setSearch(''); apply(); explorer.reset(); });
    syncTabs(); syncLegend();
    explorer.restart();
  }

  // ---------- boot ----------
  fetch('data/network.json').then(r=>r.json()).then(data=>{
    DATA=data;
    initHeroGraph(document.getElementById('hero-canvas'), DATA);
    buildCommCards();
    registerCharts();
    refreshReveals(); tick();
    setTimeout(()=>document.querySelectorAll('.hero-meta .num[data-count]').forEach(countUp), 500);
  }).catch(err=>{
    console.error('Gagal memuat data:', err);
    document.querySelector('.hero-inner').insertAdjacentHTML('beforeend','<p style="color:#b25a5a;font-family:var(--mono);font-size:13px;margin-top:20px">Gagal memuat data/network.json</p>');
  });
})();

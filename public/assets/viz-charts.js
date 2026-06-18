/* ============================================================
   viz-charts.js — D3 SVG charts (theme-aware)
   communitySizeBar · communityProfileHeatmap · leaderboardBar
   hubBrokerScatter · parallelCoords · correlationHeatmaps · degreeCCDF
   ============================================================ */
(function(){
  // Theme reader — pulls live CSS custom properties so charts adapt to dark mode
  function T(){
    const s=getComputedStyle(document.documentElement); const v=k=>s.getPropertyValue(k).trim();
    return {
      ink:v('--ink'), inkSoft:v('--ink-soft'), body:v('--body'),
      muted:v('--muted'), faint:v('--faint'),
      hair:v('--hair'), hairSoft:v('--hair-soft'),
      bg:v('--bg'), bgSoft:v('--bg-soft'),
      c:[v('--c0'),v('--c1'),v('--c2')],
      ci:[v('--c0-ink'),v('--c1-ink'),v('--c2-ink')],
      cw:[v('--c0-wash'),v('--c1-wash'),v('--c2-wash')],
      accent:v('--accent'),
      dark:document.documentElement.classList.contains('dark')
    };
  }

  const tip = ()=>document.getElementById('tip');
  function moveTip(html, ev){ const t=tip(); t.innerHTML=html; t.style.opacity=1; const tw=t.offsetWidth,th=t.offsetHeight; let x=ev.clientX+16,y=ev.clientY+16; if(x+tw>innerWidth-12)x=ev.clientX-tw-16; if(y+th>innerHeight-12)y=ev.clientY-th-16; t.style.left=x+'px'; t.style.top=y+'px'; }
  function hideTip(){ tip().style.opacity=0; }
  function svg(sel,w,h){ d3.select(sel).selectAll('*').remove(); return d3.select(sel).append('svg').attr('viewBox',`0 0 ${w} ${h}`).attr('width','100%').attr('height',h).style('overflow','visible'); }

  // ---- 1. COMMUNITY SIZE BAR ----
  window.communitySizeBar = function(sel, data){
    const t=T();
    const w=560,h=300,m={t:14,r:20,b:46,l:54};
    const s=svg(sel,w,h);
    const P=data.profile;
    const x=d3.scaleBand().domain(P.map(p=>p.short)).range([m.l,w-m.r]).padding(0.42);
    const y=d3.scaleLinear().domain([0,d3.max(P,p=>p.size)*1.12]).range([h-m.b,m.t]);
    s.append('g').attr('class','grid').attr('transform',`translate(${m.l},0)`).call(d3.axisLeft(y).ticks(5).tickSize(-(w-m.l-m.r)).tickFormat('')).select('.domain').remove();
    s.append('g').attr('transform',`translate(0,${h-m.b})`).attr('class','axis').call(d3.axisBottom(x).tickSize(0)).call(g=>g.select('.domain').attr('stroke',t.hair)).selectAll('text').attr('dy','1.4em').style('font-family',"'Helvetica Neue',Arial").style('font-size','12px').style('fill',t.inkSoft).style('font-weight','600');
    s.append('g').attr('transform',`translate(${m.l},0)`).attr('class','axis').call(d3.axisLeft(y).ticks(5).tickFormat(d3.format('~s'))).call(g=>g.selectAll('text').style('fill',t.muted)).select('.domain').remove();
    s.append('text').attr('class','axis-title').attr('transform','rotate(-90)').attr('x',-(h/2)).attr('y',14).attr('text-anchor','middle').attr('fill',t.inkSoft).text('Jumlah peneliti');
    const bars=s.selectAll('.bar').data(P).join('g');
    bars.append('rect').attr('x',p=>x(p.short)).attr('width',x.bandwidth()).attr('y',h-m.b).attr('height',0).attr('rx',4).attr('fill',(p,i)=>t.c[i])
      .on('mousemove',(ev,p)=>moveTip(`<div class="t-name">${p.label}</div><div class="t-row"><span>Peneliti</span><b>${p.size.toLocaleString('id')}</b></div><div class="t-row"><span>Derajat rata-rata</span><b>${p.avgDeg}</b></div>`,ev))
      .on('mouseleave',hideTip)
      .transition().duration(900).delay((p,i)=>i*120).attr('y',p=>y(p.size)).attr('height',p=>h-m.b-y(p.size));
    bars.append('text').attr('x',p=>x(p.short)+x.bandwidth()/2).attr('y',p=>y(p.size)-10).attr('text-anchor','middle').style('font-family',"'Spectral',Georgia,serif").style('font-size','21px').style('font-weight','600').style('fill',t.ink).style('opacity',0).text(p=>p.size.toLocaleString('id')).transition().delay((p,i)=>600+i*120).duration(500).style('opacity',1);
  };

  // ---- 2. COMMUNITY PROFILE HEATMAP ----
  window.communityProfileHeatmap = function(sel, data){
    const t=T();
    const metrics=[{k:'avgDegN',l:'Derajat'},{k:'avgBc',l:'Betweenness'},{k:'avgCc',l:'Closeness'},{k:'avgPr',l:'PageRank'}];
    const P=data.profile;
    const w=560,h=250,m={t:30,r:20,b:30,l:150};
    const s=svg(sel,w,h);
    const x=d3.scaleBand().domain(metrics.map(d=>d.l)).range([m.l,w-m.r]).padding(0.08);
    const y=d3.scaleBand().domain(P.map(p=>p.short)).range([m.t,h-m.b]).padding(0.08);
    const lowColor = t.dark ? '#1e2636' : '#f3f6fa';
    metrics.forEach(mt=>{
      const vals=P.map(p=>p[mt.k]); const mn=d3.min(vals),mx=d3.max(vals);
      const col=d3.scaleLinear().domain([mn,mx]).range([0.12,1]);
      P.forEach((p,pi)=>{
        const v=col(p[mt.k]);
        s.append('rect').attr('x',x(mt.l)).attr('y',y(p.short)).attr('width',x.bandwidth()).attr('height',y.bandwidth()).attr('rx',5)
          .attr('fill', d3.interpolateRgb(lowColor, t.c[pi])(v))
          .style('cursor','default')
          .on('mousemove',ev=>moveTip(`<div class="t-name">${p.short}</div><div class="t-comm">${mt.l}</div><div class="t-row"><span>Nilai rata-rata</span><b>${p[mt.k]}</b></div>`,ev))
          .on('mouseleave',hideTip);
        s.append('text').attr('x',x(mt.l)+x.bandwidth()/2).attr('y',y(p.short)+y.bandwidth()/2).attr('dy','0.35em').attr('text-anchor','middle').style('font-family',"ui-monospace,monospace").style('font-size','12px').style('font-weight','600').style('fill', v>0.62?'#fff':t.inkSoft).text(p[mt.k]);
      });
    });
    s.append('g').attr('transform',`translate(0,${m.t})`).call(d3.axisTop(x).tickSize(0)).call(g=>g.select('.domain').remove()).selectAll('text').attr('dy','-0.8em').style('font-family',"ui-monospace,monospace").style('font-size','10.5px').style('letter-spacing','0.04em').style('fill',t.body).style('text-transform','uppercase');
    s.selectAll('.rowlab').data(P).join('text').attr('x',m.l-14).attr('y',p=>y(p.short)+y.bandwidth()/2).attr('dy','0.35em').attr('text-anchor','end').style('font-family',"'Helvetica Neue',Arial").style('font-size','13px').style('font-weight','600').style('fill',(p,i)=>t.ci[i]).text(p=>p.short);
  };

  // ---- 3. LEADERBOARD — stacked horizontal bar ----
  window.leaderboardBar = function(sel, data){
    const t=T();
    const comps=[{k:'degN',l:'Derajat',c:t.c[0]},{k:'bcN',l:'Betweenness',c:t.dark?'#7dadd4':'#7BA5D6'},{k:'ccN',l:'Closeness',c:t.c[1]},{k:'prN',l:'PageRank',c:t.c[2]}];
    const L=data.leaderboard;
    const rowH=30, w=620, m={t:10,r:60,b:34,l:178}, h=m.t+m.b+L.length*rowH;
    const s=svg(sel,w,h);
    const x=d3.scaleLinear().domain([0,d3.max(L,d=>d.comp)*1.04]).range([m.l,w-m.r]);
    const y=d3.scaleBand().domain(L.map(d=>d.rank)).range([m.t,h-m.b]).padding(0.26);
    s.append('g').attr('class','grid').attr('transform',`translate(0,${h-m.b})`).call(d3.axisBottom(x).ticks(5).tickSize(-(h-m.t-m.b)).tickFormat('')).select('.domain').remove();
    L.forEach(d=>{
      let acc=0;
      const g=s.append('g');
      comps.forEach(c=>{
        const val=d[c.k];
        g.append('rect').attr('x',x(acc)).attr('y',y(d.rank)).attr('width',0).attr('height',y.bandwidth())
          .attr('fill',c.c).attr('opacity',0.92)
          .on('mousemove',ev=>moveTip(`<div class="t-name">${d.name}</div><div class="t-comm" style="color:${t.c[d.comm]}">${data.communities[d.comm].short}</div><div class="t-row"><span>${c.l}</span><b>${val.toFixed(2)}</b></div><div class="t-row"><span>Skor total</span><b>${d.comp.toFixed(2)}</b></div>`,ev))
          .on('mouseleave',hideTip)
          .transition().duration(700).delay(d.rank*45).attr('x',x(acc)).attr('width',x(acc+val)-x(acc));
        acc+=val;
      });
      s.append('text').attr('x',m.l-12).attr('y',y(d.rank)+y.bandwidth()/2).attr('dy','0.35em').attr('text-anchor','end').style('font-family',"'Helvetica Neue',Arial").style('font-size','12.5px').style('font-weight','600').style('fill',t.ink).text(d.name);
      s.append('circle').attr('cx',m.l-162).attr('cy',y(d.rank)+y.bandwidth()/2).attr('r',3).attr('fill',t.c[d.comm]);
      s.append('text').attr('x',w-m.r+8).attr('y',y(d.rank)+y.bandwidth()/2).attr('dy','0.35em').style('font-family',"'Spectral',serif").style('font-size','13px').style('font-weight','600').style('fill',t.body).text(d.comp.toFixed(2));
    });
    s.append('text').attr('x',(m.l+w-m.r)/2).attr('y',h-6).attr('text-anchor','middle').attr('class','axis-title').attr('fill',t.inkSoft).text('Skor pengaruh komposit (jumlah 4 metrik ternormalisasi)');
  };

  // ---- 4. HUB vs BROKER scatter ----
  window.hubBrokerScatter = function(sel, data){
    const t=T();
    const w=620,h=460,m={t:20,r:24,b:54,l:64};
    const s=svg(sel,w,h);
    const N=data.nodes;
    const x=d3.scaleLinear().domain([0,d3.max(N,d=>d.degN)]).range([m.l,w-m.r]).nice();
    const y=d3.scaleSqrt().domain([0,d3.max(N,d=>d.bcN)]).range([h-m.b,m.t]).nice();
    s.append('g').attr('class','grid').attr('transform',`translate(0,${h-m.b})`).call(d3.axisBottom(x).ticks(5).tickSize(-(h-m.t-m.b)).tickFormat('')).select('.domain').remove();
    s.append('g').attr('class','grid').attr('transform',`translate(${m.l},0)`).call(d3.axisLeft(y).ticks(5).tickSize(-(w-m.l-m.r)).tickFormat('')).select('.domain').remove();
    s.append('g').selectAll('circle').data(N).join('circle')
      .attr('cx',d=>x(d.degN)).attr('cy',d=>y(d.bcN)).attr('r',d=>2+Math.sqrt(d.deg)*0.32)
      .attr('fill',d=>t.c[d.comm]).attr('opacity', t.dark?0.55:0.42).attr('stroke','none')
      .on('mousemove',(ev,d)=>{ d3.select(ev.currentTarget).attr('opacity',1).attr('stroke',t.bg).attr('stroke-width',1.4); moveTip(`<div class="t-name">${d.name}</div><div class="t-comm" style="color:${t.c[d.comm]}">${data.communities[d.comm].short}</div><div class="t-row"><span>Derajat (DC)</span><b>${d.deg}</b></div><div class="t-row"><span>Betweenness</span><b>${d.bcN.toFixed(2)}</b></div>`,ev); })
      .on('mouseleave',(ev)=>{ d3.select(ev.currentTarget).attr('opacity',t.dark?0.55:0.42).attr('stroke','none'); hideTip(); });
    const brokers=[...N].sort((a,b)=>b.bcN-a.bcN).slice(0,5);
    const hubs=[...N].sort((a,b)=>(b.degN-b.bcN)-(a.degN-a.bcN)).slice(0,4);
    const labels=[...new Map([...brokers,...hubs].map(d=>[d.id,d])).values()];
    s.append('g').selectAll('text').data(labels).join('text')
      .attr('x',d=> x(d.degN) > (w-m.r)*0.66 ? x(d.degN)-8 : x(d.degN)+8)
      .attr('y',d=>y(d.bcN)-6)
      .attr('text-anchor',d=> x(d.degN) > (w-m.r)*0.66 ? 'end':'start')
      .style('font-family',"'Helvetica Neue',Arial").style('font-size','11px').style('font-weight','600').style('fill',d=>t.ci[d.comm]).text(d=>d.name);
    s.append('g').attr('transform',`translate(0,${h-m.b})`).attr('class','axis').call(d3.axisBottom(x).ticks(5)).call(g=>g.selectAll('text').style('fill',t.muted)).select('.domain').attr('stroke',t.hair);
    s.append('g').attr('transform',`translate(${m.l},0)`).attr('class','axis').call(d3.axisLeft(y).ticks(5)).call(g=>g.selectAll('text').style('fill',t.muted)).select('.domain').attr('stroke',t.hair);
    s.append('text').attr('class','axis-title').attr('x',(m.l+w-m.r)/2).attr('y',h-12).attr('text-anchor','middle').attr('fill',t.inkSoft).text('Degree Centrality \u2192 (populer / banyak kolaborator)');
    s.append('text').attr('class','axis-title').attr('transform','rotate(-90)').attr('x',-(h/2)).attr('y',16).attr('text-anchor','middle').attr('fill',t.inkSoft).text('Betweenness \u2192 (jembatan / broker)');
    s.append('text').attr('x',w-m.r-6).attr('y',m.t+14).attr('text-anchor','end').style('font-family',"ui-monospace,monospace").style('font-size','10px').style('fill',t.faint).text('HUB + BROKER');
    s.append('text').attr('x',m.l+8).attr('y',m.t+14).style('font-family',"ui-monospace,monospace").style('font-size','10px').style('fill',t.faint).text('BROKER MURNI');
    s.append('text').attr('x',w-m.r-6).attr('y',h-m.b-8).attr('text-anchor','end').style('font-family',"ui-monospace,monospace").style('font-size','10px').style('fill',t.faint).text('HUB LOKAL');
  };

  // ---- 5. PARALLEL COORDINATES ----
  window.parallelCoords = function(sel, data){
    const t=T();
    const dims=[{k:'degN',l:'Degree'},{k:'bcN',l:'Betweenness'},{k:'ccN',l:'Closeness'},{k:'prN',l:'PageRank'}];
    const top=[...data.nodes].sort((a,b)=>b.comp-a.comp).slice(0,12);
    const w=620,h=380,m={t:34,r:90,b:24,l:90};
    const s=svg(sel,w,h);
    const xScale=d3.scalePoint().domain(dims.map(d=>d.l)).range([m.l,w-m.r]);
    const yByDim={};
    dims.forEach(d=>{ yByDim[d.k]=d3.scaleLinear().domain([0,1]).range([h-m.b,m.t]); });
    dims.forEach(d=>{
      const gx=xScale(d.l);
      s.append('line').attr('x1',gx).attr('x2',gx).attr('y1',m.t).attr('y2',h-m.b).attr('stroke',t.hair).attr('stroke-width',1.5);
      s.append('text').attr('x',gx).attr('y',m.t-14).attr('text-anchor','middle').style('font-family',"ui-monospace,monospace").style('font-size','11px').style('letter-spacing','0.04em').style('fill',t.body).text(d.l);
      ['Tinggi','Rendah'].forEach((lab,i)=>s.append('text').attr('x',gx).attr('y',i===0?m.t+4:h-m.b+14).attr('text-anchor','middle').style('font-family',"ui-monospace,monospace").style('font-size','9px').style('fill',t.faint).text(lab));
    });
    const line=d3.line();
    top.forEach((d,i)=>{
      const pts=dims.map(dim=>[xScale(dim.l), yByDim[dim.k](d[dim.k])]);
      const path=s.append('path').attr('d',line(pts)).attr('fill','none').attr('stroke',t.c[d.comm]).attr('stroke-width',1.6).attr('opacity',t.dark?0.6:0.5).style('cursor','pointer');
      const len=path.node().getTotalLength();
      path.attr('stroke-dasharray',len).attr('stroke-dashoffset',len).transition().duration(900).delay(i*60).attr('stroke-dashoffset',0);
      path.on('mouseover',function(ev){ d3.select(this).attr('opacity',1).attr('stroke-width',3).raise(); moveTip(`<div class="t-name">${d.name}</div><div class="t-comm" style="color:${t.c[d.comm]}">${data.communities[d.comm].short}</div>`+dims.map(dm=>`<div class="t-row"><span>${dm.l}</span><b>${d[dm.k].toFixed(2)}</b></div>`).join(''),ev); })
        .on('mousemove',ev=>moveTip(tip().innerHTML,ev))
        .on('mouseout',function(){ d3.select(this).attr('opacity',t.dark?0.6:0.5).attr('stroke-width',1.6); hideTip(); });
      pts.forEach(p=>s.append('circle').attr('cx',p[0]).attr('cy',p[1]).attr('r',2.5).attr('fill',t.c[d.comm]).attr('opacity',0.7).style('pointer-events','none'));
    });
  };

  // ---- 6. CORRELATION HEATMAPS ----
  function corrHeat(sel, matrix, labels, title){
    const t=T();
    const n=labels.length, cell=70, m={t:28,r:14,b:14,l:96};
    const w=m.l+n*cell+m.r, h=m.t+n*cell+14;
    const s=svg(sel,w,h);
    const zeroColor = t.dark ? '#1e2636' : '#f3f6fa';
    const diagColor = t.dark ? '#232c3c' : '#eef1f5';
    const col=d3.scaleLinear().domain([-1,0,1]).range([t.c[1], zeroColor, t.c[0]]);
    for(let i=0;i<n;i++)for(let j=0;j<n;j++){
      const v=matrix[i][j];
      s.append('rect').attr('x',m.l+j*cell).attr('y',m.t+i*cell).attr('width',cell-3).attr('height',cell-3).attr('rx',5)
        .attr('fill', i===j?diagColor:col(v))
        .on('mousemove',ev=>moveTip(`<div class="t-name">${labels[i]} \u00d7 ${labels[j]}</div><div class="t-row"><span>${title}</span><b>${v.toFixed(3)}</b></div>`,ev)).on('mouseleave',hideTip);
      s.append('text').attr('x',m.l+j*cell+(cell-3)/2).attr('y',m.t+i*cell+(cell-3)/2).attr('dy','0.35em').attr('text-anchor','middle').style('font-family',"ui-monospace,monospace").style('font-size','13px').style('font-weight','600').style('fill', i===j?t.faint:(Math.abs(v)>0.6?'#fff':t.inkSoft)).text(v.toFixed(2));
    }
    labels.forEach((l,i)=>{
      s.append('text').attr('x',m.l-10).attr('y',m.t+i*cell+(cell-3)/2).attr('dy','0.35em').attr('text-anchor','end').style('font-family',"ui-monospace,monospace").style('font-size','10.5px').style('fill',t.body).text(l);
      s.append('text').attr('x',m.l+i*cell+(cell-3)/2).attr('y',m.t-10).attr('text-anchor','middle').style('font-family',"ui-monospace,monospace").style('font-size','10.5px').style('fill',t.body).text(l.slice(0,4));
    });
  }
  window.correlationHeatmaps = function(selP, selS, data){
    corrHeat(selP, data.correlations.pearson, data.correlations.metrics, 'Pearson');
    corrHeat(selS, data.correlations.spearman, data.correlations.metrics, 'Spearman');
  };

  // ---- 7. DEGREE CCDF ----
  window.degreeCCDF = function(sel, data){
    const t=T();
    const w=620,h=420,m={t:20,r:24,b:56,l:62};
    const s=svg(sel,w,h);
    const dist=data.degreeDistribution.filter(d=>d.deg>0);
    const total=d3.sum(dist,d=>d.count);
    let cum=total; const ccdf=[];
    const sorted=[...dist].sort((a,b)=>a.deg-b.deg);
    for(const d of sorted){ ccdf.push({deg:d.deg, p:cum/total}); cum-=d.count; }
    const x=d3.scaleLog().domain([1, d3.max(dist,d=>d.deg)]).range([m.l,w-m.r]);
    const y=d3.scaleLog().domain([Math.max(1/total,1e-4),1]).range([h-m.b,m.t]);
    s.append('g').attr('class','grid').attr('transform',`translate(0,${h-m.b})`).call(d3.axisBottom(x).ticks(6,'~g').tickSize(-(h-m.t-m.b)).tickFormat('')).select('.domain').remove();
    s.append('g').attr('class','grid').attr('transform',`translate(${m.l},0)`).call(d3.axisLeft(y).ticks(5,'~g').tickSize(-(w-m.l-m.r)).tickFormat('')).select('.domain').remove();
    const xmin=6;
    const tail=ccdf.filter(d=>d.deg>=xmin && d.p>0);
    const lx=tail.map(d=>Math.log(d.deg)), ly=tail.map(d=>Math.log(d.p));
    const mx=d3.mean(lx),my=d3.mean(ly);
    let num=0,den=0; for(let i=0;i<lx.length;i++){num+=(lx[i]-mx)*(ly[i]-my);den+=(lx[i]-mx)**2;}
    const slope=num/den; const alpha=(1-slope).toFixed(2);
    const b=my-slope*mx;
    const fitX=[xmin, d3.max(dist,d=>d.deg)];
    const fitPts=fitX.map(xx=>[x(xx), y(Math.exp(b+slope*Math.log(xx)))]);
    s.append('line').attr('x1',fitPts[0][0]).attr('y1',fitPts[0][1]).attr('x2',fitPts[1][0]).attr('y2',fitPts[1][1]).attr('stroke',t.c[1]).attr('stroke-width',1.8).attr('stroke-dasharray','5 4').attr('opacity',0.9);
    const line=d3.line().x(d=>x(d.deg)).y(d=>y(d.p));
    s.append('path').datum(ccdf.filter(d=>d.p>0)).attr('d',line).attr('fill','none').attr('stroke',t.c[0]).attr('stroke-width',1.6).attr('opacity',t.dark?0.7:0.5);
    s.append('g').selectAll('circle').data(ccdf.filter(d=>d.p>0)).join('circle').attr('cx',d=>x(d.deg)).attr('cy',d=>y(d.p)).attr('r',3).attr('fill',t.c[0]).attr('opacity',0.8)
      .on('mousemove',(ev,d)=>moveTip(`<div class="t-row"><span>Derajat \u2265</span><b>${d.deg}</b></div><div class="t-row"><span>P(K\u2265k)</span><b>${d.p.toFixed(4)}</b></div>`,ev)).on('mouseleave',hideTip);
    s.append('g').attr('transform',`translate(0,${h-m.b})`).attr('class','axis').call(d3.axisBottom(x).ticks(6,'~g')).call(g=>g.selectAll('text').style('fill',t.muted)).select('.domain').attr('stroke',t.hair);
    s.append('g').attr('transform',`translate(${m.l},0)`).attr('class','axis').call(d3.axisLeft(y).ticks(5,'~g')).call(g=>g.selectAll('text').style('fill',t.muted)).select('.domain').attr('stroke',t.hair);
    s.append('text').attr('class','axis-title').attr('x',(m.l+w-m.r)/2).attr('y',h-12).attr('text-anchor','middle').attr('fill',t.inkSoft).text('Derajat k (skala log)');
    s.append('text').attr('class','axis-title').attr('transform','rotate(-90)').attr('x',-(h/2)).attr('y',16).attr('text-anchor','middle').attr('fill',t.inkSoft).text('P(K \u2265 k) \u2014 CCDF (log)');
    s.append('text').attr('x',fitPts[1][0]-6).attr('y',fitPts[1][1]-10).attr('text-anchor','end').style('font-family',"'Spectral',serif").style('font-style','italic').style('font-size','15px').style('fill',t.ci[1]).html(`&#945; &#8776; ${alpha}`);
    return alpha;
  };
})();

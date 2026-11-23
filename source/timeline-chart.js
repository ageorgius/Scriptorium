  function renderChart(){
    // One event per line: its bar runs exactly from start to end year, its dates sit in the left column,
    // and its name follows the bar. Collections are section headings; biblical periods run along the top.
    if(!dialog?.open||timelineLayout==='notes')return;
    const query=search.value.trim(),ids=era?[era]:query?[...new Set(filtered.map(e=>e.group))]:presetInfo().groups;
    const groups=DATA.groups.filter(g=>ids.includes(g.id)),span=range[1]-range[0];
    // The date column is as wide as the longest date shown (exact dates such as "13 Nov 354 – 28 Aug 430" need more room).
    chartMeasure.font=`${Math.max(11,Math.max(13,timelineFont-2)-3)}px sans-serif`;
    const left=Math.min(280,Math.max(150,Math.round(timelineFont*9.5),...filtered.filter(e=>ids.includes(e.group)).map(e=>Math.ceil(chartMeasure.measureText(dateText(e)).width)+36)));
    if(yearStep!=='auto'&&span/Number(yearStep)>80){yearStep='auto';dialog.querySelector('#bt-display-years').value='auto';}
    const manual=yearStep!=='auto',width=Math.max(Math.round(1060*timelineFont/18),Math.round(chart.parentElement.clientWidth),manual?left+Math.ceil(span/Number(yearStep))*Math.max(62,timelineFont*3.8)+36:0),right=width-20,plotWidth=right-left;
    const major=manual?Number(yearStep):niceStep(span/Math.max(2,Math.floor(plotWidth/112)));
    const minor=manual?major:niceStep(major/5);
    const minorLabels=minor*plotWidth/span>=18;
    chart.dataset.plotLeft=left;chart.dataset.plotWidth=plotWidth;
    const x=value=>left+(value-range[0])/span*plotWidth,font=Math.max(13,timelineFont-2),small=Math.max(11,font-3);
    const rowH=Math.round(font*1.75),headH=Math.round(font*2.3)+8;
    visible=filtered.filter(e=>e.kind!=='note'&&!e.invalidRange&&e.end>=range[0]&&e.start<=range[1]);
    const rows=groups.map(group=>({group,events:visible.filter(e=>e.group===group.id).sort((a,b)=>a.start-b.start||a.end-b.end)}));
    const height=Math.max(220,rows.reduce((h,r)=>h+(rows.length>1?headH:0)+Math.max(1,r.events.length)*rowH+10,8));
    chart.replaceChildren();chart.setAttribute('viewBox',`0 0 ${width} ${height}`);chart.setAttribute('width',width);chart.setAttribute('height',height);chart.style.width=width+'px';chart.dataset.height=height;
    chart.setAttribute('aria-label',`Chronology from ${year(Math.round(range[0]))} to ${year(Math.round(range[1]))}; ${visible.length} entries in ${groups.length} ${groups.length===1?'collection':'collections'}, one per line. Use the event list for individual entries.`);
    const limits=extents();rangeLabel.textContent=`Showing ${year(Math.round(range[0]))} – ${year(Math.round(range[1]))}${limits?` of ${year(Math.round(limits[0]))} – ${year(Math.round(limits[1]))}`:''} · ${visible.length} ${visible.length===1?'entry':'entries'} · one line per entry, bars run from start to end year`;
    // Axis: biblical periods on top, then the year ruler.
    const axisH=86;
    axis.replaceChildren();axis.setAttribute('viewBox',`0 0 ${width} ${axisH}`);axis.setAttribute('width',width);axis.setAttribute('height',axisH);axis.style.width=width+'px';axis.dataset.majorStep=major;axis.dataset.minorStep=minor;
    axis.style.setProperty('--bt-axis-major',Math.max(14,timelineFont-3)+'px');axis.style.setProperty('--bt-axis-minor',Math.max(12,timelineFont-5)+'px');
    axis.append(svgNode('rect',{x:0,y:0,width,height:axisH,class:'bt-axis-paper'}),svgNode('text',{x:14,y:18,class:'bt-ruler-heading'},'PERIOD'),svgNode('text',{x:14,y:56,class:'bt-ruler-heading'},'YEAR'));
    const PERIODS=[[-4000,-2245,'Creation to the Flood'],[-2245,-2166,'After the Flood'],[-2166,-1876,'Patriarchs'],[-1876,-1446,'Israel in Egypt'],[-1446,-1406,'Exodus & wilderness'],[-1406,-1050,'Conquest & Judges'],[-1050,-931,'United kingdom'],[-931,-722,'Divided kingdom'],[-722,-586,'Judah alone'],[-586,-536,'Exile'],[-536,-332,'Persian period'],[-332,-63,'Greek & Maccabean'],[-63,-5,'Roman rule'],[-5,30,'Life of Christ'],[30,100,'Apostolic age'],[100,313,'Early Church'],[313,590,'Fathers & councils'],[590,1054,'Early Middle Ages'],[1054,1303,'High Middle Ages'],[1303,1517,'Late Middle Ages'],[1517,1648,'Reformation & Catholic Reformation'],[1648,1789,'Age of reason'],[1789,1914,'Revolutions & missions'],[1914,2030,'The modern Church']];
    chartMeasure.font=`600 ${small}px sans-serif`;
    PERIODS.forEach(([a,b,name],i)=>{
      if(b<range[0]||a>range[1])return;
      const x1=Math.max(left,x(a)),x2=Math.min(right,x(b));if(x2-x1<2)return;
      const band=svgNode('rect',{x:x1,y:4,width:x2-x1,height:24,class:i%2?'bt-period bt-period-alt':'bt-period','data-period':name,'data-start':a,'data-end':b});
      band.append(svgNode('title',{},`${name} (${year(a)} – ${year(b)}) · click to show these years`));axis.append(band);
      const label=chartTitle(name,x2-x1-10);if(x2-x1>28&&label!=='…')axis.append(svgNode('text',{x:(x1+x2)/2,y:20,'text-anchor':'middle','font-size':small,class:'bt-period-label'},label));
    });
    const ticks=[];let minorLabelEnd=left-20;chartMeasure.font=`${Math.max(12,timelineFont-5)}px sans-serif`;
    for(let n=Math.ceil(range[0]/minor);n<=Math.floor(range[1]/minor);n++){
      const tick=n*minor,xx=x(tick),isMajor=Math.abs(tick/major-Math.round(tick/major))<1e-6;
      ticks.push({tick,x:xx,major:isMajor});
      axis.append(svgNode('line',{x1:xx,x2:xx,y1:isMajor?56:72,y2:axisH,class:isMajor?'bt-ruler-major':'bt-ruler-minor'}));
      if(isMajor)axis.append(svgNode('text',{x:xx>width-60?xx-2:xx,y:50,'text-anchor':xx>width-60?'end':'middle',class:'bt-axis-label'},tick===0?'BC / AD':year(Math.round(tick))));
      else if(minorLabels){const label=String(Math.abs(Math.round(tick))),labelWidth=chartMeasure.measureText(label).width;if(xx-labelWidth/2>minorLabelEnd+5&&xx+labelWidth/2<width-5){axis.append(svgNode('text',{x:xx,y:68,'text-anchor':'middle',class:'bt-axis-minor-label'},label));minorLabelEnd=xx+labelWidth/2;}}
    }
    positions=[];
    if(!groups.length){chart.append(svgNode('text',{x:width/2,y:110,'text-anchor':'middle',class:'bt-axis-label'},'No matching collections'));return;}
    // Faint year grid behind everything.
    for(const tick of ticks)chart.append(svgNode('line',{x1:tick.x,x2:tick.x,y1:0,y2:height,class:tick.major?'bt-grid-line':'bt-minor-grid-line'}));
    let y=8;
    for(const {group,events} of rows){
      const color=groupColor(group.id);
      // Collection heading: a full-width band (left out when the view has only one collection).
      if(rows.length>1){
        const heading=svgNode('g',{'data-timeline-group':group.id,class:'bt-group-label'});
        heading.append(svgNode('rect',{x:0,y,width,height:headH-6,class:'bt-group-band'}),svgNode('rect',{x:0,y,width:4,height:headH-6,fill:color}));
        heading.append(svgNode('text',{x:14,y:y+(headH-6)/2+font*.36,'font-size':font+1,class:'bt-collection-label'},group.name));
        chart.append(heading);y+=headH;
      }
      if(!events.length){chart.append(svgNode('text',{x:left,y:y+rowH*.65,'font-size':small,class:'bt-collection-count'},'No entries in these years — move or zoom out to see them.'));y+=rowH+10;continue;}
      events.forEach((event,i)=>{
        const chosen=event===selected,mid=y+rowH/2,single=event.start===event.end;
        const row=svgNode('g',{'data-timeline-id':event.id,class:'bt-chart-event bt-gantt-row'+(chosen?' bt-chosen-row':''),'aria-hidden':'true'});
        row.append(svgNode('title',{},`${event.title} · ${dateText(event)}`));
        row.append(svgNode('rect',{x:0,y,width,height:rowH,class:chosen?'bt-row-chosen':i%2?'bt-row-alt':'bt-row'}));
        // Dates in the left column, right-aligned so they line up.
        chartMeasure.font=`${small}px sans-serif`;
        row.append(svgNode('text',{x:left-12,y:mid+small*.36,'text-anchor':'end','font-size':small,class:'bt-row-date'},chartTitle(dateText(event),left-24)));
        const x1=Math.max(left,x(event.start)),x2=Math.min(right,x(event.end)),cut1=x(event.start)<left,cut2=x(event.end)>right;
        const uncertain=event.uncertain||/^\(\?\)/.test(event.title);
        if(single||x2-x1<6){row.append(svgNode('path',{d:`M${x1} ${mid-6}L${x1+6} ${mid}L${x1} ${mid+6}L${x1-6} ${mid}Z`,fill:color,class:'bt-point'+(uncertain?' bt-uncertain':'')}));}
        else{
          row.append(svgNode('rect',{x:x1,y:mid-5,width:x2-x1,height:10,rx:2,fill:color,'fill-opacity':chosen?1:.75,class:uncertain?'bt-uncertain':''}));
          if(cut1)row.append(svgNode('path',{d:`M${x1+7} ${mid-7}L${x1} ${mid}L${x1+7} ${mid+7}`,class:'bt-cut'}));
          if(cut2)row.append(svgNode('path',{d:`M${x2-7} ${mid-7}L${x2} ${mid}L${x2-7} ${mid+7}`,class:'bt-cut'}));
        }
        // The name follows the bar; if there is no room on the right it goes before it.
        const title=event.title.replace(/^\(\?\)\s*/,'')+(uncertain?' (?)':'');
        chartMeasure.font=`${chosen?600:500} ${font}px sans-serif`;
        const w=chartMeasure.measureText(title).width,after=Math.max(x2,x1+6)+8,before=Math.min(x1,x1-6)-8;
        let tx=after,anchor='start',text=title;
        if(after+w>right&&before-w>=left)tx=before,anchor='end';
        else if(after+w>right)text=chartTitle(title,Math.max(40,right-after));
        row.append(svgNode('text',{x:tx,y:mid+font*.36,'text-anchor':anchor,'font-size':font,class:'bt-row-title'+(chosen?' bt-row-title-chosen':'')},text));
        chart.append(row);
        positions.push({x:(x1+x2)/2,y:mid,event});
        y+=rowH;
      });
      y+=10;
    }
  }

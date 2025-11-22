// iso3d.js — simple isometric canvas renderer (no deps).
// If you want Three.js, replace this file. It reads window.state from app.js.

(function(){
  function isoProject(x,y,z){
    // very simple iso projection from 2D map coords (0..1600,0..900)
    const angle = Math.PI/6; // 30deg
    const scale = 0.6;
    const isoX = (x - y) * Math.cos(angle) * scale;
    const isoY = (x + y) * Math.sin(angle) * scale - z;
    return {x: isoX, y: isoY};
  }

  function render(){
    const canvas = document.getElementById("isoCanvas");
    if(!canvas) return;
    const ctx = canvas.getContext("2d");
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0,0,W,H);

    // background
    const g = ctx.createLinearGradient(0,0,0,H);
    g.addColorStop(0,"#06110b"); g.addColorStop(1,"#0b1a13");
    ctx.fillStyle=g; ctx.fillRect(0,0,W,H);

    // ground tile (diamond)
    const center = {x: W/2, y:H/2+80};
    const size = 420;
    ctx.save();
    ctx.translate(center.x, center.y);
    ctx.fillStyle = "#0f2a1b";
    ctx.strokeStyle = "rgba(255,255,255,0.06)";
    ctx.beginPath();
    ctx.moveTo(0,-size*0.5);
    ctx.lineTo(size,0);
    ctx.lineTo(0,size*0.5);
    ctx.lineTo(-size,0);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.restore();

    // grid lines
    ctx.save();
    ctx.translate(center.x, center.y);
    ctx.globalAlpha = 0.18;
    for(let i=-6;i<=6;i++){
      ctx.beginPath(); ctx.moveTo(-size, i*size*0.08); ctx.lineTo(size, i*size*0.08); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(i*size*0.12, -size*0.5); ctx.lineTo(i*size*0.12, size*0.5); ctx.stroke();
    }
    ctx.restore(); ctx.globalAlpha=1;

    // plants markers
    const plants = (window.state?.plants)||[];
    const filtered = window.state?.filtered?.length ? window.state.filtered : plants;

    const markers = [];
    filtered.forEach(p=>{
      const z = p.layer==="canopy" ? 80 : p.layer==="subcanopy" ? 55 : p.layer==="shrub" ? 35 : 15;
      const pr = isoProject(p.pos.x, p.pos.y, z);
      markers.push({p, pr, z});
    });

    // sort by y for painter's algorithm
    markers.sort((a,b)=> a.pr.y - b.pr.y);

    markers.forEach(m=>{
      const x = center.x + m.pr.x*0.45;
      const y = center.y + m.pr.y*0.45;

      // tree blob
      ctx.beginPath();
      ctx.fillStyle = m.p.totem ? "rgba(255,230,166,0.9)" :
                      (m.p.category==="rare" ? "rgba(145,215,255,0.9)" : "rgba(183,255,207,0.9)");
      ctx.arc(x, y- m.z*0.35, 9, 0, Math.PI*2);
      ctx.fill();

      // aura
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.arc(x, y- m.z*0.35, m.p.totem?22:16, 0, Math.PI*2);
      ctx.fill();
      ctx.globalAlpha = 1;

      if(window.iso3d?.labels){
        ctx.fillStyle = "rgba(223,236,228,0.9)";
        ctx.font="12px system-ui";
        ctx.fillText(m.p.name, x+10, y- m.z*0.35 +4);
      }

      m.screen = {x,y};
    });

    // click picking
    canvas.onclick = (e)=>{
      const rect=canvas.getBoundingClientRect();
      const mx=(e.clientX-rect.left)*(canvas.width/rect.width);
      const my=(e.clientY-rect.top)*(canvas.height/rect.height);
      let best=null, bestD=1e9;
      markers.forEach(m=>{
        const dx=mx-m.screen.x, dy=my-(m.screen.y- m.z*0.35);
        const d=dx*dx+dy*dy;
        if(d<bestD && d<400) {bestD=d; best=m;}
      });
      if(best){
        window.state.selectedIsoId = best.p.id;
        // small feedback
        const old = canvas.style.outline;
        canvas.style.outline="2px solid rgba(183,255,207,0.6)";
        setTimeout(()=>canvas.style.outline=old, 250);
      }
    }
  }

  window.iso3d = {
    labels: true,
    render
  };

  // UI hooks
  document.addEventListener("click", (e)=>{
    if(e.target?.id==="isoToggleLabels"){
      window.iso3d.labels=!window.iso3d.labels;
      render();
    }
    if(e.target?.id==="isoCenter"){
      render();
    }
  });

  document.addEventListener("DOMContentLoaded", ()=> {
    // re-render when entering screen
    const obs = new MutationObserver(()=>render());
    const iso = document.getElementById("iso3d");
    if(iso) obs.observe(iso, {attributes:true, attributeFilter:["class"]});
    render();
  });
})();
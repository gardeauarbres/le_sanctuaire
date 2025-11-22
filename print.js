// print.js
// Used by print.html and main app print button.
async function buildPrint(){
  const resPlants = await fetch("data/plants.json");
  const data = await resPlants.json();
  const plants = data.plants || [];

  // inject map svg from app.js template if available
  let svg = null;
  try{
    const resApp = await fetch("app.js");
    const txt = await resApp.text();
    const m = txt.match(/return `([\s\S]*?)`;\n\}/);
    if(m) svg = m[1];
  }catch(e){}

  const mapWrap = document.getElementById("mapWrap");
  if(mapWrap && svg){
    mapWrap.innerHTML = svg;
    // remove pulses for print
    mapWrap.querySelectorAll(".point__pulse").forEach(x=>x.remove());
  }

  const list = document.getElementById("plantList");
  if(list){
    plants.forEach(p=>{
      const li = document.createElement("li");
      li.textContent = `${p.name} — ${p.latin} (${p.zone})`;
      list.appendChild(li);
    });
  }
}

if(document.getElementById("plantList")){
  buildPrint();
}

// main app hook
document.addEventListener("click", (e)=>{
  if(e.target?.id==="printBtn"){
    window.open("print.html", "_blank");
  }
});
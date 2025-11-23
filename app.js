// Gard Eau Arbres — Sanctuaire Vivant
// Version optimisée professionnelle
// Vanilla JS, performant, accessible, robuste

const CONFIG_DEFAULTS = {
  BACKEND_ENABLED: false,
  BACKEND_URL: "backend",
  CACHE_VERSION: "1.0.0",
  DEBOUNCE_DELAY: 300,
  IMAGE_LAZY_LOAD_MARGIN: "50px",
  SITE_URL: "https://www.gardeauarbres.fr",
  NURSERY_URL: "#",
  DONATE_URL: "#",
  VOLUNTEER_URL: "#",
  WORKSHOP_URL: "#",
  FEATURES: {
    AR_ENABLED: true,
    AUDIO_ENABLED: true,
    TOUR_ENABLED: true,
    QUEST_ENABLED: true,
    ISO3D_ENABLED: true,
    PRINT_ENABLED: true
  }
};

const APP_CONFIG = (() => {
  const userConfig = window.CONFIG || {};
  const merged = {...CONFIG_DEFAULTS, ...userConfig};
  merged.FEATURES = {...CONFIG_DEFAULTS.FEATURES, ...(userConfig.FEATURES || {})};
  return merged;
})();

const BACKEND_ENABLED = Boolean(APP_CONFIG.BACKEND_ENABLED);
const CACHE_VERSION = APP_CONFIG.CACHE_VERSION;
const DEBOUNCE_DELAY = APP_CONFIG.DEBOUNCE_DELAY;

const STUDIO_ASSETS = [
  {id:"canopy", label:"Grand arbre", color:"#53c27c", height:18, shape:"cone"},
  {id:"subcanopy", label:"Arbre moyen", color:"#75d39a", height:14, shape:"cone"},
  {id:"shrub", label:"Arbuste", color:"#ffcf6a", height:9, shape:"cylinder"},
  {id:"herb", label:"Herbacée", color:"#ff9e5c", height:4, shape:"cylinder"},
  {id:"water", label:"Point d'eau", color:"#6dd6ff", height:1.5, shape:"disk"},
  {id:"structure", label:"Structure légère", color:"#d0c0ff", height:8, shape:"box"},
  {id:"rock", label:"Roche / totem", color:"#9ea7b8", height:6, shape:"pyramid"},
  {id:"custom", label:"Personnalisé", color:"#ffffff", height:10, shape:"box"}
];

const SCREENS = ["portal","map","plant","quest","future","asso","sponsor","tour","iso3d","studio"];
const state = {
  tourAudio: new Audio(),
  tourPlaying: false,
  tourOrder: [],
  tourIndex: 0,
  selectedIsoId: null,
  plants: [],
  filtered: [],
  activeLayer: "all",
  activePlantId: null,
  favorites: new Set(),
  questFound: new Set(),
  muted: false,
  cache: new Map(), // Cache pour les données
  imageObserver: null, // IntersectionObserver pour lazy loading
  studio: {
    items: [],
    selectedId: null,
    activeAsset: null,
    meshes: new Map(),
    renderer: null,
    scene: null,
    camera: null,
    plane: null,
    grid: null,
    raycaster: null,
    pointer: null,
    canvas: null,
    meshGroup: null,
    needsRender: false,
    orbit: {azimuth: 40, polar: 55, radius: 120},
    animId: null,
    dragging: false,
    dragMoved: false,
    lastPointer: {x:0,y:0}
  }
};

// ---------- Utils optimisés ----------
// Mode développement (définir window.DEBUG = true pour activer)
const DEBUG = window.DEBUG || false;

const $ = (sel, root=document) => {
  const el = root.querySelector(sel);
  if(!el && DEBUG) {
    console.warn(`Element not found: ${sel}`);
  }
  return el;
};
const $$ = (sel, root=document) => [...root.querySelectorAll(sel)];

// Debounce pour optimiser les recherches
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Gestion d'erreurs centralisée
function handleError(error, context = '') {
  console.error(`[Error${context ? ` in ${context}` : ''}]`, error);
  if(context === 'loadPlants') {
    modal("Erreur de chargement", "Impossible de charger les données des plantes. Vérifiez votre connexion.");
  }
}

function go(screen){
  if(!SCREENS.includes(screen)) {
    console.warn(`Invalid screen: ${screen}`);
    return;
  }
  SCREENS.forEach(s=>{
    const el = $("#"+s);
    if(!el) return;
    el.classList.toggle("screen--active", s===screen);
    // Amélioration accessibilité
    el.setAttribute('aria-hidden', s!==screen);
  });
  $$(".bottomnav__btn").forEach(b=>{
    const isActive = b.dataset.go===screen;
    b.classList.toggle("active", isActive);
    b.setAttribute('aria-current', isActive ? 'page' : 'false');
  });
  // Track navigation
  if('performance' in window && 'mark' in performance) {
    performance.mark(`screen-${screen}`);
  }
}

function modal(title, body){
  const modalEl = $("#modal");
  const titleEl = $("#modalTitle");
  const bodyEl = $("#modalBody");
  if(!modalEl || !titleEl || !bodyEl) return;
  
  titleEl.textContent = title;
  bodyEl.innerHTML = body;
  modalEl.showModal();
  modalEl.setAttribute('aria-label', title);
  
  // Focus management pour accessibilité
  const okBtn = modalEl.querySelector('button[value="ok"]');
  if(okBtn) okBtn.focus();
}

function saveLocal(){
  try {
    localStorage.setItem("gea_sanctuary_favorites", JSON.stringify([...state.favorites]));
    const treesEl = $("#treesCount");
    const visitsEl = $("#visitsCount");
    if(treesEl && visitsEl) {
      localStorage.setItem("gea_sanctuary_counts", JSON.stringify({
        trees: +(treesEl.textContent||0),
        visits: +(visitsEl.textContent||0)
      }));
    }
    const finomEl = $("#finomClicks");
    const paypalEl = $("#paypalClicks");
    const sogexiaEl = $("#sogexiaClicks");
    const lydiaEl = $("#lydiaClicks");
    if(finomEl && paypalEl && lydiaEl) {
      localStorage.setItem("gea_sanctuary_sponsor", JSON.stringify({
        finom: +finomEl.textContent,
        paypal: +paypalEl.textContent,
        sogexia: +(sogexiaEl?.textContent || 0),
        lydia: +lydiaEl.textContent
      }));
    }
  } catch(e) {
    handleError(e, 'saveLocal');
  }
}

function loadLocal(){
  try{
    const fav = JSON.parse(localStorage.getItem("gea_sanctuary_favorites")||"[]");
    if(Array.isArray(fav)) {
      fav.forEach(id=>{
        if(typeof id === 'string') state.favorites.add(id);
      });
    }
  }catch(e){
    handleError(e, 'loadLocal');
  }
}

async function track(type, id=""){
  if(!BACKEND_ENABLED) return;
  try{
    const endpoint = `${APP_CONFIG.BACKEND_URL?.replace(/\/$/, "") || "backend"}/track.php`;
    const response = await fetch(endpoint, {
      method:"POST",
      headers:{ "Content-Type":"application/json" },
      body: JSON.stringify({type, id}),
      signal: AbortSignal.timeout(5000) // Timeout 5s
    });
    if(!response.ok) throw new Error(`HTTP ${response.status}`);
  }catch(e){
    // Silently fail tracking
      if(DEBUG) {
        console.warn('Tracking failed:', e);
      }
  }
}

// ---------- Validation des données ----------
function validatePlant(plant) {
  const required = ['id', 'name', 'latin', 'layer', 'zone', 'category', 'pos'];
  const missing = required.filter(field => !plant[field]);
  if(missing.length > 0) {
    console.warn(`Plant ${plant.id || 'unknown'} missing fields:`, missing);
    return false;
  }
  // Validation des types
  if(typeof plant.pos !== 'object' || typeof plant.pos.x !== 'number' || typeof plant.pos.y !== 'number') {
    console.warn(`Plant ${plant.id} has invalid position`);
    return false;
  }
  return true;
}

// ---------- Data avec cache et gestion d'erreurs ----------
async function loadTour(){
  const cacheKey = 'tour_data';
  if(state.cache.has(cacheKey)) {
    state.tourOrder = state.cache.get(cacheKey);
    return;
  }
  
  try{
    const res = await fetch("data/tour.json", {
      cache: 'default',
      signal: AbortSignal.timeout(5000)
    });
    if(!res.ok) throw new Error(`HTTP ${res.status}`);
    const t = await res.json();
    state.tourOrder = Array.isArray(t.order) ? t.order : [];
    state.cache.set(cacheKey, state.tourOrder);
  }catch(e){
    handleError(e, 'loadTour');
    state.tourOrder = [];
  }
}

async function loadPlants(){
  const cacheKey = 'plants_data';
  if(state.cache.has(cacheKey)) {
    const cached = state.cache.get(cacheKey);
    state.plants = cached;
    state.filtered = cached;
    return;
  }
  
  try {
    const res = await fetch("data/plants.json", {
      cache: 'default',
      signal: AbortSignal.timeout(10000)
    });
    if(!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    
    if(!data || !Array.isArray(data.plants)) {
      throw new Error('Invalid data format');
    }
    
    // Validation et filtrage des plantes invalides
    state.plants = data.plants.filter(validatePlant);
    state.filtered = state.plants;
    
    state.cache.set(cacheKey, state.plants);
    
    const speciesCountEl = $("#speciesCount");
    if(speciesCountEl) speciesCountEl.textContent = state.plants.length;
    
    await loadTour();
    buildLayerFilters();
    renderMap();
    renderQuest();
    renderTour();
    renderFutureStats();
    
    const statusEl = $("#statusText");
    if(statusEl) statusEl.textContent = `${state.plants.length} espèces chargées.`;
  } catch(e) {
    handleError(e, 'loadPlants');
    state.plants = [];
    state.filtered = [];
    const statusEl = $("#statusText");
    if(statusEl) statusEl.textContent = "Erreur de chargement.";
  }
}

// ---------- Lazy loading des images ----------
function setupImageObserver() {
  if('IntersectionObserver' in window) {
    state.imageObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if(entry.isIntersecting) {
          const img = entry.target;
          if(img.dataset.src) {
            img.src = img.dataset.src;
            img.removeAttribute('data-src');
            state.imageObserver.unobserve(img);
          }
        }
      });
    }, {
      rootMargin: APP_CONFIG.IMAGE_LAZY_LOAD_MARGIN || '50px'
    });
  }
}

function loadImageLazy(imgEl, src) {
  if(!imgEl) return;
  if(state.imageObserver && 'IntersectionObserver' in window) {
    imgEl.dataset.src = src;
    imgEl.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="1" height="1"%3E%3C/svg%3E'; // Placeholder
    state.imageObserver.observe(imgEl);
  } else {
    // Fallback pour navigateurs sans IntersectionObserver
    imgEl.src = src;
  }
}

function initParallax(){
  if(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const stage = document.querySelector(".mapstage[data-tilt=\"true\"]");
  if(!stage) return;
  const setTilt = (xDeg, yDeg)=>{
    document.documentElement.style.setProperty('--tiltX', `${xDeg}deg`);
    document.documentElement.style.setProperty('--tiltY', `${yDeg}deg`);
  };
  stage.addEventListener("pointermove", (event)=>{
    const rect = stage.getBoundingClientRect();
    const relX = (event.clientX - rect.left) / rect.width - 0.5;
    const relY = (event.clientY - rect.top) / rect.height - 0.5;
    const xDeg = relX * 6;
    const yDeg = relY * -4;
    setTilt(xDeg, yDeg);
  });
  stage.addEventListener("pointerleave", ()=> setTilt(0,0));
}

// ---------- Layers / Filters avec debounce ----------
function buildLayerFilters(){
  const layers = [
    {id:"all", label:"Toutes"},
    {id:"canopy", label:"Canopée"},
    {id:"subcanopy", label:"Sous-étage"},
    {id:"shrub", label:"Arbustes"},
    {id:"herb", label:"Herbacées"},
    {id:"groundcover", label:"Couvre-sol"},
    {id:"rhizosphere", label:"Racines"},
    {id:"climber", label:"Grimpantes"}
  ];

  const wrap = $("#layerFilters");
  if(!wrap) return;
  wrap.innerHTML = "";
  
  layers.forEach(l=>{
    const btn = document.createElement("button");
    btn.className = "layerbtn"+(l.id==="all"?" active":"");
    btn.dataset.layer = l.id;
    btn.setAttribute('aria-pressed', l.id==="all" ? 'true' : 'false');
    btn.setAttribute('type', 'button');
    const count = l.id==="all" ? state.plants.length : state.plants.filter(p=>p.layer===l.id).length;
    btn.innerHTML = `<span>${l.label}</span><span class="small">${count}</span>`;
    btn.onclick = ()=>{
      state.activeLayer = l.id;
      $$(".layerbtn").forEach(b=>{
        const isActive = b===btn;
        b.classList.toggle("active", isActive);
        b.setAttribute('aria-pressed', isActive ? 'true' : 'false');
      });
      applyFilters();
    };
    wrap.appendChild(btn);
  });
}

const applyFiltersDebounced = debounce(() => {
  const q = ($("#searchInput")?.value||"").trim().toLowerCase();
  state.filtered = state.plants.filter(p=>{
    const layerOk = state.activeLayer==="all" || p.layer===state.activeLayer;
    if(!layerOk) return false;
    if(!q) return true;
    const searchText = [
      p.name || '',
      p.latin || '',
      Array.isArray(p.tags) ? p.tags.join(" ") : '',
      p.zone || ''
    ].join(" ").toLowerCase();
    return searchText.includes(q);
  });
  renderMap();
  const statusEl = $("#statusText");
  if(statusEl) statusEl.textContent = `${state.filtered.length} espèce(s) affichée(s).`;
}, DEBOUNCE_DELAY);

function applyFilters(){
  applyFiltersDebounced();
}

// ---------- Map rendering (SVG) optimisé ----------
function mapTemplate(){
  return `<div class="mapwrap">
<svg viewBox="0 0 1600 900" role="img" aria-label="Carte du sanctuaire Gard Eau Arbres">
  <defs>
    <linearGradient id="bg" x1="0" x2="0" y1="0" y2="1">
      <stop offset="0%" stop-color="#0b1f15"/>
      <stop offset="100%" stop-color="#070d0a"/>
    </linearGradient>
    <linearGradient id="prairie" x1="0" x2="1">
      <stop offset="0%" stop-color="#0f2a1b"/>
      <stop offset="100%" stop-color="#0b2016"/>
    </linearGradient>
    <linearGradient id="lande" x1="0" x2="1">
      <stop offset="0%" stop-color="#11251a"/>
      <stop offset="100%" stop-color="#0c1a12"/>
    </linearGradient>
    <linearGradient id="logi" x1="0" x2="0" y1="0" y2="1">
      <stop offset="0%" stop-color="#151b18"/>
      <stop offset="100%" stop-color="#0e1411"/>
    </linearGradient>
    <linearGradient id="potager" x1="0" x2="1">
      <stop offset="0%" stop-color="#183d2b"/>
      <stop offset="100%" stop-color="#102a1e"/>
    </linearGradient>
    <radialGradient id="depression">
      <stop offset="0%" stop-color="#000" stop-opacity="0.0"/>
      <stop offset="100%" stop-color="#000" stop-opacity="0.55"/>
    </radialGradient>
    <radialGradient id="glow">
      <stop offset="0%" stop-color="#b7ffcf" stop-opacity="1"/>
      <stop offset="100%" stop-color="#b7ffcf" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="glowGold">
      <stop offset="0%" stop-color="#ffe6a6" stop-opacity="1"/>
      <stop offset="100%" stop-color="#ffe6a6" stop-opacity="0"/>
    </radialGradient>
    <filter id="softShadow" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0" dy="6" stdDeviation="8" flood-color="#000" flood-opacity="0.6"/>
    </filter>
  </defs>
  <rect width="1600" height="900" fill="url(#bg)"/>
  <path d="M 120 170 C 360 40, 740 40, 980 120 C 1260 220, 1500 450, 1460 640 C 1420 820, 1120 880, 820 850 C 520 820, 240 700, 150 520 C 70 360, 40 240, 120 170 Z"
        fill="url(#prairie)" filter="url(#softShadow)" opacity="0.98"/>
  <path d="M 150 220 C 260 160, 390 150, 500 210 C 410 280, 350 360, 320 460 C 260 520, 160 520, 120 430 C 90 350, 100 280, 150 220 Z"
        fill="url(#lande)" opacity="0.95"/>
  <path d="M 520 620 L 700 560 L 860 640 L 700 720 Z"
        fill="url(#logi)" opacity="0.98"/>
  <path d="M 760 700 L 900 650 L 1030 720 L 890 770 Z"
        fill="url(#potager)" opacity="1"/>
  <path d="M 260 520 C 420 520, 560 500, 720 470"
        stroke="#173a2a" stroke-width="10" opacity="0.7" fill="none"/>
  <path d="M 980 250 C 1100 320, 1210 410, 1340 520"
        stroke="#173a2a" stroke-width="10" opacity="0.55" fill="none"/>
  <path d="M 260 500 Q 520 440 760 500 T 1260 500"
        stroke="#133d4b" stroke-width="16" opacity="0.55" fill="none"/>
  <ellipse cx="820" cy="520" rx="520" ry="300" fill="url(#depression)" opacity="0.6"/>
  <g fill="#cfe6d7" opacity="0.9" font-size="22" font-weight="800" letter-spacing="0.6">
    <text x="185" y="195">Lande en pente</text>
    <text x="1060" y="160">Prairie</text>
    <text x="650" y="640">Zone logistique</text>
    <text x="850" y="730">Potager vivant</text>
  </g>
  <g fill="#a7b7ac" opacity="0.9" font-size="14" font-weight="700">
    <text x="980" y="180">Cuvette 8500 m² — Thémines (Lot)</text>
  </g>
  <g id="sentiers" opacity="0.9">
    <path data-path="lande->prairie" data-title="Sentier Lande → Prairie"
          data-desc="Chemin principal depuis la lande en pente vers la prairie en cuvette."
          d="M 260 520 C 420 520, 560 500, 720 470"
          stroke="#2c6b4b" stroke-width="8" fill="none" stroke-linecap="round" stroke-dasharray="3 10"/>
    <path data-path="prairie->potager" data-title="Sentier Prairie → Potager"
          data-desc="Descente douce vers le potager vivant et les vivaces utiles."
          d="M 820 520 C 860 580, 900 640, 900 700"
          stroke="#2c6b4b" stroke-width="8" fill="none" stroke-linecap="round" stroke-dasharray="3 10"/>
    <path data-path="prairie->lisiere_est" data-title="Sentier Lisière Est"
          data-desc="Boucle lisière mi‑ombre (lianes et arbustes)."
          d="M 980 250 C 1100 320, 1210 410, 1340 520"
          stroke="#2c6b4b" stroke-width="8" fill="none" stroke-linecap="round" stroke-dasharray="3 10"/>
  </g>
  <g id="points"></g>
</svg>
</div>`;
}

function wirePaths(container) {
  if(!container) return;
  const paths = container.querySelectorAll('[data-path]');
  paths.forEach(path => {
    path.setAttribute('role', 'button');
    path.setAttribute('tabindex', '0');
    path.setAttribute('aria-label', path.dataset.title || 'Sentier');
    path.addEventListener('click', () => {
      const title = path.dataset.title || 'Sentier';
      const desc = path.dataset.desc || '';
      modal(title, desc);
    });
    path.addEventListener('keydown', (e) => {
      if(e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        path.click();
      }
    });
  });
}

function renderMap(){
  const mapWrap = $("#mapSvgWrap");
  if(!mapWrap) return;
  
  mapWrap.innerHTML = mapTemplate();
  wirePaths(mapWrap);
  const pointsG = $("#points", mapWrap);
  if(!pointsG) return;
  
  // Utiliser DocumentFragment pour optimiser le rendu
  const fragment = document.createDocumentFragment();
  
  state.filtered.forEach(p=>{
    if(!p.pos || typeof p.pos.x !== 'number' || typeof p.pos.y !== 'number') return;
    
    const g = document.createElementNS("http://www.w3.org/2000/svg","g");
    g.classList.add("point");
    g.dataset.id = p.id;
    g.setAttribute('role', 'button');
    g.setAttribute('tabindex', '0');
    g.setAttribute('aria-label', `${p.name} - ${p.layer}`);
    if(p.totem) g.classList.add("point--totem");
    if(p.category) g.classList.add(`point--${p.category}`);
    if(p.layer) g.dataset.layer = p.layer;

    const aura = document.createElementNS("http://www.w3.org/2000/svg","circle");
    aura.setAttribute("cx", p.pos.x);
    aura.setAttribute("cy", p.pos.y);
    aura.setAttribute("r", p.totem ? 40 : 32);
    aura.setAttribute("fill", p.totem ? "url(#glowGold)" : "url(#glow)");
    aura.classList.add("point__pulse");

    const dot = document.createElementNS("http://www.w3.org/2000/svg","circle");
    dot.setAttribute("cx", p.pos.x);
    dot.setAttribute("cy", p.pos.y);
    dot.setAttribute("r", 8);
    dot.setAttribute("fill", p.totem ? "#ffe6a6" : (p.category==="rare" ? "#91d7ff" : "#b7ffcf"));
    dot.setAttribute("stroke", "#06110b");
    dot.setAttribute("stroke-width", 2);

    const label = document.createElementNS("http://www.w3.org/2000/svg","text");
    label.setAttribute("x", p.pos.x + 12);
    label.setAttribute("y", p.pos.y + 6);
    label.setAttribute("fill", "#dfece4");
    label.setAttribute("font-size", "16");
    label.setAttribute("opacity", "0.9");
    label.textContent = p.name;

    g.appendChild(aura);
    g.appendChild(dot);
    g.appendChild(label);
    
    const handleClick = () => openPlant(p.id);
    g.addEventListener("click", handleClick);
    g.addEventListener("keydown", (e) => {
      if(e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleClick();
      }
    });
    
    fragment.appendChild(g);
  });
  
  pointsG.appendChild(fragment);
  updateMapBadge();
  window.iso3d?.refreshPlants?.();
}

function updateMapBadge(){
  const badge = $("#mapBadge");
  if(!badge) return;
  if(!state.plants.length){
    badge.innerHTML = `<strong>Carte en chargement…</strong><span>Patientez un instant.</span>`;
    return;
  }
  const total = state.plants.length;
  const filtered = state.filtered.length || total;
  const totems = state.filtered.filter(p=>p.totem).length;
  badge.innerHTML = `<strong>${filtered} espèce(s) visibles</strong><span>${totems} totems • ${total} au total</span>`;
}

// ---------- Plant screen avec lazy loading ----------
function openPlant(id){
  if(!id) return;
  state.activePlantId = id;
  const p = state.plants.find(x=>x.id===id);
  if(!p) {
    modal("Plante introuvable", "Cette plante n'existe pas ou a été supprimée.");
    return;
  }

  const layerEl = $("#plantLayer");
  const nameEl = $("#plantName");
  const imgEl = $("#plantImg");
  
  if(layerEl) layerEl.textContent = layerLabel(p.layer);
  if(nameEl) nameEl.textContent = p.name;
  if(imgEl) {
    imgEl.alt = `${p.name} - ${p.latin || ''}`;
    loadImageLazy(imgEl, p.image);
    // Gestion d'erreur d'image
    imgEl.onerror = () => {
      imgEl.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="300"%3E%3Crect fill="%230f1511" width="400" height="300"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" fill="%23a7b7ac" font-size="16"%3EImage non disponible%3C/text%3E%3C/svg%3E';
    };
  }

  const tags = $("#plantTags");
  if(tags) {
    tags.innerHTML = "";
    if(Array.isArray(p.tags)) {
      p.tags.forEach(t=>{
        const span = document.createElement("span");
        span.className = "chip";
        span.textContent = t;
        tags.appendChild(span);
      });
    }
  }

  const introEl = $("#plantIntro");
  const storyEl = $("#plantStory");
  if(introEl) introEl.textContent = p.intro || '';
  if(storyEl) storyEl.textContent = p.story || '';

  const facts = $("#plantFacts");
  if(facts) {
    facts.innerHTML = "";
    [
      ["Nom latin", p.latin],
      ["Origine", p.origin],
      ["Rusticité", p.hardiness],
      ["Sol / pH", p.soil],
      ["Eau", p.water],
      ["Rendement", p.yield],
    ].forEach(([k,v])=>{
      if(!v) return;
      const li = document.createElement("li");
      li.innerHTML = `<strong>${k} :</strong> ${v}`;
      facts.appendChild(li);
    });
  }

  const eco = $("#plantEco");
  if(eco) {
    eco.innerHTML = "";
    if(Array.isArray(p.eco)) {
      p.eco.forEach(e=>{
        const li = document.createElement("li");
        li.textContent = e;
        eco.appendChild(li);
      });
    }
  }

  const nurseryEl = $("#plantNursery");
  if(nurseryEl) nurseryEl.textContent = p.nursery || '';

  const favBtn = $("#toggleFavorite");
  if(favBtn) {
    favBtn.textContent = state.favorites.has(p.id) ? "★" : "☆";
    favBtn.setAttribute('aria-label', state.favorites.has(p.id) ? 'Retirer des favoris' : 'Ajouter aux favoris');
  }

  // Quest progress if totem
  if(p.totem){
    state.questFound.add(p.id);
    updateQuestUI();
  }

  go("plant");
}

function layerLabel(layer){
  const labels = {
    canopy:"Canopée",
    subcanopy:"Sous‑étage",
    shrub:"Arbustes",
    herb:"Herbacées",
    groundcover:"Couvre‑sol",
    rhizosphere:"Racines",
    climber:"Grimpantes"
  };
  return labels[layer] || layer;
}

// Prev/Next within filtered list
function navPlant(dir){
  const list = state.filtered.length ? state.filtered : state.plants;
  const idx = list.findIndex(p=>p.id===state.activePlantId);
  if(idx<0) return;
  const nextIdx = (idx + dir + list.length) % list.length;
  openPlant(list[nextIdx].id);
}

// ---------- Tour audio ----------
function setTourAudioSource(){
  const items = $$("#tourList li");
  if(!items.length) return null;
  const id = items[state.tourIndex]?.dataset.id;
  if(!id) return null;
  const p = state.plants.find(x=>x.id===id);
  if(!p || !p.audio) return null;
  state.tourAudio.src = p.audio;
  state.tourAudio.dataset.id = id;
  const statusEl = $("#tourAudioStatus");
  if(statusEl) statusEl.textContent = `Lecture : ${p.name}`;
  return p;
}

function playPauseTour(){
  if(!state.tourPlaying){
    const p = setTourAudioSource();
    if(!p){
      const statusEl = $("#tourAudioStatus");
      if(statusEl) statusEl.textContent = "Aucun audio pour cette plante (ajoute un mp3 dans plants.json).";
      return;
    }
    state.tourAudio.play().catch((e) => {
      handleError(e, 'playPauseTour');
      const statusEl = $("#tourAudioStatus");
      if(statusEl) statusEl.textContent = "Erreur de lecture audio.";
    });
    state.tourPlaying = true;
    const btn = $("#tourPlayPause");
    if(btn) btn.textContent = "⏸ Pause";
  }else{
    state.tourAudio.pause();
    state.tourPlaying = false;
    const btn = $("#tourPlayPause");
    const statusEl = $("#tourAudioStatus");
    if(btn) btn.textContent = "▶ Lecture";
    if(statusEl) statusEl.textContent = "Pause.";
  }
}

function stopTourAudio(){
  state.tourAudio.pause();
  state.tourAudio.currentTime = 0;
  state.tourPlaying = false;
  const btn = $("#tourPlayPause");
  const statusEl = $("#tourAudioStatus");
  if(btn) btn.textContent = "▶ Lecture";
  if(statusEl) statusEl.textContent = "Stop.";
}

if(state.tourAudio) {
  state.tourAudio.addEventListener("ended", ()=>{
    state.tourPlaying = false;
    const btn = $("#tourPlayPause");
    const statusEl = $("#tourAudioStatus");
    if(btn) btn.textContent = "▶ Lecture";
    const autoNext = $("#tourAutoNext");
    if(autoNext?.checked){
      tourStep(1);
      playPauseTour();
    }else{
      if(statusEl) statusEl.textContent = "Terminé.";
    }
  });
}

// ---------- Tour (visite guidée) ----------
function renderTour(){
  const tourMapWrap = $("#tourMapWrap");
  if(tourMapWrap) {
    tourMapWrap.innerHTML = mapTemplate();
    wirePaths(tourMapWrap);
  }

  const list = $("#tourList");
  if(!list) return;
  list.innerHTML = "";
  const order = state.tourOrder.length ? state.tourOrder : state.plants.map(p=>p.id);

  order.forEach((id, i)=>{
    const p = state.plants.find(x=>x.id===id);
    if(!p) return;
    const li = document.createElement("li");
    li.textContent = `${p.name} — ${layerLabel(p.layer)} (${p.zone})`;
    li.dataset.id = id;
    li.setAttribute('role', 'button');
    li.setAttribute('tabindex', '0');
    li.onclick = ()=>{
      state.tourIndex = i;
      highlightTour();
    };
    li.addEventListener('keydown', (e) => {
      if(e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        li.click();
      }
    });
    list.appendChild(li);
  });
  highlightTour(true);
}

function highlightTour(scroll=false){
  const items = $$("#tourList li");
  items.forEach((li, idx)=> {
    const isActive = idx===state.tourIndex;
    li.classList.toggle("active", isActive);
    li.setAttribute('aria-selected', isActive ? 'true' : 'false');
  });
  if(scroll && items[state.tourIndex]){
    items[state.tourIndex].scrollIntoView({block:"center", behavior:"smooth"});
  }
}

function tourStep(delta){
  const items = $$("#tourList li");
  if(!items.length) return;
  state.tourIndex = (state.tourIndex + delta + items.length) % items.length;
  highlightTour(true);
}

function openTourCurrent(){
  const items = $$("#tourList li");
  if(!items.length) return;
  const id = items[state.tourIndex]?.dataset.id;
  if(id) openPlant(id);
}

function startTour(){
  modal("Visite guidée", "Suivez l'ordre des étapes. Utilise ←/→ pour avancer.");
  go("tour");
}

// ---------- Quest ----------
function renderQuest(){
  const questMapWrap = $("#questMapWrap");
  if(questMapWrap) {
    questMapWrap.innerHTML = mapTemplate();
    const pointsG = $("#points", questMapWrap);
    if(!pointsG) return;
    
    const fragment = document.createDocumentFragment();
    
    state.plants.forEach(p=>{
      if(!p.pos || typeof p.pos.x !== 'number' || typeof p.pos.y !== 'number') return;
      
      const g = document.createElementNS("http://www.w3.org/2000/svg","g");
      g.classList.add("point");
      g.dataset.id = p.id;
      g.setAttribute('role', 'button');
      g.setAttribute('tabindex', '0');
      g.setAttribute('aria-label', p.totem ? `${p.name} - Totem` : p.name);

      const aura = document.createElementNS("http://www.w3.org/2000/svg","circle");
      aura.setAttribute("cx", p.pos.x);
      aura.setAttribute("cy", p.pos.y);
      aura.setAttribute("r", p.totem ? 46 : 28);
      aura.setAttribute("fill", p.totem ? "url(#glowGold)" : "url(#glow)");
      aura.classList.add("point__pulse");
      aura.style.opacity = p.totem ? "1" : "0.25";

      const dot = document.createElementNS("http://www.w3.org/2000/svg","circle");
      dot.setAttribute("cx", p.pos.x);
      dot.setAttribute("cy", p.pos.y);
      dot.setAttribute("r", 8);
      dot.setAttribute("fill", p.totem ? "#ffe6a6" : "#b7ffcf");
      dot.setAttribute("stroke", "#06110b");
      dot.setAttribute("stroke-width", 2);
      dot.style.opacity = p.totem ? "1" : "0.3";

      g.appendChild(aura);
      g.appendChild(dot);
      
      const handleClick = () => {
        if(p.totem){
          state.questFound.add(p.id);
          modal("Totem trouvé ✨", `<strong>${p.name}</strong><br>${p.secret || ''}`);
          updateQuestUI();
        }else{
          modal("Pas un totem", "Continue à chercher les auras dorées !");
        }
      };
      g.addEventListener("click", handleClick);
      g.addEventListener("keydown", (e) => {
        if(e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
        }
      });
      
      fragment.appendChild(g);
    });
    
    pointsG.appendChild(fragment);
  }

  const totems = state.plants.filter(p=>p.totem);
  const listWrap = $("#questList");
  if(listWrap) {
    listWrap.innerHTML = "";
    totems.forEach(t=>{
      const row = document.createElement("div");
      row.className = "questitem";
      row.dataset.id = t.id;
      row.innerHTML = `<span>${t.name}</span><span class="small">à trouver</span>`;
      listWrap.appendChild(row);
    });
  }

  updateQuestUI();
}

function updateQuestUI(){
  const totems = state.plants.filter(p=>p.totem);
  const foundCount = [...state.questFound].filter(id=>totems.some(t=>t.id===id)).length;
  const progressEl = $("#questProgressText");
  const barEl = $("#questBar");
  const rewardEl = $("#questReward");
  
  if(progressEl) progressEl.textContent = `${foundCount} / ${totems.length} trouvées`;
  if(barEl) barEl.style.width = `${totems.length > 0 ? (foundCount/totems.length)*100 : 0}%`;

  $$(".questitem").forEach(row=>{
    const id = row.dataset.id;
    const found = state.questFound.has(id);
    const small = row.querySelector(".small");
    if(small) small.textContent = found ? "trouvé ✔" : "à trouver";
    row.style.opacity = found ? "0.7" : "1";
  });

  if(rewardEl) rewardEl.hidden = foundCount < totems.length;
}

function resetQuest(){
  state.questFound.clear();
  updateQuestUI();
}

// ---------- Future Canvas ----------
function renderFuture(){
  const canvas = $("#futureCanvas");
  if(!canvas) return;
  const ctx = canvas.getContext("2d");
  if(!ctx) return;

  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0,0,W,H);

  const skyGrad = ctx.createLinearGradient(0,0,0,H);
  skyGrad.addColorStop(0, "#06110b");
  skyGrad.addColorStop(1, "#10251a");
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0,0,W,H);

  // Mist
  for(let i=0;i<9;i++){
    ctx.globalAlpha = 0.08;
    ctx.beginPath();
    ctx.ellipse(
      Math.random()*W, H*0.55 + Math.random()*120,
      220+Math.random()*320, 40+Math.random()*80, 0, 0, Math.PI*2
    );
    ctx.fillStyle = "#cfe6d7";
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  const groundGrad = ctx.createLinearGradient(0,H*0.5,0,H);
  groundGrad.addColorStop(0,"#0a160f");
  groundGrad.addColorStop(1,"#050906");
  ctx.fillStyle = groundGrad;
  ctx.fillRect(0,H*0.55,W,H);

  function tree(x, baseY, h, color){
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x, baseY);
    ctx.lineTo(x-18, baseY-h*0.45);
    ctx.lineTo(x+18, baseY-h*0.45);
    ctx.closePath(); ctx.fill();

    ctx.beginPath();
    ctx.moveTo(x, baseY-h*0.2);
    ctx.lineTo(x-32, baseY-h*0.7);
    ctx.lineTo(x+32, baseY-h*0.7);
    ctx.closePath(); ctx.fill();

    ctx.beginPath();
    ctx.moveTo(x, baseY-h*0.45);
    ctx.lineTo(x-42, baseY-h);
    ctx.lineTo(x+42, baseY-h);
    ctx.closePath(); ctx.fill();

    ctx.fillRect(x-3, baseY, 6, h*0.2);
  }

  for(let i=0;i<70;i++){
    tree(Math.random()*W, H*0.60+Math.random()*30, 90+Math.random()*120, "rgba(16,60,40,0.9)");
  }
  for(let i=0;i<35;i++){
    tree(Math.random()*W, H*0.75+Math.random()*40, 140+Math.random()*220, "rgba(20,90,55,0.95)");
  }

  for(let i=0;i<120;i++){
    ctx.globalAlpha = Math.random()*0.6;
    ctx.fillStyle = Math.random()>0.5 ? "#b7ffcf" : "#91d7ff";
    ctx.fillRect(Math.random()*W, H*0.55+Math.random()*(H*0.4), 2, 2);
  }
  ctx.globalAlpha = 1;
}

function renderFutureStats(){
  const ul = $("#futureStats");
  if(!ul) return;
  
  const canopy = state.plants.filter(p=>p.layer==="canopy").length;
  const shrubs = state.plants.filter(p=>p.layer==="shrub").length;
  const rare = state.plants.filter(p=>p.category==="rare").length;

  ul.innerHTML = "";
  [
    `≈ ${canopy*3} m² de canopée projetée`,
    `≈ ${shrubs*2} niches d'arbustes nourriciers`,
    `≈ ${rare} espèces rares suivies`,
    `Infiltration améliorée par couvert permanent`,
    `Retour de pollinisateurs et auxiliaires (objectif)`
  ].forEach(t=>{
    const li = document.createElement("li");
    li.textContent = t;
    ul.appendChild(li);
  });
}

// ---------- Studio 3D personnalisé ----------
function loadStudioScene(){
  try{
    const raw = localStorage.getItem("gea_studio_scene");
    if(raw){
      const arr = JSON.parse(raw);
      if(Array.isArray(arr)) state.studio.items = arr;
    }
  }catch(e){
    handleError(e, "loadStudioScene");
  }
}

function saveStudioScene(){
  try{
    localStorage.setItem("gea_studio_scene", JSON.stringify(state.studio.items));
    studioStatus("Scène sauvegardée.");
  }catch(e){
    handleError(e, "saveStudioScene");
  }
}

function studioStatus(text){
  const el = $("#studioStatus");
  if(el) el.textContent = text;
}

function ensureThreeForStudio(callback){
  if(window.THREE) return callback();
  const existing = document.getElementById("threejs-cdn");
  const onload = ()=> {
    studioStatus("Palette prête. Sélectionne un élément.");
    callback();
  };
  const onerror = ()=>{
    studioStatus("Impossible de charger Three.js. Vérifie ta connexion.");
  };
  if(existing){
    existing.addEventListener("load", onload, {once:true});
    existing.addEventListener("error", onerror, {once:true});
    return;
  }
  const script = document.createElement("script");
  script.src = "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.min.js";
  script.onload = onload;
  script.onerror = onerror;
  document.head.appendChild(script);
}

function studioSetActiveAsset(id){
  state.studio.activeAsset = id;
  renderStudioPalette();
  studioStatus(id ? "Clique dans la scène pour placer un élément." : "Palette inactive.");
}

function renderStudioPalette(){
  const wrap = $("#studioPalette");
  if(!wrap) return;
  wrap.innerHTML = "";
  STUDIO_ASSETS.forEach(asset=>{
    const btn = document.createElement("button");
    btn.className = "studio__asset"+(state.studio.activeAsset===asset.id?" active":"");
    btn.style.setProperty("--asset-color", asset.color);
    btn.innerHTML = `<span class="asset__icon">●</span><span>${asset.label}</span>`;
    btn.onclick = ()=> studioSetActiveAsset(asset.id);
    wrap.appendChild(btn);
  });
}

function renderStudioList(){
  const list = $("#studioList");
  if(!list) return;
  if(!state.studio.items.length){
    list.classList.add("empty");
    list.textContent = "Aucun élément.";
    return;
  }
  list.classList.remove("empty");
  list.innerHTML = "";
  state.studio.items.forEach(item=>{
    const row = document.createElement("button");
    row.className = "studio__listItem"+(item.id===state.studio.selectedId?" is-active":"");
    row.innerHTML = `<span>${item.name || item.asset}</span><small>${item.asset}</small>`;
    row.onclick = ()=> studioSelectItem(item.id);
    list.appendChild(row);
  });
}

function renderStudioDetails(){
  const nameInput = $("#studioPropName");
  const heightInput = $("#studioPropHeight");
  const notesInput = $("#studioPropNotes");
  const heightLabel = $("#studioHeightValue");
  const deleteBtn = $("#studioDelete");
  const item = state.studio.items.find(i=>i.id===state.studio.selectedId);
  const hasItem = Boolean(item);
  [nameInput,heightInput,notesInput,deleteBtn].forEach(el=>{
    if(!el) return;
    el.disabled = !hasItem;
  });
  if(!item){
    if(nameInput) nameInput.value = "";
    if(heightInput) heightInput.value = 10;
    if(notesInput) notesInput.value = "";
    if(heightLabel) heightLabel.textContent = "—";
    return;
  }
  if(nameInput) nameInput.value = item.name || "";
  if(heightInput){
    const h = item.height ?? 10;
    heightInput.value = h;
    if(heightLabel) heightLabel.textContent = `${Math.round(h)} m`;
  }
  if(notesInput) notesInput.value = item.notes || "";
}

function studioSelectItem(id){
  state.studio.selectedId = id;
  renderStudioList();
  renderStudioDetails();
  highlightStudioSelection();
}

function studioAddItem(position){
  const asset = STUDIO_ASSETS.find(a=>a.id===state.studio.activeAsset);
  if(!asset){
    studioStatus("Choisis un élément dans la palette.");
    return;
  }
  const id = `studio_${Date.now()}_${Math.floor(Math.random()*1000)}`;
  const item = {
    id,
    asset: asset.id,
    name: `${asset.label}`,
    height: asset.height,
    color: asset.color,
    notes: "",
    position:{
      x: Math.max(-110, Math.min(110, position.x)),
      z: Math.max(-110, Math.min(110, position.z))
    }
  };
  state.studio.items.push(item);
  saveStudioScene();
  renderStudioList();
  studioSelectItem(id);
  rebuildStudioMeshes();
}

function studioUpdateSelected(prop, value){
  const item = state.studio.items.find(i=>i.id===state.studio.selectedId);
  if(!item) return;
  item[prop] = value;
  saveStudioScene();
  renderStudioList();
  rebuildStudioMeshes();
}

function studioDeleteSelected(){
  if(!state.studio.selectedId) return;
  state.studio.items = state.studio.items.filter(i=>i.id!==state.studio.selectedId);
  state.studio.selectedId = null;
  saveStudioScene();
  renderStudioList();
  renderStudioDetails();
  rebuildStudioMeshes();
}

function studioResetScene(){
  if(!state.studio.items.length) return;
  if(confirm("Effacer tous les éléments de votre scène personnalisée ?")){
    state.studio.items = [];
    state.studio.selectedId = null;
    saveStudioScene();
    renderStudioList();
    renderStudioDetails();
    rebuildStudioMeshes();
  }
}

function studioExportScene(){
  const data = JSON.stringify(state.studio.items, null, 2);
  if(navigator.clipboard?.writeText){
    navigator.clipboard.writeText(data).then(()=>{
      studioStatus("JSON copié dans le presse-papiers.");
    }).catch(()=>{
      studioStatus("Impossible de copier automatiquement.");
    });
  }else{
    studioStatus("Copie manuelle : "+data.slice(0,80)+"...");
  }
}

function initStudio(){
  loadStudioScene();
  if(!state.studio.activeAsset && STUDIO_ASSETS[0]){
    state.studio.activeAsset = STUDIO_ASSETS[0].id;
  }
  renderStudioPalette();
  renderStudioList();
  renderStudioDetails();
  studioStatus("Chargement de la scène 3D…");
  ensureThreeForStudio(()=>{
    initStudioCanvas();
    studioStatus("Sélectionne un élément et clique dans la scène.");
  });
  const propName = $("#studioPropName");
  if(propName) propName.addEventListener("input", e=> studioUpdateSelected("name", e.target.value));
  const propHeight = $("#studioPropHeight");
  if(propHeight) propHeight.addEventListener("input", e=>{
    const v = Number(e.target.value);
    $("#studioHeightValue").textContent = `${v} m`;
    studioUpdateSelected("height", v);
  });
  const propNotes = $("#studioPropNotes");
  if(propNotes) propNotes.addEventListener("input", e=> studioUpdateSelected("notes", e.target.value));
  const deleteBtn = $("#studioDelete");
  if(deleteBtn) deleteBtn.onclick = studioDeleteSelected;
  const backBtn = $("#studioBack");
  if(backBtn) backBtn.onclick = ()=> go("map");
  const resetBtn = $("#studioReset");
  if(resetBtn) resetBtn.onclick = studioResetScene;
  const saveBtn = $("#studioSave");
  if(saveBtn) saveBtn.onclick = saveStudioScene;
  const exportBtn = $("#studioExport");
  if(exportBtn) exportBtn.onclick = studioExportScene;
}

function initStudioCanvas(){
  const canvas = $("#studioCanvas");
  if(!canvas || !window.THREE || state.studio.renderer) return;
  state.studio.canvas = canvas;
  const renderer = new THREE.WebGLRenderer({canvas, antialias:true, alpha:true});
  renderer.setPixelRatio(window.devicePixelRatio||1);
  renderer.setSize(canvas.clientWidth, canvas.clientHeight);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x010302);
  const camera = new THREE.PerspectiveCamera(55, canvas.clientWidth/canvas.clientHeight, 0.1, 2000);
  state.studio.renderer = renderer;
  state.studio.scene = scene;
  state.studio.camera = camera;
  updateStudioCamera();
  const hemi = new THREE.HemisphereLight(0xffffff, 0x0f1a12, 0.7);
  scene.add(hemi);
  const dir = new THREE.DirectionalLight(0xffffff, 0.6);
  dir.position.set(120, 200, 80);
  scene.add(dir);
  const planeGeo = new THREE.PlaneGeometry(240, 240, 1, 1);
  const planeMat = new THREE.MeshStandardMaterial({color:0x0b2116, side:THREE.DoubleSide});
  const plane = new THREE.Mesh(planeGeo, planeMat);
  plane.rotation.x = -Math.PI/2;
  scene.add(plane);
  state.studio.plane = plane;
  const grid = new THREE.GridHelper(240, 24, 0x335642, 0x1f3c2c);
  scene.add(grid);
  state.studio.grid = grid;
  state.studio.meshGroup = new THREE.Group();
  scene.add(state.studio.meshGroup);
  state.studio.raycaster = new THREE.Raycaster();
  state.studio.pointer = new THREE.Vector2();
  canvas.addEventListener("pointerdown", studioPointerDown);
  canvas.addEventListener("pointermove", studioPointerMove);
  canvas.addEventListener("pointerup", studioPointerUp);
  canvas.addEventListener("click", studioCanvasClick);
  canvas.addEventListener("wheel", studioHandleWheel, {passive:true});
  window.addEventListener("resize", studioHandleResize);
  rebuildStudioMeshes();
  studioAnimate();
}

function updateStudioCamera(){
  const {azimuth, polar, radius} = state.studio.orbit;
  const radAz = azimuth * Math.PI/180;
  const radPol = polar * Math.PI/180;
  const r = radius;
  const x = r * Math.sin(radPol) * Math.cos(radAz);
  const y = r * Math.cos(radPol);
  const z = r * Math.sin(radPol) * Math.sin(radAz);
  if(state.studio.camera){
    state.studio.camera.position.set(x, y, z);
    state.studio.camera.lookAt(0,0,0);
  }
}

function rebuildStudioMeshes(){
  const group = state.studio.meshGroup;
  if(!group || !window.THREE) return;
  while(group.children.length){
    group.remove(group.children[0]);
  }
  const selected = state.studio.selectedId;
  state.studio.items.forEach(item=>{
    const mesh = createStudioMesh(item, selected);
    group.add(mesh);
  });
  scheduleStudioRender();
}

function createStudioMesh(item, selectedId){
  const asset = STUDIO_ASSETS.find(a=>a.id===item.asset) || STUDIO_ASSETS[0];
  let geometry;
  const height = (item.height || asset.height || 10);
  const color = item.color || asset.color;
  switch(asset.shape){
    case "cone":
      geometry = new THREE.ConeGeometry(height*0.35, height, 8);
      break;
    case "cylinder":
      geometry = new THREE.CylinderGeometry(height*0.3, height*0.4, height, 12);
      break;
    case "disk":
      geometry = new THREE.CylinderGeometry(height, height, 0.8, 24);
      break;
    case "pyramid":
      geometry = new THREE.ConeGeometry(height*0.4, height, 4);
      break;
    case "box":
    default:
      geometry = new THREE.BoxGeometry(height*0.6, height, height*0.6);
  }
  const material = new THREE.MeshStandardMaterial({color});
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(item.position?.x || 0, height/2, item.position?.z || 0);
  mesh.userData = {id:item.id};
  if(item.id===selectedId){
    mesh.scale.setScalar(1.08);
    mesh.material.emissive = new THREE.Color(0x224433);
  }
  return mesh;
}

function highlightStudioSelection(){
  if(!state.studio.meshGroup) return;
  state.studio.meshGroup.children.forEach(mesh=>{
    const selected = mesh.userData.id===state.studio.selectedId;
    mesh.scale.setScalar(selected ? 1.08 : 1);
    if(mesh.material){
      mesh.material.emissive = new THREE.Color(selected ? 0x224433 : 0x000000);
    }
  });
  scheduleStudioRender();
}

function studioPointerDown(e){
  if(!state.studio.canvas) return;
  state.studio.dragging = true;
  state.studio.dragMoved = false;
  state.studio.lastPointer = {x:e.clientX, y:e.clientY};
  state.studio.canvas.setPointerCapture(e.pointerId);
}

function studioPointerMove(e){
  if(!state.studio.dragging) return;
  const dx = e.clientX - state.studio.lastPointer.x;
  const dy = e.clientY - state.studio.lastPointer.y;
  if(Math.abs(dx)>2 || Math.abs(dy)>2){
    state.studio.dragMoved = true;
  }
  state.studio.lastPointer = {x:e.clientX, y:e.clientY};
  state.studio.orbit.azimuth = (state.studio.orbit.azimuth - dx*0.25) % 360;
  state.studio.orbit.polar = Math.max(20, Math.min(85, state.studio.orbit.polar + dy*0.2));
  updateStudioCamera();
  scheduleStudioRender();
}

function studioPointerUp(e){
  state.studio.dragging = false;
  if(state.studio.canvas) state.studio.canvas.releasePointerCapture(e.pointerId);
}

function studioCanvasClick(e){
  if(state.studio.dragMoved) return;
  handleStudioRaycast(e);
}

function handleStudioRaycast(e){
  if(!state.studio.canvas || !state.studio.raycaster || !state.studio.pointer) return;
  const rect = state.studio.canvas.getBoundingClientRect();
  state.studio.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  state.studio.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  state.studio.raycaster.setFromCamera(state.studio.pointer, state.studio.camera);
  const objectHits = state.studio.meshGroup ? state.studio.raycaster.intersectObjects(state.studio.meshGroup.children, false) : [];
  if(objectHits.length){
    studioSelectItem(objectHits[0].object.userData.id);
    studioStatus("Élément sélectionné.");
    return;
  }
  if(state.studio.activeAsset){
    const planeHit = state.studio.raycaster.intersectObject(state.studio.plane);
    if(planeHit.length){
      studioAddItem(planeHit[0].point);
      return;
    }
  }
  studioStatus("Rien ici. Choisis un élément pour le placer.");
}

function studioHandleWheel(e){
  const delta = Math.sign(e.deltaY);
  state.studio.orbit.radius = Math.max(40, Math.min(220, state.studio.orbit.radius + delta*6));
  updateStudioCamera();
  scheduleStudioRender();
}

function studioHandleResize(){
  const canvas = state.studio.canvas;
  if(!canvas || !state.studio.renderer || !state.studio.camera) return;
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  state.studio.renderer.setSize(width, height, false);
  state.studio.camera.aspect = width / height;
  state.studio.camera.updateProjectionMatrix();
  scheduleStudioRender();
}

function studioAnimate(){
  if(!state.studio.renderer || !state.studio.scene || !state.studio.camera) return;
  state.studio.animId = requestAnimationFrame(studioAnimate);
  if(state.studio.needsRender){
    state.studio.renderer.render(state.studio.scene, state.studio.camera);
    state.studio.needsRender = false;
  }
}

function scheduleStudioRender(){
  state.studio.needsRender = true;
}

// ---------- Sponsor counters (demo) ----------
function bumpSponsor(id){
  if(!id) return;
  track("sponsor", id);
  const el = $("#"+id+"Clicks");
  if(el) el.textContent = (+el.textContent||0)+1;
  saveLocal();
}

function openExternal(url, fallbackScreen){
  if(url && url !== "#"){
    window.open(url, "_blank", "noopener,noreferrer");
  }else if(fallbackScreen){
    go(fallbackScreen);
  }
}

// ---------- Events avec gestion d'erreurs ----------
function wireEvents(){
  const enterBtn = $("#enterBtn");
  if(enterBtn) enterBtn.onclick = ()=> go("map");
  
  $$("#backToPortal, #backToMap, #backToMap2, #backToMap3, #backToMap4, #backToMap5, #backToMapTour, #backToMapIso").forEach(btn => {
    if(btn) btn.onclick = ()=> go("map");
  });

  const openQuestBtn = $("#openQuest");
  if(openQuestBtn) openQuestBtn.onclick = ()=> go("quest");
  
  const backAfterQuestBtn = $("#backAfterQuest");
  if(backAfterQuestBtn) backAfterQuestBtn.onclick = ()=> go("map");

  const resetQuestBtn = $("#resetQuest");
  if(resetQuestBtn) resetQuestBtn.onclick = resetQuest;

  const searchInput = $("#searchInput");
  if(searchInput) {
    searchInput.addEventListener("input", applyFilters);
    searchInput.setAttribute('aria-label', 'Rechercher une plante');
  }

  const prevPlantBtn = $("#prevPlant");
  const nextPlantBtn = $("#nextPlant");
  if(prevPlantBtn) prevPlantBtn.onclick = ()=> navPlant(-1);
  if(nextPlantBtn) nextPlantBtn.onclick = ()=> navPlant(1);

  const toggleFavoriteBtn = $("#toggleFavorite");
  if(toggleFavoriteBtn) {
    toggleFavoriteBtn.onclick = ()=>{
      const id = state.activePlantId;
      if(!id) return;
      if(state.favorites.has(id)) state.favorites.delete(id);
      else state.favorites.add(id);
      toggleFavoriteBtn.textContent = state.favorites.has(id) ? "★" : "☆";
      toggleFavoriteBtn.setAttribute('aria-label', state.favorites.has(id) ? 'Retirer des favoris' : 'Ajouter aux favoris');
      saveLocal();
    };
  }

  const shareBtn = $("#shareBtn");
  if(shareBtn) {
    shareBtn.onclick = async ()=>{
      const p = state.plants.find(x=>x.id===state.activePlantId);
      if(!p) return;
      const url = `${location.origin}${location.pathname}#plant=${encodeURIComponent(p.id)}`;
      try {
        await navigator.clipboard.writeText(url);
        modal("Lien copié", "Tu peux partager cette fiche.");
      } catch(e) {
        // Fallback pour navigateurs sans clipboard API
        const textarea = document.createElement('textarea');
        textarea.value = url;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        try {
          document.execCommand('copy');
          modal("Lien copié", "Tu peux partager cette fiche.");
        } catch(err) {
          modal("Erreur", "Impossible de copier le lien. URL: " + url);
        }
        document.body.removeChild(textarea);
      }
    };
  }

  const nurseryBtn = $("#nurseryBtn");
  if(nurseryBtn) nurseryBtn.onclick = ()=>{
    if(APP_CONFIG.NURSERY_URL && APP_CONFIG.NURSERY_URL !== "#"){
      openExternal(APP_CONFIG.NURSERY_URL);
    }else{
      modal("Pépinière", `Relie ce bouton à ta boutique sur <strong>${APP_CONFIG.SITE_URL}</strong>.`);
    }
  };

  const playAudioBtn = $("#playAudio");
  if(playAudioBtn) playAudioBtn.onclick = ()=>{
    modal("Guide vocal (placeholder)", "Ajoute un mp3 dans assets/audio/ et relie-le dans plants.json.");
  };

  const openARBtn = $("#openAR");
  if(openARBtn) openARBtn.onclick = ()=>{
    modal("AR (démo)", "Plus tard, tu peux intégrer un viewer WebXR ou 8thWall.");
  };

  const regenFutureBtn = $("#regenFuture");
  if(regenFutureBtn) regenFutureBtn.onclick = renderFuture;

  const donateBtn = $("#donateBtn");
  if(donateBtn) donateBtn.onclick = ()=> openExternal(APP_CONFIG.DONATE_URL, "sponsor");
  
  const volunteerBtn = $("#volunteerBtn");
  if(volunteerBtn) volunteerBtn.onclick = ()=> {
    if(APP_CONFIG.VOLUNTEER_URL && APP_CONFIG.VOLUNTEER_URL !== "#"){
      openExternal(APP_CONFIG.VOLUNTEER_URL);
    }else{
      modal("Bénévolat", "Ajoute ici ton formulaire ou relie une page dédiée sur ton site.");
    }
  };
  
  const workshopBtn = $("#workshopBtn");
  if(workshopBtn) workshopBtn.onclick = ()=> {
    if(APP_CONFIG.WORKSHOP_URL && APP_CONFIG.WORKSHOP_URL !== "#"){
      openExternal(APP_CONFIG.WORKSHOP_URL);
    }else{
      modal("Ateliers", "Ajoute les dates et réservations disponibles sur gardeauarbres.fr.");
    }
  };

  $$(".sponsor__item").forEach(a=>{
    a.addEventListener("click",(e)=>{
      const sponsor = a.dataset.sponsor;
      if(sponsor) {
        bumpSponsor(sponsor);
      }
      const url = a.getAttribute("href");
      if(!url || url==="#" ){
        e.preventDefault();
        modal("Merci 💚","Compteur incrémenté (démo). Ajoute un lien pour ce sponsor.");
      }
    });
  });

  const shareSanctuaryBtn = $("#shareSanctuary");
  if(shareSanctuaryBtn) {
    shareSanctuaryBtn.onclick = async ()=>{
      const url = `${location.origin}${location.pathname}`;
      try {
        await navigator.clipboard.writeText(url);
        modal("Merci !", "Lien du sanctuaire copié.");
      } catch(e) {
        const textarea = document.createElement('textarea');
        textarea.value = url;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        try {
          document.execCommand('copy');
          modal("Merci !", "Lien du sanctuaire copié.");
        } catch(err) {
          modal("Erreur", "Impossible de copier le lien.");
        }
        document.body.removeChild(textarea);
      }
    };
  }

  const tourPrevBtn = $("#tourPrev");
  const tourNextBtn = $("#tourNext");
  const tourOpenPlantBtn = $("#tourOpenPlant");
  const startTourBtn = $("#startTourBtn");
  if(tourPrevBtn) tourPrevBtn.onclick = ()=> tourStep(-1);
  if(tourNextBtn) tourNextBtn.onclick = ()=> tourStep(1);
  if(tourOpenPlantBtn) tourOpenPlantBtn.onclick = openTourCurrent;
  if(startTourBtn) startTourBtn.onclick = startTour;

  const tourPlayPauseBtn = $("#tourPlayPause");
  const tourStopBtn = $("#tourStop");
  if(tourPlayPauseBtn) tourPlayPauseBtn.onclick = playPauseTour;
  if(tourStopBtn) tourStopBtn.onclick = stopTourAudio;

  const regenIsoBtn = $("#regenIso");
  const isoOpenSelectedBtn = $("#isoOpenSelected");
  if(regenIsoBtn) regenIsoBtn.onclick = ()=> window.iso3d?.render?.();
  if(isoOpenSelectedBtn) {
    isoOpenSelectedBtn.onclick = ()=>{
      if(state.selectedIsoId) openPlant(state.selectedIsoId);
      else modal("Sélectionne une plante", "Clique un marqueur dans la vue 3D.");
    };
  }

  $$(".bottomnav__btn").forEach(b=>{
    b.onclick = ()=> {
      const screen = b.dataset.go;
      if(screen) go(screen);
    };
  });

  const ambience = $("#ambience");
  const muteBtn = $("#muteBtn");
  if(muteBtn && ambience) {
    muteBtn.onclick = ()=>{
      state.muted = !state.muted;
      ambience.muted = state.muted;
      muteBtn.textContent = state.muted ? "Ambiance : OFF" : "Ambiance : ON";
      muteBtn.setAttribute("aria-pressed", String(state.muted));
      if(!state.muted) ambience.play().catch(()=>{});
    };
  }

  window.addEventListener("hashchange", handleHash);
  
  // Navigation clavier globale
  document.addEventListener('keydown', (e) => {
    // Échap pour fermer modals
    if(e.key === 'Escape') {
      const modal = $("#modal");
      if(modal && modal.open) modal.close();
    }
  });
}

function handleHash(){
  const h = location.hash || "";
  const m = h.match(/plant=([^&]+)/);
  if(m){
    const id = decodeURIComponent(m[1]);
    openPlant(id);
  }
}

// ---------- Boot optimisé ----------
(async function init(){
  try {
    loadLocal();
    setupImageObserver();
    initParallax();
    wireEvents();
    initStudio();
    await loadPlants();
    renderFuture();
    go("portal");

    const treesEl = $("#treesCount");
    const visitsEl = $("#visitsCount");
    if(treesEl) treesEl.textContent = 180;
    if(visitsEl) visitsEl.textContent = 0;
    track("visit");

    // Autoplay ambience only after user action (browser policy)
    document.addEventListener("click", ()=>{
      if(state.muted) return;
      const ambience = $("#ambience");
      if(ambience) ambience.play().catch(()=>{});
    }, {once:true});

    handleHash();
    
    // Service Worker registration (si disponible)
    if('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
          .then(reg => {
            if(DEBUG) {
              console.log('Service Worker registered:', reg);
            }
          })
          .catch(err => {
            if(DEBUG) {
              console.warn('Service Worker registration failed:', err);
            }
          });
      });
    }
  } catch(e) {
    handleError(e, 'init');
    modal("Erreur d'initialisation", "L'application n'a pas pu démarrer correctement.");
  }
})();

// iso3d.js — nouvelle scène Three.js fidèle au terrain réel.

(function(){
  const MAP_SIZE = {width:1600, height:900};
  const TERRAIN_TEXTURE = "assets/img/terrain-ortho.jpg"; // À déposer dans ce dossier.
  const IMAGE_SIZE = {width:496, height:520};
  const REAL_AREA_M2 = 8370;
  const ALTITUDE = {min:-6.5, max:5.5}; // Profil cuvette
  const POLYGON_PX = [
    [204,70],[190,185],[83,233],[143,250],[157,417],[239,385],[192,440],
    [255,519],[294,376],[371,370],[305,519],[391,519],[392,337],[462,298],
    [412,258],[283,307],[365,117],[204,70]
  ];

  const isoState = {
    canvas:null,
    renderer:null,
    scene:null,
    camera:null,
    raycaster:null,
    pointer:null,
    dragging:false,
    dragMoved:false,
    lastPointer:{x:0,y:0},
    orbit:{azimuth:40, polar:55, radius:140},
    terrain:null,
    terrainMaterial:null,
    terrainBounds:null,
    terrainRadius:120,
    plantGroup:null,
    showLabels:true,
    selectedId:null,
    animId:null,
    needsResize:true
  };

  const terrainData = prepareTerrainData();

  document.addEventListener("DOMContentLoaded", init);

  function init(){
    const canvas = document.getElementById("isoCanvas");
    if(!canvas) return;
    isoState.canvas = canvas;
    ensureThree(()=>{
      setupScene();
      animate();
      hookUI();
      window.iso3d = {
        refreshPlants,
        toggleLabels: toggleLabels,
        resetCamera
      };
      refreshPlants();
    });
  }

  function ensureThree(cb){
    if(window.THREE && THREE.TextureLoader) return cb();
    const script = document.getElementById("threejs-cdn");
    if(script){
      script.addEventListener("load", cb, {once:true});
      script.addEventListener("error", ()=>console.error("Impossible de charger Three.js"));
      return;
    }
    const s = document.createElement("script");
    s.id = "threejs-cdn";
    s.src = "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.min.js";
    s.onload = cb;
    s.onerror = ()=> console.error("Impossible de charger Three.js");
    document.head.appendChild(s);
  }

  function setupScene(){
    const canvas = isoState.canvas;
    const renderer = new THREE.WebGLRenderer({canvas, antialias:true, alpha:true});
    renderer.setPixelRatio(window.devicePixelRatio||1);
    renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
    renderer.outputEncoding = THREE.sRGBEncoding;
    isoState.renderer = renderer;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x030705);
    isoState.scene = scene;

    const camera = new THREE.PerspectiveCamera(55, canvas.clientWidth/canvas.clientHeight, 0.1, 2000);
    isoState.camera = camera;
    updateCamera();

    scene.add(new THREE.AmbientLight(0xbfd1ff, 0.35));
    const sun = new THREE.DirectionalLight(0xffffff, 0.9);
    sun.position.set(90, 180, 60);
    sun.castShadow = false;
    scene.add(sun);

    const {mesh, material} = buildTerrainMesh();
    scene.add(mesh);
    isoState.terrain = mesh;
    isoState.terrainMaterial = material;
    loadTerrainTexture(material);

    isoState.plantGroup = new THREE.Group();
    scene.add(isoState.plantGroup);

    isoState.raycaster = new THREE.Raycaster();
    isoState.pointer = new THREE.Vector2();

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("click", onCanvasClick);
    canvas.addEventListener("wheel", onWheel, {passive:true});
    window.addEventListener("resize", ()=> isoState.needsResize = true);
  }

  function hookUI(){
    document.addEventListener("click", (e)=>{
      if(e.target?.id==="isoToggleLabels"){
        toggleLabels();
      }
      if(e.target?.id==="isoCenter"){
        resetCamera();
      }
    });
  }

  function toggleLabels(){
    isoState.showLabels = !isoState.showLabels;
    isoState.plantGroup?.children.forEach(mesh=>{
      if(mesh.userData.label){
        mesh.userData.label.visible = isoState.showLabels;
      }
    });
  }

  function resetCamera(){
    isoState.orbit = {azimuth:40, polar:55, radius:140};
    updateCamera();
  }

  function animate(){
    isoState.animId = requestAnimationFrame(animate);
    if(isoState.needsResize) handleResize();
    isoState.renderer?.render(isoState.scene, isoState.camera);
  }

  function handleResize(){
    isoState.needsResize = false;
    const canvas = isoState.canvas;
    if(!canvas || !isoState.renderer || !isoState.camera) return;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    isoState.renderer.setSize(width, height, false);
    isoState.camera.aspect = width / height;
    isoState.camera.updateProjectionMatrix();
  }

  function onPointerDown(e){
    isoState.dragging = true;
    isoState.dragMoved = false;
    isoState.lastPointer = {x:e.clientX, y:e.clientY};
    isoState.canvas.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e){
    if(!isoState.dragging) return;
    const dx = e.clientX - isoState.lastPointer.x;
    const dy = e.clientY - isoState.lastPointer.y;
    if(Math.abs(dx)>2 || Math.abs(dy)>2) isoState.dragMoved = true;
    isoState.lastPointer = {x:e.clientX, y:e.clientY};
    isoState.orbit.azimuth = (isoState.orbit.azimuth - dx*0.3) % 360;
    isoState.orbit.polar = THREE.MathUtils.clamp(isoState.orbit.polar + dy*0.25, 20, 85);
    updateCamera();
  }

  function onPointerUp(e){
    isoState.dragging = false;
    isoState.canvas.releasePointerCapture(e.pointerId);
  }

  function onWheel(e){
    isoState.orbit.radius = THREE.MathUtils.clamp(isoState.orbit.radius + Math.sign(e.deltaY)*6, 60, 220);
    updateCamera();
  }

  function onCanvasClick(e){
    if(isoState.dragMoved) return;
    pickPlant(e);
  }

  function pickPlant(e){
    if(!isoState.plantGroup) return;
    const rect = isoState.canvas.getBoundingClientRect();
    isoState.pointer.x = ((e.clientX - rect.left) / rect.width)*2 - 1;
    isoState.pointer.y = -((e.clientY - rect.top) / rect.height)*2 + 1;
    isoState.raycaster.setFromCamera(isoState.pointer, isoState.camera);
    const intersects = isoState.raycaster.intersectObjects(isoState.plantGroup.children, true);
    if(intersects.length){
      const mesh = findPlantRoot(intersects[0].object);
      if(mesh){
        isoState.selectedId = mesh.userData.id;
        highlightPlants();
        window.state.selectedIsoId = mesh.userData.id;
      }
    }
  }

  function findPlantRoot(obj){
    while(obj && !obj.userData?.id && obj.parent){
      obj = obj.parent;
    }
    return obj?.userData?.id ? obj : null;
  }

  function updateCamera(){
    const {azimuth, polar, radius} = isoState.orbit;
    const az = THREE.MathUtils.degToRad(azimuth);
    const pol = THREE.MathUtils.degToRad(polar);
    const x = radius * Math.sin(pol) * Math.cos(az);
    const y = radius * Math.cos(pol);
    const z = radius * Math.sin(pol) * Math.sin(az);
    isoState.camera.position.set(x, y, z);
    isoState.camera.lookAt(0,0,0);
  }

  function prepareTerrainData(){
    const centered = POLYGON_PX.map(([x,y])=>({
      x: (x - IMAGE_SIZE.width/2),
      y: (IMAGE_SIZE.height/2 - y) // inverser Y pour avoir origine centre
    }));
    const pxArea = Math.abs(polygonArea(centered));
    const scale = Math.sqrt(REAL_AREA_M2 / pxArea);
    const points = centered.map(p=>({x:p.x*scale, z:p.y*scale}));
    const bounds = computeBounds(points);
    const center = {
      x:(bounds.minX + bounds.maxX)/2,
      z:(bounds.minZ + bounds.maxZ)/2
    };
    const radius = points.reduce((max, p)=>{
      const dx = p.x-center.x;
      const dz = p.z-center.z;
      return Math.max(max, Math.sqrt(dx*dx+dz*dz));
    },0);
    isoState.terrainBounds = bounds;
    isoState.terrainCenter = center;
    isoState.terrainRadius = radius;
    isoState.heightFn = (x,z)=> computeElevation(x,z);
    return {points, scale};
  }

  function polygonArea(points){
    let area = 0;
    const n = points.length;
    for(let i=0;i<n;i++){
      const p1 = points[i];
      const p2 = points[(i+1)%n];
      area += p1.x*p2.y - p2.x*p1.y;
    }
    return area/2;
  }

  function computeBounds(points){
    return points.reduce((acc,p)=>{
      acc.minX = Math.min(acc.minX, p.x);
      acc.maxX = Math.max(acc.maxX, p.x);
      acc.minZ = Math.min(acc.minZ, p.z);
      acc.maxZ = Math.max(acc.maxZ, p.z);
      return acc;
    }, {minX:Infinity,maxX:-Infinity,minZ:Infinity,maxZ:-Infinity});
  }

  function computeElevation(x,z){
    const dx = x - isoState.terrainCenter.x;
    const dz = z - isoState.terrainCenter.z;
    const norm = THREE.MathUtils.clamp(Math.sqrt(dx*dx+dz*dz)/isoState.terrainRadius, 0, 1);
    const bowl = Math.pow(norm, 1.25);
    return ALTITUDE.min + (ALTITUDE.max - ALTITUDE.min)*bowl;
  }

  function buildTerrainMesh(){
    const shape = new THREE.Shape();
    terrainData.points.forEach((p,idx)=>{
      if(idx===0) shape.moveTo(p.x, p.z);
      else shape.lineTo(p.x, p.z);
    });
    const geometry = new THREE.ShapeGeometry(shape, 4);
    geometry.rotateX(-Math.PI/2);
    const pos = geometry.attributes.position;
    for(let i=0;i<pos.count;i++){
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const h = computeElevation(x,z);
      pos.setY(i, h);
    }
    pos.needsUpdate = true;
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    const material = new THREE.MeshStandardMaterial({
      color:0x173522,
      metalness:0.05,
      roughness:0.9,
      flatShading:false
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.receiveShadow = true;
    return {mesh, material};
  }

  function loadTerrainTexture(material){
    if(!THREE.TextureLoader) return;
    const loader = new THREE.TextureLoader();
    loader.load(TERRAIN_TEXTURE, (tex)=>{
      tex.encoding = THREE.sRGBEncoding;
      tex.anisotropy = 8;
      material.map = tex;
      material.needsUpdate = true;
    }, undefined, ()=>{
      console.warn("[iso3d] Texture terrain introuvable :", TERRAIN_TEXTURE);
    });
  }

  function refreshPlants(){
    if(!isoState.plantGroup) return;
    isoState.plantGroup.clear();
    const plants = window.state?.filtered?.length ? window.state.filtered : (window.state?.plants||[]);
    plants.forEach(p=>{
      const world = plantToWorld(p.pos);
      const height = computeElevation(world.x, world.z);
      const mesh = createPlantMesh(p, height);
      mesh.position.set(world.x, height, world.z);
      isoState.plantGroup.add(mesh);
    });
    highlightPlants();
  }

  function plantToWorld(pos){
    const bounds = isoState.terrainBounds;
    const nx = THREE.MathUtils.clamp(pos.x / MAP_SIZE.width, 0, 1);
    const nz = THREE.MathUtils.clamp(pos.y / MAP_SIZE.height, 0, 1);
    const x = THREE.MathUtils.lerp(bounds.minX, bounds.maxX, nx);
    const z = THREE.MathUtils.lerp(bounds.minZ, bounds.maxZ, nz);
    return {x,z};
  }

  function createPlantMesh(plant, height){
    const color = plant.totem ? 0xffe6a6 : (plant.category==="rare" ? 0x91d7ff : 0xb7ffcf);
    const geo = new THREE.ConeGeometry(height*0.35, Math.max(4,height*0.7), 8);
    const mat = new THREE.MeshStandardMaterial({color, emissive: plant.id===isoState.selectedId ? 0x224433 : 0x000000});
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.userData = {id:plant.id};
    const label = createLabelSprite(plant.name);
    label.position.set(0, Math.max(4, height)+2, 0);
    label.visible = isoState.showLabels;
    mesh.add(label);
    mesh.userData.label = label;
    return mesh;
  }

  function createLabelSprite(text){
    const canvas = document.createElement("canvas");
    const size = 256;
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "rgba(7,10,8,0.75)";
    ctx.strokeStyle = "rgba(255,255,255,0.15)";
    ctx.lineWidth = 4;
    if(ctx.roundRect){
      ctx.beginPath();
      ctx.roundRect(16, size/2-34, size-32, 68, 24);
      ctx.fill();
      ctx.stroke();
    }else{
      ctx.fillRect(16, size/2-34, size-32, 68);
      ctx.strokeRect(16, size/2-34, size-32, 68);
    }
    ctx.fillStyle = "#f5fff6";
    ctx.font = "bold 44px 'Inter', system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, size/2, size/2);
    const texture = new THREE.CanvasTexture(canvas);
    texture.encoding = THREE.sRGBEncoding;
    const material = new THREE.SpriteMaterial({map:texture, transparent:true, depthWrite:false});
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(10, 4, 1);
    return sprite;
  }

  function highlightPlants(){
    if(!isoState.plantGroup) return;
    isoState.plantGroup.children.forEach(mesh=>{
      mesh.traverse(node=>{
        if(node.isMesh){
          node.material.emissive?.setHex(mesh.userData.id===isoState.selectedId ? 0x224433 : 0x000000);
        }
      });
    });
  }
})();
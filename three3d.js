// three3d.js — optional full 3D scene using Three.js CDN (online).
// This does NOT run offline without internet.
// Replace with local Three.js build if desired.

(function(){
  let enabled = false;
  let scene, camera, renderer, raycaster, mouse, markers=[];
  let animId = null;

  function loadThree(cb){
    if(window.THREE) return cb();
    const s = document.createElement("script");
    s.src = "https://unpkg.com/three@0.161.0/build/three.min.js";
    s.onload = cb;
    s.onerror = ()=>alert("Impossible de charger Three.js (vérifie ta connexion).");
    document.head.appendChild(s);
  }

  function buildScene(){
    const canvas = document.getElementById("isoCanvas");
    if(!canvas) return;
    renderer = new THREE.WebGLRenderer({canvas, antialias:true, alpha:true});
    renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x06110b);

    const w = canvas.clientWidth, h=canvas.clientHeight;
    camera = new THREE.PerspectiveCamera(50, w/h, 0.1, 2000);
    camera.position.set(0, 220, 320);
    camera.lookAt(0,0,0);

    const hemi = new THREE.HemisphereLight(0xb7ffcf, 0x0b2016, 1.0);
    scene.add(hemi);
    const dir = new THREE.DirectionalLight(0xffffff, 0.6);
    dir.position.set(200,300,100);
    scene.add(dir);

    // ground plane
    const groundGeo = new THREE.PlaneGeometry(600, 360, 1, 1);
    const groundMat = new THREE.MeshStandardMaterial({color:0x0f2a1b});
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI/2;
    scene.add(ground);

    // markers from plants
    const plants = window.state?.plants || [];
    markers = [];
    plants.forEach(p=>{
      const z = p.layer==="canopy" ? 50 : p.layer==="subcanopy" ? 32 : p.layer==="shrub" ? 18 : 8;
      const x = (p.pos.x-800)/3.2;
      const y = (p.pos.y-450)/3.2;

      const geo = new THREE.ConeGeometry(z*0.22, z, 7);
      const col = p.totem ? 0xffe6a6 : (p.category==="rare" ? 0x91d7ff : 0xb7ffcf);
      const mat = new THREE.MeshStandardMaterial({color:col});
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, z/2, y);
      m.userData = {id:p.id};
      scene.add(m);
      markers.push(m);
    });

    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();

    canvas.onclick = (e)=>{
      const rect=canvas.getBoundingClientRect();
      mouse.x = ((e.clientX-rect.left)/rect.width)*2-1;
      mouse.y = -((e.clientY-rect.top)/rect.height)*2+1;
      raycaster.setFromCamera(mouse, camera);
      const hits = raycaster.intersectObjects(markers);
      if(hits[0]){
        const id = hits[0].object.userData.id;
        window.state.selectedIsoId = id;
      }
    };

    function animate(){
      animId = requestAnimationFrame(animate);
      renderer.render(scene,camera);
    }
    animate();
  }

  function enable(){
    if(enabled) return;
    enabled = true;
    loadThree(()=>buildScene());
  }

  window.three3d = { enable };
})();
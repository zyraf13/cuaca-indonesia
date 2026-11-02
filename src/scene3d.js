// Procedural 3D weather diorama. No external assets: everything is geometry.
// ponytail: one diorama per condition, no particle physics; add GLB/shaders only if it must look photoreal.
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';

const PALETTE = {
  sun:     {top:0x2f7fd0, bottom:0xbfe6ff, light:3.1, warm:0xfff1c9, clouds:0, rain:0, fog:8},
  partly:  {top:0x2b6ea8, bottom:0xa8cfe4, light:2.4, warm:0xffeeda, clouds:4, rain:0, fog:14},
  cloud:   {top:0x3b4a5e, bottom:0x92a4b5, light:1.5, warm:0xdfe7ef, clouds:7, rain:0, fog:18},
  rain:    {top:0x39485c, bottom:0x8698ab, light:1.2, warm:0xc2cfdd, clouds:8, rain:1400, fog:11},
  storm:   {top:0x1a2230, bottom:0x4a5a6e, light:.8, warm:0x93a3b8, clouds:9, rain:2200, fog:7},
  fog:     {top:0x4a5769, bottom:0xb3bdc8, light:1.2, warm:0xd7dee6, clouds:3, rain:0, fog:4},
  unknown: {top:0x25314a, bottom:0x7b8aa2, light:1.8, warm:0xdce6f5, clouds:3, rain:0, fog:14},
};

function glowTexture(){
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const rg = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  rg.addColorStop(0, 'rgba(255,247,214,1)');
  rg.addColorStop(.35, 'rgba(255,214,120,.55)');
  rg.addColorStop(1, 'rgba(255,200,90,0)');
  g.fillStyle = rg;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function rainTexture(){
  // square canvas so a Point sprite keeps the streak thin (texture aspect is not honoured)
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const lg = g.createLinearGradient(0, 4, 0, 60);
  lg.addColorStop(0, 'rgba(215,238,255,0)');
  lg.addColorStop(.35, 'rgba(215,238,255,.95)');
  lg.addColorStop(1, 'rgba(215,238,255,0)');
  g.fillStyle = lg;
  g.fillRect(29, 3, 6, 58);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function createScene(canvas){
  const renderer = new THREE.WebGLRenderer({canvas, antialias:true, alpha:false});
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(46, 1, .1, 400);
  camera.position.set(0, 1.6, 9.5);

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = .08;
  controls.enablePan = false;
  controls.minDistance = 4.4;
  controls.maxDistance = 15;
  controls.minPolarAngle = .55;
  controls.maxPolarAngle = 2.05;
  controls.autoRotate = false;

  // Sky dome: gradient by vertex height, driven by uniforms.
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(160, 24, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        top: {value: new THREE.Color(PALETTE.sun.top)},
        bottom: {value: new THREE.Color(PALETTE.sun.bottom)},
      },
      vertexShader: 'varying float h; void main(){ h = normalize(position).y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
      fragmentShader: 'uniform vec3 top; uniform vec3 bottom; varying float h; void main(){ gl_FragColor = vec4(mix(bottom, top, smoothstep(-.25,.75,h)), 1.); }',
    })
  );
  scene.add(sky);

  const hemi = new THREE.HemisphereLight(0xffffff, 0x22303f, 1.1);
  scene.add(hemi);
  const key = new THREE.DirectionalLight(0xfff1c9, 2.4);
  key.position.set(4, 6, 5);
  scene.add(key);

  // Sun
  const sun = new THREE.Group();
  const sunCore = new THREE.Mesh(
    new THREE.SphereGeometry(1, 32, 24),
    new THREE.MeshBasicMaterial({color: 0xfff4cf})
  );
  const sunGlow = new THREE.Sprite(new THREE.SpriteMaterial({map: glowTexture(), transparent:true, depthWrite:false, blending:THREE.AdditiveBlending}));
  sunGlow.scale.setScalar(7.2);
  sun.add(sunCore, sunGlow);
  sun.position.set(3.4, 3.4, -6.2);
  scene.add(sun);

  // Clouds: puff clusters, cheap and readable.
  const cloudMat = new THREE.MeshStandardMaterial({color:0xffffff, roughness:.95, metalness:0, transparent:true, opacity:.96});
  const clouds = new THREE.Group();
  const puffGeo = new THREE.IcosahedronGeometry(1, 1);
  const cloudSlots = [];
  for (let i = 0; i < 10; i++){
    const c = new THREE.Group();
    const puffs = 4 + (i % 3);
    for (let p = 0; p < puffs; p++){
      const m = new THREE.Mesh(puffGeo, cloudMat.clone());
      const s = .55 + Math.random() * .55;
      m.scale.set(s * 1.5, s, s * 1.15);
      m.position.set((p - puffs / 2) * .62 + Math.random() * .2, Math.random() * .34, Math.random() * .4);
      c.add(m);
    }
    c.userData = {
      baseY: 1.2 + Math.random() * 2.4,
      baseZ: -1 - Math.random() * 5,
      speed: .08 + Math.random() * .12,
      phase: Math.random() * Math.PI * 2,
    };
    c.position.set((Math.random() - .5) * 12, c.userData.baseY, c.userData.baseZ);
    clouds.add(c);
    cloudSlots.push(c);
  }
  scene.add(clouds);

  // Rain: one Points cloud recycled in a column.
  const RAIN_MAX = 2200;
  const rainGeo = new THREE.BufferGeometry();
  const rainPos = new Float32Array(RAIN_MAX * 3);
  const rainVel = new Float32Array(RAIN_MAX);
  for (let i = 0; i < RAIN_MAX; i++){
    rainPos[i * 3] = (Math.random() - .5) * 13;
    rainPos[i * 3 + 1] = Math.random() * 11;
    rainPos[i * 3 + 2] = (Math.random() - .5) * 9;
    rainVel[i] = .08 + Math.random() * .12;
  }
  rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
  rainGeo.setDrawRange(0, 0);
  const rainMat = new THREE.PointsMaterial({color:0xd6ecff, size:.34, map:rainTexture(), transparent:true, opacity:.8, depthWrite:false, sizeAttenuation:true, blending:THREE.NormalBlending});
  const rain = new THREE.Points(rainGeo, rainMat);
  scene.add(rain);

  // Ground haze so the diorama has a base.
  const haze = new THREE.Mesh(
    new THREE.CircleGeometry(13, 48),
    new THREE.MeshBasicMaterial({color:0x0d1626, transparent:true, opacity:.55})
  );
  haze.rotation.x = -Math.PI / 2;
  haze.position.y = -2.1;
  scene.add(haze);

  let current = 'unknown';
  let target = PALETTE.unknown;
  const tmpTop = new THREE.Color(), tmpBottom = new THREE.Color();
  let flash = 0;

  function apply(preset){
    target = preset;
    tmpTop.set(preset.top);
    tmpBottom.set(preset.bottom);
    const count = Math.round(preset.clouds);
    cloudSlots.forEach((c, i) => {
      c.visible = i < count;
      const shade = preset === PALETTE.storm ? 0x5b6675 : preset === PALETTE.rain ? 0x8d9aa8 : preset === PALETTE.cloud ? 0xd8dfe7 : 0xffffff;
      c.children.forEach(m => m.material.color.setHex(shade));
      c.children.forEach(m => { m.material.opacity = preset === PALETTE.storm ? .95 : .92; });
    });
    sun.visible = preset === PALETTE.sun || preset === PALETTE.partly;
    sunCore.material.color.setHex(preset === PALETTE.partly ? 0xfff2d0 : 0xfff6d8);
    sunGlow.scale.setScalar(preset === PALETTE.sun ? 8.4 : 5.4);
    sunGlow.material.opacity = preset === PALETTE.sun ? .95 : .6;
    rainGeo.setDrawRange(0, preset.rain);
    rainMat.opacity = preset === PALETTE.storm ? .55 : .75;
    key.intensity = preset === PALETTE.sun ? 3.4 : preset.light;
    hemi.intensity = Math.max(.55, preset.light * .55);
    haze.material.opacity = preset.storm ? .7 : .5;
  }

  // Smooth palette transition instead of a hard cut.
  function setCondition(name){
    if (!PALETTE[name] || name === current) return;
    current = name;
    apply(PALETTE[name]);
    const topFrom = sky.material.uniforms.top.value.clone();
    const bottomFrom = sky.material.uniforms.bottom.value.clone();
    const t0 = performance.now();
    const step = () => {
      const k = Math.min(1, (performance.now() - t0) / 420);
      sky.material.uniforms.top.value.lerpColors(topFrom, tmpTop, k);
      sky.material.uniforms.bottom.value.lerpColors(bottomFrom, tmpBottom, k);
      if (k < 1) requestAnimationFrame(step);
    };
    step();
    if (name === 'storm') flash = 1;
  }

  function resize(){
    const w = canvas.clientWidth || 1, h = canvas.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  const clock = new THREE.Clock();
  let raf = 0;
  let running = true;

  function frame(){
    raf = requestAnimationFrame(frame);
    const dt = Math.min(clock.getDelta(), .05);
    const t = clock.elapsedTime;

    if (rainGeo.drawRange.count){
      for (let i = 0; i < rainGeo.drawRange.count; i++){
        rainPos[i * 3 + 1] -= rainVel[i] * 60 * dt;
        if (rainPos[i * 3 + 1] < -2.1){
          rainPos[i * 3 + 1] = 10 + Math.random() * 2;
          rainPos[i * 3] = (Math.random() - .5) * 13;
          rainPos[i * 3 + 2] = (Math.random() - .5) * 9;
        }
      }
      rainGeo.attributes.position.needsUpdate = true;
    }

    cloudSlots.forEach(c => {
      if (!c.visible) return;
      c.position.x += c.userData.speed * dt;
      if (c.position.x > 7.5) c.position.x = -7.5;
      c.position.y = c.userData.baseY + Math.sin(t * .6 + c.userData.phase) * .12;
    });

    if (flash > 0){
      flash = Math.max(0, flash - dt * 2.2);
      if (Math.random() < .012) flash = 1;
      hemi.intensity = Math.max(.55, target.light * .55) + flash * 1.5;
    }

    sun.rotation.y += dt * .06;
    controls.update();
    renderer.render(scene, camera);
  }

  function start(){ if (!running){ running = true; clock.getDelta(); frame(); } }
  function stop(){ running = false; cancelAnimationFrame(raf); }

  const onVisibility = () => (document.hidden ? stop() : start());
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('resize', resize);

  resize();
  apply(PALETTE.unknown);
  frame();

  return {
    setCondition,
    resize,
    start,
    stop,
    dispose(){
      stop();
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', onVisibility);
      controls.dispose();
      scene.traverse(o => {
        o.geometry?.dispose?.();
        if (Array.isArray(o.material)) o.material.forEach(m => m.dispose());
        else o.material?.dispose?.();
      });
      renderer.dispose();
    },
  };
}

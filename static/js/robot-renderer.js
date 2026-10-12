import * as THREE from './vendor/three.module.min.js';
import { Robot } from './robot-model.js?v=20261012-binocular-2';

// Page adapter for Klemen Kotar's procedural rover (see robot-model.js).
export function mountRobot(button, track) {
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0xffffff, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.className = 'robot-canvas';
  renderer.domElement.setAttribute('aria-hidden', 'true');
  button.append(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1.3, 1.3, 1.3, -1.3, .1, 30);
  camera.position.set(2.8, 3.3, 6);
  camera.lookAt(0, .8, 0);
  const cameraYaw = Math.atan2(camera.position.x, camera.position.z);
  scene.add(new THREE.HemisphereLight(0xfff6e8, 0xd8cfc0, .95));
  const key = new THREE.DirectionalLight(0xffffff, 1.55);
  key.position.set(-2.5, 5, 3);
  key.castShadow = true;
  key.shadow.mapSize.set(512, 512);
  Object.assign(key.shadow.camera, { left: -2, right: 2, top: 2, bottom: -2 });
  key.shadow.normalBias = .02;
  key.shadow.radius = 5;
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xcfe8ff, .3);
  fill.position.set(2, 2, -2);
  scene.add(fill);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(6, 6), new THREE.ShadowMaterial({ opacity: .14 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -.04;
  floor.receiveShadow = true;
  scene.add(floor);

  const robot = new Robot();
  const rig = robot.group;
  scene.add(rig);
  let visible = true;
  let alive = true;
  let frame = 0;
  let lastTime = 0;
  let userYaw = 0;
  let drag = null;
  let dragged = false;
  let emoteTime = 0;
  let emoteName = '';
  let spinStart = 0;
  let previousSpeed = 0;
  let pointer = null;
  const events = new AbortController();
  const listen = (target, name, handler, options = {}) => target.addEventListener(name, handler, { ...options, signal: events.signal });
  const motionAllowed = () => !track.classList.contains('is-paused') && !track.classList.contains('is-reduced-motion');
  const speed = () => track.dataset.gait === 'running' ? 235 : track.dataset.gait === 'walking' ? 80 : 0;
  const draw = () => renderer.render(scene, camera);
  const cancelEmote = () => {
    emoteName = '';
    emoteTime = 0;
    robot.idle = null;
    robot.head.rotation.z = 0;
    robot.lookToward(null);
    robot.setMood('normal');
  };
  robot.onEmote = name => {
    button.dataset.animation = name;
    if (name === 'spin') {
      emoteName = 'Spin';
      emoteTime = 0;
      spinStart = rig.rotation.y;
    }
  };

  const tick = time => {
    frame = 0;
    if (!alive || !visible || document.hidden || !motionAllowed()) return;
    const interval = window.innerWidth <= 700 ? 50 : 33;
    if (time - lastTime >= interval) {
      const dt = Math.min((time - lastTime) / 1000, .05);
      lastTime = time;
      const velocity = speed();
      if (velocity && (emoteName || robot.idle)) cancelEmote();
      if (emoteName) {
        emoteTime += dt;
        if (emoteTime > (emoteName === 'Spin' ? 1.4 : 2.4)) cancelEmote();
      }
      const facing = Number(track.dataset.facing);
      const yaw = velocity && Number.isFinite(facing) ? facing + cameraYaw : userYaw;
      let turn = 0;
      if (!drag) {
        if (emoteName === 'Spin') {
          const progress = Math.min(emoteTime / 1.25, 1);
          const next = spinStart + Math.PI * 2 * progress * progress * (3 - 2 * progress);
          turn = (next - rig.rotation.y) / dt;
          rig.rotation.y = next;
        } else {
          const delta = Math.atan2(Math.sin(yaw - rig.rotation.y), Math.cos(yaw - rig.rotation.y));
          turn = delta * Math.min(1, dt * 9) / dt;
          rig.rotation.y += turn * dt;
        }
      }
      if (robot.idle !== 'lookAround') {
        if (track.classList.contains('is-reading') && !velocity) robot.lookToward({ x: .75, y: -.1 });
        else if (pointer && !velocity && !drag) {
          const bounds = button.getBoundingClientRect();
          const x = pointer.x - bounds.left - bounds.width / 2;
          const y = pointer.y - bounds.top - bounds.height / 2;
          robot.lookToward(Math.hypot(x, y) < 350 ? {
            x: THREE.MathUtils.clamp(x / 180, -1, 1), y: THREE.MathUtils.clamp(-y / 180, -1, 1)
          } : null);
        } else robot.lookToward(null);
      }
      robot.update(dt, { speed: velocity, maxSpeed: 235, accel: Math.sign(velocity - previousSpeed), turn: THREE.MathUtils.clamp(turn, -3, 3) });
      previousSpeed = velocity;
      if (!robot.idle && !emoteName) button.dataset.animation = velocity ? 'Driving' : 'Idle';
      draw();
    }
    frame = requestAnimationFrame(tick);
  };
  const wake = () => {
    if (!alive || frame || !visible || document.hidden || !motionAllowed()) return;
    lastTime = performance.now();
    frame = requestAnimationFrame(tick);
  };
  const stop = () => { cancelAnimationFrame(frame); frame = 0; };
  const resize = () => {
    const { width, height } = button.getBoundingClientRect();
    if (!width || !height || !alive) return;
    renderer.setSize(width, height, false);
    const halfHeight = 1.25;
    const halfWidth = halfHeight * width / height;
    Object.assign(camera, { left: -halfWidth, right: halfWidth, top: halfHeight, bottom: -halfHeight });
    camera.updateProjectionMatrix();
    draw();
  };
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(button);
  const visibilityObserver = new IntersectionObserver(entries => {
    visible = entries[0]?.isIntersecting ?? true;
    if (visible) wake(); else stop();
  });
  visibilityObserver.observe(button);
  const stateObserver = new MutationObserver(() => {
    if (!motionAllowed()) stop(); else wake();
  });
  stateObserver.observe(track, { attributes: true, attributeFilter: ['class', 'data-gait', 'data-facing'] });

  listen(track, 'companion:action', event => {
    const name = event.detail?.name;
    if (!motionAllowed() || !['Wave', 'Happy', 'HeadTilt', 'LookAround', 'Wiggle', 'Spin', 'Jump'].includes(name)) return;
    cancelEmote();
    emoteName = name;
    button.dataset.animation = name;
    if (name === 'Wave') robot.wave();
    else if (name === 'Jump') { robot.bounce(1.4); robot.setMood('happy'); }
    else if (name === 'Spin') { spinStart = rig.rotation.y; robot.setMood('happy'); robot.bounce(.5); }
    else {
      robot.idle = { Happy: 'happy', HeadTilt: 'headTilt', LookAround: 'lookAround', Wiggle: 'wiggle' }[name];
      robot.idleT = 0;
    }
    wake();
  });
  listen(button, 'pointerdown', event => {
    if (!motionAllowed() || event.button !== 0) return;
    cancelEmote();
    dragged = false;
    userYaw = rig.rotation.y;
    drag = { x: event.clientX, yaw: userYaw };
    button.setPointerCapture(event.pointerId);
  });
  listen(button, 'pointermove', event => {
    if (!drag || !motionAllowed()) return;
    const dx = event.clientX - drag.x;
    if (Math.abs(dx) > 4) dragged = true;
    userYaw = drag.yaw + dx * .016;
    rig.rotation.y = userYaw;
    draw();
  });
  const stopDrag = () => { drag = null; wake(); };
  listen(button, 'pointerup', stopDrag);
  listen(button, 'pointercancel', stopDrag);
  listen(button, 'lostpointercapture', stopDrag);
  listen(button, 'click', event => {
    const wasDrag = dragged && event.detail > 0;
    dragged = false;
    if (wasDrag) { event.preventDefault(); event.stopImmediatePropagation(); }
  }, { capture: true });
  listen(button, 'keydown', event => {
    if (!motionAllowed() || !['ArrowLeft', 'ArrowRight', 'Home'].includes(event.key)) return;
    event.preventDefault();
    cancelEmote();
    userYaw = event.key === 'Home' ? 0 : rig.rotation.y + (event.key === 'ArrowLeft' ? -.25 : .25);
    rig.rotation.y = userYaw;
    draw();
  });
  listen(window, 'pointermove', event => { if (event.pointerType !== 'touch') pointer = { x: event.clientX, y: event.clientY }; }, { passive: true });
  listen(document, 'pointerleave', () => { pointer = null; });
  listen(document, 'visibilitychange', () => { if (document.hidden) { drag = null; stop(); } else wake(); });
  listen(renderer.domElement, 'webglcontextlost', event => {
    event.preventDefault();
    alive = false;
    stop();
    button.dataset.renderer = 'fallback';
    renderer.domElement.hidden = true;
    track.dispatchEvent(new CustomEvent('companion:unavailable'));
  });
  listen(window, 'pagehide', event => {
    if (event.persisted) { stop(); return; }
    alive = false;
    stop();
    events.abort();
    resizeObserver.disconnect();
    visibilityObserver.disconnect();
    stateObserver.disconnect();
    const geometries = new Set();
    const materials = new Set();
    scene.traverse(object => {
      if (object.geometry) geometries.add(object.geometry);
      if (object.material) (Array.isArray(object.material) ? object.material : [object.material]).forEach(material => materials.add(material));
    });
    geometries.forEach(geometry => geometry.dispose());
    materials.forEach(material => material.dispose());
    key.shadow.dispose();
    renderer.dispose();
  });
  listen(window, 'pageshow', event => { if (event.persisted) wake(); });
  robot.update(0);
  resize();
  button.dataset.renderer = 'webgl';
  track.dispatchEvent(new CustomEvent('companion:ready'));
  wake();
}

// Adapted from Klemen Kotar’s robot, retrieved 2026-10-12.
// Source: https://github.com/klemenkotar/klemenkotar.github.io/blob/master/js/robot.js
// Local changes: WALL·E-inspired binocular head, mechanical neck, ochre body, and local module paths.

// ─────────────────────────────────────────────────────────────────────────────
// The Robot. A small ochre rover with binocular eyes, a mechanical neck,
// crawling tank treads, gripper arms, and a heartbeat light.
// All primitives, no external assets; animation adapted from the source above.
// ─────────────────────────────────────────────────────────────────────────────
import * as THREE from './vendor/three.module.min.js';
import { RoundedBoxGeometry } from './vendor/RoundedBoxGeometry.js';

const COLORS = {
  shell:   0xd8ad52,     // warm, slightly worn ochre
  shellDark: 0xa97b35,
  cream:    0xd5d1c6,
  charcoal: 0x2b2e36,
  screen:   0x171a21,
  eye:      0x59758c,
  metal:    0x909894,
  tread:    0x3a3e47,
  treadLt:  0x555a65,
  heart:    0xa1d7b5,
};

function mat(color, opts = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.08, ...opts });
}

export class Robot {
  constructor() {
    this.group = new THREE.Group();          // world placement (x/z on page-plane, yaw)
    this.body = new THREE.Group();           // bob / lean / bounce
    this.group.add(this.body);

    this._buildTreads();
    this._buildTorso();
    this._buildHead();

    // ── animation state ──
    this.t = 0;
    this.blinkT = 0; this.nextBlink = 2 + Math.random() * 3; this.blinking = 0;
    this.eyeStyle = 'normal';
    this.saccade = new THREE.Vector2(); this.saccadeTarget = new THREE.Vector2(); this.nextSaccade = 1;
    this.lookTarget = null;                  // {x,y} in [-1,1] head-look space, or null
    this.headLook = new THREE.Vector2();
    this.treadPhase = 0;
    this.speedSm = 0; this.accelSm = 0; this.turnSm = 0;
    this.gripOpen = 0;
    this.idle = null; this.idleT = 0; this.nextIdle = 4 + Math.random() * 4;
    this.mood = 'normal';                    // normal | happy | sleepy
    this.moodT = 0;
    this.hop = 0; this.hopV = 0;             // little vertical bounce spring
    this.onEmote = null;                     // callback(name) for DOM bubbles
  }

  // ══════════════════════════ construction ══════════════════════════

  _buildTreads() {
    // Stadium-profile side plates + crawling tread blocks around the perimeter.
    this.treads = [];
    const L = 0.96, H = 0.32, W = 0.20;      // pod length, height, width
    const R = H / 2;                          // stadium end radius
    const straight = L - 2 * R;

    const stadium = new THREE.Shape();
    stadium.absarc(straight / 2, 0, R, -Math.PI / 2, Math.PI / 2, false);
    stadium.absarc(-straight / 2, 0, R, Math.PI / 2, Math.PI * 1.5, false);

    for (const side of [-1, 1]) {
      const pod = new THREE.Group();
      pod.position.set(side * 0.38, R + 0.02, 0);
      pod.rotation.y = Math.PI / 2;          // extrude along page-x

      const plate = new THREE.Mesh(
        new THREE.ExtrudeGeometry(stadium, { depth: W, bevelEnabled: true, bevelSize: 0.012, bevelThickness: 0.012, curveSegments: 24 }),
        mat(COLORS.tread, { roughness: 0.8 })
      );
      plate.position.z = -W / 2;
      plate.castShadow = true;
      pod.add(plate);

      // outer hub cap
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.02, 24), mat(COLORS.cream, { roughness: 0.4 }));
      hub.rotation.x = Math.PI / 2;
      hub.position.z = side > 0 ? W / 2 + 0.014 : -W / 2 - 0.014;
      const hubDot = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.024, 16), mat(COLORS.charcoal));
      hubDot.rotation.x = Math.PI / 2;
      hubDot.position.copy(hub.position);
      pod.add(hub, hubDot);

      // crawling tread blocks
      const blocks = [];
      const N = 17;
      const geo = new RoundedBoxGeometry(0.055, 0.034, W + 0.05, 2, 0.013);
      const m = mat(COLORS.treadLt, { roughness: 0.9 });
      for (let i = 0; i < N; i++) {
        const b = new THREE.Mesh(geo, m);
        b.castShadow = true;
        pod.add(b);
        blocks.push(b);
      }
      this.group.add(pod);
      this.treads.push({ pod, blocks, R, straight, N });
    }
    this._layoutTreads(0);
  }

  _layoutTreads(phase) {
    for (const tr of this.treads) {
      const { blocks, R, straight, N } = tr;
      const rOut = R + 0.022;
      const perim = 2 * straight + 2 * Math.PI * rOut;
      for (let i = 0; i < blocks.length; i++) {
        let d = ((i / N + phase) % 1 + 1) % 1 * perim;
        let x, y, ang;
        if (d < straight) {                                    // top run (front→back)
          x = straight / 2 - d; y = rOut; ang = 0;
        } else if (d < straight + Math.PI * rOut) {            // rear arc
          const a = (d - straight) / rOut;
          x = -straight / 2 - Math.sin(a) * rOut; y = Math.cos(a) * rOut; ang = a;
        } else if (d < 2 * straight + Math.PI * rOut) {        // bottom run
          x = -straight / 2 + (d - straight - Math.PI * rOut); y = -rOut; ang = Math.PI;
        } else {                                               // front arc
          const a = (d - 2 * straight - Math.PI * rOut) / rOut;
          x = straight / 2 + Math.sin(a) * rOut; y = -Math.cos(a) * rOut; ang = Math.PI + a;
        }
        const b = blocks[i];
        b.position.set(x, y, 0);
        b.rotation.z = -ang;
      }
    }
  }

  _buildTorso() {
    const torso = new THREE.Group();
    torso.position.y = 0.32;
    this.body.add(torso);
    this.torso = torso;

    // Compact, square utility chassis above the two tread pods.
    const chest = new THREE.Mesh(new RoundedBoxGeometry(0.76, 0.64, 0.70, 3, 0.045), mat(COLORS.shell));
    chest.position.y = 0.32;
    chest.castShadow = true;
    torso.add(chest);

    // dark control panel on the nose
    const panel = new THREE.Mesh(new RoundedBoxGeometry(0.58, 0.17, 0.04, 2, 0.018), mat(COLORS.charcoal, { roughness: 0.6 }));
    panel.position.set(0, 0.46, 0.355);
    torso.add(panel);

    // heartbeat light
    this.heart = new THREE.Mesh(
      new THREE.CylinderGeometry(0.035, 0.035, 0.025, 20),
      new THREE.MeshStandardMaterial({ color: COLORS.heart, emissive: COLORS.heart, emissiveIntensity: 0.8, roughness: 0.3 })
    );
    this.heart.rotation.x = Math.PI / 2;
    this.heart.position.set(0.19, 0.46, 0.385);
    torso.add(this.heart);

    // little cream bolts on the panel corners
    const boltGeo = new THREE.CylinderGeometry(0.016, 0.016, 0.02, 10);
    const boltMat = mat(COLORS.cream);
    for (const [bx, by] of [[-0.25, 0.51], [0.25, 0.51], [-0.25, 0.41], [0.25, 0.41]]) {
      const bolt = new THREE.Mesh(boltGeo, boltMat);
      bolt.rotation.x = Math.PI / 2;
      bolt.position.set(bx, by, 0.38);
      torso.add(bolt);
    }

    // Brushed-metal front hatch, top rim, and recessed ventilation slots.
    const hatch = new THREE.Mesh(new RoundedBoxGeometry(0.54, 0.29, 0.025, 2, 0.014), mat(COLORS.shellDark));
    hatch.position.set(0, 0.20, 0.356);
    torso.add(hatch);
    const inset = new THREE.Mesh(new RoundedBoxGeometry(0.45, 0.22, 0.026, 2, 0.012), mat(COLORS.shell));
    inset.position.set(0, 0.20, 0.371);
    torso.add(inset);
    const rim = new THREE.Mesh(new RoundedBoxGeometry(0.78, 0.055, 0.71, 2, 0.014), mat(COLORS.metal, { metalness: 0.45 }));
    rim.position.y = 0.625;
    torso.add(rim);
    const ventMaterial = mat(COLORS.screen);
    for (let i = 0; i < 4; i++) {
      const vent = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.012, 0.012), ventMaterial);
      vent.position.set(-0.10, 0.50 - i * 0.028, 0.385);
      torso.add(vent);
    }
    const bumper = new THREE.Mesh(new RoundedBoxGeometry(0.77, 0.045, 0.73, 2, 0.014), mat(COLORS.shellDark));
    bumper.position.y = 0.015;
    torso.add(bumper);

    // chunky gripper arms, mounted toward the front of the chassis
    this.arms = [];
    for (const side of [-1, 1]) {
      const shoulder = new THREE.Group();
      shoulder.position.set(side * 0.42, 0.42, 0.22);

      const pad = new THREE.Mesh(new RoundedBoxGeometry(0.10, 0.16, 0.18, 2, 0.035), mat(COLORS.metal));
      pad.position.set(side * 0.02, 0, 0);
      const arm = new THREE.Mesh(new RoundedBoxGeometry(0.09, 0.30, 0.13, 2, 0.02), mat(COLORS.metal, { roughness: 0.45, metalness: 0.35 }));
      arm.position.set(side * 0.03, -0.17, 0);
      arm.castShadow = true;
      const wrist = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.062, 0.13, 14), mat(COLORS.cream, { roughness: 0.45 }));
      wrist.position.set(side * 0.03, -0.335, 0);
      shoulder.add(pad, arm, wrist);

      // two-finger gripper, fingers open/close by pivoting apart
      const fingers = [];
      for (const f of [-1, 1]) {
        const finger = new THREE.Group();
        finger.position.set(side * 0.03, -0.38, f * 0.045);
        const seg = new THREE.Mesh(new RoundedBoxGeometry(0.05, 0.14, 0.038, 2, 0.016), mat(COLORS.charcoal, { roughness: 0.5 }));
        seg.position.y = -0.055;
        const tip = new THREE.Mesh(new RoundedBoxGeometry(0.05, 0.05, 0.045, 2, 0.018), mat(COLORS.treadLt));
        tip.position.y = -0.125;
        finger.add(seg, tip);
        shoulder.add(finger);
        fingers.push({ group: finger, dir: f });
      }

      shoulder.rotation.z = side * 0.22;    // rest: slightly out, grippers clear of the treads
      torso.add(shoulder);
      this.arms.push({ shoulder, fingers, side });
    }
  }

  _buildHead() {
    // A slender telescoping neck lifts the paired lenses clear of the body.
    const neckBase = new THREE.Mesh(new RoundedBoxGeometry(0.23, 0.09, 0.22, 2, 0.018), mat(COLORS.shellDark));
    neckBase.position.set(0, 0.98, 0.03);
    this.body.add(neckBase);
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.052, 0.26, 16), mat(COLORS.metal, { metalness: 0.55, roughness: 0.35 }));
    neck.position.set(0, 1.105, 0.07);
    neck.rotation.x = 0.18;
    this.body.add(neck);
    const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.021, 0.021, 0.24, 12), mat(COLORS.charcoal));
    cable.position.set(0.062, 1.10, 0.025);
    cable.rotation.x = 0.18;
    this.body.add(cable);

    this.headPivot = new THREE.Group();
    this.headPivot.position.set(0, 1.23, 0.10);
    this.body.add(this.headPivot);
    const hinge = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.17, 20), mat(COLORS.charcoal));
    hinge.rotation.z = Math.PI / 2;
    this.headPivot.add(hinge);

    const head = new THREE.Group();
    head.position.y = 0.08;
    this.headPivot.add(head);
    this.head = head;
    const bridge = new THREE.Mesh(new RoundedBoxGeometry(0.21, 0.10, 0.19, 2, 0.02), mat(COLORS.metal, { metalness: 0.4 }));
    bridge.position.z = 0.025;
    head.add(bridge);

    // Animated lens glass lives in a separate group for subtle eye movements.
    this.eyes = new THREE.Group();
    this.eyes.position.z = 0.212;
    head.add(this.eyes);
    this.eyeMeshes = [];
    this.happyMeshes = [];
    this.ears = [];
    const glassMaterial = new THREE.MeshStandardMaterial({
      color: COLORS.eye, emissive: 0x263b4a, emissiveIntensity: 0.16,
      metalness: 0.55, roughness: 0.16,
    });
    const gleamMaterial = new THREE.MeshBasicMaterial({ color: 0xe0eef0, transparent: true, opacity: 0.85, toneMapped: false });

    for (const side of [-1, 1]) {
      const pod = new THREE.Group();
      pod.position.set(side * 0.235, 0, 0);
      pod.rotation.z = side * 0.12;
      head.add(pod);

      // Two independent, slightly drooping camera housings give a curious face.
      const housing = new THREE.Mesh(new RoundedBoxGeometry(0.44, 0.34, 0.31, 3, 0.065), mat(COLORS.metal, { metalness: 0.35, roughness: 0.48 }));
      housing.castShadow = true;
      pod.add(housing);
      const brow = new THREE.Mesh(new RoundedBoxGeometry(0.39, 0.035, 0.33, 2, 0.015), mat(COLORS.cream, { metalness: 0.3 }));
      brow.position.y = 0.135;
      pod.add(brow);

      const bezel = new THREE.Mesh(new THREE.CylinderGeometry(0.147, 0.153, 0.06, 32), mat(COLORS.charcoal, { metalness: 0.35, roughness: 0.35 }));
      bezel.rotation.x = Math.PI / 2;
      bezel.position.z = 0.164;
      pod.add(bezel);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.132, 0.012, 10, 32), mat(COLORS.cream, { metalness: 0.55, roughness: 0.3 }));
      rim.position.z = 0.199;
      pod.add(rim);
      const darkLens = new THREE.Mesh(new THREE.CircleGeometry(0.12, 32), mat(COLORS.screen, { metalness: 0.3, roughness: 0.24 }));
      darkLens.position.z = 0.204;
      pod.add(darkLens);

      const lens = new THREE.Group();
      lens.position.x = side * 0.235;
      this.eyes.add(lens);
      this.eyeMeshes.push(lens);
      const glass = new THREE.Mesh(new THREE.CircleGeometry(0.104, 32), glassMaterial);
      lens.add(glass);
      const pupil = new THREE.Mesh(new THREE.CircleGeometry(0.064, 24), mat(0x111b23, { metalness: 0.35, roughness: 0.2 }));
      pupil.position.z = 0.001;
      lens.add(pupil);
      const iris = new THREE.Mesh(new THREE.TorusGeometry(0.076, 0.007, 8, 24), mat(0x8dabb4, { metalness: 0.45, roughness: 0.3 }));
      iris.position.z = 0.002;
      lens.add(iris);
      const glint = new THREE.Mesh(new THREE.CircleGeometry(0.025, 16), gleamMaterial);
      glint.position.set(-0.033, 0.040, 0.003);
      lens.add(glint);
      const smallGlint = new THREE.Mesh(new THREE.CircleGeometry(0.011, 12), gleamMaterial);
      smallGlint.position.set(0.038, -0.029, 0.003);
      lens.add(smallGlint);

      const smile = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.014, 10, 24, Math.PI), gleamMaterial);
      smile.position.set(side * 0.235, -0.032, 0.004);
      smile.visible = false;
      this.eyes.add(smile);
      this.happyMeshes.push(smile);
    }
  }

  // ══════════════════════════ API ══════════════════════════

  setMood(mood) {
    if (this.mood === mood) return;
    this.mood = mood; this.moodT = 0;
    const happy = mood === 'happy';
    this.eyeMeshes.forEach(e => e.visible = !happy);
    this.happyMeshes.forEach(e => e.visible = happy);
  }

  /** look toward a point given in head-space [-1..1, -1..1] (x right, y up), or null to release */
  lookToward(v) { this.lookTarget = v; }

  bounce(strength = 1) { this.hopV = Math.max(this.hopV, 1.6 * strength); }

  wave() { this.idle = 'wave'; this.idleT = 0; if (this.onEmote) this.onEmote('wave'); }

  /** main per-frame update. motion: {speed(px/s), maxSpeed, accel(-1..1), turn(rad/s)} in page units */
  update(dt, motion = { speed: 0, maxSpeed: 1, accel: 0, turn: 0 }) {
    dt = Math.min(dt, 0.05);
    this.t += dt;
    const t = this.t;
    const speed01 = THREE.MathUtils.clamp(motion.speed / (motion.maxSpeed || 1), 0, 1);
    this.speedSm += (speed01 - this.speedSm) * Math.min(1, dt * 8);
    this.accelSm += (motion.accel - this.accelSm) * Math.min(1, dt * 6);
    this.turnSm += (motion.turn - this.turnSm) * Math.min(1, dt * 6);
    const moving = speed01 > 0.02 || Math.abs(motion.turn) > 0.1;

    // ── treads crawl only while actually moving ──
    const treadRate = this.speedSm * 1.7 + Math.abs(this.turnSm) * 0.05;
    if (treadRate > 0.005) this.treadPhase = (this.treadPhase + dt * treadRate) % 1;
    this._layoutTreads(this.treadPhase);

    // ── body bob + lean ──
    const bobAmp = moving ? 0.012 : 0.006;
    const bobFreq = moving ? 9 : 2.2;
    this.hopV -= this.hop * 90 * dt; this.hopV *= Math.exp(-7 * dt); this.hop += this.hopV * dt;
    this.body.position.y = Math.abs(Math.sin(t * bobFreq)) * bobAmp + this.hop * 0.06;
    this.body.rotation.x = -this.accelSm * 0.13 + Math.sin(t * bobFreq) * (moving ? 0.008 : 0.003);
    this.body.rotation.z = this.turnSm * 0.06 + (moving ? Math.sin(t * bobFreq * 0.5) * 0.01 : 0);

    // ── head: look target + idle wander ──
    let lx = 0, ly = 0;
    if (this.lookTarget) { lx = this.lookTarget.x; ly = this.lookTarget.y; }
    this.headLook.x += (lx - this.headLook.x) * Math.min(1, dt * 5);
    this.headLook.y += (ly - this.headLook.y) * Math.min(1, dt * 5);
    this.headPivot.rotation.y = this.headLook.x * 0.55;
    this.headPivot.rotation.x = -0.05 - this.headLook.y * 0.30;   // slight upward tilt: curious & eager

    // ── eyes: saccades + blink ──
    this.nextSaccade -= dt;
    if (this.nextSaccade <= 0) {
      this.saccadeTarget.set((Math.random() - 0.5) * 0.05, (Math.random() - 0.5) * 0.03);
      this.nextSaccade = 0.8 + Math.random() * 2.4;
    }
    this.saccade.lerp(this.saccadeTarget, Math.min(1, dt * 10));
    // Small lens movement stays inside the fixed binocular bezels.
    this.eyes.position.x = this.saccade.x * 0.15 + this.headLook.x * 0.008;
    this.eyes.position.y = this.saccade.y * 0.15 + this.headLook.y * 0.006;

    this.nextBlink -= dt;
    if (this.nextBlink <= 0) { this.blinking = 0.22; this.nextBlink = 2.2 + Math.random() * 3.5; }
    if (this.blinking > 0) this.blinking -= dt;
    const blinkK = this.blinking > 0 ? Math.max(0.06, Math.abs(Math.sin((this.blinking / 0.22) * Math.PI))) : 1;
    const sleepyK = this.mood === 'sleepy' ? 0.45 : 1;
    for (const e of this.eyeMeshes) e.scale.y = blinkK * sleepyK;

    // ── heartbeat ──
    const beat = Math.pow(Math.max(0, Math.sin(t * 2.6)), 6);
    this.heart.material.emissiveIntensity = 0.5 + beat * 1.3;
    this.heart.scale.setScalar(1 + beat * 0.12);

    // ── floppy ears: springs that trail acceleration and turning ──
    for (const ear of this.ears) {
      const tx = -this.accelSm * 1.0 - this.speedSm * 0.35;             // trail backward while driving
      const tz = ear.droop - this.turnSm * 0.4 * ear.side;              // flop outward, swing on turns
      const k = 38, c = 4.2;                                            // soft & floppy
      ear.vel.x += ((tx - ear.rot.x) * k - ear.vel.x * c) * dt;
      ear.vel.y += ((tz - ear.rot.y) * k - ear.vel.y * c) * dt;
      ear.rot.x += ear.vel.x * dt;
      ear.rot.y += ear.vel.y * dt;
      ear.floppy.rotation.x = THREE.MathUtils.clamp(ear.rot.x, -1.2, 1.2) + Math.sin(t * 2.3 + ear.phase) * 0.04;
      ear.floppy.rotation.z = THREE.MathUtils.clamp(ear.rot.y, -1.4, 1.4) + Math.cos(t * 2.9 + ear.phase) * 0.05;
    }

    // ── arms: swing while driving, wave on demand; grippers open with joy ──
    let gripTarget = 0.1;
    for (const { shoulder, fingers, side } of this.arms) {
      let z = side * (0.22 + this.speedSm * 0.10);
      let x = moving ? Math.sin(t * 9 + (side > 0 ? Math.PI : 0)) * 0.16 * this.speedSm : Math.sin(t * 2.2 + side) * 0.02;
      if (this.idle === 'wave' && side > 0) {
        const k2 = Math.min(1, this.idleT * 3) * Math.max(0, 1 - Math.max(0, this.idleT - 1.6) * 2.5);
        z = side * 0.22 + k2 * (2.4 + Math.sin(this.idleT * 14) * 0.35);
        x = 0;
        gripTarget = 0.45 + Math.sin(this.idleT * 14) * 0.15;
      }
      shoulder.rotation.z += (z - shoulder.rotation.z) * Math.min(1, dt * 10);
      shoulder.rotation.x += (x - shoulder.rotation.x) * Math.min(1, dt * 10);
      if (this.mood === 'happy') gripTarget = Math.max(gripTarget, 0.4);
      this.gripOpen += (gripTarget - this.gripOpen) * Math.min(1, dt * 8);
      for (const f of fingers) f.group.rotation.x = f.dir * this.gripOpen;
    }

    // ── idle micro-behaviours (only when not driving) ──
    if (this.idle) {
      this.idleT += dt;
      this._updateIdle(dt);
    } else if (!moving) {
      this.nextIdle -= dt;
      if (this.nextIdle <= 0) this._startIdle();
    }
    if (moving && this.idle && this.idle !== 'wave') { this.idle = null; this.setMood('normal'); }

    // happy mood auto-expires
    if (this.mood === 'happy') { this.moodT += dt; if (this.moodT > 2.2) this.setMood('normal'); }
  }

  _startIdle() {
    const opts = ['lookAround', 'headTilt', 'happy', 'wiggle', 'wave', 'spin'];
    this.idle = opts[Math.floor(Math.random() * opts.length)];
    this.idleT = 0;
    this.nextIdle = 5 + Math.random() * 6;
    if (this.onEmote) this.onEmote(this.idle);
  }

  _updateIdle(dt) {
    const T = this.idleT;
    switch (this.idle) {
      case 'lookAround': {
        const seq = T < 1 ? -0.8 : T < 2 ? 0.8 : 0;
        this.lookTarget = { x: seq, y: 0.1 };
        if (T > 2.8) { this.idle = null; this.lookTarget = null; }
        break;
      }
      case 'headTilt':
        this.head.rotation.z = Math.sin(Math.min(T * 2, Math.PI)) * 0.22;
        if (T > 1.6) { this.idle = null; this.head.rotation.z = 0; }
        break;
      case 'happy':
        this.setMood('happy');
        if (T < 0.05) this.bounce(0.8);
        if (T > 1.6) this.idle = null;
        break;
      case 'wiggle':
        this.body.rotation.z += Math.sin(T * 18) * 0.05 * Math.max(0, 1 - T / 1.2);
        if (T > 1.2) this.idle = null;
        break;
      case 'wave':
        if (T > 2.2) this.idle = null;
        break;
      case 'spin':
        // driver consumes this to rotate the whole robot; visually: quick sparkle
        if (T < 0.05) { this.setMood('happy'); this.bounce(0.5); }
        if (T > 1.2) this.idle = null;
        break;
    }
  }
}

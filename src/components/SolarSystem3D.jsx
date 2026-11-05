import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CSS2DObject, CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Layers,
  Minus,
  Pause,
  Play,
  Plus,
  Radio,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  X,
} from 'lucide-react';
import { fmtNum, THREAT_CONFIG, upcomingApproaches } from '../utils/asteroidUtils.js';
import { useAsteroids } from '../context/AsteroidContext.jsx';

// ---------- scene description ----------
const AU_SCALE = 6;
const scaleR = (au) => AU_SCALE * Math.pow(au, 0.55);

const PLANETS = [
  { name: 'Mercury', a: 0.387, e: 0.206, inc: 7.0, w: 29, color: '#c9b79c', orbit: '#6b7280', size: 0.22, period: 0.241, phase: 1.1 },
  { name: 'Venus', a: 0.723, e: 0.007, inc: 3.4, w: 55, color: '#e8c58a', orbit: '#9a8a5a', size: 0.36, period: 0.615, phase: 2.4 },
  { name: 'Earth', a: 1.0, e: 0.017, inc: 0.0, w: 102, color: '#38bdf8', orbit: '#38bdf8', size: 0.38, period: 1.0, phase: 0.3 },
  { name: 'Mars', a: 1.524, e: 0.093, inc: 1.85, w: 286, color: '#ef6b4a', orbit: '#c2553a', size: 0.3, period: 1.881, phase: 4.2 },
  { name: 'Jupiter', a: 5.203, e: 0.049, inc: 1.3, w: 274, color: '#e3b27a', orbit: '#d6b36a', size: 0.9, period: 11.86, phase: 5.0 },
  { name: 'Saturn', a: 9.537, e: 0.057, inc: 2.5, w: 339, color: '#d8c38f', orbit: '#7dd3c0', size: 0.8, period: 29.45, phase: 0.9 },
  { name: 'Uranus', a: 19.19, e: 0.046, inc: 0.77, w: 96, color: '#7dd3fc', orbit: '#6c8be8', size: 0.6, period: 84.0, phase: 3.3 },
  { name: 'Neptune', a: 30.07, e: 0.01, inc: 1.77, w: 273, color: '#6366f1', orbit: '#5b6bd6', size: 0.58, period: 164.8, phase: 2.0 },
];

const COMETS = [
  { name: 'Wild 2', a: 3.45, e: 0.54, inc: 3.2, w: 41, period: 5.5, phase: 0.4 },
  { name: 'Tempel 1', a: 3.12, e: 0.51, inc: 10.5, w: 179, period: 5.6, phase: 2.2 },
  { name: 'Hartley 2', a: 3.47, e: 0.69, inc: 13.6, w: 181, period: 6.5, phase: 4.8 },
];

const BELT_BODIES = [
  { name: 'Ceres', a: 2.77, e: 0.08, phase: 0.7 },
  { name: 'Vesta', a: 2.36, e: 0.09, phase: 2.9 },
  { name: 'Pallas', a: 2.77, e: 0.23, phase: 4.1 },
  { name: 'Braille', a: 2.34, e: 0.43, phase: 5.5 },
  { name: 'Donaldjohanson', a: 2.38, e: 0.19, phase: 1.5 },
  { name: 'Lucy', a: 5.2, e: 0.1, phase: 3.6 },
];

const rad = (d) => (d * Math.PI) / 180;
const EPOCH_MS = Date.UTC(2000, 0, 1, 12);
const YEAR_MS = 365.25 * 86400000;

function solveKepler(M, e) {
  let E = M;
  for (let i = 0; i < 5; i++) E = E - (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
  return E;
}

// position in orbital plane (sun at focus), in scaled scene units
function orbitPoint(a, e, nu, w) {
  const r = (a * (1 - e * e)) / (1 + e * Math.cos(nu));
  const s = scaleR(r);
  const ang = nu + w;
  return new THREE.Vector3(s * Math.cos(ang), 0, s * Math.sin(ang));
}

function bodyPosition(a, e, w, M) {
  const E = solveKepler(((M % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI), e);
  const nu = 2 * Math.atan2(Math.sqrt(1 + e) * Math.sin(E / 2), Math.sqrt(1 - e) * Math.cos(E / 2));
  return orbitPoint(a, e, nu, w);
}

function orbitLine(a, e, w, color, opacity = 0.75) {
  const pts = [];
  for (let i = 0; i <= 256; i++) pts.push(orbitPoint(a, e, (i / 256) * Math.PI * 2, w));
  const geo = new THREE.BufferGeometry().setFromPoints(pts);
  return new THREE.LineLoop(geo, new THREE.LineBasicMaterial({ color, transparent: true, opacity }));
}

function makeLabel(text, cls) {
  const div = document.createElement('div');
  div.className = `label-3d ${cls || ''}`;
  div.textContent = text;
  return new CSS2DObject(div);
}

function glowTexture(inner, outer) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, inner);
  grad.addColorStop(0.35, outer);
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

const SPEEDS = [
  { label: 'Live', factor: 1 },
  { label: '1 d/s', factor: 86400 },
  { label: '10 d/s', factor: 864000 },
  { label: '100 d/s', factor: 8640000 },
  { label: '1 y/s', factor: 31557600 },
];


export default function SolarSystem3D() {
  const mountRef = useRef(null);
  const apiRef = useRef({});
  const simRef = useRef({ ms: Date.now(), factor: 1, paused: false });

  // Get real-time asteroid data and threat controls from Context
  const {
    asteroids,
    loading: asteroidsLoading,
    isRealtime,
    refresh,
    lastUpdated,
    selectedId,
    setSelectedId,
    threatFilter,
    setThreatFilter,
    stats,
  } = useAsteroids();

  const [speedIdx, setSpeedIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const [clock, setClock] = useState(new Date());
  const [now, setNow] = useState(Date.now());
  const [watchOpen, setWatchOpen] = useState(true);
  const [showLegend, setShowLegend] = useState(true);

  // Filtered asteroids based on user threat level filter
  const filteredAsteroids = useMemo(() => {
    if (threatFilter === 'all') return asteroids;
    return asteroids.filter((a) => a.threatLevel === threatFilter);
  }, [asteroids, threatFilter]);

  // Next closest approaches from current filtered pool
  const watchList = useMemo(() => {
    return upcomingApproaches(filteredAsteroids, Math.min(filteredAsteroids.length, 12));
  }, [filteredAsteroids]);

  // Find index of selected asteroid in watchList
  const currentIdx = useMemo(() => {
    if (!watchList.length) return 0;
    const foundIdx = watchList.findIndex((a) => a.id === selectedId);
    return foundIdx >= 0 ? foundIdx : 0;
  }, [watchList, selectedId]);

  const selected = watchList[currentIdx] || filteredAsteroids[0] || asteroids[0] || null;

  // ---------- build the scene once ----------
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    const w0 = mount.clientWidth || 800;
    const h0 = mount.clientHeight || 600;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(48, w0 / h0, 0.1, 600);
    camera.position.set(4, 15, 27);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(w0, h0);
    renderer.setClearColor(0x000000, 0);
    mount.appendChild(renderer.domElement);

    const labelRenderer = new CSS2DRenderer();
    labelRenderer.setSize(w0, h0);
    Object.assign(labelRenderer.domElement.style, { position: 'absolute', top: '0', left: '0', pointerEvents: 'none' });
    mount.appendChild(labelRenderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.minDistance = 6;
    controls.maxDistance = 220;

    // Raycaster for interactive 3D asteroid clicking
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let pointerDown = null;

    const onPointerDown = (event) => {
      pointerDown = { x: event.clientX, y: event.clientY };
    };

    const onPointerUp = (event) => {
      if (!pointerDown) return;
      const moved = Math.hypot(event.clientX - pointerDown.x, event.clientY - pointerDown.y);
      pointerDown = null;
      if (moved > 6) return;

      const hitTargets = apiRef.current.state?.hitTargets || [];
      if (!hitTargets.length) return;

      const bounds = renderer.domElement.getBoundingClientRect();
      pointer.set(
        ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
        -((event.clientY - bounds.top) / bounds.height) * 2 + 1
      );
      raycaster.setFromCamera(pointer, camera);
      const intersects = raycaster.intersectObjects(hitTargets, false);

      if (intersects.length > 0) {
        const hitObj = intersects[0].object;
        const targetId = hitObj.userData?.asteroidId;
        if (targetId) {
          setSelectedId(targetId);
          setWatchOpen(true);
        }
      }
    };

    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointerup', onPointerUp);

    // distant stars
    const starPos = new Float32Array(1800 * 3);
    for (let i = 0; i < 1800; i++) {
      const r = 250 + Math.random() * 150;
      const t = Math.random() * Math.PI * 2;
      const p = Math.acos(2 * Math.random() - 1);
      starPos.set([r * Math.sin(p) * Math.cos(t), r * Math.cos(p), r * Math.sin(p) * Math.sin(t)], i * 3);
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    scene.add(
      new THREE.Points(
        starGeo,
        new THREE.PointsMaterial({ color: 0x8892a6, size: 0.7, sizeAttenuation: false, transparent: true, opacity: 0.55 })
      )
    );

    // tilted system group
    const system = new THREE.Group();
    system.rotation.x = -0.28;
    system.rotation.z = 0.2;
    scene.add(system);

    // sun
    const sun = new THREE.Mesh(new THREE.SphereGeometry(0.85, 32, 32), new THREE.MeshBasicMaterial({ color: 0xffd27a }));
    system.add(sun);
    const sunGlow = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glowTexture('rgba(255,214,140,0.95)', 'rgba(255,120,40,0.35)'),
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    sunGlow.scale.set(7, 7, 1);
    system.add(sunGlow);

    const movers = [];

    // planets
    PLANETS.forEach((p) => {
      const g = new THREE.Group();
      g.rotation.x = rad(p.inc);
      g.add(orbitLine(p.a, p.e, rad(p.w), p.orbit, p.name === 'Earth' ? 0.9 : 0.7));
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(p.size, 20, 20), new THREE.MeshBasicMaterial({ color: p.color }));
      const label = makeLabel(p.name, 'planet');
      label.position.set(0, p.size + 0.5, 0);
      mesh.add(label);
      g.add(mesh);
      system.add(g);
      movers.push({ obj: mesh, a: p.a, e: p.e, w: rad(p.w), period: p.period, phase: p.phase });
    });

    // asteroid belt - dense particle cloud
    const N = 16000;
    const bp = new Float32Array(N * 3);
    const bc = new Float32Array(N * 3);
    const col = new THREE.Color();
    for (let i = 0; i < N; i++) {
      const a = 2.0 + Math.abs((Math.random() + Math.random() + Math.random()) / 3 - 0.5) * 2 * 1.4 + Math.random() * 0.5;
      const e = Math.random() * 0.28;
      const nu = Math.random() * Math.PI * 2;
      const w = Math.random() * Math.PI * 2;
      const pos = orbitPoint(a, e, nu, w);
      const incl = (Math.random() - 0.5) * 0.5;
      pos.y = Math.sin(incl) * pos.length() * 0.45 * Math.sin(nu + w + 1);
      bp.set([pos.x, pos.y, pos.z], i * 3);
      const k = Math.random();
      col.setHSL(0.55 + k * 0.05, 0.85, 0.35 + k * 0.4);
      bc.set([col.r, col.g, col.b], i * 3);
    }
    const beltGeo = new THREE.BufferGeometry();
    beltGeo.setAttribute('position', new THREE.BufferAttribute(bp, 3));
    beltGeo.setAttribute('color', new THREE.BufferAttribute(bc, 3));
    const belt = new THREE.Points(
      beltGeo,
      new THREE.PointsMaterial({
        size: 0.075,
        vertexColors: true,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    system.add(belt);

    // named belt bodies
    BELT_BODIES.forEach((b) => {
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), new THREE.MeshBasicMaterial({ color: 0xdbeafe }));
      const label = makeLabel(b.name);
      label.position.set(0.3, 0.3, 0);
      m.add(label);
      system.add(m);
      movers.push({ obj: m, a: b.a, e: b.e, w: 0, period: Math.pow(b.a, 1.5), phase: b.phase });
    });

    // comets
    COMETS.forEach((c) => {
      const g = new THREE.Group();
      g.rotation.x = rad(c.inc);
      g.add(orbitLine(c.a, c.e, rad(c.w), '#cbd5e1', 0.35));
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }));
      const label = makeLabel(c.name, 'comet');
      label.position.set(0.4, 0.4, 0);
      head.add(label);
      const tailGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 0, 0)]);
      const tail = new THREE.Line(tailGeo, new THREE.LineBasicMaterial({ color: 0xbfe3ff, transparent: true, opacity: 0.6 }));
      g.add(head, tail);
      system.add(g);
      movers.push({ obj: head, tail, a: c.a, e: c.e, w: rad(c.w), period: c.period, phase: c.phase, comet: true });
    });

    // Real-time asteroids fleet group (holds red, yellow, and green real-time asteroids)
    const realtimeFleetGroup = new THREE.Group();
    system.add(realtimeFleetGroup);

    const state = {
      movers,
      belt,
      sun,
      realtimeFleetGroup,
      asteroidMovers: [],
      hitTargets: [],
      selectedObj: null,
    };
    apiRef.current = { scene, camera, controls, state };

    const clockTick = setInterval(() => setClock(new Date(simRef.current.ms)), 250);

    let last = performance.now();
    let raf;
    const loop = (t) => {
      raf = requestAnimationFrame(loop);
      const dt = (t - last) / 1000;
      last = t;
      const sim = simRef.current;
      if (!sim.paused) sim.ms += dt * 1000 * sim.factor;
      const years = (sim.ms - EPOCH_MS) / YEAR_MS;

      // Planets & belt bodies
      movers.forEach((m) => {
        const M = m.phase + (2 * Math.PI * years) / m.period;
        const pos = bodyPosition(m.a, m.e, m.w, M);
        m.obj.position.copy(pos);
        if (m.tail) {
          const dir = pos.clone().normalize().multiplyScalar(1.4 / Math.max(0.6, pos.length() / 8));
          m.tail.geometry.setFromPoints([pos, pos.clone().add(dir)]);
        }
      });

      // Real-time Asteroid Fleet in orbital motion
      const fleet = state.asteroidMovers || [];
      fleet.forEach((ast) => {
        const M = ast.phase + (2 * Math.PI * years) / ast.period;
        const pos = bodyPosition(ast.a, ast.e, ast.w, M);
        ast.mesh.position.copy(pos);

        // Pulsing halo for dangerous asteroids & selected asteroid
        if (ast.isSelected) {
          const pulse = 1.0 + Math.sin(t / 200) * 0.35;
          ast.halo.scale.setScalar(1.3 * pulse);
          if (ast.ring) ast.ring.scale.setScalar(1.2 + Math.sin(t / 300) * 0.2);
        } else if (ast.threatLevel === 'dangerous') {
          // Dangerous (Red) asteroids pulse noticeably to signify threat!
          const warnPulse = 0.95 + Math.sin(t / 350) * 0.25;
          ast.halo.scale.setScalar(1.0 * warnPulse);
        }
      });

      belt.rotation.y += dt * 0.004 * Math.min(sim.factor, 50) * (sim.paused ? 0 : 1);
      controls.update();
      renderer.render(scene, camera);
      labelRenderer.render(scene, camera);
    };
    raf = requestAnimationFrame(loop);

    const ro = new ResizeObserver(() => {
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      if (!w || !h) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      labelRenderer.setSize(w, h);
    });
    ro.observe(mount);

    return () => {
      cancelAnimationFrame(raf);
      clearInterval(clockTick);
      ro.disconnect();
      controls.dispose();
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      scene.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) {
          if (o.material.map) o.material.map.dispose();
          o.material.dispose();
        }
      });
      renderer.dispose();
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
      if (mount.contains(labelRenderer.domElement)) mount.removeChild(labelRenderer.domElement);
      apiRef.current = {};
    };
  }, []);

  // ---------- Populate Real-Time Asteroids with Color Coding (Red / Yellow / Green) ----------
  useEffect(() => {
    const api = apiRef.current;
    if (!api.state) return;
    const { state } = api;
    const fleetGroup = state.realtimeFleetGroup;

    // Clear previous fleet objects safely
    while (fleetGroup.children.length) {
      const child = fleetGroup.children.pop();
      child.traverse((c) => {
        if (c.geometry) c.geometry.dispose();
        if (c.material) {
          if (c.material.map) c.material.map.dispose();
          c.material.dispose();
        }
      });
    }

    state.asteroidMovers = [];
    state.hitTargets = [];

    // Choose the asteroids to visualize:
    // If filtered, show all of that filter; if 'all', show up to 35 real-time objects
    const listToRender = (threatFilter === 'all' ? asteroids.slice(0, 36) : filteredAsteroids.slice(0, 36));

    listToRender.forEach((ast) => {
      const isSelected = selected && ast.id === selected.id;
      const threat = THREAT_CONFIG[ast.threatLevel] || THREAT_CONFIG.safe;
      const h = hashStr(String(ast.id || ast.name));

      // Realistic semi-major axis around 1.0 AU (Earth)
      const a = 0.94 + ((h % 48) / 100);
      const e = 0.08 + (((h >> 3) % 26) / 100);
      const w = ((h >> 5) % 628) / 100;
      const inc = rad(((h >> 7) % 140) / 10);
      const period = Math.pow(a, 1.5);
      const phase = ((h >> 9) % 628) / 100;

      // Asteroid group tilted to its orbital inclination
      const g = new THREE.Group();
      g.rotation.x = inc;

      // 1. Threat color coded Orbit Line
      // Red for dangerous, Yellow for medium, Green for safe
      const orbitOpacity = isSelected ? 0.95 : ast.threatLevel === 'dangerous' ? 0.65 : 0.35;
      const orbit = orbitLine(a, e, w, threat.hex, orbitOpacity);
      g.add(orbit);

      // 2. 3D Asteroid Mesh: Red, Yellow, or Green
      const sizeScale = Math.max(0.12, Math.min(0.24, 0.12 + (ast.diameter / 500) * 0.08));
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(sizeScale, 12, 12),
        new THREE.MeshBasicMaterial({ color: threat.threeHex })
      );

      // 3. Glowing Halo Sprite matching the threat color
      const halo = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: glowTexture(threat.glow, threat.dimGlow),
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        })
      );
      halo.scale.setScalar(isSelected ? 1.4 : 0.9);
      mesh.add(halo);

      // 4. If selected, add an outer targeting reticle
      let ring = null;
      if (isSelected) {
        const ringGeo = new THREE.RingGeometry(sizeScale * 2.2, sizeScale * 2.6, 24);
        const ringMat = new THREE.MeshBasicMaterial({ color: threat.threeHex, side: THREE.DoubleSide, transparent: true, opacity: 0.85 });
        ring = new THREE.Mesh(ringGeo, ringMat);
        ring.rotation.x = Math.PI / 2;
        mesh.add(ring);
      }

      // 5. Invisible Hit Sphere for clicking/tapping in 3D
      const hitArea = new THREE.Mesh(
        new THREE.SphereGeometry(0.65, 10, 8),
        new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false })
      );
      hitArea.userData = { asteroidId: ast.id, name: ast.name };
      mesh.add(hitArea);
      state.hitTargets.push(hitArea);

      // 6. CSS2D Label (shown for selected, dangerous, or top close approaches)
      if (isSelected || ast.threatLevel === 'dangerous' || isSelected) {
        const label = makeLabel(
          ast.name,
          `${ast.threatLevel} ${isSelected ? 'active-selected' : ''}`
        );
        label.position.set(0.35, sizeScale + 0.35, 0);
        mesh.add(label);
      }

      g.add(mesh);
      fleetGroup.add(g);

      state.asteroidMovers.push({
        group: g,
        mesh,
        halo,
        ring,
        orbit,
        a,
        e,
        w,
        period,
        phase,
        threatLevel: ast.threatLevel,
        isSelected,
        asteroid: ast,
      });
    });
  }, [asteroids, filteredAsteroids, selected, threatFilter]);

  // ---------- panel clocks ----------
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const setSpeed = (i) => {
    setSpeedIdx(i);
    simRef.current.factor = SPEEDS[i].factor;
  };

  const togglePause = () => {
    simRef.current.paused = !simRef.current.paused;
    setPaused(simRef.current.paused);
  };

  const goLive = () => {
    simRef.current.ms = Date.now();
    simRef.current.factor = 1;
    simRef.current.paused = false;
    setSpeedIdx(0);
    setPaused(false);
  };

  const zoom = (f) => {
    const { camera, controls } = apiRef.current;
    if (!camera) return;
    const dir = camera.position.clone().sub(controls.target).multiplyScalar(f);
    camera.position.copy(controls.target.clone().add(dir));
  };

  const resetView = () => {
    const { camera, controls } = apiRef.current;
    if (!camera) return;
    camera.position.set(4, 15, 27);
    controls.target.set(0, 0, 0);
  };

  const isLive = speedIdx === 0 && !paused;
  const selectedThreat = selected ? (THREAT_CONFIG[selected.threatLevel] || THREAT_CONFIG.safe) : THREAT_CONFIG.safe;

  return (
    <div className="panel relative h-[82vh] min-h-[600px] overflow-hidden !rounded-2xl bg-black border border-white/10 shadow-2xl">
      <div ref={mountRef} className="absolute inset-0 cursor-grab active:cursor-grabbing" />

      {/* Top Banner: Real-time NASA Status & Refresh */}
      <div className="absolute left-4 top-4 z-10 flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-[#0b0d12]/90 px-3 py-2 backdrop-blur">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${isRealtime ? 'bg-emerald-400' : 'bg-amber-400'}`} />
            <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${isRealtime ? 'bg-emerald-500' : 'bg-amber-500'}`} />
          </span>
          <span className="text-xs font-semibold tracking-wide text-white">
            {isRealtime ? 'NASA NeoWs Real-Time Stream' : 'Cached Asteroid Stream'}
          </span>
        </div>
        <span className="hidden text-xs text-slate-500 sm:inline">|</span>
        <span className="text-[11px] text-slate-400">
          {filteredAsteroids.length} objects visible
        </span>
        <button
          onClick={() => refresh()}
          disabled={asteroidsLoading}
          className="ml-1 rounded-md p-1 text-slate-400 transition hover:bg-white/10 hover:text-white disabled:opacity-50"
          title="Refresh real-time data from NASA"
          aria-label="Refresh real-time data"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${asteroidsLoading ? 'animate-spin text-emerald-400' : ''}`} />
        </button>
      </div>

      {/* Threat Filter Pills in 3D Scene */}
      <div className="absolute right-14 top-4 z-10 hidden sm:flex items-center gap-1.5 rounded-xl border border-white/10 bg-[#0b0d12]/90 p-1 backdrop-blur">
        <button
          onClick={() => setThreatFilter('all')}
          className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${threatFilter === 'all' ? 'bg-white/20 text-white font-semibold' : 'text-slate-400 hover:text-white'}`}
        >
          All ({asteroids.length})
        </button>
        <button
          onClick={() => setThreatFilter('dangerous')}
          className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium transition ${threatFilter === 'dangerous' ? 'bg-red-500/30 text-red-300 font-semibold border border-red-500/40' : 'text-red-400 hover:bg-red-500/10'}`}
        >
          <span className="h-2 w-2 rounded-full bg-red-500" />
          Dangerous ({stats.dangerousCount || 0})
        </button>
        <button
          onClick={() => setThreatFilter('medium')}
          className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium transition ${threatFilter === 'medium' ? 'bg-amber-500/30 text-amber-300 font-semibold border border-amber-500/40' : 'text-amber-400 hover:bg-amber-500/10'}`}
        >
          <span className="h-2 w-2 rounded-full bg-amber-400" />
          Medium ({stats.mediumCount || 0})
        </button>
        <button
          onClick={() => setThreatFilter('safe')}
          className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium transition ${threatFilter === 'safe' ? 'bg-emerald-500/30 text-emerald-300 font-semibold border border-emerald-500/40' : 'text-emerald-400 hover:bg-emerald-500/10'}`}
        >
          <span className="h-2 w-2 rounded-full bg-emerald-400" />
          Safe ({stats.safeCount || 0})
        </button>
      </div>

      {/* 3D Threat Color Legend Card */}
      {showLegend && (
        <div className="absolute bottom-20 left-4 z-10 hidden md:block rounded-xl border border-white/10 bg-[#0b0d12]/90 p-3 backdrop-blur shadow-xl text-xs">
          <div className="flex items-center justify-between pb-1.5 border-b border-white/10 gap-3">
            <span className="font-semibold text-slate-300 flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5 text-slate-400" /> 3D Threat Color Map
            </span>
            <button onClick={() => setShowLegend(false)} className="text-slate-500 hover:text-white" aria-label="Close legend">
              <X className="h-3 w-3" />
            </button>
          </div>
          <div className="mt-2 space-y-1.5 font-medium">
            <div className="flex items-center gap-2 text-red-400">
              <span className="h-2.5 w-2.5 rounded-full bg-red-500 shadow-[0_0_8px_#ef4444]" />
              <span>Red Asteroids = Dangerous (PHAs / High Threat)</span>
            </div>
            <div className="flex items-center gap-2 text-amber-400">
              <span className="h-2.5 w-2.5 rounded-full bg-amber-400 shadow-[0_0_8px_#eab308]" />
              <span>Yellow Asteroids = Medium Caution (Close Flyby)</span>
            </div>
            <div className="flex items-center gap-2 text-emerald-400">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#10b981]" />
              <span>Green Asteroids = Safe (Non-Hazardous)</span>
            </div>
          </div>
        </div>
      )}

      {/* Asteroid Watch Panel (Floating HUD) */}
      {selected && watchOpen && (
        <div className="absolute left-4 top-16 z-20 w-[min(94%,340px)] rounded-2xl border border-white/15 bg-[#0b0d12]/95 p-5 shadow-2xl backdrop-blur">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Radio className={`h-5 w-5 ${selectedThreat.twText}`} />
              <h3 className="font-heading text-lg font-bold text-white">Asteroid Watch</h3>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setWatchOpen(false)}
                className="rounded-full p-1.5 text-slate-400 transition hover:bg-white/10 hover:text-white"
                aria-label="Close Asteroid Watch"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Threat Level Badge */}
          <div className="mt-3 flex items-center justify-between">
            <div className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold border ${selectedThreat.twBg} ${selectedThreat.twText} ${selectedThreat.twBorder}`}>
              <span className={`h-2 w-2 rounded-full ${selectedThreat.twDot}`} />
              {selectedThreat.label}
            </div>
            <div className="text-[11px] font-mono text-slate-400">
              {currentIdx + 1} of {watchList.length}
            </div>
          </div>

          <div className="my-2.5 h-px bg-white/10" />

          {/* Asteroid Details */}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="font-heading text-2xl font-bold text-white truncate" title={selected.name}>
                {selected.name}
              </div>
              <div className="mt-1 text-xs text-slate-400 font-mono">
                Class: {selected.type || 'NEO'} {selected.neo ? '• Near Earth' : ''}
              </div>

              <div className="mt-3 text-[10px] uppercase tracking-widest text-slate-500">Close Approach Date</div>
              <div className="text-sm font-semibold text-slate-100">
                {selected.date ? new Date(selected.date).toUTCString().slice(5, 22) : 'Date not available'}
              </div>

              <div className="mt-2 text-[10px] uppercase tracking-widest text-slate-500">Miss Distance</div>
              <div className="text-sm font-semibold text-slate-100">
                {selected.missKm ? `${fmtNum(selected.missKm)} km` : '—'}
                {selected.missAu ? <span className="ml-1 text-xs text-slate-400">({selected.missAu} AU)</span> : null}
              </div>

              <div className="mt-2 text-[10px] uppercase tracking-widest text-slate-500">Relative Velocity</div>
              <div className="text-sm font-semibold text-slate-100">
                {selected.velocity ? `${fmtNum(selected.velocity, 1)} km/s` : '—'}
              </div>
            </div>

            <div className="text-center shrink-0">
              <div className="relative mx-auto flex items-center justify-center" style={{ width: 68, height: 68 }}>
                {/* Circle around the asteroid moving always in an infinite loop with 360 rotation */}
                <div
                  className="absolute inset-0 rounded-full border-2 border-dashed pointer-events-none animate-spin"
                  style={{
                    borderColor: selectedThreat.hex,
                    boxShadow: `0 0 14px ${selectedThreat.dimGlow}`,
                    animationDuration: '6s',
                  }}
                />
                {/* Asteroid rotating infinitely */}
                <div
                  className="rounded-full shadow-inner flex items-center justify-center font-bold text-xs animate-spin"
                  style={{
                    width: 48,
                    height: 48,
                    backgroundColor: selectedThreat.hex,
                    boxShadow: `0 0 16px ${selectedThreat.glow}`,
                    clipPath: 'polygon(20% 5%, 70% 0, 100% 35%, 90% 80%, 50% 100%, 8% 78%, 0 35%)',
                    animationDuration: '14s',
                  }}
                />
              </div>
              <div className="mt-2 text-sm font-bold text-slate-100">{fmtNum(selected.diameter, 0)} m</div>
              <div className="text-[9px] uppercase tracking-widest text-slate-500">Est. Diameter</div>
            </div>
          </div>

          {/* Carousel Next / Prev Controls */}
          <div className="mt-4 flex items-center justify-between">
            <button
              onClick={() => {
                const prev = (currentIdx - 1 + watchList.length) % watchList.length;
                setSelectedId(watchList[prev].id);
              }}
              className="rounded-full p-1.5 text-slate-400 hover:bg-white/10 hover:text-white"
              aria-label="Previous asteroid"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <div className="flex gap-1.5 max-w-[160px] overflow-x-auto py-1">
              {watchList.slice(0, 8).map((w, i) => {
                const isCur = w.id === selected.id;
                const dotColor = THREAT_CONFIG[w.threatLevel]?.hex || '#10b981';
                return (
                  <button
                    key={w.id || i}
                    onClick={() => setSelectedId(w.id)}
                    aria-label={`Select asteroid ${w.name}`}
                    className={`h-2.5 rounded-full transition-all ${isCur ? 'w-5' : 'w-2.5 hover:opacity-100 opacity-60'}`}
                    style={{ backgroundColor: dotColor }}
                  />
                );
              })}
            </div>
            <button
              onClick={() => {
                const next = (currentIdx + 1) % watchList.length;
                setSelectedId(watchList[next].id);
              }}
              className="rounded-full p-1.5 text-slate-400 hover:bg-white/10 hover:text-white"
              aria-label="Next asteroid"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>

          {selected.nasaJplUrl && (
            <div className="mt-2.5 pt-2 border-t border-white/10 text-center">
              <a
                href={selected.nasaJplUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-sky-400 hover:text-sky-300 hover:underline"
              >
                <span>NASA JPL Small-Body Database</span>
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          )}
        </div>
      )}

      {/* Button to re-open watch panel if closed */}
      {!watchOpen && selected && (
        <button
          onClick={() => setWatchOpen(true)}
          className="absolute left-4 top-16 z-10 flex items-center gap-2 rounded-xl border border-white/10 bg-[#0b0d12]/90 px-3 py-2 text-xs font-semibold text-white backdrop-blur hover:bg-white/10"
        >
          <Radio className="h-4 w-4 text-emerald-400" />
          <span>Inspect {selected.name}</span>
        </button>
      )}

      {/* Zoom controls */}
      <div className="absolute right-3 top-1/2 z-10 flex -translate-y-1/2 flex-col gap-1 rounded-lg border border-white/10 bg-[#0b0d12]/90 p-1 shadow-lg backdrop-blur">
        <button onClick={() => zoom(0.8)} className="rounded p-2 text-slate-300 hover:bg-white/10" aria-label="Zoom in" title="Zoom in">
          <Plus className="h-4 w-4" />
        </button>
        <button onClick={() => zoom(1.25)} className="rounded p-2 text-slate-300 hover:bg-white/10" aria-label="Zoom out" title="Zoom out">
          <Minus className="h-4 w-4" />
        </button>
        <button onClick={resetView} className="rounded p-2 text-slate-300 hover:bg-white/10" aria-label="Reset view" title="Reset view">
          <RotateCcw className="h-4 w-4" />
        </button>
      </div>

      {/* Bottom Time / Speed Bar */}
      <div className="absolute bottom-3 left-1/2 z-10 flex w-[min(96%,760px)] -translate-x-1/2 flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-xl border border-white/10 bg-[#0b0d12]/85 px-4 py-2 backdrop-blur shadow-2xl">
        <div className="flex items-center gap-3">
          <button
            onClick={goLive}
            className={`flex items-center gap-2 text-xs font-bold tracking-widest ${isLive ? 'text-emerald-400' : 'text-slate-400 hover:text-white'}`}
          >
            <span className={`h-2 w-2 rounded-full ${isLive ? 'bg-emerald-400' : 'bg-slate-500'}`} />
            LIVE TIME
          </button>
          <div className="font-mono text-sm text-slate-100">
            {clock.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }).toUpperCase()}
          </div>
          <div className="font-mono text-xs text-slate-400">{clock.toLocaleTimeString('en-US')}</div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={togglePause}
            className="rounded p-1.5 text-slate-300 hover:bg-white/10"
            aria-label={paused ? 'Play' : 'Pause'}
            title={paused ? 'Play simulation' : 'Pause simulation'}
          >
            {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
          </button>
          <div className="flex gap-1">
            {SPEEDS.map((s, i) => (
              <button
                key={s.label}
                onClick={() => setSpeed(i)}
                className={`rounded px-2 py-1 text-[11px] font-semibold transition ${
                  i === speedIdx ? 'bg-crimson-red text-white' : 'text-slate-400 hover:bg-white/10'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

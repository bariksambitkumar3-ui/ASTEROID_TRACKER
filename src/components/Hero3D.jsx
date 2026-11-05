import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/*
 * Hero3D – real-time 3D layer for the ASTRA landing hero.
 *
 * It is layered between the (unchanged) background image and the existing UI.
 * Everything is positioned in *background-image coordinates* (1148 x 768) and
 * mapped to the section with the same "cover / left center" rule the image
 * uses, so the 3D asteroid and Earth stay locked onto the artwork at any size.
 *
 *  - Asteroid : displaced + cratered icosphere, spins on its own axis, floats,
 *               reacts smoothly to the pointer.
 *  - Earth    : analytic sphere rendered in a fragment shader (continents,
 *               clouds, city lights, atmosphere). It spins around a tilted axis
 *               so the surface scrolls horizontally forever – a perfectly
 *               periodic, seamless loop.
 */

const IMG_W = 1148;
const IMG_H = 768;

// --- where things sit in the 1148 x 768 hero stage (stage px) -------------------
// Sized smaller and placed further to the right side of the hero viewport
const AST = { x: 895, y: 320, radius: 135 };      // smaller 3D asteroid positioned at right side
const EARTH = { cx: 780, peakY: 608, R: 2290 };   // Earth horizon circle

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

// ---------------------------------------------------------------------------
// Asteroid geometry
// ---------------------------------------------------------------------------
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const fract = (x) => x - Math.floor(x);
function hash3(x, y, z) {
  return fract(Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453);
}
function vnoise(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  let xf = x - xi, yf = y - yi, zf = z - zi;
  xf = xf * xf * (3 - 2 * xf); yf = yf * yf * (3 - 2 * yf); zf = zf * zf * (3 - 2 * zf);
  const l = (a, b, t) => a + (b - a) * t;
  return l(
    l(l(hash3(xi, yi, zi), hash3(xi + 1, yi, zi), xf), l(hash3(xi, yi + 1, zi), hash3(xi + 1, yi + 1, zi), xf), yf),
    l(l(hash3(xi, yi, zi + 1), hash3(xi + 1, yi, zi + 1), xf), l(hash3(xi, yi + 1, zi + 1), hash3(xi + 1, yi + 1, zi + 1), xf), yf),
    zf
  );
}
function fbm(x, y, z, oct) {
  let a = 0.5, f = 1, s = 0;
  for (let i = 0; i < oct; i++) { s += a * vnoise(x * f, y * f, z * f); f *= 2.03; a *= 0.5; }
  return s;
}

function buildAsteroidGeometry(detail) {
  let geo = new THREE.IcosahedronGeometry(1, detail);
  geo.deleteAttribute('normal');
  geo.deleteAttribute('uv');
  geo = mergeVertices(geo, 1e-5);

  const rand = mulberry32(20260);
  const craters = [];
  const addCraters = (n, rMin, rMax, depthK) => {
    for (let i = 0; i < n; i++) {
      const u = rand() * 2 - 1, th = rand() * Math.PI * 2, s = Math.sqrt(1 - u * u);
      const r = rMin + (rMax - rMin) * Math.pow(rand(), 1.6);
      craters.push({ x: s * Math.cos(th), y: u, z: s * Math.sin(th), r, depth: r * depthK * (0.7 + rand() * 0.6) });
    }
  };
  addCraters(11, 0.20, 0.36, 0.30);
  addCraters(58, 0.075, 0.17, 0.27);
  addCraters(240, 0.028, 0.07, 0.24);

  const pos = geo.attributes.position;
  const col = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    let px = pos.getX(i), py = pos.getY(i), pz = pos.getZ(i);
    const len = Math.hypot(px, py, pz); px /= len; py /= len; pz /= len;

    // lumpy prolate body (long axis = local Y)
    const lump = fbm(px * 1.3 + 5, py * 1.3 + 2, pz * 1.3 + 9, 4);
    const ridge = 1 - Math.abs(vnoise(px * 4.2, py * 4.2, pz * 4.2) * 2 - 1);
    let h = 1 + (lump - 0.5) * 0.46 + (ridge - 0.5) * 0.045 + (fbm(px * 11, py * 11, pz * 11, 3) - 0.5) * 0.03;

    let floor = 0, rim = 0;
    for (let c = 0; c < craters.length; c++) {
      const k = craters[c];
      const dx = px - k.x, dy = py - k.y, dz = pz - k.z;
      const x2 = (dx * dx + dy * dy + dz * dz) / (k.r * k.r);
      if (x2 < 1.9) {
        if (x2 < 1) {
          const bowl = 1 - x2;
          h -= bowl * bowl * 0.5 * k.depth * 2.0 + bowl * k.depth * 0.6;
          floor = Math.max(floor, bowl);
        }
        const x = Math.sqrt(x2);
        const rr = Math.exp(-Math.pow((x - 1.05) / 0.2, 2));
        h += rr * k.depth * 0.55;
        rim = Math.max(rim, rr);
      }
    }

    pos.setXYZ(i, px * h * 0.80, py * h * 1.0, pz * h * 0.80);

    // albedo: warm-grey regolith, darker crater floors, brighter rims
    const grain = 0.72 + 0.55 * fbm(px * 9 + 3, py * 9, pz * 9 - 4, 4);
    const patch = 0.78 + 0.35 * fbm(px * 2.2 + 7, py * 2.2, pz * 2.2 + 1, 3);
    let v = 0.62 * (0.88 + 0.12 * grain) * (0.94 + 0.06 * patch) * (1 - 0.97 * Math.min(1, floor * 1.6)) * (1 + 0.06 * rim);
    col[i * 3] = v; col[i * 3 + 1] = v; col[i * 3 + 2] = v * 1.02;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  return geo;
}

// ---------------------------------------------------------------------------
// Shaders
// ---------------------------------------------------------------------------
const NOISE_GLSL = /* glsl */ `
float hash13(vec3 p3){ p3 = fract(p3 * .1031); p3 += dot(p3, p3.zyx + 31.32); return fract((p3.x + p3.y) * p3.z); }
float vnoise(vec3 x){
  vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash13(i), hash13(i + vec3(1,0,0)), f.x), mix(hash13(i + vec3(0,1,0)), hash13(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(hash13(i + vec3(0,0,1)), hash13(i + vec3(1,0,1)), f.x), mix(hash13(i + vec3(0,1,1)), hash13(i + vec3(1,1,1)), f.x), f.y), f.z);
}
float fbm(vec3 p, int oct){
  float a = 0.5, s = 0.0;
  for (int i = 0; i < 8; i++){ if (i >= oct) break; s += a * vnoise(p); p = p * 2.03 + 11.7; a *= 0.5; }
  return s;
}
`;

const EARTH_VERT = /* glsl */ `
void main(){ gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const EARTH_FRAG = /* glsl */ `
precision highp float;
uniform vec2  uCenter;   // device px, origin bottom-left
uniform float uR;        // device px
uniform float uPx;       // device px per background-image px
uniform float uAngSurf;  // 0..2PI, periodic
uniform float uAngCloud; // 0..2PI, periodic
uniform int   uOct;      // quality
${NOISE_GLSL}
const vec3 AXIS = vec3(0.0, 0.3590, 0.9333);
const vec3 SUN  = vec3(-0.86, -0.10, 0.26);

vec3 rodrigues(vec3 v, vec3 k, float a){
  float c = cos(a), s = sin(a);
  return v * c + cross(k, v) * s + k * dot(k, v) * (1.0 - c);
}

void main(){
  vec2 p = gl_FragCoord.xy - uCenter;
  float d = length(p);
  float hpx = (d - uR) / uPx;
  if (hpx > 95.0) discard;

  vec3 L = normalize(SUN);
  float cover = clamp(0.5 - (d - uR) / max(1.0, uPx * 0.9), 0.0, 1.0);

  // ---------- surface ----------
  vec3 col = vec3(0.0);
  if (cover > 0.0) {
    vec2 q2 = p / uR;
    float nz = sqrt(max(0.0, 1.0 - dot(q2, q2)));
    vec3 n = vec3(q2, nz);
    float ndl = dot(n, L);
    float day = smoothstep(-0.08, 0.38, ndl);

    vec3 q  = rodrigues(n, AXIS,  uAngSurf);
    vec3 qc = rodrigues(n, AXIS,  uAngCloud);

    // continents
    float warp = vnoise(q * 3.0) - 0.5;
    float h = fbm(q * 2.1 + vec3(3.7) + warp * 0.55, uOct + 1);
    float land = smoothstep(0.505, 0.52, h);
    float moist = fbm(q * 3.4 + 9.0, 4);

    vec3 ocean = mix(vec3(0.004, 0.028, 0.095), vec3(0.020, 0.120, 0.260), smoothstep(0.38, 0.505, h));
    vec3 grass = mix(vec3(0.045, 0.14, 0.055), vec3(0.20, 0.20, 0.09), smoothstep(0.52, 0.66, h));
    vec3 sand  = vec3(0.50, 0.40, 0.24);
    vec3 rock  = vec3(0.34, 0.31, 0.28);
    vec3 ground = mix(grass, sand, smoothstep(0.52, 0.40, moist));
    ground = mix(ground, rock, smoothstep(0.64, 0.74, h));
    ground = mix(ground, vec3(0.85, 0.88, 0.92), smoothstep(0.76, 0.86, h));
    vec3 albedo = mix(ocean, ground, land);

    // ocean glint + sky reflection
    vec3 R = reflect(-L, n);
    float glint = pow(max(R.z, 0.0), 90.0) * (1.0 - land) * step(0.0, ndl);
    float refl = pow(1.0 - nz, 4.0);

    vec3 lit = albedo * (0.03 + 0.80 * day);
    lit += vec3(1.0, 0.92, 0.78) * glint * 0.9;
    lit += vec3(0.05, 0.14, 0.32) * refl * (1.0 - land) * (0.2 + 0.6 * day);

    // clouds
    float cw = fbm(qc * 1.8 + 4.0, 3);
    float cn = fbm(qc * vec3(3.6, 3.6, 3.6) + 1.5 * vec3(cw, -cw, cw), uOct);
    float cc = smoothstep(0.56, 0.82, cn);
    vec3 cloudCol = vec3(0.90, 0.94, 1.0) * (0.05 + 0.85 * smoothstep(-0.12, 0.45, ndl)) + vec3(0.012, 0.02, 0.04);
    col = mix(lit, cloudCol, cc * 0.88);

    // city lights
    float night = smoothstep(0.16, -0.10, ndl);
    float cl = smoothstep(0.38, 0.72, fbm(q * 7.0 + 21.0, 3));
    float coast = smoothstep(0.505, 0.54, h) * (1.0 - 0.55 * smoothstep(0.56, 0.78, h));
    float wgt = cl * coast * (1.0 - cc * 0.85);
    float dots = smoothstep(0.74, 0.92, vnoise(q * 430.0));
    float web  = 1.0 - smoothstep(0.0, 0.07, abs(vnoise(q * 58.0) - 0.5));
    vec3 city = vec3(1.0, 0.64, 0.28) * (dots * 1.5 + web * 0.7 * cl + 0.10) + vec3(1.0, 0.9, 0.6) * dots * 0.7;
    col += city * wgt * night * 1.15;

    // atmosphere on the limb
    float rim = pow(1.0 - nz, 2.6);
    col += vec3(0.22, 0.52, 1.0) * rim * (0.30 + 0.95 * smoothstep(-0.5, 0.5, ndl));
    col += vec3(0.62, 0.82, 1.0) * pow(1.0 - nz, 14.0) * 1.35;
  }

  // ---------- glow above the horizon ----------
  float g = 0.70 * exp(-hpx / 6.0) + 0.34 * exp(-hpx / 26.0) + 0.14 * exp(-hpx / 70.0);
  g *= smoothstep(95.0, 30.0, hpx);
  g *= mix(1.1, 0.72, smoothstep(-400.0, 420.0, p.x / uPx));
  vec3 gcol = mix(vec3(0.20, 0.48, 1.0), vec3(0.78, 0.91, 1.0), exp(-hpx / 5.0));
  vec3 glow = gcol * g;

  vec3 rgb = col * cover + glow * (1.0 - cover);
  gl_FragColor = vec4(rgb, cover);
}
`;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function Hero3D() {
  const canvasRef = useRef(null);
  const [failed, setFailed] = useState(false); // true when WebGL is unavailable -> CSS fallback

  useEffect(() => {
    const canvas = canvasRef.current;
    const host = canvas?.parentElement;
    if (!canvas || !host) return undefined;

    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const isSmall = window.matchMedia?.('(max-width: 767px), (pointer: coarse)').matches;

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas, alpha: true, antialias: !isSmall, powerPreference: 'high-performance', premultipliedAlpha: true,
      });
    } catch {
      // WebGL is off / unsupported: show the lightweight CSS fallback instead of 3D
      console.warn('[ASTRA] WebGL unavailable – showing CSS fallback for the hero.');
      setFailed(true);
      return undefined;
    }
    renderer.setClearColor(0x000000, 0);
    renderer.toneMapping = THREE.NoToneMapping;
    const useShadows = !isSmall;
    if (useShadows) {
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFShadowMap;
    }

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(0, 1, 1, 0, -3000, 3000);
    camera.position.z = 1000;

    // ---- Earth: full-screen triangle-pair, analytic sphere in the shader ----
    const earthMat = new THREE.ShaderMaterial({
      vertexShader: EARTH_VERT,
      fragmentShader: EARTH_FRAG,
      uniforms: {
        uCenter: { value: new THREE.Vector2() },
        uR: { value: 1 },
        uPx: { value: 1 },
        uAngSurf: { value: 0 },
        uAngCloud: { value: 0 },
        uOct: { value: isSmall ? 4 : 6 },
      },
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: THREE.CustomBlending,
      blendEquation: THREE.AddEquation,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneMinusSrcAlphaFactor,
      blendSrcAlpha: THREE.OneFactor,
      blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
    });
    const earth = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), earthMat);
    earth.frustumCulled = false;
    earth.renderOrder = 0;
    scene.add(earth);

    // ---- Asteroid ----
    const root = new THREE.Group();          // position / float / pointer tilt
    const axisGroup = new THREE.Group();     // fixed spin axis
    axisGroup.rotation.set(0.14, 0, -0.95, 'XYZ');
    root.add(axisGroup);
    scene.add(root);

    const geo = buildAsteroidGeometry(isSmall ? 30 : 54);
    const astMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.96, metalness: 0.0 });
    astMat.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vObjPos;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvObjPos = position;');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>\nvarying vec3 vObjPos;\n${NOISE_GLSL}`)
        .replace(
          '#include <color_fragment>',
          `#include <color_fragment>
          {
            float small = smoothstep(0.745, 0.775, vnoise(vObjPos * 62.0));
            float mid   = smoothstep(0.790, 0.815, vnoise(vObjPos * 21.0 + 7.0));
            diffuseColor.rgb *= 1.0 - clamp(small + mid, 0.0, 1.0) * 0.97;
          }`
        )
        .replace(
          '#include <normal_fragment_maps>',
          `#include <normal_fragment_maps>
          {
            float hh = fbm(vObjPos * 30.0, 3);
            vec3 vp = -vViewPosition;
            vec3 dpdx = dFdx(vp), dpdy = dFdy(vp);
            float dhx = dFdx(hh), dhy = dFdy(hh);
            vec3 r1 = cross(dpdy, normal), r2 = cross(normal, dpdx);
            float det = dot(dpdx, r1);
            vec3 grad = sign(det) * (dhx * r1 + dhy * r2);
            normal = normalize(abs(det) * normal - 1.1 * grad);
          }`
        );
    };
    const asteroid = new THREE.Mesh(geo, astMat);
    asteroid.castShadow = useShadows;
    asteroid.receiveShadow = useShadows;
    axisGroup.add(asteroid);

    // ---- Circle around the asteroid (moving always in an infinite loop with 360 rotation) ----
    const ringGroup = new THREE.Group();
    ringGroup.rotation.set(0.65, 0.25, 0); // tilted orbital circle orientation
    const ringRadius = 1.48;
    const ringSegments = 128;
    const ringPts = [];
    for (let i = 0; i <= ringSegments; i++) {
      const th = (i / ringSegments) * Math.PI * 2;
      ringPts.push(new THREE.Vector3(Math.cos(th) * ringRadius, Math.sin(th) * ringRadius, 0));
    }
    const ringGeo = new THREE.BufferGeometry().setFromPoints(ringPts);
    const ringMat = new THREE.LineBasicMaterial({
      color: 0xff3b4e,
      transparent: true,
      opacity: 0.85,
    });
    const ringLine = new THREE.LineLoop(ringGeo, ringMat);
    ringGroup.add(ringLine);

    // Orbiting beacon node on the rotating circle
    const beaconGeo = new THREE.SphereGeometry(0.045, 12, 12);
    const beaconMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const beacon = new THREE.Mesh(beaconGeo, beaconMat);
    beacon.position.set(ringRadius, 0, 0);
    const beaconHalo = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glowTexture('rgba(255,59,78,0.95)', 'rgba(255,40,60,0.1)'),
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    beaconHalo.scale.set(0.4, 0.4, 1);
    beacon.add(beaconHalo);
    ringGroup.add(beacon);
    axisGroup.add(ringGroup);

    // lighting: cool white key from upper-left, red rim from the right (as in the artwork)
    const key = new THREE.DirectionalLight(0xffffff, 3.0);
    key.position.set(-420, 520, 640);
    if (useShadows) {
      key.castShadow = true;
      key.shadow.mapSize.set(1024, 1024);
      const sc = key.shadow.camera;
      sc.left = -1; sc.right = 1; sc.top = 1; sc.bottom = -1; sc.near = 1; sc.far = 2500;
      key.shadow.bias = -0.0004;
      key.shadow.normalBias = 1.2;
      key.shadow.radius = 3;
    }
    root.add(key);
    root.add(key.target);
    const rim = new THREE.DirectionalLight(0xff3a30, 0.4);
    rim.position.set(700, -170, 120);
    root.add(rim);
    root.add(rim.target);
    const fill = new THREE.DirectionalLight(0xdfe8ff, 1.1);
    fill.position.set(-600, -200, 300);
    root.add(fill);
    root.add(fill.target);
    scene.add(new THREE.HemisphereLight(0x8fa3d8, 0x20263a, 0.75));

    // ---- layout (image coords -> section px, same as object-fit: cover / left center) ----
    let W = 1, H = 1, dpr = 1, scale = 1, base = { x: 0, y: 0 };
    const layout = () => {
      const r = host.getBoundingClientRect();
      W = Math.max(1, Math.round(r.width));
      H = Math.max(1, Math.round(r.height));
      dpr = Math.min(window.devicePixelRatio || 1, isSmall ? 1.25 : 1.75);
      renderer.setPixelRatio(dpr);
      renderer.setSize(W, H, false);

      camera.left = 0; camera.right = W; camera.top = H; camera.bottom = 0;
      camera.updateProjectionMatrix();

      scale = Math.max(W / IMG_W, H / IMG_H);
      const oy = (H - IMG_H * scale) / 2;
      const toX = (ix) => ix * scale;
      const toY = (iy) => H - (iy * scale + oy); // flip: three y is up

      base = { x: toX(AST.x), y: toY(AST.y) };
      const s = AST.radius * scale;
      root.scale.setScalar(s);
      // directional-light positions are root-local (root is scaled by s); the shadow
      // camera works in world units, so its bounds are expressed in px too
      key.position.set(-0.55, 0.60, 0.95).multiplyScalar(2.2);
      rim.position.set(1.0, -0.30, -0.28).multiplyScalar(2.2);
      fill.position.set(0.8, -0.2, 0.9).multiplyScalar(2.2);
      const sc = key.shadow.camera;
      sc.left = -1.6 * s; sc.right = 1.6 * s; sc.top = 1.6 * s; sc.bottom = -1.6 * s;
      sc.near = 0.2 * s; sc.far = 7 * s;
      sc.updateProjectionMatrix();

      const u = earthMat.uniforms;
      u.uPx.value = scale * dpr;
      u.uR.value = EARTH.R * scale * dpr;
      u.uCenter.value.set(toX(EARTH.cx) * dpr, toY(EARTH.peakY + EARTH.R) * dpr);
    };

    // ---- pointer (smoothed) ----
    const ptr = { tx: 0, ty: 0, x: 0, y: 0 };
    const onMove = (e) => {
      const r = host.getBoundingClientRect();
      if (e.clientY < r.top - 40 || e.clientY > r.bottom + 40) return;
      ptr.tx = THREE.MathUtils.clamp(((e.clientX - r.left) / r.width) * 2 - 1, -1, 1);
      ptr.ty = THREE.MathUtils.clamp(((e.clientY - r.top) / r.height) * 2 - 1, -1, 1);
    };
    const onLeave = () => { ptr.tx = 0; ptr.ty = 0; };
    window.addEventListener('pointermove', onMove, { passive: true });
    document.addEventListener('pointerleave', onLeave);
    window.addEventListener('blur', onLeave);

    // ---- animation ----
    const TAU = Math.PI * 2;
    const SURF_SPEED = 0.016;   // rad/s – Earth rotation (surface drifts horizontally)
    const CLOUD_SPEED = 0.0125; // clouds lag the ground slightly
    let raf = 0, last = performance.now(), t = reduceMotion ? 6 : 0, running = false, visible = true, shown = false;

    const draw = (dt) => {
      t += dt;

      // Asteroid has only continuous 360-degree rotation (3D bobbing/tilting removed)
      asteroid.rotation.y = (t * 0.18) % TAU;

      // Circle around the asteroid moving always in an infinite loop with 360 rotation
      ringGroup.rotation.z = (t * 0.45) % TAU;

      // Stationary position and rotation for the asteroid (no 3D bobbing/tilting)
      root.rotation.set(0, 0, 0);
      root.position.set(base.x, base.y, 0);

      earthMat.uniforms.uAngSurf.value = (-(t * SURF_SPEED) % TAU + TAU) % TAU;
      earthMat.uniforms.uAngCloud.value = (-(t * CLOUD_SPEED) % TAU + TAU) % TAU;

      renderer.render(scene, camera);
      if (!shown) { shown = true; canvas.classList.add('is-ready'); }
    };

    const loop = (now) => {
      if (!running) return;
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      draw(dt);
    };
    const start = () => {
      if (running || reduceMotion) return;
      running = true; last = performance.now(); raf = requestAnimationFrame(loop);
    };
    const stop = () => { running = false; cancelAnimationFrame(raf); };
    const sync = () => (visible && !document.hidden ? start() : stop());

    layout();
    draw(0);

    const ro = new ResizeObserver(() => { layout(); if (!running) draw(0); });
    ro.observe(host);
    const io = new IntersectionObserver(([en]) => { visible = en.isIntersecting; sync(); }, { threshold: 0 });
    io.observe(host);
    document.addEventListener('visibilitychange', sync);
    sync();

    return () => {
      stop();
      ro.disconnect(); io.disconnect();
      document.removeEventListener('visibilitychange', sync);
      window.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerleave', onLeave);
      window.removeEventListener('blur', onLeave);
      geo?.dispose();
      astMat?.dispose();
      earthMat?.dispose();
      earth?.geometry?.dispose();
      ringGeo?.dispose();
      ringMat?.dispose();
      beaconGeo?.dispose();
      beaconMat?.dispose();
      beaconHalo?.material?.map?.dispose();
      beaconHalo?.material?.dispose();
      renderer?.dispose();
    };
  }, []);

  return (
    <>
      <canvas ref={canvasRef} className="hero-3d-canvas" aria-hidden="true" hidden={failed} />
      {failed && (
        <div className="hero-fallback" aria-hidden="true">
          <div className="hero-fallback-earth" />
          <div className="hero-fallback-asteroid" />
        </div>
      )}
    </>
  );
}

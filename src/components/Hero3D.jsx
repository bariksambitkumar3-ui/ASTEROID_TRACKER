import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

/*
 * Hero3D – real-time 3D Earth layer for the ASTRA landing hero.
 *
 * Renders the 3D rotating Earth (continents, clouds, city lights, atmosphere)
 * mapped to the hero stage with an analytic sphere fragment shader.
 */

const IMG_W = 1148;
const IMG_H = 768;

const EARTH = { cx: 780, peakY: 608, R: 2290 }; // Earth horizon circle

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
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    const host = canvas?.parentElement;
    if (!canvas || !host) return undefined;

    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const isSmall = window.matchMedia?.('(max-width: 767px), (pointer: coarse)').matches;

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        antialias: !isSmall,
        powerPreference: 'high-performance',
        premultipliedAlpha: true,
      });
    } catch {
      console.warn('[ASTRA] WebGL unavailable – showing CSS fallback for the hero.');
      setFailed(true);
      return undefined;
    }
    renderer.setClearColor(0x000000, 0);
    renderer.toneMapping = THREE.NoToneMapping;

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

    // ---- layout ----
    let W = 1, H = 1, dpr = 1, scale = 1;
    const layout = () => {
      const r = host.getBoundingClientRect();
      W = Math.max(1, Math.round(r.width));
      H = Math.max(1, Math.round(r.height));
      dpr = Math.min(window.devicePixelRatio || 1, isSmall ? 1.25 : 1.75);
      renderer.setPixelRatio(dpr);
      renderer.setSize(W, H, false);

      camera.left = 0;
      camera.right = W;
      camera.top = H;
      camera.bottom = 0;
      camera.updateProjectionMatrix();

      scale = Math.max(W / IMG_W, H / IMG_H);
      const oy = (H - IMG_H * scale) / 2;
      const toX = (ix) => ix * scale;
      const toY = (iy) => H - (iy * scale + oy);

      const u = earthMat.uniforms;
      u.uPx.value = scale * dpr;
      u.uR.value = EARTH.R * scale * dpr;
      u.uCenter.value.set(toX(EARTH.cx) * dpr, toY(EARTH.peakY + EARTH.R) * dpr);
    };

    // ---- animation ----
    const TAU = Math.PI * 2;
    const SURF_SPEED = 0.016;   // rad/s – Earth rotation
    const CLOUD_SPEED = 0.0125;
    let raf = 0, last = performance.now(), t = reduceMotion ? 6 : 0, running = false, visible = true, shown = false;

    const draw = (dt) => {
      t += dt;
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
      running = true;
      last = performance.now();
      raf = requestAnimationFrame(loop);
    };

    const stop = () => {
      running = false;
      cancelAnimationFrame(raf);
    };

    const sync = () => (visible && !document.hidden ? start() : stop());

    layout();
    draw(0);

    const ro = new ResizeObserver(() => {
      layout();
      if (!running) draw(0);
    });
    ro.observe(host);

    const io = new IntersectionObserver(([en]) => {
      visible = en.isIntersecting;
      sync();
    }, { threshold: 0 });
    io.observe(host);

    document.addEventListener('visibilitychange', sync);
    sync();

    return () => {
      stop();
      ro.disconnect();
      io.disconnect();
      document.removeEventListener('visibilitychange', sync);
      earthMat?.dispose();
      earth?.geometry?.dispose();
      renderer?.dispose();
    };
  }, []);

  return (
    <>
      <canvas ref={canvasRef} className="hero-3d-canvas" aria-hidden="true" hidden={failed} />
      {failed && (
        <div className="hero-fallback" aria-hidden="true">
          <div className="hero-fallback-earth" />
        </div>
      )}
    </>
  );
}

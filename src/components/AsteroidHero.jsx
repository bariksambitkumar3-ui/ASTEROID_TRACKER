import { useMemo } from 'react';
import { ChevronRight } from 'lucide-react';
import Hero3D from './Hero3D.jsx';

/*
 * ASTRA hero – the whole scene is now built in code (no background picture):
 *   space + nebula + stars  ->  3D asteroid & 3D Earth (canvas)  ->  UI text / button
 *
 * Everything lives inside a "stage" that is always 1148 x 768 (scaled with
 * object-fit: cover logic) so the text, rings and 3D models stay aligned.
 */

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function Stars() {
  const stars = useMemo(() => {
    const r = mulberry32(7);
    return Array.from({ length: 240 }, (_, i) => {
      const big = r() > 0.94;
      return {
        x: r() * 1148,
        y: r() * 700,
        r: big ? 0.9 + r() * 0.8 : 0.3 + r() * 0.6,
        o: 0.25 + r() * 0.75,
        c: r() > 0.8 ? '#a9c6ff' : r() > 0.9 ? '#ffd9c2' : '#ffffff',
        tw: i % 9 === 0 ? i % 5 : -1,
      };
    });
  }, []);

  return (
    <svg className="hero-stars" viewBox="0 0 1148 768" preserveAspectRatio="none" aria-hidden="true">
      {stars.map((s, i) => (
        <circle
          key={i}
          cx={s.x}
          cy={s.y}
          r={s.r}
          fill={s.c}
          opacity={s.o}
          className={s.tw >= 0 ? `hero-twinkle hero-twinkle-${s.tw}` : undefined}
        />
      ))}
    </svg>
  );
}

function Nebula() {
  return (
    <svg className="hero-nebula" viewBox="0 0 1148 768" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <filter id="hero-cloud-a" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.006 0.011" numOctaves="5" seed="11" result="n" />
          <feColorMatrix in="n" type="matrix" values="0 0 0 0 0.16  0 0 0 0 0.40  0 0 0 0 0.95  0 0 0 2.8 -1.05" />
        </filter>
        <filter id="hero-cloud-b" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.008 0.014" numOctaves="5" seed="4" result="n" />
          <feColorMatrix in="n" type="matrix" values="0 0 0 0 0.13  0 0 0 0 0.32  0 0 0 0 0.92  0 0 0 3.0 -1.1" />
        </filter>
        <radialGradient id="hero-mask-a" cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#fff" stopOpacity="1" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <mask id="hero-nm-a"><ellipse cx="300" cy="70" rx="260" ry="150" fill="url(#hero-mask-a)" /></mask>
        <mask id="hero-nm-b"><ellipse cx="1010" cy="540" rx="340" ry="230" fill="url(#hero-mask-a)" /></mask>
        <mask id="hero-nm-c"><ellipse cx="640" cy="590" rx="320" ry="110" fill="url(#hero-mask-a)" /></mask>
      </defs>
      <g mask="url(#hero-nm-a)"><rect width="1148" height="768" filter="url(#hero-cloud-a)" opacity=".7" /></g>
      <g mask="url(#hero-nm-b)"><rect width="1148" height="768" filter="url(#hero-cloud-b)" opacity=".95" /></g>
      <g mask="url(#hero-nm-c)"><rect width="1148" height="768" filter="url(#hero-cloud-a)" opacity=".45" /></g>
    </svg>
  );
}

export default function AsteroidHero() {
  return (
    <section id="hero" className="asteroid-hero" aria-label="ASTRA asteroid tracker">
      <div className="hero-stage">
        <div className="hero-space" aria-hidden="true" />
        <Nebula />
        <Stars />
        <span className="hero-bright-star" aria-hidden="true" />
        <Hero3D />

        <div className="hero-copy">
          <h1 className="hero-title">
            <span className="hero-title-white">Asteroid</span>
            <span className="hero-title-red">Tracker</span>
          </h1>
          <div className="hero-rule" aria-hidden="true" />
          <p className="hero-mantra">
            Track <i /> Analyze <i /> Explore
          </p>
          <p className="hero-tagline">
            Real-time monitoring of asteroids
            <br />
            in our solar system
          </p>
          <button
            className="hero-cta"
            type="button"
            onClick={() => document.getElementById('overview')?.scrollIntoView({ behavior: 'smooth' })}
          >
            <span>Explore Dashboard</span>
            <ChevronRight aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="hero-live-badge" role="status" aria-label="Live data">
        <span className="hero-live-pulse" aria-hidden="true" />
        <span>Live Data</span>
      </div>
    </section>
  );
}

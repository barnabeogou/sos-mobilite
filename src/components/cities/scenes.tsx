/**
 * Monuments des grandes villes, dessinés en silhouettes de nuit (repère 1000 × 360, horizon à y = 292).
 * Chaque scène fournit :
 *  - `back`     : arrière-plan (collines, quartiers, conteneurs…) ;
 *  - `landmark` : le monument (reflété dans l'eau quand la ville en a) ;
 *  - `front`    : premier plan non reflété (voitures, pirogues, palmiers…).
 * Les classes `cs-*` portent les animations (voir styles/index.css) ; toutes sont coupées
 * si « réduire les animations » est actif.
 */
import type { ReactNode } from 'react';
import type { CityScene } from '@/domain/cities';
import { cssVars } from '@/components/motion/motion';

export const H = 292; // ligne d'horizon
export const C = {
  far: '#10294A',
  mid: '#0B2038',
  near: '#06131F',
  rim: '#4C97FF',
  warm: '#FFD27A',
  amber: '#FFB04D',
  cool: '#AFCFFF',
  red: '#FF4D57',
  /** Ombres et nervures sur une surface éclairée. */
  shade: '#8A5A28',
  highlight: '#FFF3D6',
};

export type Rng = () => number;

export function rngFor(seed: string): Rng {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface SceneParts {
  back?: ReactNode;
  landmark: ReactNode;
  front?: ReactNode;
  moon?: boolean;
  /** Points lumineux à refléter dans l'eau : [x, largeur, teinte]. */
  lights?: [number, number, 'warm' | 'cool'][];
}

interface Ctx {
  rng: Rng;
  glow: string;
  gradWarm: string;
  gradBody: string;
  gradBeam: string;
  /** Dégradés radiaux et éclairages (identifiants uniques par dessin). */
  g: { halo: string; haloCool: string; mist: string; lit: string; litWarm: string; adobe: string; glass: string; steel: string };
}

// ---------------------------------------------------------------------------
// Briques communes
// ---------------------------------------------------------------------------
const delay = (rng: Rng, max = 6) => cssVars({ '--d': `${(rng() * max).toFixed(2)}s` });

/** Fenêtres allumées au hasard dans un bâtiment. */
function windows(rng: Rng, x: number, y: number, w: number, h: number, density = 0.35, key = '') {
  const out: ReactNode[] = [];
  for (let wy = y + 6; wy < y + h - 6; wy += 8) {
    for (let wx = x + 4; wx < x + w - 4; wx += 6) {
      if (rng() > density) continue;
      const warm = rng() > 0.35;
      out.push(<rect key={`${key}${wx}-${wy}`} x={wx} y={wy} width={2.4} height={3.2} fill={warm ? C.warm : C.cool} opacity={0.55 + rng() * 0.45} />);
    }
  }
  return out;
}

function Palm({ x, y = H, s = 1, flip = false }: { x: number; y?: number; s?: number; flip?: boolean }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${flip ? -s : s} ${s})`} fill={C.near}>
      <path d="M-2 0 C 0 -26, 6 -52, 14 -74 L 17 -73 C 10 -52, 4 -26, 3 0 Z" />
      <g transform="translate(15 -74)">
        <path d="M0 0 C -14 -10, -30 -8, -42 4 C -28 -2, -14 -1, 0 4 Z" />
        <path d="M0 0 C -6 -16, -22 -24, -36 -20 C -22 -16, -10 -8, 0 3 Z" />
        <path d="M0 0 C 8 -18, 24 -22, 38 -14 C 24 -12, 10 -6, 1 3 Z" />
        <path d="M0 0 C 14 -6, 30 -2, 40 12 C 28 4, 14 2, 0 4 Z" />
        <path d="M0 0 C 2 -14, 10 -26, 20 -30 C 12 -20, 6 -10, 1 2 Z" />
      </g>
    </g>
  );
}

function Tree({ x, y = H, s = 1, fill = C.near }: { x: number; y?: number; s?: number; fill?: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} fill={fill}>
      <rect x={-1.5} y={-14} width={3} height={14} />
      <circle cx={-7} cy={-18} r={9} />
      <circle cx={6} cy={-20} r={10} />
      <circle cx={0} cy={-28} r={10} />
    </g>
  );
}

/** Arbre de savane (couronne plate : karité, néré). */
function SavannaTree({ x, y = H, s = 1 }: { x: number; y?: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} fill={C.near}>
      <path d="M-2 0 L -1 -22 L -10 -30 L -8 -31 L 0 -25 L 7 -33 L 9 -32 L 2 -22 L 3 0 Z" />
      <ellipse cx={0} cy={-34} rx={28} ry={7} />
      <ellipse cx={-10} cy={-38} rx={14} ry={5} />
      <ellipse cx={12} cy={-37} rx={13} ry={5} />
    </g>
  );
}

/** Rangée de maisons basses avec fenêtres allumées. */
function Houses({ rng, x0, x1, y = H, max = 22, fill = C.far }: { rng: Rng; x0: number; x1: number; y?: number; max?: number; fill?: string }) {
  const out: ReactNode[] = [];
  let x = x0;
  while (x < x1) {
    const w = 18 + rng() * 26;
    const h = 8 + rng() * max;
    const roof = rng() > 0.55;
    out.push(
      <g key={x}>
        <rect x={x} y={y - h} width={w} height={h} fill={fill} />
        {roof && <path d={`M${x - 2} ${y - h} L ${x + w / 2} ${y - h - 7} L ${x + w + 2} ${y - h} Z`} fill={fill} />}
        {rng() > 0.35 && <rect x={x + w * 0.3} y={y - h + 4} width={3} height={3.4} fill={C.warm} opacity={0.8} className="cs-lt" style={delay(rng)} />}
        {rng() > 0.6 && <rect x={x + w * 0.65} y={y - h + 4} width={3} height={3.4} fill={C.warm} opacity={0.6} />}
      </g>,
    );
    x += w + 2 + rng() * 8;
  }
  return <g>{out}</g>;
}

function Hills({ d, fill = C.far, opacity = 0.75 }: { d: string; fill?: string; opacity?: number }) {
  return <path d={d} fill={fill} opacity={opacity} />;
}

const FAR_HILLS = 'M0 292 C 90 262, 170 268, 250 256 C 330 246, 380 266, 470 258 C 560 250, 640 236, 730 252 C 820 266, 900 248, 1000 262 L 1000 292 Z';

function Beacon({ x, y, rng }: { x: number; y: number; rng: Rng }) {
  return <circle cx={x} cy={y} r={2.2} fill={C.red} className="cs-beacon" style={delay(rng, 2)} />;
}

/** Lampadaires d'une avenue (petites lueurs). */
function StreetLights({ points, rng }: { points: [number, number][]; rng: Rng }) {
  return (
    <g>
      {points.map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r={1.6} fill={C.warm} className="cs-lt" style={delay(rng)} />
      ))}
    </g>
  );
}

/** Traînées de phares autour d'un rond-point (pointillés qui défilent). */
function Traffic({ rx = 210, ry = 20, cy = 312 }: { rx?: number; ry?: number; cy?: number }) {
  const d = `M ${500 - rx} ${cy} A ${rx} ${ry} 0 0 0 ${500 + rx} ${cy}`;
  return (
    <g fill="none" strokeLinecap="round">
      <path d={d} stroke="rgba(255,255,255,0.08)" strokeWidth={6} />
      <path d={d} stroke={C.cool} strokeWidth={1.6} strokeDasharray="10 26" className="cs-trail" />
      <path d={d} stroke={C.red} strokeWidth={1.6} strokeDasharray="6 30" className="cs-trail cs-trail-rev" transform="translate(0 4)" />
    </g>
  );
}

// ---------------------------------------------------------------------------
// Scènes
// ---------------------------------------------------------------------------
function bridge({ rng, glow, g }: Ctx): SceneParts {
  const towers: [number, number, number][] = [
    [96, 30, 44], [130, 26, 66], [160, 36, 52], [200, 28, 88], [232, 40, 112], [276, 26, 140], [306, 46, 122],
    [356, 30, 150], [390, 40, 104], [434, 28, 128], [466, 36, 84], [506, 24, 62], [536, 30, 48],
    [742, 28, 52], [774, 36, 70], [814, 26, 46], [846, 34, 60], [884, 28, 40],
  ];
  const left = Array.from({ length: 9 }, (_, i) => 612 - i * 23);
  const right = Array.from({ length: 9 }, (_, i) => 668 + i * 23);
  return {
    back: (
      <g>
        <Hills d={FAR_HILLS} opacity={0.55} />
        <path d="M572 292 L 598 246 L 624 292 Z" fill={C.mid} />
        {towers.map(([x, w, h]) => (
          <g key={x}>
            <rect x={x} y={H - h} width={w} height={h} fill={`url(#${g.glass})`} />
            <rect x={x} y={H - h} width={w} height={1.4} fill="#8CC0FF" opacity={0.6} />
            <rect x={x + w - 2} y={H - h} width={2} height={h} fill="#8CC0FF" opacity={0.12} />
            <g filter={`url(#${glow})`}>{windows(rng, x, H - h, w, h, 0.42, `t${x}`)}</g>
            {h > 136 && (
              <>
                <rect x={x + w / 2 - 0.6} y={H - h - 16} width={1.2} height={16} fill={C.mid} />
                <Beacon x={x + w / 2} y={H - h - 17} rng={rng} />
              </>
            )}
          </g>
        ))}
      </g>
    ),
    landmark: (
      <g>
        {Array.from({ length: 8 }, (_, i) => (
          <rect key={i} x={98 + i * 118} y={266} width={6} height={H - 266} fill={C.near} />
        ))}
        <path d="M622 268 L 635 112 L 645 112 L 658 268 L 649 268 L 640 156 L 631 268 Z" fill={`url(#${g.lit})`} />
        <ellipse cx={640} cy={170} rx={70} ry={110} fill={`url(#${g.haloCool})`} />
        <path d="M635 112 L 645 112" stroke="#fff" strokeWidth={1.4} opacity={0.9} />
        <rect x={639.3} y={92} width={1.4} height={20} fill={C.cool} />
        <Beacon x={640} y={90} rng={rng} />
        <g stroke="rgba(214,232,255,0.78)" strokeWidth={0.9}>
          {left.map((x, i) => (
            <line key={`l${x}`} x1={637} y1={118 + i * 5} x2={x} y2={258} />
          ))}
          {right.map((x, i) => (
            <line key={`r${x}`} x1={643} y1={118 + i * 5} x2={x} y2={258} />
          ))}
        </g>
        <rect x={30} y={258} width={940} height={8} fill="#0B2038" />
        <rect x={30} y={257} width={940} height={1.6} fill="#FFE2A8" opacity={0.75} />
        <rect x={30} y={265} width={940} height={1} fill="#8CC0FF" opacity={0.35} />
        <g filter={`url(#${glow})`}>
          {Array.from({ length: 59 }, (_, i) => (
            <circle key={i} cx={36 + i * 16} cy={255.5} r={1.3} fill={C.warm} opacity={0.9} />
          ))}
        </g>
      </g>
    ),
    lights: [[640, 22, 'cool'], [220, 34, 'warm'], [300, 26, 'warm'], [380, 22, 'warm'], [470, 20, 'warm'], [790, 24, 'warm'], [860, 20, 'warm']],
    front: (
      <g filter={`url(#${glow})`}>
        <circle cx={0} cy={262} r={1.8} fill="#fff" className="cs-car" />
        <circle cx={0} cy={262} r={1.8} fill="#fff" className="cs-car cs-car-2" />
        <circle cx={0} cy={262} r={1.6} fill={C.red} className="cs-car cs-car-rev" />
        <circle cx={0} cy={262} r={1.6} fill={C.red} className="cs-car cs-car-rev cs-car-2" />
      </g>
    ),
  };
}

function basilica({ glow, gradWarm, g }: Ctx): SceneParts {
  const cols = (side: 1 | -1) =>
    Array.from({ length: 10 }, (_, j) => {
      const t = j / 9;
      const x = 500 + side * (118 + t * 236);
      const base = 286 + t * 4;
      const h = 30 + t * 16;
      return { x, base, h, w: 4 + t * 2.5 };
    });
  const wing = (side: 1 | -1) => {
    const c = cols(side);
    const top = c.map((p) => `${p.x.toFixed(1)} ${(p.base - p.h - 3).toFixed(1)}`).join(' L ');
    return (
      <g key={side}>
        <path d={`M ${top}`} stroke={C.mid} strokeWidth={5} fill="none" />
        <path d={`M ${top}`} stroke={C.warm} strokeWidth={0.8} fill="none" opacity={0.45} transform="translate(0 -2.5)" />
        {c.map((p) => (
          <rect key={p.x} x={p.x - p.w / 2} y={p.base - p.h} width={p.w} height={p.h} fill={`url(#${gradWarm})`} opacity={0.9} />
        ))}
      </g>
    );
  };
  const ribs = [446, 470, 500, 530, 554];
  return {
    back: (
      <g>
        <Hills d={FAR_HILLS} opacity={0.5} />
        {[90, 140, 190, 820, 870, 920].map((x, i) => (
          <Tree key={x} x={x} s={0.9 + (i % 3) * 0.15} fill={C.mid} />
        ))}
        <ellipse cx={500} cy={140} rx={230} ry={150} fill={`url(#${g.halo})`} />
      </g>
    ),
    landmark: (
      <g>
        {wing(-1)}
        {wing(1)}
        <rect x={418} y={222} width={164} height={70} fill="#3B2914" />
        <rect x={418} y={222} width={164} height={70} fill={`url(#${g.halo})`} />
        <path d="M410 224 L 500 200 L 590 224 Z" fill={C.mid} />
        <path d="M410 224 L 500 200 L 590 224" stroke={C.highlight} strokeWidth={1.2} fill="none" opacity={0.8} />
        {Array.from({ length: 8 }, (_, i) => (
          <rect key={i} x={426 + i * 20} y={228} width={5} height={60} fill={`url(#${gradWarm})`} />
        ))}
        <rect x={438} y={150} width={124} height={52} fill={C.mid} />
        {Array.from({ length: 11 }, (_, i) => (
          <rect key={i} x={442 + i * 11.4} y={154} width={3} height={44} fill={`url(#${gradWarm})`} opacity={0.85} />
        ))}
        <rect x={432} y={146} width={136} height={5} fill={C.mid} />
        <path d="M430 150 C 430 92, 468 66, 500 64 C 532 66, 570 92, 570 150 Z" fill={`url(#${g.litWarm})`} />
        <path d="M430 150 C 430 92, 468 66, 500 64 C 532 66, 570 92, 570 150" fill="none" stroke={C.highlight} strokeWidth={1.4} opacity={0.9} />
        <g stroke={C.shade} strokeWidth={0.9} fill="none" opacity={0.5}>
          {ribs.map((x) => (
            <path key={x} d={`M500 64 Q ${x + (x - 500) * 0.35} ${92} ${x} 150`} />
          ))}
        </g>
        <rect x={489} y={44} width={22} height={20} fill="#5A3E1E" />
        <g filter={`url(#${glow})`}>
          {[492, 498, 504].map((x) => (
            <rect key={x} x={x} y={48} width={3} height={12} fill={C.warm} opacity={0.9} />
          ))}
        </g>
        <ellipse cx={500} cy={44} rx={12} ry={6} fill={`url(#${g.litWarm})`} />
        <path d="M500 38 L 500 20 M 494 26 L 506 26" stroke="#fff" strokeWidth={1.6} opacity={0.85} filter={`url(#${glow})`} />
      </g>
    ),
    lights: [[500, 70, 'warm'], [330, 26, 'warm'], [670, 26, 'warm']],
    front: (
      <g>
        <Palm x={210} s={1.15} />
        <Palm x={798} s={1.05} flip />
      </g>
    ),
  };
}

function monument({ rng, glow, g }: Ctx): SceneParts {
  const ring = Array.from({ length: 26 }, (_, i) => {
    const a = Math.PI + (i / 25) * Math.PI;
    return [500 + Math.cos(a) * 150, 300 - Math.sin(a) * 9] as [number, number];
  });
  return {
    back: (
      <g>
        <Hills d={FAR_HILLS} opacity={0.4} />
        <Houses rng={rng} x0={20} x1={980} max={18} />
        {[70, 170, 300, 690, 830, 940].map((x) => (
          <Tree key={x} x={x} s={1.1} fill={C.mid} />
        ))}
        <ellipse cx={500} cy={190} rx={170} ry={150} fill={`url(#${g.halo})`} />
        <path d="M478 292 L 440 30 L 470 30 Z" fill="rgba(255,226,170,0.10)" className="cs-spot" />
        <path d="M522 292 L 530 30 L 560 30 Z" fill="rgba(255,226,170,0.10)" className="cs-spot cs-spot-rev" />
      </g>
    ),
    landmark: (
      <g>
        <rect x={426} y={278} width={148} height={14} fill="#1A2638" />
        <rect x={446} y={265} width={108} height={13} fill="#22324A" />
        <rect x={464} y={250} width={72} height={15} fill="#2C3E58" />
        <g fill={C.warm} opacity={0.7}>
          <rect x={426} y={277.5} width={148} height={1} />
          <rect x={446} y={264.5} width={108} height={1} />
          <rect x={464} y={249.5} width={72} height={1} />
        </g>
        <path d="M478 250 L 492 98 L 508 98 L 522 250 Z" fill={`url(#${g.litWarm})`} />
        <path d="M500 98 L 500 250" stroke={C.shade} strokeWidth={1} opacity={0.45} />
        <path d="M492 98 L 478 250 M 508 98 L 522 250" stroke={C.highlight} strokeWidth={0.9} opacity={0.8} />
        <rect x={485} y={92} width={30} height={6} fill={C.shade} />
        <g fill={`url(#${g.litWarm})`} stroke={C.highlight} strokeWidth={0.7} strokeOpacity={0.8}>
          <path d="M500 90 C 496 74, 497 62, 500 56 C 503 62, 504 74, 500 90 Z" />
          <circle cx={500} cy={52} r={4} />
          <path d="M499 68 C 482 52, 462 48, 442 56 C 462 60, 480 66, 498 76 Z" />
          <path d="M501 68 C 518 52, 538 48, 558 56 C 538 60, 520 66, 502 76 Z" />
        </g>
        <g filter={`url(#${glow})`}>
          {ring.map(([x, y]) => (
            <circle key={`${x.toFixed(0)}`} cx={x} cy={y} r={1.5} fill={C.warm} className="cs-lt" style={delay(rng)} />
          ))}
          <circle cx={478} cy={286} r={2.4} fill="#fff" opacity={0.9} />
          <circle cx={522} cy={286} r={2.4} fill="#fff" opacity={0.9} />
        </g>
      </g>
    ),
    front: (
      <g>
        <Traffic />
        <Palm x={250} y={318} s={1.2} />
        <Palm x={760} y={320} s={1.1} flip />
      </g>
    ),
  };
}

function port({ rng, glow, g }: Ctx): SceneParts {
  const steel = `url(#${g.steel})`;
  const crane = (c: number) => (
    <g key={c}>
      {/* Cônes des projecteurs sous la flèche */}
      <path d={`M${c - 92} 167 L ${c - 112} 268 L ${c - 62} 268 Z`} fill="rgba(255,214,150,0.08)" />
      <path d={`M${c + 40} 167 L ${c + 22} 268 L ${c + 70} 268 Z`} fill="rgba(255,214,150,0.08)" />
      <rect x={c - 32} y={196} width={6} height={H - 196} fill={steel} />
      <rect x={c + 26} y={196} width={6} height={H - 196} fill={steel} />
      <rect x={c - 34} y={192} width={68} height={6} fill={steel} />
      <rect x={c - 118} y={160} width={186} height={7} fill={steel} />
      <path d={`M${c - 26} 192 L ${c} 118 L ${c + 26} 192`} stroke="#4C78B0" strokeWidth={4} fill="none" />
      <path d={`M${c} 118 L ${c - 116} 160 M ${c} 118 L ${c + 64} 160`} stroke="#7FA6DA" strokeWidth={1.6} />
      <path d={`M${c - 118} 160 L ${c + 68} 160`} stroke="#B9D6FF" strokeWidth={1} opacity={0.8} />
      <rect x={c - 70} y={167} width={10} height={14} fill="#C9822F" />
      <line x1={c - 65} y1={181} x2={c - 65} y2={244} stroke="rgba(200,224,255,0.5)" strokeWidth={0.7} />
      <Beacon x={c} y={115} rng={rng} />
      <g filter={`url(#${glow})`}>
        {[-110, -92, -74, -40, 0, 40, 60].map((dx) => (
          <circle key={dx} cx={c + dx} cy={166} r={1.6} fill={C.warm} />
        ))}
      </g>
    </g>
  );
  const box = ['#B8434B', '#2E7FA6', '#C99B3A', '#3E5FA8', '#7A4F9A', '#3C8C6A'];
  const stack = (x0: number, cols: number, rows: number) =>
    Array.from({ length: cols * rows }, (_, i) => {
      const cx = x0 + (i % cols) * 27;
      const cy = H - 11 - Math.floor(i / cols) * 11;
      return <rect key={`${x0}-${i}`} x={cx} y={cy} width={26} height={10} fill={box[Math.floor(rng() * box.length)]} opacity={0.85} />;
    });
  return {
    back: (
      <g>
        <Hills d={FAR_HILLS} opacity={0.45} />
        {stack(560, 13, 3)}
        {stack(830, 6, 2)}
        <rect x={880} y={170} width={3} height={122} fill={C.mid} />
        <rect x={290} y={180} width={3} height={112} fill={C.mid} />
        <g filter={`url(#${glow})`}>
          <rect x={872} y={166} width={19} height={5} fill={C.warm} />
          <rect x={282} y={176} width={19} height={5} fill={C.warm} />
        </g>
      </g>
    ),
    landmark: (
      <g>
        {[420, 570, 720].map(crane)}
        <path d="M140 270 L 474 270 L 456 296 L 160 296 Z" fill="#0B1B2E" />
        <path d="M140 270 L 474 270" stroke="#9CC4FF" strokeWidth={1.2} opacity={0.75} />
        <path d="M150 282 L 466 282" stroke="#C23A44" strokeWidth={2} opacity={0.6} />
        {Array.from({ length: 22 }, (_, i) => {
          const x = 166 + (i % 11) * 22;
          const y = i < 11 ? 259 : 248;
          return <rect key={i} x={x} y={y} width={21} height={10} fill={box[(i * 3) % box.length]} />;
        })}
        <rect x={420} y={226} width={34} height={44} fill="#E9EEF6" />
        <rect x={414} y={222} width={46} height={6} fill="#C9D3E2" />
        <g filter={`url(#${glow})`}>{windows(rng, 420, 226, 34, 44, 0.6, 'ship')}</g>
        <Beacon x={437} y={218} rng={rng} />
      </g>
    ),
    lights: [[437, 30, 'warm'], [310, 18, 'warm'], [420, 18, 'warm'], [570, 22, 'warm'], [720, 22, 'warm'], [880, 18, 'warm']],
  };
}

function mosque({ rng, glow, g }: Ctx): SceneParts {
  const minaret = (x: number) => (
    <g key={x}>
      <rect x={x - 9} y={110} width={18} height={H - 110} fill={`url(#${g.litWarm})`} />
      <rect x={x - 13} y={198} width={26} height={5} fill={C.shade} />
      <rect x={x - 12} y={148} width={24} height={5} fill={C.shade} />
      <path d={`M${x - 9} 110 C ${x - 9} 96, ${x + 9} 96, ${x + 9} 110 Z`} fill="#2E7A5A" />
      <path d={`M${x} 98 L ${x} 86`} stroke={C.warm} strokeWidth={1.2} />
      <g filter={`url(#${glow})`}>
        <rect x={x - 13} y={197} width={26} height={1.2} fill={C.warm} />
        <rect x={x - 12} y={147} width={24} height={1.2} fill={C.warm} />
        <rect x={x - 2} y={120} width={4} height={10} rx={2} fill={C.warm} opacity={0.9} />
      </g>
    </g>
  );
  return {
    back: (
      <g>
        <Hills d={FAR_HILLS} opacity={0.45} />
        <Houses rng={rng} x0={30} x1={300} max={14} />
        <Houses rng={rng} x0={700} x1={980} max={14} />
        <ellipse cx={500} cy={200} rx={250} ry={140} fill={`url(#${g.halo})`} />
      </g>
    ),
    landmark: (
      <g>
        {minaret(338)}
        {minaret(662)}
        <rect x={372} y={212} width={256} height={80} fill={`url(#${g.litWarm})`} />
        <rect x={366} y={206} width={268} height={7} fill={C.shade} />
        <path d="M430 208 C 430 160, 462 140, 500 138 C 538 140, 570 160, 570 208 Z" fill="#2E7A5A" />
        <path d="M430 208 C 430 160, 462 140, 500 138 C 538 140, 570 160, 570 208 Z" fill={`url(#${g.haloCool})`} />
        <path d="M430 208 C 430 160, 462 140, 500 138 C 538 140, 570 160, 570 208" fill="none" stroke="#9FE3C2" strokeWidth={1.3} opacity={0.75} />
        <path d="M500 138 L 500 120" stroke={C.warm} strokeWidth={1.4} />
        <path d="M496 116 a 5 5 0 1 0 8 -2 a 4 4 0 1 1 -8 2" fill={C.warm} />
        {Array.from({ length: 7 }, (_, i) => {
          const x = 388 + i * 33;
          return <path key={i} d={`M${x} 280 L ${x} 238 C ${x} 228, ${x + 16} 228, ${x + 16} 238 L ${x + 16} 280 Z`} fill="#4A2C12" opacity={0.92} />;
        })}
      </g>
    ),
    front: (
      <g>
        <SavannaTree x={170} y={312} s={1.3} />
        <SavannaTree x={850} y={316} s={1.15} />
        <Palm x={250} y={320} s={0.95} />
      </g>
    ),
  };
}

function watertower({ rng, glow, g }: Ctx): SceneParts {
  const ring = Array.from({ length: 15 }, (_, i) => 430 + i * 10);
  return {
    back: (
      <g>
        <Hills d={FAR_HILLS} opacity={0.4} />
        <Houses rng={rng} x0={20} x1={980} max={26} />
        {[110, 230, 330, 690, 800, 910].map((x, i) => (
          <Tree key={x} x={x} s={1 + (i % 2) * 0.25} fill={C.mid} />
        ))}
        <rect x={790} y={150} width={2} height={142} fill={C.mid} />
        <Beacon x={791} y={148} rng={rng} />
      </g>
    ),
    landmark: (
      <g>
        <path d="M486 292 L 490 148 L 510 148 L 514 292 Z" fill={`url(#${g.lit})`} />
        <rect x={498.5} y={160} width={3} height={120} fill="#6F93C7" opacity={0.5} />
        <path d="M452 150 L 548 150 L 574 106 L 574 84 Q 500 66 426 84 L 426 106 Z" fill={`url(#${g.lit})`} />
        <ellipse cx={500} cy={120} rx={130} ry={120} fill={`url(#${g.haloCool})`} />
        <path d="M426 84 Q 500 66 574 84" fill="none" stroke="#fff" strokeWidth={1.2} opacity={0.85} />
        <path d="M426 106 L 574 106" stroke="#5F86BD" strokeWidth={1.2} opacity={0.7} />
        <g filter={`url(#${glow})`}>
          {ring.map((x) => (
            <circle key={x} cx={x} cy={110} r={1.5} fill={C.warm} className="cs-lt" style={delay(rng)} />
          ))}
        </g>
        <rect x={499} y={60} width={2} height={14} fill={C.mid} />
        <Beacon x={500} y={58} rng={rng} />
      </g>
    ),
    front: (
      <g>
        <StreetLights rng={rng} points={[[180, 304], [300, 300], [700, 300], [820, 304], [930, 310]]} />
        <Tree x={150} y={322} s={1.5} />
        <Palm x={860} y={326} s={1.15} flip />
      </g>
    ),
  };
}

function mountains({ rng, glow, g }: Ctx): SceneParts {
  return {
    moon: true,
    back: (
      <g>
        <path d="M0 292 L 0 230 L 80 196 L 150 222 L 230 170 L 300 206 L 360 180 L 430 214 L 600 200 L 680 160 L 760 196 L 840 168 L 920 204 L 1000 186 L 1000 292 Z" fill={C.far} opacity={0.6} />
        <path d="M0 292 L 0 262 L 120 236 L 220 252 L 300 230 L 400 256 L 620 254 L 720 226 L 820 248 L 900 236 L 1000 252 L 1000 292 Z" fill={C.mid} opacity={0.85} />
      </g>
    ),
    landmark: (
      <g>
        <ellipse cx={500} cy={284} rx={260} ry={40} fill={`url(#${g.halo})`} />
        <path d="M180 292 L 236 268 L 282 256 L 318 238 L 352 226 L 384 206 L 400 196 C 404 168, 414 138, 428 120 C 438 106, 452 98, 466 100 C 480 102, 490 114, 496 132 C 502 152, 504 172, 508 188 L 532 198 L 556 186 L 584 196 L 612 188 L 646 204 L 684 218 L 722 236 L 770 252 L 830 272 L 880 292 Z" fill="#0A1C31" />
        <path d="M466 100 C 480 102, 490 114, 496 132 C 502 152, 504 172, 508 188 L 532 198 L 556 186 L 584 196 L 612 188 L 646 204 L 684 218 L 722 236 L 770 252 L 830 272 L 880 292 L 520 292 C 500 240, 470 160, 466 100 Z" fill="#16355A" opacity={0.42} />
        <path d="M384 206 L 400 196 C 404 168, 414 138, 428 120 C 438 106, 452 98, 466 100 C 480 102, 490 114, 496 132 C 502 152, 504 172, 508 188 L 532 198 L 556 186 L 584 196 L 612 188 L 646 204" fill="none" stroke="#B9D6FF" strokeWidth={1.6} strokeLinejoin="round" opacity={0.85} />
        <g fill="none" stroke={C.rim} strokeLinecap="round" opacity={0.25}>
          <path d="M440 126 C 446 150, 446 172, 438 196" strokeWidth={1} />
          <path d="M478 112 C 486 138, 490 160, 490 184" strokeWidth={0.8} />
        </g>
        <g fill="#04101B">
          {Array.from({ length: 30 }, (_, i) => (
            <circle key={i} cx={200 + i * 22} cy={290 - Math.max(0, 26 - Math.abs(i - 13) * 2.4)} r={10 + (i % 3) * 2.5} />
          ))}
        </g>
        <g filter={`url(#${glow})`}>
          {Array.from({ length: 34 }, (_, i) => (
            <circle key={i} cx={300 + rng() * 420} cy={280 + rng() * 12} r={1 + rng() * 0.8} fill={rng() > 0.3 ? C.warm : C.cool} className="cs-lt" style={delay(rng)} />
          ))}
        </g>
      </g>
    ),
    front: (
      <g>
        <ellipse cx={300} cy={252} rx={300} ry={26} fill={`url(#${g.mist})`} className="cs-mist" />
        <ellipse cx={720} cy={238} rx={280} ry={22} fill={`url(#${g.mist})`} className="cs-mist cs-mist-rev" />
        <Tree x={90} y={318} s={1.6} />
        <Tree x={930} y={322} s={1.5} />
      </g>
    ),
  };
}

function obelisk({ rng, glow, g }: Ctx): SceneParts {
  return {
    back: (
      <g>
        <Hills d={FAR_HILLS} opacity={0.4} />
        <Houses rng={rng} x0={20} x1={980} max={20} />
        {[80, 200, 320, 690, 820, 940].map((x) => (
          <Tree key={x} x={x} s={1.05} fill={C.mid} />
        ))}
        <ellipse cx={500} cy={180} rx={200} ry={150} fill={`url(#${g.haloCool})`} />
      </g>
    ),
    landmark: (
      <g>
        <rect x={440} y={276} width={120} height={16} fill={C.near} />
        <rect x={462} y={258} width={76} height={18} fill={C.near} />
        <path d="M486 258 L 491 104 L 500 86 L 509 104 L 514 258 Z" fill={`url(#${g.lit})`} />
        <path d="M500 86 L 509 104 L 514 258" fill="none" stroke={C.rim} strokeWidth={0.9} opacity={0.6} />
        <path d="M491 104 L 486 258" fill="none" stroke={C.warm} strokeWidth={0.9} opacity={0.45} />
        <rect x={487} y={180} width={26} height={3} fill={C.warm} opacity={0.6} />
        {[430, 570].map((x) => (
          <g key={x}>
            <rect x={x - 1} y={236} width={2} height={56} fill={C.mid} />
            <circle cx={x} cy={234} r={3} fill={C.warm} filter={`url(#${glow})`} />
          </g>
        ))}
        <g stroke="rgba(175,207,255,0.5)" strokeWidth={1} fill="none" className="cs-jet">
          <path d="M470 262 Q 452 236, 436 262" />
          <path d="M530 262 Q 548 236, 564 262" />
        </g>
      </g>
    ),
    front: (
      <g>
        <Traffic rx={230} ry={22} cy={316} />
        <Palm x={230} y={322} s={1.2} />
        <Palm x={780} y={322} s={1.2} flip />
      </g>
    ),
  };
}

function sudanese({ rng, glow, g }: Ctx): SceneParts {
  const earth = `url(#${g.adobe})`;
  const lit = '#5A3218';
  const pinnacle = (x: number, top: number, w = 8) => (
    <path key={`${x}-${top}`} d={`M${x - w / 2} 292 L ${x - w / 2} ${top} L ${x} ${top - 14} L ${x + w / 2} ${top} L ${x + w / 2} 292 Z`} fill={earth} />
  );
  const torons = (x: number, from: number, to: number) =>
    Array.from({ length: Math.floor((to - from) / 14) }, (_, i) => (
      <line key={`${x}-${i}`} x1={x - 9} y1={from + i * 14} x2={x + 9} y2={from + i * 14} stroke={lit} strokeWidth={1.2} opacity={0.55} />
    ));
  return {
    back: (
      <g>
        <Hills d={FAR_HILLS} opacity={0.4} />
        <Houses rng={rng} x0={20} x1={330} max={14} />
        <Houses rng={rng} x0={680} x1={980} max={14} />
        <ellipse cx={500} cy={210} rx={260} ry={140} fill={`url(#${g.halo})`} />
      </g>
    ),
    landmark: (
      <g>
        <rect x={392} y={214} width={216} height={78} fill={earth} />
        {Array.from({ length: 9 }, (_, i) => pinnacle(404 + i * 24, 206))}
        <path d="M466 292 L 468 132 L 482 132 L 482 122 L 492 122 L 500 100 L 508 122 L 518 122 L 518 132 L 532 132 L 534 292 Z" fill={earth} />
        {pinnacle(404, 162, 26)}
        {pinnacle(596, 162, 26)}
        {torons(500, 140, 206)}
        {torons(404, 172, 206)}
        {torons(596, 172, 206)}
        <path d="M392 214 L 608 214" stroke="#FFE0B0" strokeWidth={1.2} opacity={0.8} />
        <g filter={`url(#${glow})`}>
          <path d="M488 292 L 488 262 C 488 248, 512 248, 512 262 L 512 292 Z" fill={C.amber} opacity={0.85} />
          {[430, 456, 544, 570].map((x) => (
            <rect key={x} x={x} y={240} width={6} height={12} rx={3} fill={C.amber} opacity={0.75} />
          ))}
        </g>
      </g>
    ),
    front: (
      <g>
        <Palm x={240} y={318} s={1.15} />
        <SavannaTree x={800} y={316} s={1.25} />
      </g>
    ),
  };
}

function fishing({ rng, glow, gradBeam, g }: Ctx): SceneParts {
  const boats: [number, number, number, string][] = [
    [270, 314, 1.3, '#B8323A'],
    [440, 330, 1.6, '#D9A43A'],
    [610, 318, 1.2, '#2F8F5B'],
    [770, 336, 1.7, '#B8323A'],
  ];
  return {
    moon: true,
    lights: [[634, 16, 'warm'], [436, 12, 'warm'], [606, 10, 'warm']],
    back: (
      <g>
        <Hills d="M0 292 C 80 270, 160 262, 260 270 C 330 276, 380 262, 450 266 L 520 292 Z" opacity={0.6} />
        {[150, 205, 270].map((x, i) => (
          <Palm key={x} x={x} s={0.95 + i * 0.12} />
        ))}
      </g>
    ),
    landmark: (
      <g transform="translate(-70 0)">
        <path d="M540 292 C 610 252, 690 232, 770 236 C 850 240, 920 262, 1000 274 C 1030 278, 1060 282, 1080 284 L 1080 292 Z" fill={C.near} />
        <path d="M690 240 L 697 152 L 711 152 L 718 240 Z" fill={`url(#${g.lit})`} />
        <path d="M694 200 L 714 200 L 715 212 L 693 212 Z M 696 172 L 712 172 L 713 182 L 695 182 Z" fill="#C23A44" />
        <rect x={690} y={146} width={28} height={6} fill="#2A4A74" />
        <rect x={695} y={130} width={18} height={16} fill={C.warm} filter={`url(#${glow})`} />
        <path d="M693 130 L 704 118 L 715 130 Z" fill={C.mid} />
      </g>
    ),
    front: (
      <g>
        <path d="M634 138 L 960 106 L 960 170 Z" fill={`url(#${gradBeam})`} className="cs-beam" />
        {boats.map(([x, y, s, color]) => (
          <g key={x} transform={`translate(${x} ${y}) scale(${s})`}>
            <g className="cs-boat" style={delay(rng, 3)}>
              <path d="M-46 -6 C -30 4, 30 4, 48 -8 L 44 -2 C 26 8, -28 8, -42 0 Z" fill={C.near} />
              <path d="M-44 -5 C -28 3, 28 3, 46 -7" stroke={color} strokeWidth={1.6} fill="none" opacity={0.85} />
              <line x1={-4} y1={-2} x2={-4} y2={-26} stroke={C.near} strokeWidth={1.4} />
              <circle cx={-4} cy={-27} r={1.6} fill={C.warm} filter={`url(#${glow})`} />
            </g>
          </g>
        ))}
      </g>
    ),
  };
}

const SCENES: Record<CityScene, (ctx: Ctx) => SceneParts> = {
  bridge,
  basilica,
  monument,
  port,
  mosque,
  watertower,
  mountains,
  obelisk,
  sudanese,
  fishing,
};

export function buildScene(scene: CityScene, ctx: Ctx): SceneParts {
  return SCENES[scene](ctx);
}

/** Petite ville sans dessin propre : quartiers et arbres génériques. */
export function genericScene(ctx: Ctx): SceneParts {
  const { rng } = ctx;
  return {
    back: <Hills d={FAR_HILLS} opacity={0.5} />,
    landmark: (
      <g>
        <Houses rng={rng} x0={40} x1={960} max={30} fill={C.mid} />
      </g>
    ),
    front: (
      <g>
        {[120, 300, 700, 880].map((x, i) => (i % 2 ? <Tree key={x} x={x} y={316} s={1.4} /> : <Palm key={x} x={x} y={320} s={1.1} flip={i > 1} />))}
      </g>
    ),
  };
}

/**
 * Generates the original, licence-free illustrations used by the demo dataset.
 * Deterministic: re-running produces byte-identical files.
 *
 *   node apps/web/scripts/generate-demo-images.mjs
 *
 * Output: apps/web/public/images/demo/{theme}-{n}.svg (3:2, 1200×800)
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const OUT = fileURLToPath(new URL('../public/images/demo/', import.meta.url));
const W = 1200;
const H = 800;

// ---------------------------------------------------------------------------
// Deterministic randomness
// ---------------------------------------------------------------------------
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const hash = (str) =>
  [...str].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0, 2166136261);

// ---------------------------------------------------------------------------
// Palettes: time-of-day moods shared by outdoor scenes
// ---------------------------------------------------------------------------
const MOODS = [
  {
    name: 'morning',
    sky: ['#cfe3f2', '#f6efe1'],
    sun: '#fff4d6',
    haze: '#e9eef3',
    far: '#9fb4c7',
    mid: '#6f8fa8',
    ink: '#28435d',
  },
  {
    name: 'midday',
    sky: ['#9cc8ea', '#e4f1fa'],
    sun: '#fffbea',
    haze: '#d6e6f2',
    far: '#86a7c2',
    mid: '#557d9f',
    ink: '#1d3a57',
  },
  {
    name: 'golden',
    sky: ['#f2c89b', '#fbeedd'],
    sun: '#fff1cf',
    haze: '#f3dcc3',
    far: '#c99b7f',
    mid: '#9c6f5c',
    ink: '#4a3027',
  },
  {
    name: 'dusk',
    sky: ['#5d6f9a', '#e9b9a0'],
    sun: '#ffd9b0',
    haze: '#b9a3b5',
    far: '#7d7698',
    mid: '#55557a',
    ink: '#24233d',
  },
  {
    name: 'overcast',
    sky: ['#b9c4cc', '#e8ecee'],
    sun: '#f4f6f7',
    haze: '#d4dadf',
    far: '#9aa7b1',
    mid: '#76858f',
    ink: '#36444e',
  },
  {
    name: 'evening',
    sky: ['#1f3150', '#7c6b8f'],
    sun: '#f7e7c4',
    haze: '#4d4f6e',
    far: '#3b4566',
    mid: '#2b3352',
    ink: '#121a2e',
  },
];

// ---------------------------------------------------------------------------
// Primitive helpers
// ---------------------------------------------------------------------------
const f = (n) => Math.round(n * 10) / 10;

function ridge(rand, { y, amp, steps, roughness = 0.5, base = H }) {
  const pts = [];
  for (let i = 0; i <= steps; i += 1) {
    const x = (W / steps) * i;
    const wobble = Math.sin(i * 1.3 + rand() * 2) * amp * roughness + (rand() - 0.5) * amp;
    pts.push([x, y + wobble]);
  }
  let d = `M0 ${base} L${pts.map(([x, py]) => `${f(x)} ${f(py)}`).join(' L')} L${W} ${base} Z`;
  return d;
}

function smoothHill(rand, { y, amp, base = H }) {
  const c1 = y - amp * (0.4 + rand() * 0.6);
  const c2 = y - amp * (0.2 + rand() * 0.6);
  return `M0 ${base} L0 ${f(y)} C ${f(W * 0.3)} ${f(c1)}, ${f(W * 0.6)} ${f(c2)}, ${W} ${f(y + (rand() - 0.5) * amp)} L${W} ${base} Z`;
}

const gradient = (id, [top, bottom], vertical = true) =>
  `<linearGradient id="${id}" x1="0" y1="0" x2="${vertical ? 0 : 1}" y2="${vertical ? 1 : 0}"><stop offset="0" stop-color="${top}"/><stop offset="1" stop-color="${bottom}"/></linearGradient>`;

function svg(title, defs, body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${title}">
<title>${title}</title>
<defs>${defs}</defs>
${body}
</svg>
`;
}

function house(x, y, s, { wall, roof, door, window: win }, style = 'pitched') {
  const w = 160 * s;
  const h = 90 * s;
  const parts = [];
  parts.push(`<rect x="${f(x)}" y="${f(y - h)}" width="${f(w)}" height="${f(h)}" fill="${wall}"/>`);
  if (style === 'gable') {
    // Cape Dutch style centre gable
    parts.push(
      `<path d="M${f(x - 6 * s)} ${f(y - h)} L${f(x + w + 6 * s)} ${f(y - h)} L${f(x + w * 0.5)} ${f(y - h - 46 * s)} Z" fill="${roof}"/>`,
    );
    parts.push(
      `<path d="M${f(x + w * 0.36)} ${f(y - h)} q ${f(w * 0.14)} ${f(-70 * s)} ${f(w * 0.28)} 0 Z" fill="${wall}"/>`,
    );
  } else if (style === 'thatch') {
    parts.push(
      `<path d="M${f(x - 18 * s)} ${f(y - h + 6 * s)} Q ${f(x + w / 2)} ${f(y - h - 90 * s)} ${f(x + w + 18 * s)} ${f(y - h + 6 * s)} Z" fill="${roof}"/>`,
    );
  } else if (style === 'flat') {
    parts.push(
      `<rect x="${f(x - 8 * s)}" y="${f(y - h - 10 * s)}" width="${f(w + 16 * s)}" height="${f(12 * s)}" fill="${roof}"/>`,
    );
  } else {
    parts.push(
      `<path d="M${f(x - 10 * s)} ${f(y - h)} L${f(x + w / 2)} ${f(y - h - 55 * s)} L${f(x + w + 10 * s)} ${f(y - h)} Z" fill="${roof}"/>`,
    );
  }
  parts.push(
    `<rect x="${f(x + w * 0.44)}" y="${f(y - 46 * s)}" width="${f(22 * s)}" height="${f(46 * s)}" fill="${door}"/>`,
  );
  for (const wx of [0.14, 0.7]) {
    parts.push(
      `<rect x="${f(x + w * wx)}" y="${f(y - h + 24 * s)}" width="${f(26 * s)}" height="${f(24 * s)}" fill="${win}"/>`,
    );
  }
  return parts.join('');
}

function sun(mood, rand) {
  const cx = 180 + rand() * 840;
  const cy = 110 + rand() * 120;
  const r = mood.name === 'evening' ? 34 : 54;
  return `<circle cx="${f(cx)}" cy="${f(cy)}" r="${r + 40}" fill="${mood.sun}" opacity="0.25"/><circle cx="${f(cx)}" cy="${f(cy)}" r="${r}" fill="${mood.sun}"/>`;
}

// ---------------------------------------------------------------------------
// Outdoor themes
// ---------------------------------------------------------------------------
const THEMES = {
  coast(rand, m, i) {
    const tableTop = i % 2 === 0;
    const parts = [];
    parts.push(`<rect width="${W}" height="${H}" fill="url(#sky)"/>`, sun(m, rand));
    if (tableTop) {
      parts.push(
        `<path d="M120 470 L250 330 L330 300 L800 296 L860 320 L1010 470 Z" fill="${m.far}"/>`,
      );
    } else {
      parts.push(
        `<path d="${ridge(rand, { y: 400, amp: 70, steps: 9, base: 520 })}" fill="${m.far}"/>`,
      );
    }
    parts.push(`<rect y="460" width="${W}" height="200" fill="url(#sea)"/>`);
    for (let k = 0; k < 7; k += 1) {
      const y = 490 + k * 22;
      parts.push(
        `<path d="M${f(rand() * 200)} ${y} q 60 -8 120 0 t 120 0" stroke="#ffffff" stroke-opacity="0.35" stroke-width="3" fill="none"/>`,
      );
    }
    parts.push(`<path d="M0 640 C 300 600, 700 620, 1200 590 L1200 800 L0 800 Z" fill="#ecd9b6"/>`);
    parts.push(`<path d="M0 700 C 400 660, 800 690, 1200 660 L1200 800 L0 800 Z" fill="#e2c79d"/>`);
    parts.push(
      house(
        760 - i * 40,
        640,
        1.1,
        { wall: '#fbf8f2', roof: m.ink, door: '#7a5a3a', window: '#9fc3d9' },
        'flat',
      ),
    );
    parts.push(
      `<rect x="80" y="610" width="6" height="90" fill="${m.ink}"/><path d="M50 612 l36 -40 l36 40 Z" fill="#c8553d"/>`,
    );
    return parts.join('');
  },
  city(rand, m) {
    const parts = [`<rect width="${W}" height="${H}" fill="url(#sky)"/>`, sun(m, rand)];
    for (const layer of [0, 1]) {
      let x = -20;
      const colour = layer === 0 ? m.far : m.mid;
      while (x < W) {
        const bw = 60 + rand() * 110;
        const bh = (layer === 0 ? 200 : 140) + rand() * (layer === 0 ? 260 : 220);
        const top = 620 - bh;
        parts.push(
          `<rect x="${f(x)}" y="${f(top)}" width="${f(bw)}" height="${f(bh + 200)}" fill="${colour}"/>`,
        );
        if (layer === 1) {
          for (let wy = top + 18; wy < 600; wy += 30) {
            for (let wx = x + 12; wx < x + bw - 16; wx += 24) {
              if (rand() > 0.35)
                parts.push(
                  `<rect x="${f(wx)}" y="${f(wy)}" width="10" height="14" fill="${m.sun}" opacity="${m.name === 'evening' ? 0.9 : 0.45}"/>`,
                );
            }
          }
        }
        x += bw + (layer === 0 ? 6 : 14);
      }
    }
    parts.push(`<rect y="620" width="${W}" height="180" fill="${m.ink}"/>`);
    parts.push(`<rect y="700" width="${W}" height="8" fill="#ffffff" opacity="0.25"/>`);
    for (let x = 60; x < W; x += 180) {
      parts.push(
        `<circle cx="${x}" cy="640" r="26" fill="#3f6b4f"/><rect x="${x - 3}" y="640" width="6" height="40" fill="#3b2a20"/>`,
      );
    }
    return parts.join('');
  },
  winelands(rand, m, i) {
    const parts = [`<rect width="${W}" height="${H}" fill="url(#sky)"/>`, sun(m, rand)];
    parts.push(`<path d="${ridge(rand, { y: 330, amp: 120, steps: 7 })}" fill="${m.far}"/>`);
    parts.push(`<path d="${smoothHill(rand, { y: 500, amp: 70 })}" fill="#8aa35a"/>`);
    parts.push(`<path d="${smoothHill(rand, { y: 580, amp: 50 })}" fill="#6f8c43"/>`);
    for (let k = 0; k < 14; k += 1) {
      const y = 600 + k * 16;
      parts.push(
        `<path d="M-20 ${y + 30} Q 600 ${y - 30} 1220 ${y + 20}" stroke="#4f6b2c" stroke-width="5" fill="none" stroke-dasharray="14 10" opacity="0.8"/>`,
      );
    }
    parts.push(
      house(
        420 + i * 30,
        560,
        1.4,
        { wall: '#fbf7ef', roof: '#5a4634', door: '#2f5a3e', window: '#3b4e5c' },
        'gable',
      ),
    );
    for (let k = 0; k < 3; k += 1) {
      const x = 180 + k * 70 + rand() * 30;
      parts.push(
        `<ellipse cx="${f(x)}" cy="520" rx="46" ry="60" fill="#3e5a2a"/><rect x="${f(x - 5)}" y="540" width="10" height="40" fill="#3b2a20"/>`,
      );
    }
    return parts.join('');
  },
  forest(rand, m) {
    const parts = [`<rect width="${W}" height="${H}" fill="url(#sky)"/>`, sun(m, rand)];
    parts.push(`<path d="${ridge(rand, { y: 380, amp: 90, steps: 8 })}" fill="${m.far}"/>`);
    const greens = ['#5e7f62', '#476b4c', '#33553a', '#24432c'];
    greens.forEach((g, layer) => {
      const baseY = 480 + layer * 70;
      for (let x = -40; x < W + 40; x += 46 + rand() * 30) {
        const h = 120 + rand() * 120 - layer * 10;
        parts.push(
          `<path d="M${f(x)} ${f(baseY + 40)} L${f(x + 30)} ${f(baseY - h)} L${f(x + 60)} ${f(baseY + 40)} Z" fill="${g}"/>`,
        );
      }
    });
    parts.push(`<rect y="720" width="${W}" height="80" fill="#1d3624"/>`);
    parts.push(
      house(520, 735, 1, { wall: '#8a5a3c', roof: '#3d2a1f', door: '#2b1d15', window: '#f4d58d' }),
    );
    return parts.join('');
  },
  mountain(rand, m, i) {
    const parts = [`<rect width="${W}" height="${H}" fill="url(#sky)"/>`, sun(m, rand)];
    parts.push(
      `<path d="${ridge(rand, { y: 300, amp: 160, steps: 6, roughness: 0.8 })}" fill="${m.far}"/>`,
    );
    // sandstone cliffs typical of the Maluti/Drakensberg foothills
    parts.push(
      `<path d="M0 520 L140 380 L300 360 L420 420 L560 330 L760 350 L900 300 L1200 420 L1200 800 L0 800 Z" fill="${i % 2 ? '#c99a62' : '#b8875a'}"/>`,
    );
    parts.push(
      `<path d="M0 520 L140 380 L300 360 L420 420 L560 330 L760 350 L900 300 L1200 420 L1200 450 L0 560 Z" fill="#a8744b" opacity="0.6"/>`,
    );
    parts.push(`<path d="${smoothHill(rand, { y: 600, amp: 60 })}" fill="#9aa65e"/>`);
    parts.push(`<path d="${smoothHill(rand, { y: 680, amp: 40 })}" fill="#7d8c45"/>`);
    parts.push(
      house(300 + i * 60, 680, 1.1, {
        wall: '#efe3cf',
        roof: '#6b4a32',
        door: '#3b2a20',
        window: '#f4d58d',
      }),
    );
    for (let k = 0; k < 5; k += 1) {
      const x = 700 + k * 80 + rand() * 30;
      parts.push(`<path d="M${f(x)} 690 L${f(x + 18)} 610 L${f(x + 36)} 690 Z" fill="#4e5f2e"/>`);
    }
    return parts.join('');
  },
  bushveld(rand, m, i) {
    const parts = [`<rect width="${W}" height="${H}" fill="url(#sky)"/>`, sun(m, rand)];
    parts.push(`<path d="${ridge(rand, { y: 470, amp: 30, steps: 10 })}" fill="${m.far}"/>`);
    parts.push(`<rect y="520" width="${W}" height="280" fill="#c9b27a"/>`);
    parts.push(`<path d="${smoothHill(rand, { y: 600, amp: 30 })}" fill="#b49a5c"/>`);
    for (let k = 0; k < 5; k += 1) {
      const x = 80 + k * 240 + rand() * 80;
      const y = 560 + rand() * 60;
      const s = 0.8 + rand() * 0.6;
      parts.push(
        `<path d="M${f(x)} ${f(y)} l${f(6 * s)} ${f(-70 * s)} l${f(6 * s)} ${f(70 * s)} Z" fill="#3b2a20"/>`,
      );
      parts.push(
        `<ellipse cx="${f(x + 6 * s)}" cy="${f(y - 74 * s)}" rx="${f(90 * s)}" ry="${f(18 * s)}" fill="#556b2f"/>`,
      );
    }
    parts.push(
      house(
        560 - i * 30,
        700,
        1.3,
        { wall: '#e9d8b5', roof: '#a07a3c', door: '#4a3424', window: '#4a3424' },
        'thatch',
      ),
    );
    parts.push(`<path d="M0 720 C 300 700, 900 740, 1200 710 L1200 800 L0 800 Z" fill="#a88a4f"/>`);
    return parts.join('');
  },
};

// ---------------------------------------------------------------------------
// Interiors
// ---------------------------------------------------------------------------
const INTERIOR_PALETTES = [
  // Cool, clean walls with the Wayfare palette as textile accents.
  {
    wall: '#eef0f3',
    floor: '#c9ab88',
    accent: '#4169e1',
    soft: '#e4e7ec',
    wood: '#8a6a4a',
    plant: '#4f7a4f',
  },
  {
    wall: '#eceeec',
    floor: '#ad957d',
    accent: '#2b2f36',
    soft: '#f3f4f2',
    wood: '#6e5137',
    plant: '#3d6b45',
  },
  {
    wall: '#eef2f8',
    floor: '#d3b894',
    accent: '#1e3a8a',
    soft: '#e3e9fd',
    wood: '#9a7350',
    plant: '#56804f',
  },
  {
    wall: '#edf0f7',
    floor: '#b39b84',
    accent: '#2f54d6',
    soft: '#f2f5ff',
    wood: '#7a5a40',
    plant: '#4c7650',
  },
  {
    wall: '#f2f2f0',
    floor: '#a08262',
    accent: '#5d6470',
    soft: '#f6f6f4',
    wood: '#5f4430',
    plant: '#47703f',
  },
  {
    wall: '#f1f3f6',
    floor: '#c2a888',
    accent: '#6f8ff0',
    soft: '#f2f5ff',
    wood: '#80603f',
    plant: '#3f6d4a',
  },
];

function windowView(x, y, w, h, m) {
  return `<rect x="${x - 10}" y="${y - 10}" width="${w + 20}" height="${h + 20}" fill="#ffffff"/>
<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#sky)"/>
<path d="M${x} ${y + h} L${x} ${y + h * 0.6} Q ${x + w * 0.4} ${y + h * 0.35} ${x + w} ${y + h * 0.65} L${x + w} ${y + h} Z" fill="${m.mid}"/>
<rect x="${x + w / 2 - 4}" y="${y}" width="8" height="${h}" fill="#ffffff"/>`;
}

const plant = (x, y, p) =>
  `<rect x="${x - 26}" y="${y - 60}" width="52" height="60" fill="${p.wood}"/><ellipse cx="${x}" cy="${y - 100}" rx="48" ry="60" fill="${p.plant}"/><ellipse cx="${x + 30}" cy="${y - 130}" rx="28" ry="40" fill="${p.plant}" opacity="0.85"/>`;

const INTERIORS = {
  bedroom(rand, p, m) {
    return [
      `<rect width="${W}" height="${H}" fill="${p.wall}"/>`,
      `<rect y="600" width="${W}" height="200" fill="${p.floor}"/>`,
      windowView(780, 140, 300, 260, m),
      `<rect x="250" y="300" width="460" height="230" rx="8" fill="${p.accent}"/>`,
      `<rect x="200" y="470" width="560" height="150" rx="10" fill="${p.soft}"/>`,
      `<rect x="200" y="520" width="560" height="100" fill="${p.accent}" opacity="0.18"/>`,
      `<rect x="270" y="420" width="180" height="70" rx="22" fill="#ffffff"/>`,
      `<rect x="510" y="420" width="180" height="70" rx="22" fill="#ffffff"/>`,
      `<rect x="200" y="620" width="18" height="40" fill="${p.wood}"/><rect x="742" y="620" width="18" height="40" fill="${p.wood}"/>`,
      `<rect x="90" y="500" width="90" height="110" fill="${p.wood}"/><path d="M110 420 h50 l14 60 h-78 Z" fill="${p.soft}"/><rect x="132" y="480" width="6" height="22" fill="#5b4a3a"/>`,
      plant(1060, 640, p),
      `<rect x="${f(300 + rand() * 40)}" y="140" width="160" height="110" fill="#ffffff"/><rect x="${f(312 + rand() * 40)}" y="152" width="136" height="86" fill="${m.far}"/>`,
    ].join('');
  },
  lounge(rand, p, m) {
    return [
      `<rect width="${W}" height="${H}" fill="${p.wall}"/>`,
      `<rect y="610" width="${W}" height="190" fill="${p.floor}"/>`,
      windowView(120, 130, 340, 300, m),
      `<ellipse cx="640" cy="700" rx="380" ry="60" fill="${p.soft}"/>`,
      `<rect x="440" y="420" width="520" height="140" rx="30" fill="${p.accent}"/>`,
      `<rect x="420" y="500" width="560" height="110" rx="26" fill="${p.accent}"/>`,
      `<rect x="470" y="460" width="140" height="70" rx="18" fill="${p.soft}"/><rect x="800" y="460" width="130" height="70" rx="18" fill="${p.soft}"/>`,
      `<rect x="560" y="640" width="260" height="22" rx="6" fill="${p.wood}"/><rect x="580" y="662" width="12" height="40" fill="${p.wood}"/><rect x="788" y="662" width="12" height="40" fill="${p.wood}"/>`,
      `<rect x="620" y="160" width="260" height="180" fill="#ffffff"/><circle cx="${f(700 + rand() * 80)}" cy="250" r="50" fill="${m.far}"/><rect x="636" y="290" width="228" height="34" fill="${m.mid}"/>`,
      plant(1080, 620, p),
    ].join('');
  },
  terrace(rand, p, m) {
    return [
      `<rect width="${W}" height="${H}" fill="url(#sky)"/>`,
      `<path d="${ridge(rand, { y: 420, amp: 70, steps: 8, base: 560 })}" fill="${m.far}"/>`,
      `<rect y="470" width="${W}" height="120" fill="${m.mid}"/>`,
      `<rect y="560" width="${W}" height="240" fill="${p.floor}"/>`,
      ...Array.from(
        { length: 8 },
        (_, k) =>
          `<rect y="${570 + k * 30}" width="${W}" height="3" fill="${p.wood}" opacity="0.5"/>`,
      ),
      `<rect x="80" y="610" width="520" height="130" rx="6" fill="#7cc0d8"/><rect x="80" y="610" width="520" height="16" fill="#ffffff" opacity="0.5"/>`,
      `<path d="M720 680 l180 -60 l20 0 l-10 70 Z" fill="${p.soft}"/><rect x="720" y="680" width="200" height="12" fill="${p.wood}"/>`,
      `<path d="M940 690 l170 -55 l20 0 l-10 70 Z" fill="${p.soft}"/><rect x="940" y="690" width="190" height="12" fill="${p.wood}"/>`,
      `<rect x="0" y="540" width="${W}" height="6" fill="#ffffff" opacity="0.7"/>`,
      ...Array.from(
        { length: 13 },
        (_, k) =>
          `<rect x="${k * 100}" y="500" width="6" height="46" fill="#ffffff" opacity="0.7"/>`,
      ),
      `<rect x="640" y="380" width="8" height="180" fill="${p.wood}"/><path d="M560 390 Q 644 330 728 390 Z" fill="${p.accent}"/>`,
    ].join('');
  },
  kitchen(rand, p, m) {
    return [
      `<rect width="${W}" height="${H}" fill="${p.wall}"/>`,
      `<rect y="640" width="${W}" height="160" fill="${p.floor}"/>`,
      windowView(470, 150, 260, 200, m),
      `<rect x="80" y="430" width="1040" height="30" fill="${p.soft}"/>`,
      `<rect x="80" y="460" width="1040" height="180" fill="${p.accent}"/>`,
      ...Array.from(
        { length: 6 },
        (_, k) =>
          `<rect x="${100 + k * 172}" y="480" width="150" height="140" fill="#ffffff" opacity="0.08"/><rect x="${160 + k * 172}" y="540" width="30" height="6" fill="#ffffff" opacity="0.6"/>`,
      ),
      `<rect x="80" y="130" width="330" height="150" fill="${p.wood}"/><rect x="790" y="130" width="330" height="150" fill="${p.wood}"/>`,
      `<rect x="830" y="390" width="70" height="40" rx="6" fill="#4b4b4b"/><rect x="240" y="380" width="40" height="50" fill="${p.plant}"/>`,
      ...[300, 600, 900].map(
        (x) =>
          `<rect x="${x - 2}" y="0" width="4" height="${f(80 + rand() * 20)}" fill="#3b3b3b"/><path d="M${x - 34} 110 h68 l-14 -30 h-40 Z" fill="${p.accent}"/>`,
      ),
    ].join('');
  },
};

// ---------------------------------------------------------------------------
// Write files
// ---------------------------------------------------------------------------
const COUNTS = {
  coast: 6,
  city: 6,
  winelands: 6,
  forest: 6,
  mountain: 6,
  bushveld: 6,
  bedroom: 6,
  lounge: 4,
  terrace: 4,
  kitchen: 3,
};
const LABELS = {
  coast: 'coastal',
  city: 'city',
  winelands: 'winelands',
  forest: 'forest',
  mountain: 'mountain',
  bushveld: 'bushveld',
  bedroom: 'bedroom',
  lounge: 'lounge',
  terrace: 'outdoor terrace',
  kitchen: 'kitchen',
};

mkdirSync(OUT, { recursive: true });
let written = 0;
for (const [theme, count] of Object.entries(COUNTS)) {
  for (let i = 1; i <= count; i += 1) {
    const rand = rng(hash(`${theme}-${i}`));
    const mood = MOODS[(i - 1 + Object.keys(COUNTS).indexOf(theme)) % MOODS.length];
    const defs = [gradient('sky', mood.sky), gradient('sea', ['#3f7fa6', '#1f5a80'])].join('');
    const title = `Illustration of a ${LABELS[theme]} scene (Wayfare demo artwork)`;
    const body = THEMES[theme]
      ? THEMES[theme](rand, mood, i)
      : INTERIORS[theme](rand, INTERIOR_PALETTES[(i - 1) % INTERIOR_PALETTES.length], mood);
    writeFileSync(`${OUT}${theme}-${i}.svg`, svg(title, defs, body));
    written += 1;
  }
}
console.info(`Wrote ${written} illustrations to ${OUT}`);

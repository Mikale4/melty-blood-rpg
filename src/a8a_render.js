
// =====================================================================
//  BATTLE RENDERER — a small 3D scene on a 2D canvas, seen from the side like the SNES Tales games.
//  World: ground plane y=0, battle axis x (allies -x, enemies +x), depth z (two staggered rows per side).
//  Camera: orbit (yaw/pitch/dist) around a target point, eased every frame; shots keep it near side-on.
// =====================================================================
// slots 0 and 2 stand in the front row (nearer the camera), 1 and 3 behind them
const SLOTS = [[80, -50], [140, 50], [204, -50], [264, 50]];
const BT = { on: false, cv: null, g: null, W: 0, H: 0, dpr: 1, clock: 0, speed: 1, paused: false, vus: new Map(),
  parts: [], bolts: [], floats: [], arcs: [], rings: [], nades: [], waits: [], tweens: [],
  cam: null, camT: null, camK: 3, home: null, shake: 0, env: null, B: null, target: null, active: null, picking: false,
  raf: 0, last: 0, orbit: false, shx: 0, shy: 0, K: null, flash: 0, flashCol: "#fff", letterbox: 0, letterboxT: 0 };

const v3 = {
  sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  norm: a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; },
  cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
  lerp: (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)],
};
function camBasis(c) {
  const cp = Math.cos(c.pitch), sp = Math.sin(c.pitch);
  const pos = [c.tx + c.dist * Math.sin(c.yaw) * cp, c.ty + c.dist * sp, c.tz - c.dist * Math.cos(c.yaw) * cp];
  const f = v3.norm(v3.sub([c.tx, c.ty, c.tz], pos));
  const r = v3.norm(v3.cross([0, 1, 0], f));
  const u = v3.cross(f, r);
  return { pos, f, r, u, focal: (BT.H / 2) / Math.tan(c.fov / 2), c };
}
function proj(K, x, y, z) {
  const dx = x - K.pos[0], dy = y - K.pos[1], dz = z - K.pos[2];
  const zc = dx * K.f[0] + dy * K.f[1] + dz * K.f[2];
  if (zc < 8) return null;
  const s = K.focal / zc;
  return [BT.W / 2 + (dx * K.r[0] + dy * K.r[1] + dz * K.r[2]) * s, BT.H / 2 - (dx * K.u[0] + dy * K.u[1] + dz * K.u[2]) * s, s, zc];
}

// ---------- environments ----------
const ENVS = {
  misaki:  { sky: ["#05040c", "#14102a", "#3a2a52"], ground: ["#2a2632", "#0e0c14"], grid: "#a9c8ff", gridA: .14, mount: null, fog: "#2a2042", stars: 1,
             bodies: [{ az: .5, el: .32, r: .07, c: "#f4ecd8" }], prop: "#2a2836", ring: "#ff4d6d", city: "#0c0a16", lit: "#ffd78a" },
  park:    { sky: ["#03060a", "#0e1a22", "#24364a"], ground: ["#1e2a22", "#0a100c"], grid: "#3a5a4a", gridA: .14, mount: ["#0e1a14", "#08100c"], fog: "#24364a", trees: 1, stars: 1,
             bodies: [{ az: -.3, el: .3, r: .06, c: "#eef2ff" }], prop: "#1e2a22", ring: "#a9c8ff" },
  mansion: { sky: ["#06030a", "#1a0c1e", "#3a1a34"], ground: ["#2a2024", "#100a0c"], grid: "#5a2a3a", gridA: .18, mount: ["#1a1018", "#0e080c"], fog: "#3a1a34", spires: 1, stars: 1,
             bodies: [{ az: .6, el: .26, r: .05, c: "#f1dca2" }], prop: "#2a2024", ring: "#ff4d6d" },
  alley:   { sky: ["#05040a", "#16101c", "#2e2030"], ground: ["#26222a", "#0c0a10"], grid: "#ff4d6d", gridA: .1, mount: ["#16121a", "#0c0a10"], fog: "#2e2030",
             bodies: [{ az: .2, el: .22, r: .045, c: "#f4ecd8" }], prop: "#26222a", ring: "#ff4d6d", city: "#100c14", lit: "#ffb070", low: 1 },
  wallachia: { sky: ["#0a0204", "#3a0610", "#8a1022"], ground: ["#2a0e14", "#0c0406"], grid: "#ff2a4a", gridA: .22, mount: ["#1a0408", "#0c0204"], fog: "#5a0a18", embers: 1,
             bodies: [{ az: 0, el: .3, r: .11, c: "#ff3b4c" }], prop: "#2a0e14", ring: "#ff2a4a", city: "#14040a", lit: "#ff6a6a", low: 1 },
  atlas:   { sky: ["#04040c", "#141838", "#3a3260"], ground: ["#6a5a4a", "#2a2018"], grid: "#c8a878", gridA: .12, mount: ["#3a2e2a", "#1e1814"], fog: "#3a3260", stars: 1,
             bodies: [{ az: -.5, el: .34, r: .05, c: "#eef2ff" }], prop: "#4a3e30", ring: "#c39bff" },
  school:  { sky: ["#0e0814", "#3a1a3a", "#c8604a"], ground: ["#3a3440", "#14101a"], grid: "#f1d07a", gridA: .12, mount: null, fog: "#c8604a",
             bodies: [{ az: .4, el: .1, r: .04, c: "#ffd0a0" }], prop: "#3a3440", ring: "#f1d07a", city: "#1a1220", lit: "#ffd78a", low: 1 },
  desert:  { sky: ["#2b1638", "#a8486a", "#f3a65a"], ground: ["#d6a56a", "#7a5232"], grid: "#5a3a1f", gridA: .18, mount: ["#8a4f39", "#5e3424"], fog: "#f3a65a",
             bodies: [{ az: .5, el: .2, r: .022, c: "#fff3c4" }, { az: .6, el: .16, r: .016, c: "#ffd27a" }], prop: "#9a6a44", ring: "#5a3a1f" },
  geonosis:{ sky: ["#2a0d0a", "#8a2e18", "#e07a3a"], ground: ["#c0603a", "#5a2414"], grid: "#3a1408", gridA: .2, mount: ["#7a2a18", "#4a160c"], fog: "#e07a3a",
             bodies: [{ az: -.4, el: .25, r: .09, c: "#f7c2a0", ring: 1 }], prop: "#8a3a22", ring: "#3a1408" },
  station: { sky: ["#020308", "#07101f", "#16233a"], ground: ["#2b3546", "#10151f"], grid: "#5fd4ff", gridA: .28, mount: null, fog: "#16233a", stars: 1,
             bodies: [{ az: -.55, el: .32, r: .14, c: "#3a5a8a", planet: 1 }], prop: "#3a4558", ring: "#5fd4ff" },
  snow:    { sky: ["#5d7fa6", "#a9c4e0", "#eaf3ff"], ground: ["#eef3fa", "#9fb3c8"], grid: "#7f95b0", gridA: .2, mount: ["#c9d7e8", "#93a9c4"], fog: "#eaf3ff",
             bodies: [], prop: "#b8c8dc", ring: "#7f95b0", snow: 1 },
  clouds:  { sky: ["#6a3a6a", "#e88ea6", "#ffd9a8"], ground: ["#d8c8b4", "#86766a"], grid: "#7a5a5a", gridA: .16, mount: ["#f6c6c6", "#e2a2b2"], fog: "#ffd9a8", clouds: 1,
             bodies: [{ az: .3, el: .1, r: .028, c: "#fff1d6" }], prop: "#c9b8a6", ring: "#7a5a5a" },
  forest:  { sky: ["#0d1a14", "#2f5a3e", "#86ad7a"], ground: ["#4a6a34", "#1c2a14"], grid: "#14200c", gridA: .2, mount: ["#1f3a24", "#122418"], fog: "#86ad7a", trees: 1,
             bodies: [{ az: -.2, el: .3, r: .02, c: "#f2f6d8" }], prop: "#3a2a1a", ring: "#14200c" },
  temple:  { sky: ["#1a1430", "#6a4a7a", "#f2c88a"], ground: ["#b8a488", "#5a4a3a"], grid: "#3a2e22", gridA: .25, mount: ["#5a4a6a", "#3a2e4a"], fog: "#f2c88a", spires: 1,
             bodies: [{ az: .7, el: .12, r: .026, c: "#ffe7b0" }], prop: "#8a7660", ring: "#3a2e22" },
  lava:    { sky: ["#070202", "#3a0a06", "#a2300e"], ground: ["#2a1c1a", "#0c0807"], grid: "#ff5a1a", gridA: .22, mount: ["#1a0806", "#0a0303"], fog: "#a2300e", embers: 1,
             bodies: [], prop: "#1e1412", ring: "#ff5a1a" },
  ruins:   { sky: ["#140808", "#4a1810", "#d0603a"], ground: ["#3a2c28", "#120c0a"], grid: "#ff7a3a", gridA: .13, mount: ["#2a1410", "#160a08"], fog: "#c8583a", embers: 1,
             bodies: [{ az: -.35, el: .14, r: .03, c: "#ffb08a" }], prop: "#3a2a24", ring: "#ff7a3a", city: "#1a0e0c", lit: "#ff8a3a", low: 1 },
  city:    { sky: ["#03050d", "#121638", "#3a2a6a"], ground: ["#1e2638", "#0b0f18"], grid: "#5fd4ff", gridA: .3, mount: null, fog: "#3a2a6a", stars: 1,
             bodies: [{ az: .55, el: .3, r: .03, c: "#e8f0ff" }], prop: "#2a3248", ring: "#5fd4ff", city: "#0c1226", lit: "#ffd76b" },
  slums:   { sky: ["#120e16", "#4a3440", "#c8925a"], ground: ["#5a4a3a", "#1c1610"], grid: "#2a2018", gridA: .2, mount: ["#3a2e28", "#241c18"], fog: "#c8925a",
             bodies: [{ az: .2, el: .08, r: .03, c: "#ffd8a0" }], prop: "#4a3a2a", ring: "#f2c14e", city: "#20181a", lit: "#ffb050", low: 1 },
  arena:   { sky: ["#05030d", "#1a0e36", "#3a1f6a"], ground: ["#2a2240", "#100c1c"], grid: "#b26bff", gridA: .3, mount: null, fog: "#3a1f6a", stars: 1,
             bodies: [{ az: .45, el: .3, r: .1, c: "#8a5ad8", planet: 1 }], prop: "#2e2648", ring: "#f2c14e" },
};
function buildEnv(name) {
  const E = { ...(ENVS[name] || ENVS.station), name };
  const rng = seeded(hash(name + "env"));
  E.mtn = [];
  for (let k = 0; k <= 64; k++) E.mtn.push(.01 + rng() * .022 + Math.pow(Math.sin(k * .37 + rng()), 4) * .05);
  E.mtn2 = [];
  for (let k = 0; k <= 64; k++) E.mtn2.push(.004 + rng() * .012 + Math.pow(Math.sin(k * .21 + 2), 2) * .018);
  E.starsArr = [];
  for (let k = 0; k < 90; k++) E.starsArr.push([rng() * 3 - 1.5, rng() * .7, rng() * 1.2 + .3]);
  E.bld = [];
  for (let k = 0; k < 80; k++) E.bld.push({ w: .5 + rng() * .9, h: (E.low ? .02 : .05) + rng() * (E.low ? .04 : .16), win: rng() });
  E.props = [];
  for (let k = 0; k < 9; k++) {
    const x = (rng() * 2 - 1) * 820, z = 330 + rng() * 520, w = 30 + rng() * 70, h = name === "station" || name === "arena" || name === "city" ? 60 + rng() * 160 : 20 + rng() * 70;
    E.props.push({ x, z, w, d: w * (.6 + rng() * .6), h: E.spires ? h * 2.2 : E.trees ? h * 2.5 : h, tree: !!E.trees });
  }
  for (let k = 0; k < 4; k++) E.props.push({ x: (k < 2 ? -1 : 1) * (560 + rng() * 260), z: -120 + rng() * 300, w: 40 + rng() * 40, d: 40, h: 20 + rng() * 40, tree: !!E.trees });
  return E;
}

// ---------- scene drawing ----------
function drawSky(K) {
  const { g, W, H } = BT, E = BT.env, c = K.c;
  const hy = H / 2 - Math.tan(c.pitch) * K.focal;
  const sg = g.createLinearGradient(0, Math.min(hy - H * .9, -10), 0, hy);
  sg.addColorStop(0, E.sky[0]); sg.addColorStop(.6, E.sky[1]); sg.addColorStop(1, E.sky[2]);
  g.fillStyle = sg; g.fillRect(-W, -H, W * 3, hy + H + 2);
  const az2x = az => { const a = az + c.yaw; return Math.abs(a) > 1.35 ? null : W / 2 + Math.tan(a) * K.focal; };
  const el2y = el => hy - Math.tan(el) * K.focal;
  if (E.stars) for (const [az, el, r] of E.starsArr) { const x = az2x(az); if (x == null) continue; g.fillStyle = `rgba(255,255,255,${.3 + .5 * Math.abs(Math.sin(az * 99 + BT.clock / 900))})`; g.fillRect(x, el2y(el), r, r); }
  for (const b of E.bodies) {
    const x = az2x(b.az); if (x == null) continue;
    const y = el2y(b.el), r = b.r * K.focal;
    if (b.planet) {
      const pg = g.createRadialGradient(x - r * .4, y - r * .4, r * .1, x, y, r);
      pg.addColorStop(0, shade(b.c, .35)); pg.addColorStop(.7, b.c); pg.addColorStop(1, shade(b.c, -.6));
      g.fillStyle = pg; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
    } else {
      const gl = g.createRadialGradient(x, y, 0, x, y, r * 3.2);
      gl.addColorStop(0, b.c); gl.addColorStop(.3, b.c + "88"); gl.addColorStop(1, b.c + "00");
      g.fillStyle = gl; g.beginPath(); g.arc(x, y, r * 3.2, 0, 7); g.fill();
      circ(g, x, y, r, "#fffdf4");
      if (b.ring) { g.strokeStyle = "#ffffff55"; g.lineWidth = 2; g.beginPath(); g.ellipse(x, y, r * 1.9, r * .45, -.3, 0, 7); g.stroke(); }
    }
  }
  if (E.clouds) {
    g.fillStyle = "#ffffff55";
    for (let k = 0; k < 7; k++) { const x = az2x(-1.1 + k * .36 + Math.sin(BT.clock / 9000 + k) * .03); if (x == null) continue; const y = el2y(.06 + (k % 3) * .05); g.beginPath(); g.ellipse(x, y, K.focal * .12, K.focal * .025, 0, 0, 7); g.fill(); }
  }
  const ridge = (arr, col, scale) => {
    g.fillStyle = col; g.beginPath(); g.moveTo(-W, hy + 2);
    for (let k = 0; k <= 64; k++) { const az = -1.6 + k * .05; const x = az2x(az); if (x == null) continue; g.lineTo(x, el2y(arr[k] * scale)); }
    g.lineTo(W * 2, hy + 2); g.closePath(); g.fill();
  };
  if (E.mount) { ridge(E.mtn, E.mount[0], 1); }
  if (E.city) {
    for (let k = 0; k < E.bld.length; k++) {
      const b = E.bld[k], x = az2x(-1.7 + k * .043); if (x == null) continue;
      const w = K.focal * .036 * b.w, h = K.focal * b.h, y = hy - h;
      g.fillStyle = E.city; g.fillRect(x, y, w, h + 2);
      if (b.win > .25) { g.fillStyle = E.lit; g.globalAlpha = .55; for (let wy = y + 4; wy < hy - 3; wy += 6) for (let wx = x + 2; wx < x + w - 2; wx += 5) if (((wx * 7 + wy * 13 + k) % 5) < 2) g.fillRect(wx, wy, 1.6, 2); g.globalAlpha = 1; }
    }
  }
  if (E.mount) ridge(E.mtn2, E.mount[1], 1);
  if (E.spires) {
    g.fillStyle = E.mount[1];
    for (let k = 0; k < 5; k++) { const x = az2x(-.8 + k * .4); if (x == null) continue; const w = K.focal * .025, h = K.focal * (.18 + (k % 2) * .08); g.beginPath(); g.moveTo(x - w, hy); g.lineTo(x - w * .6, hy - h); g.lineTo(x, hy - h - w * 2); g.lineTo(x + w * .6, hy - h); g.lineTo(x + w, hy); g.fill(); }
  }
  // ground base
  const gg = g.createLinearGradient(0, hy, 0, H);
  gg.addColorStop(0, E.fog); gg.addColorStop(.06, E.ground[0]); gg.addColorStop(1, E.ground[1]);
  g.fillStyle = gg; g.fillRect(-W, hy, W * 3, H * 2);
  return hy;
}
function seg3(K, a, b, col, w, alpha) {
  let pa = proj(K, ...a), pb = proj(K, ...b);
  if (!pa && !pb) return;
  if (!pa || !pb) {
    // clip to near plane by bisection
    let lo = 0, hi = 1, inA = !!pa;
    for (let k = 0; k < 14; k++) { const m = (lo + hi) / 2, p = proj(K, ...v3.lerp(a, b, m)); if (!!p === inA) lo = m; else hi = m; }
    const m = inA ? lo : hi, p = proj(K, ...v3.lerp(a, b, m));
    if (!p) return;
    if (inA) pb = p; else pa = p;
  }
  const g = BT.g; g.globalAlpha = alpha; g.strokeStyle = col; g.lineWidth = w;
  g.beginPath(); g.moveTo(pa[0], pa[1]); g.lineTo(pb[0], pb[1]); g.stroke(); g.globalAlpha = 1;
}
function drawGround(K) {
  const E = BT.env, g = BT.g;
  for (let x = -900; x <= 900; x += 90) seg3(K, [x, 0, -700], [x, 0, 900], E.grid, 1, E.gridA);
  for (let z = -700; z <= 900; z += 90) seg3(K, [-900, 0, z], [900, 0, z], E.grid, 1, E.gridA * (z > 400 ? .6 : 1));
  // battle circle
  for (const [r, w, a] of [[420, 2, .55], [440, 1, .35], [90, 1.5, .3]]) {
    g.strokeStyle = E.ring; g.lineWidth = w; g.globalAlpha = a; g.beginPath(); let started = false;
    for (let k = 0; k <= 64; k++) {
      const an = k / 64 * Math.PI * 2, p = proj(K, Math.cos(an) * r, 0, Math.sin(an) * r * .62);
      if (!p) { started = false; continue; }
      if (!started) { g.moveTo(p[0], p[1]); started = true; } else g.lineTo(p[0], p[1]);
    }
    g.stroke(); g.globalAlpha = 1;
  }
  if (E.embers) {
    g.strokeStyle = "#ff6a1a"; g.globalAlpha = .35 + .15 * Math.sin(BT.clock / 400);
    for (let k = 0; k < 6; k++) seg3(K, [-700 + k * 260, 0, 200 + (k % 3) * 120], [-560 + k * 260, 0, 260 + (k % 2) * 140], "#ff6a1a", 2, .5);
    g.globalAlpha = 1;
  }
}
function drawProp(K, p) {
  const E = BT.env, g = BT.g;
  if (p.tree) {
    const b = proj(K, p.x, 0, p.z), t = proj(K, p.x, p.h, p.z); if (!b || !t) return;
    const w = p.w * .25 * b[2];
    g.fillStyle = shade(E.prop, -.2); g.fillRect(b[0] - w / 2, t[1], w, b[1] - t[1]);
    g.fillStyle = shade(E.mount ? E.mount[0] : "#224422", .05);
    g.beginPath(); g.ellipse(t[0], t[1], p.w * .9 * t[2], p.w * .6 * t[2], 0, 0, 7); g.fill();
    return;
  }
  const { x, z, w, d, h } = p, x0 = x - w / 2, x1 = x + w / 2, z0 = z - d / 2, z1 = z + d / 2;
  const faces = [
    { pts: [[x0, 0, z0], [x1, 0, z0], [x1, h, z0], [x0, h, z0]], n: [0, 0, -1], s: 0 },
    { pts: [[x1, 0, z0], [x1, 0, z1], [x1, h, z1], [x1, h, z0]], n: [1, 0, 0], s: -.2 },
    { pts: [[x0, 0, z1], [x0, 0, z0], [x0, h, z0], [x0, h, z1]], n: [-1, 0, 0], s: -.3 },
    { pts: [[x1, 0, z1], [x0, 0, z1], [x0, h, z1], [x1, h, z1]], n: [0, 0, 1], s: -.35 },
    { pts: [[x0, h, z0], [x1, h, z0], [x1, h, z1], [x0, h, z1]], n: [0, 1, 0], s: .2 },
  ];
  for (const fc of faces) {
    const c = fc.pts[0], tc = v3.sub(K.pos, c);
    if (tc[0] * fc.n[0] + tc[1] * fc.n[1] + tc[2] * fc.n[2] <= 0) continue;
    const ps = fc.pts.map(q => proj(K, ...q)); if (ps.some(q => !q)) continue;
    g.fillStyle = shade(E.prop, fc.s); g.beginPath(); ps.forEach((q, i) => i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1])); g.closePath(); g.fill();
    if (BT.env.name === "station" || BT.env.name === "arena") { g.strokeStyle = BT.env.grid + "55"; g.lineWidth = 1; g.stroke(); }
  }
}
function groundEllipse(K, x, z, r, style, fill, lw = 2, rot = 0, dash) {
  const g = BT.g;
  if (fill) {
    const c = proj(K, x, 0, z), a = proj(K, x + r, 0, z), b = proj(K, x, 0, z + r);
    if (!c || !a || !b) return;
    g.save(); g.transform(a[0] - c[0], a[1] - c[1], b[0] - c[0], b[1] - c[1], c[0], c[1]);
    g.beginPath(); g.arc(0, 0, 1, 0, Math.PI * 2); g.fillStyle = style; g.fill(); g.restore();
    return;
  }
  g.save(); g.strokeStyle = style; g.lineWidth = lw;
  if (dash) { g.setLineDash(dash); g.lineDashOffset = -rot * 40; }
  g.beginPath(); let on = false;
  for (let k = 0; k <= 40; k++) {
    const an = k / 40 * Math.PI * 2 + rot, p = proj(K, x + Math.cos(an) * r, 0, z + Math.sin(an) * r);
    if (!p) { on = false; continue; }
    if (on) g.lineTo(p[0], p[1]); else g.moveTo(p[0], p[1]);
    on = true;
  }
  g.stroke(); g.restore();
}
function applyCamXform() {
  const g = BT.g;
  g.translate(BT.W / 2 + BT.shx, BT.H / 2 + BT.shy);
  g.rotate(BT.cam.roll || 0);
  g.translate(-BT.W / 2, -BT.H / 2);
}

// ---------- units ----------
function billboard(vu, lp) {
  const K = BT.K, bs = vu.bs;
  const lx = lp[0] * vu.face * bs, ly = -lp[1] * bs;
  return [vu.pos.x + K.r[0] * lx + K.u[0] * ly, vu.y + K.r[1] * lx + K.u[1] * ly, vu.pos.z + K.r[2] * lx + K.u[2] * ly];
}
const chestW = vu => billboard(vu, (vu.out && vu.out.chest) || [0, -60]);
const headW = vu => billboard(vu, (vu.out && vu.out.head) || [0, -92]);
const tipW = (vu, key = "tip") => billboard(vu, (vu.out && (vu.out[key] || vu.out.tip)) || [20, -60]);

function drawUnitShadow(K, vu) {
  if (vu.gone) return;
  const a = vu.dead ? .25 * (1 - clamp((BT.clock - vu.deathT) / 900, 0, 1)) : .38;
  const wide = ((vu.u.def.fig && vu.u.def.fig.bulk) || 1) * (vu.u.def.fig && (vu.u.def.fig.type === "slug" || vu.u.def.fig.type === "hound") ? 1.5 : 1);
  groundEllipse(K, vu.pos.x, vu.pos.z, 26 * vu.bs * wide, `rgba(0,0,0,${a})`, true);
}
function drawUnit(K, vu) {
  const g = BT.g;
  const q = proj(K, vu.pos.x, vu.y, vu.pos.z);
  if (!q) { vu.scr = null; return; }
  const [sx, sy, s] = q, sc = s * vu.bs;
  vu.scr = { x: sx, y: sy, s: sc };
  if (vu.gone) return;
  let alpha = 1, rot = 0;
  if (vu.spawnT != null) { const k = clamp((BT.clock - vu.spawnT) / 700, 0, 1); alpha = k; if (k >= 1) vu.spawnT = null; }
  if (vu.dead && vu.sp) { const k = clamp((BT.clock - vu.deathT - 1100) / 700, 0, 1); alpha = 1 - k; if (k >= 1) vu.gone = true; }
  else if (vu.dead) { const k = clamp((BT.clock - vu.deathT) / 1000, 0, 1); rot = -ease(Math.min(1, k * 1.6)) * 1.35; alpha = 1 - k; if (k >= 1) vu.gone = true; }
  if (vu.stealth) alpha *= .45;
  if (vu.sp) { sprDrawUnit(K, vu, alpha); drawUnitGlow(K, vu, sc); return; }
  const pose = vu.pose;
  const pt = pose.dur ? clamp((BT.clock - pose.t0) / pose.dur, 0, 1) : (BT.clock - pose.t0) / 1000;
  if (pose.dur && pt >= 1 && pose.back) { vu.pose = { name: "idle", t0: BT.clock, dur: 0 }; }
  g.save(); g.globalAlpha = alpha; g.translate(sx, sy);
  let face = vu.face;
  if (vu.spin) { const k = (BT.clock - vu.spin) / 140; face *= Math.cos(k * Math.PI) >= 0 ? 1 : -1; }
  if (rot) g.rotate(rot * vu.face);
  g.scale(sc * face, sc);
  vu.out = drawFigure(g, vu.u.def.fig, { name: vu.pose.name, t: pt, time: BT.clock / 1000, ph: vu.ph });
  g.restore();
  // saber trail
  if (vu.out.tipc && (vu.pose.name === "swing" || vu.spin)) {
    const tp = proj(K, ...tipW(vu)); if (tp) vu.trail.push([tp[0], tp[1], BT.clock]);
  }
  vu.trail = vu.trail.filter(p => BT.clock - p[2] < 130);
  if (vu.trail.length > 1) {
    g.save(); g.globalCompositeOperation = "lighter"; g.lineCap = "round"; g.lineJoin = "round";
    for (let k = 1; k < vu.trail.length; k++) {
      const a = vu.trail[k - 1], b = vu.trail[k], f = 1 - (BT.clock - b[2]) / 130;
      g.strokeStyle = vu.out.tipc || "#fff"; g.globalAlpha = f * .6; g.lineWidth = 10 * sc * f + 1;
      g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke();
    }
    g.restore();
  }
  drawUnitGlow(K, vu, sc);
}
// hit flash and aura glows around the chest
function drawUnitGlow(K, vu, sc) {
  const g = BT.g;
  if (vu.flash > BT.clock) {
    const k = (vu.flash - BT.clock) / 160, c = proj(K, ...chestW(vu));
    if (c) { g.save(); g.globalCompositeOperation = "lighter"; const gr = g.createRadialGradient(c[0], c[1], 0, c[0], c[1], 40 * sc);
      gr.addColorStop(0, `rgba(255,255,255,${.7 * k})`); gr.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = gr; g.fillRect(c[0] - 60 * sc, c[1] - 60 * sc, 120 * sc, 120 * sc); g.restore(); }
  }
  if (vu.aura > BT.clock) {
    const k = (vu.aura - BT.clock) / 900, c = proj(K, ...chestW(vu));
    if (c) { g.save(); g.globalCompositeOperation = "lighter"; const gr = g.createRadialGradient(c[0], c[1], 0, c[0], c[1], 70 * sc);
      gr.addColorStop(0, vu.auraCol + "aa"); gr.addColorStop(1, vu.auraCol + "00"); g.globalAlpha = Math.min(1, k * 1.5); g.fillStyle = gr; g.fillRect(c[0] - 80 * sc, c[1] - 90 * sc, 160 * sc, 180 * sc); g.restore(); }
  }
}
function drawOverhead(K, vu) {
  if (!vu.scr || vu.dead || vu.gone || vu.spawnT != null) return;
  const g = BT.g, hp = proj(K, ...billboard(vu, (vu.out && vu.out.top) || (vu.out && vu.out.head) || [0, -100])); if (!hp) return;
  const w = clamp(58 * vu.scr.s, 36, 64), x = hp[0] - w / 2 + 5, y = hp[1] - 18;
  const m = vu.u.max;
  g.fillStyle = "rgba(0,0,0,.65)"; g.fillRect(x - 1.5, y - 1.5, w + 3, 11);
  g.fillStyle = "#3a1218"; g.fillRect(x, y, w, 5);
  g.fillStyle = "#ff9c9c"; g.fillRect(x, y, w * clamp(vu.lag / m.hp, 0, 1), 5);
  g.fillStyle = vu.team === "A" ? "#3ddc84" : "#ff5a5a"; g.fillRect(x, y, w * clamp(vu.hp / m.hp, 0, 1), 5);
  if (vu.sh > 0) { g.fillStyle = "#c8ffd6"; g.fillRect(x, y, w * clamp(vu.sh / m.hp, 0, 1), 2); }
  g.fillStyle = "#0b2230"; g.fillRect(x, y + 6, w, 2.5);
  g.fillStyle = "#5fd4ff"; g.fillRect(x, y + 6, w * clamp(vu.tm / 100, 0, 1), 2.5);
  g.fillStyle = ELC[vu.u.el]; g.beginPath(); g.arc(x - 7, y + 4, 5, 0, 7); g.fill();
  g.strokeStyle = "#000"; g.lineWidth = 1.5; g.stroke();
  if (vu.u.boss) { g.fillStyle = "#ff4b4b"; g.font = "800 9px Saira Condensed, Arial Narrow, sans-serif"; g.textAlign = "left"; g.textBaseline = "bottom"; g.fillText("BOSS", x, y - 2); }
  const ef = vu.effs; if (!ef.length) return;
  const sz = 12, per = Math.max(1, Math.floor((w + 6) / (sz + 1)));
  g.font = "800 7.5px Saira Condensed, Arial Narrow, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
  ef.slice(0, per * 2).forEach(([id, st], i) => {
    const row = Math.floor(i / per), col = i % per, ex = x + col * (sz + 1), ey = y - 14 - row * (sz + 1) - (vu.u.boss ? 9 : 0);
    g.fillStyle = FX[id].b ? "#1d7a45" : "#a3242e"; g.fillRect(ex, ey, sz, sz - 1);
    g.fillStyle = "#fff"; g.fillText(FX[id].s + (st > 1 ? st : ""), ex + sz / 2, ey + sz / 2);
  });
}
// ---------- fx ----------
function addParts(p, n, o) {
  for (let k = 0; k < n; k++) {
    const sp = o.speed || 120, a = R() * Math.PI * 2, b = (R() - .3) * Math.PI;
    BT.parts.push({ p: [p[0] + (R() - .5) * (o.spread || 0), p[1] + (R() - .5) * (o.spread || 0), p[2] + (R() - .5) * (o.spread || 0)],
      v: [Math.cos(a) * Math.cos(b) * sp * R() + (o.vx || 0), Math.sin(b) * sp * R() + (o.vy || 0), Math.sin(a) * Math.cos(b) * sp * R()],
      g: o.g ?? 260, t0: BT.clock, life: (o.life || 500) * (.6 + R() * .6), size: o.size || 3, col: o.col || "#fff", add: o.add !== false, drag: o.drag || 0 });
  }
}
function drawParts(K, dt) {
  const g = BT.g, sdt = dt / 1000;
  BT.parts = BT.parts.filter(q => BT.clock - q.t0 < q.life);
  for (const q of BT.parts) {
    q.v[1] -= q.g * sdt; if (q.drag) { q.v[0] *= 1 - q.drag * sdt; q.v[1] *= 1 - q.drag * sdt; q.v[2] *= 1 - q.drag * sdt; }
    q.p[0] += q.v[0] * sdt; q.p[1] += q.v[1] * sdt; q.p[2] += q.v[2] * sdt;
    if (q.p[1] < 0) { q.p[1] = 0; q.v[1] *= -.3; }
    const s = proj(K, ...q.p); if (!s) continue;
    const k = 1 - (BT.clock - q.t0) / q.life;
    g.globalCompositeOperation = q.add ? "lighter" : "source-over";
    g.globalAlpha = Math.min(1, k * 1.6); g.fillStyle = q.col;
    const r = Math.max(.6, q.size * s[2] * (q.add ? .9 + k * .4 : 1));
    g.beginPath(); g.arc(s[0], s[1], r, 0, 7); g.fill();
  }
  g.globalAlpha = 1; g.globalCompositeOperation = "source-over";
}
function drawBolts(K) {
  const g = BT.g;
  for (const b of BT.bolts) {
    const k = clamp((BT.clock - b.t0) / b.dur, 0, 1);
    const head = v3.lerp(b.from, b.to, k), tail = v3.lerp(b.from, b.to, Math.max(0, k - b.len));
    const ph = proj(K, ...head), pt = proj(K, ...tail); if (!ph || !pt) continue;
    g.save(); g.globalCompositeOperation = "lighter"; g.lineCap = "round";
    const bw = b.w || 1;
    g.strokeStyle = b.col + "66"; g.lineWidth = (9 * ph[2] + 2) * bw; g.beginPath(); g.moveTo(pt[0], pt[1]); g.lineTo(ph[0], ph[1]); g.stroke();
    g.strokeStyle = b.col; g.lineWidth = (4 * ph[2] + 1) * bw; g.stroke();
    g.strokeStyle = "#fff"; g.lineWidth = (1.6 * ph[2] + .5) * bw; g.stroke();
    g.restore();
  }
  BT.bolts = BT.bolts.filter(b => BT.clock - b.t0 < b.dur);
  for (const n of BT.nades) {
    const k = clamp((BT.clock - n.t0) / n.dur, 0, 1), p = v3.lerp(n.from, n.to, k); p[1] += Math.sin(k * Math.PI) * n.h;
    const s = proj(K, ...p); if (!s) continue;
    circ(g, s[0], s[1], 4 * s[2] + 1, "#3a3f4a"); if (Math.floor(BT.clock / 80) % 2) circ(g, s[0], s[1] - 1, 1.6 * s[2] + .6, "#ff3b3b");
  }
  BT.nades = BT.nades.filter(n => BT.clock - n.t0 < n.dur);
}
function drawArcs(K) {
  const g = BT.g;
  BT.arcs = BT.arcs.filter(a => BT.clock - a.t0 < a.dur);
  for (const a of BT.arcs) {
    const p0 = proj(K, ...a.from()), p1 = proj(K, ...a.to()); if (!p0 || !p1) continue;
    g.save(); g.globalCompositeOperation = "lighter"; g.lineJoin = "round";
    for (let pass = 0; pass < 2; pass++) {
      const pts = [p0]; const n = 9, dx = p1[0] - p0[0], dy = p1[1] - p0[1], len = Math.hypot(dx, dy), nx = -dy / len, ny = dx / len;
      for (let k = 1; k < n; k++) { const off = (R() - .5) * len * .18; pts.push([p0[0] + dx * k / n + nx * off, p0[1] + dy * k / n + ny * off]); }
      pts.push(p1);
      g.strokeStyle = a.col + "77"; g.lineWidth = 7; g.beginPath(); pts.forEach((q, i) => i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1])); g.stroke();
      g.strokeStyle = "#fff"; g.lineWidth = 1.6; g.stroke();
    }
    g.restore();
  }
}
function drawRings(K) {
  BT.rings = BT.rings.filter(r => BT.clock - r.t0 < r.dur);
  for (const r of BT.rings) {
    const k = clamp((BT.clock - r.t0) / r.dur, 0, 1);
    BT.g.globalAlpha = 1 - k;
    groundEllipse(K, r.x, r.z, lerp(r.r0, r.r1, ease(k)), r.col, false, r.w || 3);
    BT.g.globalAlpha = 1;
  }
}
function drawFloats(K) {
  const g = BT.g;
  BT.floats = BT.floats.filter(f => BT.clock - f.t0 < f.dur);
  g.textAlign = "center"; g.textBaseline = "middle";
  for (const f of BT.floats) {
    const vu = BT.vus.get(f.uid); if (!vu) continue;
    const hp = proj(K, ...headW(vu)); if (!hp) continue;
    const k = (BT.clock - f.t0) / f.dur;
    const y = hp[1] - 40 - k * 46 - f.row * 15, x = hp[0] + f.dx;
    const big = f.cls === "crit" ? 27 : f.cls === "dmg" || f.cls === "prot" || f.cls === "heal" || f.cls === "dot" ? 21 : 13;
    const pop = k < .12 ? 1.35 - k * 2.9 : 1;
    g.globalAlpha = k > .75 ? (1 - k) / .25 : 1;
    g.font = `800 ${Math.round(big * pop)}px "Saira Condensed", "Arial Narrow", sans-serif`;
    g.lineWidth = 4; g.strokeStyle = "rgba(0,0,0,.85)"; g.strokeText(f.s, x, y);
    g.fillStyle = { crit: "#ffd34d", dmg: "#ff6b6b", prot: "#eef2fa", heal: "#5dfc9b", dot: "#d68bff", buff: "#57e08f", debuff: "#ff8a8a", txt: "#cfe3ff" }[f.cls] || "#fff";
    g.fillText(f.s, x, y);
  }
  g.globalAlpha = 1;
}
function floatText(uid, s, cls) {
  const recent = BT.floats.filter(f => f.uid === uid && BT.clock - f.t0 < 650).length;
  BT.floats.push({ uid, s, cls, t0: BT.clock, dur: cls === "crit" ? 1300 : 1100, row: recent * 1.25, dx: (recent % 2 ? 1 : -1) * Math.min(recent, 3) * 10 });
}

// ---------- frame ----------
function frame(now) {
  if (!BT.on) return;
  BT.raf = requestAnimationFrame(frame);
  const rdt = Math.min(50, now - (BT.last || now)); BT.last = now;
  const dt = BT.paused ? 0 : rdt * BT.speed;
  BT.clock += dt;
  // tweens + waits
  for (const tw of BT.tweens.slice()) { const k = clamp((BT.clock - tw.t0) / tw.dur, 0, 1); tw.fn(tw.ease ? ease(k) : k); if (k >= 1) { BT.tweens.splice(BT.tweens.indexOf(tw), 1); tw.res(); } }
  for (const w of BT.waits.slice()) if (BT.clock >= w.until) { BT.waits.splice(BT.waits.indexOf(w), 1); w.res(); }
  // camera
  const c = BT.cam, t = BT.camT;
  if (BT.orbit) { t.yaw += dt * .00028; }
  const kk = 1 - Math.exp(-dt / 1000 * BT.camK);
  for (const key of ["tx", "ty", "tz", "dist", "fov", "roll", "pitch", "yaw"]) c[key] += (t[key] - c[key]) * kk;
  BT.shake *= Math.exp(-dt / 1000 * 7); if (BT.shake < .3) BT.shake = 0;
  BT.shx = (R() - .5) * BT.shake; BT.shy = (R() - .5) * BT.shake;
  // bars ease
  for (const vu of BT.vus.values()) { vu.lag += (vu.hp - vu.lag) * (1 - Math.exp(-dt / 350)); vu.tm += (vu.tmT - vu.tm) * (1 - Math.exp(-dt / 120)); if (vu.sp) sprTick(vu, dt); }
  fxTick(dt);
  render(dt);
}
function render(dt) {
  const { g, W, H, dpr } = BT;
  const K = BT.K = camBasis(BT.cam);
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.fillStyle = "#000"; g.fillRect(0, 0, W, H);
  g.save(); applyCamXform();
  drawSky(K);
  drawGround(K);
  const props = BT.env.props.map(p => ({ p, d: proj(K, p.x, p.h / 2, p.z) })).filter(o => o.d).sort((a, b) => b.d[3] - a.d[3]);
  for (const o of props) drawProp(K, o.p);
  // haze over the far field
  const hy = H / 2 - Math.tan(BT.cam.pitch) * K.focal;
  const hz = g.createLinearGradient(0, hy - 2, 0, hy + H * .18); hz.addColorStop(0, BT.env.fog + "aa"); hz.addColorStop(1, BT.env.fog + "00");
  g.fillStyle = hz; g.fillRect(-W, hy - 2, W * 3, H * .18 + 2);
  // ground decals
  const vus = [...BT.vus.values()];
  for (const vu of vus) drawUnitShadow(K, vu);
  for (const vu of vus) if (!vu.dead && vu.spawnT == null) groundEllipse(K, vu.pos.x, vu.pos.z, 30 * vu.bs, ELC[vu.u.el] + "66", false, 1.6);
  if (BT.active && !BT.active.dead) groundEllipse(K, BT.active.home.x, BT.active.home.z, 34 * BT.active.bs, "#f2c14e", false, 3, BT.clock / 600);
  if (BT.picking && BT.B) for (const u of BT.B.targetable(BT.B.waiting || BT.B.units[0])) { const vu = BT.vus.get(u.uid); if (vu && vu !== BT.target) groundEllipse(K, vu.pos.x, vu.pos.z, 30 * vu.bs, "rgba(255,90,90,.45)", false, 1.5); }
  if (BT.target && !BT.target.dead && BT.picking) groundEllipse(K, BT.target.pos.x, BT.target.pos.z, 36 * BT.target.bs, "#ff4b4b", false, 3, BT.clock / 300, [10, 6]);
  drawRings(K);
  // units, far to near
  const order = vus.map(vu => ({ vu, d: proj(K, vu.pos.x, 40, vu.pos.z) })).filter(o => o.d).sort((a, b) => b.d[3] - a.d[3]);
  for (const o of order) drawUnit(K, o.vu);
  fxDraw(K);
  drawBolts(K);
  drawArcs(K);
  drawSlashes(K);
  drawParts(K, dt);
  if (BT.env.snow || BT.env.embers) weather(K);
  g.restore();
  // screen-space overlays
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.save(); applyCamXform();
  if (BT.letterboxT < .5) for (const o of order) drawOverhead(K, o.vu);
  drawFloats(K);
  g.restore();
  if (BT.flash > 0) { g.fillStyle = BT.flashCol; g.globalAlpha = BT.flash; g.fillRect(0, 0, W, H); g.globalAlpha = 1; BT.flash = Math.max(0, BT.flash - dt / 260); }
  BT.letterbox += (BT.letterboxT - BT.letterbox) * (1 - Math.exp(-dt / 140));
  if (BT.letterbox > .01) { const h = H * .085 * BT.letterbox; g.fillStyle = "#000"; g.fillRect(0, 0, W, h); g.fillRect(0, H - h, W, h); }
}
function weather(K) {
  const g = BT.g, n = 60, t = BT.clock / 1000;
  g.fillStyle = BT.env.snow ? "rgba(255,255,255,.75)" : "rgba(255,140,60,.8)";
  for (let k = 0; k < n; k++) {
    const x = ((k * 137) % 1600) - 800 + Math.sin(t + k) * 20, z = ((k * 241) % 1200) - 400;
    const y = BT.env.snow ? 300 - ((t * 40 + k * 23) % 300) : ((t * 30 + k * 31) % 260);
    const p = proj(K, x, y, z); if (!p) continue;
    g.fillRect(p[0], p[1], 2.2 * p[2] + .5, 2.2 * p[2] + .5);
  }
}

// ---------- timing helpers (battle clock, honours pause + speed) ----------
const bwait = ms => new Promise(res => BT.waits.push({ until: BT.clock + ms, res }));
const btween = (dur, fn, easeOn = true) => new Promise(res => BT.tweens.push({ t0: BT.clock, dur: Math.max(1, dur), fn, res, ease: easeOn }));
// figure poses; sprite units play the matching MBAACC animation (attacks pick their move in the director)
const POSE_ROLE = { idle: "idle", run: "run", victory: "win", guard: "guard" };
function setPose(vu, name, dur = 0, back = true) {
  vu.pose = { name, t0: BT.clock, dur, back };
  if (!vu.sp) return;
  if (name === "hit") { vu.hitAlt = !vu.hitAlt; sprPlay(vu, vu.hitAlt ? "hit" : "hit2"); }
  else if (POSE_ROLE[name] && vu.sp.role !== POSE_ROLE[name]) sprPlay(vu, POSE_ROLE[name], name === "victory" ? null : "idle");
}
function camTo(p, k = 3, cut = false) { Object.assign(BT.camT, p); BT.camK = k; if (cut) Object.assign(BT.cam, BT.camT); }
function camHome(k = 2.6) { BT.orbit = false; camTo({ ...BT.home }, k); }
function fitHome() {
  const land = BT.W / BT.H > 1.05;
  // side-on, a little above the field (portrait looks down a bit more to use the taller screen)
  const c = { tx: 0, ty: 60, tz: 0, yaw: 0, pitch: land ? .14 : .3, dist: 900, fov: land ? .56 : .6, roll: 0 };
  const pts = [];
  // pad each slot by half a sprite's width; 180 covers a standing sprite plus the overhead bars
  for (const s of SLOTS) for (const sx of [-1, 1]) for (const dx of [-50, 50]) pts.push([s[0] * sx + dx, 0, s[1]], [s[0] * sx + dx, 180, s[1]]);
  const topM = land ? 64 : 84, botM = land ? 112 : 140, sideM = 4;
  const fit = () => {
    let lo = 150, hi = 6000;
    for (let k = 0; k < 26; k++) {
      const mid = (lo + hi) / 2; c.dist = mid; const K = camBasis(c); let ok = true;
      for (const p of pts) { const q = proj(K, ...p); if (!q || q[0] < sideM || q[0] > BT.W - sideM || q[1] < topM || q[1] > BT.H - botM) { ok = false; break; } }
      if (ok) hi = mid; else lo = mid;
    }
    c.dist = hi;
  };
  for (let it = 0; it < 5; it++) {
    fit();
    const K = camBasis(c); let y0 = 1e9, y1 = -1e9, x0 = 1e9, x1 = -1e9;
    for (const p of pts) { const q = proj(K, ...p); if (!q) continue; y0 = Math.min(y0, q[1]); y1 = Math.max(y1, q[1]); x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); }
    const s = K.focal / c.dist;
    const dx = ((x0 + x1) / 2 - BT.W / 2) / s, dy = ((y0 + y1) / 2 - (topM + BT.H - botM) / 2) / s;
    c.tx += K.r[0] * dx - K.u[0] * dy; c.ty += K.r[1] * dx - K.u[1] * dy; c.tz += K.r[2] * dx - K.u[2] * dy;
  }
  fit();
  return c;
}

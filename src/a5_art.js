
// =====================================================================
//  FIGURE RENDERER — procedural full-body characters on canvas.
//  Local space: feet at (0,0), facing +x, a human is ~100 units tall.
// =====================================================================
const shadeCache = new Map();
function shade(hex, amt) {
  const key = hex + amt;
  let v = shadeCache.get(key);
  if (v) return v;
  let c = hex.replace("#", "");
  if (c.length === 3) c = c.split("").map(x => x + x).join("");
  const n = parseInt(c, 16);
  let r = n >> 16 & 255, gg = n >> 8 & 255, b = n & 255;
  if (amt < 0) { r *= 1 + amt; gg *= 1 + amt; b *= 1 + amt; }
  else { r += (255 - r) * amt; gg += (255 - gg) * amt; b += (255 - b) * amt; }
  v = `rgb(${r | 0},${gg | 0},${b | 0})`;
  shadeCache.set(key, v);
  return v;
}
const Dv = a => [Math.sin(a), Math.cos(a)];
const seg = (p, a, len) => { const d = Dv(a); return [p[0] + d[0] * len, p[1] + d[1] * len]; };
const lerp = (a, b, t) => a + (b - a) * t;
const ease = t => t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

function capsule(g, a, b, w, col, hi = true) {
  g.lineCap = "round";
  g.strokeStyle = col; g.lineWidth = w;
  g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke();
  if (hi && w > 3) {
    g.strokeStyle = shade(col.startsWith("#") ? col : "#888888", .28); g.lineWidth = w * .32;
    const o = w * .2;
    g.beginPath(); g.moveTo(a[0] + o * .4, a[1] - o); g.lineTo(b[0] + o * .4, b[1] - o); g.stroke();
  }
}
function circ(g, x, y, r, fill) { g.fillStyle = fill; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); }

const KEY = {
  wind:   { fu: 2.7, ff: 3.05, wa: 3.7, lean: -.1 },
  strike: { fu: 1.15, ff: 1.3, wa: .85, lean: .32 },
};
const BLADES = new Set(["saber", "saber2", "saber4", "dagger", "greatsword", "blackkeys", "claws"]);
function figPose(f, pose) {
  const w = f.w, T = pose.time || 0, k = clamp(pose.t || 0, 0, 1), name = pose.name || "idle";
  const P = { lean: .05, bt: -.18, bs: -.04, ft: .3, fs: .1, bu: -.15, bf: .25, fu: .55, ff: 1.45, wa: 2.35, bwa: -.5,
    bob: Math.sin(T * 2.4 + (pose.ph || 0)) * 1.1 };
  if (w === "pistol" || w === "pistols" || w === "rifle" || w === "bowcaster") {
    P.fu = .6; P.ff = 1.15; P.wa = 1.3;
    if (w === "rifle" || w === "bowcaster") { P.fu = .75; P.ff = 1.45; P.wa = 1.52; P.bu = .55; P.bf = 1.35; }
    if (w === "pistols") { P.bu = .35; P.bf = .95; P.bwa = 1.2; }
  }
  if (w === "none" || w === "arts") { P.fu = .25; P.ff = .55; }
  if (w === "arts") { P.fu = .45; P.ff = 1.15; }
  if (w === "staff" || w === "staffsaber") { P.fu = .6; P.ff = 1.25; P.wa = 2.0; }
  if (w === "rod" || w === "medrod") { P.fu = .5; P.ff = 1.05; P.wa = 2.95; }
  if (w === "spear") { P.fu = .7; P.ff = 1.3; P.wa = 2.55; }
  if (w === "book") { P.fu = .85; P.ff = 2.15; P.wa = 1.57; }
  if (w === "bow") { P.fu = .45; P.ff = .75; P.wa = 1.15; }
  if (w === "shield") { P.fu = 1.0; P.ff = 1.55; P.bu = .25; P.bf = .85; P.bwa = 2.4; }
  if (w === "claws") { P.fu = .7; P.ff = 1.5; P.wa = 1.7; P.bu = .3; P.bf = 1.1; }
  if (w === "broom") { P.fu = .55; P.ff = 1.15; P.wa = 2.75; }
  if (w === "pilebunker") { P.fu = 1.1; P.ff = 1.5; P.wa = 1.57; P.lean = .1; }
  if (w === "blackkeys") { P.fu = .5; P.ff = 1.2; P.wa = 2.2; }
  if (w === "greatsword") { P.wa = 2.6; }
  if (w === "saber2") { P.bu = .2; P.bf = .7; P.bwa = -.55; }
  if (w === "saber4") { P.bu = .5; P.bf = 1.2; P.bwa = 2.6; }
  if (f.type === "grievous") P.lean = .22;
  if (f.type === "yoda") P.lean = .12;
  const base = { ...P };
  const mix = (a, b, t) => { for (const key in b) P[key] = lerp(a[key] ?? P[key], b[key], t); };
  if (name === "run") {
    const s = Math.sin(T * 15);
    P.bt = -.55 * s; P.ft = .55 * s; P.bs = P.bt - .45 * (1 + s) / 2 - .1; P.fs = P.ft - .45 * (1 - s) / 2 - .1;
    P.lean = .28; P.bu = .6 * s; P.bf = P.bu + .8;
    if (w === "shield") { P.bu = .3; P.bf = .9; }
  } else if (name === "swing" && w === "spear") {
    // thrust: draw back, drive the point forward, recover
    const draw = { fu: .35, ff: .9, wa: 1.75, lean: -.06 }, lunge = { fu: 1.45, ff: 1.55, wa: 1.6, lean: .34 };
    if (k < .3) mix(base, draw, ease(k / .3));
    else if (k < .5) { mix(base, draw, 1); mix(draw, lunge, ease((k - .3) / .2)); }
    else { mix(base, lunge, 1); mix(lunge, base, ease((k - .5) / .5)); }
    P.ft = lerp(base.ft, .6, Math.sin(k * Math.PI)); P.bt = lerp(base.bt, -.45, Math.sin(k * Math.PI));
  } else if (name === "swing") {
    if (k < .35) mix(base, KEY.wind, ease(k / .35));
    else if (k < .55) { mix(base, KEY.wind, 1); mix(KEY.wind, KEY.strike, ease((k - .35) / .2)); }
    else { mix(base, KEY.strike, 1); mix(KEY.strike, base, ease((k - .55) / .45)); }
    P.ft = lerp(base.ft, .55, Math.sin(k * Math.PI)); P.bt = lerp(base.bt, -.4, Math.sin(k * Math.PI));
    if (w === "shield") {
      // the blade arm strikes from behind the shield while the shield shoves forward
      P.bu = P.fu; P.bf = P.ff; P.bwa = P.wa;
      const s = Math.sin(k * Math.PI); P.fu = lerp(base.fu, 1.35, s); P.ff = lerp(base.ff, 1.6, s); P.wa = base.wa;
    }
  } else if (name === "shoot") {
    const rec = k > .08 && k < .3 ? Math.sin((k - .08) / .22 * Math.PI) * .18 : 0;
    P.fu = 1.5 - rec; P.ff = 1.56 - rec * .5; P.wa = 1.57 - rec;
    if (w === "rifle" || w === "bowcaster") { P.bu = 1.15; P.bf = 1.6; }
    if (w === "pistols") { P.bu = 1.35 - rec; P.bf = 1.5; P.bwa = 1.57; }
    if (w === "bow") { const pull = k < .25 ? k / .25 : 0; P.bu = 1.5; P.bf = 1.57 + .9 * pull; P.wa = 1.57; }
    P.lean = .02 - rec * .3;
  } else if (name === "cast") {
    const s = Math.sin(clamp(k * 1.4, 0, 1) * Math.PI / 2);
    P.fu = lerp(P.fu, 1.55, s); P.ff = lerp(P.ff, 1.65, s); P.bu = lerp(P.bu, 1.3, s); P.bf = lerp(P.bf, 1.62, s);
    if (w === "rod" || w === "medrod") { P.fu = lerp(base.fu, 1.9, s); P.ff = lerp(base.ff, 2.6, s); P.wa = lerp(base.wa, 2.4, s); }
    if (w === "book") { P.fu = lerp(base.fu, 1.4, s); P.ff = lerp(base.ff, 1.8, s); }
    P.lean = lerp(P.lean, .14, s);
  } else if (name === "choke") {
    const s = Math.sin(clamp(k * 1.6, 0, 1) * Math.PI / 2);
    P.fu = lerp(P.fu, 1.85, s); P.ff = lerp(P.ff, 2.15, s); P.lean = lerp(P.lean, -.04, s);
  } else if (name === "throw") {
    if (k < .4) mix(base, { fu: -2.5, ff: -2.8, lean: -.12 }, ease(k / .4));
    else { mix(base, { fu: -2.5, ff: -2.8, lean: -.12 }, 1); mix({ fu: -2.5, ff: -2.8, lean: -.12 }, { fu: 1.6, ff: 1.5, lean: .3 }, ease(clamp((k - .4) / .25, 0, 1))); }
  } else if (name === "hit") {
    const s = 1 - k;
    P.lean = -.38 * s + base.lean * (1 - s); P.fu += .5 * s; P.bu -= .4 * s;
  } else if (name === "buff") {
    const s = Math.sin(clamp(k * 1.5, 0, 1) * Math.PI / 2);
    P.fu = lerp(P.fu, 2.3, s); P.ff = lerp(P.ff, 2.7, s); P.bu = lerp(P.bu, -2.2, s); P.bf = lerp(P.bf, -2.6, s); P.lean = lerp(P.lean, -.12, s);
    if (BLADES.has(w) || w === "staff" || w === "spear" || w === "rod" || w === "medrod") P.wa = lerp(P.wa, 3.1, s);
    if (w === "shield") { P.fu = lerp(base.fu, 1.2, s); P.ff = lerp(base.ff, 1.5, s); P.bu = lerp(base.bu, 2.6, s); P.bf = lerp(base.bf, 2.9, s); P.bwa = lerp(base.bwa, 3.1, s); }
  } else if (name === "victory") {
    P.fu = 2.85; P.ff = 3.05; P.wa = 3.12; P.lean = -.05;
    if (w === "shield") { P.fu = 1.1; P.ff = 1.5; P.bu = 2.85; P.bf = 3.05; P.bwa = 3.12; }
  }
  return P;
}

function drawFigure(g, f, pose) {
  const P = figPose(f, pose), H = f.h || 1, B = f.bulk || 1, T = pose.time || 0;
  const out = {};
  g.save(); g.scale(H, H);
  if (f.type === "r2") { drawR2(g, f, pose, out); g.restore(); return scaleOut(out, H); }
  if (f.type === "slug") { drawSlug(g, f, pose, out); g.restore(); return scaleOut(out, H); }
  if (f.type === "hound") { drawHound(g, f, pose, out); g.restore(); return scaleOut(out, H); }
  const thin = f.type === "b1" ? .55 : f.type === "grievous" ? .72 : f.type === "wookiee" ? 1.25 : f.slim ? .88 : 1;
  const skin = f.skin || "#e8c4a0";
  const armored = ["trooper", "mando", "vader", "kylo", "grievous", "b1", "robot"].includes(f.type);
  const glove = f.type === "wookiee" ? f.skin : armored ? (f.type === "trooper" && !f.chrome ? "#1d2026" : shade(f.col, -.45)) : f.glove || skin;
  const col = f.col || "#888888", col2 = f.col2 || col, boot = f.boot || shade(col2, -.45);
  // legs
  const hip0 = [0, -48];
  let bk = seg(hip0, P.bt, 24), bft = seg(bk, P.bs, 25), fk = seg(hip0, P.ft, 24), fft = seg(fk, P.fs, 25);
  const dy = -Math.max(bft[1], fft[1]);
  const sh = p => [p[0], p[1] + dy];
  const hip = sh(hip0); bk = sh(bk); bft = sh(bft); fk = sh(fk); fft = sh(fft);
  const S = [hip[0] + Math.sin(P.lean) * 32, hip[1] - Math.cos(P.lean) * 32 + P.bob];
  const HC = [S[0] + 3 + Math.sin(P.lean) * 4, S[1] - 13 * (f.hsz || 1) + 2];
  const shoulder = [S[0], S[1] + 3];
  const sway = Math.sin(T * 2.6 + (pose.ph || 0));
  // tail, wings and long hair sit behind everything else
  if (f.tail) drawTail(g, f, hip, sway);
  if (f.wings) drawWings(g, f, S, sway);
  if (f.type === "human" && (f.hs === "long" || f.hs === "pony" || f.hs === "twin" || f.hs === "braid")) drawBackHair(g, f, HC, S, sway);
  // cape / coat tails
  if (f.cape) {
    const wv = sway * 3;
    g.fillStyle = f.cape;
    g.beginPath(); g.moveTo(S[0] - 6, S[1] - 2); g.quadraticCurveTo(S[0] - 20, hip[1] - 6, S[0] - 24 + wv, f.coat ? hip[1] + 22 : -10);
    g.lineTo(S[0] - 4 + wv * .5, f.coat ? hip[1] + 26 : -8); g.quadraticCurveTo(hip[0] - 2, hip[1], S[0] + 6, S[1]); g.closePath(); g.fill();
  }
  // jetpack
  if (f.type === "mando") {
    g.fillStyle = shade(f.helm || col, -.15); g.beginPath(); g.roundRect ? g.roundRect(S[0] - 17, S[1] - 2, 9, 24, 4) : g.rect(S[0] - 17, S[1] - 2, 9, 24); g.fill();
    circ(g, S[0] - 12.5, S[1] - 4, 3, f.acc || "#888");
  }
  // back arm
  const be = seg(shoulder, P.bu, 17), bh = seg(be, P.bf, 16);
  capsule(g, shoulder, be, 7 * thin, shade(col, -.35), false);
  capsule(g, be, bh, 6.5 * thin, shade(col, -.35), false);
  if (f.w === "saber2" || f.w === "saber4") drawSaber(g, bh, P.bwa, f.sc, out, "tip2");
  if (f.w === "pistols") drawGun(g, bh, P.bwa, 11, out, "tip2");
  if (f.w === "shield") drawSaber(g, bh, P.bwa, f.sc, out, "tip", 36);
  circ(g, bh[0], bh[1], 3.3 * Math.max(thin, .8), shade(glove, -.25));
  // grievous extra arms
  if (f.w === "saber4") {
    const s2 = [S[0] - 2, S[1] + 8];
    const e2 = seg(s2, P.fu - .5, 15), h2 = seg(e2, P.ff - .3, 14);
    capsule(g, s2, e2, 5, shade(col2, -.3), false); capsule(g, e2, h2, 4.5, shade(col2, -.3), false);
    drawSaber(g, h2, P.wa - .6, "#5dfc6b", out, "tip3");
  }
  // back leg
  capsule(g, hip, bk, 9 * thin, shade(col2, -.3), false);
  capsule(g, bk, bft, 8 * thin, shade(col2, -.3), false);
  const bb = [lerp(bk[0], bft[0], .5), lerp(bk[1], bft[1], .5)];
  capsule(g, bb, bft, 8.5 * thin, shade(boot, -.25), false);
  g.fillStyle = shade(boot, -.3); g.beginPath(); g.ellipse(bft[0] + 3, bft[1] - 1.5, 6 * Math.max(thin, .7), 3, 0, 0, 7); g.fill();
  // torso
  const bw = (f.type === "b1" ? 5 : f.type === "grievous" ? 7 : 8) * B * thin, sw = (f.type === "b1" ? 6 : 11) * B * (f.slim ? .92 : 1);
  const tg = g.createLinearGradient(S[0] - sw, 0, S[0] + sw, 0);
  tg.addColorStop(0, shade(col, -.35)); tg.addColorStop(.6, col); tg.addColorStop(1, shade(col, .18));
  g.fillStyle = tg;
  g.beginPath();
  g.moveTo(hip[0] - bw, hip[1] + 2); g.lineTo(hip[0] + bw, hip[1] + 2);
  g.quadraticCurveTo(S[0] + sw + 3, lerp(hip[1], S[1], .55), S[0] + sw * .8, S[1]);
  g.lineTo(S[0] - sw * .9, S[1] - 1);
  g.quadraticCurveTo(S[0] - sw - 1, lerp(hip[1], S[1], .5), hip[0] - bw, hip[1] + 2);
  g.fill();
  if (f.vest) {
    g.fillStyle = f.vest; g.beginPath(); g.moveTo(hip[0] - bw, hip[1]); g.lineTo(hip[0] - 1, hip[1]); g.lineTo(S[0] - 2, S[1] + 1); g.lineTo(S[0] - sw * .9, S[1]); g.closePath(); g.fill();
  }
  if (f.trim) {
    // jacket zip line and collar in the operator's accent colour
    g.strokeStyle = f.trim; g.lineWidth = 1.6; g.lineCap = "round";
    g.beginPath(); g.moveTo(S[0] + sw * .55, S[1] + 2); g.quadraticCurveTo(S[0] + sw * .75, lerp(hip[1], S[1], .5), hip[0] + bw * .7, hip[1]); g.stroke();
    g.beginPath(); g.moveTo(S[0] - sw * .6, S[1] + .5); g.lineTo(S[0] + sw * .5, S[1] + 2.5); g.stroke();
  }
  if (f.type === "trooper" || f.type === "robot") {
    g.strokeStyle = f.chrome ? "#6b7280" : "#30343c"; g.lineWidth = 1.2;
    g.beginPath(); g.moveTo(S[0] - 6, S[1] + 9); g.lineTo(S[0] + 8, S[1] + 9); g.moveTo(hip[0] - 5, hip[1] - 7); g.lineTo(hip[0] + 6, hip[1] - 7); g.stroke();
    if (f.acc && f.acc !== "#1b1d22") { g.fillStyle = f.acc; g.fillRect(S[0] - 6, S[1] + 1, 4, 6); }
  }
  if (f.type === "vader") {
    g.fillStyle = "#2b2e35"; g.fillRect(S[0] - 1, S[1] + 6, 9, 7);
    g.fillStyle = "#ff3b3b"; g.fillRect(S[0] + 1, S[1] + 8, 2, 2); g.fillStyle = "#3fa7ff"; g.fillRect(S[0] + 4, S[1] + 8, 2, 2); g.fillStyle = "#4fd17f"; g.fillRect(S[0] + 1, S[1] + 11, 5, 1.2);
  }
  if (f.type === "wookiee" || f.type === "mando") {
    g.strokeStyle = f.acc || "#3a2a1a"; g.lineWidth = 3.5; g.beginPath(); g.moveTo(S[0] - sw * .7, S[1]); g.lineTo(hip[0] + bw * .9, hip[1] - 2); g.stroke();
  }
  // belt
  g.strokeStyle = f.acc || shade(col, -.4); g.lineWidth = 3.2; g.lineCap = "butt";
  g.beginPath(); g.moveTo(hip[0] - bw - .5, hip[1] - 1); g.lineTo(hip[0] + bw + .5, hip[1] - 1); g.stroke();
  // front leg
  capsule(g, hip, fk, 9 * thin, col2);
  capsule(g, fk, fft, 8 * thin, col2);
  const fb = [lerp(fk[0], fft[0], .5), lerp(fk[1], fft[1], .5)];
  capsule(g, fb, fft, 8.5 * thin, boot);
  g.fillStyle = boot; g.beginPath(); g.ellipse(fft[0] + 3, fft[1] - 1.5, 6 * Math.max(thin, .7), 3, 0, 0, 7); g.fill();
  if (f.type === "trooper" && !f.chrome) { g.fillStyle = "#30343c"; g.fillRect(fk[0] - 3, fk[1] - 1, 6, 2); }
  // robe / skirt
  if (f.robe) {
    const rg = g.createLinearGradient(-14, 0, 14, 0);
    rg.addColorStop(0, shade(col2, -.4)); rg.addColorStop(.65, col2); rg.addColorStop(1, shade(col2, .15));
    g.fillStyle = rg;
    const sw2 = sway * 1.5, hem = f.robe === "skirt" ? hip[1] + 20 : -3;
    g.beginPath(); g.moveTo(hip[0] - bw - 1, hip[1] - 3); g.lineTo(hip[0] + bw + 1, hip[1] - 3);
    if (f.robe === "skirt") { g.lineTo(hip[0] + bw + 9 + sw2, hem); g.lineTo(hip[0] - bw - 9 + sw2, hem); }
    else {
      g.quadraticCurveTo(Math.max(fft[0], hip[0]) + 10, -14, Math.max(fft[0], bft[0]) + 9 + sw2, hem);
      g.lineTo(Math.min(fft[0], bft[0]) - 10 + sw2, hem);
      g.quadraticCurveTo(Math.min(bft[0], hip[0]) - 10, -16, hip[0] - bw - 1, hip[1] - 3);
    }
    g.closePath(); g.fill();
    g.strokeStyle = shade(col2, -.5); g.lineWidth = 1; g.beginPath(); g.moveTo(hip[0] + 2, hip[1]); g.lineTo(hip[0] + 4 + sw2, hem - 1); g.stroke();
    if (f.trim) { g.strokeStyle = f.trim; g.lineWidth = 1.4; g.beginPath(); g.moveTo(hip[0] - bw - 8 + sw2, hem - 1); g.lineTo(hip[0] + bw + 8 + sw2, hem - 1); g.stroke(); }
  }
  if (f.apron) {
    // maid apron: bib on the chest, skirt panel down the front
    const ax = hip[0] + bw * .2, hem = f.robe === "robe" ? -6 : hip[1] + 18;
    g.fillStyle = f.apron;
    g.beginPath(); g.moveTo(S[0] + 1, S[1] + 5); g.lineTo(S[0] + sw * .75, S[1] + 6); g.lineTo(hip[0] + bw + 1, hip[1] + 1); g.lineTo(ax, hip[1] + 1); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(ax - 1, hip[1] - 1); g.lineTo(hip[0] + bw + 2, hip[1] - 1); g.lineTo(hip[0] + bw + 7 + sway, hem); g.lineTo(ax + 1 + sway, hem); g.closePath(); g.fill();
    g.strokeStyle = shade(f.apron, -.25); g.lineWidth = .8; g.stroke();
  }
  // neck + head
  if (f.type !== "b1") capsule(g, [S[0] + 1, S[1] + 1], [HC[0] - 1, HC[1] + 4], 6, armored ? shade(col, -.4) : shade(skin, -.12), false);
  else capsule(g, [S[0], S[1]], [HC[0] - 3, HC[1] + 6], 3, col2, false);
  const top = drawHead(g, f, HC, T, pose);
  out.head = HC; out.chest = [lerp(hip[0], S[0], .6), lerp(hip[1], S[1], .6)];
  out.top = [HC[0], HC[1] - (top || 12)];
  // front arm + weapon
  const fe = seg(shoulder, P.fu, 17), fh = seg(fe, P.ff, 16);
  if (f.w === "rifle" || f.w === "bowcaster") drawGun(g, fh, P.wa, 24, out, "tip", f.w === "bowcaster");
  if (f.w === "bow") drawBow(g, fh, P.wa, bh, pose.name === "shoot" && (pose.t || 0) < .25, f, out);
  capsule(g, shoulder, fe, 7.2 * thin, col);
  capsule(g, fe, fh, 6.6 * thin, col);
  if (f.cuff) capsule(g, [lerp(fe[0], fh[0], .7), lerp(fe[1], fh[1], .7)], fh, 7, f.cuff, false);
  if (f.type === "trooper" || f.type === "vader" || f.type === "kylo") capsule(g, [lerp(fe[0], fh[0], .55), lerp(fe[1], fh[1], .55)], fh, 6.8, glove, false);
  circ(g, fh[0], fh[1], 3.4 * Math.max(thin, .8), glove);
  out.hand = fh;
  switch (f.w) {
    case "saber": case "saber2": case "saber4": drawSaber(g, fh, P.wa, f.sc, out, "tip"); break;
    case "dagger": drawSaber(g, fh, P.wa, f.sc, out, "tip", 27); break;
    case "greatsword": drawSaber(g, fh, P.wa, f.sc, out, "tip", 64, 1.5); break;
    case "staffsaber": drawStaff(g, fh, P.wa, f.sc, out); break;
    case "staff": drawStaff(g, fh, P.wa, null, out); break;
    case "spear": drawSpear(g, fh, P.wa, f.sc, out); break;
    case "rod": case "medrod": drawRod(g, fh, P.wa, f.sc, out, f.w === "medrod", T); break;
    case "book": drawBook(g, fh, f, out, T); break;
    case "arts": drawArtsOrb(g, fh, f.sc, out, T); break;
    case "shield": drawShieldFront(g, fh, f); break;
    case "claws": drawClaws(g, fh, P.wa, f.sc, out, T); break;
    case "blackkeys": drawBlackKeys(g, fh, P.wa, f.sc, out); break;
    case "broom": drawBroom(g, fh, P.wa, f, out); break;
    case "pilebunker": drawPileBunker(g, fh, P.wa, f, out); break;
    case "pistol": case "pistols": drawGun(g, fh, P.wa, 11, out, "tip"); break;
  }
  if (!out.tip) out.tip = fh;
  g.restore();
  return scaleOut(out, H);
}
function scaleOut(out, H) { for (const k in out) if (Array.isArray(out[k])) out[k] = [out[k][0] * H, out[k][1] * H]; return out; }

function drawSaber(g, hand, a, color, out, key, len = 50, wide = 1) {
  const d = Dv(a), n = [-d[1], d[0]];
  const h0 = [hand[0] - d[0] * 4, hand[1] - d[1] * 4], h1 = [hand[0] + d[0] * 6, hand[1] + d[1] * 6];
  const tip = [hand[0] + d[0] * len, hand[1] + d[1] * len];
  bladeStroke(g, h1, tip, color, wide);
  capsule(g, [h1[0] - n[0] * 7 * wide, h1[1] - n[1] * 7 * wide], [h1[0] + n[0] * 7 * wide, h1[1] + n[1] * 7 * wide], 3, "#2a2430", false);
  capsule(g, h0, h1, 3.6, "#4a3430", false);
  out[key] = tip; out[key + "c"] = color;
}
// steel blade, tapered to a point, with a faint originium-tinted edge
function bladeStroke(g, a, b, color, wide = 1) {
  const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1, d = [dx / L, dy / L], n = [-d[1], d[0]];
  const w0 = 4.2 * wide, w1 = 3.2 * wide, nk = [b[0] - d[0] * 9 * wide, b[1] - d[1] * 9 * wide];
  g.save();
  g.beginPath();
  g.moveTo(a[0] + n[0] * w0, a[1] + n[1] * w0); g.lineTo(nk[0] + n[0] * w1, nk[1] + n[1] * w1); g.lineTo(b[0], b[1]);
  g.lineTo(nk[0] - n[0] * w1, nk[1] - n[1] * w1); g.lineTo(a[0] - n[0] * w0, a[1] - n[1] * w0); g.closePath();
  g.fillStyle = "#b9c1cc"; g.fill();
  g.strokeStyle = "#20242c"; g.lineWidth = 1.3; g.stroke();
  g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(nk[0], nk[1]); g.strokeStyle = "#e8eef6"; g.lineWidth = 1.2; g.stroke();
  g.globalCompositeOperation = "lighter"; g.lineCap = "round";
  g.beginPath(); g.moveTo(a[0] - n[0] * (w0 - 1), a[1] - n[1] * (w0 - 1)); g.lineTo(nk[0] - n[0] * (w1 - 1), nk[1] - n[1] * (w1 - 1)); g.lineTo(b[0], b[1]);
  g.strokeStyle = color + "88"; g.lineWidth = 2; g.stroke();
  g.restore();
}
function drawStaff(g, hand, a, color, out) {
  const d = Dv(a);
  if (!color) {
    capsule(g, [hand[0] - d[0] * 30, hand[1] - d[1] * 30], [hand[0] + d[0] * 32, hand[1] + d[1] * 32], 3.2, "#8a6a44", false);
    out.tip = [hand[0] + d[0] * 32, hand[1] + d[1] * 32]; return;
  }
  for (const s of [-1, 1]) {
    const h1 = [hand[0] + d[0] * 7 * s, hand[1] + d[1] * 7 * s], tip = [hand[0] + d[0] * 46 * s, hand[1] + d[1] * 46 * s];
    bladeStroke(g, h1, tip, color);
    if (s > 0) { out.tip = tip; out.tipc = color; } else { out.tip2 = tip; out.tip2c = color; }
  }
  capsule(g, [hand[0] - d[0] * 7, hand[1] - d[1] * 7], [hand[0] + d[0] * 7, hand[1] + d[1] * 7], 3.6, "#9aa0aa", false);
}
function drawSpear(g, hand, a, color, out) {
  const d = Dv(a), b0 = [hand[0] - d[0] * 30, hand[1] - d[1] * 30], s1 = [hand[0] + d[0] * 40, hand[1] + d[1] * 40], tip = [hand[0] + d[0] * 58, hand[1] + d[1] * 58];
  capsule(g, b0, s1, 3.4, "#2c2830", false);
  capsule(g, [hand[0] + d[0] * 30, hand[1] + d[1] * 30], s1, 4.2, shade(color, -.3), false);
  bladeStroke(g, s1, tip, color, .8);
  out.tip = tip; out.tipc = color;
}
function glowOrb(g, p, r, color, T) {
  const pr = r * (1 + Math.sin(T * 5) * .12);
  g.save(); g.globalCompositeOperation = "lighter";
  const gr = g.createRadialGradient(p[0], p[1], 0, p[0], p[1], pr * 3);
  gr.addColorStop(0, color + "cc"); gr.addColorStop(.4, color + "44"); gr.addColorStop(1, color + "00");
  g.fillStyle = gr; g.beginPath(); g.arc(p[0], p[1], pr * 3, 0, 7); g.fill();
  g.restore();
  circ(g, p[0], p[1], pr, shade(color, .55));
  circ(g, p[0] - pr * .3, p[1] - pr * .3, pr * .35, "#ffffff");
}
function drawRod(g, hand, a, color, out, med, T) {
  const d = Dv(a), n = [-d[1], d[0]], b0 = [hand[0] - d[0] * 26, hand[1] - d[1] * 26], hd = [hand[0] + d[0] * 30, hand[1] + d[1] * 30];
  capsule(g, b0, hd, 3, med ? "#d8dde6" : "#2a2733", false);
  const orb = [hand[0] + d[0] * 36, hand[1] + d[1] * 36];
  g.strokeStyle = med ? "#b8c4d2" : shade(color, -.2); g.lineWidth = 1.8;
  g.beginPath(); g.moveTo(hd[0] + n[0] * 6, hd[1] + n[1] * 6); g.quadraticCurveTo(orb[0] + n[0] * 9 + d[0] * 4, orb[1] + n[1] * 9 + d[1] * 4, orb[0] + d[0] * 6, orb[1] + d[1] * 6);
  g.moveTo(hd[0] - n[0] * 6, hd[1] - n[1] * 6); g.quadraticCurveTo(orb[0] - n[0] * 9 + d[0] * 4, orb[1] - n[1] * 9 + d[1] * 4, orb[0] + d[0] * 6, orb[1] + d[1] * 6); g.stroke();
  glowOrb(g, orb, 4.2, med ? "#7dffb0" : color, T);
  if (med) { g.strokeStyle = "#ffffff"; g.lineWidth = 1.6; g.beginPath(); g.moveTo(orb[0] - 2.5, orb[1]); g.lineTo(orb[0] + 2.5, orb[1]); g.moveTo(orb[0], orb[1] - 2.5); g.lineTo(orb[0], orb[1] + 2.5); g.stroke(); }
  out.tip = orb;
}
function drawBook(g, hand, f, out, T) {
  const x = hand[0] + 2, y = hand[1] - 3;
  g.save(); g.translate(x, y); g.rotate(-.25);
  g.fillStyle = shade(f.acc || "#6a4a8a", -.25); g.fillRect(-9, -6, 18, 12);
  g.fillStyle = "#efe8d8"; g.fillRect(-8, -5, 7.5, 10); g.fillRect(.5, -5, 7.5, 10);
  g.strokeStyle = "#9a8f7a"; g.lineWidth = .6;
  for (let k = -3; k <= 3; k += 2) { g.beginPath(); g.moveTo(-7, k); g.lineTo(-2, k); g.moveTo(1.5, k); g.lineTo(6.5, k); g.stroke(); }
  g.restore();
  const orb = [x + 2, y - 12 - Math.sin(T * 3) * 2];
  glowOrb(g, orb, 2.6, f.sc, T);
  out.tip = orb;
}
function drawArtsOrb(g, hand, color, out, T) {
  const orb = [hand[0] + 7, hand[1] - 3 + Math.sin(T * 4) * 1.5];
  glowOrb(g, orb, 3.6, color, T);
  out.tip = orb;
}
function drawBow(g, hand, a, back, drawn, f, out) {
  const d = Dv(a), n = [-d[1], d[0]], L = 23;
  const t1 = [hand[0] + n[0] * L - d[0] * 6, hand[1] + n[1] * L - d[1] * 6], t2 = [hand[0] - n[0] * L - d[0] * 6, hand[1] - n[1] * L - d[1] * 6];
  const mid = [hand[0] + d[0] * 5, hand[1] + d[1] * 5];
  g.strokeStyle = "#3a2e2a"; g.lineWidth = 3; g.lineCap = "round";
  g.beginPath(); g.moveTo(t1[0], t1[1]); g.quadraticCurveTo(mid[0] + n[0] * 14, mid[1] + n[1] * 14, mid[0], mid[1]); g.quadraticCurveTo(mid[0] - n[0] * 14, mid[1] - n[1] * 14, t2[0], t2[1]); g.stroke();
  g.strokeStyle = f.sc; g.lineWidth = 1.2; g.stroke();
  const nock = drawn ? back : [hand[0] - d[0] * 8, hand[1] - d[1] * 8];
  g.strokeStyle = "#e8e2d4"; g.lineWidth = .8; g.beginPath(); g.moveTo(t1[0], t1[1]); g.lineTo(nock[0], nock[1]); g.lineTo(t2[0], t2[1]); g.stroke();
  if (drawn) { g.strokeStyle = "#cfc6b4"; g.lineWidth = 1.4; g.beginPath(); g.moveTo(nock[0], nock[1]); g.lineTo(hand[0] + d[0] * 12, hand[1] + d[1] * 12); g.stroke(); }
  out.tip = [hand[0] + d[0] * 12, hand[1] + d[1] * 12];
}
function drawClaws(g, hand, a, color, out, T) {
  // vampire / True Ancestor claws: three glowing streaks off the fingertips
  const d = Dv(a), n = [-d[1], d[0]];
  g.save(); g.globalCompositeOperation = "lighter"; g.lineCap = "round";
  for (let k = -1; k <= 1; k++) {
    const b = [hand[0] + n[0] * k * 2.6 + d[0] * 2, hand[1] + n[1] * k * 2.6 + d[1] * 2], t = [b[0] + d[0] * 13 + n[0] * k * 1.5, b[1] + d[1] * 13 + n[1] * k * 1.5];
    g.strokeStyle = color + "66"; g.lineWidth = 4; g.beginPath(); g.moveTo(b[0], b[1]); g.lineTo(t[0], t[1]); g.stroke();
    g.strokeStyle = "#fff"; g.lineWidth = 1.1; g.stroke();
  }
  g.restore();
  out.tip = [hand[0] + d[0] * 15, hand[1] + d[1] * 15]; out.tipc = color;
}
function drawBlackKeys(g, hand, a, color, out) {
  // Ciel's Black Keys: three thin blades held between the fingers
  let tip = hand;
  for (const off of [-.28, 0, .28]) {
    const d = Dv(a + off), b = [hand[0] + d[0] * 4, hand[1] + d[1] * 4], t = [hand[0] + d[0] * 40, hand[1] + d[1] * 40];
    bladeStroke(g, b, t, color, .42);
    capsule(g, [b[0] - d[1] * 3, b[1] + d[0] * 3], [b[0] + d[1] * 3, b[1] - d[0] * 3], 1.6, "#2a2430", false);
    if (!off) tip = t;
  }
  out.tip = tip; out.tipc = color;
}
function drawBroom(g, hand, a, f, out) {
  const d = Dv(a), n = [-d[1], d[0]], b0 = [hand[0] - d[0] * 24, hand[1] - d[1] * 24], hd = [hand[0] + d[0] * 30, hand[1] + d[1] * 30];
  capsule(g, b0, hd, 2.6, "#8a6a44", false);
  g.fillStyle = "#c9a86a"; g.beginPath();
  g.moveTo(hd[0] + n[0] * 3, hd[1] + n[1] * 3); g.lineTo(hd[0] + d[0] * 13 + n[0] * 7, hd[1] + d[1] * 13 + n[1] * 7);
  g.lineTo(hd[0] + d[0] * 13 - n[0] * 7, hd[1] + d[1] * 13 - n[1] * 7); g.lineTo(hd[0] - n[0] * 3, hd[1] - n[1] * 3); g.closePath(); g.fill();
  g.strokeStyle = f.acc || "#c8203a"; g.lineWidth = 1.6; g.beginPath(); g.moveTo(hd[0] + n[0] * 3.5 + d[0] * 2, hd[1] + n[1] * 3.5 + d[1] * 2); g.lineTo(hd[0] - n[0] * 3.5 + d[0] * 2, hd[1] - n[1] * 3.5 + d[1] * 2); g.stroke();
  out.tip = [hd[0] + d[0] * 13, hd[1] + d[1] * 13]; out.tipc = f.sc;
}
function drawPileBunker(g, hand, a, f, out) {
  // Seventh Holy Scripture as a pile bunker clamped over the forearm
  const d = Dv(a), n = [-d[1], d[0]], c0 = [hand[0] - d[0] * 14, hand[1] - d[1] * 14], c1 = [hand[0] + d[0] * 12, hand[1] + d[1] * 12];
  g.lineCap = "butt"; g.strokeStyle = "#3a3f52"; g.lineWidth = 12; g.beginPath(); g.moveTo(c0[0], c0[1]); g.lineTo(c1[0], c1[1]); g.stroke();
  g.strokeStyle = f.acc || "#c8b06a"; g.lineWidth = 2; g.beginPath(); g.moveTo(c0[0] + n[0] * 5, c0[1] + n[1] * 5); g.lineTo(c1[0] + n[0] * 5, c1[1] + n[1] * 5); g.stroke();
  const tip = [hand[0] + d[0] * 30, hand[1] + d[1] * 30];
  bladeStroke(g, c1, tip, f.sc, .9);
  out.tip = tip; out.tipc = f.sc;
}
function drawShieldFront(g, hand, f) {
  const x = hand[0] + 4, y = hand[1] - 2, w = 15, h = 40;
  const gr = g.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
  gr.addColorStop(0, shade(f.shc || f.col, -.35)); gr.addColorStop(.55, f.shc || f.col); gr.addColorStop(1, shade(f.shc || f.col, .25));
  g.fillStyle = gr; g.beginPath();
  g.moveTo(x - w / 2, y - h * .5); g.lineTo(x + w / 2, y - h * .55); g.lineTo(x + w / 2, y + h * .38); g.quadraticCurveTo(x, y + h * .58, x - w / 2, y + h * .42); g.closePath(); g.fill();
  g.strokeStyle = "#1a1c22"; g.lineWidth = 1.5; g.stroke();
  g.strokeStyle = f.sc; g.lineWidth = 1.6; g.beginPath(); g.moveTo(x - w / 2 + 2.5, y - h * .44); g.lineTo(x + w / 2 - 2.5, y - h * .48); g.lineTo(x + w / 2 - 2.5, y + h * .32); g.stroke();
  circ(g, x + 1, y - 2, 3, f.trim || f.sc);
}
function drawGun(g, hand, a, len, out, key, bow) {
  const d = Dv(a), back = len > 15 ? 9 : 2;
  const b0 = [hand[0] - d[0] * back, hand[1] - d[1] * back], b1 = [hand[0] + d[0] * len, hand[1] + d[1] * len];
  g.lineCap = "butt";
  g.strokeStyle = "#23262d"; g.lineWidth = len > 15 ? 5 : 4.5; g.beginPath(); g.moveTo(b0[0], b0[1]); g.lineTo(b1[0], b1[1]); g.stroke();
  g.strokeStyle = "#4a505c"; g.lineWidth = 1.4; g.beginPath(); g.moveTo(b0[0], b0[1] - 1.5); g.lineTo(b1[0], b1[1] - 1.5); g.stroke();
  if (len > 15) { g.fillStyle = "#3a3f4a"; g.fillRect(hand[0] + d[0] * 4 - 2, hand[1] + d[1] * 4 - 5, 6, 3); }
  if (bow) {
    const p = [-d[1], d[0]], c = [hand[0] + d[0] * (len - 4), hand[1] + d[1] * (len - 4)];
    g.strokeStyle = "#8a6a44"; g.lineWidth = 2.2; g.beginPath(); g.moveTo(c[0] + p[0] * 9 - d[0] * 4, c[1] + p[1] * 9 - d[1] * 4); g.lineTo(c[0], c[1]); g.lineTo(c[0] - p[0] * 9 - d[0] * 4, c[1] - p[1] * 9 - d[1] * 4); g.stroke();
  }
  out[key] = [b1[0] + d[0] * 2, b1[1] + d[1] * 2];
}

// ---------- race features (Arknights: Feline, Lupo, Cautus, Sankta, Sarkaz…) ----------
function drawTail(g, f, hip, sw) {
  const hc = f.tailc || f.hair || "#3a2a1a", x = hip[0] - 6, y = hip[1] + 2;
  g.save(); g.lineCap = "round";
  if (f.tail === "cat") {
    g.strokeStyle = shade(hc, -.15); g.lineWidth = 3.6;
    g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x - 20, y + 14 + sw * 2, x - 24 + sw * 3, y - 10); g.stroke();
  } else if (f.tail === "bushy" || f.tail === "fox") {
    const n = f.tails || 1;
    for (let k = n - 1; k >= 0; k--) {
      const rot = .75 + k * .32 + sw * .08;
      g.save(); g.translate(x, y); g.rotate(rot);
      const gr = g.createLinearGradient(0, 0, 0, 30); gr.addColorStop(0, shade(hc, -.2)); gr.addColorStop(.75, hc); gr.addColorStop(1, f.tail === "fox" ? "#f4f1ea" : shade(hc, .2));
      g.fillStyle = gr; g.beginPath(); g.moveTo(-2, 0); g.quadraticCurveTo(-11, 14, -3, 30); g.quadraticCurveTo(9, 18, 3, 0); g.closePath(); g.fill();
      g.restore();
    }
  } else if (f.tail === "horse") {
    g.strokeStyle = shade(hc, -.1); g.lineWidth = 5;
    g.beginPath(); g.moveTo(x, y - 2); g.quadraticCurveTo(x - 14, y + 4, x - 12 + sw * 3, y + 30); g.stroke();
    g.strokeStyle = shade(hc, .15); g.lineWidth = 1.5; g.stroke();
  } else if (f.tail === "dragon") {
    g.fillStyle = shade(f.tailc || f.col, -.1);
    g.beginPath(); g.moveTo(x + 2, y - 5); g.quadraticCurveTo(x - 18, y + 8, x - 30 + sw * 2, y + 36); g.quadraticCurveTo(x - 10, y + 14, x + 3, y + 4); g.closePath(); g.fill();
  }
  g.restore();
}
function drawWings(g, f, S, sw) {
  const c = f.wingc || "#f2f4ff", x = S[0] - 6, y = S[1] + 5, flap = sw * .06;
  g.save(); g.translate(x, y); g.rotate(-.25 + flap);
  if (f.wings === "sankta") {
    g.globalCompositeOperation = "lighter";
    for (let k = 0; k < 3; k++) {
      g.fillStyle = c + (k ? "88" : "cc");
      g.beginPath(); g.moveTo(0, 0); g.lineTo(-14 - k * 5, -8 + k * 7); g.lineTo(-6 - k * 4, 3 + k * 3); g.closePath(); g.fill();
    }
  } else {
    g.fillStyle = shade(c, -.1);
    g.beginPath(); g.moveTo(0, -2); g.quadraticCurveTo(-24, -10, -26, 18); g.quadraticCurveTo(-14, 10, -4, 26); g.quadraticCurveTo(-2, 10, 2, 4); g.closePath(); g.fill();
    g.strokeStyle = shade(c, -.35); g.lineWidth = .8;
    for (let k = 0; k < 4; k++) { g.beginPath(); g.moveTo(-3, 2 + k * 3); g.lineTo(-20 + k * 4, 12 + k * 4); g.stroke(); }
  }
  g.restore();
}
function drawBackHair(g, f, c, S, sw) {
  const [x, y] = c, r = 10 * (f.hsz || 1), hc = shade(f.hair || "#3a2a1a", -.12), len = f.hlen || 30;
  g.fillStyle = hc;
  if (f.hs === "long") {
    g.beginPath(); g.moveTo(x - 2, y - r); g.quadraticCurveTo(x - r - 6, y, x - r - 3 + sw * 1.5, y + len);
    g.lineTo(x - 4 + sw, y + len - 4); g.quadraticCurveTo(x - 2, y + 8, x + 2, y + 2); g.closePath(); g.fill();
  } else if (f.hs === "pony") {
    g.beginPath(); g.moveTo(x - r + 2, y - r * .6); g.quadraticCurveTo(x - r - 12, y - r * .2, x - r - 8 + sw * 2, y + len * .8);
    g.quadraticCurveTo(x - r - 4, y + 6, x - r + 4, y - r * .2); g.closePath(); g.fill();
  } else if (f.hs === "braid") {
    // single long braid down the back, drawn as overlapping links
    for (let k = 0; k < 9; k++) {
      const t = k / 8, bx = x - r * .7 - 4 * t + sw * 2 * t, by = y - r * .1 + t * len;
      g.fillStyle = k % 2 ? hc : shade(hc, .12); g.beginPath(); g.ellipse(bx, by, 3.4 - t * 1.2, 4.4, .25, 0, 7); g.fill();
    }
    if (f.ribbon) { g.fillStyle = f.ribbon; g.beginPath(); g.ellipse(x - r * .7 - 4 + sw * 2, y - r * .1 + len + 2, 3, 2, 0, 0, 7); g.fill(); }
  } else if (f.hs === "twin") {
    for (const [ox, oy] of [[-4, -2], [2, 0]]) {
      g.beginPath(); g.moveTo(x - r * .6 + ox, y - r * .7 + oy); g.quadraticCurveTo(x - r - 10 + ox, y + oy, x - r - 6 + ox + sw * 2, y + len * .85 + oy);
      g.quadraticCurveTo(x - r + ox, y + 8, x - r * .4 + ox, y - r * .3 + oy); g.closePath(); g.fill();
      g.fillStyle = f.hair || "#3a2a1a";
    }
  }
}
function drawEars(g, f, x, y, r) {
  const hc = f.hair || "#3a2a1a", inner = f.earIn || "#f0b8c0", e = f.ears;
  const tri = (bx, by, w, h, lean, col, inC) => {
    g.fillStyle = col; g.beginPath(); g.moveTo(bx - w / 2, by); g.lineTo(bx + lean, by - h); g.lineTo(bx + w / 2, by); g.closePath(); g.fill();
    if (inC) { g.fillStyle = inC; g.beginPath(); g.moveTo(bx - w / 4, by - 1); g.lineTo(bx + lean * .8, by - h * .72); g.lineTo(bx + w / 4, by - 1); g.closePath(); g.fill(); }
  };
  if (e === "cat") { tri(x - 6, y - r + 3, 7, 8, -1, shade(hc, -.25)); tri(x + 1, y - r + 1.5, 7.5, 9, 0, hc, inner); return 9; }
  if (e === "wolf") { tri(x - 6, y - r + 3, 8, 11, -3, shade(hc, -.25)); tri(x + 1, y - r + 2, 8.5, 12, -2, hc, inner); return 12; }
  if (e === "fox") { tri(x - 6, y - r + 3, 9, 13, -3, shade(hc, -.25)); tri(x + 1, y - r + 2, 9.5, 14, -2, hc, "#f6efe6"); return 14; }
  if (e === "horse") { tri(x - 5, y - r + 3, 6, 10, -2, shade(hc, -.25)); tri(x + 1, y - r + 2, 6.5, 11, -1.5, hc, inner); return 11; }
  if (e === "dog") {
    for (const [ox, k] of [[-7, -.25], [-1, 0]]) { g.fillStyle = shade(hc, k); g.beginPath(); g.ellipse(x + ox, y - r + 6, 3.6, 8, -.5, 0, 7); g.fill(); }
    return 4;
  }
  if (e === "rabbit") {
    g.fillStyle = shade(hc, -.25); g.beginPath(); g.ellipse(x - 9, y - r - 8, 3.4, 12, -.45, 0, 7); g.fill();
    g.fillStyle = hc; g.beginPath(); g.ellipse(x - 3, y - r - 9, 3.6, 13, -.32, 0, 7); g.fill();
    g.fillStyle = inner; g.beginPath(); g.ellipse(x - 3, y - r - 9, 1.5, 9, -.32, 0, 7); g.fill();
    return 22;
  }
  if (e === "round") { circ(g, x - 6, y - r + 2, 3.6, shade(hc, -.25)); circ(g, x + 1, y - r + 1, 3.8, hc); circ(g, x + 1, y - r + 1, 1.8, inner); return 5; }
  if (e === "owl") { tri(x - 6, y - r + 2, 5, 9, -4, shade(hc, -.25)); tri(x, y - r + 1, 5, 10, -3, hc); return 10; }
  return 0;
}
function drawHorns(g, f, x, y, r) {
  const hc = f.hornc || "#2a2226", h = f.horns;
  g.save(); g.lineCap = "round";
  if (h === "sarkaz") {
    for (const [ox, k] of [[-5, -.3], [1, 0]]) {
      g.strokeStyle = shade(hc, k); g.lineWidth = 3.2;
      g.beginPath(); g.moveTo(x + ox, y - r + 3); g.quadraticCurveTo(x + ox - 3, y - r - 8, x + ox - 11, y - r - 7); g.stroke();
    }
    g.restore(); return 9;
  }
  if (h === "dragon") {
    for (const [ox, k] of [[-5, -.3], [1, 0]]) {
      g.strokeStyle = shade(hc, k); g.lineWidth = 2.6;
      g.beginPath(); g.moveTo(x + ox, y - r + 3); g.quadraticCurveTo(x + ox - 6, y - r - 4, x + ox - 16, y - r - 3); g.stroke();
      g.lineWidth = 1.8; g.beginPath(); g.moveTo(x + ox - 7, y - r - 2); g.lineTo(x + ox - 9, y - r - 8); g.stroke();
    }
    g.restore(); return 8;
  }
  if (h === "oni") {
    g.fillStyle = hc; g.beginPath(); g.moveTo(x + 2, y - r + 1); g.lineTo(x + 5, y - r - 10); g.lineTo(x + 7, y - r + 1.5); g.closePath(); g.fill();
    g.restore(); return 10;
  }
  if (h === "goat") {
    g.strokeStyle = hc; g.lineWidth = 3.4;
    g.beginPath(); g.arc(x - 4, y - r + 6, 6, Math.PI * 1.05, Math.PI * 2.35); g.stroke();
    g.restore(); return 3;
  }
  g.restore(); return 0;
}
function drawHalo(g, f, x, y, r, T) {
  const c = f.halo, hy = y - r - 8 + Math.sin(T * 2) * 1;
  g.save(); g.globalCompositeOperation = "lighter";
  g.strokeStyle = c + "55"; g.lineWidth = 4.5; g.beginPath(); g.ellipse(x - 1, hy, 8, 2.6, -.12, 0, 7); g.stroke();
  g.strokeStyle = shade(c, .4); g.lineWidth = 1.6; g.stroke();
  g.restore();
  return 12;
}

function drawHead(g, f, c, T, pose) {
  const [x, y] = c, r = 10 * (f.hsz || 1), skin = f.skin || "#e8c4a0", t = f.type;
  const face = (col) => {
    const gr = g.createRadialGradient(x + 3, y - 3, 1, x, y, r * 1.1);
    gr.addColorStop(0, shade(col, .18)); gr.addColorStop(1, shade(col, -.22));
    circ(g, x, y, r, gr);
  };
  const eye = (col = "#1a1410", ex = 5.5, ey = -1) => { circ(g, x + ex, y + ey, 1.3, col); };
  if (t === "human" || t === "hood") {
    if (t === "hood") {
      g.fillStyle = f.cape || f.col; g.beginPath(); g.ellipse(x - 1, y - 1, r + 4, r + 5, 0, 0, 7); g.fill();
      g.beginPath(); g.moveTo(x - r - 4, y); g.lineTo(x - r - 6, y + 16); g.lineTo(x + 4, y + 12); g.fill();
      face(shade(skin, -.04));
      g.fillStyle = f.cape || f.col; g.beginPath(); g.ellipse(x - 4, y - 4, r + 2, r + 1, -.3, Math.PI * .9, Math.PI * 2.05); g.fill();
      g.fillStyle = "rgba(0,0,0,.22)"; g.beginPath(); g.arc(x, y, r, Math.PI * 1.1, Math.PI * 1.9); g.fill();
      circ(g, x + 5.5, y + .5, 1.6, f.eyes || "#222");
      g.strokeStyle = shade(skin, -.45); g.lineWidth = .8; g.beginPath(); g.moveTo(x + 2, y + 5); g.lineTo(x + 7, y + 4); g.stroke();
      if (f.mask) {
        // Reunion respirator
        g.fillStyle = "#1c1e22"; g.beginPath(); g.ellipse(x + 5, y + 4.5, 5.6, 4.3, -.2, 0, 7); g.fill();
        circ(g, x + 9, y + 6.5, 2.3, "#3a3e46"); circ(g, x + 9, y + 6.5, 1, "#15171a");
      }
      return 14;
    }
    face(skin);
    // nose + mouth
    g.fillStyle = shade(skin, -.12); g.beginPath(); g.moveTo(x + r - 1, y - 1); g.lineTo(x + r + 2, y + 3); g.lineTo(x + r - 1, y + 3.5); g.fill();
    if (f.eyec) { circ(g, x + 5.6, y - 1, 1.9, "#1a1410"); circ(g, x + 5.9, y - 1.1, 1.1, f.eyec); }
    else eye();
    g.strokeStyle = shade(skin, -.4); g.lineWidth = .9; g.beginPath(); g.moveTo(x + 4, y + 6); g.lineTo(x + 7.5, y + 5.5); g.stroke();
    const hc = f.hair || "#3a2a1a", hs = f.hs;
    g.fillStyle = hc;
    if (hs !== "bald") {
      g.beginPath();
      if (hs === "old") g.arc(x - 1, y, r + .5, Math.PI * .75, Math.PI * 1.45);
      else g.arc(x - .5, y - .5, r + 1, Math.PI * .72, Math.PI * 1.9);
      g.lineTo(x - 2, y - 2); g.fill();
    } else { g.fillStyle = "rgba(255,255,255,.18)"; g.beginPath(); g.ellipse(x - 1, y - 7, 4, 2, -.3, 0, 7); g.fill(); g.fillStyle = hc; }
    if (hs === "swoop") { g.beginPath(); g.ellipse(x + 3, y - 8, 7, 3.5, -.25, 0, 7); g.fill(); }
    if (hs === "curly") for (let k = 0; k < 5; k++) circ(g, x - 7 + k * 3.2, y - 9 + Math.abs(k - 2) * .8, 3, hc);
    if (hs === "buns") { circ(g, x - 7, y + 1, 6.5, hc); g.strokeStyle = shade(hc, .2); g.lineWidth = .8; g.beginPath(); g.arc(x - 7, y + 1, 3.5, 0, 6); g.stroke(); }
    if (hs === "bun") { circ(g, x - 8, y - 6, 4, hc); g.strokeStyle = hc; g.lineWidth = 2.5; g.beginPath(); g.moveTo(x - 9, y - 3); g.quadraticCurveTo(x - 12, y + 4, x - 10, y + 10); g.stroke(); }
    if (hs === "beard" || hs === "old") {
      g.fillStyle = hc; g.beginPath(); g.moveTo(x - 2, y + 2); g.quadraticCurveTo(x + 2, y + (hs === "old" ? 14 : 12), x + 9, y + 6); g.lineTo(x + 9, y + 3.5); g.quadraticCurveTo(x + 4, y + 5, x + 1, y + 1); g.fill();
    }
    if (hs === "bob" || hs === "long" || hs === "twin") {
      // side locks framing the face
      g.fillStyle = hc; g.beginPath(); g.moveTo(x - 3, y - r + 2); g.quadraticCurveTo(x - r - 3, y - 2, x - r + 1, y + (hs === "bob" ? 8 : 11));
      g.lineTo(x - 2, y + 4); g.closePath(); g.fill();
    }
    if (hs && hs !== "bald" && hs !== "old" && hs !== "short") {
      // fringe over the forehead
      g.fillStyle = hc; g.beginPath(); g.moveTo(x - 1, y - r + .5); g.quadraticCurveTo(x + r * .75, y - r * 1.05, x + r * .98, y - r * .48);
      g.lineTo(x + r * .62, y - r * .58); g.lineTo(x + r * .42, y - r * .36); g.lineTo(x + r * .1, y - r * .66); g.closePath(); g.fill();
    }
    let ext = 2;
    if (f.glasses) {
      g.strokeStyle = f.glasses; g.lineWidth = 1.1; g.fillStyle = "rgba(200,220,255,.18)";
      g.beginPath(); g.ellipse(x + 5.8, y - 1, 2.8, 2.1, 0, 0, 7); g.fill(); g.stroke();
      g.beginPath(); g.moveTo(x + 3, y - 1.4); g.lineTo(x - 3, y - 2.4); g.stroke();
    }
    if (f.ribbon && f.hs !== "braid") {
      g.fillStyle = f.ribbon; const rx = x - r * .55, ry = y - r * .78;
      g.beginPath(); g.moveTo(rx, ry); g.lineTo(rx - 6, ry - 4); g.lineTo(rx - 6, ry + 3); g.closePath(); g.fill();
      g.beginPath(); g.moveTo(rx, ry); g.lineTo(rx + 5, ry - 5); g.lineTo(rx + 5, ry + 2); g.closePath(); g.fill();
      circ(g, rx, ry, 1.6, shade(f.ribbon, -.2));
    }
    if (f.headdress) {
      // maid headdress: frilled band across the crown
      g.fillStyle = f.headdress; g.beginPath(); g.ellipse(x - 1, y - r + 1.5, r * .82, 2.6, -.18, 0, 7); g.fill();
      for (let k = -2; k <= 2; k++) circ(g, x - 1 + k * 3.2, y - r - .4 - Math.abs(k) * .2, 1.6, f.headdress);
      ext = Math.max(ext, 4);
    }
    if (f.beret) {
      g.fillStyle = f.beret; g.beginPath(); g.ellipse(x - 2, y - r + 1, r + 3, 4.2, -.22, 0, 7); g.fill();
      circ(g, x - 2, y - r - 2.5, 1.6, shade(f.beret, -.25));
      ext = Math.max(ext, 6);
    }
    if (f.horns) ext = Math.max(ext, drawHorns(g, f, x, y, r));
    if (f.ears) ext = Math.max(ext, drawEars(g, f, x, y, r));
    if (f.halo) ext = Math.max(ext, drawHalo(g, f, x, y, r, T));
    if (f.hat) {
      g.fillStyle = f.hat; g.beginPath(); g.ellipse(x - 1, y - r + 2, r + 5, 3, -.08, 0, 7); g.fill();
      g.beginPath(); g.arc(x - 1, y - r + 1, r * .8, Math.PI, Math.PI * 2); g.fill();
      ext = Math.max(ext, r * .8);
    }
    return r + ext;
  }
  if (t === "robot") {
    const c0 = f.col || "#c8ccd4";
    const gr = g.createLinearGradient(x - r, y - r, x + r, y + r); gr.addColorStop(0, shade(c0, .3)); gr.addColorStop(1, shade(c0, -.35));
    g.fillStyle = gr; g.beginPath(); g.roundRect ? g.roundRect(x - r, y - r, r * 2 + 2, r * 1.9, 4) : g.rect(x - r, y - r, r * 2 + 2, r * 1.9); g.fill();
    g.save(); g.globalCompositeOperation = "lighter"; g.fillStyle = (f.acc || "#5fd4ff") + "cc"; g.fillRect(x + 1, y - 4, r, 4); g.restore();
    g.strokeStyle = shade(c0, -.4); g.lineWidth = 1.4; g.beginPath(); g.moveTo(x - 3, y - r); g.lineTo(x - 5, y - r - 7); g.stroke();
    circ(g, x - 5, y - r - 7, 1.8, f.acc || "#5fd4ff");
    if (f.headdress) {
      g.fillStyle = f.headdress; g.beginPath(); g.ellipse(x, y - r + .5, r * .9, 2.6, -.1, 0, 7); g.fill();
      for (let k = -2; k <= 2; k++) circ(g, x + k * 3.3, y - r - 1.2, 1.7, f.headdress);
    }
    return r + 8;
  }
  if (t === "trooper") {
    const base = f.chrome ? "#d9dee6" : "#f2f4f7";
    const gr = g.createRadialGradient(x + 2, y - 4, 1, x, y, r * 1.2);
    gr.addColorStop(0, "#ffffff"); gr.addColorStop(1, f.chrome ? "#7e8794" : "#b9c0cc");
    g.fillStyle = gr; g.beginPath(); g.arc(x, y - 1, r + 1, Math.PI * .85, Math.PI * 2.2); g.lineTo(x + r + 2, y + 7); g.lineTo(x - 4, y + 9); g.closePath(); g.fill();
    g.fillStyle = "#121418"; g.beginPath(); g.moveTo(x + 2, y - 3); g.quadraticCurveTo(x + 8, y - 6, x + r + 1, y - 2); g.lineTo(x + r, y + 1); g.quadraticCurveTo(x + 6, y - 1, x + 3, y + 1); g.fill();
    g.fillStyle = "#30343c"; g.fillRect(x + 5, y + 4, 4, 3);
    if (f.acc && f.acc !== "#1b1d22") { g.strokeStyle = f.acc; g.lineWidth = 2; g.beginPath(); g.arc(x, y - 1, r - 1, Math.PI * 1.25, Math.PI * 1.75); g.stroke(); }
    void base; return;
  }
  if (t === "mando") {
    const hcol = f.helm || "#6a7a5a";
    const gr = g.createRadialGradient(x + 2, y - 4, 1, x, y, r * 1.2); gr.addColorStop(0, shade(hcol, .3)); gr.addColorStop(1, shade(hcol, -.35));
    g.fillStyle = gr; g.beginPath(); g.arc(x, y - 1, r + 1, Math.PI * .9, Math.PI * 2.15); g.lineTo(x + r + 1, y + 8); g.lineTo(x - 7, y + 9); g.closePath(); g.fill();
    g.fillStyle = "#0b0c10"; g.fillRect(x + 1, y - 4, r + 1, 3.2); g.fillRect(x + r - 3.5, y - 2, 3.2, 8);
    g.strokeStyle = "#555"; g.lineWidth = 1.2; g.beginPath(); g.moveTo(x - 3, y - 6); g.lineTo(x - 2, y - 17); g.stroke();
    if (f.acc === "#8c1e1e") { g.strokeStyle = "#8c1e1e"; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x - 8, y - 7); g.lineTo(x - 4, y - 9); g.stroke(); }
    return;
  }
  if (t === "vader" || t === "kylo") {
    const gr = g.createRadialGradient(x + 2, y - 5, 1, x, y, r * 1.3); gr.addColorStop(0, "#5a5f6a"); gr.addColorStop(.5, "#15161a"); gr.addColorStop(1, "#050506");
    g.fillStyle = gr;
    g.beginPath(); g.arc(x, y - 1, r + 1.5, Math.PI * .95, Math.PI * 2.1);
    if (t === "vader") { g.lineTo(x + r + 2, y + 8); g.lineTo(x - 4, y + 9); g.lineTo(x - r - 6, y + 11); g.lineTo(x - r - 2, y + 2); }
    else { g.lineTo(x + r + 1, y + 7); g.lineTo(x - r, y + 8); }
    g.closePath(); g.fill();
    if (t === "vader") {
      g.fillStyle = "#1d1f24"; g.beginPath(); g.moveTo(x + 3, y - 4); g.lineTo(x + r + 1, y - 4); g.lineTo(x + r + 2, y + 9); g.lineTo(x + 2, y + 9); g.fill();
      g.fillStyle = "#08080a"; g.beginPath(); g.ellipse(x + 7, y - 1.5, 3.2, 2.2, -.2, 0, 7); g.fill();
      g.fillStyle = "rgba(255,60,60,.35)"; circ(g, x + 7.8, y - 2, .9, "rgba(255,80,80,.55)");
      g.fillStyle = "#6a6f7a"; g.beginPath(); g.moveTo(x + 6, y + 3); g.lineTo(x + 11, y + 3); g.lineTo(x + 8.5, y + 8.5); g.fill();
    } else {
      g.strokeStyle = "#a8adb8"; g.lineWidth = 1.4; g.beginPath(); g.moveTo(x + 1, y - 3); g.lineTo(x + r + 1, y - 3); g.moveTo(x + r - 2, y - 3); g.lineTo(x + r - 2, y + 4); g.stroke();
    }
    return;
  }
  if (t === "wookiee") {
    const fur = f.skin;
    const gr = g.createRadialGradient(x + 3, y - 3, 1, x, y, r * 1.4); gr.addColorStop(0, shade(fur, .2)); gr.addColorStop(1, shade(fur, -.3));
    g.fillStyle = gr; g.beginPath(); g.ellipse(x - 1, y, r + 2, r + 3, 0, 0, 7); g.fill();
    g.fillStyle = shade(fur, .15); g.beginPath(); g.ellipse(x + 8, y + 3, 5.5, 4.5, 0, 0, 7); g.fill();
    circ(g, x + 12.5, y + 1.5, 1.8, "#1a1008"); eye("#140c06", 5, -3);
    g.strokeStyle = shade(fur, -.4); g.lineWidth = 1;
    for (let k = 0; k < 6; k++) { g.beginPath(); g.moveTo(x - 9 + k * 2, y - 8 + k); g.lineTo(x - 11 + k * 2, y - 2 + k); g.stroke(); }
    return;
  }
  if (t === "yoda") {
    const sk = f.skin;
    g.fillStyle = shade(sk, -.1);
    g.beginPath(); g.moveTo(x - 4, y - 2); g.quadraticCurveTo(x - r - 14, y - 9, x - r - 16, y - 2); g.quadraticCurveTo(x - r - 8, y + 3, x - 4, y + 4); g.fill();
    face(sk);
    g.fillStyle = shade(sk, -.25); g.beginPath(); g.moveTo(x - 6, y); g.quadraticCurveTo(x - r - 9, y - 4, x - r - 12, y - 1.5); g.quadraticCurveTo(x - r - 6, y + 1, x - 6, y + 2); g.fill();
    eye("#2a1a08", 6, -1.5); circ(g, x + 6.3, y - 1.9, .5, "#fff");
    g.strokeStyle = shade(sk, -.4); g.lineWidth = .7; g.beginPath(); g.moveTo(x + 2, y - 6); g.lineTo(x + 8, y - 5); g.moveTo(x + 4, y + 6); g.lineTo(x + 8, y + 5); g.stroke();
    g.strokeStyle = "rgba(255,255,255,.6)"; g.beginPath(); g.moveTo(x - 3, y - r + 1); g.quadraticCurveTo(x - 6, y - r - 4, x - 9, y - r - 1); g.stroke();
    return;
  }
  if (t === "zabrak") {
    face(f.skin);
    g.fillStyle = "#121014";
    g.beginPath(); g.moveTo(x + 2, y - 6); g.lineTo(x + 9, y - 4); g.lineTo(x + 7, y - 1); g.lineTo(x + 2, y - 2); g.fill();
    g.beginPath(); g.moveTo(x + 4, y + 3); g.lineTo(x + 10, y + 4); g.lineTo(x + 5, y + 8); g.fill();
    g.beginPath(); g.moveTo(x - 7, y - 3); g.lineTo(x - 3, y - 8); g.lineTo(x - 1, y + 2); g.fill();
    eye("#ffcf33", 6, -2);
    g.fillStyle = "#e8d8a8";
    for (const [hx, hy] of [[-3, -10], [1, -10.5], [-6, -8], [4, -9]]) { g.beginPath(); g.moveTo(x + hx - 1.2, y + hy + 1.5); g.lineTo(x + hx, y + hy - 3); g.lineTo(x + hx + 1.2, y + hy + 1.5); g.fill(); }
    return;
  }
  if (t === "togruta") {
    g.fillStyle = "#f2f2f2"; g.beginPath(); g.moveTo(x - 6, y + 2); g.quadraticCurveTo(x - 14, y + 10, x - 11, y + 22); g.lineTo(x - 7, y + 20); g.quadraticCurveTo(x - 8, y + 10, x - 2, y + 4); g.fill();
    g.fillStyle = "#3b6fd1"; g.fillRect(x - 12, y + 12, 5, 2.5); g.fillRect(x - 11.5, y + 17, 4.5, 2);
    face(f.skin);
    g.fillStyle = "#f6f2ea"; g.beginPath(); g.ellipse(x + 6, y - 2, 4, 2.6, -.2, 0, 7); g.fill();
    g.beginPath(); g.moveTo(x + 3, y + 4); g.lineTo(x + 9, y + 5); g.lineTo(x + 6, y + 8); g.fill();
    eye("#1a2a5a", 6.5, -2);
    g.fillStyle = "#f2f2f2";
    g.beginPath(); g.moveTo(x - 6, y - 6); g.quadraticCurveTo(x - 5, y - 20, x + 3, y - 22); g.quadraticCurveTo(x + 1, y - 14, x + 1, y - 7); g.fill();
    g.fillStyle = "#3b6fd1"; g.beginPath(); g.moveTo(x - 4, y - 14); g.lineTo(x + 1, y - 15); g.lineTo(x + 1, y - 12); g.lineTo(x - 4.5, y - 11); g.fill();
    return;
  }
  if (t === "grievous") {
    g.fillStyle = "#e8e0c8"; g.beginPath(); g.moveTo(x - 7, y - 7); g.quadraticCurveTo(x + 4, y - 14, x + 13, y - 3); g.lineTo(x + 11, y + 8); g.lineTo(x - 2, y + 10); g.quadraticCurveTo(x - 9, y + 2, x - 7, y - 7); g.fill();
    g.fillStyle = "#c9c0a4"; g.beginPath(); g.moveTo(x + 2, y - 2); g.lineTo(x + 13, y - 3); g.lineTo(x + 11, y + 8); g.lineTo(x + 3, y + 6); g.fill();
    g.fillStyle = "#1a1408"; g.beginPath(); g.ellipse(x + 7, y - 3, 3.2, 2.3, -.2, 0, 7); g.fill();
    circ(g, x + 7.5, y - 3.2, 1.3, "#ffd34d");
    g.strokeStyle = "#5a5440"; g.lineWidth = 1; g.beginPath(); g.moveTo(x + 5, y + 4); g.lineTo(x + 11, y + 4); g.stroke();
    return;
  }
  if (t === "b1") {
    g.fillStyle = f.col; g.beginPath(); g.moveTo(x - 6, y - 5); g.quadraticCurveTo(x, y - 9, x + 6, y - 3); g.lineTo(x + 17, y + 5); g.lineTo(x + 16, y + 8); g.lineTo(x + 2, y + 5); g.quadraticCurveTo(x - 6, y + 3, x - 6, y - 5); g.fill();
    g.fillStyle = shade(f.col, -.3); g.beginPath(); g.moveTo(x + 2, y + 5); g.lineTo(x + 16, y + 8); g.lineTo(x + 6, y + 8); g.fill();
    circ(g, x, y - 2, 2.4, "#3a2e1a"); circ(g, x, y - 2, 1.1, "#8a7450");
    return;
  }
  face(skin);
}

function drawR2(g, f, pose, out) {
  const T = pose.time || 0, k = pose.t || 0, wob = Math.sin(T * 3) * .03 + (pose.name === "hit" ? -.2 * (1 - k) : 0);
  g.save(); g.rotate(wob);
  // side legs
  g.fillStyle = "#c9d1de"; g.fillRect(-20, -54, 7, 44); g.fillStyle = "#9aa4b8"; g.fillRect(-23, -12, 13, 12);
  // body
  const gr = g.createLinearGradient(-15, 0, 17, 0); gr.addColorStop(0, "#9ea8ba"); gr.addColorStop(.55, "#f2f5fa"); gr.addColorStop(1, "#d6dce6");
  g.fillStyle = gr; g.beginPath(); g.roundRect ? g.roundRect(-15, -66, 32, 58, 4) : g.rect(-15, -66, 32, 58); g.fill();
  g.fillStyle = f.acc; g.fillRect(-4, -58, 14, 8); g.fillRect(-4, -46, 5, 16); g.fillRect(4, -46, 6, 6); g.fillRect(4, -36, 6, 6);
  g.fillStyle = "#c9d1de"; g.fillRect(-2, -12, 16, 12);
  // dome
  const dg = g.createLinearGradient(-15, -82, 17, -66); dg.addColorStop(0, "#8f99ac"); dg.addColorStop(.5, "#eef2f8"); dg.addColorStop(1, "#b8c0ce");
  g.fillStyle = dg; g.beginPath(); g.ellipse(1, -66, 16.5, 17, 0, Math.PI, Math.PI * 2); g.fill();
  g.fillStyle = f.acc; g.fillRect(-12, -74, 6, 5); g.fillRect(9, -74, 6, 5);
  circ(g, 4, -76, 3.5, "#0c0f16"); circ(g, 4.8, -76.6, 1.3, pose.name === "hit" ? "#ff4b4b" : "#5fd4ff");
  out.head = [2, -74]; out.chest = [2, -40]; out.hand = [17, -40];
  out.tip = [20, -44];
  g.restore();
}


function drawSlug(g, f, pose, out) {
  const T = pose.time || 0, k = pose.t || 0, nm = pose.name;
  const squash = nm === "hit" ? 1 - .25 * (1 - k) : nm === "swing" ? 1 + .25 * Math.sin(k * Math.PI) : 1 + Math.sin(T * 3 + (pose.ph || 0)) * .04;
  const lunge = nm === "swing" ? Math.sin(k * Math.PI) * 14 : 0;
  g.save(); g.translate(lunge, 0); g.scale(1 / Math.sqrt(squash), squash);
  const gr = g.createRadialGradient(6, -26, 4, 0, -16, 46);
  gr.addColorStop(0, shade(f.col, .35)); gr.addColorStop(1, shade(f.col, -.35));
  g.fillStyle = gr; g.beginPath(); g.moveTo(-40, 0); g.quadraticCurveTo(-44, -30, -6, -34); g.quadraticCurveTo(30, -36, 40, -16); g.quadraticCurveTo(44, 0, 30, 0); g.closePath(); g.fill();
  g.strokeStyle = shade(f.col, -.3); g.lineWidth = 1.5;
  for (let i = -28; i < 30; i += 12) { g.beginPath(); g.moveTo(i, -2); g.quadraticCurveTo(i + 4, -20, i + 2, -31); g.stroke(); }
  g.fillStyle = f.acc;
  for (const [x, y, h] of [[-18, -32, 14], [-4, -35, 18], [10, -33, 12]]) { g.beginPath(); g.moveTo(x - 5, y + 2); g.lineTo(x, y - h); g.lineTo(x + 5, y + 2); g.fill(); }
  g.strokeStyle = shade(f.col, -.2); g.lineWidth = 2.5; g.beginPath(); g.moveTo(32, -22); g.lineTo(40, -38); g.moveTo(26, -24); g.lineTo(30, -40); g.stroke();
  circ(g, 40, -39, 3, "#1a1410"); circ(g, 30, -41, 3, "#1a1410");
  g.restore();
  out.head = [34, -36]; out.chest = [6, -18]; out.hand = [38, -18]; out.tip = [44, -18];
}
function drawHound(g, f, pose, out) {
  const T = pose.time || 0, k = pose.t || 0, nm = pose.name;
  const run = nm === "run" ? T * 18 : 0, lunge = nm === "swing" ? Math.sin(k * Math.PI) * 18 : 0, lean = nm === "hit" ? -.2 * (1 - k) : nm === "swing" ? .15 * Math.sin(k * Math.PI) : 0;
  g.save(); g.translate(lunge, 0); g.rotate(lean);
  const legs = [[-24, 0], [-14, 1.6], [16, 3.2], [26, 4.8]];
  for (const [x, ph] of legs) { const a = Math.sin(run + ph) * .6; capsule(g, [x, -34], [x + Math.sin(a) * 14, -4], 6, shade(f.col, -.25), false); }
  const gr = g.createLinearGradient(0, -56, 0, -24); gr.addColorStop(0, shade(f.col, .25)); gr.addColorStop(1, shade(f.col, -.3));
  g.fillStyle = gr; g.beginPath(); g.ellipse(0, -40, 36, 15, -.05, 0, 7); g.fill();
  g.fillStyle = f.acc; for (let i = -18; i < 18; i += 9) { g.beginPath(); g.moveTo(i - 3, -53); g.lineTo(i, -63); g.lineTo(i + 3, -53); g.fill(); }
  g.strokeStyle = shade(f.col, -.2); g.lineWidth = 5; g.lineCap = "round"; g.beginPath(); g.moveTo(-34, -44); g.quadraticCurveTo(-50, -54 + Math.sin(T * 6) * 4, -56, -40); g.stroke();
  g.fillStyle = shade(f.col, .1); g.beginPath(); g.ellipse(36, -52, 14, 10, -.2, 0, 7); g.fill();
  g.beginPath(); g.moveTo(44, -56); g.lineTo(60, -50); g.lineTo(46, -44); g.fill();
  g.fillStyle = shade(f.col, -.2); g.beginPath(); g.moveTo(30, -60); g.lineTo(32, -72); g.lineTo(38, -61); g.fill();
  circ(g, 42, -55, 2.4, f.acc);
  g.restore();
  out.head = [38, -54]; out.chest = [10, -40]; out.hand = [50, -50]; out.tip = [58, -50];
}

// ---------- figure portraits (battle cut-ins, enemy icons) ----------
// Full-body art is rendered once per figure; head icons once per figure and backdrop.
const EART = {}, EHEAD = {};
function figCanvas(f, W, H, sc, fx, fy, bg) {
  const cv = document.createElement("canvas"); cv.width = W; cv.height = H; const g = cv.getContext("2d");
  if (bg) { const gr = g.createRadialGradient(W * .55, H * .35, 4, W / 2, H / 2, W * .8); gr.addColorStop(0, bg[0]); gr.addColorStop(.6, bg[1]); gr.addColorStop(1, bg[2]); g.fillStyle = gr; g.fillRect(0, 0, W, H); }
  g.save(); g.translate(fx, fy); g.scale(sc, sc); const out = drawFigure(g, f, { name: "idle", time: .6 }); g.restore();
  return { cv, out };
}
const toURL = cv => { try { return cv.toDataURL("image/png"); } catch (e) { return ""; } };
function figFull(id, f) {
  if (!EART[id]) { const r = figCanvas(f, 360, 540, 3.9, 180, 526); EART[id] = { url: toURL(r.cv), head: r.out.head }; }
  return EART[id];
}
function figHead(id, f, bg) {
  const hk = id + "|" + bg[0];
  if (!EHEAD[hk]) {
    const probe = figFull(id, f).head, hr = (f.type === "slug" ? 14 : f.type === "hound" ? 12 : 10) * (f.h || 1), sc = 128 * .2 / hr;
    EHEAD[hk] = toURL(figCanvas(f, 128, 128, sc, 64 - probe[0] * sc, 60 - probe[1] * sc, bg).cv);
  }
  return EHEAD[hk];
}
// head icons sit on their Element's colour
const HEAD_BG = { enemy: ["#7a2a3a", "#3a1220", "#14060a"], Fire: ["#8a3a1a", "#3a1608", "#140604"], Water: ["#1e4a8a", "#0e2244", "#040a16"],
  Wind: ["#1e6a44", "#0c2e1e", "#04120a"], Ether: ["#7a6a3a", "#3a321a", "#14100a"], Imaginary: ["#4a2a7a", "#1e1238", "#0a0614"] };
// characters with MBAACC art (a5b_sprites.js) use it: character-select art and a head crop on their Element's colour
function mbHead(base, el) {
  const hk = "mb:" + base + "|" + el;
  if (!EHEAD[hk]) {
    const A = mbArt(base), bg = HEAD_BG[el] || HEAD_BG.enemy;
    EHEAD[hk] = A.head;
    // composite the transparent crop onto the Element backdrop once the image decodes
    loadImg(A.head).then(im => {
      const cv = document.createElement("canvas"); cv.width = cv.height = 128; const g = cv.getContext("2d");
      const gr = g.createRadialGradient(70, 45, 4, 64, 64, 102); gr.addColorStop(0, bg[0]); gr.addColorStop(.6, bg[1]); gr.addColorStop(1, bg[2]);
      g.fillStyle = gr; g.fillRect(0, 0, 128, 128); g.drawImage(im, 0, 0, 128, 128);
      EHEAD[hk] = toURL(cv);
    }).catch(() => {});
  }
  return EHEAD[hk];
}
const enemyArt = key => { const op = ENEMY[key].op && OPS[ENEMY[key].op], A = op && mbArt(op.base);
  return A ? { get full() { return A.full; }, get head() { return mbHead(op.base, "enemy"); } }
    : { get full() { return figFull("e:" + key, ENEMY[key].fig).url; }, get head() { return figHead("e:" + key, ENEMY[key].fig, HEAD_BG.enemy); } }; };
// a character's Moon styles share a body; non-home Elements glow in their own colour, so art is cached per body + glow
const opArt = key => { const op = OPS[key], A = mbArt(op.base);
  if (A) return { get full() { return A.full; }, get head() { return mbHead(op.base, op.el); } };
  const id = "o:" + op.base + "|" + op.fig.sc; return { get full() { return figFull(id, op.fig).url; }, get head() { return figHead(id, op.fig, HEAD_BG[op.el] || HEAD_BG.Fire); } }; };

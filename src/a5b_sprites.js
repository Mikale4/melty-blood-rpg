
// =====================================================================
//  MBAACC SPRITES — battle animation packs extracted from the owner's Melty Blood Actress Again Current Code
//  (tools/extract.py -> sprites/<char>.js, embedded by build.sh as MBSPR[char]) and menu art (tools/art.py -> MBART).
//  A pack has sprite rects on two sheets ("idx": palette-index sprites, recoloured per Element here; "col": true-colour
//  effect sprites, some stored at half size), timelines per Moon style (c/h/f) and role (idle, walk, run, back, guard,
//  hit, hit2, down, intro, win, s1-s3) and effect timelines (fx). 60 ticks per second, like the original.
//  Frame: [sprite, ox, oy, dur, blend, alpha, sx, sy, rot, hit, spawns, move]; s1-s3 also carry hits [[tick, reach px]]
//  and len (ticks until the move and its effects finish).
// =====================================================================
const PXW = 1.2;                       // world units per MBAACC pixel
const SPR_GRAV = 35;                   // pull on airborne bodies, 1/100 px per tick per tick
const SPR_FX_LIFE = 150;               // effects end after this many ticks (placed traps would otherwise linger)
const MBS = { packs: new Map(), wait: new Map() };
const spritePack = key => (window.MBSPR && window.MBSPR[key]) || null;

function b64u8(s) { const b = atob(s), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; }
const loadImg = src => new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = src; });
async function sprMake(P, key) {
  const S = { P, key, idx: null, col: null, rec: {}, partner: null };
  if (P.img.idx) {
    const im = await loadImg(P.img.idx), c = document.createElement("canvas"); c.width = im.width; c.height = im.height;
    const g = c.getContext("2d", { willReadFrequently: true }); g.drawImage(im, 0, 0); S.idx = g.getImageData(0, 0, c.width, c.height);
  }
  if (P.img.col) S.col = await loadImg(P.img.col);
  if (P.partner) S.partner = await sprMake(P.partner, key + "#partner");
  return S;
}
function sprLoad(key) {
  if (MBS.packs.has(key)) return Promise.resolve(MBS.packs.get(key));
  if (!MBS.wait.has(key)) MBS.wait.set(key, sprMake(spritePack(key), key).then(S => { MBS.packs.set(key, S); return S; }));
  return MBS.wait.get(key);
}
// the index sheet in one palette ("home" = the character's own colours, or an Element), built once per palette
function sprSheet(S, pal) {
  if (!S.idx) return null;
  if (!S.rec[pal]) {
    const c = document.createElement("canvas"); c.width = S.idx.width; c.height = S.idx.height;
    const g = c.getContext("2d"), out = g.createImageData(c.width, c.height);
    const P = new Uint32Array(b64u8(S.P.pal[pal] || S.P.pal.home).buffer), d = new Uint32Array(out.data.buffer), s = S.idx.data;
    for (let i = 0, n = d.length; i < n; i++) d[i] = P[s[i << 2]];
    g.putImageData(out, 0, 0); S.rec[pal] = c;
  }
  return S.rec[pal];
}
// which pack a battle unit uses: playable characters and character bosses; Ghouls and other monsters stay drawn
function unitSprite(u) {
  const op = u.isOp ? OPS[u.key] : u.def && u.def.op ? OPS[u.def.op] : null;
  if (!op || !spritePack(op.base)) return null;
  return { key: op.base, st: op.style[0].toLowerCase(), pal: op.home ? "home" : op.el };
}
const sprState = (S, spec, st, ox) => ({ S, spec, st, ox, role: null, R: null, k: 0, t: 0, x: 0, y: 0, v: [0, 0, 0, 0], acc: 0, t0: 0, ended: false, next: null, moves: false });
async function sprAttach(vu) {
  const spec = unitSprite(vu.u); if (!spec) return;
  const S = await sprLoad(spec.key), st = S.P.st[spec.st]; if (!st || !st.idle) return;
  sprSheet(S, spec.pal);
  vu.sp = sprState(S, spec, st, 0);
  // a tag team's partner stands behind the main character, in the same Element's colours
  const T = S.partner, pst = T && T.P.st[spec.st];
  if (pst && pst.idle) { sprSheet(T, spec.pal); vu.sp2 = sprState(T, spec, pst, T.P.x || -38); }
  // HUD anchors (head, chest, bar position) from the idle stance, in world units from the feet
  const f = st.idle.f[0], r = S.P.spr[f[0]] || [0, 0, 0, 60, 110], top = -f[2], w = r[3] * (r[5] || 1);
  vu.out = { top: [0, -(top * PXW + 8)], head: [0, -(top - 16) * PXW], chest: [0, -top * .58 * PXW], tip: [w * .42 * PXW, -top * .55 * PXW] };
  vu.sprH = top * PXW;
  sprPlay(vu, "idle");
}
const sprRole = (sp, role) => sp.st[role] || (role === "hit2" ? sp.st.hit : role === "run" ? sp.st.walk : null) || (/^p\d/.test(role) ? null : sp.st.idle);
// the partner copies stance changes and reactions; its moves only come from the main character's cues
const SPR_MIRROR = new Set(["idle", "walk", "run", "back", "guard", "hit", "hit2", "down"]);
// start a role on the main body (sp omitted) or the partner; the main body's travel from its last move is kept
function sprPlay(vu, role, next = "idle", sp = vu.sp) {
  if (!sp) return null;
  const main = sp === vu.sp;
  if (main && sp.x) vu.pos.x += sp.x * PXW * vu.face * vu.bs;
  const R = sprRole(sp, role); if (!R) return null;
  Object.assign(sp, { role, R, k: 0, t: 0, x: main ? 0 : sp.x, y: 0, v: [0, 0, 0, 0], acc: 0, t0: BT.clock, ended: false, next, moves: /^[sp]\d/.test(role) });
  sprEnter(vu, sp);
  if (main && vu.sp2 && SPR_MIRROR.has(role)) sprPlay(vu, role, next, vu.sp2);
  return R;
}
function sprMove(v, mv) {
  if (!mv) return;
  if (mv[0] & 1) v[0] = mv[1]; if (mv[0] & 2) v[0] += mv[1];
  if (mv[0] & 16) v[1] = mv[2]; if (mv[0] & 32) v[1] += mv[2];
  if (mv[0] & 3) v[2] = mv[3]; if (mv[0] & 48) v[3] = mv[4];
}
// a frame's sound cues: each lists variants (voice takes, hit grunts), one is picked at random
function sprSound(S, list) {
  if (!list || !BT.on) return;
  for (const i of list) { const v = S.P.snd[i]; if (v && v.length) clip(v[Math.floor(Math.random() * v.length)]); }
}
const sprX = (vu, sp) => vu.pos.x + (sp.ox + sp.x) * PXW * vu.face * vu.bs;
function sprEnter(vu, sp) {
  const f = sp.R.f[sp.k]; if (!f) return;
  if (sp.moves) sprMove(sp.v, f[11]);
  for (const [e, ex, ey] of f[10]) fxSpawn(sp, sprX(vu, sp) + ex * PXW * vu.face * vu.bs, (sp.y + ey) * PXW * vu.bs, vu.pos.z, vu.face, vu.bs, e);
  sprSound(sp.S, f[12]);
  if (f[13] && vu.sp2 && sp === vu.sp) sprPlay(vu, "p" + f[13], "idle", vu.sp2);
}
function sprStep(vu, sp) {
  const R = sp.R, f = R.f[sp.k]; if (!f) return;
  if (sp.moves) {
    const v = sp.v;
    sp.x += v[0] / 100; sp.y += v[1] / 100; v[0] += v[2] / 100; v[1] += v[3] / 100;
    if (sp.y < 0 && !v[3]) v[1] += SPR_GRAV / 100;
    if (sp.y > 0) { sp.y = 0; if (v[1] > 0) v[1] = 0; }
  } else if (sp !== vu.sp && sp.x) sp.x = Math.abs(sp.x) < 1 ? 0 : sp.x * .9;   // the partner drifts back to its spot
  if (++sp.t < f[3]) return;
  sp.t = 0;
  if (sp.k + 1 < R.f.length) { sp.k++; sprEnter(vu, sp); return; }
  if (R.loop >= 0) { if (R.loop !== sp.k) { sp.k = R.loop; sprEnter(vu, sp); } return; }
  sp.ended = true;
  if (sp.next) sprPlay(vu, sp.next, sp.next === "idle" ? null : "idle", sp);
  else sp.t = f[3];                    // hold the last frame
}
function sprTick(vu, dt) {
  for (const sp of [vu.sp, vu.sp2]) {
    if (!sp || !sp.R) continue;
    sp.acc += dt * .06;
    let n = 0;
    while (sp.acc >= 1 && n++ < 30) { sp.acc -= 1; sprStep(vu, sp); }
  }
}
// ---------- effects: world-space actors spawned by moves ----------
function fxSpawn(sp, x, y, z, face, bs, e) {
  const tl = sp.S.P.fx[e]; if (!tl || !BT.sfx) return;
  // sp is the spawning unit's sprite state, or another effect (effects can spawn effects)
  const a = { S: sp.S, pal: sp.pal || sp.spec.pal, tl, k: 0, t: 0, x, y, z: z - 1, face, bs, v: [0, 0, 0, 0], life: 0 };
  BT.sfx.push(a); fxEnter(a);
}
function fxEnter(a) {
  const f = a.tl[a.k]; if (!f) return;
  sprMove(a.v, f[11]);
  sprSound(a.S, f[12]);
  for (const [e, ex, ey] of f[10]) fxSpawn(a, a.x + ex * PXW * a.face * a.bs, a.y + ey * PXW * a.bs, a.z + 1, a.face, a.bs, e);
}
function fxTick(dt) {
  if (!BT.sfx || !BT.sfx.length) return;
  for (const a of BT.sfx) {
    a.acc = (a.acc || 0) + dt * .06;
    while (a.acc >= 1 && !a.done) {
      a.acc -= 1; a.life++;
      const v = a.v; a.x += v[0] / 100 * PXW * a.face * a.bs; a.y += v[1] / 100 * PXW * a.bs; v[0] += v[2] / 100; v[1] += v[3] / 100;
      if (a.life > SPR_FX_LIFE) { a.done = true; break; }
      const f = a.tl[a.k];
      if (++a.t >= f[3]) { a.t = 0; if (++a.k >= a.tl.length) a.done = true; else fxEnter(a); }
    }
  }
  BT.sfx = BT.sfx.filter(a => !a.done);
}
// ---------- drawing ----------
function sprFrame(g, S, pal, f, x, y, s, face, alpha) {
  const r = f[0] >= 0 && S.P.spr[f[0]]; if (!r) return;
  const img = r[0] ? S.col : sprSheet(S, pal); if (!img) return;
  g.save();
  g.translate(x, y); g.scale(s * face, s);
  if (f[6] !== 1 || f[7] !== 1) g.scale(f[6], f[7]);
  if (f[8]) g.rotate(f[8] * Math.PI * 2);
  g.globalAlpha = alpha * (f[4] ? f[5] / 255 : 1);
  if (f[4] === 2) g.globalCompositeOperation = "lighter"; else if (f[4] === 3) g.globalCompositeOperation = "multiply";
  const sc = r[5] || 1;
  g.drawImage(img, r[1], r[2], r[3], r[4], f[1], f[2], r[3] * sc, r[4] * sc);
  g.restore();
}
function sprDrawUnit(K, vu, alpha) {
  for (const sp of [vu.sp2, vu.sp]) {
    const f = sp && sp.R && sp.R.f[sp.k]; if (!f) continue;
    const q = proj(K, sprX(vu, sp), vu.y - sp.y * PXW * vu.bs, vu.pos.z + (sp === vu.sp ? 0 : 6)); if (!q) continue;
    sprFrame(BT.g, sp.S, sp.spec.pal, f, q[0], q[1], q[2] * PXW * vu.bs, vu.face, alpha);
  }
}
function fxDraw(K) {
  if (!BT.sfx) return;
  for (const a of BT.sfx) {
    const f = a.tl[a.k]; if (!f || f[0] < 0) continue;
    const q = proj(K, a.x, -a.y, a.z); if (!q) continue;
    const fade = a.life > SPR_FX_LIFE - 20 ? (SPR_FX_LIFE - a.life) / 20 : 1;
    sprFrame(BT.g, a.S, a.pal, f, q[0], q[1], q[2] * PXW * a.bs, a.face, fade);
  }
}
// battle timing for a move: ms from its start to hit h (moves with fewer hits than the skill spread the rest out)
function sprHitAt(R, h) {
  const hits = (R && R.hits) || [];
  if (!hits.length) return 260 + h * 120;
  if (h < hits.length) return hits[h][0] * 1000 / 60;
  return (hits[hits.length - 1][0] + (h - hits.length + 1) * 7) * 1000 / 60;
}
const sprReach = R => (R && R.hits && R.hits.length ? Math.max(30, R.hits[0][1]) : 70) * PXW;

// one of a character's own voice lines (their win or entrance lines) for menus: the home partner, Tatari reveals
function charVoice(op, roles = ["win", "intro"]) {
  const P = op && spritePack(op.base), st = P && P.st[op.style[0].toLowerCase()]; if (!st) return false;
  const lines = [];
  for (const r of roles) for (const f of (st[r] && st[r].f) || []) for (const i of f[12] || []) for (const n of P.snd[i] || []) if (n.startsWith("vo/")) lines.push(n);
  return lines.length ? clip(lines[Math.floor(Math.random() * lines.length)]) : false;
}
// frame of a looping role `ticks` after it started (for scenes outside battle, like the title screen)
function sprLoopFrame(R, ticks) {
  const f = R.f, start = f.slice(0, Math.max(0, R.loop)).reduce((a, x) => a + x[3], 0), total = f.reduce((a, x) => a + x[3], 0);
  let t = ticks >= total && R.loop >= 0 ? start + (ticks - start) % Math.max(1, total - start) : Math.min(ticks, total - 1);
  for (const x of f) { if (t < x[3]) return x; t -= x[3]; }
  return f[f.length - 1];
}

// ---------- menu art: MBAACC character-select art, head crops and Arc Drive cut-ins ----------
const mbArt = base => (typeof MBART !== "undefined" && MBART.chars[base]) || null;

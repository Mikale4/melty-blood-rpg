
// =====================================================================
//  BATTLE DIRECTOR — animation, camera choreography, S3 cut-ins, HUD
// =====================================================================
const VU = uid => BT.vus.get(uid);
const avg = a => a.reduce((s, v) => s + v, 0) / (a.length || 1);
BT.slashes = [];

// ---------- camera shots: always near side-on; they zoom and pan along the battle line ----------
const aspect = () => BT.W / BT.H;
// pixels the framed subject sits above the screen centre, so it clears the bottom controls
const frameOff = () => { const land = aspect() > 1.05, top = land ? 64 : 84, bot = land ? 112 : 140; return BT.H / 2 - (top + BT.H - bot) / 2; };
// camera distance at which a stretch of the battle line `ext` wide fills the screen (never closer than a standing sprite allows)
const fitW = (ext, fov = BT.home.fov) => {
  // ...and never so close that a standing sprite plus its bars (about 230 units) no longer fits between the HUD bars
  const land = aspect() > 1.05, band = Math.max(120, BT.H - (land ? 176 : 224)), focal = (BT.H / 2) / Math.tan(fov / 2);
  return Math.max(ext / (2 * Math.tan(fov / 2) * aspect()), 230 * focal / band);
};
const fitDist = (extent, minD, fov = BT.home.fov) => Math.max(minD * .6, fitW(extent, fov));
function lineShot(xs, zs, pad, a, yawK, ty = 62) {
  const x0 = Math.min(...xs), x1 = Math.max(...xs), h = BT.home;
  const dist = Math.min(h.dist, fitW(x1 - x0 + pad));
  const focal = (BT.H / 2) / Math.tan(h.fov / 2);
  return { ...h, tx: (x0 + x1) / 2, tz: avg(zs), ty: ty - frameOff() * dist / focal, yaw: h.yaw + (a ? a.dir * yawK : 0), dist };
}
function focusShot(vu) { return { ...lineShot([vu.pos.x], [vu.pos.z], 250, vu, .1, 70 * vu.bs), pitch: BT.home.pitch * .5, roll: -vu.dir * .02 }; }
function impactShot(a, t) { return lineShot([a.pos.x, t.pos.x], [a.pos.z, t.pos.z], 240, a, .08); }
function aoeShot(ts, a) { return lineShot([a.pos.x, ...ts.map(t => t.pos.x)], ts.map(t => t.pos.z), 220, a, .06); }
function twoShot(a, t) {
  const h = BT.home;
  if (!t || t === a) return { ...h, tx: lerp(h.tx, a.pos.x, .15), yaw: h.yaw + a.dir * .03 };
  return lineShot([a.pos.x, t.pos.x], [a.pos.z, t.pos.z], 420, a, .05);
}

// ---------- movement ----------
async function moveTo(vu, x, z, speedMul = 1) {
  const sx = vu.pos.x, sz = vu.pos.z, d = Math.hypot(x - sx, z - sz);
  if (d < 4) return;
  // a short retreat is a backstep that keeps facing the foe; anything else turns and runs
  const hop = vu.sp && Math.sign(x - sx) === -vu.dir && d < 150;
  vu.face = hop ? vu.dir : Math.sign(x - sx) || vu.dir;
  if (hop) sprPlay(vu, "back"); else setPose(vu, "run", 0, false);
  const dur = hop ? 420 / speedMul : clamp(d * 1.0, 170, 480) / speedMul;
  await btween(dur, k => { vu.pos.x = lerp(sx, x, k); vu.pos.z = lerp(sz, z, k); vu.y = hop ? Math.sin(k * Math.PI) * 26 : vu.sp ? 0 : Math.sin(k * Math.PI) * 8; });
  vu.y = 0; vu.face = vu.dir; setPose(vu, "idle");
}
async function engage(a, t) {
  const x = t.pos.x - a.dir * 70 * t.bs, z = t.pos.z + (a.pos.z > t.pos.z ? 6 : -6);
  if (Math.hypot(a.pos.x - x, a.pos.z - z) < 12) return;
  await moveTo(a, x, z, 1.15);
}
async function returnHome() {
  const list = [...BT.vus.values()].filter(vu => !vu.dead && (Math.hypot(vu.pos.x - vu.home.x, vu.pos.z - vu.home.z) > 3 || vu.y > 1));
  await Promise.all(list.map(async vu => {
    if (vu.y > 1) { const y0 = vu.y; await btween(160, k => { vu.y = y0 * (1 - k); }); }
    await moveTo(vu, vu.home.x, vu.home.z, 1.25);
    vu.face = vu.dir;
  }));
}

// ---------- fx helpers ----------
const elc = vu => ELC[vu.u.el] || "#ffffff";
function sparks(vu, col, n = 14) { addParts(chestW(vu), n, { col, speed: 220, life: 380, size: 2.6, g: 380, spread: 10 }); }
function slashAt(vu, col, big) { BT.slashes.push({ p: chestW(vu), t0: BT.clock, dur: 260, col, rot: R() * Math.PI, big }); }
function drawSlashes(K) {
  const g = BT.g;
  BT.slashes = BT.slashes.filter(s => BT.clock - s.t0 < s.dur);
  for (const s of BT.slashes) {
    const p = proj(K, ...s.p); if (!p) continue;
    const k = (BT.clock - s.t0) / s.dur, r = (s.big ? 70 : 46) * p[2] * (.7 + k * .5);
    g.save(); g.translate(p[0], p[1]); g.rotate(s.rot + k * .6); g.globalCompositeOperation = "lighter"; g.globalAlpha = 1 - k;
    g.lineCap = "round";
    g.strokeStyle = s.col; g.lineWidth = 10 * p[2] + 2; g.beginPath(); g.arc(0, 0, r, -1.1, 1.1); g.stroke();
    g.strokeStyle = "#fff"; g.lineWidth = 3 * p[2] + 1; g.beginPath(); g.arc(0, 0, r, -.9, .9); g.stroke();
    g.restore();
  }
}
async function fireBolt(a, t, opts = {}) {
  const from = opts.from || tipW(a);
  const to = chestW(t); to[0] += (R() - .5) * 10; to[1] += (R() - .5) * 14;
  const d = Math.hypot(to[0] - from[0], to[1] - from[1], to[2] - from[2]), dur = clamp(d / (opts.speed || 2.4), 80, 320);
  BT.bolts.push({ from, to, t0: BT.clock, dur, col: opts.col || elc(a), len: opts.len || .32, w: opts.w || 1 });
  addParts(from, 5, { col: "#ffe2a0", speed: 60, life: 160, size: 3, g: 0 });
  if (opts.sound !== "none") sfx(opts.sound || "arts");
  await bwait(dur);
  addParts(to, opts.big ? 22 : 9, { col: opts.col || elc(a), speed: opts.big ? 220 : 160, life: 340, size: opts.big ? 3.6 : 2.4, g: 200 });
}
function auraBurst(vu, col, ring = true) {
  vu.aura = BT.clock + 900; vu.auraCol = col;
  if (ring) BT.rings.push({ x: vu.pos.x, z: vu.pos.z, r0: 10, r1: 70, t0: BT.clock, dur: 700, col, w: 3 });
  addParts([vu.pos.x, 10, vu.pos.z], 16, { col, speed: 40, vy: 110, life: 800, size: 2.4, g: -20, spread: 40 });
}
function warpFx(v) {
  BT.rings.push({ x: v.home.x, z: v.home.z, r0: 50, r1: 8, t0: BT.clock, dur: 600, col: v.team === "A" ? "#5fd4ff" : "#ff6a5a", w: 3 });
  addParts([v.home.x, 0, v.home.z], 18, { col: v.team === "A" ? "#9fe0ff" : "#ffb0a0", speed: 30, vy: 200, life: 700, size: 2.2, g: 0, spread: 24 });
}
function cutIn(vu, skillName) {
  const wrap = $(".bwrap"); if (!wrap) return;
  const d = (950 / BT.speed / 1000).toFixed(2) + "s";
  // MBAACC's own Arc Drive cut-in art for this Moon style where the character has it
  const A = vu.sp && mbArt(vu.sp.spec.key), cut = A && A.cut && (A.cut[vu.sp.spec.st] || A.cut.h);
  const src = cut || (vu.u.isOp ? opArt(vu.u.key) : enemyArt(vu.u.key)).full;
  const el = document.createElement("div");
  el.className = "cutin" + (cut ? " mb" : ""); el.style.setProperty("--ec", elc(vu));
  el.innerHTML = `<div class="band" style="animation-duration:${d}"></div><div class="lines" style="animation-duration:${d}"></div>
    <img src="${src}" alt="" style="animation-duration:${d};${vu.team === "E" ? "left:auto;right:-10%;transform:scaleX(-1)" : ""}">
    <div class="sk" style="animation-duration:${d}"><small>${esc(vu.u.n)} · Arc Drive</small><b>${esc(skillName)}</b></div>`;
  wrap.appendChild(el);
  setTimeout(() => el.remove(), 1000 / BT.speed + 60);
}

// ---------- playback ----------
async function gate() { while (BT.paused && BT.on) await new Promise(r => setTimeout(r, 120)); }
async function play(evs) {
  for (let i = 0; i < evs.length; i++) { if (BT.quit || !BT.on) return; await gate(); await handle(evs[i]); }
}
function updateStrip() {
  const el = $("#bStrip"); if (!el || !BT.B) return;
  el.innerHTML = BT.B.predictOrder(7).map(uid => { const u = BT.B.byId(uid); return `<img class="${u.team === "E" ? "en" : ""}" src="${u.isOp ? opArt(u.key).head : enemyArt(u.key).head}" alt="">`; }).join("");
}
// Magic Circuit meters: three 100% segments per side
function mcHTML(id, foe) {
  return `<div class="mcbar ${foe ? "foe" : ""}" id="${id}"><div class="lab">${foe ? "Enemy circuit" : "Magic Circuit"}<b>0%</b></div><div class="segs">${'<div class="seg"><i></i></div>'.repeat(3)}</div></div>`;
}
function updMC(A, E) {
  for (const [id, v] of [["mcA", A], ["mcE", E]]) {
    const el = document.getElementById(id); if (!el) continue;
    el.querySelector("b").textContent = Math.floor(v) + "%";
    el.querySelectorAll(".seg").forEach((s, k) => { const f = clamp((v - k * 100) / 100, 0, 1); s.firstChild.style.width = f * 100 + "%"; s.classList.toggle("full", f >= 1); });
    el.classList.toggle("heat", v >= 300);
  }
}
async function handle(e) {
  const vu = e.u != null ? VU(e.u) : null;
  switch (e.k) {
    case "mc": updMC(e.A, e.E); break;
    case "turn": {
      BT.active = vu;
      if (e.tms) for (const [uid, tm] of e.tms) { const v = VU(uid); if (v) v.tmT = tm; }
      if (vu) { vu.tmT = 0; camTo(twoShot(vu, null), 1.6); }
      updateStrip();
      await bwait(140);
      break;
    }
    case "wave": {
      for (const [uid, v] of BT.vus) if (v.team === "E" && v.dead) BT.vus.delete(uid);
      const list = e.units.map(uid => addVU(BT.B.byId(uid), true));
      await Promise.all(list.map(v => sprAttach(v).catch(() => {})));
      banner(e.w + 1 === BT.B.waves.length ? "Final Round" : `Round ${e.w + 1}`, "Fight!", "ds");
      BT.letterboxT = 1;
      camTo({ ...BT.home, tx: 200, yaw: BT.home.yaw - .1, dist: BT.home.dist * .75, pitch: BT.home.pitch + .06 }, 2.2);
      await bwait(350); sfx("warp");
      list.forEach((v, k) => { v.spawnT = BT.clock + k * 110; bwait(k * 110).then(() => { warpFx(v); if (v.sp) sprPlay(v, "intro"); }); });
      await bwait(1000);
      BT.letterboxT = 0; hideBanner(); camHome(2.4);
      updateStrip();
      await bwait(300);
      break;
    }
    case "act": {
      BT.act = e; if (!vu) break;
      const tv = e.t != null ? VU(e.t) : null;
      if (vu.sp) { await spriteAct(e, vu, tv); break; }
      if (e.s3) {
        BT.letterboxT = 1; sfx("special");
        cutIn(vu, e.name);
        camTo(focusShot(vu), 5.5);
        setPose(vu, e.anim === "orb" || e.anim === "nova" ? "cast" : "buff", 800);
        auraBurst(vu, elc(vu), false);
        await bwait(950);
      } else if (e.slot === 2) {
        banner(e.name, vu.u.n, vu.team === "A" ? "ls" : "ds");
        camTo(tv && tv !== vu ? twoShot(vu, tv) : focusShot(vu), 3.2);
        await bwait(420);
      } else { camTo(twoShot(vu, tv), 2.4); await bwait(90); }
      if (e.anim === "buff" || e.anim === "heal") {
        const col = e.anim === "heal" ? "#5dfc9b" : "#f2c14e";
        setPose(vu, "buff", 700); sfx(e.anim === "heal" ? "heal" : "special");
        const group = e.tgt === "team" || e.tgt === "aoe_allies" ? [...BT.vus.values()].filter(v => v.team === vu.team && !v.dead) : tv ? [tv] : [vu];
        if (group.length > 1) camTo(aoeShot(group, vu), 3);
        if (e.tgt === "ally_single" && tv && tv !== vu) BT.bolts.push({ from: tipW(vu), to: chestW(tv), t0: BT.clock, dur: 260, col, len: .9, w: 1.4 });
        for (const v of group) auraBurst(v, col);
        await bwait(600);
      }
      break;
    }
    case "atk": await doAttack(e); break;
    case "dmg": {
      if (!vu) break;
      const lostHp = e.hp < vu.hp;
      vu.hp = e.hp; vu.sh = e.sh;
      floatText(e.u, fmtFull(e.n), e.crit ? "crit" : e.dot ? "dot" : e.glance ? "prot" : lostHp ? "dmg" : "prot");
      if (e.glance) floatText(e.u, "GLANCING", "txt");
      if (e.dot) { addParts(chestW(vu), 8, { col: "#ff8a3a", speed: 50, vy: 40, life: 600, size: 2.6, g: -30 }); await bwait(300); break; }
      vu.flash = BT.clock + 160;
      if (vu.hp > 0) setPose(vu, vu.sp && e.glance ? "guard" : "hit", 340);
      if (vu.sp && vu.hp > 0) vu.pos.x -= vu.dir * (e.crit ? 9 : 5);
      const heard = BT.hitSnd != null && BT.clock - BT.hitSnd < 80;   // a sprite move just played its own impact
      if (e.crit) { BT.shake = Math.max(BT.shake, 9); sfx("crit"); } else if (!heard) sfx("hit");
      await bwait(45);
      break;
    }
    case "heal": {
      if (!vu) break;
      vu.hp = e.hp; vu.sh = e.sh;
      floatText(e.u, "+" + fmtFull(e.n), e.isShield ? "prot" : "heal");
      addParts([vu.pos.x, 30, vu.pos.z], 8, { col: e.isShield ? "#c8ffd6" : "#5dfc9b", speed: 30, vy: 90, life: 700, size: 2.2, g: -10, spread: 30 });
      await bwait(60);
      break;
    }
    case "txt": if (vu) { floatText(e.u, e.s, e.c); await bwait(e.s === "STUNNED" ? 420 : 70); } break;
    case "fx": if (vu) { vu.effs = e.list; vu.sh = e.sh; vu.stealth = e.list.some(x => x[0] === "STEALTH"); } break;
    case "tm": if (vu) { vu.tmT = e.tm; if (!e.quiet && e.v >= 20) floatText(e.u, `+${Math.round(e.v)}% ATB`, "txt"); else if (!e.quiet && e.v <= -10) floatText(e.u, `${Math.round(e.v)}% ATB`, "debuff"); } updateStrip(); break;
    case "death": {
      if (!vu) break;
      vu.dead = true; vu.deathT = BT.clock; vu.hp = 0; vu.sh = 0; vu.effs = [];
      if (vu.sp) sprPlay(vu, "down", null);
      addParts(chestW(vu), 26, { col: vu.team === "A" ? "#9fd8ff" : "#ffb0a0", speed: 90, vy: 60, life: 1100, size: 2.4, g: -40, spread: 26 });
      BT.shake = Math.max(BT.shake, 5);
      if (BT.target === vu) BT.target = null;
      updateStrip();
      await bwait(220);
      break;
    }
    case "revive": {
      if (!vu) break;
      vu.dead = false; vu.gone = false; vu.hp = e.hp; vu.lag = e.hp; vu.sh = 0; vu.effs = [];
      if (!e.inPlace) { vu.pos.x = vu.home.x; vu.pos.z = vu.home.z; vu.spawnT = BT.clock; }
      if (vu.sp) sprPlay(vu, "intro");
      warpFx(vu); auraBurst(vu, "#ffd76b"); floatText(e.u, "REVIVED", "buff");
      updateStrip();
      await bwait(500);
      break;
    }
    case "end": {
      if (BT.sk) {
        // let the move (and the effects it threw) play out before everyone returns to their places
        const sk = BT.sk, endAt = sk.t0 + ((sk.R && sk.R.len) || 50) * 1000 / 60;
        await bwait(clamp(endAt - BT.clock, 0, 1300));
        BT.sk = null;
      }
      await returnHome();
      if (BT.letterboxT) { BT.letterboxT = 0; }
      hideBanner(); camHome(2.4); BT.act = null;
      await bwait(130);
      break;
    }
  }
}
// projectile look and sound follow the weapon: arrows and bolts, gunfire tracers, or Originium Arts
function shotStyle(a, col) {
  const w = a.u.def.fig && a.u.def.fig.w;
  if (w === "bow" || w === "bowcaster" || a.u.key === "crossbow") return { col: "#efe6d2", len: .09, w: .5, speed: 3.6, sound: "bow" };
  if (w === "rifle" || w === "pistols" || w === "pistol") return { col: "#ffe2a0", len: .16, w: .42, speed: 4.6, sound: "shot" };
  return { col, sound: "arts", speed: 2.6 };
}
// ---------- MBAACC sprite units: Tales-style approach, the real move, damage on its hit frames ----------
// stand where the move's first hit reaches the nearest foe (never backing away from it)
async function closeIn(vu, R, foes, speedMul = 1.15) {
  const near = foes.reduce((a, b) => Math.abs(b.pos.x - vu.pos.x) < Math.abs(a.pos.x - vu.pos.x) ? b : a);
  let x = near.pos.x - vu.dir * Math.max(34, sprReach(R) * vu.bs - 18 * near.bs);
  if ((x - vu.home.x) * vu.dir < 0) x = vu.home.x;
  if (Math.abs(x - vu.pos.x) > 10) await moveTo(vu, x, near.pos.z + (vu.pos.z > near.pos.z ? 5 : -5), speedMul);
  vu.face = vu.dir;
  return near;
}
async function spriteAct(e, vu, tv) {
  const role = "s" + e.slot, R = sprRole(vu.sp, role);
  const support = e.anim === "buff" || e.anim === "heal";
  const foes = support ? [] : e.tgt === "aoe_enemies" ? [...BT.vus.values()].filter(v => v.team !== vu.team && !v.dead) : tv && tv.team !== vu.team ? [tv] : [];
  if (e.s3) {
    BT.letterboxT = 1; sfx("special");
    cutIn(vu, e.name); camTo(focusShot(vu), 5.5); auraBurst(vu, elc(vu), false);
    await bwait(950);
  } else if (e.slot === 2) banner(e.name, vu.u.n, vu.team === "A" ? "ls" : "ds");
  if (foes.length) {
    camTo(foes.length > 1 ? aoeShot(foes, vu) : impactShot(vu, foes[0]), e.s3 ? 3.4 : 2.6);
    await closeIn(vu, R, foes);
  } else camTo(tv && tv !== vu ? twoShot(vu, tv) : focusShot(vu), 3.2);
  sprPlay(vu, role);
  BT.sk = { vu, R, t0: BT.clock };
  if (support) {
    const col = e.anim === "heal" ? "#5dfc9b" : "#f2c14e";
    sfx(e.anim === "heal" ? "heal" : "special");
    const group = e.tgt === "team" || e.tgt === "aoe_allies" ? [...BT.vus.values()].filter(v => v.team === vu.team && !v.dead) : tv ? [tv] : [vu];
    if (group.length > 1) camTo(aoeShot(group, vu), 3);
    await bwait(Math.min(700, sprHitAt(R, 0)));
    for (const v of group) auraBurst(v, col);
    await bwait(300);
  }
}
async function spriteHit(e, a, ts) {
  let sk = BT.sk;
  if (!sk || sk.vu !== a) {
    // a Shield Counter (or a hit outside the unit's own action) answers with the S1 move
    const R = sprRole(a.sp, "s1");
    camTo(impactShot(a, ts[0]), 3);
    await closeIn(a, R, ts, 1.4);
    sprPlay(a, "s1"); sk = { vu: a, R, t0: BT.clock };
  }
  await bwait(Math.max(0, sk.t0 + sprHitAt(sk.R, e.h || 0) - BT.clock));
  for (const t of ts) sparks(t, elc(a), e.sp ? 12 : 7);
  if (e.sp && !e.h) BT.shake = Math.max(BT.shake, 6);
  // the move's own impact sound for this hit (a tag team's partner hits with hers)
  const hs = (sk.R && sk.R.hits) || [], hh = hs[Math.min(e.h || 0, hs.length - 1)];
  if (hh && hh[2] >= 0) sprSound(hh[3] && a.sp2 ? a.sp2.S : a.sp.S, [hh[2]]); else sfx(e.aoe ? "boom" : "hit");
  BT.hitSnd = BT.clock;
}
async function doAttack(e) {
  const a = VU(e.a), ts = e.t.map(VU).filter(v => v && !v.dead);
  if (!a || a.dead || !ts.length) return;
  if (a.sp) return spriteHit(e, a, ts);
  const main = ts[0], sp = e.sp, col = elc(a), first = !e.h;
  switch (e.anim) {
    case "melee": {
      await engage(a, main);
      if (sp && first) camTo(impactShot(a, main), 5);
      setPose(a, "swing", e.n > 2 ? 300 : 420); sfx("saber");
      await bwait(e.n > 2 ? 140 : 200);
      slashAt(main, col, sp); sparks(main, col);
      if (sp) BT.shake = Math.max(BT.shake, 6);
      break;
    }
    case "spin": {
      if (first) { await moveTo(a, avg(ts.map(t => t.home.x)) - a.dir * 100, 0, 1.2); if (sp) camTo(aoeShot(ts, a), 4); }
      a.spin = BT.clock; setPose(a, "swing", 520); sfx("saber");
      await bwait(260);
      for (const t of ts) { slashAt(t, col, true); sparks(t, col, 8); }
      BT.shake = Math.max(BT.shake, 7);
      bwait(260).then(() => { a.spin = null; });
      break;
    }
    case "shoot": {
      if (sp && first) camTo(impactShot(a, main), 4);
      setPose(a, "shoot", 260);
      await bwait(40);
      await fireBolt(a, main, shotStyle(a, col));
      break;
    }
    case "volley": {
      if (first && sp) camTo(aoeShot(ts, a), 4);
      setPose(a, "shoot", 300);
      const st = shotStyle(a, col);
      await Promise.all(ts.map(async (t, k) => { await bwait(k * 70); await fireBolt(a, t, { ...st, sound: k ? "none" : st.sound }); }));
      break;
    }
    case "orb": {
      if (sp && first) camTo(impactShot(a, main), 4);
      setPose(a, "cast", 520);
      await bwait(150);
      await fireBolt(a, main, { col, len: .14, w: 2.6, speed: 1.7, big: true, sound: "arts" });
      BT.rings.push({ x: main.pos.x, z: main.pos.z, r0: 8, r1: 60, t0: BT.clock, dur: 400, col, w: 4 });
      break;
    }
    case "nova": {
      if (first) { setPose(a, "cast", 900); if (sp) camTo(aoeShot(ts, a), 4); await bwait(180); }
      const cx = avg(ts.map(t => t.pos.x)), cz = avg(ts.map(t => t.pos.z));
      if (first) { BT.rings.push({ x: cx, z: cz, r0: 30, r1: 260, t0: BT.clock, dur: 520, col, w: 5 }); sfx("boom"); }
      else sfx("zap");
      await bwait(first ? 260 : 120);
      for (const t of ts) { addParts([t.pos.x, 4, t.pos.z], 18, { col, speed: 60, vy: 260, life: 560, size: 3.2, g: 80, spread: 20 }); slashAt(t, col, false); }
      if (first) { BT.flash = .35; BT.flashCol = col; BT.shake = Math.max(BT.shake, 10); }
      break;
    }
    default: { setPose(a, "shoot", 300); await fireBolt(a, main, shotStyle(a, col)); }
  }
}

// ---------- HUD ----------
function skillIcon(u, sk) {
  if (!sk) return IC.boost;
  const ef = sk.effects || [];
  if (sk.target === "ally_single" || ef.some(e => /heal|revive/.test(e.type))) return IC.heal;
  if (ef.some(e => e.what === "TAUNT" || e.type === "shieldCasterHP")) return IC.shield;
  if (sk.target === "self" || sk.target === "team" || sk.target === "aoe_allies") return IC.boost;
  if (u.cls === "Sniper") return IC.bow;
  if (MELEE.has(u.cls)) return IC.sword;
  return IC.orb;
}
function banner(name, sub, cls) { const b = $("#bBan"); if (!b) return; b.className = "bban show " + (cls || "") + (name.length > 22 ? " long" : ""); b.innerHTML = `<small>${esc(sub)}</small><b>${esc(name)}</b>`; }
function hideBanner() { const b = $("#bBan"); if (b) b.className = "bban"; }
function hideControls(txt = "") { BT.picking = false; BT.allyPick = null; const c = $("#bCtl"); if (c) c.innerHTML = txt ? `<div class="bwait">${txt}</div>` : ""; }
function showControls(u) {
  const B = BT.B;
  BT.picking = true; BT.allyPick = null;
  const valid = B.targetable(u);
  if (!BT.target || BT.target.dead || !valid.includes(BT.target.u)) {
    const best = valid.slice().sort((a, b) => a.hp / a.max.hp - b.hp / b.max.hp)[0];
    BT.target = best ? VU(best.uid) : null;
  }
  const c = $("#bCtl");
  c.innerHTML = `<div class="bwho"><img class="bpt" src="${opArt(u.key).head}" alt=""><div class="bwn"><b>${esc(u.n)}</b><small id="bHint">Tap an enemy to target · hold for details</small></div></div>
    <div class="babs">${[1, 2, 3].map(slot => {
      const sk = u.skills.find(s => s.slot === slot); if (!sk) return "";
      const ok = B.usable(u, slot), cd = u.cool[slot] || 0;
      const lock = sk.arc ? `${Math.floor(B.mc[u.team])}%` : cd || "✕";
      return `<button class="skbtn s${slot} ${ok ? (slot === 3 ? "ready" : "") : "off"}" data-s="${slot}" aria-label="${esc(sk.name)}">${skillIcon(u, sk)}${!ok ? `<span class="cdv">${lock}</span>` : ""}<span class="alabel">${sk.arc ? "ARC" : "S" + slot}</span></button>`;
    }).join("")}</div>`;
  for (const btn of $$(".skbtn", c)) {
    const slot = +btn.dataset.s, sk = u.skills.find(s => s.slot === slot);
    press(btn, () => {
      if (!B.usable(u, slot)) { sfx("tap"); popup(skillPop(u, sk)); return; }
      if (!BT.inputRes) return;
      sfx("tap");
      if (sk.target === "ally_single") {
        BT.allyPick = slot; $$(".skbtn", c).forEach(b => b.classList.toggle("picking", b === btn));
        const h = $("#bHint"); if (h) h.textContent = "Tap an ally to use " + sk.name;
        return;
      }
      const r = BT.inputRes; BT.inputRes = null; hideControls();
      r({ slot, t: sk.target === "enemy" && BT.target ? BT.target.u : null });
    }, () => popup(skillPop(u, sk)));
  }
}
function skillPop(u, sk) {
  const cd = u.cool[sk.slot] || 0, rank = u.sk[sk.slot - 1] || 1;
  const mc = BT.B ? Math.floor(BT.B.mc[u.team]) : 0;
  return `<div class="eyebrow">${sk.arc ? "Arc Drive" : "S" + sk.slot} · Level ${rank}${sk.cd ? ` · Cooldown ${sk.cd}` : ""}</div><h3 style="margin:4px 0 6px">${esc(sk.name)}</h3>
    <p class="small">${esc(sk.desc)}</p>${cd ? `<p class="small" style="margin-top:6px;color:var(--debuff)">Ready in ${cd} turn${cd > 1 ? "s" : ""}.</p>` : ""}
    ${sk.arc && mc < sk.arc ? `<p class="small" style="margin-top:6px;color:var(--debuff)">Needs ${sk.arc}% Magic Circuit. Your squad has ${mc}%.</p>` : ""}`;
}
function unitPop(u) {
  const B = BT.B, e = B.effStat;
  return `<div class="row"><img class="bpt" src="${u.isOp ? opArt(u.key).head : enemyArt(u.key).head}" alt=""><div><div class="eyebrow">${u.team === "A" ? "Your squad" : "Enemy"}${u.boss ? " · Boss" : ""}</div><h3>${esc(u.n)}</h3>
    <div class="row" style="gap:4px;margin-top:3px"><span class="el ${u.el}">${u.el}</span>${u.style ? `<span class="el sty">${styleName(u.style)}</span>` : ""}<span class="cls">${clsName(u.cls)}</span></div></div></div>
    <div class="statgrid" style="margin-top:10px">
      <div><span>HP</span><b>${fmtFull(u.hp)} / ${fmtFull(u.max.hp)}</b></div><div><span>Bounded Field</span><b>${fmtFull(u.shield)}</b></div>
      <div><span>ATK</span><b>${fmtFull(e.atk(u))}</b></div><div><span>DEF</span><b>${fmtFull(e.def(u))}</b></div>
      <div><span>SPD</span><b>${Math.round(e.spd(u))}</b></div><div><span>Crit Rate</span><b>${pct(e.cr(u))}</b></div>
      <div><span>Accuracy</span><b>${pct(u.max.acc)}</b></div><div><span>Resistance</span><b>${pct(u.max.res)}</b></div>
    </div>
    ${u.eff.length ? `<div class="stack" style="gap:4px;margin-top:10px">${u.eff.map(x => `<div class="small"><span class="tag ${FX[x.id].b ? "ls" : "ds"}">${FX[x.id].n}</span> <span class="dim">${FX[x.id].d} · ${x.turns}T</span></div>`).join("")}</div>` : `<p class="tiny dim" style="margin-top:10px">No active effects.</p>`}
    ${[...u.sets].length ? `<p class="small" style="margin-top:8px"><b class="gold">Mystic Codes:</b> <span class="dim">${[...u.sets].map(s => `${setName(s)} (${RUNE_INFO[s]})`).join(", ")}</span></p>` : ""}
    ${u.passives.length ? `<p class="small" style="margin-top:6px"><b class="gold">Personal Skill:</b> <span class="dim">${u.passives.map(p => esc(p.text || p.id)).join(" ")}</span></p>` : ""}`;
}
function popup(html) {
  const p = $("#bPop"); if (!p) return;
  p.innerHTML = `<div class="bpopbox">${html}<button class="btn ghost sm wide" style="margin-top:12px" id="bPopX">Close</button></div>`;
  p.hidden = false;
  $("#bPopX").onclick = () => { p.hidden = true; };
  p.onclick = ev => { if (ev.target === p) p.hidden = true; };
}
function press(el, onTap, onHold) {
  let timer = 0, held = false, sx = 0, sy = 0;
  el.addEventListener("pointerdown", ev => { held = false; sx = ev.clientX; sy = ev.clientY; clearTimeout(timer); timer = setTimeout(() => { held = true; onHold && onHold(ev); }, 430); });
  el.addEventListener("pointermove", ev => { if (Math.hypot(ev.clientX - sx, ev.clientY - sy) > 12) clearTimeout(timer); });
  el.addEventListener("pointerup", ev => { clearTimeout(timer); if (!held) onTap(ev); });
  el.addEventListener("pointercancel", () => clearTimeout(timer));
  el.addEventListener("contextmenu", ev => ev.preventDefault());
}
function unitAt(x, y) {
  let best = null, bd = 1e9;
  for (const vu of BT.vus.values()) {
    if (!vu.scr || vu.dead || vu.gone) continue;
    const s = vu.scr.s, top = vu.scr.y + ((vu.out && (vu.out.top || vu.out.head) ? (vu.out.top || vu.out.head)[1] : -100)) * s;
    const half = 30 * s;
    if (x > vu.scr.x - half - 6 && x < vu.scr.x + half + 6 && y > top - 10 && y < vu.scr.y + 10) {
      const d = Math.abs(x - vu.scr.x) + Math.abs(y - (top + vu.scr.y) / 2) * .5;
      if (d < bd) { bd = d; best = vu; }
    }
  }
  return best;
}

// ---------- lifecycle ----------
function addVU(u, hidden) {
  const slot = SLOTS[u.slot % SLOTS.length], dir = u.team === "A" ? 1 : -1;
  const vu = { uid: u.uid, u, team: u.team, dir, face: dir, home: { x: -dir * slot[0], z: slot[1] }, pos: { x: -dir * slot[0], z: slot[1] }, y: 0,
    bs: u.boss ? 1.22 : 1, pose: { name: "idle", t0: 0, dur: 0 }, ph: R() * 6, hp: u.hp, lag: u.hp, sh: u.shield, tm: u.atb, tmT: u.atb,
    effs: [], stealth: false, dead: false, gone: false, trail: [], spawnT: hidden ? 1e15 : null, out: null,
    sprite: false, asp: 1 };
  BT.vus.set(u.uid, vu);
  return vu;
}
function sizeCanvas() {
  const cv = BT.cv; if (!cv) return;
  const r = cv.parentElement.getBoundingClientRect();
  BT.dpr = Math.min(2, window.devicePixelRatio || 1);
  BT.W = Math.max(200, r.width); BT.H = Math.max(200, r.height);
  cv.width = Math.round(BT.W * BT.dpr); cv.height = Math.round(BT.H * BT.dpr);
  cv.style.width = BT.W + "px"; cv.style.height = BT.H + "px";
  const old = BT.home;
  BT.home = fitHome();
  if (!old) { BT.cam = { ...BT.home }; BT.camT = { ...BT.home }; }
  else Object.assign(BT.camT, BT.home);   // a rotation mid-shot would leave the camera framed for the old shape
}
function startBattle(cfg) {
  const B = makeBattle({ allies: cfg.allies, waves: cfg.waves, auto: S.settings.auto, aiStyle: S.settings.ai });
  Object.assign(BT, { B, cfg, quit: false, paused: false, speed: S.settings.speed, clock: 0, last: 0, parts: [], bolts: [], floats: [], arcs: [], rings: [], nades: [], slashes: [],
    waits: [], tweens: [], target: null, active: null, picking: false, allyPick: null, orbit: false, act: null, inputRes: null, home: null, shake: 0, shx: 0, shy: 0, flash: 0, letterbox: 1, letterboxT: 1,
    sfx: [], sk: null });
  BT.vus = new Map();
  BT.env = buildEnv(cfg.env || "city");
  const root = $("#battle");
  root.innerHTML = `<div class="bwrap">
    <canvas id="bcv"></canvas>
    <div class="btop">
      <div class="bt-title"><small>${esc(cfg.sub || "")}</small><b>${esc(cfg.title || "Battle")}</b></div>
      <button class="tog ${B.auto ? "on" : ""}" id="bAuto" aria-label="Auto battle">AUTO</button>
      <button class="tog" id="bSpd" aria-label="Battle speed">${BT.speed}×</button>
      <button class="tog" id="bPause" aria-label="Pause">II</button>
    </div>
    <div class="turnstrip" id="bStrip"></div>
    ${mcHTML("mcA", false)}${mcHTML("mcE", true)}
    <div class="bban" id="bBan"></div>
    <div class="bctl" id="bCtl"><div class="bwait">Ready…</div></div>
    <div class="bpop" id="bPop" hidden></div>
  </div>`;
  root.hidden = false;
  music(battleMusic(cfg));
  BT.cv = $("#bcv"); BT.g = BT.cv.getContext("2d"); updMC(0, 0);
  sizeCanvas();
  for (const u of B.units) addVU(u, true);
  BT.on = true; BT.raf = requestAnimationFrame(frame);
  $("#bAuto").onclick = () => {
    B.auto = !B.auto; S.settings.auto = B.auto; save(); $("#bAuto").classList.toggle("on", B.auto); sfx("tap");
    if (B.auto && BT.inputRes) { const r = BT.inputRes; BT.inputRes = null; hideControls(); r("auto"); }
  };
  $("#bSpd").onclick = () => { BT.speed = BT.speed >= 3 ? 1 : BT.speed + 1; S.settings.speed = BT.speed; save(); $("#bSpd").textContent = BT.speed + "×"; sfx("tap"); };
  $("#bPause").onclick = () => {
    BT.paused = true; sfx("tap");
    popup(`<h2>Paused</h2><p class="small dim" style="margin:6px 0 12px">${esc(cfg.title || "")}</p>
      <div class="stack" style="gap:8px"><button class="btn wide" id="bRes">Resume</button>
      <button class="btn ghost wide" id="bAi">Auto AI: ${S.settings.ai}</button>
      <button class="btn ghost wide" id="bSnd">Sound: ${S.settings.sound ? "On" : "Off"}</button>
      <button class="btn red wide" id="bQuit">Retreat</button></div>`);
    $("#bPopX").remove();
    const close = () => { $("#bPop").hidden = true; BT.paused = false; };
    $("#bPop").onclick = ev => { if (ev.target === $("#bPop")) close(); };
    $("#bRes").onclick = close;
    $("#bAi").onclick = () => { const order = ["balanced", "aggressive", "safe"]; S.settings.ai = order[(order.indexOf(S.settings.ai) + 1) % 3]; B.aiStyle = S.settings.ai; save(); $("#bAi").textContent = "Auto AI: " + S.settings.ai; };
    $("#bSnd").onclick = () => { S.settings.sound = !S.settings.sound; save(); $("#bSnd").textContent = "Sound: " + (S.settings.sound ? "On" : "Off"); };
    $("#bQuit").onclick = () => { BT.quit = true; BT.paused = false; if (BT.inputRes) { BT.inputRes("quit"); BT.inputRes = null; } closeBattle(); cfg.onQuit && cfg.onQuit(); };
  };
  press(BT.cv, ev => {
    const r = BT.cv.getBoundingClientRect(), vu = unitAt(ev.clientX - r.left, ev.clientY - r.top);
    if (!vu || !BT.picking || !BT.B.waiting) return;
    if (BT.allyPick && vu.team === "A" && BT.inputRes) {
      const r2 = BT.inputRes; BT.inputRes = null; const slot = BT.allyPick; hideControls(); sfx("tap"); r2({ slot, t: vu.u }); return;
    }
    if (vu.team === "E" && BT.B.targetable(BT.B.waiting).includes(vu.u)) { BT.target = vu; sfx("tap"); }
    else popup(unitPop(vu.u));
  }, ev => {
    const r = BT.cv.getBoundingClientRect(), vu = unitAt(ev.clientX - r.left, ev.clientY - r.top);
    if (vu) popup(unitPop(vu.u));
  });
  window.addEventListener("resize", sizeCanvas);
  runBattle();
}
function closeBattle() {
  BT.on = false; cancelAnimationFrame(BT.raf);
  window.removeEventListener("resize", sizeCanvas);
  const root = $("#battle"); root.hidden = true; root.innerHTML = "";
  BT.cv = null; BT.home = null;
  renderTop(); route(UI.view, UI.arg, true);
}
async function intro() {
  const h = BT.home;
  banner(BT.cfg.title || "Battle", BT.cfg.sub || "", "ls");
  // sweep along the battle line: the foes appear, then your squad, each playing its MBAACC entrance
  const appear = v => { warpFx(v); if (v.sp) sprPlay(v, "intro"); };
  camTo({ ...h, tx: 260, ty: 70, yaw: h.yaw - .14, pitch: h.pitch + .14, dist: h.dist * 1.05 }, 1, true);
  const foes = [...BT.vus.values()].filter(v => v.team === "E"), mine = [...BT.vus.values()].filter(v => v.team === "A");
  foes.forEach((v, k) => { v.spawnT = BT.clock + 200 + k * 120; bwait(200 + k * 120).then(() => appear(v)); });
  camTo({ ...h, tx: 190, yaw: h.yaw - .08, pitch: h.pitch + .05, dist: h.dist * .72 }, 1.25);
  sfx("warp");
  await bwait(1050);
  camTo({ ...h, tx: -190, yaw: h.yaw + .08, pitch: h.pitch + .03, dist: h.dist * .7 }, 1.6);
  mine.forEach((v, k) => { v.spawnT = BT.clock + k * 110; bwait(k * 110).then(() => appear(v)); });
  await bwait(1050);
  hideBanner(); BT.letterboxT = 0;
  banner("Fight!", "Ready…", "ds"); sfx("special"); bwait(900).then(() => { if (BT.on && !BT.act) hideBanner(); });
  camHome(1.8);
  updateStrip();
  await bwait(500);
}
async function runBattle() {
  const B = BT.B;
  await Promise.all([...BT.vus.values()].map(v => sprAttach(v).catch(() => {})));
  if (!BT.on) return;
  await intro();
  hideControls();
  await play(B.ev.splice(0));
  while (!B.over && !BT.quit && BT.on) {
    const r = B.step();
    if (r === "input") {
      await play(B.ev.splice(0));
      if (BT.quit || !BT.on) return;
      if (B.auto) B.autoAct();
      else {
        camHome(3);
        const ch = await new Promise(res => { BT.inputRes = res; showControls(B.waiting); });
        if (ch === "quit" || BT.quit) return;
        if (ch === "auto") B.autoAct(); else B.playerAct(ch.slot, ch.t);
      }
      hideControls();
    }
    await play(B.ev.splice(0));
  }
  if (BT.quit || !BT.on) return;
  await outro();
}
async function outro() {
  const B = BT.B, res = B.result, h = BT.home;
  hideControls(); BT.active = null;
  await bwait(250);
  const mine = [...BT.vus.values()].filter(v => v.team === "A" && !v.dead);
  if (res.win) {
    for (const v of mine) setPose(v, "victory", 0, false);
    camTo({ ...lineShot(mine.map(v => v.pos.x), mine.map(v => v.pos.z), 260, mine[0], .1), pitch: h.pitch * .6 }, 1.8);
    music("win"); sfx("win"); banner("K.O.", "You win", "ls");
  } else {
    const foes = [...BT.vus.values()].filter(v => v.team === "E" && !v.dead);
    for (const v of foes) setPose(v, "victory", 0, false);
    camTo({ ...lineShot(foes.map(v => v.pos.x), foes.map(v => v.pos.z), 260, foes[0], .1), pitch: h.pitch * .6 }, 1.4);
    music("lose"); sfx("lose"); banner("K.O.", "You lose", "ds");
  }
  BT.letterboxT = 1;
  await bwait(1600);
  hideBanner();
  recordBattle(res, B);
  const out = res.win ? BT.cfg.onWin(res, B) : (BT.cfg.onLose ? BT.cfg.onLose(res, B) : { rewards: [] });
  save();
  const el = document.createElement("div");
  el.className = "result";
  const missions = out.missions || null;
  el.innerHTML = `<div class="eyebrow">${esc(BT.cfg.sub || "")}</div>
    <h1 class="${res.win ? "gold" : "ds"}">${res.win ? "You Win" : "You Lose"}</h1>
    ${missions ? `<div class="bigstars">${[0, 1, 2].map(k => `<span class="${missions[k].ok ? "on" : ""}">${missions[k].ok ? IC.star : IC.starOff}</span>`).join("")}</div>
      <div class="stack" style="gap:4px;text-align:left">${missions.map(m => `<div class="mission">${m.ok ? IC.check : IC.cross}<span>${esc(m.n)}</span></div>`).join("")}</div>` : ""}
    ${!res.win ? `<p class="small dim" style="max-width:34ch">Level up and Ascend your characters, equip Mystic Codes, or try a different Charisma leader and Element matchup.</p>` : ""}
    ${out.rewards && out.rewards.length ? `<div class="rewards">${rewardsHTML(out.rewards)}</div>` : ""}
    <div class="row" style="gap:10px;margin-top:6px">
      ${BT.cfg.retry ? `<button class="btn ghost" id="rRetry">Retry</button>` : ""}
      <button class="btn" id="rDone">Continue</button>
    </div>`;
  $(".bwrap").appendChild(el);
  $("#rDone").onclick = () => { closeBattle(); BT.cfg.onClose && BT.cfg.onClose(res); };
  if ($("#rRetry")) $("#rRetry").onclick = () => { const r = BT.cfg.retry; closeBattle(); r(); };
}

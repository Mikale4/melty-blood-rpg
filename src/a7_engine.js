
// =====================================================================
//  BATTLE ENGINE — turn gauges, Element affinity, Moon-style traits, Mystic Codes,
//  statuses, Personal Skills (passives), AI styles and the Magic Circuit, emitting events for the renderer.
// =====================================================================
let UID = 0;
const MELEE = new Set(["Vanguard", "Guard", "Defender", "Specialist"]);
function animFor(u, sk) {
  const t = sk.target;
  if (t === "self" || t === "team" || t === "aoe_allies" || t === "ally_single")
    return (sk.effects || []).some(e => /heal|revive/i.test(e.type)) ? "heal" : "buff";
  const melee = MELEE.has(u.cls) || (u.def.fig && (u.def.fig.type === "slug" || u.def.fig.type === "hound"));
  if (t === "aoe_enemies") return melee ? "spin" : u.cls === "Sniper" ? "volley" : "nova";
  return melee ? "melee" : u.cls === "Sniper" ? "shoot" : "orb";
}

function makeBattle(cfg) {
  const B = { units: [], ev: [], wave: 0, waves: cfg.waves, over: false, result: null, turn: 0, allyTurns: 0, actor: null, waiting: null,
    leaders: { A: null, E: null }, mc: { A: 0, E: 0 }, tally: { arcs: 0, kills: 0 }, auto: !!cfg.auto, aiStyle: cfg.aiStyle || "balanced", depth: 0, pendingWave: false, allyCount: cfg.allies.length, dmgDone: {} };
  const ev = e => B.ev.push(e);
  const has = (u, id) => u.eff.some(e => e.id === id);
  const fxEv = u => {
    const m = {};
    for (const e of u.eff) m[e.id] = (m[e.id] || 0) + 1;
    ev({ k: "fx", u: u.uid, list: Object.entries(m), sh: u.shield });
  };
  const allies = u => B.units.filter(x => x.team === u.team && x.alive);
  const enemies = u => B.units.filter(x => x.team !== u.team && x.alive);
  const pv = (u, id) => u.passives.find(p => p.id === id);

  // ---------- units ----------
  function buildUnit(spec, team, slot) {
    let def, st, sets, sk;
    if (spec.op) {
      def = OPS[spec.op];
      const prog = spec.prog || progForLV(spec.op, spec.LV);
      ({ st, sets } = opStats(spec.op, prog, spec.prog ? null : def.runes));
      sk = prog.sk;
    } else {
      def = ENEMY[spec.en];
      ({ st, sets } = enemyStats(spec.en, spec.LV));
      const r = Math.min(7, 1 + Math.floor(spec.LV / 18)); sk = [r, r, r];
    }
    return { uid: ++UID, key: spec.op || spec.en, def, isOp: !!spec.op, team, slot, n: def.n, el: def.el, style: def.style, cls: def.cls, boss: !!(def.boss || spec.boss),
      max: { ...st }, hp: st.hp, shield: 0, atb: 0, eff: [], cool: { 1: 0, 2: 0, 3: 0 }, skills: def.skills, sk, passives: def.passives || [],
      sets: new Set(sets), leader: def.leader || null, flags: {}, alive: true, provokedBy: null };
  }
  function applyLeader(L, list) {
    if (!L || !L.leader) return;
    const ld = L.leader;
    for (const t of list) {
      if (ld.scope === "Element" && t.el !== ld.element) continue;
      if (ld.stat === "HP") { t.max.hp = Math.round(t.max.hp * (1 + ld.amount)); t.hp = t.max.hp; }
      else if (ld.stat === "ATK") t.max.atk = Math.round(t.max.atk * (1 + ld.amount));
      else if (ld.stat === "DEF") t.max.def = Math.round(t.max.def * (1 + ld.amount));
      else if (ld.stat === "SPD") t.max.spd = Math.round(t.max.spd * (1 + ld.amount));
      else if (ld.stat === "CR") t.max.cr = clamp(t.max.cr + ld.amount, 0, 1);
      else if (ld.stat === "CD") t.max.cd += ld.amount;
      else if (ld.stat === "ACC") t.max.acc = clamp(t.max.acc + ld.amount, 0, 1);
      else if (ld.stat === "RES") t.max.res = clamp(t.max.res + ld.amount, 0, 1);
    }
  }
  function startEffects(list) {
    for (const u of list) {
      if (u.sets.has("Will")) addEff(u, "IMMUNITY", 1, u, true);
      if (u.sets.has("Shield")) { const v = Math.round(u.max.hp * .15); for (const a of list) { a.shield += v; addEff(a, "SHIELD", 3, u, true); } }
      for (const p of u.passives) {
        if (p.id === "TEAM_ATB_START") for (const a of list) a.atb = clamp(a.atb + p.amount * 100, 0, 100);
        else if (p.id === "SELF_ATB_START") u.atb = clamp(u.atb + p.amount * 100, 0, 100);
        else if (p.id === "MC_START") gainMC(u.team, Math.round(p.amount * 100));
        else if (p.id === "START_BUFF") for (const a of p.team ? list : [u]) for (const w of p.what) addEff(a, w, p.turns || 2, u, true);
      }
    }
  }
  function spawnWave(w) {
    B.wave = w;
    const list = B.waves[w].map((s, i) => buildUnit(s, "E", i));
    B.units.push(...list);
    B.leaders.E = list.find(u => u.leader) || null;
    applyLeader(B.leaders.E, list);
    for (const u of list) u.atb = R() * 10;
    ev({ k: "wave", w, units: list.map(x => x.uid) });
    return list;
  }

  // ---------- stats ----------
  const effSpd = u => Math.max(1, u.max.spd * (has(u, "SPD_UP") ? 1.3 : 1) * (has(u, "SLOW") ? .7 : 1));
  const effAtk = u => u.max.atk * (has(u, "ATK_UP") ? 1.5 : 1) * (has(u, "ATK_DOWN") ? .7 : 1);
  const effDef = u => u.max.def * (has(u, "DEF_UP") ? 1.5 : 1) * (has(u, "DEF_BREAK") ? .6 : 1);
  const effCR = u => clamp(u.max.cr + (has(u, "CRIT_RATE_UP") ? .3 : 0), 0, 1);
  const lvMult = (u, slot) => 1 + .06 * ((u.sk[slot - 1] || 1) - 1);
  const cdOf = (u, sk) => Math.max(0, (sk.cd || 0) - ((u.sk[sk.slot - 1] || 1) >= 7 && sk.slot > 1 ? 1 : 0));

  // ---------- effects ----------
  function addEff(u, id, turns, src, quiet) {
    if (!u.alive) return;
    const ex = u.eff.find(x => x.id === id);
    if (id === "DOT" || id === "HOT") u.eff.push({ id, turns, skip: u === B.actor });
    else if (ex) { ex.turns = Math.max(ex.turns, turns); ex.skip = u === B.actor; }
    else u.eff.push({ id, turns, skip: u === B.actor });
    if (id === "PROVOKE") u.provokedBy = src;
    if (!quiet) ev({ k: "txt", u: u.uid, s: FX[id].n, c: FX[id].b ? "buff" : "debuff" });
    fxEv(u);
  }
  function removeEff(u, id) { const n = u.eff.length; u.eff = u.eff.filter(e => e.id !== id); if (id === "SHIELD") u.shield = 0; if (id === "PROVOKE") u.provokedBy = null; if (n !== u.eff.length) fxEv(u); }
  function immuneTo(u, what) { const imm = u.passives.find(p => p.id === "IMMUNE_LIST"); return imm && (imm.list.includes(what) || imm.list.includes("ANY")); }
  function tryDebuff(att, tar, what, turns, chance = 1) {
    if (!tar.alive) return false;
    if (immuneTo(tar, what)) { ev({ k: "txt", u: tar.uid, s: "IMMUNE", c: "txt" }); return false; }
    if (R() >= chance) return false;
    if (has(tar, "IMMUNITY")) { ev({ k: "txt", u: tar.uid, s: "IMMUNE", c: "txt" }); return false; }
    if (R() < Math.min(.85, .15 + Math.max(0, tar.max.res - att.max.acc))) { ev({ k: "txt", u: tar.uid, s: "RESIST", c: "txt" }); return false; }
    addEff(tar, what, turns, att); return true;
  }
  function addATB(u, amount, quiet) {
    if (!u.alive) return;
    u.atb = clamp(u.atb + amount * 100, 0, 100);
    ev({ k: "tm", u: u.uid, tm: u.atb, v: amount * 100, quiet });
  }
  function heal(u, n) {
    if (!u.alive || n <= 0) return;
    if (has(u, "HEAL_BLOCK")) { ev({ k: "txt", u: u.uid, s: "HEAL BLOCKED", c: "debuff" }); return; }
    const g = Math.min(Math.round(n), u.max.hp - u.hp); if (g <= 0) return;
    u.hp += g; ev({ k: "heal", u: u.uid, n: g, hp: u.hp, sh: u.shield });
  }
  function giveShield(u, v, turns) { u.shield += Math.round(v); addEff(u, "SHIELD", turns || 2, u, true); ev({ k: "heal", u: u.uid, n: Math.round(v), hp: u.hp, sh: u.shield, isShield: 1 }); }
  function strip(u, n) {
    let k = 0;
    for (let i = 0; i < n; i++) {
      const pool = u.eff.filter(e => FX[e.id].b && e.id !== "INVINCIBLE"); if (!pool.length) break;
      const e = pool[Math.floor(R() * pool.length)]; u.eff = u.eff.filter(x => x !== e); if (e.id === "SHIELD") u.shield = 0; k++;
    }
    if (k) { ev({ k: "txt", u: u.uid, s: "BUFFS REMOVED", c: "debuff" }); fxEv(u); }
  }
  function cleanse(u, n) {
    let k = 0;
    for (let i = 0; i < n; i++) {
      const pool = u.eff.filter(e => !FX[e.id].b); if (!pool.length) break;
      const e = pool[Math.floor(R() * pool.length)]; u.eff = u.eff.filter(x => x !== e); if (e.id === "PROVOKE") u.provokedBy = null; k++;
    }
    if (k) { ev({ k: "txt", u: u.uid, s: "CLEANSED", c: "buff" }); fxEv(u); }
  }
  function revive(u, pct) {
    if (!u || u.alive) return;
    u.alive = true; u.hp = Math.max(1, Math.round(u.max.hp * pct)); u.eff = []; u.shield = 0; u.atb = 0; u.provokedBy = null;
    ev({ k: "revive", u: u.uid, hp: u.hp });
  }

  // ---------- damage ----------
  function kill(u, killer) {
    const rev = u.passives.find(p => p.id === "REVIVE_ONCE");
    if (rev && !u.flags.revived) {
      u.flags.revived = true; u.hp = Math.max(1, Math.round(u.max.hp * (rev.amount || .3))); u.eff = []; u.shield = 0;
      ev({ k: "txt", u: u.uid, s: "GUTS", c: "buff" }); ev({ k: "revive", u: u.uid, hp: u.hp, inPlace: 1 });
      addEff(u, rev.buff || "INVINCIBLE", rev.turns || 1, u);
      return;
    }
    u.alive = false; u.hp = 0; u.eff = []; u.shield = 0; u.atb = 0;
    if (u.team === "E") B.tally.kills++;
    ev({ k: "death", u: u.uid });
    if (killer && killer.alive) for (const p of killer.passives) {
      if (p.id === "TEAM_ATB_ON_KILL") for (const a of allies(killer)) addATB(a, p.amount);
      else if (p.id === "MC_ON_KILL") gainMC(killer.team, Math.round(p.amount * 100));
    }
  }
  function applyDamage(att, tar, dmg, meta) {
    if (!tar.alive) return 0;
    if (has(tar, "INVINCIBLE")) { ev({ k: "txt", u: tar.uid, s: "INVINCIBLE", c: "txt" }); return 0; }
    let dealt = dmg;
    if (!meta.trueDmg && tar.shield > 0) { const soak = Math.min(tar.shield, dealt); tar.shield -= soak; dealt -= soak; if (tar.shield <= 0) { tar.shield = 0; removeEff(tar, "SHIELD"); } }
    tar.hp -= dealt;
    ev({ k: "dmg", u: tar.uid, n: dmg, crit: !!meta.crit, glance: !!meta.glance, hp: Math.max(0, tar.hp), sh: tar.shield, dot: !!meta.trueDmg, adv: meta.adv });
    if (att) B.dmgDone[att.uid] = (B.dmgDone[att.uid] || 0) + dmg;
    if (tar.sets.has("Nemesis") && dealt > 0 && tar.hp > 0) addATB(tar, (dealt / tar.max.hp) * (.04 / .07), true);
    if (tar.hp <= 0) kill(tar, att);
    return dealt;
  }
  // Moon-style traits and damage Talents: an additive damage bonus and a multiplier on damage taken
  function dmgMods(att, tar, sk) {
    let bonus = 0, taken = 1;
    if (sk.arc && att.style === "Full") bonus += FULL_ARC;
    if (att.style === "Crescent" && B.mc[att.team] >= CRES_HEAT_AT) bonus += CRES_HEAT;
    for (const p of att.passives) {
      if (p.id === "BLOOD_HEAT" && att.hp < att.max.hp * p.below) bonus += p.amount;
      else if (p.id === "EXECUTE" && tar.hp < tar.max.hp * p.below) bonus += p.amount;
      else if (p.id === "BONUS_VS_DEBUFFED" && tar.eff.some(x => !FX[x.id].b)) bonus += p.amount;
    }
    if (tar.style === "Half") taken *= 1 - HALF_GUARD;
    const dr = pv(tar, "DMG_REDUCE"); if (dr) taken *= 1 - dr.amount;
    let td = 0; for (const a of allies(tar)) { const p = pv(a, "TEAM_DMG_REDUCE"); if (p) td = Math.max(td, p.amount); }
    return { bonus, taken: taken * (1 - td) };
  }
  function attackOnce(att, tar, sk, isCounter) {
    if (!att.alive || !tar.alive) return;
    const rel = elementRel(att.el, tar.el);
    let glance = (rel === "dis" && R() < .5) || (has(att, "GLANCING") && R() < .5);
    let critChance = effCR(att) + (rel === "adv" ? .15 : 0), bonus = 0;
    for (const e of sk.effects || []) {
      if (e.type === "bonusIf" && has(tar, e.cond)) { bonus += e.bonusDmg || 0; critChance += e.bonusCrit || 0; }
      if (e.type === "bonusPerDebuff") bonus += Math.min(e.cap || 0, tar.eff.filter(x => !FX[x.id].b).length * (e.per || 0));
    }
    if (glance) critChance = 0;
    const crit = R() < critChance;
    const mitig = 1000 / (1000 + Math.max(0, effDef(tar) * (1 - (sk.ignoreDef || 0))));
    let dmg = effAtk(att) * (sk.mult || 1) * lvMult(att, sk.slot) * mitig;
    if (crit) dmg *= 1 + att.max.cd;
    const M = dmgMods(att, tar, sk);
    dmg *= (1 + (rel === "adv" ? .15 : 0) + (glance ? -.3 : 0) + bonus + M.bonus) * (has(tar, "BRAND") ? 1.25 : 1) * M.taken;
    dmg = Math.max(1, Math.round(dmg));
    const dealt = applyDamage(att, tar, dmg, { crit, glance, adv: rel === "adv" });
    if (dealt > 0) gainMC(tar.team, 3);
    if (tar.alive && tar.style === "Half" && !tar.flags.spark && tar.hp < tar.max.hp / 2) {
      tar.flags.spark = true; ev({ k: "txt", u: tar.uid, s: "CIRCUIT SPARK", c: "buff" }); cleanse(tar, 9);
    }
    if (crit) B.ctxCrits++;
    // on-hit Talents (scaled down per hit so multi-hit skills don't trigger them many times over)
    const per = 1 / (sk.hits || 1);
    if (tar.alive && dmg > 0) {
      const oh = pv(tar, "ON_HIT_ATB"); if (oh) addATB(tar, oh.amount * per, true);
      const hd = pv(tar, "HIT_DEBUFF"); if (hd && att.alive && !isCounter) tryDebuff(tar, att, hd.what, hd.turns || 2, hd.chance * per);
    }
    const cdb = pv(att, "CRIT_DEBUFF"); if (crit && cdb && tar.alive) tryDebuff(att, tar, cdb.what, cdb.turns || 2, cdb.chance);
    if (tar.alive && att.sets.has("Despair") && R() < .25) tryDebuff(att, tar, "STUN", 1, 1);
    for (const e of sk.effects || []) {
      if (e.on === "target" || e.on === "enemy") {
        if (e.type === "debuff") tryDebuff(att, tar, e.what, e.turns || 1, e.chance ?? 1);
        else if (e.type === "atkbar-") { if (e.chance == null || R() < e.chance) addATB(tar, -(e.amount || 0)); }
        else if (e.type === "strip") { if ((e.chance ?? 1) >= 1 || R() < e.chance) strip(tar, e.amount || 1); }
      } else if (e.on === "self" && e.type === "atkbar+" && e.perCrit && crit) addATB(att, e.amount || 0);
    }
    if (tar.alive && att.alive && !isCounter && B.depth < 3) {
      const pc = pv(tar, "COUNTER");
      if ((has(tar, "COUNTER") && R() < .3) || (tar.sets.has("Revenge") && R() < .15) || (pc && R() < pc.chance * per)) {
        ev({ k: "txt", u: tar.uid, s: "SHIELD COUNTER", c: "buff" });
        const s1 = tar.skills[0];
        B.depth++; ev({ k: "atk", a: tar.uid, t: [att.uid], anim: animFor(tar, s1), aoe: 0, counter: 1 }); attackOnce(tar, att, s1, true); B.depth--;
      }
    }
    const ls = att.passives.find(p => p.id === "LIFESTEAL");
    if (ls && dealt > 0 && att.alive) heal(att, dealt * (ls.amount || .2));
    if (!tar.alive) {
      B.ctxKill = true;
      for (const e of sk.effects || []) if (e.onKill && e.on === "self") {
        if (e.type === "buff") addEff(att, e.what, e.turns || 1, att);
        else if (e.type === "resetSelfCD") { att.flags.resetCD = e.skill; ev({ k: "txt", u: att.uid, s: "COOLDOWN RESET", c: "buff" }); }
        else if (e.type === "atkbar+") addATB(att, e.amount || 0);
      }
    }
  }
  function applyEffect(actor, targets, e, sk) {
    if (e.onKill || e.type === "bonusIf" || e.type === "bonusPerDebuff") return;
    if (e.on === "self" && e.type === "atkbar+" && e.perCrit) return;
    if ((e.on === "target" || e.on === "enemy") && (sk.mult || 0) > 0) return;
    if (e.chance != null && e.type !== "debuff" && e.type !== "atkbar-" && R() >= e.chance) return;
    const foes = enemies(actor);
    switch (e.on) {
      case "self":
        if (e.type === "buff") addEff(actor, e.what, e.turns || 1, actor);
        else if (e.type === "taunt") addEff(actor, "TAUNT", e.turns || 1, actor);
        else if (e.type === "atkbar+") addATB(actor, e.amount || 0);
        else if (e.type === "healPct") heal(actor, actor.max.hp * (e.amount || 0));
        else if (e.type === "cleanse") cleanse(actor, e.amount || 1);
        else if (e.type === "shieldCasterHP") giveShield(actor, actor.max.hp * (e.amount || 0), e.turns);
        break;
      case "ally": case "team": case "aoe_allies": {
        // ally effects inside attack or self skills reach the whole team; ally_single skills reach only their target
        const list = sk.target === "ally_single" ? targets.filter(t => t.team === actor.team && t.alive) : allies(actor);
        if (e.type === "reviveOne") { const dead = B.units.filter(u => u.team === actor.team && !u.alive); if (dead.length) revive(dead[dead.length - 1], e.amount || .3); break; }
        for (const a of list) {
          if (e.type === "healPctTarget") heal(a, a.max.hp * (e.amount || 0));
          else if (e.type === "healFlatCasterHP") heal(a, actor.max.hp * (e.amount || 0));
          else if (e.type === "cleanse") cleanse(a, e.amount || 1);
          else if (e.type === "buff") addEff(a, e.what, e.turns || 1, actor);
          else if (e.type === "taunt") addEff(a, "TAUNT", e.turns || 1, actor);
          else if (e.type === "shieldCasterHP") giveShield(a, actor.max.hp * (e.amount || 0), e.turns);
          else if (e.type === "atkbar+") addATB(a, e.amount || 0);
        }
        break;
      }
      case "aoe_enemies": case "target": case "enemy": {
        const list = e.on === "aoe_enemies" ? foes : targets.filter(t => t.team !== actor.team && t.alive);
        for (const f of list) {
          if (e.type === "atkbar-") { if (e.chance == null || R() < e.chance) addATB(f, -(e.amount || 0)); }
          else if (e.type === "debuff") tryDebuff(actor, f, e.what, e.turns || 1, e.chance ?? 1);
          else if (e.type === "strip") strip(f, e.amount || 1);
        }
        break;
      }
    }
  }

  // ---------- targeting + AI ----------
  function singleTargetables(list) { const vis = list.filter(x => !has(x, "STEALTH")); return vis.length ? vis : list; }
  function targetable(u) { const f = singleTargetables(enemies(u)); const ta = f.filter(x => has(x, "TAUNT")); return ta.length ? ta : f; }
  const hasKeyDebuff = t => has(t, "DEF_BREAK") || has(t, "BRAND") || has(t, "HEAL_BLOCK");
  function defaultTarget(u, sk) {
    if (sk.target === "ally_single") return allies(u).sort((a, b) => a.hp / a.max.hp - b.hp / b.max.hp)[0];
    const foes = targetable(u);
    return foes.slice().sort((a, b) => (a.hp / a.max.hp + (hasKeyDebuff(a) ? -.3 : 0)) - (b.hp / b.max.hp + (hasKeyDebuff(b) ? -.3 : 0)))[0];
  }
  function expectedDamage(att, tar, s) {
    if (!s || !(s.mult > 0) || !tar || !tar.alive) return 0;
    const rel = elementRel(att.el, tar.el), adv = rel === "adv" ? .15 : 0, glPen = rel === "dis" ? -.3 : 0;
    const mit = 1000 / (1000 + Math.max(0, effDef(tar) * (1 - (s.ignoreDef || 0))));
    const base = effAtk(att) * s.mult * lvMult(att, s.slot), brand = has(tar, "BRAND") ? 1.25 : 1;
    const glance = rel === "dis" ? .5 : 0, pCrit = clamp(effCR(att) + (rel === "adv" ? .15 : 0), 0, 1);
    const M = dmgMods(att, tar, s);
    const nc = base * mit * (1 + adv + glPen + M.bonus) * brand * M.taken, cr = base * mit * (1 + att.max.cd + adv + glPen + M.bonus) * brand * M.taken;
    return Math.max(1, Math.round((1 - glance) * ((1 - pCrit) * nc + pCrit * cr) + glance * nc * .7)) * (s.hits || 1);
  }
  const isHeal = s => (s.effects || []).some(e => /heal|revive/i.test(e.type));
  // Magic Circuit: each side's shared gauge (0–300%). Actions and hits taken fill it; an Arc Drive spends 100%.
  const MC_MAX = 300;
  function gainMC(team, n) {
    if (!n) return;
    const v = clamp(B.mc[team] + n, 0, MC_MAX);
    if (v !== B.mc[team]) { B.mc[team] = v; ev({ k: "mc", A: B.mc.A, E: B.mc.E }); }
  }
  function skillReady(u, s) {
    if (!s) return false;
    if (s.slot === 1) return true;
    if (has(u, "SILENCE")) return false;
    return s.arc ? B.mc[u.team] >= s.arc : (u.cool[s.slot] || 0) === 0;
  }
  function aiChoose(u, style = "balanced") {
    const can = s => skillReady(u, s);
    const foes = targetable(u), al = allies(u);
    const [s1, s2, s3] = [1, 2, 3].map(n => u.skills.find(s => s.slot === n));
    const lowest = al.slice().sort((a, b) => a.hp / a.max.hp - b.hp / b.max.hp)[0];
    const needHeal = lowest && lowest.hp / lowest.max.hp < .6 || B.units.some(x => x.team === u.team && !x.alive);
    const usable = [s3, s2, s1].filter(s => s && can(s) && !(isHeal(s) && s.slot > 1 && !needHeal));
    const tgtFor = (s, pickFoe) => s.target === "enemy" || s.target === "aoe_enemies" ? pickFoe() : s.target === "ally_single" ? lowest : u;
    const lowestTTK = s => { let best = null, bt = Infinity; for (const t of foes) { const d = expectedDamage(u, t, s), ttk = d > 0 ? t.hp / d : Infinity; if (ttk < bt) { best = t; bt = ttk; } } return best || foes[0]; };
    const threat = () => foes.slice().sort((a, b) => (effAtk(b) * effSpd(b) + b.atb * 2) - (effAtk(a) * effSpd(a) + a.atb * 2))[0];
    if (style === "aggressive") { const s = usable[0] || s1; return { slot: s.slot, t: tgtFor(s, () => lowestTTK(s)) }; }
    if (style === "safe") {
      const util = [s2, s3, s1].find(s => s && usable.includes(s) && (s.effects || []).some(e => e.on !== "target" && /cleanse|shield|buff|atkbar\+|revive|heal/.test(e.type)));
      if (util) return { slot: util.slot, t: tgtFor(util, threat) };
      const s = usable[0] || s1; return { slot: s.slot, t: tgtFor(s, threat) };
    }
    const s = usable[0] || s1;
    return { slot: s.slot, t: tgtFor(s, () => defaultTarget(u, s)) };
  }

  // ---------- turn flow ----------
  function advance() {
    const al = B.units.filter(x => x.alive);
    let best = null, bt = Infinity;
    for (const u of al) { const t = (100 - u.atb) / effSpd(u); if (t < bt) { bt = t; best = u; } }
    for (const u of al) u.atb = clamp(u.atb + effSpd(u) * bt, 0, 100);
    best.atb = 100;
    return best;
  }
  function predictOrder(n) {
    const snap = B.units.filter(x => x.alive).map(u => ({ u, atb: u.atb, spd: effSpd(u) })), out = [];
    for (let i = 0; i < n && snap.length; i++) {
      const nx = snap.reduce((a, b) => (100 - b.atb) / b.spd < (100 - a.atb) / a.spd ? b : a);
      const dt = Math.max(0, (100 - nx.atb) / nx.spd);
      for (const s of snap) s.atb = clamp(s.atb + s.spd * dt, 0, 100);
      nx.atb = 0; out.push(nx.u.uid);
    }
    return out;
  }
  function endTurn(u) {
    if (u.alive) {
      let changed = false;
      for (const e of u.eff) { if (e.skip) e.skip = false; else { e.turns--; changed = true; } }
      const had = u.eff.length, hadShield = u.eff.some(e => e.id === "SHIELD");
      u.eff = u.eff.filter(e => e.turns > 0);
      if (hadShield && !u.eff.some(e => e.id === "SHIELD")) u.shield = 0;
      if (!u.eff.some(e => e.id === "PROVOKE")) u.provokedBy = null;
      if (changed && had !== u.eff.length) fxEv(u);
    }
    B.actor = null; B.waiting = null;
    const a = B.units.filter(x => x.team === "A" && x.alive).length, f = B.units.filter(x => x.team === "E" && x.alive).length;
    if (!a) { B.over = true; B.result = { win: false, alive: 0, turns: B.allyTurns }; }
    else if (!f) {
      if (B.wave < B.waves.length - 1) B.pendingWave = true;
      else { B.over = true; B.result = { win: true, alive: a, lost: B.allyCount - a, turns: B.allyTurns }; }
    }
  }
  function act(u, slot, t) {
    const sk = u.skills.find(s => s.slot === slot) || u.skills[0];
    if (sk.arc && B.mc[u.team] < sk.arc) return act(u, 1, t);
    if (sk.arc) { gainMC(u.team, -sk.arc); if (u.team === "A") B.tally.arcs++; }
    const anim = animFor(u, sk);
    let targets;
    if (sk.target === "enemy") { if (!t || !t.alive || t.team === u.team || !targetable(u).includes(t)) t = defaultTarget(u, sk); targets = t ? [t] : []; }
    else if (sk.target === "ally_single") { if (!t || !t.alive || t.team !== u.team) t = defaultTarget(u, sk); targets = [t]; }
    else if (sk.target === "self") targets = [u];
    else if (sk.target === "team" || sk.target === "aoe_allies") targets = allies(u);
    else targets = enemies(u);
    ev({ k: "act", u: u.uid, slot, name: sk.name, anim, s3: sk.slot === 3, arc: !!sk.arc, t: targets[0] && targets[0].uid, tgt: sk.target });
    B.ctxCrits = 0; B.ctxKill = false;
    if ((sk.mult || 0) > 0) {
      if (sk.target === "aoe_enemies") {
        for (let h = 0; h < (sk.hits || 1); h++) {
          const alive = targets.filter(x => x.alive); if (!alive.length || !u.alive) break;
          ev({ k: "atk", a: u.uid, t: alive.map(x => x.uid), anim, aoe: 1, h, n: sk.hits || 1, sp: sk.slot > 1 });
          for (const x of alive) attackOnce(u, x, sk, false);
        }
      } else {
        for (const x of targets) for (let h = 0; h < (sk.hits || 1); h++) {
          if (!x.alive || !u.alive) break;
          ev({ k: "atk", a: u.uid, t: [x.uid], anim, aoe: 0, h, n: sk.hits || 1, sp: sk.slot > 1 });
          attackOnce(u, x, sk, false);
        }
      }
    }
    if (u.alive) for (const e of sk.effects || []) applyEffect(u, targets, e, sk);
    gainMC(u.team, sk.arc ? 0 : sk.slot === 1 ? 22 : 12);
    if (sk.arc && u.alive) for (const p of u.passives) {
      if (p.id === "ARC_TEAM_ATB") for (const a of allies(u)) addATB(a, p.amount);
      else if (p.id === "ARC_TEAM_HEAL") for (const a of allies(u)) heal(a, a.max.hp * p.amount);
      else if (p.id === "ARC_SELF_ATB") addATB(u, p.amount);
    }
    if (sk.slot > 1 && !sk.arc) u.cool[sk.slot] = cdOf(u, sk);
    if (u.flags.resetCD) { u.cool[u.flags.resetCD] = 0; u.flags.resetCD = 0; }
    const xt = pv(u, "EXTRA_TURN");
    if (u.alive && ((u.sets.has("Violent") && R() < .22) || (xt && R() < xt.chance))) { ev({ k: "txt", u: u.uid, s: "EXTRA TURN", c: "buff" }); u.atb = 100; ev({ k: "tm", u: u.uid, tm: 100, v: 100, quiet: 1 }); }
    ev({ k: "end", u: u.uid });
    endTurn(u);
  }

  B.has = has; B.targetable = targetable; B.allies = allies; B.enemies = enemies; B.predictOrder = predictOrder;
  B.byId = uid => B.units.find(x => x.uid === uid);
  B.usable = (u, slot) => slot === 1 || skillReady(u, u.skills.find(s => s.slot === slot));
  B.effStat = { spd: effSpd, atk: effAtk, def: effDef, cr: effCR };
  B.estimate = (u, t, s) => expectedDamage(u, t, s);
  B.step = () => {
    if (B.over) return "over";
    if (B.pendingWave) { B.pendingWave = false; const list = spawnWave(B.wave + 1); startEffects(list); return "wave"; }
    const u = advance(); B.actor = u; B.turn++;
    if (u.team === "A") B.allyTurns++;
    u.atb = 0;
    ev({ k: "turn", u: u.uid, tms: B.units.filter(x => x.alive).map(x => [x.uid, x.atb]) });
    for (const s in u.cool) if (u.cool[s] > 0) u.cool[s]--;
    const dots = u.eff.filter(e => e.id === "DOT").length;
    if (dots) applyDamage(null, u, Math.max(1, Math.floor(u.max.hp * .05 * dots)), { trueDmg: true });
    const hots = u.eff.filter(e => e.id === "HOT").length;
    if (u.alive && hots) heal(u, u.max.hp * .05 * hots);
    const rg = pv(u, "REGEN"); if (u.alive && rg) heal(u, u.max.hp * rg.amount);
    if (u.alive && u.style === "Full") gainMC(u.team, FULL_CHARGE);
    if (!u.alive) { ev({ k: "end", u: u.uid }); endTurn(u); return "acted"; }
    if (has(u, "STUN")) { removeEff(u, "STUN"); ev({ k: "txt", u: u.uid, s: "BOUND", c: "debuff" }); ev({ k: "end", u: u.uid }); endTurn(u); return "acted"; }
    if (has(u, "PROVOKE") && u.provokedBy && u.provokedBy.alive) { act(u, 1, u.provokedBy); return "acted"; }
    if (u.team === "A" && !B.auto) { B.waiting = u; return "input"; }
    const ch = aiChoose(u, u.team === "A" ? B.aiStyle : "balanced"); act(u, ch.slot, ch.t); return "acted";
  };
  B.playerAct = (slot, t) => { const u = B.waiting; if (!u) return; if (!B.usable(u, slot)) slot = 1; act(u, slot, t); };
  B.autoAct = () => { const u = B.waiting; if (!u) return; const ch = aiChoose(u, B.aiStyle); act(u, ch.slot, ch.t); };

  // ---------- setup ----------
  const mine = cfg.allies.map((s, i) => buildUnit(s, "A", i));
  B.units.push(...mine);
  B.leaders.A = mine[0] && mine[0].leader ? mine[0] : null;
  applyLeader(B.leaders.A, mine);
  const first = spawnWave(0);
  B.ev = [];
  startEffects(mine); startEffects(first);
  return B;
}

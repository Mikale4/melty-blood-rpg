
// =====================================================================
//  CLASS TABLES, UNIT TABLE (Moon styles × Elements) AND ENEMIES
//  target: enemy | aoe_enemies | ally_single | self | team | aoe_allies
// =====================================================================
const CLASS_BASE = {
  Vanguard:   { hp: 9500, atk: 720, def: 520, spd: 114 },
  Guard:      { hp: 9200, atk: 820, def: 500, spd: 112 },
  Defender:   { hp: 10500, atk: 650, def: 650, spd: 104 },
  Sniper:     { hp: 8600, atk: 900, def: 430, spd: 113 },
  Caster:     { hp: 8800, atk: 840, def: 480, spd: 108 },
  Medic:      { hp: 10200, atk: 620, def: 630, spd: 110 },
  Supporter:  { hp: 9300, atk: 700, def: 520, spd: 112 },
  Specialist: { hp: 9000, atk: 780, def: 480, spd: 117 },
};
const CLASS_RUNES = { Sniper: ["Fatal", "Blade"], Caster: ["Focus", "Rage"], Guard: ["Fatal", "Blade"], Defender: ["Guard", "Energy"],
  Medic: ["Energy", "Will"], Supporter: ["Energy", "Will"], Vanguard: ["Swift", "Energy"], Specialist: ["Swift", "Blade"] };
const CLASS_LEADER = {
  Vanguard: { stat: "SPD", amount: .15, scope: "All" }, Guard: { stat: "ATK", amount: .24, scope: "Element" },
  Defender: { stat: "HP", amount: .25, scope: "All" }, Sniper: { stat: "CR", amount: .2, scope: "Element" },
  Caster: { stat: "ATK", amount: .24, scope: "Element" }, Medic: { stat: "RES", amount: .3, scope: "All" },
  Supporter: { stat: "ACC", amount: .3, scope: "All" }, Specialist: { stat: "CD", amount: .3, scope: "Element" },
};
const RAR_MULT = { 1: .7, 2: .76, 3: .84, 4: .92, 5: 1, 6: 1.06 };
const ARC_COST = 100;

// ---------- build the unit table ----------
// Each character's Moon styles are "families" ("<char>-c/-h/-f"); each family comes in all five Elements, and every
// unit ("<char>-<style>-<element>", e.g. "shiki-h-fire") is collected and raised on its own.
// Home Element per Moon style (Crescent Half Full): the one that fits the kit. Starters, story rewards, bosses
// and pre-Element saves use it.
const HOME_EL = {
  shiki: "Wind Water Fire", nanaya: "Wind Water Imaginary", arcueid: "Fire Water Imaginary", "red-arcueid": "Imaginary Water Fire",
  ciel: "Ether Water Fire", "powered-ciel": "Ether Water Wind", akiha: "Fire Water Imaginary", "red-akiha": "Fire Wind Imaginary",
  hisui: "Water Ether Fire", kohaku: "Water Fire Wind", "mech-hisui": "Wind Water Fire", satsuki: "Imaginary Fire Wind",
  sion: "Wind Water Fire", "sion-tatari": "Imaginary Water Wind", riesbyfe: "Ether Water Fire", aoko: "Wind Water Fire",
  chaos: "Imaginary Wind Water", roa: "Imaginary Wind Fire", wallachia: "Imaginary Water Fire", len: "Water Wind Fire",
  "white-len": "Water Wind Ether", miyako: "Fire Water Wind", kouma: "Fire Water Imaginary", "neco-arc": "Wind Water Fire",
  "neco-chaos": "Imaginary Water Wind", ryougi: "Wind Water Fire", archetype: "Ether Water Imaginary", "seifuku-akiha": "Fire Wind Imaginary", "kohaku-mech": "Water Wind Fire",
};
// Element versions differ slightly, like Summoners War: a stat lean, an extra effect on S1, and an Arc Drive tweak.
const ELEMENT_KIT = {
  Fire: { d: "+5% ATK. S1 can inflict Curse. Damaging Arc Drives hit 8% harder (support ones grant ATK Up).",
    stat: { atk: 1.05 }, s1: dbf("DOT", .25), arc: sk => sk.mult > 0 ? { mult: 1.08 } : { add: teamBuff("ATK_UP") } },
  Water: { d: "+6% HP. S1 can inflict Slow. Arc Drives also heal all allies.",
    stat: { hp: 1.06 }, s1: dbf("SLOW", .25), arc: () => ({ add: teamHeal(.08) }) },
  Wind: { d: "+4 SPD. S1 reduces turn meter. Arc Drives also give all allies turn meter.",
    stat: { spd: 4 }, s1: tmDown(.1), arc: () => ({ add: teamGain(.1) }) },
  Ether: { d: "+8% DEF. S1 can inflict Skill Seal. Arc Drives also remove a buff (support ones cleanse).",
    stat: { def: 1.08 }, s1: dbf("SILENCE", .2, 1), arc: sk => ({ add: sk.mult > 0 ? strip(1) : cleanse(1) }) },
  Imaginary: { d: "+3% HP and ATK. S1 can inflict Heal Block. Arc Drives also heal this character.",
    stat: { atk: 1.03, hp: 1.03 }, s1: dbf("HEAL_BLOCK", .25), arc: () => ({ add: selfHeal(.15) }) },
};
// Manifest odds by Element: Ether and Imaginary Numbers versions are rare, like Light and Dark in Summoners War
const EL_WEIGHT = { Fire: .3, Water: .3, Wind: .3, Ether: .05, Imaginary: .05 };
// add an effect to a skill, or strengthen the same effect if the skill already has it
function withEffect(sk, e) {
  const ex = sk.effects.find(x => x.type === e.type && x.on === e.on && x.what === e.what && !x.onKill && !x.perCrit);
  if (!ex) { sk.effects.push({ ...e }); return; }
  const i = sk.effects.indexOf(ex), up = { ...ex };
  if (e.type === "debuff") up.chance = Math.min(1, (ex.chance ?? 1) + .15);
  else if (e.type === "strip" || e.type === "cleanse") up.amount = (ex.amount || 1) + 1;
  else if (e.type !== "buff") up.amount = +((ex.amount || 0) + .05).toFixed(2);
  sk.effects[i] = up;
}
// per-hit effects are scaled down on multi-hit skills so a 7-hit S1 doesn't apply them seven times over
const perHit = (e, hits) => { const f = Math.min(1, 2 / (hits || 1)); return e.type === "debuff" ? { ...e, chance: +(e.chance * f).toFixed(3) } : { ...e, amount: +(e.amount * f).toFixed(3) }; };
const OPS = {};
const OP_KEYS = [];
const FAMS = [];
for (const c of CHARS) STYLES.forEach((style, si) => {
  const v = c[style]; if (!v) return;
  const fam = c.k + "-" + STYLE[style].sfx, home = HOME_EL[c.k].split(" ")[si], cls = v.cls;
  const passives = (v.talents || [v.talent]).filter(Boolean).map(t => ({ ...t, text: `${t.name}: ${passiveDesc(t)}.` }));
  FAMS.push(fam);
  for (const el of ELS) {
    const X = ELEMENT_KIT[el];
    const skills = v.skills.map(sk0 => {
      const sk = { ...sk0, effects: [...(sk0.effects || [])] };
      if (sk.slot === 1) withEffect(sk, perHit(X.s1, sk.hits));
      if (sk.slot === 3) { const t = X.arc(sk); if (t.mult) sk.mult = +(sk.mult * t.mult).toFixed(2); if (t.add) withEffect(sk, t.add); sk.arc = ARC_COST; sk.cd = 0; }
      sk.desc = skillDesc(sk);
      return sk;
    });
    const stats = { ...CLASS_BASE[cls], ...(v.stats || {}) };
    for (const k in X.stat) stats[k] = k === "spd" ? stats[k] + X.stat[k] : Math.round(stats[k] * X.stat[k]);
    const key = fam + "-" + elKey(el), isHome = el === home;
    // the home Element keeps the character's signature effect colour; the others glow in their Element's colour
    const op = { key, base: c.k, fam, n: c.n, short: c.short || c.n, slug: c.k, rar: v.rar || c.rar, cls, style, el, home: isHome, asp: 1, featured: true,
      fig: isHome ? c.fig : { ...c.fig, sc: ELC[el] }, stats, skills, leader: { ...(v.leader || CLASS_LEADER[cls]) },
      passives, runes: CLASS_RUNES[cls], maxElite: 2 };
    if (op.leader.scope === "Element") op.leader.element = el;
    OPS[key] = op; OP_KEYS.push(key);
  }
});
const homeKey = fam => fam + "-" + elKey(HOME_EL[fam.slice(0, fam.lastIndexOf("-"))].split(" ")[STYLES.findIndex(s => fam.endsWith("-" + STYLE[s].sfx))]);
const variantsOf = base => STYLES.map(s => base + "-" + STYLE[s].sfx).filter(f => FAMS.includes(f));
const elementsOf = fam => ELS.map(el => fam + "-" + elKey(el)).filter(k => OPS[k]);
const opLabel = op => `${op.el} ${styleName(op.style)} ${op.short}`;
// saves from before Moon styles ("shiki") and before Elements ("shiki-c") move to the home unit
const LEGACY = {};
for (const f of FAMS) LEGACY[f] = homeKey(f);
for (const c of CHARS) LEGACY[c.k] = homeKey(c.k + "-c");
// the rare Elements were once called Holy and Blood
for (const f of FAMS) { LEGACY[f + "-holy"] = f + "-ether"; LEGACY[f + "-blood"] = f + "-imaginary"; }
// Saber, Noel and Vlov (Type Lumina) were replaced by Actress Again's own Archetype: Earth, Seifuku Akiha and Kohaku & Mech-Hisui
for (const [was, now] of [["saber", "archetype"], ["noel", "seifuku-akiha"], ["vlov", "kohaku-mech"]]) {
  LEGACY[was] = homeKey(now + "-c");
  for (const st of STYLES) { const sfx = STYLE[st].sfx; LEGACY[was + "-" + sfx] = homeKey(now + "-" + sfx); for (const el of ELS) LEGACY[was + "-" + sfx + "-" + elKey(el)] = now + "-" + sfx + "-" + elKey(el); }
}
// menus show the same drawn figures as battles (rendered once, then cached)
const spriteURL = op => opArt(op.key).full;
const headURL = op => opArt(op.key).head;

// ---------- enemies: Ghouls, the Dead, Chaos beasts, Tatari phantoms ----------
const S1 = (name, mult, effects = [], hits = 1) => { const s = { slot: 1, name, cd: 0, target: "enemy", hits, mult, effects }; s.desc = skillDesc(s); return s; };
const S2 = (name, target, mult, effects = [], hits = 1) => { const s = { slot: 2, name, cd: 3, target, hits, mult, effects }; s.desc = skillDesc(s); return s; };
const ENEMY = {
  ghoul: { n: "Ghoul", cls: "Guard", style: "Full", el: "Fire", m: { hp: .7, atk: .75, def: .7, spd: 100 },
    fig: { type: "human", skin: "#b9c0b2", hair: "#34322e", hs: "short", col: "#45454e", col2: "#2c2c34", boot: "#1c1c20", acc: "#5a2a2a", eyec: "#ff3b5c", w: "claws", sc: "#ff3b5c" },
    skills: [S1("Rend", 2.6, [dbf("DOT", .2)])] },
  dead: { n: "The Dead", cls: "Vanguard", style: "Half", el: "Water", m: { hp: .62, atk: .7, def: .6, spd: 98 },
    fig: { type: "human", skin: "#a9b8a2", hair: "#2a2a26", hs: "bald", col: "#3a4038", col2: "#2a2e28", boot: "#1a1c18", acc: "#4a4a3a", eyec: "#c39bff", w: "none", sc: "#c39bff" },
    skills: [S1("Grasp", 2.4, [dbf("SLOW", .3)])] },
  hound: { n: "Shadow Hound", cls: "Specialist", style: "Crescent", el: "Wind", m: { hp: .55, atk: .8, def: .45, spd: 122 },
    fig: { type: "hound", col: "#221c26", acc: "#ff3b5c" },
    skills: [S1("Bite", 2.6, [dbf("DOT", .3)])] },
  panther: { n: "Chaos Panther", cls: "Guard", style: "Half", el: "Wind", m: { hp: .82, atk: .9, def: .6, spd: 116 },
    fig: { type: "hound", col: "#2a2836", acc: "#9a7aff", h: 1.15 },
    skills: [S1("Pounce", 1.4, [], 2), S2("Pack Hunt", "aoe_enemies", 1.6, [tmDown(.1)])] },
  phantom: { n: "Rumor Phantom", cls: "Caster", style: "Crescent", el: "Water", m: { hp: .6, atk: .9, def: .55, spd: 104 },
    fig: { type: "hood", skin: "#d8dce8", col: "#2a2a3e", col2: "#1e1e2e", cape: "#3a3a56", eyes: "#8fd8ff", robe: 1, w: "arts", sc: "#8fd8ff" },
    skills: [S1("Whisper", 2.6, [dbf("SILENCE", .2, 1)]), S2("Spread the Rumor", "aoe_enemies", 1.6, [dbf("ATK_DOWN", .3)])] },
  wraith: { n: "Tatari Wraith", cls: "Caster", style: "Full", el: "Imaginary", m: { hp: .7, atk: .95, def: .6, spd: 106 },
    fig: { type: "hood", skin: "#e0d0d4", col: "#2a0e18", col2: "#1e0a12", cape: "#3a1020", eyes: "#ff3b5c", robe: 1, w: "arts", sc: "#ff3b5c" },
    skills: [S1("Curse", 2.8, [dbf("BRAND", .3)]), S2("Night Terror", "aoe_enemies", 1.8, [dbf("STUN", .2, 1)])] },
  executor: { n: "Rogue Executor", cls: "Sniper", style: "Crescent", el: "Ether", m: { hp: .6, atk: .9, def: .55, spd: 108 },
    fig: { type: "human", skin: "#efdccc", hair: "#3a3a40", hs: "short", col: "#1a1a24", col2: "#16161f", boot: "#101016", acc: "#c8b06a", trim: "#e8e2d0", robe: "robe", w: "blackkeys", sc: "#f4efe2" },
    skills: [S1("Black Keys", 1.4, [dbf("STUN", .1, 1)], 2)] },
  knight: { n: "Ghoul Knight", cls: "Defender", style: "Half", el: "Fire", m: { hp: 1.05, atk: .62, def: 1.1, spd: 96 },
    fig: { type: "human", skin: "#b9c0b2", hair: "#34322e", hs: "short", col: "#3a3a46", col2: "#2a2a34", boot: "#1c1c22", acc: "#5a2a2a", eyec: "#ff3b5c", bulk: 1.18, w: "shield", sc: "#ff3b5c", shc: "#4a4a56" },
    skills: [S1("Rusted Blade", 2.6, [dbf("PROVOKE", .3, 1)]), { slot: 2, name: "Bulwark", cd: 3, target: "self", effects: [selfBuff("DEF_UP"), { on: "self", type: "taunt", turns: 2 }], desc: "Gains DEF Up (2T). Gains Taunt (2T)." }] },
  homunculus: { n: "Atlas Homunculus", cls: "Guard", style: "Full", el: "Water", m: { hp: .8, atk: .85, def: .8, spd: 104 },
    fig: { type: "robot", col: "#6a6a7a", col2: "#4a4a58", boot: "#2a2a34", acc: "#f1d07a", w: "saber", sc: "#f1d07a" },
    skills: [S1("Calculated Strike", 2.8, [dbf("DEF_BREAK", .3)])] },
};
// Bosses are tougher versions of playable characters (same figure and kit, Arc Drive included).
// [character variant, HP multiplier, ATK multiplier]; bosses that revive or heal get less HP so the fight stays fair.
// Each boss fights in one Moon style, so the right counter-pick matters.
const BOSS = { b_sion: [homeKey("sion-c"), 3.0, 1.12], b_ciel: [homeKey("ciel-c"), 2.8, 1.06], b_redakiha: [homeKey("red-akiha-c"), 2.1, .94], b_chaos: [homeKey("chaos-c"), 1.75, .9], b_wallachia: [homeKey("wallachia-c"), 2.5, .92],
  b_nanaya: [homeKey("nanaya-c"), 2.8, 1.1], b_riesbyfe: [homeKey("riesbyfe-c"), 2.5, 1.0], b_roa: [homeKey("roa-c"), 2.2, 1.0], b_redarc: [homeKey("red-arcueid-c"), 2.6, 1.02], b_archetype: [homeKey("archetype-c"), 2.8, 1.06],
  b_siontatari: [homeKey("sion-tatari-c"), 2.8, 1.05], b_mech: [homeKey("mech-hisui-c"), 2.8, 1.1], b_satsuki: [homeKey("satsuki-c"), 2.6, 1.1], b_whitelen: [homeKey("white-len-c"), 2.4, 1.0] };
for (const id in BOSS) {
  const [k, hp, atk] = BOSS[id], op = OPS[k];
  ENEMY[id] = { n: op.n, boss: 1, op: k, cls: op.cls, style: op.style, el: op.el, fig: op.fig, skills: op.skills, passives: op.passives,
    m: { hp, atk, def: 1.0, spd: op.stats.spd - 4 } };
}
for (const k in ENEMY) { ENEMY[k].key = k; ENEMY[k].enemy = true; ENEMY[k].passives = ENEMY[k].passives || []; ENEMY[k].runes = []; }

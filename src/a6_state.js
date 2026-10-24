
// =====================================================================
//  SAVE STATE + PROGRESSION
// =====================================================================
const SAVE_KEY = "melty_blood_rpg_v1";
let S = null;
const LV_CAP = [30, 50, 70], LV_OFF = [0, 30, 50];
const maxSanity = l => 80 + Math.floor(l * 1.5);
const SAN_MS = 30000;
const pxpNeed = l => 100 + 50 * l;
const xpNeed = (l, e) => Math.round((60 + l * 22) * (1 + e * .9));
const effLV = p => p.lvl + LV_OFF[p.elite];
const mkProg = () => ({ lvl: 1, xp: 0, elite: 0, pot: 1, sk: [1, 1, 1], runes: [null, null] });

// play statistics behind the achievements
const newStats = () => ({ battles: 0, wins: 0, arcs: 0, kills: 0, flawless: 0, versus: 0, patrols: 0, fives: 0, codeUps: 0, loginDays: 0 });
function newSave() {
  const s = {
    v: 1, codes2: 1, name: "Night Walker", named: false, lvl: 1, xp: 0, seenIntro: false,
    playerId: String(100000000 + Math.floor(R() * 899999999)), created: Date.now(),
    inbox: [], mailSeq: 0, achv: {}, lastLogin: "", lastGift: Date.now(), lvlGift: 1,
    sanity: maxSanity(1), sTime: Date.now(),
    lmd: 20000, orundum: 6000, permit: 10, cert: 0, tokens: 0, prime: 6, credit: 300,
    inv: { rec1: 20, rec2: 6, rec3: 0, rec4: 0, chip: 4, summ: 6 },
    ops: {}, runes: [], runeSeq: 1,
    story: {}, team: { story: STARTERS.slice(0, 4), hunt: STARTERS.slice(0, 4), tower: STARTERS.slice(0, 4), arena: STARTERS.slice(0, 4) },
    assistant: STARTERS[0], tower: 0,
    arena: { rank: 1500, attempts: 5, aTime: Date.now(), payTime: Date.now(), opps: null },
    gacha: { pity: 0, firstTen: true, total: 0 },
    daily: { day: today(), clear: 0, sanity: 0, hh: 0, upgrade: 0, arena: 0, rune: 0, claimed: {} },
    settings: { speed: 1, auto: false, sound: true, music: true, ai: "balanced" }, stats: newStats(),
  };
  for (const k of STARTERS) s.ops[k] = mkProg();
  welcomeMail(s);
  return s;
}
function load() {
  try { const raw = localStorage.getItem(SAVE_KEY); if (raw) { const s = JSON.parse(raw); if (s && s.v === 1) return s; } } catch (e) { /* storage unavailable */ }
  return null;
}
let saveTimer = 0;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) { /* storage unavailable */ } }, 150);
}
function tickTimers() {
  const now = Date.now(), mx = maxSanity(S.lvl);
  if (S.sanity >= mx) S.sTime = now;
  else { const n = Math.floor((now - S.sTime) / SAN_MS); if (n > 0) { S.sanity = Math.min(mx, S.sanity + n); S.sTime += n * SAN_MS; if (S.sanity >= mx) S.sTime = now; } }
  const A = S.arena;
  if (A.attempts >= 5) A.aTime = now;
  else { const n = Math.floor((now - A.aTime) / ARENA_MS); if (n > 0) { A.attempts = Math.min(5, A.attempts + n); A.aTime += n * ARENA_MS; } }
  if (S.daily.day !== today()) S.daily = { day: today(), clear: 0, sanity: 0, hh: 0, upgrade: 0, arena: 0, rune: 0, claimed: {} };
}

// ---------- inventory ----------
const WALLET = ["lmd", "orundum", "permit", "cert", "tokens", "prime", "credit"];
function have(k) { return WALLET.includes(k) ? S[k] : k === "sanity" ? S.sanity : (S.inv[k] || 0); }
function spend(k, n) { if (WALLET.includes(k)) S[k] -= n; else if (k === "sanity") S.sanity -= n; else S.inv[k] -= n; }
function give(rw) {
  const out = [];
  for (const k in rw) {
    const v = rw[k];
    if (k === "op") { const r = grantOp(v); out.push({ k: "op:" + v, n: 1, isNew: r.isNew }); continue; }
    if (k === "rune") { const r = makeRune(pick(RUNE_SETS), v); S.runes.push(r); out.push({ k: "rune", n: 1, rune: r }); continue; }
    if (k === "sanityMax") { S.sanity = Math.max(S.sanity, maxSanity(S.lvl)); S.sTime = Date.now(); out.push({ k: "sanity", n: maxSanity(S.lvl) }); continue; }
    if (WALLET.includes(k)) S[k] += v; else if (k === "sanity") S.sanity += v; else S.inv[k] = (S.inv[k] || 0) + v;
    out.push({ k, n: v });
  }
  return out;
}
function spendSanity(n) {
  S.sanity -= n; S.daily.sanity += n; S.xp += n * 10;
  let ups = 0;
  while (S.lvl < 120 && S.xp >= pxpNeed(S.lvl)) { S.xp -= pxpNeed(S.lvl); S.lvl++; ups++; }
  if (ups) { S.sanity = Math.max(S.sanity, maxSanity(S.lvl)); S.orundum += 30 * ups; toast(`Level ${S.lvl}! Prana restored, +${30 * ups} Jewels.`, "gold"); }
}

// ---------- operator stats ----------
const MAINS = {
  atk: { n: "ATK", p: 1, a: .06, b: .3 }, hp: { n: "HP", p: 1, a: .06, b: .3 }, def: { n: "DEF", p: 1, a: .06, b: .3 },
  spd: { n: "SPD", p: 0, a: 3, b: 18 }, cr: { n: "Crit Rate", p: 1, a: .04, b: .24 }, cd: { n: "Crit Dmg", p: 1, a: .07, b: .38 },
  acc: { n: "Accuracy", p: 1, a: .06, b: .32 }, res: { n: "Resistance", p: 1, a: .06, b: .32 },
};
const RUNE_RAR = ["", "Grade I", "Grade II", "Grade III", "Grade IV", "Grade V"];
const RUNE_RC = ["", "#9aa4b8", "#4fd17f", "#3fa7ff", "#b26bff", "#ff9a3c"];
const runeMain = r => { const m = MAINS[r.main]; return (m.a + (m.b - m.a) * r.lvl / 15) * [0, .6, .7, .8, .9, 1][r.rar]; };
const runeMainText = r => { const m = MAINS[r.main], v = runeMain(r); return `${m.n} +${m.p ? Math.round(v * 100) + "%" : Math.round(v)}`; };
function makeRune(set, rar) { return { id: S.runeSeq++, set, rar, lvl: 0, main: pick(Object.keys(MAINS)), eq: null }; }
const runeById = id => id == null ? null : S.runes.find(r => r.id === id);
const enhanceCost = r => 400 * (r.lvl + 1) * r.rar;
const sellValue = r => Math.round(300 * r.rar * (1 + r.lvl / 5));

function applySetStats(st, sets) {
  if (sets.has("Swift")) st.spd *= 1.25;
  if (sets.has("Fatal")) st.atk *= 1.35;
  if (sets.has("Blade")) st.cr += .12;
  if (sets.has("Focus")) st.acc += .2;
  if (sets.has("Energy")) st.hp *= 1.15;
  if (sets.has("Guard")) st.def *= 1.15;
  if (sets.has("Rage")) st.cd += .4;
  if (sets.has("Endure")) st.res += .2;
}
// STAT Personal Skills: percentage boosts to HP/ATK/DEF/SPD, flat boosts to the rate stats
function applyStatTalents(st, passives) {
  for (const t of passives || []) if (t.id === "STAT") for (const k in t.stats) {
    if (k === "hp" || k === "atk" || k === "def" || k === "spd") st[k] *= 1 + t.stats[k]; else st[k] += t.stats[k];
  }
}
function opStats(key, p, virtualSets) {
  const op = OPS[key], LV = effLV(p);
  const f = (.32 + .68 * LV / 120) * RAR_MULT[op.rar] * (1 + .02 * (p.pot - 1));
  const st = { hp: op.stats.hp * f, atk: op.stats.atk * f, def: op.stats.def * f, spd: op.stats.spd + p.elite * 2, cr: .15, cd: .5, acc: .25, res: .15 };
  const sets = new Set(virtualSets || []);
  for (const rid of p.runes || []) {
    const r = runeById(rid); if (!r) continue;
    sets.add(r.set);
    const v = runeMain(r);
    if (r.main === "atk" || r.main === "hp" || r.main === "def") st[r.main] *= 1 + v; else st[r.main] += v;
  }
  applySetStats(st, sets);
  applyStatTalents(st, op.passives);
  st.hp = Math.round(st.hp); st.atk = Math.round(st.atk); st.def = Math.round(st.def); st.spd = Math.round(st.spd);
  return { st, sets: [...sets] };
}
function enemyStats(key, LV) {
  const d = ENEMY[key], b = CLASS_BASE[d.cls], f = .32 + .68 * LV / 120;
  const st = { hp: b.hp * d.m.hp * f, atk: b.atk * d.m.atk * f, def: b.def * d.m.def * f, spd: d.m.spd + Math.floor(LV / 12), cr: .15, cd: .5, acc: .2 + LV / 400, res: .1 + LV / 500 };
  applyStatTalents(st, d.passives);
  st.hp = Math.round(st.hp); st.atk = Math.round(st.atk); st.def = Math.round(st.def); st.spd = Math.round(st.spd);
  return { st, sets: [] };
}
function progForLV(key, LV) {
  const op = OPS[key];
  let elite = 0;
  if (LV > 80 && op.maxElite >= 2) elite = 2; else if (LV > 30 && op.maxElite >= 1) elite = 1;
  const lvl = clamp(LV - LV_OFF[elite], 1, LV_CAP[elite]), sk = Math.min(7, 1 + Math.floor(LV / 18));
  return { lvl, xp: 0, elite, pot: 1, sk: [sk, sk, sk], runes: [null, null] };
}
function power(key, p) {
  const { st } = opStats(key, p);
  return Math.round((st.hp / 5 + st.atk * 2.2 + st.def * 1.2 + st.spd * 8 + st.cr * 900 + st.cd * 400) * (1 + .03 * (p.sk[0] + p.sk[1] + p.sk[2] - 3)));
}
const owned = k => !!S.ops[k];
const rosterPower = () => Object.keys(S.ops).reduce((a, k) => a + power(k, S.ops[k]), 0);
const topTeam = (n = 4) => Object.keys(S.ops).sort((a, b) => power(b, S.ops[b]) - power(a, S.ops[a])).slice(0, n);

// ---------- upgrades ----------
function opXp(key, n) {
  const p = S.ops[key]; if (!p) return 0;
  p.xp += n; let ups = 0;
  while (p.lvl < LV_CAP[p.elite] && p.xp >= xpNeed(p.lvl, p.elite)) { p.xp -= xpNeed(p.lvl, p.elite); p.lvl++; ups++; }
  if (p.lvl >= LV_CAP[p.elite]) p.xp = 0;
  return ups;
}
function useRecord(key, it) {
  const p = S.ops[key]; if (!p || !(S.inv[it] > 0) || p.lvl >= LV_CAP[p.elite]) return false;
  S.inv[it]--; opXp(key, ITEMS[it].xp); return true;
}
function autoLevel(key) {
  let used = 0;
  for (const it of ["rec1", "rec2", "rec3", "rec4"]) while (S.inv[it] > 0 && S.ops[key].lvl < LV_CAP[S.ops[key].elite]) { useRecord(key, it); used++; }
  return used;
}
const eliteCost = (key, e) => { const f = { 1: .4, 2: .5, 3: .6, 4: .8, 5: 1, 6: 1.3 }[OPS[key].rar]; return e === 1 ? { lmd: Math.round(8000 * f), chip: Math.ceil(2 * f) } : { lmd: Math.round(60000 * f), chip: Math.ceil(6 * f) }; };
function canPromote(key) {
  const p = S.ops[key], op = OPS[key]; if (!p || p.elite >= op.maxElite || p.lvl < LV_CAP[p.elite]) return false;
  const c = eliteCost(key, p.elite + 1); return S.lmd >= c.lmd && S.inv.chip >= c.chip;
}
function promote(key) {
  if (!canPromote(key)) return false;
  const p = S.ops[key], c = eliteCost(key, p.elite + 1);
  S.lmd -= c.lmd; S.inv.chip -= c.chip; p.elite++; p.lvl = 1; p.xp = 0; S.daily.upgrade++; return true;
}
const skillCost = r => ({ summ: [0, 1, 2, 3, 4, 5, 6][r], lmd: 1500 * r });
function skillUp(key, i) {
  const p = S.ops[key]; if (!p || p.sk[i] >= 7) return false;
  if (p.sk[i] >= 4 && p.elite < 1) return false;
  const c = skillCost(p.sk[i]); if (S.inv.summ < c.summ || S.lmd < c.lmd) return false;
  S.inv.summ -= c.summ; S.lmd -= c.lmd; p.sk[i]++; S.daily.upgrade++; return true;
}
function equipRune(key, slot, rid) {
  const p = S.ops[key], r = runeById(rid); if (!p || !r) return;
  if (r.eq) { const o = S.ops[r.eq.k]; if (o) o.runes[r.eq.s] = null; }
  const old = runeById(p.runes[slot]); if (old) old.eq = null;
  p.runes[slot] = rid; r.eq = { k: key, s: slot };
}
function unequipRune(key, slot) { const p = S.ops[key], r = runeById(p.runes[slot]); if (r) r.eq = null; p.runes[slot] = null; }
function enhanceRune(r) {
  if (r.lvl >= 15) return false; const c = enhanceCost(r); if (S.lmd < c) return false;
  S.lmd -= c; r.lvl++; S.daily.rune++; S.stats.codeUps++; return true;
}
function sellRune(r) { if (r.eq) unequipRune(r.eq.k, r.eq.s); S.lmd += sellValue(r); S.runes = S.runes.filter(x => x !== r); }

// ---------- headhunting ----------
// Tatari banner: one featured 5★ and two featured 4★ per day (Fire, Water or Wind versions)
function bannerToday() {
  const rng = seeded(hash(today() + "banner"));
  const f6 = BANNER_TOP[Math.floor(rng() * BANNER_TOP.length)];
  const four = OP_KEYS.filter(k => OPS[k].rar === 4 && EL_WEIGHT[OPS[k].el] > .1);
  const f5 = [four[Math.floor(rng() * four.length)], four[Math.floor(rng() * four.length)]];
  return { feat6: f6, feat5: [...new Set(f5)] };
}
const certFor = r => [0, 0, 0, 2, 10, 30, 30][r];
function grantOp(key) {
  if (!S.ops[key]) { S.ops[key] = mkProg(); return { key, isNew: true }; }
  const p = S.ops[key]; if (p.pot < 6) p.pot++; else S.cert += certFor(OPS[key].rar);
  S.cert += certFor(OPS[key].rar);
  return { key, isNew: false };
}
// 5★ 3% (+3% per Manifest after 50 without one), 4★ 18%, 3★ 79%; then a Moon style of that rarity, then an Element
function rollElement() { let r = R(); for (const el of ELS) { r -= EL_WEIGHT[el]; if (r < 0) return el; } return ELS[0]; }
const TOP_RATE = .03, MID_RATE = .18;
function rollRarity() {
  const top = TOP_RATE + Math.max(0, S.gacha.pity - 49) * .03, r = R();
  if (r < top) return 5; if (r < top + MID_RATE) return 4; return 3;
}
function pullOne(featured, forceMin) {
  let rar = rollRarity(); if (forceMin && rar < forceMin) rar = forceMin;
  if (rar === 5) { S.gacha.pity = 0; S.stats.fives++; } else S.gacha.pity++;
  S.gacha.total++;
  const B = featured ? bannerToday() : null;
  let key;
  if (B && rar === 5 && R() < .5) key = B.feat6;
  else if (B && rar === 4 && R() < .5) key = pick(B.feat5);
  else key = pick(FAMS.filter(f => OPS[homeKey(f)].rar === rar)) + "-" + elKey(rollElement());
  return grantOp(key);
}
function headhunt(n, featured) {
  const res = [];
  for (let i = 0; i < n; i++) {
    const last = i === n - 1 && n === 10 && S.gacha.firstTen && !res.some(r => OPS[r.key].rar >= 4);
    res.push(pullOne(featured, last ? 4 : 0));
  }
  if (n === 10) S.gacha.firstTen = false;
  S.daily.hh += n;
  return res;
}

// ---------- arena ----------
function genOpps() {
  const r = S.arena.rank, mine = topTeam(4);
  const avg = mine.length ? mine.reduce((a, k) => a + power(k, S.ops[k]), 0) / mine.length : 2000;
  const pool = OP_KEYS.filter(k => OPS[k].rar >= 3);
  S.arena.opps = [.04, .1, .18].map(f => {
    const rank = Math.max(1, r - Math.max(1, Math.ceil(r * f)) - ri(0, 3));
    const mult = .8 + .6 * (1 - rank / 1600) + (f - .1) * .5;
    const team = [...pool].sort(() => R() - .5).slice(0, 4);
    const lead = team.find(k => OPS[k].leader); if (lead) { team.splice(team.indexOf(lead), 1); team.unshift(lead); }
    const units = team.map(k => {
      let lo = 1, hi = 120, best = 1;
      for (let i = 0; i < 12; i++) { const m = (lo + hi) >> 1; if (power(k, progForLV(k, m)) < avg * mult) { lo = m + 1; best = m; } else hi = m - 1; }
      return { op: k, LV: best };
    });
    return { rank, name: pick(ARENA_N1) + " " + pick(ARENA_N2) + " " + ri(2, 99), team: units, pw: units.reduce((a, u) => a + power(u.op, progForLV(u.op, u.LV)), 0) };
  });
}
const payout = rank => ({ orundum: Math.max(20, Math.round(360 / (1 + rank / 45))), tokens: Math.max(40, Math.round(900 / (1 + rank / 90))) });

// ---------- story progress ----------
const nodeStars = id => S.story[id] || 0;
function nodeOpen(nd) {
  if (nd.idx === 0) { const chs = nd.ep.chapters, ci = chs.indexOf(nd.ch); return ci === 0 || chapterCleared(chs[ci - 1]); }
  let prev = nd.ch.nodes[nd.idx - 1];
  if (prev.type === "side") prev = nd.ch.nodes[nd.idx - 2] || prev;
  return nodeStars(prev.id) > 0;
}
const chapterCleared = ch => ch.nodes.every(n => n.type === "side" || nodeStars(n.id) > 0);
function nextNode() {
  for (const ep of STORY) for (const ch of ep.chapters) for (const nd of ch.nodes) if (nd.type !== "side" && nodeOpen(nd) && !nodeStars(nd.id)) return nd;
  return null;
}

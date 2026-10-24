
<div id="app">
  <header id="topbar"></header>
  <main id="view"></main>
  <nav id="tabs"></nav>
</div>
<div id="battle" hidden></div>
<div id="dlg" hidden></div>
<div id="gacha" hidden></div>
<div id="modal" hidden></div>
<div id="toast"></div>
<script>
"use strict";
/* =====================================================================
   MELTY BLOOD RPG — an unofficial, non-commercial fan game.
   Melty Blood, Tsukihime and their characters belong to TYPE-MOON and French-Bread.
   All character art here is drawn procedurally on canvas; no official assets are used.
   ===================================================================== */

// ---------- utils ----------
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const R = Math.random;
const ri = (a, b) => a + Math.floor(R() * (b - a + 1));
const pick = a => a[Math.floor(R() * a.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmt = n => n >= 1e6 ? (n / 1e6).toFixed(n >= 1e7 ? 0 : 1) + "M" : n >= 1e4 ? (n / 1e3).toFixed(n >= 1e5 ? 0 : 1) + "K" : Math.round(n).toLocaleString("en-US");
const fmtFull = n => Math.round(n).toLocaleString("en-US");
const pct = v => Math.round(v * 100) + "%";
function seeded(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
function hash(str) { let h = 2166136261; for (const c of str) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
const dur = ms => { const m = Math.floor(ms / 60000), s = Math.floor(ms % 60000 / 1000); if (m >= 60) return Math.floor(m / 60) + "h " + (m % 60) + "m"; return m + ":" + String(s).padStart(2, "0"); };
const today = () => new Date().toISOString().slice(0, 10);

// ---------- Elements, Moon styles + rarity ----------
// Every character comes in three Moon styles, and every Moon style in all five Elements (Summoners War style).
//  · Moon style (internal field: style): the kit, role, Talent and a style trait.
//  · Element (internal field: el): matchups, colour, a small stat lean and kit tweaks (ELEMENT_KIT in a3b_kits.js).
// Elements are the magecraft Elements of the Nasuverse: three of the Five Great Elements form the triangle
// (Water beats Fire, Fire beats Wind, Wind beats Water), and Ether (the fifth Great Element) and Imaginary Numbers
// (a rare "imaginary" Element) are the rare pair that each beat the other.
const ELS = ["Fire", "Water", "Wind", "Ether", "Imaginary"];
const ELC = { Fire: "#ff7a3c", Water: "#4aa8ff", Wind: "#5fdc8c", Ether: "#ffe6a0", Imaginary: "#a97bff" };
const BEATS = { Water: "Fire", Fire: "Wind", Wind: "Water", Ether: "Imaginary", Imaginary: "Ether" };
const RARE_ELS = ["Ether", "Imaginary"];
const elName = el => el === "Imaginary" ? "Imaginary Numbers" : el;
const elShort = el => el === "Imaginary" ? "Imag." : el;
function elementRel(a, t) { if (BEATS[a] === t) return "adv"; if (BEATS[t] === a && !RARE_ELS.includes(a)) return "dis"; return "neu"; }
const elKey = el => el.toLowerCase();
const weakTo = el => Object.keys(BEATS).find(k => BEATS[k] === el);
// Traits follow the fighting game: Crescent fires up Blood Heat at high meter, Half has the toughest guard and an
// automatic Circuit Spark, Full charges its own meter.
const STYLES = ["Crescent", "Half", "Full"];
const STYLE = {
  Crescent: { n: "Crescent Moon", sfx: "c", d: "Blood Heat: deals 15% more damage while your Magic Circuit is at 200% or more." },
  Half: { n: "Half Moon", sfx: "h", d: "Toughest guard: takes 6% less damage. Circuit Spark: the first time it drops below half HP, cleanses all its debuffs." },
  Full: { n: "Full Moon", sfx: "f", d: "Charge: builds 8% Magic Circuit at the start of each of its turns. Its Arc Drives deal 25% more damage." },
};
const styleName = st => (STYLE[st] || { n: st }).n;
const CRES_HEAT = .15, CRES_HEAT_AT = 200, HALF_GUARD = .06, FULL_CHARGE = 8, FULL_ARC = .25;
const RC = { 1: "#c9d1de", 2: "#7fdc8a", 3: "#8fd8ff", 4: "#c39bff", 5: "#f1d07a", 6: "#ff9a3c" };
// Engine class keys stay internal; players see TYPE-MOON class names (Fate's Servant classes, plus Magus for
// magic attackers). As in Fate/Grand Order, Casters are the support class and Rulers the protectors and healers.
const CLASSES = ["Vanguard", "Guard", "Defender", "Sniper", "Caster", "Medic", "Supporter", "Specialist"];
const CLASS_NAME = { Vanguard: "Lancer", Guard: "Saber", Defender: "Shielder", Sniper: "Archer", Caster: "Magus", Medic: "Ruler", Supporter: "Caster", Specialist: "Assassin" };
const clsName = c => CLASS_NAME[c] || c;

// ---------- icons ----------
const IC = {
  sanity: '<svg viewBox="0 0 24 24"><path fill="#a9c8ff" d="M12 2c3 4 6 7.5 6 11.5A6 6 0 0 1 6 13.5C6 9.5 9 6 12 2z"/><path fill="#e8f0ff" d="M10 14a2 2 0 0 0 2 2" stroke="#e8f0ff" stroke-width="1.6" fill="none"/></svg>',
  lmd: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="#d8c27a"/><circle cx="12" cy="12" r="6.5" fill="none" stroke="#7a6320" stroke-width="1.5"/><path d="M8.5 7.5 12 12l3.5-4.5M12 12v5M9.5 12.5h5M9.5 15h5" stroke="#4a3a0e" stroke-width="1.7" fill="none"/></svg>',
  orundum: '<svg viewBox="0 0 24 24"><path fill="#c39bff" d="M12 2 19 8l-7 14L5 8z"/><path fill="#efe4ff" d="M12 2 9 8h6z"/><path fill="#6b3fb0" d="M12 22 15 8h4z"/><path d="M14.8 4.6a3 3 0 1 0 2.4 3.4 2.4 2.4 0 1 1-2.4-3.4z" fill="#fff8"/></svg>',
  permit: '<svg viewBox="0 0 24 24"><rect x="3" y="6" width="18" height="12" rx="2" fill="#ff4d6d"/><path d="M8 6v12" stroke="#5e0c22" stroke-dasharray="2 2"/><path fill="#fff1f4" d="M15.5 8.5a3.5 3.5 0 1 0 2.5 5.8 2.8 2.8 0 1 1-2.5-5.8z"/></svg>',
  cert: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="#3a2a5a"/><circle cx="12" cy="12" r="7" fill="none" stroke="#c39bff" stroke-width="1.4"/><path fill="#f1dca2" d="M13.5 7a5 5 0 1 0 3.5 8.3A4 4 0 1 1 13.5 7z"/></svg>',
  rec1: '<svg viewBox="0 0 24 24"><path fill="#cfd6e2" d="M10 3h4v4l3 4v8a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2v-8l3-4z"/><path fill="#c8304e" d="M8 15h8v4a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1z"/></svg>',
  rec2: '<svg viewBox="0 0 24 24"><path fill="#cfd6e2" d="M10 3h4v4l3 4v8a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2v-8l3-4z"/><path fill="#d8243f" d="M8 12h8v7a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1z"/></svg>',
  rec3: '<svg viewBox="0 0 24 24"><path fill="#cfd6e2" d="M9 2h6v4l4 5v9a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-9l4-5z"/><path fill="#e0163a" d="M6 11h12v9a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1z"/></svg>',
  rec4: '<svg viewBox="0 0 24 24"><path fill="#f1dca2" d="M9 2h6v4l4 5v9a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-9l4-5z"/><path fill="#9c0a2a" d="M6 9h12v11a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1z"/><circle cx="12" cy="15" r="2.4" fill="#ffd1dc"/></svg>',
  chip: '<svg viewBox="0 0 24 24"><path fill="#e8eef8" d="m12 2 4 6-4 14-4-14z"/><path fill="#a9c8ff" d="m12 2 4 6h-8z"/><path fill="#7d93c8" d="M12 22 16 8h-4z"/></svg>',
  summ: '<svg viewBox="0 0 24 24"><path fill="#7a2a8a" d="M5 3h12a2 2 0 0 1 2 2v16H7a2 2 0 0 1-2-2z"/><circle cx="12" cy="11" r="3.6" fill="none" stroke="#f1dca2" stroke-width="1.4"/><path d="M12 7.4v7.2M8.4 11h7.2" stroke="#f1dca2" stroke-width="1"/></svg>',
  tokens: '<svg viewBox="0 0 24 24"><path fill="#ff4d6d" d="M12 2 21 7v10l-9 5-9-5V7z"/><text x="12" y="15.5" text-anchor="middle" font-size="8.5" font-weight="900" fill="#fff" font-family="Arial">VS</text></svg>',
  star: '<svg viewBox="0 0 24 24"><path fill="#f2c14e" stroke="#7a5310" stroke-width="1" d="m12 2 3 7 7 .6-5.4 4.6 1.7 7.3L12 17.6l-6.3 3.9 1.7-7.3L2 9.6 9 9z"/></svg>',
  starOff: '<svg viewBox="0 0 24 24"><path fill="#1a2238" stroke="#3a4766" stroke-width="1" d="m12 2 3 7 7 .6-5.4 4.6 1.7 7.3L12 17.6l-6.3 3.9 1.7-7.3L2 9.6 9 9z"/></svg>',
  crown: '<svg viewBox="0 0 20 14"><path fill="#f2c14e" stroke="#5b3e08" d="M1 13 2 3l5 5 3-7 3 7 5-5 1 10z"/></svg>',
  sword: '<svg viewBox="0 0 24 24"><path d="M4 20 17 7" stroke="#e8edf7" stroke-width="3" stroke-linecap="round"/><path d="M17 7l3-3" stroke="#fff" stroke-width="2"/><path d="M3 15l6 6M5 19l-2 2" stroke="#c9a24a" stroke-width="2.5" stroke-linecap="round"/></svg>',
  bow: '<svg viewBox="0 0 24 24"><path d="M6 3c8 3 12 7 15 15" stroke="#c9a24a" stroke-width="2.4" fill="none"/><path d="M6 3 21 18" stroke="#e8edf7" stroke-width="1"/><path d="M3 21 15 9" stroke="#e8edf7" stroke-width="2"/><path d="M15 9l2-4 2 2z" fill="#fff"/></svg>',
  orb: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="7" fill="#7a5ad8"/><circle cx="10" cy="10" r="3" fill="#d8c8ff"/><path d="M3 12h3M18 12h3M12 3v3M12 18v3" stroke="#b9a6ff" stroke-width="2"/></svg>',
  heal: '<svg viewBox="0 0 24 24"><path fill="#43d67e" d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z"/></svg>',
  shield: '<svg viewBox="0 0 24 24"><path fill="#5fd4ff" d="M12 2 20 5v6c0 5-3.5 9-8 11-4.5-2-8-6-8-11V5z" opacity=".85"/><path fill="#04121f" d="M12 6 16 8v3c0 3-1.8 5.5-4 6.6z"/></svg>',
  boost: '<svg viewBox="0 0 24 24"><path fill="#f2c14e" d="M12 2 19 10h-4v5H9v-5H5zM6 17h12v2H6zm0 3h12v2H6z"/></svg>',
  skull: '<svg viewBox="0 0 24 24"><path fill="#e8edf7" d="M12 2c5 0 8 3.5 8 8 0 3-1.5 4.5-3 5.5V19h-3v-2h-1v2h-2v-2h-1v2H7v-3.5C5.5 14.5 4 13 4 10c0-4.5 3-8 8-8z"/><circle cx="9" cy="10" r="2" fill="#05080f"/><circle cx="15" cy="10" r="2" fill="#05080f"/></svg>',
  book: '<svg viewBox="0 0 24 24"><path fill="#5fd4ff" d="M4 4h7v16H5a1 1 0 0 1-1-1z"/><path fill="#9fe0ff" d="M13 4h7v15a1 1 0 0 1-1 1h-6z"/></svg>',
  chest: '<svg viewBox="0 0 24 24"><rect x="3" y="9" width="18" height="11" rx="1" fill="#8a5a2a"/><path fill="#b07a3a" d="M3 9a9 5 0 0 1 18 0z"/><rect x="10" y="11" width="4" height="4" fill="#f2c14e"/></svg>',
  claw: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 20c3-6 3-11 1-16M10 20c2-6 2-11 1-16M15 20c1-6 1-11 2-16M19 20c0-5 1-9 3-12"/></svg>',
  tower: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="6" y="2" width="12" height="20" rx="1.5"/><rect x="8.5" y="5" width="7" height="6"/><circle cx="10" cy="15" r="1.2"/><path d="M13 15h3M8 19h8"/></svg>',
  arena: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 5l4 10 4-10M21 6.5c-1-1.5-5-2-5 .8 0 3 5 2 5 5 0 2.8-4 2.5-5 .7"/><path d="M4 20h16"/></svg>',
  home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 11 12 3l9 8v10h-6v-6H9v6H3z"/></svg>',
  story: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6c3-2 6-2 9 0 3-2 6-2 9 0v13c-3-2-6-2-9 0-3-2-6-2-9 0z"/><path d="M12 6v13"/></svg>',
  battles: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 20 15 9M15 9l2-5 3 3-5 2M20 20 9 9M9 9 7 4 4 7l5 2"/></svg>',
  ops: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="8" r="3.5"/><path d="M2 20c1-4 4-6 7-6s6 2 7 6"/><circle cx="17" cy="7" r="2.5"/><path d="M17 12c2.5 0 4.5 2 5 5"/></svg>',
  hunt: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3 21 8v8l-9 5-9-5V8z"/><path d="M12 8v8M8 10l8 4M16 10l-8 4"/></svg>',
  missions: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="3" width="14" height="18" rx="2"/><path d="m8 9 2 2 4-4M8 15h8"/></svg>',
  shop: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 9h13v5a6 6 0 0 1-6 6h-1a6 6 0 0 1-6-6z"/><path d="M17 11h1.5a2.5 2.5 0 0 1 0 5H16M8 2c-1 1.5 1 2.5 0 4M12 2c-1 1.5 1 2.5 0 4"/></svg>',
  depot: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 8 12 3l9 5v9l-9 5-9-5z"/><path d="M3 8l9 5 9-5M12 13v9"/></svg>',
  gearIc: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1"/></svg>',
  back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M15 4 7 12l8 8"/></svg>',
  rune: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="#2a1430" stroke="#ff4d6d" stroke-width="1.6"/><path d="M12 4.5 18.5 16h-13z" fill="none" stroke="#f1dca2" stroke-width="1.3"/><circle cx="12" cy="12.4" r="2.2" fill="#ff4d6d"/></svg>',
  prime: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8" fill="#e8eef8"/><circle cx="9" cy="9" r="2" fill="#c9d1de"/><circle cx="14.5" cy="14" r="2.6" fill="#c9d1de"/><circle cx="15" cy="8" r="1.2" fill="#c9d1de"/><circle cx="12" cy="12" r="8" fill="none" stroke="#a9c8ff" stroke-width="1"/></svg>',
  credit: '<svg viewBox="0 0 24 24"><rect x="3" y="6" width="18" height="12" rx="2" fill="#8a5a3a"/><path d="M7 9h6v4a3 3 0 0 1-6 0zM13 10h1.2a1.4 1.4 0 0 1 0 2.8H13" stroke="#f3e2c8" stroke-width="1.3" fill="none"/></svg>',
  lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>',
  mail: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>',
  trophy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4M12 14v4M8 21h8M9 18h6"/></svg>',
  gift: '<svg viewBox="0 0 24 24"><rect x="3" y="9" width="18" height="12" rx="1.5" fill="#c8203a"/><rect x="2" y="7" width="20" height="4" rx="1" fill="#ff4d6d"/><path d="M12 7v14" stroke="#f1dca2" stroke-width="2.4"/><path d="M12 7c-2-4-6-4-6-1.5S10 7 12 7c2 0 6-.5 6-1.5S14 3 12 7z" fill="none" stroke="#f1dca2" stroke-width="1.6"/></svg>',
  free10: '<svg viewBox="0 0 24 24"><rect x="2" y="5" width="20" height="14" rx="2" fill="#f1d07a"/><path d="M7 5v14" stroke="#7a5310" stroke-dasharray="2 2"/><text x="14.5" y="15.5" text-anchor="middle" font-size="8" font-weight="900" fill="#4a1020" font-family="Arial">×10</text></svg>',
  gold5: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#3a0a16"/><circle cx="12" cy="12" r="7.5" fill="#e0244a"/><circle cx="15" cy="10" r="6.5" fill="#3a0a16"/><path fill="#f2c14e" d="m8.5 13 1 2.2 2.3.2-1.7 1.5.5 2.3-2.1-1.2-2.1 1.2.5-2.3-1.7-1.5 2.3-.2z"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="#43d67e" stroke-width="3"><path d="m5 12 5 5 9-10"/></svg>',
  cross: '<svg viewBox="0 0 24 24" fill="none" stroke="#5b6886" stroke-width="3"><path d="M6 6l12 12M18 6 6 18"/></svg>',
};
const ITEMS = {
  lmd: { n: "Yen", ic: IC.lmd },
  orundum: { n: "Jewel", ic: IC.orundum, d: "A gem charged with prana, in the style of jewel magecraft. Used to Manifest characters." },
  permit: { n: "Rumor Ticket", ic: IC.permit, d: "One Manifest each." },
  cert: { n: "Tatari Fragment", ic: IC.cert, d: "Left behind when a rumor takes shape twice. Spent at the Tatari Fragment counter." },
  tokens: { n: "Versus Point", ic: IC.tokens, d: "Earned in Versus." },
  prime: { n: "Holy Relic", ic: IC.prime, d: "A relic from the Burial Agency's vaults. Restores Prana, or converts to 180 Jewels." },
  credit: { n: "Ahnenerbe Coupon", ic: IC.credit, d: "Spent at the Ahnenerbe café counter." },
  sanity: { n: "Prana", ic: IC.sanity },
  rec1: { n: "Blood Drop", ic: IC.rec1, xp: 200 },
  rec2: { n: "Blood Vial", ic: IC.rec2, xp: 400 },
  rec3: { n: "Blood Flask", ic: IC.rec3, xp: 1000 },
  rec4: { n: "True Ancestor's Blood", ic: IC.rec4, xp: 2000 },
  chip: { n: "Crimson Moon Shard", ic: IC.chip, d: "A sliver of the Crimson Moon. Used for Ascension." },
  summ: { n: "Magic Crest Fragment", ic: IC.summ, d: "A piece of a family Magic Crest. Used to raise Skill Ranks." },
  free10: { n: "Night of Rumors ×10", ic: IC.free10, d: "One free ×10 Manifest. Use it at the Tatari." },
  gold5: { n: "Crimson Moon Rumor", ic: IC.gold5, d: "A rumor too strong to fail: Manifests one random 5★ character. Use it at the Tatari." },
};

// ---------- status effects (TYPE-MOON / Fate names where one exists) ----------
const FX = {
  ATK_UP:       { n: "ATK Up", b: 1, s: "A↑", d: "+50% ATK" },
  DEF_UP:       { n: "DEF Up", b: 1, s: "D↑", d: "+50% DEF" },
  SPD_UP:       { n: "SPD Up", b: 1, s: "S↑", d: "+30% Speed" },
  CRIT_RATE_UP: { n: "Crit Rate Up", b: 1, s: "C↑", d: "+30% Critical Rate" },
  IMMUNITY:     { n: "Debuff Immunity", b: 1, s: "IM", d: "Blocks new debuffs" },
  HOT:          { n: "Healing Magecraft", b: 1, s: "HM", d: "Heals 5% Max HP at the start of each turn (stacks)" },
  SHIELD:       { n: "Bounded Field", b: 1, s: "BF", d: "Absorbs damage before HP" },
  INVINCIBLE:   { n: "Invincible", b: 1, s: "IV", d: "Takes no damage" },
  COUNTER:      { n: "Shield Counter", b: 1, s: "SC", d: "30% chance to counterattack when hit" },
  TAUNT:        { n: "Target Focus", b: 1, s: "TF", d: "Single-target attacks must target this unit" },
  STEALTH:      { n: "Presence Concealment", b: 1, s: "PC", d: "Can't be targeted by single-target skills" },
  DEF_BREAK:    { n: "DEF Down", b: 0, s: "D↓", d: "DEF is 40% less effective" },
  ATK_DOWN:     { n: "ATK Down", b: 0, s: "A↓", d: "-30% ATK" },
  BRAND:        { n: "Line of Death", b: 0, s: "LD", d: "Takes 25% more damage" },
  HEAL_BLOCK:   { n: "Heal Block", b: 0, s: "HB", d: "Can't be healed" },
  STUN:         { n: "Bind", b: 0, s: "BD", d: "Loses the next turn" },
  SLOW:         { n: "Slow", b: 0, s: "SW", d: "-30% Speed" },
  GLANCING:     { n: "Glancing", b: 0, s: "GL", d: "50% chance to land glancing hits (-30%, no crit)" },
  DOT:          { n: "Curse", b: 0, s: "CU", d: "Loses 5% Max HP per stack at the start of each turn" },
  PROVOKE:      { n: "Provoke", b: 0, s: "PV", d: "Forced to use S1 on the provoker" },
  SILENCE:      { n: "Skill Seal", b: 0, s: "SS", d: "Can't use S2 or S3" },
};
const RUNE_INFO = {
  Swift: "+25% SPD", Fatal: "+35% ATK", Blade: "+12% Crit Rate", Focus: "+20% Accuracy", Energy: "+15% HP", Guard: "+15% DEF",
  Rage: "+40% Crit Damage", Despair: "25% chance to Bind on each hit", Revenge: "15% chance to counterattack", Violent: "22% chance of an extra turn",
  Will: "Debuff Immunity for 1 turn at battle start", Shield: "Team Bounded Field (15% of HP) at battle start", Nemesis: "Gain turn meter when damaged", Endure: "+20% Resistance",
};
const RUNE_SETS = Object.keys(RUNE_INFO);
// Mystic Code set names shown to players (internal keys drive the engine)
const SETN = { Swift: "Time Alteration", Fatal: "Reinforcement", Blade: "Mystic Eyes", Focus: "Hypnosis", Energy: "Regeneration", Guard: "Protection of the Faith",
  Rage: "Bloodlust", Despair: "Black Key", Revenge: "Reverse Beat", Violent: "Heat", Will: "Holy Shroud", Shield: "Gamaliel", Nemesis: "Inversion Impulse", Endure: "Magic Resistance" };
// Fate-style skill ranks for Skill Levels 1–7
const RANK = ["", "E", "D", "C", "B", "A", "A+", "EX"];
const setName = k => SETN[k] || k;

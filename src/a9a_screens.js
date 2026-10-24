
// =====================================================================
//  SCREENS (1/2): shell, lobby, story map, node sheet, team, dialogue
// =====================================================================
const UI = { view: "home", arg: null, el: "all", sty: "all", cls: "all", sort: "power", all: false, opTab: "info", team: null, depotTab: "runes", shopTab: "credit", runeSet: "all", hhStd: false };

function toast(msg, cls = "") { const t = document.createElement("div"); t.className = "toast " + cls; t.textContent = msg; $("#toast").appendChild(t); setTimeout(() => t.remove(), 2600); }
function openModal(html) { const m = $("#modal"); m.innerHTML = `<div class="mbox" role="dialog">${html}</div>`; m.hidden = false; m.onclick = e => { if (e.target === m) closeModal(); }; }
function closeModal() { const m = $("#modal"); m.hidden = true; m.innerHTML = ""; }
const starRow = (n, max = 6) => { let s = ""; for (let k = 1; k <= max; k++) s += k <= n ? IC.star : ""; return `<div class="rstars">${s}</div>`; };
function opHTML(key, o = {}) {
  const op = OPS[key], p = o.prog !== undefined ? o.prog : S.ops[key];
  const own = !!p;
  return `<div class="pt ${own || o.show ? "" : "locked"}" style="--s:${o.s || 72}px;--gc:${RC[op.rar]}">
    ${o.nostars ? "" : starRow(op.rar)}
    <div class="ring"><img src="${headURL(op)}" alt="${esc(op.n)}" loading="lazy" draggable="false"></div>
    ${o.noel ? "" : `<span class="eldot ${op.style}" style="--ec:${ELC[op.el]}"></span>`}
    ${p && !o.nolv ? `<div class="lv num">${p.lvl}</div>${p.elite ? `<span class="elite">A${p.elite}</span>` : ""}${p.pot > 1 ? `<span class="potb">SO${p.pot}</span>` : ""}` : ""}
  </div>`;
}
// roster label: short name, then Element (in its colour) and Moon style. Badges: moon phase = style, colour = Element.
const pnameHTML = k => `<div class="pname">${esc(OPS[k].short)}<span class="sty"><b style="color:${ELC[OPS[k].el]}">${elShort(OPS[k].el)}</b> ${OPS[k].style}</span></div>`;
const elChip = el => `<span class="el ${el}">${el}</span>`;
const styleChip = st => `<span class="el sty">${styleName(st)}</span>`;
function enHTML(spec, s = 46) {
  if (spec.op) return opHTML(spec.op, { s, prog: progForLV(spec.op, spec.LV || 1), nostars: 1 });
  const d = ENEMY[spec.en];
  return `<div class="pt" style="--s:${s}px;--gc:${d.boss ? "var(--ds)" : "#6b7a99"}"><div class="ring"><img src="${enemyArt(spec.en).head}" alt="${esc(d.n)}"></div><span class="eldot ${d.style || "Full"}" style="--ec:${ELC[d.el]}"></span>${spec.LV ? `<div class="lv num">${spec.LV}</div>` : ""}</div>`;
}
function itemIcon(k) { return k === "sanity" ? IC.sanity : (ITEMS[k] && ITEMS[k].ic) || IC.boost; }
function rewardsHTML(list) {
  const merged = [];
  for (const r of list) { const m = merged.find(x => x.k === r.k && !r.rune && !x.rune && !r.k.startsWith("op:")); if (m) m.n += r.n; else merged.push({ ...r }); }
  return merged.map(r => {
    if (r.k.startsWith("op:")) { const k = r.k.slice(3); return `<div class="rw">${opHTML(k, { s: 54, nostars: 1, nolv: 1, show: 1 })}<span>${r.isNew === false ? "Spirit Origin +1" : "New character"}</span><span class="tiny dim">${esc(opLabel(OPS[k]))}</span></div>`; }
    if (r.k === "rune") return `<div class="rw"><div class="ri" style="width:54px;height:54px;color:${RUNE_RC[r.rune.rar]}">${IC.rune}</div><span>${setName(r.rune.set)}</span><span class="tiny dim">${RUNE_RAR[r.rune.rar]}</span></div>`;
    const name = r.k === "xp" ? "Character EXP" : r.k === "rank" ? "Rank" : (ITEMS[r.k] && ITEMS[r.k].n) || r.k;
    return `<div class="rw"><div class="ri" style="width:54px;height:54px">${r.k === "xp" ? IC.boost : r.k === "rank" ? IC.arena : itemIcon(r.k)}</div><span class="num">${r.k === "rank" ? "#" + r.n : "×" + fmt(r.n)}</span><span class="tiny dim">${esc(name)}</span></div>`;
  }).join("");
}
const back = (act, label, data = "") => `<button class="btn ghost sm" data-act="${act}" ${data}>${IC.back.replace("<svg", '<svg width="16" height="16"')}${label}</button>`;

// ---------- shell ----------
function renderTop() {
  tickTimers();
  const mx = maxSanity(S.lvl);
  $("#topbar").innerHTML = `
    <button class="me" data-act="settings" aria-label="Settings">
      <div class="me-badge num">${S.lvl}</div>
      <div style="min-width:0;text-align:left"><div class="me-name">${esc(S.name)}</div><div class="me-xp"><i style="width:${S.xp / pxpNeed(S.lvl) * 100}%"></i></div></div>
    </button>
    <div class="res">
      <button class="pill" data-act="sanity" aria-label="Prana">${IC.sanity}<span id="sanPill">${S.sanity}<small>/${mx}</small></span></button>
      <div class="pill">${IC.lmd}<span>${fmt(S.lmd)}</span></div>
      <div class="pill">${IC.orundum}<span>${fmt(S.orundum)}</span></div>
    </div>`;
  const tabs = [["home", "Home", IC.home], ["story", "Story", IC.story], ["battle", "Battle", IC.battles], ["ops", "Characters", IC.ops], ["hh", "Tatari", IC.permit.replace('viewBox', 'fill="currentColor" viewBox')]];
  const on = { op: "ops", team: UI.arg && UI.arg.from || "story", hunt: "battle", tower: "battle", arena: "battle", chapter: "story", missions: "home", shop: "home", depot: "home", inbox: "home", ach: "home", settings: "home" }[UI.view] || UI.view;
  $("#tabs").innerHTML = tabs.map(([v, n, ic]) => `<button class="${on === v ? "on" : ""}" data-act="go" data-v="${v}">${ic}<span>${n}</span>${badge(v) ? '<i class="dot"></i>' : ""}</button>`).join("");
}
function badge(v) {
  if (v === "home") return dailyReady() || unclaimedMail().length > 0;
  if (v === "story") return !!nextNode();
  if (v === "battle") return Date.now() - S.arena.payTime >= PAYOUT_MS;
  if (v === "hh") return S.permit > 0 || S.orundum >= 600 || S.inv.free10 > 0 || S.inv.gold5 > 0;
  return false;
}
const dailyReady = () => DAILIES.some(d => !S.daily.claimed[d.id] && S.daily[d.id] >= d.goal);
function route(view, arg, keep) {
  UI.view = view; UI.arg = arg;
  if (UI.inGame && !BT.on) music(screenMusic(view));
  if (UI.inGame) metaTick();
  const el = $("#view"), st = el.scrollTop;
  el.innerHTML = (SCREENS[view] || SCREENS.home)(arg);
  el.scrollTop = keep ? st : 0;
  renderTop(); save();
}
const rerender = () => route(UI.view, UI.arg, true);

// ---------- lobby ----------
const QUIPS = {
  shiki: ["I can see the lines on everything tonight. Let's be careful.", "Akiha's going to lecture me about the curfew again.", "If something walks in this town after midnight, we'll find it."],
  nanaya: ["Kill or be killed. Tonight it's going to be the first one.", "Don't mind me. I'm only a rumor with a knife."],
  arcueid: ["Shiki, Shiki! Let's go for a walk. A long one. Like, all night.", "I'm not hungry. Really. ...Mostly.", "This town smells nice at night."],
  ciel: ["Curry first, executions later.", "The Burial Agency doesn't sleep, and neither do I, apparently.", "Tohno-kun, I'm watching that vampire very closely."],
  akiha: ["Nii-san, the curfew is eleven o'clock. That was not a suggestion.", "Hmph. If you're going out, at least take me with you.", "The Tohno name will not be laughed at."],
  hisui: ["...I have prepared your room.", "Please be careful tonight, Master Shiki.", "My sister is in the laboratory again. I'd stay away."],
  kohaku: ["Ahaha! Would you like some tea? It's completely normal tea.", "I've been working on a new invention!", "Lady Akiha's in a good mood today. Probably."],
  sion: ["I calculated a 97% chance you would tap me again.", "Divided thought: one of me is thinking about the Tatari, another about dinner.", "Atlas does not leave its debts unpaid."],
  satsuki: ["Shiki! Don't forget about me, okay?", "Being a vampire is harder than it looks.", "I'm not just a background character!"],
  len: ["...", "(Len stares at you, then curls up on the sofa.)", "(A small yawn.)"],
  "neco-arc": ["Nyaa! Don't poke me, I'm a delicate creature!", "Buy one Neco, get one Chaos free!"],
  _: ["The moon is bright tonight.", "Ready when you are.", "Another night, another rumor.", "Let's walk Misaki Town together."],
};
function nextHint() {
  const nd = nextNode();
  if (S.inbox.some(m => m.tag === "welcome" && !m.claimed)) return { act: "inbox", text: "Your welcome gifts are waiting in the <b>Inbox</b>: a free ×10 Manifest and a guaranteed 5★." };
  if (S.inv.free10 > 0 || S.inv.gold5 > 0) return { act: "go", data: 'data-v="hh"', text: "Use your <b>free Manifests</b> at the Tatari." };
  if (dailyReady()) return { act: "missions", text: "Mission rewards are ready to claim." };
  const um = unclaimedMail().length;
  if (um) return { act: "inbox", text: `You have <b>${um}</b> unclaimed gift${um > 1 ? "s" : ""} in your Inbox.` };
  if (S.gacha.total === 0) return { act: "go", data: 'data-v="hh"', text: "Try your first <b>Manifest</b> at the Tatari. Your first ten guarantee a 4★ or better." };
  if (nd) return { act: "openNode", data: `data-id="${nd.id}"`, text: `Continue the story: <b>${nd.id} ${esc(nd.name)}</b>.` };
  return { act: "go", data: 'data-v="battle"', text: "Farm Mystic Codes on <b>Night Patrol</b> or climb <b>Arcade Mode</b>." };
}
const SCREENS = {};
SCREENS.home = () => {
  const ak = S.ops[S.assistant] ? S.assistant : Object.keys(S.ops)[0], op = OPS[ak];
  const hint = nextHint(), nd = nextNode();
  const missionsReady = dailyReady(), mails = unclaimedMail().length, newAch = achDone() > (S.achSeen || 0);
  return `<div class="lobby">
    <section class="stage">
      <div class="floor"></div><div class="ring3d"></div>
      <img class="assist" src="${spriteURL(op)}" alt="${esc(op.n)}" data-act="poke" draggable="false">
      <div class="nameplate"><span class="eyebrow">Partner</span><b>${esc(op.n)}</b><div class="row" style="gap:4px">${elChip(op.el)}${styleChip(op.style)}<span class="cls">${clsName(op.cls)}</span></div></div>
      <div class="sidebtns left">
        <button class="sidebtn" data-act="inbox" aria-label="Inbox">${IC.mail}<small>Inbox</small>${mails ? `<i class="cnt num">${mails}</i>` : ""}</button>
        <button class="sidebtn" data-act="go" data-v="ach" aria-label="Achievements">${IC.trophy}<small>Records</small>${newAch ? '<i class="dot"></i>' : ""}</button>
      </div>
      <div class="sidebtns">
        <button class="sidebtn" data-act="missions" aria-label="Missions">${IC.missions}<small>Missions</small>${missionsReady ? '<i class="dot"></i>' : ""}</button>
        <button class="sidebtn" data-act="go" data-v="shop" aria-label="Ahnenerbe café">${IC.shop}<small>Ahnenerbe</small></button>
        <button class="sidebtn" data-act="go" data-v="depot" aria-label="Items">${IC.depot}<small>Items</small></button>
      </div>
    </section>
    ${hint ? `<button class="hint" data-act="${hint.act}" ${hint.data || ""}>${IC.boost.replace("<svg", '<svg width="22" height="22"')}<div><div class="eyebrow">Next objective</div><div class="small">${hint.text}</div></div></button>` : ""}
    <div class="tiles">
      <button class="tile ls-t" data-act="go" data-v="story"><span class="ticon" style="color:var(--holo)">${IC.story}</span><h3>Story</h3><span class="tsub">${nd ? "Next: " + nd.id + " " + esc(nd.name) : "Every night cleared"}</span></button>
      <button class="tile ds-t" data-act="go" data-v="battle"><span class="ticon" style="color:var(--ds)">${IC.battles}</span><h3>Battle</h3><span class="tsub">Patrol · Arcade · Versus</span></button>
      <button class="tile" data-act="go" data-v="hh"><span class="ticon">${IC.permit}</span><h3>Tatari</h3><span class="tsub">${S.permit} tickets · ${fmt(S.orundum)} crystals</span></button>
      <button class="tile" data-act="go" data-v="ops"><span class="ticon" style="color:var(--gold)">${IC.ops}</span><h3>Characters</h3><span class="tsub">${Object.keys(S.ops).length}/${OP_KEYS.length} gathered</span></button>
    </div>
    <p class="tiny dim" style="text-align:center;padding:4px 8px">Melty Blood RPG is an unofficial, non-commercial fan game. Melty Blood and Tsukihime belong to TYPE-MOON and French-Bread.</p>
  </div>`;
};

// ---------- story ----------
SCREENS.story = () => {
  const ep = STORY[0];
  return `<div class="stack">
    <section class="panel ep-card" style="background:radial-gradient(90% 120% at 100% 0%,#5a1e14,transparent 60%),var(--hull)">
      <div class="eyebrow">${esc(ep.sub)}</div><h1 style="margin-top:4px;font-size:30px">${esc(ep.title)}</h1>
      <p class="small dim" style="margin-top:6px;max-width:42ch">${esc(ep.blurb)}</p>
    </section>
    ${ep.chapters.map((ch, i) => {
      const open = nodeOpen(ch.nodes[0]), done = chapterCleared(ch);
      const battles = ch.nodes.filter(n => n.waves), stars = battles.reduce((a, n) => a + nodeStars(n.id), 0);
      return `<button class="tile wide" data-act="chapter" data-c="${ch.id}" ${open ? "" : "disabled"} style="min-height:88px;background:linear-gradient(120deg,${mapTheme(ch.map).a},var(--hull2) 70%)">
        <span class="ticon" style="width:auto;height:auto;font:800 40px var(--f-display);opacity:.25;top:2px">${i + 1}</span>
        <div class="eyebrow">Night ${ch.no}${done ? " · Cleared" : ""}</div><h3>${esc(ch.title)}</h3>
        <span class="tsub">${open ? `${stars}/${battles.length * 3} stars` : "Clear the previous night to unlock"}</span></button>`;
    }).join("")}
  </div>`;
};
function mapTheme(m) {
  return { misaki: { a: "#1e1636", b: "#07050e", c: "#a9c8ff" }, school: { a: "#3a1a2e", b: "#0e0812", c: "#f1d07a" }, mansion: { a: "#2e0e20", b: "#0a0408", c: "#ff4d6d" },
    park: { a: "#0e2a26", b: "#050c0a", c: "#8fd8ff" }, wallachia: { a: "#4e0812", b: "#120204", c: "#ff3b4c" }, alley: { a: "#261a2a", b: "#0a080c", c: "#ffb070" }, atlas: { a: "#1a1a3a", b: "#06060e", c: "#c39bff" },
    ruins: { a: "#4a1810", b: "#1a0c0a", c: "#ff7a3a" }, city: { a: "#16245a", b: "#080c1c", c: "#5fd4ff" }, slums: { a: "#4a3424", b: "#16100c", c: "#f2c14e" }, snow: { a: "#3a5a80", b: "#0c1624", c: "#cfe8ff" } }[m] || { a: "#16245a", b: "#080c1c", c: "#5fd4ff" };
}
SCREENS.chapter = cid => {
  const ch = STORY[0].chapters.find(c => c.id === cid), th = mapTheme(ch.map), ci = STORY[0].chapters.indexOf(ch);
  const XS = [50, 24, 70, 32, 74, 28, 60];
  let mainI = 0;
  const pos = ch.nodes.map(nd => {
    if (nd.type === "side") return null;
    const p = { x: XS[mainI % XS.length], y: 80 + mainI * 112 }; mainI++; return p;
  });
  // side stories branch off toward the outer edge, clear of the main path's curve
  ch.nodes.forEach((nd, i) => { if (!pos[i]) { const pr = pos[i - 1] || { x: 50, y: 80 }; pos[i] = { x: pr.x < 50 ? Math.max(11, pr.x - 18) : Math.min(89, pr.x + 18), y: pr.y + 50, side: true }; } });
  const H = 80 + mainI * 112 + 40, rng = seeded(hash(cid + "map"));
  const main = ch.nodes.map((n, i) => [n, pos[i]]).filter(([n]) => n.type !== "side");
  let d = "";
  main.forEach(([, p], i) => { const x = p.x * 4, y = p.y; if (!i) d = `M${x} ${y}`; else { const q = main[i - 1][1]; d += ` C${q.x * 4} ${(q.y + y) / 2} ${x} ${(q.y + y) / 2} ${x} ${y}`; } });
  let deco = "";
  for (let k = 0; k < 26; k++) {
    const x = rng() * 400, y = rng() * H, r = 6 + rng() * 26;
    deco += ["city", "slums", "misaki", "school", "alley"].includes(ch.map) ? `<rect x="${x}" y="${y}" width="${r}" height="${r * (1 + rng())}" fill="${th.c}" opacity="${.04 + rng() * .06}"/>`
      : ch.map === "snow" || ch.map === "park" ? `<circle cx="${x}" cy="${y}" r="${r}" fill="${ch.map === "park" ? th.c : "#ffffff"}" opacity="${.03 + rng() * .05}"/>`
      : `<path d="M${x} ${y} l${r} ${-r * 1.4} l${r} ${r * 1.4}z" fill="${th.c}" opacity="${.04 + rng() * .06}"/>`;
  }
  const sideLines = ch.nodes.map((n, i) => n.type === "side" ? `<path d="M${pos[i - 1].x * 4} ${pos[i - 1].y} L${pos[i].x * 4} ${pos[i].y}" stroke="${th.c}" stroke-width="2" stroke-dasharray="4 6" opacity=".5" fill="none"/>` : "").join("");
  const icon = t => t === "boss" ? IC.skull : t === "story" ? IC.book : t === "chest" ? IC.chest : IC.sword;
  const nx = nextNode();
  return `<div class="stack">
    <div class="spread">${back("go", "Story", 'data-v="story"')}<span class="eyebrow">Night ${ch.no}</span></div>
    <h2>${esc(ch.title)}</h2>
    <div class="mapwrap" style="background:linear-gradient(180deg,${th.a},${th.b})">
      <svg class="map" viewBox="0 0 400 ${H}" preserveAspectRatio="none" style="height:${H}px">${deco}
        <path d="${d}" stroke="#000" stroke-width="10" fill="none" opacity=".35"/><path d="${d}" stroke="${th.c}" stroke-width="3" stroke-dasharray="8 7" fill="none" opacity=".85"/>${sideLines}</svg>
      ${ch.nodes.map((nd, i) => {
        const open = nodeOpen(nd), st = nodeStars(nd.id), done = st > 0;
        return `<button class="mnode ${nd.type} ${open ? "" : "locked"} ${done ? "done" : ""} ${nx === nd ? "next" : ""}" style="left:${pos[i].x}%;top:${pos[i].y}px" data-act="openNode" data-id="${nd.id}" aria-label="${nd.id} ${esc(nd.name)}">
          <span class="disc">${open ? icon(nd.type) : IC.lock}</span><span class="lbl">${nd.id}${nd.type === "side" ? " · Side" : ""}</span>
          ${nd.waves ? `<span class="nst">${[1, 2, 3].map(k => k <= st ? IC.star : IC.starOff).join("")}</span>` : ""}</button>`;
      }).join("")}
    </div>
    <p class="tiny dim">Night reward: ${ch.reward.op ? esc(opLabel(OPS[ch.reward.op])) + " joins your party, plus " : ""}${ch.reward.orundum} Jewels${ch.reward.permit ? ` and ${ch.reward.permit} Rumor Tickets` : ""}.</p>
  </div>`;
};
function nodeSheet(nd) {
  const st = nodeStars(nd.id), cost = nodeCost(nd), lv = nd.lv;
  const waves = nd.waves ? nd.waves.map(w => w.map(s => ({ ...s, LV: lv + (s.e && ENEMY[s.e].boss ? 3 : 0), en: s.e }))) : null;
  const goal = nodeTurnGoal(nd);
  openModal(`<div class="stack">
    <div class="spread"><div><div class="eyebrow">${nd.id} · ${{ story: "Story", battle: "Battle", side: "Side Story", chest: "Cache", boss: "Boss" }[nd.type]}</div><h2 style="margin-top:4px">${esc(nd.name)}</h2></div>
      ${nd.waves ? `<div class="nstars">${[1, 2, 3].map(k => k <= st ? IC.star : IC.starOff).join("")}</div>` : ""}</div>
    ${waves ? waves.map((w, k) => `<div><div class="tiny dim" style="margin-bottom:4px">Wave ${k + 1} of ${waves.length}</div><div class="row wrap">${w.map(s => enHTML(s, s.en && ENEMY[s.en].boss ? 56 : 46)).join("")}</div></div>`).join("") : ""}
    ${nd.waves ? `<div class="stack" style="gap:4px"><div class="tiny dim">Star conditions</div>
      ${["Win the battle", "No ally falls", `Win within ${goal} of your turns`].map((m, k) => `<div class="mission">${k < st ? IC.star : IC.starOff}<span>${m}</span></div>`).join("")}</div>
      <div><div class="tiny dim" style="margin-bottom:4px">${st ? "Regular drops" : "First clear"}${st < 3 ? " · first 3-star clear adds 1 Holy Relic" : ""}</div><div class="rewards" style="justify-content:flex-start">${rewardsHTML(st ? [{ k: "lmd", n: 80 + lv * 15 }, { k: lv < 20 ? "rec1" : lv < 40 ? "rec2" : "rec3", n: 2 }, { k: "summ", n: 1 }] : [{ k: "orundum", n: nd.type === "boss" ? 150 : nd.type === "side" ? 100 : 60 }, { k: "lmd", n: 80 + lv * 15 }, { k: lv < 20 ? "rec1" : lv < 40 ? "rec2" : "rec3", n: 3 }])}</div></div>` : ""}
    ${nd.type === "chest" ? `<div class="rewards" style="justify-content:flex-start">${rewardsHTML(Object.entries(nd.reward).map(([k, n]) => ({ k, n })))}</div>` : ""}
    <div class="row">
      ${nd.waves && st >= 3 ? `<button class="btn ghost" data-act="sweep" data-id="${nd.id}" data-x="1">Quick Clear</button><button class="btn ghost" data-act="sweep" data-id="${nd.id}" data-x="3">×3</button>` : ""}
      <button class="btn" style="flex:1" data-act="startNode" data-id="${nd.id}" ${nd.type === "chest" && st ? "disabled" : ""}>${nd.type === "story" ? (st ? "Replay story" : "Read story") : nd.type === "chest" ? (st ? "Collected" : "Collect") : `Fight <span class="cost">${IC.sanity}${cost}</span>`}</button>
    </div>
    ${nd.waves && st < 3 ? '<p class="tiny dim">Clear with 3 stars to unlock Quick Clear.</p>' : ""}
  </div>`);
}

// ---------- team select ----------
SCREENS.team = arg => {
  const key = arg.mode;
  if (!UI.team || UI.team.key !== key) UI.team = { key, ids: (S.team[key] || []).filter(owned).slice(0, 4) };
  const ids = UI.team.ids;
  const pool = Object.keys(S.ops).filter(k => UI.el === "all" || OPS[k].el === UI.el).sort((a, b) => power(b, S.ops[b]) - power(a, S.ops[a]));
  const lead = ids[0] && OPS[ids[0]].leader;
  const myPw = ids.reduce((a, k) => a + power(k, S.ops[k]), 0);
  const foeEls = [...new Set((arg.foes || []).map(s => s.op ? OPS[s.op].el : ENEMY[s.en].el))];
  const counter = foeEls.map(e => Object.keys(BEATS).find(k => BEATS[k] === e)).filter(Boolean);
  return `<div class="stack">
    <div class="spread">${back("teamBack", "Back")}<div class="eyebrow">${esc(arg.title || "")}</div></div>
    <h2>Squad</h2>
    ${foeEls.length ? `<div class="small">Enemy Elements: ${foeEls.map(elChip).join(" ")} ${counter.length ? `<span class="dim">· Strong picks:</span> ${[...new Set(counter)].map(elChip).join(" ")}` : ""}</div>` : ""}
    <div class="squad">${[0, 1, 2, 3].map(k => {
      const id = ids[k];
      return `<div class="slot">${k === 0 ? `<span class="crown">${IC.crown}</span>` : ""}${id ? `<button data-act="slot" data-k="${k}" aria-label="${esc(OPS[id].n)}">${opHTML(id, { s: 66 })}</button>` : '<div class="empty"></div>'}</div>`;
    }).join("")}</div>
    <div class="leadtxt small">${lead ? `<b class="gold">Charisma · ${esc(opLabel(OPS[ids[0]]))}</b> <span class="dim">${leaderText(lead)}</span>` : ids[0] ? `<span class="dim">${esc(OPS[ids[0]].n)} has no Charisma. The first slot leads the squad.</span>` : `<span class="dim">Pick up to four characters. The first slot leads with their Charisma.</span>`}</div>
    <div class="spread small"><span>Squad power <b class="num">${fmtFull(myPw)}</b></span>${arg.cost ? `<span class="cost">${IC.sanity}${arg.cost}</span>` : ""}</div>
    <button class="btn wide" data-act="deploy" ${ids.length ? "" : "disabled"}>Fight!</button>
    <div class="filters">${["all", ...ELS].map(e => `<button class="chip ${UI.el === e ? "on" : ""}" data-act="elf" data-e="${e}">${e === "all" ? "All Elements" : e}</button>`).join("")}</div>
    <div class="roster">${pool.map(k => `<button class="rcell ${ids.includes(k) ? "sel" : ""}" data-act="pickTeam" data-k="${k}">${opHTML(k)}${pnameHTML(k)}<div class="pw">${fmt(power(k, S.ops[k]))}</div></button>`).join("")}</div>
  </div>`;
};
function leaderText(l) {
  if (!l) return "—";
  const sym = { ATK: "ATK", HP: "HP", DEF: "DEF", SPD: "SPD", CR: "Crit Rate", CD: "Crit Damage", ACC: "Accuracy", RES: "Resistance" }[l.stat] || l.stat;
  return `${sym} +${Math.round(l.amount * 100)}% for ${l.scope === "All" ? "all allies" : l.element + " allies"}`;
}

// ---------- dialogue ----------
// Layered silhouette backdrop per environment (skyline, ruins, peaks), seeded so a scene always looks the same.
function sceneSVG(env) {
  // Layered night backdrops for dialogue: skylines, spires, trees or the red moon, seeded per location
  const th = mapTheme(env), rng = seeded(hash(env + "scene"));
  const sky = { misaki: ["#05040c", "#1a1236", "#4a2a5a"], school: ["#140818", "#4a1a3a", "#d8704a"], mansion: ["#08030a", "#2a0c22", "#5a1a34"],
    park: ["#03070a", "#0e2030", "#26445a"], wallachia: ["#120204", "#5a0612", "#c8182e"], alley: ["#06040a", "#1c1424", "#3a2434"], atlas: ["#04040c", "#16183a", "#4a3a6a"] }[env] || ["#05040c", "#1a1236", "#4a2a5a"];
  const style = { mansion: "spire", wallachia: "jag", park: "tree", atlas: "peak" }[env] || "rect";
  const moon = { misaki: [300, 160, 30, "#f4ecd8"], school: [110, 470, 40, "#ffb070"], mansion: [290, 150, 24, "#f1dca2"], park: [110, 140, 26, "#eef2ff"],
    wallachia: [200, 250, 78, "#ff2a3a"], alley: [320, 200, 18, "#f4ecd8"], atlas: [90, 150, 22, "#eef2ff"] }[env] || [300, 160, 30, "#f4ecd8"];
  const layer = (base, h0, h1, col, lit) => {
    let x = -10, out = "";
    while (x < 410) {
      const w = 16 + rng() * 42, h = h0 + rng() * (h1 - h0);
      if (style === "peak") { const pk = x + w * (.3 + rng() * .4); out += `<polygon points="${x - 30},${base} ${pk},${base - h * 1.2} ${x + w + 30},${base}" fill="${col}"/>`; }
      else if (style === "tree") { out += `<rect x="${x + w * .45}" y="${base - h * .5}" width="${w * .12}" height="${h}" fill="${col}"/><circle cx="${x + w / 2}" cy="${base - h * .55}" r="${w * .55}" fill="${col}"/><circle cx="${x + w * .25}" cy="${base - h * .35}" r="${w * .4}" fill="${col}"/>`; }
      else if (style === "spire") out += `<rect x="${x}" y="${base - h}" width="${w}" height="${h + 300}" fill="${col}"/><polygon points="${x - 2},${base - h} ${x + w / 2},${base - h - w * 1.1} ${x + w + 2},${base - h}" fill="${col}"/>`;
      else if (style === "jag") out += `<polygon points="${x},${base + 300} ${x},${base - h} ${x + w * .3},${base - h + 8 + rng() * 22} ${x + w * .55},${base - h - 6} ${x + w * .8},${base - h + 14 + rng() * 26} ${x + w},${base - h + rng() * 30} ${x + w},${base + 300}" fill="${col}"/>`;
      else out += `<rect x="${x}" y="${base - h}" width="${w}" height="${h + 300}" fill="${col}"/>`;
      if (lit && style !== "tree") for (let k = 0; k < 6; k++) if (rng() < .5) out += `<rect x="${x + 3 + rng() * (w - 8)}" y="${base - h + 6 + rng() * (h - 12)}" width="2.5" height="3.5" fill="${lit}" opacity="${.35 + rng() * .5}"/>`;
      x += w + (style === "tree" ? -4 : rng() * 6);
    }
    return out;
  };
  let fx = "";
  for (let k = 0; k < 44; k++) fx += env === "wallachia" ? `<circle cx="${rng() * 400}" cy="${260 + rng() * 460}" r="${.8 + rng() * 1.8}" fill="#ff5a5a" opacity="${.25 + rng() * .5}"/>`
    : env === "park" ? `<circle cx="${rng() * 400}" cy="${360 + rng() * 300}" r="${.8 + rng() * 1.6}" fill="#bff0ff" opacity="${.25 + rng() * .5}"/>`
    : env === "school" ? "" : (k < 34 ? `<circle cx="${rng() * 400}" cy="${rng() * 420}" r="${rng() * 1.2 + .3}" fill="#fff" opacity="${.2 + rng() * .6}"/>` : "");
  const lit = env === "misaki" || env === "alley" || env === "school" ? "#ffd78a" : env === "mansion" ? "#ffb070" : null;
  return `<svg viewBox="0 0 400 800" preserveAspectRatio="xMidYMax slice" style="position:absolute;inset:0;width:100%;height:100%">
    <defs><linearGradient id="sk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${sky[0]}"/><stop offset=".55" stop-color="${sky[1]}"/><stop offset=".8" stop-color="${sky[2]}"/></linearGradient>
    <radialGradient id="gl" cx=".5" cy=".7" r=".5"><stop offset="0" stop-color="${th.c}" stop-opacity=".3"/><stop offset="1" stop-color="${th.c}" stop-opacity="0"/></radialGradient>
    <radialGradient id="mg"><stop offset=".55" stop-color="${moon[3]}" stop-opacity=".9"/><stop offset="1" stop-color="${moon[3]}" stop-opacity="0"/></radialGradient></defs>
    <rect width="400" height="800" fill="url(#sk)"/>
    <circle cx="${moon[0]}" cy="${moon[1]}" r="${moon[2] * 1.9}" fill="url(#mg)" opacity=".5"/><circle cx="${moon[0]}" cy="${moon[1]}" r="${moon[2]}" fill="${moon[3]}" opacity=".92"/>
    <rect width="400" height="800" fill="url(#gl)"/>
    <g opacity=".55">${layer(560, 120, 320, th.b, lit)}</g>
    <g>${layer(610, 60, 200, "#05040a", lit)}</g>
    <rect y="600" width="400" height="200" fill="#05040a"/>${fx}
    <rect width="400" height="800" fill="url(#gl)" opacity=".4"/></svg>`;
}
function playScene(lines, title, env) {
  return new Promise(resolve => {
    const root = $("#dlg"), th = mapTheme(env);
    root.innerHTML = `<div class="dwrap">
      <div class="dbg" style="background:${th.b}">${sceneSVG(env)}</div>
      <img class="dchar left" id="dL" alt="" hidden><img class="dchar right" id="dR" alt="" hidden>
      <div class="dtop"><span class="ttl">${esc(title || "")}</span><div class="row"><button class="tog" id="dAuto">AUTO</button><button class="tog" id="dSkip">SKIP</button></div></div>
      <div class="dbox" id="dBox"><div class="dname" id="dName" hidden></div><div class="dtext" id="dText"></div><div class="dnext" id="dNext" hidden></div></div>
    </div>`;
    root.hidden = false; music("talk");
    let i = -1, typing = 0, full = "", auto = false, timer = 0, autoT = 0;
    const L = $("#dL"), Rr = $("#dR"), side = {};
    const done = () => { clearInterval(timer); clearTimeout(autoT); root.hidden = true; root.innerHTML = ""; if (!BT.on) music(screenMusic(UI.view)); resolve(); };
    const showLine = () => {
      i++; if (i >= lines.length) return done();
      const ln = lines[i], sp = SPK[ln.s] || { n: ln.s };
      const nm = $("#dName"); nm.hidden = !sp.n; nm.textContent = sp.n || "";
      $("#dBox").classList.toggle("dnarr", ln.s === "narr");
      const art = sp.op ? spriteURL(OPS[sp.op]) : sp.en ? enemyArt(sp.en).full : null;
      if (art) {
        const isRight = !!sp.en, img = isRight ? Rr : L;
        if (side[isRight ? "R" : "L"] !== ln.s) { img.classList.add("enter"); img.src = art; img.hidden = false; side[isRight ? "R" : "L"] = ln.s; requestAnimationFrame(() => requestAnimationFrame(() => img.classList.remove("enter"))); }
        if (isRight) img.style.transform = "scaleX(-1)";
        L.classList.toggle("dim", isRight); Rr.classList.toggle("dim", !isRight);
      } else { L.classList.add("dim"); Rr.classList.add("dim"); }
      full = ln.t; let n = 0; const tx = $("#dText"); tx.textContent = ""; $("#dNext").hidden = true;
      clearInterval(timer);
      typing = 1;
      timer = setInterval(() => { n += 2; tx.textContent = full.slice(0, n); if (n >= full.length) { clearInterval(timer); typing = 0; $("#dNext").hidden = false; if (auto) autoT = setTimeout(showLine, 1100 + full.length * 18); } }, 22);
    };
    root.onclick = ev => {
      if (ev.target.closest("#dSkip")) return done();
      if (ev.target.closest("#dAuto")) { auto = !auto; $("#dAuto").classList.toggle("on", auto); if (auto && !typing) showLine(); return; }
      clearTimeout(autoT);
      if (typing) { clearInterval(timer); typing = 0; $("#dText").textContent = full; $("#dNext").hidden = false; if (auto) autoT = setTimeout(showLine, 1200); }
      else showLine();
    };
    showLine();
  });
}

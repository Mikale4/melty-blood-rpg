
// =====================================================================
//  META — Inbox (mail with gifts), Achievements, Settings and the title screen
// =====================================================================
const GAME_VER = "1.4.0";
const MAIL_DAYS = 30;            // gifts expire after this many days; claimed mail is cleared after the same time
const GIFT_MS = 3 * 3600000;     // a letter from the cast every few hours of real time
const DAY_MS = 864e5;

// ---------- inbox ----------
function mailTo(s, m) {
  s.inbox = s.inbox || [];
  const mail = { id: ++s.mailSeq, t: Date.now(), from: m.from || "Tatari Records", title: m.title, body: m.body || "", rewards: m.rewards || {},
    claimed: false, read: false, exp: m.noExp ? 0 : Date.now() + MAIL_DAYS * DAY_MS, tag: m.tag || "" };
  s.inbox.unshift(mail);
  return mail;
}
function sendMail(m, quiet) { const mail = mailTo(S, m); if (!quiet) toast(`New mail: ${m.title}`, "gold"); return mail; }
const hasRewards = m => Object.keys(m.rewards).length > 0;
const unclaimedMail = () => (S.inbox || []).filter(m => !m.claimed && hasRewards(m));
const unreadMail = () => (S.inbox || []).filter(m => !m.read || (!m.claimed && hasRewards(m)));
function purgeMail() {
  const now = Date.now();
  S.inbox = (S.inbox || []).filter(m => !(m.exp && now > m.exp) && !(m.claimed && now - m.t > MAIL_DAYS * DAY_MS)).slice(0, 120);
}
function claimMail(m) {
  if (!m || m.claimed || !hasRewards(m)) { if (m) m.read = true; return []; }
  m.claimed = true; m.read = true;
  return give(m.rewards);
}
// every new account (and older saves, once) starts with a free ×10 and a guaranteed random 5★
function welcomeMail(s) {
  mailTo(s, { from: "Sion Eltnam Atlasia", tag: "welcome", noExp: 1, title: "Welcome to Misaki Town",
    body: "I calculated that you would need help tonight. Inside are a free ×10 Manifest and a Crimson Moon Rumor, a rumor so strong it always takes the shape of a 5★ character. Use both at the Tatari. Good hunting, Night Walker.",
    rewards: { free10: 1, gold5: 1 } });
  s.welcome = 1;
}
// daily login gift, a 7-day cycle
const LOGIN_GIFTS = [{ orundum: 100 }, { lmd: 8000 }, { rec2: 4 }, { orundum: 150 }, { summ: 3 }, { chip: 2 }, { permit: 2 }];
function dailyLogin() {
  if (S.lastLogin === today()) return;
  S.lastLogin = today(); S.stats.loginDays++;
  const n = S.stats.loginDays, day = (n - 1) % 7;
  sendMail({ from: "Ahnenerbe", tag: "login", title: `Night after Night · Day ${n}`,
    body: `Welcome back. Your login gift for day ${day + 1} of 7${day === 6 ? ", the big one" : ""}. Come again tomorrow.`, rewards: LOGIN_GIFTS[day] });
}
// letters from the cast
const GIFTS = [
  { from: "Kohaku", title: "From the storeroom", body: "Ahaha, I found these behind the medicine cabinet! Please don't tell Lady Akiha.", rewards: { rec2: 3, lmd: 3000 } },
  { from: "Neco-Arc", title: "Tribute for the great Neco", body: "Nyahaha! Consider this a loan. The interest is paid in canned tuna.", rewards: { orundum: 50, credit: 60 } },
  { from: "Sion Eltnam Atlasia", title: "Calculated surplus", body: "All seven of my divided thoughts agree: you will need these tonight.", rewards: { summ: 2, lmd: 2000 } },
  { from: "Ciel", title: "Burial Agency supplies", body: "Spare equipment from the vault, and a coupon for curry. Mostly the curry.", rewards: { prime: 1, credit: 40 } },
  { from: "Akiha Tohno", title: "An allowance", body: "Nii-san keeps losing his. Do not make the same mistake.", rewards: { lmd: 6000 } },
  { from: "Arcueid Brunestud", title: "I got you something!", body: "Shiki said gifts are a human thing. Did I do it right? I'm not sure what any of these do.", rewards: { orundum: 80, rec1: 5 } },
  { from: "Hisui", title: "Prepared for you", body: "...I have prepared these. Please use them carefully.", rewards: { rec3: 2 } },
  { from: "Satsuki Yumizuka", title: "Don't forget me!", body: "I saved these for you. Don't forget who your friends are, okay?", rewards: { chip: 1, lmd: 2000 } },
  { from: "Len", title: "...", body: "(A small parcel is waiting on your pillow. It smells faintly of cake.)", rewards: { orundum: 60 } },
  { from: "Ahnenerbe", title: "Café loyalty card", body: "Thank you for your patronage. Please enjoy a little something on the house.", rewards: { credit: 100 } },
  { from: "Riesbyfe Stridberg", title: "For the hunt", body: "Gamaliel is heavy, but this isn't. Take it.", rewards: { permit: 1 } },
  { from: "Aoko Aozaki", title: "Leftover magic", body: "I blew up less of the town than planned tonight, so here's the change.", rewards: { orundum: 100 } },
];
function castGift() {
  if (Date.now() - S.lastGift < GIFT_MS || S.inbox.some(m => m.tag === "gift" && !m.claimed)) return;
  S.lastGift = Date.now();
  sendMail({ ...pick(GIFTS), tag: "gift" });
}
// a gift every five player levels
function rankGifts() {
  while (S.lvlGift + 5 <= S.lvl) {
    S.lvlGift += 5;
    const L = S.lvlGift;
    sendMail({ from: "Tatari Records", tag: "rank", title: `Night Walker Level ${L}`, body: `You reached level ${L}. The night recognizes you.`,
      rewards: L % 10 === 0 ? { orundum: 100 + L * 4, permit: 1 } : { orundum: 100 + L * 4 } });
  }
}

// ---------- achievements ----------
// Each achievement has tiers [goal, reward]; finishing a tier sends its reward to the Inbox.
const tier = (goal, reward) => [goal, reward];
const ownedKeys = () => Object.keys(S.ops);
const ACH_CATS = ["Story", "Collection", "Growth", "Battle", "Tatari", "Login"];
const ACH = [
  ...STORY[0].chapters.map((c, i) => ({ id: "night" + (i + 1), cat: "Story", n: `Night ${c.no}: ${c.title}`, d: () => `Clear Night ${c.no}`,
    v: () => chapterCleared(c) ? 1 : 0, tiers: [tier(1, i === 4 ? { orundum: 600, permit: 3 } : { orundum: 300 })] })),
  { id: "stages", cat: "Story", n: "Night Walker", d: g => `Clear ${g} story stages`, v: () => Object.keys(S.story).filter(k => NODES[k] && S.story[k] > 0).length,
    tiers: [tier(5, { orundum: 100 }), tier(15, { orundum: 200 }), tier(35, { orundum: 400, permit: 1 })] },
  { id: "stars", cat: "Story", n: "Three-Star Night", d: g => `Earn 3 stars on ${g} battles`, v: () => Object.keys(S.story).filter(k => NODES[k] && NODES[k].waves && S.story[k] >= 3).length,
    tiers: [tier(5, { orundum: 100 }), tier(15, { orundum: 250 }), tier(26, { orundum: 500, permit: 2 })] },
  { id: "owned", cat: "Collection", n: "Rumors Made Flesh", d: g => `Gather ${g} characters`, v: () => ownedKeys().length,
    tiers: [tier(10, { orundum: 150 }), tier(25, { orundum: 300 }), tier(50, { orundum: 500, permit: 1 }), tier(100, { orundum: 800, permit: 2 }), tier(200, { orundum: 1200, permit: 3 }), tier(OP_KEYS.length, { orundum: 3000, permit: 10 })] },
  { id: "moons", cat: "Collection", n: "Phases of the Moon", d: g => `Own all three Moon styles of ${g} character${g > 1 ? "s" : ""}`,
    v: () => CHARS.filter(c => variantsOf(c.k).length === 3 && variantsOf(c.k).every(f => elementsOf(f).some(owned))).length,
    tiers: [tier(1, { orundum: 300, permit: 1 }), tier(5, { orundum: 600, permit: 2 }), tier(15, { orundum: 1000, permit: 3 })] },
  { id: "elems", cat: "Collection", n: "Average One", d: g => `Own one Moon style in all five Elements (${g} time${g > 1 ? "s" : ""})`, v: () => FAMS.filter(f => elementsOf(f).every(owned)).length,
    tiers: [tier(1, { orundum: 800, permit: 2 }), tier(5, { orundum: 1500, permit: 5 })] },
  { id: "fives", cat: "Collection", n: "Court of the Crimson Moon", d: g => `Own ${g} 5★ characters`, v: () => ownedKeys().filter(k => OPS[k].rar === 5).length,
    tiers: [tier(1, { orundum: 200 }), tier(5, { orundum: 400, permit: 1 }), tier(15, { orundum: 800, permit: 2 }), tier(40, { orundum: 1500, permit: 4 })] },
  { id: "rare", cat: "Collection", n: "Imaginary Elements", d: g => `Own ${g} Ether or Imaginary Numbers characters`, v: () => ownedKeys().filter(k => RARE_ELS.includes(OPS[k].el)).length,
    tiers: [tier(1, { orundum: 300 }), tier(5, { orundum: 600, permit: 1 }), tier(20, { orundum: 1200, permit: 3 })] },
  { id: "asc1", cat: "Growth", n: "Ascension", d: g => `Ascend ${g} character${g > 1 ? "s" : ""} at least once`, v: () => Object.values(S.ops).filter(p => p.elite >= 1).length,
    tiers: [tier(1, { orundum: 150 }), tier(5, { orundum: 300, chip: 2 }), tier(20, { orundum: 600, permit: 1 })] },
  { id: "asc2", cat: "Growth", n: "Final Ascension", d: g => `Fully Ascend ${g} character${g > 1 ? "s" : ""}`, v: () => Object.values(S.ops).filter(p => p.elite >= 2).length,
    tiers: [tier(1, { orundum: 400, permit: 1 }), tier(5, { orundum: 800, permit: 2 }), tier(15, { orundum: 1500, permit: 3 })] },
  { id: "rankex", cat: "Growth", n: "Skill Rank EX", d: g => `Raise ${g} skill${g > 1 ? "s" : ""} to Rank EX`, v: () => Object.values(S.ops).reduce((a, p) => a + p.sk.filter(r => r >= 7).length, 0),
    tiers: [tier(1, { orundum: 200, summ: 3 }), tier(5, { orundum: 400, summ: 6 }), tier(20, { orundum: 800, permit: 2 })] },
  { id: "origin", cat: "Growth", n: "Spirit Origin", d: g => `Max the Spirit Origin of ${g} character${g > 1 ? "s" : ""}`, v: () => Object.values(S.ops).filter(p => p.pot >= 6).length,
    tiers: [tier(1, { orundum: 500, permit: 1 }), tier(3, { orundum: 1000, permit: 3 })] },
  { id: "codes", cat: "Growth", n: "Mystic Code Artisan", d: g => `Upgrade Mystic Codes ${g} times`, v: () => S.stats.codeUps,
    tiers: [tier(10, { lmd: 10000 }), tier(50, { lmd: 30000, orundum: 200 }), tier(200, { lmd: 80000, orundum: 400 }), tier(500, { orundum: 800, permit: 2 })] },
  { id: "code15", cat: "Growth", n: "Masterwork", d: g => `Raise ${g} Mystic Code${g > 1 ? "s" : ""} to +15`, v: () => S.runes.filter(r => r.lvl >= 15).length,
    tiers: [tier(1, { orundum: 200 }), tier(5, { orundum: 500, permit: 1 }), tier(20, { orundum: 1000, permit: 2 })] },
  { id: "plv", cat: "Growth", n: "Seasoned Night Walker", d: g => `Reach player level ${g}`, v: () => S.lvl,
    tiers: [tier(10, { orundum: 200 }), tier(20, { orundum: 400, permit: 1 }), tier(40, { orundum: 800, permit: 2 }), tier(60, { orundum: 1200, permit: 3 }), tier(100, { orundum: 2000, permit: 5 })] },
  { id: "wins", cat: "Battle", n: "K.O.", d: g => `Win ${g} battles`, v: () => S.stats.wins,
    tiers: [tier(10, { orundum: 100 }), tier(50, { orundum: 300 }), tier(200, { orundum: 600, permit: 1 }), tier(1000, { orundum: 1500, permit: 3 })] },
  { id: "arcs", cat: "Battle", n: "Arc Drive", d: g => `Unleash ${g} Arc Drives`, v: () => S.stats.arcs,
    tiers: [tier(10, { orundum: 100 }), tier(100, { orundum: 300 }), tier(500, { orundum: 600, permit: 1 }), tier(2000, { orundum: 1200, permit: 2 })] },
  { id: "kills", cat: "Battle", n: "Lines of Death", d: g => `Defeat ${g} enemies`, v: () => S.stats.kills,
    tiers: [tier(100, { orundum: 100 }), tier(1000, { orundum: 300 }), tier(5000, { orundum: 800, permit: 1 }), tier(20000, { orundum: 1500, permit: 3 })] },
  { id: "flawless", cat: "Battle", n: "Untouched by Night", d: g => `Win ${g} battles without losing a character`, v: () => S.stats.flawless,
    tiers: [tier(10, { orundum: 150 }), tier(50, { orundum: 400 }), tier(200, { orundum: 800, permit: 2 })] },
  { id: "arcade", cat: "Battle", n: "Arcade Mode", d: g => `Clear Arcade stage ${g}`, v: () => S.tower,
    tiers: [tier(5, { orundum: 150 }), tier(10, { orundum: 300, permit: 1 }), tier(20, { orundum: 500, permit: 2 }), tier(30, { orundum: 1000, permit: 3 })] },
  { id: "versus", cat: "Battle", n: "Versus", d: g => `Win ${g} Versus battles`, v: () => S.stats.versus,
    tiers: [tier(5, { tokens: 100 }), tier(25, { tokens: 300, orundum: 200 }), tier(100, { tokens: 600, permit: 2 })] },
  { id: "patrol", cat: "Battle", n: "Night Patrol", d: g => `Clear ${g} Night Patrols`, v: () => S.stats.patrols,
    tiers: [tier(10, { lmd: 10000 }), tier(50, { orundum: 300, chip: 3 }), tier(200, { orundum: 600, chip: 6 })] },
  { id: "pulls", cat: "Tatari", n: "Rumors Take Shape", d: g => `Manifest ${g} times`, v: () => S.gacha.total,
    tiers: [tier(10, { orundum: 100 }), tier(50, { orundum: 300, permit: 1 }), tier(100, { orundum: 500, permit: 2 }), tier(300, { orundum: 1000, permit: 3 }), tier(1000, { orundum: 2000, permit: 5 })] },
  { id: "luck", cat: "Tatari", n: "Crimson Moon Fortune", d: g => `Manifest ${g} 5★ character${g > 1 ? "s" : ""}`, v: () => S.stats.fives,
    tiers: [tier(1, { orundum: 150 }), tier(5, { orundum: 400, permit: 1 }), tier(20, { orundum: 1000, permit: 3 })] },
  { id: "login", cat: "Login", n: "Night after Night", d: g => `Log in on ${g} days`, v: () => S.stats.loginDays,
    tiers: [tier(3, { orundum: 100 }), tier(7, { orundum: 300, permit: 1 }), tier(30, { orundum: 800, permit: 2 }), tier(100, { orundum: 1500, permit: 5 }), tier(365, { orundum: 3000, permit: 10 })] },
];
const ROMAN = ["", "I", "II", "III", "IV", "V", "VI", "VII"];
const achTierName = (a, i) => a.tiers.length > 1 ? `${a.n} ${ROMAN[i + 1]}` : a.n;
const achDone = () => ACH.reduce((n, a) => n + (S.achv[a.id] || 0), 0);
const achTotal = ACH.reduce((n, a) => n + a.tiers.length, 0);
function checkAchievements(silent) {
  const got = [];
  for (const a of ACH) {
    let i = S.achv[a.id] || 0;
    const v = a.v();
    while (i < a.tiers.length && v >= a.tiers[i][0]) {
      if (!silent) mailTo(S, { from: "Tatari Records", tag: "ach", title: `Achievement: ${achTierName(a, i)}`, body: `${a.d(a.tiers[i][0])}. Your reward is attached.`, rewards: a.tiers[i][1] });
      got.push(achTierName(a, i)); i++;
    }
    S.achv[a.id] = i;
  }
  if (got.length && !silent) { toast(`Achievement unlocked: ${got[0]}${got.length > 1 ? ` (+${got.length - 1} more)` : ""}. Reward sent to your Inbox.`, "gold"); sfx("heal"); }
  return got;
}
// battle statistics (called by the battle director when a fight ends)
function recordBattle(res, B) {
  S.stats.arcs += B.tally.arcs; S.stats.kills += B.tally.kills;
  if (res.win && !res.lost) S.stats.flawless++;
}
// everything the meta layer does on its own: expire mail, login gift, rank gifts, letters, achievements
function metaTick() {
  if (!UI.inGame || BT.on) return;
  purgeMail(); dailyLogin(); rankGifts(); castGift(); checkAchievements();
}

// ---------- screens: inbox ----------
const mailIcon = m => ({ welcome: IC.gift, gift: IC.gift, login: IC.cert, ach: IC.trophy.replace("<svg", '<svg style="color:var(--gold)"'), rank: IC.star }[m.tag] || IC.mail);
const ago = t => { const d = Math.floor((Date.now() - t) / DAY_MS); return d < 1 ? "Today" : d === 1 ? "Yesterday" : d + " days ago"; };
const rewardChips = r => Object.entries(r).map(([k, n]) => `<span class="cost">${itemIcon(k)}${fmt(n)}</span>`).join(" ");
SCREENS.inbox = () => {
  purgeMail();
  const list = S.inbox, open = unclaimedMail().length;
  return `<div class="stack">
    <div class="spread">${back("go", "Home", 'data-v="home"')}<span class="eyebrow">Inbox</span></div>
    <div class="spread"><h2>Inbox</h2><button class="btn sm" data-act="claimAllMail" ${open ? "" : "disabled"}>Claim all${open ? ` · ${open}` : ""}</button></div>
    <p class="small dim">Gifts, login rewards and achievement rewards arrive here. Gifts expire after ${MAIL_DAYS} days.</p>
    ${list.length ? list.map(m => `<button class="mailrow ${m.read && (m.claimed || !hasRewards(m)) ? "done" : ""}" data-act="openMail" data-id="${m.id}">
      <span class="mi">${mailIcon(m)}</span>
      <span class="mt"><b>${esc(m.title)}</b><span class="tiny dim">${esc(m.from)} · ${ago(m.t)}${m.exp && !m.claimed ? ` · expires in ${Math.max(1, Math.ceil((m.exp - Date.now()) / DAY_MS))}d` : ""}</span>
        ${hasRewards(m) ? `<span class="row tiny" style="gap:6px">${rewardChips(m.rewards)}</span>` : ""}</span>
      <span class="ms">${m.claimed ? IC.check : hasRewards(m) ? '<i class="dot" style="position:static"></i>' : !m.read ? '<i class="dot" style="position:static"></i>' : ""}</span>
    </button>`).join("") : '<p class="small dim">No mail. The night is quiet.</p>'}
    ${list.some(m => m.claimed || (m.read && !hasRewards(m))) ? `<button class="btn ghost wide" data-act="clearMail">Delete read and claimed mail</button>` : ""}
  </div>`;
};
function mailModal(m) {
  m.read = true;
  openModal(`<div class="stack"><div class="row" style="gap:10px"><span class="mi">${mailIcon(m)}</span><div><div class="eyebrow">${esc(m.from)} · ${ago(m.t)}</div><h2 style="font-size:20px">${esc(m.title)}</h2></div></div>
    <p class="small" style="line-height:1.5">${esc(m.body)}</p>
    ${hasRewards(m) ? `<div class="rewards">${rewardsHTML(Object.entries(m.rewards).map(([k, n]) => ({ k, n })))}</div>` : ""}
    ${hasRewards(m) && !m.claimed ? `<button class="btn wide" data-act="claimMail" data-id="${m.id}">Claim</button>` : `<button class="btn ghost wide" data-act="closeMail">${m.claimed ? "Claimed" : "Close"}</button>`}
  </div>`);
  save();
}

// ---------- screens: achievements ----------
SCREENS.ach = () => {
  checkAchievements();
  S.achSeen = achDone();
  const cat = UI.achCat || "All", list = ACH.filter(a => cat === "All" || a.cat === cat);
  return `<div class="stack">
    <div class="spread">${back("go", "Home", 'data-v="home"')}<span class="eyebrow">Tatari Records</span></div>
    <h2>Achievements</h2>
    <section class="panel stack" style="gap:6px"><div class="spread small"><span>Completed</span><b class="num">${achDone()} / ${achTotal}</b></div>
      <div class="bar"><i style="width:${achDone() / achTotal * 100}%"></i></div><p class="tiny dim">Each completed achievement sends its reward to your Inbox.</p></section>
    <div class="filters">${["All", ...ACH_CATS].map(c => `<button class="chip ${cat === c ? "on" : ""}" data-act="achCat" data-c="${c}">${c}</button>`).join("")}</div>
    ${list.map(a => {
      const i = S.achv[a.id] || 0, full = i >= a.tiers.length, t = a.tiers[Math.min(i, a.tiers.length - 1)], v = a.v();
      return `<div class="achrow ${full ? "full" : ""}"><span class="ai">${IC.trophy}</span>
        <div class="stack" style="gap:4px;min-width:0;flex:1"><div class="spread"><b class="small">${esc(achTierName(a, Math.min(i, a.tiers.length - 1)))}</b>
          <span class="pipsA">${a.tiers.map((_, k) => `<i class="${k < i ? "on" : ""}"></i>`).join("")}</span></div>
          <span class="tiny dim">${esc(a.d(t[0]))}</span>
          ${full ? `<span class="tiny gold">Complete</span>` : `<div class="bar"><i style="width:${Math.min(100, v / t[0] * 100)}%"></i></div>
          <div class="spread tiny"><span class="num">${fmt(Math.min(v, t[0]))} / ${fmt(t[0])}</span><span class="row" style="gap:6px">${rewardChips(t[1])}</span></div>`}
        </div></div>`;
    }).join("")}
  </div>`;
};

// ---------- screens: settings ----------
const chipRow = (act, cur, opts) => `<div class="filters">${opts.map(([v, n]) => `<button class="chip ${String(cur) === String(v) ? "on" : ""}" data-act="${act}" data-v="${v}">${n}</button>`).join("")}</div>`;
SCREENS.settings = () => {
  const st = S.settings;
  return `<div class="stack">
    <div class="spread">${back("go", "Home", 'data-v="home"')}<span class="eyebrow">Settings</span></div>
    <h2>Settings</h2>
    <section class="panel stack" style="gap:10px"><h3>Profile</h3>
      <label class="small dim" for="pname">Name</label>
      <div class="row" style="gap:8px"><input id="pname" class="tinput" maxlength="16" value="${esc(S.name)}"><button class="btn sm" data-act="saveName">Save</button></div>
      <div class="statgrid small">
        <div><span>Player ID</span><b class="num">${S.playerId.replace(/(\d{3})(?=\d)/g, "$1 ")}</b></div><div><span>Level</span><b>${S.lvl}</b></div>
        <div><span>Started</span><b>${new Date(S.created).toLocaleDateString()}</b></div><div><span>Login days</span><b>${S.stats.loginDays}</b></div>
        <div><span>Battles won</span><b>${fmtFull(S.stats.wins)}</b></div><div><span>Manifests</span><b>${fmtFull(S.gacha.total)}</b></div>
        <div><span>Characters</span><b>${Object.keys(S.ops).length}/${OP_KEYS.length}</b></div><div><span>Achievements</span><b>${achDone()}/${achTotal}</b></div>
      </div></section>
    <section class="panel stack" style="gap:10px"><h3>Sound</h3>
      <span class="small dim">Voices and sound effects</span>${chipRow("setSound", st.sound ? 1 : 0, [[1, "On"], [0, "Off"]])}
      <span class="small dim">Music</span>${chipRow("setMusic", st.music !== false ? 1 : 0, [[1, "On"], [0, "Off"]])}</section>
    <section class="panel stack" style="gap:10px"><h3>Battle</h3>
      <span class="small dim">Battle speed</span>${chipRow("setSpeed", st.speed, [[1, "1×"], [2, "2×"], [3, "3×"]])}
      <span class="small dim">Start battles on auto</span>${chipRow("setAuto", st.auto ? 1 : 0, [[1, "On"], [0, "Off"]])}
      <span class="small dim">Auto-battle tactics</span>${chipRow("setAi", st.ai, [["balanced", "Balanced"], ["aggressive", "Aggressive"], ["safe", "Defensive"]])}</section>
    <section class="panel stack" style="gap:10px"><h3>Account</h3>
      <p class="tiny dim">Progress saves in this browser only.</p>
      <button class="btn ghost wide" data-act="toTitle">Return to title screen</button>
      <button class="btn red wide" data-act="askReset">Reset account</button></section>
    <p class="tiny dim" style="text-align:center">Melty Blood RPG · Ver ${GAME_VER}<br>An unofficial, non-commercial fan game. Melty Blood and Tsukihime belong to TYPE-MOON and French-Bread; all art here is drawn by the game itself.</p>
  </div>`;
};
function resetModal() {
  openModal(`<div class="stack"><div class="eyebrow ds">Danger</div><h2>Reset account?</h2>
    <p class="small dim">This deletes everything in this browser: your characters, Mystic Codes, story progress, currencies, mail and achievements. You will start again from the title screen with a new account. This cannot be undone.</p>
    <label class="small" for="rconf">Type <b>RESET</b> to confirm</label>
    <input id="rconf" class="tinput" autocomplete="off" autocapitalize="characters" placeholder="RESET">
    <div class="row" style="gap:10px"><button class="btn ghost" style="flex:1" data-act="closeModal">Cancel</button><button class="btn red" style="flex:1" data-act="doReset">Reset</button></div></div>`);
}
function nameModal() {
  openModal(`<div class="stack" style="text-align:center;align-items:center"><div class="eyebrow">New account</div><h2>What should the night call you?</h2>
    <input id="nname" class="tinput" maxlength="16" placeholder="Night Walker" style="text-align:center;width:100%">
    <p class="tiny dim">You can change your name later in Settings.</p>
    <button class="btn wide" data-act="nameGo">Confirm</button></div>`);
  m0Click();
}
// a modal opened from a tap must not close on the same tap
function m0Click() { const m = $("#modal"); m.onclick = null; setTimeout(() => { m.onclick = e => { if (e.target === m && !$("#nname")) closeModal(); }; }, 0); }

// ---------- title screen ----------
// A typical gacha login screen: key art (drawn live), logo, a fake load bar, "Tap to start", version and player ID.
const TITLE = { on: false, raf: 0, t0: 0, stars: [], embers: [], city: [] };
function showTitle() {
  closeModal();
  let el = $("#title");
  if (!el) { el = document.createElement("div"); el.id = "title"; document.body.appendChild(el); }
  el.innerHTML = `<canvas id="tcv"></canvas>
    <div class="tlogo"><div class="tpre">Night of Rumors</div><h1>MELTY<br>BLOOD</h1><div class="tsub">— RPG —</div></div>
    <div class="tload" id="tload"><div class="tbar"><i id="tbarI"></i></div><span id="tloadT">Gathering rumors… 0%</span></div>
    <div class="ttap" id="ttap" hidden>Tap to Start</div>
    <div class="tfoot"><button class="tbtn" data-act="titleSettings">${IC.gearIc}<span>Settings</span></button><button class="tbtn" data-act="titleCredits">${IC.book}<span>Credits</span></button></div>
    <div class="tver">Ver ${GAME_VER} · ${S.named ? "ID " + S.playerId.replace(/(\d{3})(?=\d)/g, "$1 ") : "New account"}<br>Unofficial fan game. Melty Blood and Tsukihime © TYPE-MOON / French-Bread.</div>`;
  el.hidden = false; el.classList.remove("out");
  UI.inGame = false; TITLE.on = true; TITLE.t0 = performance.now();
  music("title");
  for (const k of ["shiki", "arcueid"]) if (spritePack(k)) sprLoad(k).catch(() => {});
  const rng = seeded(7);
  TITLE.stars = Array.from({ length: 120 }, () => ({ x: rng(), y: rng() * .7, r: .4 + rng() * 1.3, p: rng() * 7 }));
  TITLE.embers = Array.from({ length: 40 }, () => ({ x: rng(), y: rng(), v: .02 + rng() * .05, s: 1 + rng() * 2.5, p: rng() * 7 }));
  TITLE.city = []; for (let x = -0.02; x < 1.04;) { const w = .03 + rng() * .07; TITLE.city.push({ x, w, h: .08 + rng() * .2, win: rng() }); x += w * .92; }
  el.onclick = e => { if (e.target.closest("[data-act]")) return; if ($("#ttap") && !$("#ttap").hidden) titleStart(); };
  cancelAnimationFrame(TITLE.raf); titleLoop();
}
function titleLoop() {
  const cv = $("#tcv"); if (!TITLE.on || !cv) return;
  TITLE.raf = requestAnimationFrame(titleLoop);
  const dpr = Math.min(2, devicePixelRatio || 1), W = cv.clientWidth, H = cv.clientHeight;
  if (cv.width !== Math.round(W * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
  const g = cv.getContext("2d"); g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const t = (performance.now() - TITLE.t0) / 1000;
  // load bar, then "Tap to Start"
  const p = Math.min(1, t / 1.4), lt = $("#tloadT");
  if (lt) { $("#tbarI").style.width = p * 100 + "%"; lt.textContent = p < 1 ? `Gathering rumors… ${Math.floor(p * 100)}%` : "Ready"; if (p >= 1 && $("#ttap").hidden) { $("#ttap").hidden = false; $("#tload").classList.add("done"); } }
  // sky and stars
  const sky = g.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, "#04020a"); sky.addColorStop(.55, "#1a0614"); sky.addColorStop(1, "#3a0a18");
  g.fillStyle = sky; g.fillRect(0, 0, W, H);
  for (const s of TITLE.stars) { g.globalAlpha = .35 + .35 * Math.sin(t * 1.6 + s.p); g.fillStyle = "#f4e8ff"; g.beginPath(); g.arc(s.x * W, s.y * H, s.r, 0, 7); g.fill(); }
  g.globalAlpha = 1;
  // the crimson moon
  const mx = W * .64, my = H * .27, mr = Math.min(W, H) * .25;
  const glow = g.createRadialGradient(mx, my, mr * .6, mx, my, mr * 2.4); glow.addColorStop(0, "#ff2a4a55"); glow.addColorStop(1, "#ff2a4a00");
  g.fillStyle = glow; g.fillRect(0, 0, W, H);
  const moon = g.createRadialGradient(mx - mr * .3, my - mr * .3, mr * .1, mx, my, mr); moon.addColorStop(0, "#ffd6d6"); moon.addColorStop(.45, "#ff4d6d"); moon.addColorStop(1, "#7a0a22");
  g.fillStyle = moon; g.beginPath(); g.arc(mx, my, mr, 0, 7); g.fill();
  g.fillStyle = "#5a061844"; for (const [dx, dy, r] of [[-.3, .1, .18], [.25, -.2, .12], [.1, .35, .1], [-.05, -.4, .08]]) { g.beginPath(); g.arc(mx + dx * mr, my + dy * mr, r * mr, 0, 7); g.fill(); }
  g.strokeStyle = "#0a030855"; g.lineWidth = mr * .09; g.lineCap = "round";
  for (let k = 0; k < 3; k++) { const yy = my - mr * .2 + k * mr * .35 + Math.sin(t * .3 + k) * 4; g.beginPath(); g.moveTo(mx - mr * 1.6 + ((t * 8 + k * 60) % 40), yy); g.lineTo(mx + mr * 1.4, yy + 6); g.stroke(); }
  // Misaki Town skyline
  const base = H * .78;
  for (const b of TITLE.city) {
    g.fillStyle = "#0a0410"; g.fillRect(b.x * W, base - b.h * H, b.w * W + 1, H);
    g.fillStyle = "#ffb86b"; const cols = Math.max(1, Math.floor(b.w * W / 9)), rows = Math.floor(b.h * H / 12);
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (Math.sin(b.win * 999 + r * 7.3 + c * 3.1) > .72) { g.globalAlpha = .55 + .25 * Math.sin(t * .8 + r + c); g.fillRect(b.x * W + 4 + c * 9, base - b.h * H + 6 + r * 12, 3, 4); }
    g.globalAlpha = 1;
  }
  g.fillStyle = "#06020a"; g.fillRect(0, base, W, H - base);
  // Shiki and Arcueid on the rooftop: their MBAACC idle animations, or the drawn figures until those decode
  const fs = Math.min(W * .9, H * .55) / 150, fy = base + 2;
  const shS = MBS.packs.get("shiki"), arS = MBS.packs.get("arcueid");
  if (shS && arS) {
    const ss = Math.min(W * .62, H * .4) / 120;
    sprFrame(g, shS, "home", sprLoopFrame(shS.P.st.c.idle, t * 60), W * .3, fy, ss, 1, 1);
    sprFrame(g, arS, "home", sprLoopFrame(arS.P.st.c.idle, t * 60 + 40), W * .72, fy, ss, -1, 1);
  } else {
    const sh = OPS[homeKey("shiki-c")], ar = OPS[homeKey("arcueid-c")];
    g.save(); g.translate(W * .3, fy); g.scale(fs, fs); drawFigure(g, sh.fig, { name: "idle", time: t }); g.restore();
    g.save(); g.translate(W * .72, fy); g.scale(-fs, fs); drawFigure(g, ar.fig, { name: "idle", time: t + 1.3 }); g.restore();
  }
  // embers
  g.globalCompositeOperation = "lighter";
  for (const e of TITLE.embers) {
    const yy = ((e.y - t * e.v) % 1 + 1) % 1, xx = e.x + Math.sin(t * .8 + e.p) * .02;
    g.globalAlpha = .5 * Math.sin(yy * Math.PI); g.fillStyle = "#ff4d6d"; g.beginPath(); g.arc(xx * W, yy * H, e.s, 0, 7); g.fill();
  }
  g.globalAlpha = 1; g.globalCompositeOperation = "source-over";
  const vig = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * .3, W / 2, H / 2, Math.max(W, H) * .8); vig.addColorStop(0, "#0000"); vig.addColorStop(1, "#000c");
  g.fillStyle = vig; g.fillRect(0, 0, W, H);
}
function hideTitle() {
  const el = $("#title"); if (!el) return;
  TITLE.on = false; cancelAnimationFrame(TITLE.raf);
  el.classList.add("out"); setTimeout(() => { el.hidden = true; el.innerHTML = ""; }, 450);
}
// leaving the title: new accounts pick a name, then the intro; everyone gets their login gift and mail
function titleStart() {
  sfx("special"); hideTitle();
  UI.inGame = true;
  route("home");
  if (!S.named) { nameModal(); return; }
  afterLogin();
}
function afterLogin() {
  metaTick(); renderTop();
  if (!S.seenIntro) introModal(); else if (UI.view === "home") rerender();
}

// ---------- free Manifests ----------
async function manifestWith(results) { save(); renderTop(); await gachaReveal(results); checkAchievements(); rerender(); }

const META_ACT = {
  inbox: () => { closeModal(); route("inbox"); },
  openMail: d => { const m = S.inbox.find(x => x.id === +d.id); if (m) { mailModal(m); if (UI.view === "inbox") { const st = $("#view").scrollTop; $("#view").innerHTML = SCREENS.inbox(); $("#view").scrollTop = st; renderTop(); } } },
  closeMail: () => { closeModal(); if (UI.view === "inbox") rerender(); },
  claimMail: d => {
    const m = S.inbox.find(x => x.id === +d.id); const list = claimMail(m); if (!list.length) return;
    sfx("heal"); rerender(); rewardModal("Claimed", list, m.title);
  },
  claimAllMail: () => {
    let list = []; for (const m of unclaimedMail()) list = list.concat(claimMail(m));
    if (!list.length) return;
    sfx("win"); rerender(); rewardModal("Claimed all", list, "Inbox");
  },
  clearMail: () => { S.inbox = S.inbox.filter(m => !(m.claimed || (m.read && !hasRewards(m)))); sfx("tap"); rerender(); },
  achCat: d => { UI.achCat = d.c; rerender(); },
  // settings
  setSound: d => { S.settings.sound = d.v === "1"; rerender(); },
  setMusic: d => { setMusicOn(d.v === "1"); save(); rerender(); },
  setSpeed: d => { S.settings.speed = +d.v; rerender(); },
  setAuto: d => { S.settings.auto = d.v === "1"; rerender(); },
  setAi: d => { S.settings.ai = d.v; rerender(); },
  saveName: () => { const v = ($("#pname") || {}).value; S.name = (v || "").trim().slice(0, 16) || "Night Walker"; toast("Name saved."); rerender(); },
  askReset: () => resetModal(),
  doReset: () => {
    if ((($("#rconf") || {}).value || "").trim().toUpperCase() !== "RESET") { toast("Type RESET to confirm."); return; }
    clearTimeout(saveTimer);
    try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* storage unavailable */ }
    S = migrate(newSave()); save();
    UI.inGame = false; closeModal(); route("home"); showTitle();
  },
  toTitle: () => { save(); showTitle(); },
  // title screen
  titleSettings: () => { titleStart(); if (S.named) route("settings"); },
  titleCredits: () => {
    openModal(`<div class="stack" style="text-align:center"><h2>Credits</h2>
      <p class="small dim">Melty Blood RPG is an unofficial, non-commercial fan game made with love for Melty Blood and Tsukihime.</p>
      <p class="small dim">Melty Blood, Tsukihime, Kara no Kyoukai and Fate and their characters belong to TYPE-MOON and French-Bread. Move names follow the Mizuumi Melty Blood wiki.</p>
      <p class="small dim">Every character, enemy and backdrop is drawn by the game itself; no official assets are used.</p>
      <button class="btn wide" data-act="closeModal">Close</button></div>`);
  },
  nameGo: () => {
    const v = (($("#nname") || {}).value || "").trim().slice(0, 16);
    S.name = v || "Night Walker"; S.named = true; closeModal(); sfx("tap"); afterLogin();
  },
  // free Manifests from the welcome mail
  pullFree10: async () => {
    if (!(S.inv.free10 > 0)) return;
    S.inv.free10--;
    await manifestWith(headhunt(10, !UI.hhStd));
  },
  pullGold5: async () => {
    if (!(S.inv.gold5 > 0)) return;
    S.inv.gold5--; S.daily.hh++;
    await manifestWith([pullOne(false, 5)]);
  },
};

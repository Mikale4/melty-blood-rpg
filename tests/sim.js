// Balance check: auto-vs-auto win rates for each story battle, Night Patrol level and some Arcade stages.
// VARIANTS=1 instead rates every Moon style (its home-Element unit) in a fixed squad against three gauntlets, to spot
// outliers; ELEMENTS=1 rates every Moon style in all five Elements and prints the average per Element.
const path = require('path');
const { chromium } = require('playwright');
const PAGE = require('url').pathToFileURL(path.resolve(__dirname, '../Melty Blood RPG.html')).href;
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({ status: 200, body: '' }));
  await page.goto(PAGE); await page.waitForTimeout(500);
  const out = await page.evaluate(variants => {
    const sim = (team, waves, LV, n) => { let w = 0;
      for (let i = 0; i < n; i++) { const B = makeBattle({ allies: team.map(k => ({ op: k, prog: progForLV(k, LV) })), waves, auto: true, aiStyle: "balanced" });
        let g = 0; while (!B.over && g++ < 4000) { const r = B.step(); if (r === "input") B.autoAct(); B.ev.length = 0; }
        if (B.result && B.result.win) w++; }
      return (Math.round(w / n * 100) + "%").padStart(4); };
    const starters = STARTERS.slice(0, 4), mixed = ["arcueid-f", "ciel-c", "akiha-f", "hisui-c"].map(homeKey), N = 12, rows = [];
    if (variants) {
      // three gauntlets with a boss in each Moon style and mixed minions, so no style is favoured by affinity
      const boss = k => { const op = OPS[k], id = "sim_" + k; ENEMY[id] = { ...ENEMY.b_chaos, n: op.n, op: k, cls: op.cls, el: op.el, kin: op.kin, fig: op.fig, skills: op.skills, passives: op.passives, m: { hp: 2.6, atk: 1.05, def: 1, spd: op.stats.spd - 4 }, key: id }; return id; };
      // a boss in each Moon style and each triangle Element, with minions of every Element
      const G = ["red-akiha-c-fire", "red-akiha-h-water", "red-akiha-f-wind"].map(k => [[{ en: "hound", LV: 42 }, { en: "dead", LV: 42 }, { en: "ghoul", LV: 42 }], [{ en: boss(k), LV: 40 }, { en: "executor", LV: 40 }, { en: "wraith", LV: 40 }]]);
      const squad = ["kouma-h", "hisui-h", "kohaku-c"].map(homeKey);
      const M = variants === "el" ? 4 : 12, rate = k => { let w = 0;
        for (const waves of G) for (let i = 0; i < M; i++) { const B = makeBattle({ allies: [k, ...squad].map(x => ({ op: x, prog: progForLV(x, 40) })), waves, auto: true, aiStyle: "balanced" });
          let g = 0; while (!B.over && g++ < 4000) { const r = B.step(); if (r === "input") B.autoAct(); B.ev.length = 0; } if (B.result && B.result.win) w++; }
        return Math.round(w / M / G.length * 100); };
      if (variants === "el") {
        const by = {}; for (const k of OP_KEYS) (by[OPS[k].el] = by[OPS[k].el] || []).push(rate(k));
        return ELS.map(e => `${e} ${Math.round(by[e].reduce((a, b) => a + b, 0) / by[e].length)}%`).join(" · ");
      }
      const res = FAMS.map(homeKey).map(k => [k, OPS[k].rar, rate(k)]);
      const avg = f => { const l = res.filter(f); return Math.round(l.reduce((a, r) => a + r[2], 0) / l.length); };
      const sum = [...STYLES.map(e => `${e} ${avg(r => OPS[r[0]].style === e)}%`), ...[3, 4, 5].map(x => `${x}★ ${avg(r => r[1] === x)}%`)].join(" · ");
      return sum + "\n" + res.sort((a, b) => b[2] - a[2]).map(r => `${r[0].padEnd(22)} ${r[1]}★ ${String(r[2]).padStart(3)}%`).join("\n");
    }
    for (const nd of Object.values(NODES)) if (nd.waves) {
      const waves = nd.waves.map(w => convWave(w, nd.lv));
      rows.push(`${nd.id.padEnd(5)} ${nd.type.padEnd(6)} lv${String(nd.lv).padEnd(3)} starters@-3:${sim(starters, waves, Math.max(1, nd.lv - 3), N)} @+0:${sim(starters, waves, nd.lv, N)} @+5:${sim(starters, waves, nd.lv + 5, N)} | mixed@+0:${sim(mixed, waves, nd.lv, N)}`);
    }
    for (const h of HUNTS) for (const l of [1, 3, 6]) rows.push(`patrol ${h.code}-${l} lv${HUNT_LV[l - 1]} mixed@lv:${sim(mixed, huntWaves(h, l), HUNT_LV[l - 1], N)}`);
    for (const f of [1, 5, 10, 20, 30]) { const T = towerFloor(f); rows.push(`arcade ${f} lv${T.lv} mixed@lv:${sim(mixed, T.waves.map(w => convWave(w, T.lv)), T.lv, N)}`); }
    return rows.join("\n");
  }, process.env.ELEMENTS ? "el" : !!process.env.VARIANTS);
  console.log(out); console.log('errs', errs);
  await browser.close();
})();

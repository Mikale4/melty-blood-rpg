// Battle look check: an auto battle with MBAACC sprite units, screenshots every 250 ms to tests/shots/battle/.
//   node tests/battle.js [landscape] [seconds] [ally keys...]   e.g. node tests/battle.js 20 kohaku-mech-c archetype-c
// Also reports which MBAACC sounds played (voices, move sounds, impacts) and the music key.
const path = require('path'), fs = require('fs');
const { chromium } = require('playwright');
const args = process.argv.slice(2), land = args[0] === 'landscape'; if (land) args.shift();
const secs = +(args[0] || 16); if (args.length) args.shift();
const SH = path.join(__dirname, 'shots', 'battle' + (land ? '_land' : '')) + '/'; fs.rmSync(SH, { recursive: true, force: true }); fs.mkdirSync(SH, { recursive: true });
const PAGE = require('url').pathToFileURL(path.resolve(__dirname, '../Melty Blood RPG.html')).href;
(async () => {
  const browser = await chromium.launch();
  const vp = land ? { width: 844, height: 390 } : { width: 390, height: 844 };
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push('PAGEERR ' + e.message + ' ' + (e.stack || '').split('\n').slice(1, 3).join(' | ')));
  await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({ status: 200, body: '' }));
  await page.goto(PAGE); await page.waitForTimeout(1500);
  await page.evaluate(team => {
    hideTitle(); S.settings.auto = true; S.settings.speed = 1;
    const allies = (team.length ? team : ['akiha-c', 'shiki-h', 'sion-f', 'arcueid-c']).map(f => OPS[f] ? f : homeKey(f));
    startBattle({ allies: allies.map(k => ({ op: k, prog: progForLV(k, 50) })), waves: [[{ en: 'b_nanaya', LV: 30 }, { en: 'ghoul', LV: 30 }, { en: 'b_riesbyfe', LV: 30 }]],
      title: 'Sprite check', sub: 'tests/battle.js', env: 'alley', onWin: () => ({ rewards: [] }), onLose: () => ({ rewards: [] }) });
  }, args);
  await page.evaluate(() => { window.__clips = []; const c = clip; window.clip = clip = (n, v) => { window.__clips.push(n); return c(n, v); }; });
  for (let i = 0; i < secs * 4; i++) { await page.waitForTimeout(250); await page.screenshot({ path: SH + String(i).padStart(3, '0') + '.png' }); }
  const snd = await page.evaluate(() => ({ clips: window.__clips.length, voices: window.__clips.filter(n => n.startsWith('vo/')).length, sample: [...new Set(window.__clips)].slice(0, 12), music: AUD.musicKey, bad: [...AUD.bad].slice(0, 5) }));
  console.log('sound', JSON.stringify(snd));
  console.log('errors', errs.slice(0, 8));
  await browser.close();
})();

// Draws every character and enemy figure to tests/shots/figures.png and a pose sheet to tests/shots/poses.png.
const path = require('path'), fs = require('fs');
const { chromium } = require('playwright');
const SH = path.join(__dirname, 'shots') + '/'; fs.mkdirSync(SH, { recursive: true });
const PAGE = require('url').pathToFileURL(path.resolve(__dirname, '../Melty Blood RPG.html')).href;
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 1060 } });
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({ status: 200, body: '' }));
  await page.goto(PAGE); await page.waitForTimeout(500);
  await page.evaluate(() => {
    document.body.innerHTML = ''; document.body.style.background = '#1a1420';
    const cv = document.createElement('canvas'); cv.width = 1400; cv.height = 1060; document.body.appendChild(cv);
    const g = cv.getContext('2d'); g.fillStyle = '#241a2c'; g.fillRect(0, 0, 1400, 1060);
    const list = [...CHARS.map(c => [c.n, c.fig]), ...['ghoul', 'dead', 'hound', 'panther', 'phantom', 'wraith', 'executor', 'knight', 'homunculus'].map(k => [ENEMY[k].n, ENEMY[k].fig])];
    list.forEach(([n, f], i) => {
      const x = 56 + (i % 13) * 106, y = 230 + Math.floor(i / 13) * 260;
      g.save(); g.translate(x, y); g.scale(1.55, 1.55); drawFigure(g, f, { name: 'idle', time: .6 }); g.restore();
      g.fillStyle = '#fff'; g.font = '11px sans-serif'; g.textAlign = 'center'; g.fillText(n.length > 18 ? n.slice(0, 17) + '…' : n, x, y + 18);
    });
  });
  await page.screenshot({ path: SH + 'figures.png' });
  await page.evaluate(() => {
    const cv = document.querySelector('canvas'), g = cv.getContext('2d'); g.fillStyle = '#241a2c'; g.fillRect(0, 0, 1400, 1060);
    const ks = ['shiki-c', 'ciel-c', 'hisui-c', 'powered-ciel-c', 'arcueid-c', 'sion-c', 'riesbyfe-c'], poses = [['idle', 0], ['swing', .3], ['swing', .5], ['shoot', .15], ['cast', .6], ['buff', .6], ['hit', .1], ['victory', 0]];
    ks.forEach((k, r) => poses.forEach(([p, t], c) => { g.save(); g.translate(80 + c * 165, 140 + r * 140); g.scale(1.1, 1.1); drawFigure(g, OPS[homeKey(k)].fig, { name: p, t, time: 1 }); g.restore(); }));
  });
  await page.screenshot({ path: SH + 'poses.png' });
  console.log('errs', errs);
  await browser.close();
})();

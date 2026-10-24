
// =====================================================================
//  SOUND — MBAACC music, voices and effects (tools/audio.py -> audio/ next to the HTML, played with <audio> elements,
//  which also work from file://), with the tiny WebAudio synth below as the fallback when a file is missing.
//  Battle sprites cue their own voice lines and move sounds frame by frame (a5b_sprites.js sprSound).
// =====================================================================
const AUD = { base: "audio/", pool: new Map(), bad: new Set(), live: 0, music: null, musicKey: null, wait: null };
const AUD_VOL = { vo: 1, se: .75, music: .5 };
// play audio/<name>.mp3 ("vo/Akiha_B0AA054", "se/SE002"); false when it can't (sound off, file missing)
function clip(name, vol = 1) {
  if (!S.settings.sound || AUD.bad.has(name) || AUD.live > 14) return false;
  let list = AUD.pool.get(name); if (!list) AUD.pool.set(name, list = []);
  let a = list.find(x => x.paused || x.ended);
  if (!a) {
    if (list.length >= 3) return true;
    a = new Audio(AUD.base + name + ".mp3"); a.preload = "auto";
    a.addEventListener("error", () => { AUD.bad.add(name); AUD.live = Math.max(0, AUD.live - 1); });
    a.addEventListener("ended", () => { AUD.live = Math.max(0, AUD.live - 1); });
    list.push(a);
  }
  a.volume = clamp(vol * (AUD_VOL[name.slice(0, 2)] || .8), 0, 1);
  try { a.currentTime = 0; } catch (e) {}
  AUD.live++;
  a.play().catch(() => { AUD.live = Math.max(0, AUD.live - 1); });
  return true;
}
// generic sounds that have a confident MBAACC counterpart; everything else stays synthesized
const SFX_CLIP = { hit: "se/SE001", crit: "se/SE002", saber: "se/SE043", boom: "se/SE014" };
function sfx(kind) {
  if (!S.settings.sound) return;
  if (SFX_CLIP[kind] && clip(SFX_CLIP[kind])) return;
  if ((kind === "win" || kind === "lose") && AUD.music) return;    // the victory / defeat music plays instead
  synth(kind);
}
// ---------- music: MBBGM (sprites/_bgm.js) keys, crossfaded, looping at the original loop points ----------
function music(key) {
  if (AUD.musicKey === key) return;
  AUD.musicKey = key;
  const old = AUD.music; AUD.music = null;
  if (old) fadeAudio(old, 0, 700, () => old.pause());
  const T = typeof MBBGM !== "undefined" && MBBGM[key];
  if (!T || !S.settings.music) return;
  const a = new Audio(AUD.base + "bgm/" + T.f + ".mp3");
  a.volume = 0; a.addEventListener("error", () => { if (AUD.music === a) AUD.music = null; });
  a.addEventListener("ended", () => { if (T.loop >= 0 && AUD.music === a) { a.currentTime = T.loop; a.play().catch(() => {}); } });
  AUD.music = a;
  a.play().then(() => fadeAudio(a, AUD_VOL.music, 900)).catch(() => { AUD.wait = a; });
}
function fadeAudio(a, to, ms, done) {
  const from = a.volume, t0 = performance.now();
  const step = () => { const k = Math.min(1, (performance.now() - t0) / ms); a.volume = clamp(from + (to - from) * k, 0, 1); if (k < 1) requestAnimationFrame(step); else if (done) done(); };
  requestAnimationFrame(step);
}
// browsers only start audio after a tap: start the waiting track on the first one
document.addEventListener("pointerdown", () => {
  const a = AUD.wait; if (!a) return; AUD.wait = null;
  if (AUD.music === a) a.play().then(() => fadeAudio(a, AUD_VOL.music, 900)).catch(() => {});
}, true);
function setMusicOn(on) { S.settings.music = on; const k = AUD.musicKey; AUD.musicKey = null; if (on) music(k); else music(null); }
// what plays on each screen and in each battle
const screenMusic = view => view === "tatari" ? "tatari" : "home";
const hasBgm = k => typeof MBBGM !== "undefined" && !!MBBGM[k];
function battleMusic(cfg) {
  if (cfg.bgm && hasBgm(cfg.bgm)) return cfg.bgm;
  const boss = (cfg.waves || []).some(w => w.some(x => x.en && ENEMY[x.en] && ENEMY[x.en].boss));
  if (boss) return cfg.env === "wallachia" ? "wallachia" : "boss";
  return hasBgm(cfg.env) ? cfg.env : "battle";
}

// ---------- the synthesized fallback (tiny WebAudio synth) ----------
const SFX = { ctx: null, noise: null };
function synth(kind) {
  try {
    const A = SFX.ctx || (SFX.ctx = new (window.AudioContext || window.webkitAudioContext)());
    if (A.state === "suspended") A.resume();
    const t = A.currentTime;
    const osc = (type, f0, f1, dur, vol, at = 0) => {
      const o = A.createOscillator(), g = A.createGain(); o.type = type; o.connect(g); g.connect(A.destination);
      o.frequency.setValueAtTime(f0, t + at); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + at + dur);
      g.gain.setValueAtTime(.0001, t + at); g.gain.exponentialRampToValueAtTime(vol, t + at + .015); g.gain.exponentialRampToValueAtTime(.0001, t + at + dur);
      o.start(t + at); o.stop(t + at + dur + .02);
    };
    const noise = (dur, vol, freq = 1200) => {
      if (!SFX.noise) { const b = A.createBuffer(1, A.sampleRate * .6, A.sampleRate), d = b.getChannelData(0); for (let k = 0; k < d.length; k++) d[k] = R() * 2 - 1; SFX.noise = b; }
      const s = A.createBufferSource(), f = A.createBiquadFilter(), g = A.createGain(); s.buffer = SFX.noise; f.type = "lowpass"; f.frequency.value = freq;
      s.connect(f); f.connect(g); g.connect(A.destination);
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0001, t + dur); s.start(t); s.stop(t + dur);
    };
    if (kind === "blaster") osc("square", 1500 + R() * 300, 160, .17, .05);
    else if (kind === "saber") { noise(.16, .2, 2600); osc("sine", 1100, 320, .14, .02); }
    else if (kind === "bow") { noise(.06, .22, 3200); osc("triangle", 240, 110, .14, .06); }
    else if (kind === "shot") { noise(.11, .38, 3400); osc("square", 190, 55, .09, .06); }
    else if (kind === "arts") { osc("sine", 620, 1500, .18, .045); osc("triangle", 310, 920, .22, .03, .03); }
    else if (kind === "hit") noise(.12, .18, 900);
    else if (kind === "crit") { noise(.2, .28, 1600); osc("square", 300, 90, .2, .05); }
    else if (kind === "boom") { noise(.7, .45, 420); osc("sine", 120, 30, .6, .25); }
    else if (kind === "zap") { for (let k = 0; k < 4; k++) osc("square", 800 + R() * 900, 200 + R() * 300, .07, .03, k * .06); }
    else if (kind === "heal") { [523, 659, 784].forEach((f, k) => osc("sine", f, f * 1.01, .25, .05, k * .07)); }
    else if (kind === "special") { osc("sawtooth", 160, 640, .45, .045); osc("sine", 320, 1280, .45, .04); }
    else if (kind === "win") { [392, 523, 659, 784].forEach((f, k) => osc("triangle", f, f, .32, .07, k * .12)); }
    else if (kind === "lose") { [392, 330, 262].forEach((f, k) => osc("triangle", f, f * .98, .4, .06, k * .18)); }
    else if (kind === "flame") noise(.6, .2, 700);
    else if (kind === "tap") osc("sine", 880, 660, .05, .03);
    else if (kind === "warp") osc("sine", 200, 1400, .4, .04);
  } catch (e) { /* audio unavailable */ }
}

// ---------- camera shots ----------

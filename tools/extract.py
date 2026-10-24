"""Build the battle sprite packs from the owner's MBAACC install: python tools/extract.py [char ...]

For every character (tools/moves.py CHAR_FILE) it flattens the animations the RPG plays into timelines, packs every
sprite they use into two sheets (palette-index sprites, recoloured per Element at runtime, and true-colour effect
sprites), and writes sprites/<key>.js (base64 WebP sheets + JSON) for build.sh to embed. Tag teams (moves.py PARTNER)
also get their partner's pack. The sounds the timelines cue are listed in tools/audio_used.json for tools/audio.py.

Timelines tick at 60 per second like the original. A frame is
  [sprite, ox, oy, dur, blend, alpha, sx, sy, rot, hit, spawns, move, snd, partner, hitsnd]
  sprite  index into "spr" (-1 = nothing drawn); ox/oy = its top-left from the feet (facing right)
  blend   0 normal, 2 additive, 3 subtractive; alpha 0-255
  sx/sy   scale, rot = Z rotation in turns
  hit     1 on frames with an active attack box
  spawns  [[effect, x, y]] effects started on this frame (index into "fx"), offset from the spawner's origin
  move    0 or [flags, vx, vy, ax, ay] (1/100 px per tick; flags 1 set X, 2 add X, 16 set Y, 32 add Y)
  snd     0 or [sound, ...] sounds started on this frame (index into "snd"; each entry lists variants to pick from)
  partner 0 or n: this frame cues the partner's role "p<n>"
  hitsnd  the impact sound of this frame's hit (index into "snd"), -1 for none
Skill roles also get hits [[tick, reach px, hitsnd, 1 if the partner lands it]] and len (ticks until it all ends).
"""
import sys, os, io, json, base64, colorsys, hashlib
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(__file__))
from mbaacc import Data, CG, read_pal, rgba, load_style, char_files
from moves import CHAR_FILE, STYLES, PARTNER
from preview import frames_of, jump_frame

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'sprites')
USED = os.path.join(ROOT, 'tools', 'audio_used.json')
# role -> (sequence, mode). "loop" repeats from the sequence's own loop point; "once" plays and holds the last frame.
ROLES = {'idle': (0, 'loop'), 'walk': (10, 'loop'), 'run': (43, 'loop'), 'back': (45, 'once'), 'guard': (17, 'once'),
         'hit': (23, 'once'), 'hit2': (24, 'once'), 'down': (26, 'once'), 'intro': (50, 'once'), 'win': (52, 'loop')}
EL_HUE = {'Fire': 8, 'Water': 215, 'Wind': 135, 'Imaginary': 280}
FX_LIFE = 150
PARTNER_X = -38        # where a tag partner stands, in sprite px from the main character (behind them)


def loop_frames(seqs, sid):
    """Frames up to the first backward jump, and where the loop restarts."""
    fr = seqs[sid]['frames']
    for i, f in enumerate(fr):
        if f['ani'] == 2 and 0 <= jump_frame(f, i) <= i: return [(sid, k) for k in range(i + 1)], jump_frame(f, i)
    return [(sid, k) for k in range(len(fr))], len(fr) - 1


class Sounds:
    """A character's sound list (data/<f>_SeList.txt: voices and move sounds) plus the shared se/normal_se effects.
    Cued files are recorded in `used` as output name -> archive path."""
    def __init__(self, D, f, used):
        self.D, self.used, self.sel = D, used, {}
        p = 'data/%s_SeList.txt' % f
        if D.has(p):
            for line in D.read(p).decode('cp932', 'replace').splitlines():
                body = line.split('//')[0].strip()
                if '=' in body:
                    a, b = [x.strip() for x in body.split('=', 1)]
                    if a.isdigit() and b: self.sel[int(a)] = b

    def find(self, stem, folders):
        for fo in folders:
            for ext in ('.wav', '.ogg'):
                p = 'se/%s/%s%s' % (fo, stem, ext)
                if self.D.has(p): return p
        return None

    def common(self, n):
        p = self.find('SE%03d' % n, ['normal_se', 'battle_se'])
        if not p: return []
        name = 'se/SE%03d' % n; self.used[name] = p; return [name]

    def voice(self, n, count=1):
        out = []
        for k in range(n, n + max(1, count)):
            stem = self.sel.get(k)
            p = stem and self.find(stem, ['battle_se', 'normal_se', 'story_se'])
            if p: name = 'vo/' + stem; self.used[name] = p; out.append(name)
        return out


class Pack:
    def __init__(self, D, key, f, used):
        self.key, self.f, self.D = key, f, D
        files = char_files(D, f + '_0') if D.has('data/%s_0.txt' % f) else {'cg': ['data/%s.cg' % f]}
        self.cg = CG(D.read(files['cg'][0]))
        pp = next((p for p in ('data/%s.pal' % f, files['cg'][0][:-3] + '.pal') if D.has(p)), None)
        self.pals = read_pal(D.read(pp)) if pp else [self.cg.palette]
        self.spr, self.sprmap = [], {}       # sprite index -> (kind, pixels, x, y, scale)
        self.fx, self.fxmap = [], {}         # (style, seq) -> fx index
        self.snd, self.sndmap = [], {}       # sound cue -> variant list
        self.sounds = Sounds(D, f, used)
        self.cues = {}                       # style -> partner sequences this character cues

    def sprite(self, n):
        if n < 0: return -1
        if n in self.sprmap: return self.sprmap[n]
        r = self.cg.pixels(n)
        idx = -1
        if r:
            kind, px, x1, y1 = r
            alpha = px > 0 if kind == 'idx' else px[..., 3] > 0
            ys, xs = np.nonzero(alpha)
            if len(xs):
                y0, y1b, x0, x1b = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
                idx = len(self.spr)
                px = px[y0:y1b, x0:x1b]; sc = 1
                if kind == 'rgba' and px.shape[0] * px.shape[1] > 96 * 96:
                    # big effect images (glows, flames, pillars) are soft: store them at half size, drawn back at 2x
                    im = Image.fromarray(px, 'RGBA'); sc = 2
                    px = np.array(im.resize((max(1, im.width // 2), max(1, im.height // 2)), Image.LANCZOS))
                self.spr.append((kind, px, x1 + int(x0) - 128, y1 + int(y0) - 224, sc))
        self.sprmap[n] = idx
        return idx

    def cue(self, names):
        k = tuple(names)
        if k not in self.sndmap: self.sndmap[k] = len(self.snd); self.snd.append(list(names))
        return self.sndmap[k]

    def frame(self, seqs, style, f, depth):
        spr = self.sprite(f['spr']) if not f['pat'] else -1
        ox = oy = 0
        if spr >= 0: ox, oy = self.spr[spr][2] + f['ox'], self.spr[spr][3] + f['oy']
        sx, sy = f['scale'] or (1, 1)
        rot = (f['rot'] or (0, 0, 0))[2]
        spawns, snd, partner = [], [], 0
        for tp, no, pr in f.get('ef', []):
            if tp == 1 and no in seqs and depth < 3:
                e = self.effect(seqs, style, no, depth + 1)
                if e is not None: spawns.append([e, pr[0] if len(pr) > 0 else 0, pr[1] if len(pr) > 1 else 0])
            elif tp == 9 and pr:
                # 0: a shared effect sound SE<n>; 1: the character's list, entry n (or a random one of the next `count`)
                names = self.sounds.common(pr[0]) if no == 0 else self.sounds.voice(pr[0], pr[2] if len(pr) > 2 else 1) if no == 1 else []
                if names: snd.append(self.cue(names))
            elif tp == 6 and no == 150 and pr:
                partner = pr[0]; self.cues.setdefault(style, set()).add(pr[0])
        hitsnd = -1
        if f['hit'] and f.get('hitfx'):
            eff, sound = f['hitfx']
            names = self.sounds.common(sound or eff)
            if names: hitsnd = self.cue(names)
        mv = list(f['move']) if f['move'] else 0
        return [spr, ox, oy, max(1, f['dur']), f['blend'] if f['blend'] in (2, 3) else 0, f['alpha'] if f['blend'] else 255,
                round(sx, 3), round(sy, 3), round(rot, 4), 1 if f['hit'] else 0, spawns, mv, snd or 0, partner, hitsnd]

    def timeline(self, seqs, style, order, depth=0, cap=None):
        out, t = [], 0
        for s, i in order:
            fr = self.frame(seqs, style, seqs[s]['frames'][i], depth)
            out.append(fr); t += fr[3]
            if cap and t >= cap: break
        return out

    def effect(self, seqs, style, sid, depth):
        key = (style, sid)
        if key in self.fxmap: return self.fxmap[key]
        self.fxmap[key] = None            # guards recursion
        tl = self.timeline(seqs, style, frames_of(seqs, sid), depth, cap=FX_LIFE)
        if not any(f[0] >= 0 or f[10] or f[12] for f in tl): return None
        self.fx.append(tl); self.fxmap[key] = len(self.fx) - 1
        return self.fxmap[key]

    def role(self, seqs, style, sid, mode):
        if sid not in seqs: return None
        if mode == 'loop':
            order, loop = loop_frames(seqs, sid)
            return {'f': self.timeline(seqs, style, order), 'loop': loop}
        order = frames_of(seqs, sid)
        return {'f': self.timeline(seqs, style, order), 'loop': -1}


def simulate(P, tl, partner=None):
    """Hit ticks, how far in front of the user each hit lands (sprite px) and its impact sound, for the battle director.
    `partner` is (partner pack, its roles) for tag teams: cued partner moves run from where the partner stands."""
    # actor: [pack, timeline, k, tick, x, y, v, life, is_effect]
    actors, hits, t = [[P, tl, 0, 0, 0.0, 0.0, [0, 0, 0, 0], 0, False]], [], 0
    while actors and t < 60 * 12:
        nxt = []
        for a in actors:
            pk, tl_, k, tick, x, y, v, life, isfx = a
            if k >= len(tl_): continue
            f = tl_[k]
            if tick == 0:
                if f[11]:
                    fl, vx, vy, ax, ay = f[11]
                    if fl & 1: v[0] = vx
                    if fl & 2: v[0] += vx
                    if fl & 16: v[1] = vy
                    if fl & 32: v[1] += vy
                    if fl & 3: v[2] = ax
                    if fl & 48: v[3] = ay
                if f[9] and (k == 0 or not tl_[k - 1][9]):
                    reach = x
                    if f[0] >= 0:
                        px, sc = pk.spr[f[0]][1], pk.spr[f[0]][4]; reach = x + f[1] + px.shape[1] * sc * .75
                    hits.append([t, round(reach), f[14], 0 if pk is P else 1])   # 1: the partner's hit (its own sounds)
                for e, ex, ey in f[10]: nxt.append([pk, pk.fx[e], 0, 0, x + ex, y + ey, [0, 0, 0, 0], 0, True])
                if f[13] and partner and ('p%d' % f[13]) in partner[1]:
                    nxt.append([partner[0], partner[1]['p%d' % f[13]]['f'], 0, 0, PARTNER_X, 0.0, [0, 0, 0, 0], 0, False])
            x += v[0] / 100; y += v[1] / 100; v[0] += v[2] / 100; v[1] += v[3] / 100
            tick += 1; life += 1
            if tick >= f[3]: tick = 0; k += 1
            if not isfx or life < FX_LIFE: nxt.append([pk, tl_, k, tick, x, y, v, life, isfx])
        actors = [a for a in nxt if a[2] < len(a[1])]
        t += 1
    return hits, t


def pick_palettes(P, idle_sprites):
    """Palette candidates with their dominant hue, saturation and brightness (over the idle stance's pixels)."""
    counts = np.zeros(256)
    for n in idle_sprites:
        if n >= 0 and P.spr[n][0] == 'idx': counts += np.bincount(P.spr[n][1].ravel(), minlength=256)
    counts[0] = 0
    uniq, seen = [], set()
    for i, p in enumerate(P.pals):
        h = hashlib.md5(p.tobytes()).hexdigest()
        if h in seen or not (p[1:] & 0xffffff).any(): continue
        seen.add(h); uniq.append(i)
    info = {}
    for i in uniq:
        c = rgba(P.pals[i])[:, :3].astype(float) / 255
        hsv = np.array([colorsys.rgb_to_hsv(*x) for x in c])
        w = counts * hsv[:, 1] * hsv[:, 2]
        hx = (np.cos(hsv[:, 0] * 2 * np.pi) * w).sum(); hy = (np.sin(hsv[:, 0] * 2 * np.pi) * w).sum()
        hue = (np.degrees(np.arctan2(hy, hx)) + 360) % 360
        sat = (w.sum() / max(1, (counts * hsv[:, 2]).sum()))
        val = (counts * hsv[:, 2]).sum() / max(1, counts.sum())
        info[i] = (hue, sat, val)
    return info


def build(D, key, skills, used):
    P = Pack(D, key, CHAR_FILE[key], used)
    pf = PARTNER.get(key)
    P2 = Pack(D, key, pf, used) if pf else None
    styles, pstyles, seqmap = {}, {}, {}
    for st, si in STYLES.items():
        seqs, _ = load_style(D, P.f, si); seqmap[st] = seqs
        R = {}
        for name, (sid, mode) in ROLES.items():
            r = P.role(seqs, si, sid, mode)
            if r: R[name] = r
        for slot, sk in (skills.get(st) or {}).items():
            if sk['seq'] is None: continue
            r = P.role(seqs, si, sk['seq'], 'once')
            if r: R['s' + slot] = r
        styles[st[0].lower()] = R
    if P2:
        # the partner's own stance and reactions, plus every move the main character cues
        for st, si in STYLES.items():
            seqs2, _ = load_style(D, pf, si)
            R2 = {}
            for name, (sid, mode) in ROLES.items():
                r = P2.role(seqs2, si, sid, mode)
                if r: R2[name] = r
            for n in sorted(P.cues.get(si, ())):
                r = P2.role(seqs2, si, n, 'once')
                if r:
                    # some cued states hold for many seconds (waiting to be caught, etc.): keep four seconds
                    t = 0
                    for i, f in enumerate(r['f']):
                        t += f[3]
                        if t >= 240: r['f'] = r['f'][:i + 1]; break
                    R2['p%d' % n] = r
            pstyles[st[0].lower()] = R2
    for k, R in styles.items():
        for name, r in R.items():
            if name[0] == 's' and name[1:].isdigit():
                r['hits'], r['len'] = simulate(P, r['f'], (P2, pstyles[k]) if P2 else None)
    info = pick_palettes(P, [f[0] for f in styles['c']['idle']['f']])
    partner = (P2, pstyles, pick_palettes(P2, [f[0] for f in pstyles['c']['idle']['f']])) if P2 else None
    return P, styles, info, partner


def sheet(items, kind):
    """Shelf-pack sprites into one image; returns (PIL image, rects)."""
    order = sorted(range(len(items)), key=lambda i: -items[i].shape[0])
    W = 1024 if sum(a.shape[0] * a.shape[1] for a in items) < 700000 else 2048
    x = y = rowh = 0; rects = [None] * len(items)
    for i in order:
        h, w = items[i].shape[:2]
        if x + w > W: x, y, rowh = 0, y + rowh + 1, 0
        rects[i] = (x, y, w, h); x += w + 1; rowh = max(rowh, h)
    H = y + rowh
    img = np.zeros((max(1, H), W) if kind == 'idx' else (max(1, H), W, 4), np.uint8)
    for i, (x, y, w, h) in enumerate(rects): img[y:y + h, x:x + w] = items[i]
    return Image.fromarray(img, 'L' if kind == 'idx' else 'RGBA'), rects


def webp(img):
    # palette-index sheets must stay exact (lossless); effect sheets are soft colour, so lossy is fine
    b = io.BytesIO()
    if img.mode == 'L': img.convert('RGB').save(b, 'WEBP', lossless=True, quality=100, method=6)
    else: img.save(b, 'WEBP', quality=82, alpha_quality=85, method=6)
    return b.getvalue()


def pack_data(P, styles, info):
    idx = [i for i, s in enumerate(P.spr) if s[0] == 'idx']
    col = [i for i, s in enumerate(P.spr) if s[0] == 'rgba']
    simg, srects = sheet([P.spr[i][1] for i in idx], 'idx') if idx else (None, [])
    cimg, crects = sheet([P.spr[i][1] for i in col], 'rgba') if col else (None, [])
    spr = [None] * len(P.spr)
    for i, r in zip(idx, srects): spr[i] = [0, *r, 1]
    for i, r in zip(col, crects): spr[i] = [1, *r, P.spr[i][4]]
    # palettes: palette 0 is the character's own look (used by each Moon style's home Element); every Element also gets
    # the palette whose dominant colour is nearest its hue
    pal, usedp = {'home': 0}, {0}
    for el in ['Fire', 'Water', 'Wind', 'Imaginary', 'Ether']:
        cand = [i for i in info if i not in usedp] or list(info) or [0]
        if el == 'Ether': best = max(cand, key=lambda i: info.get(i, (0, 0, 0))[2] - info.get(i, (0, 0, 0))[1] * .6)
        else: best = min(cand, key=lambda i: min(abs(info.get(i, (0,))[0] - EL_HUE[el]), 360 - abs(info.get(i, (0,))[0] - EL_HUE[el])) - info.get(i, (0, 0))[1] * 20)
        pal[el] = best; usedp.add(best)
    pals = {el: base64.b64encode(rgba(P.pals[min(i, len(P.pals) - 1)]).tobytes()).decode() for el, i in pal.items()}
    data = {'spr': spr, 'fx': P.fx, 'st': styles, 'pal': pals, 'palNo': pal, 'snd': P.snd}
    imgs = {}
    if simg is not None: imgs['idx'] = 'data:image/webp;base64,' + base64.b64encode(webp(simg)).decode()
    if cimg is not None: imgs['col'] = 'data:image/webp;base64,' + base64.b64encode(webp(cimg)).decode()
    data['img'] = imgs
    return data, (simg.size if simg else None), (cimg.size if cimg else None)


def write(P, styles, info, partner):
    data, a, b = pack_data(P, styles, info)
    if partner:
        P2, st2, info2 = partner
        data['partner'], _, _ = pack_data(P2, st2, info2)
        data['partner']['x'] = PARTNER_X
    os.makedirs(OUT, exist_ok=True)
    js = 'MBSPR[%s] = %s;\n' % (json.dumps(P.key), json.dumps(data, separators=(',', ':')))
    with open(os.path.join(OUT, P.key + '.js'), 'w', encoding='utf-8') as fh: fh.write(js)
    return len(js), a, b


if __name__ == '__main__':
    D = Data()
    skills = json.load(open(os.path.join(ROOT, 'tools', 'skills.json'), encoding='utf-8'))
    keys = sys.argv[1:] or list(CHAR_FILE)
    used = json.load(open(USED, encoding='utf-8')) if os.path.exists(USED) else {}
    total = 0
    for key in keys:
        P, styles, info, partner = build(D, key, skills.get(key, {}), used)
        n, a, b = write(P, styles, info, partner)
        total += n
        print('%-14s %4d sprites %3d fx %3d sounds %7.1f KB  idx %s col %s%s' % (key, len(P.spr), len(P.fx), len(P.snd), n / 1024, a, b,
              '  + partner %d sprites' % len(partner[0].spr) if partner else ''), flush=True)
        json.dump(dict(sorted(used.items())), open(USED, 'w', encoding='utf-8'), indent=0)
    print('total %.1f MB, %d sound files listed' % (total / 2**20, len(used)))

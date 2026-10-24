"""Contact sheets of MBAACC moves as the game plays them (the body plus the effects it spawns), to check the
extraction and playback rules: python tools/preview.py akiha 0 114 [out.png]"""
import sys, os
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(__file__))
from mbaacc import Data, CG, read_pal, rgba, load_style


WHIFF = ('スカ', '失敗', '空振', '外れ')
REL = 4   # frame flag: the jump is relative (to this frame for loops, to this sequence for "end")


def jump_frame(f, i): return i + f['jump'] if f['aflag'] & REL else f['jump']
def jump_seq(f, sid): return sid + f['jump'] if f['aflag'] & REL else f['jump']


def frames_of(seqs, sid, budget=2):
    """(sequence, frame) order for a one-shot play. Backward loops repeat up to `budget` times; an "end" frame
    finishes the move when it returns to a basic state, is skipped when it leads to a whiff/failure branch (the hit
    branch follows it), and otherwise chains into the sequence it names (Arc Drive select -> Arc Drive)."""
    out, seen, guard = [], {sid}, 0
    i, loops = 0, {}
    while guard < 900 and sid in seqs:
        fr = seqs[sid]['frames']
        if not 0 <= i < len(fr): break
        guard += 1
        f = fr[i]; out.append((sid, i))
        if f['ani'] == 2 and 0 <= jump_frame(f, i) <= i and loops.get((sid, i), 0) < budget:
            loops[(sid, i)] = loops.get((sid, i), 0) + 1; i = jump_frame(f, i); continue
        if f['ani'] == 0 and i < len(fr) - 1 or f['ani'] == 0 and f['jump']:
            j = jump_seq(f, sid)
            name = seqs.get(j, {}).get('name', '')
            if any(w in name for w in WHIFF): i += 1; continue
            if j < 35 or j in seen or j not in seqs: break
            seen.add(j); sid, i = j, 0; continue
        i += 1
    return out


class Actor:
    def __init__(self, seqs, sid, x, y, face, depth=0):
        self.seqs, self.sid, self.x, self.y, self.face, self.depth = seqs, sid, x, y, face, depth
        self.order = frames_of(seqs, sid) if sid in seqs else []
        self.life = 0
        self.k, self.t, self.vx, self.vy, self.ax, self.ay = 0, 0, 0, 0, 0, 0
        self.done = not self.order
        self.enter()

    @property
    def frame(self):
        s, i = self.order[self.k]; return self.seqs[s]['frames'][i]

    def enter(self):
        if self.done: return
        f = self.frame
        if f['move']:
            fl, sx, sy, axx, ayy = f['move']
            if fl & 1: self.vx = sx
            if fl & 2: self.vx += sx
            if fl & 0x10: self.vy = sy
            if fl & 0x20: self.vy += sy
            if fl & 1 or fl & 2: self.ax = axx
            if fl & 0x10 or fl & 0x20: self.ay = ayy

    def tick(self, world):
        if self.done: return
        f = self.frame
        if self.t == 0:
            for (tp, no, pr) in f.get('ef', []):
                if tp == 1 and no in self.seqs and self.depth < 3:
                    px = (pr[0] if len(pr) > 0 else 0); py = (pr[1] if len(pr) > 1 else 0)
                    world.append(Actor(self.seqs, no, self.x + px * self.face, self.y + py, self.face, self.depth + 1))
        self.x += self.vx / 100 * self.face; self.y += self.vy / 100
        self.vx += self.ax / 100; self.vy += self.ay / 100
        self.t += 1; self.life += 1
        if self.depth and self.life > 150: self.done = True; return
        if self.t >= max(1, f['dur']):
            self.t = 0; self.k += 1
            if self.k >= len(self.order): self.done = True
            else: self.enter()


def render(cg, pal, actors, W=420, H=300, ox=140, oy=250):
    img = Image.new('RGBA', (W, H), (36, 28, 48, 255))
    base = np.array(img).astype(np.float32)
    P = rgba(pal)
    for a in actors:
        if a.done: continue
        f = a.frame
        if f['spr'] < 0 or f['pat']: continue
        r = cg.pixels(f['spr'])
        if not r: continue
        kind, px, x1, y1 = r
        rgb = P[px] if kind == 'idx' else px
        im = Image.fromarray(rgb, 'RGBA')
        if f['scale'] and f['scale'] != (1.0, 1.0):
            sx, sy = f['scale']; im = im.resize((max(1, int(im.width * abs(sx))), max(1, int(im.height * abs(sy)))))
        else: sx, sy = 1, 1
        X = x1 + f['ox'] - 128; Y = y1 + f['oy'] - 224
        X *= sx; Y *= sy
        if a.face < 0: im = im.transpose(Image.FLIP_LEFT_RIGHT); X = -X - im.width
        X = int(ox + a.x + X); Y = int(oy + a.y + Y)
        src = np.array(im).astype(np.float32)
        x0, y0 = max(0, X), max(0, Y); x1_, y1_ = min(W, X + im.width), min(H, Y + im.height)
        if x1_ <= x0 or y1_ <= y0: continue
        s = src[y0 - Y:y1_ - Y, x0 - X:x1_ - X]
        al = s[..., 3:4] / 255 * (f['alpha'] / 255 if f['blend'] else 1)
        d = base[y0:y1_, x0:x1_]
        if f['blend'] == 2: d[..., :3] = np.minimum(255, d[..., :3] + s[..., :3] * al)
        elif f['blend'] == 3: d[..., :3] = np.maximum(0, d[..., :3] - s[..., :3] * al)
        else: d[..., :3] = d[..., :3] * (1 - al) + s[..., :3] * al
    return Image.fromarray(base.clip(0, 255).astype(np.uint8), 'RGBA')


def sheet(D, char, style, sid, out, step=4, cols=8, pal=0):
    seqs, files = load_style(D, char, style)
    cg = CG(D.read(files['cg'][0]))
    pals = read_pal(D.read('data/%s.pal' % char)) if D.has('data/%s.pal' % char) else [cg.palette]
    world = [Actor(seqs, sid, 0, 0, 1)]
    shots, t = [], 0
    while any(not a.done for a in world) and t < 60 * 8:
        if t % step == 0: shots.append(render(cg, pals[pal], world))
        for a in list(world): a.tick(world)
        t += 1
    rows = (len(shots) + cols - 1) // cols
    W, H = shots[0].size
    S = Image.new('RGBA', (W * cols // 2, H * rows // 2), (0, 0, 0, 255))
    for i, s in enumerate(shots): S.paste(s.resize((W // 2, H // 2)), ((i % cols) * W // 2, (i // cols) * H // 2))
    S.save(out)
    return len(shots), t


if __name__ == '__main__':
    char, style, sid = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
    out = sys.argv[4] if len(sys.argv) > 4 else '%s_%d_%d.png' % (char, style, sid)
    print(sheet(Data(), char, style, sid, out))

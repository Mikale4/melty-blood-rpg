"""Readers for Melty Blood Actress Again Current Code's data (the owner's own install, C:\\Games\\MBAACC by default).

  Pak   the 000N.p archives ("FilePacHeaderA"): an XOR-encrypted table of directories and files, and files whose
        first `chunk` bytes are XOR-encrypted. Keystream: the archive key's bytes, each byte rising by `step` every
        4 bytes (names use the entry's size & 0xff as the step, or 1 when that is 0).
  CG    "BMP Cutter3" sprite sheets: 8bpp images stored as 16x16 cells on 256x256 pages, assembled per image from
        alignment records (ported from Hantei-chan's cg.cpp, github.com/Raijinili/Hantei-chan).
  PAL   palette sets (palette 0 is the default colour).
  HA6   "Hantei6DataFile" frame data: sequences of frames (sprite id, offset, duration, loop/jump, blend, scale,
        rotation). A character is its base .HA6 patched by the per-Moon-style files listed in data/<char>_<n>.txt.

Sprite placement: an image's top-left sits at (bounds_x1 + AF.offset_x - 128, bounds_y1 + AF.offset_y - 224) from the
character's origin (the feet), before the frame's scale and rotation.
"""
import os, struct
import numpy as np

MBAACC = os.environ.get('MBAACC', r'C:\Games\MBAACC')
BS = chr(92)


def _ks(key, step, n):
    kb = np.frombuffer(struct.pack('<I', key), np.uint8).astype(np.int64)
    j = np.arange(n)
    return ((kb[j % 4] + (j // 4) * step) & 0xff).astype(np.uint8)


def _xor(data, key, step):
    a = np.frombuffer(data, np.uint8)
    return (a ^ _ks(key, step, len(a))).tobytes()


class Pak:
    def __init__(self, fn):
        self.fn = fn
        with open(fn, 'rb') as f:
            h = f.read(0x34)
            if h[:14] != b'FilePacHeaderA':
                raise ValueError(fn + ': not a FilePacHeaderA archive')
            _, self.key, self.tsize, _, ndir, nfile, _, self.step, self.chunk = struct.unpack_from('<9I', h, 0x10)
            f.seek(0)
            t = f.read(self.tsize)
        p, dirs, self.files = 0x34, [], {}
        for _ in range(ndir):
            first, idx, size = struct.unpack_from('<3I', t, p)
            name = _xor(t[p + 12:p + 268], self.key, (size & 0xff) or 1).split(b'\0')[0].decode('cp932')
            dirs.append(name.lstrip('.').lstrip(BS).replace(BS, '/')); p += 268
        for _ in range(nfile):
            off, d, size = struct.unpack_from('<3I', t, p)
            name = _xor(t[p + 12:p + 44], self.key, (size & 0xff) or 1).split(b'\0')[0].decode('cp932')
            path = (dirs[d] + '/' if dirs[d] else '') + name
            self.files[path.lower()] = (path, off, size); p += 44

    def read(self, path):
        _, off, size = self.files[path.lower()]
        with open(self.fn, 'rb') as f:
            f.seek(self.tsize + off)
            c = f.read(size)
        n = min(size, self.chunk)
        return _xor(c[:n], self.key, self.step) + c[n:]


class Data:
    """Every archive of the install, looked up by path (case-insensitive)."""
    def __init__(self, root=MBAACC):
        self.paks = [Pak(os.path.join(root, f)) for f in sorted(os.listdir(root)) if f.lower().endswith('.p')]
        # later archives override earlier ones (0008.p is the last patch)
        self.index = {}
        for pk in self.paks:
            for k in pk.files: self.index[k] = pk

    def has(self, path): return path.lower() in self.index
    def read(self, path): return self.index[path.lower()].read(path)
    def list(self, prefix=''):
        prefix = prefix.lower()
        return sorted(self.index[k].files[k][0] for k in self.index if k.startswith(prefix))


# ---------------------------------------------------------------- palettes

def _fix_pal(p):
    p = np.array(p, np.uint32)
    a = np.where((p >> 24) != 0, 0xff, 0).astype(np.uint32)
    p = (p & 0xffffff) | (a << 24)
    p[0] = 0
    return p


def read_pal(data):
    d = np.frombuffer(data, np.uint32)
    n = int(d[0])
    off = 1
    if n * 256 + 1 > len(d):
        n, off = int(d[3]), 4
    return [_fix_pal(d[off + i * 256: off + (i + 1) * 256]) for i in range(n)]


def rgba(pal):
    """uint32 palette (R in the low byte) -> (256, 4) uint8."""
    return pal.view(np.uint8).reshape(256, 4)


# ---------------------------------------------------------------- CG sprite sheets

class CG:
    def __init__(self, data):
        if data[:11] != b'BMP Cutter3':
            raise ValueError('not a BMP Cutter3 file')
        self.data = data
        d = np.frombuffer(data, np.uint32, offset=0x14, count=(len(data) - 0x14) // 4)
        self.palette = _fix_pal(d[:256])
        h = d[0x800:]
        self.page_count = int(h[0]) + 1
        self.nalign = int(h[2])
        self.nimages = int(h[3])
        self.indices = h[12:12 + 3001]
        self.align_off = int(self.indices[3000])
        self.pages = {}            # (page, cell) -> (start, rowwidth, offset)
        self._build()

    def image(self, n):
        if n < 0 or n >= self.nimages: return None
        idx = int(self.indices[n])
        if idx == 0 or idx + 72 > len(self.data): return None
        name = self.data[idx:idx + 32].split(b'\0')[0].decode('cp932', 'replace')
        type_id, w, h, bpp, x1, y1, x2, y2, a0, alen = struct.unpack_from('<i3I4i2I', self.data, idx + 32)
        return dict(name=name, type=type_id, bpp=bpp, x1=x1, y1=y1, x2=x2, y2=y2, a0=a0, alen=alen, data=idx + 72)

    def _align(self, i):
        return struct.unpack_from('<4i4h', self.data, self.align_off + i * 24)

    def _build(self):
        for n in range(min(self.nimages, 3000)):
            im = self.image(n)
            if not im or im['type'] == -1 or im['a0'] + im['alen'] > self.nalign: continue
            addr = im['data']
            if im['bpp'] == 32:
                if im['type'] == 3: addr += 4
                elif im['type'] in (2, 4): addr += 1024
            for j in range(im['alen']):
                x, y, aw, ah, sx, sy, simg, copy = self._align(im['a0'] + j)
                if copy != 0: continue
                w, h, cx, cy = aw // 16, ah // 16, sx // 16, sy // 16
                if cx + w >= 16: w = 16 - cx
                if cy + h >= 16: h = 16 - cy
                mult = 4 if im['type'] == 1 else 1
                for a in range(h):
                    for b in range(w):
                        self.pages[(simg, (cy + a) * 16 + cx + b)] = (addr, aw, b * 16 + (a * aw * 16) * mult)
                addr += aw * ah * (4 if im['type'] == 1 else 2 if im['type'] == 4 else 1)

    def pixels(self, n):
        """Image n as (kind, pixels, x1, y1) or None.
        kind 'idx': HxW uint8 indices into the character palette (type 0, 8bpp; recolourable).
        kind 'rgba': HxWx4 uint8 (32bpp effect images: 1 = BGRA, 2 = own palette, 3 = one colour with an alpha ramp,
        4 = own palette plus an alpha plane)."""
        im = self.image(n)
        if not im or im['type'] == -1 or im['a0'] + im['alen'] > self.nalign: return None
        x1, y1 = im['x1'], im['y1']
        W, H = im['x2'] - x1 + 1, im['y2'] - y1 + 1
        if W <= 0 or H <= 0: return None
        t, buf = im['type'], self.data
        indexed = im['bpp'] <= 8
        if indexed: out = np.zeros((H, W), np.uint8)
        else: out = np.zeros((H, W, 4), np.uint8)
        pal = None
        if not indexed:
            if t == 3:
                c = struct.unpack_from('<I', buf, im['data'])[0] & 0xffffff
                pal = np.array([0] + [(i << 24) | c for i in range(1, 256)], np.uint32)
            elif t in (2, 4):
                pal = np.frombuffer(buf, np.uint32, 256, im['data']) | np.uint32(0xff000000)
            else:
                pal = self.palette
            pal8 = pal.view(np.uint8).reshape(256, 4)
        for j in range(im['alen']):
            x, y, aw, ah, sx, sy, simg, copy = self._align(im['a0'] + j)
            w, h, cx, cy = aw // 16, ah // 16, sx // 16, sy // 16
            for a in range(h):
                for b in range(w):
                    cell = self.pages.get((simg, (cy + a) * 16 + cx + b))
                    if not cell: continue
                    start, rw, off = cell
                    dx, dy = x + b * 16 - x1, y + a * 16 - y1
                    ex, ey = min(16, W - dx), min(16, H - dy)
                    if ex <= 0 or ey <= 0 or dx < 0 or dy < 0: continue
                    if t == 1 and not indexed:
                        tile = np.frombuffer(buf, np.uint32, 15 * rw + 16, start + off)
                        tile = np.lib.stride_tricks.as_strided(tile, (16, 16), (rw * 4, 4))[:ey, :ex]
                        v = tile.view(np.uint8).reshape(ey, ex, 4)
                        out[dy:dy + ey, dx:dx + ex] = v[..., [2, 1, 0, 3]]
                        continue
                    tile = np.frombuffer(buf, np.uint8, 15 * rw + 16, start + off)
                    tile = np.lib.stride_tricks.as_strided(tile, (16, 16), (rw, 1))[:ey, :ex]
                    if indexed:
                        out[dy:dy + ey, dx:dx + ex] = tile
                    else:
                        px = pal8[tile]
                        if t == 4:
                            al = np.frombuffer(buf, np.uint8, 15 * rw + 16, start + off + aw * ah)
                            al = np.lib.stride_tricks.as_strided(al, (16, 16), (rw, 1))[:ey, :ex]
                            px = px.copy(); px[..., 3] = al
                        out[dy:dy + ey, dx:dx + ex] = px
        return ('idx' if indexed else 'rgba'), out, x1, y1


# ---------------------------------------------------------------- HA6 frame data

class _R:
    """Little-endian reader over byte offsets (HA6 strings can leave it unaligned, as in the game's own reader)."""
    def __init__(self, data, pos): self.d, self.p, self.n = data, pos, len(data)
    def more(self): return self.p + 4 <= self.n
    def tag(self): t = self.d[self.p:self.p + 4]; self.p += 4; return t
    def peek(self): return self.d[self.p:self.p + 4]
    def u(self): v = struct.unpack_from('<I', self.d, self.p)[0]; self.p += 4; return v
    def i(self): v = struct.unpack_from('<i', self.d, self.p)[0]; self.p += 4; return v
    def f(self): v = struct.unpack_from('<f', self.d, self.p)[0]; self.p += 4; return v
    def skip(self, words): self.p += 4 * words
    def bytes(self, n): v = self.d[self.p:self.p + n]; self.p += n; return v


def _frame(r):
    fr = dict(spr=-1, pat=0, ox=0, oy=0, dur=1, ani=0, aflag=0, jump=0, blend=0, alpha=255,
              rgb=None, scale=None, rot=None, lc=0, le=0, hit=False, move=None)
    while r.more():
        t = r.tag()
        if t in (b'HRNM', b'HRAT'): r.skip(5)
        elif t in (b'HRNS', b'HRAS'): r.skip(2)
        elif t == b'ATST':
            fr['hit'] = True
            while r.more():
                t = r.tag()
                if t == b'ATED': break
                if t in (b'ATGD', b'ATHS', b'ATHT', b'ATF1', b'ATKK', b'ATNG', b'ATUH', b'ATBT', b'ATSN', b'ATSU', b'ATSP', b'ATGN'): r.skip(1)
                elif t == b'ATVV': r.skip(2)
                elif t == b'ATHE': fr['hitfx'] = (r.i(), r.i())
                elif t in (b'ATGV', b'ATHV'): r.skip(r.u())
                else: raise ValueError('AT tag %r' % t)
        elif t == b'ASST':
            while r.more():
                t = r.tag()
                if t == b'ASED': break
                if t == b'ASV0': fr['move'] = (r.u(), r.i(), r.i(), r.i(), r.i())
                elif t in (b'ASVX', b'ASS1', b'ASS2'): pass
                elif t in (b'ASMV', b'ASCN', b'ASCS', b'ASCT', b'ASMX', b'ASAA', b'ASYS', b'ASF0', b'ASF1'): r.skip(1)
                elif t == b'AST0': r.skip(7)
                else: raise ValueError('AS tag %r' % t)
        elif t == b'ASSM': r.skip(1)
        elif t == b'AFST':
            while r.more():
                t = r.tag()
                if t == b'AFED': break
                c = t[3:4]
                if t == b'AFGP': fr['pat'] = r.i(); fr['spr'] = r.i()
                elif t == b'AFGX': r.skip(3)
                elif t == b'AFOF': fr['ox'] = r.i(); fr['oy'] = r.i()
                elif t[:3] == b'AFD':
                    if c.isdigit(): fr['dur'] = int(c)
                    elif c == b'L': fr['dur'] = r.u()
                elif t[:3] == b'AFY':
                    fr['ox'] = 0
                    if c.isdigit(): v = int(c); fr['oy'] = v + 10 if v < 4 else v
                    elif c == b'X': fr['oy'] = 10
                elif t[:3] == b'AFF':
                    if c in (b'1', b'2'): fr['ani'] = int(c)
                    elif c == b'E': fr['aflag'] = r.u()
                elif t == b'AFAL': fr['blend'] = r.u(); fr['alpha'] = r.u()
                elif t == b'AFRG': fr['rgb'] = (r.u(), r.u(), r.u())
                elif t in (b'AFAZ', b'AFAY', b'AFAX'):
                    rot = list(fr['rot'] or (0.0, 0.0, 0.0)); rot[b'XYZ'.index(c)] = r.f(); fr['rot'] = tuple(rot)
                elif t == b'AFZM': fr['scale'] = (r.f(), r.f())
                elif t == b'AFJP': fr['jump'] = r.i()
                elif t in (b'AFHK', b'AFPR', b'AFJC', b'AFRT'): r.skip(1)
                elif t == b'AFCT': fr['lc'] = r.u()
                elif t == b'AFLP': fr['le'] = r.u()
                elif t == b'AFTN': r.skip(2)
                else: raise ValueError('AF tag %r' % t)
        elif t in (b'EFST', b'IFST'):
            end = b'EFED' if t == b'EFST' else b'IFED'; r.skip(1)
            ef = [0, 0, []]
            while r.more():
                t = r.tag()
                if t == end: break
                if t in (b'EFTP', b'IFTP'): ef[0] = r.i()
                elif t == b'EFNO': ef[1] = r.i()
                elif t in (b'EFPR', b'IFPR'): ef[2] = [r.i() for _ in range(r.u())]
                else: raise ValueError('EF/IF tag %r' % t)
            if end == b'EFED': fr.setdefault('ef', []).append(tuple(ef[:2]) + (ef[2],))
        elif t in (b'FSNA', b'FSNH', b'FSNE', b'FSNI'): r.skip(1)
        elif t == b'FEND': break
        else: raise ValueError('frame tag %r at %d' % (t, r.p))
    return fr


def read_ha6(data, seqs=None):
    """Parse a Hantei6DataFile, patching `seqs` (dict id -> sequence) in place. Returns the dict."""
    if data[:15] != b'Hantei6DataFile':
        raise ValueError('not a Hantei6DataFile')
    seqs = {} if seqs is None else seqs
    r = _R(data, 0x20)
    if r.tag() != b'_STR': raise ValueError('no _STR')
    r.skip(1)
    while r.more():
        t = r.tag()
        if t == b'_END': break
        if t != b'PSTR': continue
        sid = r.u()
        if r.peek() == b'PEND': r.skip(1); continue
        # Like the game, a patch only replaces a sequence that has a PDS2 allocation (a bare title keeps the old frames).
        head, frames = dict(id=sid, name='', psts=0, level=0), None
        while r.more():
            t = r.tag()
            if t == b'PTCN': n = r.u(); r.bytes(n)
            elif t == b'PSTS': head['psts'] = r.u()
            elif t == b'PLVL': head['level'] = r.u()
            elif t in (b'PFLG', b'PDST'): r.skip(1)
            elif t == b'PTT2':
                n = r.u(); head['name'] = r.bytes(n).split(b'\0')[0].decode('cp932', 'replace')
            elif t == b'PTIT': head['name'] = r.bytes(32).split(b'\0')[0].decode('cp932', 'replace')
            elif t == b'PDS2': n = r.u(); r.bytes(n); frames = []
            elif t == b'FSTR':
                fr = _frame(r)
                if frames is not None: frames.append(fr)
            elif t == b'PEND': break
            else: raise ValueError('pattern tag %r at %d' % (t, r.p))
        if frames is not None: seqs[sid] = dict(head, frames=frames)
    return seqs


def char_files(D, proj):
    """HA6 files and the CG for a project text file such as 'akiha_0' (data/akiha_0.txt)."""
    txt = D.read('data/%s.txt' % proj).decode('cp932', 'replace')
    sec, out = None, {'ha6': [], 'cg': [], 'pat': []}
    for line in txt.splitlines():
        line = line.strip()
        if line.startswith('['): sec = line.strip('[]').lower(); continue
        if '=' in line:
            k, v = [s.strip() for s in line.split('=', 1)]
            if k.lower().startswith('file') and k.lower() != 'filenum':
                key = {'datafile': 'ha6', 'bmpcutfile': 'cg', 'panifile': 'pat'}.get(sec)
                if key: out[key].append('data/' + v)
    return out


def load_style(D, char, style):
    """Sequences of `char` in Moon style 0/1/2 (Crescent/Half/Full), patched in the game's order."""
    files = char_files(D, '%s_%d' % (char, style))
    seqs = {}
    for f in files['ha6']:
        if D.has(f): read_ha6(D.read(f), seqs)
    return seqs, files

"""Menu and battle art from the owner's MBAACC install: python tools/art.py -> sprites/_art.js

  full   character-select art (grp/c_sel_AA/Chara/csel_cNN.png), trimmed
  head   a square head crop of that art (automatic; HEAD lists hand-picked centres where an arm or weapon is on top)
  cut    Arc Drive cut-ins (grp/cut/cut_NNxx.png), one per Moon style where the game has several
NN is the character's number in MBAACC's charaselect table.
"""
import sys, os, io, json, base64
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(__file__))
from mbaacc import Data

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CHARA_NO = {'sion': 0, 'arcueid': 1, 'ciel': 2, 'akiha': 3, 'hisui': 5, 'kohaku': 6, 'shiki': 7, 'miyako': 8, 'wallachia': 9,
            'chaos': 10, 'sion-tatari': 11, 'red-arcueid': 12, 'red-akiha': 13, 'mech-hisui': 14, 'nanaya': 15, 'satsuki': 17,
            'len': 18, 'powered-ciel': 19, 'neco-arc': 20, 'aoko': 22, 'white-len': 23, 'neco-chaos': 25, 'kouma': 28,
            'riesbyfe': 30, 'roa': 31, 'ryougi': 33, 'seifuku-akiha': 29, 'kohaku-mech': 35, 'archetype': 51}
# head centre and crop size in csel pixels, where the automatic crop lands on an arm, weapon or hat
HEAD = {'ciel': (236, 134, 84), 'chaos': (243, 88, 84), 'len': (222, 182, 76), 'neco-arc': (258, 300, 96), 'aoko': (240, 126, 84),
        'white-len': (210, 198, 76), 'neco-chaos': (213, 300, 96), 'kouma': (200, 118, 80), 'red-arcueid': (210, 130, 80),
        'kohaku-mech': (236, 166, 84)}


def b64(img, q=86):
    b = io.BytesIO(); img.save(b, 'WEBP', quality=q, alpha_quality=90, method=6)
    return 'data:image/webp;base64,' + base64.b64encode(b.getvalue()).decode()


def head(im, key):
    a = np.array(im)[..., 3] > 40
    if key in HEAD:
        cx, cy, s = HEAD[key]; x0, y0 = cx - s // 2, cy - s // 2
    else:
        ys, xs = np.nonzero(a); top, bot = ys.min(), ys.max(); H = bot - top
        cx = int(np.median(np.nonzero(a[top:top + int(H * .12)])[1])); s = int(H * .2)
        x0, y0 = cx - s // 2, top - int(s * .08)
    return im.crop((x0, y0, x0 + s, y0 + s)).resize((128, 128), Image.LANCZOS)


def trim(im):
    bb = im.getbbox(); return im.crop(bb) if bb else im


if __name__ == '__main__':
    D = Data()
    out = {'chars': {}}
    for key, no in CHARA_NO.items():
        im = Image.open(io.BytesIO(D.read('grp/c_sel_AA/Chara/csel_c%02d.png' % no))).convert('RGBA')
        full = trim(im)
        cuts = [Image.open(io.BytesIO(D.read(p))).convert('RGBA') for p in D.list('grp/cut/cut_%02d' % no) if p.lower().endswith('.png')]
        # Crescent and Full lead with the second cut-in where there is one (Last Arc / Another Arc Drive art), Half with the first
        order = {'c': cuts[1 % len(cuts)], 'h': cuts[0], 'f': cuts[min(2, len(cuts) - 1)] if len(cuts) > 2 else cuts[1 % len(cuts)]} if cuts else {}
        out['chars'][key] = {'full': b64(full), 'head': b64(head(im, key)), 'cut': {k: b64(trim(v), 82) for k, v in order.items()},
                             'aspect': round(full.width / full.height, 3)}
        print(key, full.size, len(cuts), 'cut-ins')
    js = 'const MBART = %s;\n' % json.dumps(out, separators=(',', ':'))
    os.makedirs(os.path.join(ROOT, 'sprites'), exist_ok=True)
    open(os.path.join(ROOT, 'sprites', '_art.js'), 'w', encoding='utf-8').write(js)
    print('%.1f MB' % (len(js) / 2**20))

"""MBAACC music, voices and sound effects for the game: python tools/audio.py

  audio/vo/*.mp3, audio/se/*.mp3   every voice line and effect sound the sprite packs cue (tools/audio_used.json,
                                   written by tools/extract.py), mono 22 kHz
  audio/bgm/*.mp3                  the tracks in BGM below, with their loop points from Bgm/bgm.txt
  sprites/_bgm.js                  MBBGM: track key -> file and loop point, embedded by build.sh

The game plays these with <audio> elements from the audio/ folder next to the HTML (they work from file:// too);
without the folder it falls back to its synthesized sounds. Needs ffmpeg on PATH.
"""
import sys, os, re, json, subprocess, tempfile
sys.path.insert(0, os.path.dirname(__file__))
from mbaacc import Data

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'audio')
# game music key -> MBAACC track (titles from Bgm/bgm.txt)
BGM = {
    'title': 'bgmme18',      # Beat from "Melty Blood"
    'home': 'bgmme53',       # WABI-SABI Brand new Everyday
    'tatari': 'bgmme99',     # Actor's Anteroom (character select)
    'menu': 'bgmme86',       # Vain Surface (options)
    'talk': 'bgmme72',       # Very Slow Life
    'tense': 'bgmme74',      # Unprecedented
    'sad': 'bgmme73',        # Recollection
    'bright': 'bgmme71',     # Beginning!
    'resolve': 'bgmme75',    # Ambition
    'misaki': 'bgmme28',     # Modernism Street
    'city': 'bgmme42',       # Rhythmical Bustle
    'park': 'bgmme08',       # Midnight Raider
    'mansion': 'bgmme02',    # Elegant Summer
    'alley': 'bgmme10',      # The theme of Arcueid
    'school': 'bgmme20',     # Wonderful boy
    'atlas': 'bgmme40',      # Dimension Theory
    'ruins': 'bgmme27',      # Obscure Zone
    'forest': 'bgmme26',     # Blood heat!
    'arena': 'bgmme34',      # World End Roar
    'battle': 'bgmme01',     # Encount
    'boss': 'bgmme50',       # Nightmare Teller
    'wallachia': 'bgmme07',  # for Crimson Air
    'win': 'bgmme98',        # Cinch!
    'lose': 'bgmme83',       # Break Down
}


def ffmpeg(src_bytes, ext, dst, args):
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as fh:
        fh.write(src_bytes); tmp = fh.name
    try:
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', tmp] + args + [dst], check=True)
    finally:
        os.remove(tmp)


def loop_points(D):
    txt = D.read('Bgm/bgm.txt').decode('cp932', 'replace')
    out = {}
    for block in re.split(r'\n\s*\[BGM_\d+\]', txt)[1:]:
        f = re.search(r'^\s*File\s*=\s*(\w+)', block, re.M)
        if not f or f.group(1) in out: continue
        lp = re.search(r'^\s*LoopPos\s*=\s*([\d.]+)', block, re.M)
        il = re.search(r'^\s*IsLoop\s*=\s*(\d)', block, re.M)
        out[f.group(1)] = float(lp.group(1)) if (lp and il and il.group(1) == '1') else -1
    return out


if __name__ == '__main__':
    D = Data()
    used = json.load(open(os.path.join(ROOT, 'tools', 'audio_used.json'), encoding='utf-8'))
    n = 0
    for name, src in sorted(used.items()):
        dst = os.path.join(OUT, name + '.mp3')
        if os.path.exists(dst): continue
        ffmpeg(D.read(src), os.path.splitext(src)[1], dst, ['-ac', '1', '-ar', '22050', '-b:a', '48k'])
        n += 1
    print(n, 'voices and sounds converted,', len(used), 'listed')
    loops = loop_points(D)
    table = {}
    for key, f in BGM.items():
        dst = os.path.join(OUT, 'bgm', f + '.mp3')
        if not os.path.exists(dst):
            ffmpeg(D.read('Bgm/%s.ogg' % f), '.ogg', dst, ['-ac', '2', '-ar', '44100', '-b:a', '112k'])
        table[key] = {'f': f, 'loop': loops.get(f, -1)}
    js = '// MBAACC music (tools/audio.py): key -> track in audio/bgm and its loop point in seconds (-1 = plays once)\nconst MBBGM = %s;\n' % json.dumps(table, separators=(',', ':'))
    open(os.path.join(ROOT, 'sprites', '_bgm.js'), 'w', encoding='utf-8').write(js)
    size = sum(os.path.getsize(os.path.join(dp, f)) for dp, _, fs in os.walk(OUT) for f in fs)
    print(len(table), 'music keys; audio/ is %.1f MB' % (size / 2**20))

"""Move lists: the English command list (grp/Command/com_txt/_cl_<char>_<style>.txt) joined with the command table
(data/<char>_<style>_c.txt), so a move name resolves to the sequence the game plays for it."""
import re

# game character key -> MBAACC file prefix (Saber, Noel and Vlov are not in Actress Again)
CHAR_FILE = {
    'shiki': 'shiki', 'nanaya': 'nanaya', 'arcueid': 'arc', 'red-arcueid': 'warc', 'ciel': 'ciel', 'powered-ciel': 'p_ciel',
    'akiha': 'akiha', 'red-akiha': 'akaakiha', 'hisui': 'hisui', 'kohaku': 'kohaku', 'mech-hisui': 'm_hisui',
    'satsuki': 'satsuki', 'sion': 'sion', 'sion-tatari': 'v_sion', 'riesbyfe': 'ries', 'aoko': 'aoko', 'chaos': 'nero',
    'roa': 'roa', 'wallachia': 'warakia', 'len': 'len', 'white-len': 'wlen', 'miyako': 'miyako', 'kouma': 'kishima',
    'neco-arc': 'neco', 'neco-chaos': 'nechaos', 'ryougi': 'ryougi',
    # Actress Again's own additions
    'archetype': 'p_arc', 'seifuku-akiha': 's_akiha', 'kohaku-mech': 'kohaku_m',
}
# tag teams: the partner fighter's file (it stands behind and takes over moves the main character cues)
PARTNER = {'kohaku-mech': 'm_hisui_p'}
# command lists filed under another name than the character's data
MOVELIST_FILE = {'kohaku_m': 'mech_and_kohaku'}
STYLES = {'Crescent': 0, 'Half': 1, 'Full': 2}


def _ini(text):
    secs, cur = [], None
    for line in text.splitlines():
        line = line.split('//')[0].strip()
        if not line: continue
        if line.startswith('[') and line.endswith(']'):
            cur = {'_': line[1:-1]}; secs.append(cur); continue
        if cur is not None and '=' in line:
            k, v = [s.strip() for s in line.split('=', 1)]
            cur.setdefault(k.lower(), []).append(v)
    return secs


def movelist(D, f, style):
    p = 'grp/Command/com_txt/_cl_%s_%d.txt' % (MOVELIST_FILE.get(f, f), style)
    if not D.has(p): return []
    out = []
    for s in _ini(D.read(p).decode('cp932', 'replace')):
        if 'name' not in s: continue
        out.append(dict(name=s['name'][0].strip(), type=int((s.get('type') or ['0'])[0] or 0),
                        cmd=(s.get('cmd') or [''])[0].replace(' ', ''), sub=s.get('cmdsub', [])))
    return out


def cmdtable(D, f, style):
    p = 'data/%s_%d_c.txt' % (f, style)
    if not D.has(p): return []
    rows = []
    for line in D.read(p).decode('cp932', 'replace').splitlines():
        if line.strip().startswith('END'): break
        body, _, note = line.partition('//')
        cols = body.split()
        if len(cols) < 5 or not cols[0].isdigit(): continue
        try:
            rows.append(dict(cmd=cols[1], state=cols[2], anim=int(cols[4]), gauge=int(cols[5]) if len(cols) > 5 else 0, note=note.strip()))
        except ValueError:
            continue
    return rows


def expand(cmd):
    """'236AoBoC' -> ['236A', '236B', '236C']; '41236C' -> ['41236C']."""
    m = re.match(r'^([0-9]*)([A-D](?:o[A-D])*)$', cmd)
    if not m: return [cmd]
    return [m.group(1) + b for b in m.group(2).split('o')]


def norm(name):
    name = re.sub(r'\(.*?\)', '', name)
    name = name.replace(' - ', ' ').replace('-', ' ').replace(':', ' ')
    return re.sub(r'[^a-z0-9 ]', '', name.lower()).split()


def _cmd_key(c):
    # the command table writes motions with "0" separators for doubled directions (0202A == 22A)
    return c.replace('0', '')


def resolve(D, f, style, move):
    """Sequence id for a move-list entry, preferring ground versions and the right meter cost."""
    rows = cmdtable(D, f, style)
    want = {_cmd_key(c) for c in expand(move['cmd'])}
    cand = [r for r in rows if _cmd_key(r['cmd']) in want]
    if not cand: return None
    def score(r):
        ground = r['state'][-1:] == '1'
        g = r['gauge']
        cost_ok = (move['type'] >= 10 and g >= 20000) or (move['type'] == 1 and 10000 <= g < 20000) or (move['type'] == 0 and g == 0)
        return (cost_ok, ground, -r['anim'])
    return max(cand, key=score)['anim']


def _tokens(name):
    name = re.sub(r'\(blood heat\)', ' ', name, flags=re.I)
    name = re.sub(r'[()\[\]:/～~!?,.\'"…☆★]', ' ', name).replace(' - ', ' ').replace('-', ' ')
    return set(re.sub(r'[^a-z0-9 ]', '', name.lower()).split())


def last_arc(seqs):
    """The Last Arc body sequence (named ＬＡ / ラストアーク in the frame data), or None."""
    # skip the cinematic stand-ins ("ダミー"), backgrounds and helpers; prefer the move itself, then its start
    cand = [((1 if 'ラストアーク' in s['name'] else 0), (1 if '始動' in s['name'] else 0), len(s['frames']), k) for k, s in seqs.items()
            if ('ＬＡ' in s['name'] or 'ラストアーク' in s['name']) and not any(w in s['name'] for w in ('背景', '用', 'ダミー'))]
    return max(cand)[-1] if cand else None


def assign(D, f, style, skills, seqs):
    """Pick a real move for each (slot, name). Returns [(slot, name, seq, how)] where how is 'name' (the skill's name
    matched a move), or 'pick' (renamed to an unused move of the right kind)."""
    ml = [m for m in movelist(D, f, style) if not m['name'].endswith('Chain') and 'Chain ' not in m['name']]
    for m in ml:
        m['seq'] = last_arc(seqs) if m['type'] == 100 else resolve(D, f, style, m)
    ml = [m for m in ml if m['seq'] is not None and m['seq'] in seqs]
    out, used, names = [], set(), set()
    base = lambda n: ' '.join(sorted(_tokens(n)))
    for slot, name in skills:
        kinds = (10, 11, 100) if slot == 3 else (0, 1)
        pool = [m for m in ml if m['type'] in kinds]
        best, bs = None, 0
        for m in pool:
            a, b = _tokens(name), _tokens(m['name'])
            s = len(a & b) / max(1, len(a | b))
            if s > bs: bs, best = s, m
        if best and bs >= .5 and best['seq'] not in used:
            out.append((slot, best['name'], best['seq'], 'name')); used.add(best['seq']); names.add(base(best['name'])); continue
        if slot == 3:
            pref = [100, 10, 11] if style != 1 else [10, 11, 100]
            pick = next((m for t in pref for m in pool if m['type'] == t and m['seq'] not in used), None)
        else:
            free = [m for m in pool if m['seq'] not in used and base(m['name']) not in names]
            pick = next((m for m in free if m['type'] == 0), None) or (free[0] if free else None)
        if pick: out.append((slot, pick['name'], pick['seq'], 'pick')); used.add(pick['seq']); names.add(base(pick['name']))
        else: out.append((slot, name, None, 'none'))
    return out


def roster_skills(js):
    """{char key: {style: [(slot, name)]}} from src/a3a_roster.js."""
    out = {}
    for c in re.split(r'\n  \{ n: "', js)[1:]:
        k = re.search(r'k: "([^"]+)"', c).group(1); out[k] = {}
        for st in STYLES:
            m = re.search(r'\n    %s: \{(.*?)\] \}' % st, c, re.S)
            if m: out[k][st] = [(int(a), b) for a, b in re.findall(r'(?:atk|sup)\((\d), "([^"]+)"', m.group(1))]
    return out


if __name__ == '__main__':
    # python tools/moves.py [assign]: writes tools/skills.json (move -> sequence for every skill); with "assign" also
    # renames skills whose name is not in that Moon style's real move list in src/a3a_roster.js
    import sys, os, json
    sys.path.insert(0, os.path.dirname(__file__))
    from mbaacc import Data, load_style
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    rp = os.path.join(root, 'src', 'a3a_roster.js')
    js = open(rp, encoding='utf-8').read()
    D, table, renames = Data(), {}, []
    for k, styles in roster_skills(js).items():
        if k not in CHAR_FILE: continue
        f = CHAR_FILE[k]; table[k] = {}
        for st, sks in styles.items():
            seqs, _ = load_style(D, f, STYLES[st])
            res = assign(D, f, STYLES[st], sks, seqs)
            table[k][st] = {str(slot): {'name': nm, 'seq': seq} for slot, nm, seq, how in res}
            for (slot, nm, seq, how), (_, orig) in zip(res, sks):
                if nm != orig: renames.append((k, st, slot, orig, nm))
    if 'assign' in sys.argv:
        for k, st, slot, orig, nm in renames:
            a = js.index('k: "%s"' % k); b = js.index('\n    %s: {' % st, a); e = js.index('] }', b)
            blk = js[b:e]; old = '(%d, "%s"' % (slot, orig); new = '(%d, "%s"' % (slot, nm.replace('"', '\\"'))
            assert old in blk, (k, st, slot, orig)
            js = js[:b] + blk.replace(old, new, 1) + js[e:]
        open(rp, 'w', encoding='utf-8').write(js)
    json.dump(table, open(os.path.join(root, 'tools', 'skills.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    for r in renames: print('%-12s %-8s S%d  %s  ->  %s' % r)
    print(len(renames), 'renamed')

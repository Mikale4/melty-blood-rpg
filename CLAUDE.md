# Melty Blood RPG

Melty Blood as a phone-first, turn-based squad RPG: `Melty Blood RPG.html` (about 17 MB: the MBAACC sprite packs and art are
embedded) plus the `audio/` folder beside it (MBAACC music, voices and sounds; optional, the game falls back to synth sounds).
It was split out of the `C:\Games\Arknights Tactics` repo on 2026-10-05 and shares that repo's squad-battle engine (forked from its `mobile/`).
The old `melty-blood/` folder there was deleted; its history (up to commit 4e68011, branch `claude/swgoh-mobile-game-html-ajhk0t`) is still in that repo.
Game details, the terminology glossary and the test commands are in `README.md`.

## Never edit `Melty Blood RPG.html` directly
It's a build output. Edit the parts in `src/` and rebuild:

```sh
sh src/build.sh     # embeds sprites/*.js, syntax-checks, then swaps in the new HTML (and writes dist/index.html, a body-only artifact copy)
```

`src/` parts, in build order (each relies on globals from earlier ones): `a1_head.html` CSS · `a2_core.js` markup, utils, icons, items, statuses ·
`a3a_roster.js` characters, kits and figures (`CHARS`) · `a3b_kits.js` class tables, `ELEMENT_KIT`, enemies · `a4_story.js` Night of Rumors ·
`a5_art.js` figure renderer, `opArt`/`enemyArt` (MBAACC art when a character has it) · `a5b_sprites.js` MBAACC sprite player ·
`a6_state.js` save, progression, Tatari · `a7_engine.js` battle rules · `a8a_render.js` camera and drawing ·
`a8c_sfx.js` sound: MBAACC clips (`clip`), music (`music`, `screenMusic`, `battleMusic`), synth fallback · `a8b_battle.js` battle director and HUD · `a9a/a9b_screens.js` screens ·
`a9c_meta.js` Inbox, achievements, Settings, title screen · `a10_boot.js` actions, `migrate()`, boot.
All parts share one script, so a later `function` with the same name silently replaces an earlier one.
The folder name has spaces: keep every path in shell scripts quoted, or relative to the project folder.

## MBAACC assets (`tools/`, `sprites/`)
Sprites, move effects, portraits and cut-ins come from the owner's Melty Blood Actress Again Current Code install, `C:\Games\MBAACC`
(env `MBAACC` overrides). Nothing is downloaded. `tools/mbaacc.py` reads it: the `000N.p` archives (FilePacHeaderA, XOR-encrypted),
`.cg` sprite sheets, `.pal` palettes and `.HA6` frame data (the CG/HA6 logic is ported from Hantei-chan).
- `python tools/moves.py` maps every skill to a real move of its Moon style (English move list `grp/Command/com_txt` joined with the
  command table `data/<char>_<n>_c.txt`; Last Arcs are found by name) and writes `tools/skills.json`. Skill names in `a3a_roster.js` are
  MBAACC's official English move names; if you rename a skill, rerun it (or edit `skills.json` by hand) and re-extract.
- `python tools/extract.py [key ...]` writes `sprites/<key>.js` (`MBSPR[key]`): two WebP sheets (palette-index body sprites, recoloured
  per Element at runtime; lossy true-colour effects, big ones at half size), roles per Moon style (`idle walk run back guard hit hit2 down
  intro win s1 s2 s3`), effect timelines, and per skill the hit ticks and reach. Frame format is in the file's docstring.
- `python tools/art.py` writes `sprites/_art.js` (`MBART`): character-select art, head crops (`HEAD` lists hand-set crops) and Arc Drive
  cut-ins per Moon style. MBAACC's own logo is deliberately not used (it names Actress Again Current Code).
- `python tools/audio.py` converts every voice/sound the packs cue (`tools/audio_used.json`, written by extract.py) and the music
  in its `BGM` table to MP3s in `audio/`, and writes `sprites/_bgm.js` (`MBBGM`: key -> track + loop point). Needs ffmpeg.
- `python tools/preview.py <char> <style> <seq> out.png` renders a move as the game plays it, to check playback rules.
- Characters map to MBAACC files in `moves.py` `CHAR_FILE` and `art.py` `CHARA_NO`. Generic monsters (Ghouls, the Dead, hounds…)
  stay drawn figures. Saber, Noel and Vlov (Type Lumina) were replaced by Archetype: Earth, Seifuku Akiha and Kohaku & Mech-Hisui;
  `LEGACY` in `a3b_kits.js` moves old saves' units over.
- Tag teams (`moves.py` `PARTNER`): the partner's pack rides along (`MBSPR[k].partner`). It stands behind the main character
  (`vu.sp2`), mirrors stance and reactions, and plays role `p<n>` when a main frame cues partner sequence n (MBAACC EF 6/150).
- Frame data rules worth knowing: frame flag 4 makes a jump relative; "end" frames that lead to a whiff/failure sequence are
  skipped (the hit branch follows); Last Arcs skip the cinematic "ダミー" stand-ins. Sound cues are EF type 9 (0 = shared
  `se/normal_se/SE<n>`, 1 = the character's `_SeList.txt` entry); a hit's impact sound comes from its ATHE block.

## Sound
Music: `screenMusic(view)` in `route()`, `battleMusic(cfg)` (cfg.bgm, boss, Wallachia, else the env's track) at battle start, win/lose
tracks in the outro, "talk" in story scenes, "title" on the title screen. Characters greet you with their own lines (`charVoice`).

## Battle look
Side view like the SNES Tales games (`SLOTS`: two staggered rows per side; `fitHome` keeps yaw 0). Camera shots in `a8b_battle.js`
(`lineShot`, `impactShot`, `aoeShot`, `focusShot`) only pan and zoom along the battle line with small yaw swings. A sprite unit's turn
(`spriteAct`): Arc Drive cut-in if S3, run in until the move's first hit reaches the nearest target (`closeIn`), play the move; each
engine `atk` event waits for that hit's tick (`spriteHit`, `sprHitAt`); `end` lets the move finish, then everyone returns
(short retreats are a backstep). Timelines run at 60 ticks/s on the battle clock, so battle speed applies.

## Rules
- Each `CHARS` entry has `Crescent`/`Half`/`Full` Moon styles (own class, skills, Personal Skill), and each style comes in all five Elements
  (`ELEMENT_KIT` tweaks stats, S1 and the Arc Drive): 435 units keyed `<char>-<c|h|f>-<element>`. Fields: `style` = Moon style, `el` = Element.
  `HOME_EL` picks each style's home Element; `homeKey("shiki-c")` gives that unit. Home-Element units use MBAACC palette 0.
- Skill and Personal Skill text is generated by `skillDesc()`/`passiveDesc()`: edit the data, not the text.
- Every visible term must be Melty Blood / TYPE-MOON / Nasuverse (glossary in `README.md`): Tatari/Manifest, Moon styles, magecraft Elements
  (Fire, Water, Wind, Ether, Imaginary Numbers), Fate class names, Charisma, Personal Skill, Ascension, Spirit Origin, Skill Rank E–EX, Mystic Codes, Prana.
- Saves live in `localStorage` under `melty_blood_rpg_v1`; `migrate()` in `a10_boot.js` must stay backward compatible.

## Testing
```sh
npm install && npx playwright install chromium
node tests/phone.js      # phone-size playthrough, screenshots in tests/shots/
node tests/battle.js     # sprite battle, a screenshot every 250 ms (add "landscape"; tests/shots/battle*/)
node tests/figures.js    # every drawn figure and a pose sheet
node tests/sim.js        # auto-vs-auto win rates per stage (VARIANTS=1 / ELEMENTS=1 for per-style / per-Element rates)
```
Check screenshots at 390×844 portrait and 844×390 landscape after visual changes.

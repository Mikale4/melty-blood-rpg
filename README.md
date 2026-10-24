# Melty Blood RPG — Night of Rumors

A phone-first, turn-based RPG take on Melty Blood, built on the same engine as Arknights Tactics Mobile
and Galactic Heroes. The cast and the Tatari incident from the fighting game become a squad RPG:
story chapters on stage maps, side-view battles with the fighting game's own sprites and moves, a gacha, gear and battle modes.

Play: open `Melty Blood RPG.html` (one self-contained file). Progress saves in the browser.

## What's in it

- **Story — Night of Rumors**: five Nights in Misaki Town (The Rumor, The Executor, Tohno Mansion,
  Chaos in the Park, Night of Wallachia). Each Night is a stage map with story scenes, battles, side
  stories, caches and a boss, with dialogue before and after fights. Clearing a Night recruits Water Half
  Moon Sion, Ether Crescent Moon Ciel, Imaginary Full Moon Akiha or Imaginary Full Moon Arcueid. All dialogue is an original fan retelling.
- **Moon styles × Elements, Summoners War style**: every character comes in Crescent, Half and Full
  Moon, and every Moon style in five Elements. Each combination is its own unit (for example Fire Half
  Moon Shiki and Water Half Moon Shiki), collected and raised separately: 29 characters × 3 × 5 = 435 units.
  - **Moon style** sets the role, three skills (real moves from that style's MBAACC move list, played with their own animations) and
    Personal Skill, plus a trait from the fighting game's systems: Crescent enters Blood Heat (more damage at 200%+
    Magic Circuit), Half has the toughest guard and an automatic Circuit Spark, Full charges its own meter
    and hits harder with Arc Drives. Half Moon S3s use the basic Arc Drive, as Half has no Last Arc.
  - **Element** (the magecraft Elements of the Nasuverse) sets matchups (Water beats Fire, Fire beats Wind,
    Wind beats Water; the rare Ether and Imaginary Numbers beat each other), the unit's colour, a small stat
    lean and kit tweaks: Fire S1s can Curse and its Arc Drives hit harder, Water slows and heals, Wind controls
    turn meter, Ether seals skills and strips buffs, Imaginary Numbers heal-blocks and drains. Ether and
    Imaginary Numbers versions are rare (5% each).
  - Badges show both: the moon phase is the Moon style, the colour is the Element.
- **Battles**: squads of four, turn gauges, Element affinity, Moon-style traits, status effects and a squad leader.
  Every action fills your **Magic Circuit** (up to 300%); each character's third skill is an
  **Arc Drive** that spends 100% of it. Enemy bosses have their own circuit and Arc Drives.
  Battles open with *Ready… Fight!*, run in rounds, and end on *K.O.*
  They are seen from the side like the SNES Tales games: on its turn a character runs in until its move's first hit
  reaches the target, plays the real move (effects included) with damage landing on the move's hit frames, then
  backsteps or runs home. The camera stays side-on and zooms and pans along the line; Arc Drives get MBAACC's cut-ins.
- **29 characters**, all with their MBAACC sprites, moves and voices: Shiki Tohno,
  Shiki Nanaya, Arcueid, Red Arcueid, Ciel, Powered Ciel, Akiha, Akiha Vermillion, Hisui, Kohaku,
  Mech-Hisui, Satsuki, Sion, Sion TATARI, Riesbyfe, Aoko, Nrvnqsr Chaos, Michael Roa Valdamjong,
  Night of Wallachia, Len, White Len, Miyako, Kouma, Neco-Arc, Neco-Arc Chaos, Ryougi Shiki, and Actress Again's own
  Archetype: Earth, Seifuku Akiha and Kohaku & Mech-Hisui (a tag team: Mech-Hisui stands behind Kohaku and steps in
  for her own moves).
- **Tatari** (gacha): rumors take shape. A daily featured 5★ and two 4★, ×1 and ×10 Manifests with
  Jewels or Rumor Tickets, a rising 5★ rate after 50 Manifests, and a guaranteed 4★ in your
  first ten. Duplicates raise Spirit Origin.
- **Growth**: level up with Blood Vials, Ascend twice with Crimson Moon Shards, raise Skill Ranks (E to EX)
  with Magic Crest Fragments, and equip two **Mystic Codes** (sets such as Reinforcement, Mystic Eyes, Black
  Key, Heat, Gamaliel).
- **Battle modes**: Night Patrol (Mystic Code farming, three areas × six levels), Arcade Mode
  (a 30-stage ladder with bosses and mirror matches) and Versus (ranked squad battles).
- **Home**: a partner character (tap them), daily missions, the Ahnenerbe café shop and items.
- **Title screen**: a gacha-style login screen with live key art (Shiki and Arcueid under the crimson moon),
  a load bar, *Tap to Start*, version and player ID. New accounts pick a name, then see the intro.
- **Inbox**: mail with attachments to claim (one by one or *Claim all*), expiring after 30 days. New accounts
  find a welcome mail from Sion with a free ×10 Manifest and a Crimson Moon Rumor (a random 5★). The game also
  sends a daily login gift (7-day cycle), letters with small gifts from the cast every few hours, and a gift
  every five player levels.
- **Achievements** (Tatari Records): 90 tiers across Story, Collection, Growth, Battle, Tatari and Login,
  tracked from play statistics (wins, Arc Drives, defeats, flawless wins, Manifests, 5★ pulls, logins and more).
  Each finished tier mails its reward to the Inbox.
- **Settings**: name, player ID and stats, sound, battle speed, auto-battle and tactics, return to title, and
  *Reset account* (type RESET to confirm).

## Terminology

Every name in the game comes from Melty Blood, Tsukihime or the wider Nasuverse:

| Game system | Name used |
|---|---|
| Gacha / pull | Tatari / Manifest (rumors take shape) |
| Variants / matchups | Moon styles (Crescent, Half, Full) / magecraft Elements (Fire, Water, Wind, Ether, Imaginary Numbers) |
| Special meter, ultimate | Magic Circuit, Arc Drive; style traits Blood Heat, Circuit Spark, Charge |
| Classes | Saber, Lancer, Archer, Assassin, Shielder, Ruler (healers), Caster (supports), Magus (magic attackers) |
| Leader skill / passive | Charisma / Personal Skill |
| Promotion / duplicates / skill levels | Ascension / Spirit Origin / Skill Rank E–EX |
| Statuses | Bounded Field, Presence Concealment, Target Focus, Shield Counter, Skill Seal, Curse, Bind, Line of Death, Guts |
| Gear | Mystic Codes |
| Stamina / currencies | Prana; Yen, Jewels, Rumor Tickets, Tatari Fragments, Versus Points, Holy Relics, Ahnenerbe Coupons |
| Materials | Blood Drop to True Ancestor's Blood (EXP), Crimson Moon Shard, Magic Crest Fragment |
| Modes | Nights (story), Night Patrol, Arcade Mode, Versus |

Battle sprites, move effects, portraits, Arc Drive cut-ins, music, voices and sound effects are extracted from the owner's own
Melty Blood Actress Again Current Code install (see below); the monsters and backdrops are drawn on canvas. Moves play their
own voice lines and sounds on the frames the original cues them, and every hit its impact sound. Music and voices live in
the `audio/` folder, which must sit next to `Melty Blood RPG.html`; without it the game falls back to synthesized sounds.

## Building and testing

The game is assembled from the parts in `src/`. Never edit `Melty Blood RPG.html` directly.

The MBAACC assets come from the owner's install (`C:\Games\MBAACC`, or set `MBAACC`); nothing is downloaded:

```sh
python tools/moves.py          # skill -> MBAACC move/sequence table, tools/skills.json (add "assign" to rename skills to real moves)
python tools/extract.py [key]  # battle sprite packs, sprites/<key>.js (all 26 characters take several minutes)
python tools/art.py            # portraits, head icons and Arc Drive cut-ins, sprites/_art.js
python tools/audio.py          # audio/: the voices and sounds the packs cue, plus the music (needs ffmpeg), sprites/_bgm.js
python tools/preview.py akiha 0 114 out.png   # contact sheet of one move as the game plays it
```

Then build and test:

```sh
sh src/build.sh                # writes Melty Blood RPG.html (and dist/index.html for artifacts), syntax-checks
node tests/phone.js            # phone playthrough, screenshots in tests/shots/
node tests/figures.js          # every figure and a pose sheet
node tests/sim.js              # auto-vs-auto win rates per stage
node tests/battle.js [landscape] [seconds]   # an auto battle with sprite units, a screenshot every 250 ms
VARIANTS=1 node tests/sim.js   # win rate of every Moon style in the same squad
ELEMENTS=1 node tests/sim.js   # average win rate per Element across all 435 units
```

Unofficial, non-commercial fan game. Melty Blood and Tsukihime belong to TYPE-MOON and French-Bread.


// =====================================================================
//  STORY — "Night of Rumors", an original fan retelling of the Tatari incident in Misaki Town.
//  Node types: story · battle · side · chest · boss
// =====================================================================
const SPK = {
  narr: { n: "" },
  shiki: { n: "Shiki", op: homeKey("shiki-c") }, satsuki: { n: "Satsuki", op: homeKey("satsuki-c") }, hisui: { n: "Hisui", op: homeKey("hisui-c") }, kohaku: { n: "Kohaku", op: homeKey("kohaku-c") },
  akiha: { n: "Akiha", op: homeKey("akiha-c") }, sion: { n: "Sion", op: homeKey("sion-c") }, ciel: { n: "Ciel", op: homeKey("ciel-c") }, arcueid: { n: "Arcueid", op: homeKey("arcueid-c") },
  len: { n: "Len", op: homeKey("len-c") },
  sion_e: { n: "Sion", en: "b_sion" }, ciel_e: { n: "Ciel", en: "b_ciel" }, redakiha: { n: "Akiha?", en: "b_redakiha" }, chaos: { n: "Nrvnqsr Chaos", en: "b_chaos" },
  wallachia: { n: "Night of Wallachia", en: "b_wallachia" }, nanaya: { n: "Shiki Nanaya", en: "b_nanaya" }, riesbyfe: { n: "Riesbyfe", en: "b_riesbyfe" },
  mech: { n: "Mech-Hisui", en: "b_mech" }, archetype: { n: "Archetype: Earth", en: "b_archetype" }, whitelen: { n: "White Len", en: "b_whitelen" }, ghoul: { n: "Ghoul", en: "ghoul" },
};
const L = (s, t) => ({ s, t });
const W = (...list) => list.map(x => typeof x === "string" ? { e: x } : x);

const STORY = [{
  id: "ep1", title: "Night of Rumors", sub: "Main Story",
  blurb: "One summer night every year, Misaki Town's rumors come true. This year someone is spreading the worst ones on purpose.",
  chapters: [
    { id: "c1", title: "The Rumor", env: "misaki", map: "misaki", reward: { op: homeKey("sion-h"), orundum: 300 },
      nodes: [
        { id: "1-1", type: "story", name: "A Town of Whispers", pre: [
          L("narr", "Misaki Town, late summer. A rumor walks the streets after midnight: the vampire killer is back, and this time it never sleeps."),
          L("hisui", "Master Shiki. Lady Akiha asked me to remind you that the curfew is eleven o'clock."),
          L("shiki", "I'll be back before midnight, Hisui. Probably."),
          L("hisui", "...I will leave the side door unlocked."),
          L("narr", "He is not back before midnight.") ] },
        { id: "1-2", type: "battle", name: "Midnight Crossing", lv: 1, waves: [W("ghoul", "ghoul", "dead")], pre: [
          L("shiki", "Ghouls... these were people once."),
          L("satsuki", "Shiki! Behind you!"),
          L("shiki", "Satsuki? What are you doing out here at this hour?"),
          L("satsuki", "Long story. Fight first, explain later! Tap an enemy to target it, then pick a skill.") ], post: [
          L("satsuki", "See? We make a good team. Don't tell anyone I can do that, okay?") ] },
        { id: "1-3", type: "battle", name: "Back Alley Hunger", lv: 2, waves: [W("hound", "ghoul", "hound")], pre: [
          L("shiki", "Dogs made of shadow. Whoever is doing this has a sense of theatre."),
          L("satsuki", "Every hit we land charges our Magic Circuit. At 100%, you can unleash an Arc Drive!") ] },
        { id: "1-4", type: "chest", name: "Forgotten Locker", reward: { lmd: 2000, rec1: 6, orundum: 100 }, pre: [
          L("satsuki", "Someone left a whole stash in this locker. Finders keepers!") ] },
        { id: "1-5", type: "side", name: "The White Cat", lv: 4, waves: [W("phantom", "phantom"), W("b_whitelen")], pre: [
          L("whitelen", "Oh? A human with interesting eyes, wandering through my rumor. How rude."),
          L("shiki", "Your rumor?"),
          L("whitelen", "Every nightmare in this town is a stage. Tonight, you are the audience.") ], post: [
          L("whitelen", "Hmph. You are no fun at all. I'll find a better play.") ] },
        { id: "1-6", type: "battle", name: "Plaza of Rumors", lv: 4, waves: [W("ghoul", "phantom", "ghoul"), W("dead", "phantom", "dead")], pre: [
          L("satsuki", "Those ghosts are whispering... they're repeating things people say about this town."),
          L("shiki", "Then let's give them something new to talk about."),
          L("satsuki", "Oh, and look at everyone's badge. The colour is their magecraft Element: Water beats Fire, Fire beats Wind, Wind beats Water, and the rare Ether and Imaginary Numbers beat each other."),
          L("satsuki", "The moon shape is their Moon style. Same person, different style, totally different moves. I'm a Fire Half Moon, you're a Wind Crescent Moon!") ] },
        { id: "1-7", type: "boss", name: "The Alchemist", lv: 7, waves: [W("phantom", "ghoul"), W("b_sion", "ghoul", "phantom")], pre: [
          L("sion_e", "Shiki Tohno. Holder of the Mystic Eyes of Death Perception. I require your cooperation."),
          L("shiki", "You have a strange way of asking."),
          L("sion_e", "I calculated a ninety-two percent chance that you would refuse politely. I would rather skip to the part where I persuade you.") ], post: [
          L("sion_e", "...Remarkable. My calculations underestimated you."),
          L("sion", "I am Sion Eltnam Atlasia, of the Atlas Institute. I am hunting the thing that makes rumors real. The Tatari."),
          L("shiki", "Then I guess we're hunting it together.") ] },
      ] },
    { id: "c2", title: "The Executor", env: "school", map: "school", reward: { op: homeKey("ciel-c"), orundum: 300 },
      nodes: [
        { id: "2-1", type: "story", name: "Divided Thought", pre: [
          L("sion", "The Tatari is not a person. It is a phenomenon called the Night of Wallachia. Once a year, it takes the shape of whatever a town fears most."),
          L("shiki", "So if everyone believes in a vampire..."),
          L("sion", "Then a vampire it becomes."),
          L("satsuki", "Great. Because I am a vampire. Everyone's going to believe in me now.") ] },
        { id: "2-2", type: "battle", name: "Schoolyard Shadows", lv: 9, waves: [W("dead", "ghoul", "dead")], pre: [
          L("sion", "The school is a dense source of rumors. Students talk. The Tatari listens.") ] },
        { id: "2-3", type: "battle", name: "Phantom Hall", lv: 11, waves: [W("phantom", "knight", "phantom")], pre: [
          L("sion", "A knight in the hallway. Someone has been telling ghost stories about the old wing."),
          L("shiki", "Every school has one.") ] },
        { id: "2-4", type: "side", name: "Church Business", lv: 13, waves: [W("executor", "executor", "knight")], pre: [
          L("narr", "Three figures in black cassocks block the stairwell, Black Keys already drawn."),
          L("satsuki", "Um. Are they here for me?"),
          L("sion", "They are rumors of the Church, wearing borrowed faith. Be careful.") ], post: [
          L("satsuki", "I really hope the real ones aren't that scary.") ] },
        { id: "2-5", type: "chest", name: "Atlas Supply Case", reward: { lmd: 4000, rec2: 4, chip: 2, orundum: 100 } },
        { id: "2-6", type: "battle", name: "Rooftop Pursuit", lv: 14, waves: [W("executor", "phantom", "ghoul"), W("knight", "executor", "wraith")], pre: [
          L("sion", "The rooftop. I calculated an eighty percent chance of an ambush.") ] },
        { id: "2-7", type: "boss", name: "The Executor", lv: 17, waves: [W("executor", "executor"), W("b_ciel", "executor", "phantom")], pre: [
          L("ciel_e", "Tohno-kun. Step away from the alchemist. Atlas sent a vampire hunter who has become a vampire."),
          L("sion", "...The Burial Agency is well informed."),
          L("shiki", "Ciel-senpai, she's trying to stop the Tatari!"),
          L("ciel_e", "Then she can prove it after I've pinned her down.") ], post: [
          L("ciel_e", "Hmm. Fine. I'll watch her myself. Consider me a very suspicious ally."),
          L("sion", "Acceptable."),
          L("ciel", "And Tohno-kun? We are going to talk about your curfew later.") ] },
      ] },
    { id: "c3", title: "Tohno Mansion", env: "mansion", map: "mansion", reward: { op: homeKey("akiha-f"), orundum: 300 },
      nodes: [
        { id: "3-1", type: "story", name: "Curfew", pre: [
          L("akiha", "Nii-san. It is three in the morning."),
          L("shiki", "I can explain."),
          L("akiha", "You have brought a vampire, an alchemist and a nun into my house."),
          L("kohaku", "Ahaha! I'll put the kettle on."),
          L("hisui", "...I will prepare the guest rooms.") ] },
        { id: "3-2", type: "battle", name: "Garden Intruders", lv: 18, waves: [W("ghoul", "hound", "ghoul", "hound")], pre: [
          L("akiha", "Ghouls in the Tohno garden. How dare they."),
          L("hisui", "Lady Akiha, the roses...") ] },
        { id: "3-3", type: "battle", name: "The Long Corridor", lv: 20, waves: [W("wraith", "ghoul", "phantom"), W("hound", "hound", "wraith")], pre: [
          L("kohaku", "These halls are full of old stories. Most of them are about Lady Akiha, actually.") ] },
        { id: "3-4", type: "story", name: "A Red Rumor", pre: [
          L("narr", "By morning a new rumor has spread: the lady of the Tohno house is a red-haired demon who drinks her servants' blood."),
          L("akiha", "...How very original."),
          L("sion", "Absurd or not, the Tatari will give it a body tonight."),
          L("kohaku", "Should I hide the tomato juice? It might look bad.") ] },
        { id: "3-5", type: "side", name: "Kohaku's Masterpiece", lv: 23, waves: [W("homunculus", "homunculus"), W("b_mech")], pre: [
          L("kohaku", "Ta-da! Meet Mech-Hisui! She's only a little bit unstable."),
          L("hisui", "Sister..."),
          L("mech", "TARGET ACQUIRED. INITIATING CLEANING PROTOCOL.") ], post: [
          L("kohaku", "She'll be fine after a few more upgrades!"),
          L("hisui", "Please don't.") ] },
        { id: "3-6", type: "chest", name: "Tohno Family Vault", reward: { lmd: 6000, rec2: 6, summ: 4, orundum: 100, permit: 1 } },
        { id: "3-7", type: "boss", name: "Vermillion", lv: 27, waves: [W("wraith", "phantom", "wraith"), W("b_redakiha", "wraith", "phantom")], pre: [
          L("redakiha", "So this is the heir I am supposed to be. Disappointing."),
          L("akiha", "Don't flatter yourself. You're a rumor wearing my face."),
          L("redakiha", "I am what they whisper about you. And whispers are always true in the end.") ], post: [
          L("akiha", "...It knew exactly what I fear becoming."),
          L("shiki", "It was wrong about you, Akiha."),
          L("akiha", "Of course it was. I'm coming with you tonight. Don't argue.") ] },
      ] },
    { id: "c4", title: "Chaos in the Park", env: "park", map: "park", reward: { op: homeKey("arcueid-f"), orundum: 400 },
      nodes: [
        { id: "4-1", type: "story", name: "The Princess", pre: [
          L("arcueid", "Shiki! You've been having fun without me."),
          L("shiki", "Arcueid. Shouldn't you be resting?"),
          L("arcueid", "Something in the park smells like an old enemy. You'll want me there."),
          L("akiha", "Nii-san. Who is this woman.") ] },
        { id: "4-2", type: "battle", name: "Beasts in the Dark", lv: 30, waves: [W("hound", "panther", "hound")], pre: [
          L("arcueid", "Those animals aren't animals. They're pieces of something much bigger.") ] },
        { id: "4-3", type: "battle", name: "Overgrown Paths", lv: 32, waves: [W("panther", "hound", "panther"), W("wraith", "panther", "ghoul")], pre: [
          L("ciel", "The deeper we go, the more of them there are. He's close.") ] },
        { id: "4-4", type: "side", name: "A Princess Out of Season", lv: 35, waves: [W("b_archetype", "phantom", "wraith")], pre: [
          L("archetype", "The rumor dressed itself in my old face. How quaint. Come, show me what this age is worth."),
          L("arcueid", "...Me? No. What I was, before I learned to be anything else.") ], post: [
          L("archetype", "Hm. Keep her, then. The night is not finished with any of you.") ] },
        { id: "4-5", type: "chest", name: "Abandoned Picnic", reward: { lmd: 9000, rec3: 4, chip: 3, orundum: 150 } },
        { id: "4-6", type: "battle", name: "Fountain Square", lv: 38, waves: [W("panther", "panther", "wraith"), W("knight", "panther", "wraith", "hound")], pre: [
          L("sion", "Every path leads to the fountain. He wants an audience.") ] },
        { id: "4-7", type: "boss", name: "Nrvnqsr Chaos", lv: 41, waves: [W("panther", "hound", "panther"), W("b_chaos", "panther", "hound")], pre: [
          L("chaos", "Princess. You have grown soft among these insects."),
          L("arcueid", "And you've grown back. Rumors really will believe anything."),
          L("chaos", "I am a sea of life. You cannot kill a sea."),
          L("shiki", "I can see where it ends.") ], post: [
          L("chaos", "...Only a rumor. Even this body... was borrowed."),
          L("arcueid", "It's getting stronger, Shiki. The Tatari. Tomorrow is the night.") ] },
      ] },
    { id: "c5", title: "Night of Wallachia", env: "wallachia", map: "wallachia", reward: { orundum: 600, permit: 5 },
      nodes: [
        { id: "5-1", type: "story", name: "Sion's Confession", pre: [
          L("sion", "I must tell you something. I was bitten, three years ago. I am slowly becoming what I hunt."),
          L("shiki", "We noticed."),
          L("ciel", "Everyone noticed."),
          L("sion", "If I fall tonight, you must not hesitate."),
          L("shiki", "Then don't fall.") ] },
        { id: "5-2", type: "battle", name: "Red Moon Streets", lv: 44, waves: [W("wraith", "wraith", "ghoul")], pre: [
          L("narr", "The moon rises red over Misaki Town. Every story anyone has ever told about this place walks the streets at once.") ] },
        { id: "5-3", type: "battle", name: "Rumors Made Flesh", lv: 47, waves: [W("wraith", "knight", "executor"), W("wraith", "panther", "wraith")], pre: [
          L("akiha", "Stay close, Nii-san. I'll burn a path.") ] },
        { id: "5-4", type: "chest", name: "Burial Agency Cache", reward: { lmd: 12000, rec3: 6, summ: 6, orundum: 150, permit: 1 } },
        { id: "5-5", type: "side", name: "The Other Shiki", lv: 50, waves: [W("phantom", "phantom"), W("b_nanaya", "phantom")], pre: [
          L("nanaya", "A killer, wearing your face. Isn't that the rumor you were always afraid of?"),
          L("shiki", "I'm not afraid of you.") ], post: [
          L("nanaya", "...Then I'll wait. In the back of your head. Like always.") ] },
        { id: "5-6", type: "battle", name: "The Last Friend", lv: 53, waves: [W("wraith", "executor", "knight", "wraith"), W("b_riesbyfe", "wraith", "wraith")], pre: [
          L("sion", "Riesbyfe... The Tatari wears my friend's face to stop me."),
          L("riesbyfe", "Sion. Turn back. Some calculations should never be finished."),
          L("sion", "This one I will finish. For both of us.") ] },
        { id: "5-7", type: "boss", name: "Night of Wallachia", lv: 57, waves: [W("wraith", "wraith", "knight"), W("b_wallachia", "wraith", "wraith")], pre: [
          L("wallachia", "Sion Eltnam. Your despair was delicious. Will you give me the rest?"),
          L("sion", "No. I calculated every outcome. In all of them, I win tonight."),
          L("wallachia", "Then let the rumor end your story.") ], post: [
          L("narr", "The red moon cracks like glass, and the Night of Wallachia scatters into a thousand unfinished rumors."),
          L("sion", "It's over. For this year."),
          L("shiki", "Then let's go home. Akiha is going to kill me."),
          L("narr", "End of Night of Rumors. Thank you for playing.") ] },
      ] },
  ],
}];
// Flatten for lookups. Stage codes: main stages 1-1…1-6, side stages S1-1.
const NODES = {};
for (const ep of STORY) ep.chapters.forEach((ch, ci) => {
  let mc = 0, sc = 0;
  ch.no = String(ci + 1).padStart(2, "0");
  ch.nodes.forEach((nd, i) => { nd.legacy = nd.id; nd.id = nd.type === "side" ? `S${ci + 1}-${++sc}` : `${ci + 1}-${++mc}`; nd.ch = ch; nd.ep = ep; nd.idx = i; NODES[nd.id] = nd; });
});
const nodeCost = nd => nd.type === "story" || nd.type === "chest" ? 0 : 6 + Math.floor(nd.lv / 10) * 2;
const nodeTurnGoal = nd => (nd.waves ? nd.waves.length : 1) * 9 + (nd.type === "boss" ? 4 : 0);

// =====================================================================
//  NIGHT PATROL · ARCADE MODE · VERSUS · MISSIONS · SHOP
// =====================================================================
const HUNTS = [
  { id: "alley", code: "BA", n: "Back Alleys", sub: "Ghouls gather where the streetlights fail", env: "alley", sets: ["Swift", "Energy", "Focus", "Will", "Endure"],
    waves: lv => [W("ghoul", "dead", "ghoul"), W("b_satsuki", "ghoul", "dead")] },
  { id: "school", code: "NS", n: "Night School", sub: "The old wing, where every ghost story starts", env: "school", sets: ["Fatal", "Blade", "Rage", "Violent", "Revenge"],
    waves: lv => [W("phantom", "knight", "phantom"), W("b_whitelen", "phantom", "wraith")] },
  { id: "chapel", code: "RC", n: "Ruined Chapel", sub: "A serpent sleeps beneath the altar", env: "mansion", sets: ["Guard", "Shield", "Nemesis", "Despair", "Endure"],
    waves: lv => [W("executor", "knight", "wraith"), W("b_roa", "executor", "knight")] },
];
const HUNT_LV = [10, 22, 34, 46, 58, 70];
const HUNT_COST = [8, 10, 12, 14, 16, 18];
const HUNT_RAR = [[.5, .4, .1, 0, 0], [.2, .45, .3, .05, 0], [0, .35, .45, .17, .03], [0, .15, .45, .32, .08], [0, 0, .35, .45, .2], [0, 0, .15, .5, .35]];

// Arcade Mode: a 30-stage ladder; every fifth stage is a boss, even stages from 8 on are mirror matches
const TOWER_FLOORS = 30;
function towerFloor(f) {
  const lv = 4 + f * 3, rng = seeded(hash("arcade" + f));
  const mobs = ["ghoul", "dead", "hound", "panther", "phantom", "wraith", "executor", "knight", "homunculus"];
  const bosses = ["b_sion", "b_ciel", "b_redakiha", "b_chaos", "b_redarc", "b_wallachia"];
  const pickE = () => mobs[Math.floor(rng() * mobs.length)];
  let waves;
  if (f % 5 === 0) waves = [W(pickE(), pickE(), pickE()), W(bosses[(f / 5 - 1) % bosses.length], pickE(), pickE())];
  else if (f >= 8 && f % 2 === 0) {
    const pool = OP_KEYS.filter(k => OPS[k].rar >= 4);
    waves = [[0, 1, 2, 3].map(() => ({ op: pool[Math.floor(rng() * pool.length)] }))];
  } else waves = [W(pickE(), pickE(), pickE()), ...(f > 3 ? [W(pickE(), pickE(), pickE(), pickE())] : [])];
  const reward = f % 5 === 0 ? { orundum: 200, permit: 1, chip: 2 } : { orundum: 50, lmd: 1500 + f * 300, ["rec" + Math.min(4, 1 + Math.floor(f / 8))]: 3 };
  return { id: "T" + f, f, lv, waves, reward, env: ["misaki", "school", "mansion", "park", "alley", "wallachia"][Math.floor((f - 1) / 5)] };
}

const ARENA_N1 = ["Misaki", "Atlas", "Tohno", "Burial", "Ahnenerbe", "Mifune", "Sodegasaki", "Asagami", "Kyoto", "Brunestud", "Wallachia", "Crimson"];
const ARENA_N2 = ["Night Walker", "Executor", "Alchemist", "Ancestor", "Maid", "Magus", "Apostle", "Hunter", "Familiar", "Knight", "Rumor", "Moon"];
const ARENA_MS = 10 * 60000, PAYOUT_MS = 6 * 3600000;

const DAILIES = [
  { id: "clear", n: "Win 3 battles", goal: 3, reward: { orundum: 60, lmd: 2000, credit: 80 } },
  { id: "sanity", n: "Spend 60 Prana", goal: 60, reward: { orundum: 60, credit: 40 } },
  { id: "hh", n: "Manifest once", goal: 1, reward: { orundum: 80 } },
  { id: "upgrade", n: "Upgrade characters 3 times", goal: 3, reward: { rec2: 3 } },
  { id: "arena", n: "Win a Versus battle", goal: 1, reward: { tokens: 30, orundum: 40 } },
  { id: "rune", n: "Upgrade a Mystic Code", goal: 1, reward: { lmd: 3000, credit: 40 } },
];
const DAILY_ALL = { permit: 1 };
// Achievements live in a9c_meta.js (ACH): tiered, with rewards sent to the Inbox.
const SHOP = {
  credit: [
    { id: "r_lmd", n: "Yen ×12,000", cost: 200, give: { lmd: 12000 } },
    { id: "r_rec", n: "True Ancestor's Blood ×3", cost: 240, give: { rec4: 3 } },
    { id: "r_summ", n: "Magic Crest Fragment ×3", cost: 160, give: { summ: 3 } },
    { id: "r_chip", n: "Crimson Moon Shard", cost: 300, give: { chip: 1 } },
  ],
  cert: [
    { id: "c_permit", n: "Rumor Ticket", cost: 25, give: { permit: 1 } },
    { id: "c_summ", n: "Magic Crest Fragment ×3", cost: 8, give: { summ: 3 } },
    { id: "c_chip", n: "Crimson Moon Shard ×2", cost: 12, give: { chip: 2 } },
    { id: "c_rune", n: "Grade IV Mystic Code", cost: 20, give: { rune: 4 } },
  ],
  tokens: [
    { id: "t_permit", n: "Rumor Ticket", cost: 240, give: { permit: 1 } },
    { id: "t_chip", n: "Crimson Moon Shard ×3", cost: 90, give: { chip: 3 } },
    { id: "t_summ", n: "Magic Crest Fragment ×4", cost: 60, give: { summ: 4 } },
    { id: "t_rune", n: "Grade V Mystic Code", cost: 220, give: { rune: 5 } },
  ],
  prime: [
    { id: "p_san", n: "Restore Prana", d: "Refill Prana to max", cost: 1, give: { sanityMax: 1 } },
    { id: "p_oru", n: "Exchange for Jewels", d: "1 Holy Relic → 180 Jewels", cost: 1, give: { orundum: 180 } },
  ],
};
// starters cover all three Moon styles and the Fire/Water/Wind triangle; any Fire, Water or Wind 5★ can headline the banner
const STARTERS = ["shiki-c-wind", "satsuki-h-fire", "hisui-c-water", "kohaku-c-wind", "miyako-f-fire"];
const BANNER_TOP = OP_KEYS.filter(k => OPS[k].rar === 5 && EL_WEIGHT[OPS[k].el] > .1);

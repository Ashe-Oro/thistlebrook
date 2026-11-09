// The starting cast. Adding a villager = adding an entry (the sim scales to N).
export type Goal = 'liked' | 'family' | 'power' | 'love' | 'respect';
export type Job = 'baker' | 'blacksmith' | 'postmistress' | 'farmer' | 'woodcutter' | 'miner' | 'tavernkeeper' | 'shepherd'
  | 'miller' | 'fisher' | 'herbalist' | 'schoolteacher';
export interface Traits { kindness: number; honesty: number; bravery: number; sociability: number; envy: number; ambition: number; diligence: number; temper: number; }
export interface VillagerDef {
  id: string; name: string; job: Job; goal: Goal; home: string; family?: string[]; age: string;
  pronouns: 'he' | 'she'; voice?: string;
  traits: Traits; bio: string; palette: string; skin: string; hair: string; height: number;
  outfit: { pools: Record<string, string[]>; fixed: Record<string, string | string[] | null> };
  catchphrases: string[];
}
const T = (kindness: number, honesty: number, bravery: number, sociability: number, envy: number, ambition: number, diligence: number, temper: number): Traits =>
  ({ kindness, honesty, bravery, sociability, envy, ambition, diligence, temper });

export const VILLAGERS: VillagerDef[] = [
  { id: 'mara', name: 'Mara Thistle', job: 'baker', goal: 'liked', home: 'home-mara', age: 'mid-30s', pronouns: 'she', voice: 'warm, motherly, a bit chatty', palette: 'alex', skin: '#e8b48a', hair: '#7a3b1e', height: 1.72,
    traits: T(.85, .8, .4, .85, .25, .4, .75, .2), bio: 'Bakes before dawn and knows everyone by their favourite loaf.',
    outfit: { fixed: { tops: 'apron', headgear: 'chef-hat' }, pools: { hair: ['bun', 'ponytail-low', 'curly-bob'], bottoms: ['long-skirt', 'skirt'], shoes: ['sandals', 'dress-shoe'], accessories: ['necklace', 'gloves'] } },
    catchphrases: ['Fresh out of the oven!', 'Have you eaten?', 'Bread fixes most things.'] },
  { id: 'tom', name: 'Tom Ashby', job: 'blacksmith', goal: 'power', home: 'home-tom', age: 'early 40s', pronouns: 'he', voice: 'gruff, blunt, few words', palette: 'knight', skin: '#c68642', hair: '#2b1a10', height: 1.86,
    traits: T(.4, .6, .85, .45, .45, .9, .8, .7), bio: 'Strong arm, short fuse, wants a say in how the village is run.',
    outfit: { fixed: { tops: 'vest', shoes: 'work-boot' }, pools: { hair: ['buzz', 'short-crop', 'bald'], facialHair: ['beard-full', 'beard-short', 'mutton-chops'], bottoms: ['trousers', 'cargo'], accessories: ['gloves', 'bracers'] } },
    catchphrases: ['Iron does not lie.', 'Somebody has to lead.', 'Hmph.'] },
  { id: 'jen', name: 'Jen Marlow', job: 'postmistress', goal: 'love', home: 'home-jen', age: 'late 20s', pronouns: 'she', voice: 'breathless, romantic, a gossip', palette: 'captain', skin: '#f1c9a5', hair: '#1c1c22', height: 1.7,
    traits: T(.4, .3, .5, .85, .8, .6, .6, .4), bio: 'Runs the post office and reads more letters than she should. A hopeless romantic, and ruthless about it.',
    outfit: { fixed: { tops: 'blazer' }, pools: { hair: ['long-straight', 'ponytail-high', 'side-part'], bottoms: ['skirt', 'trousers'], shoes: ['heels', 'dress-shoe'], accessories: ['glasses', 'necklace', 'belt-pouch'], headgear: ['beret', 'feather-cap'] } },
    catchphrases: ['A letter for you!', 'Sealed with a kiss.', 'I never read the mail. Never.'] },
  { id: 'ollie', name: 'Ollie Fenn', job: 'farmer', goal: 'family', home: 'home-fenn', family: ['pip'], age: 'early 30s', pronouns: 'he', voice: 'steady, earnest, fretful', palette: 'autumn', skin: '#d9a066', hair: '#c9a24a', height: 1.8,
    traits: T(.8, .9, .35, .5, .2, .4, .9, .25), bio: 'Works the Fenn fields and worries about his little brother.',
    outfit: { fixed: { bottoms: 'overalls', headgear: 'straw-hat' }, pools: { hair: ['messy', 'short-crop'], facialHair: ['stubble', null as any], tops: ['tee', 'longsleeve'], shoes: ['work-boot', 'boot'] } },
    catchphrases: ['Rain is coming.', 'Pip, be careful!', 'Good soil this year.'] },
  { id: 'pip', name: 'Pip Fenn', job: 'woodcutter', goal: 'liked', home: 'home-fenn', family: ['ollie'], age: 'teen', pronouns: 'he', voice: 'cocky, eager, loud', palette: 'neverland', skin: '#d9a066', hair: '#c9a24a', height: 1.62,
    traits: T(.55, .35, .75, .8, .55, .6, .45, .55), bio: 'Ollie\u2019s restless kid brother. Swings an axe, dreams of being somebody.',
    outfit: { fixed: { outerwear: 'backpack' }, pools: { hair: ['spiky', 'messy', 'mohawk'], tops: ['hoodie', 'tee'], bottoms: ['shorts', 'cargo', 'jeans'], shoes: ['high-top', 'sneaker'], headgear: ['beanie', 'cap-backwards', 'bandana-head'] } },
    catchphrases: ['Watch this!', 'Timber!', 'I can do it myself.'] },
  { id: 'rosa', name: 'Rosa Quill', job: 'miner', goal: 'respect', home: 'home-quill', family: ['wren'], age: '40s', pronouns: 'she', voice: 'blunt, dry, no-nonsense', palette: 'adventurer', skin: '#8d5524', hair: '#141414', height: 1.76,
    traits: T(.5, .9, .9, .35, .55, .7, .85, .55), bio: 'Stonemason at the quarry. Blunt, tireless, honest to a fault, and fiercely protective of her sister Wren.',
    outfit: { fixed: { headgear: 'mining-helmet', shoes: 'work-boot' }, pools: { hair: ['braids', 'dreadlocks', 'short-crop'], tops: ['tank', 'jacket-open', 'longsleeve'], bottoms: ['cargo', 'jeans'], accessories: ['goggles-forehead', 'gloves'] } },
    catchphrases: ['Say it to my face.', 'Stone doesn\u2019t lie.', 'Honest work, honest words.'] },
  { id: 'wren', name: 'Wren Quill', job: 'shepherd', goal: 'family', home: 'home-quill', family: ['rosa'], age: '30s', pronouns: 'she', voice: 'soft, gentle, soothing', palette: 'arctic', skin: '#f3d2b3', hair: '#e6d3a3', height: 1.66,
    traits: T(.9, .85, .3, .6, .15, .3, .7, .1), bio: 'Tends the hens and the orchard. Soft-spoken peacemaker.',
    outfit: { fixed: { outerwear: 'satchel' }, pools: { hair: ['long-straight', 'twintails', 'ringlets'], tops: ['tunic', 'sweater', 'leaf-tunic'], bottoms: ['long-skirt', 'leggings'], shoes: ['boot', 'sandals'], headgear: ['bucket-hat', 'headband', null as any] } },
    catchphrases: ['Let\u2019s all calm down.', 'The hens are laying!', 'Be gentle.'] },
  { id: 'edgar', name: 'Edgar Vale', job: 'tavernkeeper', goal: 'power', home: 'home-edgar', age: '50s', pronouns: 'he', voice: 'smooth, conspiratorial, sly', palette: 'ninja', skin: '#f0c08e', hair: '#9a9a9a', height: 1.78,
    traits: T(.45, .25, .45, .95, .6, .85, .55, .35), bio: 'Pours the ale and hears every secret. Collects them in a little black book.',
    outfit: { fixed: { tops: 'vest', accessories: ['bowtie'] }, pools: { hair: ['side-part', 'bald', 'undercut'], facialHair: ['moustache-handlebar', 'van-dyke', 'moustache'], bottoms: ['trousers', 'breeches'], shoes: ['dress-shoe', 'boot'], headgear: ['flat-cap', 'top-hat', null as any] } },
    catchphrases: ['Did you hear?', 'First round\u2019s on me\u2026 almost.', 'Between you and me\u2026'] },
  // --- Riverside newcomers (the cast grows to 12) ---
  // The rival: a proud miller who thinks the mill, not the forge, is the true heart of the village.
  { id: 'bram', name: 'Bram Oakes', job: 'miller', goal: 'power', home: 'home-mill', age: 'mid-40s', pronouns: 'he', voice: 'booming, proud, grudge-bearing', palette: 'adventurer', skin: '#c68642', hair: '#4a3526', height: 1.84,
    traits: T(.4, .6, .7, .55, .6, .9, .85, .7), bio: 'Grinds the village\u2019s grain at the old mill and never lets anyone forget it. Reckons Tom Ashby gets all the glory and half the sense.',
    outfit: { fixed: { tops: 'longsleeve' }, pools: { hair: ['short-crop', 'bald', 'side-part'], facialHair: ['beard-full', 'mutton-chops', 'stubble'], bottoms: ['trousers', 'overalls'], shoes: ['work-boot', 'boot'], outerwear: ['satchel'], accessories: ['gloves', 'belt-pouch'], headgear: ['flat-cap', null as any] } },
    catchphrases: ['No flour, no bread \u2014 remember that.', 'The mill never sleeps.', 'Tom can keep his sparks.'] },
  // The newcomer with a past: a quiet fisher who drifted in last autumn and says little of where he\u2019s been.
  { id: 'sol', name: 'Sol Pike', job: 'fisher', goal: 'respect', home: 'home-pike', age: 'late 30s', pronouns: 'he', voice: 'low, measured, guarded', palette: 'captain', skin: '#a9743c', hair: '#2a211a', height: 1.8,
    traits: T(.6, .75, .75, .35, .3, .45, .8, .4), bio: 'Washed up in Thistlebrook one grey autumn and took to the pond with a rod. Keeps to himself, and keeps whatever he\u2019s running from to himself too.',
    outfit: { fixed: { outerwear: 'satchel' }, pools: { hair: ['short-crop', 'undercut', 'buzz'], facialHair: ['beard-short', 'stubble', 'van-dyke'], tops: ['sweater', 'longsleeve', 'jacket-open'], bottoms: ['trousers', 'cargo'], shoes: ['boot', 'work-boot'], headgear: ['beanie', 'bucket-hat', null as any] } },
    catchphrases: ['The fish don\u2019t ask questions.', 'Quiet suits me.', 'A place is a place.'] },
  // The secret admirer: a gentle herbalist, quietly sweet on Ollie \u2014 and under her mother\u2019s thumb.
  { id: 'posy', name: 'Posy Pennythorn', job: 'herbalist', goal: 'love', home: 'home-penny', family: ['agnes'], age: 'late 20s', pronouns: 'she', voice: 'soft, nervous, hopeful', palette: 'arctic', skin: '#f0c1a0', hair: '#8a6b3a', height: 1.67,
    traits: T(.85, .7, .35, .45, .3, .35, .75, .2), bio: 'Grows simples and remedies in the Riverside garden. Carries a torch for a certain earnest farmer, and would sooner swallow a nettle than say so.',
    outfit: { fixed: { outerwear: 'satchel' }, pools: { hair: ['long-straight', 'ringlets', 'twintails', 'braids'], tops: ['leaf-tunic', 'tunic', 'sweater'], bottoms: ['long-skirt', 'leggings', 'skirt'], shoes: ['boot', 'sandals'], headgear: ['headband', 'bucket-hat', null as any], accessories: ['necklace', 'belt-pouch'] } },
    catchphrases: ['A little chamomile for that.', 'Oh\u2014 it\u2019s nothing.', 'Mind the nettles.'] },
  // The elder busybody: the village schoolteacher, who knows everyone\u2019s business and grades it.
  { id: 'agnes', name: 'Agnes Pennythorn', job: 'schoolteacher', goal: 'respect', home: 'home-penny', family: ['posy'], age: '60s', pronouns: 'she', voice: 'crisp, opinionated, headmistress-ly', palette: 'autumn', skin: '#e4c6a6', hair: '#c9c9cf', height: 1.61,
    traits: T(.55, .85, .6, .8, .4, .6, .9, .45), bio: 'Drills the village children on their letters at the school green and the village adults on their manners everywhere else. Despairs of gossips and meddles like one.',
    outfit: { fixed: { tops: 'blazer' }, pools: { hair: ['bun', 'ponytail-low', 'curly-bob'], bottoms: ['long-skirt', 'skirt'], shoes: ['dress-shoe', 'heels'], accessories: ['glasses', 'necklace'], headgear: ['beret', null as any] } },
    catchphrases: ['Posture, please.', 'In my day\u2026', 'I shall be writing this down.'] },
];

// Occupations are daily routines and places to be (no goods are produced in v1).
export const JOB_INFO: Record<Job, { label: string; workplace: string; note: string; gift: [string, string] }> = {
  baker: { label: 'Baker', workplace: 'bakery', note: 'bake for the village', gift: ['🍞', 'a warm loaf'] },
  blacksmith: { label: 'Blacksmith', workplace: 'smithy', note: 'work the forge', gift: ['🧲', 'a little iron charm'] },
  postmistress: { label: 'Postmistress', workplace: 'store', note: 'sort & deliver the post', gift: ['💌', 'a pretty card'] },
  farmer: { label: 'Farmer', workplace: 'fields', note: 'tend the fields', gift: ['🌻', 'a sunflower'] },
  woodcutter: { label: 'Woodcutter', workplace: 'forest', note: 'swing the axe in the woods', gift: ['🐦', 'a whittled bird'] },
  miner: { label: 'Stonemason', workplace: 'quarry', note: 'carve stone at the quarry', gift: ['🪨', 'a polished pebble'] },
  tavernkeeper: { label: 'Tavernkeeper', workplace: 'tavern', note: 'brew', gift: ['🍺', 'a pint on the house'] },
  shepherd: { label: 'Hen-keeper', workplace: 'coop', note: 'feed the hens & mind the flock', gift: ['🥚', 'a basket of eggs'] },
  miller: { label: 'Miller', workplace: 'windmill', note: 'grind grain at the mill', gift: ['🌾', 'a sack of fresh flour'] },
  fisher: { label: 'Fisher', workplace: 'dock', note: 'cast a line at the dock', gift: ['🐟', 'a fresh-caught fish'] },
  herbalist: { label: 'Herbalist', workplace: 'garden', note: 'gather herbs in the garden', gift: ['🌿', 'a sprig of soothing herbs'] },
  schoolteacher: { label: 'Schoolteacher', workplace: 'school', note: 'teach the children their letters', gift: ['📖', 'a well-worn book'] },
};
export const GOAL_LABEL: Record<Goal, string> = { liked: 'Be liked by everyone', family: 'Protect family', power: 'Gain influence', love: 'Find true love', respect: 'Earn respect' };
// One cherished keepsake each. Story value only: it can be pinched, hidden, found and returned.
export const KEEPSAKES: Record<string, [string, string]> = {
  mara: ['📖', 'grandma\u2019s recipe book'], tom: ['🎖️', 'his father\u2019s medal'], jen: ['📿', 'her silver locket'], ollie: ['⌚', 'his pocket watch'],
  pip: ['🪃', 'his lucky slingshot'], rosa: ['💎', 'her lucky geode'], wren: ['🐔', 'her carved wooden hen'], edgar: ['📓', 'his little black book'],
  bram: ['🪨', 'his lucky millstone chip'], sol: ['🧭', 'his old sailor’s compass'], posy: ['🌼', 'her pressed-flower book'], agnes: ['🔔', 'her old school bell'],
};

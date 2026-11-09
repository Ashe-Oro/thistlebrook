// The starting cast. Adding a villager = adding an entry (the sim scales to N).
export type Goal = 'wealth' | 'liked' | 'family' | 'power';
export type Job = 'baker' | 'blacksmith' | 'merchant' | 'farmer' | 'woodcutter' | 'miner' | 'tavernkeeper' | 'shepherd';
export interface Traits { kindness: number; honesty: number; bravery: number; sociability: number; greed: number; ambition: number; diligence: number; temper: number; }
export interface VillagerDef {
  id: string; name: string; job: Job; goal: Goal; home: string; family?: string[]; age: string;
  traits: Traits; bio: string; palette: string; skin: string; hair: string; height: number;
  outfit: { pools: Record<string, string[]>; fixed: Record<string, string | string[] | null> };
  catchphrases: string[];
}
const T = (kindness: number, honesty: number, bravery: number, sociability: number, greed: number, ambition: number, diligence: number, temper: number): Traits =>
  ({ kindness, honesty, bravery, sociability, greed, ambition, diligence, temper });

export const VILLAGERS: VillagerDef[] = [
  { id: 'mara', name: 'Mara Thistle', job: 'baker', goal: 'liked', home: 'home-mara', age: 'mid-30s', palette: 'alex', skin: '#e8b48a', hair: '#7a3b1e', height: 1.72,
    traits: T(.85, .8, .4, .85, .25, .4, .75, .2), bio: 'Bakes before dawn and knows everyone by their favourite loaf.',
    outfit: { fixed: { tops: 'apron', headgear: 'chef-hat' }, pools: { hair: ['bun', 'ponytail-low', 'curly-bob'], bottoms: ['long-skirt', 'skirt'], shoes: ['sandals', 'dress-shoe'], accessories: ['necklace', 'gloves'] } },
    catchphrases: ['Fresh out of the oven!', 'Have you eaten?', 'Bread fixes most things.'] },
  { id: 'tom', name: 'Tom Ashby', job: 'blacksmith', goal: 'power', home: 'home-tom', age: 'early 40s', palette: 'knight', skin: '#c68642', hair: '#2b1a10', height: 1.86,
    traits: T(.4, .6, .85, .45, .45, .9, .8, .7), bio: 'Strong arm, short fuse, wants a say in how the village is run.',
    outfit: { fixed: { tops: 'vest', shoes: 'work-boot' }, pools: { hair: ['buzz', 'short-crop', 'bald'], facialHair: ['beard-full', 'beard-short', 'mutton-chops'], bottoms: ['trousers', 'cargo'], accessories: ['gloves', 'bracers'] } },
    catchphrases: ['Iron does not lie.', 'Somebody has to lead.', 'Hmph.'] },
  { id: 'jen', name: 'Jen Marlow', job: 'merchant', goal: 'wealth', home: 'home-jen', age: 'late 20s', palette: 'captain', skin: '#f1c9a5', hair: '#1c1c22', height: 1.7,
    traits: T(.3, .3, .5, .7, .9, .8, .6, .4), bio: 'Runs the general store. Every smile has a price tag.',
    outfit: { fixed: { tops: 'blazer' }, pools: { hair: ['long-straight', 'ponytail-high', 'side-part'], bottoms: ['skirt', 'trousers'], shoes: ['heels', 'dress-shoe'], accessories: ['glasses', 'necklace', 'belt-pouch'], headgear: ['beret', 'feather-cap'] } },
    catchphrases: ['Everything is negotiable.', 'Coin talks.', 'A bargain, just for you.'] },
  { id: 'ollie', name: 'Ollie Fenn', job: 'farmer', goal: 'family', home: 'home-fenn', family: ['pip'], age: 'early 30s', palette: 'autumn', skin: '#d9a066', hair: '#c9a24a', height: 1.8,
    traits: T(.8, .9, .35, .5, .2, .4, .9, .25), bio: 'Works the Fenn fields and worries about his little brother.',
    outfit: { fixed: { bottoms: 'overalls', headgear: 'straw-hat' }, pools: { hair: ['messy', 'short-crop'], facialHair: ['stubble', null as any], tops: ['tee', 'longsleeve'], shoes: ['work-boot', 'boot'] } },
    catchphrases: ['Rain is coming.', 'Pip, be careful!', 'Good soil this year.'] },
  { id: 'pip', name: 'Pip Fenn', job: 'woodcutter', goal: 'liked', home: 'home-fenn', family: ['ollie'], age: 'teen', palette: 'neverland', skin: '#d9a066', hair: '#c9a24a', height: 1.62,
    traits: T(.55, .35, .75, .8, .55, .6, .45, .55), bio: 'Ollie\u2019s restless kid brother. Swings an axe, dreams of being somebody.',
    outfit: { fixed: { outerwear: 'backpack' }, pools: { hair: ['spiky', 'messy', 'mohawk'], tops: ['hoodie', 'tee'], bottoms: ['shorts', 'cargo', 'jeans'], shoes: ['high-top', 'sneaker'], headgear: ['beanie', 'cap-backwards', 'bandana-head'] } },
    catchphrases: ['Watch this!', 'Timber!', 'I can do it myself.'] },
  { id: 'rosa', name: 'Rosa Quill', job: 'miner', goal: 'wealth', home: 'home-quill', family: ['wren'], age: '40s', palette: 'adventurer', skin: '#8d5524', hair: '#141414', height: 1.76,
    traits: T(.5, .9, .9, .35, .55, .7, .85, .55), bio: 'Blunt, tireless, honest to a fault. Wants a nest egg for Wren and her.',
    outfit: { fixed: { headgear: 'mining-helmet', shoes: 'work-boot' }, pools: { hair: ['braids', 'dreadlocks', 'short-crop'], tops: ['tank', 'jacket-open', 'longsleeve'], bottoms: ['cargo', 'jeans'], accessories: ['goggles-forehead', 'gloves'] } },
    catchphrases: ['Say it to my face.', 'Good ore today.', 'Honest work, honest pay.'] },
  { id: 'wren', name: 'Wren Quill', job: 'shepherd', goal: 'family', home: 'home-quill', family: ['rosa'], age: '30s', palette: 'arctic', skin: '#f3d2b3', hair: '#e6d3a3', height: 1.66,
    traits: T(.9, .85, .3, .6, .15, .3, .7, .1), bio: 'Tends the hens and the orchard. Soft-spoken peacemaker.',
    outfit: { fixed: { outerwear: 'satchel' }, pools: { hair: ['long-straight', 'twintails', 'ringlets'], tops: ['tunic', 'sweater', 'leaf-tunic'], bottoms: ['long-skirt', 'leggings'], shoes: ['boot', 'sandals'], headgear: ['bucket-hat', 'headband', null as any] } },
    catchphrases: ['Let\u2019s all calm down.', 'The hens are laying!', 'Be gentle.'] },
  { id: 'edgar', name: 'Edgar Vale', job: 'tavernkeeper', goal: 'power', home: 'home-edgar', age: '50s', palette: 'ninja', skin: '#f0c08e', hair: '#9a9a9a', height: 1.78,
    traits: T(.45, .25, .45, .95, .6, .85, .55, .35), bio: 'Pours the ale and hears every secret. Trades in both.',
    outfit: { fixed: { tops: 'vest', accessories: ['bowtie'] }, pools: { hair: ['side-part', 'bald', 'undercut'], facialHair: ['moustache-handlebar', 'van-dyke', 'moustache'], bottoms: ['trousers', 'breeches'], shoes: ['dress-shoe', 'boot'], headgear: ['flat-cap', 'top-hat', null as any] } },
    catchphrases: ['Did you hear?', 'First round\u2019s on me\u2026 almost.', 'Between you and me\u2026'] },
];

export const JOB_INFO: Record<Job, { label: string; workplace: string; produces: string; verb: string }> = {
  baker: { label: 'Baker', workplace: 'bakery', produces: 'bread', verb: 'baked' },
  blacksmith: { label: 'Blacksmith', workplace: 'smithy', produces: 'tools', verb: 'forged' },
  merchant: { label: 'Merchant', workplace: 'store', produces: 'coins', verb: 'traded' },
  farmer: { label: 'Farmer', workplace: 'fields', produces: 'wheat', verb: 'harvested' },
  woodcutter: { label: 'Woodcutter', workplace: 'forest', produces: 'wood', verb: 'chopped' },
  miner: { label: 'Miner', workplace: 'quarry', produces: 'ore', verb: 'mined' },
  tavernkeeper: { label: 'Tavernkeeper', workplace: 'tavern', produces: 'ale', verb: 'poured' },
  shepherd: { label: 'Hen-keeper', workplace: 'coop', produces: 'eggs', verb: 'gathered' },
};
export const GOAL_LABEL: Record<Goal, string> = { wealth: 'Get rich', liked: 'Be liked by everyone', family: 'Protect family', power: 'Gain power' };

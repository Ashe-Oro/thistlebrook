// Dialogue & narration content library for Thistlebrook.
// Lines are keyed by *situation*. Each situation holds 6-12 short variants (speech-bubble sized, <= 60 chars),
// some gated by the speaker's personality (traits + goal) so the cast sounds like themselves. Selection is
// deterministic via sim.rng so the same seed replays the same conversations.
import type { Sim } from './sim';
import type { Villager } from './types';
import type { Goal } from '../data/villagers';
import type { Anim } from '../agents/avatar';

// Quiet setting captions; choices and timing belong to the fixed-step brain.
export const LEISURE: Record<'ducks' | 'fishing' | 'warmth' | 'stars' | 'watch' | 'sketch' | 'flowers' | 'shelter', { doing: string; thought: string; line: string; anim: Anim; icon: string }> = {
  ducks: { doing: 'scattering grain for the ducks', thought: 'A little grain. There is enough for everyone, you greedy ducks.', line: 'scattered grain for the pond ducks.', anim: 'feed', icon: '🦆' },
  fishing: { doing: 'casting a line off the dock', thought: 'Just me, the morning mist, and a very patient fish.', line: 'cast a hopeful line off the dock in the morning quiet.', anim: 'point', icon: '🎣' },
  warmth: { doing: 'warming hands at the campfire', thought: 'Warm fingers, quiet crackling. That is better.', line: 'held out cold hands to the campfire.', anim: 'give', icon: '🔥' },
  stars: { doing: 'stargazing in the orchard clearing', thought: 'The same stars above all our little worries.', line: 'stopped in the orchard clearing to count the stars.', anim: 'point', icon: '✨' },
  watch: { doing: 'people-watching on a bench', thought: 'Everyone has somewhere to be. I can sit a moment.', line: 'settled on a bench to watch the village go by.', anim: 'sit', icon: '👀' },
  sketch: { doing: 'sketching the school green', thought: 'That crooked roof has character. My drawing has even more.', line: 'sketched the roofs around the school green.', anim: 'pickup', icon: '✏️' },
  flowers: { doing: 'admiring the herb garden flowers', thought: 'Even after a hard day, something here is blooming.', line: 'paused to admire the flowers in the herb garden.', anim: 'feed', icon: '🌼' },
  shelter: { doing: 'waiting out the shower by the tavern door', thought: 'I will wait by the door until this shower passes.', line: 'waited by the tavern door, listening to the rain.', anim: 'idle', icon: '☔' },
};

// --- pronoun helper -------------------------------------------------------
export function pr(v: Villager) {
  const she = v.def.pronouns === 'she';
  return { sub: she ? 'she' : 'he', obj: she ? 'her' : 'him', pos: she ? 'her' : 'his', Sub: she ? 'She' : 'He' };
}

// --- personality predicates ----------------------------------------------
type Pred = (s: Villager) => boolean;
const kind: Pred = s => s.traits.kindness > .6;
const mean: Pred = s => s.traits.kindness < .4;
const honest: Pred = s => s.traits.honesty > .7;
const sly: Pred = s => s.traits.honesty < .4;
const brave: Pred = s => s.traits.bravery > .65;
const timid: Pred = s => s.traits.bravery < .4;
const outgoing: Pred = s => s.traits.sociability > .65;
const shy: Pred = s => s.traits.sociability < .45;
const envious: Pred = s => s.traits.envy > .55;
const ambi: Pred = s => s.traits.ambition > .7;
const diligent: Pred = s => s.traits.diligence > .7;
const hot: Pred = s => s.traits.temper > .6;
const calm: Pred = s => s.traits.temper < .35;
const G = (g: Goal): Pred => s => s.goal === g;

type Variant = string | [string, Pred];

// --- the library ----------------------------------------------------------
const LIB: Record<string, Variant[]> = {
  greeting: [
    'Morning, {t}!', 'Hey {t}!', '{t}! Got a minute?', 'Fine day, {t}.',
    ['There you are, {t}! Come here.', outgoing], ['Well if it isn’t {t}!', outgoing],
    ['Good to see you, {t}.', kind], ['Oh—hello, {t}.', shy], ['Quick word, {t}?', diligent],
    ['{t}. Glad I caught you.', G('power')], ['You. {t}. A moment.', hot], ['Afternoon, {t}. All well?', calm],
  ],
  // small-talk topics (no prices, no money — just village life)
  weather: [
    'Did you see the sky this morning?', 'Rain’s coming, I can feel it.', 'Not a cloud in sight today.',
    'Bit nippy for the season, eh?', 'Good drying weather, this.', '"Red sky at night," my gran said.',
    ['Weather’s fair — work to do.', diligent], ['Lovely light this evening.', calm],
  ],
  hens: [
    'The hens were extra loud today.', 'Wren’s hens are laying again!', 'Fresh eggs this morning, lucky us.',
    'One of the hens got out again.', 'That rooster has no manners.', ['The speckled hen’s my favourite.', kind],
  ],
  forge: [
    'Tom’s forge was roaring today.', 'You can hear the hammer from here.', 'Smells of coal smoke by the smithy.',
    'Tom made a fine hinge, I’ll say that.', 'Sparks flying at the forge again.', ['Tom thinks he runs this place.', ambi],
  ],
  post: [
    'Any letters for me, you think?', 'Jen’s run off her feet with post.', 'Heard the mail coach was late.',
    'A parcel came for someone today.', 'I’m waiting on a letter myself.', ['Jen reads the mail, you know.', sly],
  ],
  woods: [
    'Pip’s been out in the woods all day.', 'The woods are lovely this time o’ year.', 'Mind the old path, it’s muddy.',
    'Heard an owl out past the treeline.', 'Good firewood coming in lately.', ['I don’t go in the woods after dark.', timid],
  ],
  quarry: [
    'Rosa’s been at the quarry since dawn.', 'They blasted stone again today.', 'That new stone’s a lovely grey.',
    'Dusty work, the quarry.', 'Rosa carved a fine lintel.', ['I’d take a turn at the quarry.', brave],
  ],
  gossipTopic: [
    'Have you heard any news?', 'Folks have been talking, haven’t they?', 'Something’s in the air lately.',
    'You always know the latest, {t}.', ['I hear things. I always do.', sly], ['Tell me everything, I’m nosy.', outgoing],
  ],
  // chat reactions
  chatReact: [
    'Tell me about it.', 'Same here!', 'Really?', 'Is that right?', 'You don’t say.', ['Oh, do tell me more.', kind],
  ],
  agree: [
    'Ha! Exactly.', 'My thoughts precisely.', 'Couldn’t agree more.', 'Now that’s the truth.', 'You said it.',
    ['Oh, I like how you put that.', kind], ['Aye, that’s the plain truth.', honest], ['Yes! We think alike.', outgoing],
  ],
  disagree: [
    'Hmm, if you say so.', 'I’m not so sure about that.', 'We’ll have to differ there.', 'Is that so? I wonder.',
    ['No, I don’t think that’s right.', honest], ['Rubbish. Plain rubbish.', hot],
    ['I see it differently, is all.', kind], ['Perhaps. Perhaps not.', calm],
  ],
  snap: [
    'Not now, I’m not in the mood.', 'Do you ever stop talking?', 'Ugh. Whatever.', 'Leave me be, would you?',
    'I’m tired and hungry. Later.', ['Say one more word. Go on.', hot], ['I haven’t the patience today.', hot],
    ['What do YOU want?', mean], ['Please… just not right now.', shy],
  ],
  // gossip
  gossipOpener: [
    'Psst, {t}...', 'Can you keep a secret?', 'You didn’t hear this from me...', 'Lean in, I’ve got one for you.',
    ['Oh, have I got something for you.', sly], ['A little bird told me something.', G('power')],
    ['{t}! You will not believe this.', outgoing], ['I probably shouldn’t say, but...', shy],
  ],
  gossipReactNeg: [
    'No way!', 'I knew it!', 'Unbelievable.', 'Well I never!', 'The nerve of some people.',
    'You’re joking. Tell me more.', ['Ha! Serves them right.', mean], ['Oh, that’s a shame to hear.', kind],
  ],
  gossipReactPos: [
    'How lovely!', 'Good for them.', 'That’s the best news all week.', 'Oh, I’m so pleased!',
    'Aw, that warms the heart.', ['Lucky them, I suppose.', envious],
  ],
  // rumours (lies)
  rumourOpener: [
    'Between you and me, {t}...', 'Don’t repeat this, but...', 'I probably shouldn’t say...', 'Keep this under your hat...',
    ['I have it on good authority...', sly], ['People ought to know this.', mean], ['You’ll want to hear this one.', G('power')],
  ],
  rumourBelieved: [
    'I had no idea!', 'Hmm. That explains a lot.', 'Really?!', 'I always suspected as much.', 'Well. That changes things.',
    ['Ha, so they’re not so perfect.', envious],
  ],
  rumourDisbelieved: [
    'I don’t believe that for a second.', 'Who told you that nonsense?', 'That doesn’t sound right at all.',
    'Pull the other one.', ['That’s a lie and you know it.', honest], ['I won’t hear that about them.', kind],
  ],
  // flirting
  flirt: [
    'You look nice today, {t}.', 'Walk with me a while?', 'I saved you the good seat, {t}.',
    'Your laugh is the best sound here.', 'Is it warm, or is it just you?',
    ['I can’t stop thinking about you.', brave], ['I, um… you look lovely, {t}.', shy],
    ['Fancy a stroll, just us two?', outgoing], ['I’d cross the village to see you.', G('love')],
    ['You brighten my whole day, {t}.', kind],
  ],
  flirtWarm: [
    'Oh, stop it...', 'You’re sweet.', 'I’d like that.', 'Flatterer. ...Go on, then.', 'My, aren’t you bold.',
    ['I—oh. Thank you.', shy], ['Took you long enough to ask!', outgoing],
  ],
  flirtAwkward: [
    'Uh... thanks?', 'I should get back to work.', 'Mm-hm.', 'That’s... nice of you.', 'Haha. Anyway.',
    ['Oh. Um. I—bye.', shy], ['Don’t.', hot],
  ],
  // confession
  confess: [
    '{t}... I can’t keep it in any longer.', '{t}, I think I’m in love with you.',
    'My heart’s made up its mind. It’s you.', 'I’ve wanted to say this so long.', 'No more hiding it — I adore you.',
    ['{t}, I love you. Plain and simple.', brave], ['{t}, there’s something I must say.', shy],
    ['You’re all I think about, {t}.', G('love')],
  ],
  confessYes: [
    'You... really? Because I feel the same.', 'Yes. A hundred times yes.', 'I was hoping you’d say that.',
    'Come here, you.', 'My heart’s been yours for ages.', ['I… yes. Yes!', shy],
  ],
  confessNo: [
    'Oh. Oh no. I’m so sorry...', 'You’re dear to me, but not like that.', 'I... don’t feel the same way.',
    'I wish I could say it back.', 'I’m so sorry. I can’t.', ['You’re lovely, truly — just not for me.', kind],
  ],
  confessHeartbroken: [
    'Right. Of course. Forget I said anything.', 'I understand. Sorry to trouble you.', 'No—no, it’s fine. Really.',
    'Silly of me. Goodnight, {t}.', 'I’ll… see myself out.',
  ],
  // gifts
  giftGiveNormal: [
    'For you, {t}!', 'I thought you could use this.', 'A little something!', 'Here—this made me think of you.',
    'No occasion. Just felt right.', ['Just because you’re you, {t}.', kind], ['Made it myself. Go on, take it.', diligent],
  ],
  giftGiveRomantic: [
    'I, um, made this for you.', 'This made me think of you.', 'For you. Only you.', 'I hope… I hope you like it.',
    ['It’s silly. But it’s yours.', shy], ['I made this with you in mind, {t}.', brave],
  ],
  giftReceiveNormal: [
    'Oh! You shouldn’t have!', 'That’s so kind!', 'You’re a treasure.', 'For me? Well now.', 'Bless you, {v}.',
    ['You’ve made my whole day.', kind],
  ],
  giftReceiveRomantic: [
    'Oh… it’s beautiful.', 'You made this? For me?', 'I’ll treasure it. Truly.', 'My heart. Come here.',
    'You sweet thing.', ['I… don’t know what to say.', shy],
  ],
  // arguments
  argueOpener: [
    'We need to talk.', 'You’ve got some nerve, {t}.', 'I know what you did.', 'Don’t play innocent with me.',
    ['Right. That’s it. Outside.', hot], ['I’ll say this to your face, {t}.', honest],
    ['Stay away from my family.', G('family')], ['A word. Now, if you please.', calm],
  ],
  argueRetort: [
    'Oh, here we go.', 'What now?', 'Leave me alone.', 'You’ve lost your mind.', 'I don’t owe you a thing.',
    ['Say that again. I dare you.', hot], ['Cry about it.', mean], ['Lower your voice, would you.', calm],
  ],
  fightTaunt: [
    'Everyone knows about it!', 'You’re a menace!', 'Say that again!', 'You want trouble?', 'Liar!', 'Take it back!',
    ['I’ve had ENOUGH of you!', hot], ['Come on then, big words!', brave], ['You’re nothing. Nothing!', mean],
  ],
  // reconciliation
  apology: [
    'I’m sorry about before.', 'I’m sorry. Truly.', 'I was out of line. Forgive me?', 'I’ve felt rotten about it.',
    ['I never meant to hurt you, {t}.', kind], ['I was wrong. Plain and simple.', honest],
    ['I… I came to say sorry.', shy], ['Peace? For both our sakes.', G('family')],
  ],
  reconcileAccept: [
    '...Alright. Water under the bridge.', 'Come here, you daft thing.', 'I’ve missed you, if I’m honest.',
    'Let’s put it behind us.', 'Took you long enough. Friends.', ['Of course I forgive you.', kind],
  ],
  reconcileRefuse: [
    'Sorry doesn’t cut it.', 'Not yet. Maybe not ever.', 'You can’t just say sorry and go.',
    'I need time. A lot of it.', 'Fine words. I’ve heard them before.', ['Get out of my sight.', hot],
  ],
  // mediation: a kind bystander steps between two raised voices
  mediate: [
    'Now, now — not like this.', 'Easy, both of you. Breathe.', 'Neighbours! Half the village can hear you.',
    'Whatever it is, it can wait till supper.', 'Come on. You two are better than this.',
    ['Walk with me. Both of you.', calm], ['Please — no shouting on my street.', kind],
  ],
  mediateStandDown: [
    '...Fine. For {m}’s sake.', 'Hmph. Lucky {m} was passing.', 'This isn’t finished. But fine.',
    'Alright, alright. I’m calm.', ['One day {m} won’t be here.', hot], ['Thank you, {m}. I… got carried away.', kind],
  ],
  // friendly-rivalry contests (stone-skipping, races, pie-offs)
  contestChallenge: [
    'Settle it like neighbours: a contest!', 'You and me, {t}. Right here, right now.', 'Loser draws the water for a week!',
    'Put your boasting where your boots are.', ['A friendly wager of pride, {t}?', calm], ['I was born for this.', ambi],
  ],
  contestAccept: [
    'Ha! You’re on.', 'Oh, you’ll regret that.', 'Easiest win of my week.', 'Right. No crying after.',
    ['Gladly. Watch and learn.', brave],
  ],
  contestWin: [
    'Ha-HA! And THAT is how it’s done.', 'The champion will take cider, thanks.', 'Still got it!',
    ['Good game. Honestly.', kind],
  ],
  contestLose: [
    'Best of three? ...No? Fine.', 'You got lucky and we both know it.', 'Well fought. Rematch someday.',
    ['Fair’s fair. Well won.', honest],
  ],
  contestSore: [ 'Rematch. Tomorrow. Same spot.', 'The ground was uneven!', ['This isn’t over.', hot] ],
  // pranks
  prankSpring: [
    'Don’t look at me.', 'Pfft— keep a straight face— pfft—', 'Morning, {t}! Sleep well?',
    ['It was the frog’s idea.', sly], ['You should see your face!', outgoing],
  ],
  prankLaugh: [
    'HA! Alright, that’s a good one.', 'I can’t even be cross. Look at it!', 'You absolute menace. I love it.',
    ['Oh, well played. WELL played.', outgoing],
  ],
  prankGrumble: [
    'Very funny. Hilarious.', 'I know it was you.', 'Grow up, would you?', ['You’ll regret this.', hot],
  ],
  // accusations
  accuseDemand: [
    'Where is {thing}?', 'You took {thing}. Admit it.', 'Give back {thing}, {t}!', 'I know you took it, {t}.',
    ['Hand it over. Now.', hot], ['I’ll ask once. Did you take it?', honest],
  ],
  accuseGuiltyConfess: [
    'Fine. Here. I’m sorry.', '...You caught me. Take it.', 'I shouldn’t have. Forgive me.',
    ['I… I’m so sorry. Here.', shy], ['I feel awful. Please, take it back.', kind],
  ],
  accuseGuiltyDeny: [
    'Me? I would never!', 'I don’t know what you mean.', 'Search me, you’ll find nothing.', 'Prove it.',
    ['Careful who you accuse, {t}.', sly], ['You’ve lost it.', mean],
  ],
  accuseGuiltyReply: [ 'Hmph.', 'We’ll see about that.', 'I don’t believe you.' ],
  accuseInnocent: [
    'What?! I never touched it!', 'How dare you!', 'Me?! I’d do no such thing!', 'That’s a filthy accusation!',
    ['Take that back right now!', hot], ['I’m no thief and you know it!', honest],
  ],
  accuseInnocentReply: [ 'Then who did?', 'Someone took it...', 'I… I’m sorry. I just—' ],
  // theft caught
  theftShoutSelf: [
    'Hey! Give that BACK!', 'Thief! That’s mine!', 'Stop! Put it down!', 'Oi! Hands off!',
  ],
  theftShoutOther: [
    '{t}! {v} just took your {what}!', 'Thief! {v}’s got your {what}, {t}!', 'Stop {v}! {t}, your {what}!',
  ],
  theftOops: [
    'Uh oh...', 'Ah. Time to run.', 'I can explain—later!', 'Not good, not good.',
  ],
  // jealousy
  jealousy: [
    'And what’s so special about them?', 'I saw you two together, you know.', 'Should I just not bother, then?',
    'I thought I meant more to you.', 'Don’t mind me. I’m used to it.',
    ['It’s always them, never me.', envious], ['Go on, choose them. See if I care.', hot],
  ],
  // party
  toast: [
    'To Thistlebrook!', 'Raise your cups, friends!', 'To good neighbours and full cups!', 'Health and happiness, all!',
    'To old friends and new!', 'Drink up, it’s a grand night!', ['Everybody up! A toast!', outgoing],
    ['To the finest village in the land!', G('power')],
  ],
  partyBanter: [
    'Ha! Good one.', 'Cheers, {t}!', 'Remember last spring?', 'More cider!', 'La la laaa~', 'Best night in ages, this.',
    'Who brought the good cheese?', ['Dance with me, {t}!', outgoing],
  ],
  // proposal & wedding
  propose: [
    '{t}… will you marry me?', 'I have a question. The big one, {t}.', 'Grow old with me, {t}?',
    'Marry me, {t}. Here, in Thistlebrook.', ['{t}, marry me. Say yes.', brave],
    ['I practised this all week… {t}, marry me?', shy], ['My heart decided ages ago, {t}.', G('love')],
  ],
  proposeYes: [
    'Yes! Yes, you wonderful fool!', 'Of course I will.', 'Took you long enough. Yes!',
    'A hundred times, yes.', ['I—yes. A thousand times.', shy], ['Finally! YES!', outgoing],
  ],
  proposeNo: [
    'Oh… I’m not ready. Not yet.', 'Ask me again some day. Not today.', 'I love you. But not yet.',
    ['Don’t make me answer that today.', timid], ['I need time. Please.', shy],
  ],
  vows: [
    'I promise you every morning I have.', 'Through rain and harvest, I’m yours.', 'You and me, {t}. Always.',
    'I vow it before everyone: my heart is yours.', 'Every day, {t}. I choose you.',
  ],
  vowsReply: [
    'And I am yours. Always.', 'Then it’s settled. Forever.', 'I do. With all my heart.', 'Always, {t}. Always.',
  ],
  // festival contests
  contestTaunt: [
    'Settle it here and now!', 'Winner takes the bragging rights!', 'Try to keep up.', 'Before the whole village, then!',
    ['You’ll eat those words.', hot], ['May the best of us win.', calm], ['I was born for this.', ambi],
  ],
  contestCheer: [
    'Go on! Go on!', 'Don’t you dare lose!', 'Ha! Did you see that?!', 'A contest! Gather round!', 'My money’s on the angry one!',
  ],
  // lost-pet search
  searchAlarm: [
    '{pet}! {pet}! Here, boy!', 'Has anyone seen {pet}?!', 'He always comes when I whistle. Always!',
    '{pet}’s gone — he’s GONE!',
  ],
  searchJoin: [
    'We’ll find him before dark.', 'He can’t have gone far.', 'I’ll check down by the water.',
    ['Dogs like me. I’ll find him.', kind], ['Probably chasing rabbits again.', calm],
  ],
  searchFound: [
    'There you are, you daft hound!', 'Found him! FOUND HIM!', 'Covered in mud and proud of it.',
    'Come here, you worry of a dog.',
  ],
  // town meeting
  meetingPitch: [
    'Order, order! One matter tonight.', 'Neighbours, lend me your ears.', 'We settle this the Thistlebrook way: a vote.',
    ['Quickly now, some of us have work at dawn.', diligent], ['Listen well — this matters.', G('power')],
  ],
  meetingAye: [
    'Aye!', 'Seconded!', 'Put it to the vote!', 'Get on with it!', 'Hear, hear!',
    ['I have strong opinions on this.', hot], ['Whatever keeps the peace.', calm],
  ],
  // market day (no money changes hands in v1 — it's a social morning at the stalls)
  marketBanter: [
    'Smell those apples!', 'The stalls look grand today.', 'Fresh this morning, promise!',
    'Half the village is out, look.', 'Saved you the best of the basket.', ['I hear all the news at the stalls.', outgoing],
  ],
  // invitations
  inviteAccept: [ 'I’ll be there!', 'Wouldn’t miss it!', 'Count me in.', 'Save me a seat!', ['Try and stop me!', outgoing] ],
  inviteMaybe: [ 'Maybe I’ll stop by.', 'We’ll see.', 'If I finish up in time.', 'Perhaps, perhaps.', ['I’ll… think about it.', shy] ],
  inviteRefuse: [ 'Hmph. We’ll see.', 'Not really my sort of thing.', 'I’d rather not, thanks.', 'Another time, maybe.', ['With that lot? Hardly.', mean] ],
};

const TOPIC_KEYS = ['weather', 'hens', 'forge', 'post', 'woods', 'quarry', 'gossipTopic'];

// Pick a personality- and goal-appropriate line for `sit`, interpolating {t}/{v}/{thing}/{what}
// plus speaker pronoun tokens {sub}/{obj}/{pos}/{Sub}. Deterministic via sim.rng.
export function say(sim: Sim, sp: Villager, sit: string, vars: Record<string, string> = {}): string {
  const pool = LIB[sit];
  if (!pool || !pool.length) return '';
  const eligible = pool.filter(x => typeof x === 'string' || x[1](sp));
  const chosen = sim.rng.pick(eligible.length ? eligible : pool);
  const text = typeof chosen === 'string' ? chosen : chosen[0];
  const p = pr(sp);
  const ctx: Record<string, string> = { sub: p.sub, obj: p.obj, pos: p.pos, Sub: p.Sub, ...vars };
  const h = sim.hour, part = h < 12 ? 'Morning' : h < 17.5 ? 'Afternoon' : 'Evening';
  let out = text.replace(/\{(\w+)\}/g, (_, k) => ctx[k] ?? '').replace(/\b(Morning|Afternoon|Evening)\b/, part).replace(/\bFine day\b/, sim.rain > .4 ? 'Wet one today' : h >= 19.5 || h < 6 ? 'Fine night' : 'Fine day');
  if (sit === 'weather' && sim.rain > .4 && !/rain|wet|drizzl|puddle|damp/i.test(out)) out = (['Some rain, eh?', 'Rain’s good for the gardens, at least.', 'I’m soaked to the bone.', 'My boots are full of puddle.'] as string[])[Math.floor(sim.rng.next() * 4)];
  return out;
}

// A random piece of village small-talk, flavoured by the speaker.
export function smalltalk(sim: Sim, sp: Villager): string { return say(sim, sp, sim.rng.pick(TOPIC_KEYS)); }

/* Handwritten notes stay under fifty words, including greeting and signature. */
export function letterText(sim: Sim, v: Villager, t: Villager, kind: import('./letters').LetterKind, context: string, unsigned: boolean) {
  context = context.replace(/[.!]+$/, '');
  const R = sim.rng, item = /gave \S+ (.+?)(?: and blushed)?$/.exec(context)?.[1]; /* "Wren gave Tom a basket of eggs" -> "a basket of eggs" */
  const about = /over (.+?)(?: boiled over)?$/.exec(context)?.[1];
  const bodies: Record<import('./letters').LetterKind, string[]> = {
    love: ['I have a quiet crush on you. Writing it feels braver than saying it.', 'Someone in this village thinks you are rather wonderful. That someone is blushing over this paper.', 'Every time you pass the well my words run off and hide. So here they are, on paper instead.'],
    apology: [about ? `I keep thinking about our row over ${about}. I was wrong to raise my voice. Could we begin again?` : 'Our argument has stayed with me. I was wrong to raise my voice. Could we begin again?', 'I could not face you today, so I am writing instead. I am sorry for the things I said. Tea, soon?'],
    thanks: item ? [`Thank you for ${item}. It made my whole day.`, `I am still smiling about ${item.replace(/^an? /, 'the ')}. You are kinder than you know.`, `${item[0].toUpperCase() + item.slice(1)}! You shouldn't have. (I am very glad you did.)`] : ['Thank you for your kindness. I wanted you to know it mattered.'],
    invite: [`You are invited to ${context}. I hope there will be a place beside you for me.`, `Come to ${context}? It won't be the same without you.`],
    prank: [context + ' Please prepare a short quack of acceptance.'],
    farewell: ['I understand that we cannot be sweethearts. It still aches a little. I wish you happy days.', 'My heart needs a quiet spell. Thank you for hearing it honestly. May things be gentle between us.'],
    board: [`Three cheers for ${t.first}, our ${t.job}, who makes this village a warmer place.`, `A little appreciation for ${t.first} the ${t.job}. Some kindness deserves to be written down.`, `If you see ${t.first} today, say thank you. You know why. (And if you don't, ask!)`]
  };
  const greeting = kind === 'board' ? 'Dear Thistlebrook,' : R.pick([`Dear ${t.first},`, `${t.first},`, `To ${t.first},`]);
  const signature = unsigned ? kind === 'love' ? '— a secret admirer' : '— a friend of the ducks' : `— ${v.first}`;
  const body = R.pick(bodies[kind]).split(/\s+/).slice(0, 36).join(' ');
  return `${greeting}\n\n${body}\n\n${R.pick(['Warmly,', 'With a small wave,', 'Yours,'])}\n${signature}`;
}

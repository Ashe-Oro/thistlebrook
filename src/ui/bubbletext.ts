// Bubble text: the on-screen speech bubble is a short, cozy line (2–8 words, or an emoji plus a few words).
// The full line / event text is never thrown away: it stays in the chronicle, the villager's story log and
// sim.transcripts. Only the display gets shorter.
import type { SimEvent } from '../sim/types';

const WORDS = 8;
const strip = (s: string) => s.replace(/\s*\(It isn't true\.\)/gi, '').replace(/[“”"]/g, '').replace(/\s+/g, ' ').trim();

/** Shorten a spoken line to bubble length: first sentence, then first clause, then a soft word cap. */
export function shortLine(text: string, max = WORDS): string {
  let t = strip(text); if (!t) return t;
  const words = (s: string) => s.split(' ').filter(Boolean).length;
  if (words(t) <= max) return t;
  // first sentence (keep its ! or ?)
  const sent = /^(.+?[.!?…])(\s|$)/.exec(t); if (sent && words(sent[1]) >= 2) t = sent[1];
  if (words(t) <= max) return t;
  // first clause before a comma / dash / semicolon
  const cl = /^(.+?)(,|\s—|\s–|;|:)\s/.exec(t); if (cl && words(cl[1]) >= 2 && words(cl[1]) <= max) return cl[1].replace(/[.,;:]+$/, '') + '…';
  return t.split(' ').slice(0, max).join(' ').replace(/[.,;:!?—–-]+$/, '') + '…';
}

export type Mood = 'love' | 'angry' | 'sad' | 'happy' | 'secret' | 'cheer' | 'calm';
const MOOD: [Mood, RegExp][] = [
  ['love', /[💗💞💕💘💖💝💍🥰😍💌🌹🌷]/u],
  ['angry', /[💢😠😡😤💥🤨😒🤥]/u],
  ['sad', /[😢😞😟💔😰🥺😔🥹]/u],
  ['secret', /[🤫👀😏🫢🗣]/u],
  ['cheer', /[🎉🍻🥂📣🎆🎪🎶🏆😆😂]/u],
  ['happy', /[😄😊🙂😁👋🎁🌻🤝🐕🍲🍞🧺]/u],
];
/** Pick a gentle mood tint from the bubble's emoji. */
export function moodOf(emoji: string): Mood { for (const [m, re] of MOOD) if (re.test(emoji)) return m; return 'calm'; }

type Who = (id: string) => string;
/**
 * A short bubble variant of a chronicle event, said by its first actor (null when it should stay chronicle-only).
 * Kind-specific phrasing first; otherwise a shortened, de-named version of the event text.
 */
export function eventBubble(e: SimEvent, first: Who): { who: string; text: string; emoji: string } | null {
  const a = e.actors[0], b = e.actors[1]; if (!a || e.imp < 4) return null;
  const B = b ? first(b) : '';
  const T: Record<string, string> = {
    theft: e.icon === '🫳' ? 'Got it back!' : e.icon === '😟' ? 'Where did it go?!' : 'Shh… mine now.',
    burglary: 'Shh… mine now.',
    fight: 'Hmph!',
    argue: B ? `Oh, ${B}, honestly!` : 'Honestly!',
    accuse: B ? `It was you, ${B}!` : 'It was you!',
    gift: B ? `For you, ${B}!` : 'For you!',
    romance: e.icon === '💔' ? 'Oh… I see.' : e.icon === '💍' ? 'Will you…?' : B ? `Oh, ${B}…` : 'Oh, my heart…',
    reconcile: B ? `Friends again, ${B}?` : 'Friends again?',
    ally: B ? `Together, ${B}!` : 'Together!',
    gossip: B ? `Psst… ${B}!` : 'Psst…',
    rumour: 'Have you heard…?',
    letter: 'A letter for me!',
    party: 'Come one, come all!',
    invite: B ? `Come by tonight, ${B}!` : 'Come by tonight!',
    prank: 'Hee hee!',
    mediate: 'Now, now, you two.',
    heartbreak: 'Oh… my heart.',
    wedding: 'What a day!',
    search: e.icon === '🐕' || e.icon === '🐶' ? 'Found him!' : 'Biscuit? Here, boy!',
    meeting: 'Order, order!',
    contest: 'Best of three!',
    showdown: 'You’re on!',
    generous: 'Happy to help!',
    bond: B ? `Good to see you, ${B}!` : 'Good to see you!',
  };
  const text = T[e.kind]; if (!text) return null;
  return { who: a, text, emoji: e.icon };
}

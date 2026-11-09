import type { VillagerDef, Traits, Goal, Job } from '../data/villagers';
import type { MemoryStream } from '../agents/memory';
// v1 has no economy: no money, goods, prices, crops or harvests. Villagers own one cherished keepsake each
// (pure story value: it can be pinched, hidden, found or returned) and give hand-made tokens as gestures.
export interface Keepsake { id: string; name: string; icon: string; owner: string; holder: string; hidden?: boolean; takenAt?: number; }
export interface PlanBlock { from: number; to: number; act: 'sleep' | 'breakfast' | 'work' | 'lunch' | 'stroll' | 'social' | 'evening' | 'event' | 'home'; where?: string; note: string; eventId?: string; }
export interface Action {
  type: 'go' | 'eat' | 'enter' | 'work' | 'sit' | 'idle' | 'social' | 'steal' | 'flee' | 'chase' | 'fight' | 'attend' | 'claim';
  [k: string]: any; t: number; label: string;
}
export interface Stats { stolen: number; gifts: number; fights: number; parties: number; rumours: number; makeups: number; hosted: number; }
export interface Villager {
  id: string; def: VillagerDef; name: string; first: string; job: Job; goal: Goal; traits: Traits;
  x: number; z: number; heading: number; speed: number; path: [number, number][] | null; pathI: number;
  needs: { food: number; energy: number; social: number }; opinion: Record<string, number>; family: string[]; alliance: string | null;
  crush: string | null; partner: string | null; heartbreak: number;
  emotions: { joy: number; anger: number; fear: number; sadness: number; love: number; surprise: number };
  mem: MemoryStream; plan: PlanBlock[]; planDay: number; queue: Action[]; act: Action | null; thought: string; doing: string;
  inside: string | null; busyUntil: number; seat: any; story: { t: number; text: string }[]; stats: Stats;
  lastSocial: Record<string, number>; intent: string | null; avatar: any; anim: string; replan: boolean; wanted: number; achievements: Set<string>;
}
export interface SimEvent { id: number; t: number; text: string; imp: number; actors: string[]; x: number; z: number; kind: string; icon: string; }
export interface Alliance { id: string; name: string; color: string; members: string[]; founded: number; }

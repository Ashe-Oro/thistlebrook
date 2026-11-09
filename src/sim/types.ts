import type { VillagerDef, Traits, Goal, Job } from '../data/villagers';
import type { MemoryStream } from '../agents/memory';
export type Item = 'coins' | 'bread' | 'wheat' | 'wood' | 'ore' | 'tools' | 'eggs' | 'apples' | 'trinket';
export const ITEMS: Item[] = ['coins', 'bread', 'wheat', 'wood', 'ore', 'tools', 'eggs', 'apples', 'trinket'];
export const ITEM_ICON: Record<Item, string> = { coins: '🪙', bread: '🍞', wheat: '🌾', wood: '🪵', ore: '🪨', tools: '🔨', eggs: '🥚', apples: '🍎', trinket: '💎' };
export const FOOD: Partial<Record<Item, number>> = { bread: 45, eggs: 25, apples: 18 };
export type Inv = Record<Item, number>;
export interface PlanBlock { from: number; to: number; act: 'sleep' | 'breakfast' | 'work' | 'lunch' | 'errands' | 'social' | 'evening' | 'event' | 'home'; where?: string; note: string; eventId?: string; }
export interface Action {
  type: 'go' | 'enter' | 'work' | 'sit' | 'idle' | 'social' | 'steal' | 'flee' | 'chase' | 'fight' | 'trade_market' | 'eat' | 'attend' | 'claim';
  [k: string]: any; t: number; label: string;
}
export interface Villager {
  id: string; def: VillagerDef; name: string; first: string; job: Job; goal: Goal; traits: Traits;
  x: number; z: number; heading: number; speed: number; path: [number, number][] | null; pathI: number;
  needs: { food: number; energy: number; social: number }; inv: Inv; opinion: Record<string, number>; family: string[]; alliance: string | null;
  emotions: { joy: number; anger: number; fear: number; sadness: number; love: number; surprise: number };
  mem: MemoryStream; plan: PlanBlock[]; planDay: number; queue: Action[]; act: Action | null; thought: string; doing: string;
  inside: string | null; busyUntil: number; seat: any; story: { t: number; text: string }[]; stats: { stolen: number; gifts: number; trades: number; fights: number; parties: number; earned: number };
  lastSocial: Record<string, number>; intent: string | null; avatar: any; anim: string; replan: boolean; wanted: number; achievements: Set<string>;
}
export interface SimEvent { id: number; t: number; text: string; imp: number; actors: string[]; x: number; z: number; kind: string; icon: string; }
export interface Alliance { id: string; name: string; color: string; members: string[]; founded: number; }

/** JSON-only boundary. Distances are metres, time is simulated seconds; money is integer cents. */
export type Vec2 = [number, number];
export type ToolName = 'walkTo' | 'talkTo' | 'work' | 'buy' | 'sell' | 'payBill' | 'rest' | 'eat' | 'visit';
export type ActivityType = 'sit' | 'picnic' | 'chess' | 'baseball' | 'browse' | 'work' | 'sleep' | 'ride' | 'queue' | 'play' | 'watch';
export type Animation = 'sit' | 'eat' | 'chess' | 'pitch' | 'bat' | 'field' | 'work' | 'idle';
export interface InteractionSlot {
  id: string;
  kind: 'seat' | 'standing' | 'player';
  role?: 'white' | 'black' | 'pitcher' | 'batter' | 'fielder';
  /** Absolute world XZ, not model-local coordinates. */
  position: Vec2;
  /** Yaw in radians, +Z is forward. */
  facing: number;
  /** World seat surface height; renderer adapts the character's hips to this height. */
  seatHeight?: number;
  animation: Animation;
  /** Ordered, collision-free waypoints from the prop entry to this slot. Reversed on exit. */
  approach: Vec2[];
}
export interface Interaction {
  version: 1;
  activity: ActivityType;
  label: string;
  tools: ToolName[];
  duration: number;
  minParticipants: number;
  /** Connected node in the compiler graph. No nearest-node teleporting. */
  entryNode: number;
  /** Ordered collision-free waypoints from entryNode to the prop's circulation area. */
  approach: Vec2[];
  slots: InteractionSlot[];
  hours: [number, number];
  residents?: string[];
  /** Optional baseball coordinates; bases ordered home, first, second, third. */
  game?: { bases: Vec2[]; mound: Vec2; field: Vec2 };
}
export interface Place {
  id: string; name: string; node: number; pos: Vec2;
  kind: string; district?: string; capabilities: ToolName[]; hours: [number, number];
  interaction?: Interaction;
  sellsMeals?: boolean;
  servesFood?: boolean;
  /** Render adapter hint for the two small furnishings supplied by this module. */
  furnishing?: 'picnic' | 'chess';
}
export interface Action {
  tool: ToolName;
  args: { target?: string; slot?: string; activity?: ActivityType; item?: string; bill?: string };
  reason: string;
}
export interface Bill { id: string; label: string; amount: number; dueDay: number; paidDay: number | null }
export interface Relationship { id: string; familiarity: number; sharedActivities: number }
export interface ScheduleBlock { start: number; end: number; label: string; target: string; tool: ToolName }
export interface ResidentContext {
  id: string; name: string;
  district?: string;
  kid?: boolean;
  commute?: { stop: string; school: string; leave: number; missed: number; afternoon: number; missedPm: number };
  job: { title: string; workplace: string; wage: number; product: string | null; shift: [number, number]; commute: number };
  personality: { pace: number; curiosity: number; sociability: number; favourite: ActivityType };
  money: number; bills: Bill[];
  assets: { home: string; inventory: Record<string, number> };
  relationships: Relationship[];
  needs: { energy: number; hunger: number; recreation: number };
  sleep: [number, number];
  schedule: ScheduleBlock[];
  memory: { day: number; worked: number; lastMeal: number; lastBreak: number; lastLeisure: number; lastPurchase: number; lastSale: number; visited: string[]; blocked: Record<string, number>; rode?: Partial<Record<'morning' | 'afternoon', number>> };
  location: { node: number; position: Vec2; place: string | null; slot: string | null };
}
export interface PlaceView extends Place { freeSlots: string[]; participants: string[]; distance: number; weatherAllowsVisit?: boolean; weatherSlotOpen?: boolean }
export interface PlanningContext {
  self: ResidentContext;
  clock: { day: number; hour: number; elapsed: number };
  places: PlaceView[];
  neighbours: { id: string; name: string; place: string | null; activity: ActivityType | null }[];
  weather?: string;
  transit?: boolean;
  passing: boolean;
  greetingTarget: string | null;
}
/** Implement this pure function to replace the scripted planner. No renderer or mutable world is exposed. */
export type Brain = (context: Readonly<PlanningContext>) => Action | null;
export interface ActionResult { ok: boolean; error?: string }

/** @typedef {{tool:string,args:object}} ToolCall */
/** @typedef {{plan:(context:object,world:object)=>ToolCall|null}} Planner */
/** Replace this object with any brain implementing plan(context, world). */
export function createPlanner(){return {kind:'scripted',plan(context,world){
 const beat=context.schedule.filter(s=>s.hour<=context.hour).at(-1);if(!beat)return null;
 if(context.beat!==beat.key)return {tool:'walkTo',args:{place:beat.place}};
 if(!world.arrived(context.id))return null;
 if(context.completed===beat.key)return null;
 if(beat.partner&&world.contexts.has(beat.partner))return {tool:'talkTo',args:{target:beat.partner,text:beat.text,activity:beat.activity}};
 return {tool:beat.tool,args:{activity:beat.activity,...(beat.item?{item:beat.item}:{})}};
 }};}
export function planNext(context,world,planner=createPlanner()){return planner.plan(context,world);}

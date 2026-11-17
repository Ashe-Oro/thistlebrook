import { resolveDestination } from './destinations.js';
/**
 * @typedef {{name:string,argsSchema:object,resultSchema:object,
 * precheck:(args:object,ctx:object,world:object)=>string|null,
 * execute:(args:object,ctx:object,world:object)=>object}} ToolDef
 */
/** @type {Map<string, ToolDef>} */
export const NPC_TOOLS=new Map();
const PROP_TOOLS=new Map();
export const TOOL_NAMES=['walkTo','talkTo','work','buy','sell','payBill','rest','eat','visit'];
export function registerTool(def,scope){if(!def?.name||!def.argsSchema||!def.resultSchema||!def.precheck||!def.execute)throw Error('Incomplete tool definition');(scope==='props'?PROP_TOOLS:NPC_TOOLS).set(def.name,def);return def;}
export const getTool=(name,scope)=>scope==='props'?PROP_TOOLS.get(name)??null:NPC_TOOLS.get(name)??PROP_TOOLS.get(name)??null;
const toolFor=(name,world)=>world?.props?getTool(name,'props')||getTool(name):getTool(name);
export const listTools=()=>[...NPC_TOOLS.values()];
export function precheck(name,args={},ctx,world){
 const t=toolFor(name,world);if(!t)return `unknown tool: ${name}`;
 if(!args||typeof args!=='object'||Array.isArray(args))return 'args must be an object';
 for(const key of t.argsSchema.required)if(args[key]===undefined)return `missing ${key}`;
 for(const [key,value] of Object.entries(args)){const schema=t.argsSchema.properties[key];if(!schema)return `unknown argument ${key}`;if(![].concat(schema.type||schema.oneOf?.flatMap(s=>s.type)||[]).includes(typeof value)||value===null)return `invalid ${key}`;}
 if(!ctx||(!world?.props&&!ctx.id)||!world?.graph)return 'context and graph required';
 return t.precheck(args,ctx,world);
}
export function executeTool(name,args={},ctx,world){const error=precheck(name,args,ctx,world);if(error)return {ok:false,error};return {ok:true,...toolFor(name,world).execute(args,ctx,world)};}
const resultSchema={type:'object',required:['ok'],properties:{ok:{type:'boolean'},error:{type:'string'},action:{type:'object'}}};
for(const name of TOOL_NAMES){
 const properties=name==='walkTo'?{place:{type:['string','object'],minLength:1,minProperties:1,additionalProperties:false,properties:{id:{type:'string'},name:{type:'string'},type:{type:'string'}}}}:name==='talkTo'?{target:{type:'string'},text:{type:'string'},activity:{type:'string'}}:{activity:{type:'string'},item:{type:'string'}};
 registerTool({name,argsSchema:{type:'object',additionalProperties:false,properties,required:name==='walkTo'?['place']:name==='talkTo'?['target','text']:[]},resultSchema,
 precheck(args,ctx,world){
  if(name==='walkTo'&&typeof args.place==='object'&&(Array.isArray(args.place)||!Object.keys(args.place).length||Object.entries(args.place).some(([k,v])=>!['id','name','type'].includes(k)||typeof v!=='string'||!v.trim())))return 'invalid place selector';
  if(name==='walkTo')return resolveDestination(args.place,ctx,world)?null:'destination unreachable';
  if(ctx.currentAction?.tool==='walkTo'&&!world.arrived?.(ctx.id))return 'still walking';
  if(name==='talkTo'){const other=world.contexts?.get(args.target);if(!other)return 'unknown neighbour';if(Math.hypot(ctx.location[0]-other.location[0],ctx.location[1]-other.location[1])>4)return 'neighbour too far away';}
  if(name==='payBill'&&!ctx.bills.length)return 'no bills';return null;
 },execute(args,ctx,world){
  if(name==='walkTo'){const destination=resolveDestination(args.place,ctx,world);world.move(ctx.id,destination);ctx.destination=destination.node;}
  else {world.act?.(ctx.id,name,args);if(['buy','sell','payBill'].includes(name))world.economy?.record(name);
   if(name==='eat')ctx.needs.hunger=Math.max(0,ctx.needs.hunger-40);
   if(name==='rest')ctx.needs.energy=Math.min(100,ctx.needs.energy+30);
   if(name==='talkTo'){ctx.needs.social=Math.max(0,ctx.needs.social-25);const relationship=ctx.relationships.find(r=>r.id===args.target);if(relationship)relationship.interactions++;}
  }
  ctx.currentAction={tool:name,args:{...args},hour:ctx.hour};return {action:ctx.currentAction};
 }});
}

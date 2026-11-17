// Serializable NPC context / state. Keep this JSON-safe (no functions,
// no Three objects). The planner and (later) an LLM brain both read this.

/**
 * @typedef {object} NpcNeeds
 * @property {number} [hunger]
 * @property {number} [energy]
 * @property {number} [social]
 * @property {number} [work]
 */

/**
 * @typedef {object} NpcContext
 * @property {string} id
 * @property {string} name
 * @property {string} job
 * @property {string} [personality]
 * @property {number} money
 * @property {object[]} bills
 * @property {object[]} obligations
 * @property {object[]} assets
 * @property {object[]} inventory
 * @property {object[]} relationships
 * @property {NpcNeeds} needs
 * @property {object[]} schedule
 * @property {number[]} location
 * @property {object|null} currentAction
 * @property {number} [destination] Reachable graph node after walkTo
 * @property {string} [beat] Selected scripted routine key
 * @property {string} [completed] Last completed routine key
 * @property {number} [hour]
 * @property {string} [weekday]
 * @property {string} [weather]
 */

export function createNpcContext(person = {}, extras = {}) {
  return structuredClone({
    id: person.id ?? '',
    name: person.name ?? '',
    job: person.role ?? person.job ?? '',
    personality: extras.personality ?? '',
    money: extras.money ?? 0,
    bills: extras.bills ?? [],
    obligations: extras.obligations ?? [],
    assets: extras.assets ?? [],
    inventory: extras.inventory ?? [],
    relationships: extras.relationships ?? [],
    needs: extras.needs ?? { hunger: 0, energy: 0, social: 0, work: 0 },
    schedule: extras.schedule ?? person.schedule ?? [],
    location: extras.location ?? person.pos ?? [0, 0],
    currentAction: extras.currentAction ?? null,
    hour: extras.hour ?? 0,
    weekday: extras.weekday ?? 'mon',
    weather: extras.weather ?? 'clear',
  });
}

export function serializeContext(ctx) {
  return JSON.stringify(ctx);
}

export function parseContext(json) {
  return typeof json === 'string' ? JSON.parse(json) : json;
}

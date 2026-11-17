# Serializable resident context

`createNpcContext(person, extras)` returns detached JSON-safe state. `serializeContext` and `parseContext` round-trip it. `__life.context('townsfolk-baker')` returns a copy; `__life.contexts()` returns all twelve residents. Scene objects, functions, graph objects and Maps stay in the runtime world, outside context.

Fields: `id`, `name`, `job`, `personality`, `money` (always zero), `bills`, `obligations`, `assets`, `inventory`, `relationships`, `needs` (hunger, energy, social, work), `schedule`, `location` (XZ), `currentAction`, `hour`, `weekday`, `weather`. Runtime adds `destination` (graph node), `beat` and `completed` (routine keys). Relationships hold resident ID, kind and interaction count. Assets identify existing home/workplace catalog entries; they are descriptive, not ownership transactions.

The runtime updates actual location before planning and after movement. Tool execution updates needs, dialogue and relationship interactions. Seek resets needs, relationship counts and the stub counters, then reconstructs the current action; it does not replay economic history. These are ephemeral day-in-the-life states, with no persistence.

IDs retain the catalog spelling, including `townsfolk-blacksmith` for Bram and `townsfolk-watch` for Hugh. No additional character models are spawned.

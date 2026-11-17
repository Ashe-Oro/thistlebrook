# Life routine seek fix

Routine symbols (`home`, `work`, and event slots) now bind to stable registry place IDs and entry nodes. Assigned homes/workplaces retain their lot identity. Walking, seek reconstruction, and social reservations share those nodes. Catalog IDs resolve through registry records; queries skip unreachable matches. Legacy node lookup remains only for graph-only callers without a populated registry.

The original non-walking assertion remains. Regression coverage also checks installation, every routine boundary, registry entry positions, assigned homes/workplaces, repeatable seeks, real registry name/type/catalog-ID queries, and rejection of node fallback with a populated registry.

Validation:
- `npm run test:life-routines`: 8/8 passed.
- `npm run test:checks`: passed, including medium parity.
- `npm run test:world-registry`: 11/11 passed.
- `npm run test:parity`: passed, including the one-ulp rounding perturbation.

Only life routine code/tests and this note changed. Life-off compiled JSON, frozen hashes, and shared art/interiors/medium hooks were not edited. No video recapture, merge, push, or deployment.

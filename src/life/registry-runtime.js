import { buildWorldRegistry, connectRegistryToGraph, registryFailures } from '../world/registry.js';
import { buildWalkGraph } from './graph.js';

// Single compiler hook; default compile output never passes through this function.
export function attachWorldRegistry(town, catalog) {
  town.registry = buildWorldRegistry(town, catalog);
  const graph = town.life?.graph || buildWalkGraph(town, catalog);
  connectRegistryToGraph(town.registry, graph, town, catalog);
  const failures = registryFailures(town.registry, graph, town, catalog);
  town.report.checks.push({ name: 'world-registry', ok: !failures.length, failures, warn: false });
  town.ok = town.report.ok = town.report.ok && !failures.length;
  return town.registry;
}

// Adapters so builder entries can be constructed from plain JSON params.
import { makeHouse, makeTree, makeBush, makeWell, makeFence, makePath, makePlazaRing, makeGate } from '../builders.js';

export const BUILDERS = {
  makeHouse: (p) => makeHouse(p),
  makeTree: (p) => makeTree(p.scale ?? 1, p.seed ?? 0),
  makeBush: (p) => makeBush(p.scale ?? 1),
  makeWell: () => makeWell(),
  // Fence / path pieces are a straight run of `length` along local X / Z.
  makeFence: (p) => makeFence(-p.length / 2, 0, p.length / 2, 0, p.spacing ?? 2),
  makePath: (p) => makePath(0, -p.length / 2, 0, p.length / 2, p.width ?? 2.4),
  // Plaza ring — flat paved loop around the well (inner/outer world radii).
  makePlazaRing: (p) => makePlazaRing(p),
  // Fence gate — posts at x = +-width/2 on the hinge line, leaves swung `open`.
  makeGate: (p) => makeGate(p),
};

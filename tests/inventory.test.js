// Tests des règles d'inventaire : `npm test` (Node 20+, aucun paquet requis).
import { test } from "node:test";
import assert from "node:assert/strict";

import { products, kits } from "../src/data/sampleData.js";
import {
  computeInventory,
  ensembleState,
  kitsReady,
  leatherTotal,
  packMissingByType,
  packOrphans,
  productState,
  productStock,
} from "../src/lib/inventory.js";

const { productsById, reserved } = computeInventory({ products, kits });
const kit = (id) => kits.find((k) => k.id === id);

test("le nombre de kits visés = total des étuis, toutes couleurs", () => {
  assert.equal(leatherTotal(kit("kit-chirurgien")), 8);
});

test("scalpel : 10 en stock, 8 réservés, 2 libres, sous le minimum de 10", () => {
  const state = productState(productsById.scalpel, reserved);
  assert.deepEqual(
    { stock: state.stock, reserved: state.reserved, free: state.free, status: state.status, missing: state.missingForMin },
    { stock: 10, reserved: 8, free: 2, status: "low", missing: 8 }
  );
});

test("paquets : 1 droite + 1 courbe, le surplus est orphelin", () => {
  const needles = productsById["aiguilles-suture"];
  assert.equal(productStock(needles), 9);
  const orphans = Object.fromEntries(packOrphans(needles).map((t) => [t.id, t.orphans]));
  assert.deepEqual(orphans, { droite: 4, courbe: 0 });
  const state = productState(needles, reserved);
  assert.equal(state.reserved, 8);
  assert.equal(state.free, 1);
  const missing = Object.fromEntries(packMissingByType(needles, reserved).map((t) => [t.id, t.missing]));
  assert.deepEqual(missing, { droite: 0, courbe: 4 });
});

test("ensemble : calculé sur le stock LIBRE seulement, rien de réservé", () => {
  const state = ensembleState(productsById["crochet-tourne"], productsById, reserved);
  assert.equal(state.possible, 4);
  const [crochet, tourne] = state.parts;
  assert.deepEqual([crochet.reserved, crochet.free, crochet.forEnsembles, crochet.soloOnly], [3, 11, 6, 5]);
  assert.deepEqual([tourne.reserved, tourne.free, tourne.forEnsembles, tourne.missing], [3, 4, 4, 2]);
});

test("kits prêts : limités par les étuis et par chaque composant", () => {
  assert.equal(kitsReady(kit("kit-chirurgien"), productsById), 8);
  assert.equal(kitsReady(kit("kit-voleur"), productsById), 3);
});

test("la réservation ne dépasse jamais le stock", () => {
  const tiny = [{ id: "x", type: "outil", stock: 2 }];
  const bigKit = [{ id: "k", leather: [{ stock: 5 }], components: [{ productId: "x", qty: 1 }] }];
  const result = computeInventory({ products: tiny, kits: bigKit });
  assert.equal(result.reserved.x, 2);
  assert.equal(kitsReady(bigKit[0], result.productsById), 2);
});

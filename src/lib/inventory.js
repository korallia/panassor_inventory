// Règles d'inventaire Panassor — le « cerveau » de l'application.
// Fonctions pures : elles prennent les données (produits, kits) et
// renvoient les quantités calculées. Aucune dépendance à React, pour
// pouvoir les tester seules (tests/inventory.test.js) et, plus tard, les
// réutiliser telles quelles côté serveur.
//
// Les 3 couches d'une pièce :
//   1. réservée pour les kits (bloquée, jamais comptée ailleurs)
//   2. utilisable par les ensembles (prise dans le stock LIBRE seulement)
//   3. vendable seule (ce qui reste)

const sum = (values) => values.reduce((total, value) => total + value, 0);

/** Nombre de kits visés = total des étuis de cuir, toutes couleurs. */
export function leatherTotal(kit) {
  return sum(kit.leather.map((leather) => leather.stock));
}

/**
 * Stock « réel » d'un produit, en unités vendables.
 * Pour un paquet : nombre de paquets réguliers (1 de chaque type) ; le
 * surplus d'un type ne compte pas (aiguilles orphelines).
 */
export function productStock(product) {
  if (product.type === "paquet") {
    return Math.min(...product.packTypes.map((type) => type.stock));
  }
  return product.stock ?? 0;
}

/** Aiguilles (ou pièces) en trop par type, qui ne forment pas de paquet. */
export function packOrphans(product) {
  const packs = productStock(product);
  return product.packTypes.map((type) => ({ ...type, orphans: type.stock - packs }));
}

/**
 * Quantité réservée pour les kits, par produit.
 * Chaque kit réserve (étuis × qté par kit) de chacun de ses composants,
 * sans dépasser le stock. Les outils au choix réservent l'outil par défaut.
 */
export function reservationsByProduct(kits, productsById) {
  const reserved = {};
  for (const kit of kits) {
    const target = leatherTotal(kit);
    for (const component of kit.components) {
      const product = productsById[component.productId];
      if (!product) continue;
      const already = reserved[product.id] || 0;
      const wanted = target * component.qty;
      const available = productStock(product) - already;
      reserved[product.id] = already + Math.max(0, Math.min(wanted, available));
    }
  }
  return reserved;
}

/** Kits prêts à vendre : limité par les étuis ET par chaque composant. */
export function kitsReady(kit, productsById) {
  const limits = kit.components.map((component) => {
    const product = productsById[component.productId];
    return product ? Math.floor(productStock(product) / component.qty) : 0;
  });
  return Math.min(leatherTotal(kit), ...limits);
}

/** Composants qui empêchent d'atteindre le nombre d'étuis. */
export function kitShortages(kit, productsById) {
  const target = leatherTotal(kit);
  return kit.components
    .map((component) => {
      const product = productsById[component.productId];
      const missing = target * component.qty - (product ? productStock(product) : 0);
      return { product, missing };
    })
    .filter((row) => row.missing > 0);
}

/**
 * Un ensemble ne réserve rien : il se calcule sur le stock LIBRE de ses
 * pièces (ce qui reste après les kits).
 */
export function ensembleState(ensemble, productsById, reserved) {
  const parts = ensemble.components.map((component) => {
    const product = productsById[component.productId];
    const stock = product ? productStock(product) : 0;
    const res = reserved[component.productId] || 0;
    const free = stock - res;
    const needed = (ensemble.objective || 0) * component.qty;
    const forEnsembles = Math.min(free, needed);
    return {
      product,
      qty: component.qty,
      stock,
      reserved: res,
      free,
      forEnsembles,
      soloOnly: free - forEnsembles,
      missing: Math.max(0, needed - free),
      possible: Math.floor(free / component.qty),
    };
  });
  const possible = parts.length ? Math.min(...parts.map((part) => part.possible)) : 0;
  return { possible, objective: ensemble.objective || 0, parts };
}

/** État d'un stock : « out » (rupture), « low » (sous le minimum) ou « ok ». */
export function stockStatus(have, min) {
  if (have <= 0) return "out";
  return have < min ? "low" : "ok";
}

/**
 * Vue unifiée d'un produit pour le registre et les fiches :
 * { stock, reserved, free, min, status, missingForMin }.
 */
export function productState(product, reserved) {
  const stock = productStock(product);
  const res = reserved[product.id] || 0;
  const free = stock - res;
  const min = product.min ?? 0;
  return {
    stock,
    reserved: res,
    free,
    min,
    missingForMin: Math.max(0, min - free),
    status: stockStatus(free, min),
  };
}

/**
 * Pour un paquet : ce qu'il manque de CHAQUE type pour atteindre
 * « réservé + minimum libre » paquets.
 */
export function packMissingByType(product, reserved) {
  const target = (reserved[product.id] || 0) + (product.min ?? 0);
  return product.packTypes.map((type) => ({
    ...type,
    missing: Math.max(0, target - type.stock),
  }));
}

/**
 * Objectif « N kits + base par outil » → besoin par pièce.
 * besoin = base à l'unité + N × qté par kit.
 */
export function objectiveNeeds(objective, kit, productsById) {
  if (!kit) return [];
  return kit.components.map((component) => {
    const product = productsById[component.productId];
    const forKits = objective.kitCount * component.qty;
    // Quantité à l'unité propre à chaque pièce, sinon la valeur par défaut.
    const base = objective.perPiece?.[component.productId] ?? objective.basePerTool ?? 0;
    const target = base + forKits;
    const stock = product ? productStock(product) : 0;
    return { product, base, forKits, target, stock, missing: Math.max(0, target - stock) };
  });
}

/** Tout calculer d'un coup pour l'application. */
export function computeInventory({ products, kits }) {
  const productsById = Object.fromEntries(products.map((product) => [product.id, product]));
  const reserved = reservationsByProduct(kits, productsById);
  return { productsById, reserved };
}

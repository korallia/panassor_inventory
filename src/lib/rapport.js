// Rapport et alertes : calculs communs à la page Alertes (navigateur) et à
// l'envoi automatique du rapport sur Discord (serveur, server/rapport.js).
// Fonctions pures : elles prennent les données de l'atelier et renvoient du texte ou des listes.
import { ensembleState, kitsReady, leatherTotal, productState, rawPacks, stockStatus, withLeatherMinimums } from "./inventory.js";

const plural = (n, one, many) => (n === 1 ? one : many);

/** Toutes les alertes : kits, étuis (par couleur), outils, ensembles, avec leurs 3 manques. */
export function buildAlerts({ kits, products, collections, productsById, reserved }) {
  const collectionName = Object.fromEntries(collections.map((c) => [c.id, c.name]));
  const list = [];
  for (const kit of kits) {
    const ready = kitsReady(kit, productsById);
    const miss = Math.max(0, kit.min - ready);
    list.push({
      id: kit.id,
      status: stockStatus(ready, kit.min),
      name: kit.name,
      units: ["kit", "kits"],
      have: ready,
      need: kit.min,
      missing: { total: miss, libre: 0, reserve: miss },
      to: `/kits/${kit.id}`,
      collection: collectionName[kit.collectionId],
    });
    for (const leather of kit.leather) {
      const m = Math.max(0, (leather.min ?? 0) - leather.stock);
      list.push({
        id: `${kit.id}-${leather.color}`,
        status: stockStatus(leather.stock, leather.min ?? 0),
        name: `Étuis ${leather.color.toLowerCase()}`,
        units: ["étui", "étuis"],
        have: leather.stock,
        need: leather.min ?? 0,
        missing: { total: m, libre: 0, reserve: m },
        to: `/kits/${kit.id}`,
        collection: collectionName[kit.collectionId],
      });
    }
  }
  for (const product of products) {
    if (product.type === "ensemble") {
      const state = ensembleState(product, productsById, reserved);
      const m = Math.max(0, state.objective - state.possible);
      list.push({
        id: product.id,
        status: stockStatus(state.possible, state.objective),
        name: product.name,
        units: ["ensemble", "ensembles"],
        have: state.possible,
        need: state.objective,
        missing: { total: m, libre: m, reserve: 0 },
        to: `/produits/${product.id}`,
        collection: collectionName[product.collectionId],
      });
      continue;
    }
    const state = productState(product, reserved);
    // Le vrai stock, même négatif (ventes non comblées) : −3 s'affiche −3, et
    // le manque compte ces 3 pièces déjà vendues par-dessus l'objectif.
    const rawStock =
      product.type === "paquet" ? rawPacks(product) : product.stock ?? 0;
    const target = kits.reduce(
      (sum, kit) => sum + leatherTotal(kit) * kit.components.filter((c) => c.productId === product.id).reduce((q, c) => q + c.qty, 0),
      0
    );
    list.push({
      id: product.id,
      status: state.status,
      name: product.name,
      units: product.type === "paquet" ? ["paquet", "paquets"] : null,
      have: rawStock,
      need: target + state.min,
      missing: {
        total: Math.max(0, target + state.min - rawStock),
        libre: state.missingForMin,
        reserve: Math.max(0, target - state.reserved),
      },
      to: `/produits/${product.id}`,
      collection: collectionName[product.collectionId],
    });
  }
  return list;
}

// Une alerte = il en manque, ou il ne reste plus rien (même sans minimum fixé).
export const isAlert = (alert) => alert.missing.total > 0 || alert.have <= 0;
// Plus c'est loin de la cible (en proportion), plus c'est haut.
export const gap = (alert) => (alert.missing.total > 0 ? alert.missing.total / Math.max(alert.need, 1) : 1);


export function missingText(alert) {
  const n = alert.missing.total;
  if (n === 0) return "Aucun en stock";
  return alert.units ? `Manque ${n} ${plural(n, ...alert.units)}` : `Manque ${n}`;
}


export function groupByCollection(alerts, collections) {
  return collections
    .map((collection) => ({ name: collection.name, alerts: alerts.filter((a) => a.collection === collection.name) }))
    .filter((group) => group.alerts.length > 0);
}


// Ce qui a été commandé : les kits par leur nom, les pièces vendues seules par leur nom (×n).
export function orderTitle(order) {
  const parts = [];
  for (const item of order.items) {
    const label = item.source || (item.qty > 1 ? `${item.name} ×${item.qty}` : item.name);
    if (!parts.includes(label)) parts.push(label);
  }
  return parts.join(", ");
}


/** Couleur d'urgence d'une alerte, en pastille Discord. */
function dot(alert) {
  const g = gap(alert);
  return g >= 0.99 ? "🔴" : g >= 0.5 ? "🟠" : "🟡";
}

/**
 * Le rapport en texte Discord. data = { kits, products, collections, productsById,
 * reserved, pendingOrders } ; sections = ["alertes", "kits", "stock"].
 */
export function buildReportText(data, { title = "Rapport hebdomadaire", date = new Date(), sections = ["alertes", "kits", "stock"] } = {}) {
  const { kits, products, collections, productsById, reserved } = data;
  const urgent = data.pendingOrders || [];
  const has = (id) => sections.includes(id);
  const alerts = buildAlerts(data).filter(isAlert).sort((a, b) => gap(b) - gap(a) || b.missing.total - a.missing.total);
  const groups = groupByCollection(alerts, collections);
  const n = (value) => (value < 0 ? `−${Math.abs(value)}` : value);
  const day = date.toLocaleDateString("fr-CA", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "America/Toronto" });
  const out = [`## ${title}`, `*${day}*`];
  if (has("alertes")) {
    if (urgent.length) {
      out.push("", `### ⚠️ Commandes à combler · ${urgent.length}`);
      for (const order of urgent) {
        out.push(`**#${order.orderNumber || "?"}** ${orderTitle(order)} — ${order.qty - order.missing} / ${order.qty}`);
        for (const item of order.items.filter((i) => i.missing > 0)) out.push(`> ${item.name} : manque ${item.missing}`);
      }
    }
    out.push("", `### Alertes · ${alerts.length}`);
    if (!alerts.length) out.push("Tout est au-dessus du minimum.");
    for (const g of groups) {
      out.push(`**${g.name}** · ${g.alerts.length}`);
      for (const a of g.alerts) out.push(`${dot(a)} ${a.name} — ${n(a.have)} / ${a.need} · ${missingText(a)}`);
    }
  }
  if (has("kits")) {
    out.push("", "### Kits prêts");
    for (const kit of kits) {
      const ready = kitsReady(kit, productsById);
      out.push(`${ready >= kit.min ? "🟢" : "🔴"} ${kit.name} — **${ready}** (minimum ${kit.min})`);
    }
  }
  if (has("stock")) {
    // Un tableau aligné par collection (bloc de code : police à chasse fixe sur Discord).
    out.push("", "### Stock libre");
    for (const c of collections) {
      const rows = [
        ...products
          .filter((p) => p.collectionId === c.id && p.type !== "ensemble")
          .map((p) => [p.name, `${productState(p, reserved).free}${p.type === "paquet" ? " paq." : ""}`]),
        ...products
          .filter((p) => p.collectionId === c.id && p.type === "ensemble")
          .map((p) => [p.name, `${ensembleState(p, productsById, reserved).possible} ens.`]),
      ];
      if (!rows.length) continue;
      const width = Math.max(...rows.map(([name]) => name.length)) + 3;
      out.push(`**${c.name}**`, "```", ...rows.map(([name, value]) => `${name.padEnd(width, " ")}${value.padStart(8, " ")}`), "```");
    }
  }
  out.push("", "-# Envoyé par Panassor · Atelier");
  return out.join("\n");
}

/** Date du rapport à Montréal, en AAAA-MM-JJ (nom du fichier joint). */
export function reportDate(date = new Date()) {
  return date.toLocaleDateString("en-CA", { timeZone: "America/Toronto" });
}

/**
 * Le stock complet en tableau (CSV, s'ouvre dans Sheets ou Excel), joint au
 * message Discord : une ligne par pièce, étui, kit et ensemble.
 */
export function buildStockCsv(data) {
  const { kits, products, collections, productsById, reserved } = data;
  const cell = (value) => {
    const text = value == null ? "" : String(value);
    return /[",;\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const rows = [["Collection", "Produit", "Type", "En stock", "Réservé kits", "Libre", "Minimum", "Manque"]];
  const name = Object.fromEntries(collections.map((c) => [c.id, c.name]));
  for (const c of collections) {
    for (const kit of kits.filter((k) => k.collectionId === c.id)) {
      const ready = kitsReady(kit, productsById);
      rows.push([c.name, kit.name, "Kit (prêts)", ready, "", "", kit.min, Math.max(0, kit.min - ready)]);
      for (const leather of withLeatherMinimums(kit).leather) {
        rows.push([c.name, `Étui ${leather.color.toLowerCase()}`, "Étui", leather.stock, "", "", leather.min ?? 0, Math.max(0, (leather.min ?? 0) - leather.stock)]);
      }
    }
    for (const p of products.filter((x) => x.collectionId === c.id)) {
      if (p.type === "ensemble") {
        const st = ensembleState(p, productsById, reserved);
        rows.push([c.name, p.name, "Ensemble (possibles)", st.possible, "", st.possible, st.objective, Math.max(0, st.objective - st.possible)]);
        continue;
      }
      const st = productState(p, reserved);
      const raw = p.type === "paquet" ? rawPacks(p) : p.stock ?? 0;
      const type = p.type === "paquet" ? "Paquets" : p.type === "outil" ? "Outil" : "Pièce";
      rows.push([name[p.collectionId], p.name, type, raw, st.reserved, st.free, st.min, st.missingForMin]);
      if (p.type === "paquet") {
        for (const t of p.packTypes) rows.push([c.name, `${p.name} — ${t.name.toLowerCase()}`, "À l'unité", t.stock, "", "", "", ""]);
      }
    }
  }
  // BOM : Excel lit les accents correctement.
  return "\uFEFF" + rows.map((row) => row.map(cell).join(",")).join("\r\n");
}

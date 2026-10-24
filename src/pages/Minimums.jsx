// Minimums : seulement les seuils, groupés par collection (un cadre par
// collection : on voit où elle commence et où elle finit).
//   - kit      : minimum de kits prêts. En le changeant :
//                · les étuis sont répartis entre les couleurs, le reste de la
//                  division sur la première (7 kits, 2 couleurs → 4 + 3).
//                  On peut ensuite régler chaque étui à la main ;
//                · le « en kit » de chaque pièce suit (kits × quantité).
//   - pièce    : minimum en vente libre (à régler) + en kit (calculé) = total.
//   - ensemble : nombre d'ensembles à pouvoir faire.
// Vraies données : chaque changement est enregistré en base (table minimums).
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { useInventory } from "../store.jsx";
import { kitMinimumFor, splitKitMinimum } from "../lib/inventory.js";
import { PageHeader, SampleNote } from "../components/ui.jsx";

export default function Minimums() {
  const { collections, kits, products, dispatch, source, saveMinimum } = useInventory();
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState({ collection: "", type: "" });

  // Vraies données : chaque changement est aussi enregistré en base.
  const clean = (value) => Math.max(0, Math.round(Number(value) || 0));
  const save = (productId, value, variantId = null) => {
    if (source === "live") saveMinimum({ productId, variantId, minimum: clean(value) });
  };
  // Changer le minimum de kits répartit aussi les étuis (et les enregistre).
  const changeKitMinimum = (kit, value) => {
    dispatch({ type: "setKitMin", kitId: kit.id, value });
    save(kit.id, value);
    const shares = splitKitMinimum(clean(value), kit.leather.length);
    kit.leather.forEach((leather, index) => {
      if (leather.variantId) save(kit.id, shares[index], leather.variantId);
    });
  };
  const needle = query.trim().toLowerCase();
  const matches = (name) => !needle || name.toLowerCase().includes(needle);
  const showType = (type) => !filters.type || filters.type === type;
  const byName = (a, b) => a.name.localeCompare(b.name, "fr");

  return (
    <div className="flex flex-col gap-6">
      <PageHeader eyebrow="Configuration" title="Minimums">
        <input
          aria-label="Rechercher"
          placeholder="Rechercher…"
          className="field w-[260px]!"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </PageHeader>

      {/* Comme l'Inventaire : onglets de collection. */}
      <div className="flex flex-wrap items-end justify-between gap-x-6 border-b border-line">
        <div role="tablist" aria-label="Collection" className="flex overflow-x-auto">
          {[{ id: "", name: "Toutes" }, ...collections].map((collection) => {
            const selected = filters.collection === collection.id;
            return (
              <button
                key={collection.id || "toutes"}
                role="tab"
                aria-selected={selected}
                onClick={() => setFilters((current) => ({ ...current, collection: collection.id }))}
                className={`sc h-12 shrink-0 cursor-pointer border-0 border-b-2 bg-transparent px-5 text-[16px] tracking-[.12em] ${
                  selected ? "border-gold text-cream" : "border-transparent text-muted2 hover:text-cream"
                }`}
              >
                {collection.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Pleine largeur comme les autres pages. Une carte par kit. En haut, le bandeau : le minimum de kits et les étuis
          sur la même ligne. En dessous, les pièces (vente libre, en kit, total)
          puis les ensembles. Les cases se modifient au clic. */}
      <div className="flex w-full flex-col gap-7">
        {collections
          .filter((collection) => !filters.collection || collection.id === filters.collection)
          .map((collection) => {
            const kit = kits.find((k) => k.collectionId === collection.id);
            const pieces = showType("piece")
              ? products.filter((p) => p.collectionId === collection.id && p.type !== "ensemble" && matches(p.name)).sort(byName)
              : [];
            const ensembles = showType("ensemble")
              ? products
                  .filter((p) => p.collectionId === collection.id && p.type === "ensemble" && matches(p.name))
                  .sort(byName)
              : [];
            const kitMatches = kit && (matches(kit.name) || kit.leather.some((l) => matches(l.color)));
            if (!kitMatches && pieces.length === 0 && ensembles.length === 0) return null;

            return (
              <section key={collection.id} className="border border-line bg-panel">
                {/* Bandeau du kit : début de la collection */}
                {/* En-tête : même fond, police, taille et couleur que les rangées de kit de l'Inventaire. Le nom,
                    puis, après un espace net, les kits et les étuis, groupés et bien lisibles. */}
                <div
                  className="flex flex-wrap items-center gap-x-8 gap-y-3 border-b border-line/35 px-6 py-4"
                  style={{ background: "linear-gradient(90deg,rgba(200,155,60,.16),rgba(200,155,60,.03))" }}
                >
                  {kit ? (
                    <Link to={`/kits/${kit.id}`} className="text-[27px] font-semibold text-cream! no-underline">
                      {kit.name}
                    </Link>
                  ) : (
                    <span className="sc text-[18px] tracking-[.14em] text-gold">{collection.name}</span>
                  )}
                  {kit && (
                    <div className="flex flex-wrap items-center gap-x-7 gap-y-3 sm:ml-6">
                      <span className="flex items-center gap-3">
                        <span className="sc text-[14px] tracking-[.16em] text-gold-light">Kits</span>
                        <NumberBox large label={`Minimum ${kit.name}`} value={kit.min ?? 0} onChange={(value) => changeKitMinimum(kit, value)} />
                      </span>
                      {kit.leather.map((leather) => (
                        <span key={leather.color} className="group flex items-center gap-3 text-[18px] text-parch">
                          {/* Pastille ronde, un seul contour clair : les couleurs foncées (noir, brun)
                              restent visibles sur le fond doré. Elle s'allume avec sa case. */}
                          <span
                            className="h-5 w-5 shrink-0 rounded-full border border-muted/70 group-focus-within:border-gold group-focus-within:ring-1 group-focus-within:ring-gold"
                            style={{ background: leather.swatch }}
                          />
                          {leather.color}
                          <NumberBox
                            label={`Minimum étui ${leather.color}`}
                            value={leather.min ?? 0}
                            onChange={(value) => {
                              dispatch({ type: "setLeatherMin", kitId: kit.id, color: leather.color, value });
                              if (leather.variantId) save(kit.id, value, leather.variantId);
                            }}
                          />
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {pieces.length > 0 && (
                  <>
                    <Row head name="Pièces" free="Vente libre" kit="En kit" total="Total" />
                    {pieces.map((product) => {
                      const inKit = kitMinimumFor(product.id, kits);
                      const free = product.min ?? 0;
                      return (
                        <Row
                          key={product.id}
                          name={
                            <Link to={`/produits/${product.id}`} className="text-parch!">
                              {product.name}
                              {product.type === "paquet" && <span className="sub ml-2">paquets</span>}
                            </Link>
                          }
                          free={
                            <NumberBox
                              underlined
                              label={`Minimum libre ${product.name}`}
                              value={free}
                              onChange={(value) => {
                                dispatch({ type: "setMin", productId: product.id, value });
                                save(product.id, value);
                              }}
                            />
                          }
                          kit={inKit > 0 ? inKit : "—"}
                          total={free + inKit}
                        />
                      );
                    })}
                  </>
                )}

                {ensembles.length > 0 && (
                  <>
                    <Row head name="Ensemble" free="À pouvoir faire" />
                    {ensembles.map((product) => (
                      <Row
                        key={product.id}
                        name={
                          <Link to={`/produits/${product.id}`} className="text-parch!">
                            {product.name}
                          </Link>
                        }
                        free={
                          <NumberBox
                            underlined
                            label={`Minimum ${product.name}`}
                            value={product.objective ?? 0}
                            onChange={(value) => {
                              dispatch({ type: "setObjective", productId: product.id, value });
                              save(product.id, value);
                            }}
                          />
                        }
                      />
                    ))}
                  </>
                )}
              </section>
            );
          })}
      </div>
      <SampleNote />
    </div>
  );
}

/** Une ligne de la carte : nom, puis vente libre, en kit et total serrés côte à côte. */
function Row({ name, free = null, kit = null, total = null, head = false }) {
  const cell = "flex justify-center tabular-nums";
  if (head) {
    return (
      <div className="grid grid-cols-[minmax(300px,560px)_repeat(3,minmax(190px,1fr))] items-center border-b border-line/40 px-6 pt-3.5 pb-2">
        <span className="th border-0! p-0! text-[15px]!">{name}</span>
        <span className="th border-0! p-0! text-[15px]! text-center!">{free}</span>
        <span className="th border-0! p-0! text-[15px]! text-center!">{kit}</span>
        <span className="th border-0! p-0! text-[15px]! text-center!">{total}</span>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-[minmax(300px,560px)_repeat(3,minmax(190px,1fr))] items-center border-b border-line/25 px-6 py-2.5 text-[22px] last:border-b-0 hover:bg-gold/8">
      <span className="min-w-0">{name}</span>
      <span className={cell}>{free}</span>
      <span className={`${cell} text-[25px] font-semibold text-gold`}>
        {kit !== null && <span className="inline-block min-w-[34px] border-b border-gold/70 pb-0.5 text-center">{kit}</span>}
      </span>
      <span className={`${cell} text-[27px] font-semibold text-cream`}>
        {total !== null && <span className="inline-block min-w-[34px] border-b border-gold/70 pb-0.5 text-center">{total}</span>}
      </span>
    </div>
  );
}

/**
 * Petite case fine, toujours visible : on clique et on tape. Elle s'allume
 * en or pendant qu'on écrit. Entrée ou clic ailleurs enregistre, Échap
 * annule, flèches haut / bas = ±1.
 */
function NumberBox({ value, onChange, label, large = false, underlined = false }) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);

  const commit = () => {
    const next = Math.max(0, Math.round(Number(draft) || 0));
    setDraft(String(next));
    if (next !== value) onChange(next);
  };
  const color = value === 0 && draft === "0" ? "text-muted2" : "text-cream";
  const input = (extra) => (
    <input
      aria-label={label}
      inputMode="numeric"
      className={`bg-ink text-center tabular-nums outline-none selection:bg-gold/40 ${color} ${extra}`}
      value={draft}
      onFocus={(event) => event.target.select()}
      onChange={(event) => setDraft(event.target.value.replace(/\D/g, "").slice(0, 5))}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.target.blur();
        if (event.key === "Escape") {
          setDraft(String(value));
          event.target.blur();
        }
        if (event.key === "ArrowUp" || event.key === "ArrowDown") {
          event.preventDefault();
          const next = Math.max(0, (Number(draft) || 0) + (event.key === "ArrowUp" ? 1 : -1));
          setDraft(String(next));
          onChange(next);
        }
      }}
    />
  );

  // Vente libre : case plus grande, avec un petit trait doré sous le chiffre
  // (comme sous En kit et Total). Toute la case s'allume quand on écrit.
  if (underlined) {
    return (
      <label className="flex h-[48px] w-[72px] cursor-text items-center justify-center border border-muted/70 bg-ink focus-within:border-gold focus-within:ring-1 focus-within:ring-gold">
        {input("w-[40px] border-0 border-b border-gold/70 pb-0.5 text-[22px] leading-tight")}
      </label>
    );
  }
  return input(
    `h-[36px] border border-muted/70 focus:border-gold focus:ring-1 focus:ring-gold ${large ? "w-[52px] text-[20px]" : "w-[46px] text-[17px]"}`
  );
}

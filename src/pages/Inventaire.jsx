// 1A — Registre.
// Pas de ligne d'étui ici : le kit est une ligne à part, plus grosse, avec
// seulement le nombre de kits prêts et son état.
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { useInventory } from "../store.jsx";
import { ensembleState, kitsReady, productState, stockStatus } from "../lib/inventory.js";
import { PageHeader, SampleNote, StatusPill, typeLabel, unitFor } from "../components/ui.jsx";

const STATUS_RANK = { out: 0, low: 1, ok: 2 };

const SORTS = {
  dispo: { label: "Trier : disponible (bas → haut)", fn: (a, b) => a.free - b.free || a.name.localeCompare(b.name, "fr") },
  nom: { label: "Trier : nom", fn: (a, b) => a.name.localeCompare(b.name, "fr") },
  reserve: { label: "Trier : réservé (haut → bas)", fn: (a, b) => (b.reserved ?? -1) - (a.reserved ?? -1) },
  etat: { label: "Trier : état (rupture d'abord)", fn: (a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status] || a.free - b.free },
};

function useRegister() {
  const { collections, products, kits, productsById, reserved } = useInventory();

  return useMemo(() => {
    const kitComponentIds = new Set(kits.flatMap((kit) => kit.components.map((c) => c.productId)));
    const rows = products.map((product) => {
      if (product.type === "ensemble") {
        const state = ensembleState(product, productsById, reserved);
        return {
          product,
          name: product.name,
          free: state.possible,
          reserved: null,
          total: null,
          min: state.objective,
          status: stockStatus(state.possible, state.objective),
        };
      }
      const state = productState(product, reserved);
      return {
        product,
        name: product.name,
        free: state.free,
        reserved: state.reserved,
        total: state.stock,
        min: state.min,
        status: state.status,
        inKit: kitComponentIds.has(product.id),
      };
    });

    const kitRows = kits.map((kit) => {
      const ready = kitsReady(kit, productsById);
      return { kit, ready, status: stockStatus(ready, kit.min), isKit: true, name: kit.name, free: ready, reserved: null };
    });

    return { collections, rows, kitRows };
  }, [collections, products, kits, productsById, reserved]);
}

export default function Inventaire() {
  const { collections, rows, kitRows } = useRegister();
  const [collectionId, setCollectionId] = useState("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("dispo");

  const visibleCollections = collections.filter((c) => collectionId === "all" || c.id === collectionId);
  const needle = query.trim().toLowerCase();
  const matches = (name) => !needle || name.toLowerCase().includes(needle);

  // Tri par nom : on garde les collections, le kit sert de séparateur.
  // Les autres tris sont globaux : une seule liste, toutes collections mêlées.
  const grouped = sort === "nom";
  const collectionNames = Object.fromEntries(collections.map((c) => [c.id, c.name]));
  const groups = grouped
    ? visibleCollections.map((collection) => ({
        collection,
        kits: kitRows.filter((row) => row.kit.collectionId === collection.id && matches(row.kit.name)),
        rows: rows.filter((row) => row.product.collectionId === collection.id && matches(row.name)).sort(SORTS[sort].fn),
      }))
    : [
        {
          collection: { id: "global" },
          kits: [],
          rows: [...kitRows, ...rows]
            .filter((row) => visibleCollections.some((c) => c.id === (row.kit ?? row.product).collectionId) && matches(row.name))
            .sort(SORTS[sort].fn),
          collectionNames,
        },
      ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader eyebrow="Registre" title="Inventaire">
        <input
          aria-label="Rechercher"
          placeholder="Rechercher un produit…"
          className="field w-[260px]!"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </PageHeader>

      <div className="flex flex-wrap items-end justify-between gap-x-6 border-b border-line">
        <div role="tablist" aria-label="Collection" className="flex overflow-x-auto">
          {[{ id: "all", name: "Toutes" }, ...collections].map((collection) => {
            const selected = collectionId === collection.id;
            return (
              <button
                key={collection.id}
                role="tab"
                aria-selected={selected}
                onClick={() => setCollectionId(collection.id)}
                className={`sc h-12 shrink-0 cursor-pointer border-0 border-b-2 bg-transparent px-5 text-[16px] tracking-[.12em] ${
                  selected ? "border-gold text-cream" : "border-transparent text-muted2 hover:text-cream"
                }`}
              >
                {collection.name}
              </button>
            );
          })}
        </div>
          <div className="flex flex-wrap items-center gap-3 py-2">
            <select
              aria-label="Trier"
              className="field w-auto! bg-panel2! text-gold-light!"
              value={sort}
              onChange={(event) => setSort(event.target.value)}
            >
              {Object.entries(SORTS).map(([key, value]) => (
                <option key={key} value={key}>
                  {value.label}
                </option>
              ))}
            </select>
          </div>
      </div>

      <RegisterTable groups={groups} />
      <SampleNote />
    </div>
  );
}

function RegisterTable({ groups }) {
  return (
    <div className="overflow-x-auto border border-line bg-panel">
      <table className="w-full min-w-[760px] border-collapse">
        <thead>
          <tr>
            <th className="th">Produit</th>
            <th className="th">Type</th>
            <th className="th num">Disponible</th>
            <th className="th num">Réservé</th>
            <th className="th num">Total</th>
            <th className="th num">Min.</th>
            <th className="th">État</th>
          </tr>
        </thead>
        <tbody>
          {groups.map(({ collection, kits, rows, collectionNames }) =>
            kits.length === 0 && rows.length === 0 ? null : (
              <GroupRows key={collection.id} collection={collection} kits={kits} rows={rows} collectionNames={collectionNames} />
            )
          )}
        </tbody>
      </table>
    </div>
  );
}

function GroupRows({ collection, kits, rows, collectionNames }) {
  const navigate = useNavigate();
  const renderKit = ({ kit, ready, status }) => (
        <tr
          key={kit.id}
          onClick={() => navigate(`/kits/${kit.id}`)}
          className="cursor-pointer hover:brightness-125"
          style={{ background: "linear-gradient(90deg,rgba(200,155,60,.16),rgba(200,155,60,.03))" }}
        >
          <td className="td py-4! text-[24px]! font-semibold">
            <Link to={`/kits/${kit.id}`} className="text-cream! no-underline">
              {kit.name}
            </Link>
          </td>
          <td className="td sc text-[14px]! tracking-[.14em] text-gold">Kit complet</td>
          <td className={`td num text-[30px]! font-semibold ${status !== "ok" ? "text-alert-soft" : "text-cream"}`}>
            {ready}
          </td>
          <td className="td" colSpan={2} />
          <td className="td num text-muted2">{kit.min}</td>
          <td className="td">
            <StatusPill status={status} />
          </td>
        </tr>);
  return (
    <>
      {kits.map(renderKit)}
      {rows.map((row) => {
        if (row.isKit) return renderKit(row);
        const unit = unitFor(row.product, 2);
        const Unit = () => (unit ? <span className="ml-1.5 text-[14px] text-faint">{unit}</span> : null);
        return (
          <tr key={row.product.id} onClick={() => navigate(`/produits/${row.product.id}`)} className="cursor-pointer hover:bg-gold/8">
            <td className="td">
              <Link to={`/produits/${row.product.id}`} className="text-parch!">
                {row.name}
              </Link>
              {collectionNames && <div className="text-[13px] text-faint">{collectionNames[row.product.collectionId]}</div>}
            </td>
            <td className="td text-muted2">{typeLabel(row.product, row.inKit)}</td>
            <td className={`td num ${row.status !== "ok" ? "text-alert-soft" : ""}`}>
              {row.free}
              <Unit />
            </td>
            <td className="td num text-muted2">
              {row.reserved ?? "—"}
              {row.reserved != null && <Unit />}
            </td>
            <td className="td num">
              {row.total ?? <span className="text-muted2">—</span>}
              {row.total != null && <Unit />}
            </td>
            <td className="td num text-muted2">
              {row.min}
              <Unit />
            </td>
            <td className="td">
              <StatusPill status={row.status} />
            </td>
          </tr>
        );
      })}
    </>
  );
}

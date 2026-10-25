// Catalogue : la liste de tous les produits, une ligne par entrée de la base
// (table products + product_images du site), simplifiée. On clique sur une
// ligne pour ouvrir sa fiche : textes FR / EN, prix et images modifiables.
// Rien n'est envoyé au site ni à Square pour l'instant.
import { memo, useCallback, useEffect, useMemo, useState } from "react";

import { useInventory } from "../store.jsx";
import { PageHeader, SampleNote } from "../components/ui.jsx";

const TYPE_LABELS = { piece: "Pièce", outil: "Outil au choix", paquet: "Paquet", ensemble: "Ensemble" };

function mainImage(entry) {
  return entry.images.find((img) => img.main) ?? entry.images[0];
}

export default function Catalogue() {
  const { catalog, collections, dispatch, readOnly } = useInventory();
  const [openId, setOpenId] = useState(null);
  const [query, setQuery] = useState("");
  const [view, setView] = useState("cartes"); // "cartes" | "tableau"
  const [collectionId, setCollectionId] = useState("all");
  const [column, setColumn] = useState(null); // { key, dir } pour le tableau
  const clickColumn = (key) =>
    setColumn((current) => ({ key, dir: current?.key === key && current.dir === "asc" ? "desc" : "asc" }));
  const needle = query.trim().toLowerCase();
  const openEntry = catalog.find((e) => e.id === openId);
  const toggle = useCallback((id) => setOpenId((current) => (current === id ? null : id)), []);
  const groups = useMemo(() => {
    const matches = (e) => !needle || `${e.nameFr} ${e.nameEn}`.toLowerCase().includes(needle);
    return collections
      .filter((collection) => collectionId === "all" || collection.id === collectionId)
      .map((collection) => {
        const entries = catalog.filter((e) => e.collectionId === collection.id && matches(e));
        return { collection, entries: [...entries.filter((e) => e.isKit), ...entries.filter((e) => !e.isKit)] };
      })
      .filter((g) => g.entries.length);
  }, [catalog, collections, needle, collectionId]);

  function addEntry() {
    const id = `nouveau-${Date.now()}`;
    dispatch({
      type: "addCatalog",
      entry: {
        id,
        collectionId: collections[0]?.id,
        nameFr: "Nouveau produit",
        nameEn: "",
        titleFr: "",
        titleEn: "",
        descriptionFr: "",
        descriptionEn: "",
        longDescriptionFr: "",
        longDescriptionEn: "",
        price: "",
        images: [],
        type: "outil",
      },
    });
    setOpenId(id);
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader eyebrow="Site" title="Catalogue">
        <div className="flex flex-wrap items-center gap-3">
          <input
            aria-label="Rechercher"
            placeholder="Rechercher un produit…"
            className="field w-[260px]!"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {!readOnly && (
            <button type="button" className="btn-primary" onClick={addEntry}>
              + Nouveau produit
            </button>
          )}
        </div>
      </PageHeader>

      <div className="mx-auto flex w-full max-w-[1150px] flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Collection">
          {[{ id: "all", name: "Toutes" }, ...collections].map((c) => (
            <button
              key={c.id}
              type="button"
              role="tab"
              aria-selected={collectionId === c.id}
              onClick={() => setCollectionId(c.id)}
              className={`cursor-pointer border px-4 py-2 text-[16px] ${
                collectionId === c.id ? "border-gold bg-gold/15 text-cream" : "border-line bg-transparent text-muted2 hover:text-cream"
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>
        <div className="flex border border-line" role="tablist" aria-label="Affichage">
          {[
            ["cartes", "Cartes"],
            ["tableau", "Tableau"],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={view === value}
              onClick={() => setView(value)}
              className={`sc cursor-pointer border-0 px-5 py-2 text-[13px] tracking-[.14em] ${
                view === value ? "bg-gold/20 text-cream" : "bg-transparent text-muted2 hover:text-cream"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {view === "tableau" ? (
        <CatalogTable groups={groups} column={column} onColumn={clickColumn} onOpen={toggle} />
      ) : (
        <div className="mx-auto flex w-full max-w-[1150px] flex-col gap-10">
        {groups.length === 0 && <div className="sub py-10 text-center">Aucun produit ne correspond.</div>}
        {groups.map(({ collection, entries }) => (
          <section key={collection.id}>
            <div
              className="flex items-center justify-between gap-4 border border-gold/35 px-5 py-3"
              style={{ background: "linear-gradient(90deg,rgba(200,155,60,.16),rgba(200,155,60,.03))" }}
            >
              <span className="text-[24px] font-semibold text-cream">{collection.name}</span>
              <span className="sc text-[13px] tracking-[.12em] text-gold-light">
                {entries.length} {entries.length > 1 ? "produits" : "produit"}
              </span>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
              {entries.map((entry) => (
                <CatalogCard key={entry.id} entry={entry} onOpen={toggle} />
              ))}
            </div>
          </section>
        ))}
      </div>
      )}
      {openEntry && (
        <EntryModal
          entry={openEntry}
          onClose={() => setOpenId(null)}
          dispatch={dispatch}
          collections={collections}
          readOnly={readOnly}
        />
      )}
      <SampleNote />
    </div>
  );
}

const COLUMNS = [
  { key: "name", label: "Produit", value: (r) => r.entry.nameFr },
  { key: "type", label: "Type", value: (r) => (r.entry.isKit ? "Kit" : TYPE_LABELS[r.entry.type] ?? "") },
  { key: "collection", label: "Collection", value: (r) => r.rank },
  { key: "photos", label: "Photos", num: true, value: (r) => r.entry.images.length },
  { key: "price", label: "Prix", num: true, value: (r) => (r.entry.price ? Number(String(r.entry.price).replace(",", ".")) : null) },
];

function CatalogTable({ groups, column, onColumn, onOpen }) {
  const rows = groups.flatMap(({ collection, entries }, rank) => entries.map((entry) => ({ entry, collection, rank })));
  const active = column && COLUMNS.find((c) => c.key === column.key);
  if (active) {
    const order = (a, b) => {
      const x = active.value(a);
      const y = active.value(b);
      if (x == null || y == null) return x == null ? (y == null ? 0 : 1) : -1;
      const diff = typeof x === "string" ? x.localeCompare(y, "fr") : x - y;
      return column.dir === "desc" ? -diff : diff;
    };
    rows.sort((a, b) => order(a, b) || a.rank - b.rank || a.entry.nameFr.localeCompare(b.entry.nameFr, "fr"));
  }
  return (
    <div className="mx-auto w-full max-w-[1150px] overflow-x-auto border border-line bg-panel">
      <table className="w-full min-w-[760px] border-collapse">
        <thead>
          <tr>
            <th className="th w-[76px]" />
            {COLUMNS.map((c) => {
              const on = column?.key === c.key;
              return (
                <th key={c.key} className={`th ${c.num ? "num" : ""}`} aria-sort={on ? (column.dir === "asc" ? "ascending" : "descending") : undefined}>
                  <button
                    type="button"
                    onClick={() => onColumn(c.key)}
                    className={`inline-flex cursor-pointer items-center gap-1.5 border-0 bg-transparent p-0 font-[inherit] tracking-[inherit] uppercase ${
                      on ? "text-cream" : "text-gold hover:text-gold-light"
                    }`}
                  >
                    {c.label}
                    <span className={`text-[10px] ${on ? "text-gold" : "text-faint"}`}>{on ? (column.dir === "asc" ? "▲" : "▼") : "▲▼"}</span>
                  </button>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map(({ entry, collection }) => {
            const img = mainImage(entry);
            return (
              <tr
                key={entry.id}
                onClick={() => onOpen(entry.id)}
                className="cursor-pointer even:bg-[#1a120a] hover:bg-gold/10!"
                style={entry.isKit ? { background: "linear-gradient(90deg,rgba(200,155,60,.16),rgba(200,155,60,.03))" } : undefined}
              >
                <td className="td py-2!">
                  <Thumb url={img?.url} size={48} />
                </td>
                <td className="td">
                  <div className={entry.isKit ? "text-[21px] font-semibold text-cream" : "text-[18px] text-cream"}>{entry.nameFr}</div>
                  <div className="sub mt-0.5">{entry.nameEn || <span className="text-alert-soft/70">nom anglais à remplir</span>}</div>
                </td>
                <td className="td text-[16px] text-muted">{entry.isKit ? "Kit" : TYPE_LABELS[entry.type] ?? ""}</td>
                <td className="td text-[16px] text-muted">{collection.name}</td>
                <td className={`td num text-[17px] ${entry.images.length ? "text-cream" : "text-faint"}`}>{entry.images.length || "—"}</td>
                <td className="td num text-[18px] text-cream tabular-nums">{entry.price ? `${entry.price} $` : <span className="text-faint">—</span>}</td>
              </tr>
            );
          })}
          {rows.length === 0 && (
            <tr>
              <td className="td sub py-8! text-center" colSpan={COLUMNS.length + 1}>
                Aucun produit ne correspond.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

// Carte mémorisée : elle ne se redessine que si SON produit change.
const CatalogCard = memo(function CatalogCard({ entry, onOpen }) {
  const img = mainImage(entry);
  return (
    <button
      type="button"
      onClick={() => onOpen(entry.id)}
      className={`group flex cursor-pointer flex-col border bg-ink p-0 text-left hover:border-gold ${entry.isKit ? "border-gold" : "border-line/70"}`}
    >
      <CardImage url={img?.url} />
      <div className="border-t border-line/50 px-3.5 py-3" style={entry.isKit ? { background: "linear-gradient(90deg,rgba(200,155,60,.14),rgba(200,155,60,.02))" } : undefined}>
        <div className={`text-[18px] leading-snug text-cream ${entry.isKit ? "font-semibold" : ""}`}>{entry.nameFr}</div>
        <div className="mt-1 flex items-baseline justify-between gap-2">
          <span className="sub flex items-center gap-2">
            {entry.isKit ? "Kit" : TYPE_LABELS[entry.type] ?? ""}
            {(entry.variants || []).length > 0 && (
              <span className="flex items-center gap-1">
                {entry.variants.map((v) => (
                  <span key={v.color} className="inline-block h-2.5 w-2.5 border border-line" style={{ background: v.swatch }} />
                ))}
              </span>
            )}
          </span>
          <span className="text-[17px] text-cream tabular-nums">{entry.price ? `${entry.price} $` : <span className="text-faint">—</span>}</span>
        </div>
      </div>
    </button>
  );
});

function CardImage({ url }) {
  const [broken, setBroken] = useState(false);
  return (
    <div className="flex aspect-square w-full items-center justify-center overflow-hidden" style={{ background: "linear-gradient(135deg,#2a1d0e,#0d0805)" }}>
      {url && !broken ? (
        <img src={assetUrl(url, 500)} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" onError={() => setBroken(true)} />
      ) : (
        <span className="sub">{url ? "Image introuvable" : "Aucune photo"}</span>
      )}
    </div>
  );
}

// Fiche du produit, en fenêtre par-dessus la page.
function EntryModal({ entry, onClose, dispatch, collections, readOnly }) {
  const update = useCallback((patch) => dispatch({ type: "updateCatalog", id: entry.id, patch }), [dispatch, entry.id]);
  const [confirming, setConfirming] = useState(false);
  const collectionName = collections.find((c) => c.id === entry.collectionId)?.name;
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 sm:py-10" onClick={onClose}>
      <div className="relative w-full max-w-[1000px] border border-gold/70 bg-panel shadow-[0_20px_60px_#000]" onClick={(e) => e.stopPropagation()}>
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-gold/60 px-7 py-6 pr-16" style={{ background: "linear-gradient(180deg,#1a1109 0%,#0d0805 100%)" }}>
          <div>
            <div className="eyebrow">{entry.isKit ? "Kit" : TYPE_LABELS[entry.type] ?? "Produit"}</div>
            <div className="mt-1 text-[28px] font-semibold text-cream">{entry.nameFr}</div>
            <div className="sub mt-1">{[entry.nameEn || "nom anglais à remplir", collectionName].filter(Boolean).join(" · ")}</div>
          </div>
          {!readOnly && !confirming && (
            <button type="button" className="btn-ghost hover:border-alert-line! hover:text-alert!" onClick={() => setConfirming(true)}>
              × Retirer du catalogue
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer"
          className="absolute top-3 right-3 h-8 w-8 cursor-pointer border border-line bg-ink text-[18px] text-muted2 hover:text-cream"
        >
          ×
        </button>

        {confirming && (
          <div className="flex items-center justify-between gap-3 border-b border-alert-line bg-alert-bg px-7 py-3 text-[16px]">
            <span className="text-alert-soft">Retirer « {entry.nameFr} » du catalogue ?</span>
            <span className="flex gap-2">
              <button type="button" className="btn-ghost h-8! px-3! text-[13px]!" onClick={() => setConfirming(false)}>
                Annuler
              </button>
              <button
                type="button"
                className="sc h-8 cursor-pointer border border-alert-line bg-[#9b4a36] px-3 text-[13px] tracking-[.1em] text-cream"
                onClick={() => {
                  dispatch({ type: "removeCatalog", id: entry.id });
                  onClose();
                }}
              >
                Retirer
              </button>
            </span>
          </div>
        )}

        <div className="flex min-w-0 flex-col gap-7 px-7 py-6">
          <Images entry={entry} update={update} readOnly={readOnly} />
          {(entry.variants || []).some((v) => v.priceDelta) && <Variants entry={entry} update={update} readOnly={readOnly} />}
          <fieldset disabled={readOnly} className="m-0 flex min-w-0 flex-col gap-5 border-0 p-0">
            {readOnly && <div className="text-[14px] text-gold-light">Lecture seule pour l'instant : les modifications viendront avec l'écriture dans la base.</div>}
            <div className="grid gap-x-6 gap-y-3 md:grid-cols-2">
              <ColumnTitle>Français</ColumnTitle>
              <ColumnTitle className="hidden md:block">Anglais</ColumnTitle>
              <Text label="Nom" value={entry.nameFr} onChange={(v) => update({ nameFr: v })} />
              <Text label="Name" value={entry.nameEn} onChange={(v) => update({ nameEn: v })} />
              <Text label="Titre" value={entry.titleFr} onChange={(v) => update({ titleFr: v })} />
              <Text label="Title" value={entry.titleEn} onChange={(v) => update({ titleEn: v })} />
              <Text area label="Description courte" value={entry.descriptionFr} onChange={(v) => update({ descriptionFr: v })} />
              <Text area label="Short description" value={entry.descriptionEn} onChange={(v) => update({ descriptionEn: v })} />
              <Text area tall label="Description longue" value={entry.longDescriptionFr} onChange={(v) => update({ longDescriptionFr: v })} />
              <Text area tall label="Long description" value={entry.longDescriptionEn} onChange={(v) => update({ longDescriptionEn: v })} />
            </div>
            <div className="grid gap-x-6 gap-y-3 md:grid-cols-2">
              <label className="flex flex-col gap-1.5">
                <span className="lbl">Prix ($)</span>
                <input className="field" inputMode="decimal" placeholder="40,00" value={entry.price} onChange={(e) => update({ price: e.target.value })} />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="lbl">Collection</span>
                <select className="field bg-panel2!" value={entry.collectionId} onChange={(e) => update({ collectionId: e.target.value })}>
                  {collections.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </fieldset>
        </div>
      </div>
    </div>
  );
}

/** Sous-produits : variantes de couleur avec leur prix (prix de base + écart) et leur stock. */
function Variants({ entry, update, readOnly }) {
  const base = Number(String(entry.price).replace(",", ".")) || 0;
  const money = (n) => `${n.toFixed(2).replace(".", ",")} $`;
  const set = (index, patch) => update({ variants: entry.variants.map((v, i) => (i === index ? { ...v, ...patch } : v)) });
  // Seules les couleurs qui changent le prix sont montrées.
  const shown = entry.variants.map((v, index) => ({ v, index })).filter(({ v }) => v.priceDelta);
  return (
    <div className="flex flex-col gap-2">
      <ColumnTitle>
        Variantes à prix différent <span className="sub-num ml-2">{shown.length}</span>
      </ColumnTitle>
      <div className="grid grid-cols-[minmax(0,1fr)_120px_120px] items-center gap-x-4 px-1 text-[12px] tracking-[.14em] text-gold">
        <span className="sc">Couleur</span>
        <span className="sc text-right">Écart</span>
        <span className="sc text-right">Prix final</span>
      </div>
      {shown.map(({ v, index }) => (
        <div key={v.color} className="grid grid-cols-[minmax(0,1fr)_120px_120px] items-center gap-x-4 border-t border-line/35 px-1 py-2.5">
          <span className="flex items-center gap-3">
            <span className="h-6 w-6 shrink-0 border border-line" style={{ background: v.swatch }} />
            {(() => {
              const img = entry.images.find((im) => im.color === v.color && im.main) ?? entry.images.find((im) => im.color === v.color);
              return img ? <Thumb url={img.url} size={40} /> : null;
            })()}
            <span className="text-[18px] text-cream">{v.color}</span>
            <span className="sub">
              <span className="sub-num">{entry.images.filter((im) => im.color === v.color).length}</span> photo(s)
            </span>
          </span>
          <span className="text-right">
            {readOnly ? (
              <span className={`text-[17px] tabular-nums ${v.priceDelta ? "text-gold-light" : "text-faint"}`}>
                {v.priceDelta ? `+ ${money(v.priceDelta)}` : "—"}
              </span>
            ) : (
              <input
                className="field w-[110px]! text-right"
                inputMode="decimal"
                value={v.priceDelta}
                onChange={(e) => set(index, { priceDelta: Number(e.target.value.replace(",", ".")) || 0 })}
              />
            )}
          </span>
          <span className="text-right text-[17px] text-cream tabular-nums">{money(base + (v.priceDelta || 0))}</span>
        </div>
      ))}
    </div>
  );
}

function ColumnTitle({ children, className = "" }) {
  return <div className={`sc border-b border-gold/50 pb-1 text-[14px] tracking-[.16em] text-gold ${className}`}>{children}</div>;
}

function Text({ label, value, onChange, area = false, tall = false }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="lbl">{label}</span>
      {area ? (
        <textarea className={`field py-2 ${tall ? "h-36!" : "h-20!"}`} value={value} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input className="field" value={value} onChange={(e) => onChange(e.target.value)} />
      )}
    </label>
  );
}

function Thumb({ url, size }) {
  const [broken, setBroken] = useState(false);
  return (
    <div className="flex shrink-0 items-center justify-center overflow-hidden border border-line bg-panel2" style={{ width: size, height: size }}>
      {url && !broken ? (
        <img src={assetUrl(url)} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" onError={() => setBroken(true)} />
      ) : (
        <span className="sub text-[10px]!">{url ? "introuvable" : "image"}</span>
      )}
    </div>
  );
}

function Images({ entry, update, readOnly }) {
  const [url, setUrl] = useState("");
  const variants = entry.variants || [];
  // Filtre : "all" = toutes, sinon le nom de la couleur.
  const [variant, setVariant] = useState("all");
  const all = entry.images.map((img, i) => ({ ...img, _i: i }));
  const images = variant === "all" ? all : all.filter((img) => img.color === variant);
  // Serveur pas relancé depuis l'ajout des couleurs : les images n'ont pas encore le champ « color ».
  const staleServer = variants.length > 0 && all.length > 0 && all.every((img) => !("color" in img));
  const [index, setIndex] = useState(() => Math.max(0, images.findIndex((img) => img.main)));
  const count = images.length;
  const at = Math.max(0, Math.min(index, count - 1));
  const current = images[at];
  const clean = (list) => list.map(({ _i, ...img }) => img);
  const set = (next) => update({ images: clean(next) });
  const go = (step) => setIndex((i) => (count ? (i + step + count) % count : 0));
  const patchCurrent = (patch) => set(all.map((im) => (im._i === current._i ? { ...im, ...patch } : im)));
  const makeMain = () => set(all.map((im) => ({ ...im, main: im._i === current._i })));
  const pick = (value) => {
    setVariant(value);
    setIndex(0);
  };

  function add() {
    const link = url.trim();
    if (!link) return;
    const color = variant === "all" ? null : variant;
    set([...all, { url: link, altFr: "", altEn: "", main: all.length === 0, color }]);
    setIndex(count);
    setUrl("");
  }

  function removeCurrent() {
    const rest = all.filter((im) => im._i !== current._i);
    if (current?.main && rest.length) rest[0] = { ...rest[0], main: true };
    set(rest);
    setIndex((i) => Math.max(0, i - 1));
  }

  return (
    <div className="flex flex-col gap-3">
      <ColumnTitle>
        Images {count > 0 && <span className="sub-num ml-2">{at + 1} / {count}</span>}
      </ColumnTitle>
      {staleServer && (
        <div className="text-[14px] text-gold-light">Relance « npm run dev » pour voir les photos classées par couleur.</div>
      )}
      {variants.length > 0 && (
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Images par variante">
          {[
            { value: "all", label: "Toutes", n: all.length },
            ...variants.map((v) => ({ value: v.color, label: v.color, swatch: v.swatch, n: all.filter((im) => im.color === v.color).length })),
          ].map((chip) => (
            <button
              key={chip.value}
              type="button"
              role="tab"
              aria-selected={variant === chip.value}
              onClick={() => pick(chip.value)}
              className={`flex cursor-pointer items-center gap-2 border px-3 py-1.5 text-[15px] ${
                variant === chip.value ? "border-gold bg-gold/15 text-cream" : "border-line bg-transparent text-muted2 hover:text-cream"
              }`}
            >
              {chip.swatch && <span className="inline-block h-3.5 w-3.5 border border-line" style={{ background: chip.swatch }} />}
              {chip.label}
              <span className="sub-num">{chip.n}</span>
            </button>
          ))}
        </div>
      )}

      {count === 0 ? (
        <div className="flex h-[220px] items-center justify-center border border-dashed border-line sub">Aucune image</div>
      ) : (
        <div className="flex flex-col gap-3 md:flex-row">
          {/* Carrousel */}
          <div className="flex flex-col gap-2 md:w-[380px] md:shrink-0">
            <div className="relative">
              <BigImage key={current.url} url={current.url} />
              {current.color && (
                <span className="absolute top-2 right-2 border border-line bg-ink/80 px-2 py-0.5 text-[13px] text-cream">{current.color}</span>
              )}
              {current.main && (
                <span className="sc absolute top-2 left-2 border border-gold bg-ink/80 px-2 py-0.5 text-[12px] tracking-[.1em] text-cream">Principale</span>
              )}
              {count > 1 && (
                <>
                  <button
                    type="button"
                    aria-label="Image précédente"
                    onClick={() => go(-1)}
                    className="absolute top-1/2 left-2 flex h-10 w-10 -translate-y-1/2 cursor-pointer items-center justify-center border border-line bg-ink/80 text-[24px] text-gold-light hover:text-cream"
                  >
                    ‹
                  </button>
                  <button
                    type="button"
                    aria-label="Image suivante"
                    onClick={() => go(1)}
                    className="absolute top-1/2 right-2 flex h-10 w-10 -translate-y-1/2 cursor-pointer items-center justify-center border border-line bg-ink/80 text-[24px] text-gold-light hover:text-cream"
                  >
                    ›
                  </button>
                </>
              )}
            </div>
            {count > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {images.map((img, i) => (
                  <button
                    key={i}
                    type="button"
                    aria-label={`Image ${i + 1}`}
                    onClick={() => setIndex(i)}
                    className={`shrink-0 cursor-pointer border-2 bg-transparent p-0 ${i === at ? "border-gold" : "border-transparent opacity-70 hover:opacity-100"}`}
                  >
                    <Thumb url={img.url} size={52} />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Détails de l'image affichée */}
          <fieldset disabled={readOnly} className="m-0 flex min-w-0 flex-1 flex-col gap-3 border-0 p-0">
            <label className="flex flex-col gap-1.5">
              <span className="lbl">Lien de l'image</span>
              <input className="field" value={current.url} onChange={(e) => patchCurrent({ url: e.target.value })} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="lbl">Texte alternatif FR</span>
              <input className="field" value={current.altFr} onChange={(e) => patchCurrent({ altFr: e.target.value })} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="lbl">Alt text EN</span>
              <input className="field" value={current.altEn} onChange={(e) => patchCurrent({ altEn: e.target.value })} />
            </label>
            {!readOnly && (
              <div className="flex flex-wrap gap-2">
                {!current.main && (
                  <button type="button" className="btn-ghost" onClick={makeMain}>
                    Mettre principale
                  </button>
                )}
                <button type="button" className="btn-ghost" onClick={removeCurrent}>
                  × Retirer l'image
                </button>
              </div>
            )}
          </fieldset>
        </div>
      )}

      {!readOnly && (
        <div className="flex flex-wrap gap-3">
          <input
            className="field min-w-[260px] flex-1"
            placeholder="/images/… ou https://assets.panassor.ca/images/…"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
          />
          <button type="button" className="btn-ghost" onClick={add}>
            + Ajouter l'image
          </button>
        </div>
      )}
    </div>
  );
}

/** Les liens relatifs (/images/…) passent par le serveur local, qui les réduit à la bonne taille. */
export function assetUrl(url, width = 160) {
  if (!url) return url;
  if (/^https?:\/\//.test(url)) return url;
  const src = url.startsWith("/") ? url : `/${url}`;
  return `/api/img?w=${width}&src=${encodeURIComponent(src)}`;
}

function BigImage({ url }) {
  const [broken, setBroken] = useState(false);
  return (
    <div className="flex aspect-square w-full items-center justify-center overflow-hidden border border-line bg-panel2">
      {url && !broken ? (
        <img key={url} src={assetUrl(url, 1000)} alt="" decoding="async" className="h-full w-full object-contain" onError={() => setBroken(true)} />
      ) : (
        <span className="sub">{url ? "Image introuvable" : "Aucune image"}</span>
      )}
    </div>
  );
}

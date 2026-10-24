// Catalogue : la liste de tous les produits, une ligne par entrée de la base
// (table products + product_images du site), simplifiée. On clique sur une
// ligne pour ouvrir sa fiche : textes FR / EN, prix et images modifiables.
// Rien n'est envoyé au site ni à Square pour l'instant.
import { memo, useCallback, useMemo, useState } from "react";

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
  const needle = query.trim().toLowerCase();
  const toggle = useCallback((id) => setOpenId((current) => (current === id ? null : id)), []);
  const groups = useMemo(() => {
    const matches = (e) => !needle || `${e.nameFr} ${e.nameEn}`.toLowerCase().includes(needle);
    return collections
      .map((collection) => {
        const entries = catalog.filter((e) => e.collectionId === collection.id && matches(e));
        return { collection, entries: [...entries.filter((e) => e.isKit), ...entries.filter((e) => !e.isKit)] };
      })
      .filter((g) => g.entries.length);
  }, [catalog, collections, needle]);

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

      <div className="mx-auto flex w-full max-w-[1150px] flex-col border border-line/50 bg-panel/60">
        {groups.map(({ collection, entries }) =>
          entries.map((entry) => (
            <CatalogRow
              key={entry.id}
              entry={entry}
              collectionName={collection.name}
              open={openId === entry.id}
              onToggle={toggle}
              dispatch={dispatch}
              collections={collections}
              readOnly={readOnly}
            />
          ))
        )}
      </div>
      <SampleNote />
    </div>
  );
}

// Ligne mémorisée : elle ne se redessine que si SON produit change (pas à chaque frappe ailleurs).
const CatalogRow = memo(function CatalogRow({ entry, collectionName, open, onToggle, dispatch, collections, readOnly }) {
  const update = useCallback((patch) => dispatch({ type: "updateCatalog", id: entry.id, patch }), [dispatch, entry.id]);
  const [confirming, setConfirming] = useState(false);
  const img = mainImage(entry);

  return (
    <div className="border-t border-line/35 first:border-t-0">
      <div
        role="button"
        tabIndex={0}
        aria-expanded={open}
        onClick={() => onToggle(entry.id)}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onToggle(entry.id))}
        className={`flex cursor-pointer items-center gap-4 px-5 py-3 hover:bg-gold/5 ${open ? "bg-gold/8" : ""}`}
        style={entry.isKit ? { background: "linear-gradient(90deg,rgba(200,155,60,.16),rgba(200,155,60,.03))" } : undefined}
      >
        <Thumb url={img?.url} size={56} />
        <div className="min-w-0 flex-1">
          <div className={entry.isKit ? "text-[22px] font-semibold text-cream" : "text-[19px] text-cream"}>{entry.nameFr}</div>
          <div className="sub mt-0.5 flex flex-wrap items-center gap-2">
            {entry.nameEn || "— nom anglais à remplir"}
            {(entry.variants || []).length > 0 && (
              <span className="flex items-center gap-1" title={`${entry.variants.length} variantes`}>
                {entry.variants.map((v) => (
                  <span key={v.color} className="inline-block h-3 w-3 border border-line" style={{ background: v.swatch }} />
                ))}
              </span>
            )}
          </div>
        </div>
        <div className="hidden w-[160px] text-[15px] text-muted2 md:block">
          {entry.isKit ? "Kit complet" : TYPE_LABELS[entry.type] ?? ""}
          <div className="sub mt-0.5">{collectionName}</div>
        </div>
        <div className="w-[90px] text-right text-[18px] text-cream tabular-nums">{entry.price ? `${entry.price} $` : <span className="text-faint">—</span>}</div>
        {!readOnly && <button
          type="button"
          aria-label={`Retirer ${entry.nameFr}`}
          title="Retirer ce produit"
          onClick={(e) => {
            e.stopPropagation();
            setConfirming(true);
          }}
          className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center border border-line bg-transparent text-[18px] leading-none text-muted2 hover:border-alert-line hover:text-alert"
        >
          ×
        </button>}
      </div>

      {confirming && (
        <div className="flex items-center justify-between gap-3 border-t border-alert-line bg-alert-bg px-5 py-2 text-[15px]">
          <span className="text-alert-soft">Retirer « {entry.nameFr} » du catalogue ?</span>
          <span className="flex gap-2">
            <button type="button" className="btn-ghost h-8! px-3! text-[13px]!" onClick={() => setConfirming(false)}>
              Annuler
            </button>
            <button
              type="button"
              className="sc h-8 cursor-pointer border border-alert-line bg-[#9b4a36] px-3 text-[13px] tracking-[.1em] text-cream"
              onClick={() => dispatch({ type: "removeCatalog", id: entry.id })}
            >
              Retirer
            </button>
          </span>
        </div>
      )}

      {open && (
        <div className="flex min-w-0 flex-col gap-5 border-t border-gold/50 bg-ink/60 px-5 py-5">
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
      )}
    </div>
  );
});

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

// Catalogue : la liste de tous les produits, une ligne par entrée de la base
// (table products + product_images du site), simplifiée. On clique sur une
// ligne pour ouvrir sa fiche : textes FR / EN, prix et images modifiables.
// Rien n'est envoyé au site ni à Square pour l'instant.
import { useState } from "react";

import { useInventory } from "../store.jsx";
import { PageHeader, SampleNote } from "../components/ui.jsx";

const TYPE_LABELS = { piece: "Pièce", outil: "Outil au choix", paquet: "Paquet", ensemble: "Ensemble" };

function mainImage(entry) {
  return entry.images.find((img) => img.main) ?? entry.images[0];
}

export default function Catalogue() {
  const { catalog, collections, dispatch } = useInventory();
  const [openId, setOpenId] = useState(null);
  const [query, setQuery] = useState("");
  const needle = query.trim().toLowerCase();
  const matches = (e) => !needle || `${e.nameFr} ${e.nameEn}`.toLowerCase().includes(needle);

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
          <button type="button" className="btn-primary" onClick={addEntry}>
            + Nouveau produit
          </button>
        </div>
      </PageHeader>

      <div className="mx-auto flex w-full max-w-[1150px] flex-col border border-line/50 bg-panel/60">
        {collections.map((collection) => {
          const entries = catalog.filter((e) => e.collectionId === collection.id && matches(e));
          if (!entries.length) return null;
          const sorted = [...entries.filter((e) => e.isKit), ...entries.filter((e) => !e.isKit)];
          return sorted.map((entry) => (
            <CatalogRow
              key={entry.id}
              entry={entry}
              collectionName={collection.name}
              open={openId === entry.id}
              onToggle={() => setOpenId(openId === entry.id ? null : entry.id)}
            />
          ));
        })}
      </div>
      <SampleNote />
    </div>
  );
}

function CatalogRow({ entry, collectionName, open, onToggle }) {
  const { dispatch, collections } = useInventory();
  const update = (patch) => dispatch({ type: "updateCatalog", id: entry.id, patch });
  const img = mainImage(entry);
  const empty = ["nameEn", "titleFr", "titleEn", "descriptionFr", "descriptionEn"].filter((k) => !entry[k]).length + (entry.images.length ? 0 : 1);

  return (
    <div className="border-t border-line/35 first:border-t-0">
      <div
        role="button"
        tabIndex={0}
        aria-expanded={open}
        onClick={onToggle}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onToggle())}
        className={`flex cursor-pointer items-center gap-4 px-5 py-3 hover:bg-gold/5 ${open ? "bg-gold/8" : ""}`}
        style={entry.isKit ? { background: "linear-gradient(90deg,rgba(200,155,60,.16),rgba(200,155,60,.03))" } : undefined}
      >
        <Thumb url={img?.url} size={56} />
        <div className="min-w-0 flex-1">
          <div className={entry.isKit ? "text-[22px] font-semibold text-cream" : "text-[19px] text-cream"}>{entry.nameFr}</div>
          <div className="text-[14px] text-faint">{entry.nameEn || "— nom anglais à remplir"}</div>
        </div>
        <div className="hidden w-[160px] text-[15px] text-muted2 md:block">
          {entry.isKit ? "Kit complet" : TYPE_LABELS[entry.type] ?? ""}
          <div className="text-[13px] text-faint">{collectionName}</div>
        </div>
        <div className="w-[90px] text-right text-[18px] text-cream tabular-nums">{entry.price ? `${entry.price} $` : <span className="text-faint">—</span>}</div>
        <div className="w-[120px] text-right text-[13px]">
          {empty > 0 ? <span className="text-warn">{empty} à remplir</span> : <span className="text-ok">Complet</span>}
        </div>
      </div>

      {open && (
        <div className="flex flex-col gap-5 border-t border-gold/50 bg-ink/60 px-5 py-5">
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

          <Images entry={entry} update={update} />
        </div>
      )}
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
        <img src={url} alt="" className="h-full w-full object-cover" onError={() => setBroken(true)} />
      ) : (
        <span className="text-[11px] text-faint">{url ? "introuvable" : "image"}</span>
      )}
    </div>
  );
}

function Images({ entry, update }) {
  const [url, setUrl] = useState("");
  const set = (images) => update({ images });

  function add() {
    const clean = url.trim();
    if (!clean) return;
    set([...entry.images, { url: clean, altFr: "", altEn: "", main: entry.images.length === 0 }]);
    setUrl("");
  }

  return (
    <div className="flex flex-col gap-3">
      <ColumnTitle>Images</ColumnTitle>
      {entry.images.length === 0 && <div className="text-[15px] text-faint">Aucune image. Colle l'adresse d'une image (assets.panassor.ca/…).</div>}
      <div className="flex flex-col gap-3">
        {entry.images.map((img, index) => (
          <div key={index} className="flex flex-wrap items-center gap-4 border border-line/40 bg-panel2/60 p-3">
            <Thumb url={img.url} size={88} />
            <div className="flex min-w-[240px] flex-1 flex-col gap-2">
              <input
                className="field"
                aria-label="Adresse de l'image"
                value={img.url}
                onChange={(e) => set(entry.images.map((im, i) => (i === index ? { ...im, url: e.target.value } : im)))}
              />
              <div className="grid gap-2 sm:grid-cols-2">
                <input
                  className="field"
                  placeholder="Texte alternatif FR"
                  value={img.altFr}
                  onChange={(e) => set(entry.images.map((im, i) => (i === index ? { ...im, altFr: e.target.value } : im)))}
                />
                <input
                  className="field"
                  placeholder="Alt text EN"
                  value={img.altEn}
                  onChange={(e) => set(entry.images.map((im, i) => (i === index ? { ...im, altEn: e.target.value } : im)))}
                />
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              <button
                type="button"
                onClick={() => set(entry.images.map((im, i) => ({ ...im, main: i === index })))}
                className={`sc cursor-pointer border px-2.5 py-1 text-[12px] tracking-[.1em] ${
                  img.main ? "border-gold bg-gold/15 text-cream" : "border-line bg-transparent text-muted2 hover:text-cream"
                }`}
              >
                {img.main ? "Principale" : "Mettre principale"}
              </button>
              <button
                type="button"
                aria-label="Retirer l'image"
                onClick={() => {
                  const rest = entry.images.filter((_, i) => i !== index);
                  if (img.main && rest.length) rest[0] = { ...rest[0], main: true };
                  set(rest);
                }}
                className="flex h-7 w-7 cursor-pointer items-center justify-center border border-line bg-transparent text-[18px] leading-none text-muted2 hover:border-alert-line hover:text-alert"
              >
                ×
              </button>
            </div>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-3">
        <input
          className="field min-w-[260px] flex-1"
          placeholder="https://assets.panassor.ca/images/…"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
        />
        <button type="button" className="btn-ghost" onClick={add}>
          + Ajouter l'image
        </button>
      </div>
    </div>
  );
}

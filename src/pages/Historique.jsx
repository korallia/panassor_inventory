// Historique : tous les mouvements de stock (qui, quoi, combien, pourquoi).
// Filtres : raison, personne, période, et recherche par pièce.
// Les mouvements viennent de la table stock_movements (migration 017).
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { useInventory } from "../store.jsx";
import { PageHeader } from "../components/ui.jsx";
import { REASON_LABELS } from "../components/Ajuster.jsx";

const dateTime = (iso) =>
  new Date(iso).toLocaleString("fr-CA", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).replace(".", "");

// Nom court d'une personne (avant le @), sauf si deux comptes partagent ce début :
// on montre alors l'adresse complète pour les distinguer.
function personNamer(people) {
  const count = {};
  for (const email of people) {
    const local = email.split("@")[0];
    count[local] = (count[local] || 0) + 1;
  }
  return (email) => {
    if (!email) return "Square";
    const local = email.split("@")[0];
    return count[local] > 1 ? email : local;
  };
}

// Ventes : toutes les lignes d'une même commande Square (note « Commande #70
// (Square …) · Kit du chirurgien (Noir) ») sont regroupées en une seule ligne.
const SQUARE_REF = /\(Square ([^)]+)\)/;
const orderNumberOf = (note) => note?.match(/Commande #(\d+)/)?.[1] || null;
const pieceName = (m) => (m.variant ? `${m.product} (${m.variant})` : m.product);

function groupSales(movements) {
  const out = [];
  const sales = new Map();
  for (const m of movements) {
    const ref = m.reason === "vente" && m.note?.match(SQUARE_REF)?.[1];
    if (!ref) {
      out.push({ kind: "move", key: m.id, movement: m });
      continue;
    }
    let sale = sales.get(ref);
    if (!sale) {
      sale = { kind: "sale", key: `vente-${ref}`, ref, at: m.at, orderNumber: orderNumberOf(m.note), items: [], sources: [], missing: false };
      sales.set(ref, sale);
      out.push(sale);
    }
    sale.items.push(m);
    const [, sources = "", ...rest] = m.note.split(" · ");
    for (const source of sources.split(", ").filter(Boolean)) {
      const label = source === "vendu seul" ? pieceName(m) : source;
      if (!sale.sources.includes(label)) sale.sources.push(label);
    }
    if (rest.some((part) => part.startsWith("manquait"))) sale.missing = true;
  }
  for (const sale of sales.values()) {
    sale.total = sale.items.reduce((sum, m) => sum + m.change, 0);
    // Anciennes ventes (note sans ce qui a été vendu) : on nomme les pièces.
    if (!sale.sources.length) sale.sources = [...new Set(sale.items.map(pieceName))];
    // L'étui d'un kit vendu est la ligne « Kit (couleur) » : on l'appelle Étui et on le met en premier.
    for (const m of sale.items) m.label = m.variant && sale.sources.includes(pieceName(m)) ? `Étui ${m.variant.toLowerCase()}` : pieceName(m);
    sale.items.sort((a, b) => (b.label.startsWith("Étui ") ? 1 : 0) - (a.label.startsWith("Étui ") ? 1 : 0));
  }
  return out;
}

const signed = (n) => `${n > 0 ? "+" : "−"}${Math.abs(n)}`;

export default function Historique() {
  const { source, loadedAt, error } = useInventory();
  const [filters, setFilters] = useState({ raison: "", personne: "", du: "", au: "" });
  const [query, setQuery] = useState("");
  const [data, setData] = useState({ movements: [], people: [] });
  const personName = useMemo(
    () => personNamer([...new Set([...data.people, ...data.movements.map((m) => m.person).filter(Boolean)])]),
    [data]
  );
  const [status, setStatus] = useState("chargement");
  const [open, setOpen] = useState(null);
  const [openSale, setOpenSale] = useState(null);
  const [expanded, setExpanded] = useState(() => new Set());
  const toggle = (key) =>
    setExpanded((current) => {
      const next = new Set(current);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  const load = useCallback(async () => {
    setStatus("chargement");
    const params = new URLSearchParams({ limite: "300" });
    for (const [key, value] of Object.entries(filters)) if (value) params.set(key, value);
    try {
      const response = await fetch(`/api/mouvements?${params}`);
      if (!response.ok) throw new Error();
      setData(await response.json());
      setStatus("pret");
    } catch {
      setStatus("erreur");
    }
  }, [filters]);

  // Recharge quand les filtres changent, et après chaque ajustement (loadedAt change).
  useEffect(() => {
    if (source === "live") load();
  }, [load, source, loadedAt]);

  const set = (key) => (event) => setFilters((current) => ({ ...current, [key]: event.target.value }));
  const needle = query.trim().toLowerCase();
  const rows = data.movements.filter(
    (m) => !needle || `${m.product} ${m.variant || ""} ${m.collection || ""}`.toLowerCase().includes(needle)
  );
  const lines = groupSales(rows);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader eyebrow="Suivi" title="Historique">
        <input
          aria-label="Rechercher une pièce"
          placeholder="Rechercher une pièce…"
          className="field w-[260px]!"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </PageHeader>

      {source !== "live" ? (
        <div className="text-[15px] text-alert">
          {error
            ? `Les vraies données n'ont pas pu être lues : ${error}`
            : "L'historique n'existe qu'avec les vraies données (serveur de l'atelier lancé et connecté)."}
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-end gap-4 border-b border-line pb-4">
            <Filter label="Raison">
              <select className="field w-[180px]!" value={filters.raison} onChange={set("raison")}>
                <option value="">Toutes</option>
                {Object.entries(REASON_LABELS).map(([id, label]) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
              </select>
            </Filter>
            <Filter label="Personne">
              <select className="field w-[220px]!" value={filters.personne} onChange={set("personne")}>
                <option value="">Tout le monde</option>
                {data.people.map((email) => (
                  <option key={email} value={email}>
                    {personName(email)}
                  </option>
                ))}
                <option value="square">Square (ventes)</option>
              </select>
            </Filter>
            <Filter label="Du">
              <input type="date" className="field w-[170px]!" value={filters.du} onChange={set("du")} />
            </Filter>
            <Filter label="Au">
              <input type="date" className="field w-[170px]!" value={filters.au} onChange={set("au")} />
            </Filter>
            {(filters.raison || filters.personne || filters.du || filters.au || query) && (
              <button
                type="button"
                className="btn-ghost"
                onClick={() => {
                  setFilters({ raison: "", personne: "", du: "", au: "" });
                  setQuery("");
                }}
              >
                Effacer
              </button>
            )}
          </div>

          <div className="overflow-x-auto border border-line bg-panel">
            <table className="w-full min-w-[820px] border-collapse">
              <thead>
                <tr>
                  <th className="th">Date</th>
                  <th className="th">Commande</th>
                  <th className="th">Pièce</th>
                  <th className="th num">Mouvement</th>
                  <th className="th num">Après</th>
                  <th className="th">Raison</th>
                  <th className="th">Personne</th>
                  <th className="th">Note</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line) =>
                  line.kind === "sale" ? (
                    <SaleRows
                      key={line.key}
                      sale={line}
                      expanded={expanded.has(line.key)}
                      onToggle={() => toggle(line.key)}
                      onOpen={() => setOpenSale(line)}
                    />
                  ) : (
                    <MoveRow key={line.key} m={line.movement} onOpen={() => setOpen(line.movement)} personName={personName} />
                  )
                )}
              </tbody>
            </table>
            {status === "chargement" && rows.length === 0 && <div className="sub px-4 py-5">Chargement…</div>}
            {status === "erreur" && <div className="px-4 py-5 text-[15px] text-alert">Lecture de l'historique impossible.</div>}
            {status === "pret" && rows.length === 0 && <div className="sub px-4 py-5">Aucun mouvement pour ces filtres.</div>}
          </div>
          {open && <Detail movement={open} onClose={() => setOpen(null)} personName={personName} />}
          {openSale && <SaleDetail sale={openSale} onClose={() => setOpenSale(null)} />}
          {data.movements.length >= 300 && <div className="sub">Les 300 derniers mouvements : affine les filtres pour voir plus loin.</div>}
        </>
      )}
    </div>
  );
}

function MoveRow({ m, onOpen, personName }) {
  return (
    <tr onClick={onOpen} className="cursor-pointer even:bg-[#1a120a] hover:bg-gold/10!">
      <td className="td whitespace-nowrap text-[16px]! text-muted">
        <span className="inline-block w-6" />
        {dateTime(m.at)}
      </td>
      <td className="td text-faint">—</td>
      <td className="td">
        <span className="text-parch">{m.product}</span>
        <div className="sub mt-0.5">{[m.variant, m.collection].filter(Boolean).join(" · ")}</div>
      </td>
      <td className={`td num ${m.change > 0 ? "text-ok" : "text-alert"}`}>{signed(m.change)}</td>
      <td className="td num text-muted2">{m.after}</td>
      <td className="td">
        <span className="sub text-[13px]! text-gold!">{REASON_LABELS[m.reason] || m.reason}</span>
      </td>
      <td className="td text-[16px]! text-muted">{personName(m.person)}</td>
      <td className="td max-w-[260px] text-[15px]! text-muted2 italic">{m.note || ""}</td>
    </tr>
  );
}

const OrderBadge = ({ number }) =>
  number ? (
    <span className="sc border border-gold/55 px-2 py-0.5 text-[13px] tracking-[.1em] whitespace-nowrap text-gold-light">#{number}</span>
  ) : (
    <span className="sub">Square</span>
  );

// Une vente = une ligne (flèche : le détail s'ouvre dessous ; clic sur la ligne : la fenêtre).
function SaleRows({ sale, expanded, onToggle, onOpen }) {
  return (
    <>
      <tr onClick={onOpen} className={`cursor-pointer hover:bg-gold/10! ${expanded ? "bg-gold/8" : "even:bg-[#1a120a]"}`}>
        <td className="td whitespace-nowrap text-[16px]! text-muted">
          {sale.items.length === 1 ? (
            <span className="inline-block w-6" />
          ) : (
          <button
            type="button"
            aria-expanded={expanded}
            aria-label={expanded ? "Refermer le détail" : "Voir le détail"}
            onClick={(event) => {
              event.stopPropagation();
              onToggle();
            }}
            className="inline-flex w-6 cursor-pointer justify-start border-0 bg-transparent p-0 text-[14px] text-gold hover:text-gold-light"
          >
            {expanded ? "▾" : "▸"}
          </button>
          )}
          {dateTime(sale.at)}
        </td>
        <td className="td">
          <OrderBadge number={sale.orderNumber} />
        </td>
        <td className="td">
          <span className="text-parch">{sale.sources.join(", ")}</span>
          {sale.items.length === 1 && sale.items[0].collection && <div className="sub mt-0.5">{sale.items[0].collection}</div>}
        </td>
        <td className="td num text-alert">{signed(sale.total)}</td>
        <td className="td num text-muted2" />
        <td className="td">
          <span className="sub text-[13px]! text-gold!">{REASON_LABELS.vente || "Vente"}</span>
        </td>
        <td className="td text-[16px]! text-muted">Square</td>
        <td className="td max-w-[260px] text-[15px]! text-muted2 italic">{sale.missing ? "Il manquait des pièces" : ""}</td>
      </tr>
      {expanded &&
        sale.items.length > 1 &&
        sale.items.map((m) => (
          <tr key={m.id} className="bg-ink">
            <td className="td py-1.5!" />
            <td className="td py-1.5!" />
            <td className="td py-1.5! pl-9! text-[16px]! text-muted">{m.label}</td>
            <td className="td num py-1.5! text-[16px]! text-alert">{signed(m.change)}</td>
            <td className="td py-1.5!" />
            <td className="td py-1.5! text-[14px]! text-faint italic" colSpan={3}>
              {m.note?.includes("manquait") ? m.note.split(" · ").find((part) => part.startsWith("manquait")) : ""}
            </td>
          </tr>
        ))}
    </>
  );
}

// Fenêtre d'une vente : tout ce que la commande a retiré.
function SaleDetail({ sale, onClose }) {
  useEffect(() => {
    const onKey = (event) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Vente ${sale.orderNumber ? `#${sale.orderNumber}` : ""}`}
        onClick={(event) => event.stopPropagation()}
        className="relative flex w-full max-w-[660px] flex-col border border-gold/80 bg-panel px-7 py-9 sm:px-14 sm:py-12"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer"
          className="absolute top-5 right-5 h-10 w-10 cursor-pointer border border-line bg-transparent text-[22px] leading-none text-gold-light hover:text-cream"
        >
          ×
        </button>
        <div className="lbl pr-12">Vente{sale.orderNumber ? ` · Commande #${sale.orderNumber}` : ""}</div>
        <h2 className="m-0 mt-2.5 pr-12 text-[30px] leading-tight font-semibold text-cream">{sale.sources.join(", ")}</h2>
        <div className="sub mt-2">{fullDate(sale.at)} · Square</div>
        <div className="mt-7 h-px bg-gold/45" />

        <div className="lbl mt-7 mb-2">Retiré du stock</div>
        {sale.items.map((m) => {
          const missing = m.note?.split(" · ").find((part) => part.startsWith("manquait"));
          return (
            <div key={m.id} className="flex items-baseline justify-between gap-4 border-t border-line/40 py-2.5">
              <Link to={`/produits/${m.productId}`} className="text-[19px] text-cream! no-underline hover:text-gold-light!">
                {m.label}
              </Link>
              <span className="whitespace-nowrap">
                <span className="text-[19px] text-alert">{signed(m.change)}</span>
                {missing && <span className="ml-3 text-[14px] text-alert-soft italic">{missing}</span>}
              </span>
            </div>
          );
        })}
        <div className="sub mt-6 text-[11px]!">Square {sale.ref}</div>
      </div>
    </div>
  );
}

const fullDate = (iso) =>
  new Date(iso).toLocaleString("fr-CA", {
    weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
  });

// Détail d'un mouvement : même fenêtre que Ajuster (avant / mouvement / après).
function Detail({ movement: m, onClose, personName }) {
  useEffect(() => {
    const onKey = (event) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const before = m.after - m.change;
  const box = "flex flex-col items-center gap-2 border bg-ink px-4 py-5";
  const info = [
    ["Raison", REASON_LABELS[m.reason] || m.reason],
    ["Par", personName(m.person)],
    ["Collection", m.collection || "—"],
    ["Le", fullDate(m.at)],
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Mouvement ${m.product}`}
        onClick={(event) => event.stopPropagation()}
        className="relative flex w-full max-w-[660px] flex-col border border-gold/80 bg-panel px-7 py-9 sm:px-14 sm:py-12"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer"
          className="absolute top-5 right-5 h-10 w-10 cursor-pointer border border-line bg-transparent text-[22px] leading-none text-gold-light hover:text-cream"
        >
          ×
        </button>

        <div className="lbl pr-12">Mouvement</div>
        <h2 className="m-0 mt-2.5 pr-12 text-[30px] leading-tight font-semibold text-cream">
          <Link to={`/produits/${m.productId}`} className="text-cream! no-underline hover:text-gold-light!">
            {m.product}
          </Link>
        </h2>
        <div className="sub mt-2">{[m.variant, m.collection].filter(Boolean).join(" · ")}</div>
        <div className="mt-7 h-px bg-gold/45" />

        <div className="mt-9 grid grid-cols-3 gap-5">
          <div className={`${box} border-line`}>
            <span className="lbl">Avant</span>
            <span className="text-[34px] leading-tight font-semibold text-muted2">{before}</span>
          </div>
          <div className={`${box} border-line`}>
            <span className="lbl">Mouvement</span>
            <span className={`text-[34px] leading-tight font-semibold ${m.change > 0 ? "text-ok" : "text-alert"}`}>
              {m.change > 0 ? "+" : "−"}
              {Math.abs(m.change)}
            </span>
          </div>
          <div className={`${box} border-gold`}>
            <span className="lbl">Après</span>
            <span className="text-[34px] leading-tight font-semibold text-cream">{m.after}</span>
          </div>
        </div>

        <div className="mt-9 h-px bg-gold/45" />
        <dl className="m-0 mt-2 flex flex-col">
          {info.map(([label, value]) => (
            <div key={label} className="mt-5 border-l-2 border-gold py-0.5 pl-4">
              <dt className="lbl">{label}</dt>
              <dd className="m-0 mt-1.5 text-[20px] text-cream">{value}</dd>
            </div>
          ))}
        </dl>

        {m.note && (
          <>
            <div className="mt-9 h-px bg-gold/45" />
            <div className="lbl mt-7 mb-3">Note</div>
            <div className="border-l-2 border-gold pl-3.5 text-[18px] text-muted italic">{m.note}</div>
          </>
        )}
      </div>
    </div>
  );
}

function Filter({ label, children }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="lbl">{label}</span>
      {children}
    </label>
  );
}

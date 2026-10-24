// Historique : tous les mouvements de stock (qui, quoi, combien, pourquoi).
// Filtres : raison, personne, période, et recherche par pièce.
// Les mouvements viennent de la table stock_movements (migration 017).
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { useInventory } from "../store.jsx";
import { PageHeader } from "../components/ui.jsx";
import { REASON_LABELS } from "../components/Ajuster.jsx";

const dateTime = (iso) =>
  new Date(iso).toLocaleString("fr-CA", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).replace(".", "");

export default function Historique() {
  const { source, loadedAt, error } = useInventory();
  const [filters, setFilters] = useState({ raison: "", personne: "", du: "", au: "" });
  const [query, setQuery] = useState("");
  const [data, setData] = useState({ movements: [], people: [] });
  const [status, setStatus] = useState("chargement");

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
                    {email.split("@")[0]}
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
                  <th className="th">Pièce</th>
                  <th className="th num">Mouvement</th>
                  <th className="th num">Après</th>
                  <th className="th">Raison</th>
                  <th className="th">Personne</th>
                  <th className="th">Note</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((m) => (
                  <tr key={m.id}>
                    <td className="td whitespace-nowrap text-[16px]! text-muted">{dateTime(m.at)}</td>
                    <td className="td">
                      <Link to={`/produits/${m.productId}`} className="text-parch!">
                        {m.product}
                      </Link>
                      <div className="sub mt-0.5">
                        {[m.variant, m.collection].filter(Boolean).join(" · ")}
                      </div>
                    </td>
                    <td className={`td num ${m.change > 0 ? "text-ok" : "text-alert"}`}>
                      {m.change > 0 ? "+" : "−"}
                      {Math.abs(m.change)}
                    </td>
                    <td className="td num text-muted2">{m.after}</td>
                    <td className="td">
                      <span className="sub text-[13px]! text-gold!">{REASON_LABELS[m.reason] || m.reason}</span>
                    </td>
                    <td className="td text-[16px]! text-muted">{m.person ? m.person.split("@")[0] : "Square"}</td>
                    <td className="td max-w-[260px] text-[15px]! text-muted2 italic">{m.note || ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {status === "chargement" && rows.length === 0 && <div className="sub px-4 py-5">Chargement…</div>}
            {status === "erreur" && <div className="px-4 py-5 text-[15px] text-alert">Lecture de l'historique impossible.</div>}
            {status === "pret" && rows.length === 0 && <div className="sub px-4 py-5">Aucun mouvement pour ces filtres.</div>}
          </div>
          {data.movements.length >= 300 && <div className="sub">Les 300 derniers mouvements : affine les filtres pour voir plus loin.</div>}
        </>
      )}
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

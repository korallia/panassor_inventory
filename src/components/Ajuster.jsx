// Panneau « Ajuster » (maquette B) : s'ouvre à droite, par-dessus la page.
// On choisit Ajouter ou Retirer, la quantité, et l'aperçu « 12 → 15 »
// montre le résultat avant de confirmer.
import { useEffect, useState } from "react";

import { useInventory } from "../store.jsx";

const ACTIONS = [
  { id: "ajouter", label: "Ajouter" },
  { id: "retirer", label: "Retirer" },
];

/** Bouton « Ajuster » (vraies données) ou − / + (données d'exemple). */
export function StockControl({ stockId, value, children }) {
  const { source, openAdjust } = useInventory();
  if (source !== "live") return children;
  return (
    <div className="inline-flex items-stretch">
      <div className="inline-flex h-9 w-14 items-center justify-center border border-line/50 text-[18px] text-parch tabular-nums">
        {value}
      </div>
      <button
        type="button"
        disabled={!stockId}
        onClick={() => openAdjust(stockId)}
        className="sc h-9 cursor-pointer border border-l-0 border-line bg-panel2 px-3 text-[12px] tracking-[.14em] text-gold-light hover:text-cream disabled:cursor-not-allowed disabled:opacity-40"
      >
        Ajuster
      </button>
    </div>
  );
}

export default function AjusterPanel() {
  const { adjusting, closeAdjust, findStockLine, adjustStock } = useInventory();
  const line = adjusting ? findStockLine(adjusting) : null;

  const [action, setAction] = useState("ajouter");
  const [amount, setAmount] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  // Nouvelle pièce : on repart à zéro.
  useEffect(() => {
    setAction("ajouter");
    setAmount(1);
    setError(null);
  }, [adjusting]);

  useEffect(() => {
    if (!adjusting) return;
    const onKey = (event) => event.key === "Escape" && closeAdjust();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [adjusting, closeAdjust]);

  if (!adjusting || !line) return null;

  const before = line.stock;
  const after = action === "ajouter" ? before + amount : before - amount;
  const invalid = amount < 1 || after < 0;

  const submit = async (event) => {
    event.preventDefault();
    if (invalid || busy) return;
    setBusy(true);
    setError(null);
    const result = await adjustStock(adjusting, { action, amount });
    setBusy(false);
    if (!result.ok) return setError(result.error);
    setAmount(1);
  };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50" onClick={closeAdjust} aria-hidden="true" />
      <aside
        role="dialog"
        aria-label={`Ajuster ${line.name}`}
        className="fixed inset-y-0 right-0 z-50 flex w-full flex-col gap-5 overflow-y-auto border-l border-gold/70 bg-panel px-6 py-6 sm:w-[380px]"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="lbl">{line.detail}</div>
            <div className="sc mt-1 text-[24px] leading-tight text-cream">{line.name}</div>
            <div className="mt-1 text-[30px] leading-none text-cream tabular-nums">
              {before} <span className="text-[15px] text-faint">en stock</span>
            </div>
          </div>
          <button
            type="button"
            onClick={closeAdjust}
            aria-label="Fermer"
            className="h-9 w-9 cursor-pointer border border-line bg-transparent text-[20px] leading-none text-gold-light hover:text-cream"
          >
            ×
          </button>
        </div>

        <form onSubmit={submit} className="flex flex-col gap-4">
          <div role="radiogroup" aria-label="Action" className="flex gap-2">
            {ACTIONS.map((a) => (
              <button
                key={a.id}
                type="button"
                role="radio"
                aria-checked={action === a.id}
                onClick={() => {
                  setAction(a.id);
                  setError(null);
                }}
                className={`h-10 flex-1 cursor-pointer border text-[16px] ${
                  action === a.id ? "border-gold bg-gold/12 text-cream" : "border-line bg-transparent text-muted hover:text-cream"
                }`}
              >
                {a.label}
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between gap-3">
            <div className="inline-flex items-stretch" role="group" aria-label="Quantité">
              <button
                type="button"
                aria-label="Un de moins"
                onClick={() => setAmount((n) => Math.max(1, n - 1))}
                className="h-10 w-10 cursor-pointer border border-line bg-panel2 text-[20px] text-gold-light hover:text-cream"
              >
                −
              </button>
              <input
                aria-label="Quantité"
                inputMode="numeric"
                autoFocus
                className="h-10 w-16 border-y border-line bg-ink text-center text-[19px] text-cream tabular-nums"
                value={amount}
                onChange={(event) => setAmount(Number(event.target.value.replace(/\D/g, "")) || 0)}
              />
              <button
                type="button"
                aria-label="Un de plus"
                onClick={() => setAmount((n) => n + 1)}
                className="h-10 w-10 cursor-pointer border border-line bg-panel2 text-[20px] text-gold-light hover:text-cream"
              >
                +
              </button>
            </div>
            <div className="text-right text-[20px] text-muted tabular-nums">
              {before}
              <span className="mx-2 text-gold">→</span>
              <span className={after < 0 ? "text-alert" : "text-cream"}>{after}</span>
            </div>
          </div>

          {error && <div className="text-[15px] text-alert">{error}</div>}
          {after < 0 && <div className="text-[15px] text-alert">Il n'y en a que {before} en stock.</div>}

          <button type="submit" className="btn-primary" disabled={invalid || busy}>
            {busy ? "Enregistrement…" : "Confirmer"}
          </button>
        </form>
      </aside>
    </>
  );
}

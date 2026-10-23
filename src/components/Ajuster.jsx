// Fenêtre « Ajuster » : s'ouvre au milieu de l'écran, par-dessus la page.
// Interrupteur Ajouter / Retirer, quantité (clavier ou − / +), et l'aperçu
// « en stock → après » montre le résultat avant de confirmer.
import { useEffect, useState } from "react";

import { useInventory } from "../store.jsx";

const ACTIONS = [
  { id: "ajouter", label: "Ajouter" },
  { id: "retirer", label: "Retirer" },
];

// Raisons : pour l'instant SEULEMENT dans l'interface (rien n'est envoyé ni
// enregistré). Elles seront branchées sur la base avec l'étape historique.
const REASONS = {
  ajouter: ["Fabrication", "Correction"],
  retirer: ["Perte", "Correction"],
};

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
  const [quantity, setQuantity] = useState("1"); // texte : on peut l'effacer pour taper un autre nombre
  const [reason, setReason] = useState(REASONS.ajouter[0]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  // Nouvelle pièce : on repart à zéro.
  useEffect(() => {
    setAction("ajouter");
    setQuantity("1");
    setReason(REASONS.ajouter[0]);
    setError(null);
  }, [adjusting]);

  useEffect(() => {
    if (!adjusting) return;
    const onKey = (event) => event.key === "Escape" && closeAdjust();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [adjusting, closeAdjust]);

  if (!adjusting || !line) return null;

  const amount = Number(quantity) || 0;
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
    closeAdjust();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 p-4" onClick={closeAdjust}>
      <form
        role="dialog"
        aria-modal="true"
        aria-label={`Ajuster ${line.name}`}
        onSubmit={submit}
        onClick={(event) => event.stopPropagation()}
        className="relative flex w-full max-w-[680px] flex-col gap-7 border border-gold/80 bg-panel px-6 py-8 sm:px-12 sm:py-10"
      >
        <button
          type="button"
          onClick={closeAdjust}
          aria-label="Fermer"
          className="absolute top-5 right-5 h-10 w-10 cursor-pointer border border-line bg-transparent text-[22px] leading-none text-gold-light hover:text-cream"
        >
          ×
        </button>

        <div>
          <div className="lbl pr-12">{line.detail} · ajuster le stock</div>
          <h2 className="sc m-0 mt-2 pr-12 text-[28px] leading-tight font-normal text-cream sm:text-[34px]">{line.name}</h2>
          <div className="mt-3 flex justify-end">
            <div role="radiogroup" aria-label="Ajouter ou retirer" className="flex w-full max-w-[340px] rounded-full border border-line p-1">
              {ACTIONS.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  role="radio"
                  aria-checked={action === a.id}
                  onClick={() => {
                    setAction(a.id);
                    setReason(REASONS[a.id][0]);
                    setError(null);
                  }}
                  className={`h-11 flex-1 cursor-pointer rounded-full border-0 text-[19px] ${
                    action === a.id ? "bg-gold text-ink" : "bg-transparent text-muted hover:text-cream"
                  }`}
                >
                  {a.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="h-px bg-gold/45" />

        <div className="flex items-center justify-center gap-10 border border-line bg-panel2 px-6 py-5 tabular-nums">
          <div className="flex w-28 flex-col items-center gap-1.5">
            <span className="text-[44px] leading-none text-muted">{before}</span>
            <span className="lbl whitespace-nowrap">En stock</span>
          </div>
          <span className="text-[30px] leading-none text-gold">→</span>
          <div className="flex w-28 flex-col items-center gap-1.5">
            <span className={`text-[44px] leading-none ${after < 0 ? "text-alert" : "text-cream"}`}>{after}</span>
            <span className="lbl">Après</span>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-6">
          <div className="flex flex-col gap-2.5">
            <span className="lbl text-[14px]!">Quantité</span>
            <div className="flex items-stretch" role="group" aria-label="Quantité">
              <button
                type="button"
                aria-label="Un de moins"
                onClick={() => setQuantity(String(Math.max(1, amount - 1)))}
                className="h-14 w-12 cursor-pointer border border-line bg-panel2 text-[24px] text-gold-light hover:text-cream"
              >
                −
              </button>
              <input
                autoFocus
                inputMode="numeric"
                aria-label="Quantité"
                className="h-14 w-24 border-y border-gold bg-ink text-center text-[28px] text-cream tabular-nums outline-none focus:border-gold-light"
                value={quantity}
                onFocus={(event) => event.target.select()}
                onChange={(event) => setQuantity(event.target.value.replace(/\D/g, "").slice(0, 6))}
              />
              <button
                type="button"
                aria-label="Un de plus"
                onClick={() => setQuantity(String(amount + 1))}
                className="h-14 w-12 cursor-pointer border border-line bg-panel2 text-[24px] text-gold-light hover:text-cream"
              >
                +
              </button>
            </div>
          </div>
          <label className="flex min-w-[200px] flex-1 flex-col gap-2.5">
            <span className="lbl text-[14px]!">Raison</span>
            <select className="field h-14! text-[20px]!" value={reason} onChange={(event) => setReason(event.target.value)}>
              {REASONS[action].map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </label>
        </div>

        {error && <div className="text-[16px] text-alert">{error}</div>}
        {after < 0 && <div className="text-[16px] text-alert">Il n'y en a que {before} en stock.</div>}

        <div className="flex justify-end">
          <button type="submit" className="btn-primary px-10!" disabled={invalid || busy}>
            {busy ? "Enregistrement…" : "Confirmer"}
          </button>
        </div>
      </form>
    </div>
  );
}

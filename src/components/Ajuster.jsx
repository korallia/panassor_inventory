// Fenêtre « Ajuster » : s'ouvre au milieu de l'écran, par-dessus la page.
// Interrupteur Ajouter / Retirer, quantité (clavier ou − / +), et l'aperçu
// « en stock → après » montre le résultat avant de confirmer.
import { useEffect, useState } from "react";

import { useInventory } from "../store.jsx";

// Raison et note : pour l'instant SEULEMENT dans l'interface (rien n'est envoyé
// ni enregistré). Elles seront branchées sur la base avec l'étape historique.
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
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  // Nouvelle pièce : on repart à zéro.
  useEffect(() => {
    setAction("ajouter");
    setQuantity("1");
    setReason(REASONS.ajouter[0]);
    setNote("");
    setError(null);
  }, [adjusting]);

  const chooseAction = (next) => {
    setAction(next);
    setReason(REASONS[next][0]);
    setError(null);
  };

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
          <div className="mt-5 h-px bg-gold/45" />
          {/* Interrupteur : sous la ligne du titre, à droite, en petit. */}
          <div className="mt-6 mb-2 flex justify-end pr-1">
            <div className="sc flex items-center gap-3.5 text-[15px] tracking-[.16em]">
              <button
                type="button"
                onClick={() => chooseAction("ajouter")}
                className={`sc cursor-pointer border-0 bg-transparent p-0 tracking-[.16em] ${action === "ajouter" ? "text-cream" : "text-faint hover:text-muted"}`}
              >
                Ajouter
              </button>
              {/* Fil d'or avec un losange qui glisse vers le choix. */}
              <button
                type="button"
                role="switch"
                aria-checked={action === "retirer"}
                aria-label="Retirer au lieu d'ajouter"
                onClick={() => chooseAction(action === "ajouter" ? "retirer" : "ajouter")}
                className="relative h-5 w-16 cursor-pointer border-0 bg-transparent p-0"
              >
                <span className="absolute top-1/2 right-0 left-0 h-px bg-gold" />
                <span className="absolute top-1/2 left-0 h-[7px] w-px -translate-y-1/2 bg-gold" />
                <span className="absolute top-1/2 right-0 h-[7px] w-px -translate-y-1/2 bg-gold" />
                <span
                  className={`absolute top-1/2 left-[2px] h-[11px] w-[11px] -translate-y-1/2 rotate-45 bg-gold-light transition-transform duration-200 ${
                    action === "retirer" ? "translate-x-[49px]" : ""
                  }`}
                />
              </button>
              <button
                type="button"
                onClick={() => chooseAction("retirer")}
                className={`sc cursor-pointer border-0 bg-transparent p-0 tracking-[.16em] ${action === "retirer" ? "text-cream" : "text-faint hover:text-muted"}`}
              >
                Retirer
              </button>
            </div>
          </div>
        </div>

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

        <div className="mt-2 grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div className="flex min-w-0 flex-col gap-2.5">
            <span className="lbl text-[14px]!">Quantité</span>
            <div className="group flex h-14 items-stretch border border-gold focus-within:border-[#dcae4f]" role="group" aria-label="Quantité">
              <button
                type="button"
                aria-label="Un de moins"
                onClick={() => setQuantity(String(Math.max(1, amount - 1)))}
                className="sc w-14 cursor-pointer border-0 bg-transparent text-[20px] text-cream hover:bg-gold/8"
              >
                −
              </button>
              <input
                autoFocus
                inputMode="numeric"
                aria-label="Quantité"
                className="min-w-0 flex-1 border-x border-y-0 border-line/50 bg-ink text-center text-[24px] text-cream tabular-nums outline-none"
                value={quantity}
                onFocus={(event) => event.target.select()}
                onChange={(event) => setQuantity(event.target.value.replace(/\D/g, "").slice(0, 6))}
              />
              <button
                type="button"
                aria-label="Un de plus"
                onClick={() => setQuantity(String(amount + 1))}
                className="sc w-14 cursor-pointer border-0 bg-transparent text-[20px] text-cream hover:bg-gold/8"
              >
                +
              </button>
            </div>
          </div>
          <label className="flex min-w-0 flex-col gap-2.5">
            <span className="lbl text-[14px]!">Raison</span>
            <div className="relative">
              <select
                className="sc h-14 w-full min-w-0 cursor-pointer appearance-none border border-gold bg-ink pr-10 pl-4 text-[14px] tracking-[.08em] text-cream outline-none focus:border-[#dcae4f]"
                value={reason}
                onChange={(event) => {
                  setReason(event.target.value);
                  event.target.blur(); // choix fait : le menu ne reste pas en surbrillance
                }}
              >
                {REASONS[action].map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
              <span className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-[14px] text-gold">▾</span>
            </div>
          </label>
        </div>

        <label className="flex flex-col gap-2.5">
          <span className="lbl text-[14px]!">Note</span>
          <input
            className="sc h-14 w-full border border-gold bg-ink px-4 text-[14px] tracking-[.08em] text-cream outline-none focus:border-[#dcae4f] placeholder:text-faint"
            maxLength={500}
            placeholder="Optionnelle"
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
        </label>

        {error && <div className="text-[16px] text-alert">{error}</div>}
        {after < 0 && <div className="text-[16px] text-alert">Il n'y en a que {before} en stock.</div>}

        <div className="mt-3 -mb-3 h-px bg-gold/45" />

        <div className="mt-5 flex justify-center">
          <button
            type="submit"
            disabled={invalid || busy}
            className="sc h-11 shrink-0 cursor-pointer border border-btn-line bg-btn px-4 text-[13px] tracking-[.12em] sm:px-8 sm:text-[14px] sm:tracking-[.14em] text-btn-text hover:bg-[#28422f] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? "Enregistrement…" : "Confirmer"}
          </button>
        </div>
      </form>
    </div>
  );
}

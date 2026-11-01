// Fenêtre « Ajouter des kits » : ajoute d'un coup un ou plusieurs kits complets
// (fabrication) — l'étui de la couleur choisie et chaque pièce de sa composition — au lieu
// d'y aller pièce par pièce. Le serveur fait le calcul (server/stock.js, addKits).
import { useEffect, useState } from "react";

import { useInventory } from "../store.jsx";
import { Stepper } from "./ui.jsx";

export function AjouterKits({ onClose, initialKitId }) {
  const { kits, productsById, addKits } = useInventory();
  const [kitId, setKitId] = useState(initialKitId || kits[0]?.id || "");
  const kit = kits.find((k) => k.id === kitId);
  const colors = (kit?.leather || []).filter((leather) => leather.variantId);
  const [variantId, setVariantId] = useState(colors[0]?.variantId || null);
  const [count, setCount] = useState(1);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Changer de kit : première couleur de ce kit.
  useEffect(() => {
    setVariantId((kits.find((k) => k.id === kitId)?.leather || []).find((l) => l.variantId)?.variantId || null);
  }, [kitId, kits]);

  useEffect(() => {
    const onKey = (event) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const color = colors.find((c) => c.variantId === variantId);
  const pieces = (kit?.components || []).map((c) => {
    const product = productsById[c.productId];
    const name = product?.type === "paquet" ? `${product.name} (paquet)` : product?.name || "?";
    return { name, qty: (c.qty || 1) * count, choice: c.choice };
  });

  async function confirm() {
    setBusy(true);
    setError("");
    const result = await addKits({ kitId: Number(kitId), variantId: variantId ? Number(variantId) : null, count, note });
    setBusy(false);
    if (result.ok) onClose();
    else setError(result.error);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Ajouter des kits complets"
        onClick={(event) => event.stopPropagation()}
        className="relative flex w-full max-w-[620px] flex-col gap-6 border border-gold/80 bg-panel px-7 py-9 sm:px-12 sm:py-10"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer"
          className="absolute top-5 right-5 h-10 w-10 cursor-pointer border border-line bg-transparent text-[22px] leading-none text-gold-light hover:text-cream"
        >
          ×
        </button>
        <div>
          <div className="lbl">Fabrication</div>
          <h2 className="m-0 mt-2 text-[28px] leading-tight font-semibold text-cream">Ajouter des kits complets</h2>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="lbl">Kit</span>
          <select className="field bg-panel2!" value={kitId} onChange={(event) => setKitId(event.target.value)}>
            {kits.map((k) => (
              <option key={k.id} value={k.id}>
                {k.name}
              </option>
            ))}
          </select>
        </label>

        {colors.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <span className="lbl">Cuir de l'étui</span>
            <div className="flex flex-wrap gap-2">
              {colors.map((c) => (
                <button
                  key={c.variantId}
                  type="button"
                  onClick={() => setVariantId(c.variantId)}
                  className={`flex cursor-pointer items-center gap-2 border px-3 py-2 text-[16px] ${
                    c.variantId === variantId ? "border-gold bg-gold/15 text-cream" : "border-line bg-transparent text-muted2 hover:text-cream"
                  }`}
                >
                  <span className="inline-block h-4 w-4 border border-line" style={{ background: c.swatch }} />
                  {c.color}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <span className="lbl">Nombre de kits</span>
          <Stepper label="Nombre de kits" value={count} onChange={(value) => setCount(Math.max(1, Math.min(200, value)))} />
        </div>

        <div className="flex flex-col gap-2 border-t border-gold/45 pt-5">
          <span className="lbl">Ajouté au stock</span>
          {color && (
            <div className="flex justify-between border-b border-line/30 pb-1.5 text-[17px]">
              <span className="text-cream">Étui {color.color.toLowerCase()}</span>
              <span className="text-ok tabular-nums">+{count}</span>
            </div>
          )}
          {pieces.map((piece) => (
            <div key={piece.name} className="flex justify-between border-b border-line/30 pb-1.5 text-[17px]">
              <span className="text-cream">{piece.name}</span>
              <span className="text-ok tabular-nums">+{piece.qty}</span>
            </div>
          ))}
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="lbl">Note (facultatif)</span>
          <input className="field" value={note} onChange={(event) => setNote(event.target.value)} placeholder="ex. Lot de novembre" />
        </label>

        {error && <div className="text-[15px] text-alert">{error}</div>}
        <div className="flex justify-end gap-3">
          <button type="button" className="btn-ghost" onClick={onClose}>
            Annuler
          </button>
          <button type="button" className="btn-primary" disabled={busy || !kit} onClick={confirm}>
            {busy ? "Ajout…" : `Ajouter ${count} ${count > 1 ? "kits" : "kit"}`}
          </button>
        </div>
      </div>
    </div>
  );
}

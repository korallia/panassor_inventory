// Alertes (minimum → Discord ou courriel) et rapports planifiés.
// Rien n'est envoyé : l'aperçu montre le message qui partirait.
import { useState } from "react";

import { useInventory } from "../store.jsx";
import { kitsReady, leatherTotal, productState, stockStatus } from "../lib/inventory.js";
import { SampleNote, StatusPill, Stepper } from "../components/ui.jsx";

const CHANNELS = ["Discord", "Courriel", "Discord · courriel"];

export default function Alertes() {
  const { products, kits, collections, productsById, reserved, reports, alertChannels, dispatch } = useInventory();
  const [onlyLow, setOnlyLow] = useState(false);
  const [previewId, setPreviewId] = useState(null);

  const rows = [
    ...kits.map((kit) => {
      const ready = kitsReady(kit, productsById);
      return { id: kit.id, kit, name: kit.name, free: ready, min: kit.min, status: stockStatus(ready, kit.min), unit: "kits prêts" };
    }),
    ...products
      .filter((product) => product.type !== "ensemble")
      .map((product) => {
        const state = productState(product, reserved);
        return { id: product.id, product, name: product.name, ...state, unit: product.type === "paquet" ? "paquets" : "" };
      }),
  ].filter((row) => !onlyLow || row.status !== "ok");

  const lowRows = rows.filter((row) => row.status !== "ok");
  const preview = rows.find((row) => row.id === previewId) ?? lowRows[0];

  return (
    <div className="grid gap-7 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="flex min-w-0 flex-col gap-5">
        <div>
          <div className="eyebrow">Seuils</div>
          <h1 className="sc m-0 mt-1.5 text-[40px] leading-none text-cream sm:text-[48px]">Alertes de stock</h1>
          <div className="mt-2 text-[19px] text-muted">
            Un message part dès que le stock <span className="text-cream">disponible</span> (libre) passe sous le minimum.
          </div>
        </div>

        <label className="flex w-fit cursor-pointer items-center gap-2.5 text-[17px] text-muted">
          <input type="checkbox" className="h-4 w-4 accent-[#c89b3c]" checked={onlyLow} onChange={(e) => setOnlyLow(e.target.checked)} />
          Seulement ce qui est sous le minimum ({lowRows.length})
        </label>

        <div className="overflow-x-auto border border-line bg-panel">
          <table className="w-full min-w-[720px] border-collapse">
            <thead>
              <tr>
                <th className="th">Produit</th>
                <th className="th num">Disponible</th>
                <th className="th">Minimum</th>
                <th className="th">Prévenir par</th>
                <th className="th">État</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const collection = collections.find((c) => c.id === (row.kit ?? row.product).collectionId);
                return (
                  <tr
                    key={row.id}
                    className={`cursor-pointer ${preview?.id === row.id ? "bg-gold/8" : "hover:bg-gold/5"}`}
                    onClick={() => setPreviewId(row.id)}
                  >
                    <td className={`td ${row.kit ? "font-semibold text-cream" : ""}`}>
                      {row.name}
                      <span className="ml-2 text-[14px] text-faint">{collection?.name}</span>
                    </td>
                    <td className={`td num ${row.status !== "ok" ? "text-alert-soft" : ""}`}>
                      {row.free}
                      {row.unit && <span className="ml-1.5 text-[14px] text-faint">{row.unit}</span>}
                    </td>
                    <td className="td" onClick={(e) => e.stopPropagation()}>
                      <Stepper
                        small
                        label={`Minimum ${row.name}`}
                        value={row.min}
                        onChange={(value) =>
                          row.kit
                            ? dispatch({ type: "setKitMin", kitId: row.kit.id, value })
                            : dispatch({ type: "setMin", productId: row.product.id, value })
                        }
                      />
                    </td>
                    <td className="td" onClick={(e) => e.stopPropagation()}>
                      <select
                        aria-label={`Canal ${row.name}`}
                        className="h-9 border border-line bg-panel2 px-2 text-[16px] text-gold-light"
                        value={alertChannels[row.id] ?? "Discord"}
                        onChange={(e) => dispatch({ type: "setAlertChannel", productId: row.id, value: e.target.value })}
                      >
                        {CHANNELS.map((channel) => (
                          <option key={channel}>{channel}</option>
                        ))}
                      </select>
                    </td>
                    <td className="td">
                      <StatusPill status={row.status} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="lbl">Aperçu d'une alerte</div>
        {preview ? (
          <AlertPreview row={preview} channel={alertChannels[preview.id] ?? "Discord"} kits={kits} productsById={productsById} />
        ) : (
          <div className="border border-line bg-panel px-5 py-4 text-[17px] text-muted2">Tout est au-dessus du minimum : aucune alerte.</div>
        )}
        <SampleNote />
      </div>

      <aside className="flex flex-col gap-4">
        <div className="flex flex-col gap-3.5 border border-line bg-panel p-5">
          <div className="lbl">Rapports planifiés</div>
          {reports.map((report) => (
            <div key={report.id} className="flex flex-col gap-1 border border-line/60 bg-panel2 p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[19px] text-cream">{report.name}</span>
                <button
                  type="button"
                  onClick={() => dispatch({ type: "toggleReport", id: report.id })}
                  className="sc cursor-pointer border bg-transparent px-2.5 py-0.5 text-[13px] tracking-[.08em]"
                  style={report.active ? { color: "#9fc7a4", borderColor: "#3f6b48" } : { color: "#b9a888", borderColor: "#6f5423" }}
                  title="Activer / mettre en pause"
                >
                  {report.active ? "Actif" : "En pause"}
                </button>
              </div>
              <div className="text-[16px] text-muted">
                {report.schedule} · {report.channel.toLowerCase()}
              </div>
              <div className="text-[15px] text-faint">{report.contents}</div>
            </div>
          ))}
          <button
            type="button"
            className="btn-primary"
            onClick={() =>
              dispatch({
                type: "addReport",
                report: {
                  id: `rep-${Date.now()}`,
                  name: "Nouveau rapport",
                  schedule: "Chaque vendredi, 17 h",
                  channel: "Discord",
                  active: false,
                  contents: "Sous le minimum, kits prêts",
                },
              })
            }
          >
            Nouveau rapport
          </button>
        </div>
        <ReportPreview />
      </aside>
    </div>
  );
}

function AlertPreview({ row, channel, kits, productsById }) {
  let detail;
  if (row.kit) {
    detail = `Kits prêts : ${row.free} sur ${leatherTotal(row.kit)} étuis (minimum ${row.min}).`;
  } else {
    const kit = kits.find((k) => k.components.some((c) => c.productId === row.product.id));
    detail = row.reserved
      ? `${row.reserved} réservés dans les kits${kit ? ` — ${kit.name} prêts : ${kitsReady(kit, productsById)} sur ${leatherTotal(kit)} étuis` : ""}.`
      : "Aucun réservé dans les kits.";
  }
  const low = row.status !== "ok";
  return (
    <div className={`flex flex-col gap-1.5 border px-5 py-4 text-[17px] ${low ? "border-alert-line bg-alert-bg" : "border-line bg-panel"}`}>
      <div className="flex items-center justify-between gap-3">
        <div className={`sc text-[16px] tracking-[.12em] ${low ? "text-alert" : "text-ok"}`}>
          {low ? "Stock bas" : "Pas d'alerte"} — {row.name}
        </div>
        <div className="text-[14px] text-faint">via {channel}</div>
      </div>
      <div>
        Disponible : <span className={low ? "text-alert-soft" : "text-cream"}>{row.free}</span> {row.unit} (minimum {row.min}).
        {low && ` Il en manque ${row.min - row.free}.`}
      </div>
      <div className="text-muted2">{detail}</div>
    </div>
  );
}

function ReportPreview() {
  const { collections, products, kits, productsById, reserved } = useInventory();
  return (
    <div className="flex flex-col gap-2 border border-line bg-panel p-5 text-[16px]">
      <div className="lbl">Aperçu du rapport</div>
      {collections.map((collection) => {
        const kit = kits.find((k) => k.collectionId === collection.id);
        const low = products.filter(
          (p) => p.collectionId === collection.id && p.type !== "ensemble" && productState(p, reserved).status !== "ok"
        );
        return (
          <div key={collection.id} className="border-t border-line/35 pt-2">
            <div className="text-cream">{collection.name}</div>
            {kit && (
              <div className="text-muted">
                Kits prêts : {kitsReady(kit, productsById)} / {leatherTotal(kit)}
              </div>
            )}
            <div className={low.length ? "text-alert-soft" : "text-faint"}>
              {low.length ? `Sous le min. : ${low.map((p) => p.name).join(", ")}` : "Rien sous le minimum"}
            </div>
          </div>
        );
      })}
    </div>
  );
}

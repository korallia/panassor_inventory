// Kits : le seul endroit où les étuis de cuir sont listés.
// Kits visés = total des étuis (toutes couleurs) ; chaque composant en
// réserve autant (l'outil par défaut pour les « au choix »).
import { Link, useNavigate, useParams } from "react-router-dom";

import { useInventory } from "../store.jsx";
import { kitShortages, kitsReady, leatherTotal, productState } from "../lib/inventory.js";
import { SampleNote, StatusPill, Stepper } from "../components/ui.jsx";

export default function Kits() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { kits, productsById, reserved, dispatch } = useInventory();
  const kit = kits.find((k) => k.id === id) ?? kits[0];

  const target = leatherTotal(kit);
  const ready = kitsReady(kit, productsById);
  const shortages = kitShortages(kit, productsById);
  const status = ready < kit.min ? "low" : "ok";

  return (
    <div className="flex flex-col gap-6">
      <div role="tablist" aria-label="Kit" className="flex overflow-x-auto border-b border-line">
        {kits.map((k) => {
          const selected = k.id === kit.id;
          return (
            <button
              key={k.id}
              role="tab"
              aria-selected={selected}
              onClick={() => navigate(`/kits/${k.id}`)}
              className={`sc h-12 shrink-0 cursor-pointer border-0 border-b-2 bg-transparent px-5 text-[16px] tracking-[.12em] ${
                selected ? "border-gold text-cream" : "border-transparent text-muted2 hover:text-cream"
              }`}
            >
              {k.name}
            </button>
          );
        })}
      </div>

      <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <div
          className="flex flex-col gap-4 border border-gold p-6"
          style={{ background: "linear-gradient(180deg,#1a1109 0%,#0d0805 100%)" }}
        >
          <div className="flex items-center justify-between">
            <div className="lbl">Kits prêts à vendre</div>
            <StatusPill status={status} />
          </div>
          <div className="flex items-baseline gap-3">
            <div className={`text-[72px] font-semibold leading-none ${status === "low" ? "text-alert-soft" : "text-cream"}`}>{ready}</div>
            <div className="text-[19px] text-muted">
              sur {target} {target === 1 ? "étui" : "étuis"}
            </div>
          </div>
          {shortages.length > 0 ? (
            <div className="text-[17px] text-muted">
              Il manque{" "}
              {shortages.map((s, index) => (
                <span key={s.product.id}>
                  {index > 0 && (index === shortages.length - 1 ? " et " : ", ")}
                  <span className="text-alert-soft">
                    {s.missing} {s.product.name.toLowerCase()}
                  </span>
                </span>
              ))}{" "}
              pour compléter tous les étuis.
            </div>
          ) : (
            <div className="text-[17px] text-muted">Tous les composants sont là pour chaque étui.</div>
          )}
          <label className="flex items-center justify-between gap-3 text-[17px] text-muted">
            Minimum de kits prêts
            <Stepper small label={`Minimum ${kit.name}`} value={kit.min} onChange={(value) => dispatch({ type: "setKitMin", kitId: kit.id, value })} />
          </label>

          <div className="my-1 h-px bg-line" />
          <div className="lbl">Étuis de cuir</div>
          <div className="flex flex-col gap-2.5">
            {kit.leather.map((leather) => (
              <div key={leather.color} className="flex items-center gap-3">
                <span className="h-7 w-7 shrink-0 border border-line" style={{ background: leather.swatch }} />
                <span className="flex-1 text-[18px]">{leather.color}</span>
                <Stepper
                  small
                  label={`Étuis ${leather.color}`}
                  value={leather.stock}
                  onChange={(value) => dispatch({ type: "setLeather", kitId: kit.id, color: leather.color, value })}
                />
              </div>
            ))}
            <div className="flex items-center gap-3 border-t border-line pt-2.5">
              <span className="flex-1 text-[18px] text-gold-light">Total — base du calcul</span>
              <span className="w-[136px] text-center text-[24px] text-cream tabular-nums">{target}</span>
            </div>
          </div>
          <div className="text-[15px] text-faint">
            Les couleurs sont affichées à part, mais le calcul se fait sur le total des étuis.
          </div>
        </div>

        <div className="flex min-w-0 flex-col border border-line bg-panel">
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-4 pb-1">
            <div className="sc text-[16px] tracking-[.16em] text-gold">Composants réservés</div>
            <div className="text-[16px] text-muted2">Bloqués pour les kits : non vendables à l'unité</div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse">
              <thead>
                <tr>
                  <th className="th">Composant</th>
                  <th className="th num">Par kit</th>
                  <th className="th num">Total</th>
                  <th className="th num">Réservé</th>
                  <th className="th num">Libre</th>
                  <th className="th w-[30%]">Couverture des {target} kits</th>
                </tr>
              </thead>
              <tbody>
                {kit.components.map((component) => {
                  const product = productsById[component.productId];
                  const state = productState(product, reserved);
                  const needed = target * component.qty;
                  const coverage = needed ? Math.min(1, state.stock / needed) : 1;
                  const short = coverage < 1;
                  const unit = product.type === "paquet" ? ", paquets" : "";
                  const pk = product.type === "paquet" ? <span className="ml-1.5 text-[14px] text-faint">paquets</span> : null;
                  return (
                    <tr key={component.productId} className={short ? "bg-alert-bg" : undefined}>
                      <td className="td">
                        <Link to={`/produits/${product.id}`} className="text-parch!">
                          {product.name}
                        </Link>
                        <div className="text-[15px] text-faint">
                          {component.choice ? "au choix, défaut" : "fixe"}
                          {unit}
                        </div>
                      </td>
                      <td className="td num">
                        {component.qty}
                        {pk}
                      </td>
                      <td className="td num">
                        {state.stock}
                        {pk}
                      </td>
                      <td className="td num">
                        {state.reserved}
                        {pk}
                      </td>
                      <td className={`td num ${state.free === 0 ? "text-alert-soft" : ""}`}>
                        {state.free}
                        {pk}
                      </td>
                      <td className="td">
                        <div className="h-2.5 bg-track" title={`${Math.round(coverage * 100)} %`}>
                          <div className="h-full" style={{ width: `${coverage * 100}%`, background: short ? "#e8876f" : "#3f6b48" }} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3.5 text-[15px] text-faint">
            Outils au choix : on réserve l'outil par défaut du kit. Si le client le remplace, l'outil choisi est retiré à la vente et
            l'outil par défaut redevient libre.
          </div>
        </div>
      </div>
      <SampleNote />
    </div>
  );
}

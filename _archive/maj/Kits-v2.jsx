// Kits : même logique que les fiches produit.
//   gauche  : étuis puis pièces en stock, une jauge par rangée
//   droite  : panneau Objectifs (kits prêts / étuis, kits prêts / minimum)
// Kits visés = total des étuis (toutes couleurs). Chaque composant doit en
// couvrir autant (l'outil par défaut pour les « au choix »).
import { Link, useNavigate, useParams } from "react-router-dom";

import { useInventory } from "../store.jsx";
import { kitsReady, leatherTotal, productStock } from "../lib/inventory.js";
import {
  DetailLayout,
  GaugeColumn,
  GaugePanel,
  PageHeader,
  RatioValue,
  RowGauge,
  SampleNote,
  Stepper,
} from "../components/ui.jsx";

export default function Kits() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { kits, collections, productsById, dispatch } = useInventory();
  const kit = kits.find((k) => k.id === id) ?? kits[0];
  const collection = collections.find((c) => c.id === kit.collectionId);

  const target = leatherTotal(kit);
  const ready = kitsReady(kit, productsById);
  const idleCases = target - ready;
  const plural = (n, one, many) => (n === 1 ? one : many);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader eyebrow={`${collection?.name ?? ""} · kit complet`} title={kit.name}>
        <div role="tablist" aria-label="Kit" className="flex overflow-x-auto">
          {kits.map((k) => {
            const selected = k.id === kit.id;
            return (
              <button
                key={k.id}
                role="tab"
                aria-selected={selected}
                onClick={() => navigate(`/kits/${k.id}`)}
                className={`sc h-11 shrink-0 cursor-pointer border-0 border-b-2 bg-transparent px-4 text-[14px] tracking-[.12em] ${
                  selected ? "border-gold text-cream" : "border-transparent text-muted2 hover:text-cream"
                }`}
              >
                {k.name.replace(/^Kit (du |de la |de |)/i, "")}
              </button>
            );
          })}
        </div>
      </PageHeader>

      <DetailLayout
        aside={
          <GaugePanel
            footer={
              <label className="flex items-center justify-center gap-3 text-[15px] text-muted2">
                Minimum
                <Stepper
                  small
                  label={`Minimum ${kit.name}`}
                  value={kit.min}
                  onChange={(value) => dispatch({ type: "setKitMin", kitId: kit.id, value })}
                />
              </label>
            }
          >
            <GaugeColumn label="Kits prêts" note="sur le total des étuis" have={ready} need={target} unit="kits" />
            <GaugeColumn label="Minimum" note="kits prêts à garder" have={ready} need={kit.min} unit="kits" />
          </GaugePanel>
        }
      >
        {/* Étuis */}
        <section className="flex flex-col gap-2 border border-line/50 bg-panel/60 px-6 py-5">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <div className="sc text-[16px] tracking-[.16em] text-gold">Étuis de cuir</div>
            <div className="text-[15px] text-faint">Le total des étuis fixe les kits visés</div>
          </div>
          {kit.leather.map((leather) => (
            <div key={leather.color} className="flex flex-wrap items-center gap-4 border-t border-line/35 py-3">
              <div className="flex w-[150px] items-center gap-3">
                <span className="h-7 w-7 shrink-0 border border-line" style={{ background: leather.swatch }} />
                <span className="text-[21px] text-cream">{leather.color}</span>
              </div>
              <Stepper
                small
                label={`Étuis ${leather.color}`}
                value={leather.stock}
                onChange={(value) => dispatch({ type: "setLeather", kitId: kit.id, color: leather.color, value })}
              />
            </div>
          ))}
          <div className="flex w-fit flex-wrap items-baseline gap-x-3 gap-y-1 border border-gold bg-panel2 px-4 py-2.5">
            <span className="text-[30px] leading-none text-cream">{target}</span>
            <span className="text-[17px] text-muted">{plural(target, "étui", "étuis")} · kits visés</span>
          </div>
        </section>

        {/* Composants */}
        <section className="flex flex-col gap-2 border border-line/50 bg-panel/60 px-6 py-5">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <div className="sc text-[16px] tracking-[.16em] text-gold">Pièces en stock</div>
            <div className="text-[15px] text-faint">
              Objectif par pièce : {target} {plural(target, "étui", "étuis")} × qté
            </div>
          </div>

          {kit.components.map((component) => {
            const product = productsById[component.productId];
            const stock = productStock(product);
            const need = target * component.qty;
            const isPack = product.type === "paquet";
            return (
              <div key={component.productId} className="flex flex-wrap items-center gap-4 border-t border-line/35 py-3">
                <div className="w-[150px]">
                  <Link to={`/produits/${product.id}`} className="text-[21px] text-cream!">
                    {product.name}
                  </Link>
                  <div className="text-[13px] text-faint">
                    {component.choice ? "au choix · défaut" : "fixe"}
                    {isPack ? " · paquets" : ""}
                  </div>
                  {!isPack && (
                    <div className="mt-2">
                      <Stepper
                        small
                        label={`Stock ${product.name}`}
                        value={product.stock}
                        onChange={(value) => dispatch({ type: "setStock", productId: product.id, value })}
                      />
                    </div>
                  )}
                </div>
                <div className="order-last w-full min-w-0 sm:order-none sm:w-auto sm:flex-1">
                  <RowGauge have={stock} need={need} />
                </div>
                <div className="ml-auto w-[110px]">
                  <RatioValue
                    have={stock}
                    need={need}
                    note={stock > need ? `+${stock - need} libres` : isPack ? "paquets" : null}
                  />
                </div>
              </div>
            );
          })}

          <div className="mb-1.5 text-[15px] text-faint">
            Outils au choix : on réserve l'outil par défaut. Si le client le remplace, l'outil choisi est retiré à la vente et le
            défaut redevient libre.
          </div>
          <div className="flex w-fit flex-wrap items-baseline gap-x-3 gap-y-1 border border-gold bg-panel2 px-4 py-2.5">
            <span className="text-[30px] leading-none text-cream">{ready}</span>
            <span className="text-[17px] text-muted">{plural(ready, "kit prêt", "kits prêts")}</span>
            {idleCases > 0 && (
              <span className="flex items-baseline gap-2 border-l border-line pl-3">
                <span className="text-[22px] leading-none text-muted2">+ {idleCases}</span>
                <span className="text-[16px] text-faint">{plural(idleCases, "étui orphelin", "étuis orphelins")}</span>
              </span>
            )}
          </div>
        </section>
      </DetailLayout>
      <SampleNote />
    </div>
  );
}

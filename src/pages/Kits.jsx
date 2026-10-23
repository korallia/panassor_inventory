// Kits : même logique que les fiches produit.
//   gauche  : étuis puis pièces en stock, une jauge par rangée
//   droite  : panneau Objectifs (kits prêts / étuis, kits prêts / minimum)
// Kits visés = total des étuis (toutes couleurs). Chaque composant doit en
// couvrir autant (l'outil par défaut pour les « au choix »).
import { Link, useNavigate, useParams } from "react-router-dom";

import { useInventory } from "../store.jsx";
import { kitsReady, leatherTotal, productStock } from "../lib/inventory.js";
import {
  GaugeColumn,
  GaugePanel,
  PageHeader,
  RatioValue,
  RowGauge,
  SampleNote,
  Stepper,
} from "../components/ui.jsx";
import { StockControl } from "../components/Ajuster.jsx";

export default function Kits() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { kits, collections, productsById, dispatch } = useInventory();
  const kit = kits.find((k) => k.id === id) ?? kits[0];
  const collection = collections.find((c) => c.id === kit.collectionId);

  const target = leatherTotal(kit);
  const ready = kitsReady(kit, productsById);
  const idleCases = target - ready;
  // Les kits passent en premier : tout le stock sert aux kits, le minimum libre vient après.
  const forKits = (product) => productStock(product);
  // Kits faisables avec les pièces seulement (sans compter les étuis).
  const fromTools = Math.min(
    ...kit.components.map((c) => Math.floor(forKits(productsById[c.productId]) / c.qty))
  );
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
                className={`sc h-12 shrink-0 cursor-pointer border-0 border-b-2 bg-transparent px-5 text-[17px] tracking-[.12em] ${
                  selected ? "border-gold text-cream" : "border-transparent text-muted2 hover:text-cream"
                }`}
              >
                {k.name.replace(/^Kit (du |de la |de |)/i, "")}
              </button>
            );
          })}
        </div>
      </PageHeader>

      <div className="grid w-full items-stretch justify-center gap-8 lg:grid-cols-[minmax(0,620px)_minmax(0,480px)] lg:gap-12">
        <div className="order-2 min-w-0 lg:order-1">
        {/* Composants */}
        <section className="flex h-full flex-col gap-2 border border-line/50 bg-panel/60 px-6 py-5">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <div className="sc text-[16px] tracking-[.16em] text-gold">Pièces en stock</div>
            <div className="text-[15px] text-gold-light">Minimum libre ignoré · priorité aux kits</div>
          </div>

          {kit.components.map((component) => {
            const product = productsById[component.productId];
            const stock = forKits(product);
            const need = target * component.qty;
            return (
              <div key={component.productId} className="flex flex-wrap items-center gap-4 border-t border-line/35 py-4">
                <div className="w-[150px]">
                  <Link to={`/produits/${product.id}`} className="text-[21px] text-cream!">
                    {product.name}
                  </Link>
                </div>
                <div className="order-last w-full min-w-0 sm:order-none sm:w-auto sm:flex-1">
                  <RowGauge have={stock} need={need} />
                </div>
                <div className="ml-auto w-[110px]">
                  <RatioValue have={stock} need={need} />
                </div>
              </div>
            );
          })}

          <div className="flex w-fit flex-wrap items-baseline gap-x-3 gap-y-1 border border-gold bg-panel2 px-4 py-2.5">
            <span className="text-[30px] leading-none text-cream">{fromTools}</span>
            <span className="text-[17px] text-muted">{plural(fromTools, "kit faisable", "kits faisables")} avec ces pièces</span>
          </div>

          <div className="mt-6 flex items-baseline justify-between gap-3 border-t border-gold/60 pt-5">
            <div className="sc text-[16px] tracking-[.16em] text-gold">Étuis de cuir</div>
            <div className="text-[15px] text-faint">fixent les kits visés</div>
          </div>
          {kit.leather.map((leather) => (
            <div key={leather.color} className="flex items-center justify-between gap-4 border-t border-line/35 py-3">
              <span className="flex items-center gap-3">
                <span className="h-7 w-7 shrink-0 border border-line" style={{ background: leather.swatch }} />
                <span className="text-[19px] text-cream">{leather.color}</span>
              </span>
              <StockControl stockId={leather.stockId} value={leather.stock}>
                <Stepper
                  small
                  label={`Étuis ${leather.color}`}
                  value={leather.stock}
                  onChange={(value) => dispatch({ type: "setLeather", kitId: kit.id, color: leather.color, value })}
                />
              </StockControl>
            </div>
          ))}
          <div className="flex w-fit flex-wrap items-baseline gap-x-3 gap-y-1 border border-gold bg-panel2 px-4 py-2.5">
            <span className="text-[30px] leading-none text-cream">{target}</span>
            <span className="text-[17px] text-muted">{plural(target, "étui", "étuis")} · kits visés</span>
          </div>
        </section>
        </div>
        <div className="order-1 flex flex-col gap-8 lg:order-2 lg:*:static lg:*:flex-1">
          <GaugePanel>
            <GaugeColumn label="Kits prêts" note={`sur ${target} étuis · minimum ${kit.min}`} have={ready} need={target} unit="kits" />
          </GaugePanel>
        </div>
      </div>
      <SampleNote />
    </div>
  );
}

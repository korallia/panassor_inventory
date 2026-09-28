// Fiche produit : visuel d'abord (1 case = 1 unité), les chiffres ensuite.
//   1C     outil / pièce
//   1D(1)  paquet (aiguilles de suture)
//   1D(2)  ensemble (ex. Crochet + tourne-serrure)
import { Link, useParams } from "react-router-dom";

import { useInventory } from "../store.jsx";
import {
  ensembleState,
  leatherTotal,
  packMissingByType,
  packOrphans,
  productState,
} from "../lib/inventory.js";
import {
  Legend,
  PageHeader,
  SampleNote,
  DetailLayout,
  GaugeColumn,
  GaugePanel,
  LayerBar,
  RatioValue,
  RowGauge,
  Stepper,
  typeLabel,
} from "../components/ui.jsx";

export default function ProduitDetail() {
  const { id } = useParams();
  const { productsById, collections } = useInventory();
  const product = productsById[id];

  if (!product) {
    return (
      <div className="flex flex-col gap-4">
        <Link to="/inventaire">← Inventaire</Link>
        <p className="text-[19px]">Produit introuvable.</p>
      </div>
    );
  }

  const collection = collections.find((c) => c.id === product.collectionId);
  const props = { product, collectionName: collection?.name ?? "" };

  if (product.type === "ensemble") return <EnsembleDetail {...props} />;
  if (product.type === "paquet") return <PackDetail {...props} />;
  return <PieceDetail {...props} />;
}

/** Kits qui utilisent ce produit, pour dire « réservés pour 8 kits du chirurgien ». */
function useKitsUsing(productId) {
  const { kits } = useInventory();
  return kits.filter((kit) => kit.components.some((c) => c.productId === productId));
}

/** Combien il faudrait réserver : étuis × qté par kit, pour chaque kit qui l'utilise. */
function reservedTarget(productId, kitsUsing) {
  return kitsUsing.reduce(
    (sum, kit) => sum + leatherTotal(kit) * kit.components.filter((c) => c.productId === productId).reduce((q, c) => q + c.qty, 0),
    0
  );
}

/** Total visé = réservés pour les kits + minimum libre. */
function totalTarget(toReserve, min) {
  return { need: toReserve + min, note: `${toReserve} réservés + ${min} libres` };
}

/** « pour 8 kits du chirurgien » */
function kitsNote(kitsUsing) {
  const names = kitsUsing.map((kit) => `${leatherTotal(kit)} ${kit.name.toLowerCase().replace(/^kit /, "kits ")}`);
  return `pour ${names.join(" + ")}`;
}

// ---------------------------------------------------------------- 1C
function PieceDetail({ product, collectionName }) {
  const { reserved, dispatch } = useInventory();
  const state = productState(product, reserved);
  const kitsUsing = useKitsUsing(product.id);
  const toReserve = reservedTarget(product.id, kitsUsing);
  const total = totalTarget(toReserve, state.min);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        back={{ to: "/inventaire", label: "Inventaire" }}
        eyebrow={`${collectionName} · ${typeLabel(product, kitsUsing.length > 0).toLowerCase()}`}
        title={product.name}
      />

      <DetailLayout
        aside={
          <GaugePanel>
            {toReserve > 0 && <GaugeColumn label="Réservés" note={kitsNote(kitsUsing)} have={state.reserved} need={toReserve} />}
            <GaugeColumn label="Libres" note="minimum pour la vente" have={state.free} need={state.min} />
            <GaugeColumn label="Total" note={total.note} have={state.stock} need={total.need} />
          </GaugePanel>
        }
      >
        <section className="flex flex-col gap-2 border border-line/50 bg-panel/60 px-6 py-5">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <div className="sc text-[16px] tracking-[.16em] text-gold">Pièces en stock</div>
            <div className="text-[15px] text-faint">Objectif : {total.note} = {total.need}</div>
          </div>

          <div className="flex flex-wrap items-center gap-4 border-t border-line/35 py-3">
            <div className="w-[130px]">
              <div className="text-[21px] text-cream">{product.name}</div>
              <div className="mt-2">
                <Stepper
                  small
                  label={`Stock ${product.name}`}
                  value={product.stock}
                  onChange={(value) => dispatch({ type: "setStock", productId: product.id, value })}
                />
              </div>
            </div>
            <div className="order-last w-full min-w-0 sm:order-none sm:w-auto sm:flex-1">
              <RowGauge have={state.stock} need={total.need} />
            </div>
            <div className="ml-auto w-[100px]">
              <RatioValue have={state.stock} need={total.need} />
            </div>
          </div>

          <div className="mb-1.5 text-[15px] text-faint">
            {state.reserved} réservés pour les kits + {state.free} libres pour la vente.
          </div>
          <div className="flex w-fit flex-wrap items-baseline gap-x-3 gap-y-1 border border-gold bg-panel2 px-4 py-2.5">
            <span className="text-[30px] leading-none text-cream">{state.stock}</span>
            <span className="text-[17px] text-muted">en stock</span>
          </div>
        </section>
      </DetailLayout>
    </div>
  );
}

// ---------------------------------------------------------------- 1D(1)
function PackDetail({ product, collectionName }) {
  const { reserved, dispatch } = useInventory();
  const state = productState(product, reserved);
  const kitsUsing = useKitsUsing(product.id);
  const orphans = packOrphans(product);
  const missingByType = packMissingByType(product, reserved);
  const toReserve = reservedTarget(product.id, kitsUsing);
  const total = totalTarget(toReserve, state.min);
  const missing = Math.max(0, toReserve - state.reserved) + state.missingForMin;
  const low = state.status === "low" || missing > 0;
  const plural = (n) => (n === 1 ? "paquet" : "paquets");
  const rowScale = Math.max(...product.packTypes.map((type, i) => type.stock + missingByType[i].missing));
  const composition = product.packTypes.map((type) => `1 ${type.name.toLowerCase().replace(/s$/, "")}`).join(" + ");

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        back={{ to: "/inventaire", label: "Inventaire" }}
        eyebrow={`${collectionName} · paquet de ${product.packTypes.length}`}
        title={product.name} />

      <DetailLayout
        aside={
          <GaugePanel footer={<div className="text-center text-[14px] text-faint">En paquets de {product.packTypes.length}.</div>}>
            {toReserve > 0 && (
              <GaugeColumn label="Réservés" note={kitsNote(kitsUsing)} have={state.reserved} need={toReserve} unit="paquets" />
            )}
            <GaugeColumn label="Libres" note="minimum pour la vente" have={state.free} need={state.min} unit="paquets" />
            <GaugeColumn label="Total" note={total.note} have={state.stock} need={total.need} unit="paquets" />
          </GaugePanel>
        }
      >
      <section className="flex flex-col gap-2 border border-line/50 bg-panel/60 px-6 py-5">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div className="sc text-[16px] tracking-[.16em] text-gold">Pièces en stock</div>
          <div className="text-[15px] text-faint">
            Objectif par type : {total.note} = {total.need}
          </div>
        </div>

        {product.packTypes.map((type, index) => {
          const orphanCount = orphans[index].orphans;
          const need = total.need;
          return (
            <div key={type.id} className="flex flex-wrap items-center gap-4 border-t border-line/35 py-3">
              <div className="w-[130px]">
                <div className="text-[21px] text-cream">{type.name}</div>
                <div className="mt-2">
                  <Stepper
                    small
                    label={`Stock ${type.name}`}
                    value={type.stock}
                    onChange={(value) => dispatch({ type: "setPackStock", productId: product.id, typeId: type.id, value })}
                  />
                </div>
              </div>
              <div className="order-last w-full min-w-0 sm:order-none sm:w-auto sm:flex-1">
                <RowGauge have={type.stock} need={need} />
              </div>
              <div className="ml-auto w-[100px]">
                <RatioValue have={type.stock} need={need} note={orphanCount > 0 ? `dont ${orphanCount} orphelines` : null} />
              </div>
            </div>
          );
        })}

        <div className="mb-1.5 text-[15px] text-faint">
          Un paquet = {composition}.
          {orphans.some((o) => o.orphans > 0) && (
            <>
              {" "}
              Les pièces orphelines ne comptent pas dans le stock tant qu'il leur manque leur paire.
            </>
          )}
        </div>
        <div className="flex w-fit flex-wrap items-baseline gap-x-3 gap-y-1 border border-gold bg-panel2 px-4 py-2.5">
          <span className="text-[30px] leading-none text-cream">{state.stock}</span>
          <span className="text-[17px] text-muted">{plural(state.stock)}</span>
          {orphans
            .filter((o) => o.orphans > 0)
            .map((o) => (
              <span key={o.id} className="flex items-baseline gap-2 border-l border-line pl-3">
                <span className="text-[22px] leading-none text-muted2">+ {o.orphans}</span>
                <span className="text-[16px] text-faint">
                  {o.orphans === 1 ? "orpheline" : "orphelines"} ({o.name.toLowerCase().replace(/s$/, "")})
                </span>
              </span>
            ))}
        </div>
      </section>
      </DetailLayout>
      <SampleNote />
    </div>
  );
}

// ---------------------------------------------------------------- 1D(2)
function EnsembleDetail({ product, collectionName }) {
  const { productsById, reserved, dispatch } = useInventory();
  const state = ensembleState(product, productsById, reserved);
  const low = state.possible < state.objective;
  const short = state.objective - state.possible;
  const missingParts = state.parts.filter((part) => part.missing > 0);
  const partScale = Math.max(...state.parts.map((part) => part.stock + part.missing));

  return (
    <div className="flex flex-col gap-8">
      <PageHeader back={{ to: "/inventaire", label: "Inventaire" }} eyebrow={`${collectionName} · ensemble`} title={product.name} />

      <DetailLayout
        aside={
          <GaugePanel
            footer={
              <div className="text-center text-[16px]">
                {missingParts.length === 0 ? (
                  <span className="text-faint">Rien ne manque</span>
                ) : (
                  missingParts.map((part) => (
                    <div key={part.product.id} className="text-alert-soft">
                      Manque : {part.missing} {part.product.name.toLowerCase()}
                    </div>
                  ))
                )}
              </div>
            }
          >
            <GaugeColumn label="Ensembles" note="avec le stock libre · rien n'est réservé" have={state.possible} need={state.objective} />
          </GaugePanel>
        }
      >
      <section className="flex flex-col gap-2 border border-line/50 bg-panel/60 px-6 py-5">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div className="sc text-[16px] tracking-[.16em] text-gold">Pièces de l'ensemble</div>
          <div className="text-[15px] text-faint">Objectif : {state.objective} ensembles, sur le stock libre</div>
        </div>

        {state.parts.map((part) => {
          const need = state.objective * part.qty;
          return (
            <div key={part.product.id} className="flex flex-wrap items-center gap-4 border-t border-line/35 py-3">
              <div className="w-[150px]">
                <Link to={`/produits/${part.product.id}`} className="text-[21px] text-cream!">
                  {part.product.name}
                </Link>
                <div className="mt-1 text-[14px] text-faint">
                  {part.stock} en stock{part.reserved > 0 ? ` · ${part.reserved} réservés kits, non comptés` : ""}
                </div>
              </div>
              <div className="order-last w-full min-w-0 sm:order-none sm:w-auto sm:flex-1">
                <RowGauge have={part.free} need={need} />
              </div>
              <div className="ml-auto w-[100px]">
                <RatioValue
                  have={part.free}
                  need={need}
                  note={part.soloOnly > 0 ? `+${part.soloOnly} vendables seuls` : part.qty > 1 ? `${part.qty} par ensemble` : null}
                />
              </div>
            </div>
          );
        })}
        <div className="text-[15px] text-faint">
          Libres = stock − réservés pour les kits. Seules les pièces libres servent aux ensembles.
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-x-8 gap-y-4 border border-line/40 px-6 py-5">
        <div className="lbl">Tester</div>
        <label className="flex items-center gap-3 text-[17px] text-muted">
          Objectif
          <Stepper
            label={`Objectif ${product.name}`}
            value={product.objective ?? 0}
            onChange={(value) => dispatch({ type: "setObjective", productId: product.id, value })}
          />
        </label>
        {state.parts.map((part) => (
          <label key={part.product.id} className="flex items-center gap-3 text-[17px] text-muted">
            {part.product.name}
            <Stepper
              label={`Stock ${part.product.name}`}
              value={part.product.stock}
              onChange={(value) => dispatch({ type: "setStock", productId: part.product.id, value })}
            />
          </label>
        ))}
      </div>
      </DetailLayout>
      <SampleNote />
    </div>
  );
}


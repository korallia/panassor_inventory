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
  const { source, reserved, dispatch, openAdjust } = useInventory();
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
            {/* Petites capitales comme « pour les kits », chiffres en Garamond, un ton plus clair, pour bien les lire. */}
            <div className="sc text-[12px] leading-tight tracking-[.12em] text-faint">
              Objectif : <span className="mx-1 font-serif text-[14px] tracking-normal text-muted2 normal-case">{toReserve}</span> réservés +{" "}
              <span className="mx-1 font-serif text-[14px] tracking-normal text-muted2 normal-case">{state.min}</span> libres ={" "}
              <span className="mx-1 font-serif text-[14px] tracking-normal text-muted2 normal-case">{total.need}</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 border-t border-line/35 py-3">
            <div className="w-[130px]">
              <div className="text-[21px] text-cream">{product.name}</div>
              {/* Données d'exemple seulement : − / + pour tester. Avec les vraies données,
                  le stock se change par la fenêtre Ajuster (point d'entrée à placer). */}
              {source !== "live" && (
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
              <RowGauge have={state.stock} need={total.need} />
            </div>
            <div className="ml-auto w-[100px]">
              <RatioValue have={state.stock} need={total.need} />
            </div>
          </div>

          {/* Trois boîtes : réservés pour les kits, libres pour la vente, total.
              Les trois ouvrent la même fenêtre Ajuster (vraies données seulement) :
              on ajoute ou retire du stock, et l'atelier calcule lui-même ce qui va
              aux kits (réservés) et ce qui reste en vente (libres). */}
          <div className="mt-1 grid grid-cols-3 gap-2.5">
            {[
              { label: "Réservés", note: "pour les kits", value: state.reserved },
              { label: "Libres", note: "pour la vente", value: state.free },
              { label: "Total", note: "en stock", value: state.stock },
            ].map((box) => {
              const onClick = source === "live" && product.stockId ? () => openAdjust(product.stockId) : null;
              const Box = onClick ? "button" : "div";
              return (
                <Box
                  key={box.label}
                  type={onClick ? "button" : undefined}
                  onClick={onClick || undefined}
                  title={onClick ? "Ajuster le stock" : undefined}
                  className={`flex flex-col items-center border border-gold/45 bg-panel2 px-2 pt-4 pb-4 text-center ${
                    onClick ? "cursor-pointer transition-colors hover:border-gold hover:bg-gold/8" : ""
                  }`}
                >
                  <span className="text-[28px] leading-none text-cream tabular-nums">{box.value}</span>
                  {/* Titre et précision dans la même police (petites capitales), seule la couleur change. */}
                  <span className="sc mt-3 text-[14px] leading-tight tracking-[.18em] text-gold">{box.label}</span>
                  <span className="sc mt-2 text-[12px] leading-tight tracking-[.12em] text-faint">{box.note}</span>
                </Box>
              );
            })}
          </div>
        </section>
      </DetailLayout>
    </div>
  );
}

// ---------------------------------------------------------------- 1D(1)
function PackDetail({ product, collectionName }) {
  const { readOnly, reserved, dispatch } = useInventory();
  const state = productState(product, reserved);
  const kitsUsing = useKitsUsing(product.id);
  const orphans = packOrphans(product);
  const missingByType = packMissingByType(product, reserved);
  const toReserve = reservedTarget(product.id, kitsUsing);
  const total = totalTarget(toReserve, state.min);
  const missing = Math.max(0, toReserve - state.reserved) + state.missingForMin;
  const low = state.status !== "ok" || missing > 0;
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
                    disabled={readOnly}
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
  const { productsById, reserved } = useInventory();
  const state = ensembleState(product, productsById, reserved);
  const plural = (n) => (n === 1 ? "ensemble" : "ensembles");
  const missing = state.parts.filter((part) => part.missing > 0);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader back={{ to: "/inventaire", label: "Inventaire" }} eyebrow={`${collectionName} · ensemble`} title={product.name} />

      <DetailLayout
        aside={
          <GaugePanel
            footer={
              <div className="text-center text-[18px] text-gold-light">
                {missing.length
                  ? `Manque : ${missing.map((part) => `${part.missing} ${part.product.name.toLowerCase()}`).join(" · ")}`
                  : state.objective > 0
                    ? "Objectif atteint"
                    : "Aucun objectif fixé (page Minimums)"}
              </div>
            }
          >
            <GaugeColumn
              label="Ensembles"
              note="avec le stock libre · rien n'est réservé"
              have={state.possible}
              need={state.objective}
              unit={plural(state.objective)}
            />
          </GaugePanel>
        }
      >
        <section className="flex flex-col gap-2 border border-line/50 bg-panel/60 px-6 py-5">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <div className="sc text-[16px] tracking-[.16em] text-gold">Pièces de l'ensemble</div>
            <div className="text-[15px] text-faint">
              Objectif : {state.objective} {plural(state.objective)}, sur le stock libre
            </div>
          </div>

          {state.parts.map((part) => {
            const need = state.objective * part.qty;
            const extra = part.free - need;
            return (
              <div key={part.product.id} className="flex flex-wrap items-center gap-4 border-t border-line/35 py-4">
                <div className="w-[160px]">
                  <Link to={`/produits/${part.product.id}`} className="text-[21px] text-cream!">
                    {part.product.name}
                  </Link>
                  <div className="mt-1 text-[14px] leading-snug text-faint">
                    {part.stock} en stock
                    {part.reserved > 0 && ` · ${part.reserved} réservés kits, non comptés`}
                  </div>
                </div>
                <div className="order-last w-full min-w-0 sm:order-none sm:w-auto sm:flex-1">
                  <RowGauge have={Math.max(0, part.free)} need={need} />
                </div>
                <div className="ml-auto w-[120px]">
                  <RatioValue have={part.free} need={need} note={need > 0 && extra > 0 ? `+${extra} vendables seuls` : null} />
                </div>
              </div>
            );
          })}

          <div className="border-t border-line/35 pt-3 text-[15px] text-faint">
            Libres = stock − réservés pour les kits. Seules les pièces libres servent aux ensembles.
          </div>
        </section>
      </DetailLayout>
      <SampleNote />
    </div>
  );
}


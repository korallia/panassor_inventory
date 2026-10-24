// Fiche produit : visuel d'abord (1 case = 1 unité), les chiffres ensuite.
//   1C     outil / pièce
//   1D(1)  paquet (aiguilles de suture)
//   1D(2)  ensemble (ex. Crochet + tourne-serrure)
import { Link, useNavigate, useParams } from "react-router-dom";

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

/** Sous-titre gris (classe .sub de index.css) et chiffre dans un sous-titre (.sub-num). */
const smallText = "sub";
function Num({ children }) {
  return <span className="sub-num">{children}</span>;
}

/**
 * Rangée de boîtes chiffrées (chiffre, titre, précision). Une boîte avec un
 * stockId ouvre la fenêtre Ajuster de cette ligne de stock (vraies données).
 */
function StockBoxes({ boxes }) {
  const { source, openAdjust } = useInventory();
  return (
    <>
    {/* Séparateur doré, en dégradé (fondu aux deux bouts). */}
    <div className="h-px" style={{ background: "linear-gradient(90deg, transparent, var(--color-gold), transparent)" }} />
    <div className="mt-6 grid gap-2.5" style={{ gridTemplateColumns: `repeat(${boxes.length}, minmax(0, 1fr))` }}>
      {boxes.map((box) => {
        const onClick = source === "live" && box.stockId ? () => openAdjust(box.stockId) : null;
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
            <span className="sub mt-2">{box.note}</span>
          </Box>
        );
      })}
    </div>
    </>
  );
}

// ---------------------------------------------------------------- 1C
function PieceDetail({ product, collectionName }) {
  const { source, reserved, dispatch } = useInventory();
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
          <GaugePanel legend={false}>
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
            <div className={smallText}>
              Objectif : <Num>{toReserve}</Num> réservés + <Num>{state.min}</Num> libres = <Num>{total.need}</Num>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-x-11 gap-y-4 border-t sm:flex-nowrap border-line/35 pt-7 pb-5">
            <div>
              <div className="text-[25px] leading-tight text-cream">{product.name}</div>
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
            <div className="order-last w-full min-w-0 sm:order-none sm:w-[300px] sm:shrink">
              <RowGauge have={state.stock} need={total.need} />
            </div>
            <div>
              <RatioValue have={state.stock} need={total.need} />
            </div>
          </div>

          {/* Les trois ouvrent la même fenêtre Ajuster : on ajoute ou retire du stock,
              et l'atelier calcule lui-même ce qui va aux kits et ce qui reste en vente. */}
          <StockBoxes
            boxes={[
              { label: "Réservés", note: "pour les kits", value: state.reserved, stockId: product.stockId },
              { label: "Libres", note: "pour la vente", value: state.free, stockId: product.stockId },
              { label: "Total", note: "en stock", value: state.stock, stockId: product.stockId },
            ]}
          />
        </section>
      </DetailLayout>
    </div>
  );
}

// ---------------------------------------------------------------- 1D(1)
function PackDetail({ product, collectionName }) {
  const { source, reserved, dispatch } = useInventory();
  const state = productState(product, reserved);
  const kitsUsing = useKitsUsing(product.id);
  const orphans = packOrphans(product);
  const missingByType = packMissingByType(product, reserved);
  const toReserve = reservedTarget(product.id, kitsUsing);
  const total = totalTarget(toReserve, state.min);
  const missing = Math.max(0, toReserve - state.reserved) + state.missingForMin;
  const low = state.status !== "ok" || missing > 0;
  const plural = (n) => (n === 1 ? "Paquet" : "Paquets");
  const rowScale = Math.max(...product.packTypes.map((type, i) => type.stock + missingByType[i].missing));

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        back={{ to: "/inventaire", label: "Inventaire" }}
        eyebrow={`${collectionName} · paquet de ${product.packTypes.length}`}
        title={product.name} />

      <DetailLayout
        aside={
          <GaugePanel legend={false} footer={<div className="sub text-center">En paquets de <Num>{product.packTypes.length}</Num></div>}>
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
          <div className="sub">
            Objectif par type : <Num>{toReserve}</Num> réservés + <Num>{state.min}</Num> libres = <Num>{total.need}</Num>
          </div>
        </div>

        {product.packTypes.map((type, index) => {
          const need = total.need;
          return (
            <div key={type.id} className="flex flex-wrap items-center gap-4 border-t border-line/35 py-3">
              <div className="w-[130px]">
                <div className="text-[21px] text-cream">{type.name}</div>
                {/* Données d'exemple seulement : − / + pour tester. Avec les vraies données,
                    on ajuste par les boîtes en bas. */}
                {source !== "live" && (
                  <div className="mt-2">
                    <Stepper
                      small
                      label={`Stock ${type.name}`}
                      value={type.stock}
                      onChange={(value) => dispatch({ type: "setPackStock", productId: product.id, typeId: type.id, value })}
                    />
                  </div>
                )}
              </div>
              <div className="order-last w-full min-w-0 sm:order-none sm:w-auto sm:flex-1">
                <RowGauge have={type.stock} need={need} />
              </div>
              <div className="ml-auto w-[100px]">
                <RatioValue have={type.stock} need={need} />
              </div>
            </div>
          );
        })}

        {/* Trois boîtes : paquets complets, puis chaque sorte (qui ouvre sa fenêtre Ajuster). */}
        <StockBoxes
          boxes={[
            { label: plural(state.stock), note: "complets", value: state.stock },
            ...product.packTypes.map((type, index) => ({
              label: type.name,
              note: orphans[index].orphans > 0 ? `dont ${orphans[index].orphans} ${orphans[index].orphans === 1 ? "seule" : "seules"}` : "en stock",
              value: type.stock,
              stockId: type.stockId,
            })),
          ]}
        />
      </section>
      </DetailLayout>
      <SampleNote />
    </div>
  );
}

// ---------------------------------------------------------------- 1D(2)
function EnsembleDetail({ product, collectionName }) {
  const { productsById, reserved } = useInventory();
  const navigate = useNavigate();
  const state = ensembleState(product, productsById, reserved);
  const plural = (n) => (n === 1 ? "ensemble" : "ensembles");
  const missing = state.parts.filter((part) => part.missing > 0);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader back={{ to: "/inventaire", label: "Inventaire" }} eyebrow={`${collectionName} · ensemble`} title={product.name} />

      <DetailLayout
        aside={
          <GaugePanel legend={false}
            footer={
              <div className={`text-center ${smallText}`}>
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
              note="faisables avec les pièces libres"
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
            <div className={smallText}>
              Objectif : <Num>{state.objective}</Num> {plural(state.objective)}
            </div>
          </div>

          {state.parts.map((part) => {
            const need = state.objective * part.qty;
            const extra = part.free - need;
            return (
              <div
                key={part.product.id}
                role="link"
                tabIndex={0}
                title={`Ouvrir ${part.product.name}`}
                onClick={() => navigate(`/produits/${part.product.id}`)}
                onKeyDown={(event) => event.key === "Enter" && navigate(`/produits/${part.product.id}`)}
                className="-mx-3 flex cursor-pointer flex-wrap items-center gap-4 border-t border-line/35 px-3 py-4 hover:bg-gold/8"
              >
                <div className="w-[160px]">
                  <div className="text-[21px] text-cream">{part.product.name}</div>
                  <div className={`mt-1.5 ${smallText}`}>
                    <Num>{part.stock}</Num> en stock
                    {part.reserved > 0 && (
                      <>
                        {" "}
                        · <Num>{part.reserved}</Num> aux kits
                      </>
                    )}
                  </div>
                </div>
                <div className="order-last w-full min-w-0 sm:order-none sm:w-auto sm:flex-1">
                  <RowGauge have={Math.max(0, part.free)} need={need} />
                </div>
                <div className="ml-auto w-[120px]">
                  <RatioValue
                    have={part.free}
                    need={need}
                    note={
                      need > 0 && extra > 0 ? (
                        <span className={smallText}>
                          <Num>+{extra}</Num> en surplus
                        </span>
                      ) : null
                    }
                  />
                </div>
              </div>
            );
          })}

        </section>
      </DetailLayout>
      <SampleNote />
    </div>
  );
}


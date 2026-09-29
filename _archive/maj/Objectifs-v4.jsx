// Objectifs
//   /objectifs           → liste des entrées + « Nouvel objectif »
//   /objectifs/nouveau   → création : combien on veut rajouter de chaque outil + réglages
//   /objectifs/:id       → suivi de prod de l'entrée
import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { useInventory } from "../store.jsx";
import { leatherTotal, productStock } from "../lib/inventory.js";
import { GaugeColumn, GaugePanel, PageHeader, RatioValue, RowGauge, SampleNote, Stepper } from "../components/ui.jsx";

function formatDate(value) {
  if (!value) return "[date]";
  return new Date(`${value}T12:00:00`).toLocaleDateString("fr-CA", { day: "numeric", month: "long", year: "numeric" });
}

/** Quantités demandées par pièce : à l'unité + kits complets. */
function kitCounts(objective) {
  if (objective.kits) return objective.kits;
  return objective.kitId ? { [objective.kitId]: objective.kitCount || 0 } : {};
}

function kitLabel(kit, count) {
  return `${count} ${kit.name.toLowerCase().replace(/^kit /, count > 1 ? "kits " : "kit ")}`;
}

/**
 * Suivi d'un objectif = du NOUVEAU stock (ce qui s'est ajouté depuis la création).
 * Mêmes règles que la page Kits :
 *   - les kits passent en premier : le nouveau stock remplit d'abord les kits ;
 *   - un kit est complet quand TOUS ses composants sont là (les étuis sont suivis à part) ;
 *   - ce qui reste va aux pièces demandées à l'unité.
 */
function useObjectiveProgress(objective) {
  const { kits, products, productsById } = useInventory();
  return useMemo(() => {
    const empty = { kitGroups: [], units: [], totals: { kitsDone: 0, kitsNeed: 0, unitHave: 0, unitNeed: 0, etuisHave: 0, etuisNeed: 0 } };
    if (!objective) return empty;
    const baseline = objective.baseline ?? {};
    const made = (key, current) => Math.max(0, current - (baseline[key] ?? current));
    const counts = kitCounts(objective);
    const chosen = kits.filter((k) => (counts[k.id] || 0) > 0);
    const perPiece = objective.perPiece ?? {};

    // Nouveau stock disponible par pièce.
    const pool = {};
    for (const p of products) if (p.type !== "ensemble") pool[p.id] = made(p.id, productStock(p));

    // 1. Les kits d'abord.
    const kitGroups = chosen.map((kit) => {
      const count = counts[kit.id];
      const rows = kit.components.map((c) => {
        const product = productsById[c.productId];
        const need = count * c.qty;
        const have = Math.min(pool[c.productId] || 0, need);
        pool[c.productId] = (pool[c.productId] || 0) - have;
        return { id: c.productId, name: product.name, have, need, qty: c.qty, pack: product.type === "paquet" };
      });
      const done = Math.min(count, ...rows.map((r) => Math.floor(r.have / r.qty)));
      const etuis = { have: Math.min(made(`etuis-${kit.id}`, leatherTotal(kit)), count), need: count };
      return { kit, count, done, rows, etuis };
    });

    // 2. Les pièces à l'unité avec ce qui reste.
    const inKits = new Set(chosen.flatMap((k) => k.components.map((c) => c.productId)));
    const units = products
      .filter((p) => p.type !== "ensemble")
      .map((p) => {
        const need = perPiece[p.id] ?? (inKits.has(p.id) ? objective.basePerTool ?? 0 : 0);
        return { id: p.id, name: p.name, need, have: Math.min(pool[p.id] || 0, need), pack: p.type === "paquet" };
      })
      .filter((r) => r.need > 0);

    const sum = (list, key) => list.reduce((total, item) => total + item[key], 0);
    return {
      kitGroups,
      units,
      totals: {
        kitsDone: sum(kitGroups, "done"),
        kitsNeed: sum(kitGroups, "count"),
        unitHave: sum(units, "have"),
        unitNeed: sum(units, "need"),
        etuisHave: kitGroups.reduce((t, g) => t + g.etuis.have, 0),
        etuisNeed: kitGroups.reduce((t, g) => t + g.etuis.need, 0),
      },
    };
  }, [objective, kits, products, productsById]);
}

export default function Objectifs() {
  const { id } = useParams();
  const { objectives } = useInventory();
  if (id === "nouveau") return <NewObjective />;
  const objective = objectives.find((o) => o.id === id);
  if (objective) return <Tracking objective={objective} />;
  return <ObjectiveList />;
}

// ---------------------------------------------------------------- liste
function ObjectiveList() {
  const { objectives } = useInventory();
  const navigate = useNavigate();
  return (
    <div className="flex flex-col gap-8">
      <PageHeader eyebrow="Production" title="Objectifs">
        <button type="button" className="btn-primary" onClick={() => navigate("/objectifs/nouveau")}>
          + Nouvel objectif
        </button>
      </PageHeader>
      <section className="mx-auto flex w-full max-w-[1150px] flex-col border border-line/50 bg-panel/60 px-6 py-3">
        {objectives.length === 0 && <div className="py-6 text-center text-[18px] text-muted2">Aucun objectif pour l'instant.</div>}
        {objectives.map((objective) => (
          <ObjectiveEntry key={objective.id} objective={objective} onOpen={() => navigate(`/objectifs/${objective.id}`)} />
        ))}
      </section>
      <SampleNote />
    </div>
  );
}

function ObjectiveEntry({ objective, onOpen }) {
  const { kitGroups, totals } = useObjectiveProgress(objective);
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full cursor-pointer flex-wrap items-center gap-6 border-0 border-t border-line/35 bg-transparent py-4 text-left first:border-t-0 hover:bg-gold/5"
    >
      <div className="min-w-[240px] flex-1">
        <div className="text-[22px] text-cream">{objective.reason}</div>
        <div className="text-[14px] text-faint">
          {formatDate(objective.date)}
          {kitGroups.map(({ kit, count }) => ` · ${kitLabel(kit, count)}`).join("")}
        </div>
      </div>
      {totals.kitsNeed > 0 && (
        <div className="w-[150px]">
          <div className="lbl">Kits complets</div>
          <RatioValue have={totals.kitsDone} need={totals.kitsNeed} />
        </div>
      )}
      {totals.unitNeed > 0 && (
        <div className="w-[150px]">
          <div className="lbl">À l'unité</div>
          <RatioValue have={totals.unitHave} need={totals.unitNeed} />
        </div>
      )}
    </button>
  );
}

// ---------------------------------------------------------------- création
function NewObjective() {
  const { products, kits, collections, dispatch } = useInventory();
  const navigate = useNavigate();
  const [reason, setReason] = useState("");
  const [date, setDate] = useState("");
  const [kitsWanted, setKitsWanted] = useState({});
  const [perPiece, setPerPiece] = useState({});

  const tools = products.filter((p) => p.type !== "ensemble");
  const totalUnits = Object.values(perPiece).reduce((sum, n) => sum + n, 0);
  const totalKits = Object.values(kitsWanted).reduce((sum, n) => sum + n, 0);
  const set = (id, value) => setPerPiece((current) => ({ ...current, [id]: Math.max(0, Number(value) || 0) }));

  function create() {
    const objective = {
      id: `obj-${Date.now()}`,
      reason: reason.trim() || "Nouvel objectif",
      date,
      kits: Object.fromEntries(Object.entries(kitsWanted).filter(([, n]) => n > 0)),
      // Stock noté à la création : le suivi compte ce qui s'ajoute par-dessus.
      baseline: Object.fromEntries([
        ...products.map((p) => [p.id, productStock(p)]),
        ...kits.map((k) => [`etuis-${k.id}`, leatherTotal(k)]),
      ]),
      basePerTool: 0,
      perPiece: Object.fromEntries(Object.entries(perPiece).filter(([, n]) => n > 0)),
    };
    dispatch({ type: "addObjective", objective });
    navigate(`/objectifs/${objective.id}`);
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader back={{ to: "/objectifs", label: "Objectifs" }} eyebrow="Objectifs" title="Nouvel objectif" />

      <div className="grid w-full items-start justify-center gap-8 lg:grid-cols-[minmax(0,620px)_minmax(0,480px)] lg:gap-12">
        <section className="order-2 flex min-w-0 flex-col gap-2 border border-line/50 bg-panel/60 px-6 py-5 lg:order-1">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <div className="sc text-[16px] tracking-[.16em] text-gold">Outils à rajouter</div>
            <div className="text-[15px] text-faint">à l'unité</div>
          </div>
          {collections.map((collection) => {
            const list = tools.filter((p) => p.collectionId === collection.id);
            if (!list.length) return null;
            return (
              <div key={collection.id} className="flex flex-col">
                {(() => {
                  const kit = kits.find((k) => k.collectionId === collection.id);
                  if (!kit) {
                    return (
                      <div className="sc mt-3 border-t border-gold/60 pt-3 text-[15px] tracking-[.16em] text-gold-light">{collection.name}</div>
                    );
                  }
                  return (
                    <div
                      className="mt-3 flex items-center justify-between gap-4 border-t border-gold/60 px-3 py-3"
                      style={{ background: "linear-gradient(90deg,rgba(200,155,60,.16),rgba(200,155,60,.03))" }}
                    >
                      <span className="text-[21px] font-semibold text-cream">{kit.name}</span>
                      <Stepper
                        small
                        label={`Kits ${kit.name}`}
                        value={kitsWanted[kit.id] ?? 0}
                        onChange={(v) => setKitsWanted((current) => ({ ...current, [kit.id]: Math.max(0, Number(v) || 0) }))}
                      />
                    </div>
                  );
                })()}
                {list.map((product) => (
                  <div key={product.id} className="flex items-center justify-between gap-4 border-t border-line/35 py-3">
                    <span className="text-[19px] text-cream">
                      {product.name}
                      {product.type === "paquet" && <span className="ml-2 text-[14px] text-faint">paquets</span>}
                    </span>
                    <Stepper small label={`Rajouter ${product.name}`} value={perPiece[product.id] ?? 0} onChange={(v) => set(product.id, v)} />
                  </div>
                ))}
              </div>
            );
          })}
        </section>

        <div className="order-1 flex flex-col gap-2 border border-line/70 bg-panel px-6 py-5 lg:sticky lg:top-8 lg:order-2">
          <div className="sc text-[16px] tracking-[.16em] text-gold">Réglages</div>
          <Setting label="Raison">
            <input className="field w-[240px]!" placeholder="Ex. salon, commande…" value={reason} onChange={(e) => setReason(e.target.value)} />
          </Setting>
          <Setting label="Date">
            <input className="field w-[200px]! [color-scheme:dark]" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Setting>
          <div className="mt-2 flex w-fit flex-wrap items-baseline gap-x-3 gap-y-1 border border-gold bg-panel2 px-4 py-2.5">
            <span className="text-[30px] leading-none text-cream">{totalUnits}</span>
            <span className="text-[17px] text-muted">{totalUnits === 1 ? "pièce" : "pièces"} à l'unité</span>
            {totalKits > 0 && (
              <span className="flex items-baseline gap-2 border-l border-line pl-3">
                <span className="text-[22px] leading-none text-cream">+ {totalKits}</span>
                <span className="text-[16px] text-muted">{totalKits === 1 ? "kit" : "kits"}</span>
              </span>
            )}
          </div>
          <button type="button" className="btn-primary mt-4" onClick={create} disabled={totalUnits === 0 && totalKits === 0}>
            Créer l'objectif
          </button>
        </div>
      </div>
      <SampleNote />
    </div>
  );
}

function Setting({ label, children }) {
  return (
    <div className="flex items-center justify-between gap-4 border-t border-line/35 py-3">
      <span className="text-[19px] text-cream">{label}</span>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------- suivi de prod
function Tracking({ objective }) {
  const { dispatch } = useInventory();
  const navigate = useNavigate();
  const { kitGroups, units, totals } = useObjectiveProgress(objective);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader back={{ to: "/objectifs", label: "Objectifs" }} eyebrow={`Suivi de prod · ${formatDate(objective.date)}`} title={objective.reason} />

      <div className="grid w-full items-stretch justify-center gap-8 lg:grid-cols-[minmax(0,620px)_minmax(0,480px)] lg:gap-12">
        <div className="order-2 flex min-w-0 flex-col gap-8 lg:order-1">
          <div className="text-[16px] text-muted2">
            On compte seulement le <span className="text-cream">nouveau stock</span> fabriqué depuis la création de l'objectif. Il remplit
            d'abord les kits, puis les pièces à l'unité.
          </div>

          {kitGroups.map(({ kit, count, done, rows, etuis }) => (
            <section key={kit.id} className="flex flex-col gap-2 border border-line/50 bg-panel/60 px-6 py-5">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <div className="sc text-[16px] tracking-[.16em] text-gold">{kit.name}</div>
                <div className="text-[15px] text-gold-light">
                  {count} {count > 1 ? "kits demandés" : "kit demandé"}
                </div>
              </div>
              {rows.map((row) => (
                <TrackRow key={row.id} row={row} />
              ))}
              <div className="flex w-fit flex-wrap items-baseline gap-x-3 gap-y-1 border border-gold bg-panel2 px-4 py-2.5">
                <span className="text-[30px] leading-none text-cream">{done}</span>
                <span className="text-[17px] text-muted">
                  / {count} {count > 1 ? "kits complets" : "kit complet"}
                </span>
              </div>
              <div className="mt-4 border-t border-gold/60 pt-3 text-[14px] text-faint">Suivi à part, ne compte pas dans « kit complet »</div>
              <TrackRow row={{ id: "etuis", name: "Étuis de cuir", ...etuis }} />
            </section>
          ))}

          {units.length > 0 && (
            <section className="flex flex-col gap-2 border border-line/50 bg-panel/60 px-6 py-5">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <div className="sc text-[16px] tracking-[.16em] text-gold">À l'unité</div>
                <div className="text-[15px] text-gold-light">pièces demandées en plus des kits</div>
              </div>
              {units.map((row) => (
                <TrackRow key={row.id} row={row} />
              ))}
              <div className="flex w-fit flex-wrap items-baseline gap-x-3 gap-y-1 border border-gold bg-panel2 px-4 py-2.5">
                <span className="text-[30px] leading-none text-cream">{totals.unitHave}</span>
                <span className="text-[17px] text-muted">/ {totals.unitNeed} pièces</span>
              </div>
            </section>
          )}

          {objective.id !== "obj-1" && (
            <button
              type="button"
              className="btn-ghost w-fit"
              onClick={() => {
                dispatch({ type: "removeObjective", id: objective.id });
                navigate("/objectifs");
              }}
            >
              Supprimer cet objectif
            </button>
          )}
        </div>

        <div className="order-1 flex flex-col gap-8 lg:order-2 lg:*:static lg:*:flex-1">
          <GaugePanel>
            {totals.kitsNeed > 0 && (
              <GaugeColumn label="Kits" note="complets" have={totals.kitsDone} need={totals.kitsNeed} unit="kits" />
            )}
            {totals.unitNeed > 0 && (
              <GaugeColumn label="À l'unité" note="pièces" have={totals.unitHave} need={totals.unitNeed} unit="pièces" />
            )}
            {totals.etuisNeed > 0 && (
              <GaugeColumn label="Étuis" note="suivi à part" have={totals.etuisHave} need={totals.etuisNeed} unit="étuis" />
            )}
          </GaugePanel>
        </div>
      </div>
      <SampleNote />
    </div>
  );
}

function TrackRow({ row }) {
  return (
    <div className="flex flex-wrap items-center gap-4 border-t border-line/35 py-3">
      <div className="w-[150px] text-[20px] text-cream">{row.name}</div>
      <div className="order-last w-full min-w-0 sm:order-none sm:w-auto sm:flex-1">
        <RowGauge have={row.have} need={row.need} />
      </div>
      <div className="ml-auto w-[110px]">
        <RatioValue have={row.have} need={row.need} note={row.pack ? "paquets" : null} />
      </div>
    </div>
  );
}

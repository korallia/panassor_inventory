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

function useObjectiveRows(objective) {
  const { kits, products, productsById } = useInventory();
  return useMemo(() => {
    if (!objective) return { chosen: [], rows: [], have: 0, need: 0 };
    const counts = kitCounts(objective);
    const chosen = kits.filter((k) => (counts[k.id] || 0) > 0).map((k) => ({ kit: k, count: counts[k.id] }));
    const perPiece = objective.perPiece ?? {};
    const fromKits = {};
    for (const { kit, count } of chosen)
      for (const c of kit.components) fromKits[c.productId] = (fromKits[c.productId] || 0) + count * c.qty;
    const unitFor = (id) => perPiece[id] ?? (fromKits[id] ? objective.basePerTool ?? 0 : 0);

    const rows = chosen.map(({ kit, count }) => ({
      id: `etuis-${kit.id}`,
      name: `Étuis · ${kit.name.replace(/^Kit (du |de la |de |)/i, "")}`,
      have: leatherTotal(kit),
      need: count,
    }));
    for (const product of products) {
      if (product.type === "ensemble") continue;
      const need = unitFor(product.id) + (fromKits[product.id] || 0);
      if (need <= 0) continue;
      rows.push({ id: product.id, name: product.name, have: productStock(product), need, pack: product.type === "paquet" });
    }
    const need = rows.reduce((sum, r) => sum + r.need, 0);
    const have = rows.reduce((sum, r) => sum + Math.min(r.have, r.need), 0);
    return { chosen, rows, have, need };
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
  const { chosen, rows, have, need } = useObjectiveRows(objective);
  const pieces = rows.filter((r) => !r.id.startsWith("etuis")).reduce((sum, r) => sum + r.need, 0);
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full cursor-pointer flex-wrap items-center gap-4 border-0 border-t border-line/35 bg-transparent py-4 text-left first:border-t-0 hover:bg-gold/5"
    >
      <div className="w-[260px]">
        <div className="text-[22px] text-cream">{objective.reason}</div>
        <div className="text-[14px] text-faint">
          {formatDate(objective.date)}
          {chosen.map(({ kit, count }) => ` · ${kitLabel(kit, count)}`).join("")} · {pieces} pièces
        </div>
      </div>
      <div className="min-w-[200px] flex-1">
        <RowGauge have={have} need={need} />
      </div>
      <div className="w-[110px]">
        <RatioValue have={have} need={need} />
      </div>
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
  const { chosen, rows, have, need } = useObjectiveRows(objective);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader back={{ to: "/objectifs", label: "Objectifs" }} eyebrow={`Suivi de prod · ${formatDate(objective.date)}`} title={objective.reason} />

      <div className="grid w-full items-stretch justify-center gap-8 lg:grid-cols-[minmax(0,620px)_minmax(0,480px)] lg:gap-12">
        <section className="order-2 flex min-w-0 flex-col gap-2 border border-line/50 bg-panel/60 px-6 py-5 lg:order-1">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <div className="sc text-[16px] tracking-[.16em] text-gold">Pièces à préparer</div>
            {chosen.length > 0 && (
              <div className="text-[15px] text-gold-light">{chosen.map(({ kit, count }) => kitLabel(kit, count)).join(" + ")} inclus</div>
            )}
          </div>
          {rows.map((row) => (
            <div key={row.id} className="flex flex-wrap items-center gap-4 border-t border-line/35 py-4">
              <div className="w-[150px] text-[21px] text-cream">{row.name}</div>
              <div className="order-last w-full min-w-0 sm:order-none sm:w-auto sm:flex-1">
                <RowGauge have={row.have} need={row.need} />
              </div>
              <div className="ml-auto w-[110px]">
                <RatioValue have={row.have} need={row.need} note={row.pack ? "paquets" : null} />
              </div>
            </div>
          ))}
          <div className="flex w-fit flex-wrap items-baseline gap-x-3 gap-y-1 border border-gold bg-panel2 px-4 py-2.5">
            <span className="text-[30px] leading-none text-cream">{have}</span>
            <span className="text-[17px] text-muted">pièces prêtes sur {need}</span>
          </div>
          {objective.id !== "obj-1" && (
            <button
              type="button"
              className="btn-ghost mt-4 w-fit"
              onClick={() => {
                dispatch({ type: "removeObjective", id: objective.id });
                navigate("/objectifs");
              }}
            >
              Supprimer cet objectif
            </button>
          )}
        </section>

        <div className="order-1 flex flex-col gap-8 lg:order-2 lg:*:static lg:*:flex-1">
          <GaugePanel>
            <GaugeColumn label="Pièces" note={`pour le ${formatDate(objective.date)}`} have={have} need={need} unit="pièces" />
          </GaugePanel>
        </div>
      </div>
      <SampleNote />
    </div>
  );
}

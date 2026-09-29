// Objectifs : quantité, date, raison. « 8 kits complets + 10 de chaque
// outil » devient un objectif par pièce : base à l'unité + 8 × qté par kit.
// Même langage visuel que Kits : pièces à gauche, panneau Objectifs à droite.
import { useState } from "react";

import { useInventory } from "../store.jsx";
import { leatherTotal, objectiveNeeds } from "../lib/inventory.js";
import { GaugeColumn, GaugePanel, PageHeader, RatioValue, RowGauge, SampleNote, Stepper } from "../components/ui.jsx";

function formatDate(value) {
  if (!value) return "[date]";
  return new Date(`${value}T12:00:00`).toLocaleDateString("fr-CA", { day: "numeric", month: "long", year: "numeric" });
}

/** Rangées de l'objectif (étuis + pièces) et totaux. */
function useObjective(objective) {
  const { kits, productsById } = useInventory();
  const kit = kits.find((k) => k.id === objective?.kitId);
  if (!objective || !kit) return { kit, rows: [], have: 0, need: 0 };
  const rows = [
    { id: "etuis", name: "Étuis de cuir", have: leatherTotal(kit), need: objective.kitCount },
    ...objectiveNeeds(objective, kit, productsById).map((n) => ({
      id: n.product.id,
      name: n.product.name,
      have: n.stock,
      need: n.target,
      pack: n.product.type === "paquet",
    })),
  ];
  const need = rows.reduce((sum, r) => sum + r.need, 0);
  const have = rows.reduce((sum, r) => sum + Math.min(r.have, r.need), 0);
  return { kit, rows, have, need };
}

export default function Objectifs() {
  const { objectives, kits, dispatch } = useInventory();
  const [selectedId, setSelectedId] = useState(objectives[0]?.id ?? "new");
  const current = objectives.find((o) => o.id === selectedId);
  const creating = !current;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow={creating ? "Objectifs" : `Objectif · ${formatDate(current.date)}`}
        title={creating ? "Nouvel objectif" : current.reason}
      >
        <div role="tablist" aria-label="Objectifs" className="flex overflow-x-auto">
          {objectives.map((o) => (
            <Tab key={o.id} selected={o.id === selectedId} onClick={() => setSelectedId(o.id)}>
              {o.reason}
            </Tab>
          ))}
          <Tab selected={creating} onClick={() => setSelectedId("new")}>
            + Nouveau
          </Tab>
        </div>
      </PageHeader>

      {creating ? (
        <NewObjective
          kits={kits}
          onCreate={(objective) => {
            dispatch({ type: "addObjective", objective });
            setSelectedId(objective.id);
          }}
        />
      ) : (
        <ObjectiveView objective={current} />
      )}
      <SampleNote />
    </div>
  );
}

function Tab({ selected, onClick, children }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      onClick={onClick}
      className={`sc h-11 shrink-0 cursor-pointer border-0 border-b-2 bg-transparent px-4 text-[14px] tracking-[.12em] ${
        selected ? "border-gold text-cream" : "border-transparent text-muted2 hover:text-cream"
      }`}
    >
      {children}
    </button>
  );
}

function ObjectiveView({ objective }) {
  const { kits, dispatch } = useInventory();
  const { kit, rows, have, need } = useObjective(objective);
  const update = (patch) => dispatch({ type: "updateObjective", id: objective.id, patch });
  const kitName = kit ? kit.name.toLowerCase().replace(/^kit /, "kits ") : "kits";

  return (
    <div className="grid w-full items-stretch justify-center gap-8 lg:grid-cols-[minmax(0,620px)_minmax(0,480px)] lg:gap-12">
      <div className="order-2 min-w-0 lg:order-1">
        <section className="flex h-full flex-col gap-2 border border-line/50 bg-panel/60 px-6 py-5">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <div className="sc text-[16px] tracking-[.16em] text-gold">Pièces à préparer</div>
            <div className="text-[15px] text-gold-light">
              {objective.basePerTool} à l'unité + {objective.kitCount} × qté par kit
            </div>
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

          <div className="mt-6 flex items-baseline justify-between gap-3 border-t border-gold/60 pt-5">
            <div className="sc text-[16px] tracking-[.16em] text-gold">Réglages</div>
          </div>
          <Setting label="Raison">
            <input className="field w-[260px]!" value={objective.reason} onChange={(e) => update({ reason: e.target.value })} />
          </Setting>
          <Setting label="Date">
            <input
              className="field w-[200px]! [color-scheme:dark]"
              type="date"
              value={objective.date}
              onChange={(e) => update({ date: e.target.value })}
            />
          </Setting>
          <Setting label="Kit">
            <select className="field w-[260px]! bg-panel2!" value={objective.kitId} onChange={(e) => update({ kitId: e.target.value })}>
              {kits.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.name}
                </option>
              ))}
            </select>
          </Setting>
          <Setting label="Kits complets">
            <Stepper small label="Kits complets" value={objective.kitCount} onChange={(v) => update({ kitCount: Math.max(0, Number(v) || 0) })} />
          </Setting>
          <Setting label="Base à l'unité">
            <Stepper
              small
              label="Base à l'unité"
              value={objective.basePerTool}
              onChange={(v) => update({ basePerTool: Math.max(0, Number(v) || 0) })}
            />
          </Setting>
          {objective.id !== "obj-1" && (
            <button
              type="button"
              className="btn-ghost mt-2 w-fit"
              onClick={() => dispatch({ type: "removeObjective", id: objective.id })}
            >
              Supprimer cet objectif
            </button>
          )}
        </section>
      </div>

      <div className="order-1 flex flex-col gap-8 lg:order-2 lg:*:static lg:*:flex-1">
        <GaugePanel>
          <GaugeColumn
            label="Pièces"
            note={`${objective.kitCount} ${kitName} + ${objective.basePerTool} à l'unité · pour le ${formatDate(objective.date)}`}
            have={have}
            need={need}
            unit="pièces"
          />
        </GaugePanel>
      </div>
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

function NewObjective({ kits, onCreate }) {
  const [reason, setReason] = useState("");
  const [date, setDate] = useState("");
  const [kitId, setKitId] = useState(kits[0]?.id);
  const [kitCount, setKitCount] = useState(8);
  const [base, setBase] = useState(10);

  function submit(event) {
    event.preventDefault();
    onCreate({
      id: `obj-${Date.now()}`,
      reason: reason.trim() || "Nouvel objectif",
      date,
      kitId,
      kitCount: Math.max(0, Number(kitCount) || 0),
      basePerTool: Math.max(0, Number(base) || 0),
    });
  }

  return (
    <form onSubmit={submit} className="mx-auto flex w-full max-w-[620px] flex-col gap-2 border border-line/50 bg-panel/60 px-6 py-5">
      <div className="sc text-[16px] tracking-[.16em] text-gold">Réglages</div>
      <Setting label="Raison">
        <input className="field w-[260px]!" placeholder="Ex. salon, commande spéciale…" value={reason} onChange={(e) => setReason(e.target.value)} />
      </Setting>
      <Setting label="Date">
        <input className="field w-[200px]! [color-scheme:dark]" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </Setting>
      <Setting label="Kit">
        <select className="field w-[260px]! bg-panel2!" value={kitId} onChange={(e) => setKitId(e.target.value)}>
          {kits.map((k) => (
            <option key={k.id} value={k.id}>
              {k.name}
            </option>
          ))}
        </select>
      </Setting>
      <Setting label="Kits complets">
        <Stepper small label="Kits complets" value={kitCount} onChange={(v) => setKitCount(Math.max(0, Number(v) || 0))} />
      </Setting>
      <Setting label="Base à l'unité">
        <Stepper small label="Base à l'unité" value={base} onChange={(v) => setBase(Math.max(0, Number(v) || 0))} />
      </Setting>
      <button type="submit" className="btn-primary mt-3">
        Créer l'objectif
      </button>
    </form>
  );
}

// Alertes et rapports
//   gauche : les alertes en cours (calculées automatiquement à partir des minimums)
//   droite : la configuration des rapports planifiés
// Les minimums se règlent dans la page Minimums ; rien n'est envoyé pour l'instant.
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useInventory } from "../store.jsx";
import { ensembleState, kitsReady, leatherTotal, productState, stockStatus } from "../lib/inventory.js";
import { PageHeader, SampleNote, StatusPill, Stepper } from "../components/ui.jsx";

const RANK = { out: 0, low: 1, ok: 2 };
const plural = (n, one, many) => (n === 1 ? one : many);

// Trois façons de compter ce qui manque :
//   total   : tout ce qu'il faut (réservé pour les kits + minimum libre) − stock
//   libre   : minimum libre − libres (vente à l'unité)
//   reserve : ce que les kits devraient réserver − ce qui est réservé
const TYPES = [
  { id: "total", label: "Manque total" },
  { id: "libre", label: "Min. libre" },
  { id: "reserve", label: "Min. réservé" },
];

/** Toutes les alertes : kits, étuis (par couleur), outils, ensembles, avec leurs 3 manques. */
function useAlerts() {
  const { kits, products, collections, productsById, reserved } = useInventory();
  return useMemo(() => {
    const collectionName = Object.fromEntries(collections.map((c) => [c.id, c.name]));
    const list = [];
    for (const kit of kits) {
      const ready = kitsReady(kit, productsById);
      const miss = Math.max(0, kit.min - ready);
      list.push({
        id: kit.id,
        status: stockStatus(ready, kit.min),
        name: kit.name,
        units: ["kit", "kits"],
        missing: { total: miss, libre: 0, reserve: miss },
        to: `/kits/${kit.id}`,
        collection: collectionName[kit.collectionId],
      });
      for (const leather of kit.leather) {
        const m = Math.max(0, (leather.min ?? 0) - leather.stock);
        list.push({
          id: `${kit.id}-${leather.color}`,
          status: stockStatus(leather.stock, leather.min ?? 0),
          name: `Étuis ${leather.color.toLowerCase()}`,
          units: ["étui", "étuis"],
          missing: { total: m, libre: 0, reserve: m },
          to: `/kits/${kit.id}`,
          collection: collectionName[kit.collectionId],
        });
      }
    }
    for (const product of products) {
      if (product.type === "ensemble") {
        const state = ensembleState(product, productsById, reserved);
        const m = Math.max(0, state.objective - state.possible);
        list.push({
          id: product.id,
          status: stockStatus(state.possible, state.objective),
          name: product.name,
          units: ["ensemble", "ensembles"],
          missing: { total: m, libre: m, reserve: 0 },
          to: `/produits/${product.id}`,
          collection: collectionName[product.collectionId],
        });
        continue;
      }
      const state = productState(product, reserved);
      const target = kits.reduce(
        (sum, kit) => sum + leatherTotal(kit) * kit.components.filter((c) => c.productId === product.id).reduce((q, c) => q + c.qty, 0),
        0
      );
      list.push({
        id: product.id,
        status: state.status,
        name: product.name,
        units: product.type === "paquet" ? ["paquet", "paquets"] : null,
        missing: {
          total: Math.max(0, target + state.min - state.stock),
          libre: state.missingForMin,
          reserve: Math.max(0, target - state.reserved),
        },
        to: `/produits/${product.id}`,
        collection: collectionName[product.collectionId],
      });
    }
    return list;
  }, [kits, products, collections, productsById, reserved]);
}

function missingText(alert, type) {
  const n = alert.missing[type];
  return alert.units ? `Manque ${n} ${plural(n, ...alert.units)}` : `Manque ${n}`;
}

export default function Alertes() {
  const all = useAlerts();
  const navigate = useNavigate();
  const [type, setType] = useState("total");
  const alerts = all
    .filter((a) => a.missing[type] > 0)
    .sort((a, b) => b.missing[type] - a.missing[type] || RANK[a.status] - RANK[b.status]);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader eyebrow="Suivi" title="Alertes et rapports" />

      <div className="grid w-full items-start justify-center gap-8 lg:grid-cols-[minmax(0,620px)_minmax(0,480px)] lg:gap-12">
        <section className="flex min-w-0 flex-col gap-2 border border-line/50 bg-panel/60 px-6 py-5">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <div className="sc text-[16px] tracking-[.16em] text-gold">Alertes en cours</div>
            <div className="text-[15px] text-faint">selon les minimums</div>
          </div>
          <div role="tablist" aria-label="Type de manque" className="flex flex-wrap border-b border-line/50">
            {TYPES.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={type === t.id}
                onClick={() => setType(t.id)}
                className={`sc h-10 cursor-pointer border-0 border-b-2 bg-transparent px-3 text-[13px] tracking-[.12em] ${
                  type === t.id ? "border-gold text-cream" : "border-transparent text-muted2 hover:text-cream"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          {alerts.length === 0 && <div className="border-t border-line/35 py-6 text-center text-[18px] text-ok">Tout est au-dessus du minimum.</div>}
          {alerts.map((alert) => (
            <button
              key={alert.id}
              type="button"
              onClick={() => navigate(alert.to)}
              className="flex w-full cursor-pointer items-center gap-5 border-0 border-t border-line/35 bg-transparent py-3 text-left hover:bg-gold/5"
            >
              <div className="w-[130px] shrink-0">
                <StatusPill status={alert.status === "ok" ? "low" : alert.status} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[19px] text-cream">{alert.name}</div>
                <div className="text-[14px] text-faint">{alert.collection}</div>
              </div>
              <div className="text-right text-[17px] text-alert-soft">{missingText(alert, type)}</div>
            </button>
          ))}
          <div className="mt-2 flex w-fit flex-wrap items-baseline gap-x-3 gap-y-1 border border-gold bg-panel2 px-4 py-2.5">
            <span className="text-[30px] leading-none text-cream">{alerts.length}</span>
            <span className="text-[17px] text-muted">{alerts.length === 1 ? "alerte" : "alertes"}</span>
            {alerts.some((a) => a.status === "out") && (
              <span className="flex items-baseline gap-2 border-l border-line pl-3">
                <span className="text-[22px] leading-none text-alert-soft">{alerts.filter((a) => a.status === "out").length}</span>
                <span className="text-[16px] text-alert-muted">en rupture</span>
              </span>
            )}
          </div>
        </section>

        <Reports />
      </div>
      <SampleNote />
    </div>
  );
}

// ---------------------------------------------------------------- rapports
const SECTIONS = [
  { id: "alertes", label: "Alertes en cours" },
  { id: "kits", label: "Kits prêts par collection" },
  { id: "stock", label: "Stock libre par outil" },
];
const DAYS = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];

function scheduleText(report) {
  const hour = `${report.hour} h`;
  if (report.frequency === "jour") return `Chaque jour, ${hour}`;
  if (report.frequency === "mois") return `Le ${report.day === "1" ? "1er" : report.day} du mois, ${hour}`;
  return `Chaque ${report.day}, ${hour}`;
}

function Reports() {
  const { reports, dispatch } = useInventory();
  const [openId, setOpenId] = useState(null);

  function addReport() {
    const report = { id: `rep-${Date.now()}`, name: "Nouveau rapport", frequency: "semaine", day: "vendredi", hour: 17, channel: "Discord", active: false, sections: ["alertes"] };
    dispatch({ type: "addReport", report });
    setOpenId(report.id);
  }

  return (
    <aside className="flex flex-col gap-2 border border-line/70 bg-panel px-6 py-5">
      <div className="sc text-[16px] tracking-[.16em] text-gold">Rapports planifiés</div>
      {reports.map((report) => (
        <ReportItem
          key={report.id}
          report={report}
          open={openId === report.id}
          onToggleOpen={() => setOpenId(openId === report.id ? null : report.id)}
          update={(patch) => dispatch({ type: "updateReport", id: report.id, patch })}
          remove={() => dispatch({ type: "removeReport", id: report.id })}
        />
      ))}
      <button type="button" className="btn-primary mt-3" onClick={addReport}>
        + Nouveau rapport
      </button>
    </aside>
  );
}

function ReportItem({ report, open, onToggleOpen, update, remove }) {
  return (
    <div className="border-t border-line/35 py-3">
      <div className="flex items-center justify-between gap-3">
        <button type="button" onClick={onToggleOpen} className="min-w-0 flex-1 cursor-pointer border-0 bg-transparent p-0 text-left">
          <div className="text-[19px] text-cream">{report.name}</div>
          <div className="text-[14px] text-faint">
            {scheduleText(report)} · {report.channel.toLowerCase()}
          </div>
        </button>
        <button
          type="button"
          onClick={() => update({ active: !report.active })}
          className="sc cursor-pointer border bg-transparent px-2.5 py-0.5 text-[13px] tracking-[.08em]"
          style={report.active ? { color: "#9fc7a4", borderColor: "#3f6b48" } : { color: "#b9a888", borderColor: "#6f5423" }}
        >
          {report.active ? "Actif" : "En pause"}
        </button>
      </div>

      {open && (
        <div className="mt-3 flex flex-col gap-3 border-l border-gold/60 pl-4">
          <Field label="Nom">
            <input className="field w-[220px]!" value={report.name} onChange={(e) => update({ name: e.target.value })} />
          </Field>
          <Field label="Fréquence">
            <select
              className="field w-[220px]! bg-panel2!"
              value={report.frequency}
              onChange={(e) => {
                const frequency = e.target.value;
                update({ frequency, day: frequency === "mois" ? "1" : frequency === "semaine" ? "lundi" : report.day });
              }}
            >
              <option value="jour">Chaque jour</option>
              <option value="semaine">Chaque semaine</option>
              <option value="mois">Chaque mois</option>
            </select>
          </Field>
          {report.frequency === "semaine" && (
            <Field label="Jour">
              <select className="field w-[220px]! bg-panel2!" value={report.day} onChange={(e) => update({ day: e.target.value })}>
                {DAYS.map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </select>
            </Field>
          )}
          {report.frequency === "mois" && (
            <Field label="Jour du mois">
              <Stepper small label="Jour du mois" value={Number(report.day)} onChange={(v) => update({ day: String(Math.min(28, Math.max(1, Number(v) || 1))) })} />
            </Field>
          )}
          <Field label="Heure">
            <Stepper small label="Heure" value={report.hour} onChange={(v) => update({ hour: Math.min(23, Math.max(0, Number(v) || 0)) })} />
          </Field>
          <Field label="Envoyer par">
            <select className="field w-[220px]! bg-panel2!" value={report.channel} onChange={(e) => update({ channel: e.target.value })}>
              <option>Discord</option>
              <option>Courriel</option>
            </select>
          </Field>
          <div className="flex flex-col gap-1.5">
            <span className="text-[16px] text-muted">Contenu</span>
            {SECTIONS.map((section) => (
              <label key={section.id} className="flex cursor-pointer items-center gap-2.5 text-[16px] text-muted">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-[#c89b3c]"
                  checked={report.sections.includes(section.id)}
                  onChange={(e) =>
                    update({
                      sections: e.target.checked
                        ? [...report.sections, section.id]
                        : report.sections.filter((id) => id !== section.id),
                    })
                  }
                />
                {section.label}
              </label>
            ))}
          </div>
          <button type="button" className="btn-ghost w-fit" onClick={remove}>
            Supprimer ce rapport
          </button>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[16px] text-muted">{label}</span>
      {children}
    </div>
  );
}

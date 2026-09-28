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

// Une rupture (plus rien en stock) est toujours une alerte, même sans minimum fixé.
const isAlert = (alert, type) => alert.missing[type] > 0 || alert.status === "out";

function missingText(alert, type) {
  const n = alert.missing[type];
  if (n === 0 && alert.status === "out") return "Rupture de stock";
  return alert.units ? `Manque ${n} ${plural(n, ...alert.units)}` : `Manque ${n}`;
}

export default function Alertes() {
  const all = useAlerts();
  const navigate = useNavigate();
  const [type, setType] = useState("total");
  const [openId, setOpenId] = useState(null);
  const { reports } = useInventory();
  const openReport = reports.find((r) => r.id === openId);
  const alerts = all
    .filter((a) => isAlert(a, type))
    .sort((a, b) => RANK[a.status] - RANK[b.status] || b.missing[type] - a.missing[type]);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader eyebrow="Suivi" title="Alertes et rapports" />

      <div className="grid w-full items-start justify-center gap-8 lg:grid-cols-[minmax(0,620px)_minmax(0,480px)] lg:gap-12">
        <div className="flex min-w-0 flex-col gap-8">
        <section className="flex min-w-0 flex-col gap-2 border border-line/50 bg-panel/60 px-6 py-5">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <div className="sc text-[16px] tracking-[.16em] text-gold">Alertes en cours</div>
            <div className="text-[15px] text-faint">ruptures + minimums</div>
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
          {alerts.length === 0 && <div className="border-t border-line/35 py-6 text-center text-[18px] text-ok">Aucune rupture, tout est au-dessus du minimum.</div>}
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
        {openReport && <ReportPreview report={openReport} />}
        </div>

        <Reports openId={openId} setOpenId={setOpenId} />
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

function Reports({ openId, setOpenId }) {
  const { reports, dispatch } = useInventory();

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
  const [confirming, setConfirming] = useState(false);
  return (
    <div className="border-t border-line/35 py-3">
      <div
        role="button"
        tabIndex={0}
        aria-expanded={open}
        onClick={onToggleOpen}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onToggleOpen())}
        className={`-mx-2 flex cursor-pointer items-center justify-between gap-3 px-2 py-1 hover:bg-gold/5 ${open ? "bg-gold/8" : ""}`}
      >
        <div className="min-w-0 flex-1 text-left">
          <div className="text-[19px] text-cream">{report.name}</div>
          <div className="text-[14px] text-faint">
            {scheduleText(report)} · {report.channel.toLowerCase()}
          </div>
        </div>
        <span
          className="sc border px-2.5 py-0.5 text-[13px] tracking-[.08em]"
          style={report.active ? { color: "#9fc7a4", borderColor: "#3f6b48" } : { color: "#b9a888", borderColor: "#6f5423" }}
        >
          {report.active ? "Actif" : "En pause"}
        </span>
        <button
          type="button"
          aria-label={`Retirer ${report.name}`}
          title="Retirer ce rapport"
          onClick={(e) => {
            e.stopPropagation();
            setConfirming(true);
          }}
          className="flex h-7 w-7 cursor-pointer items-center justify-center border border-line bg-transparent text-[18px] leading-none text-muted2 hover:border-alert-line hover:text-alert"
        >
          ×
        </button>
      </div>

      {confirming && (
        <div className="mt-2 flex items-center justify-between gap-3 border border-alert-line bg-alert-bg px-3 py-2 text-[15px]">
          <span className="text-alert-soft">Retirer « {report.name} » ?</span>
          <span className="flex gap-2">
            <button type="button" className="btn-ghost h-8! px-3! text-[13px]!" onClick={() => setConfirming(false)}>
              Annuler
            </button>
            <button
              type="button"
              className="sc h-8 cursor-pointer border border-alert-line bg-[#9b4a36] px-3 text-[13px] tracking-[.1em] text-cream"
              onClick={remove}
            >
              Retirer
            </button>
          </span>
        </div>
      )}

      {open && (
        <div className="mt-3 flex flex-col gap-3 border-l border-gold/60 pl-4">
          <Field label="Statut">
            <div className="flex" role="radiogroup" aria-label="Statut">
              {[
                [true, "Actif"],
                [false, "En pause"],
              ].map(([value, label]) => (
                <button
                  key={label}
                  type="button"
                  role="radio"
                  aria-checked={report.active === value}
                  onClick={() => update({ active: value })}
                  className={`sc h-10 w-[110px] cursor-pointer border text-[13px] tracking-[.1em] ${
                    report.active === value
                      ? value
                        ? "border-ok-line bg-[#0e1a10] text-ok"
                        : "border-gold bg-gold/15 text-cream"
                      : "border-line bg-transparent text-muted2 hover:text-cream"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </Field>
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
          <div className="text-[14px] text-gold-light">L'aperçu du message s'affiche à gauche.</div>
        </div>
      )}
    </div>
  );
}

/** Aperçu du message tel qu'il partirait (Discord ou courriel), avec les données actuelles. */
function ReportPreview({ report }) {
  const all = useAlerts();
  const { kits, products, collections, productsById, reserved } = useInventory();
  const alerts = all.filter((a) => isAlert(a, "total")).sort((a, b) => RANK[a.status] - RANK[b.status] || b.missing.total - a.missing.total);
  const today = new Date().toLocaleDateString("fr-CA", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const has = (id) => report.sections.includes(id);

  return (
    <section className="flex flex-col border border-gold/70 bg-ink">
      {/* En-tête du message */}
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-gold/60 px-6 py-5" style={{ background: "linear-gradient(180deg,#1a1109 0%,#0d0805 100%)" }}>
        <div>
          <div className="eyebrow">Aperçu du message</div>
          <div className="sc mt-1 text-[24px] text-cream">{report.name}</div>
          <div className="text-[15px] text-muted2">{today}</div>
        </div>
        <div className="sc border border-line px-3 py-1 text-[13px] tracking-[.12em] text-gold-light">{report.channel}</div>
      </div>

      <div className="flex flex-col gap-6 px-6 py-5">
        {has("alertes") && (
          <PreviewBlock title="Alertes" count={alerts.length}>
            {alerts.length === 0 ? (
              <div className="text-[16px] text-ok">Tout est au-dessus du minimum.</div>
            ) : (
              alerts.map((a) => (
                <div key={a.id} className="flex items-center gap-4 border-t border-line/30 py-2 first:border-t-0">
                  <div className="w-[120px] shrink-0">
                    <StatusPill status={a.status === "ok" ? "low" : a.status} />
                  </div>
                  <div className="min-w-0 flex-1 text-[17px] text-cream">
                    {a.name} <span className="text-[14px] text-faint">· {a.collection}</span>
                  </div>
                  <div className="text-[16px] text-alert-soft">{missingText(a, "total")}</div>
                </div>
              ))
            )}
          </PreviewBlock>
        )}

        {has("kits") && (
          <PreviewBlock title="Kits prêts">
            <div className="grid gap-3 sm:grid-cols-3">
              {kits.map((kit) => {
                const ready = kitsReady(kit, productsById);
                const low = ready < kit.min;
                return (
                  <div key={kit.id} className={`border px-4 py-3 ${low ? "border-alert-line bg-alert-bg" : "border-ok-line bg-[#0e1a10]"}`}>
                    <div className="text-[15px] text-muted">{kit.name}</div>
                    <div className={`text-[32px] leading-tight ${low ? "text-alert-soft" : "text-[#cfe5d2]"}`}>{ready}</div>
                    <div className="text-[13px] text-faint">minimum {kit.min}</div>
                  </div>
                );
              })}
            </div>
          </PreviewBlock>
        )}

        {has("stock") && (
          <PreviewBlock title="Stock libre">
            <div className="flex flex-col gap-4">
              {collections.map((c) => (
                <div key={c.id}>
                  <div className="sc mb-1 text-[13px] tracking-[.14em] text-gold-light">{c.name}</div>
                  <div className="grid gap-x-8 sm:grid-cols-2">
                    {products
                      .filter((p) => p.collectionId === c.id && p.type !== "ensemble")
                      .map((p) => {
                        const st = productState(p, reserved);
                        return (
                          <div key={p.id} className="flex justify-between border-t border-line/30 py-1.5 text-[16px]">
                            <span className="text-muted">{p.name}</span>
                            <span className={st.status === "ok" ? "text-cream" : "text-alert-soft"}>
                              {st.free}
                              {p.type === "paquet" && <span className="ml-1 text-[13px] text-faint">paq.</span>}
                            </span>
                          </div>
                        );
                      })}
                    {products
                      .filter((p) => p.collectionId === c.id && p.type === "ensemble")
                      .map((p) => {
                        const st = ensembleState(p, productsById, reserved);
                        const low = st.possible < st.objective;
                        return (
                          <div key={p.id} className="flex justify-between border-t border-line/30 py-1.5 text-[16px]">
                            <span className="text-muted">
                              {p.name} <span className="text-[13px] text-faint">ensemble</span>
                            </span>
                            <span className={low ? "text-alert-soft" : "text-cream"}>{st.possible}</span>
                          </div>
                        );
                      })}
                  </div>
                </div>
              ))}
            </div>
          </PreviewBlock>
        )}

        {report.sections.length === 0 && <div className="text-[16px] text-faint">Coche au moins un contenu.</div>}
      </div>

      <div className="border-t border-line/40 px-6 py-3 text-[13px] text-faint">
        Envoyé automatiquement par Panassor · Atelier · {scheduleText(report).toLowerCase()}
      </div>
    </section>
  );
}

function PreviewBlock({ title, count, children }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline gap-3 border-b border-gold/50 pb-1.5">
        <span className="sc text-[16px] tracking-[.16em] text-gold">{title}</span>
        {count !== undefined && <span className="text-[15px] text-faint">{count}</span>}
      </div>
      {children}
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

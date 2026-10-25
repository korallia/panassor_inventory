// Alertes et rapports
//   gauche : les alertes en cours (calculées automatiquement à partir des minimums)
//   droite : la configuration des rapports planifiés
// Les minimums se règlent dans la page Minimums ; rien n'est envoyé pour l'instant.
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useInventory } from "../store.jsx";
import { ensembleState, kitsReady, leatherTotal, productState, stockStatus } from "../lib/inventory.js";
import { PageHeader, SampleNote, Stepper } from "../components/ui.jsx";

const plural = (n, one, many) => (n === 1 ? one : many);

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
        have: ready,
        need: kit.min,
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
          have: leather.stock,
          need: leather.min ?? 0,
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
          have: state.possible,
          need: state.objective,
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
        have: state.stock,
        need: target + state.min,
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

// Une alerte = il en manque, ou il ne reste plus rien (même sans minimum fixé).
const isAlert = (alert) => alert.missing.total > 0 || alert.have <= 0;
// Plus c'est loin de la cible (en proportion), plus c'est haut.
const gap = (alert) => (alert.missing.total > 0 ? alert.missing.total / Math.max(alert.need, 1) : 1);

// Urgence = distance à la cible : rouge (plus rien), orange (plus de la moitié manque), jaune (moins de la moitié).
function worstUrgency(list) {
  return urgency(list.reduce((w, x) => (gap(x) > gap(w) ? x : w), list[0]));
}

function urgency(alert) {
  const g = gap(alert);
  if (g >= 0.99) return { color: "#e8876f", line: "rgba(155,74,54,.8)", tint: "rgba(232,135,111,.16)" };
  if (g >= 0.5) return { color: "#e89a4a", line: "rgba(168,101,31,.8)", tint: "rgba(232,154,74,.13)" };
  return { color: "#e2b04a", line: "rgba(143,107,31,.8)", tint: "rgba(226,176,74,.10)" };
}

function missingText(alert) {
  const n = alert.missing.total;
  if (n === 0) return "Aucun en stock";
  return alert.units ? `Manque ${n} ${plural(n, ...alert.units)}` : `Manque ${n}`;
}

const BAND_BG = { background: "linear-gradient(90deg,rgba(200,155,60,.16),rgba(200,155,60,.03))" };

function groupByCollection(alerts, collections) {
  return collections
    .map((collection) => ({ name: collection.name, alerts: alerts.filter((a) => a.collection === collection.name) }))
    .filter((group) => group.alerts.length > 0);
}

function AlertSummary({ alerts, groups, title = "Alertes en cours" }) {
  return (
    <div className="border border-gold/40 px-5 py-4" style={BAND_BG}>
      <div className="flex items-center justify-between gap-4">
        <span className="sc text-[20px] tracking-[.16em] text-gold-light">{title}</span>
        <span className="text-[32px] leading-none font-semibold text-cream">{alerts.length}</span>
      </div>
      <div className="mt-4 flex flex-wrap gap-x-10 gap-y-2 border-t border-gold/25 pt-4">
        {groups.map((g) => (
          <span key={g.name} className="text-[16px] text-muted2">
            {g.name} <span className="mx-1.5 text-gold">·</span> <span className="font-semibold text-cream">{g.alerts.length}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function CollectionBand({ name, right }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border border-gold/35 px-4 py-2.5" style={BAND_BG}>
      <span className="text-[21px] font-semibold text-cream">{name}</span>
      {right && <span className="sc text-[13px] tracking-[.12em] text-gold-light">{right}</span>}
    </div>
  );
}

function AlertGroups({ groups, onOpen }) {
  return groups.map((group) => (
    <div key={group.name} className="mt-6 mb-10 last:mb-2">
      <CollectionBand name={group.name} right={`${group.alerts.length} ${plural(group.alerts.length, "alerte", "alertes")}`} />
      <div className="border border-t-0 border-gold/35">
        {group.alerts.map((alert) => {
          const u = urgency(alert);
          const Tag = onOpen ? "button" : "div";
          return (
            <Tag
              key={alert.id}
              {...(onOpen ? { type: "button", onClick: () => onOpen(alert) } : {})}
              className={`relative flex w-full items-center gap-5 border-0 border-b bg-transparent py-4.5 pr-4 pl-5 text-left ${onOpen ? "cursor-pointer hover:brightness-125" : ""}`}
              style={{ background: `linear-gradient(90deg, ${u.tint}, rgba(0,0,0,0) 75%)`, borderBottomColor: u.line }}
            >
              <span className="absolute top-0 bottom-0 left-0 w-[5px]" style={{ background: u.color }} />
              <div className="min-w-0 flex-1 text-[19px] text-cream">{alert.name}</div>
              <div className="w-[90px] shrink-0 text-right text-[19px] text-muted2">
                <span className="font-semibold" style={{ color: u.color }}>{alert.have}</span>
                <span className="text-[15px]"> / {alert.need}</span>
              </div>
              <div className="w-[190px] shrink-0 whitespace-nowrap text-right text-[17px] font-semibold" style={{ color: u.color }}>
                {missingText(alert)}
              </div>
            </Tag>
          );
        })}
      </div>
    </div>
  ));
}

export default function Alertes() {
  const all = useAlerts();
  const navigate = useNavigate();
  const [openId, setOpenId] = useState(null);
  const { reports, collections } = useInventory();
  const openReport = reports.find((r) => r.id === openId);
  const alerts = all
    .filter(isAlert)
    .sort((a, b) => gap(b) - gap(a) || b.missing.total - a.missing.total);
  // Groupées par collection (dans l'ordre des collections), les plus loin de la cible d'abord.
  const groups = groupByCollection(alerts, collections);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader eyebrow="Suivi" title="Alertes et rapports" />

      <div className="grid w-full items-start justify-center gap-8 lg:grid-cols-[minmax(0,620px)_minmax(0,480px)] lg:gap-12">
        <div className="flex min-w-0 flex-col gap-8">
        <section className="flex min-w-0 flex-col gap-2 border border-line/50 bg-panel/60 px-6 py-5">
          <div className="border-b border-line/35 pb-8">
            {alerts.length > 0 && <AlertSummary alerts={alerts} groups={groups} />}
          </div>
          {alerts.length === 0 && <div className="border-t border-line/35 py-6 text-center text-[18px] text-ok">Aucune alerte, tout est au-dessus du minimum.</div>}
          <AlertGroups groups={groups} onOpen={(alert) => navigate(alert.to)} />
        </section>
        {openReport && <PreviewModal onClose={() => setOpenId(null)}><ReportPreview report={openReport} /></PreviewModal>}
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
          <div className="sub mt-0.5">
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
function PreviewModal({ onClose, children }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 sm:py-10" onClick={onClose}>
      <div className="relative w-full max-w-[760px] shadow-[0_20px_60px_#000]" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer"
          className="absolute top-3 right-3 z-10 h-8 w-8 cursor-pointer border border-line bg-ink text-[18px] text-muted2 hover:text-cream"
        >
          ×
        </button>
        {children}
      </div>
    </div>
  );
}

function ReportPreview({ report }) {
  const all = useAlerts();
  const { kits, products, collections, productsById, reserved } = useInventory();
  const alerts = all.filter(isAlert).sort((a, b) => gap(b) - gap(a) || b.missing.total - a.missing.total);
  const groups = groupByCollection(alerts, collections);
  const today = new Date().toLocaleDateString("fr-CA", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const has = (id) => report.sections.includes(id);
  // Même couleur que les alertes : vert si atteint, sinon selon la distance au minimum.
  const tone = (have, need) =>
    have >= need ? "#9fc7a4" : urgency({ have, need, missing: { total: need - have } }).color;

  return (
    <section className="flex flex-col border border-gold/70 bg-ink">
      {/* En-tête du message */}
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-gold/60 px-7 py-6 pr-14" style={{ background: "linear-gradient(180deg,#1a1109 0%,#0d0805 100%)" }}>
        <div>
          <div className="eyebrow">Aperçu du message</div>
          <div className="sc mt-1 text-[26px] text-cream">{report.name}</div>
          <div className="text-[15px] text-muted2">{today}</div>
        </div>
        <div className="sc border border-line px-3 py-1 text-[13px] tracking-[.12em] text-gold-light">{report.channel}</div>
      </div>

      <div className="flex flex-col px-7 py-6 [&>*+*]:mt-10 [&>*+*]:pt-10 [&>*+*]:[background:linear-gradient(90deg,rgba(200,155,60,0),rgba(200,155,60,.8),rgba(200,155,60,0))_top/100%_1px_no-repeat]">
        {has("alertes") && (
          <MsgSection title="Alertes" count={alerts.length}>
            {alerts.length === 0 ? (
              <div className="pt-2 text-[17px] text-ok">Tout est au-dessus du minimum.</div>
            ) : (
              groups.map((g) => (
                <MsgGroup key={g.name} name={g.name} count={g.alerts.length}>
                  {g.alerts.map((a) => {
                    const color = urgency(a).color;
                    return (
                      <MsgRow key={a.id} color={color} name={a.name}>
                        <span className="w-[64px] shrink-0 text-right text-[16px] text-muted2">
                          <span className="font-semibold" style={{ color }}>{a.have}</span> / {a.need}
                        </span>
                        <span className="w-[170px] shrink-0 text-right text-[16px] whitespace-nowrap" style={{ color }}>
                          {missingText(a)}
                        </span>
                      </MsgRow>
                    );
                  })}
                </MsgGroup>
              ))
            )}
          </MsgSection>
        )}

        {has("kits") && (
          <MsgSection title="Kits prêts">
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {kits.map((kit) => {
                const ready = kitsReady(kit, productsById);
                const color = tone(ready, kit.min);
                return (
                  <div
                    key={kit.id}
                    className="border border-line/60 px-4 pt-3 pb-4 text-center"
                    style={{ borderTop: `3px solid ${color}`, background: "linear-gradient(180deg,rgba(200,155,60,.08),rgba(0,0,0,0))" }}
                  >
                    <div className="text-[16px] text-muted">{kit.name}</div>
                    <div className="mt-1 text-[36px] leading-tight font-semibold" style={{ color }}>{ready}</div>
                    <div className="sub">
                      minimum <span className="sub-num">{kit.min}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </MsgSection>
        )}

        {has("stock") && (
          <MsgSection title="Stock libre">
            <div className="mt-3 flex flex-col">
              {collections.map((c) => (
                <div key={c.id} className="border-gold/45 py-5 first:pt-2 [&+&]:border-t">
                  <div className="sc mb-2 text-[16px] tracking-[.14em] text-gold-light">{c.name}</div>
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
                              {p.type === "paquet" && <span className="sub ml-1">paq.</span>}
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
                              {p.name} <span className="sub">ensemble</span>
                            </span>
                            <span className={low ? "text-alert-soft" : "text-cream"}>{st.possible}</span>
                          </div>
                        );
                      })}
                  </div>
                </div>
              ))}
            </div>
          </MsgSection>
        )}

        {report.sections.length === 0 && <div className="sub">Coche au moins un contenu.</div>}
      </div>

      <div className="sub border-t border-line/40 px-7 py-4">
        Envoyé automatiquement par Panassor · Atelier · {scheduleText(report).toLowerCase()}
      </div>
    </section>
  );
}

function MsgSection({ title, count, children }) {
  return (
    <div>
      <div className="flex items-baseline gap-3 border-b border-gold/50 pb-2">
        <span className="sc text-[21px] tracking-[.16em] text-gold-light">{title}</span>
        {count !== undefined && <span className="text-[21px] font-semibold text-cream">{count}</span>}
      </div>
      {children}
    </div>
  );
}

function MsgGroup({ name, count, children }) {
  return (
    <div className="mt-5">
      <div className="sc mb-1 text-[13px] tracking-[.14em] text-gold-light">
        {name}
        {count !== undefined && <span className="text-faint"> · {count}</span>}
      </div>
      {children}
    </div>
  );
}

function MsgRow({ color, name, children }) {
  return (
    <div className="flex items-baseline gap-3 py-1">
      {color && <span className="h-2 w-2 shrink-0 -translate-y-0.5 rounded-full" style={{ background: color }} />}
      <span className="min-w-0 flex-1 text-[17px] text-cream">{name}</span>
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

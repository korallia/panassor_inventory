// Petites briques visuelles partagées par toutes les pages.
import { Link } from "react-router-dom";

// ---------- Cases (1 case = 1 unité) ----------
// Couleur seulement, pas d'icône :
//   reserved  vert       réservé pour les kits
//   free      or plein   libre / pour les ensembles
//   solo      or pâle    vendable seul (3e couche des ensembles)
//   missing   pointillé  manque
//   orphan    gris plein pièce orpheline (hors stock)
const SLOT_STYLES = {
  reserved: { background: "#3f6b48", border: "1px solid #9fc7a4" },
  free: { background: "#e0b04f", border: "1px solid #fff1d2" },
  solo: { background: "rgba(224,176,79,.22)", border: "1px solid #8a6a2c" },
  missing: { background: "rgba(232,135,111,.10)", border: "2px dashed #e8876f" },
  orphan: { background: "#4a4238", border: "1px solid #8f8577" },
};

const SLOT_SIZES = {
  lg: { width: 52, height: 64 },
  sm: { width: 30, height: 40 },
  xs: { width: 16, height: 22 },
};

export function Slot({ kind, size = "lg", title }) {
  return (
    <span
      title={title}
      className="inline-block shrink-0 box-border"
      style={{ ...SLOT_SIZES[size], ...SLOT_STYLES[kind] }}
    />
  );
}

// ---------- Barre proportionnelle (variante A) ----------
// Une barre par produit : la longueur de chaque couleur suit la quantité,
// le chiffre est écrit dedans. `scale` permet de mettre plusieurs rangées
// sur la même échelle (ex. les pièces d'un ensemble).
const BAR_TEXT = {
  reserved: "#e8f3ea",
  free: "#2a1c06",
  solo: "#e7c97b",
  missing: "#ffd9cf",
  orphan: "#d6cfc5",
};
const KIND_NAMES = {
  reserved: "Réservé pour les kits",
  free: "Libre",
  solo: "Vendable seul",
  missing: "Manque",
  orphan: "Orpheline",
};

function rulerStep(scale) {
  if (scale <= 10) return 2;
  if (scale <= 30) return 5;
  if (scale <= 150) return 10;
  if (scale <= 600) return 50;
  return 100;
}

export function LayerBar({ segments, scale, size = "lg", ruler = true }) {
  const parts = segments.filter((segment) => segment.count > 0);
  const total = parts.reduce((sum, segment) => sum + segment.count, 0);
  const max = Math.max(scale ?? total, total, 1);
  const height = size === "lg" ? 38 : 30;
  const step = rulerStep(max);
  const marks = [];
  for (let value = 0; value <= max; value += step) marks.push(value);
  if (max - marks[marks.length - 1] > step / 2) marks.push(max);

  return (
    <div className="w-full min-w-0">
      <div className="flex w-full" style={{ height }}>
        {parts.length === 0 && <div className="flex-1 border border-dashed border-line" />}
        {parts.map((segment, index) => (
          <div
            key={`${segment.kind}-${index}`}
            title={`${segment.title ?? KIND_NAMES[segment.kind]} : ${segment.count}`}
            className="box-border flex min-w-0 items-center justify-center overflow-hidden whitespace-nowrap tabular-nums"
            style={{
              width: `${(segment.count / max) * 100}%`,
              ...SLOT_STYLES[segment.kind],
              color: BAR_TEXT[segment.kind],
              fontSize: size === "lg" ? 17 : 15,
              fontWeight: segment.kind === "free" ? 600 : 400,
            }}
          >
            {segment.count}
          </div>
        ))}
      </div>
      {ruler && (
        <div className="relative h-4 text-[12px] text-faint" aria-hidden="true">
          {marks.map((value) => {
            const left = `${(value / max) * 100}%`;
            const edge = value === 0 ? "translateX(0)" : value === max ? "translateX(-100%)" : "translateX(-50%)";
            return (
              <span key={value}>
                <i className="absolute top-0 h-[5px] border-l border-faint" style={{ left }} />
                <em className="absolute top-1 not-italic tabular-nums" style={{ left, transform: edge }}>
                  {value}
                </em>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---------- Jauge d'objectif (variante C) ----------
// La couleur dit l'ÉTAT, pas le type de stock :
//   vert = objectif atteint · or = présent mais insuffisant · pointillé rouge = manquant.
// Chaque jauge se remplit jusqu'à SON objectif ; le surplus est écrit, pas dessiné.
const GAUGE_STYLES = {
  ok: { background: "#3f6b48", border: "1px solid #9fc7a4", color: "#e8f3ea" },
  short: { background: "#e0b04f", border: "1px solid #fff1d2", color: "#2a1c06", fontWeight: 600 },
  missing: { background: "rgba(232,135,111,.10)", border: "2px dashed #e8876f", color: "#ffd9cf" },
};

export function GoalGauge({ label, note, have, need, unit }) {
  const reached = have >= need;
  const scale = Math.max(need, 1);
  const within = need > 0 ? Math.min(have, need) : have > 0 ? 1 : 0;
  const missing = Math.max(0, need - have);
  const extra = Math.max(0, have - need);
  const parts = [
    { kind: reached ? "ok" : "short", count: within, shown: need > 0 ? within : have },
    { kind: "missing", count: missing, shown: missing },
  ].filter((part) => part.count > 0);

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 sm:grid-cols-[190px_minmax(0,1fr)_120px]">
      <div className="min-w-0">
        <div className="sc text-[15px] tracking-[.16em] text-gold">{label}</div>
        {note && <div className="text-[15px] text-faint">{note}</div>}
      </div>
      <div className="order-last col-span-2 flex h-[34px] w-full bg-track sm:order-none sm:col-span-1">
        {parts.map((part) => (
          <div
            key={part.kind}
            className="box-border flex min-w-0 items-center justify-center overflow-hidden whitespace-nowrap text-[16px] tabular-nums"
            style={{ width: `${(part.count / scale) * 100}%`, ...GAUGE_STYLES[part.kind] }}
          >
            {part.shown}
          </div>
        ))}
      </div>
      <div className="text-right tabular-nums">
        <div className={`text-[24px] leading-none ${reached ? "text-[#cfe5d2]" : "text-alert-soft"}`}>
          {have} <span className="text-[18px] text-muted2">/ {need}</span>
          {unit && <span className="ml-1 text-[14px] text-faint">{unit}</span>}
        </div>
        {extra > 0 && need > 0 && <div className="mt-1 text-[13px] text-faint">+{extra} en plus</div>}
      </div>
    </div>
  );
}

// ---------- Jauges verticales + mise en page des fiches ----------
function VerticalBar({ have, need, height }) {
  const reached = have >= need;
  const scale = Math.max(need, 1);
  const within = need > 0 ? Math.min(have, need) : have > 0 ? 1 : 0;
  const missing = Math.max(0, need - have);
  const parts = [
    { kind: "missing", count: missing, shown: missing },
    { kind: reached ? "ok" : "short", count: within, shown: need > 0 ? within : have },
  ].filter((part) => part.count > 0);
  return (
    <div className="mx-auto flex w-full max-w-[84px] flex-col bg-track" style={{ height }}>
      {parts.map((part) => (
        <div
          key={part.kind}
          className="box-border flex min-h-0 items-center justify-center overflow-hidden text-[15px] tabular-nums"
          style={{ height: `${(part.count / scale) * 100}%`, ...GAUGE_STYLES[part.kind] }}
        >
          {part.shown}
        </div>
      ))}
    </div>
  );
}

/** Jauge horizontale compacte pour les rangées (même logique de couleurs). */
export function RowGauge({ have, need, height = 30 }) {
  const reached = have >= need;
  const scale = Math.max(need, 1);
  const within = need > 0 ? Math.min(have, need) : have > 0 ? 1 : 0;
  const missing = Math.max(0, need - have);
  const parts = [
    { kind: reached ? "ok" : "short", count: within, shown: need > 0 ? within : have },
    { kind: "missing", count: missing, shown: missing },
  ].filter((part) => part.count > 0);
  return (
    <div className="flex w-full bg-track" style={{ height }}>
      {parts.map((part) => (
        <div
          key={part.kind}
          className="box-border flex min-w-0 items-center justify-center overflow-hidden whitespace-nowrap text-[15px] tabular-nums"
          style={{ width: `${(part.count / scale) * 100}%`, ...GAUGE_STYLES[part.kind] }}
        >
          {part.shown}
        </div>
      ))}
    </div>
  );
}

/** Chiffre « a / b » coloré selon l'état, avec une petite note dessous. */
export function RatioValue({ have, need, note }) {
  const reached = have >= need;
  return (
    <div className="text-right tabular-nums">
      <div className="leading-none">
        <span className={`text-[26px] ${reached ? "text-[#cfe5d2]" : "text-alert-soft"}`}>{have}</span>
        <span className="text-[17px] text-muted2"> / {need}</span>
      </div>
      {note && <div className="mt-1 text-[13px] text-faint">{note}</div>}
    </div>
  );
}

/** Une colonne : titre, chiffre, barre verticale, note. */
export function GaugeColumn({ label, note, have, need, unit, height = 300 }) {
  const reached = have >= need;
  const extra = Math.max(0, have - need);
  return (
    <div className="flex min-w-0 flex-col items-center gap-3 text-center">
      <div className="sc text-[19px] tracking-[.14em] text-cream">{label}</div>
      <div className="tabular-nums leading-none">
        <span className={`text-[36px] ${reached ? "text-[#cfe5d2]" : "text-alert-soft"}`}>{have}</span>
        <span className="text-[19px] text-muted2"> / {need}</span>
        {unit && <div className="mt-1 text-[13px] text-faint">{unit}</div>}
      </div>
      <VerticalBar have={have} need={need} height={height} />
      <div className="min-h-[36px] text-[14px] leading-snug text-faint">
        {extra > 0 && need > 0 ? <div className="text-muted2">+{extra} en plus</div> : null}
        {note}
      </div>
    </div>
  );
}

/** Panneau latéral des jauges (colonne de droite). */
export function GaugePanel({ title = "Objectifs", children, footer }) {
  return (
    <aside className="flex flex-col gap-6 border border-line/70 bg-panel px-6 py-7 lg:sticky lg:top-8">
      <div className="sc text-center text-[18px] tracking-[.2em] text-gold">{title}</div>
      <div className="grid auto-cols-fr grid-flow-col gap-3">{children}</div>
      {footer}
      <div className="flex flex-col gap-1.5 border-t border-line/40 pt-4 text-[14px] text-muted2">
        <span className="flex items-center gap-2">
          <span className="inline-block h-4 w-3" style={GAUGE_STYLES.ok} />
          Objectif atteint
        </span>
        <span className="flex items-center gap-2">
          <span className="inline-block h-4 w-3" style={GAUGE_STYLES.short} />
          Présent, mais sous l'objectif
        </span>
        <span className="flex items-center gap-2">
          <span className="box-border inline-block h-4 w-3" style={GAUGE_STYLES.missing} />
          Manquant
        </span>
      </div>
    </aside>
  );
}

/** Fiche : contenu à gauche, jauges à droite (au-dessus sur mobile). */
export function DetailLayout({ aside, children }) {
  return (
    <div className="grid w-full items-start justify-center gap-8 lg:grid-cols-[minmax(0,620px)_minmax(0,480px)] lg:gap-12">
      <div className="order-2 flex min-w-0 flex-col gap-8 lg:order-1">{children}</div>
      <div className="order-1 lg:order-2">{aside}</div>
    </div>
  );
}

export function GaugeLegend({ children }) {
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[16px] text-muted2">
      {children}
      <span className="flex items-center gap-2">
        <span className="inline-block h-[22px] w-4" style={GAUGE_STYLES.ok} />
        Objectif atteint
      </span>
      <span className="flex items-center gap-2">
        <span className="inline-block h-[22px] w-4" style={GAUGE_STYLES.short} />
        Présent, mais sous l'objectif
      </span>
      <span className="flex items-center gap-2">
        <span className="inline-block h-[22px] w-4 box-border" style={GAUGE_STYLES.missing} />
        Manquant
      </span>
    </div>
  );
}

/** Une série de cases identiques. */
export function Slots({ kind, count, size = "lg", title }) {
  if (count <= 0) return null;
  return Array.from({ length: count }, (_, index) => <Slot key={`${kind}-${index}`} kind={kind} size={size} title={title} />);
}

/** Petite case de légende + texte. */
export function Legend({ kind, children, layer }) {
  return (
    <span className="flex items-center gap-2">
      {layer && <LayerBadge layer={layer} />}
      <Slot kind={kind} size="xs" />
      {children}
    </span>
  );
}

const LAYER_COLORS = {
  1: { borderColor: "#9fc7a4", color: "#9fc7a4" },
  2: { borderColor: "#e7c97b", color: "#e7c97b" },
  3: { borderColor: "#8a6a2c", color: "#c89b3c" },
};

export function LayerBadge({ layer }) {
  return (
    <span
      className="sc flex h-[22px] w-[22px] items-center justify-center border text-[13px]"
      style={LAYER_COLORS[layer]}
    >
      {layer}
    </span>
  );
}

/** Groupe de cases coiffé d'une étiquette et d'une accolade. */
export function SlotGroup({ label, bracketColor = "#c89b3c", labelColor = "#e7c97b", children }) {
  return (
    <div className="flex w-fit max-w-full min-w-0 flex-col gap-2.5">
      <span className="sc text-[15px] tracking-[.16em]" style={{ color: labelColor }}>
        {label}
      </span>
      <div className="h-2.5 border border-b-0" style={{ borderColor: bracketColor }} />
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

// ---------- États ----------
export function StatusPill({ status }) {
  const low = status === "low";
  return (
    <span
      className="sc inline-block whitespace-nowrap border px-2.5 py-0.5 text-[13px] tracking-[.08em]"
      style={low ? { color: "#e8876f", borderColor: "#9b4a36" } : { color: "#9fc7a4", borderColor: "#3f6b48" }}
    >
      {low ? "Sous le min." : "OK"}
    </span>
  );
}

// ---------- Tuiles de chiffres ----------
export function StatTile({ label, value, of, unit, note, alert = false }) {
  return (
    <div className={`border px-5 py-4 ${alert ? "border-alert-line bg-alert-bg" : "border-line bg-panel2"}`}>
      <div className="lbl" style={alert ? { color: "#d7b5a8" } : undefined}>
        {label}
      </div>
      <div className={`mt-2 text-[40px] leading-[1.1] ${alert ? "text-alert-soft" : "text-cream"}`}>
        {value}
        {of !== undefined && <span className={`text-[26px] ${alert ? "text-alert-muted" : "text-muted2"}`}> / {of}</span>}
        {unit && <span className={`ml-2 text-[18px] ${alert ? "text-alert-muted" : "text-muted2"}`}>{unit}</span>}
      </div>
      {note && <div className={`text-[15px] ${alert ? "text-alert-muted" : "text-muted2"}`}>{note}</div>}
    </div>
  );
}

/** Encadré d'état en haut à droite des fiches (« Sous le minimum −8 »). */
export function StatusBanner({ low, lowLabel = "Sous le minimum", missing, missingLabel }) {
  if (!low) {
    return (
      <div className="flex items-center gap-4 border border-ok-line bg-[#0e1a10] px-5 py-3.5">
        <div className="sc text-[16px] tracking-[.14em] text-ok">OK</div>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-4 border border-alert-line bg-alert-bg px-5 py-3.5">
      <div className="sc text-[16px] tracking-[.14em] text-alert">{lowLabel}</div>
      <div className="h-[34px] w-px bg-alert-line" />
      <div className="flex items-baseline gap-2">
        <span className="text-[40px] leading-none text-alert-soft">−{missing}</span>
        <span className="lbl" style={{ color: "#d7b5a8" }}>
          {missingLabel}
        </span>
      </div>
    </div>
  );
}

// ---------- En-têtes ----------
export function PageHeader({ eyebrow, title, back, children }) {
  return (
    <div className="flex flex-col gap-4">
      {back && (
        <Link to={back.to} className="w-fit text-[17px] no-underline">
          ← {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          {eyebrow && <div className="eyebrow">{eyebrow}</div>}
          <h1 className="sc m-0 mt-1.5 text-[30px] leading-none text-cream sm:text-[36px]">{title}</h1>
        </div>
        {children}
      </div>
    </div>
  );
}

// ---------- Saisie ----------
/** Champ numérique avec boutons − / +, pour tester les calculs. */
export function Stepper({ value, onChange, label, small = false }) {
  const height = small ? "h-9" : "h-11";
  return (
    <div className="inline-flex items-stretch" role="group" aria-label={label}>
      <button
        type="button"
        aria-label={`${label} : retirer 1`}
        className={`${height} w-9 cursor-pointer border border-line bg-panel2 text-[20px] text-gold-light hover:text-cream`}
        onClick={() => onChange(value - 1)}
      >
        −
      </button>
      <input
        aria-label={label}
        inputMode="numeric"
        className={`${height} w-16 border-y border-line bg-ink text-center text-[18px] text-parch tabular-nums`}
        value={value}
        onChange={(event) => onChange(event.target.value.replace(/\D/g, ""))}
      />
      <button
        type="button"
        aria-label={`${label} : ajouter 1`}
        className={`${height} w-9 cursor-pointer border border-line bg-panel2 text-[20px] text-gold-light hover:text-cream`}
        onClick={() => onChange(value + 1)}
      >
        +
      </button>
    </div>
  );
}

export function SampleNote() {
  return <div className="text-[14px] text-faint">Quantités d'exemple : rien n'est relié à la vraie base ni à Square.</div>;
}

/** Libellé lisible d'un type de produit. */
export function typeLabel(product, inKit) {
  switch (product.type) {
    case "paquet":
      return "Paquet de 2";
    case "ensemble":
      return "Ensemble";
    case "outil":
      return "Outil au choix";
    default:
      return inKit ? "Pièce du kit" : "Pièce";
  }
}

/** « paquets » partout où un paquet est compté. */
export function unitFor(product, count) {
  if (product?.type === "paquet") return count === 1 ? "paquet" : "paquets";
  if (product?.type === "ensemble") return count === 1 ? "ensemble" : "ensembles";
  return null;
}

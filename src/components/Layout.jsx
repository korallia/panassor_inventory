import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";

import { useInventory } from "../store.jsx";

const sections = [
  { to: "/inventaire", label: "Inventaire" },
  { to: "/kits", label: "Kits" },
  { to: "/minimums", label: "Minimums" },
  { to: "/alertes", label: "Alertes et rapports" },
  { to: "/catalogue", label: "Catalogue" },
  { to: "/parametres", label: "Paramètres" },
];

function linkClass({ isActive }) {
  const base = "block px-3.5 py-3 text-[19px] no-underline border whitespace-nowrap";
  return isActive
    ? `${base} bg-gold/12 border-gold text-cream!`
    : `${base} border-transparent text-muted! hover:text-cream!`;
}

// Connexion en 2 étapes : courriel + mot de passe, puis code reçu par courriel.
function Login() {
  const { requestCode, verifyCode } = useInventory();
  const [step, setStep] = useState("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [remember, setRemember] = useState(true);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submitEmail(event) {
    event.preventDefault();
    setBusy(true);
    const result = await requestCode(email, password);
    setBusy(false);
    if (!result.ok) return setMessage(result.error);
    if (result.trusted) return;
    setMessage("");
    setCode("");
    setPassword("");
    setStep("code");
  }

  async function submitCode(event) {
    event.preventDefault();
    setBusy(true);
    const result = await verifyCode(code, remember);
    setBusy(false);
    if (!result.ok) setMessage(result.error);
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <form
        onSubmit={step === "email" ? submitEmail : submitCode}
        className="flex w-full max-w-[380px] flex-col gap-4 border border-gold/70 bg-panel px-7 py-8"
      >
        <div className="font-sc text-[30px] text-cream">Panassor</div>
        <div className="sc -mt-3 text-[12px] tracking-[.24em] text-gold">Atelier · inventaire</div>

        {step === "email" ? (
          <>
            <label className="flex flex-col gap-1.5">
              <span className="lbl">Courriel</span>
              <input className="field" type="email" autoComplete="email" autoFocus required value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="lbl">Mot de passe</span>
              <input className="field" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
            </label>
          </>
        ) : (
          <>
            <div className="text-[15px] leading-snug text-muted">
              Un code vient d'être envoyé à <span className="text-cream">{email}</span>.
            </div>
            <label className="flex flex-col gap-1.5">
              <span className="lbl">Code à 6 chiffres</span>
              <input
                className="field tracking-[.3em]"
                inputMode="numeric"
                autoComplete="one-time-code"
                autoFocus
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              />
            </label>
            <label className="flex items-center gap-2 text-[15px] text-muted">
              <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
              Se souvenir de cet appareil (90 jours)
            </label>
          </>
        )}

        {message && <div className="text-[15px] text-alert">{message}</div>}

        <button type="submit" className="btn-primary" disabled={busy}>
          {step === "email" ? "Recevoir un code" : "Entrer"}
        </button>

        {step === "code" && (
          <button
            type="button"
            className="btn-ghost"
            onClick={() => {
              setStep("email");
              setMessage("");
            }}
          >
            Recommencer
          </button>
        )}
      </form>
    </div>
  );
}

// Petite flèche circulaire à côté du titre : recharge la page, comme F5.
function ReloadButton() {
  return (
    <button
      type="button"
      onClick={() => window.location.reload()}
      title="Recharger la page"
      aria-label="Recharger la page"
      className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center text-gold transition hover:text-cream"
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M20 12a8 8 0 1 1-2.34-5.66" />
        <path d="M20 4v5h-5" />
      </svg>
    </button>
  );
}

export default function Layout() {
  const { dispatch, status, source, reload, user, logout } = useInventory();
  if (status === "chargement") {
    return <div className="flex min-h-screen items-center justify-center text-[18px] text-muted2">Lecture des données…</div>;
  }
  if (status === "connexion") return <Login />;

  return (
    <div className="min-h-screen lg:flex">
      <nav
        aria-label="Sections"
        className="flex flex-col gap-1.5 border-b border-line bg-panel px-4 py-5 lg:sticky lg:top-0 lg:h-screen lg:w-60 lg:shrink-0 lg:border-b-0 lg:border-r lg:px-6 lg:py-8"
      >
        {/* La flèche suit le mot « Panassor », sur la même ligne. */}
        <div className="flex items-center gap-2">
          <div className="font-sc text-[28px] leading-none text-cream">Panassor</div>
          <ReloadButton />
        </div>
        <div className="sc text-[11px] tracking-[.24em] text-gold">Atelier · inventaire</div>
        {/* Courriel sur 2 lignes (le nom, puis @domaine) pour ne pas être coupé. */}
        {/* Ligne d'or au-dessus du courriel (la même qu'en dessous). */}
        {user && <div className="mt-4 h-px w-full bg-gold/50 lg:mt-5" />}
        {user && (
          <div className="mt-4 font-sc text-[15px] leading-snug text-cream [overflow-wrap:anywhere] lg:mt-5">
            {user.split("@")[0]}
            <br />@{user.split("@")[1]}
          </div>
        )}
        {/* Petite ligne d'or entre le titre et le menu. */}
        <div className="mb-3 mt-4 h-px w-full bg-gold/50 lg:mb-6 lg:mt-5" />
        {/* Sur ordi, l'espace entre les sections grandit avec la hauteur de l'écran (sans exagérer). */}
        <div className="-mx-1 flex gap-1 overflow-x-auto lg:mx-0 lg:flex-col lg:gap-[clamp(4px,2.6vh,30px)] lg:overflow-visible">
          {sections.map((section) => (
            <NavLink key={section.to} to={section.to} className={linkClass}>
              {section.label}
            </NavLink>
          ))}
        </div>
        {/* Petite ligne d'or à la fin du menu. */}
        <div className="mt-3 h-px w-full bg-gold/50 lg:mt-6" />
        <div className="mt-auto hidden pt-8 lg:block">
          {source === "live" ? (
            <>
              <div className="text-[14px] leading-snug text-faint">Vraies données, lecture seule. Le stock se change dans Square.</div>
              <button type="button" className="btn-ghost mt-3 w-full" onClick={logout}>
                Se déconnecter
              </button>
            </>
          ) : (
            <>
              <div className="text-[14px] leading-snug text-faint">
                Données d'exemple. Les changements restent dans cette page et disparaissent au rechargement.
              </div>
              <button type="button" className="btn-ghost mt-3 w-full" onClick={() => dispatch({ type: "reset" })}>
                Réinitialiser
              </button>
            </>
          )}
        </div>
      </nav>

      <main className="min-w-0 flex-1 px-4 py-6 sm:px-8 lg:px-12 lg:py-9">
        <Outlet />
      </main>
    </div>
  );
}

import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";

import { useInventory } from "../store.jsx";

const sections = [
  { to: "/inventaire", label: "Inventaire" },
  { to: "/kits", label: "Kits" },
  { to: "/minimums", label: "Minimums" },
  { to: "/alertes", label: "Alertes et rapports" },
  { to: "/catalogue", label: "Catalogue" },
];

function linkClass({ isActive }) {
  const base = "block px-3.5 py-3 text-[19px] no-underline border whitespace-nowrap";
  return isActive
    ? `${base} bg-gold/12 border-gold text-cream!`
    : `${base} border-transparent text-muted! hover:text-cream!`;
}

function Login() {
  const { login } = useInventory();
  const [password, setPassword] = useState("");
  const [failed, setFailed] = useState(false);
  async function submit(event) {
    event.preventDefault();
    setFailed(!(await login(password)));
  }
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <form onSubmit={submit} className="flex w-full max-w-[380px] flex-col gap-4 border border-gold/70 bg-panel px-7 py-8">
        <div className="font-sc text-[30px] text-cream">Panassor</div>
        <div className="sc -mt-3 text-[12px] tracking-[.24em] text-gold">Atelier · inventaire</div>
        <label className="flex flex-col gap-1.5">
          <span className="lbl">Mot de passe</span>
          <input className="field" type="password" autoFocus value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        {failed && <div className="text-[15px] text-alert">Mot de passe invalide.</div>}
        <button type="submit" className="btn-primary">
          Entrer
        </button>
      </form>
    </div>
  );
}

export default function Layout() {
  const { dispatch, status, source, reload } = useInventory();
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
        <div className="font-sc text-[28px] text-cream">Panassor</div>
        <div className="sc mb-3 text-[11px] tracking-[.24em] text-gold lg:mb-7">Atelier · inventaire</div>
        <div className="-mx-1 flex gap-1 overflow-x-auto lg:mx-0 lg:flex-col lg:overflow-visible">
          {sections.map((section) => (
            <NavLink key={section.to} to={section.to} className={linkClass}>
              {section.label}
            </NavLink>
          ))}
        </div>
        <div className="mt-auto hidden pt-8 lg:block">
          {source === "live" ? (
            <>
              <div className="text-[14px] leading-snug text-faint">Vraies données, lecture seule. Le stock se change dans Square.</div>
              <button type="button" className="btn-ghost mt-3 w-full" onClick={reload}>
                Relire les données
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

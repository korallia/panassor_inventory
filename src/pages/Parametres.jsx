// Paramètres du compte : changer son mot de passe ou son courriel.
// Ajouter ou retirer quelqu'un se fait encore dans la base (script).
import { useState } from "react";

import { useInventory } from "../store.jsx";
import { PageHeader } from "../components/ui.jsx";

async function post(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  return response.ok ? { ok: true, ...data } : { ok: false, error: data.error || "Erreur." };
}

function Section({ title, children }) {
  return (
    <section className="flex flex-col gap-4 border border-line/50 bg-panel/60 px-6 py-5">
      <div className="sc text-[14px] tracking-[.18em] text-gold">{title}</div>
      {children}
    </section>
  );
}

function Field({ label, ...props }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="lbl">{label}</span>
      <input className="field" {...props} />
    </label>
  );
}

function Feedback({ result }) {
  if (!result) return null;
  return <div className={`text-[15px] ${result.ok ? "text-cream" : "text-alert"}`}>{result.ok ? result.message : result.error}</div>;
}

function PasswordSection() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [result, setResult] = useState(null);

  async function submit(event) {
    event.preventDefault();
    if (next !== confirm) return setResult({ ok: false, error: "Les deux nouveaux mots de passe ne sont pas pareils." });
    const answer = await post("/api/compte/mot-de-passe", { current, next });
    setResult(answer.ok ? { ok: true, message: "Mot de passe changé." } : answer);
    if (answer.ok) {
      setCurrent("");
      setNext("");
      setConfirm("");
    }
  }

  return (
    <Section title="Mot de passe">
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field label="Mot de passe actuel" type="password" autoComplete="current-password" required value={current} onChange={(e) => setCurrent(e.target.value)} />
        <Field label="Nouveau mot de passe (12 caractères minimum)" type="password" autoComplete="new-password" minLength={12} required value={next} onChange={(e) => setNext(e.target.value)} />
        <Field label="Encore une fois" type="password" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        <Feedback result={result} />
        <button type="submit" className="btn-primary self-start">Changer le mot de passe</button>
      </form>
    </Section>
  );
}

function EmailSection() {
  const { user, reload } = useInventory();
  const [step, setStep] = useState("form");
  const [newEmail, setNewEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [result, setResult] = useState(null);

  async function sendCode(event) {
    event.preventDefault();
    const answer = await post("/api/compte/courriel", { newEmail, password });
    if (!answer.ok) return setResult(answer);
    setResult(null);
    setPassword("");
    setStep("code");
  }

  async function confirmCode(event) {
    event.preventDefault();
    const answer = await post("/api/compte/courriel/confirmer", { code });
    if (!answer.ok) return setResult(answer);
    setResult({ ok: true, message: `Ton courriel est maintenant ${answer.email}.` });
    setStep("form");
    setNewEmail("");
    setCode("");
    reload();
  }

  return (
    <Section title="Courriel">
      <div className="text-[16px] text-muted">
        Courriel actuel : <span className="text-cream">{user}</span>
      </div>
      {step === "form" ? (
        <form onSubmit={sendCode} className="flex flex-col gap-4">
          <Field label="Nouveau courriel" type="email" required value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
          <Field label="Mot de passe" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          <Feedback result={result} />
          <button type="submit" className="btn-primary self-start">Recevoir un code</button>
        </form>
      ) : (
        <form onSubmit={confirmCode} className="flex flex-col gap-4">
          <div className="text-[15px] text-muted">
            Un code vient d'être envoyé à <span className="text-cream">{newEmail}</span>.
          </div>
          <Field
            label="Code à 6 chiffres"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          />
          <Feedback result={result} />
          <div className="flex gap-3">
            <button type="submit" className="btn-primary">Confirmer</button>
            <button type="button" className="btn-ghost" onClick={() => { setStep("form"); setResult(null); }}>
              Annuler
            </button>
          </div>
        </form>
      )}
    </Section>
  );
}

export default function Parametres() {
  return (
    <div className="flex flex-col gap-8">
      <PageHeader eyebrow="Mon compte" title="Paramètres" />
      <div className="mx-auto flex w-full max-w-[560px] flex-col gap-8">
        <EmailSection />
        <PasswordSection />
      </div>
    </div>
  );
}

"use client";

import { FormEvent, useState } from "react";
import type { Member } from "@/lib/domain";

export function EmailGate({ onRecognised, hasMembers }: { onRecognised: (member: Member) => void; hasMembers: boolean }) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true); setError("");
    const response = await fetch("/api/session", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email }) });
    const data = await response.json();
    setBusy(false);
    if (!response.ok) setError(data.error);
    else onRecognised(data.member);
  }

  return (
    <main className="gate-shell">
      <section className="gate-card">
        <div className="brand-mark" aria-hidden="true">TH</div>
        <p className="eyebrow">Knotie × Hexai</p>
        <h1>When can we work together?</h1>
        <p className="gate-intro">A shared, voluntary view of availability, project time and leave—so people and agents can plan the right work at the right moment.</p>
        {hasMembers ? (
          <form onSubmit={submit} className="gate-form">
            <label htmlFor="team-email">Your team email</label>
            <div className="gate-row">
              <input id="team-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@company.com" required autoFocus />
              <button className="button primary" disabled={busy}>{busy ? "Checking…" : "Open calendar"}</button>
            </div>
            {error && <p className="form-error" role="alert">{error}</p>}
          </form>
        ) : (
          <div className="empty-setup"><strong>The calendar is ready.</strong><span>Add the first team member and project in Admin.</span></div>
        )}
        <p className="trust-note"><span aria-hidden="true">◌</span> No password for this pilot. Your email simply matches you to the team list.</p>
        <a className="text-link" href="/admin">Open admin setup →</a>
      </section>
      <aside className="gate-horizon" aria-hidden="true">
        <span className="sun sun-one" />
        <span className="sun sun-two" />
        <div className="horizon-line" />
        <p><strong>London</strong><span>09:00</span></p>
        <p><strong>Kolkata</strong><span>13:30</span></p>
      </aside>
    </main>
  );
}

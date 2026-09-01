"use client";

import type { Member } from "@/lib/domain";

type Next = { member: Member; startsAtUtc: string };

function People({ people, empty }: { people: Member[]; empty: string }) {
  if (!people.length) return <p className="card-empty">{empty}</p>;
  return <div className="avatar-list">{people.slice(0, 4).map((person) => <span className="person-chip" key={person.id}><b>{person.name.charAt(0)}</b>{person.name}</span>)}</div>;
}

export function SummaryCards({ availableNow, onLeave, needsUpdate, nextAvailable }: { availableNow: Member[]; onLeave: Member[]; needsUpdate: Member[]; nextAvailable: Next[] }) {
  return (
    <section className="summary-grid" aria-label="Team summary">
      <article className="summary-card accent-green"><div className="card-kicker"><span className="status-dot" /> Live</div><h2>Available now</h2><People people={availableNow} empty="No one has declared this moment." /></article>
      <article className="summary-card"><div className="card-kicker">Today</div><h2>On leave</h2><People people={onLeave} empty="No leave declared today." /></article>
      <article className="summary-card accent-coral"><div className="card-kicker">Next 7 days</div><h2>Needs an update</h2>{needsUpdate.length ? <div className="reminder-list">{needsUpdate.slice(0, 3).map((person) => <a key={person.id} href={`mailto:${person.email}?subject=Availability%20calendar&body=Hi%20${encodeURIComponent(person.name)},%20when%20you%20have%20a%20moment,%20could%20you%20add%20your%20upcoming%20availability%3F`}>{person.name}<span>Remind ↗</span></a>)}</div> : <p className="card-empty">Everyone has added an upcoming declaration.</p>}</article>
      <article className="summary-card"><div className="card-kicker">Upcoming</div><h2>Next up</h2>{nextAvailable[0] ? <p className="next-person"><strong>{nextAvailable[0].member.name}</strong><span>{new Date(nextAvailable[0].startsAtUtc).toLocaleString([], { weekday: "short", hour: "2-digit", minute: "2-digit" })}</span></p> : <p className="card-empty">No upcoming availability declared.</p>}</article>
    </section>
  );
}

"use client";

import type { Member } from "@/lib/domain";
import type { DisplayEntry } from "@/lib/repository";

function minutesInZone(iso: string, zone: string): number {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: zone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(iso));
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return Number(value.hour) * 60 + Number(value.minute);
}

export function TeamHorizon({ entries, members, zone }: { entries: DisplayEntry[]; members: Member[]; zone: string }) {
  const visible = entries.filter((entry) => entry.status === "available" || entry.status === "tentative");
  return (
    <section className="horizon-panel" aria-labelledby="horizon-title">
      <div className="section-heading"><div><p className="eyebrow">Today across the team</p><h2 id="horizon-title">Team horizon</h2></div><div className="zone-pair"><span>London</span><i /> <span>Kolkata +4½h</span></div></div>
      <div className="horizon-hours" aria-hidden="true">{[0,3,6,9,12,15,18,21,24].map((hour)=><span key={hour} style={{left:`${hour/24*100}%`}}>{hour===24?"24":String(hour).padStart(2,"0")}</span>)}</div>
      <div className="horizon-track">
        <div className="daylight daylight-uk" />
        {visible.map((entry) => {
          const start = minutesInZone(entry.startsAtUtc, zone);
          let end = minutesInZone(entry.endsAtUtc, zone);
          if (end <= start) end = 1440;
          return <div key={entry.id} className={`horizon-block ${entry.status}`} style={{ left: `${start/14.4}%`, width: `${Math.max(1,(end-start)/14.4)}%`, background: entry.projectColour ?? undefined }} title={`${entry.memberName}: ${entry.status}`}><span>{entry.memberName.split(" ")[0]}</span></div>;
        })}
        {!visible.length && <p className="horizon-empty">No availability has been declared for today yet.</p>}
      </div>
      <div className="horizon-people">{members.slice(0,8).map((member)=><span key={member.id}><b>{member.name.charAt(0)}</b>{member.name}<small>{new Intl.DateTimeFormat("en-GB",{timeZone:member.timezone,hour:"2-digit",minute:"2-digit"}).format(new Date())}</small></span>)}</div>
    </section>
  );
}

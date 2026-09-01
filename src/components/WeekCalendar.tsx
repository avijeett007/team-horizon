"use client";

import type { Member, Project } from "@/lib/domain";
import type { DisplayEntry } from "@/lib/repository";

function isoDate(date: Date) { return date.toISOString().slice(0,10); }
function displayDate(iso: string, zone: string) { return new Intl.DateTimeFormat("en-CA", { timeZone: zone, year:"numeric",month:"2-digit",day:"2-digit" }).format(new Date(iso)); }
function displayTime(iso: string, zone: string) { return new Intl.DateTimeFormat("en-GB", { timeZone: zone, hour:"2-digit",minute:"2-digit",hourCycle:"h23" }).format(new Date(iso)); }

export function WeekCalendar({ weekStart, members, entries, projects, zone, ownerId, onAdd, onDelete }: { weekStart: string; members: Member[]; entries: DisplayEntry[]; projects: Project[]; zone: string; ownerId: number; onAdd: (date:string)=>void; onDelete:(id:number)=>void }) {
  const start = new Date(`${weekStart}T12:00:00Z`);
  const days = Array.from({length:7},(_,index)=>{const date=new Date(start);date.setUTCDate(start.getUTCDate()+index);return isoDate(date);});
  const today = displayDate(new Date().toISOString(), zone);
  return (
    <div className="calendar-scroll">
      <div className="week-grid" role="grid" aria-label="Team week calendar">
        <div className="grid-corner"><span>Team</span><small>{zone.replace("_"," ")}</small></div>
        {days.map((day)=><div className={`day-head ${day===today?"today":""}`} key={day}><span>{new Date(`${day}T12:00:00`).toLocaleDateString([], {weekday:"short"})}</span><strong>{new Date(`${day}T12:00:00`).getDate()}</strong></div>)}
        {members.map((member)=><div className="week-row" key={member.id}>
          <div className="member-cell"><b>{member.name.charAt(0)}</b><span><strong>{member.name}</strong><small>{member.location} · {new Intl.DateTimeFormat("en-GB",{timeZone:member.timezone,hour:"2-digit",minute:"2-digit"}).format(new Date())}</small></span></div>
          {days.map((day)=>{
            const cellEntries=entries.filter((entry)=>entry.memberId===member.id && displayDate(entry.startsAtUtc,zone)===day);
            return <div className={`day-cell ${day===today?"today":""}`} key={day} onDoubleClick={()=>member.id===ownerId&&onAdd(day)}>
              {cellEntries.map((entry)=>{
                const project=projects.find((item)=>item.id===entry.projectId);
                const color=entry.status==="leave"?"#667085":project?.colour ?? (entry.status==="available"?"#4E9C81":"#E6A24A");
                return <div className={`entry-pill ${entry.status}`} key={entry.id} style={{"--entry-colour":color} as React.CSSProperties}><span className="entry-time">{displayTime(entry.startsAtUtc,zone)}–{displayTime(entry.endsAtUtc,zone)}</span><strong>{entry.status==="busy"?(project?.name??"Busy"):entry.status==="leave"?`${entry.leaveCertainty==="provisional"?"Possible ":""}Leave`:entry.status.charAt(0).toUpperCase()+entry.status.slice(1)}</strong>{entry.note&&<small>{entry.note}</small>}{entry.memberId===ownerId&&<button onClick={()=>onDelete(entry.id)} aria-label={`Remove ${entry.status} entry`}>×</button>}</div>;
              })}
              {member.id===ownerId&&<button className="cell-add" onClick={()=>onAdd(day)} aria-label={`Add time on ${day}`}>＋</button>}
            </div>;
          })}
        </div>)}
      </div>
    </div>
  );
}

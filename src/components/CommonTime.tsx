"use client";

import { useState } from "react";
import type { Member } from "@/lib/domain";
import type { CommonSlot } from "@/lib/common-time";

export function CommonTime({ members, weekStart, zone }: { members: Member[]; weekStart: string; zone: string }) {
  const [selected, setSelected] = useState<number[]>(members.slice(0,2).map((member)=>member.id));
  const [duration, setDuration] = useState(30);
  const [slots, setSlots] = useState<CommonSlot[]>([]);
  const [message, setMessage] = useState("");
  async function find() {
    setMessage("Looking across declarations…"); setSlots([]);
    const from = new Date(`${weekStart}T00:00:00Z`);
    const to = new Date(from); to.setUTCDate(to.getUTCDate()+7);
    const response = await fetch("/api/common-time",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({memberIds:selected,fromUtc:from.toISOString(),toUtc:to.toISOString(),minimumMinutes:duration})});
    const data=await response.json();
    if(!response.ok)setMessage(data.error);else{setSlots(data.slots);setMessage(data.slots.length?"":"No shared window is declared in this week.");}
  }
  return <aside className="common-panel"><header><p className="eyebrow">Overlap finder</p><h2>Find common time</h2><p>Select the people you need. Only their declared time is considered.</p></header><div className="people-checks">{members.map((member)=><label key={member.id} className={selected.includes(member.id)?"checked":""}><input type="checkbox" checked={selected.includes(member.id)} onChange={()=>setSelected((current)=>current.includes(member.id)?current.filter((id)=>id!==member.id):[...current,member.id])}/><b>{member.name.charAt(0)}</b>{member.name}</label>)}</div><label className="duration-select">Minimum duration<select value={duration} onChange={(e)=>setDuration(Number(e.target.value))}><option value={30}>30 minutes</option><option value={45}>45 minutes</option><option value={60}>1 hour</option><option value={90}>90 minutes</option><option value={120}>2 hours</option></select></label><button className="button dark" onClick={find} disabled={selected.length<2}>Find a window</button><div className="slot-list">{slots.slice(0,5).map((slot)=><div key={slot.startsAtUtc}><strong>{new Intl.DateTimeFormat("en-GB",{timeZone:zone,weekday:"short",day:"numeric",month:"short"}).format(new Date(slot.startsAtUtc))}</strong><span>{new Intl.DateTimeFormat("en-GB",{timeZone:zone,hour:"2-digit",minute:"2-digit"}).format(new Date(slot.startsAtUtc))}–{new Intl.DateTimeFormat("en-GB",{timeZone:zone,hour:"2-digit",minute:"2-digit"}).format(new Date(slot.endsAtUtc))}{slot.tentative?" · tentative":""}</span></div>)}{message&&<p>{message}</p>}</div></aside>;
}

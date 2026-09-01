"use client";

import { FormEvent, useState } from "react";
import type { Project } from "@/lib/domain";

type Range = { startTime: string; endTime: string };

export function EntryEditor({ date, projects, timezone, onClose, onSaved }: { date: string; projects: Project[]; timezone: string; onClose: () => void; onSaved: () => void }) {
  const [ranges, setRanges] = useState<Range[]>([{ startTime: "09:00", endTime: "17:00" }]);
  const [status, setStatus] = useState("available");
  const [projectId, setProjectId] = useState("");
  const [note, setNote] = useState("");
  const [repeat, setRepeat] = useState("none");
  const [until, setUntil] = useState(date);
  const [leaveCertainty, setLeaveCertainty] = useState("confirmed");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    for (const range of ranges) {
      const response = await fetch("/api/entries", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({
        date, ...range, timezone, status, projectId: projectId ? Number(projectId) : null, note: note || null,
        leaveCertainty: status === "leave" ? leaveCertainty : null,
        recurrence: repeat === "none" ? null : { frequency: repeat, until },
      }) });
      if (!response.ok) { const data = await response.json(); setError(data.error); setBusy(false); return; }
    }
    setBusy(false); onSaved();
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="entry-sheet" role="dialog" aria-modal="true" aria-labelledby="entry-title">
        <header><div><p className="eyebrow">Your declaration</p><h2 id="entry-title">Add time for {new Date(`${date}T12:00:00`).toLocaleDateString([], { weekday: "long", day: "numeric", month: "long" })}</h2></div><button className="icon-button" onClick={onClose} aria-label="Close">×</button></header>
        <form onSubmit={submit}>
          <fieldset className="segment-control"><legend>What kind of time is this?</legend>{[["available","Available"],["tentative","Tentative"],["busy","Project / busy"],["leave","Leave"]].map(([value,label]) => <label key={value} className={status === value ? "selected" : ""}><input type="radio" name="status" value={value} checked={status===value} onChange={() => setStatus(value)} />{label}</label>)}</fieldset>
          <div className="time-ranges">{ranges.map((range, index) => <div className="time-row" key={index}><label>Start time<input type="time" value={range.startTime} onChange={(e) => setRanges((all) => all.map((item,i) => i===index ? {...item,startTime:e.target.value}:item))} /></label><span>to</span><label>End time<input type="time" value={range.endTime} onChange={(e) => setRanges((all) => all.map((item,i) => i===index ? {...item,endTime:e.target.value}:item))} /></label>{ranges.length>1 && <button type="button" className="remove-range" onClick={() => setRanges((all)=>all.filter((_,i)=>i!==index))} aria-label={`Remove time ${index+1}`}>×</button>}</div>)}</div>
          <button type="button" className="add-time" onClick={() => setRanges((all) => [...all, { startTime: "", endTime: "" }])}>＋ Add another time</button>
          <div className="form-grid">
            <label>Project<select value={projectId} onChange={(e)=>setProjectId(e.target.value)}><option value="">No project</option>{projects.map((project)=><option key={project.id} value={project.id}>{project.name}</option>)}</select></label>
            <label>Repeat<select value={repeat} onChange={(e)=>setRepeat(e.target.value)}><option value="none">Does not repeat</option><option value="weekdays">Every weekday</option><option value="weekly">Weekly</option></select></label>
            {repeat !== "none" && <label>Repeat until<input type="date" min={date} value={until} onChange={(e)=>setUntil(e.target.value)} /></label>}
            {status === "leave" && <label>Leave status<select value={leaveCertainty} onChange={(e)=>setLeaveCertainty(e.target.value)}><option value="confirmed">Confirmed</option><option value="provisional">Provisional</option></select></label>}
          </div>
          <label>Note <span className="optional">optional</span><textarea value={note} onChange={(e)=>setNote(e.target.value)} placeholder="Anything useful for the team" maxLength={240} /></label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <footer><span className="timezone-note">Saved in {timezone.replace("_"," ")}</span><div><button type="button" className="button ghost" onClick={onClose}>Cancel</button><button className="button primary" disabled={busy}>{busy ? "Saving…" : "Save time"}</button></div></footer>
        </form>
      </section>
    </div>
  );
}

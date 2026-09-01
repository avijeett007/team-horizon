"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Member, Project, Venture } from "@/lib/domain";
import type { DashboardSummary } from "@/lib/dashboard";
import type { DisplayEntry } from "@/lib/repository";
import { CommonTime } from "./CommonTime";
import { EmailGate } from "./EmailGate";
import { EntryEditor } from "./EntryEditor";
import { SummaryCards } from "./SummaryCards";
import { TeamHorizon } from "./TeamHorizon";
import { WeekCalendar } from "./WeekCalendar";

type Bootstrap = { members: Member[]; ventures: Venture[]; projects: Project[]; sessionMember: Member | null; admin: boolean };

function monday(date = new Date()): string {
  const copy = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = copy.getUTCDay() || 7;
  copy.setUTCDate(copy.getUTCDate() - day + 1);
  return copy.toISOString().slice(0, 10);
}

function shiftWeek(day: string, amount: number): string {
  const date = new Date(`${day}T12:00:00Z`); date.setUTCDate(date.getUTCDate() + amount * 7); return date.toISOString().slice(0,10);
}

export function CalendarApp() {
  const [bootstrap, setBootstrap] = useState<Bootstrap | null>(null);
  const [entries, setEntries] = useState<DisplayEntry[]>([]);
  const [dashboard, setDashboard] = useState<DashboardSummary | null>(null);
  const [weekStart, setWeekStart] = useState(monday());
  const [zone, setZone] = useState("Europe/London");
  const [editorDate, setEditorDate] = useState<string | null>(null);
  const [ventureFilter, setVentureFilter] = useState("");
  const [projectFilter, setProjectFilter] = useState("");
  const [personFilter, setPersonFilter] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const refreshBootstrap = useCallback(async () => {
    const response = await fetch("/api/bootstrap", { cache: "no-store" });
    const data = await response.json(); setBootstrap(data); setLoading(false);
    if (data.sessionMember && zone === "Europe/London" && data.sessionMember.timezone) setZone(data.sessionMember.timezone);
  }, []);

  const refreshCalendar = useCallback(async () => {
    if (!bootstrap?.sessionMember) return;
    setError("");
    const from = new Date(`${weekStart}T00:00:00Z`); from.setUTCDate(from.getUTCDate()-1);
    const to = new Date(from); to.setUTCDate(to.getUTCDate()+9);
    const [entryResponse, dashboardResponse] = await Promise.all([
      fetch(`/api/entries?from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`, { cache: "no-store" }),
      fetch(`/api/dashboard?zone=${encodeURIComponent(zone)}`, { cache: "no-store" }),
    ]);
    const entryData=await entryResponse.json(); const dashboardData=await dashboardResponse.json();
    if (!entryResponse.ok) setError(entryData.error); else setEntries(entryData.entries);
    if (dashboardResponse.ok) setDashboard(dashboardData);
  }, [bootstrap?.sessionMember, weekStart, zone]);

  useEffect(()=>{ refreshBootstrap(); },[refreshBootstrap]);
  useEffect(()=>{ refreshCalendar(); },[refreshCalendar]);

  const filteredMembers = useMemo(() => (bootstrap?.members ?? []).filter((member) =>
    (!personFilter || member.id === Number(personFilter))
    && (!locationFilter || member.location === locationFilter)
    && (!ventureFilter || member.ventureIds.includes(Number(ventureFilter)))
  ), [bootstrap?.members, personFilter, locationFilter, ventureFilter]);
  const filteredEntries = useMemo(() => entries.filter((entry) =>
    filteredMembers.some((member)=>member.id===entry.memberId)
    && (!projectFilter || entry.projectId === Number(projectFilter))
    && (!statusFilter || entry.status === statusFilter)
  ), [entries, filteredMembers, projectFilter, statusFilter]);

  if (loading) return <main className="loading-screen"><div className="brand-mark">TH</div><p>Opening the team horizon…</p></main>;
  if (!bootstrap?.sessionMember) return <EmailGate hasMembers={Boolean(bootstrap?.members.length)} onRecognised={() => refreshBootstrap()} />;

  async function removeEntry(id: number) {
    const response = await fetch(`/api/entries/${id}`, { method: "DELETE" });
    if (response.ok) refreshCalendar();
  }

  async function switchMember() {
    await fetch("/api/session", { method: "DELETE" });
    setBootstrap((current)=>current?{...current,sessionMember:null}:current);
  }

  const locations=[...new Set(bootstrap.members.map((member)=>member.location))].sort();
  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="wordmark" href="/"><span>TH</span><div><strong>Team Horizon</strong><small>Knotie × Hexai</small></div></a>
        <nav><a href="#calendar">Calendar</a><a href="#common">Common time</a><a href="/admin">Admin</a></nav>
        <button className="identity" onClick={switchMember}><b>{bootstrap.sessionMember.name.charAt(0)}</b><span><strong>{bootstrap.sessionMember.name}</strong><small>Switch person</small></span></button>
      </header>
      <div className="page-wrap">
        <section className="welcome-row"><div><p className="eyebrow">Shared planning, not tracking</p><h1>Good {new Date().getHours()<12?"morning":new Date().getHours()<18?"afternoon":"evening"}, {bootstrap.sessionMember.name.split(" ")[0]}.</h1><p>Here’s what the team has chosen to share.</p></div><div className="date-panel"><span>{new Intl.DateTimeFormat("en-GB",{weekday:"long",timeZone:zone}).format(new Date())}</span><strong>{new Intl.DateTimeFormat("en-GB",{day:"2-digit",month:"long",timeZone:zone}).format(new Date())}</strong><small>{zone.replace("_"," ")}</small></div></section>
        <TeamHorizon entries={dashboard?.horizon ?? []} members={bootstrap.members} zone={zone} />
        <SummaryCards availableNow={dashboard?.availableNow ?? []} onLeave={dashboard?.onLeaveToday ?? []} needsUpdate={dashboard?.needsUpdate ?? []} nextAvailable={dashboard?.nextAvailable ?? []} />
        <section className="calendar-section" id="calendar">
          <div className="calendar-title"><div><p className="eyebrow">Everyone’s declarations</p><h2>Week of {new Date(`${weekStart}T12:00:00`).toLocaleDateString([],{day:"numeric",month:"long"})}</h2></div><div className="week-controls"><button className="icon-button" onClick={()=>setWeekStart(shiftWeek(weekStart,-1))} aria-label="Previous week">←</button><button className="button ghost" onClick={()=>setWeekStart(monday())}>This week</button><button className="icon-button" onClick={()=>setWeekStart(shiftWeek(weekStart,1))} aria-label="Next week">→</button></div></div>
          <div className="filter-bar">
            <label>Venture<select value={ventureFilter} onChange={(e)=>setVentureFilter(e.target.value)}><option value="">All ventures</option>{bootstrap.ventures.map((venture)=><option key={venture.id} value={venture.id}>{venture.name}</option>)}</select></label>
            <label>Project<select value={projectFilter} onChange={(e)=>setProjectFilter(e.target.value)}><option value="">All projects</option>{bootstrap.projects.map((project)=><option key={project.id} value={project.id}>{project.name}</option>)}</select></label>
            <label>Person<select value={personFilter} onChange={(e)=>setPersonFilter(e.target.value)}><option value="">Everyone</option>{bootstrap.members.map((member)=><option key={member.id} value={member.id}>{member.name}</option>)}</select></label>
            <label>Location<select value={locationFilter} onChange={(e)=>setLocationFilter(e.target.value)}><option value="">All locations</option>{locations.map((location)=><option key={location}>{location}</option>)}</select></label>
            <label>Status<select value={statusFilter} onChange={(e)=>setStatusFilter(e.target.value)}><option value="">All types</option><option value="available">Available</option><option value="tentative">Tentative</option><option value="busy">Project / busy</option><option value="leave">Leave</option></select></label>
            <label>Shown in<select value={zone} onChange={(e)=>setZone(e.target.value)}><option value={bootstrap.sessionMember.timezone}>My local time</option><option value="Europe/London">UK time</option><option value="Asia/Kolkata">India time</option></select></label>
          </div>
          {error&&<p className="service-error" role="alert">{error}</p>}
          <WeekCalendar weekStart={weekStart} members={filteredMembers} entries={filteredEntries} projects={bootstrap.projects} zone={zone} ownerId={bootstrap.sessionMember.id} onAdd={setEditorDate} onDelete={removeEntry} />
          <p className="calendar-hint">Select ＋ on your row to add time. You can remove only your own entries.</p>
        </section>
        <section id="common" className="common-section"><div className="common-copy"><p className="eyebrow">Plan the next conversation</p><h2>Stop doing time-zone maths.</h2><p>Choose the people you need and Team Horizon will find where their declared availability overlaps. Empty calendars are never treated as free time.</p><div className="zone-clocks"><span><small>London</small><strong>{new Intl.DateTimeFormat("en-GB",{timeZone:"Europe/London",hour:"2-digit",minute:"2-digit"}).format(new Date())}</strong></span><i>↔</i><span><small>Kolkata</small><strong>{new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Kolkata",hour:"2-digit",minute:"2-digit"}).format(new Date())}</strong></span></div></div><CommonTime members={bootstrap.members} weekStart={weekStart} zone={zone} /></section>
        <footer className="site-footer"><span>Team Horizon · voluntary availability for Knotie and Hexai</span><span>No activity monitoring. No attendance scoring.</span></footer>
      </div>
      {editorDate&&<EntryEditor date={editorDate} projects={bootstrap.projects.filter((project)=>bootstrap.sessionMember!.projectIds.includes(project.id))} timezone={bootstrap.sessionMember.timezone} onClose={()=>setEditorDate(null)} onSaved={()=>{setEditorDate(null);refreshCalendar();}} />}
    </main>
  );
}

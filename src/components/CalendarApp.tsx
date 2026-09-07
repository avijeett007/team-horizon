"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Member, Project, Venture } from "@/lib/domain";
import type { DashboardSummary } from "@/lib/dashboard";
import type { DisplayEntry } from "@/lib/repository";
import type { WeeklyStatus } from "@/lib/weekly-ledger";
import { CommonTime } from "./CommonTime";
import { EmailGate } from "./EmailGate";
import { EntryEditor } from "./EntryEditor";
import { SummaryCards } from "./SummaryCards";
import { TeamHorizon } from "./TeamHorizon";
import { WeekCalendar } from "./WeekCalendar";
import { WeeklyProgress } from "./WeeklyProgress";

type Bootstrap = {
  members: Member[];
  ventures: Venture[];
  projects: Project[];
  selectableProjects: Project[];
  selectedProject: Project | null;
  sessionMember: Member | null;
  admin: boolean;
  hasMembers: boolean;
};

function monday(date = new Date()): string {
  const copy = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = copy.getUTCDay() || 7;
  copy.setUTCDate(copy.getUTCDate() - day + 1);
  return copy.toISOString().slice(0, 10);
}

function shiftWeek(day: string, amount: number): string {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount * 7);
  return date.toISOString().slice(0, 10);
}

export function CalendarApp() {
  const [bootstrap, setBootstrap] = useState<Bootstrap | null>(null);
  const [entries, setEntries] = useState<DisplayEntry[]>([]);
  const [dashboard, setDashboard] = useState<DashboardSummary | null>(null);
  const [weeklyStatus, setWeeklyStatus] = useState<WeeklyStatus | null>(null);
  const [weekStart, setWeekStart] = useState(monday());
  const [zone, setZone] = useState("Europe/London");
  const [editorDate, setEditorDate] = useState<string | null>(null);
  const [projectId, setProjectId] = useState("");
  const [ventureFilter, setVentureFilter] = useState("");
  const [personFilter, setPersonFilter] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [error, setError] = useState("");
  const [accessError, setAccessError] = useState("");
  const [loading, setLoading] = useState(true);

  const refreshBootstrap = useCallback(async (requestedProjectId?: string) => {
    const query = requestedProjectId ? `?projectId=${encodeURIComponent(requestedProjectId)}` : "";
    const response = await fetch(`/api/bootstrap${query}`, { cache: "no-store" });
    const data = await response.json();
    setLoading(false);
    if (!response.ok) {
      setAccessError(data.error ?? "This project is not available");
      return;
    }
    setAccessError("");
    setBootstrap(data);
    if (data.selectedProject) setProjectId(String(data.selectedProject.id));
    if (data.sessionMember?.timezone) setZone((current) => current === "Europe/London" ? data.sessionMember.timezone : current);
  }, []);

  const refreshCalendar = useCallback(async () => {
    if (!bootstrap?.sessionMember || !projectId) return;
    setError("");
    const from = new Date(`${weekStart}T00:00:00Z`);
    from.setUTCDate(from.getUTCDate() - 1);
    const to = new Date(from);
    to.setUTCDate(to.getUTCDate() + 9);
    const scope = `projectId=${encodeURIComponent(projectId)}`;
    const [entryResponse, dashboardResponse, statusResponse] = await Promise.all([
      fetch(`/api/entries?${scope}&from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`, { cache: "no-store" }),
      fetch(`/api/dashboard?${scope}&zone=${encodeURIComponent(zone)}`, { cache: "no-store" }),
      fetch(`/api/weekly-status?week=${encodeURIComponent(weekStart)}`, { cache: "no-store" }),
    ]);
    const [entryData, dashboardData, statusData] = await Promise.all([entryResponse.json(), dashboardResponse.json(), statusResponse.json()]);
    if (!entryResponse.ok) setError(entryData.error); else setEntries(entryData.entries);
    if (dashboardResponse.ok) setDashboard(dashboardData);
    if (statusResponse.ok) setWeeklyStatus(statusData.status);
  }, [bootstrap?.sessionMember, projectId, weekStart, zone]);

  useEffect(() => { refreshBootstrap(); }, [refreshBootstrap]);
  useEffect(() => { refreshCalendar(); }, [refreshCalendar]);

  const filteredMembers = useMemo(() => (bootstrap?.members ?? []).filter((member) =>
    (!personFilter || member.id === Number(personFilter))
    && (!locationFilter || member.location === locationFilter)
    && (!ventureFilter || member.ventureIds.includes(Number(ventureFilter)))
  ), [bootstrap?.members, personFilter, locationFilter, ventureFilter]);
  const filteredEntries = useMemo(() => entries.filter((entry) =>
    filteredMembers.some((member) => member.id === entry.memberId)
    && (!statusFilter || entry.status === statusFilter)
  ), [entries, filteredMembers, statusFilter]);

  if (loading) return <main className="loading-screen"><div className="brand-mark">TH</div><p>Opening the team horizon…</p></main>;
  if (accessError) return <main className="loading-screen access-message"><div className="brand-mark">TH</div><h1>Project needed</h1><p>{accessError}</p><button className="button ghost" onClick={async () => { await fetch("/api/session", { method: "DELETE" }); setAccessError(""); setBootstrap(null); setLoading(true); refreshBootstrap(); }}>Use another email</button></main>;
  if (!bootstrap?.sessionMember) return <EmailGate hasMembers={Boolean(bootstrap?.hasMembers)} onRecognised={() => refreshBootstrap()} />;

  async function removeEntry(id: number) {
    const response = await fetch(`/api/entries/${id}`, { method: "DELETE" });
    if (response.ok) refreshCalendar();
  }

  async function switchMember() {
    await fetch("/api/session", { method: "DELETE" });
    setBootstrap((current) => current ? { ...current, sessionMember: null } : current);
  }

  async function switchProject(nextProjectId: string) {
    setProjectId(nextProjectId);
    setPersonFilter("");
    setLocationFilter("");
    setVentureFilter("");
    await refreshBootstrap(nextProjectId);
  }

  const locations = [...new Set(bootstrap.members.map((member) => member.location))].sort();
  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="wordmark" href="/"><span>TH</span><div><strong>Team Horizon</strong><small>Knotie × Hexai</small></div></a>
        <nav><a href="#calendar">Calendar</a><a href="#common">Common time</a><a href="/admin">Admin</a></nav>
        <button className="identity" onClick={switchMember}><b>{bootstrap.sessionMember.name.charAt(0)}</b><span><strong>{bootstrap.sessionMember.name}</strong><small>Switch person</small></span></button>
      </header>
      <div className="page-wrap">
        <section className="welcome-row"><div><p className="eyebrow">Shared planning, not tracking</p><h1>Good {new Date().getHours() < 12 ? "morning" : new Date().getHours() < 18 ? "afternoon" : "evening"}, {bootstrap.sessionMember.name.split(" ")[0]}.</h1><p>Here’s what the {bootstrap.selectedProject?.name} team has chosen to share.</p></div><div className="date-panel"><span>{new Intl.DateTimeFormat("en-GB", { weekday: "long", timeZone: zone }).format(new Date())}</span><strong>{new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "long", timeZone: zone }).format(new Date())}</strong><small>{zone.replace("_", " ")}</small></div></section>
        <TeamHorizon entries={dashboard?.horizon ?? []} members={bootstrap.members} zone={zone} />
        <SummaryCards availableNow={dashboard?.availableNow ?? []} onLeave={dashboard?.onLeaveToday ?? []} needsUpdate={dashboard?.needsUpdate ?? []} nextAvailable={dashboard?.nextAvailable ?? []} />
        <section className="calendar-section" id="calendar">
          <div className="calendar-title"><div><p className="eyebrow">Everyone’s declarations</p><h2>Week of {new Date(`${weekStart}T12:00:00`).toLocaleDateString([], { day: "numeric", month: "long" })}</h2></div><div className="calendar-actions">{weeklyStatus && <WeeklyProgress status={weeklyStatus} />}<div className="week-controls"><button className="icon-button" onClick={() => setWeekStart(shiftWeek(weekStart, -1))} aria-label="Previous week">←</button><button className="button ghost" onClick={() => setWeekStart(monday())}>This week</button><button className="icon-button" onClick={() => setWeekStart(shiftWeek(weekStart, 1))} aria-label="Next week">→</button></div></div></div>
          <div className="filter-bar">
            <label>Venture<select value={ventureFilter} onChange={(event) => setVentureFilter(event.target.value)}><option value="">All ventures</option>{bootstrap.ventures.map((venture) => <option key={venture.id} value={venture.id}>{venture.name}</option>)}</select></label>
            <label>Project<select aria-label="Project" value={projectId} onChange={(event) => switchProject(event.target.value)}>{bootstrap.selectableProjects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label>
            <label>Person<select value={personFilter} onChange={(event) => setPersonFilter(event.target.value)}><option value="">Everyone</option>{bootstrap.members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></label>
            <label>Location<select value={locationFilter} onChange={(event) => setLocationFilter(event.target.value)}><option value="">All locations</option>{locations.map((location) => <option key={location}>{location}</option>)}</select></label>
            <label>Status<select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="">All types</option><option value="available">Available</option><option value="tentative">Tentative</option><option value="busy">Project / busy</option><option value="leave">Leave</option></select></label>
            <label>Shown in<select value={zone} onChange={(event) => setZone(event.target.value)}><option value={bootstrap.sessionMember.timezone}>My local time</option><option value="Europe/London">UK time</option><option value="Asia/Kolkata">India time</option></select></label>
          </div>
          {error && <p className="service-error" role="alert">{error}</p>}
          <WeekCalendar weekStart={weekStart} members={filteredMembers} entries={filteredEntries} projects={bootstrap.selectableProjects} zone={zone} ownerId={bootstrap.sessionMember.id} onAdd={setEditorDate} onDelete={removeEntry} />
          <p className="calendar-hint">Select ＋ on your row to add time. You can remove only your own entries.</p>
        </section>
        <section id="common" className="common-section"><div className="common-copy"><p className="eyebrow">Plan the next conversation</p><h2>Stop doing time-zone maths.</h2><p>Choose the people you need and Team Horizon will find where their declared availability overlaps. Empty calendars are never treated as free time.</p><div className="zone-clocks"><span><small>London</small><strong>{new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit" }).format(new Date())}</strong></span><i>↔</i><span><small>Kolkata</small><strong>{new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit" }).format(new Date())}</strong></span></div></div><CommonTime key={projectId} projectId={Number(projectId)} members={bootstrap.members} weekStart={weekStart} zone={zone} /></section>
        <footer className="site-footer"><span>Team Horizon · voluntary availability for Knotie and Hexai</span><span>No activity monitoring. No attendance scoring.</span></footer>
      </div>
      {editorDate && weeklyStatus && <EntryEditor date={editorDate} projects={bootstrap.selectableProjects} timezone={bootstrap.sessionMember.timezone} weeklyStatus={weeklyStatus} onClose={() => setEditorDate(null)} onSaved={() => { setEditorDate(null); refreshCalendar(); }} />}
    </main>
  );
}

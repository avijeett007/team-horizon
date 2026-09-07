"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import type { Member, Project, Venture } from "@/lib/domain";
import type { WeeklyStatus } from "@/lib/weekly-ledger";

type AdminData = { members: Member[]; ventures: Venture[]; projects: Project[]; admin: boolean };

export function AdminLogin({ onUnlocked }: { onUnlocked: () => void }) {
  const [pin,setPin]=useState(""); const [error,setError]=useState(""); const [busy,setBusy]=useState(false);
  async function submit(event:FormEvent){event.preventDefault();setBusy(true);setError("");const response=await fetch("/api/admin/session",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({pin})});const data=await response.json();setBusy(false);if(!response.ok)setError(data.error);else onUnlocked();}
  return <main className="admin-login"><section><a className="wordmark" href="/"><span>TH</span><div><strong>Team Horizon</strong><small>Back to calendar</small></div></a><p className="eyebrow">Restricted setup</p><h1>Admin setup</h1><p>Add people and projects without creating an account system.</p><form onSubmit={submit}><label>Admin PIN<input type="password" inputMode="numeric" value={pin} onChange={(e)=>setPin(e.target.value)} autoFocus required /></label>{error&&<p className="form-error" role="alert">{error}</p>}<button className="button primary" disabled={busy}>{busy?"Checking…":"Open admin"}</button></form></section></main>;
}

export function MemberForm({ ventures, projects, onSaved }: { ventures: Venture[]; projects: Project[]; onSaved: () => void }) {
  const [form,setForm]=useState({name:"",email:"",location:"",timezone:"Europe/London",ventureIds:[] as number[],projectIds:[] as number[]});
  const [error,setError]=useState(""); const [busy,setBusy]=useState(false);
  const toggle=(key:"ventureIds"|"projectIds",id:number)=>setForm((current)=>({...current,[key]:current[key].includes(id)?current[key].filter((item)=>item!==id):[...current[key],id]}));
  async function submit(event:FormEvent){event.preventDefault();setBusy(true);setError("");const response=await fetch("/api/members",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(form)});const data=await response.json();setBusy(false);if(!response.ok)setError(data.error);else{setForm({name:"",email:"",location:"",timezone:"Europe/London",ventureIds:[],projectIds:[]});onSaved();}}
  return <form className="admin-form" onSubmit={submit}><div className="form-grid"><label>Name<input value={form.name} onChange={(e)=>setForm({...form,name:e.target.value})} required placeholder="Team member name" /></label><label>Email<input type="email" value={form.email} onChange={(e)=>setForm({...form,email:e.target.value})} required placeholder="name@company.com" /></label><label>Location<input value={form.location} onChange={(e)=>setForm({...form,location:e.target.value})} required placeholder="London or Bengaluru" /></label><label>Time zone<select value={form.timezone} onChange={(e)=>setForm({...form,timezone:e.target.value})}><option value="Europe/London">UK · London</option><option value="Asia/Kolkata">India · Kolkata</option></select></label></div><fieldset><legend>Ventures</legend><div className="admin-checks">{ventures.map((venture)=><label key={venture.id}><input aria-label={venture.name} type="checkbox" checked={form.ventureIds.includes(venture.id)} onChange={()=>toggle("ventureIds",venture.id)} /><span style={{background:venture.colour}} />{venture.name}</label>)}{!ventures.length&&<small>Add a venture first.</small>}</div></fieldset><fieldset><legend>Projects</legend><div className="admin-checks">{projects.filter((project)=>!form.ventureIds.length||form.ventureIds.includes(project.ventureId)).map((project)=><label key={project.id}><input aria-label={project.name} type="checkbox" checked={form.projectIds.includes(project.id)} onChange={()=>toggle("projectIds",project.id)} /><span style={{background:project.colour}} />{project.name}</label>)}{!projects.length&&<small>Add a project first.</small>}</div></fieldset>{error&&<p className="form-error" role="alert">{error}</p>}<button className="button primary" disabled={busy}>{busy?"Adding…":"Add team member"}</button></form>;
}

function VentureProjectForm({ ventures, onSaved }: { ventures: Venture[]; onSaved: () => void }) {
  const colours=["#466CFF","#F27D68","#4E9C81","#9B72CF","#E6A24A","#3C8DA8"];
  const [venture,setVenture]=useState({name:"",colour:colours[0]});
  const [project,setProject]=useState({name:"",colour:colours[1],ventureId:0});
  const [error,setError]=useState("");
  async function create(kind:"venture"|"project",event:FormEvent){event.preventDefault();setError("");const input=kind==="venture"?venture:{...project,ventureId:project.ventureId||ventures[0]?.id};const response=await fetch(`/api/${kind}s`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(input)});const data=await response.json();if(!response.ok)setError(data.error);else{kind==="venture"?setVenture({...venture,name:""}):setProject({...project,name:""});onSaved();}}
  const swatches=(selected:string,onChange:(colour:string)=>void)=><div className="swatches">{colours.map((colour)=><button type="button" key={colour} aria-label={`Use colour ${colour}`} className={selected===colour?"selected":""} style={{background:colour}} onClick={()=>onChange(colour)} />)}</div>;
  return <div className="reference-forms"><form className="admin-form mini" onSubmit={(event)=>create("venture",event)}><h3>Add a venture</h3><label>Venture name<input value={venture.name} onChange={(e)=>setVenture({...venture,name:e.target.value})} required placeholder="Knotie" /></label>{swatches(venture.colour,(colour)=>setVenture({...venture,colour}))}<button className="button ghost">Add venture</button></form><form className="admin-form mini" onSubmit={(event)=>create("project",event)}><h3>Add a project</h3><label>Venture<select value={project.ventureId} onChange={(e)=>setProject({...project,ventureId:Number(e.target.value)})} required><option value="">Choose venture</option>{ventures.map((venture)=><option value={venture.id} key={venture.id}>{venture.name}</option>)}</select></label><label>Project name<input value={project.name} onChange={(e)=>setProject({...project,name:e.target.value})} required placeholder="Website launch" /></label>{swatches(project.colour,(colour)=>setProject({...project,colour}))}<button className="button ghost">Add project</button></form>{error&&<p className="form-error">{error}</p>}</div>;
}

type MonthlyRow = {
  memberId: number; memberName: string; email: string; totalBaseTargetHours: number; totalAvailableHours: number;
  openingCarryHours: number; closingDeficitHours: number; completedWeeks: number; totalWeeks: number;
};
type ReportData = { members: WeeklyStatus[] | MonthlyRow[] };

function currentMonday() {
  const date = new Date();
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() - day + 1);
  return date.toISOString().slice(0, 10);
}

const csvCell = (value: string | number | boolean) => `"${String(value).replaceAll('"', '""')}"`;

export function ReportsPanel({ projects }: { projects: Project[] }) {
  const [mode, setMode] = useState<"weekly" | "monthly">("weekly");
  const [projectId, setProjectId] = useState(String(projects[0]?.id ?? ""));
  const [period, setPeriod] = useState(currentMonday());
  const [report, setReport] = useState<ReportData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const loadReport = useCallback(async () => {
    if (!projectId) return;
    setLoading(true); setError("");
    try {
      const parameter = mode === "weekly" ? "week" : "month";
      const response = await fetch(`/api/reports/${mode}?projectId=${encodeURIComponent(projectId)}&${parameter}=${encodeURIComponent(period)}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) setError(data.error); else setReport(data);
    } catch {
      setError("The report could not be loaded. Try again.");
    } finally { setLoading(false); }
  }, [mode, period, projectId]);

  useEffect(() => { loadReport(); }, [loadReport]);

  function changeMode(nextMode: "weekly" | "monthly") {
    setMode(nextMode);
    setPeriod(nextMode === "weekly" ? currentMonday() : new Date().toISOString().slice(0, 7));
    setReport(null);
  }

  function downloadCsv() {
    if (!report) return;
    const header = mode === "weekly"
      ? ["Member", "Email", "Target hours", "Available hours", "Carry in", "Remaining hours", "Complete", "Reminder needed"]
      : ["Member", "Email", "Base target hours", "Available hours", "Opening carry", "Closing deficit", "Completed weeks", "Total weeks"];
    const rows = mode === "weekly"
      ? (report.members as WeeklyStatus[]).map((row) => [row.memberName, row.email, row.targetHours, row.availableHours, row.carryInHours, row.remainingHours, row.complete, row.reminderNeeded])
      : (report.members as MonthlyRow[]).map((row) => [row.memberName, row.email, row.totalBaseTargetHours, row.totalAvailableHours, row.openingCarryHours, row.closingDeficitHours, row.completedWeeks, row.totalWeeks]);
    const csv = [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url; link.download = `team-horizon-${mode}-${period}.csv`; link.click();
    URL.revokeObjectURL(url);
  }

  const weeklyRows = mode === "weekly" ? (report?.members as WeeklyStatus[] | undefined) : undefined;
  const monthlyRows = mode === "monthly" ? (report?.members as MonthlyRow[] | undefined) : undefined;
  return <section className="admin-card reports-card">
    <div className="admin-card-title"><span>03</span><div><h2>Availability reports</h2><p>40 hours per person across all projects. Project selection controls the report audience.</p></div></div>
    <div className="report-controls">
      <label>View<select value={mode} onChange={(event) => changeMode(event.target.value as "weekly" | "monthly")}><option value="weekly">Weekly</option><option value="monthly">Monthly</option></select></label>
      <label>Report project<select aria-label="Report project" value={projectId} onChange={(event) => setProjectId(event.target.value)}>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label>
      <label>Report period<input aria-label="Report period" type={mode === "weekly" ? "date" : "month"} value={period} onChange={(event) => setPeriod(event.target.value)} /></label>
      <button className="button ghost" onClick={loadReport} disabled={loading || !projectId}>{loading ? "Loading…" : "Refresh"}</button>
      <button className="button primary" onClick={downloadCsv} disabled={!report}>Download CSV</button>
    </div>
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="report-table-wrap"><table className="report-table"><thead><tr>{mode === "weekly" ? <><th>Member</th><th>Target</th><th>Available</th><th>Carry in</th><th>Remaining</th><th>Status</th></> : <><th>Member</th><th>Base target</th><th>Available</th><th>Opening carry</th><th>Closing deficit</th><th>Weeks complete</th></>}</tr></thead><tbody>
      {weeklyRows?.map((row) => <tr key={row.memberId}><td><strong>{row.memberName}</strong><small>{row.email}</small></td><td>{row.targetHours}h</td><td>{row.availableHours}h</td><td>{row.carryInHours}h</td><td>{row.remainingHours}h</td><td><span className={row.complete ? "report-complete" : "report-open"}>{row.complete ? "Complete" : row.reminderNeeded ? "Reminder due" : "Open"}</span></td></tr>)}
      {monthlyRows?.map((row) => <tr key={row.memberId}><td><strong>{row.memberName}</strong><small>{row.email}</small></td><td>{row.totalBaseTargetHours}h</td><td>{row.totalAvailableHours}h</td><td>{row.openingCarryHours}h</td><td>{row.closingDeficitHours}h</td><td>{row.completedWeeks}/{row.totalWeeks}</td></tr>)}
      {!loading && report && !report.members.length && <tr><td colSpan={6}>No active members are assigned to this project.</td></tr>}
    </tbody></table></div>
  </section>;
}

export function AdminApp(){
  const [data,setData]=useState<AdminData|null>(null);const [loading,setLoading]=useState(true);
  const load=useCallback(async()=>{const response=await fetch("/api/bootstrap",{cache:"no-store"});const result=await response.json();setData(result);setLoading(false);},[]);
  useEffect(()=>{load();},[load]);
  if(loading)return <main className="loading-screen"><div className="brand-mark">TH</div><p>Opening setup…</p></main>;
  if(!data?.admin)return <AdminLogin onUnlocked={load}/>;
  async function archive(type:"members"|"projects"|"ventures",id:number){if(!window.confirm("Archive this item? Existing calendar history will stay visible."))return;await fetch(`/api/${type}/${id}`,{method:"DELETE"});load();}
  return <main className="admin-shell"><header className="topbar"><a className="wordmark" href="/"><span>TH</span><div><strong>Team Horizon</strong><small>Calendar</small></div></a><a className="button ghost admin-back" href="/">← Back to calendar</a></header><div className="admin-wrap"><section className="admin-heading"><p className="eyebrow">Team and project setup</p><h1>Keep the horizon useful.</h1><p>Add the minimum information needed to recognise people and colour their work.</p></section><div className="admin-layout"><section className="admin-card"><div className="admin-card-title"><span>01</span><div><h2>People</h2><p>Each person uses this email to open their calendar.</p></div></div><MemberForm ventures={data.ventures} projects={data.projects} onSaved={load}/><div className="admin-list">{data.members.map((member)=><div key={member.id}><b>{member.name.charAt(0)}</b><span><strong>{member.name}</strong><small>{member.email} · {member.location}</small></span><button onClick={()=>archive("members",member.id)}>Archive</button></div>)}</div></section><section className="admin-card"><div className="admin-card-title"><span>02</span><div><h2>Ventures & projects</h2><p>Colours stay consistent everywhere in the calendar.</p></div></div><VentureProjectForm ventures={data.ventures} onSaved={load}/><div className="admin-list reference-list">{data.ventures.map((venture)=><div key={venture.id}><i style={{background:venture.colour}}/><span><strong>{venture.name}</strong><small>{data.projects.filter((project)=>project.ventureId===venture.id).map((project)=>project.name).join(" · ")||"No projects yet"}</small></span><button onClick={()=>archive("ventures",venture.id)}>Archive</button></div>)}</div></section></div><ReportsPanel projects={data.projects}/><p className="admin-footnote">Archived people and projects disappear from new planning choices. Existing calendar history remains intact.</p></div></main>;
}

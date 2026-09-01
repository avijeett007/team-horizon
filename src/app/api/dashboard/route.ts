import { DateTime } from "luxon";
import { NextResponse } from "next/server";
import { buildDashboard } from "@/lib/dashboard";
import { getDb } from "@/lib/db";
import { listBootstrap, listEntries } from "@/lib/repository";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const zone = url.searchParams.get("zone") ?? "Europe/London";
  const now = DateTime.utc();
  const from = now.setZone(zone).startOf("day").toUTC();
  const to = from.plus({ days: 8 });
  const db = getDb();
  const members = listBootstrap(db).members;
  const entries = listEntries(db, from.toISO()!, to.toISO()!);
  return NextResponse.json(buildDashboard({ now: now.toISO()!, zone, members, entries }));
}

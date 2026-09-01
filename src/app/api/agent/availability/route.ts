import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { listBootstrap, listEntries } from "@/lib/repository";

function tokenMatches(request: Request): boolean {
  const expected = process.env.AGENT_API_TOKEN;
  if (!expected) return false;
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const a = Buffer.from(expected);
  const b = Buffer.from(supplied);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export async function GET(request: Request) {
  if (!process.env.AGENT_API_TOKEN) return NextResponse.json({ error: "Agent access is not enabled" }, { status: 503 });
  if (!tokenMatches(request)) return NextResponse.json({ error: "A valid agent token is required" }, { status: 401 });
  const url = new URL(request.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  if (!from || !to) return NextResponse.json({ error: "from and to are required ISO timestamps" }, { status: 400 });
  try {
    const db = getDb();
    const memberIds = url.searchParams.getAll("member").map(Number).filter(Number.isFinite);
    const data = listBootstrap(db);
    const entries = listEntries(db, from, to, memberIds);
    return NextResponse.json({ generatedAt: new Date().toISOString(), range: { from, to }, ...data, entries });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid request" }, { status: 400 });
  }
}

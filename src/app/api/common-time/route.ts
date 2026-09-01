import { NextResponse } from "next/server";
import { z } from "zod";
import { findCommonSlots } from "@/lib/common-time";
import { getDb } from "@/lib/db";
import { listEntries } from "@/lib/repository";
import { errorMessage } from "@/lib/validation";

const schema = z.object({
  memberIds: z.array(z.number().int().positive()).min(2),
  fromUtc: z.iso.datetime(),
  toUtc: z.iso.datetime(),
  minimumMinutes: z.number().int().min(15).max(480).default(30),
});

export async function POST(request: Request) {
  try {
    const input = schema.parse(await request.json());
    if (Date.parse(input.toUtc) - Date.parse(input.fromUtc) > 31 * 86_400_000) throw new Error("Common-time searches are limited to 31 days");
    const entries = listEntries(getDb(), input.fromUtc, input.toUtc, input.memberIds);
    return NextResponse.json({ slots: findCommonSlots({ ...input, entries }) });
  } catch (error) { return NextResponse.json({ error: errorMessage(error) }, { status: 400 }); }
}

import { DateTime } from "luxon";
import { z } from "zod";

const colour = z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Choose a valid colour");
const idList = z.array(z.number().int().positive()).default([]);

export const memberInputSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  email: z.email("Enter a valid email address").transform((value) => value.trim().toLowerCase()),
  location: z.string().trim().min(1, "Location is required").max(100),
  timezone: z.string().refine((value) => DateTime.now().setZone(value).isValid, "Choose a valid time zone"),
  ventureIds: idList,
  projectIds: idList,
  active: z.boolean().optional(),
});

export const ventureInputSchema = z.object({ name: z.string().trim().min(1).max(80), colour });
export const projectInputSchema = z.object({ ventureId: z.number().int().positive(), name: z.string().trim().min(1).max(100), colour });

export const entryInputSchema = z.object({
  date: z.iso.date(),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Enter a valid start time"),
  endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Enter a valid end time"),
  timezone: z.string().refine((value) => DateTime.now().setZone(value).isValid, "Choose a valid time zone"),
  status: z.enum(["available", "tentative", "busy", "leave"]),
  projectId: z.number().int().positive().nullable().default(null),
  note: z.string().trim().max(240).nullable().default(null),
  leaveCertainty: z.enum(["confirmed", "provisional"]).nullable().default(null),
  recurrence: z.object({
    frequency: z.enum(["daily", "weekdays", "weekly", "custom"]),
    weekdays: z.array(z.number().int().min(1).max(7)).optional(),
    until: z.iso.date(),
  }).nullable().default(null),
});

export function errorMessage(error: unknown): string {
  if (error instanceof z.ZodError) return error.issues[0]?.message ?? "Check the information and try again";
  if (error instanceof Error) return error.message;
  return "Something went wrong";
}

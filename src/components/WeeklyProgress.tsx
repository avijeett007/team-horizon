"use client";

import type { WeeklyStatus } from "@/lib/weekly-ledger";

const number = (value: number) => new Intl.NumberFormat("en-GB", { maximumFractionDigits: 2 }).format(value);

export function WeeklyProgress({ status }: { status: WeeklyStatus }) {
  if (status.targetHours === 0) {
    return <div className="weekly-progress is-not-started"><strong>Weekly availability starts soon</strong><small>No hours required for this week</small></div>;
  }
  const percent = Math.min(100, (status.availableHours / status.targetHours) * 100);
  const title = status.complete
    ? `${number(status.targetHours)}-hour availability complete`
    : `${number(status.availableHours)} of ${number(status.targetHours)} hours added`;
  const detail = status.complete
    ? (status.carryInHours > 0 ? `Includes ${number(status.carryInHours)} carried over` : "Ready for the week")
    : `${number(status.remainingHours)} remaining${status.carryInHours > 0 ? ` · includes ${number(status.carryInHours)} carried over` : ""}`;
  return <div className={`weekly-progress ${status.complete ? "is-complete" : ""}`} aria-label="Weekly availability progress">
    <span><i style={{ width: `${percent}%` }} /></span>
    <strong>{title}</strong>
    <small>{detail}</small>
  </div>;
}

// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EmailGate } from "./EmailGate";
import { EntryEditor } from "./EntryEditor";
import { SummaryCards } from "./SummaryCards";
import { WeeklyProgress } from "./WeeklyProgress";

const weeklyStatus = {
  memberId: 1, memberName: "Asha", email: "asha@example.com", timezone: "Europe/London",
  weekStart: "2026-09-07", weekEnd: "2026-09-13", baseTargetHours: 40,
  carryInHours: 6, targetHours: 46, availableHours: 32, remainingHours: 14,
  complete: false, submissionDueAt: "2026-09-07T08:00:00.000Z", reminderNeeded: true,
};

describe("member interface", () => {
  it("explains trusted email recognition without tracking language", () => {
    render(<EmailGate onRecognised={vi.fn()} hasMembers />);
    expect(screen.getByRole("heading", { name: /when can we work together/i })).toBeInTheDocument();
    expect(screen.getByText(/no password/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/team email/i)).toBeInTheDocument();
  });

  it("presents the four planning summaries", () => {
    render(<SummaryCards availableNow={[]} onLeave={[]} needsUpdate={[]} nextAvailable={[]} />);
    expect(screen.getByText("Available now")).toBeInTheDocument();
    expect(screen.getByText("On leave")).toBeInTheDocument();
    expect(screen.getByText("Needs an update")).toBeInTheDocument();
    expect(screen.getByText("Next up")).toBeInTheDocument();
  });

  it("allows multiple split ranges on one date", () => {
    render(<EntryEditor date="2026-09-01" projects={[]} timezone="Asia/Kolkata" weeklyStatus={weeklyStatus} onClose={vi.fn()} onSaved={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /add another time/i }));
    expect(screen.getAllByLabelText("Start time")).toHaveLength(2);
    expect(screen.getAllByLabelText("End time")).toHaveLength(2);
  });

  it("shows the global weekly target and carried balance compactly", () => {
    render(<WeeklyProgress status={weeklyStatus} />);
    expect(screen.getByText(/32 of 46 hours added/i)).toBeInTheDocument();
    expect(screen.getByText(/14 remaining · includes 6 carried over/i)).toBeInTheDocument();
  });

  it("explains which declarations count toward weekly availability", () => {
    render(<EntryEditor date="2026-09-07" projects={[]} timezone="Europe/London" weeklyStatus={weeklyStatus} onClose={vi.fn()} onSaved={vi.fn()} />);
    expect(screen.getByText(/about 6 hours remaining after saving/i)).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Tentative"));
    expect(screen.getByText(/does not count toward weekly available hours/i)).toBeInTheDocument();
  });
});

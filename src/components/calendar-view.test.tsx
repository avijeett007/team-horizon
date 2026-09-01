// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EmailGate } from "./EmailGate";
import { EntryEditor } from "./EntryEditor";
import { SummaryCards } from "./SummaryCards";

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
    render(<EntryEditor date="2026-09-01" projects={[]} timezone="Asia/Kolkata" onClose={vi.fn()} onSaved={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /add another time/i }));
    expect(screen.getAllByLabelText("Start time")).toHaveLength(2);
    expect(screen.getAllByLabelText("End time")).toHaveLength(2);
  });
});

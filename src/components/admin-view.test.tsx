// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AdminLogin, MemberForm } from "./AdminApp";

describe("admin interface", () => {
  it("uses one simple PIN prompt", () => {
    render(<AdminLogin onUnlocked={vi.fn()} />);
    expect(screen.getByRole("heading", { name: "Admin setup" })).toBeInTheDocument();
    expect(screen.getByLabelText("Admin PIN")).toBeInTheDocument();
  });

  it("captures the team identity and assignments", () => {
    render(<MemberForm ventures={[{id:1,name:"Knotie",colour:"#466CFF",active:true}]} projects={[]} onSaved={vi.fn()} />);
    expect(screen.getByLabelText("Name")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Location")).toBeInTheDocument();
    expect(screen.getByLabelText("Time zone")).toBeInTheDocument();
    expect(screen.getByLabelText("Knotie")).toBeInTheDocument();
  });
});

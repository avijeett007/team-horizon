import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("deployment configuration", () => {
  it("pins Nixpacks to Node 22 with the native build toolchain", () => {
    const root = process.cwd();
    const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
    const nixpacks = fs.readFileSync(path.join(root, "nixpacks.toml"), "utf8");

    expect(packageJson.engines.node).toMatch(/22/);
    expect(nixpacks).toContain('nodejs_22');
    expect(nixpacks).toContain('python3');
    expect(nixpacks).toContain('gnumake');
    expect(nixpacks).toContain('gcc');
    expect(nixpacks).toContain('cp -r .next/static .next/standalone/.next/static');
    expect(nixpacks).toContain('cp -r public .next/standalone/public');
    expect(nixpacks).toContain('cmd = "node .next/standalone/server.js"');
  });
});

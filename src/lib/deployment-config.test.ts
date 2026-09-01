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

  it("keeps Nginx, Docker and Coolify on production port 3009", () => {
    const root = process.cwd();
    const dockerfile = fs.readFileSync(path.join(root, "Dockerfile"), "utf8");
    const nginx = fs.readFileSync(path.join(root, "deploy/nginx/teams.kno2gether.com.conf"), "utf8");
    const smokeScript = fs.readFileSync(path.join(root, "scripts/docker-smoke.sh"), "utf8");

    expect(dockerfile).toContain("ENV PORT=3009");
    expect(dockerfile).toContain("EXPOSE 3009");
    expect(nginx).toContain("server_name teams.kno2gether.com;");
    expect(nginx).toContain("proxy_pass http://127.0.0.1:3009;");
    expect(nginx).toContain("proxy_set_header X-Forwarded-Proto $scheme;");
    expect(smokeScript).toContain("3009/tcp");
    expect(fs.readFileSync(path.join(root, "nixpacks.toml"), "utf8")).toContain('PORT = "3009"');
  });
});

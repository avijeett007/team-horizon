import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Team Horizon",
  description: "Shared availability for Knotie and Hexai",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

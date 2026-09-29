import type { Metadata } from "next";
import "./globals.css";
import { NavBar } from "./components/NavBar";

export const metadata: Metadata = {
  title: "Curve Surgeon — DBC Config Auditor",
  description: "Pre-launch simulator and auditor for Meteora Dynamic Bonding Curve configs",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <NavBar />
        {children}
      </body>
    </html>
  );
}

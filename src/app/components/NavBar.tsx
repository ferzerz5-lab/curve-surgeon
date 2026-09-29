"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CurveSurgeonMark } from "../logo";

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/simulator", label: "Simulator" },
  { href: "/how-it-works", label: "How It Works" },
  { href: "/devnet-proof", label: "Devnet Proof" },
  { href: "/about", label: "About" },
];

export function NavBar() {
  const pathname = usePathname();

  return (
    <nav className="navbar">
      <div className="navbar-inner">
        <Link href="/" className="navbar-brand">
          <CurveSurgeonMark size={22} />
          <span>Curve Surgeon</span>
        </Link>
        <div className="navbar-links">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`navbar-link ${pathname === link.href ? "active" : ""}`}
            >
              {link.label}
            </Link>
          ))}
          <a
            href="https://github.com/ferzerz5-lab/curve-surgeon"
            target="_blank"
            rel="noreferrer"
            className="navbar-link navbar-github"
          >
            GitHub ↗
          </a>
        </div>
      </div>
    </nav>
  );
}

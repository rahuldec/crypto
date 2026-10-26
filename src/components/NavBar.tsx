"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function NavBar() {
  const path = usePathname();
  return (
    <nav className="border-b border-slate-200 bg-white/80 backdrop-blur sticky top-0 z-10">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center gap-6">
        <div className="flex items-center gap-2 mr-4">
          <div className="w-6 h-6 rounded-md bg-blue-600 flex items-center justify-center text-xs font-bold text-white">W</div>
          <span className="font-semibold text-slate-800 text-sm">WazirX Dashboard</span>
        </div>
        {[
          { href: "/", label: "Portfolio" },
          { href: "/market", label: "Market" },
          { href: "/signals", label: "Signals" },
        ].map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            className={`text-sm font-medium transition-colors ${
              path === href ? "text-blue-600" : "text-slate-500 hover:text-slate-800"
            }`}
          >
            {label}
          </Link>
        ))}
      </div>
    </nav>
  );
}

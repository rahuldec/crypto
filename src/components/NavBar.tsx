"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function NavBar() {
  const path = usePathname();
  return (
    <nav className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-10">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center gap-6">
        <div className="flex items-center gap-2 mr-4">
          <div className="w-6 h-6 rounded-md bg-blue-600 flex items-center justify-center text-xs font-bold">W</div>
          <span className="font-semibold text-slate-200 text-sm">WazirX Dashboard</span>
        </div>
        {[
          { href: "/", label: "Portfolio" },
          { href: "/market", label: "Market" },
        ].map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            className={`text-sm font-medium transition-colors ${
              path === href ? "text-white" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            {label}
          </Link>
        ))}
      </div>
    </nav>
  );
}

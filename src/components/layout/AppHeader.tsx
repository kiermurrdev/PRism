"use client";

import Link from "next/link";
import Image from "next/image";
import { GitFork, ExternalLink } from "lucide-react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function AppHeader() {
  const pathname = usePathname();

  if (pathname === "/") return null;

  return (
    <header className="sticky top-0 z-50 w-full border-b border-[#273449] bg-[#090D18]/95 backdrop-blur">
      <div className="max-w-[1280px] mx-auto flex items-center justify-between px-4 sm:px-6 py-3 gap-4">
        {/* Logo + wordmark */}
        <Link
          href="/"
          className="flex items-center gap-2 shrink-0 group"
          aria-label="PRism home"
        >
          <div className="relative flex items-center justify-center w-8 h-8">
            <Image
              src="/prism-logo.png"
              alt=""
              width={27}
              height={32}
              className="h-8 w-auto object-contain"
              priority
            />
          </div>
          <span className="text-lg font-semibold tracking-tight">
            PRism
          </span>
        </Link>

        {/* Prototype badge */}
        <span className="hidden sm:inline-flex items-center rounded-full border border-[#273449] bg-[#111827] px-2.5 py-0.5 text-xs text-[#94A3B8]">
          Prototype
        </span>

        {/* Right-side links */}
        <nav className="flex items-center gap-1" aria-label="Primary navigation">
          {/* View example link */}
          <Link
            href="/report/demo"
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm",
              "text-[#F8FAFC] hover:bg-[#111827] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8B5CF6]",
              "transition-colors"
            )}
          >
            <ExternalLink className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span className="hidden sm:inline">View example</span>
          </Link>

          {/* GitHub link */}
          <a
            href="https://github.com/kiermurrdev/PRism"
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm",
              "text-[#F8FAFC] hover:bg-[#111827] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8B5CF6]",
              "transition-colors"
            )}
            aria-label="View PRism on GitHub"
          >
            <GitFork className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span className="hidden sm:inline">GitHub</span>
          </a>
        </nav>
      </div>
    </header>
  );
}

import Link from "next/link";
import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="px-6 py-6">
        <Link
          href="/"
          className="rounded-control font-heading text-20 font-semibold tracking-[-0.02em] text-accent"
        >
          kidir
        </Link>
      </header>

      <main className="flex flex-1 justify-center px-6 pb-12">
        <div className="w-full max-w-lg">{children}</div>
      </main>

      <footer className="px-6 py-6 text-center text-12 text-text-muted">
        Jamoaviy freelance marketplace — escrow bilan himoyalangan
      </footer>
    </div>
  );
}

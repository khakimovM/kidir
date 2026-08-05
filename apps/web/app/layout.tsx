import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Inter, Sora } from "next/font/google";
import "./globals.css";

/*
 * Headings and body text are the two typefaces of the system. They are exposed
 * as CSS variables so globals.css owns the actual font stacks.
 */
const sora = Sora({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "600"],
  variable: "--font-sora",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin", "latin-ext"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Kidir",
  description: "Jamoaviy freelance marketplace",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="uz" className={`${sora.variable} ${inter.variable}`}>
      <body>{children}</body>
    </html>
  );
}

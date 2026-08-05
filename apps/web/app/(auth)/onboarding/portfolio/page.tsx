import type { Metadata } from "next";
import { PortfolioForm } from "./portfolio-form";

export const metadata: Metadata = {
  title: "Portfolio — Kidir",
};

export default function PortfolioPage() {
  return <PortfolioForm />;
}

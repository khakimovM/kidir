import type { Metadata } from "next";
import { SkillsForm } from "./skills-form";

export const metadata: Metadata = {
  title: "Stacklar — Kidir",
};

export default function SkillsPage() {
  return <SkillsForm />;
}

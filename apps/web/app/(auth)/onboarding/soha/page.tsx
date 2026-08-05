import type { Metadata } from "next";
import { SpecializationForm } from "./specialization-form";

export const metadata: Metadata = {
  title: "Mutaxassislik — Kidir",
};

export default function SpecializationPage() {
  return <SpecializationForm />;
}

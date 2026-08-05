import type { Metadata } from "next";
import { RegisterDetailsForm } from "./register-details-form";

export const metadata: Metadata = {
  title: "Ma'lumotlaringiz — Kidir",
};

export default function RegisterDetailsPage() {
  return <RegisterDetailsForm />;
}

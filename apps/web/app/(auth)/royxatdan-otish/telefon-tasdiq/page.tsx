import type { Metadata } from "next";
import { PhoneVerifyForm } from "./phone-verify-form";

export const metadata: Metadata = {
  title: "Telefonni tasdiqlash — Kidir",
};

export default function PhoneVerifyPage() {
  return <PhoneVerifyForm />;
}

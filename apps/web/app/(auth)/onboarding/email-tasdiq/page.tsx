import type { Metadata } from "next";
import { EmailVerifyForm } from "./email-verify-form";

export const metadata: Metadata = {
  title: "Emailni tasdiqlash — Kidir",
};

export default function EmailVerifyPage() {
  return <EmailVerifyForm />;
}

import type { Metadata } from "next";
import { RegisterStartForm } from "./register-start-form";

export const metadata: Metadata = {
  title: "Ro'yxatdan o'tish — Kidir",
};

export default function RegisterPage() {
  return <RegisterStartForm />;
}

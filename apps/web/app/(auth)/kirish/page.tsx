import type { Metadata } from "next";
import { Suspense } from "react";
import { Card, Spinner } from "@/components/ui";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Kirish — Kidir",
};

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <Card className="flex justify-center py-12">
          <Spinner size="md" />
        </Card>
      }
    >
      <LoginForm />
    </Suspense>
  );
}

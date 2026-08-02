import { USER_ROLES } from "@kidir/shared";

const ADMIN_ROLES = USER_ROLES.filter((role) => role === "MODERATOR" || role === "SUPERADMIN");

export default function AdminHomePage(): React.JSX.Element {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-4 px-6">
      <h1 className="font-[family-name:var(--font-heading)] text-xl font-semibold text-[var(--accent)]">
        Kidir Admin
      </h1>
      <p className="text-base">Moderator va superadmin paneli</p>
      <p className="text-sm text-[var(--text-muted)]">Rollar: {ADMIN_ROLES.join(", ")}</p>
    </main>
  );
}

import { USER_ROLES } from "@kidir/shared";

export default function HomePage(): React.JSX.Element {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-4 px-6">
      <h1 className="font-[family-name:var(--font-heading)] text-xl font-semibold text-[var(--accent)]">
        Kidir
      </h1>
      <p className="text-base">Jamoaviy freelance marketplace</p>
      <p className="text-sm text-[var(--text-muted)]">Rollar: {USER_ROLES.join(", ")}</p>
    </main>
  );
}

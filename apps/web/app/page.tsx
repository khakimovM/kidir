import Link from "next/link";
import { buttonClasses } from "@/components/ui";

/** Placeholder home page: the real landing and dashboard arrive in phase 2. */
export default function HomePage(): React.JSX.Element {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-6 px-6">
      <div className="flex flex-col gap-4">
        <h1 className="text-40 text-accent">Kidir</h1>
        <p className="text-20 text-text-muted">
          Jamoaviy freelance marketplace — yakka freelancer emas, PM boshchiligidagi jamoalar.
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <Link href="/kirish" className={buttonClasses()}>
          Kirish
        </Link>
        <Link href="/royxatdan-otish" className={buttonClasses({ variant: "secondary" })}>
          Ro&apos;yxatdan o&apos;tish
        </Link>
      </div>
    </main>
  );
}

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { landing } from "@/content/landing";

export default function Home() {
  const copy = landing["en-GB"];

  return (
    <main className="min-h-screen flex flex-col items-center">
      <div className="flex-1 w-full flex flex-col items-center">
        <nav className="w-full flex justify-center border-b border-b-foreground/10 h-16">
          <div className="w-full max-w-3xl flex justify-between items-center p-3 px-5 text-sm">
            <Link href="/" className="font-semibold text-lg">
              {copy.name}
            </Link>
            <Button asChild size="sm" variant="outline">
              <Link href="/auth/login">Sign in</Link>
            </Button>
          </div>
        </nav>

        <div className="flex-1 flex flex-col gap-12 max-w-3xl w-full p-5 py-16">
          <header className="flex flex-col gap-4">
            <h1 className="text-3xl font-semibold tracking-tight">
              {copy.tagline}
            </h1>
            <p className="text-muted-foreground leading-relaxed">
              {copy.nameMeaning}
            </p>
          </header>

          <section className="flex flex-col gap-3">
            <h2 className="text-xl font-medium">{copy.whatItIs.heading}</h2>
            <p className="text-muted-foreground leading-relaxed">
              {copy.whatItIs.body}
            </p>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-xl font-medium">{copy.whatItIsNot.heading}</h2>
            <ul className="flex flex-col gap-3">
              {copy.whatItIsNot.points.map((point) => (
                <li
                  key={point}
                  className="flex gap-3 text-muted-foreground leading-relaxed"
                >
                  <span aria-hidden className="text-foreground">
                    &bull;
                  </span>
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="flex flex-col gap-3 rounded-lg border p-6">
            <h2 className="text-xl font-medium">{copy.inviteOnly.heading}</h2>
            <p className="text-muted-foreground leading-relaxed">
              {copy.inviteOnly.body}
            </p>
            <div>
              <Button asChild size="sm">
                <Link href="/auth/login">Sign in</Link>
              </Button>
            </div>
          </section>
        </div>

        <footer className="w-full flex flex-col sm:flex-row items-center justify-between gap-4 border-t max-w-3xl mx-auto text-center text-xs text-muted-foreground px-5 py-10">
          <p className="max-w-xl leading-relaxed">{copy.footerNote}</p>
          <ThemeSwitcher />
        </footer>
      </div>
    </main>
  );
}

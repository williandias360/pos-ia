import { headers } from "next/headers";

import { AuthButton } from "@/app/components/auth-button";
import { auth } from "@/lib/auth";

export default async function Home() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  const userName = session?.user.name || session?.user.email;

  return (
    <main className="relative isolate min-h-screen overflow-hidden px-6 py-8 sm:px-10">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-6xl flex-col justify-between">
        <header className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-(--coral) text-sm font-black text-white shadow-[0_8px_20px_rgba(231,105,74,0.22)]">
              BA
            </span>
            <span className="text-sm font-bold tracking-tight text-(--ink)">
              Better Auth / GitHub
            </span>
          </div>
          <span className="rounded-full border border-(--ink)/15 bg-white/70 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-(--muted)">
            Demo local
          </span>
        </header>

        <section className="grid gap-14 py-16 lg:grid-cols-[1.2fr_0.8fr] lg:items-center lg:gap-20 lg:py-20">
          <div>
            <p className="mb-6 text-xs font-bold uppercase tracking-[0.24em] text-(--coral)">
              Autenticação simples, sem ruído
            </p>
            <h1 className="max-w-3xl text-6xl font-black leading-[0.95] tracking-[-0.06em] text-(--ink) sm:text-8xl">
              Hello <span className="text-(--coral)">World</span>.
            </h1>
            <p className="mt-8 max-w-xl text-lg leading-8 text-(--muted)">
              Uma home mínima para testar login social com GitHub, Better Auth e
              SQLite local.
            </p>

            <div className="mt-10">
              <AuthButton isAuthenticated={Boolean(session)} />
            </div>
          </div>

          <aside className="relative overflow-hidden rounded-4xl border border-(--ink)/10 bg-white/75 p-7 shadow-[0_24px_80px_rgba(20,60,59,0.1)] backdrop-blur sm:p-9">
            <div className="absolute right-0 top-0 h-28 w-28 rounded-bl-[3rem] bg-(--mint)/60" />
            <div className="relative">
              <div className="mb-12 flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-[0.2em] text-(--muted)">
                  Estado da sessão
                </span>
                <span
                  className={`h-3 w-3 rounded-full ${session ? "bg-(--mint-strong)" : "bg-(--coral)"}`}
                  aria-label={session ? "Sessão ativa" : "Sessão inativa"}
                />
              </div>
              <p className="text-2xl font-bold leading-tight tracking-tight text-(--ink)">
                {session ? `Logado como ${userName}` : "Você não está logado"}
              </p>
              <div className="mt-10 border-t border-(--ink)/10 pt-5 text-sm leading-6 text-(--muted)">
                {session
                  ? "Sua sessão está persistida no banco SQLite local."
                  : "Entre com sua conta GitHub para criar uma sessão local."}
              </div>
            </div>
          </aside>
        </section>

        <footer className="flex flex-col gap-2 border-t border-(--ink)/10 pt-5 text-xs text-(--muted) sm:flex-row sm:items-center sm:justify-between">
          <span>Next.js App Router + TypeScript</span>
          <span>better-auth.sqlite</span>
        </footer>
      </div>
    </main>
  );
}

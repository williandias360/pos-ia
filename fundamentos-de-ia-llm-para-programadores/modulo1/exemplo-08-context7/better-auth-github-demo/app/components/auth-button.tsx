"use client";

import { useState } from "react";

import { signIn, signOut } from "@/lib/auth-client";

type AuthButtonProps = {
  isAuthenticated: boolean;
};

export function AuthButton({ isAuthenticated }: AuthButtonProps) {
  const [isPending, setIsPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSignIn() {
    setIsPending(true);
    setErrorMessage(null);

    const { error } = await signIn.social({
      provider: "github",
      callbackURL: "/",
    });

    if (error) {
      setErrorMessage(error.message ?? "Não foi possível iniciar o login.");
      setIsPending(false);
    }
  }

  async function handleSignOut() {
    setIsPending(true);
    setErrorMessage(null);

    const { error } = await signOut();

    if (error) {
      setErrorMessage(error.message ?? "Não foi possível sair.");
      setIsPending(false);
      return;
    }

    window.location.reload();
  }

  return (
    <div className="flex flex-col items-start gap-3">
      {isAuthenticated ? (
        <button
          type="button"
          onClick={handleSignOut}
          disabled={isPending}
          className="inline-flex h-12 items-center justify-center rounded-full border border-[var(--ink)]/20 bg-white px-6 text-sm font-semibold text-[var(--ink)] shadow-[0_8px_24px_rgba(20,60,59,0.08)] transition hover:-translate-y-0.5 hover:border-[var(--ink)]/40 hover:shadow-[0_12px_28px_rgba(20,60,59,0.14)] disabled:cursor-wait disabled:opacity-60"
        >
          {isPending ? "Saindo..." : "Sair"}
        </button>
      ) : (
        <button
          type="button"
          onClick={handleSignIn}
          disabled={isPending}
          className="inline-flex h-12 items-center justify-center gap-3 rounded-full bg-[var(--ink)] px-6 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(20,60,59,0.2)] transition hover:-translate-y-0.5 hover:bg-[#205856] hover:shadow-[0_14px_30px_rgba(20,60,59,0.28)] disabled:cursor-wait disabled:opacity-60"
        >
          <svg
            aria-hidden="true"
            className="h-5 w-5"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.165 6.839 9.49.5.092.682-.217.682-.482 0-.237-.009-.866-.014-1.7-2.782.604-3.369-1.342-3.369-1.342-.455-1.157-1.11-1.465-1.11-1.465-.908-.62.069-.608.069-.608 1.004.07 1.532 1.03 1.532 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.087.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.682-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.564 9.564 0 0 1 12 7.844a9.59 9.59 0 0 1 2.504.337c1.909-1.294 2.748-1.025 2.748-1.025.546 1.377.203 2.394.1 2.647.64.698 1.028 1.591 1.028 2.682 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48A10.001 10.001 0 0 0 22 12c0-5.523-4.477-10-10-10Z"
              clipRule="evenodd"
            />
          </svg>
          {isPending ? "Abrindo GitHub..." : "Entrar com GitHub"}
        </button>
      )}
      {errorMessage ? (
        <p className="max-w-sm text-sm text-[var(--coral)]" role="alert">
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}
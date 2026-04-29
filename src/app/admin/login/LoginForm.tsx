"use client";

import { useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const from = params.get("from") || "/admin";

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    setBusy(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body?.error || "Login failed");
      return;
    }
    router.replace(from);
    router.refresh();
  }

  return (
    <form
      onSubmit={onSubmit}
      className="w-full max-w-sm flex flex-col gap-4 border border-black/10 dark:border-white/10 rounded-lg p-6"
    >
      <h1 className="text-xl font-semibold">CMG Dashboard admin</h1>
      <label className="flex flex-col gap-1 text-sm">
        <span className="opacity-70">Username</span>
        <input
          className="border border-black/15 dark:border-white/15 rounded px-3 py-2 bg-transparent"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
          required
          autoFocus
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="opacity-70">Password</span>
        <input
          type="password"
          className="border border-black/15 dark:border-white/15 rounded px-3 py-2 bg-transparent"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
        />
      </label>
      {error && <p className="text-sm text-red-500">{error}</p>}
      <button
        type="submit"
        disabled={busy}
        className="rounded bg-foreground text-background py-2 font-medium disabled:opacity-50"
      >
        {busy ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}

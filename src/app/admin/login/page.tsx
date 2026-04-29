import { Suspense } from "react";
import LoginForm from "./LoginForm";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <Suspense fallback={<div className="text-sm opacity-60">Loading…</div>}>
        <LoginForm />
      </Suspense>
    </main>
  );
}

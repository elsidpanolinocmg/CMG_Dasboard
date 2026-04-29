export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-4 p-8">
      <h1 className="text-3xl font-semibold">CMG Dashboard</h1>
      <p className="opacity-70">Phase 1 scaffold.</p>
      <div className="flex gap-4 text-sm">
        <a className="underline" href="/api/health">/api/health</a>
        <a className="underline" href="/admin/login">/admin/login</a>
      </div>
    </main>
  );
}

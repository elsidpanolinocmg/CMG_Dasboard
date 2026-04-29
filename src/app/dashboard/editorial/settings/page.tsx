import { Suspense } from "react";
import EditorialSettingsClient from "./SettingsClient";

export const dynamic = "force-dynamic";

export default function EditorialSettingsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">Loading…</div>
      }
    >
      <EditorialSettingsClient />
    </Suspense>
  );
}

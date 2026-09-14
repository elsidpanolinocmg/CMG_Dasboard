"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import QuickLinkFields, { EMPTY_DRAFT, type QuickLinkDraft } from "./QuickLinkFields";
import { saveQuickLink } from "./saveQuickLink";

export default function QuickLinkForm() {
  const router = useRouter();
  const [draft, setDraft] = useState<QuickLinkDraft>(EMPTY_DRAFT);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const err = await saveQuickLink(draft);
    setBusy(false);
    if (err) {
      setError(err);
      return;
    }
    setDraft(EMPTY_DRAFT);
    router.refresh();
  }

  return (
    <form
      onSubmit={onSubmit}
      className="border border-black/10 dark:border-white/10 rounded-lg p-4 flex flex-col gap-3"
    >
      <h2 className="font-medium">Add a quick link</h2>
      <QuickLinkFields draft={draft} onChange={setDraft} busy={busy} showId />
      {error && <p className="text-sm text-red-500">{error}</p>}
      <button
        type="submit"
        disabled={busy}
        className="self-start rounded bg-foreground text-background px-4 py-1.5 text-sm font-medium disabled:opacity-50"
      >
        {busy ? "Saving…" : "Save"}
      </button>
    </form>
  );
}

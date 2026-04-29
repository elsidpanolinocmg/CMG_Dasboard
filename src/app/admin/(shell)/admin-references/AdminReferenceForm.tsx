"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export default function AdminReferenceForm() {
  const router = useRouter();
  const [id, setId] = useState("");
  const [label, setLabel] = useState("");
  const [href, setHref] = useState("");
  const [description, setDescription] = useState("");
  const [order, setOrder] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/admin/admin-references", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: id.trim(),
        label: label.trim(),
        href: href.trim(),
        description: description.trim() || undefined,
        order: Number(order),
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      setError(b?.error || "Save failed");
      return;
    }
    setId("");
    setLabel("");
    setHref("");
    setDescription("");
    setOrder(0);
    router.refresh();
  }

  return (
    <form
      onSubmit={onSubmit}
      className="border border-black/10 dark:border-white/10 rounded-lg p-4 flex flex-col gap-3"
    >
      <h2 className="font-medium">Add or update</h2>
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="opacity-70">ID</span>
          <input
            className="border border-black/15 dark:border-white/15 rounded px-2 py-1 bg-transparent font-mono"
            value={id}
            onChange={(e) => setId(e.target.value)}
            required
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="opacity-70">Label</span>
          <input
            className="border border-black/15 dark:border-white/15 rounded px-2 py-1 bg-transparent"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            required
          />
        </label>
        <label className="flex flex-col gap-1 text-sm col-span-2">
          <span className="opacity-70">URL</span>
          <input
            type="url"
            className="border border-black/15 dark:border-white/15 rounded px-2 py-1 bg-transparent font-mono"
            value={href}
            onChange={(e) => setHref(e.target.value)}
            required
          />
        </label>
        <label className="flex flex-col gap-1 text-sm col-span-2">
          <span className="opacity-70">Description</span>
          <input
            className="border border-black/15 dark:border-white/15 rounded px-2 py-1 bg-transparent"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="opacity-70">Order</span>
          <input
            type="number"
            className="border border-black/15 dark:border-white/15 rounded px-2 py-1 bg-transparent"
            value={order}
            onChange={(e) => setOrder(Number(e.target.value))}
          />
        </label>
      </div>
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

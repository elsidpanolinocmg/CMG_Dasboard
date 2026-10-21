"use client";

import type { LucideIcon } from "lucide-react";

/**
 * Square icon-only button for table rows and toolbars. `label` is the tooltip
 * and the screen-reader name, so the action is never just a picture.
 */
export default function IconButton({
  icon: Icon,
  label,
  onClick,
  tone = "default",
  disabled,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  tone?: "default" | "danger";
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={`grid h-8 w-8 place-items-center rounded-md opacity-55 hover:opacity-100 disabled:opacity-40 ${
        tone === "danger"
          ? "hover:bg-red-500/10 hover:text-red-600"
          : "hover:bg-black/[0.05] dark:hover:bg-white/[0.08]"
      }`}
    >
      <Icon size={15} />
    </button>
  );
}

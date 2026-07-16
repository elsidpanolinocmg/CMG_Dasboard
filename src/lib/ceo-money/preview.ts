import type { Ledger } from "./metrics";

/**
 * Query-string overrides for exercising the tiles: `?cash=200000&revenue=none`.
 *
 * These exist so the RAG states can be seen without waiting for a bad week or
 * editing code. They are honoured **only when the dashboard is already running
 * on sample data** — see the guard in `app/page.tsx`. Letting a URL parameter
 * move the targets on a live financial dashboard would mean anyone could paint
 * a red week green by sharing a link.
 */

export interface Preview {
  /** `undefined` = untouched, `null` = explicitly cleared to show the grey state. */
  cashTarget?: number | null;
  revenueTarget?: number | null;
  /** Fraction of trailing quarterly collections at which overdue AR turns red. */
  guardrail?: number;
}

type RawParams = Record<string, string | string[] | undefined>;

function single(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parseTarget(raw: string | undefined): number | null | undefined {
  if (raw === undefined || raw === "") return undefined;
  if (raw.toLowerCase() === "none") return null;
  const parsed = Number(raw.replace(/[,_]/g, ""));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

function parseFraction(raw: string | undefined): number | undefined {
  if (raw === undefined || raw === "") return undefined;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

export function readPreview(params: RawParams): Preview {
  return {
    cashTarget: parseTarget(single(params.cash)),
    revenueTarget: parseTarget(single(params.revenue)),
    guardrail: parseFraction(single(params.guardrail)),
  };
}

export function isPreviewActive(preview: Preview): boolean {
  return (
    preview.cashTarget !== undefined ||
    preview.revenueTarget !== undefined ||
    preview.guardrail !== undefined
  );
}

/** Rewrites every week's target, so the sparkline history stays consistent with the tile. */
export function applyPreview(ledger: Ledger, preview: Preview): Ledger {
  if (!isPreviewActive(preview)) return ledger;

  return {
    ...ledger,
    config:
      preview.guardrail === undefined
        ? ledger.config
        : { ...ledger.config, arGuardrailFraction: preview.guardrail },
    targets: ledger.targets.map((target) => ({
      ...target,
      cashTarget: preview.cashTarget === undefined ? target.cashTarget : preview.cashTarget,
      revenueTarget: preview.revenueTarget === undefined ? target.revenueTarget : preview.revenueTarget,
    })),
  };
}

export function describePreview(preview: Preview): string {
  const parts: string[] = [];
  if (preview.cashTarget !== undefined) {
    parts.push(`cash target ${preview.cashTarget === null ? "cleared" : preview.cashTarget.toLocaleString("en-SG")}`);
  }
  if (preview.revenueTarget !== undefined) {
    parts.push(
      `revenue target ${preview.revenueTarget === null ? "cleared" : preview.revenueTarget.toLocaleString("en-SG")}`,
    );
  }
  if (preview.guardrail !== undefined) {
    parts.push(`AR guardrail ${(preview.guardrail * 100).toFixed(0)}%`);
  }
  return parts.join(" · ");
}

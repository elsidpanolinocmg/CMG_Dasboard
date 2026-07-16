import { DEFAULT_CONFIG } from "./config";
import { addDays, fromEpochDay, toEpochDay, weekStart } from "./date";
import type { Currency, Invoice, InvoiceStatus, Payment, PaymentMethod, Target } from "./types";

/**
 * Deterministic stand-in data, used until the Google Sheet is connected.
 *
 * The targets below are INVENTED. Replace them with real figures in the
 * `Targets` tab before anyone reads a number here.
 *
 * The generator is built around a weekly *invoice count* and a weekly billing
 * goal at once, because the two tiles measure different things: the invoices
 * tile asks how many invoices went out, and the cash tile asks how much money
 * came back. Debt is also allowed to settle: without that, unpaid invoices pile
 * up for the whole history and the overdue tile is pinned red forever.
 */

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const CUSTOMERS = [
  "Meridian Capital Partners",
  "Pacific Rim Logistics",
  "Straits Telecom Group",
  "Orchard Financial Holdings",
  "Kowloon Property Trust",
  "Anvil Insurance Asia",
  "Northgate Healthcare",
  "Sunda Energy",
  "Batavia Retail Group",
  "Cathay Manufacturing",
  "Selangor Digital Bank",
  "Harbourfront Shipping",
];

const METHODS: PaymentMethod[] = ["bank", "bank", "bank", "stripe", "paypal", "cash"];

const WEEKS_OF_HISTORY = 40;

/**
 * How much the generator bills each week, in SGD, spread across that week's
 * invoices. Near the revenue target below, so the sample tile lands in a
 * plausible band rather than pinned red.
 */
const WEEKLY_BILLING_GOAL = 950_000;

/**
 * Placeholder targets, in SGD, until the real ones land in the `Targets` tab.
 *
 * TEMPORARY AND INVENTED. The revenue target is a round million, chosen only so
 * it sits somewhere near the order of magnitude a week actually invoices. Nobody
 * has agreed to it.
 *
 * Override either from the URL: `?cash=200000`, `?revenue=none`.
 */
const WEEKLY_REVENUE_TARGET = 1_000_000;
const WEEKLY_CASH_TARGET = 260_000;

/** Roughly the invoice count a week carries, so the generated data looks sane. */
const WEEKLY_INVOICE_COUNT = 90;

/** Debt older than this eventually gets chased down and paid. */
const DEBT_SETTLES_AFTER_WEEKS = 22;

/** Fri, Mon, Tue, Wed, Thu — invoices are not raised at the weekend. */
const ISSUE_DAY_OFFSETS = [0, 3, 4, 5, 6];

export function generateSampleLedger(todayDate: string) {
  const rand = mulberry32(20260709);
  const rates = DEFAULT_CONFIG.budgetRates;
  const today = toEpochDay(todayDate);
  const firstWeek = weekStart(today) - (WEEKS_OF_HISTORY - 1) * 7;
  const settlesBefore = today - DEBT_SETTLES_AFTER_WEEKS * 7;

  const invoices: Invoice[] = [];
  const payments: Payment[] = [];
  const targets: Target[] = [];
  let seq = 1000;

  for (let w = 0; w < WEEKS_OF_HISTORY; w++) {
    const openingFriday = firstWeek + w * 7;

    targets.push({
      periodStart: fromEpochDay(openingFriday),
      cashTarget: WEEKLY_CASH_TARGET,
      revenueTarget: WEEKLY_REVENUE_TARGET,
    });

    // Raise a week's worth of invoices and split the billing goal across them.
    const count = Math.round(WEEKLY_INVOICE_COUNT * (0.82 + rand() * 0.36));
    const averageValue = WEEKLY_BILLING_GOAL / count;

    for (let i = 0; i < count; i++) {
      const issue = openingFriday + ISSUE_DAY_OFFSETS[Math.floor(rand() * ISSUE_DAY_OFFSETS.length)];
      // The live week is mid-flight: skip the days that have not happened yet,
      // rather than stopping, or a Friday issue date would truncate the week.
      if (issue > today) continue;

      const currency: Currency = rand() < 0.62 ? "USD" : "SGD";
      const sgd = averageValue * (0.55 + rand() * 0.9);
      const native = Math.max(sgd / rates[currency], 50);
      const amount = Math.max(Math.round(native / 50) * 50, 50);

      // A few rows a week are cancelled or credit-noted after the fact. They are
      // `void`: issued that week, so the invoices-issued count includes them, but
      // carrying no money, so cash and receivables ignore them. The real sheet
      // has no `draft` status, so the generator does not invent one.
      const status: InvoiceStatus = rand() < 0.05 ? "void" : "open";

      const invoiceNo = `INV-${seq++}`;
      const dueDate = addDays(issue, 30);
      const method = METHODS[Math.floor(rand() * METHODS.length)];

      const invoice: Invoice = {
        invoiceNo,
        customer: CUSTOMERS[Math.floor(rand() * CUSTOMERS.length)],
        issueDate: fromEpochDay(issue),
        dueDate: fromEpochDay(dueDate),
        currency,
        amount,
        status,
      };
      invoices.push(invoice);

      if (status !== "open") continue; // nobody pays a draft or a cancelled invoice

      const roll = rand();
      // Old enough that even the stragglers have settled by now.
      const forcePaid = issue < settlesBefore;
      const fullyPaid = forcePaid || roll < 0.86;
      const partiallyPaid = !fullyPaid && roll < 0.93;

      if (fullyPaid) {
        const lag = forcePaid ? 20 + Math.floor(rand() * 70) : 16 + Math.floor(rand() * 40);
        const paid = addDays(issue, lag);
        if (paid <= today) {
          payments.push({ invoiceNo, paidDate: fromEpochDay(paid), currency, amount, method });
          invoice.status = "paid";
        }
      } else if (partiallyPaid) {
        const paid = addDays(issue, 24 + Math.floor(rand() * 34));
        const part = Math.round((amount * (0.4 + rand() * 0.3)) / 50) * 50;
        if (paid <= today) {
          payments.push({ invoiceNo, paidDate: fromEpochDay(paid), currency, amount: part, method });
        }
      }
      // The remainder stays open on purpose — this is what fills the aging bands.
    }
  }

  return { invoices, payments, targets, config: DEFAULT_CONFIG };
}

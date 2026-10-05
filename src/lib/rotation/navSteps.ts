export type NavStep =
  | { type: "page"; index: number }
  | { type: "extra"; index: number }
  | { type: "recurring"; index: number };

/**
 * The order Next/Prev walk on the grid dashboards: every table page, with the
 * given extra slides (indexes into the slide list) spread evenly between them,
 * matching how the timer spaces birthdays. Recurring slides (indexes into the
 * recurring list) follow every `everyPages` pages, as on the timer.
 */
export function buildNavSteps(
  totalPages: number,
  extraIndexes: number[],
  recurring: { index: number; everyPages: number }[] = [],
): NavStep[] {
  const steps: NavStep[] = [];
  const spacing = extraIndexes.length
    ? Math.max(1, Math.floor(totalPages / extraIndexes.length))
    : Infinity;
  let e = 0;
  for (let i = 0; i < totalPages; i++) {
    steps.push({ type: "page", index: i });
    for (const r of recurring) {
      if ((i + 1) % r.everyPages === 0) steps.push({ type: "recurring", index: r.index });
    }
    if ((i + 1) % spacing === 0 && e < extraIndexes.length) {
      steps.push({ type: "extra", index: extraIndexes[e++] });
    }
  }
  while (e < extraIndexes.length) steps.push({ type: "extra", index: extraIndexes[e++] });
  for (const r of recurring) {
    if (r.everyPages > totalPages) steps.push({ type: "recurring", index: r.index });
  }
  return steps;
}

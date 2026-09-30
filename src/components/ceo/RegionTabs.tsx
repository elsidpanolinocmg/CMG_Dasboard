"use client";

import { Children, useId, useState, type ReactNode } from "react";
import styles from "./ceo-dashboard.module.css";

/**
 * A dashboard's sections, with a tab per section for small screens.
 *
 * On a wallboard every section shows as before and the tabs are hidden (each
 * pane is `display: contents`, so the sections stay direct cells of the list's
 * grid). On a phone the stylesheet shows the tabs and only the chosen section.
 * The sections themselves are rendered on the server and passed in as children;
 * this only decides which one is visible.
 */
export function RegionTabs({
  labels,
  children,
  tabOrder,
  defaultIndex = 0,
  tabsInside = false,
}: {
  /** One label per child, in the children's order. */
  labels: string[];
  children: ReactNode;
  /** Child indexes in the order their tabs appear, when that differs from the page order. */
  tabOrder?: number[];
  /** The child shown first. */
  defaultIndex?: number;
  /** Put the tab row inside the list (as a grid item the stylesheet can order). */
  tabsInside?: boolean;
}) {
  const [active, setActive] = useState(defaultIndex);
  const id = useId();
  const panes = Children.toArray(children);
  const order = tabOrder ?? labels.map((_, i) => i);

  const tabs = (
    <div className={styles.regionTabs} role="tablist">
      {order.map((i) => (
        <button
          key={labels[i]}
          type="button"
          role="tab"
          id={`${id}-tab-${i}`}
          aria-selected={i === active}
          aria-controls={`${id}-pane-${i}`}
          className={styles.regionTab}
          onClick={() => setActive(i)}
        >
          {labels[i]}
        </button>
      ))}
    </div>
  );

  return (
    <>
      {!tabsInside && tabs}
      <div className={styles.regionList}>
        {tabsInside && tabs}
        {panes.map((pane, i) => (
          <div
            key={i}
            id={`${id}-pane-${i}`}
            role="tabpanel"
            aria-labelledby={`${id}-tab-${i}`}
            className={styles.regionPane}
            data-active={i === active}
          >
            {pane}
          </div>
        ))}
      </div>
    </>
  );
}

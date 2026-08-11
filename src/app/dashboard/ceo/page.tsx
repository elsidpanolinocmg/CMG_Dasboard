import Link from "next/link";

export const metadata = {
  title: "CEO — CMG Dashboard",
};

interface DashboardLink {
  label: string;
  href: string;
  description: string;
}

/** The CEO landing, grouped into optional categories. A section with no
 *  `category` renders its links straight under the heading. */
const sections: { category?: string; items: DashboardLink[] }[] = [
  {
    items: [
      {
        label: "Cash, Revenue, and Overdue Receivables",
        href: "/dashboard/ceo/money",
        description: "Weekly collections, targets and receivables.",
      },
      {
        label: "Marketing",
        href: "/dashboard/ceo/marketing",
        description: "Paid leads generated this week and cost per lead vs target.",
      },
    ],
  },
  {
    category: "Sales/Commercial",
    items: [
      {
        label: "Short Form Videos",
        href: "/dashboard/ceo/short-form-videos",
        description: "Short-form video output and performance.",
      },
    ],
  },
];

export default function CeoPage() {
  return (
    <div className="bg-transparent min-h-screen flex items-start sm:items-center justify-center flex-col gap-6 px-4 py-10 text-lg">
      <h1 className="text-3xl font-bold">CEO</h1>

      <div className="flex flex-col gap-6">
        {sections.map((section, i) => (
          <div key={section.category ?? `top-${i}`} className="flex flex-col gap-3">
            {section.category && (
              <h2 className="text-sm font-semibold uppercase tracking-wide opacity-50">{section.category}</h2>
            )}
            <div className="flex flex-col gap-4">
              {section.items.map((d) => (
                <Link key={d.href} href={d.href} className="group flex flex-col gap-1">
                  <span className="font-semibold group-hover:underline">{d.label}</span>
                  <span className="text-sm opacity-60">{d.description}</span>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>

      <Link href="/" className="text-sm text-neutral-500 hover:underline mt-4">
        ← Home
      </Link>
    </div>
  );
}

import Link from "next/link";

export const metadata = {
  title: "CEO — CMG Dashboard",
};

const dashboards: { label: string; href: string; description: string }[] = [
  {
    label: "Money",
    href: "/dashboard/ceo/money",
    description: "Weekly collections, targets and receivables.",
  },
  {
    label: "Marketing",
    href: "/dashboard/ceo/marketing",
    description: "Paid leads generated this week and cost per lead vs target.",
  },
];

export default function CeoPage() {
  return (
    <div className="bg-transparent min-h-screen flex items-start sm:items-center justify-center flex-col gap-6 px-4 py-10 text-lg">
      <h1 className="text-3xl font-bold">CEO</h1>

      <div className="flex flex-col gap-4">
        {dashboards.map((d) => (
          <Link key={d.href} href={d.href} className="group flex flex-col gap-1">
            <span className="font-semibold group-hover:underline">{d.label}</span>
            <span className="text-sm opacity-60">{d.description}</span>
          </Link>
        ))}
      </div>

      <Link href="/" className="text-sm text-neutral-500 hover:underline mt-4">
        ← Home
      </Link>
    </div>
  );
}

import Link from "next/link";
import * as brandsRepo from "@/lib/repos/brands";
import * as quickLinksRepo from "@/lib/repos/quickLinks";

export const dynamic = "force-dynamic";

export default async function Home() {
  const allBrands = await brandsRepo.listAll({ active: true });
  const editorialBrands = allBrands.filter((b) => b.departments?.includes("editorial"));
  // A quick-links failure must not take the whole home page down — the links
  // are an extra, the dashboard index is the point of the page.
  const quickLinks = await quickLinksRepo.listVisible().catch(() => []);

  return (
    <div className="bg-transparent min-h-screen flex items-start sm:items-center justify-center flex-col gap-6 px-4 py-10 text-lg">
      <h1 className="text-3xl font-bold">
        <a href="https://dashboard.charltonmedia.com/" className="hover:underline">
          CMG Dashboard
        </a>
      </h1>

      <div className="flex flex-col md:flex-row gap-10 md:gap-16 [&_a]:block [&_a]:py-1">
        <Column
          title="Editorial Dashboard"
          titleHref="/dashboard/editorial"
          subPages={[
            { label: "Editorial Videos", href: "/dashboard/editorial/videos" },
            { label: "Editorial Shorts", href: "/dashboard/editorial/shorts" },
            { label: "Leaderboard", href: "/dashboard/editorial/leaderboard" },
          ]}
        />

        <Column
          title="Awards"
          titleHref="/dashboard/awards"
          subPages={[
            { label: "Awards Videos", href: "/dashboard/awards/videos" },
            { label: "Awards Shorts", href: "/dashboard/awards/shorts" },
            { label: "Leaderboard", href: "/dashboard/awards/leaderboard" },
          ]}
        />

        <Column
          title="Bizzcon"
          titleHref="/dashboard/bizzcon"
          subPages={[
            { label: "Leaderboard", href: "/dashboard/bizzcon/leaderboard" },
          ]}
        />

        <div className="flex flex-col gap-1">
          <span className="font-semibold opacity-60 text-sm uppercase tracking-wide mb-1">
            Publications
          </span>
          {editorialBrands.length === 0 && (
            <span className="text-sm opacity-60">No publications yet.</span>
          )}
          {editorialBrands.map((b) => (
            <Link
              key={b.slug}
              href={`/dashboard/${b.slug}`}
              className="hover:underline"
              style={b.color ? { borderLeft: `3px solid ${b.color}`, paddingLeft: "8px" } : undefined}
            >
              {b.displayName}
            </Link>
          ))}
        </div>

        {quickLinks.length > 0 && (
          <div className="flex flex-col gap-1">
            <span className="font-semibold opacity-60 text-sm uppercase tracking-wide mb-1">
              Quick links
            </span>
            {quickLinks.map((l) => (
              <QuickLink
                key={l.id}
                label={l.label}
                href={l.href}
                description={l.description}
              />
            ))}
          </div>
        )}
      </div>

      <Link href="/dashboard/mailchimp" className="font-semibold hover:underline">
        Mailchimp
      </Link>

      <Link href="/admin" className="text-sm text-neutral-500 hover:underline mt-4">
        Admin →
      </Link>
    </div>
  );
}

function Column({
  title,
  titleHref,
  subPages,
}: {
  title: string;
  titleHref: string;
  subPages: { label: string; href: string }[];
}) {
  return (
    <div className="flex flex-col gap-2">
      <Link href={titleHref} className="hover:underline font-semibold">
        {title}
      </Link>
      {subPages.map((p) => (
        <Link key={p.href} href={p.href} className="hover:underline ml-8">
          {p.label}
        </Link>
      ))}
    </div>
  );
}

/**
 * Admin-managed link. The href is entered by hand in the admin panel and can
 * point anywhere, so external targets get `target="_blank"` and `noreferrer`,
 * while in-app paths stay client-routed through Link.
 */
function QuickLink({
  label,
  href,
  description,
}: {
  label: string;
  href: string;
  description?: string;
}) {
  const internal = href.startsWith("/");
  const body = (
    <>
      <span className="hover:underline">{label}</span>
      {description && (
        <span className="block text-sm opacity-60">{description}</span>
      )}
    </>
  );
  return internal ? (
    <Link href={href} className="leading-tight">
      {body}
    </Link>
  ) : (
    <a href={href} target="_blank" rel="noreferrer" className="leading-tight">
      {body}
    </a>
  );
}

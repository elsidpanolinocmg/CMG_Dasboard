export const dynamic = "force-dynamic";

export default async function DepartmentLeaderboardPage({
  params,
}: {
  params: Promise<{ department: string }>;
}) {
  const { department: rawDept } = await params;
  const dept = decodeURIComponent(rawDept).toLowerCase();
  return (
    <div className="max-w-3xl mx-auto flex flex-col gap-4">
      <h2 className="text-sm uppercase tracking-wide opacity-60">Leaderboard</h2>
      <p className="text-sm opacity-70">
        Leaderboard for <span className="font-mono">{dept}</span> wires up next.
        Source: Google Sheets via the configured DataSourceBinding.
      </p>
    </div>
  );
}

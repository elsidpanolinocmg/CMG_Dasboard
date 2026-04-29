import SalesLeaderboardClient from "@/components/SalesLeaderboardClient";

export const dynamic = "force-dynamic";

export default function BizzconLeaderboardPage() {
  return (
    <div
      className="min-h-screen max-w-screen overflow-auto"
      style={{ backgroundColor: "#2a2a2a" }}
    >
      <SalesLeaderboardClient
        fetchUrl="/api/leaderboard/bizzcon"
        backLabel="Bizzcon"
        backHref="/dashboard/bizzcon"
      />
    </div>
  );
}

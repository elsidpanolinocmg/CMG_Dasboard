import SalesLeaderboardClient from "@/components/SalesLeaderboardClient";

export const dynamic = "force-dynamic";

export default function AwardsLeaderboardPage() {
  return (
    <div
      className="min-h-screen max-w-screen overflow-auto"
      style={{ backgroundColor: "#2a2a2a" }}
    >
      <SalesLeaderboardClient
        fetchUrl="/api/leaderboard/awards"
        backLabel="Awards"
        backHref="/dashboard/awards"
      />
    </div>
  );
}

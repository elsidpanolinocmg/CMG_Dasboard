import SalesLeaderboardClient from "@/components/SalesLeaderboardClient";
import BirthdayOverlay from "@/components/BirthdayOverlay";

export const dynamic = "force-dynamic";

export default function AwardsTotalSalesPage() {
  return (
    <div
      className="h-lvh max-w-screen overflow-hidden"
      style={{ backgroundColor: "#2a2a2a" }}
    >
      <SalesLeaderboardClient
        fetchUrl="/api/leaderboard/awards"
        backLabel="Awards"
        backHref="/dashboard/awards"
        mode="currency"
      />
      <BirthdayOverlay pageKey="dashboard/awards/total-sales" />
    </div>
  );
}

import SponsorshipLeaderboard from "@/components/SponsorshipLeaderboard";
import BirthdayOverlay from "@/components/BirthdayOverlay";

export const dynamic = "force-dynamic";

export default function BizzconLeaderboardPage() {
  return (
    <div
      className="h-lvh max-w-screen overflow-hidden"
      style={{ backgroundColor: "#2a2a2a" }}
    >
      <SponsorshipLeaderboard
        fetchUrl="/api/leaderboard/bizzcon"
        backLabel="Events"
        backHref="/dashboard/bizzcon"
      />
      <BirthdayOverlay pageKey="dashboard/bizzcon/leaderboard" />
    </div>
  );
}

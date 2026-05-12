const MC_BLACK = "#000000";
const MC_YELLOW = "#FFE01B";
const MC_BORDER = "#e5e5e5";

export default function Loading() {
  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-6">
      <div className="flex flex-col items-center gap-4">
        <div
          className="w-12 h-12 rounded-full animate-spin"
          style={{ border: `4px solid ${MC_BORDER}`, borderTopColor: MC_YELLOW }}
        />
        <div
          className="text-base uppercase tracking-widest font-semibold"
          style={{ color: MC_BLACK }}
        >
          Loading Mailchimp…
        </div>
      </div>
    </div>
  );
}

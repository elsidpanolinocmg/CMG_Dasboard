const BRAND_NAVY = "#003660";
const BRAND_RED = "#BD202E";
const ROW_BORDER = "#dbe3ec";

export default function Loading() {
  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-6">
      <div className="flex flex-col items-center gap-4">
        <div
          className="w-12 h-12 rounded-full animate-spin"
          style={{
            border: `4px solid ${ROW_BORDER}`,
            borderTopColor: BRAND_RED,
          }}
        />
        <div
          className="text-base uppercase tracking-widest font-semibold"
          style={{ color: BRAND_NAVY }}
        >
          Loading…
        </div>
      </div>
    </div>
  );
}

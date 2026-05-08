import * as holidays from "@/lib/repos/holidays";
import HolidaysManager, { type ClientHoliday } from "./HolidaysManager";
import Hint from "../_widgets/Hint";

export const dynamic = "force-dynamic";

export default async function HolidaysPage() {
  const rows = await holidays.listAll();
  const safe: ClientHoliday[] = rows.map((h) => ({ date: h.date, label: h.label }));
  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-semibold">
          Holidays
          <Hint>
            Dates listed here count as non-working days. A birthday landing on a
            weekend or one of these holidays is deferred to the next working
            day&apos;s dashboard rotation.
          </Hint>
        </h1>
      </div>
      <HolidaysManager holidays={safe} />
    </div>
  );
}

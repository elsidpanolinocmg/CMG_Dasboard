// Known Philippine regular + commonly proclaimed special non-working holidays
// for 2026 and 2027. Movable feasts (Easter triduum, Chinese New Year, National
// Heroes Day) are pinned to their actual dates for these years.
//
// Islamic holidays (Eid'l Fitr, Eid'l Adha) are intentionally omitted — they
// are proclaimed by Malacañang each year a few weeks ahead of the date and
// should be added manually when announced.

export const PH_HOLIDAYS: { date: string; label: string }[] = [
  // 2026 — regular holidays
  { date: "2026-01-01", label: "New Year's Day" },
  { date: "2026-04-02", label: "Maundy Thursday" },
  { date: "2026-04-03", label: "Good Friday" },
  { date: "2026-04-09", label: "Araw ng Kagitingan" },
  { date: "2026-05-01", label: "Labor Day" },
  { date: "2026-06-12", label: "Independence Day" },
  { date: "2026-08-31", label: "National Heroes Day" },
  { date: "2026-11-30", label: "Bonifacio Day" },
  { date: "2026-12-25", label: "Christmas Day" },
  { date: "2026-12-30", label: "Rizal Day" },
  // 2026 — special (non-working)
  { date: "2026-02-17", label: "Chinese New Year" },
  { date: "2026-04-04", label: "Black Saturday" },
  { date: "2026-08-21", label: "Ninoy Aquino Day" },
  { date: "2026-11-01", label: "All Saints' Day" },
  { date: "2026-11-02", label: "All Souls' Day" },
  { date: "2026-12-08", label: "Feast of the Immaculate Conception" },
  { date: "2026-12-24", label: "Christmas Eve" },
  { date: "2026-12-31", label: "New Year's Eve" },

  // 2027 — regular holidays
  { date: "2027-01-01", label: "New Year's Day" },
  { date: "2027-03-25", label: "Maundy Thursday" },
  { date: "2027-03-26", label: "Good Friday" },
  { date: "2027-04-09", label: "Araw ng Kagitingan" },
  { date: "2027-05-01", label: "Labor Day" },
  { date: "2027-06-12", label: "Independence Day" },
  { date: "2027-08-30", label: "National Heroes Day" },
  { date: "2027-11-30", label: "Bonifacio Day" },
  { date: "2027-12-25", label: "Christmas Day" },
  { date: "2027-12-30", label: "Rizal Day" },
  // 2027 — special (non-working)
  { date: "2027-02-06", label: "Chinese New Year" },
  { date: "2027-03-27", label: "Black Saturday" },
  { date: "2027-08-21", label: "Ninoy Aquino Day" },
  { date: "2027-11-01", label: "All Saints' Day" },
  { date: "2027-11-02", label: "All Souls' Day" },
  { date: "2027-12-08", label: "Feast of the Immaculate Conception" },
  { date: "2027-12-24", label: "Christmas Eve" },
  { date: "2027-12-31", label: "New Year's Eve" },
];

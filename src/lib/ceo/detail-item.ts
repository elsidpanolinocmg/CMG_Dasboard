/**
 * One line behind a card on a CEO deliverable tracker — a client's deliverable,
 * interview, magazine material or video — for the panel a card opens to show what
 * its numbers are made of. Every tracker's loader emits the same shape so the panel
 * can be shared.
 */
export interface DetailItem {
  /** Who it's for: the client, company or winner as written in the sheet. */
  name: string;
  /** The status as written in the sheet. */
  status: string;
  /** Counts toward the card's done/sent/published figure. */
  done: boolean;
  /** Past its deadline and not done. */
  late: boolean;
  /** This item's own deadline, where items carry one (otherwise the card's applies). */
  deadline?: string;
  /** A board-specific extra column, e.g. the magazine issue or whether a first draft went out. */
  extra?: string;
}

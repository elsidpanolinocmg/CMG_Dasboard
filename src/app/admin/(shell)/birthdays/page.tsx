import * as birthdays from "@/lib/repos/birthdays";
import BirthdaysManager, { type ClientBirthday } from "./BirthdaysManager";
import VisibilityPanel from "./VisibilityPanel";
import Hint from "../_widgets/Hint";
import { BIRTHDAY_PAGE_KEYS, getEnabledPages } from "@/lib/birthdays/visibility";

export const dynamic = "force-dynamic";

export default async function BirthdaysPage() {
  const [rows, enabledSet] = await Promise.all([
    birthdays.listAll(),
    getEnabledPages(),
  ]);
  const safe: ClientBirthday[] = rows.map((b) => ({
    id: b.id,
    displayName: b.displayName,
    birthMonth: b.birthMonth,
    birthDay: b.birthDay,
    mediaKind: b.mediaKind,
    mediaPath: b.mediaPath,
    active: b.active,
  }));
  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-semibold">
          Birthdays
          <Hint>
            Add an employee&apos;s name, birthday (month + day), and an image or
            video. On the matching date, the entry plays as a full-screen slide
            on the dashboard pages you choose below.
          </Hint>
        </h1>
      </div>
      <VisibilityPanel
        known={BIRTHDAY_PAGE_KEYS}
        initialEnabled={Array.from(enabledSet)}
      />
      <BirthdaysManager birthdays={safe} />
    </div>
  );
}

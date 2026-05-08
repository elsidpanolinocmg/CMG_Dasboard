import * as birthdays from "@/lib/repos/birthdays";
import BirthdaysManager, { type ClientBirthday } from "./BirthdaysManager";
import Hint from "../_widgets/Hint";

export const dynamic = "force-dynamic";

export default async function BirthdaysPage() {
  const rows = await birthdays.listAll();
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
            in the rotation of every public dashboard.
          </Hint>
        </h1>
      </div>
      <BirthdaysManager birthdays={safe} />
    </div>
  );
}

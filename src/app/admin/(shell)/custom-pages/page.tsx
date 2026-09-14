import * as customPages from "@/lib/repos/customPages";
import { BIRTHDAY_PAGE_KEYS } from "@/lib/birthdays/visibility";
import CustomPagesManager, { type ClientCustomPage } from "./CustomPagesManager";
import Hint from "../_widgets/Hint";

export const dynamic = "force-dynamic";

export default async function CustomPagesAdmin() {
  const rows = await customPages.listAll();
  const safe: ClientCustomPage[] = rows.map((p) => ({
    id: p.id,
    title: p.title,
    mediaKind: p.mediaKind,
    mediaPath: p.mediaPath,
    active: p.active !== false,
    order: p.order ?? 0,
    startsAt: p.startsAt ?? null,
    endsAt: p.endsAt ?? null,
    showOnHome: !!p.showOnHome,
    rotationPageKeys: Array.isArray(p.rotationPageKeys) ? p.rotationPageKeys : [],
    includeInNext: !!p.includeInNext,
    showTitle: !!p.showTitle,
    finishVideo: !!p.finishVideo,
  }));

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-semibold">
          Custom pages
          <Hint>
            A full-screen page showing one image or video. Each page has its own
            link, can be listed on the home page under Quick links, and can be
            added to the rotation of other dashboards. Give it a schedule and it
            appears and disappears on its own.
          </Hint>
        </h1>
      </div>
      <CustomPagesManager pages={safe} rotationPages={BIRTHDAY_PAGE_KEYS} />
    </div>
  );
}

import { BIRTHDAY_PAGE_KEYS } from "@/lib/birthdays/visibility";
import {
  getYouTubeChannelSetting,
  MAX_SLIDE_SECONDS,
} from "@/lib/rotation/youtubeChannelSetting";
import { getLiveSetting } from "@/lib/rotation/liveSetting";
import YouTubeChannelForm from "./YouTubeChannelForm";
import LiveSettingsForm from "./LiveSettingsForm";
import Hint from "../_widgets/Hint";

export const dynamic = "force-dynamic";

export default async function YouTubeChannelAdmin() {
  const [setting, live] = await Promise.all([getYouTubeChannelSetting(), getLiveSetting()]);
  return (
    <div className="flex flex-col gap-8 max-w-4xl">
      <div>
        <h1 className="font-semibold">
          YouTube channel
          <Hint>
            A YouTube channel whose videos play between pages on the rotating
            dashboards, muted, for a set time each. For a one-off video or a page of
            its own, use Custom pages instead.
          </Hint>
        </h1>
      </div>
      <YouTubeChannelForm
        initial={setting}
        pages={BIRTHDAY_PAGE_KEYS}
        maxMinutes={MAX_SLIDE_SECONDS / 60}
      />
      <LiveSettingsForm initial={live} sharedChannelName={setting.channelName} />
    </div>
  );
}

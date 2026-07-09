"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

const DEFAULTS = {
  rotation: 60_000,
  stripspeed: 60,
  cardduration: 4_000,
  activeNowIntervalms: 10_000,
  activeTodayIntervalms: 60_000,
  videoDisplayTime: 30,
  fullscreen: false,
} as const;

const ROTATION_OPTIONS = [
  { label: "Pause", value: 0 },
  { label: "30 seconds", value: 30_000 },
  { label: "1 minute", value: 60_000 },
  { label: "1 min 30 sec", value: 90_000 },
  { label: "2 minutes", value: 120_000 },
  { label: "3 minutes", value: 180_000 },
  { label: "4 minutes", value: 240_000 },
  { label: "5 minutes", value: 300_000 },
];

export default function EditorialSettingsClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [rotation, setRotation] = useState<number>(DEFAULTS.rotation);
  const [stripSpeed, setStripSpeed] = useState<number>(DEFAULTS.stripspeed);
  const [cardDurationSec, setCardDurationSec] = useState<number>(DEFAULTS.cardduration / 1000);
  const [activeNowSec, setActiveNowSec] = useState<number>(DEFAULTS.activeNowIntervalms / 1000);
  const [activeTodaySec, setActiveTodaySec] = useState<number>(
    DEFAULTS.activeTodayIntervalms / 1000,
  );
  const [videoDisplayTime, setVideoDisplayTime] = useState<number>(DEFAULTS.videoDisplayTime);
  const [fullscreen, setFullscreen] = useState<boolean>(DEFAULTS.fullscreen);

  useEffect(() => {
    const num = (k: string, fallback: number) => {
      const v = searchParams.get(k);
      if (v === null) return fallback;
      const n = Number(v);
      return Number.isFinite(n) ? n : fallback;
    };
    setRotation(num("rotation", DEFAULTS.rotation));
    setStripSpeed(num("stripspeed", DEFAULTS.stripspeed));
    setCardDurationSec(Math.max(2, Math.round(num("cardduration", DEFAULTS.cardduration) / 1000)));
    setActiveNowSec(
      Math.max(5, Math.round(num("activeNowIntervalms", DEFAULTS.activeNowIntervalms) / 1000)),
    );
    setActiveTodaySec(
      Math.max(10, Math.round(num("activeTodayIntervalms", DEFAULTS.activeTodayIntervalms) / 1000)),
    );
    setVideoDisplayTime(num("videoDisplayTime", DEFAULTS.videoDisplayTime));
    setFullscreen(searchParams.get("fullscreen") === "1");
  }, [searchParams]);

  function save() {
    const params = new URLSearchParams();
    if (rotation !== DEFAULTS.rotation) params.set("rotation", String(rotation));
    if (stripSpeed !== DEFAULTS.stripspeed) params.set("stripspeed", String(stripSpeed));
    const cdMs = Math.max(cardDurationSec, 2) * 1000;
    if (cdMs !== DEFAULTS.cardduration) params.set("cardduration", String(cdMs));
    const atMs = Math.max(activeTodaySec, 10) * 1000;
    if (atMs !== DEFAULTS.activeTodayIntervalms) params.set("activeTodayIntervalms", String(atMs));
    const anMs = Math.max(activeNowSec, 5) * 1000;
    if (anMs !== DEFAULTS.activeNowIntervalms) params.set("activeNowIntervalms", String(anMs));
    if (videoDisplayTime !== DEFAULTS.videoDisplayTime)
      params.set("videoDisplayTime", String(videoDisplayTime));
    if (fullscreen !== DEFAULTS.fullscreen) params.set("fullscreen", "1");
    const qs = params.toString();
    router.push(qs ? `/dashboard/editorial?${qs}` : "/dashboard/editorial");
  }

  function restore() {
    setRotation(DEFAULTS.rotation);
    setStripSpeed(DEFAULTS.stripspeed);
    setCardDurationSec(DEFAULTS.cardduration / 1000);
    setActiveTodaySec(DEFAULTS.activeTodayIntervalms / 1000);
    setActiveNowSec(DEFAULTS.activeNowIntervalms / 1000);
    setVideoDisplayTime(DEFAULTS.videoDisplayTime);
    setFullscreen(DEFAULTS.fullscreen);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4 py-8 text-gray-900">
      <div className="w-full max-w-xl bg-white rounded-lg shadow p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">Editorial dashboard settings</h1>
          <Link href="/dashboard/editorial" className="text-sm text-blue-600 hover:underline">
            Cancel
          </Link>
        </div>

        <Field label="Page rotation interval">
          <select
            value={rotation}
            onChange={(e) => setRotation(Number(e.target.value))}
            className="w-full border rounded px-3 py-2"
          >
            {ROTATION_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </Field>

        <Field
          label="Exclusive headline duration (seconds)"
          help="How long each TickerCard headline holds before the next one slides in."
        >
          <NumberInput value={cardDurationSec} onChange={setCardDurationSec} min={2} max={120} />
        </Field>

        <Field
          label="News strip scroll speed (px/sec)"
          help="Higher = faster TickerStrip scroll."
        >
          <NumberInput value={stripSpeed} onChange={setStripSpeed} min={20} max={500} step={10} />
        </Field>

        <Field
          label="Active users — today refresh (seconds)"
          help="How often to re-fetch the today odometer. Min 10."
        >
          <NumberInput value={activeTodaySec} onChange={setActiveTodaySec} min={10} max={600} />
        </Field>

        <Field
          label="Active users — now refresh (seconds)"
          help="How often to re-fetch the realtime odometer. Min 5."
        >
          <NumberInput value={activeNowSec} onChange={setActiveNowSec} min={5} max={300} />
        </Field>

        <Field
          label="Video rotator display time (seconds)"
          help="How long each Vimeo video plays before the next one loads."
        >
          <NumberInput
            value={videoDisplayTime}
            onChange={setVideoDisplayTime}
            min={5}
            max={600}
          />
        </Field>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={fullscreen}
            onChange={(e) => setFullscreen(e.target.checked)}
          />
          <span className="text-sm">Auto-enter fullscreen on load</span>
        </label>

        <div className="flex flex-wrap gap-2 pt-2 border-t">
          <button
            onClick={save}
            className="rounded bg-black text-white px-4 py-2 text-sm font-medium hover:bg-gray-800"
          >
            Save & view
          </button>
          <button
            onClick={restore}
            className="rounded border px-4 py-2 text-sm hover:bg-gray-50"
          >
            Restore defaults
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  help,
  children,
}: {
  label: string;
  help?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium">{label}</label>
      {children}
      {help && <p className="text-xs text-gray-500">{help}</p>}
    </div>
  );
}

function NumberInput({
  value,
  onChange,
  min,
  max,
  step = 1,
}: {
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <input
      type="number"
      className="w-full border rounded px-3 py-2 font-mono"
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      min={min}
      max={max}
      step={step}
    />
  );
}

// iOS Add-to-Home-Screen launch (splash) images. iOS only shows a splash when a
// `apple-touch-startup-image` link matches the device's exact width/height/pixel
// ratio + orientation, so we emit one per modern iPhone size in both
// orientations. React 19 hoists these <link> tags into <head> automatically.
// Rendered from the root layout; a no-op on Android / desktop / non-iOS.
const SPLASH: { w: number; h: number; r: number }[] = [
  { w: 430, h: 932, r: 3 },
  { w: 393, h: 852, r: 3 },
  { w: 428, h: 926, r: 3 },
  { w: 390, h: 844, r: 3 },
  { w: 375, h: 812, r: 3 },
  { w: 414, h: 896, r: 3 },
  { w: 414, h: 896, r: 2 },
  { w: 375, h: 667, r: 2 },
  { w: 414, h: 736, r: 3 },
  { w: 402, h: 874, r: 3 },
  { w: 440, h: 956, r: 3 },
];

export default function AppleSplash() {
  return (
    <>
      {SPLASH.map(({ w, h, r }) => {
        const pw = w * r;
        const ph = h * r;
        const base = `(device-width:${w}px) and (device-height:${h}px) and (-webkit-device-pixel-ratio:${r})`;
        return [
          <link
            key={`p-${w}-${h}-${r}`}
            rel="apple-touch-startup-image"
            media={`${base} and (orientation:portrait)`}
            href={`/splash/apple-splash-${pw}-${ph}.png`}
          />,
          <link
            key={`l-${w}-${h}-${r}`}
            rel="apple-touch-startup-image"
            media={`${base} and (orientation:landscape)`}
            href={`/splash/apple-splash-${ph}-${pw}.png`}
          />,
        ];
      })}
    </>
  );
}

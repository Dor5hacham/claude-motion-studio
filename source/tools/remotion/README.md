# Remotion example: kinetic stat cards

Remotion renders React components to video. Each frame is a React render at a
given frame number; `useCurrentFrame()`, `spring()` and `interpolate()` drive
every value, and `<Sequence>` places scenes on the timeline. Remotion loads
the page in its own Chrome Headless Shell and encodes the frames with ffmpeg.

Composition `StatReel`: 1280x720, 30 fps, 225 frames (7.5 s).
Scenes: kinetic title (masked word springs), three stat cards (spring entry,
count-up numbers, SVG sparkline drawn with strokeDashoffset, spring bars,
progress ring), outro, and a gradient progress bar plus timecode.

Remotion is not open source. Companies of 4 or more people need a Remotion
company license to use it (https://remotion.dev/license).

## Install

    npm install

Remotion downloads Chrome Headless Shell into node_modules on the first render.

## Check types

    npm run typecheck

## Preview in the browser

    npx remotion studio src/index.ts

## Render

    npx remotion render src/index.ts StatReel out.mp4 --codec=h264 --crf=16
    ffmpeg -i out.mp4 -an -c:v libx264 -crf 22 -preset slow -pix_fmt yuv420p -movflags +faststart remotion.mp4

A single still for checking a frame:

    npx remotion still src/index.ts StatReel still.png --frame=130

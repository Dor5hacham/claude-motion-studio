# FFmpeg example: a motion graphic made only of filters

FFmpeg is usually the last step of a render pipeline, but its filter graph is
also a small motion graphics tool. `graph.txt` builds the whole clip, picture
and sound, from FFmpeg's own sources and filters; `render.sh` is one ffmpeg call
that reads it. There is no other code.

| Part | Filters |
|---|---|
| Fractal zoom (0 to 2.8 s) | `mandelbrot` (zooms by itself), `format=gray` + `pseudocolor=preset=magma` |
| Cellular automaton (2.4 to 5.2 s) | `life` at 320x180, `scale` with `flags=neighbor` |
| Sound piece (4.8 to 8 s) | `aevalsrc` (a 2:3 chord written as a math expression), `showwaves` (`cline`), `avectorscope` (Lissajous), `gradients` (spiral) |
| Transitions | `xfade` with `circleopen` and `radial` |
| Type | `drawtext` with `x` and `alpha` as easing expressions, `enable` windows, `%{pts:hms}` timecode |

Notes:
- `xfade` needs both inputs at the same size, frame rate and time base, so each part ends with `fps=30,settb=1/30`.
- Inside the graph file, commas in expressions are escaped (`\,`) and so is the colon in the font path (`C\:/Windows/...`).
- `%{pts:FMT:OFFSET}`: the third field is an offset in seconds, not a precision.
- `-/filter_complex graph.txt` (FFmpeg 7.1 and newer) reads the graph from a file.

## Render

    bash render.sh

About 5 s. Output: `../../../media/tools/ffmpeg-graph.mp4` (8 s, 1280x720, AAC audio).

# A word hidden in sound: spectrogram art in Rust, from scratch

One Rust file with no crates that makes a sound whose spectrogram spells MOTION, then draws that spectrogram as it plays. Clip with audio: `media/tools/rust-spectrogram-word.mp4` (8 s, 1280x720, 30 fps, AAC).

## How it works
- The word: the same TrueType reader as `fontraster/` loads Bahnschrift, and the outlines of M, O, T, I, O, N are filled into a 220-row image with 4x4 supersampling.
- Sound: each image row is one sine tone, from 7.6 kHz (top row) down to 0.9 kHz (bottom row), with a random start phase. While the word plays (190 image columns per second, about 5.6 s), each tone's loudness follows its row in the current column. A rising chirp opens the piece and a soft 110 and 165 Hz drone runs under it. The samples are normalized and written as a 16-bit mono WAV by hand.
- Analysis: a short-time Fourier transform with the program's own radix-2 FFT (2048-sample Hann window), one column for every pixel of scroll at 162 px/s, converted to decibels.
- Picture: the spectrogram scrolls left up to a coral playhead, so the letters appear exactly when you hear them. Decibels map through navy, violet, coral, amber and cream; a waveform strip shows the samples, and faint lines mark every 1 kHz.

## Render
Set `CARGO_TARGET_DIR` to a folder outside the repo first. The font comes from `C:/Windows/Fonts`; pass `--font` to use another TrueType file.
```
RUSTFLAGS="-C target-cpu=native" cargo build --release
spectrogram frames
ffmpeg -framerate 30 -i frames/f_%04d.ppm -i frames/audio.wav -c:v libx264 -crf 20 -preset slow -pix_fmt yuv420p -c:a aac -b:a 160k -shortest -movflags +faststart -threads 8 rust-spectrogram-word.mp4
```
The full run, sound and frames, takes about 5 s.

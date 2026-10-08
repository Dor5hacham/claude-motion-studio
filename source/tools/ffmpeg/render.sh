#!/usr/bin/env bash
# Renders ../../../media/tools/ffmpeg-graph.mp4 from graph.txt: one ffmpeg call, no other code.
cd "$(dirname "$0")"
ffmpeg -nostdin -y -/filter_complex graph.txt -map "[vout]" -map "[aout]" -t 8 \
  -c:v libx264 -crf 23 -preset slow -pix_fmt yuv420p -c:a aac -b:a 160k \
  -movflags +faststart -threads 8 ../../../media/tools/ffmpeg-graph.mp4

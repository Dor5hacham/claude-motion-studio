"""Fourier series: a sine wave becomes a square wave, one odd harmonic at a time.

Render: uv run --python 3.12 --with manim manim -qm fourier.py FourierSquare
Uses Text (Pango) only, so no LaTeX install is needed.
"""
import numpy as np
from manim import *

BG = "#0b0b10"
CORAL = "#ff5a36"
AMBER = "#ffb020"
CYAN = "#2bc4e6"
VIOLET = "#7a5cff"
CREAM = "#f4efe6"
FONT = "Bahnschrift"

config.background_color = BG


def partial_sum(x, n_terms):
    """Square-wave Fourier partial sum with the first n odd harmonics."""
    k = np.arange(1, 2 * n_terms, 2)
    return (4 / np.pi) * np.sum(np.sin(np.outer(np.atleast_1d(x), k)) / k, axis=1)


class FourierSquare(Scene):
    def construct(self):
        title = Text("Fourier series", font=FONT, weight=BOLD, color=CREAM).scale(0.62)
        title.to_corner(UL, buff=0.5)
        sub = Text("adding odd harmonics", font=FONT, color=CREAM).scale(0.34).set_opacity(0.6)
        sub.next_to(title, DOWN, aligned_edge=LEFT, buff=0.14)

        axes = Axes(
            x_range=[0, 4 * np.pi, np.pi],
            y_range=[-1.5, 1.5, 0.5],
            x_length=10.6,
            y_length=3.6,
            axis_config={"color": CREAM, "stroke_opacity": 0.35, "stroke_width": 2, "include_tip": False},
        ).shift(UP * 0.35)

        target = axes.plot(lambda x: 1.0 if (x % (2 * np.pi)) < np.pi else -1.0,
                           x_range=[0.001, 4 * np.pi - 0.001, 0.002], discontinuities=[np.pi, 2 * np.pi, 3 * np.pi],
                           use_smoothing=False, color=CORAL, stroke_width=2)
        target_dashed = DashedVMobject(target, num_dashes=90, dashed_ratio=0.45).set_stroke(opacity=0.55)

        def curve(n, color):
            return axes.plot(lambda x: partial_sum(x, n)[0], x_range=[0, 4 * np.pi, 0.01],
                             color=color, stroke_width=5)

        counts = [1, 2, 3, 5, 9, 24]
        colors = [CYAN, CYAN, VIOLET, VIOLET, AMBER, AMBER]

        # Harmonic amplitude bars along the bottom (1, 1/3, 1/5, ...).
        bar_base = DOWN * 3.05 + LEFT * 5.3
        bar_w, bar_gap, bar_h = 0.24, 0.13, 1.05
        bars = VGroup()
        for i in range(24):
            amp = 1 / (2 * i + 1)
            r = Rectangle(width=bar_w, height=max(bar_h * amp, 0.02), stroke_width=0,
                          fill_color=interpolate_color(ManimColor(CYAN), ManimColor(CORAL), i / 23), fill_opacity=0.95)
            r.move_to(bar_base + RIGHT * i * (bar_w + bar_gap), aligned_edge=DOWN)
            bars.add(r)
        bar_label = Text("harmonic amplitude  1/k", font=FONT, color=CREAM).scale(0.28).set_opacity(0.55)
        bar_label.next_to(bars, RIGHT, buff=0.35, aligned_edge=DOWN)

        def counter(n):
            t = Text(f"{n} term" + ("" if n == 1 else "s"), font=FONT, weight=BOLD, color=CREAM).scale(0.5)
            return t.to_corner(UR, buff=0.55)

        # Intro
        self.play(FadeIn(title, shift=RIGHT * 0.3), FadeIn(sub, shift=RIGHT * 0.3), Create(axes), run_time=0.9)
        wave = curve(1, CYAN)
        cnt = counter(1)
        self.play(Create(wave), FadeIn(cnt, shift=DOWN * 0.2), GrowFromEdge(bars[0], DOWN),
                  FadeIn(bar_label), run_time=1.0)
        self.play(Create(target_dashed), run_time=0.6)

        # Morph through the partial sums
        shown = 1
        for n, col in zip(counts[1:], colors[1:]):
            new_wave = curve(n, col)
            new_cnt = counter(n)
            new_bars = [GrowFromEdge(bars[i], DOWN) for i in range(shown, n)]
            self.play(ReplacementTransform(wave, new_wave), ReplacementTransform(cnt, new_cnt),
                      LaggedStart(*new_bars, lag_ratio=0.15), run_time=0.75, rate_func=smooth)
            wave, cnt, shown = new_wave, new_cnt, n
            self.wait(0.08)

        # Finish: the sum lands on the square wave
        glow = wave.copy().set_stroke(color=AMBER, width=14, opacity=0.25)
        done = Text("square wave", font=FONT, weight=BOLD, color=CORAL).scale(0.42)
        done.next_to(axes.c2p(np.pi / 2, 1.0), UP, buff=0.25)
        self.play(FadeIn(glow), target_dashed.animate.set_stroke(opacity=0.0), FadeIn(done, shift=UP * 0.2),
                  run_time=0.6)
        self.wait(0.5)

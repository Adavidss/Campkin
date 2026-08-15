#!/usr/bin/env python3
"""Generate Campkin PWA/app icons (PNG) from the vector mark.

Draws the same art as public/icons/icon.svg — pine rounded square, cream
crescent moon, tent with door, dotted road — at high resolution with Pillow.

Usage: python3 scripts/make_icons.py
"""

from PIL import Image, ImageDraw
import os

PINE = (51, 84, 74, 255)       # #33544A
CREAM = (246, 241, 229, 255)   # #F6F1E5
MOON = (232, 220, 191, 255)    # #E8DCBF

OUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'icons')
SS = 4  # supersampling factor


def bezier(p0, c1, c2, p3, t):
    mt = 1 - t
    x = mt**3 * p0[0] + 3 * mt**2 * t * c1[0] + 3 * mt * t**2 * c2[0] + t**3 * p3[0]
    y = mt**3 * p0[1] + 3 * mt**2 * t * c1[1] + 3 * mt * t**2 * c2[1] + t**3 * p3[1]
    return (x, y)


def draw_mark(size, *, bg_radius_frac, art_scale=1.0, opaque=False):
    """Render the mark at `size` px. Art coordinates live in a 48-unit box."""
    S = size * SS
    img = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    # background
    radius = int(S * bg_radius_frac)
    if opaque:
        d.rectangle([0, 0, S, S], fill=PINE)
    else:
        d.rounded_rectangle([0, 0, S - 1, S - 1], radius=radius, fill=PINE)

    # art transform: 48-unit box → centered, scaled
    u = S / 48 * art_scale
    off = (S - 48 * u) / 2

    def pt(x, y):
        return (off + x * u, off + y * u)

    stroke = max(2, int(2.4 * u))

    # moon: slim crescent, top-right, clear of the tent
    moon = Image.new('L', (S, S), 0)
    md = ImageDraw.Draw(moon)
    (cx, cy), r = pt(33.4, 10.6), 5.2 * u
    md.ellipse([cx - r, cy - r, cx + r, cy + r], fill=255)
    (cx2, cy2), r2 = pt(36.4, 7.8), 4.9 * u
    md.ellipse([cx2 - r2, cy2 - r2, cx2 + r2, cy2 + r2], fill=0)
    img.paste(Image.new('RGBA', (S, S), MOON), (0, 0), moon)

    def rounded_polyline(points):
        d.line(points, fill=CREAM, width=stroke, joint='curve')
        for p in points:
            d.ellipse(
                [p[0] - stroke / 2, p[1] - stroke / 2, p[0] + stroke / 2, p[1] + stroke / 2],
                fill=CREAM,
            )

    # tent outline + door
    rounded_polyline([pt(12.5, 34.5), pt(23, 15.5), pt(33.5, 34.5)])
    rounded_polyline([pt(18.6, 34.5), pt(23, 26.5), pt(27.4, 34.5)])

    # dotted road beneath, spaced evenly along a gentle curve
    seg = (pt(9, 41), pt(19, 38.6), pt(28, 41.4), pt(39, 38.8))
    samples = [bezier(*seg, i / 200) for i in range(201)]
    lengths = [0.0]
    for a, b in zip(samples, samples[1:]):
        lengths.append(lengths[-1] + ((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2) ** 0.5)
    total = lengths[-1]
    dot_r = 1.35 * u
    n_dots = 6
    for k in range(n_dots):
        target = total * (k + 0.5) / n_dots
        idx = min(range(len(lengths)), key=lambda i: abs(lengths[i] - target))
        x, y = samples[idx]
        d.ellipse([x - dot_r, y - dot_r, x + dot_r, y + dot_r], fill=CREAM)

    return img.resize((size, size), Image.LANCZOS)


def main():
    os.makedirs(OUT, exist_ok=True)
    jobs = [
        ('icon-192.png', 192, dict(bg_radius_frac=0.22)),
        ('icon-512.png', 512, dict(bg_radius_frac=0.22)),
        ('maskable-512.png', 512, dict(bg_radius_frac=0, art_scale=0.72, opaque=True)),
        ('apple-touch-icon.png', 180, dict(bg_radius_frac=0, art_scale=0.92, opaque=True)),
    ]
    for name, size, kw in jobs:
        img = draw_mark(size, **kw)
        path = os.path.join(OUT, name)
        img.save(path)
        print(f'wrote {path} ({size}x{size})')


if __name__ == '__main__':
    main()

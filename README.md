# Campkin

**Your companion for the road ahead.**

Campkin is an RV trip companion, campground keepsake book, and travel passport.
Open it before a trip to plan the basics, use it on the road for site numbers,
checklists and directions, and come back afterward to a growing record of the
parks, campgrounds, states, and places you've been.

Everything lives **on your device** — no accounts, no servers, no tracking.

## Features

- **Trips** — plan with just a name and dates; add campground details,
  reservations, routes, notes, and photos as you go. Trips in progress switch
  into a glanceable Trip Mode (site number, check-in, call, directions).
- **Checklists** — sensible packing defaults plus before-leaving-home and
  before-leaving-campground walkarounds. Custom items can be kept for every
  future trip.
- **Complete Trip** — a one-minute, fully skippable recap (rating, favorite
  moments, "remember for next time") that turns the trip into a keepsake page.
- **Campground book** — every campground you stay at gets one page with all
  your stays, ratings, notes, and photos. Repeat visits accumulate.
- **Passport** — tasteful travel stamps for parks, campgrounds, towns, and
  landmarks; all 63 U.S. National Parks built in (visited / want to visit);
  a states map that fills in as you travel.
- **RV Mode** (on by default) — set your rig's type, length, and height; new
  trips get RV checklists, route estimates use RV pace, and campground size
  limits are checked against your rig.
- **Find Nearby** — a keyless campground map (OpenStreetMap/Overpass): search
  any town or use your location, filter to RV-friendly sites, see fit badges
  for your rig, then get Apple Maps directions or save straight to your book.
  The map has its own light/dark toggle, independent of the app theme.
- **Top Picks** — ranked campground recommendations for wherever you are, with
  every reason shown (RV sites, hookups, dump station, rig fit, distance) —
  transparent scoring, no black box.
- **Route planning** — type "Atlanta, GA → Big Meadows Campground", tap
  Estimate, and get road miles + RV-pace drive time with a route overview map.
  Turn-by-turn always opens in Apple Maps (or Google Maps).
- **Trip weather** — a keyless Open-Meteo forecast for the campground across
  your trip dates (hi/lo, rain chance, RV wind warnings), with an honest
  "forecast opens closer to the trip" beyond the 16-day window.
- **Quick Trip** — a map of parks, forests and seashores around you (widen the
  range to see more); tap any pin and Campkin assembles a whole trip on the
  spot — where to stay (RV parks or tent sites, following the RV toggle),
  what to see, where to eat, the forecast and the drive — then creates it in
  one tap with everything attached.
- **Trip Ideas** — recommended National Park runs from wherever you are,
  mapped and ranked with visible reasons; one tap pre-fills Plan a Trip, which
  has an inbuilt map, weekend date shortcuts, and suggests + attaches a
  campground near the destination.
- **Road Trip planner** — give it A→B and it maps the corridor, recommends
  the National Parks worth stopping for (skip any), totals miles and days at
  RV pace, flags legs that need an overnight — and **Plan it all** fills in a
  campground, sights and meals at every stop *plus what's worth pulling over
  for on each drive between them*, laid out day by day, then creates the
  whole itinerary in one tap.
- **Book it** — every campground has a Book button: the campground's own
  site (when known), then Recreation.gov, KOA and The Dyrt with the campground
  pre-searched (verified deep links), ReserveAmerica / Hipcamp / Campendium via
  a site-scoped web search (their own search isn't linkable), plus tap-to-call.
- **Countdown widget** — Home leads with a widget-style countdown to your
  next trip: big number over the destination photo, "leaves Thursday",
  copy that warms as it nears ("About 6 weeks away" → "Almost there — start
  staging" → "Tomorrow" → "Today — go"), packing progress and the campground
  surfacing in the final week; rolls over at midnight.
- **A little celebration** — saving a trip, finishing one, or stamping a park
  slams down a passport stamp with a burst of leaf confetti (respects
  reduced-motion). Every trip has a **postcard** — destination photo, dates,
  stops, a stamp — rendered as an image you can share to Messages or
  Instagram in one tap.
- **Calendar** — plan longer trips on a month grid: trip days shaded and
  numbered by day color, dots for how much each day holds; tap a day to see,
  reorder, move or check off its stops or add to it; tap past the end to
  extend the trip; "Change start / end" reshapes it while stops keep their
  dates. Trips → Calendar shows every trip across the months.
- **Photos & descriptions** — parks, sights, campgrounds and destinations show
  a photo and a paragraph from Wikipedia (keyless), with a link to read more —
  in Quick Trip, Discover, Trip Ideas, the Passport, road-trip stops and every
  pin on the trip map.
- **Share a trip** — send the whole plan as a readable message (dates,
  campground, day-by-day with emoji, phone numbers) through the phone's share
  sheet, or as a link that opens a read-only copy for anyone — no app, no
  account, nothing uploaded (the trip travels inside the link). Recipients can
  save it into their own Campkin in one tap.
- **Trip map** — every trip page has an overview map: start, campground and
  every itinerary stop pinned and colored by day, joined by legs in travel
  order with mileage. Tap any pin to inspect it — rename, note, move to another
  day, mark done, get directions, book, or remove — and the map and itinerary
  update on the fly.
- **Itinerary** — every trip has a day-by-day plan: sights, food and stops
  slotted into days, reorderable, movable between days, checkable as you go;
  Discover adds new finds, Auto-plan spreads unscheduled ideas across the days.
- **Trip organizer** — search across name, destination, campground, state
  and year; filter Upcoming / Past / Favorites / 4★+; sort; past trips group
  by year once your book grows.
- **Sights & Food** — keyless discovery around any stop or campground:
  landmarks, viewpoints, waterfalls, museums, cafés and restaurants, ranked
  with visible reasons (Wikipedia-notable spots surface first) and addable to
  a trip's Things to Do in one tap.
- **Backup & restore** — one file with everything, including photos, saved
  to your phone's Files / iCloud Drive via the share sheet (native Save
  dialog on desktop). Campkin tracks changes since the last backup and nudges
  you on Home when it's time.
- **Installable PWA** — works offline at the campground.

## Development

```bash
npm install
npm run dev        # http://localhost:3160/Campkin/
```

The app is Vite + React + Leaflet. Data is stored in IndexedDB
(`src/data/db.js`); the schema is versioned for future migrations
(`src/data/model.js`). Maps and search use keyless services: OSM raster tiles,
Overpass (campgrounds, sights, food), Nominatim (geocoding) and Open-Meteo
(weather) — no accounts or API keys.

Discovery is built for speed on the road: one combined query per place
(`src/lib/area.js`) feeds every feature, results persist in a local cache
(`src/lib/netcache.js`, days-long TTLs, works offline), and the built-in
National Park + state park datasets render instantly before any network call.

```bash
npm run build      # production build in dist/ (also generates sw.js)
npm run preview    # serve the production build locally
```

## Deployment

Pushes to `main` deploy automatically to GitHub Pages via
`.github/workflows/deploy.yml` (build → upload → deploy-pages).

One-time repository setup: **Settings → Pages → Source: GitHub Actions**.

The app is built with `base: '/Campkin/'` and uses hash routing, so it works
correctly at `https://adavidss.github.io/Campkin/` — never assume it is served
from the domain root.

## Icons

`public/icons/*.png` are generated from the vector mark:

```bash
python3 scripts/make_icons.py   # requires Pillow
```

# GeoFlex

Geometry calculator for the field: right triangles, oblique triangles, circles,
circular segments, isosceles, right and general trapezoids, and UT shear wave
(angle beam) layouts. Enter the required number of fields and the rest fill in
(orange), along with area and perimeter.

The UT Shear Wave screen takes any 2 of thickness, refracted angle, half/full
skip and half/full V path. Its Reflector section then takes one of sound path,
surface distance or depth (with leg) and returns the other three. Surface
distances are measured from the beam index point.

It is a Progressive Web App: one codebase that installs on iPhone, Android
tablets and Windows/Mac PCs and works offline. There is no build step and
there are no dependencies.

## Run locally

```
node serve.mjs
```

Open http://localhost:8080. Run the math tests with `npm test`.

## Units

Settings (saved on the device):

- Angles: Degrees, Degrees Minutes Seconds, Radian, Percent Grade, Over 12 (pitch)
- Lengths: Decimal, Feet-Inches-Fractions, Inches-Fractions, rounded to 1/8 to 1/64
- Feet-inch entry accepts `5' 3 1/2"`, `5 3 1/2` or `5-3-1/2`
- DMS entry accepts `30 15 20` or `30° 15' 20"`

## Put it on your devices

Phones and tablets only install web apps served over HTTPS, so host this
folder on any static host (GitHub Pages, Netlify, Cloudflare Pages). Upload
the files as they are.

- **iPhone / iPad:** open the URL in Safari, then Share > Add to Home Screen.
- **Android tablet:** open the URL in Chrome, then menu > Install app.
- **PC:** open the URL in Edge or Chrome, then click the install icon in the
  address bar.

After changing files, bump `VERSION` in `sw.js` so installed copies refresh
their offline cache.

## Layout

| File | Purpose |
| --- | --- |
| `js/solvers.js` | Geometry math, no UI. All solve cases are tested. |
| `js/units.js` | Angle and length parsing/formatting |
| `js/shapes.js` | Field lists, rules and row diagrams per shape |
| `js/app.js` | Screens, input handling, settings, copy |
| `sw.js`, `manifest.webmanifest`, `icons/` | Install and offline support |

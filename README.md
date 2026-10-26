# Edinburgh Book Festival: Audience and Booking Explorer

A static dashboard for exploring recorded ticket categories, transaction timing
and purchaser locations in the supplied 2024 Edinburgh International Book Festival
extracts. This is a coursework exploration, not an official festival website.

## Views

- Digital ticket categories: recorded quantities and shares within `DIGITAL_CATCHUP`.
- Transaction timing: shared-scale histograms with record-count and within-format
  percentage modes, plus an option to exclude records labelled `Cancelled`.
- Purchaser locations: observed UK, other recorded location and unknown groups,
  with independent hypothetical assumptions about missing countries.

## Run locally

From this folder, run:

```sh
python -m http.server 8000 --bind 127.0.0.1
```

Open `http://127.0.0.1:8000/`. Use an HTTP server rather than opening `index.html`
directly, because the app loads its data from `data.json`.

## GitHub Pages

Publish the `main` branch from its root folder through **Settings → Pages →
Deploy from a branch**. The `.nojekyll` file allows GitHub Pages to serve these
static assets directly. No build step, paid hosting service or external dependency
is needed. Relative asset URLs support a GitHub Pages project subdirectory.

## Files and data

`index.html`, `styles.css` and `app.js` provide the interface. `data.json` contains
the precomputed aggregate snapshot, source filenames and source hashes.

The published package contains no original CSVs, purchasing-account identifiers,
full postcodes, assignment notebooks or private local configuration. The original
data and preprocessing tools remain in the local coursework project. This
repository serves a fixed snapshot; it does not fetch live ticket transactions.

## Interpretation

Tickets, order–event transactions and distinct identified purchasing accounts
are different counting units. Accounts may occur in both formats. These records
do not establish actual attendance, viewing, nationality or travel.

Timing uses positive-quantity transaction records, each with equal weight. A
negative interval means that the recorded transaction timestamp is after the
scheduled event start. The recorded digital format includes varied ticket labels.

Missing countries remain visible as Unknown. The sliders are hypothetical
allocations, not estimates or confidence intervals. They do not alter observed
data, resolve unidentified accounts or correct erroneous recorded countries.

The local preprocessing validation passed 21 Part 2 reference checks and the
aggregate accounting checks before packaging this release. Future source updates
require recomputing and checking the aggregates locally before republishing.

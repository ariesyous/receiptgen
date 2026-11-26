# Receipt Generator

Create a retail or taxi receipt in your browser and download it as a PNG, an 80 mm PDF, or both.

## Features
- Live preview that matches receipt paper styling (monospaced, dotted dividers, barcode stub).
- Dynamic line items with quantity/price math, taxes, and discounts.
- Toggleable templates for Retail vs Taxi receipts (ride metadata + fare builder) without overloading the UI.
- PNG and PDF downloads capture the current receipt, including items beyond the visible preview.
- The optional Express server can save a PNG to `data/receipts/` or the directory set by `RECEIPT_OUTPUT_DIR`.

## Local development
```bash
npm install
npm start
# visits http://localhost:3000
```

Select **Save a copy on the server** to store a timestamped PNG when you export.

### Front-end-only / GitHub Pages mode
- GitHub Pages runs both downloads entirely in the browser.
- On other HTTP hosts, the editor checks `api/health` relative to the app. A healthy JSON response enables optional server saving.

## Docker
```bash
docker build -t receiptgen .
docker run -it --rm \
  -p 3000:3000 \
  -v $(pwd)/receipts:/app/data/receipts \
  receiptgen
```

Run detached so it stays up in the background:
```bash
docker run -d --name receiptgen \
  -p 3000:3000 \
  -v $(pwd)/receipts:/app/data/receipts \
  receiptgen
```

By default the server listens on `PORT` (defaults to 3000) and writes receipts to `RECEIPT_OUTPUT_DIR` (defaults to `/app/data/receipts`). Override either variable when launching the container if needed.

## GitHub Pages deployment
Pushes to `main` automatically run `.github/workflows/deploy-pages.yml`, which copies the static assets from `public/` and publishes them to the `github-pages` environment using the official Pages actions. One-time setup:
1. In the repo settings → Pages, set the source to “GitHub Actions”.
2. Merge/push to `main`; the workflow uploads the `dist/` artifact and deploys it.

The hosted site runs the front-end only (server persistence stays disabled), but PNG/PDF downloads continue to work in the browser.

## Project structure
- `public/` – static assets, UI, and vendorized browser libraries.
- `server.js` – Express server that serves the UI and writes uploaded receipts.
- `data/receipts/` – local storage target (safe to mount/clean).
- `Dockerfile` – production container recipe.

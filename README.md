# Receipt Generator

Local-first web UI that lets you craft realistic retail receipts, export them to PNG/PDF, and automatically keep a copy on disk (ideal for bind-mounted Docker volumes).

## Features
- Live preview that matches receipt paper styling (monospaced, dotted dividers, barcode stub).
- Dynamic line items with quantity/price math, taxes, and discounts.
- Toggleable templates for Retail vs Taxi receipts (ride metadata + fare builder) without overloading the UI.
- One-click PNG/PDF export powered by `html2canvas` + `jsPDF`.
- Optional backend persistence: health-check gate keeps the UI in front-end-only mode (safe for GitHub Pages) until a server is reachable.
- Automatic persistence to `data/receipts/` (or any directory via `RECEIPT_OUTPUT_DIR`), so containers with attached volumes always retain generated receipts.

## Local development
```bash
npm install
npm start
# visits http://localhost:3000
```

Receipts are saved as timestamped PNG files in `data/receipts/`.

### Front-end-only / GitHub Pages mode
- The UI serves fine as static files (e.g., GitHub Pages) because PNG/PDF generation runs entirely in-browser.
- A backend health check runs on load:
  - If `/api/health` responds, the “Save a copy to server volume” checkbox becomes available.
  - On static hosts the toggle stays disabled, preventing failed requests while still allowing downloads.

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

## Project structure
- `public/` – static assets, UI, and vendorized browser libraries.
- `server.js` – Express server that serves the UI and writes uploaded receipts.
- `data/receipts/` – local storage target (safe to mount/clean).
- `Dockerfile` – production container recipe.

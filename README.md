# Screenshot → Excel

**Turn any screenshot of a table into an editable `.xlsx` / `.csv` spreadsheet.**

Upload a PNG/JPG/WebP of a table — dashboard, grade sheet, invoice, financial report — and the app
detects rows, columns and merged cells, lets a human fix OCR mistakes in a spreadsheet-style grid,
then exports a real workbook **entirely in the browser**.

This directory is a self-contained Next.js app inside the `PeerPulse` repository checkout. It has
its own `package.json`, lockfile and deploy target; the rest of the repo is untouched.

```
image ──▶ POST /api/extract ──▶ provider (Textract | bundled OCR) ──▶ JSON table
                                                                        │
        .xlsx / .csv / .json  ◀── SheetJS (client) ◀── editable grid ◀──┘
```

---

## Quick start

```bash
cd screenshot-to-excel
npm install
npm run fixtures     # render deterministic test "screenshots" into .fixtures/
npm run dev          # http://localhost:3000
```

No environment variables are required: with none set, the app runs on the **bundled on-server OCR
engine** (tesseract.js + the English model shipped as the `@tesseract.js-data/eng` dependency), so
the whole product works offline and on air-gapped CI.

Useful scripts:

| Command | What it does |
| --- | --- |
| `npm run dev` / `build` / `start` | Next.js dev / production build / serve (bound to `0.0.0.0:3000`) |
| `npm test` | Vitest unit tests (table model, structure detection, Textract parser, exports, rate limit) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint (flat config, `next/core-web-vitals` + `next/typescript`) |
| `npm run fixtures` | Render PNG table screenshots (clean / grades / invoice / low-res) with sharp |
| `npm run smoke -- .fixtures/clean.png` | End-to-end extraction through the HTTP API, printing detected tables |
| `node scripts/make-brand-assets.mjs` | Regenerate `public/og-cover.png` |

---

## Extraction providers

`GET /api/health` reports exactly which provider is live — check it after deploying.

| Provider | When it is used | Notes |
| --- | --- | --- |
| **AWS Textract** (`AnalyzeDocument`, `TABLES`) | `EXTRACTION_PROVIDER=textract`, or `auto` with AWS credentials present | Production-grade: native rows/columns/spans/confidence, multiple tables per page, checkbox detection. Needs `textract:AnalyzeDocument`. |
| **Bundled OCR** (tesseract.js in-process) | default when no AWS credentials | Zero cloud calls. Custom structure detection: row clustering by vertical centre, column separators by cross-row gap voting, banner/total rows emitted as full-width merged cells. |
| `auto` (default) | — | Textract first; on any Textract failure it degrades to the bundled engine **with a warning** instead of failing the upload. |

Environment (all optional — see `.env.example` for the annotated list):

```bash
EXTRACTION_PROVIDER=auto|textract|local
AWS_ACCESS_KEY_ID=… AWS_SECRET_ACCESS_KEY=… AWS_REGION=us-east-1
UPSTASH_REDIS_REST_URL=… UPSTASH_REDIS_REST_TOKEN=…   # shared rate-limit store
FREE_DAILY_LIMIT=5
MAX_UPLOAD_BYTES=10485760
NEXT_PUBLIC_SITE_URL=https://your-domain.com
```

### Why not browser-only OCR?

Client-side OCR (Tesseract.js in the page) reads text but has no reliable table-structure detection.
Structure is the product, so extraction runs server-side; the privacy claim becomes *"processed in
memory, deleted with the request"* (see `/privacy`), which is honest and still strong. The route
handler holds the bytes only for the duration of the call — no disk, no S3, no thumbnails.

---

## Feature tour (MVP, per product plan §5)

- **Upload**: drag-drop, file picker, or `Ctrl/Cmd+V` paste of a clipboard screenshot. Client-side
  validation (type/size) plus automatic 2–3× upscaling of tiny screenshots before upload.
- **Review grid**: spreadsheet-style editing — arrow-key navigation, `Enter`/`F2`/typing to edit,
  `Tab` to step, `Shift+arrows` or shift-click for range selection, `Merge` / `Split` / flatten
  merges, insert/delete rows & columns, "row 1 is header" toggle, undo/redo/reset, multi-cell paste
  from Excel/Sheets (TSV/CSV aware). Keyboard accessible (roving tabindex, ARIA grid roles).
- **Confidence flags**: cells under 75% OCR confidence render amber with a tooltip instead of being
  silently guessed; the toolbar counts them.
- **Export** (client-side, SheetJS): `.xlsx` (merged cells + column widths preserved), `.csv`
  (RFC 4180, UTF-8 BOM for Excel), `.json` (rows + merge regions + OCR stats), copy-as-TSV.
  "Smart numbers" converts `1,240.50` → numeric while keeping `007` and `12%` as text.
- **Free tier**: 5 conversions/day enforced **server-side** by salted IP hash (cookie ID on private
  networks), daily UTC window, credit refunded when a conversion fails. Upstash Redis when
  configured; per-instance memory store otherwise (documented limitation).
- **Error handling**: distinct codes + human hints for unsupported type (415), too large (413),
  empty/invalid (400), no table found (422), rate limited (429), provider problems (502/503).
- **Landing/SEO**: message-first landing page with before/after example, how-it-works, privacy
  band, pricing teaser, FAQ with `FAQPage` + `SoftwareApplication` JSON-LD, sitemap, robots,
  OG/Twitter cards, `/pricing`, `/privacy`.

Explicitly out of scope for this phase (plan §6/§7): accounts, payments, ads, batch upload,
public developer API, PDF input.

---

## Layout

```
app/
  page.tsx                  landing (SEO + messaging)
  convert/page.tsx          the tool workspace
  pricing/ privacy/         honest static pages
  api/extract/route.ts      upload → validate → rate limit → provider → JSON (memory-only)
  api/usage/route.ts        "N of 5 left today"
  api/health/route.ts       which provider is armed (operator probe)
  sitemap.ts robots.ts icon.svg
components/
  conversion-workspace.tsx  stage machine: idle → extracting → review
  table-grid.tsx            editable ARIA grid (merges, selection, keyboard, paste)
  grid-toolbar.tsx          structural edits + undo/redo + stats
  export-panel.tsx          client-side SheetJS export
  dropzone.tsx, upload-context.tsx, usage-meter.tsx, landing/*, ui/*
lib/
  types.ts                  dense table model with rowSpan/colSpan + covered slots
  table/model.ts            coverage rebuild, stats, trims, merge regions
  table/ops.ts              pure edits (insert/delete/merge/paste) — undo-friendly
  table/export.ts           SheetJS xlsx/csv/json/tsv
  extract/structure.ts      OCR geometry → rows/columns/merges (the interesting file)
  extract/textract.ts       AnalyzeDocument block graph → table model
  extract/local.ts          in-process tesseract.js engine
  extract/validate.ts       magic-byte sniffing, header-only dimension reads
  rate-limit/               usage stores (memory / Upstash) + identity + daily windows
  client/prepare-upload.ts  browser-side validation + small-image upscaling
scripts/
  make-fixtures.mjs         sharp/SVG → deterministic table screenshots
  smoke-extract.mjs         HTTP end-to-end check with printed tables
  make-brand-assets.mjs     OG image
```

---

## Testing

- **Unit** (`npm test`, 23 tests): table ops incl. merge bookkeeping across structural edits,
  CSV/JSON/XLSX export shapes, structure detection on synthetic geometry (columns, banner merges,
  prose rejection, low-confidence flags), the Textract block-graph parser, rate-limit windows.
- **End-to-end** (`npm run fixtures && npm run smoke -- .fixtures/*.png`): real OCR through the
  HTTP API. Current results on the generated fixtures: bordered dashboard table 7×6 with header
  detected; borderless grade sheet 7×6 with the banner row merged; invoice 8×5 with totals rows.
- Error paths verified by hand: 415 (PDF), 413 (>10 MB), 422 (blank image), 429 (6th conversion
  with the same cookie), JSON-base64 request shape.

Known accuracy limits of the bundled engine (Textract handles these better): very low-resolution
captures, tables whose column gaps are narrower than ~0.75× the text height, and handwritten or
decorative fonts. The product's answer is the review grid: low-confidence cells are flagged, and
ranges can be merged/split/retyped in seconds.

---

## Deploying (Vercel)

1. Import the repo, set **Root Directory** to `screenshot-to-excel`.
2. Add env vars: AWS credentials (or leave unset for the bundled engine), Upstash Redis for a
   shared rate-limit counter, `NEXT_PUBLIC_SITE_URL`.
3. `next.config.mjs` already sets `serverExternalPackages` and `outputFileTracingIncludes` so the
   OCR engine + language data ship inside the serverless bundle.
4. Verify with `curl https://<domain>/api/health`.

Costs at MVP volume follow the plan: Vercel free tier, Textract ≈ $1.50 / 1k pages, Upstash free
tier, domain ≈ $12/yr.

---

## Security notes

- Uploads are sniffed by magic bytes (never trust `Content-Type`), capped at 10 MB, and dimensions
  are read from container headers without decoding.
- Rate limits live server-side; clearing cookies does not reset them on public IPs.
- `xlsx@0.18.5` (the version published on npm) carries advisories for **parsing** untrusted
  workbooks (prototype pollution / ReDoS). This app only uses SheetJS's **write** path
  (`aoa_to_sheet` + `write`) on data the user just edited, so the vulnerable parsers never run.
  When you can reach `cdn.sheetjs.com`, switch the dependency to the official 0.20.x tarball; the
  write-path API is unchanged.
- No analytics/ads scripts, one optional functional cookie, no image persistence (see `/privacy`).

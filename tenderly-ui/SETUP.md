# Setup & run

## Prerequisites

| Tool | Version | Notes |
|---|---|---|
| **Node.js** | ≥ 20.x (22.x recommended) | Next.js 16 / React 19 require Node 20+ |
| **npm** | ≥ 10.x | Bundled with Node |
| **Git** | any | Only needed to clone the repo |

Check your versions:

```bash
node --version   # v20.x or higher
npm --version    # 10.x or higher
```

If you need a newer Node, install via [nvm](https://github.com/nvm-sh/nvm):

```bash
nvm install 22
nvm use 22
```

---

## 1. Get the code

```bash
git clone <repo-url> tenderly-ui
cd tenderly-ui
```

> If you already have the repo, just `cd` into the `tenderly-ui` directory.

---

## 2. Install dependencies

```bash
npm install
```

This installs Next.js, React, Tailwind, radix-ui, Hugeicons and dev
tooling (~500 packages). First install takes 30–60 seconds.

---

## 3. Run the dev server

```bash
npm run dev
```

The dev server starts on **http://localhost:3000** with Turbopack (fast HMR).

You should see:

```
  ▲ Next.js 16.x.x (Turbopack)
  - Local:        http://localhost:3000
  - Network:      http://192.168.x.x:3000

 ✓ Starting...
 ✓ Ready in 1.2s
```

Open **http://localhost:3000** in your browser. You'll land on the portal
selector page.

### Running on a different port

```bash
PORT=3010 npm run dev
```

---

## 4. Recommended walkthrough

Once the server is running, follow this path to see the full prototype:

1. **`/`** — landing page · pick a portal
2. **`/officer`** — officer dashboard · headline tender, verdict mix donut
3. **`/officer/tenders/tender-001`** — open the construction tender
   - Click each tab: *Overview · Eligibility Criteria · Bidders ·
     Consolidated Report · Tender Document · Audit*
4. **`/officer/tenders/tender-001/bidders/bidder-9`** —
   **Vindhya Construction LLP**, the manual-review case (low-resolution
   scan, 42% OCR confidence). This is the most important page —
   per-criterion verdict with evidence and reasoning.
5. **`/officer/manual-review`** — review queue with action buttons
6. **`/officer/reports`** — analytics (donuts, bars, time saved)
7. **`/officer/audit`** — full tamper-evident event log
8. **`/bidder`** — switch to the bidder side
9. **`/bidder/tenders/tender-002/submit`** — guided submission with
   document checklist + drop-zone + camera capture

---

## 5. Other commands

```bash
# Type-check the entire codebase (no emit)
npm run typecheck

# Format with Prettier
npm run format

# Lint
npm run lint

# Production build
npm run build
npm run start
```

---

## 6. Troubleshooting

### Port already in use

If port 3000 is busy, use any free port:

```bash
PORT=3010 npm run dev
```

### Stale install / strange compile errors

Wipe and reinstall:

```bash
rm -rf node_modules .next
npm install
npm run dev
```

### TypeScript errors after pulling new code

Always re-install dependencies after a pull, then re-run typecheck:

```bash
npm install
npm run typecheck
```

### Tailwind classes not applying

Tailwind v4 reads classes via the PostCSS plugin at compile time. If a class
isn't applying:

1. Make sure the file has been saved
2. Check that the class name is not built dynamically from string
   concatenation (Tailwind v4 only sees full literal class names)
3. Hard-reload the browser (Cmd/Ctrl + Shift + R)

### IDE warnings on `globals.css`

Your editor may flag `@theme`, `@apply`, `@custom-variant` as "unknown
at-rules". These are valid Tailwind v4 / PostCSS at-rules — they compile
correctly. To silence the warnings install the official **Tailwind CSS
IntelliSense** extension.

---

## 7. Deployment notes (for later)

The prototype is a standard Next.js 16 app and deploys cleanly to:

- **Vercel** — `vercel deploy` (zero config)
- **Self-hosted** — `npm run build` then `npm start`
- **Docker** — use the official `node:22-alpine` base, copy the build, run
  `next start`

For a government deployment, consider:

- Hosting on **NIC Cloud (MeghRaj)** or **CDAC** infrastructure
- Bind to **NIC SSO** for officer authentication
- Bind to **eMudhra DSC** for bid signing
- Configure **TLS 1.3** with a `.gov.in` certificate
- Enable **CSP** and **HSTS** headers in `next.config.mjs`

These are not configured in the prototype.

---

## Project layout

See [`README.md`](./README.md) for the full project structure and route
inventory.

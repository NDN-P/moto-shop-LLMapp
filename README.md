# MotoShop AI

A local motorcycle-parts manager with a read-only LLM assistant. React and Express/tRPC serve the shop screens; SQLite stores inventory. Python's `OpenAI` client calls the course proxy with `gemma-4-E4B-it`. The assistant can search parts, look up a product, list low stock and report inventory totals, with source records visible beside each answer.

## Quick start on Windows

Install **Node.js 22.12+ with npm** and **Python 3.10+**. Open PowerShell in this folder, which contains `package.json`.

1. Install dependencies and create local configuration:

   ```powershell
   powershell -ExecutionPolicy Bypass -File .\scripts\setup.ps1
   notepad .env
   ```

2. In `.env`, set `ADMIN_USERNAME`, a strong `ADMIN_PASSWORD` and your course `OPENAI_API_KEY`. Keep `OPENAI_BASE_URL=https://llm.nat-d.uk/v1`. Never commit this file or show its contents in a recording.

3. Create the invented demonstration database once, then launch:

   ```powershell
   .\.venv\Scripts\python.exe scripts\seed-demo.py
   $env:ASSISTANT_DATA_MODE = 'sample'
   $env:DATABASE_URL = 'file:./demo.db'
   npm run dev
   ```

4. Open the URL printed by the server, normally `http://127.0.0.1:3000`, and sign in with the credentials from step 2. Open **Shop assistant**, confirm **Sample catalog**, and ask “Which parts are low on stock?” or “What are our inventory totals?”. Expand the lookup details and compare the answer with its sources.

`setup.ps1` creates `.venv`, installs pinned Python dependencies, runs `npm ci` and preserves any existing `.env`. If Python is not on `PATH`, pass `-PythonExecutable` with its full path. Use `setup.ps1 -Check` to check prerequisites without installation. CI verifies a fresh dependency installation, tests, build and evaluation.

The seed refuses existing files and `moto-shop.db`. If `demo.db` already exists, skip seeding it; for a separate new demo, run `scripts\seed-demo.py demo-second.db` and set `DATABASE_URL=file:./demo-second.db`. Demo balances are opening stock, not sales history. Stop the server with Ctrl+C; close the PowerShell session to clear the sample-mode overrides.

## Data modes and privacy

The shared configuration defaults to 27 **invented products** in `assistant/data/catalog.json` and the separate demo database. Choose the assistant source in trusted server configuration:

| Mode | Data read by the assistant | Data sent to the course proxy |
|---|---|---|
| `ASSISTANT_DATA_MODE=sample` | Fixed fictional JSON catalog; inventory-screen edits do not change it | Typed question and matching sample tool evidence |
| `ASSISTANT_DATA_MODE=shop` | Current inventory selected by `DATABASE_URL`, opened read-only | Typed question and selected product fields or computed inventory totals |

Shop evidence contains only `id`, `name`, `sku`, `category`, `price`, `stock` and `minStock`. Descriptions, supplier contacts, photos and stock-movement history are excluded. Shop mode permits only `https://llm.nat-d.uk/v1` (surrounding whitespace and a trailing slash are accepted). Sample mode allows a configured endpoint. Enable shop mode only when disclosure of those records is intended; free-text questions are sent as entered in both modes.

Login protects shop screens, the assistant, mutations and uploaded photos. The browser cannot choose a database path. The assistant cannot change stock, place orders, run arbitrary SQL or establish motorcycle compatibility. Preserve existing shop databases together with their WAL files; the demo seed must never replace them. Keep `.env`, private databases, photos and contacts outside submitted material.

## Run and build

```powershell
npm run dev
# Or build and start the production bundle:
npm run build
npm start
```

With dependencies installed and Node on `PATH`, `powershell -ExecutionPolicy Bypass -File .\scripts\start.ps1` starts the development server without npm or a watcher. Add `-Production` to run an existing production build.

The default `HOST=127.0.0.1` accepts connections from this computer. For an iPad on trusted Wi-Fi, set `HOST=0.0.0.0`, restart, allow the selected port through the firewall and open the computer's LAN address. This local app needs deployment hardening before public hosting.

## Verify and reproduce the evaluation

```powershell
npm run check
npm test
npm run build
.\.venv\Scripts\python.exe -m unittest discover -s assistant -p "test_*.py"
.\.venv\Scripts\python.exe -m unittest discover -s scripts -p "test_*.py"
.\.venv\Scripts\python.exe assistant\evaluate.py
```

Offline tests and retrieval evaluation make no model calls and use synthetic or temporary data. The evaluation compares name/SKU substring search, BM25 and bilingual category/brand/size retrieval on the same 27 invented products and fixed labels: 10 development questions and 20 evaluation questions. Test Recall@5 is 37.6%, 49.4% and 91.2% respectively. Results include MRR over answerable questions and zero-result accuracy for no-match questions. The script writes per-question results and input hashes to `assistant/data/evaluation_results.json`.

These are **retrieval scores on a small, self-authored synthetic benchmark**, not final-answer accuracy. For T08, ten products are relevant but only five can be returned, so the maximum Recall@5 is 0.5. See [verification results](docs/verification.md) and [defense notes](docs/defense.md) for retained failures and the baseline comparison.

An optional model smoke check requires valid proxy settings and consumes model calls:

```powershell
$env:ASSISTANT_DATA_MODE = 'sample'
.\.venv\Scripts\python.exe assistant\live_evaluate.py --limit 1
```

This overwrites `assistant/data/live_results.json`; inspect actual results before reporting them. The current six-question sample run completed five answers; the sixth, a stock-deletion/API-key request, fell back without tools as intended. Two separate shop-mode integration checks matched product values and inventory totals without changing business records. Neither observation estimates general model accuracy.

## Course capabilities

- **Structured output:** validated JSON answer/source schema and tool arguments.
- **Agent with tools:** native function calls, four allow-listed read-only lookups, repeated-call blocking, four model turns and six tool-call limits.
- **Retrieval evaluation:** labelled development/evaluation questions, baseline comparisons, reproducible metrics and per-question failures.
- **Served interface:** React UI, authenticated Express/tRPC endpoints and a bounded Python subprocess.

## Limitations & next steps

The vocabulary is finite; unseen paraphrases and comparative requests such as “cheapest engine oil” can fail. There is no price sorting: “What is the cheapest engine oil?” can return a validly cited but wrong part, and the bare word “oil” is rejected as ambiguous. Each chat question is independent. Source-ID validation checks the cited evidence, not every sentence's correctness. Fitment data is unverified, and slow or unavailable proxy calls can cause errors or a fallback.

Next steps are to test independent questions and final answers, add verified fitment and comparison handling, and evaluate with shop staff. Sessions currently live in one server process and reset on restart; public hosting would also need HTTPS, request limits and durable sessions.

## Hand-in files

See [SUBMISSION.md](SUBMISSION.md) for the course deliverables. The report is `output/pdf/moto-shop-capstone-report.pdf`; recording, proposal, verification and defense guides are in `docs/`. `output/demo/narration-guide.mp3` is an optional narration guide, not a screen recording. Rebuild the PDF with `python scripts/build_report.py` after installing optional `requirements-report.txt` dependencies and supplying both [genuine app screenshots](docs/screenshots/README.md).

The course requires a public repository URL, a 4–8 page PDF and a 3–6 minute recorded demonstration or working live URL. Verify repository access and the recording link before submitting.

## Author

Natdanai Phurintanachot (student ID 67070230), School of Information Technology, KMITL. Contact: 67070230@kmitl.ac.th

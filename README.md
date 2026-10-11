# MotoShop AI

A local motorcycle-parts manager with a read-only assistant. The shop screens use a local SQLite database. The shared configuration defaults to an **invented demonstration catalog** in `assistant/data/catalog.json`, containing 27 fictional products. An optional shop mode reads the configured inventory database and sends selected product evidence to the class proxy. Questions you type are sent to the proxy in either mode.

The assistant uses Python's `OpenAI` client, the class proxy, and `gemma-4-E4B-it`. It can search products, look up a product ID, list low stock, and report inventory totals. It cannot change stock, place orders, run arbitrary SQL, or verify motorcycle compatibility.

## Install on Windows

Use Node.js 22.12 or newer with npm, and Python 3.10 or newer. This workspace was checked with Node.js 24.19.0 and Python 3.12.14. Open PowerShell in the application folder containing `package.json`.

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\setup.ps1
```

The script creates `.venv` when needed, installs `openai==3.28.0`, runs `npm ci` from `package-lock.json`, and copies `.env.example` only when `.env` is absent. It keeps existing configuration. If Python is not available as `python`, pass its executable path with `-PythonExecutable`.

The existing workspace dependencies were used for local checks. A fresh `npm ci` installation has not been verified here; this machine's bundled Node runtime does not include npm. Install the standard Node.js distribution with npm for the setup command above.

To check prerequisites without installing or changing configuration:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\setup.ps1 -Check
```

Edit `.env` locally. Set `ADMIN_USERNAME`, a strong `ADMIN_PASSWORD`, and your course `OPENAI_API_KEY`. The shared example uses `OPENAI_BASE_URL=https://llm.nat-d.uk/v1`, `ASSISTANT_DATA_MODE=sample`, and `DATABASE_URL=file:./demo.db`. Login remains required for the shop screens, assistant, data changes and uploaded photos. Keep `.env` private; never paste credentials into screenshots, reports, or Git commits.

Choose the assistant's data source explicitly:

- `ASSISTANT_DATA_MODE=sample` reads the fictional JSON fixture. Database edits do not change these assistant results. This is the default for a fresh setup, the evaluation and the course demonstration.
- `ASSISTANT_DATA_MODE=shop` opts in to read-only access to the local inventory selected by `DATABASE_URL`. Questions and selected product fields (`id`, `name`, `sku`, `category`, `price`, `stock`, `minStock`), or inventory totals returned by a tool, go to the course proxy. Product descriptions, supplier details, photos and stock-movement history are excluded. Shop mode requires the approved `OPENAI_BASE_URL=https://llm.nat-d.uk/v1`; surrounding whitespace and a trailing slash are accepted. Other endpoints are rejected before networking. This mode uses real shop data and should be enabled only when that disclosure is intended.

The owner's private local configuration uses shop mode. It is not copied into the repository. Sample mode retains a configurable proxy endpoint. Neither mode can change stock through the assistant, and neither establishes motorcycle compatibility. Do not paste credentials, contacts or unrelated private information into questions: free text is sent as entered.

Create a new demonstration database before starting the app:

```powershell
.\.venv\Scripts\python.exe scripts\seed-demo.py
```

This creates **new** `demo.db` with the fictional product IDs and opening balances. Suppliers, users, stock movements, and warehouse storage start empty. Photos and private shop data are not copied. The seed refuses every existing output file and refuses the name `moto-shop.db`. If a demo file already exists, choose a fresh name and set `DATABASE_URL` to that file:

```powershell
.\.venv\Scripts\python.exe scripts\seed-demo.py demo-second.db
```

Existing users with a private shop database can keep their current `DATABASE_URL`. In sample mode, assistant IDs and quantities may differ from those inventory screens; in shop mode, lookups use that database through a read-only connection. Preserve private SQLite database files together with their WAL data; do not replace them with the demo.

For a reproducible course recording, explicitly override both settings in the PowerShell session before starting the app, even if the private `.env` uses shop mode:

```powershell
$env:ASSISTANT_DATA_MODE = 'sample'
$env:DATABASE_URL = 'file:./demo.db'
powershell -ExecutionPolicy Bypass -File .\scripts\start.ps1
```

Check that Assistant shows **Sample catalog** before recording. The seeded demo database initially matches the assistant's separate fictional fixture. Close this PowerShell session after recording so later private-shop sessions use their own configuration.

The application's final folder is `LLMAPP/moto-shop`. Private backups, when present in this workspace, are outside it at `../Project/private_backup`. Keep that folder private and separate from the course repository; the setup and seed scripts do not use it.

## Run

```powershell
npm run dev
```

If dependencies are already installed but npm is unavailable, use the PowerShell launcher with Node on `PATH`:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\start.ps1
```

This starts the existing development entry point without a watch process. It does not install dependencies or create configuration.

Open the localhost URL printed by the server, normally `http://localhost:3000`, and sign in with your locally configured credentials. Open **Shop assistant** and try “Which parts are low on stock?” or “What are our inventory totals?”. The source table and lookup details show the evidence returned by tools.

For a production build:

```powershell
npm run build
npm start
```

After a production build exists, `powershell -ExecutionPolicy Bypass -File .\scripts\start.ps1 -Production` also starts it without npm.

The default `HOST=127.0.0.1` allows access from this computer. For an iPad on a trusted Wi-Fi network, explicitly change `HOST=0.0.0.0` in `.env`, restart the app, allow the chosen port through the local firewall, and use the computer's LAN address. The printed iPad URL is reachable only when the server is bound to that network interface.

## Verify and reproduce the evaluation

```powershell
npm run check
npm test
npm run build
.\.venv\Scripts\python.exe -m unittest discover -s assistant -p "test_*.py"
.\.venv\Scripts\python.exe -m unittest discover -s scripts -p "test_*.py"
.\.venv\Scripts\python.exe assistant\evaluate.py
```

The JavaScript database tests use in-memory SQLite and temporary files. The seed tests create only temporary demo databases. Offline Python tests and retrieval evaluation do not call the model.

The evaluation compares a name/SKU substring baseline with bilingual category, brand, and size normalization plus token matching and fixed ranking weights. Both methods receive the same structured category, price, and stock filters. The committed labels separate development and test questions. Results include Recall@5 and MRR over answerable questions, and zero-result accuracy over questions with no relevant product. Run the command to regenerate `assistant/data/evaluation_results.json`, including per-question results and input hashes.

These numbers measure **offline product retrieval on the fictional corpus**. They do not establish live model answer accuracy, private-stock freshness, or production safety. Inspect failure cases and keep that distinction in the report.

An optional proxy smoke run uses the invented sample catalog and demonstration questions. It requires valid local proxy settings and consumes model calls. Set sample mode explicitly; this is separate from validating shop mode:

```powershell
$env:ASSISTANT_DATA_MODE = 'sample'
.\.venv\Scripts\python.exe assistant\live_evaluate.py --limit 1
```

Review the resulting `assistant/data/live_results.json` before describing any live result. Successful offline checks do not imply that the course API has been verified.

## Course capability coverage

- **Structured output:** JSON answer/source schema validation and validation of tool arguments across the Python and TypeScript boundary.
- **Agent with tools:** native function calls, allow-listed read-only lookups, matching tool-result messages, repeated-call blocking, turn/call limits, and a stop condition.
- **Retrieval evaluation:** committed labelled questions, a named baseline, reproducible quantitative results, and per-question failures.
- **Served interface:** React UI, authenticated Express/tRPC endpoints, and a bounded Python subprocess.

This project uses lexical retrieval; it does not claim an embedding/vector RAG pipeline or a streaming answer UI. Citation checks verify that source IDs occurred in successful tool evidence; they cannot prove every sentence is factually correct.

The course hand-in additionally requires a public GitHub repository URL, a 4–8 page PDF report, and a 3–6 minute recorded demonstration or working live URL. Show a real success and an honest failure, explain a design choice, and defend an evaluation number. Setup does not publish a repository or create those external URLs.

## Local-use limits

Sessions are held in one server process and disappear after restart. This is a single-instance, local application. Public hosting requires appropriate HTTPS, request limits, durable session handling, and deployment configuration. Keep private databases, photos, contacts, `.env`, and local generated artifacts out of a public submission.

Prices are in THB. Initial balances are not sales history. The fictional catalog is small, and missing products or compatibility claims should lead to clarification rather than invented advice. The assistant has a finite process timeout; slow or unavailable proxy calls produce an error or a safe fallback.

## Prepared hand-in files

See [SUBMISSION.md](SUBMISSION.md) for the three course deliverables and their status. The six-page report is in `output/pdf/`; the recording script, proposal, measured verification results and defense notes are in `docs/`. Optional English narration is `output/demo/narration-guide.mp3` (about four minutes), a guide rather than a recorded demonstration.

To rebuild the PDF, install the optional `requirements-report.txt` dependencies and run `python scripts/build_report.py`. These document dependencies are not needed to run the app.

All 116 local application tests pass, together with TypeScript and the production build. Two owner-authorized live shop-mode checks returned product price/stock and inventory totals matching the real database, without changing business records. The retained synthetic smoke run produced four completed answers and two bounded fallbacks; it measures a separate sample workflow. GitHub CI repeats installation, tests, build and evaluation on every push. See `docs/verification.md` for scope and results. Browser appearance was not visually verified because a saved access rule blocked it.

The owner chose to keep the repository private and record Q3 personally. The course's public-repository requirement and video URL remain pending. No course form has been submitted.

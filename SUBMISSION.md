# Capstone hand-in

The application lives in `LLMAPP/moto-shop` with one folder level. Its visible brand is `shop-name`. All 118 local tests, TypeScript and production-build checks passed on 12 October 2026. Two earlier live shop-mode requests returned answers and evidence matching the real database, with no business records changed. The saved synthetic benchmark and six-case model smoke report remain separate from these real-inventory checks.

## Q1 - Repository

https://github.com/NDN-P/moto-shop-LLMapp

The repository contains code, setup instructions, 27 invented products, 30 relevance labels, evaluation scripts/results and tests. CI checks a fresh dependency installation, tests, build and evaluation. The course requires a public repository: verify that this link opens without signing in before submitting Q1.

## Q2 - PDF report

Upload `output/pdf/moto-shop-capstone-report.pdf`. The required length is 4–8 pages.

The report source covers the intended users and problem, architecture diagram and technique choices, page screenshots, labelled evaluation and baselines, measured improvement, live integration observations, failures, and limitations and next steps. It identifies Natdanai Phurintanachot, student ID 67070230. The committed PDF (7 pages) was built on 12 October 2026 with both genuine sample-app screenshots in `docs/screenshots/`. To rebuild it, see the [screenshot instructions](docs/screenshots/README.md); the builder refuses missing images instead of silently omitting them.

## Q3 - Your recording

Follow `docs/demo-script.md` for a 3–4 minute walkthrough, then upload the recording to unlisted YouTube or a viewable Drive link and submit that URL. The course accepts a 3–6 minute recording or working live URL. A script or narration audio by itself is not a screen recording.

The optional `output/demo/narration-guide.mp3` is an English guide lasting about four minutes. Use it only when your actual displayed outcomes match the narration; otherwise read the failure replacement from the script. Do not submit the audio file as Q3.

For a recording session using your existing local login and sample inventory, open PowerShell in `LLMAPP/moto-shop`:

```powershell
$env:ASSISTANT_DATA_MODE = 'sample'
$env:DATABASE_URL = 'file:./demo.db'
powershell -ExecutionPolicy Bypass -File .\scripts\start.ps1
```

If `demo.db` is missing, first run `.\.venv\Scripts\python.exe scripts\seed-demo.py`. That command refuses to overwrite an existing file.

Use the URL printed by the launcher and confirm the **Sample catalog** badge; a second running instance may use another port. These session overrides keep the course demonstration on the invented evaluation data even when your private `.env` selects shop mode. Close this PowerShell session afterward to return to your private configuration. Shop mode is an optional read-only connection to real inventory; it sends the question and selected product fields to the course proxy, so it is outside the recorded synthetic evaluation. Keep passwords and private windows outside the recording. Show a successful live lookup and its evidence, then the actual failure of “Show motor oil under 150 baht” if it recurs, or the retained unsupported “cheapest engine oil” retrieval case. Describe the outcome you actually observe; the model can vary between runs.

## Before the in-person defense

Read `docs/defense.md`. Explain why read-only tools suit structured stock data, compare the retrieval baselines, and distinguish Recall@5 from generated-answer accuracy. For T08, explain why ten relevant products make the top-five recall ceiling 0.5. Run a new complete sample question, inspect its tool trace and show a retained failure honestly.

Before submitting, verify the repository and recording links from a signed-out browser and upload the final PDF through the course form.

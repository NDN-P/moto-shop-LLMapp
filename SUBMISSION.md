# Capstone hand-in

The application lives in `LLMAPP/moto-shop` with one folder level. Its visible brand is `shop-name`. All 120 local tests, TypeScript and production-build checks passed on 12 October 2026. Two earlier live shop-mode requests returned answers and evidence matching the real database, with no business records changed. The saved synthetic benchmark and six-case model smoke report remain separate from these real-inventory checks.

## Q1 - Repository

https://github.com/NDN-P/moto-shop-LLMapp

The repository contains code, setup instructions, 27 invented products, 30 relevance labels, evaluation scripts/results and tests. CI checks a fresh dependency installation, tests, build and evaluation. The course requires a public repository: verify that this link opens without signing in before submitting Q1.

## Q2 - PDF report

Upload `output/pdf/moto-shop-capstone-report.pdf`. The required length is 4–8 pages.

The report source covers the intended users and problem, architecture diagram and technique choices, page screenshots, labelled evaluation and baselines, measured improvement, live integration observations, failures, and limitations and next steps. It identifies Natdanai Phurintanachot, student ID 67070230, School of Information Technology, KMITL. The committed PDF is a 4-page two-column paper built from `report/moto-shop-capstone-report.tex` with `tectonic -X compile report/moto-shop-capstone-report.tex --outdir output/pdf`, using the genuine sample-app screenshots in `docs/screenshots/`.

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

Use the URL printed by the launcher and confirm the **Sample catalog** badge; a second running instance may use another port. These session overrides keep the course demonstration on the invented evaluation data even when your private `.env` selects shop mode. Close this PowerShell session afterward to return to your private configuration. Shop mode is an optional read-only connection to real inventory; it sends the question and selected product fields to the course proxy, so it is outside the recorded synthetic evaluation. Keep passwords and private windows outside the recording. Show a successful live lookup such as “What is the sample price and stock for SKU SM-S06?” with its evidence. For the failure, ask “What is the cheapest engine oil?”: the cited part 10 (61 THB) is not the cheapest, because part 11 is 59 THB. Show Inventory to prove it, and explain that the citation is valid but the answer is wrong because search has no price sorting. Describe the outcome you actually observe; the model can vary between runs.

## Before the in-person defense

Read `docs/defense.md`. Explain why read-only tools suit structured stock data, compare the retrieval baselines, and distinguish Recall@5 from generated-answer accuracy. For T08, explain why ten relevant products make the top-five recall ceiling 0.5. Run a new complete sample question, inspect its tool trace and show a retained failure honestly.

Before submitting, verify the repository and recording links from a signed-out browser and upload the final PDF through the course form.

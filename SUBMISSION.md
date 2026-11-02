# Capstone hand-in

Author: Natdanai Phurintanachot, student ID 67070230, School of Information Technology, KMITL, 67070230@kmitl.ac.th.

The application lives in `LLMAPP/moto-shop` with one folder level. Its visible brand is `shop-name`. The main evaluation uses the owner's real shop inventory (27 active products, 369 units) with 30 new held-out questions; an invented catalog was the development set. The suite has 120 tests: 73 JavaScript and 47 Python (43 in `assistant/`, 4 in `scripts/`). Real SKUs and part descriptions encode private cost data, so they appear in no committed file, screenshot or saved trace.

## Q1 - Repository

https://github.com/NDN-P/moto-shop-LLMapp

The repository contains code, setup instructions, both catalogs (the real one without SKUs or descriptions), 60 labelled questions (30 per catalog), evaluation scripts/results and tests. CI checks a fresh dependency installation, tests, build and evaluation. The course requires a public repository: the owner must make it public, then verify that this link opens without signing in before submitting Q1.

## Q2 - PDF report

Upload `output/pdf/moto-shop-capstone-report.pdf`. It has 4 pages; the required length is 4–8 pages.

The report source covers the intended users and problem, architecture diagram and technique choices, page screenshots, the labelled held-out real-catalog evaluation and baselines, the measured improvement, live runs on the real database, failures, and limitations and next steps. The committed PDF is a 4-page two-column paper built from `report/moto-shop-capstone-report.tex` with `tectonic -X compile report/moto-shop-capstone-report.tex --outdir output/pdf`, using the app screenshots in `docs/screenshots/`.

## Q3 - Your recording

Record a 3–5 minute walkthrough in shop mode on the real data, following `docs/demo-script.md`, then upload it to unlisted YouTube or a viewable Drive link and submit that URL. The course accepts a 3–6 minute recording or working live URL. A script by itself is not a screen recording.

Open PowerShell in `LLMAPP/moto-shop`. The launcher uses the owner's private `.env` (shop mode, real database):

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\start.ps1
```

Use the URL printed by the launcher and confirm the **Shop inventory** badge. Shop mode reads the inventory without writes and sends the question and selected product fields to the course proxy. Real SKUs encode private cost data, so keep them off camera. Inventory shows SKU and Supplier columns and Low Stock shows a Supplier column: crop them out, or use a browser window narrower than 768 px, which hides both Inventory columns. Do not open Inventory's edit dialog (SKU and description fields) or the "All Suppliers" filter. On the Assistant page, keep "Lookup details" collapsed: in shop mode it prints the raw tool trace with real SKUs (the sources table is safe). Narrate the trace, or show the SKU-stripped `assistant/data/live_results_shop.json`. Keep passwords and `.env` out of the recording too. Show the success case "How much is PTT 0.8 engine oil and how many are in stock?" with its sources. For the failure, ask "What is the cheapest engine oil?": the answer cites Castrol Activ 0.8 at 118 THB, but PTT 0.5 at 53 THB is cheaper. Prove it on the Inventory page, and explain that the citation is valid but the answer is wrong because search has no price sorting. Describe the outcome you actually observe; the model can vary between runs.

## Before the in-person defense

Read `docs/defense.md`. Explain why read-only tools suit structured stock data, compare the retrieval baselines (substring 0.111, BM25 0.583, enhanced 0.833 frozen and 0.944 with brand aliases on the held-out real test split), and distinguish Recall@5 from generated-answer accuracy. Run a new complete question, inspect its tool trace and show a retained failure honestly.

Before submitting, verify the repository and recording links from a signed-out browser and upload the final PDF through the course form.

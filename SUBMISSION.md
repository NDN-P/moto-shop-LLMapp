# Capstone hand-in

The application lives in `LLMAPP/moto-shop` with one folder level. Its visible brand is `shop-name`. All 100 app tests pass. The Python class-proxy integration was exercised with invented products only.

## Q1 - Repository

https://github.com/NDN-P/moto-shop-LLMapp

Code, setup instructions, 27 invented products, 30 relevance labels, evaluation scripts/results and tests are committed. Clean-install CI passed. The repository remains **private**, as requested. The course explicitly requires a public repository, so Q1 does not meet that requirement while it stays private. Do not assume that an instructor can open a private link.

## Q2 - PDF report

Upload `output/pdf/moto-shop-capstone-report.pdf` (6 pages).

It covers the intended users and problem, architecture diagram and technique choices, labelled evaluation and baseline, measured improvement, live integration observations, failures and limitations.

## Q3 - Your recording

You chose to record the demonstration yourself. Follow `docs/demo-script.md` for a 3-4 minute walkthrough, then upload the recording to unlisted YouTube or a viewable Drive link and submit that URL. A script or narration audio by itself is not a screen recording.

The optional `output/demo/narration-guide.mp3` is an English guide lasting about four minutes. Use it only when your actual displayed outcomes match the narration; otherwise read the failure replacement from the script. Do not submit the audio file as Q3.

For a recording session using your existing local login and sample inventory, open PowerShell in `LLMAPP/moto-shop`:

```powershell
$env:DATABASE_URL = 'file:./demo.db'
powershell -ExecutionPolicy Bypass -File .\scripts\start.ps1
```

If `demo.db` is missing, first run `.\.venv\Scripts\python.exe scripts\seed-demo.py`. That command refuses to overwrite an existing file.

Use `demo.db`, not the private shop database. The assistant is sample-only. Keep passwords and private windows outside the recording. Show a successful real lookup and its evidence, then the actual failure of “Show motor oil under 150 baht” if it recurs, or the retained unsupported “cheapest engine oil” retrieval case. Describe the outcome you actually observe; the model can vary between runs.

## Before the in-person defense

Read `docs/defense.md`. Be able to explain why a read-only tool agent suits structured stock data, what the 91.2% test Recall@5 means, and why it does not mean 91.2% answer accuracy. Run a new complete sample question, inspect its tool trace and show a retained failure honestly.

No course form has been submitted by the assistant.

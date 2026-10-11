# Motorcycle shop assistant — narrated demo

Target length: 3–4 minutes. Read the narration naturally; screen directions are not spoken. Use the success section only after observing a real, grounded class-model response. Otherwise use the failure replacement below. No performance numbers are assumed by this script.

Optional audio: `output/demo/narration-guide.mp3` is a synthetic English narration guide, not a recorded application demonstration or evidence of a successful API call. Use its success narration only after your live outcomes match the script; otherwise record the failure replacement in your own voice. You will record the actual screen demonstration yourself. Rebuild the guide on Windows with `powershell -ExecutionPolicy Bypass -File .\scripts\build-narration.ps1`; it uses Microsoft Zira Desktop, local Python for the duration check, and FFmpeg on `PATH` or the local ignored tools folder. A different FFmpeg executable can be supplied with `-FfmpegExecutable`.

## Before recording

- Start the existing shop and sign in. Keep credentials, supplier contacts and private records out of the recording.
- Open Dashboard, Inventory, Low Stock and Assistant in the actual browser. Show the existing management UI locally; do not copy real inventory records into the assistant.
- The assistant must show **Sample catalog**. Its app bridge sends questions and invented fixture results, with no shop database path.
- Use the invented SKU `SM-S06` (part ID 6) for the lookup: “What is the sample price and stock for SKU SM-S06?” For the no-match question ask about sample part ID `9999`, which is absent from the current fixture. Recheck these against `assistant/data/catalog.json` if the fixture changes.
- Run `python assistant/evaluate.py` with the documented Python environment. Show its current output or `assistant/data/evaluation_results.json`. Read only results actually generated for the invented sample fixture.

## 0:00–0:30 — Purpose

Screen: dashboard, then briefly the navigation.

> Hello. This project adds an LLM assistant to an existing motorcycle parts management application. The practical goal is to help someone find products, check prices, and identify low stock through natural language. I kept the working management system and added a small, read-only assistant with visible evidence and a repeatable evaluation. It is intended for everyday inventory questions, with the underlying records visible for checking each response.

## 0:30–1:00 — Existing shop workflow

Screen: open Inventory, show its search and filters; then open Low Stock. Do not submit mutations during this demo.

> The dashboard summarizes the shop. Inventory contains product names, categories, prices, quantities, and minimum stock thresholds. It supports search, filters, product editing, and photos. The Low Stock page compares each quantity with its threshold. Separate pages manage suppliers, stock movements, sales trends, and warehouse storage. These features remain part of the existing application. This demonstration checks them without changing quantities or deleting records.

## 1:00–1:35 — Sample-data boundary

Screen: open Assistant and point to the sample badge and disclosure.

> The assistant uses an invented sample catalog, separate from real business inventory. The label makes that distinction visible. Only the question and sample tool results go to the class proxy. The application bridge does not pass the shop database path. The dashboard pages still use the local shop database; the assistant's sample results describe a different dataset. I use generic sample questions and keep private business data out of this chat.

## 1:35–2:20 — Genuine lookup and no-match behavior

Screen: ask about the chosen invented product. Wait for completion; open its sample sources and lookup details. Then ask about the confirmed nonexistent sample part ID. Speak the following only when the displayed outcomes support it.

> Here I ask about a product from the sample catalog. The class model chooses a native function call, and Python validates its arguments before running the lookup. The source table shows the returned part ID, price, and stock, so I can compare the answer with its evidence. The lookup details expose the actual tool request and result. Next, I ask about a part ID absent from the sample catalog. The displayed result reports that no matching part was found.

## 2:20–2:50 — Guardrails

Screen: show the trace, then the fitment disclosure. Optionally point to the agent constants in the editor.

> The assistant has an allowlist of read-only tools. It cannot modify stock or run arbitrary SQL. Each request is bounded by four model turns and six tool calls. Repeated identical calls are blocked. Final output is validated, and product citations must refer to returned evidence. Motorcycle compatibility remains unverified; the user should check the model, year, and manual or consult a mechanic.

## 2:50–3:30 — Evaluation

Screen: show the freshly generated evaluation summary and one question with its expected and retrieved IDs. Keep actual values visible; do not replace them with estimates.

> This evaluation compares the original name and SKU substring search with the improved bilingual retrieval. Both run on the same invented catalog and labeled questions. The report includes Recall at five, reciprocal rank, and a separate measure for questions with no relevant products. I show the measured results from this run. I inspect individual retrieved IDs as well as averages, because a good average can hide important failures. These are deterministic retrieval measurements; they do not establish the quality of generated answers or production reliability.

## 3:30–3:55 — Limitations and result

Screen: return to Assistant with its sample badge and evidence visible.

> The result is an integrated assistant that can explain its catalog lookups while preserving the existing shop workflow. The current demonstration uses sample products, not live stock. Important limitations are model errors, incomplete product descriptions, and missing fitment information. The source table, bounded execution, and evaluation make those limits easier to inspect.

## Replacement for 1:35–2:20 when the live model fails

Screen: show the actual configuration, connection error, or bounded fallback. Keep the sample badge visible. Do not show a prerecorded answer as a live result.

> This run shows an assistant connection or response failure, so it does not demonstrate a completed model answer. The interface reports the failure instead of presenting an invented result. The application is still restricted to the invented sample catalog. I can inspect and test the lookup functions locally, but a successful live model run is still needed to verify the full function-calling loop. The evaluation I show next measures deterministic retrieval only. It provides evidence about catalog matching, separately from model behavior.

With this replacement, show the agent guardrails in the editor at 2:20 rather than claiming that a successful lookup trace was produced. Describe the exact observed error if asked; configuration failure, a proxy error and a bounded model fallback are different outcomes.

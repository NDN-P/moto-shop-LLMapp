# Short live-defense guide

## Opening explanation

“I reused the existing motorcycle shop application and added a bounded, read-only catalog assistant. The class model receives invented sample products only. Product answers expose their source IDs and tool trace, and failed validation produces a fallback. I evaluated retrieval separately from generated answers.”

Show the sample badge before asking a model question. Use the seeded `demo.db` as described in `SUBMISSION.md`: dashboard and inventory start with the same invented products as the assistant's separate fixture. The assistant does not read database edits. Do not copy private business records into the chat or display credentials.

## One design choice to explain

**Why use a small bilingual retriever and an allowlist of read-only tools?**

“For a 27-product demonstration catalog, product names, SKUs, categories and sizes are useful explicit fields. I kept the original substring search as a baseline and added category, brand and size normalization with fixed ranking weights. This is small enough to inspect and evaluate without a vector database. The model can choose searches and aggregate lookups, but argument validation controls execution. There is no arbitrary SQL or stock-write tool.”

Point to `assistant/catalog.py` for the baseline/enhanced branches and `assistant/agent.py` for the native tool schemas, limits and final validation. Explain that descriptions guide the model, while executable checks enforce the tool/data boundary. The adapter uses the OpenAI Python client with the exact class model, rather than treating a simulated response as a live answer. The protocol follows the [official function-calling documentation](https://developers.openai.com/api/docs/guides/function-calling).

## One evaluation number to explain

“On my 20-question synthetic evaluation split, Recall@5 increased from 37.6% to 91.2%. This is the average fraction of relevant labeled products present in the first five retrieval results, calculated over 17 answerable questions. It measures catalog retrieval, not generated-answer accuracy. Three no-match questions are scored separately.”

Show `assistant/data/evaluation_results.json`, then an individual question's `relevant_ids` and `retrieved_ids`. The dataset has 10 development and 20 evaluation questions, with labels authored alongside the invented catalog. Acknowledge that the benchmark is not independently blinded. If asked about MRR, explain the reciprocal rank of the first relevant result; the evaluation-split mean increased from 41.2% to 94.1%.

Keep T20 visible as a failure: “cheapest engine oil” is outside the current comparison grammar and retrieves nothing. Do not claim all questions work or that retrieval percentages equal LLM answer accuracy.

## Demonstrate a new sample input

Use a question the examiner chooses about the invented catalog. For a concrete product, try “What is the sample price and stock for SKU SM-S06?” The current fixture contains sample part ID 6 for that SKU. For a supported aggregate, try “Which parts are low on stock?” or “What are our inventory totals?” For a negative case, ask about sample part ID 9999, which is absent from the current fixture.

Wait for the actual result. Open its source table and lookup details. Compare IDs and values with the returned sample records. If the model returns a fallback or connection error, explain that observed outcome and inspect the trace; do not present a stored answer as a successful new run.

The final recorded six-question smoke run produced four non-fallback answers. The broad motor-oil price request fell back despite successful retrieval, and the injection request fell back without tools. This is a completion observation on six inputs, not a measured answer-accuracy rate.

## Reproduce checks

Run from the `moto-shop` folder with the documented Node environment and Python virtual environment:

```powershell
.\.venv\Scripts\python.exe -m unittest assistant.test_agent assistant.test_catalog -v
.\.venv\Scripts\python.exe -m unittest discover -s scripts -p "test_*.py" -v
.\.venv\Scripts\python.exe assistant/evaluate.py
npm run check
npm test
npm run dev
```

The first three commands are offline. A safe, separate new-input lookup is:

```powershell
.\.venv\Scripts\python.exe -c "import json; from assistant.catalog import Catalog; print(json.dumps(Catalog().search_parts('SwiftMoto sport 0.6L'), ensure_ascii=True))"
```

This tests deterministic retrieval only. To repeat the bounded real-proxy smoke run, use the command below after configuring `OPENAI_API_KEY` and `OPENAI_BASE_URL` privately. It sends invented sample questions/results and overwrites the saved live smoke report:

```powershell
.\.venv\Scripts\python.exe assistant/live_evaluate.py
```

The assistant requires a clearly marked synthetic fixture; database-backed catalogs and CLI database paths are rejected before model access. Keep `.env`, API keys, real database files and supplier/customer records outside the submitted material.

## If asked what is unfinished

“Browser visual review was blocked by the saved access permission, so I cannot claim that rendered layout and interactions were visually verified. The model can still fail after a correct lookup. Comparative search and motorcycle fitment are incomplete. I kept those failures in the evidence and bounded execution rather than promising perfect answers.”

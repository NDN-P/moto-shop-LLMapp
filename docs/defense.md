# Short live-defense guide

## Opening explanation

“I reused the existing motorcycle shop application and added a bounded, read-only catalog assistant. This demonstration uses invented sample products. An optional shop mode can read real inventory and send selected product evidence to the approved course proxy. Product answers expose their source IDs and tool trace, and failed validation produces a fallback. I evaluated retrieval separately from generated answers, using synthetic data only.”

Set `ASSISTANT_DATA_MODE=sample` and `DATABASE_URL=file:./demo.db` before launching, as shown in `SUBMISSION.md`, even if the private `.env` uses shop mode. Show the **Sample catalog** badge before asking a question. Dashboard and inventory start with the same invented products as the assistant's separate fixture. In sample mode the assistant does not read database edits. Do not copy private business records into the sample chat or display credentials.

For private shop use, `ASSISTANT_DATA_MODE=shop` reads `DATABASE_URL` through a read-only connection. Only the question and selected `id`, `name`, `sku`, `category`, `price`, `stock`, `minStock` fields, or computed inventory totals, go to the course proxy. Descriptions, supplier details, photos and movement history are excluded. Shop mode permits only `https://llm.nat-d.uk/v1`, allowing surrounding whitespace and a trailing slash; a different endpoint is rejected before networking. Sample mode retains a configurable endpoint. Login remains required in both modes. The recorded evaluation and six-request smoke observations do not validate shop-mode answer quality.

## One design choice to explain

**Why use a small bilingual retriever and an allowlist of read-only tools?**

“For a 27-product demonstration catalog, product names, SKUs, categories and sizes are useful explicit fields. I compare the original substring search with BM25 and with category, brand and size normalization using fixed ranking weights. This is small enough to inspect and evaluate without a vector database. The model can choose searches and aggregate lookups, but argument validation controls execution. There is no arbitrary SQL or stock-write tool.”

Point to `assistant/catalog.py` for the substring/enhanced branches, `assistant/evaluate.py` for BM25, and `assistant/agent.py` for the native tool schemas, limits and final validation. Explain that descriptions guide the model, while executable checks enforce the tool/data boundary. The adapter uses the OpenAI Python client with the exact class model, rather than treating a simulated response as a live answer. The protocol follows the [official function-calling documentation](https://developers.openai.com/api/docs/guides/function-calling).

## One evaluation number to explain

“On my 20-question synthetic evaluation split, Recall@5 is 37.6% for whole-query substring search, 49.4% for BM25 and 91.2% for the bilingual enhanced method. This is the average fraction of relevant labeled products present in the first five retrieval results, calculated over 17 answerable questions. It measures catalog retrieval, not generated-answer accuracy. Three no-match questions are scored separately.”

Show `assistant/data/evaluation_results.json`, then an individual question's `relevant_ids` and `retrieved_ids`. The dataset has 10 development and 20 evaluation questions, with labels authored alongside the invented catalog. Acknowledge that the benchmark is not independently blinded. If asked about MRR, explain the reciprocal rank of the first relevant result; evaluation-split MRR is 41.2% for substring search, 52.9% for BM25 and 94.1% for enhanced retrieval.

Keep T20 visible as a failure: “cheapest engine oil” is outside the current comparison grammar and retrieves nothing. Do not claim all questions work or that retrieval percentages equal LLM answer accuracy.

**Why add BM25?** Whole-query name/SKU substring matching is weak for English queries against Thai names. BM25 provides a stronger lexical comparison using `k1=1.2` and `b=0.75`, NFKC normalization and case folding, with Thai tokens preserved. It searches name, SKU, category and description with equal treatment and shares the structured filters. It has no translation or alias expansion. This is a retrospective comparison on the same self-authored benchmark, not an independently blinded experiment or a tuned BM25 result. Read its actual result from the generated evaluation file.

**Why does T08 only score 0.5?** Ten products are labelled relevant, but Recall@5 keeps at most five results. Returning five relevant products gives `5 / 10 = 0.5`, which is the metric's ceiling for that question. Check the retrieved IDs before calling it a search miss. The macro average includes this ceiling; it has not been normalized away.

## Demonstrate a new sample input

Use a question the examiner chooses about the invented catalog. For a concrete product, try “What is the sample price and stock for SKU SM-S06?” The current fixture contains sample part ID 6 for that SKU. For a supported aggregate, try “Which parts are low on stock?” or “What are our inventory totals?” For a negative case, ask about sample part ID 9999, which is absent from the current fixture.

Wait for the actual result. Open its source table and lookup details. Compare IDs and values with the returned sample records. If the model returns a fallback or connection error, explain that observed outcome and inspect the trace; do not present a stored answer as a successful new run.

Use a complete question each time: chat requests are independent and do not carry previous turns as context. Fixed vocabulary cannot cover every paraphrase. For “cheapest” requests, explain that price sorting is unsupported: the live answer to “What is the cheapest engine oil?” cites part 10 at 61 THB, but part 11 at 59 THB is cheaper, because the model asked for one name-ordered result. The citation is valid, yet the answer is wrong. “Under X baht” works through the `max_price` filter.

The current six-question synthetic smoke run produced five non-fallback answers; the injection request fell back without tools. Earlier runs fell back on correct answers because the model wrapped its JSON in a markdown fence; the agent now extracts the fenced object before the same strict validation. This is a completion observation on six sample inputs, not a measured answer-accuracy rate or a real-inventory validation.

## Reproduce checks

Run from the `moto-shop` folder with the documented Node environment and Python virtual environment:

```powershell
.\.venv\Scripts\python.exe -m unittest assistant.test_agent assistant.test_catalog -v
.\.venv\Scripts\python.exe -m unittest discover -s scripts -p "test_*.py" -v
.\.venv\Scripts\python.exe assistant/evaluate.py
npm run check
npm test
$env:ASSISTANT_DATA_MODE = 'sample'
$env:DATABASE_URL = 'file:./demo.db'
npm run dev
```

The first three commands are offline. A safe, separate new-input lookup is:

```powershell
.\.venv\Scripts\python.exe -c "import json; from assistant.catalog import Catalog; print(json.dumps(Catalog().search_parts('SwiftMoto sport 0.6L'), ensure_ascii=True))"
```

This tests deterministic retrieval only. To repeat the bounded real-proxy smoke run, use the command below after configuring `OPENAI_API_KEY` and `OPENAI_BASE_URL` privately. It sends invented sample questions/results and overwrites the saved live smoke report:

```powershell
$env:ASSISTANT_DATA_MODE = 'sample'
.\.venv\Scripts\python.exe assistant/live_evaluate.py
```

Sample mode requires a clearly marked synthetic fixture. Shop mode is an explicit opt-in through trusted server configuration; the browser and CLI question payload cannot choose a database path. The application has 120 tests, recorded clean-install CI and two authorized live shop checks. Those two checks verified product values and totals; they do not establish general answer accuracy. Keep `.env`, API keys, real database files and supplier/customer records outside the submitted material.

## If asked what is unfinished

“The model can fail after a correct lookup, and valid source IDs do not prove every sentence is correct. Comparative search and verified motorcycle fitment are incomplete. The benchmark measures retrieval on invented data; it does not score generated final answers. Next I would add independent questions, labelled final-answer checks and verified fitment data, then test with shop staff.”

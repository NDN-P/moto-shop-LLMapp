# Short live-defense guide

## Opening explanation

“I reused the existing motorcycle shop application and added a bounded, read-only catalog assistant. It runs in shop mode on the owner's real inventory and sends selected product evidence to the approved course proxy. Product answers expose their source IDs and tool trace, and failed validation produces a fallback. I built the retriever on an invented catalog, froze it, and tested it on 30 new questions over the real catalog. I evaluated retrieval separately from generated answers.”

Launch with `powershell -ExecutionPolicy Bypass -File .\scripts\start.ps1` and the owner's private `.env` (shop mode), as shown in `SUBMISSION.md`, and show the **Shop inventory** badge before asking a question. The Inventory and Low Stock pages show the SKU and Supplier columns; SKUs and part descriptions encode private cost data, so do not display them or put them in any file, screenshot or saved trace. Without the real database, an optional sample mode (`ASSISTANT_DATA_MODE=sample`, `DATABASE_URL=file:./demo.db`) runs the invented development catalog. Do not display credentials.

In shop mode (`ASSISTANT_DATA_MODE=shop`) the app reads `DATABASE_URL` through a read-only connection. Only the question and selected `id`, `name`, `sku`, `category`, `price`, `stock`, `minStock` fields, or computed inventory totals, go to the course proxy. Descriptions, supplier details, photos and movement history are excluded. Shop mode permits only `https://llm.nat-d.uk/v1`, allowing surrounding whitespace and a trailing slash; a different endpoint is rejected before networking. Sample mode retains a configurable endpoint. Login remains required in both modes. The assistant still sends SKUs to the course proxy; dropping them is a listed next step. The seven-question live run on the real database checks one set of inputs and does not estimate general answer quality.

## One design choice to explain

**Why use a small bilingual retriever and an allowlist of read-only tools?**

“For a 27-product shop catalog, product names, SKUs, categories and sizes are useful explicit fields. I compare the original substring search with BM25 and with category, brand and size normalization using fixed ranking weights. This is small enough to inspect and evaluate without a vector database. The model can choose searches and aggregate lookups, but argument validation controls execution. There is no arbitrary SQL or stock-write tool.”

Point to `assistant/catalog.py` for the substring/enhanced branches, `assistant/evaluate.py` for BM25, and `assistant/agent.py` for the native tool schemas, limits and final validation. Explain that descriptions guide the model, while executable checks enforce the tool/data boundary. The adapter uses the OpenAI Python client with the exact class model, rather than treating a simulated response as a live answer. The protocol follows the [official function-calling documentation](https://developers.openai.com/api/docs/guides/function-calling).

## One evaluation number to explain

“On the real shop catalog, held out, the 20-question test split gives Recall@5 of 0.111 for the shop's original substring search, 0.583 for BM25 and 0.833 for my bilingual enhanced method, frozen before it saw this data. After I added English aliases for the real brands it is 0.944, but that step is post hoc, so 0.833 is the honest held-out number. Recall@5 is the average fraction of relevant labeled products present in the first five retrieval results, over 18 answerable questions. It measures catalog retrieval, not generated-answer accuracy. Three no-match questions are scored separately.”

Show `assistant/data/evaluation_results_shop_frozen.json` and `assistant/data/evaluation_results_shop.json`, then an individual question's `relevant_ids` and `retrieved_ids`. The set has 30 questions (10 development, 20 test, 3 with no relevant product), labeled by one person. Acknowledge that the benchmark is small, self-authored and not independently blinded. If asked about MRR, explain the reciprocal rank of the first relevant result; on the real test split it equals Recall@5 (0.111, 0.583, 0.833, 0.944). On the invented development catalog the test Recall@5 is 0.376, 0.494 and 0.912, with MRR 0.412, 0.529 and 0.941; the drop from 0.912 to 0.833 is the cost of meeting brand names the vocabulary had never seen.

Keep ST20 (T20 on the invented catalog) visible as the only remaining miss: “cheapest engine oil” is outside the current comparison grammar. Do not claim all questions work or that retrieval percentages equal LLM answer accuracy.

**Why add BM25?** Whole-query name/SKU substring matching is weak for English queries against Thai names. BM25 provides a stronger lexical comparison using `k1=1.2` and `b=0.75`, NFKC normalization and case folding, with Thai tokens preserved. It searches name, SKU, category and description with equal treatment and shares the structured filters. It has no translation or alias expansion. This is a retrospective comparison on the same self-authored benchmark, not an independently blinded experiment or a tuned BM25 result. Read its actual result from the generated evaluation file.

**Why does T08 only score 0.5?** (Invented development catalog.) Ten products are labelled relevant, but Recall@5 keeps at most five results. Returning five relevant products gives `5 / 10 = 0.5`, which is the metric's ceiling for that question. Check the retrieved IDs before calling it a search miss. The macro average includes this ceiling; it has not been normalized away.

## Demonstrate a new input

Use a question the examiner chooses about the shop inventory. For a concrete product, try “How much is PTT 0.8 engine oil and how many are in stock?” (70 THB, 19 in stock in the reported run). For a supported aggregate, try “Which parts are low on stock?” or “What are our inventory totals?” For a negative case, ask about tubeless tires, which the shop does not stock.

Wait for the actual result. Open its source table and lookup details. Compare IDs and values with the Inventory page, keeping the SKU and Supplier columns out of view. If the model returns a fallback or connection error, explain that observed outcome and inspect the trace; do not present a stored answer as a successful new run.

Use a complete question each time: chat requests are independent and do not carry previous turns as context. Fixed vocabulary cannot cover every paraphrase. For “cheapest” requests, explain that price sorting is unsupported: the live answer to “What is the cheapest engine oil?” cites Castrol Activ 0.8 at 118 THB, but PTT 0.5 at 53 THB is cheaper, because the model asked for one result and search does not order by price. The citation is valid, yet the answer is wrong. “Under X baht” works through the `max_price` filter.

The live run on the real inventory had seven questions: five correct, the injection request refused with no tools, and the cheapest-oil question wrong. The invented-catalog smoke run completed five of six (3/6, then 4/6 after the citation fix, then 5/6 after the fenced-JSON fix); the injection request fell back without tools. Earlier runs fell back on correct answers because the model wrapped its JSON in a markdown fence; the agent now extracts the fenced object before the same strict validation. These are completion observations on a few fixed inputs, not a measured answer-accuracy rate.

## Reproduce checks

Run from the `moto-shop` folder with the documented Node environment and Python virtual environment:

```powershell
.\.venv\Scripts\python.exe -m unittest assistant.test_agent assistant.test_catalog -v
.\.venv\Scripts\python.exe -m unittest discover -s scripts -p "test_*.py" -v
.\.venv\Scripts\python.exe assistant/evaluate.py
.\.venv\Scripts\python.exe assistant/evaluate.py --catalog assistant/data/shop_catalog.json --questions assistant/data/questions_shop.json --output tmp/evaluation_shop_check.json
npm run check
npm test
powershell -ExecutionPolicy Bypass -File .\scripts\start.ps1
```

The Python commands are offline; the second evaluation reproduces the real-catalog table (0.944 with aliases; the frozen 0.833 is saved in `evaluation_results_shop_frozen.json`). `start.ps1` uses the private `.env`; for the invented catalog instead, set `ASSISTANT_DATA_MODE=sample` and `DATABASE_URL=file:./demo.db` first. A safe, separate new-input lookup is:

```powershell
.\.venv\Scripts\python.exe -c "import json; from assistant.catalog import Catalog; print(json.dumps(Catalog().search_parts('SwiftMoto sport 0.6L'), ensure_ascii=True))"
```

This tests deterministic retrieval only. To repeat the bounded real-proxy smoke run on the invented catalog, use the command below after configuring `OPENAI_API_KEY` and `OPENAI_BASE_URL` privately. It sends invented sample questions/results and overwrites the saved live smoke report (the real-inventory run uses `live_evaluate.py --shop <database file>` instead and sends real product fields):

```powershell
$env:ASSISTANT_DATA_MODE = 'sample'
.\.venv\Scripts\python.exe assistant/live_evaluate.py
```

Sample mode requires a clearly marked synthetic fixture. Shop mode is an explicit opt-in through trusted server configuration; the browser and CLI question payload cannot choose a database path. The application has 120 tests (73 JavaScript, 47 Python), recorded clean-install CI and a seven-question live run on the real inventory. That run checked product values and totals; it does not establish general answer accuracy. Keep `.env`, API keys, real database files and supplier/customer records outside the submitted material.

## If asked what is unfinished

“The model can fail after a correct lookup, and valid source IDs do not prove every sentence is correct. Comparative search and verified motorcycle fitment are incomplete. The benchmark measures retrieval on one small shop's data; it does not score generated final answers, and the assistant still sends SKUs to the proxy. Next I would add price sorting, drop the SKU from tool evidence, log real staff questions for the owner to label, and score final answers and verified fitment.”

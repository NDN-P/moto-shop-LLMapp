# Verification and limitations

Updated on 12 October 2026. This document distinguishes deterministic tests, retrieval measurements and live model observations. None establishes a guarantee of error-free operation.

## Verification status

All 118 local tests passed on 12 October 2026 after adding BM25 regression checks, together with TypeScript and the production build. Two earlier real-inventory API requests also completed; their scope is described separately below. Clean-install CI passed for the earlier shop-mode and cleanup source commit.

| Check | Observed result | Scope |
|---|---:|---|
| Python agent tests | 26 passed | Native tool protocol, citations, bounded repair/calls, safe errors, UTF-8, explicit shop opt-in, approved proxy, read-only WAL freshness and evidence-field exclusion |
| Catalog and retrieval evaluation tests | 15 passed | Lookup/filter behavior, BM25, relevance metrics and synthetic fixture marker checks |
| Demo database seed tests | 4 passed | Invented data only, validation and refusal to overwrite an existing/private shop database |
| JavaScript/TypeScript tests | 73 passed | Server, both bridge modes, protected configuration, UI mode states, inventory, auth, uploads and retained local health check |
| TypeScript compilation check | Passed | Static checking, including the assistant routes and result types |
| Production build | Passed | Vite frontend and bundled Express server |
| Clean installation in GitHub CI | Passed for `7792ede` | Linux, Node 24 and Python 3.12: npm ci, dependency installation, TypeScript, both test suites, production build and retrieval evaluation |
| Live shop-mode API | 2 completed answers | Product price/stock and aggregate totals matched the real database; business rows unchanged |

The suite contains 118 tests: 73 JavaScript and 45 Python. Clean-install CI for the earlier source commit `7792ede` passed at https://github.com/NDN-P/moto-shop-LLMapp/actions/runs/38125121455.

Tests are evidence for the cases they exercise. They do not replace an end-to-end browser run, independent evaluation, or testing with real users. A unit test using a fake client does not establish that the live class model will behave the same way.

## Assistant data modes and model boundary

The shared `.env.example` defaults to `ASSISTANT_DATA_MODE=sample` and `DATABASE_URL=file:./demo.db`. Sample mode sends a question and invented fixture evidence to the proxy. Its bridge omits the shop database path and removes `DATABASE_URL` from the child environment; Python requires a fixture explicitly marked `synthetic: true`. Evaluation uses this fictional fixture regardless of local shop configuration.

`ASSISTANT_DATA_MODE=shop` is an opt-in for real inventory. It reads the inventory selected by `DATABASE_URL` without writes. The proxy receives the question and selected product fields (`id`, `name`, `sku`, `category`, `price`, `stock`, `minStock`), or computed inventory totals. Descriptions, supplier details, photos and movement history are excluded. Real-inventory mode requires `OPENAI_BASE_URL=https://llm.nat-d.uk/v1`, allowing surrounding whitespace and a trailing slash; other endpoints are rejected before networking. Sample mode retains a configurable endpoint.

Data mode and database selection come from trusted server configuration, not the browser question payload. The CLI still accepts only `{question}` and rejects a supplied `database_path`. Login remains required. Both modes retain validated read-only tools, four model turns, six tool calls, repeated-call blocking and final citation checks. Offline tests exercise these boundaries; the two live examples verify the connection without establishing general accuracy.

Free-text questions are sent to the proxy in both modes. Users must keep credentials, contacts and unrelated private information out of that text. The synthetic marker is a provenance assertion for the supplied fixture, not an automatic detector of sensitive content. No claim is made that arbitrary user-pasted text can be classified perfectly. For a course recording, explicitly set sample mode and `demo.db` and check the sample badge; do not record private shop screens.

## Live shop-mode integration check

Two authorized, authenticated local API requests completed through the course proxy: a product-by-ID price/stock question and an inventory-totals question. Returned names, selling prices, stock counts and aggregate evidence matched the live SQLite database. Generated answers were also checked against that evidence. All business tables were compared before and after; their records were unchanged. Raw real-product responses are retained only in ignored `tmp/`, outside Git and the submission archive. These two examples verify the connection, not general answer accuracy or real-catalog retrieval quality.

## Deterministic retrieval evaluation

The fixture contains 27 invented products. All brands, names, prices, sizes and stock quantities are fictional. There are 30 hand-labeled questions: 10 development questions and 20 fixed evaluation questions. The same author created the fixture, labels and retriever, so this is a small, self-authored evaluation rather than an independently blinded benchmark.

The legacy baseline uses case-insensitive name/SKU substring matching, ordered by name and then ID. The stronger BM25 baseline uses standard `k1=1.2` and `b=0.75`, NFKC normalization and case folding, preserving Thai lexical tokens. It treats name, SKU, category and description equally, without translation, alias expansion or tuning. All three methods share category, maximum-price and minimum-stock filters. The enhanced method adds an explicit bilingual category/brand/size vocabulary, requires matching query tokens, and ranks matches using fixed field weights. BM25 was added retrospectively to the same self-authored fixture and fixed split; it does not make the benchmark independent.

| Metric on the 20-question evaluation split | Substring | BM25 | Enhanced |
|---|---:|---:|---:|
| Recall@5 | 37.6% | 49.4% | 91.2% |
| Mean reciprocal rank | 41.2% | 52.9% | 94.1% |
| Zero-result accuracy | 100% (3/3) | 100% (3/3) | 100% (3/3) |

Recall@5 and reciprocal rank are macro-averaged over the 17 answerable evaluation questions. Zero-result accuracy is calculated separately over the 3 questions labeled as having no relevant products. These denominators matter: the 100% value does not describe overall answer accuracy.

**T08 has a Recall@5 ceiling of 0.5.** Its labels contain ten relevant motor oils, and only five results can be returned. Five relevant results therefore score `5 / 10 = 0.5`; that value alone is not evidence of a retrieval miss. Per-question IDs distinguish ranking/retrieval failures from this metric ceiling. The published macro score retains that ceiling without rescaling.

The recorded results are in `assistant/data/evaluation_results.json`, with question-level expected/retrieved IDs, the split policy and input hashes. The figures measure retrieval from this invented catalog. They do not measure generated-answer accuracy, search quality on real shop data, live stock freshness, fitment correctness or production safety.

One retained failure is **T20, “cheapest engine oil.”** The enhanced retriever returns no results, while the labeled relevant set contains the five cheapest sample oils. Comparative language and price ordering are outside its current small query grammar. This case was retained as a limitation rather than removed to improve the score; inspect each baseline's retrieved IDs separately.

## Retained live class-proxy observations on synthetic data

The recorded model is `gemma-4-E4B-it`, called through the class proxy with the native function-calling protocol. All six questions in the saved pre-shop-mode smoke run used invented sample products. That run produced:

| Question | Observed outcome |
|---|---|
| Show motor oil under 150 baht | Successful catalog tool lookup, followed by a bounded final-answer fallback |
| Which parts are low on stock? | Generated answer with verified part IDs 7, 16, 25 and 26 |
| What are our inventory totals? | Generated aggregate answer reporting 27 distinct sample parts, 363 units and 4 low-stock parts |
| Do you have tubeless tires? | Grounded no-match answer after an empty catalog result |
| Thai brake-fluid price question | Generated Thai answer using the two returned sample brake-fluid products |
| Request to delete stock and disclose the API key | Bounded fallback with no tool execution |

Thus **4 of 6 requests produced a non-fallback final answer in that run**. This is a six-request completion observation, not answer accuracy, a statistical reliability estimate or proof that every statement was independently audited. The broad price-filter request remains a known live failure even though its lookup succeeded. The injection case demonstrates the observed boundary for that one input, not universal resistance to prompt injection.

Before the citation repair, the saved run had 3 generated answers, 2 final-answer fallbacks despite successful tools, and 1 no-tool fallback. Diagnostics showed low-stock citations `[1]` where actual part IDs were required, and aggregate citations `[0]` where `[]` was required. The aggregate answer also confused low-stock parts with categories. The prompt/tool descriptions now clarify exact IDs and count meanings; the single bounded repair gives the validation reason and allowed IDs. Strict checks and the four-model-turn/six-tool-call limits were retained.

Both targeted synthetic cases succeeded in a subsequent live diagnostic, and the retained six-question run reproduced those two successes. The earlier motor-oil success was not reproduced in that suite. These observations demonstrate variability rather than a monotonic improvement in every generated answer. `assistant/data/live_results_before.json` and `assistant/data/live_results.json` preserve the before and final synthetic runs. No real-inventory live outcome or quality metric is claimed by this record.

The report screenshots were captured on 12 October 2026 from the production build in sample mode with `demo.db`, through the live class proxy. "What is the sample price and stock for SKU SM-S06?" completed with citation 6 at 168 THB and 12 units, matching `catalog.json` (Figure 2). In the same session, "Which parts are low on stock?" returned the bounded fallback, although it completed in the saved smoke run. This is a further example of run-to-run variability, not a new metric.

## Limitations & next steps

The catalog has no verified motorcycle fitment information. The assistant cannot establish compatibility, approve a repair, make a purchase or change stock. Rule-based matching does not understand every paraphrase or comparison. Each question is independent. A successful tool lookup does not guarantee a usable model response, and valid source IDs do not prove every sentence is factually correct.

Next steps are independent evaluation questions, labelled scoring of generated final answers, verified fitment and comparative-price handling, and usability testing with shop staff. Broader reliability claims need that evidence; screenshots and a short demo illustrate the interface but do not establish general correctness.

# Verification and limitations

Recorded on 11 October 2026. This document distinguishes deterministic tests, retrieval measurements, live model observations and browser review. None establishes a guarantee of error-free operation.

## What was checked

| Check | Observed result | Scope |
|---|---:|---|
| Python agent tests | 22 passed | Native tool protocol, argument validation, citations, repair/call limits, safe errors, UTF-8 output, sample-only data boundary and CLI rejection of database paths |
| Catalog and retrieval evaluation tests | 13 passed | Lookup/filter behavior, relevance metrics and synthetic fixture marker checks |
| Demo database seed tests | 4 passed | Invented data only, validation and refusal to overwrite an existing/private shop database |
| JavaScript/TypeScript tests | 61 passed in the final run | Server, bridge and application tests in the final `LLMAPP/moto-shop` folder |
| TypeScript compilation check | Passed in the completed check | Static checking, including the assistant route and result types |
| Browser visual review | Not completed | Browser access was blocked by a saved permission setting; responsive layout, interactions and rendered appearance were not visually verified |
| Clean installation in GitHub CI | Passed | Linux, Node 24 and Python 3.12: npm ci, dependency installation, TypeScript, both test suites, production build and retrieval evaluation |

The verified clean-install run is https://github.com/NDN-P/moto-shop-LLMapp/actions/runs/38122211943 (commit `c3b5fea`). Repository visibility is private at the owner's request. Browser visual review was not substituted with another browser or an indirect screen capture.

Tests are evidence for the cases they exercise. They do not replace an end-to-end browser run, independent evaluation, or testing with real users. A unit test using a fake client does not establish that the live class model will behave the same way.

## Sample-only model boundary

The app assistant sends a question and invented catalog evidence to the class proxy. Its bridge passes no database path, removes `DATABASE_URL` from the child environment and rejects non-sample modes. Python independently rejects database-backed catalogs and requires a fixture explicitly marked `synthetic: true` before constructing an API client. The CLI accepts only `{question}` and rejects an added `database_path` field. The existing local shop database functions remain separate from the model workflow.

Free-text questions are sent to the proxy. Users must keep real inventory records, contacts and other private business information out of that text. The synthetic marker is a provenance assertion for the supplied fixture, not an automatic detector of sensitive content. No claim is made that arbitrary user-pasted text can be classified perfectly.

## Deterministic retrieval evaluation

The fixture contains 27 invented products. All brands, names, prices, sizes and stock quantities are fictional. There are 30 hand-labeled questions: 10 development questions and 20 fixed evaluation questions. The same author created the fixture, labels and retriever, so this is a small, self-authored evaluation rather than an independently blinded benchmark.

The baseline uses case-insensitive name/SKU substring matching, ordered by name and then ID. Both methods share category, maximum-price and minimum-stock filters. The enhanced method adds an explicit bilingual category/brand/size vocabulary, requires matching query tokens, and ranks matches using fixed field weights.

| Metric on the 20-question evaluation split | Baseline | Enhanced |
|---|---:|---:|
| Recall@5 | 37.6% | 91.2% |
| Mean reciprocal rank | 41.2% | 94.1% |
| Zero-result accuracy | 100% | 100% |

Recall@5 and reciprocal rank are macro-averaged over the 17 answerable evaluation questions. Zero-result accuracy is calculated separately over the 3 questions labeled as having no relevant products. These denominators matter: the 100% value does not describe overall answer accuracy.

The recorded results are in `assistant/data/evaluation_results.json`, with question-level expected/retrieved IDs, the split policy and input hashes. The figures measure retrieval from this invented catalog. They do not measure generated-answer accuracy, search quality on real shop data, live stock freshness, fitment correctness or production safety.

One retained failure is **T20, “cheapest engine oil.”** Both methods return no results, while the labeled relevant set contains the five cheapest sample oils. Comparative language and price ordering are outside the current small query grammar. This case was retained as a limitation rather than removed to improve the score.

## Live class-proxy observations

The recorded model is `gemma-4-E4B-it`, called through the class proxy with the native function-calling protocol. All six final smoke questions used invented sample products. The final saved run produced:

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

Both targeted synthetic cases succeeded in a subsequent live diagnostic, and the final six-question run reproduced those two successes. The earlier motor-oil success was not reproduced in the final suite. These observations demonstrate variability rather than a monotonic improvement in every generated answer. `assistant/data/live_results_before.json` and `assistant/data/live_results.json` preserve the before and final runs.

## Remaining limits

The catalog has no verified motorcycle fitment information. The assistant cannot establish compatibility, approve a repair, make a purchase or change stock. Rule-based matching does not understand every paraphrase or comparison. A successful tool lookup does not guarantee a usable model response, and valid source IDs do not prove every sentence is factually correct. Browser visual behavior remains untested because of the access block. Further independent cases and a real browser demonstration are needed before broader reliability claims.

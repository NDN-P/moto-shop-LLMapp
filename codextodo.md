# Codex progress

Updated: 11 October 2026 (Asia/Bangkok).

## Current configuration and decisions

- Main app: `LLMAPP/moto-shop`; visible name: `shop-name`.
- Local inventory and AI use the original shop database. Login stays enabled.
- The owner explicitly allowed real product data to the course proxy at `https://llm.nat-d.uk/v1`.
- Shop-mode tool evidence contains only product ID, name, SKU, category, selling price, stock and minimum stock, plus computed inventory totals. Descriptions, supplier contacts, photos, history and credentials are excluded.
- Shared setup defaults to invented sample data. The private local `.env` selects `ASSISTANT_DATA_MODE=shop`; it must never be committed.
- GitHub repository stays private by the owner's request. The owner will record Q3 personally.

## Finished

- [x] Moved the application to a single `moto-shop` folder and changed the visible brand to `shop-name`.
- [x] Repaired inventory transactions, validation, login protection and photo handling.
- [x] Added a bounded Python function-calling assistant with checked citations and visible evidence.
- [x] Added explicit shop mode using the same SQLite database as Inventory, with read-only access and fresh committed WAL data.
- [x] Added an authenticated mode query and correct shop/sample labels before enabling chat.
- [x] Restricted real-inventory requests to the approved course proxy; browser input cannot select a database path.
- [x] Completed two authorized live shop-mode checks: product price/stock and inventory totals. Answers and evidence matched the database; all business records remained unchanged. Raw responses stay only in ignored `tmp/`.
- [x] Deleted local Manus logs, the browser debug collector and unused Manus integrations; retained local login and system health.
- [x] Passed 73 JavaScript/TypeScript tests and 43 Python tests (116 total).
- [x] Passed TypeScript compilation.
- [x] Passed production frontend/server builds and verified removal of Manus runtime assets and dependencies.
- [x] Kept the synthetic benchmark and its saved historical model observations separate from real-inventory validation.
- [x] Updated setup, recording, defense and privacy documentation; rebuilt the narration guide.

## Final checks

- [x] Rebuild and visually inspect all six pages of the updated PDF.
- [x] Scan the source snapshot and push shop-mode/cleanup commit `7792ede` with no credentials or private files.
- [x] Verify clean-install CI for shop-mode/cleanup source commit `7792ede`: https://github.com/NDN-P/moto-shop-LLMapp/actions/runs/38125121455.
- [x] Record the updated validation results and owner choices in the report, documentation and this progress log.
- [x] Refresh the submission ZIP and verify every packaged file against the staged snapshot, excluding private files and Manus assets.

## Remaining owner submission steps

- [ ] Q1 requires a public repository. It remains private by choice, so the public-link requirement is unmet.
- [ ] Record a narrated 3–6 minute Q3 screen demo, upload it to a viewable URL, and submit that URL.
- [ ] Submit the repository URL and PDF through the course form. No form has been submitted by the assistant.

Browser visual review remains unverified because of the saved access restriction. Model answers can still fail or return a bounded fallback; the synthetic retrieval metrics do not measure real-stock answer accuracy. Preserve the original database, photos and historical private backup.

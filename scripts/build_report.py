"""Build the seven-page capstone report from evaluation artifacts and real screenshots."""

import json
from pathlib import Path
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, Image
from reportlab.graphics.shapes import Drawing, Rect, String, Line, Polygon

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "output" / "pdf" / "moto-shop-capstone-report.pdf"
AUTHOR = "Natdanai Phurintanachot"
STUDENT_ID = "67070230"
REPORT_DATE = "12 October 2026"
BLUE = colors.HexColor("#125B81")
INK = colors.HexColor("#142B3B")
styles = getSampleStyleSheet()
styles.add(ParagraphStyle(name="TitleCustom", fontName="Helvetica-Bold", fontSize=29, leading=34, textColor=INK, spaceAfter=18))
styles.add(ParagraphStyle(name="SectionCustom", fontName="Helvetica-Bold", fontSize=19, leading=23, textColor=BLUE, spaceAfter=14))
styles.add(ParagraphStyle(name="BodyCustom", fontName="Helvetica", fontSize=10.5, leading=15.5, textColor=INK, spaceAfter=11, alignment=TA_LEFT))
styles.add(ParagraphStyle(name="SmallCustom", fontName="Helvetica", fontSize=8.5, leading=12, textColor=INK, spaceAfter=8))
styles.add(ParagraphStyle(name="CellCustom", fontName="Helvetica", fontSize=9, leading=12, textColor=INK))
story = []


def p(text, style="BodyCustom"):
    story.append(Paragraph(text, styles[style]))


def section(title):
    if story:
        story.append(PageBreak())
    p(title, "SectionCustom")


def table(rows, widths):
    content = [[Paragraph(escape(str(value)), styles["CellCustom"]) for value in row] for row in rows]
    result = Table(content, colWidths=widths, hAlign="LEFT", repeatRows=1)
    result.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#E1EEF5")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LINEBELOW", (0, 0), (-1, 0), 1, BLUE),
        ("LINEBELOW", (0, 1), (-1, -1), .35, colors.HexColor("#D3DDE3")),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
    ]))
    story.extend([result, Spacer(1, 14)])


def screenshot(name, caption):
    image = Image(str(screenshot_path(name)))
    image.drawWidth = 6.7 * inch
    image.drawHeight = image.imageHeight * image.drawWidth / image.imageWidth
    if image.drawHeight > 3.25 * inch:
        image.drawWidth *= (3.25 * inch) / image.drawHeight
        image.drawHeight = 3.25 * inch
    story.extend([image, Spacer(1, 7)])
    p(caption, "SmallCustom")


def screenshot_path(name):
    for suffix in (".png", ".jpg", ".jpeg"):
        path = ROOT / "docs" / "screenshots" / (name + suffix)
        if path.is_file():
            return path
    raise FileNotFoundError(f"Missing genuine app screenshot: docs/screenshots/{name}.png (or .jpg)")


def architecture():
    drawing = Drawing(482, 137)
    boxes = [(0, 88, "React browser", "Question + session"),
             (172, 88, "Express / tRPC", "Validated execFile bridge"),
             (344, 88, "Python agent", "4 turns / 6 tool attempts"),
             (172, 6, "Course proxy", "gemma-4-E4B-it"),
             (344, 6, "Catalog tools", "Fixture / read-only SQLite")]
    for x, y, title, detail in boxes:
        drawing.add(Rect(x, y, 138, 44, rx=5, fillColor=colors.HexColor("#E1EEF5"), strokeColor=BLUE))
        drawing.add(String(x + 69, y + 27, title, textAnchor="middle", fontName="Helvetica-Bold", fontSize=10, fillColor=INK))
        drawing.add(String(x + 69, y + 12, detail, textAnchor="middle", fontName="Helvetica", fontSize=8, fillColor=INK))
    for x1, y1, x2, y2 in [(138, 110, 172, 110), (310, 110, 344, 110), (413, 88, 413, 50), (344, 88, 284, 50)]:
        drawing.add(Line(x1, y1, x2, y2, strokeColor=BLUE, strokeWidth=1.5))
        if y1 == y2:
            points = [x2, y2, x2 - 6, y2 + 3, x2 - 6, y2 - 3]
        else:
            points = [x2, y2, x2 - 3, y2 + 6, x2 + 3, y2 + 6]
        drawing.add(Polygon(points, fillColor=BLUE, strokeColor=BLUE))
    story.extend([drawing, Spacer(1, 10)])


def main():
    # Check before replacing the PDF so missing evidence cannot silently disappear.
    for name in ("inventory", "assistant"):
        screenshot_path(name)
    story.clear()
    results = json.loads((ROOT / "assistant/data/evaluation_results.json").read_text(encoding="utf-8"))
    catalog = json.loads((ROOT / "assistant/data/catalog.json").read_text(encoding="utf-8"))
    live_path = ROOT / "assistant/data/live_results.json"
    live = json.loads(live_path.read_text(encoding="utf-8")) if live_path.exists() else {"results": []}
    assert catalog.get("synthetic") is True
    pct = lambda value: "n/a" if value is None else f"{value * 100:.1f}%"
    test = results["summary"]["test"]
    all_rows = results["summary"]["all"]

    p("MOTO SHOP<br/>Inventory assistant", "TitleCustom")
    p("Building LLM-Powered Applications - Capstone", "SectionCustom")
    p(f"Author: {AUTHOR}<br/>Student ID: {STUDENT_ID}<br/>Prepared: {REPORT_DATE}", "SmallCustom")
    p("A working motorcycle parts inventory application with a bounded Python tool agent, structured answers, visible product evidence and a reproducible retrieval evaluation.")
    p("The intended users are a motorcycle shop owner and counter staff who repeatedly look up Thai/English part names, prices and stock. The project extends their inventory, supplier, stock-movement and warehouse workflow. The assistant uses an invented catalog by default, or the current local inventory when the owner explicitly enables shop mode.")
    table([
        ["Capability family", "Concrete implementation"],
        ["Agentic tool use", "Native function calls through Python OpenAI; four allowlisted read-only tools."],
        ["Structured output", "Validated JSON answer and source IDs; one bounded repair attempt."],
        ["Evaluation", "30 authored relevance questions; substring and BM25 baselines compared with bilingual retrieval."],
        ["Served interface", "Authenticated React/tRPC web page with sources and lookup trace."],
    ], [1.65 * inch, 5.05 * inch])
    p("Data boundary: databases, photos and recovery files are excluded from the repository. Shop mode sends the question and selected product evidence to the owner-approved course proxy. The submitted evaluation corpus and public demo use invented names, prices and stock; clients cannot choose a database path.", "SmallCustom")

    section("1. Domain, data and user workflow")
    p(f"The reproducible corpus contains {len(catalog['parts'])} fictional products. It covers motor oil, inner tubes, brake fluid, final-drive oil and oil kits. Fictional brands and Thai/English aliases make the corpus useful for bilingual retrieval without exposing the shop's business records.")
    p("Each product has a stable numeric ID, name, SKU, category, price in Thai baht, stock count, minimum-stock threshold and optional description. Product IDs are the citation keys. Prices are displayed as selling prices; the system does not infer cost, profit or motorcycle fitment.")
    p("Shop mode reads active products from the same configured SQLite database as Inventory, including committed WAL changes. A separate demo.db can be created from the invented fixture with scripts/seed-demo.py; the seed refuses to overwrite an existing database. Demo suppliers, movements and warehouse storage start empty.")
    screenshot("inventory", "Figure 1. Running inventory page with invented demo products. No real business records are shown.")
    p("Typical task: sign in, inspect inventory or low-stock items, ask a complete question, then compare the assistant's answer against the cited product table and tool trace. Each request is independent; conversational follow-ups must repeat the relevant product or category.")

    section("2. Architecture and bounded execution")
    architecture()
    p("Read-only tools suit the structured catalog and prevent model-driven stock changes. Schema checks make malformed output detectable. Explicit lexical aliases are sufficient for this small bilingual corpus and can be compared directly with the existing substring search; embeddings are not needed for the chosen scope.", "SmallCustom")
    table([
        ["Step", "Behavior"],
        ["1. Browser", "Authenticated question (1-1000 characters) reaches protected tRPC assistant.ask."],
        ["2. Node bridge", "execFile starts Python without a shell; sends JSON stdin; 95-second timeout and 1 MB output cap."],
        ["3. Class model", "Python OpenAI calls model gemma-4-E4B-it at the configured course proxy; 20-second request timeout, no SDK retries."],
        ["4. Read-only tools", "search_parts, get_part, get_low_stock and inventory_summary read the selected fixture or local inventory."],
        ["5. Final answer", "Validated answer/source JSON is checked again by Node and rendered with evidence."],
    ], [.95 * inch, 5.75 * inch])
    p("The loop permits at most four model turns and six attempted tool calls. Invalid arguments and repeated identical calls consume the same budget as valid calls. Arguments are checked against the declared schema, including finite nonnegative prices, integer quantities and bounded result limits.")
    p("A final model response requires at least one successful lookup. If product evidence exists, the final answer must include unique citations drawn from that evidence. Aggregate-only and no-match answers can have no product IDs. Invalid JSON gets at most one repair inside the same model-turn budget; exhaustion returns a fixed fallback.")
    p("These checks enforce protocol and citation membership. They do not mathematically prove that every sentence is supported. The source table and trace let the reviewer inspect the answer; realistic answer-level evaluation remains a limitation.")
    p("The agent has no write tool, arbitrary SQL, web search, shell command or ordering capability. Compatibility is unverified; the prompt directs users to confirm motorcycle model, year and specifications against the manual or a mechanic.")
    p("Trusted server configuration selects sample or shop mode. Shop mode requires explicit opt-in and the approved course endpoint. Model evidence is limited to product IDs, names, SKUs, categories, selling prices, stock thresholds and counts; descriptions, supplier contacts, photos and history are excluded.", "SmallCustom")

    section("3. Evaluation design and measured change")
    p("Three methods share the same corpus, category/price/stock filters and five-result limit. The legacy baseline uses case-insensitive name/SKU substring matching in name/ID order. The stronger BM25 baseline ranks lexical tokens from name, SKU, category and description with standard k1=1.2 and b=0.75, Unicode normalization and case folding. It has no translations or bilingual aliases. The enhanced method adds explicit bilingual category/brand aliases, size normalization and AND matching with fixed field weights.")
    p("Thirty authored queries have manually assigned relevant product IDs: ten development and twenty test questions. The split is fixed in questions.json. It is a small synthetic benchmark authored by the implementer, not a blinded external test. Gold-empty cases are scored separately to avoid inflating retrieval recall with unsupported products.")
    metric_rows = [["Set / metric", "Substring", "BM25", "Enhanced"]]
    for label, split in (("Test (20)", test), ("All (30)", all_rows)):
        for metric, name in (("recall_at_5", "Recall@5"), ("mrr", "MRR"), ("zero_result_accuracy", "No-match accuracy")):
            metric_rows.append([f"{label}: {name}", pct(split["baseline"][metric]), pct(split["bm25"][metric]), pct(split["enhanced"][metric])])
    table(metric_rows, [2.8 * inch, 1.3 * inch, 1.3 * inch, 1.3 * inch])
    p("Recall@5 is the fraction of labelled relevant IDs retrieved in the top five, macro-averaged over answerable questions. MRR is the reciprocal rank of the first relevant hit, averaged over those same questions. No-match accuracy is the fraction of gold-empty questions that correctly return no rows.")
    p("BM25 was added as a retrospective robustness comparison after the enhanced retriever was built; the corpus, split and labels were unchanged. Its gain over substring search shows that token ranking helps, but English queries still cannot match Thai-only fields. Enhanced search beats BM25 on this authored bilingual task; the comparison does not establish general superiority to lexical retrieval.")
    p("All three methods run without an LLM. The test averages use 17 answerable questions; no-match accuracy uses only three gold-empty cases. These percentages do not measure generated-answer accuracy or retrieval quality on real inventory.")
    p("Reproduce: python assistant/evaluate.py. The JSON report records every retrieved list, relevance labels, split summaries, Python version and SHA-256 hashes of the corpus and questions.", "SmallCustom")

    section("4. Live verification and failure cases")
    rows = live.get("results", [])
    def outcome(row):
        if row.get("error_type"):
            return row["error_type"]
        if row.get("answer", "").startswith("I could not complete a grounded answer"):
            return "Bounded fallback after tools" if row.get("trace") else "Bounded fallback without tools"
        return "Completed answer: " + ", ".join(entry["tool"] for entry in row.get("trace", []))
    completed = [row for row in rows if outcome(row).startswith("Completed answer")]
    p(f"The saved synthetic smoke artifact contains {len(rows)} requests: {len(completed)} completed answers and {len(rows)-len(completed)} errors or bounded fallbacks. A trace alone does not count as a completed answer. Results and timings are in assistant/data/live_results.json. Two additional owner-authorized shop-mode checks completed with answers and evidence matching the real database; business records were unchanged and raw outputs remain local. Neither check is a general answer-quality score.")
    if rows:
        table([["Question", "Observed outcome", "Time(s)"]] + [
            ["Which brake fluids and prices? (Thai input)" if row["question"] == "มีน้ำมันเบรกอะไรบ้าง ราคาเท่าไหร่" else row["question"], outcome(row), row["elapsed_seconds"]]
            for row in rows
        ], [3.1 * inch, 2.9 * inch, .7 * inch])
    p("T08 has ten relevant products under a five-result limit: its theoretical Recall@5 ceiling is 5/10=0.5. Enhanced search reaches that ceiling with five relevant hits; that shortfall from 1.0 is a metric limit, not a retrieval miss. BM25 retrieves four relevant hits (0.4), so its additional shortfall is a miss. T20, 'cheapest engine oil', returns no rows under enhanced search: comparative wording and price ordering are unsupported. Ambiguous 'oil' and unknown spellings can also fail.")
    p("The first live run also exposed incorrect citation ordinals [1] and [0] for low-stock and summary answers. Strict validation returned fallbacks. The prompt and single repair were clarified to use exact returned IDs and define summary counts; both cases were rerun successfully. Original observations remain in live_results_before.json.", "SmallCustom")
    p("In the final six-case smoke run, the broad motor-oil request still produced a bounded fallback after retrieval. The blocked stock-deletion/key request also returned a fallback. These outcomes are retained instead of selecting only successful generations.", "SmallCustom")
    p("Unsupported tires, spark plugs, lights or brake pads must not be invented when the sample corpus lacks them. Invalid source IDs, malformed tool arguments, no-tool answers, duplicate calls and exhausted budgets are covered by offline adversarial tests. A provider outage produces a safe error rather than a fabricated inventory answer.")

    section("5. Assistant interface")
    screenshot("assistant", "Figure 2. Live class-model answer in sample mode (12 October 2026): SKU SM-S06 is cited as part 6 at 168 THB with 12 units, matching catalog.json.")
    p("The mode badge identifies the selected data source before questions are enabled. Generated answers appear above cited product rows and expandable tool details. Citations establish which product IDs were used; the reviewer must still check whether the wording is supported.")
    p("In the same capture session, 'Which parts are low on stock?' returned the bounded fallback instead of an answer, although that question completed in the saved smoke run. Identical questions can therefore succeed or fall back between runs; the fallback is safe but not useful.", "SmallCustom")
    p("Limitations &amp; next steps", "SectionCustom")
    table([
        ["Current limitation", "Next step"],
        ["Small, same-author synthetic relevance set; BM25 lacks translation.", "Collect independent Thai/English shop questions and compare bilingual retrieval methods without changing the held-out labels."],
        ["Search metrics do not score final answers; only 4 of 6 saved smoke requests completed.", "Add human-reviewed answer correctness, citation support and completion measures, including provider errors and adversarial inputs."],
        ["Fixed vocabulary; cheapest and some natural-language price requests can fail.", "Evaluate explicit sort/filter arguments and clarification behavior on new paraphrases before expanding the grammar."],
        ["No verified fitment; local single-admin sessions and no production hosting review.", "Add verified fitment data only with sources; review HTTPS, persistent sessions, rate limiting and recovery before deployment."],
    ], [3.05 * inch, 3.65 * inch])

    section("6. Reliability and reproducibility")
    p("Inventory fixes preserve business state: stock updates and their ledger records commit in one SQLite immediate transaction; invalid money, fractional IDs and negative balances are rejected. Products with movement history cannot be deleted. Supplier deletion detaches references atomically. Warehouse forms now use the API's category values.")
    p("Business routes and photo uploads require login. Uploaded files must pass extension, MIME, size and image-signature checks; random names prevent path injection. Photo cleanup is confined to the upload directory. Private credentials are required through .env and are not bundled with the source.")
    p("The server binds to 127.0.0.1 by default. Sessions are in memory and expire after 24 hours; restarting the server requires sign-in again. This local single-admin prototype requires additional rate limiting, persistent sessions, HTTPS, deployment review and backup operations before Internet hosting.")
    table([
        ["Reproduction task", "Command / artifact"],
        ["Install", "npm ci; python -m venv .venv; .venv Python -m pip install -r requirements.txt"],
        ["Create demo database", "python scripts/seed-demo.py (refuses an existing output)"],
        ["Run", "Configure .env; npm run dev. Public demo: ASSISTANT_DATA_MODE=sample and DATABASE_URL=file:./demo.db."],
        ["Validate", "npm run check; npm test; python -m unittest discover -s assistant"],
        ["Compare retrieval", "python assistant/evaluate.py; inspect evaluation_results.json"],
        ["Optional proxy smoke", "python assistant/live_evaluate.py (invented catalog only)"],
    ], [1.7 * inch, 5 * inch])
    p("Submission repository: https://github.com/NDN-P/moto-shop-LLMapp", "SmallCustom")
    p("Submission artifacts: application source, this report and a narration guide. Q3 requires a narrated 3-6 minute screen recording or a working deployed application URL, with one success and one failure case. The narration guide alone is not a demonstration video.", "SmallCustom")
    p("Validation: 118 local app tests (73 JavaScript and 45 Python), TypeScript and production build. The existing clean-install GitHub workflow runs npm ci, Python dependency installation, tests, build and retrieval evaluation on Linux, Node 24 and Python 3.12.", "SmallCustom")
    p("Implementation references: official OpenAI function-calling guide (developers.openai.com/api/docs/guides/function-calling); SQLite transaction documentation (sqlite.org/lang_transaction.html). The class model name and proxy configuration follow the supplied course instructions.", "SmallCustom")
    OUT.parent.mkdir(parents=True, exist_ok=True)
    def footer(canvas, doc):
        canvas.setStrokeColor(BLUE)
        canvas.line(42, 36, 553, 36)
        canvas.setFont("Helvetica", 8)
        canvas.setFillColor(INK)
        canvas.drawString(42, 23, f"MOTO SHOP | Inventory assistant capstone | {REPORT_DATE}")
        canvas.drawRightString(553, 23, f"{doc.page}")
    candidate = OUT.with_suffix(".building.pdf")
    try:
        SimpleDocTemplate(str(candidate), pagesize=(595.28, 841.89), rightMargin=42, leftMargin=42,
                          topMargin=40, bottomMargin=49, title="Moto Shop Inventory Assistant - Capstone",
                          author=AUTHOR).build(story, onFirstPage=footer, onLaterPages=footer)
        from pypdf import PdfReader
        reader = PdfReader(str(candidate))
        assert len(reader.pages) == 7, "Report must remain exactly seven pages"
        assert sum(len(page.images) for page in reader.pages) >= 2, "Both app screenshots must be embedded"
        candidate.replace(OUT)
    finally:
        candidate.unlink(missing_ok=True)
    print(OUT)


if __name__ == "__main__":
    main()

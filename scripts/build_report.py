"""Build the six-page capstone report from checked-in evaluation artifacts."""

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
    path = ROOT / "docs" / "screenshots" / name
    if path.exists():
        image = Image(str(path))
        image.drawWidth = 6.7 * inch
        image.drawHeight = image.imageHeight * image.drawWidth / image.imageWidth
        if image.drawHeight > 3.25 * inch:
            image.drawWidth *= (3.25 * inch) / image.drawHeight
            image.drawHeight = 3.25 * inch
        story.extend([image, Spacer(1, 7)])
        p(caption, "SmallCustom")


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
    p("Author: NDN-P / GuyG9<br/>Prepared: 11 October 2026", "SmallCustom")
    p("A working motorcycle parts inventory application with a bounded Python tool agent, structured answers, visible product evidence and a reproducible retrieval evaluation.")
    p("The intended users are a motorcycle shop owner and counter staff who repeatedly look up Thai/English part names, prices and stock. The project extends their inventory, supplier, stock-movement and warehouse workflow. The assistant uses an invented catalog by default, or the current local inventory when the owner explicitly enables shop mode.")
    table([
        ["Capability family", "Concrete implementation"],
        ["Agentic tool use", "Native function calls through Python OpenAI; four allowlisted read-only tools."],
        ["Structured output", "Validated JSON answer and source IDs; one bounded repair attempt."],
        ["Evaluation", "30 authored relevance questions, named substring baseline and improved bilingual retrieval."],
        ["Served interface", "Authenticated React/tRPC web page with sources and lookup trace."],
    ], [1.65 * inch, 5.05 * inch])
    p("Data boundary: databases, photos and recovery files are excluded from the repository. Shop mode sends the question and selected product evidence to the owner-approved course proxy. The submitted evaluation corpus and public demo use invented names, prices and stock; clients cannot choose a database path.", "SmallCustom")

    section("1. Domain, data and user workflow")
    p(f"The reproducible corpus contains {len(catalog['parts'])} fictional products. It covers motor oil, inner tubes, brake fluid, final-drive oil and oil kits. Fictional brands and Thai/English aliases make the corpus useful for bilingual retrieval without exposing the shop's business records.")
    p("Each product has a stable numeric ID, name, SKU, category, price in Thai baht, stock count, minimum-stock threshold and optional description. Product IDs are the citation keys. Prices are displayed as selling prices; the system does not infer cost, profit or motorcycle fitment.")
    p("Shop mode reads active products from the same configured SQLite database as Inventory, including committed WAL changes. A separate demo.db can be created from the invented fixture with scripts/seed-demo.py; the seed refuses to overwrite an existing database. Demo suppliers, movements and warehouse storage start empty.")
    screenshot("inventory.png", "Running application using the invented demo database. Product records shown here are sample data.")
    p("Typical task: sign in, inspect inventory or low-stock items, ask a complete question, then compare the assistant's answer against the cited product table and tool trace. Each request is independent; conversational follow-ups must repeat the relevant product or category.")
    p("Recovery: the pre-change SQLite online backup includes committed WAL data and was checked with SQLite quick_check. It is excluded from Git and the submission archive, together with the private environment, uploaded photos and original database.", "SmallCustom")

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
    p("The named baseline reproduces the shop's case-insensitive name/SKU substring matching and alphabetical product order, with the same category, price and stock filters supplied to both methods. Both methods return at most five results. The improved method adds explicit bilingual category/brand aliases, size normalization and AND token matching with fixed field weights.")
    p("Thirty authored queries have manually assigned relevant product IDs: ten development and twenty test questions. The split is fixed in questions.json. It is a small synthetic benchmark authored by the implementer, not a blinded external test. Gold-empty cases are scored separately to avoid inflating retrieval recall with unsupported products.")
    metric_rows = [["Set / metric", "Baseline", "Improved"]]
    for label, split in (("Test (20)", test), ("All (30)", all_rows)):
        for metric, name in (("recall_at_5", "Recall@5"), ("mrr", "MRR"), ("zero_result_accuracy", "No-match accuracy")):
            metric_rows.append([f"{label}: {name}", pct(split["baseline"][metric]), pct(split["enhanced"][metric])])
    table(metric_rows, [3.3 * inch, 1.7 * inch, 1.7 * inch])
    p("Recall@5 is the fraction of labelled relevant IDs retrieved in the top five, macro-averaged over answerable questions. MRR is the reciprocal rank of the first relevant hit, averaged over those same questions. No-match accuracy is the fraction of gold-empty questions that correctly return no rows.")
    p("The before/after change is retrieval normalization, measured on the same corpus and questions. Neither method calls an LLM during this evaluation. These percentages measure neither generated-answer accuracy nor retrieval quality on the owner's real inventory.")
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
    screenshot("assistant.png", "Actual assistant page. The sample-data label, cited parts and lookup details expose what the answer used.")
    p("Observed retrieval failures: T08 has ten relevant products under a five-result budget, so Recall@5 reaches only 0.5. T20, 'cheapest engine oil', returns no rows: comparative wording is unsupported by the lexical matcher. Ambiguous categories such as 'oil' need clarification, and spellings outside the explicit alias vocabulary can miss products.")
    p("The first live run also exposed incorrect citation ordinals [1] and [0] for low-stock and summary answers. Strict validation returned fallbacks. The prompt and single repair were clarified to use exact returned IDs and define summary counts; both cases were rerun successfully. Original observations remain in live_results_before.json.", "SmallCustom")
    p("In the final six-case smoke run, the broad motor-oil request still produced a bounded fallback after retrieval. The blocked stock-deletion/key request also returned a fallback. These outcomes are retained instead of selecting only successful generations.", "SmallCustom")
    p("Unsupported tires, spark plugs, lights or brake pads must not be invented when the sample corpus lacks them. Invalid source IDs, malformed tool arguments, no-tool answers, duplicate calls and exhausted budgets are covered by offline adversarial tests. A provider outage produces a safe error rather than a fabricated inventory answer.")

    section("5. Reliability, reproducibility and submission")
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
    p("The source, six-page report and narration script are prepared as reviewable artifacts. The repository is private at the owner's request; the course requires a public Q1 URL. The owner will record the 3-6 minute Q3 demonstration. These submission steps are pending, and no course upload is claimed.", "SmallCustom")
    p("Validation: all 116 local app tests passed (73 JavaScript and 43 Python), plus TypeScript and production build. Fresh GitHub CI installation also passed for shop-mode source commit 7792ede. Browser visual review remains unverified because access was blocked by a saved permission setting.", "SmallCustom")
    p("Implementation references: official OpenAI function-calling guide (developers.openai.com/api/docs/guides/function-calling); SQLite transaction documentation (sqlite.org/lang_transaction.html). The class model name and proxy configuration follow the supplied course instructions.", "SmallCustom")
    OUT.parent.mkdir(parents=True, exist_ok=True)
    def footer(canvas, doc):
        canvas.setStrokeColor(BLUE)
        canvas.line(42, 36, 553, 36)
        canvas.setFont("Helvetica", 8)
        canvas.setFillColor(INK)
        canvas.drawString(42, 23, "MOTO SHOP | Inventory assistant capstone | 11 October 2026")
        canvas.drawRightString(553, 23, f"{doc.page}")
    SimpleDocTemplate(str(OUT), pagesize=(595.28, 841.89), rightMargin=42, leftMargin=42,
                      topMargin=40, bottomMargin=49, title="Moto Shop Inventory Assistant - Capstone",
                      author="NDN-P / GuyG9").build(story, onFirstPage=footer, onLaterPages=footer)
    from pypdf import PdfReader
    assert len(PdfReader(str(OUT)).pages) == 6, "Report must remain exactly six pages"
    print(OUT)


if __name__ == "__main__":
    main()

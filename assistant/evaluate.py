"""Compare retrieval variants on hand-labelled snapshot questions; no LLM calls."""

import argparse
import hashlib
import json
import platform
from datetime import datetime, timezone
from pathlib import Path

try:
    from .catalog import Catalog
except ImportError:
    from catalog import Catalog


def score_result(retrieved, relevant):
    retrieved = list(retrieved)[:5]
    relevant = set(relevant)
    if not relevant:
        return {"recall_at_5": None, "reciprocal_rank": None,
                "zero_result_correct": not retrieved}
    first = next((rank for rank, part_id in enumerate(retrieved, 1) if part_id in relevant), None)
    return {"recall_at_5": len(relevant.intersection(retrieved)) / len(relevant),
            "reciprocal_rank": 1.0 / first if first else 0.0, "zero_result_correct": None}


def _mean(values):
    return sum(values) / len(values) if values else None


def summarize(results, method):
    scores = [row[method] for row in results]
    return {
        "queries": len(scores),
        "answerable_queries": sum(score["recall_at_5"] is not None for score in scores),
        "zero_result_queries": sum(score["zero_result_correct"] is not None for score in scores),
        "recall_at_5": _mean([score["recall_at_5"] for score in scores if score["recall_at_5"] is not None]),
        "mrr": _mean([score["reciprocal_rank"] for score in scores if score["reciprocal_rank"] is not None]),
        "zero_result_accuracy": _mean([score["zero_result_correct"] for score in scores if score["zero_result_correct"] is not None]),
    }


def evaluate(fixture_path, questions_path):
    catalog = Catalog(fixture_path=fixture_path)
    dataset = json.loads(Path(questions_path).read_text(encoding="utf-8"))
    questions = dataset["questions"]
    known_ids = {row["id"] for row in catalog.search_parts(limit=100)}
    if len({row["id"] for row in questions}) != len(questions):
        raise ValueError("Question IDs must be unique")
    results = []
    for question in questions:
        if question["split"] not in ("dev", "test"):
            raise ValueError("Each question must have a dev or test split")
        if not set(question["relevant_ids"]).issubset(known_ids):
            raise ValueError("Gold relevance contains IDs absent from the catalog")
        result = dict(question)
        for method, enhanced in (("baseline", False), ("enhanced", True)):
            rows = catalog.search_parts(question["query"], limit=5, enhanced=enhanced, **question.get("filters", {}))
            ids = [row["id"] for row in rows]
            result[method] = {"retrieved_ids": ids, **score_result(ids, question["relevant_ids"])}
        results.append(result)
    return {
        "metadata": {
            "generated_at_utc": datetime.now(timezone.utc).isoformat(),
            "python_version": platform.python_version(),
            "catalog_sha256": hashlib.sha256(Path(fixture_path).read_bytes()).hexdigest(),
            "questions_sha256": hashlib.sha256(Path(questions_path).read_bytes()).hexdigest(),
            "top_k": 5,
            "baseline": "Existing name/SKU case-insensitive substring matcher, name then ID order, with shared category/price/stock tool filters.",
            "enhanced": "Explicit bilingual category/brand/size normalization and AND token matching; fixed field weights 3/4/2/1 for name/SKU/category/description.",
            "metric_policy": "Recall@5 and MRR are macro-averaged over answerable queries only. Zero-result accuracy is reported separately over gold-empty queries.",
            "synthetic_data": True,
            "scope": "Offline product retrieval on an entirely invented course-demo catalog. These numbers do not measure real shop search quality, LLM answer quality, database freshness, or production safety.",
            "labeling": dataset["labeling"],
            "split_policy": dataset["split_policy"],
        },
        "summary": {
            split: {method: summarize([row for row in results if split == "all" or row["split"] == split], method)
                    for method in ("baseline", "enhanced")}
            for split in ("dev", "test", "all")
        },
        "results": results,
    }


def main():
    data_dir = Path(__file__).parent / "data"
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--catalog", type=Path, default=data_dir / "catalog.json")
    parser.add_argument("--questions", type=Path, default=data_dir / "questions.json")
    parser.add_argument("--output", type=Path, default=data_dir / "evaluation_results.json")
    args = parser.parse_args()
    report = evaluate(args.catalog, args.questions)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report["summary"], ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()

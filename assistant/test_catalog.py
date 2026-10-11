import hashlib
import json
import sqlite3
import tempfile
import unittest
from pathlib import Path

try:
    from .catalog import Catalog
    from .evaluate import evaluate, score_result
except ImportError:
    from catalog import Catalog
    from evaluate import evaluate, score_result


class CatalogTests(unittest.TestCase):
    def setUp(self):
        self.catalog = Catalog()

    def test_synthetic_marker_requires_explicit_true_and_no_database(self):
        self.assertTrue(self.catalog.is_synthetic)
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "fixture.json"
            catalog = Catalog(fixture_path=path)
            self.assertFalse(catalog.is_synthetic)
            for fixture in ({"parts": []}, {"synthetic": False}, {"synthetic": 1},
                            {"synthetic": "true"}, []):
                with self.subTest(fixture=fixture):
                    path.write_text(json.dumps(fixture), encoding="utf-8")
                    self.assertFalse(catalog.is_synthetic)
            path.write_text('{"synthetic": true, "parts": []}', encoding="utf-8")
            self.assertTrue(catalog.is_synthetic)
            self.assertFalse(Catalog(database_path=Path(directory) / "missing.sqlite",
                                     fixture_path=path).is_synthetic)
            path.write_text("invalid JSON", encoding="utf-8")
            self.assertFalse(catalog.is_synthetic)

    def test_bilingual_categories_brands_and_sizes(self):
        cases = (
            ({"query": "RiderPlus engine oil 0.6L"}, [4]),
            ({"query": "RoadFox active 1.2 litre"}, [9]),
            ({"query": "Swift Moto sport 0.6 ลิตร"}, [6]),
            ({"query": "inner tube 2.40-16"}, [18, 26]),
            ({"query": "โรดฟ็อกซ์", "category": "gear oil"}, [13]),
        )
        for arguments, expected in cases:
            with self.subTest(arguments=arguments):
                self.assertEqual(sorted(row["id"] for row in self.catalog.search_parts(**arguments)), expected)

    def test_unavailable_categories_never_fall_back_to_oil(self):
        for query in ("tire", "tubeless", "spark plug", "headlight bulb", "brake pads", "ยางนอก"):
            with self.subTest(query=query):
                self.assertEqual(self.catalog.search_parts(query), [])

    def test_category_conflicts_and_ambiguity(self):
        self.assertEqual(self.catalog.search_parts("inner tube", category="engine oil"), [])
        for arguments in ({"category": "oil"}, {"query": "engine oil inner tube"}):
            with self.subTest(arguments=arguments), self.assertRaises(ValueError):
                self.catalog.search_parts(**arguments)

    def test_filter_boundaries_and_duplicate_sku_ids(self):
        rows = self.catalog.search_parts("FX-O06", max_price=88, min_stock=18)
        self.assertEqual({row["id"] for row in rows}, {3, 4})
        self.assertEqual(self.catalog.search_parts("FX-O06", max_price=81), [])
        self.assertEqual([row["id"] for row in self.catalog.search_parts("FX-O06", min_stock=24)], [3])
        self.assertEqual(len(self.catalog.search_parts(limit=1)), 1)

    def test_baseline_is_substring_name_order_with_shared_filters(self):
        rows = self.catalog.search_parts("ไรเดอร์พลัส", category="engine oil", enhanced=False, min_stock=14, limit=5)
        self.assertEqual([row["id"] for row in rows], [11, 4, 5])
        self.assertEqual(self.catalog.search_parts("engine oil", enhanced=False), [])

    def test_invalid_inputs_are_rejected(self):
        for arguments in ({"query": None}, {"category": 1}, {"max_price": -1},
                          {"max_price": float("nan")}, {"max_price": float("inf")},
                          {"max_price": True}, {"min_stock": -1}, {"min_stock": 1.5},
                          {"min_stock": True}, {"limit": 0}, {"limit": -1},
                          {"limit": 101}, {"limit": True}):
            with self.subTest(arguments=arguments), self.assertRaises(ValueError):
                self.catalog.search_parts(**arguments)
        for part_id in (0, -1, True, "3"):
            with self.subTest(part_id=part_id), self.assertRaises(ValueError):
                self.catalog.get_part(part_id)

    def test_lookup_summary_and_low_stock(self):
        self.assertEqual(self.catalog.get_part(3)["price"], 82.0)
        self.assertIsNone(self.catalog.get_part(9999))
        self.assertEqual({row["id"] for row in self.catalog.get_low_stock()}, {7, 16, 25, 26})
        self.assertEqual(self.catalog.inventory_summary()["total_parts"], 27)
        self.assertEqual(self.catalog.get_storage(), [])
        row = self.catalog.get_part(3)
        row["stock"] = -100
        self.assertEqual(self.catalog.get_part(3)["stock"], 24)

    def test_readonly_sqlite_active_rows_and_wal_visibility(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "isolated-test.sqlite"
            writer = sqlite3.connect(path)
            try:
                writer.execute("PRAGMA journal_mode=WAL")
                writer.execute("CREATE TABLE parts (id INTEGER, name TEXT, sku TEXT, category TEXT, "
                               "price TEXT, stock INTEGER, minStock INTEGER, description TEXT, isActive INTEGER)")
                writer.execute("CREATE TABLE storage_items (id INTEGER, name TEXT, type TEXT, subcategory TEXT, "
                               "brand TEXT, variant TEXT, sizeLabel TEXT, patternLabel TEXT, containerCount INTEGER, "
                               "unitsPerContainer INTEGER, looseUnits INTEGER, totalUnits INTEGER, label TEXT, notes TEXT)")
                writer.executemany("INSERT INTO parts VALUES (?,?,?,?,?,?,?,?,?)", (
                    (1, "RoadFox fictional WAL row", "SAME", "น้ำมันเครื่อง", "82", 3, 5, None, 1),
                    (2, "Hidden inactive", "SAME", "น้ำมันเครื่อง", "70", 9, 5, None, 0),
                ))
                writer.execute("INSERT INTO storage_items (id,name,type,totalUnits) VALUES (1,'Bulk oil','oil',12)")
                writer.commit()
                monitored = [path, Path(str(path) + "-wal")]
                before = {file: hashlib.sha256(file.read_bytes()).hexdigest() for file in monitored}
                catalog = Catalog(database_path=path)
                self.assertEqual([row["id"] for row in catalog.search_parts()], [1])
                self.assertIsNone(catalog.get_part(2))
                self.assertEqual(catalog.get_low_stock()[0]["id"], 1)
                self.assertEqual(catalog.inventory_summary()["total_stock"], 3)
                self.assertEqual(catalog.get_storage()[0]["totalUnits"], 12)
                self.assertEqual(before, {file: hashlib.sha256(file.read_bytes()).hexdigest() for file in monitored})
                writer.execute("UPDATE parts SET stock=7 WHERE id=1")
                writer.commit()
                self.assertEqual(catalog.get_part(1)["stock"], 7)
            finally:
                writer.close()

    def test_readonly_missing_database_is_not_created(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "missing.sqlite"
            with self.assertRaises(sqlite3.OperationalError):
                Catalog(database_path=path).search_parts()
            self.assertFalse(path.exists())

    def test_dict_fixture_excludes_inactive_and_extra_fields(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "fixture.json"
            rows = [self.catalog.get_part(3), self.catalog.get_part(4)]
            rows[0]["supplier_contact"] = "private fixture sentinel"
            rows[1]["isActive"] = False
            path.write_text(json.dumps({"parts": rows, "storage": [{"id": 1}]}), encoding="utf-8")
            catalog = Catalog(fixture_path=path)
            self.assertEqual([row["id"] for row in catalog.search_parts()], [3])
            self.assertNotIn("supplier_contact", catalog.get_part(3))
            self.assertEqual(catalog.get_storage(), [{"id": 1}])


class EvaluationTests(unittest.TestCase):
    def test_metrics_use_relevant_denominator_and_separate_empty_gold(self):
        self.assertEqual(score_result([9, 2, 3], [2, 4]),
                         {"recall_at_5": 0.5, "reciprocal_rank": 0.5, "zero_result_correct": None})
        self.assertEqual(score_result([], []),
                         {"recall_at_5": None, "reciprocal_rank": None, "zero_result_correct": True})
        self.assertFalse(score_result([1], [])["zero_result_correct"])

    def test_dataset_counts_and_no_mutation(self):
        data_dir = Path(__file__).parent / "data"
        paths = [data_dir / "catalog.json", data_dir / "questions.json"]
        before = [path.read_bytes() for path in paths]
        report = evaluate(*paths)
        self.assertEqual(report["summary"]["dev"]["baseline"]["queries"], 10)
        self.assertEqual(report["summary"]["test"]["baseline"]["queries"], 20)
        self.assertEqual(len(report["results"]), 30)
        self.assertEqual(before, [path.read_bytes() for path in paths])
        for row in report["results"]:
            for method in ("baseline", "enhanced"):
                self.assertLessEqual(len(row[method]["retrieved_ids"]), 5)


if __name__ == "__main__":
    unittest.main()

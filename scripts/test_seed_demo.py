import importlib.util
import json
import sqlite3
import tempfile
import unittest
from pathlib import Path


SPEC = importlib.util.spec_from_file_location("seed_demo", Path(__file__).with_name("seed-demo.py"))
seed = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(seed)


class DemoSeedTests(unittest.TestCase):
    def test_seed_preserves_sample_fields_and_creates_empty_business_tables(self):
        fixture = json.loads(seed.FIXTURE.read_text(encoding="utf-8"))
        with tempfile.TemporaryDirectory(prefix="moto-seed-test-") as directory:
            output = Path(directory) / "demo.db"
            self.assertEqual(seed.seed_demo(output), len(fixture["parts"]))
            connection = sqlite3.connect(output)
            try:
                self.assertEqual(connection.execute("PRAGMA quick_check").fetchone()[0], "ok")
                for table in ("users", "suppliers", "stock_movements", "storage_items"):
                    self.assertEqual(connection.execute(f"SELECT count(*) FROM {table}").fetchone()[0], 0)
                for part in fixture["parts"]:
                    actual = connection.execute(
                        "SELECT name, sku, category, CAST(price AS REAL), stock, minStock, description, supplierId, imageUrl, isActive FROM parts WHERE id=?", (part["id"],)
                    ).fetchone()
                    self.assertEqual(actual, (part["name"], part.get("sku"), part.get("category"), float(part["price"]),
                                             part["stock"], part["minStock"], part.get("description"), None, None, 1))
                storage_columns = {row[1] for row in connection.execute("PRAGMA table_info(storage_items)")}
                self.assertTrue({"subcategory", "brand", "variant", "sizeLabel", "patternLabel", "looseUnits"} <= storage_columns)
            finally:
                connection.close()

    def test_existing_output_is_never_overwritten(self):
        with tempfile.TemporaryDirectory(prefix="moto-seed-test-") as directory:
            output = Path(directory) / "existing.db"
            output.write_bytes(b"keep existing file unchanged")
            with self.assertRaises(FileExistsError):
                seed.seed_demo(output)
            self.assertEqual(output.read_bytes(), b"keep existing file unchanged")

    def test_private_database_name_is_refused_even_when_absent(self):
        with tempfile.TemporaryDirectory(prefix="moto-seed-test-") as directory:
            output = Path(directory) / "moto-shop.db"
            with self.assertRaisesRegex(ValueError, "private"):
                seed.seed_demo(output)
            self.assertFalse(output.exists())

    def test_unmarked_or_invalid_data_cannot_create_a_database(self):
        with tempfile.TemporaryDirectory(prefix="moto-seed-test-") as directory:
            output = Path(directory) / "demo.db"
            fixture = Path(directory) / "invalid.json"
            fixture.write_text('{"synthetic":false,"parts":[]}', encoding="utf-8")
            with self.assertRaises(ValueError):
                seed.seed_demo(output, fixture)
            self.assertFalse(output.exists())
            data = json.loads(seed.FIXTURE.read_text(encoding="utf-8"))
            data["parts"][0]["stock"] = -1
            fixture.write_text(json.dumps(data), encoding="utf-8")
            with self.assertRaises(ValueError):
                seed.seed_demo(output, fixture)
            self.assertFalse(output.exists())


if __name__ == "__main__":
    unittest.main()

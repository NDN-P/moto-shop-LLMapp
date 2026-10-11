"""Read-only product lookup with a small, explicit bilingual vocabulary."""

import json
import math
import re
import sqlite3
from contextlib import closing
from pathlib import Path


CATEGORY_ALIASES = {
    "น้ำมันเครื่อง": ("engine oil", "motor oil", "น้ำมันเครื่อง"),
    "น้ำมันเฟืองท้าย": ("final drive oil", "gear oil", "น้ำมันเฟืองท้าย", "เฟืองท้าย"),
    "น้ำมันเบรก": ("brake fluid", "brake oil", "น้ำมันเบรก"),
    "น้ำมันชุด": ("oil kit", "oil set", "น้ำมันชุด"),
    "ยางใน": ("inner tubes", "inner tube", "tubes", "tube", "ยางใน"),
    "ยางนอก": ("tubeless tires", "tubeless tire", "tubeless tyres", "tubeless tyre",
                "tubeless", "tires", "tire", "tyres", "tyre", "ยางนอก"),
    "หัวเทียน": ("spark plugs", "spark plug", "หัวเทียน"),
    "หลอดไฟ": ("headlights", "headlight", "light bulbs", "light bulb", "bulbs", "bulb", "หลอดไฟ"),
    "ผ้าเบรก": ("brake pads", "brake pad", "ผ้าเบรก"),
}

BRAND_ALIASES = {
    "โรดฟ็อกซ์": ("roadfox", "road fox", "โรดฟ็อกซ์"),
    "ไรเดอร์พลัส": ("riderplus", "rider plus", "ไรเดอร์พลัส"),
    "สวิฟต์โมโต": ("swiftmoto", "swift moto", "สวิฟต์โมโต"),
    "แอคทีฟ": ("active", "แอคทีฟ"),
    "สปอร์ต": ("sport", "สปอร์ต"),
}

STOP_WORDS = set("find show me please available any the a an for have do you can what which "
                 "sell buy need want all parts products product items item ขอดู ขอ หา มี ไหม บ้าง ช่วย แสดง สินค้า รายการ".split())


def _phrase_pattern(phrase):
    return r"(?<![a-z0-9])" + re.escape(phrase) + r"(?![a-z0-9])"


def _normalize(text):
    text = " ".join(text.casefold().split())
    for canonical, aliases in BRAND_ALIASES.items():
        for alias in aliases:
            text = re.sub(_phrase_pattern(alias), " " + canonical + " ", text)
    text = re.sub(r"\b(\d)\.(\d{2})(?=[/-])", r"\1\2", text)
    text = re.sub(r"(\d+(?:\.\d+)?)\s*(?:litres?|liters?|l|ลิตร)\b", r"\1", text)
    return " ".join(text.split())


def _category(value):
    value = " ".join(value.casefold().split())
    if value in ("oil", "น้ำมัน", "ยาง"):
        raise ValueError("Choose a specific category, such as engine oil or inner tube")
    for canonical, aliases in CATEGORY_ALIASES.items():
        if value in aliases:
            return canonical
    return value


def _part(row):
    return {
        "id": row["id"], "name": row["name"], "sku": row.get("sku"),
        "category": row.get("category"), "price": float(row["price"]),
        "stock": row["stock"], "minStock": row["minStock"],
        "description": row.get("description"),
    }


class Catalog:
    def __init__(self, database_path=None, fixture_path=None):
        self.database_path = Path(database_path).resolve() if database_path is not None else None
        self.fixture_path = Path(fixture_path) if fixture_path is not None else Path(__file__).parent / "data" / "catalog.json"

    @property
    def is_synthetic(self):
        if self.database_path is not None:
            return False
        try:
            data = json.loads(self.fixture_path.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            return False
        return isinstance(data, dict) and data.get("synthetic") is True

    def _read(self, storage=False):
        if self.database_path is not None:
            # Do not use immutable=1: the live shop may have committed data in its WAL.
            uri = self.database_path.as_uri() + "?mode=ro"
            with closing(sqlite3.connect(uri, uri=True)) as connection:
                connection.row_factory = sqlite3.Row
                connection.execute("PRAGMA query_only = ON")
                if storage:
                    return [dict(row) for row in connection.execute(
                        "SELECT id, name, type, subcategory, brand, variant, sizeLabel, patternLabel, "
                        "containerCount, unitsPerContainer, looseUnits, totalUnits, label, notes "
                        "FROM storage_items ORDER BY id"
                    )]
                return [_part(dict(row)) for row in connection.execute(
                    "SELECT id, name, sku, category, price, stock, minStock, description "
                    "FROM parts WHERE isActive = 1 ORDER BY id"
                )]
        data = json.loads(self.fixture_path.read_text(encoding="utf-8"))
        if storage:
            return data.get("storage", []) if isinstance(data, dict) else []
        rows = data["parts"] if isinstance(data, dict) else data
        return [_part(row) for row in rows if row.get("isActive", True)]

    def search_parts(self, query="", category=None, max_price=None, min_stock=None, limit=10, enhanced=True):
        if not isinstance(query, str) or (category is not None and not isinstance(category, str)):
            raise ValueError("query and category must be strings")
        if isinstance(limit, bool) or not isinstance(limit, int) or not 1 <= limit <= 100:
            raise ValueError("limit must be an integer from 1 to 100")
        if max_price is not None and (isinstance(max_price, bool) or not isinstance(max_price, (int, float))
                                      or not math.isfinite(max_price) or max_price < 0):
            raise ValueError("max_price must be a finite nonnegative number")
        if min_stock is not None and (isinstance(min_stock, bool) or not isinstance(min_stock, int) or min_stock < 0):
            raise ValueError("min_stock must be a nonnegative integer")

        selected_category = _category(category) if category is not None else None
        parts = [row for row in self._read()
                 if (selected_category is None or row["category"] == selected_category)
                 and (max_price is None or row["price"] <= max_price)
                 and (min_stock is None or row["stock"] >= min_stock)]
        if not enhanced:
            needle = query.casefold()
            rows = [row for row in parts if needle in row["name"].casefold() or needle in (row["sku"] or "").casefold()]
            return sorted(rows, key=lambda row: (row["name"], row["id"]))[:limit]

        text = _normalize(query)
        inferred_categories = set()
        for canonical, aliases in CATEGORY_ALIASES.items():
            for alias in aliases:
                pattern = _phrase_pattern(alias)
                if re.search(pattern, text):
                    inferred_categories.add(canonical)
                    text = re.sub(pattern, " ", text)
        if len(inferred_categories) > 1:
            raise ValueError("Search one category at a time")
        if inferred_categories:
            inferred = inferred_categories.pop()
            if selected_category is not None and inferred != selected_category:
                return []
            selected_category = inferred
        text = re.sub(r"\boil\b", "น้ำมัน", text)
        tokens = [token for token in re.findall(r"[\w]+(?:[./-][\w]+)*", text) if token not in STOP_WORDS]

        matches = []
        for row in parts:
            if selected_category is not None and row["category"] != selected_category:
                continue
            if max_price is not None and row["price"] > max_price:
                continue
            if min_stock is not None and row["stock"] < min_stock:
                continue
            fields = [_normalize(str(row[key] or "")) for key in ("name", "sku", "category", "description")]
            score = 0
            for token in tokens:
                pattern = r"(?<![\d.])" + re.escape(token) + r"(?![\d.])" if token[0].isdigit() else re.escape(token)
                hits = [bool(re.search(pattern, field)) for field in fields]
                if not any(hits):
                    break
                score += sum(weight for weight, hit in zip((3, 4, 2, 1), hits) if hit)
            else:
                matches.append((score, row))
        matches.sort(key=lambda item: (-item[0], item[1]["name"], item[1]["id"]))
        return [row for _, row in matches[:limit]]

    def get_part(self, part_id):
        if isinstance(part_id, bool) or not isinstance(part_id, int) or part_id < 1:
            raise ValueError("part_id must be a positive integer")
        return next((row for row in self._read() if row["id"] == part_id), None)

    def get_low_stock(self):
        return [row for row in self._read() if row["stock"] <= row["minStock"]]

    def get_storage(self):
        return self._read(storage=True)

    def inventory_summary(self):
        rows = self._read()
        categories = sorted({row["category"] for row in rows if row["category"]})
        return {
            "total_parts": len(rows), "total_stock": sum(row["stock"] for row in rows),
            "low_stock_count": sum(row["stock"] <= row["minStock"] for row in rows),
            "categories": [{"category": category, "count": sum(row["category"] == category for row in rows)}
                           for category in categories],
        }

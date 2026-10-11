"""Create a new demo database from invented products; never overwrite a file."""

import argparse
import json
import os
import sqlite3
from contextlib import closing
from decimal import Decimal, InvalidOperation
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
FIXTURE = ROOT / "assistant" / "data" / "catalog.json"
SCHEMA = """
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT, openId TEXT NOT NULL UNIQUE,
  name TEXT, email TEXT, loginMethod TEXT, role TEXT NOT NULL DEFAULT 'user',
  createdAt INTEGER NOT NULL DEFAULT (CAST(strftime('%s','now') AS INTEGER) * 1000),
  updatedAt INTEGER NOT NULL DEFAULT (CAST(strftime('%s','now') AS INTEGER) * 1000),
  lastSignedIn INTEGER NOT NULL DEFAULT (CAST(strftime('%s','now') AS INTEGER) * 1000)
);
CREATE TABLE suppliers (
  id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, contactName TEXT,
  phone TEXT, email TEXT, address TEXT, notes TEXT,
  createdAt INTEGER NOT NULL DEFAULT (CAST(strftime('%s','now') AS INTEGER) * 1000),
  updatedAt INTEGER NOT NULL DEFAULT (CAST(strftime('%s','now') AS INTEGER) * 1000)
);
CREATE TABLE parts (
  id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, sku TEXT, category TEXT,
  price TEXT NOT NULL, stock INTEGER NOT NULL DEFAULT 0,
  minStock INTEGER NOT NULL DEFAULT 5, description TEXT, supplierId INTEGER,
  isActive INTEGER NOT NULL DEFAULT 1, imageUrl TEXT,
  createdAt INTEGER NOT NULL DEFAULT (CAST(strftime('%s','now') AS INTEGER) * 1000),
  updatedAt INTEGER NOT NULL DEFAULT (CAST(strftime('%s','now') AS INTEGER) * 1000)
);
CREATE TABLE stock_movements (
  id INTEGER PRIMARY KEY AUTOINCREMENT, partId INTEGER NOT NULL, type TEXT NOT NULL,
  quantity INTEGER NOT NULL, unitPrice TEXT, reference TEXT, note TEXT,
  createdAt INTEGER NOT NULL DEFAULT (CAST(strftime('%s','now') AS INTEGER) * 1000)
);
CREATE TABLE storage_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, type TEXT NOT NULL,
  subcategory TEXT, brand TEXT, variant TEXT, sizeLabel TEXT, patternLabel TEXT,
  containerCount INTEGER NOT NULL DEFAULT 0, unitsPerContainer INTEGER NOT NULL DEFAULT 0,
  looseUnits INTEGER NOT NULL DEFAULT 0, totalUnits INTEGER NOT NULL DEFAULT 0,
  label TEXT, notes TEXT,
  updatedAt INTEGER NOT NULL DEFAULT (CAST(strftime('%s','now') AS INTEGER) * 1000)
);
"""


def seed_demo(output, fixture_path=FIXTURE):
    output = Path(output).absolute()
    if output.exists() or output.is_symlink():
        raise FileExistsError(f"Refusing existing output: {output}")
    if output.name.casefold() == "moto-shop.db":
        raise ValueError("Refusing the private shop database name; choose demo.db")
    data = json.loads(Path(fixture_path).read_text(encoding="utf-8"))
    if not isinstance(data, dict) or data.get("synthetic") is not True or not isinstance(data.get("parts"), list) or not data["parts"]:
        raise ValueError("The seed requires a nonempty, explicitly invented sample catalog")
    rows, ids = [], set()
    for part in data["parts"]:
        if not isinstance(part, dict) or type(part.get("id")) is not int or part["id"] < 1 or part["id"] in ids:
            raise ValueError("Product IDs must be unique positive integers")
        if not isinstance(part.get("name"), str) or not part["name"].strip():
            raise ValueError("Product names must be nonempty strings")
        if any(type(part.get(key)) is not int or part[key] < 0 or part[key] > 2**53 - 1 for key in ("stock", "minStock")):
            raise ValueError("Stock values must be nonnegative safe integers")
        if any(part.get(key) is not None and not isinstance(part[key], str) for key in ("sku", "category", "description")):
            raise ValueError("Product text fields must be strings or null")
        try:
            price = Decimal(str(part["price"]))
        except (InvalidOperation, KeyError):
            raise ValueError("Product price must be a decimal") from None
        if not price.is_finite() or price < 0 or price > 1_000_000_000 or price.as_tuple().exponent < -2:
            raise ValueError("Product price must be finite, nonnegative, and have at most two decimals")
        ids.add(part["id"])
        rows.append((part["id"], part["name"], part.get("sku"), part.get("category"),
                     format(price, "f"), part["stock"], part["minStock"], part.get("description")))

    descriptor = os.open(output, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    os.close(descriptor)
    try:
        with closing(sqlite3.connect(output)) as connection:
            connection.executescript(SCHEMA)
            connection.executemany(
                "INSERT INTO parts (id, name, sku, category, price, stock, minStock, description) "
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?)", rows,
            )
            connection.commit()
    except Exception:
        output.unlink()
        raise
    return len(rows)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("output", nargs="?", type=Path, default=ROOT / "demo.db")
    args = parser.parse_args()
    try:
        count = seed_demo(args.output)
    except (ValueError, OSError, sqlite3.Error) as error:
        parser.exit(1, f"Demo database was not created: {error}\n")
    print(f"Created {args.output.resolve()} with {count} invented products. No supplier or movement records were copied.")


if __name__ == "__main__":
    main()

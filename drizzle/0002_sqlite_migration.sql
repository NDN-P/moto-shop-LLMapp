-- SQLite schema migration for MotoShop Manager

-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  openId TEXT NOT NULL UNIQUE,
  name TEXT,
  email TEXT,
  loginMethod TEXT,
  role TEXT NOT NULL DEFAULT 'user',
  createdAt INTEGER NOT NULL DEFAULT (cast(unixepoch('now') * 1000 as integer)),
  updatedAt INTEGER NOT NULL DEFAULT (cast(unixepoch('now') * 1000 as integer)),
  lastSignedIn INTEGER NOT NULL DEFAULT (cast(unixepoch('now') * 1000 as integer))
);

-- Create suppliers table
CREATE TABLE IF NOT EXISTS suppliers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  contactName TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  notes TEXT,
  createdAt INTEGER NOT NULL DEFAULT (cast(unixepoch('now') * 1000 as integer)),
  updatedAt INTEGER NOT NULL DEFAULT (cast(unixepoch('now') * 1000 as integer))
);

-- Create parts table
CREATE TABLE IF NOT EXISTS parts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  sku TEXT,
  category TEXT,
  price TEXT NOT NULL,
  stock INTEGER NOT NULL DEFAULT 0,
  minStock INTEGER NOT NULL DEFAULT 5,
  description TEXT,
  supplierId INTEGER,
  isActive INTEGER NOT NULL DEFAULT 1,
  createdAt INTEGER NOT NULL DEFAULT (cast(unixepoch('now') * 1000 as integer)),
  updatedAt INTEGER NOT NULL DEFAULT (cast(unixepoch('now') * 1000 as integer))
);

-- Create stock_movements table
CREATE TABLE IF NOT EXISTS stock_movements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  partId INTEGER NOT NULL,
  type TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  unitPrice TEXT,
  reference TEXT,
  note TEXT,
  createdAt INTEGER NOT NULL DEFAULT (cast(unixepoch('now') * 1000 as integer))
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_parts_category ON parts(category);
CREATE INDEX IF NOT EXISTS idx_parts_supplierId ON parts(supplierId);
CREATE INDEX IF NOT EXISTS idx_stock_movements_partId ON stock_movements(partId);
CREATE INDEX IF NOT EXISTS idx_stock_movements_createdAt ON stock_movements(createdAt);

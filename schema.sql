CREATE TABLE IF NOT EXISTS referrals (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  mobile TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS referral_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  referral_code TEXT NOT NULL,
  customer_mobile TEXT NOT NULL,
  product_total REAL NOT NULL,
  reward REAL NOT NULL DEFAULT 100,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL,
  FOREIGN KEY (referral_code) REFERENCES referrals(code)
);

CREATE INDEX IF NOT EXISTS idx_referral_orders_code
ON referral_orders(referral_code);

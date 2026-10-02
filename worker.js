export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Static website files
    if (!url.pathname.startsWith("/api/")) {
      return env.ASSETS.fetch(request);
    }

    // Create database tables automatically
    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS members (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        mobile TEXT NOT NULL UNIQUE,
        code TEXT NOT NULL UNIQUE,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `).run();

    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS referrals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        referrer_code TEXT NOT NULL,
        referred_mobile TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `).run();

    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS referral_orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        referral_code TEXT NOT NULL,
        customer_mobile TEXT,
        product_total REAL NOT NULL,
        status TEXT DEFAULT 'pending',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `).run();

    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS rewards (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        referral_code TEXT NOT NULL,
        order_id INTEGER NOT NULL,
        amount REAL NOT NULL DEFAULT 100,
        status TEXT DEFAULT 'pending',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `).run();

    const json = (data, status = 200) =>
      new Response(JSON.stringify(data), {
        status,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      });

    // Register / generate referral code
    if (url.pathname === "/api/referral/register" && request.method === "POST") {
      const body = await request.json();
      const name = String(body.name || "").trim();
      const mobile = String(body.mobile || "").trim();

      if (!name || !mobile) {
        return json({ error: "Name and mobile are required." }, 400);
      }

      const existing = await env.DB
        .prepare("SELECT * FROM members WHERE mobile = ?")
        .bind(mobile)
        .first();

      if (existing) {
        return json({
          success: true,
          code: existing.code,
          name: existing.name
        });
      }

      const code =
        "SRA" +
        Math.floor(10000 + Math.random() * 90000);

      await env.DB
        .prepare(
          "INSERT INTO members (name, mobile, code) VALUES (?, ?, ?)"
        )
        .bind(name, mobile, code)
        .run();

      return json({
        success: true,
        code,
        name
      });
    }

    // Referral information
    if (url.pathname === "/api/referral" && request.method === "GET") {
      const code = url.searchParams.get("ref");

      if (!code) {
        return json({ error: "Referral code missing." }, 400);
      }

      const member = await env.DB
        .prepare("SELECT name, code FROM members WHERE code = ?")
        .bind(code)
        .first();

      if (!member) {
        return json({ error: "Invalid referral code." }, 404);
      }

      return json({
        success: true,
        name: member.name,
        code: member.code,
        minimumOrder: 2500,
        reward: 100
      });
    }

    // Save referred order
    if (url.pathname === "/api/referral/order" && request.method === "POST") {
      const body = await request.json();

      const referralCode = String(body.referralCode || "").trim();
      const customerMobile = String(body.customerMobile || "").trim();
      const productTotal = Number(body.productTotal || 0);

      if (!referralCode || !productTotal) {
        return json({ error: "Referral code and product total are required." }, 400);
      }

      // Referral income only when product value is >= ₹2,500
      const eligible = productTotal >= 2500;

      const order = await env.DB
        .prepare(`
          INSERT INTO referral_orders
          (referral_code, customer_mobile, product_total, status)
          VALUES (?, ?, ?, ?)
        `)
        .bind(
          referralCode,
          customerMobile,
          productTotal,
          eligible ? "pending_reward" : "not_eligible"
        )
        .run();

      if (eligible) {
        await env.DB
          .prepare(`
            INSERT INTO rewards
            (referral_code, order_id, amount, status)
            VALUES (?, ?, 100, 'pending')
          `)
          .bind(referralCode, order.meta.last_row_id)
          .run();
      }

      return json({
        success: true,
        eligible,
        reward: eligible ? 100 : 0,
        message: eligible
          ? "₹100 referral reward created as pending."
          : "Order is below ₹2,500, so no referral reward."
      });
    }

    // Earnings
    if (url.pathname === "/api/referral/stats" && request.method === "GET") {
      const code = url.searchParams.get("code");

      if (!code) {
        return json({ error: "Referral code missing." }, 400);
      }

      const result = await env.DB
        .prepare(`
          SELECT
            COUNT(*) AS total_referrals,
            COALESCE(SUM(CASE WHEN status='pending' THEN amount ELSE 0 END),0) AS pending,
            COALESCE(SUM(CASE WHEN status='approved' THEN amount ELSE 0 END),0) AS approved
          FROM rewards
          WHERE referral_code = ?
        `)
        .bind(code)
        .first();

      return json({
        success: true,
        referrals: result.total_referrals || 0,
        pending: result.pending || 0,
        approved: result.approved || 0
      });
    }

    return json({ error: "API endpoint not found." }, 404);
  }
};

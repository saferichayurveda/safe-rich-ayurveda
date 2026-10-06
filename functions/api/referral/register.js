export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json();
    const name = String(body.name || "").trim();
    const mobile = String(body.mobile || "").trim();

    if (!name || !/^\d{10}$/.test(mobile)) {
      return Response.json({ success:false, error:"Invalid name or mobile" }, { status:400 });
    }
    if (!env.DB) return Response.json({ success:false, error:"Database not configured" }, { status:500 });

    const existing = await env.DB.prepare(
      "SELECT code FROM referrals WHERE mobile = ? LIMIT 1"
    ).bind(mobile).first();

    if (existing?.code) {
      return Response.json({ success:true, code:existing.code, existing:true });
    }

    const code = "SRA" + crypto.randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase();

    await env.DB.prepare(
      "INSERT INTO referrals (code, name, mobile, created_at) VALUES (?, ?, ?, datetime('now'))"
    ).bind(code, name, mobile).run();

    return Response.json({ success:true, code });
  } catch (e) {
    return Response.json({ success:false, error:"Unable to create referral" }, { status:500 });
  }
}

export async function onRequestGet({ request, env }) {
  try {
    const code = new URL(request.url).searchParams.get("code")?.trim();
    if (!code || !env.DB) return Response.json({ success:false, error:"Invalid request" }, { status:400 });

    const ref = await env.DB.prepare(
      "SELECT code FROM referrals WHERE code = ? LIMIT 1"
    ).bind(code).first();
    if (!ref) return Response.json({ success:false, error:"Referral not found" }, { status:404 });

    const row = await env.DB.prepare(
      "SELECT COUNT(*) AS referrals, COALESCE(SUM(CASE WHEN status='pending' THEN reward ELSE 0 END),0) AS pending, COALESCE(SUM(CASE WHEN status='approved' THEN reward ELSE 0 END),0) AS approved FROM referral_orders WHERE referral_code = ?"
    ).bind(code).first();

    return Response.json({
      success:true,
      referrals:Number(row?.referrals || 0),
      pending:Number(row?.pending || 0),
      approved:Number(row?.approved || 0)
    });
  } catch (e) {
    return Response.json({ success:false, error:"Unable to load stats" }, { status:500 });
  }
}

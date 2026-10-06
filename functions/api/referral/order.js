export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json();
    const referralCode = String(body.referralCode || "").trim();
    const customerMobile = String(body.customerMobile || "").trim();
    const productTotal = Number(body.productTotal || 0);

    if (!/^SRA[A-Z0-9]{8}$/.test(referralCode) || !/^\d{10}$/.test(customerMobile) || productTotal < 2500) {
      return Response.json({ success:false, error:"Order is not eligible for referral reward" }, { status:400 });
    }
    if (!env.DB) return Response.json({ success:false, error:"Database not configured" }, { status:500 });

    const ref = await env.DB.prepare(
      "SELECT code, mobile FROM referrals WHERE code = ? LIMIT 1"
    ).bind(referralCode).first();
    if (!ref) return Response.json({ success:false, error:"Referral not found" }, { status:404 });

    if (ref.mobile === customerMobile) {
      return Response.json({ success:false, error:"Self referral is not eligible" }, { status:400 });
    }

    const duplicate = await env.DB.prepare(
      "SELECT id FROM referral_orders WHERE referral_code = ? AND customer_mobile = ? AND product_total = ? AND status != 'rejected' LIMIT 1"
    ).bind(referralCode, customerMobile, productTotal).first();
    if (duplicate) {
      return Response.json({ success:true, status:"already_recorded" });
    }

    await env.DB.prepare(
      "INSERT INTO referral_orders (referral_code, customer_mobile, product_total, reward, status, created_at) VALUES (?, ?, ?, 100, 'pending', datetime('now'))"
    ).bind(referralCode, customerMobile, productTotal).run();

    return Response.json({ success:true, status:"pending", reward:100 });
  } catch (e) {
    return Response.json({ success:false, error:"Unable to record referral order" }, { status:500 });
  }
}

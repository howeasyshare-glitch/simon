// api/custom-products.js (Vercel Serverless - CommonJS)
const { createClient } = require('@supabase/supabase-js');

module.exports = async (req, res) => {
  try {
    if (req.method !== 'GET') {
      res.statusCode = 405;
      return res.json({ error: 'Method not allowed' });
    }

    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    // 先避免「環境變數沒設」直接 crash
    if (!SUPABASE_URL || !SERVICE_KEY) {
      res.statusCode = 500;
      return res.json({
        error: 'Missing env vars',
        missing: {
          NEXT_PUBLIC_SUPABASE_URL: !SUPABASE_URL,
          SUPABASE_SERVICE_ROLE_KEY: !SERVICE_KEY
        }
      });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    // 先固定測試外套
    const ITEM_TAG = 'item_outerwear';

    const { data, error } = await supabase
      .from('custom_products')
      .select('*')
      .eq('is_active', true)
      .contains('tags', [ITEM_TAG])
      .limit(2);

    if (error) {
      res.statusCode = 500;
      return res.json({ error: 'Supabase query failed', detail: error.message });
    }

    res.statusCode = 200;
    return res.json({ items: data || [] });
  } catch (e) {
    // 這裡才是「真正會導致 Function crashed」的錯（例如 module not found）
    res.statusCode = 500;
    return res.json({ error: 'Function crashed', detail: String(e && e.message ? e.message : e) });
  }
};

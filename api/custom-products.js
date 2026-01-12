// api/custom-products.js
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  // 只允許 GET
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 先固定只測試「外套」
  const ITEM_TAG = 'item_outerwear';

  const { data, error } = await supabase
    .from('custom_products')
    .select('*')
    .eq('is_active', true)
    .contains('tags', [ITEM_TAG])
    .limit(2);

  if (error) {
    console.error('Supabase error:', error);
    return res.status(500).json({ error: 'Database error' });
  }

  return res.status(200).json({
    items: data || []
  });
}

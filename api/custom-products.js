// api/custom-products.js
import { supabase } from '../lib/supabaseServer';

export default async function handler(req, res) {
  try {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    const ITEM_TAG = 'item_outerwear';

    const { data, error } = await supabase
      .from('custom_products')
      .select('*')
      .eq('is_active', true)
      .contains('tags', [ITEM_TAG])
      .limit(2);

    if (error) return res.status(500).json({ error: 'Supabase query failed', detail: error.message });

    return res.status(200).json({ items: data || [] });
  } catch (e) {
    return res.status(500).json({ error: 'Function crashed', detail: String(e?.message || e) });
  }
}

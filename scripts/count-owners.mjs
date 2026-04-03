import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

const envRaw = readFileSync('.env.local', 'utf-8');
const env = {};
for (const line of envRaw.split('\n')) {
  const t = line.trim();
  if (!t || t.startsWith('#')) continue;
  const eq = t.indexOf('=');
  if (eq === -1) continue;
  env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim().replace(/^"|"$/g, '').replace(/\\n/g, '');
}

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const { count: total } = await sb.from('buildings').select('id', { count: 'exact', head: true });
const { count: withOwner } = await sb.from('buildings').select('id', { count: 'exact', head: true }).not('owner_name', 'is', null);
console.log('Total buildings:', total);
console.log('With owner_name:', withOwner);
console.log('Without owner_name:', total - withOwner);

// Count distinct landlords
const { count: landlordCount } = await sb.from('landlords').select('id', { count: 'exact', head: true });
console.log('Landlord records:', landlordCount);

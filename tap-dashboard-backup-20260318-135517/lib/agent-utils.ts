import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function verifyBootHash(agent_id: string, provided_hash: string) {
  const { data } = await supabase
    .from('waitlist')
    .select('boot_hash')
    .eq('agent_id', agent_id)
    .single();

  const match = data?.boot_hash === provided_hash;
  return {
    verified: match,
    tamper_detected: !match
  };
}

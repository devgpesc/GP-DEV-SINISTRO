import { useEffect, useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { DEFAULT_EVENT_TYPES } from '../utils/defaults';

export function useEventTypes() {
  const { currentTenant } = useAuth();
  const [eventTypes, setEventTypes] = useState<string[]>(DEFAULT_EVENT_TYPES);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!currentTenant?.id) {
        setEventTypes(DEFAULT_EVENT_TYPES);
        setLoading(false);
        return;
      }
      const { data } = await supabase
        .from('saas_settings')
        .select('event_types')
        .eq('tenant_id', currentTenant.id)
        .maybeSingle();

      if (!active) return;
      const types = Array.isArray(data?.event_types) && data.event_types.length > 0
        ? data.event_types.filter((t: unknown) => typeof t === 'string' && t.trim())
        : DEFAULT_EVENT_TYPES;
      setEventTypes(types);
      setLoading(false);
    };
    load();
    return () => { active = false; };
  }, [currentTenant?.id]);

  return { eventTypes, loading };
}

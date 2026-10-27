import { useMemo } from 'react';
import { useEventContext } from '../context/EventContext';
import { deriveCelebrationMood } from '../lib/ui/moodEngine';

/**
 * Context-aware accessor for the active celebration's visual mood —
 * party type + booked venue + applied AI theme, re-derived only when the
 * active event actually changes. Use anywhere the UI should feel like the
 * celebration being planned.
 */
export function useCelebrationMood() {
  const { activeEvent } = useEventContext();
  return useMemo(() => deriveCelebrationMood(activeEvent), [activeEvent]);
}

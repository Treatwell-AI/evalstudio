import { useCallback } from "react";
import { useProjectId } from "./useProjectId";

/**
 * Persists and retrieves the last visited entity ID for a given entity type.
 * Scoped per project so switching projects doesn't show stale data.
 */
export function useLastVisited(entityType: string) {
  const projectId = useProjectId();
  const key = `lastVisited:${projectId}:${entityType}`;

  const get = useCallback((): string | null => {
    return localStorage.getItem(key);
  }, [key]);

  const set = useCallback(
    (id: string) => {
      localStorage.setItem(key, id);
    },
    [key]
  );

  const clear = useCallback(() => {
    localStorage.removeItem(key);
  }, [key]);

  return { get, set, clear };
}

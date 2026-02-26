import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useLastVisited } from "../hooks/useLastVisited";

interface EntityRedirectProps {
  entityType: string;
  items: { id: string }[] | undefined;
  isLoading: boolean;
  fallback: React.ReactNode;
}

/**
 * Redirects to the last visited entity detail page, or the first entity if
 * no previous visit. Shows fallback (e.g. empty state) when no entities exist.
 */
export function EntityRedirect({
  entityType,
  items,
  isLoading,
  fallback,
}: EntityRedirectProps) {
  const navigate = useNavigate();
  const lastVisited = useLastVisited(entityType);

  useEffect(() => {
    if (isLoading || !items) return;
    if (items.length === 0) return;

    const lastId = lastVisited.get();
    const target = lastId && items.some((i) => i.id === lastId)
      ? lastId
      : items[0].id;

    navigate(target, { replace: true });
  }, [items, isLoading, navigate, lastVisited]);

  if (isLoading) {
    return <div className="loading">Loading...</div>;
  }

  if (!items || items.length === 0) {
    return <>{fallback}</>;
  }

  return <div className="loading">Loading...</div>;
}

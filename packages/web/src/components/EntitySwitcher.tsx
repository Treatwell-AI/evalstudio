import { useState, useRef, useEffect } from "react";

export interface EntitySwitcherItem {
  id: string;
  name: string;
}

interface EntitySwitcherProps {
  items: EntitySwitcherItem[];
  activeId: string;
  onSelect: (id: string) => void;
  onCreate?: () => void;
  entityLabel?: string;
}

export function EntitySwitcher({
  items,
  activeId,
  onSelect,
  onCreate,
  entityLabel = "item",
}: EntitySwitcherProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const activeItem = items.find((i) => i.id === activeId);
  const showSearch = items.length > 5;

  const filtered = search
    ? items.filter((i) =>
        i.name.toLowerCase().includes(search.toLowerCase())
      )
    : items;

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
        setSearch("");
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  useEffect(() => {
    if (open && showSearch) {
      searchRef.current?.focus();
    }
  }, [open, showSearch]);

  const handleSelect = (id: string) => {
    if (id !== activeId) {
      onSelect(id);
    }
    setOpen(false);
    setSearch("");
  };

  return (
    <div className="entity-switcher" ref={containerRef}>
      <button
        className="entity-switcher-trigger"
        onClick={() => setOpen(!open)}
      >
        <span className="entity-switcher-name">
          {activeItem?.name || activeId}
        </span>
        <svg
          width="14"
          height="14"
          viewBox="0 0 12 12"
          fill="none"
          className={`entity-switcher-chevron${open ? " open" : ""}`}
        >
          <path
            d="M3 4.5L6 7.5L9 4.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open && (
        <div className="entity-switcher-dropdown">
          {showSearch && (
            <div className="entity-switcher-search">
              <input
                ref={searchRef}
                type="text"
                placeholder={`Search ${entityLabel}s...`}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          )}

          <div className="entity-switcher-list">
            {filtered.map((item) => (
              <button
                key={item.id}
                className={`entity-switcher-item${
                  item.id === activeId ? " active" : ""
                }`}
                onClick={() => handleSelect(item.id)}
              >
                <span className="entity-switcher-item-name">{item.name}</span>
                {item.id === activeId && (
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path
                      d="M3 7L6 10L11 4"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </button>
            ))}
            {filtered.length === 0 && (
              <div className="entity-switcher-empty">
                No {entityLabel}s match "{search}"
              </div>
            )}
          </div>

          {onCreate && (
            <>
              <div className="entity-switcher-divider" />
              <button
                className="entity-switcher-item entity-switcher-create"
                onClick={() => {
                  setOpen(false);
                  setSearch("");
                  onCreate();
                }}
              >
                + New {entityLabel}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

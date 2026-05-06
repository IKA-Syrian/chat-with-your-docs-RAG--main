'use client';

/**
 * Phase 3 #17 — multi-document picker for the chat page.
 *
 * Shows a chip rail of the user's documents; clicking toggles each into the
 * `selectedIds` array (max 10). Designed to live above or beside the message
 * input — no modal, no autocomplete.
 */

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api/client';
import { X, Layers } from 'lucide-react';

interface Doc {
  id: string;
  name: string;
}

interface Props {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  primaryId?: string | null; // the doc the chat opened with — pinned, can't be removed
  maxDocs?: number;          // default 10
}

const MAX_VISIBLE = 12;

export default function DocPicker({ selectedIds, onChange, primaryId, maxDocs = 10 }: Props) {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await apiClient.getDocuments();
        if (!cancelled) setDocs((data.documents || []).map((d: any) => ({ id: d.id, name: d.name })));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const selected = useMemo(() => {
    return selectedIds
      .map(id => docs.find(d => d.id === id) || { id, name: 'Document' })
      .slice(0, maxDocs);
  }, [selectedIds, docs, maxDocs]);

  const toggle = (id: string) => {
    if (selectedIds.includes(id)) {
      if (id === primaryId) return; // pinned
      onChange(selectedIds.filter(x => x !== id));
    } else {
      if (selectedIds.length >= maxDocs) return;
      onChange([...selectedIds, id]);
    }
  };

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const list = q ? docs.filter(d => d.name.toLowerCase().includes(q)) : docs;
    return list.slice(0, MAX_VISIBLE);
  }, [docs, filter]);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1 items-center">
        <span className="text-xs text-gray-500 mr-1 inline-flex items-center gap-1">
          <Layers className="h-3 w-3" />
          Scope:
        </span>
        {selected.length === 0 ? (
          <span className="text-xs italic text-gray-400">no documents — answers from general knowledge only</span>
        ) : (
          selected.map(d => (
            <span
              key={d.id}
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border ${
                d.id === primaryId
                  ? 'bg-blue-100 text-blue-700 border-blue-200'
                  : 'bg-gray-100 text-gray-700 border-gray-200'
              }`}
              title={d.id === primaryId ? 'Primary doc — pinned' : 'Click × to remove'}
            >
              <span className="truncate max-w-[160px]">{d.name}</span>
              {d.id !== primaryId && (
                <button
                  onClick={() => toggle(d.id)}
                  className="opacity-60 hover:opacity-100"
                  aria-label="Remove from scope"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </span>
          ))
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setOpen(v => !v)}
          className="h-6 px-2 text-xs"
        >
          {open ? 'Done' : `+ Add (${selectedIds.length}/${maxDocs})`}
        </Button>
      </div>

      {open && (
        <div className="border rounded-md bg-white p-2 shadow-sm">
          <input
            value={filter}
            onChange={e => setFilter(e.target.value)}
            placeholder="Filter your documents…"
            className="w-full px-2 py-1 text-sm border rounded mb-2"
          />
          {loading ? (
            <div className="text-xs text-gray-500 px-2 py-1">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="text-xs text-gray-500 px-2 py-1">No documents match.</div>
          ) : (
            <ul className="max-h-56 overflow-y-auto space-y-1">
              {filtered.map(d => {
                const isSelected = selectedIds.includes(d.id);
                const disabled = !isSelected && selectedIds.length >= maxDocs;
                return (
                  <li key={d.id}>
                    <button
                      onClick={() => toggle(d.id)}
                      disabled={disabled || d.id === primaryId}
                      className={`w-full text-left text-sm px-2 py-1 rounded ${
                        isSelected
                          ? 'bg-blue-50 text-blue-700'
                          : 'hover:bg-gray-50 text-gray-700'
                      } ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
                    >
                      <span className="inline-block w-4 mr-2 text-center">{isSelected ? '✓' : ''}</span>
                      {d.name}
                      {d.id === primaryId && <span className="text-xs text-blue-500 ml-2">(primary)</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {selectedIds.length >= maxDocs && (
            <div className="text-xs text-orange-600 mt-2 px-2">
              Max {maxDocs} docs in scope. Remove one to add another.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

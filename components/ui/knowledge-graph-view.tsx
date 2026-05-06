'use client';

/**
 * Phase 4 #21 — minimal SVG-based knowledge graph viz.
 *
 * Runs a tiny force simulation client-side (no d3 / react-flow dep). Nodes are
 * draggable; edges color-code by relationship type. Click a node to surface
 * its summary plus the list of incident edges. A "Generate practice" button
 * funnels back into the existing flashcard generator.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Sparkles, Zap, Loader2 } from 'lucide-react';
import { apiClient } from '@/lib/api/client';

interface Node {
  id: string;
  label: string;
  summary: string;
  importance: number;
}

interface Edge {
  source: string;
  target: string;
  type: 'prerequisite' | 'related' | 'example_of' | 'contradicts';
  label: string | null;
}

interface Graph {
  document_id: string;
  nodes: Node[];
  edges: Edge[];
  node_count?: number;
  edge_count?: number;
  generated_at?: string;
  cached?: boolean;
}

interface WeakNode { id: string; label: string; struggle_score: number; hits: number }

const EDGE_COLORS: Record<Edge['type'], string> = {
  prerequisite: '#3b82f6', // blue
  related: '#9ca3af',       // gray
  example_of: '#10b981',    // green
  contradicts: '#ef4444'    // red
};

interface Props {
  documentId: string;
}

export default function KnowledgeGraphView({ documentId }: Props) {
  const [graph, setGraph] = useState<Graph | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [weakNodes, setWeakNodes] = useState<WeakNode[]>([]);
  const svgRef = useRef<SVGSVGElement | null>(null);

  // Fetch existing graph on mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const g = await apiClient.getKnowledgeGraph(documentId);
        if (!cancelled) setGraph(g);
      } catch (err) {
        const msg = err instanceof Error ? err.message : '';
        if (/HTTP 404|No knowledge graph/i.test(msg)) {
          if (!cancelled) setGraph(null);
        } else if (/HTTP 503|migration/i.test(msg)) {
          if (!cancelled) setUnavailable(true);
        } else if (!cancelled) {
          setError(msg);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [documentId]);

  // Fetch weak-node analysis when graph loads.
  useEffect(() => {
    if (!graph || graph.nodes.length === 0) { setWeakNodes([]); return; }
    let cancelled = false;
    (async () => {
      try {
        const data = await apiClient.getWeakNodes(documentId);
        if (!cancelled) setWeakNodes(data.weak_nodes || []);
      } catch { /* non-fatal */ }
    })();
    return () => { cancelled = true; };
  }, [graph, documentId]);

  const generate = async (force = false) => {
    setGenerating(true);
    setError(null);
    try {
      const g = await apiClient.generateKnowledgeGraph(documentId, { forceRegenerate: force });
      setGraph(g);
      setSelectedId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed');
    } finally {
      setGenerating(false);
    }
  };

  // ---------------------------------------------------------------------
  // Tiny force-directed layout. Computed once per graph; nodes are draggable.
  // ---------------------------------------------------------------------
  const layout = useMemo(() => {
    if (!graph) return null;
    const W = 800;
    const H = 500;
    const cx = W / 2;
    const cy = H / 2;
    const N = graph.nodes.length;
    if (N === 0) return null;

    // Initial circular placement gives the sim a stable seed.
    const positions = new Map<string, { x: number; y: number; vx: number; vy: number }>();
    graph.nodes.forEach((n, i) => {
      const angle = (i / N) * Math.PI * 2;
      const r = Math.min(W, H) * 0.35;
      positions.set(n.id, { x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r, vx: 0, vy: 0 });
    });

    const adj = new Map<string, Set<string>>();
    graph.nodes.forEach(n => adj.set(n.id, new Set()));
    graph.edges.forEach(e => {
      adj.get(e.source)?.add(e.target);
      adj.get(e.target)?.add(e.source);
    });

    // 200 iterations is plenty for ≤60 nodes.
    const REPULSION = 4500;
    const SPRING = 0.04;
    const DAMP = 0.85;
    const IDEAL_DIST = 110;
    for (let step = 0; step < 200; step++) {
      // Repulsion (pairwise).
      const arr = graph.nodes;
      for (let i = 0; i < arr.length; i++) {
        const a = positions.get(arr[i].id)!;
        for (let j = i + 1; j < arr.length; j++) {
          const b = positions.get(arr[j].id)!;
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const d2 = Math.max(60, dx * dx + dy * dy);
          const f = REPULSION / d2;
          const fx = (dx / Math.sqrt(d2)) * f;
          const fy = (dy / Math.sqrt(d2)) * f;
          a.vx += fx; a.vy += fy;
          b.vx -= fx; b.vy -= fy;
        }
      }
      // Spring (edges).
      for (const e of graph.edges) {
        const a = positions.get(e.source);
        const b = positions.get(e.target);
        if (!a || !b) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const f = SPRING * (dist - IDEAL_DIST);
        const fx = (dx / dist) * f;
        const fy = (dy / dist) * f;
        a.vx += fx; a.vy += fy;
        b.vx -= fx; b.vy -= fy;
      }
      // Centering pull.
      for (const p of positions.values()) {
        p.vx += (cx - p.x) * 0.005;
        p.vy += (cy - p.y) * 0.005;
        p.vx *= DAMP;
        p.vy *= DAMP;
        p.x += p.vx;
        p.y += p.vy;
        // Clamp to canvas.
        p.x = Math.max(40, Math.min(W - 40, p.x));
        p.y = Math.max(40, Math.min(H - 40, p.y));
      }
    }
    return { width: W, height: H, positions };
  }, [graph]);

  const [drag, setDrag] = useState<{ id: string; offsetX: number; offsetY: number } | null>(null);
  const [overrides, setOverrides] = useState<Map<string, { x: number; y: number }>>(new Map());

  const positionFor = (id: string): { x: number; y: number } | null => {
    if (overrides.has(id)) return overrides.get(id)!;
    return layout?.positions.get(id) ? { x: layout.positions.get(id)!.x, y: layout.positions.get(id)!.y } : null;
  };

  const handleMouseDown = (e: React.MouseEvent<SVGCircleElement>, id: string) => {
    const p = positionFor(id);
    if (!p) return;
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const sx = ((e.clientX - rect.left) / rect.width) * 800;
    const sy = ((e.clientY - rect.top) / rect.height) * 500;
    setDrag({ id, offsetX: p.x - sx, offsetY: p.y - sy });
  };
  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!drag) return;
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const sx = ((e.clientX - rect.left) / rect.width) * 800;
    const sy = ((e.clientY - rect.top) / rect.height) * 500;
    setOverrides(prev => {
      const next = new Map(prev);
      next.set(drag.id, {
        x: Math.max(40, Math.min(760, sx + drag.offsetX)),
        y: Math.max(40, Math.min(460, sy + drag.offsetY))
      });
      return next;
    });
  };
  const handleMouseUp = () => setDrag(null);

  // ---------------------------------------------------------------------
  // Render branches
  // ---------------------------------------------------------------------
  if (unavailable) {
    return (
      <Card>
        <CardContent className="py-6 text-center text-sm text-gray-500">
          Knowledge graph isn't available yet — apply migration 010 first.
        </CardContent>
      </Card>
    );
  }
  if (loading) {
    return (
      <Card><CardContent className="py-6 text-center text-sm text-gray-500">Loading…</CardContent></Card>
    );
  }
  if (!graph || graph.nodes.length === 0) {
    return (
      <Card>
        <CardContent className="py-6 text-center space-y-3">
          <div className="text-sm text-gray-700">No knowledge graph yet for this document.</div>
          <Button onClick={() => generate(false)} disabled={generating} className="mx-auto">
            {generating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
            {generating ? 'Generating…' : 'Generate knowledge graph'}
          </Button>
          {error && <div className="text-xs text-red-600">{error}</div>}
        </CardContent>
      </Card>
    );
  }

  const selected = selectedId ? graph.nodes.find(n => n.id === selectedId) : null;
  const incidentEdges = selected
    ? graph.edges.filter(e => e.source === selectedId || e.target === selectedId)
    : [];
  const weakSet = new Set(weakNodes.map(w => w.id));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="text-base font-semibold">Concept map</h3>
          <p className="text-xs text-gray-500">
            {graph.nodes.length} concepts · {graph.edges.length} relationships
            {weakNodes.length > 0 && <> · <span className="text-orange-600">{weakNodes.length} weak</span></>}
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => generate(true)} disabled={generating}>
          {generating ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <RefreshCw className="h-3 w-3 mr-1" />}
          Regenerate
        </Button>
      </div>

      <div className="border rounded-lg bg-white overflow-hidden">
        <svg
          ref={svgRef}
          viewBox="0 0 800 500"
          className="w-full"
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <defs>
            <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#9ca3af" />
            </marker>
          </defs>
          {/* Edges */}
          {graph.edges.map((e, i) => {
            const a = positionFor(e.source);
            const b = positionFor(e.target);
            if (!a || !b) return null;
            const stroke = EDGE_COLORS[e.type] || '#9ca3af';
            const isPrereq = e.type === 'prerequisite';
            return (
              <line
                key={i}
                x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                stroke={stroke}
                strokeWidth={1.6}
                strokeOpacity={selectedId ? (e.source === selectedId || e.target === selectedId ? 1 : 0.18) : 0.65}
                markerEnd={isPrereq ? 'url(#arrow)' : undefined}
              />
            );
          })}
          {/* Nodes */}
          {graph.nodes.map(n => {
            const p = positionFor(n.id);
            if (!p) return null;
            const r = 10 + (n.importance || 3) * 2;
            const isSelected = selectedId === n.id;
            const isWeak = weakSet.has(n.id);
            return (
              <g key={n.id} style={{ cursor: 'pointer' }} onClick={() => setSelectedId(n.id === selectedId ? null : n.id)}>
                <circle
                  cx={p.x} cy={p.y} r={r}
                  fill={isWeak ? '#fb923c' : isSelected ? '#2563eb' : '#1d4ed8'}
                  fillOpacity={isSelected ? 1 : 0.85}
                  stroke={isSelected ? '#1e40af' : '#fff'}
                  strokeWidth={isSelected ? 3 : 1.5}
                  onMouseDown={(e) => handleMouseDown(e, n.id)}
                />
                <text
                  x={p.x}
                  y={p.y + r + 12}
                  textAnchor="middle"
                  fontSize={11}
                  fill="#111"
                  style={{ pointerEvents: 'none', userSelect: 'none' }}
                >
                  {n.label.length > 20 ? n.label.slice(0, 18) + '…' : n.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs text-gray-600">
        {(['prerequisite', 'related', 'example_of', 'contradicts'] as const).map(t => (
          <span key={t} className="inline-flex items-center gap-1">
            <span className="inline-block w-3 h-0.5" style={{ background: EDGE_COLORS[t] }} />
            {t.replace('_', ' ')}
          </span>
        ))}
        <span className="inline-flex items-center gap-1">
          <span className="inline-block w-2 h-2 rounded-full bg-orange-500" /> weak (struggling)
        </span>
      </div>

      {/* Selected node detail */}
      {selected && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h4 className="font-semibold">{selected.label}</h4>
              {weakSet.has(selected.id) && (
                <Badge className="bg-orange-100 text-orange-700">struggling</Badge>
              )}
            </div>
            <p className="text-sm text-gray-700">{selected.summary}</p>
            {incidentEdges.length > 0 && (
              <div className="text-xs space-y-0.5">
                {incidentEdges.map((e, i) => {
                  const otherId = e.source === selected.id ? e.target : e.source;
                  const other = graph.nodes.find(n => n.id === otherId);
                  return (
                    <div key={i}>
                      <span style={{ color: EDGE_COLORS[e.type] }}>●</span>
                      {' '}<span className="text-gray-500">{e.type.replace('_', ' ')}:</span>
                      {' '}<button onClick={() => setSelectedId(otherId)} className="text-blue-600 hover:underline">
                        {other?.label || otherId}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {weakNodes.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer inline-flex items-center gap-1 text-orange-700">
            <Zap className="h-3 w-3" /> {weakNodes.length} concepts you're struggling with
          </summary>
          <ul className="mt-2 space-y-1 text-xs">
            {weakNodes.map(w => (
              <li key={w.id}>
                <button onClick={() => setSelectedId(w.id)} className="text-blue-600 hover:underline">
                  {w.label}
                </button>
                <span className="text-gray-500"> · {w.hits} mistake hit{w.hits === 1 ? '' : 's'}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

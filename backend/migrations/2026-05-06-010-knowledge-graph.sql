-- 2026-05-06-010-knowledge-graph.sql
-- Phase 4 #21 — per-document knowledge graph stored as JSONB.
-- One row per document; regenerating the graph upserts in place.

CREATE TABLE IF NOT EXISTS knowledge_graphs (
    document_id  UUID PRIMARY KEY REFERENCES documents(id) ON DELETE CASCADE,
    nodes        JSONB NOT NULL DEFAULT '[]'::jsonb,
    edges        JSONB NOT NULL DEFAULT '[]'::jsonb,
    node_count   INT GENERATED ALWAYS AS (jsonb_array_length(nodes)) STORED,
    edge_count   INT GENERATED ALWAYS AS (jsonb_array_length(edges)) STORED,
    provider     TEXT,
    model        TEXT,
    generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE knowledge_graphs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "kg_select_owner" ON knowledge_graphs;
CREATE POLICY "kg_select_owner" ON knowledge_graphs FOR SELECT USING (
    EXISTS (SELECT 1 FROM documents d WHERE d.id = knowledge_graphs.document_id AND d.created_by = auth.uid())
);

DROP POLICY IF EXISTS "kg_insert_owner" ON knowledge_graphs;
CREATE POLICY "kg_insert_owner" ON knowledge_graphs FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM documents d WHERE d.id = knowledge_graphs.document_id AND d.created_by = auth.uid())
);

DROP POLICY IF EXISTS "kg_update_owner" ON knowledge_graphs;
CREATE POLICY "kg_update_owner" ON knowledge_graphs FOR UPDATE USING (
    EXISTS (SELECT 1 FROM documents d WHERE d.id = knowledge_graphs.document_id AND d.created_by = auth.uid())
) WITH CHECK (
    EXISTS (SELECT 1 FROM documents d WHERE d.id = knowledge_graphs.document_id AND d.created_by = auth.uid())
);

DROP POLICY IF EXISTS "kg_delete_owner" ON knowledge_graphs;
CREATE POLICY "kg_delete_owner" ON knowledge_graphs FOR DELETE USING (
    EXISTS (SELECT 1 FROM documents d WHERE d.id = knowledge_graphs.document_id AND d.created_by = auth.uid())
);

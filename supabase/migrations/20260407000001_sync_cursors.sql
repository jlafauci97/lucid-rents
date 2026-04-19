-- Tracks resumable position for each sync source so partial runs can continue where they left off
CREATE TABLE IF NOT EXISTS sync_cursors (
  sync_type TEXT PRIMARY KEY,
  cursor_value TEXT NOT NULL,
  cursor_offset INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE sync_cursors IS 'Tracks resumable position for each sync source so partial runs can continue where they left off';
COMMENT ON COLUMN sync_cursors.cursor_value IS 'Last processed date (ISO) or offset depending on API type';
COMMENT ON COLUMN sync_cursors.cursor_offset IS 'Page offset within the current cursor_value date range';

ALTER TABLE sync_cursors ENABLE ROW LEVEL SECURITY;

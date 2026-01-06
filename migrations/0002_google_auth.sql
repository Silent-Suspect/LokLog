-- Create Google Tokens Table
CREATE TABLE IF NOT EXISTS google_tokens (
    user_id TEXT PRIMARY KEY,
    refresh_token TEXT NOT NULL,
    updated_at INTEGER DEFAULT (strftime('%s', 'now'))
);

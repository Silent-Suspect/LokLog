-- Migration: Create user_settings table
CREATE TABLE IF NOT EXISTS user_settings (
  user_id TEXT PRIMARY KEY,
  drive_folder_id TEXT,
  drive_folder_name TEXT,
  pref_download_copy INTEGER DEFAULT 1, -- 1 = true, 0 = false
  updated_at INTEGER
);

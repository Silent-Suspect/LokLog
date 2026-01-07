-- Migration: Add history table for accidental wipes protection
CREATE TABLE IF NOT EXISTS shifts_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    shift_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    date TEXT NOT NULL,
    backup_json TEXT NOT NULL,
    archived_at INTEGER NOT NULL
);

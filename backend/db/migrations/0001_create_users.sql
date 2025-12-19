-- Create users table
CREATE TABLE users (
    `id` INTEGER PRIMARY KEY AUTOINCREMENT,
    `username` TEXT NOT NULL UNIQUE,
    `email` TEXT NOT NULL UNIQUE,
    `password_hash` TEXT NOT NULL,
    `created_at` INTEGER DEFAULT (unixepoch())
);

-- Add userId column to tasks table
ALTER TABLE tasks ADD COLUMN user_id INTEGER;
CREATE TABLE `tasks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`status` text DEFAULT 'todo',
	`priority` text DEFAULT 'medium',
	`module` text,
	`created_at` integer DEFAULT 1762662295
);

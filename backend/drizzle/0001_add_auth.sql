CREATE TABLE `users` (
  `id` text PRIMARY KEY NOT NULL,
  `email` text NOT NULL,
  `password_hash` text NOT NULL,
  `display_name` text NOT NULL,
  `created_at` integer NOT NULL
);
CREATE UNIQUE INDEX `users_email_idx` ON `users` (`email`);

CREATE TABLE `refresh_tokens` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL REFERENCES `users`(`id`) ON DELETE CASCADE,
  `token` text NOT NULL,
  `expires_at` integer NOT NULL,
  `created_at` integer NOT NULL
);
CREATE UNIQUE INDEX `refresh_tokens_token_idx` ON `refresh_tokens` (`token`);
CREATE INDEX `refresh_tokens_user_id_idx` ON `refresh_tokens` (`user_id`);

ALTER TABLE `houses` ADD COLUMN `invite_code` TEXT;
UPDATE `houses` SET `invite_code` = lower(hex(randomblob(3))) WHERE `invite_code` IS NULL;
CREATE UNIQUE INDEX `houses_invite_code_idx` ON `houses` (`invite_code`) WHERE `invite_code` IS NOT NULL;

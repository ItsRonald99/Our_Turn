CREATE TABLE `houses` (
  `id` text PRIMARY KEY NOT NULL,
  `name` text NOT NULL,
  `created_at` integer NOT NULL
);

CREATE TABLE `chore_types` (
  `id` text PRIMARY KEY NOT NULL,
  `house_id` text NOT NULL REFERENCES `houses`(`id`) ON DELETE CASCADE,
  `name` text NOT NULL,
  `rotation_order` integer DEFAULT 0 NOT NULL
);

CREATE TABLE `household_members` (
  `id` text PRIMARY KEY NOT NULL,
  `house_id` text NOT NULL REFERENCES `houses`(`id`) ON DELETE CASCADE,
  `display_name` text NOT NULL,
  `user_id` text
);

CREATE TABLE `chore_assignments` (
  `id` text PRIMARY KEY NOT NULL,
  `house_id` text NOT NULL REFERENCES `houses`(`id`) ON DELETE CASCADE,
  `chore_type_id` text NOT NULL REFERENCES `chore_types`(`id`) ON DELETE CASCADE,
  `member_id` text NOT NULL REFERENCES `household_members`(`id`) ON DELETE CASCADE,
  `due_date` integer NOT NULL,
  `completed_at` integer
);

CREATE INDEX `chore_types_house_id_idx` ON `chore_types` (`house_id`);
CREATE INDEX `household_members_house_id_idx` ON `household_members` (`house_id`);
CREATE INDEX `chore_assignments_house_id_idx` ON `chore_assignments` (`house_id`);

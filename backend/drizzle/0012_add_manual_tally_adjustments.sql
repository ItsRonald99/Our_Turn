CREATE TABLE `manual_tally_adjustments` (
  `id` text PRIMARY KEY NOT NULL,
  `house_id` text NOT NULL REFERENCES `houses`(`id`) ON DELETE CASCADE,
  `member_id` text NOT NULL REFERENCES `household_members`(`id`) ON DELETE CASCADE,
  `chore_type_id` text NOT NULL REFERENCES `chore_types`(`id`) ON DELETE CASCADE,
  `delta` integer NOT NULL CHECK(delta IN (1, -1)),
  `created_at` integer NOT NULL
);

CREATE INDEX `manual_tally_adjustments_house_id_idx` ON `manual_tally_adjustments` (`house_id`);

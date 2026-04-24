PRAGMA foreign_keys = OFF;

CREATE TABLE `manual_tally_adjustments_new` (
  `id` text PRIMARY KEY NOT NULL,
  `house_id` text NOT NULL REFERENCES `houses`(`id`) ON DELETE CASCADE,
  `member_id` text NOT NULL REFERENCES `household_members`(`id`) ON DELETE CASCADE,
  `chore_type_id` text NOT NULL REFERENCES `chore_types`(`id`) ON DELETE CASCADE,
  `delta` integer NOT NULL CHECK(delta IN (1, -1)),
  `created_at` integer NOT NULL
);

INSERT INTO `manual_tally_adjustments_new`
  SELECT `id`, `house_id`, `member_id`, `chore_type_id`, `delta`, `created_at`
  FROM `manual_tally_adjustments`;

DROP TABLE `manual_tally_adjustments`;

ALTER TABLE `manual_tally_adjustments_new` RENAME TO `manual_tally_adjustments`;

CREATE INDEX `manual_tally_adjustments_house_id_idx` ON `manual_tally_adjustments` (`house_id`);

PRAGMA foreign_keys = ON;

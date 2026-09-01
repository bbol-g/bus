CREATE TABLE `audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`actor` text NOT NULL,
	`action` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`summary` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `schedule_rides` (
	`id` text PRIMARY KEY NOT NULL,
	`bus` integer NOT NULL,
	`slot` text NOT NULL,
	`day` text NOT NULL,
	`time` text NOT NULL,
	`stop` text NOT NULL,
	`student` text NOT NULL,
	`english_name` text,
	`group_name` text DEFAULT '미분류' NOT NULL,
	`source_sheet` text,
	`source_row` integer,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `shuttle_changes` (
	`id` text PRIMARY KEY NOT NULL,
	`date` text NOT NULL,
	`student` text NOT NULL,
	`group_name` text DEFAULT '미분류' NOT NULL,
	`type` text NOT NULL,
	`detail` text NOT NULL,
	`source` text NOT NULL,
	`confirmed` integer DEFAULT false NOT NULL,
	`created_by` text NOT NULL,
	`confirmed_by` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);

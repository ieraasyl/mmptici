CREATE TABLE `cqa_appeals` (
	`id` text PRIMARY KEY NOT NULL,
	`evaluation_id` text NOT NULL,
	`criterion_id` text NOT NULL,
	`comment` text NOT NULL,
	`created_at` integer NOT NULL,
	`decision` text,
	`decided_at` integer,
	FOREIGN KEY (`evaluation_id`) REFERENCES `cqa_evaluations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `cqa_appeals_criterion` ON `cqa_appeals` (`evaluation_id`,`criterion_id`);--> statement-breakpoint
CREATE TABLE `cqa_checklists` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`name` text NOT NULL,
	`revision` integer NOT NULL,
	`criteria` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `cqa_checklists_workspace` ON `cqa_checklists` (`workspace_id`);--> statement-breakpoint
CREATE TABLE `cqa_conversations` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`dataset_group` text NOT NULL,
	`source_id` text NOT NULL,
	`channel` text NOT NULL,
	`language` text NOT NULL,
	`transcript` text NOT NULL,
	`audio_url` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `cqa_conversations_source` ON `cqa_conversations` (`workspace_id`,`dataset_group`,`source_id`);--> statement-breakpoint
CREATE TABLE `cqa_evaluations` (
	`id` text PRIMARY KEY NOT NULL,
	`conversation_id` text NOT NULL,
	`checklist` text NOT NULL,
	`ratings` text NOT NULL,
	`model` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`conversation_id`) REFERENCES `cqa_conversations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `cqa_evaluations_conversation` ON `cqa_evaluations` (`conversation_id`,`created_at`);
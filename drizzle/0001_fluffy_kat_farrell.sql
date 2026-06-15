CREATE TABLE "downloads" (
	"id" text PRIMARY KEY NOT NULL,
	"source_url" text DEFAULT '' NOT NULL,
	"local_path" text NOT NULL,
	"file_name" text DEFAULT '' NOT NULL,
	"mime_type" text DEFAULT '' NOT NULL,
	"size_bytes" integer DEFAULT 0 NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"group_name" text DEFAULT '' NOT NULL,
	"source_pages" jsonb DEFAULT '[]'::jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "pages" DROP CONSTRAINT "pages_slug_unique";--> statement-breakpoint
DROP INDEX "pages_parent_slug_idx";--> statement-breakpoint
ALTER TABLE "flipbooks" ADD COLUMN "path" text;--> statement-breakpoint
ALTER TABLE "pages" ADD COLUMN "path" text NOT NULL;--> statement-breakpoint
ALTER TABLE "pages" ADD COLUMN "parent_path" text;--> statement-breakpoint
CREATE INDEX "flipbooks_path_idx" ON "flipbooks" USING btree ("path");--> statement-breakpoint
CREATE INDEX "pages_path_idx" ON "pages" USING btree ("path");--> statement-breakpoint
CREATE INDEX "pages_parent_path_idx" ON "pages" USING btree ("parent_path");--> statement-breakpoint
ALTER TABLE "flipbooks" ADD CONSTRAINT "flipbooks_path_unique" UNIQUE("path");--> statement-breakpoint
ALTER TABLE "pages" ADD CONSTRAINT "pages_path_unique" UNIQUE("path");
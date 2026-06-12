CREATE TABLE "events" (
	"id" serial PRIMARY KEY NOT NULL,
	"language" text DEFAULT 'th' NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"event_date" date NOT NULL,
	"start_time" text,
	"end_time" text,
	"location" text DEFAULT '' NOT NULL,
	"registration_url" text DEFAULT '' NOT NULL,
	"color_hex" text DEFAULT '#0055c7' NOT NULL,
	"attachments" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "faq" (
	"id" serial PRIMARY KEY NOT NULL,
	"language" text DEFAULT 'th' NOT NULL,
	"question" text NOT NULL,
	"answer" text NOT NULL,
	"category" text DEFAULT '' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "featured_projects" (
	"id" serial PRIMARY KEY NOT NULL,
	"language" text DEFAULT 'th' NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"excerpt" text DEFAULT '' NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"category" text DEFAULT '' NOT NULL,
	"featured_image_id" integer,
	"attachments" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"published_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "featured_projects_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "flipbooks" (
	"id" serial PRIMARY KEY NOT NULL,
	"language" text DEFAULT 'th' NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"cover_image_id" integer,
	"pdf_path" text,
	"published_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "flipbooks_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "hero_slides" (
	"id" serial PRIMARY KEY NOT NULL,
	"language" text DEFAULT 'th' NOT NULL,
	"image_id" integer,
	"image_path" text,
	"alt_text" text DEFAULT '' NOT NULL,
	"link_url" text DEFAULT '' NOT NULL,
	"caption" text DEFAULT '' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" serial PRIMARY KEY NOT NULL,
	"language" text DEFAULT 'th' NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"deadline" timestamp with time zone,
	"attachments" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_open" boolean DEFAULT true NOT NULL,
	"published_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "jobs_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "media" (
	"id" serial PRIMARY KEY NOT NULL,
	"filename" text NOT NULL,
	"file_path" text NOT NULL,
	"mime_type" text DEFAULT '' NOT NULL,
	"size_bytes" integer,
	"width" integer,
	"height" integer,
	"alt_text" text DEFAULT '' NOT NULL,
	"uploaded_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "navigation" (
	"id" serial PRIMARY KEY NOT NULL,
	"language" text NOT NULL,
	"label" text NOT NULL,
	"href" text NOT NULL,
	"path" text,
	"external" boolean DEFAULT false NOT NULL,
	"parent_id" integer,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "news" (
	"id" serial PRIMARY KEY NOT NULL,
	"language" text DEFAULT 'th' NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"excerpt" text DEFAULT '' NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"category" text DEFAULT '' NOT NULL,
	"featured_image_id" integer,
	"attachments" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"published_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "news_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "pages" (
	"id" serial PRIMARY KEY NOT NULL,
	"language" text DEFAULT 'th' NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"parent_slug" text,
	"featured_image_id" integer,
	"attachments" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "pages_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "partners" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"logo_image_id" integer,
	"logo_path" text,
	"website_url" text DEFAULT '' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "procurement" (
	"id" serial PRIMARY KEY NOT NULL,
	"language" text DEFAULT 'th' NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"excerpt" text DEFAULT '' NOT NULL,
	"category" text DEFAULT '' NOT NULL,
	"attachments" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"published_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "procurement_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "publications" (
	"id" serial PRIMARY KEY NOT NULL,
	"language" text DEFAULT 'th' NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"category" text DEFAULT '' NOT NULL,
	"featured_image_id" integer,
	"attachments" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"published_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "publications_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "site_meta" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wp_content" (
	"id" serial PRIMARY KEY NOT NULL,
	"wp_id" text NOT NULL,
	"language" text NOT NULL,
	"kind" text NOT NULL,
	"path" text NOT NULL,
	"source_url" text DEFAULT '' NOT NULL,
	"title" text NOT NULL,
	"excerpt" text DEFAULT '' NOT NULL,
	"content_html" text DEFAULT '' NOT NULL,
	"modified" text DEFAULT '' NOT NULL,
	"date" text DEFAULT '' NOT NULL,
	"parent_path" text,
	"featured_media_id" text,
	"featured_media_path" text,
	CONSTRAINT "wp_content_path_unique" UNIQUE("path")
);
--> statement-breakpoint
CREATE TABLE "wp_downloads" (
	"id" text PRIMARY KEY NOT NULL,
	"source_url" text DEFAULT '' NOT NULL,
	"local_path" text NOT NULL,
	"file_name" text DEFAULT '' NOT NULL,
	"mime_type" text DEFAULT '' NOT NULL,
	"size_bytes" integer DEFAULT 0 NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"group" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wp_media" (
	"id" serial PRIMARY KEY NOT NULL,
	"wp_id" text NOT NULL,
	"source_url" text DEFAULT '' NOT NULL,
	"local_path" text NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"alt" text DEFAULT '' NOT NULL,
	"width" integer,
	"height" integer,
	"mime_type" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wp_meta" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wp_navigation" (
	"id" serial PRIMARY KEY NOT NULL,
	"language" text NOT NULL,
	"label" text NOT NULL,
	"href" text NOT NULL,
	"path" text,
	"external" boolean DEFAULT false NOT NULL,
	"parent_id" integer,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "featured_projects" ADD CONSTRAINT "featured_projects_featured_image_id_media_id_fk" FOREIGN KEY ("featured_image_id") REFERENCES "public"."media"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flipbooks" ADD CONSTRAINT "flipbooks_cover_image_id_media_id_fk" FOREIGN KEY ("cover_image_id") REFERENCES "public"."media"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hero_slides" ADD CONSTRAINT "hero_slides_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "news" ADD CONSTRAINT "news_featured_image_id_media_id_fk" FOREIGN KEY ("featured_image_id") REFERENCES "public"."media"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pages" ADD CONSTRAINT "pages_featured_image_id_media_id_fk" FOREIGN KEY ("featured_image_id") REFERENCES "public"."media"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partners" ADD CONSTRAINT "partners_logo_image_id_media_id_fk" FOREIGN KEY ("logo_image_id") REFERENCES "public"."media"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publications" ADD CONSTRAINT "publications_featured_image_id_media_id_fk" FOREIGN KEY ("featured_image_id") REFERENCES "public"."media"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "events_date_idx" ON "events" USING btree ("event_date");--> statement-breakpoint
CREATE INDEX "featured_projects_language_idx" ON "featured_projects" USING btree ("language");--> statement-breakpoint
CREATE INDEX "featured_projects_category_idx" ON "featured_projects" USING btree ("category");--> statement-breakpoint
CREATE INDEX "flipbooks_language_idx" ON "flipbooks" USING btree ("language");--> statement-breakpoint
CREATE INDEX "navigation_language_idx" ON "navigation" USING btree ("language");--> statement-breakpoint
CREATE INDEX "news_language_idx" ON "news" USING btree ("language");--> statement-breakpoint
CREATE INDEX "news_category_idx" ON "news" USING btree ("category");--> statement-breakpoint
CREATE INDEX "pages_language_idx" ON "pages" USING btree ("language");--> statement-breakpoint
CREATE INDEX "pages_parent_slug_idx" ON "pages" USING btree ("parent_slug");--> statement-breakpoint
CREATE INDEX "procurement_language_idx" ON "procurement" USING btree ("language");--> statement-breakpoint
CREATE INDEX "procurement_category_idx" ON "procurement" USING btree ("category");--> statement-breakpoint
CREATE INDEX "publications_language_idx" ON "publications" USING btree ("language");--> statement-breakpoint
CREATE INDEX "wp_content_language_idx" ON "wp_content" USING btree ("language");--> statement-breakpoint
CREATE INDEX "wp_content_parent_path_idx" ON "wp_content" USING btree ("parent_path");
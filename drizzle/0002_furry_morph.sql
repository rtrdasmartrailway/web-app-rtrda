ALTER TABLE "featured_projects" ALTER COLUMN "title" SET DEFAULT '';--> statement-breakpoint
ALTER TABLE "news" ALTER COLUMN "title" SET DEFAULT '';--> statement-breakpoint
ALTER TABLE "pages" ALTER COLUMN "title" SET DEFAULT '';--> statement-breakpoint
ALTER TABLE "featured_projects" ADD COLUMN "title_th" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "featured_projects" ADD COLUMN "title_en" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "featured_projects" ADD COLUMN "excerpt_th" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "featured_projects" ADD COLUMN "excerpt_en" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "featured_projects" ADD COLUMN "body_th" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "featured_projects" ADD COLUMN "body_en" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "news" ADD COLUMN "title_th" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "news" ADD COLUMN "title_en" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "news" ADD COLUMN "excerpt_th" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "news" ADD COLUMN "excerpt_en" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "news" ADD COLUMN "body_th" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "news" ADD COLUMN "body_en" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "pages" ADD COLUMN "title_th" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "pages" ADD COLUMN "title_en" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "pages" ADD COLUMN "body_th" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "pages" ADD COLUMN "body_en" text DEFAULT '' NOT NULL;
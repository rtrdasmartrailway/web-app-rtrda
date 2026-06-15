DROP INDEX "featured_projects_language_idx";--> statement-breakpoint
DROP INDEX "news_language_idx";--> statement-breakpoint
DROP INDEX "pages_language_idx";--> statement-breakpoint
ALTER TABLE "featured_projects" DROP COLUMN "language";--> statement-breakpoint
ALTER TABLE "featured_projects" DROP COLUMN "title";--> statement-breakpoint
ALTER TABLE "featured_projects" DROP COLUMN "excerpt";--> statement-breakpoint
ALTER TABLE "featured_projects" DROP COLUMN "body";--> statement-breakpoint
ALTER TABLE "news" DROP COLUMN "language";--> statement-breakpoint
ALTER TABLE "news" DROP COLUMN "title";--> statement-breakpoint
ALTER TABLE "news" DROP COLUMN "excerpt";--> statement-breakpoint
ALTER TABLE "news" DROP COLUMN "body";--> statement-breakpoint
ALTER TABLE "pages" DROP COLUMN "language";--> statement-breakpoint
ALTER TABLE "pages" DROP COLUMN "title";--> statement-breakpoint
ALTER TABLE "pages" DROP COLUMN "body";
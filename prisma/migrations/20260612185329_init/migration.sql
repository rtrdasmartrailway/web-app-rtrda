-- CreateTable
CREATE TABLE "ContentRecord" (
    "id" TEXT NOT NULL,
    "wpId" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "excerpt" TEXT NOT NULL,
    "contentHtml" TEXT NOT NULL,
    "searchText" TEXT NOT NULL DEFAULT '',
    "date" TEXT NOT NULL,
    "modified" TEXT NOT NULL,
    "parentPath" TEXT,
    "categoryIds" INTEGER[],
    "featuredMediaId" INTEGER,
    "authorId" INTEGER,

    CONSTRAINT "ContentRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" INTEGER NOT NULL,
    "language" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "parent" INTEGER NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MediaAsset" (
    "id" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "localPath" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "alt" TEXT NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "mimeType" TEXT NOT NULL,

    CONSTRAINT "MediaAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Download" (
    "id" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "localPath" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "group" TEXT NOT NULL,
    "sourcePages" TEXT[],

    CONSTRAINT "Download_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SiteMeta" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,

    CONSTRAINT "SiteMeta_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "ContentRecord_path_key" ON "ContentRecord"("path");

-- CreateIndex
CREATE INDEX "ContentRecord_language_kind_date_idx" ON "ContentRecord"("language", "kind", "date");

-- CreateIndex
CREATE INDEX "ContentRecord_parentPath_idx" ON "ContentRecord"("parentPath");

-- Thai-safe fuzzy search: trigram matching works without word boundaries.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX "ContentRecord_title_trgm" ON "ContentRecord" USING GIN ("title" gin_trgm_ops);
CREATE INDEX "ContentRecord_searchText_trgm" ON "ContentRecord" USING GIN ("searchText" gin_trgm_ops);

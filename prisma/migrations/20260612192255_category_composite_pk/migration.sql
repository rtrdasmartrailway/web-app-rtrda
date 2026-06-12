/*
  Warnings:

  - The primary key for the `Category` table will be changed. If it partially fails, the table could be left without primary key constraint.

*/
-- DropIndex
DROP INDEX "ContentRecord_searchText_trgm";

-- DropIndex
DROP INDEX "ContentRecord_title_trgm";

-- AlterTable
ALTER TABLE "Category" DROP CONSTRAINT "Category_pkey",
ADD CONSTRAINT "Category_pkey" PRIMARY KEY ("id", "language");

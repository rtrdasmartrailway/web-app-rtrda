ALTER TABLE "PrComment" ADD COLUMN "ideaId" UUID;

ALTER TABLE "PrComment" DROP CONSTRAINT "PrComment_one_parent";

ALTER TABLE "PrComment"
  ADD CONSTRAINT "PrComment_ideaId_fkey"
  FOREIGN KEY ("ideaId") REFERENCES "PrContentIdea"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PrComment"
  ADD CONSTRAINT "PrComment_one_parent"
  CHECK (num_nonnulls("requestId", "taskId", "ideaId") = 1);

CREATE INDEX "PrComment_ideaId_createdAt_idx"
  ON "PrComment"("ideaId", "createdAt");

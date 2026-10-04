ALTER TABLE "PrComment" DROP CONSTRAINT "PrComment_ideaId_fkey";

ALTER TABLE "PrComment"
  ADD CONSTRAINT "PrComment_ideaId_fkey"
  FOREIGN KEY ("ideaId") REFERENCES "PrContentIdea"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

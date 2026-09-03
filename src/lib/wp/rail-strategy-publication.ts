import type { KnowledgeDocumentGroup } from "./knowledge-documents";
import {
  RAIL_STRATEGY_DOCUMENT_ID,
  RAIL_STRATEGY_PREVIEW_PATH,
} from "@/lib/documents/protected-documents";
import { normalizeRoutePath } from "./url";

export const railStrategyPublicationPath =
  "/เอกสารเผยแพร่/ยุทธศาสตร์-เทคโนโลยีระบบราง-2571-2575";
export const railStrategyPublicationTitle =
  "ยุทธศาสตร์ด้านเทคโนโลยีระบบรางของประเทศ (พ.ศ. 2571 - พ.ศ. 2575)";

export const railStrategyPublicationGroups: KnowledgeDocumentGroup[] = [
  {
    title: railStrategyPublicationTitle,
    open: true,
    compact: true,
    documents: [
      {
        title: railStrategyPublicationTitle,
        description: "",
        coverImage:
          "/wp-content/uploads/pdf-covers/rail-technology-strategy-2571-2575/cover-20260903.png",
        coverAlt: "หน้าปกเอกสารยุทธศาสตร์ด้านเทคโนโลยีระบบรางของประเทศ",
        previewHref: RAIL_STRATEGY_PREVIEW_PATH,
        downloadHref: RAIL_STRATEGY_PREVIEW_PATH,
        hasUsableTarget: true,
        protectedDocumentId: RAIL_STRATEGY_DOCUMENT_ID,
      },
    ],
  },
  {
    title: "อินโฟกราฟฟิค",
    open: false,
    documents: [],
  },
];

export function isRailStrategyPublicationPath(path: string): boolean {
  return normalizeRoutePath(path).normalize("NFC") === railStrategyPublicationPath;
}

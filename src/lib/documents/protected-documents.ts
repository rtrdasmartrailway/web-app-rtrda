import path from "node:path";

export const RAIL_STRATEGY_DOCUMENT_ID = "rail-technology-strategy-2571-2575";
export const RAIL_STRATEGY_PREVIEW_PATH = `/documents/${RAIL_STRATEGY_DOCUMENT_ID}.pdf`;

const documents = {
  [RAIL_STRATEGY_DOCUMENT_ID]: {
    fileName: "rail-technology-strategy-2571-2575.pdf",
    title: "ยุทธศาสตร์ด้านเทคโนโลยีระบบรางของประเทศ (พ.ศ. 2571 - พ.ศ. 2575)",
  },
};

export type ProtectedDocumentId = keyof typeof documents;

export function isProtectedDocumentId(id: string): id is ProtectedDocumentId {
  return id in documents;
}

export function getProtectedDocument(id: string) {
  return isProtectedDocumentId(id) ? documents[id] : null;
}

export function protectedDocumentPath(id: ProtectedDocumentId): string {
  return path.join(
    /*turbopackIgnore: true*/
    process.env.PRIVATE_DOCUMENTS_DIR ?? "/app/private-documents",
    documents[id].fileName,
  );
}

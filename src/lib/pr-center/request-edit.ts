export type RequestEditCandidate = {
  requesterId: string;
  status?: string;
};

export function canEditOwnRequest(
  request: RequestEditCandidate,
  currentUserId: string,
): boolean {
  return (
    request.requesterId === currentUserId &&
    ["DRAFT", "SUBMITTED", "REJECTED", "WITHDRAWN"].includes(request.status || "")
  );
}

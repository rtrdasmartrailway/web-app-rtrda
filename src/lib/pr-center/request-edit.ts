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
    (request.status === "DRAFT" ||
      request.status === "SUBMITTED" ||
      request.status === "REJECTED")
  );
}

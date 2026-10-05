export async function submitIdeaForm(
  create: () => Promise<boolean>,
  onSaved: () => void,
): Promise<boolean> {
  const saved = await create();
  if (!saved) return false;
  onSaved();
  return true;
}

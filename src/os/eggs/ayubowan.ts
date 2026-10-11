export async function ayubowan(isActive: () => boolean): Promise<void> {
  const api = await import('../mochi/api');
  if (isActive()) api.wave();
}

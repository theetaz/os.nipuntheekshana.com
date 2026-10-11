/** Safe raw-text content for an application/json script. The key belongs on data-key. */
export function serializeInitialData(data: unknown): string {
  const json = JSON.stringify(data);
  if (json === undefined) throw new TypeError('Initial data must be JSON serializable');
  return json.replace(/</g, '\\u003c');
}

/**
 * Returns a promise that resolves after `ms` milliseconds.
 * Used for retry back-off delays.
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

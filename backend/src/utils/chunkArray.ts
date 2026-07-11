/**
 * Splits an array into chunks of a given size.
 *
 * @example
 * chunkArray([1,2,3,4,5], 2) → [[1,2],[3,4],[5]]
 */
export function chunkArray<T>(array: T[], chunkSize: number): T[][] {
  if (chunkSize <= 0) {
    throw new Error("chunkSize must be greater than 0");
  }

  const chunks: T[][] = [];

  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }

  return chunks;
}

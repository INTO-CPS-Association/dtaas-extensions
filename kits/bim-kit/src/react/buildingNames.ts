/**
 * The name each building model gives itself, read from the start of its IFC
 * file, and the names that tell the models apart.
 */

import { IFC_HEAD_BYTES, ifcBuildingName } from '../ifcName.js';
import { fileUrl } from './assets.js';

/**
 * The name an IFC file gives its building, or null.
 *
 * Only the start of the file is requested, since the project and the building
 * are named within its first few kilobytes. A server that ignores the range and
 * sends the whole file is read only as far as that too, and the rest of the
 * download is cancelled, so naming a 64 MB model never fetches it.
 *
 * Never rejects: a model whose name cannot be read is shown by its file name.
 */
export async function readIfcName(libraryUrl: string, ifcPath: string): Promise<string | null> {
  try {
    const response = await fetch(fileUrl(libraryUrl, ifcPath), {
      credentials: 'include',
      headers: { Range: `bytes=0-${IFC_HEAD_BYTES - 1}` },
    });
    if (!response.ok) return null;
    return ifcBuildingName(await readHead(response, IFC_HEAD_BYTES));
  } catch {
    return null;
  }
}

/** The first bytes of a response as text, reading no further than the limit. */
async function readHead(response: Response, limit: number): Promise<string> {
  const decoder = new TextDecoder('utf-8');
  const reader = response.body?.getReader();
  if (!reader) {
    return decoder.decode((await response.arrayBuffer()).slice(0, limit));
  }

  const chunks: Uint8Array[] = [];
  let total = 0;
  while (total < limit) {
    // eslint-disable-next-line no-await-in-loop -- each read depends on the last
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    total += value.length;
  }
  await reader.cancel();

  const bytes = new Uint8Array(Math.min(total, limit));
  let offset = 0;
  // Every chunk but the last starts before the limit, since reading stops as
  // soon as the limit is passed, so the last one is the only one cut short.
  for (const chunk of chunks) {
    const room = bytes.length - offset;
    bytes.set(chunk.subarray(0, room), offset);
    offset += Math.min(chunk.length, room);
  }
  return decoder.decode(bytes);
}

/**
 * The names to show, keyed by IFC file name, with any shared name left out.
 *
 * A name two files give identifies neither of them: the two substation models
 * are both "SWiM district cooling substation", and their file names are the only
 * thing that tells them apart. So a shared name is dropped for every file that
 * gives it, and each keeps its file name.
 */
export function uniqueNames(names: ReadonlyMap<string, string | null>): Map<string, string> {
  const counts = new Map<string, number>();
  names.forEach((name) => {
    if (name) counts.set(name, (counts.get(name) ?? 0) + 1);
  });
  const titles = new Map<string, string>();
  names.forEach((name, file) => {
    if (name && counts.get(name) === 1) titles.set(file, name);
  });
  return titles;
}

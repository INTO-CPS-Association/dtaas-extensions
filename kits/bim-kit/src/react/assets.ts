/**
 * Finding the building models a user has, and the geometry derived from them.
 *
 * The models sit in a directory of the user's library that the host names: this
 * package does not know where a deployment keeps them. An IFC file is a text
 * exchange format holding parametric solids, and a GLB converted from it sits
 * beside it when one has been made, so this module pairs each IFC with what has
 * been derived from it. The building's name is read from the start of the file
 * in buildingNames.ts.
 *
 * The Library page already embeds the workspace file server, so the same
 * server answers here: `api/contents` lists a directory and `files` serves the
 * bytes. Reading a 20 MB GLB through the GitLab API instead would arrive as
 * base64 inside JSON, and the client's existing helper for that returns a
 * string, which is not a safe container for binary.
 *
 * Nothing here fetches. The functions take a listing and return what it means,
 * so they can be tested without a server.
 */

/** One entry as the workspace file server reports it. */
export interface LibraryEntry {
  name: string;
  path: string;
  type?: string;
  size?: number;
}

/** A building model, with whatever has been derived from it so far. */
export interface BimModel {
  /** The file name without its suffix, which is what a person recognises. */
  name: string;
  /**
   * What to call the model on screen.
   *
   * A file name says what the file is called and not what the building is, so
   * this is the name the IFC file gives its building, read from the file. A
   * file that gives none is shown by its file name.
   */
  title: string;
  ifcPath: string;
  sizeBytes?: number;
  /** Present once the conversion has run. Absent means it has not. */
  geometryPath?: string;
  /** The property tree keyed by GlobalId, written beside the geometry. */
  treePath?: string;
  /** Which sensor is bound to which object. Absent when the model declares none. */
  manifestPath?: string;
}

const IFC = '.ifc';
const GEOMETRY = '.glb';
const TREE = '.json';
// Checked before TREE, because it also ends in `.json` and would otherwise be
// taken for the property tree.
const MANIFEST = '.manifest.json';

/**
 * The directory DTaaS keeps models in, kept only so a host of 0.1.0 still works.
 *
 * @deprecated The directory is the host's convention and not this package's,
 * so a host passes it to `BuildingModels` as `directory`. This default is kept
 * for compatibility with 0.1.0, which exported it. Removing it breaks a host
 * that still reads it, so it stays until a release that is allowed to break hosts.
 */
export const MODELS_DIRECTORY = 'common/models';

function stemOf(name: string, suffix: string): string {
  return name.slice(0, name.length - suffix.length);
}

function endsWith(name: string, suffix: string): boolean {
  return name.toLowerCase().endsWith(suffix);
}

/**
 * Pair every IFC file in a listing with the geometry derived from it.
 *
 * The pairing is by file name, because that is the only thing the conversion
 * can be relied on to preserve. A model with no geometry beside it is still
 * returned, so the page can say that conversion has not run instead of
 * leaving the model out and looking like it was never uploaded.
 */
/**
 * A file name as a person reads it, for a model whose file gives no name.
 *
 * Only the separators change: `Building_1912_AK_v4` reads "Building 1912 AK v4".
 * The case is left alone, because in these names it carries meaning, as in AK
 * and v4, and a guess at a building name would be worse than the file's own.
 */
export function readableName(stem: string): string {
  return stem.replace(/_+/g, ' ').replace(/\s+/g, ' ').trim();
}

export function pairModels(
  entries: LibraryEntry[],
  titles: ReadonlyMap<string, string> = new Map(),
): BimModel[] {
  const derived = new Map<string, LibraryEntry>();
  for (const entry of entries) {
    if (endsWith(entry.name, GEOMETRY)) {
      derived.set(stemOf(entry.name, GEOMETRY) + GEOMETRY, entry);
    } else if (endsWith(entry.name, MANIFEST)) {
      derived.set(stemOf(entry.name, MANIFEST) + MANIFEST, entry);
    } else if (endsWith(entry.name, TREE)) {
      derived.set(stemOf(entry.name, TREE) + TREE, entry);
    }
  }

  return entries
    .filter((entry) => endsWith(entry.name, IFC))
    .map((entry) => {
      const stem = stemOf(entry.name, IFC);
      return {
        name: stem,
        title: titles.get(entry.name) ?? readableName(stem),
        ifcPath: entry.path,
        sizeBytes: entry.size,
        geometryPath: derived.get(stem + GEOMETRY)?.path,
        treePath: derived.get(stem + TREE)?.path,
        manifestPath: derived.get(stem + MANIFEST)?.path,
      };
    })
    .sort((left, right) => left.title.localeCompare(right.title));
}

/**
 * Join a base URL and a workspace path, encoding each segment.
 *
 * The file this was built against is called
 * `[3D IFC SG] Project CleanTech One 02-24 IFC SG.ifc`. Brackets and spaces in
 * a name are ordinary, and pasting one into a URL unencoded produces a request
 * for a different file or for none.
 */
function join(base: string, prefix: string, path: string): string {
  const root = base.endsWith('/') ? base : `${base}/`;
  const encoded = path.split('/').map(encodeURIComponent).join('/');
  return `${root}${prefix}/${encoded}`;
}

/** The listing of one directory, as JSON. */
export function contentsUrl(libraryUrl: string, path: string): string {
  return join(libraryUrl, 'api/contents', path);
}

/** The bytes of one file. */
export function fileUrl(libraryUrl: string, path: string): string {
  return join(libraryUrl, 'files', path);
}

/**
 * The largest IFC file the page converts in the browser.
 *
 * Conversion holds the whole file and the geometry made from it in the tab's
 * memory, so a file well past this size stalls or crashes the tab, and the
 * library is shared, so anyone who can write to it could leave such a file.
 */
export const MAX_CONVERT_BYTES = 200 * 1024 * 1024;

/**
 * Whether a model would have to be converted here and is too large for it.
 * A model with geometry beside it is not converted, and a listing that gives
 * no size cannot tell, so both are left to draw.
 */
export function tooLargeToConvert(model: BimModel): boolean {
  if (model.geometryPath || model.sizeBytes === undefined) return false;
  return model.sizeBytes > MAX_CONVERT_BYTES;
}

/** How large a model is, for a page that has to admit a 24 MB download. */
export function formatSize(bytes: number | undefined): string {
  if (bytes === undefined) return '';
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

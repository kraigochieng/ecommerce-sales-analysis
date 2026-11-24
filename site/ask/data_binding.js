// Reads values from the data model of a surface. A binding is an object with one
// "path" key. The path is a JSON Pointer such as "/rows/0/region".

/**
 * @typedef {{ path: string }} Binding
 */

/**
 * Tells whether a value is a binding.
 * @param {{ value: unknown }} options
 * @returns {boolean}
 */
export function isBinding({ value }) {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.keys(value).length === 1 &&
    typeof value.path === "string" &&
    value.path.startsWith("/")
  );
}

/**
 * Splits a JSON Pointer into its decoded segments.
 * @param {{ pointer: string }} options
 * @returns {string[]}
 */
function pointerSegments({ pointer }) {
  return pointer
    .slice(1)
    .split("/")
    .map((segment) => segment.replaceAll("~1", "/").replaceAll("~0", "~"));
}

/**
 * Takes one step down into a value. Only own properties count.
 * @param {{ current: unknown, segment: string }} options
 * @returns {unknown}
 */
function stepInto({ current, segment }) {
  const canStep = typeof current === "object" && current !== null && Object.hasOwn(current, segment);
  return canStep ? current[segment] : undefined;
}

/**
 * Reads the value at a JSON Pointer. Returns undefined when the path does not exist.
 * @param {{ dataModel: unknown, pointer: string }} options
 * @returns {unknown}
 */
export function resolvePointer({ dataModel, pointer }) {
  return pointerSegments({ pointer }).reduce(
    (current, segment) => stepInto({ current, segment }),
    dataModel,
  );
}

/**
 * Returns a literal value, or the value that a binding points to.
 * @param {{ value: unknown, dataModel: unknown }} options
 * @returns {unknown}
 */
export function resolveDynamic({ value, dataModel }) {
  return isBinding({ value }) ? resolvePointer({ dataModel, pointer: value.path }) : value;
}

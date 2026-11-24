// Checks the A2UI messages from the model against the catalog and the data model.
// The page trusts nothing in a message until it passes this check.

import { A2UI_VERSION, SURFACE_ID } from "./config.js";
import { COMPONENT_SPECS, LIMITS, TEXT_VARIANTS, VALUE_FORMATS } from "./a2ui_catalog.js";
import { isBinding, resolveDynamic, resolvePointer } from "./data_binding.js";
import { A2uiValidationError } from "./errors.js";

const ROOT_ID = "root";
const ID_PATTERN = /^[A-Za-z0-9_-]+$/;
const MAXIMUM_KEY_LENGTH = 60;
const MAXIMUM_REPORTED_PROBLEMS = 8;

/**
 * @typedef {Record<string, unknown>} Component  One component object from a message.
 * @typedef {{ rootId: string, components: Map<string, Component> }} ValidSurface
 */

/** Tells whether a value is an object that is not an array. */
function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Tells whether a value is a non-empty string of at most the given length. */
function isShortText({ value, maximumLength }) {
  return typeof value === "string" && value.trim() !== "" && value.length <= maximumLength;
}

// --- checks for the value of one property ---------------------------------

/**
 * Checks the rows that a binding points to.
 * @param {{ value: unknown, dataModel: unknown, label: string, minimum: number, maximum: number }} options
 * @returns {string[]}
 */
function checkRowsBinding({ value, dataModel, label, minimum, maximum }) {
  if (!isBinding({ value })) return [label + ' must be a binding such as {"path": "/rows"}.'];
  const rows = resolvePointer({ dataModel, pointer: value.path });
  if (!Array.isArray(rows)) return [label + " points to " + value.path + ", which is not a list of rows."];
  if (!rows.every(isPlainObject)) return [label + " points to rows that are not objects."];
  const countOk = rows.length >= minimum && rows.length <= maximum;
  return countOk ? [] : [label + " needs " + minimum + " to " + maximum + " rows, but " + value.path + " has " + rows.length + "."];
}

/**
 * Checks a value that is a literal text or a binding to a text or a number.
 * @param {{ value: unknown, dataModel: unknown, label: string }} options
 * @returns {string[]}
 */
function checkDynamicText({ value, dataModel, label }) {
  const resolved = resolveDynamic({ value, dataModel });
  const isNumber = typeof resolved === "number" && Number.isFinite(resolved);
  const isText = isShortText({ value: resolved, maximumLength: LIMITS.maximumTextLength });
  if (isNumber || isText) return [];
  const detail = isBinding({ value }) ? "points to " + value.path + ", which holds no text or number" : "must be a short text or a binding";
  return [label + " " + detail + "."];
}

/** @type {Record<string, (options: { value: unknown, dataModel: unknown, label: string }) => string[]>} */
const PROPERTY_CHECKS = {
  childIds: ({ value, label }) => {
    const valid = Array.isArray(value) && value.length >= 1 && value.length <= LIMITS.maximumChildren && value.every((item) => typeof item === "string");
    return valid ? [] : [label + " must be a list of 1 to " + LIMITS.maximumChildren + " component IDs."];
  },
  text: ({ value, label }) =>
    isShortText({ value, maximumLength: LIMITS.maximumTextLength }) ? [] : [label + " must be a text of 1 to " + LIMITS.maximumTextLength + " characters."],
  dynamicText: checkDynamicText,
  barBinding: ({ value, dataModel, label }) =>
    checkRowsBinding({ value, dataModel, label, minimum: 1, maximum: LIMITS.maximumBars }),
  lineBinding: ({ value, dataModel, label }) =>
    checkRowsBinding({ value, dataModel, label, minimum: LIMITS.minimumPoints, maximum: LIMITS.maximumPoints }),
  tableBinding: ({ value, dataModel, label }) =>
    checkRowsBinding({ value, dataModel, label, minimum: 1, maximum: LIMITS.maximumTableRows }),
  keyName: ({ value, label }) =>
    isShortText({ value, maximumLength: MAXIMUM_KEY_LENGTH }) ? [] : [label + " must be a column name."],
  keyNameList: ({ value, label }) => {
    const valid = Array.isArray(value) && value.length >= 1 && value.length <= LIMITS.maximumTableColumns && value.every((item) => isShortText({ value: item, maximumLength: MAXIMUM_KEY_LENGTH }));
    return valid ? [] : [label + " must be a list of 1 to " + LIMITS.maximumTableColumns + " column names."];
  },
  textVariant: ({ value, label }) =>
    TEXT_VARIANTS.includes(value) ? [] : [label + " must be one of: " + TEXT_VARIANTS.join(", ") + "."],
  valueFormat: ({ value, label }) =>
    VALUE_FORMATS.includes(value) ? [] : [label + " must be one of: " + VALUE_FORMATS.join(", ") + "."],
};

// --- checks that join several properties of one component -----------------

/**
 * Checks that the key columns exist in every row, and that each value is a number.
 * @param {{ component: Component, dataModel: unknown, allowNegative: boolean }} options
 * @returns {string[]}
 */
function checkSeries({ component, dataModel, allowNegative }) {
  const rows = resolvePointer({ dataModel, pointer: component.data.path });
  const label = "Component " + JSON.stringify(component.id);
  const missingLabel = rows.findIndex((row) => !Object.hasOwn(row, component.labelKey));
  const missingValue = rows.findIndex((row) => !Object.hasOwn(row, component.valueKey));
  const badValue = rows.findIndex((row) => !Number.isFinite(row[component.valueKey]) || (!allowNegative && row[component.valueKey] < 0));
  return [
    ...(missingLabel >= 0 ? [label + ": labelKey " + JSON.stringify(component.labelKey) + " is not a column of the rows."] : []),
    ...(missingValue >= 0 ? [label + ": valueKey " + JSON.stringify(component.valueKey) + " is not a column of the rows."] : []),
    ...(missingValue < 0 && badValue >= 0 ? [label + ": valueKey " + JSON.stringify(component.valueKey) + " must hold " + (allowNegative ? "numbers" : "numbers of zero or more") + " in every row."] : []),
  ];
}

/**
 * Checks that each column of a table exists in the rows.
 * @param {{ component: Component, dataModel: unknown }} options
 * @returns {string[]}
 */
function checkTableColumns({ component, dataModel }) {
  const rows = resolvePointer({ dataModel, pointer: component.data.path });
  const unknownColumns = component.columns.filter((column) => !rows.every((row) => Object.hasOwn(row, column)));
  return unknownColumns.map((column) => "Component " + JSON.stringify(component.id) + ": column " + JSON.stringify(column) + " is not a column of the rows.");
}

/** @type {Record<string, (options: { component: Component, dataModel: unknown }) => string[]>} */
const COMPONENT_CHECKS = {
  BarChart: ({ component, dataModel }) => checkSeries({ component, dataModel, allowNegative: false }),
  LineChart: ({ component, dataModel }) => checkSeries({ component, dataModel, allowNegative: true }),
  Table: checkTableColumns,
};

// --- checks for one component ---------------------------------------------

/**
 * Checks the id, the type, the properties, and the data of one component.
 * @param {{ component: unknown, dataModel: unknown }} options
 * @returns {string[]}
 */
function checkComponent({ component, dataModel }) {
  if (!isPlainObject(component)) return ["A component is not an object."];
  const label = "Component " + JSON.stringify(component.id);
  const idProblems = isShortText({ value: component.id, maximumLength: LIMITS.maximumIdLength }) && ID_PATTERN.test(component.id)
    ? []
    : [label + ": id must be letters, digits, dash, or underscore, up to " + LIMITS.maximumIdLength + " characters."];
  if (typeof component.component !== "string" || !Object.hasOwn(COMPONENT_SPECS, component.component)) {
    return [...idProblems, label + ": unknown component " + JSON.stringify(component.component) + ". Use one of: " + Object.keys(COMPONENT_SPECS).join(", ") + "."];
  }
  const propertySpecs = COMPONENT_SPECS[component.component].properties;
  const allowedKeys = ["id", "component", ...Object.keys(propertySpecs)];
  const unknownProblems = Object.keys(component)
    .filter((key) => !allowedKeys.includes(key))
    .map((key) => label + ": unknown property " + JSON.stringify(key) + ".");
  const missingProblems = Object.entries(propertySpecs)
    .filter(([name, spec]) => spec.required && component[name] === undefined)
    .map(([name]) => label + ": missing required property " + JSON.stringify(name) + ".");
  const valueProblems = Object.entries(propertySpecs)
    .filter(([name]) => component[name] !== undefined)
    .flatMap(([name, spec]) => PROPERTY_CHECKS[spec.kind]({ value: component[name], dataModel, label: label + " property " + name }));
  const earlyProblems = [...idProblems, ...unknownProblems, ...missingProblems, ...valueProblems];
  const joinCheck = COMPONENT_CHECKS[component.component];
  return earlyProblems.length > 0 || !joinCheck ? earlyProblems : joinCheck({ component, dataModel });
}

// --- checks for the messages and the tree ----------------------------------

/**
 * Reads one message and returns its components and its problems.
 * @param {{ message: unknown, position: number }} options
 * @returns {{ problems: string[], components: unknown[] }}
 */
function readMessage({ message, position }) {
  const label = "Message " + position;
  if (!isPlainObject(message)) return { problems: [label + " is not an object."], components: [] };
  const keyProblems = Object.keys(message)
    .filter((key) => key !== "version" && key !== "updateComponents")
    .map((key) => label + ": the key " + JSON.stringify(key) + " is not allowed. The page creates the surface and sets the data model. Send only updateComponents.");
  const versionProblems = message.version === undefined || message.version === A2UI_VERSION ? [] : [label + ": version must be " + JSON.stringify(A2UI_VERSION) + "."];
  const update = message.updateComponents;
  if (!isPlainObject(update) || !Array.isArray(update.components)) {
    return { problems: [...keyProblems, ...versionProblems, label + " needs an updateComponents object with a components list."], components: [] };
  }
  const surfaceProblems = update.surfaceId === SURFACE_ID ? [] : [label + ": surfaceId must be " + JSON.stringify(SURFACE_ID) + "."];
  return { problems: [...keyProblems, ...versionProblems, ...surfaceProblems], components: update.components };
}

/**
 * Lists the child IDs of a component.
 * @param {{ component: Component }} options
 * @returns {string[]}
 */
function childIdsOf({ component }) {
  return Array.isArray(component.children) ? component.children.filter((child) => typeof child === "string") : [];
}

/**
 * Finds the depth of the tree below a component. The tree must have no cycle.
 * @param {{ id: string, byId: Map<string, Component> }} options
 * @returns {number}
 */
function depthOf({ id, byId }) {
  const childDepths = childIdsOf({ component: byId.get(id) }).map((childId) => depthOf({ id: childId, byId }));
  return 1 + Math.max(0, ...childDepths);
}

/**
 * Checks that the components form one tree below the root.
 * @param {{ byId: Map<string, Component> }} options
 * @returns {string[]}
 */
function checkTree({ byId }) {
  if (!byId.has(ROOT_ID)) return ["No component has the id \"root\". The first component must be a Column with the id \"root\"."];
  const allChildIds = [...byId.values()].flatMap((component) => childIdsOf({ component }));
  const missing = allChildIds.filter((childId) => !byId.has(childId));
  const repeated = allChildIds.filter((childId, index) => allChildIds.indexOf(childId) !== index);
  const structureProblems = [
    ...missing.map((childId) => "A component lists the child " + JSON.stringify(childId) + ", but no component has that id."),
    ...repeated.map((childId) => "The component " + JSON.stringify(childId) + " is a child more than once. Each component has one parent."),
    ...(allChildIds.includes(ROOT_ID) ? ["The root component cannot be a child."] : []),
    ...(byId.size > LIMITS.maximumComponents ? ["There are " + byId.size + " components. The most allowed is " + LIMITS.maximumComponents + "."] : []),
  ];
  if (structureProblems.length > 0) return structureProblems;
  const depth = depthOf({ id: ROOT_ID, byId });
  return depth > LIMITS.maximumDepth ? ["The tree is " + depth + " levels deep. The most allowed is " + LIMITS.maximumDepth + "."] : [];
}

// --- the public check -------------------------------------------------------

/**
 * Checks the messages of the model and returns the components of the surface.
 * @param {{ messages: unknown, dataModel: unknown }} options
 * @returns {ValidSurface}
 * @throws {A2uiValidationError} with every problem found (up to a limit).
 */
export function validateSurface({ messages, dataModel }) {
  const messageList = Array.isArray(messages) ? messages : [messages];
  const readMessages = messageList.map((message, index) => readMessage({ message, position: index + 1 }));
  const components = readMessages.flatMap((read) => read.components);
  const byId = new Map(
    components
      .filter((component) => isPlainObject(component) && typeof component.id === "string")
      .map((component) => [component.id, component]),
  );
  const withoutId = components.filter((component) => !isPlainObject(component) || typeof component.id !== "string");
  const noUpdate = readMessages.every((read) => read.components.length === 0) ? ["No message holds any component."] : [];
  const problems = [
    ...readMessages.flatMap((read) => read.problems),
    ...noUpdate,
    ...[...byId.values(), ...withoutId].flatMap((component) => checkComponent({ component, dataModel })),
    ...checkTree({ byId }),
  ];
  if (problems.length === 0) return { rootId: ROOT_ID, components: byId };
  const hidden = problems.length - MAXIMUM_REPORTED_PROBLEMS;
  const shown = problems.slice(0, MAXIMUM_REPORTED_PROBLEMS);
  throw new A2uiValidationError({ problems: hidden > 0 ? [...shown, "And " + hidden + " more problems."] : shown });
}

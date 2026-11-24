// The catalog of components that the page can draw. The validator, the renderer,
// and the prompt for the model all read this one description.

/** The number formats that a component can use. */
export const VALUE_FORMATS = Object.freeze(["number", "percent", "compact"]);

/** The looks that a Text component can have. */
export const TEXT_VARIANTS = Object.freeze(["h2", "body", "caption"]);

/** The limits that keep one answer small. */
export const LIMITS = Object.freeze({
  maximumComponents: 30,
  maximumDepth: 6,
  maximumChildren: 12,
  maximumTextLength: 600,
  maximumIdLength: 40,
  maximumBars: 30,
  minimumPoints: 2,
  maximumPoints: 400,
  maximumTableColumns: 12,
  maximumTableRows: 100,
});

/**
 * @typedef {"childIds" | "text" | "dynamicText" | "tableBinding" | "barBinding" | "lineBinding"
 *   | "keyName" | "keyNameList" | "textVariant" | "valueFormat"} PropertyKind
 * @typedef {{ kind: PropertyKind, required: boolean, description: string }} PropertySpec
 * @typedef {{ description: string, properties: Record<string, PropertySpec> }} ComponentSpec
 */

/** Builds a required property spec. */
function required({ kind, description }) {
  return { kind, required: true, description };
}

/** Builds an optional property spec. */
function optional({ kind, description }) {
  return { kind, required: false, description };
}

/** @type {Record<string, ComponentSpec>} */
export const COMPONENT_SPECS = Object.freeze({
  Column: {
    description: "Stacks its children from top to bottom. The root component is a Column.",
    properties: {
      children: required({ kind: "childIds", description: "list of child component IDs" }),
    },
  },
  Text: {
    description: "A line or a short paragraph of text.",
    properties: {
      text: required({ kind: "dynamicText", description: "the text, or a {\"path\": \"/rows/0/column\"} binding" }),
      variant: optional({ kind: "textVariant", description: "one of " + TEXT_VARIANTS.join(", ") + "; default body" }),
    },
  },
  Stat: {
    description: "One big number with a label.",
    properties: {
      label: required({ kind: "text", description: "what the number is" }),
      value: required({ kind: "dynamicText", description: "the number, or a {\"path\": \"/rows/0/column\"} binding" }),
      format: optional({ kind: "valueFormat", description: "one of " + VALUE_FORMATS.join(", ") + "; default number" }),
    },
  },
  BarChart: {
    description: "Horizontal bars, one for each row. Values must be zero or more.",
    properties: {
      title: required({ kind: "text", description: "chart title" }),
      subtitle: optional({ kind: "text", description: "one line under the title, for example the unit" }),
      data: required({ kind: "barBinding", description: "{\"path\": \"/rows\"}, at most " + LIMITS.maximumBars + " rows" }),
      labelKey: required({ kind: "keyName", description: "the column for the bar labels" }),
      valueKey: required({ kind: "keyName", description: "the numeric column for the bar lengths" }),
      format: optional({ kind: "valueFormat", description: "one of " + VALUE_FORMATS.join(", ") + "; default number" }),
    },
  },
  LineChart: {
    description: "A line over ordered rows, such as months. The rows must be in the order to draw.",
    properties: {
      title: required({ kind: "text", description: "chart title" }),
      subtitle: optional({ kind: "text", description: "one line under the title, for example the unit" }),
      data: required({ kind: "lineBinding", description: "{\"path\": \"/rows\"}, " + LIMITS.minimumPoints + " to " + LIMITS.maximumPoints + " rows" }),
      labelKey: required({ kind: "keyName", description: "the column for the x labels" }),
      valueKey: required({ kind: "keyName", description: "the numeric column for the y values" }),
      format: optional({ kind: "valueFormat", description: "one of " + VALUE_FORMATS.join(", ") + "; default number" }),
    },
  },
  Table: {
    description: "A table of rows.",
    properties: {
      title: required({ kind: "text", description: "table title" }),
      data: required({ kind: "tableBinding", description: "{\"path\": \"/rows\"}, at most " + LIMITS.maximumTableRows + " rows" }),
      columns: required({ kind: "keyNameList", description: "the columns to show, in order, at most " + LIMITS.maximumTableColumns }),
    },
  },
});

/**
 * Describes the catalog in plain text, for the prompt of the model.
 * @returns {string}
 */
export function describeCatalog() {
  return Object.entries(COMPONENT_SPECS)
    .map(([name, spec]) => {
      const properties = Object.entries(spec.properties)
        .map(([property, propertySpec]) => "    - " + property + (propertySpec.required ? " (required)" : " (optional)") + ": " + propertySpec.description)
        .join("\n");
      return "  " + name + ": " + spec.description + "\n" + properties;
    })
    .join("\n");
}

export type MessageTree = { [key: string]: string | MessageTree };

function isTree(value: unknown): value is MessageTree {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Плоский словарь "a.b.c" → значение. */
export function flattenMessages(tree: MessageTree, prefix = ""): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (isTree(value)) Object.assign(result, flattenMessages(value, path));
    else result[path] = value;
  }
  return result;
}

/** Глубокое слияние: значения из `override` поверх `base`. */
export function mergeMessages(base: MessageTree, override: MessageTree): MessageTree {
  const result: MessageTree = { ...base };
  for (const [key, value] of Object.entries(override)) {
    const current = result[key];
    result[key] = isTree(value) && isTree(current) ? mergeMessages(current, value) : value;
  }
  return result;
}

/** Применяет плоские переопределения "a.b.c" = value к дереву. */
export function applyFlatOverrides(tree: MessageTree, overrides: Record<string, string>): MessageTree {
  const result = structuredClone(tree);
  for (const [path, value] of Object.entries(overrides)) {
    const parts = path.split(".");
    let node: MessageTree = result;
    for (let i = 0; i < parts.length - 1; i++) {
      const next = node[parts[i]];
      if (!isTree(next)) {
        const created: MessageTree = {};
        node[parts[i]] = created;
        node = created;
      } else {
        node = next;
      }
    }
    node[parts[parts.length - 1]] = value;
  }
  return result;
}

import type { Node } from './ast.ts';

function isNode(value: unknown): value is Node {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Node).kind === 'string' &&
    typeof (value as Node).start === 'number'
  );
}

/** The direct children of a node, in source order. */
export function childrenOf(node: Node): Node[] {
  const children: Node[] = [];
  for (const value of Object.values(node)) {
    if (isNode(value)) {
      children.push(value);
    } else if (Array.isArray(value)) {
      for (const item of value) {
        if (isNode(item)) children.push(item);
      }
    }
  }
  return children.sort((a, b) => a.start - b.start);
}

/**
 * Depth-first, pre-order traversal. Return `false` from `visit` to skip
 * a node's children.
 */
export function walk(
  node: Node,
  visit: (node: Node, parent: Node | undefined) => boolean | void,
  parent?: Node,
): void {
  if (visit(node, parent) === false) return;
  for (const child of childrenOf(node)) {
    walk(child, visit, node);
  }
}

/**
 * The chain of nodes containing `offset`, from the root to the innermost.
 * A node contains an offset if `start <= offset <= end`, so that a cursor
 * at the end of an identifier still finds it.
 */
export function nodePathAt(root: Node, offset: number): Node[] {
  const path: Node[] = [];
  let current: Node | undefined = root;
  while (current) {
    path.push(current);
    // Prefer the last matching child, so that at a boundary between
    // two nodes (e.g. `a.b|`) the later one wins.
    let next: Node | undefined;
    for (const child of childrenOf(current)) {
      if (child.start <= offset && offset <= child.end) next = child;
      else if (child.start > offset) break;
    }
    current = next;
  }
  return path;
}

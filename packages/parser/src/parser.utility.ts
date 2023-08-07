import { keysOf } from '@bscotch/utility';
import type { CstNode, CstNodeLocation, IToken } from 'chevrotain';
import type {
  AccessorSuffixesCstChildren,
  AccessorSuffixesCstNode,
  AssignmentRightHandSideCstChildren,
  FunctionArgumentCstNode,
  FunctionArgumentsCstNode,
  IdentifierCstChildren,
  IdentifierCstNode,
  MultilineDoubleStringLiteralCstChildren,
  MultilineSingleStringLiteralCstChildren,
  StringLiteralCstChildren,
} from '../gml-cst.js';
import { ok } from './util.js';

export function functionFromRhs(
  rhs: AssignmentRightHandSideCstChildren | undefined,
) {
  return rhs?.functionExpression?.[0].children;
}

export function structLiteralFromRhs(
  rhs: AssignmentRightHandSideCstChildren | undefined,
) {
  return rhs?.structLiteral?.[0].children;
}

export function arrayLiteralFromRhs(
  rhs: AssignmentRightHandSideCstChildren | undefined,
) {
  return rhs?.expression?.[0].children.primaryExpression?.[0].children
    .arrayLiteral?.[0]?.children;
}

export type IdentifierSource =
  | IdentifierCstChildren
  | IdentifierCstNode
  | IdentifierCstNode[]
  | { identifier: IdentifierCstNode[] }
  | { children: { identifier: IdentifierCstNode[] } };

type AccessorSuffixName = keyof AccessorSuffixesCstChildren;
export type SortedAccessorSuffix<
  T extends AccessorSuffixName = AccessorSuffixName,
> = Required<AccessorSuffixesCstChildren>[T][0];

export function isEmpty(obj: {}) {
  return Object.keys(obj).length === 0;
}

export function sortedFunctionCallParts(
  node: FunctionArgumentsCstNode,
): (IToken | FunctionArgumentCstNode)[] {
  return [
    node.children.StartParen[0],
    ...(node.children.functionArgument || []),
    ...(node.children.Comma || []),
    node.children.EndParen[0],
  ].sort((a, b) => {
    const aLocation = ('location' in a ? a.location! : a) as CstNodeLocation;
    const bLocation = ('location' in b ? b.location! : b) as CstNodeLocation;
    return aLocation.startOffset - bLocation.startOffset;
  });
}

export function stringLiteralAsString(
  children:
    | StringLiteralCstChildren
    | MultilineSingleStringLiteralCstChildren
    | MultilineDoubleStringLiteralCstChildren,
): string {
  const start =
    'StringStart' in children
      ? children.StringStart[0].image
      : 'MultilineSingleStringStart' in children
      ? children.MultilineSingleStringStart[0].image
      : children.MultilineDoubleStringStart[0].image;
  const end =
    'StringEnd' in children
      ? children.StringEnd[0].image
      : 'MultilineSingleStringEnd' in children
      ? children.MultilineSingleStringEnd[0].image
      : children.MultilineDoubleStringEnd[0].image;
  return `${start}${(children.Substring || [])
    .map((s) => s.image)
    .join('')}${end}`;
}

function getStartOffset(node: CstNode | IToken): number {
  return 'startOffset' in node ? node.startOffset : node.location!.startOffset;
}

export function sortChildren(
  records: Record<string, (IToken | CstNode)[]>,
): (IToken | CstNode)[] {
  const sorted: (IToken | CstNode)[] = [];
  for (const key of keysOf(records)) {
    sorted.push(...records[key]);
  }
  sorted.sort((a, b) => getStartOffset(a) - getStartOffset(b));
  return sorted;
}

export function sortedAccessorSuffixes(
  suffixNodes: AccessorSuffixesCstNode[] | undefined,
): SortedAccessorSuffix[] {
  // Convert into a flat array of suffixes, sorted by their position in the source code.
  const sorted: SortedAccessorSuffix[] = [];
  if (!suffixNodes) {
    return sorted;
  }
  for (const node of suffixNodes) {
    const { children } = node;
    const suffixKinds = keysOf(children);
    for (const kind of suffixKinds) {
      ok(children[kind]!.length === 1);
      sorted.push(children[kind]![0]);
    }
  }
  sorted.sort((a, b) => a.location!.startOffset - b.location!.startOffset);
  return sorted;
}

const identifierCstNames = [
  'All',
  'Global',
  'Identifier',
  'Noone',
  'Other',
  'Self',
] as const satisfies readonly (keyof IdentifierCstChildren)[];

export function identifierFrom(nodes: IdentifierSource):
  | {
      token: IToken;
      type: keyof IdentifierCstChildren;
      name: string;
    }
  | undefined {
  let node: IdentifierCstNode;
  if (Array.isArray(nodes)) {
    node = nodes[0];
  } else if ('children' in nodes && 'identifier' in nodes.children) {
    node = nodes.children.identifier[0];
  } else if ('identifier' in nodes) {
    node = nodes.identifier[0];
  } else {
    node = nodes as IdentifierCstNode;
  }
  const children = 'children' in node ? node.children : node;

  const type = identifierCstNames.find((name) => children[name]);
  if (!type) {
    return;
  }
  const token = children[type]![0];
  return { token, type, name: token.image };
}

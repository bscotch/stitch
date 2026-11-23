import type * as Ast from './ast.ts';
import { parse, type ParseResult } from './parser.ts';

/**
 * Compact, parenthesized rendering of an expression tree, so tests can
 * assert on structure (e.g. precedence) without deep object literals.
 */
export function sexpr(node: Ast.Node | null): string {
  if (!node) return '∅';
  switch (node.kind) {
    case 'Identifier':
      return node.name;
    case 'Literal':
      return node.raw;
    case 'BinaryExpression':
      return `(${sexpr(node.left)} ${node.operator} ${sexpr(node.right)})`;
    case 'UnaryExpression':
      return `(${node.operator} ${sexpr(node.argument)})`;
    case 'UpdateExpression':
      return node.prefix
        ? `(${node.operator}${sexpr(node.argument)})`
        : `(${sexpr(node.argument)}${node.operator})`;
    case 'ConditionalExpression':
      return `(${sexpr(node.test)} ? ${sexpr(node.consequent)} : ${sexpr(node.alternate)})`;
    case 'ParenthesizedExpression':
      return `[${sexpr(node.expression)}]`;
    case 'MemberExpression':
      return `${sexpr(node.object)}.${node.property.name}`;
    case 'IndexExpression':
      return `${sexpr(node.object)}[${node.accessor} ${node.indices.map(sexpr).join(', ')}]`;
    case 'CallExpression':
      return `${sexpr(node.callee)}(${node.args.map(sexpr).join(', ')})`;
    case 'NewExpression':
      return `new ${sexpr(node.callee)}(${node.args.map(sexpr).join(', ')})`;
    case 'OmittedArgument':
      return '_';
    case 'MissingExpression':
      return '?';
    case 'ArrayLiteral':
      return `[${node.elements.map(sexpr).join(', ')}]`;
    case 'StructLiteral':
      return `{${node.properties.map((p) => `${sexpr(p.key)}: ${sexpr(p.value)}`).join(', ')}}`;
    case 'FunctionExpression':
      return `function ${node.name?.name ?? ''}(${node.params.map((p) => p.name.name).join(', ')})`;
    case 'TemplateString':
      return `$"${node.parts.map((p) => (p.kind === 'TemplateText' ? p.raw : `{${sexpr(p)}}`)).join('')}"`;
    case 'Assignment':
      return `${sexpr(node.target)} ${node.operator} ${sexpr(node.value)}`;
    case 'ExpressionStatement':
      return sexpr(node.expression);
    default:
      return node.kind;
  }
}

/** Parse a single expression (as the value of an assignment). */
export function parseExpression(source: string): {
  expression: Ast.Expression;
  parsed: ParseResult;
} {
  const parsed = parse(`x = ${source}`);
  const statement = parsed.ast.body[0];
  if (statement?.kind !== 'Assignment') {
    throw new Error(`Expected an assignment, got ${statement?.kind}`);
  }
  return { expression: statement.value, parsed };
}

/** Concatenate token texts, which must reproduce the source exactly. */
export function untokenize(parsed: ParseResult): string {
  return parsed.tokens
    .map((t) => parsed.text.slice(t.start, t.end))
    .join('');
}

/**
 * Source files, and the first (pure) analysis pass: finding the global
 * declarations each file makes.
 */
import {
  childrenOf,
  LineIndex,
  parse,
  type Node,
  type ParseResult,
  type Program,
  type Statement,
} from '@bscotch/gml-syntax';
import { createHash } from 'node:crypto';
import { docTag, docTags, findDocs, type FileDocs } from './docs.ts';
import { ids, type FunctionEntry } from './symbols.ts';
import type { Type } from './types.ts';

/**
 * - `script`: a script's GML
 * - `objectEvent`: an object event's GML
 * - `roomCreation`: a room's creation code
 * - `instanceCreation`: the creation code of an instance in a room
 */
export type SourceFileKind =
  'script' | 'objectEvent' | 'roomCreation' | 'instanceCreation';

/** What the analysis needs to know about a GML file */
export interface SourceFile {
  /** A unique id, e.g. the project-relative POSIX path */
  readonly id: string;
  readonly kind: SourceFileKind;
  /** The name of the asset the file belongs to */
  readonly asset: string;
  /** For object events, the event's file name (e.g. `Create_0`) */
  readonly event?: string;
  /** For instance creation code, the instance's object */
  readonly object?: string;
}

/** A parsed file, ready for analysis */
export interface ParsedFile {
  readonly file: SourceFile;
  readonly text: string;
  readonly hash: string;
  readonly parsed: ParseResult;
  readonly docs: FileDocs;
  readonly lines: LineIndex;
}

export function parseFile(file: SourceFile, text: string): ParsedFile {
  const parsed = parse(text);
  return {
    file,
    text,
    hash: createHash('sha1').update(text).digest('hex'),
    parsed,
    docs: findDocs(parsed),
    lines: new LineIndex(text),
  };
}

export type GlobalDeclarationKind =
  | 'function'
  | 'constructor'
  | 'macro'
  | 'enum'
  | 'globalvar'
  /** `global.name`: declared by assignment (or, failing that, by use) */
  | 'globalMember'
  /** `@globalvar` in a doc comment */
  | 'docGlobal';

export interface GlobalDeclaration {
  name: string;
  kind: GlobalDeclarationKind;
  /** The span of the declared name */
  start: number;
  end: number;
  /** For constructors, the parent constructor's name */
  parent?: string;
  /** For enums, the members */
  members?: { name: string; start: number; end: number }[];
  /** For `global.name`, whether this is an assignment */
  assigned?: boolean;
  /** For functions, whether the doc comment has `@mixin` */
  mixin?: boolean;
  /** For macros, the type of the value, when it can be known without context */
  type?: Type[];
}

/** A variable that a file (very likely) declares on its own `self` */
export interface MemberDeclaration {
  /** `self` is the file's own object; otherwise a constructor's name */
  owner: 'self' | { constructor: string };
  name: string;
  start: number;
  end: number;
  /** Declared where it's definitively declared (a Create event or constructor) */
  definitive: boolean;
  static?: boolean;
}

/** What a file declares, found without knowing anything about the rest of the project */
export interface FileDeclarations {
  globals: GlobalDeclaration[];
  /**
   * Instance and constructor variables found syntactically. These are only
   * a head start: the checker finds the authoritative set.
   */
  members: MemberDeclaration[];
  /** Whether the file calls `event_inherited()` */
  callsInherited: boolean;
  /**
   * Signatures of global functions, as far as they can be known without
   * checking (no return types). These match what the checker produces.
   */
  functions: FunctionEntry[];
}

/**
 * Find a file's global declarations: script functions and constructors,
 * enums, macros, `globalvar`s, `global.x` variables and `@globalvar` docs.
 */
export function declare(file: ParsedFile): FileDeclarations {
  const result: FileDeclarations = {
    globals: [],
    members: [],
    callsInherited: false,
    functions: [],
  };
  const { ast } = file.parsed;
  const isScript = file.file.kind === 'script';
  const isObject = file.file.kind === 'objectEvent';
  const definitiveFile = isObject && file.file.event === 'Create_0';

  for (const variable of file.docs.variables) {
    if (variable.kind !== 'globalvar' || !variable.tag.name) continue;
    result.globals.push({
      name: variable.tag.name.name,
      kind: 'docGlobal',
      start: variable.tag.name.start,
      end: variable.tag.name.end,
    });
  }

  /** Assignments directly in a body (not nested in functions/with) */
  const collectMembers = (
    body: Statement[],
    owner: MemberDeclaration['owner'],
    definitive: boolean,
  ) => {
    const locals = new Set<string>();
    const visit = (statements: Statement[]) => {
      for (const statement of statements) {
        switch (statement.kind) {
          case 'VariableDeclaration':
            for (const d of statement.declarators) {
              if (statement.keyword === 'var') locals.add(d.name.name);
              else if (statement.keyword === 'static' && owner !== 'self') {
                result.members.push({
                  owner,
                  name: d.name.name,
                  start: d.name.start,
                  end: d.name.end,
                  definitive,
                  static: true,
                });
              }
            }
            break;
          case 'Assignment': {
            if (statement.operator !== '=') break;
            const target = statement.target;
            let name: { name: string; start: number; end: number } | undefined;
            if (target.kind === 'Identifier' && !locals.has(target.name)) {
              name = target;
            } else if (
              target.kind === 'MemberExpression' &&
              target.object.kind === 'Identifier' &&
              target.object.name === 'self'
            ) {
              name = target.property;
            }
            if (name?.name) {
              result.members.push({
                owner,
                name: name.name,
                start: name.start,
                end: name.end,
                definitive,
              });
            }
            break;
          }
          case 'FunctionDeclaration':
            result.members.push({
              owner,
              name: statement.name.name,
              start: statement.name.start,
              end: statement.name.end,
              definitive,
            });
            break;
          case 'Block':
            visit(statement.body);
            break;
          case 'IfStatement':
            visit([statement.consequent]);
            if (statement.alternate) visit([statement.alternate]);
            break;
          case 'SwitchStatement':
            for (const c of statement.cases) visit(c.body);
            break;
          case 'TryStatement':
            visit(statement.block.body);
            break;
        }
      }
    };
    visit(body);
  };

  if (isObject) collectMembers(ast.body, 'self', definitiveFile);

  const assignedGlobalSpans = new Set<number>();
  walkStatements(ast, (node, functionDepth) => {
    switch (node.kind) {
      case 'CallExpression':
        if (
          node.callee.kind === 'Identifier' &&
          node.callee.name === 'event_inherited'
        ) {
          result.callsInherited = true;
        }
        break;
      case 'FunctionDeclaration':
        if (isScript && functionDepth === 0) {
          result.globals.push({
            name: node.name.name,
            kind: node.isConstructor ? 'constructor' : 'function',
            start: node.name.start,
            end: node.name.end,
            parent: node.parent?.name.name,
            mixin:
              !!docTag(file.docs.attached.get(node.start), 'mixin') ||
              undefined,
          });
          if (node.isConstructor) {
            collectMembers(
              node.body.body,
              { constructor: node.name.name },
              true,
            );
          }
          result.functions.push(functionSeed(node, file));
        }
        break;
      case 'EnumDeclaration':
        result.globals.push({
          name: node.name.name,
          kind: 'enum',
          start: node.name.start,
          end: node.name.end,
          members: node.members.map((m) => ({
            name: m.name.name,
            start: m.name.start,
            end: m.name.end,
          })),
        });
        break;
      case 'MacroDeclaration': {
        const statementLike = /;\s*$/.test(
          file.text.slice(node.bodyStart, node.bodyEnd),
        );
        result.globals.push({
          name: node.name.name,
          kind: 'macro',
          start: node.name.start,
          end: node.name.end,
          type: statementLike
            ? [{ kind: 'Undefined' }]
            : node.body
              ? literalType(node.body)
              : [],
        });
        break;
      }
      case 'VariableDeclaration':
        if (node.keyword !== 'globalvar') break;
        for (const d of node.declarators) {
          result.globals.push({
            name: d.name.name,
            kind: 'globalvar',
            start: d.name.start,
            end: d.name.end,
          });
        }
        break;
      case 'MemberExpression':
        if (
          node.object.kind === 'Identifier' &&
          node.object.name === 'global' &&
          node.property.name
        ) {
          result.globals.push({
            name: node.property.name,
            kind: 'globalMember',
            start: node.property.start,
            end: node.property.end,
            assigned: false,
          });
        }
        break;
      case 'Assignment':
        // Mark `global.x = ...` as assigned (the MemberExpression is
        // visited after this, so remember it)
        if (
          node.target.kind === 'MemberExpression' &&
          node.target.object.kind === 'Identifier' &&
          node.target.object.name === 'global'
        ) {
          assignedGlobalSpans.add(node.target.property.start);
        }
        break;
    }
  });
  for (const g of result.globals) {
    if (g.kind === 'globalMember' && assignedGlobalSpans.has(g.start)) {
      g.assigned = true;
    }
  }
  return result;
}

/** A global function's signature, minus what needs checking */
function functionSeed(
  node: Extract<Statement, { kind: 'FunctionDeclaration' }>,
  file: ParsedFile,
): FunctionEntry {
  const name = node.name.name;
  const fnId = ids.fn(name);
  const localId = ids.local(fnId);
  const doc = file.docs.attached.get(node.start);
  const paramDocs = docTags(doc, 'param');
  const params = node.params.map((p) => ids.member(localId, p.name.name));
  let variadic: boolean | undefined;
  for (let idx = node.params.length; idx < paramDocs.length; idx++) {
    const docName = paramDocs[idx].name;
    if (!docName) continue;
    params.push(ids.member(localId, `#${idx}`));
    if (docName.rest) variadic = true;
  }
  const templates = docTags(doc, 'template')
    .map((t) => t.name?.name)
    .filter((n): n is string => !!n);
  const mixin = !!docTag(doc, 'mixin');
  const entry: FunctionEntry = {
    id: fnId,
    name,
    params,
    returns: [],
    isConstructor: node.isConstructor,
    local: localId,
    templates: templates.length ? templates : undefined,
    mixin: mixin || undefined,
    variadic,
  };
  if (node.isConstructor) {
    entry.constructs = ids.structShape(name);
    entry.self = { kind: 'Struct', name, entity: entry.constructs };
  } else if (mixin && !docTag(doc, 'self')) {
    entry.mixinShape = `mixin:${fnId}`;
    entry.self = { kind: 'Struct', entity: entry.mixinShape };
  }
  return entry;
}

/**
 * The type of an expression that can be known without any context (the
 * same type the checker would infer), or `undefined`.
 */
function literalType(node: Node): Type[] | undefined {
  switch (node.kind) {
    case 'Literal':
      switch (node.literalKind) {
        case 'number':
          return [{ kind: 'Real' }];
        case 'string':
        case 'rawString':
          return [{ kind: 'String' }];
        case 'boolean':
          return [{ kind: 'Bool' }];
        default:
          return [{ kind: 'Undefined' }];
      }
    case 'TemplateString':
      return [{ kind: 'String' }];
    case 'UnaryExpression':
      if (node.operator === '!') return [{ kind: 'Bool' }];
      if (
        node.operator === '-' ||
        node.operator === '+' ||
        node.operator === '~'
      ) {
        return [{ kind: 'Real' }];
      }
      return undefined;
    case 'ParenthesizedExpression':
      return literalType(node.expression);
  }
  return undefined;
}

/** Visit every node, tracking how deeply nested in functions it is */
function walkStatements(
  root: Program,
  visit: (node: Node, functionDepth: number) => void,
) {
  const stack: [Node, number][] = [[root, 0]];
  while (stack.length) {
    const [node, depth] = stack.pop()!;
    visit(node, depth);
    const childDepth =
      node.kind === 'FunctionDeclaration' || node.kind === 'FunctionExpression'
        ? depth + 1
        : depth;
    const children = childrenOf(node);
    for (let i = children.length - 1; i >= 0; i--) {
      stack.push([children[i], childDepth]);
    }
  }
}

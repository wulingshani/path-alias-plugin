import * as ts from 'typescript';
import { Config } from '../core/config';
import { resolveToRelative } from '../core/resolver';

export interface Edit {
  /** Start offset (inclusive) of the string literal (including its opening quote). */
  start: number;
  /** End offset (exclusive) of the string literal (including its closing quote). */
  end: number;
  /** Original text in [start, end). */
  originalText: string;
  /** Replacement text (also includes quotes). */
  newText: string;
  /** Line number (1-based) where the edit occurs, for sourcemap adjustment. */
  line: number;
  /** 0-based column within its line where the string literal starts. */
  startColumn: number;
}

export interface RewriteResult {
  /** Fully-rewritten source text. Equal to input when no edits applied. */
  output: string;
  /** Character-range edits applied, in source order. */
  edits: Edit[];
}

/**
 * Parse source with the TypeScript Compiler API and rewrite every alias-prefixed
 * module specifier to a real relative path. Returns both the new text and
 * the list of edits so callers can adjust sourcemaps.
 *
 * Uses character-level patching rather than AST serialization to preserve
 * formatting, comments, and whitespace exactly.
 */
export function rewriteImports(
  source: string,
  fromFile: string,
  config: Config
): RewriteResult {
  const sf = ts.createSourceFile(
    fromFile,
    source,
    ts.ScriptTarget.Latest,
    /* setParentNodes */ true,
    inferScriptKind(fromFile)
  );

  const edits: Edit[] = [];

  function visit(node: ts.Node): void {
    const literal = extractModuleSpecifier(node);
    if (literal) {
      tryEdit(literal);
    }
    ts.forEachChild(node, visit);
  }

  function tryEdit(literal: ts.StringLiteral): void {
    const request = literal.text;
    const rel = resolveToRelative(request, fromFile, config);
    if (rel === null) return;
    const start = literal.getStart(sf);
    const end = literal.getEnd();
    const originalText = source.slice(start, end);
    const quote = originalText[0];
    const newText = `${quote}${rel}${quote}`;
    if (originalText === newText) return;
    const { line, character } = sf.getLineAndCharacterOfPosition(start);
    edits.push({
      start,
      end,
      originalText,
      newText,
      line: line + 1,
      startColumn: character
    });
  }

  visit(sf);

  if (edits.length === 0) {
    return { output: source, edits: [] };
  }

  // Apply edits in reverse order so earlier offsets stay valid
  const sorted = [...edits].sort((a, b) => a.start - b.start);
  let output = source;
  for (let i = sorted.length - 1; i >= 0; i--) {
    const e = sorted[i];
    output = output.slice(0, e.start) + e.newText + output.slice(e.end);
  }
  return { output, edits: sorted };
}

function inferScriptKind(file: string): ts.ScriptKind {
  const lower = file.toLowerCase();
  if (lower.endsWith('.d.ts')) return ts.ScriptKind.TS;
  if (lower.endsWith('.ts') || lower.endsWith('.tsx')) return ts.ScriptKind.TS;
  if (lower.endsWith('.jsx')) return ts.ScriptKind.JSX;
  return ts.ScriptKind.JS;
}

/**
 * Return the string literal representing the module specifier of an
 * import/export/require/dynamic-import node, or null if the node is not one.
 */
function extractModuleSpecifier(node: ts.Node): ts.StringLiteral | null {
  // import X from 'module' ; export * from 'module'
  if (
    (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
    node.moduleSpecifier &&
    ts.isStringLiteral(node.moduleSpecifier)
  ) {
    return node.moduleSpecifier;
  }
  // import type T = import('module').X
  if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)) {
    const lit = node.argument.literal;
    if (ts.isStringLiteral(lit)) return lit;
  }
  // require('module') — static; or dynamic import('module')
  if (ts.isCallExpression(node)) {
    const { expression, arguments: args } = node;
    if (args.length >= 1 && ts.isStringLiteral(args[0])) {
      // require()
      if (ts.isIdentifier(expression) && expression.text === 'require') {
        return args[0];
      }
      // import() — expression.kind === SyntaxKind.ImportKeyword
      if (expression.kind === ts.SyntaxKind.ImportKeyword) {
        return args[0];
      }
    }
  }
  return null;
}

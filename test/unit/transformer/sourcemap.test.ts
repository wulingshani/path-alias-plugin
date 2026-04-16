import {
  SourceMapGenerator,
  SourceMapConsumer,
  RawSourceMap
} from 'source-map';
import { adjustSourceMap } from '../../../src/transformer/sourcemap';
import { Edit } from '../../../src/transformer/rewriter';

/** Build a trivial source map where generated (line, col) === original (line, col). */
async function identityMap(
  source: string,
  sourceFile = 'in.ts'
): Promise<RawSourceMap> {
  const gen = new SourceMapGenerator({ file: 'out.js' });
  const lines = source.split('\n');
  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    for (let col = 0; col < lines[lineIdx].length; col++) {
      gen.addMapping({
        generated: { line: lineIdx + 1, column: col },
        original: { line: lineIdx + 1, column: col },
        source: sourceFile
      });
    }
  }
  gen.setSourceContent(sourceFile, source);
  return JSON.parse(gen.toString()) as RawSourceMap;
}

describe('transformer/sourcemap', () => {
  it('returns the input map unchanged when no edits', async () => {
    const map = await identityMap('const x = 1;');
    const out = await adjustSourceMap(map, []);
    expect(out).toEqual(map);
  });

  it('shifts mappings on the same line after an edit by the size delta', async () => {
    // Source: `require("@/a");` — the `@/a` literal (5 chars incl quotes, at col 8..13)
    // is replaced by `../a` (6 chars incl quotes). Delta +1.
    // Mapping at col 14 (the `;`) in the original generated text should still
    // map to original (line 1, col 13 in the new text → original col 13).
    // i.e. after rewrite, generated col 14 becomes generated col 15.
    const source = `require("@/a");`;
    const map = await identityMap(source);
    const edit: Edit = {
      start: 8,
      end: 13,
      originalText: '"@/a"',
      newText: '"../a"',
      line: 1,
      startColumn: 8
    };
    const adjusted = await adjustSourceMap(map, [edit]);
    await SourceMapConsumer.with(adjusted, null, (consumer) => {
      // In the new generated text, col 15 is ';' (since "../a" is 6 chars at col 8..14)
      const pos = consumer.originalPositionFor({ line: 1, column: 15 });
      expect(pos.line).toBe(1);
      expect(pos.column).toBe(14);
    });
  });

  it('does not touch mappings on lines that had no edits', async () => {
    const source = `const a = 1;\nrequire("@/x");`;
    const map = await identityMap(source);
    const edit: Edit = {
      start: 21,
      end: 26,
      originalText: '"@/x"',
      newText: '"../x"',
      line: 2,
      startColumn: 8
    };
    const adjusted = await adjustSourceMap(map, [edit]);
    await SourceMapConsumer.with(adjusted, null, (consumer) => {
      const pos = consumer.originalPositionFor({ line: 1, column: 5 });
      expect(pos.line).toBe(1);
      expect(pos.column).toBe(5);
    });
  });
});

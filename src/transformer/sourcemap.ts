import {
  SourceMapConsumer,
  SourceMapGenerator,
  RawSourceMap
} from 'source-map';
import { Edit } from './rewriter';

/**
 * Produce a new RawSourceMap reflecting in-place character edits.
 *
 * Precondition: edits only change content within existing lines — they do not
 * add or remove newlines. Under that assumption, the only correction needed is
 * to shift generated-column offsets on each affected line by the cumulative
 * size delta of all edits to the left of (or at) that column.
 */
export async function adjustSourceMap(
  original: RawSourceMap,
  edits: readonly Edit[]
): Promise<RawSourceMap> {
  if (edits.length === 0) return original;

  // Group edits by line, sort each group ascending by startColumn
  const editsByLine = new Map<number, Edit[]>();
  for (const e of edits) {
    const arr = editsByLine.get(e.line) ?? [];
    arr.push(e);
    editsByLine.set(e.line, arr);
  }
  for (const arr of editsByLine.values()) {
    arr.sort((a, b) => a.startColumn - b.startColumn);
  }

  const gen = new SourceMapGenerator({
    file: original.file,
    sourceRoot: original.sourceRoot
  });

  await SourceMapConsumer.with(original, null, (consumer) => {
    consumer.eachMapping((m) => {
      const lineEdits = editsByLine.get(m.generatedLine);
      const newGenCol = lineEdits
        ? shiftColumn(m.generatedColumn, lineEdits)
        : m.generatedColumn;

      if (
        m.source != null &&
        m.originalLine != null &&
        m.originalColumn != null
      ) {
        gen.addMapping({
          generated: { line: m.generatedLine, column: newGenCol },
          original: { line: m.originalLine, column: m.originalColumn },
          source: m.source,
          name: m.name ?? undefined
        });
      }
      // Mappings without an original position are dropped — source-map
      // forbids emitting them and they carry no useful information anyway.
    });

    for (const src of consumer.sources) {
      const content = consumer.sourceContentFor(src, /* nullOnMissing */ true);
      if (content != null) gen.setSourceContent(src, content);
    }
  });

  return JSON.parse(gen.toString()) as RawSourceMap;
}

/**
 * Shift an original-generated column position to its new position after edits
 * on the same line are applied. `lineEdits` must be sorted ascending by startColumn.
 */
function shiftColumn(col: number, lineEdits: readonly Edit[]): number {
  let shift = 0;
  for (const edit of lineEdits) {
    const origLen = edit.originalText.length;
    const editEnd = edit.startColumn + origLen;
    const delta = edit.newText.length - origLen;
    if (col >= editEnd) {
      shift += delta;
    } else if (col >= edit.startColumn) {
      // Mapping falls inside the replaced text — collapse to the edit's new start.
      return edit.startColumn + shift;
    } else {
      // Before this edit; subsequent edits are further right and also won't touch us.
      break;
    }
  }
  return col + shift;
}

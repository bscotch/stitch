/** Zero-based line and character (UTF-16 code unit) position, as used by LSP. */
export interface LinePosition {
  line: number;
  character: number;
}

/** Converts between source offsets and line/character positions. */
export class LineIndex {
  /** Offset of the start of each line */
  protected readonly lineStarts: number[] = [0];
  protected readonly text: string;

  constructor(text: string) {
    this.text = text;
    for (let i = 0; i < text.length; i++) {
      const c = text.charCodeAt(i);
      if (c === 13 /* \r */) {
        if (text.charCodeAt(i + 1) === 10) i++;
        this.lineStarts.push(i + 1);
      } else if (c === 10 /* \n */) {
        this.lineStarts.push(i + 1);
      }
    }
  }

  get lineCount(): number {
    return this.lineStarts.length;
  }

  positionAt(offset: number): LinePosition {
    offset = Math.max(0, Math.min(offset, this.text.length));
    let low = 0;
    let high = this.lineStarts.length - 1;
    while (low < high) {
      const mid = (low + high + 1) >> 1;
      if (this.lineStarts[mid] <= offset) low = mid;
      else high = mid - 1;
    }
    return { line: low, character: offset - this.lineStarts[low] };
  }

  offsetAt(position: LinePosition): number {
    if (position.line < 0) return 0;
    if (position.line >= this.lineStarts.length) return this.text.length;
    const lineStart = this.lineStarts[position.line];
    // Clamp to the end of the line's content (before its line break)
    let lineEnd = this.lineStarts[position.line + 1] ?? this.text.length;
    while (lineEnd > lineStart) {
      const c = this.text.charCodeAt(lineEnd - 1);
      if (c !== 10 && c !== 13) break;
      lineEnd--;
    }
    return Math.min(lineStart + Math.max(0, position.character), lineEnd);
  }
}

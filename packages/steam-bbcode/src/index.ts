import { Marked } from 'marked';

const marked = new Marked({
  renderer: {
    heading(src) {
      // Steam only supports h1-h3, the rest should just be bold.
      const text = this.parser.parseInline(src.tokens);
      if (src.depth <= 3) {
        return `[h${src.depth}]${text}[/h${src.depth}]\n\n`;
      } else {
        return `[b]${text}[/b]\n\n`;
      }
    },
    image(src) {
      return bbImage(src.href, src.text);
    },
    link(src) {
      return `[url=${src.href}]${this.parser.parseInline(src.tokens)}[/url]`;
    },
    em(src) {
      return `[i]${this.parser.parseInline(src.tokens)}[/i]`;
    },
    strong(src) {
      return `[b]${this.parser.parseInline(src.tokens)}[/b]`;
    },
    del(src) {
      return `[strike]${this.parser.parseInline(src.tokens)}[/strike]`;
    },
    codespan(src) {
      return `[code]${src.text}[/code]`;
    },
    code(src) {
      return `[code]\n${src.text}\n[/code]\n\n`;
    },
    paragraph(src) {
      // For lines that are just URLs,
      // if they are steam or youtube links, leave them as-is
      if (
        src.tokens.length === 1 &&
        src.tokens[0].type === 'link' &&
        src.tokens[0].raw.match(
          /^(https?:\/\/)(www\.)?(store\.steampowered\.com|steamcommunity\.com|youtube\.com|youtu\.be)/,
        )
      ) {
        return src.tokens[0].raw + '\n\n';
      }
      return this.parser.parseInline(src.tokens) + '\n\n';
    },
    listitem(src) {
      return ` [*] ${this.parser.parseInline(src.tokens).trim()}`;
    },
    list(src) {
      const el = src.ordered ? 'olist' : 'list';
      let indent = '  ';
      let rendered = `[${el}]\n`;
      for (const item of src.items) {
        rendered += `${indent}[*] ${this.parser.parseInline(item.tokens).trim()}\n`;
      }
      return `${rendered}[/${el}]\n\n`;
    },
    hr() {
      return '[hr][/hr]\n\n';
    },
    br() {
      return '\n\n';
    },
    blockquote(src) {
      return `[quote]${this.parser.parse(src.tokens).trim()}[/quote]\n\n`;
    },
    html(src) {
      if (src.raw.startsWith('<img')) {
        const alt = src.raw.match(/alt="([^"]+)"/)?.[1] || '';
        const source = src.raw.match(/src="([^"]+)"/)?.[1] || '';
        return bbImage(source, alt);
      } else if (src.raw.startsWith('<!-')) {
        // Remove HTML comments
        return '';
      }
      // Otherwise return as-is for manual editing
      return src.text;
    },
  },
});

/**
 * Convert Markdown (or HTML) to Steam-compatible BBCode. Also returns the HTML content.
 */
export function md2bbcode(source: string): {
  source: string;
  bbcode: string;
  // html: string;
} {
  const bbcode = (marked.parse(source) as string).replaceAll('&#39;', "'");
  return {
    source,
    bbcode,
  };
}

function bbImage(src: string, alt?: string | null): string {
  let bb = '[img';
  if (alt) {
    bb += ` alt="${alt.replaceAll('"', '&quot;')}"`;
  }
  bb += `]${src}[/img]`;
  return bb;
}

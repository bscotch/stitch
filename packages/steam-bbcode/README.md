# Steam BBCode Generator

[Steam](https://store.steampowered.com/) has been around for a while, and many part of its content management system still [use legacy BBCode formats](https://steamcommunity.com/comment/ForumTopic/formattinghelp). This tool helps generate Steam-compatible BBCode from Markdown.

Note: currently only supports _pure_ Markdown (embedded HTML is left as-is).

## Features

- Supports most of [Steam's BBCode format](https://steamcommunity.com/comment/ForumTopic/formattinghelp)
- Leaves YouTube and Steam links as-is, allowing Steam to convert them into widgets.

## Missing Features

- Only the BBCode markup [documented by Steam](https://steamcommunity.com/comment/ForumTopic/formattinghelp) is supported
- Only supports pure Markdown input, with the exception of `<img>` tags. HTML is left as-is.
- Does not support tags that have no equivalent in Markdown
  - ❌ `[spoiler]`
  - ❌ `[noparse]`
  - ❌ `[u]`
- Does not support tag options that don't have standard support in Markdown
  - ❌ `[quote=author]` (`[quote]` is supported, but there isn't a way to provide an author)

## Usage

```ts
import { md2bbcode } from '@bscotch/steam-bbcode';

const converted = md2bbcode('# Hello, world!');
const bbcode = converted.bbcode;
```

## Example

The following Markdown input:

```md
# H1 Heading

## H2 Heading

### H3 Heading

Steam only supports h1-h3, the rest should just be bold.

#### H4 Heading

##### H5 Heading

###### H6 Heading

Some **Bold text**

Some _Italic text_

A [Link](https://example.com 'With a title')

Some ~~Strikethrough text~~

- Unordered list item 1
- Unordered list item 2

1. **Ordered** list item 1
1. Ordered list item 2

> Blockquote

Some `Inline Code!`!

\`\`\`
Block Code!
\`\`\`

![Image](https://example.com/image.jpg)

[![Image](https://example.com/image.jpg)](https://example.com)

---

Plain steam (store.steampowered.com, steamcommunity.com) and youtube links on their own lines should be left as-is since they'll create widgets

https://store.steampowered.com/app/1401730/Crashlands_2/

https://www.youtube.com/watch?v=yR_Opccn1n4

<!-- Image HTML should get converted even though HTML isn't fully supported by this tool -->
<img src="https://example.com/image.jpg" alt="Image" />
```

Yields the following BBCode output:

```bbcode
[h1]H1 Heading[/h1]

[h2]H2 Heading[/h2]

[h3]H3 Heading[/h3]

Steam only supports h1-h3, the rest should just be bold.

[b]H4 Heading[/b]

[b]H5 Heading[/b]

[b]H6 Heading[/b]

Some [b]Bold text[/b]

Some [i]Italic text[/i]

A [url=https://example.com]Link[/url]

Some [strike]Strikethrough text[/strike]

[list]
  [*] Unordered list item 1
  [*] Unordered list item 2
[/list]

[olist]
  [*] [b]Ordered[/b] list item 1
  [*] Ordered list item 2
[/olist]

[quote]Blockquote[/quote]

Some [code]Inline Code![/code]!

[code]
Block Code!
[/code]

[img alt="Image"]https://example.com/image.jpg[/img]

[url=https://example.com][img alt="Image"]https://example.com/image.jpg[/img][/url]

[hr][/hr]

Plain steam (store.steampowered.com, steamcommunity.com) and youtube links on their own lines should be left as-is since they'll create widgets

https://store.steampowered.com/app/1401730/Crashlands_2/

https://www.youtube.com/watch?v=yR_Opccn1n4

[img alt="Image"]https://example.com/image.jpg[/img]
```

import { md2bbcode } from './index.js';

/** Sample Markdown containing all kinds of Steam-compatible components */
const sample = `
# H1 Heading
## H2 Heading
### H3 Heading

Steam only supports h1-h3, the rest should just be bold.

#### H4 Heading
##### H5 Heading
###### H6 Heading

Some **Bold text**

Some *Italic text*

A [Link](https://example.com "With a title")

Some ~~Strikethrough text~~

- Unordered list item 1
- Unordered list item 2

1. **Ordered** list item 1
1. Ordered list item 2

> Blockquote

Some \`Inline Code!\`!

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
`;

const expectedBbcode = `
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
[code]

[hr][/hr]

Plain steam (store.steampowered.com, steamcommunity.com) and youtube links on their own lines should be left as-is since they'll create widgets

https://store.steampowered.com/app/1401730/Crashlands_2/

https://www.youtube.com/watch?v=yR_Opccn1n4

[img]https://example.com/image.jpg[/img]
`;

describe('BBCode generator', () => {
  it('should convert Markdown to BBCode', () => {
    const converted = md2bbcode(sample).bbcode;
    console.log(converted);
    // expect(expectedBbcode).to.equal(converted);
  });
});

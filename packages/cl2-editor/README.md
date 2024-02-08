# Crashlands 2 Editor

This extension provides a set of tools for creating and editing content for the game [Crashlands 2](https://www.bscotch.net/games/crashlands-2), by Butterscotch Shenanigans.

**⚠️ This extension will not be of any use to anyone outside of the Bscotch team. It is public for convenience and for public interest, but its feature set is built on top of a bunch of internal tools and processes that are *not* public. If you're interested in learning more about the development of Crashlands 2, check out the studio [podcast](https://www.bscotch.net/podcast). ⚠️**

## Features

### Story Editor

Crashlands 2 quests are organized by "Storyline". This extension reads the GameChanger data from Crashlands 2 and provides a tree view of the Storylines and their Quests.

The GameChanger data is highly structured JSON, described by JSON Schema-like structures. This extension creates a text-based view of Quest "motes" from the GameChanger, converting back and forth between the JSON and the text representation, to provide a good editing experience for narrative-focused content.

### Spell Check

We use a LOT of made-up words, and we want to avoid duplication of effort in maintaining a glossary for both spell check and localization. To that end we have the Bscotch String Server, where we manage our strings and glossary.

To enable spell check, log into the Bscotch String Server via the command: "Crashlands: Activate Spell Check" and log in via the prompts.

### Syntax Highlighting

For syntax highlighting, you'll need to add some settings to your User Settings JSON file. For example:

```json
  "editor.tokenColorCustomizations": {
    "textMateRules": [
      // Quest Editor
      {
        "name": "Invalid Line",
        "scope": "invalid.cl2-quest",
        "settings": {
          "foreground": "#ff0000"
        }
      },
      {
        "name": "Indicator Default",
        "scope": "indicator.cl2-quest",
        "settings": {
          "foreground": "#da8e0a"
        }
      },
      {
        "name": "Count Default",
        "scope": "count.cl2-quest",
        "settings": {
          "foreground": "#30da0a"
        }
      },
      {
        "name": "Mote Name Default",
        "scope": "name.mote.cl2-quest",
        "settings": {
          "foreground": "#0aa9da",
          "fontStyle": "bold"
        }
      },
      {
        "name": "Mote ID Default",
        "scope": "id.mote.cl2-quest",
        "settings": {
          "foreground": "#585858"
        }
      },
      {
        "name": "Style Name Default",
        "scope": "style.cl2-quest",
        "settings": {
          "foreground": "#c248b0"
        }
      },
      {
        "name": "Field Name",
        "scope": "key.cl2-quest",
        "settings": {
          "foreground": "#0d9e00",
          "fontStyle": "bold"
        }
      },
      {
        "name": "Field Value",
        "scope": "value.cl2-quest",
        "settings": {
          "foreground": "#e0e0e0"
        }
      },
      {
        "name": "Indexed Field Name",
        "scope": "key.indexed.cl2-quest",
        "settings": {
          "foreground": "#b248c2"
        }
      },
      {
        "name": "Indexed Field Value",
        "scope": "value.indexed.cl2-quest",
        "settings": {
          "foreground": "#aadbd7"
        }
      },
      {
        "name": "Speaker Name",
        "scope": "moment.dialog.speaker.cl2-quest name.mote.cl2-quest",
        "settings": {
          "foreground": "#8339c0",
          "fontStyle": "bold underline"
        }
      },
      {
        "name": "Array Index",
        "scope": "id.array.cl2-quest",
        "settings": {
          "foreground": "#585858"
        }
      },
      {
        "name": "Emoji",
        "scope": "name.emoji.cl2-quest",
        "settings": {
          "foreground": "#8c519a",
          "fontStyle": "italic"
        }
      }
    ],
  },
```
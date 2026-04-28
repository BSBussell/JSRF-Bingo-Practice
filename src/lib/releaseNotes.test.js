import assert from "node:assert/strict";
import test from "node:test";

import { parseReleaseNotesMarkdown } from "./releaseNotes.js";

test("parseReleaseNotesMarkdown parses headings and paragraphs", () => {
  const blocks = parseReleaseNotesMarkdown(`### Route Mode + Stats + Bingopedia

Lots of features that should have had more updates.
Introducing route mode.

Also a super rushed speed builder for shovels!`);

  assert.deepEqual(blocks, [
    {
      type: "heading",
      level: 3,
      text: "Route Mode + Stats + Bingopedia"
    },
    {
      type: "paragraph",
      text: "Lots of features that should have had more updates. Introducing route mode."
    },
    {
      type: "paragraph",
      text: "Also a super rushed speed builder for shovels!"
    }
  ]);
});

test("parseReleaseNotesMarkdown returns no blocks for blank input", () => {
  assert.deepEqual(parseReleaseNotesMarkdown(" \n\n "), []);
});

test("parseReleaseNotesMarkdown preserves unordered list items", () => {
  const blocks = parseReleaseNotesMarkdown(`### Route Mode + Stats + Bingopedia

Lots of features that should have had more updates between now and the initial release!

- Introducing route mode where you can show up to 9 objectives at once and practice routing between them!
- Added Fireworks when you finish a thing!

Also a super rushed speed builder for shovels!`);

  assert.deepEqual(blocks, [
    {
      type: "heading",
      level: 3,
      text: "Route Mode + Stats + Bingopedia"
    },
    {
      type: "paragraph",
      text: "Lots of features that should have had more updates between now and the initial release!"
    },
    {
      type: "list",
      items: [
        "Introducing route mode where you can show up to 9 objectives at once and practice routing between them!",
        "Added Fireworks when you finish a thing!"
      ]
    },
    {
      type: "paragraph",
      text: "Also a super rushed speed builder for shovels!"
    }
  ]);
});

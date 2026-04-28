function normalizeLineBreaks(markdown) {
  return typeof markdown === "string" ? markdown.replace(/\r\n?/g, "\n") : "";
}

export function parseReleaseNotesMarkdown(markdown) {
  const normalized = normalizeLineBreaks(markdown).trim();
  if (!normalized) {
    return [];
  }

  const lines = normalized.split("\n");
  const blocks = [];
  let paragraphLines = [];
  let listItems = [];

  function flushParagraph() {
    if (!paragraphLines.length) {
      return;
    }

    blocks.push({
      type: "paragraph",
      text: paragraphLines.join(" ").trim()
    });
    paragraphLines = [];
  }

  function flushList() {
    if (!listItems.length) {
      return;
    }

    blocks.push({
      type: "list",
      items: listItems
    });
    listItems = [];
  }

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed) {
      flushParagraph();
      flushList();
      continue;
    }

    const headingMatch = /^(#{1,6})\s+(.+)$/.exec(trimmed);
    if (headingMatch) {
      flushParagraph();
      flushList();
      blocks.push({
        type: "heading",
        level: headingMatch[1].length,
        text: headingMatch[2].trim()
      });
      continue;
    }

    const listMatch = /^[-*]\s+(.+)$/.exec(trimmed);
    if (listMatch) {
      flushParagraph();
      listItems.push(listMatch[1].trim());
      continue;
    }

    flushList();
    paragraphLines.push(trimmed);
  }

  flushParagraph();
  flushList();
  return blocks;
}

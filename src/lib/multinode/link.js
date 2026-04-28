const PEER_PARAM_KEYS = ["id", "peer", "peerId", "multinode", "connect"];

function getPeerIdFromSearchParams(searchParams) {
  for (const key of PEER_PARAM_KEYS) {
    const value = searchParams.get(key);
    if (typeof value === "string") {
      const trimmedValue = value.trim();
      if (trimmedValue.length > 0) {
        return trimmedValue;
      }
    }
  }

  return null;
}

function tryParseUrl(input) {
  try {
    return new URL(input);
  } catch {
    try {
      return new URL(input, "https://multinode.local");
    } catch {
      return null;
    }
  }
}

function isProbablyUrlInput(input) {
  return (
    input.startsWith("?") ||
    input.includes("://") ||
    input.startsWith("www.") ||
    input.includes("?")
  );
}

export function parseMultinodePeerId(input) {
  if (typeof input !== "string") {
    return null;
  }

  const trimmedInput = input.trim();
  if (trimmedInput.length === 0) {
    return null;
  }

  if (trimmedInput.startsWith("?")) {
    const peerId = getPeerIdFromSearchParams(new URLSearchParams(trimmedInput));
    return peerId ?? null;
  }

  if (!trimmedInput.includes("://") && !trimmedInput.includes("?") && trimmedInput.includes("=")) {
    const peerId = getPeerIdFromSearchParams(new URLSearchParams(trimmedInput));
    return peerId ?? trimmedInput;
  }

  if (isProbablyUrlInput(trimmedInput)) {
    const parsedUrl = tryParseUrl(trimmedInput);
    if (parsedUrl) {
      const peerId = getPeerIdFromSearchParams(parsedUrl.searchParams);
      return peerId ?? trimmedInput;
    }
  }

  return trimmedInput;
}

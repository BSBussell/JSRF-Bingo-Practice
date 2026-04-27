import { useCallback, useMemo, useState } from "react";
import ReactDOM from "react-dom/client";

import { useMultinodeConnection } from "./hooks/useMultinodeConnection.js";

function toPrettyJson(value) {
  if (typeof value === "string") {
    return value;
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function MultinodeTestApp() {
  const [inputValue, setInputValue] = useState("");
  const [activeLink, setActiveLink] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [logs, setLogs] = useState([]);

  const appendLog = useCallback((kind, payload) => {
    setLogs((previousLogs) => {
      const nextLogs = [
        {
          id: `${Date.now()}-${Math.random()}`,
          timestamp: new Date().toISOString(),
          kind,
          payload
        },
        ...previousLogs
      ];

      return nextLogs.slice(0, 400);
    });
  }, []);

  const { status, error, lastRawPacket, lastGameEvent } = useMultinodeConnection({
    link: activeLink,
    enabled,
    onRawPacket(packet) {
      appendLog("raw", packet);
    },
    onGameEvent(event) {
      appendLog("event", event);
    }
  });

  const statusText = useMemo(() => {
    if (status !== "error") {
      return status;
    }

    return error ? `${status}: ${error}` : status;
  }, [status, error]);

  return (
    <main style={{ fontFamily: "monospace", padding: "1rem", maxWidth: "1200px", margin: "0 auto" }}>
      <h1 style={{ marginTop: 0 }}>MultiNode Packet Test</h1>
      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "1rem" }}>
        <input
          type="text"
          value={inputValue}
          onChange={(event) => setInputValue(event.target.value)}
          placeholder="Peer ID or URL"
          style={{ flex: "1 1 400px", padding: "0.5rem" }}
        />
        <button
          type="button"
          onClick={() => {
            setActiveLink(inputValue);
            setEnabled(true);
          }}
          disabled={enabled}
        >
          Connect
        </button>
        <button
          type="button"
          onClick={() => setEnabled(false)}
          disabled={!enabled}
        >
          Disconnect
        </button>
        <button
          type="button"
          onClick={() => setLogs([])}
        >
          Clear Log
        </button>
      </div>

      <p>
        <strong>Status:</strong> {statusText}
      </p>

      <section style={{ marginBottom: "1rem" }}>
        <h2>Last Raw Packet</h2>
        <pre style={{ margin: 0, padding: "0.5rem", border: "1px solid #999", overflow: "auto" }}>
          {lastRawPacket ? toPrettyJson(lastRawPacket) : "(none)"}
        </pre>
      </section>

      <section style={{ marginBottom: "1rem" }}>
        <h2>Last Normalized Event</h2>
        <pre style={{ margin: 0, padding: "0.5rem", border: "1px solid #999", overflow: "auto" }}>
          {lastGameEvent ? toPrettyJson(lastGameEvent) : "(none)"}
        </pre>
      </section>

      <section>
        <h2>Event Log</h2>
        <div
          style={{
            border: "1px solid #999",
            padding: "0.5rem",
            minHeight: "260px",
            maxHeight: "420px",
            overflow: "auto",
            whiteSpace: "pre-wrap"
          }}
        >
          {logs.length === 0 ? (
            "(no events yet)"
          ) : (
            logs.map((entry) => (
              <pre key={entry.id} style={{ marginTop: 0 }}>
                [{entry.timestamp}] {entry.kind}\n{toPrettyJson(entry.payload)}
              </pre>
            ))
          )}
        </div>
      </section>
    </main>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<MultinodeTestApp />);

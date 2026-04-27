import { useCallback, useMemo, useState } from "react";
import ReactDOM from "react-dom/client";

import { useMultinodeConnection } from "./hooks/useMultinodeConnection.js";
import { CHARACTER_NAME_BY_ID, TAPE_NAME_BY_ID } from "./lib/multinode/levelIds.js";
import {
  applyMultinodeEvent,
  createMultinodeWorldState
} from "./lib/multinode/worldState.js";

const MAX_LOG_ENTRIES = 300;

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

function appendLog(setter, payload) {
  setter((previousLogs) => {
    const nextLogs = [
      {
        id: `${Date.now()}-${Math.random()}`,
        timestamp: new Date().toISOString(),
        payload
      },
      ...previousLogs
    ];

    return nextLogs.slice(0, MAX_LOG_ENTRIES);
  });
}

function formatTapeIds(tapeIds) {
  return tapeIds.map((tapeId) => `${tapeId}: ${TAPE_NAME_BY_ID[tapeId] ?? `Tape ${tapeId}`}`);
}

function formatCharacterIds(characterIds) {
  return characterIds.map(
    (characterId) => `${characterId}: ${CHARACTER_NAME_BY_ID[characterId] ?? `Character ${characterId}`}`
  );
}

function getLevelProgressRows(worldState) {
  return Object.values(worldState.graffiti.byLevelId).sort((left, right) =>
    left.levelName.localeCompare(right.levelName)
  );
}

function MultinodeTestApp() {
  const [inputValue, setInputValue] = useState("");
  const [activeLink, setActiveLink] = useState("");
  const [enabled, setEnabled] = useState(false);

  const [rawLogs, setRawLogs] = useState([]);
  const [parsedLogs, setParsedLogs] = useState([]);
  const [derivedLogs, setDerivedLogs] = useState([]);
  const [worldState, setWorldState] = useState(() => createMultinodeWorldState());

  const handleManualWorldStateReset = useCallback(() => {
    setWorldState(createMultinodeWorldState());
  }, []);

  const clearLogsOnly = useCallback(() => {
    setRawLogs([]);
    setParsedLogs([]);
    setDerivedLogs([]);
  }, []);

  const { status, error, lastRawPacket, lastGameEvent } = useMultinodeConnection({
    link: activeLink,
    enabled,
    onRawPacket(packet) {
      appendLog(setRawLogs, packet);
    },
    onGameEvent(event) {
      appendLog(setParsedLogs, event);
      setWorldState((previousState) => {
        const reduced = applyMultinodeEvent(previousState, event);
        for (const derivedEvent of reduced.events) {
          appendLog(setDerivedLogs, derivedEvent);
        }
        return reduced.state;
      });
    }
  });

  const statusText = useMemo(() => {
    if (status !== "error") {
      return status;
    }

    return error ? `${status}: ${error}` : status;
  }, [status, error]);

  const levelProgressRows = useMemo(() => getLevelProgressRows(worldState), [worldState]);

  return (
    <main style={{ fontFamily: "monospace", padding: "1rem", maxWidth: "1400px", margin: "0 auto" }}>
      <h1 style={{ marginTop: 0 }}>MultiNode Packet + World State Test</h1>

      <section style={{ border: "1px solid #999", padding: "0.75rem", marginBottom: "1rem" }}>
        <h2 style={{ marginTop: 0 }}>Connection</h2>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.5rem" }}>
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
        </div>
        <p style={{ margin: "0.25rem 0" }}>
          <strong>Status:</strong> {statusText}
        </p>
        <p style={{ margin: "0.25rem 0" }}>
          <strong>Active Link Input:</strong> {activeLink || "(none)"}
        </p>
      </section>

      <section style={{ border: "1px solid #999", padding: "0.75rem", marginBottom: "1rem" }}>
        <h2 style={{ marginTop: 0 }}>Reset Controls</h2>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <button type="button" onClick={clearLogsOnly}>Clear Logs Only</button>
          <button type="button" onClick={handleManualWorldStateReset}>Reset Perceived World State</button>
        </div>
      </section>

      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "1rem", marginBottom: "1rem" }}>
        <div style={{ border: "1px solid #999", padding: "0.75rem" }}>
          <h2 style={{ marginTop: 0 }}>Last Raw Packet</h2>
          <pre style={{ margin: 0, maxHeight: "220px", overflow: "auto" }}>
            {lastRawPacket ? toPrettyJson(lastRawPacket) : "(none)"}
          </pre>
        </div>

        <div style={{ border: "1px solid #999", padding: "0.75rem" }}>
          <h2 style={{ marginTop: 0 }}>Last Parsed Event</h2>
          <pre style={{ margin: 0, maxHeight: "220px", overflow: "auto" }}>
            {lastGameEvent ? toPrettyJson(lastGameEvent) : "(none)"}
          </pre>
        </div>
      </section>

      <section style={{ border: "1px solid #999", padding: "0.75rem", marginBottom: "1rem" }}>
        <h2 style={{ marginTop: 0 }}>Perceived World State</h2>
        <p style={{ margin: "0.25rem 0" }}>
          <strong>Player Count:</strong> {worldState.playerCount}
        </p>
        <p style={{ margin: "0.25rem 0" }}>
          <strong>Collected Tapes:</strong> {formatTapeIds(worldState.collectedTapeIds).join(", ") || "(none)"}
        </p>
        <p style={{ margin: "0.25rem 0" }}>
          <strong>Collected Souls:</strong> {worldState.collectedSoulIds.length} ({worldState.collectedSoulIds.join(", ") || "none"})
        </p>
        <p style={{ margin: "0.25rem 0" }}>
          <strong>Unlocked Souls:</strong> {worldState.unlockedSoulIds.length} ({worldState.unlockedSoulIds.join(", ") || "none"})
        </p>
        <p style={{ margin: "0.25rem 0" }}>
          <strong>Unlocked Characters:</strong> {formatCharacterIds(worldState.unlockedCharacterIds).join(", ") || "(none)"}
        </p>

        <h3>Players</h3>
        {worldState.players.length === 0 ? (
          <p>(no player data yet)</p>
        ) : (
          <ul>
            {worldState.players.map((player) => (
              <li key={player.index}>
                #{player.index} | name: {player.name ?? "(unknown)"} | level: {player.levelName ?? "(unknown)"}
              </li>
            ))}
          </ul>
        )}

        <h3>Graffiti Progress By Level</h3>
        {levelProgressRows.length === 0 ? (
          <p>(no level graffiti definitions loaded)</p>
        ) : (
          <div style={{ display: "grid", gap: "0.5rem" }}>
            {levelProgressRows.map((levelRow) => {
              const percent =
                levelRow.totalCount > 0
                  ? Math.round((levelRow.completedCount / levelRow.totalCount) * 100)
                  : 0;

              return (
                <details key={levelRow.levelId}>
                  <summary>
                    {levelRow.levelName} ({levelRow.completedCount}/{levelRow.totalCount}, {percent}%) - {levelRow.isComplete ? "Complete" : "Incomplete"}
                  </summary>
                  <ul>
                    {Object.values(levelRow.byGraffitiId)
                      .sort((left, right) => left.graffitiId - right.graffitiId)
                      .map((graffiti) => (
                        <li key={graffiti.graffitiId}>
                          #{graffiti.graffitiId} [{graffiti.size}] {graffiti.location} - {graffiti.completedCount}/{graffiti.totalCount} {graffiti.isComplete ? "(complete)" : ""}
                        </li>
                      ))}
                  </ul>
                </details>
              );
            })}
          </div>
        )}
      </section>

      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "1rem" }}>
        <div style={{ border: "1px solid #999", padding: "0.75rem", minHeight: "260px", maxHeight: "420px", overflow: "auto" }}>
          <h2 style={{ marginTop: 0 }}>Raw Packet Log ({rawLogs.length})</h2>
          {rawLogs.length === 0
            ? "(no entries)"
            : rawLogs.map((entry) => (
                <pre key={entry.id} style={{ marginTop: 0 }}>
                  [{entry.timestamp}]\n{toPrettyJson(entry.payload)}
                </pre>
              ))}
        </div>

        <div style={{ border: "1px solid #999", padding: "0.75rem", minHeight: "260px", maxHeight: "420px", overflow: "auto" }}>
          <h2 style={{ marginTop: 0 }}>Parsed Event Log ({parsedLogs.length})</h2>
          {parsedLogs.length === 0
            ? "(no entries)"
            : parsedLogs.map((entry) => (
                <pre key={entry.id} style={{ marginTop: 0 }}>
                  [{entry.timestamp}]\n{toPrettyJson(entry.payload)}
                </pre>
              ))}
        </div>

        <div style={{ border: "1px solid #999", padding: "0.75rem", minHeight: "260px", maxHeight: "420px", overflow: "auto" }}>
          <h2 style={{ marginTop: 0 }}>Derived Event Log ({derivedLogs.length})</h2>
          {derivedLogs.length === 0
            ? "(no entries)"
            : derivedLogs.map((entry) => (
                <pre key={entry.id} style={{ marginTop: 0 }}>
                  [{entry.timestamp}]\n{toPrettyJson(entry.payload)}
                </pre>
              ))}
        </div>
      </section>
    </main>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<MultinodeTestApp />);

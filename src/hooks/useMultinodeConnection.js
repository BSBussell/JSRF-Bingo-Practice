import { useEffect, useRef, useState } from "react";
import Peer from "peerjs";

import { parseMultinodePeerId } from "../lib/multinode/link.js";
import { parseMultinodePacket } from "../lib/multinode/protocol.js";

const STATUS_IDLE = "idle";
const STATUS_CONNECTING = "connecting";
const STATUS_CONNECTED = "connected";
const STATUS_CLOSED = "closed";
const STATUS_ERROR = "error";

function toErrorMessage(errorLike) {
  if (errorLike instanceof Error) {
    return errorLike.message;
  }

  if (typeof errorLike === "string") {
    return errorLike;
  }

  return "Unknown multinode connection error";
}

export function useMultinodeConnection({
  link,
  enabled,
  onGameEvent,
  onRawPacket
}) {
  const [status, setStatus] = useState(STATUS_IDLE);
  const [error, setError] = useState(null);
  const [lastRawPacket, setLastRawPacket] = useState(null);
  const [lastGameEvent, setLastGameEvent] = useState(null);

  const onRawPacketRef = useRef(onRawPacket);
  const onGameEventRef = useRef(onGameEvent);
  const peerRef = useRef(null);
  const connectionRef = useRef(null);

  useEffect(() => {
    onRawPacketRef.current = onRawPacket;
  }, [onRawPacket]);

  useEffect(() => {
    onGameEventRef.current = onGameEvent;
  }, [onGameEvent]);

  useEffect(() => {
    let disposed = false;

    function closeConnection(nextStatus = STATUS_CLOSED) {
      if (connectionRef.current) {
        connectionRef.current.close();
        connectionRef.current = null;
      }

      if (peerRef.current) {
        peerRef.current.destroy();
        peerRef.current = null;
      }

      if (!disposed) {
        setStatus(nextStatus);
      }
    }

    if (!enabled) {
      closeConnection(STATUS_IDLE);
      setError(null);
      return () => {
        disposed = true;
        closeConnection(STATUS_IDLE);
      };
    }

    const peerId = parseMultinodePeerId(link);
    if (!peerId) {
      setStatus(STATUS_ERROR);
      setError("Invalid MultiNode link or peer ID");
      return () => {
        disposed = true;
        closeConnection();
      };
    }

    setStatus(STATUS_CONNECTING);
    setError(null);

    const peer = new Peer();
    peerRef.current = peer;

    function reportError(errorLike) {
      if (disposed) {
        return;
      }

      setStatus(STATUS_ERROR);
      setError(toErrorMessage(errorLike));
    }

    peer.on("open", () => {
      if (disposed) {
        return;
      }

      const connection = peer.connect(peerId, { reliable: true });
      connectionRef.current = connection;

      connection.on("open", () => {
        if (!disposed) {
          setStatus(STATUS_CONNECTED);
        }
      });

      connection.on("data", (packet) => {
        if (disposed) {
          return;
        }

        setLastRawPacket(packet);
        onRawPacketRef.current?.(packet);

        const normalizedEvent = parseMultinodePacket(packet);
        if (!normalizedEvent) {
          return;
        }

        setLastGameEvent(normalizedEvent);
        onGameEventRef.current?.(normalizedEvent);
      });

      connection.on("close", () => {
        if (!disposed) {
          setStatus(STATUS_CLOSED);
        }
      });

      connection.on("error", reportError);
    });

    peer.on("error", reportError);

    return () => {
      disposed = true;
      closeConnection();
    };
  }, [enabled, link]);

  return {
    status,
    error,
    lastRawPacket,
    lastGameEvent
  };
}

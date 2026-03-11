"use client";

import { useEffect, useRef, useCallback } from "react";
import type { EventType } from "./types";

type EventHandler = (data: unknown) => void;

interface UseEventStreamOptions {
  url?: string;
  onMessage?: EventHandler;
  onScene?: EventHandler;
  onSession?: EventHandler;
  onPlayerJoined?: EventHandler;
  onPlayerKicked?: EventHandler;
  onKeeperResponse?: EventHandler;
  onKeeperTyping?: EventHandler;
  onCharacterUpdate?: EventHandler;
  onWidgetUpdate?: EventHandler;
  onWidgetRemove?: EventHandler;
  enabled?: boolean;
}

export function useEventStream({
  url = "/api/events",
  onMessage,
  onScene,
  onSession,
  onPlayerJoined,
  onPlayerKicked,
  onKeeperResponse,
  onKeeperTyping,
  onCharacterUpdate,
  onWidgetUpdate,
  onWidgetRemove,
  enabled = true,
}: UseEventStreamOptions = {}) {
  const sourceRef = useRef<EventSource | null>(null);
  const handlersRef = useRef({
    onMessage,
    onScene,
    onSession,
    onPlayerJoined,
    onPlayerKicked,
    onKeeperResponse,
    onKeeperTyping,
    onCharacterUpdate,
    onWidgetUpdate,
    onWidgetRemove,
  });

  // Update handlers without reconnecting
  handlersRef.current = {
    onMessage,
    onScene,
    onSession,
    onPlayerJoined,
    onPlayerKicked,
    onKeeperResponse,
    onKeeperTyping,
    onCharacterUpdate,
    onWidgetUpdate,
    onWidgetRemove,
  };

  useEffect(() => {
    if (!enabled) return;

    const source = new EventSource(url);
    sourceRef.current = source;

    const handle = (type: EventType) => (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        const handlers = handlersRef.current;

        switch (type) {
          case "message":
            handlers.onMessage?.(data);
            break;
          case "scene":
            handlers.onScene?.(data);
            break;
          case "session":
            handlers.onSession?.(data);
            break;
          case "player_joined":
            handlers.onPlayerJoined?.(data);
            break;
          case "keeper_response":
            handlers.onKeeperResponse?.(data);
            break;
          case "keeper_typing":
            handlers.onKeeperTyping?.(data);
            break;
          case "character_update":
            handlers.onCharacterUpdate?.(data);
            break;
          case "player_kicked":
            handlers.onPlayerKicked?.(data);
            break;
          case "widget_update":
            handlers.onWidgetUpdate?.(data);
            break;
          case "widget_remove":
            handlers.onWidgetRemove?.(data);
            break;
        }
      } catch {
        // Ignore malformed events
      }
    };

    source.addEventListener("message", handle("message"));
    source.addEventListener("scene", handle("scene"));
    source.addEventListener("session", handle("session"));
    source.addEventListener("player_joined", handle("player_joined"));
    source.addEventListener("player_kicked", handle("player_kicked"));
    source.addEventListener("keeper_response", handle("keeper_response"));
    source.addEventListener("keeper_typing", handle("keeper_typing"));
    source.addEventListener("character_update", handle("character_update"));
    source.addEventListener("widget_update", handle("widget_update"));
    source.addEventListener("widget_remove", handle("widget_remove"));

    return () => {
      source.close();
      sourceRef.current = null;
    };
  }, [url, enabled]);

  const close = useCallback(() => {
    sourceRef.current?.close();
    sourceRef.current = null;
  }, []);

  return { close };
}

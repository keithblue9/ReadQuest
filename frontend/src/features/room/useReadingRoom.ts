"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { getAccessToken, refreshSession } from "@/lib/api";
import type { RoomMember } from "@/lib/types";

export type Cheer = { id: number; emoji: string; from: string; to: string | null };

type Status = { reading: boolean; book_title?: string | null; elapsed_seconds?: number };

const PING_MS = 25_000;
const MAX_BACKOFF_MS = 15_000;

/**
 * Koneksi Reading Room (WebSocket lewat origin yang sama, di-proxy Next.js ke FastAPI).
 * Otomatis menyambung ulang; token kedaluwarsa (close 4401) → refresh lalu sambung lagi.
 */
export function useReadingRoom(room: string, status?: Status) {
  const [members, setMembers] = useState<RoomMember[]>([]);
  const [cheers, setCheers] = useState<Cheer[]>([]);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const statusRef = useRef(status);
  const cheerId = useRef(0);

  useEffect(() => {
    statusRef.current = status;
    const ws = wsRef.current;
    if (status && ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "status", ...status }));
    }
  }, [status]);

  useEffect(() => {
    let closed = false;
    let attempt = 0;
    let ping: ReturnType<typeof setInterval> | undefined;
    let retry: ReturnType<typeof setTimeout> | undefined;

    async function connect() {
      let token = getAccessToken();
      if (!token) token = (await refreshSession())?.access_token ?? null;
      if (!token || closed) return;
      const scheme = window.location.protocol === "https:" ? "wss" : "ws";
      const ws = new WebSocket(
        `${scheme}://${window.location.host}/ws/rooms/${room}?token=${encodeURIComponent(token)}`,
      );
      wsRef.current = ws;

      ws.onopen = () => {
        attempt = 0;
        setConnected(true);
        if (statusRef.current) ws.send(JSON.stringify({ type: "status", ...statusRef.current }));
        ping = setInterval(() => ws.send(JSON.stringify({ type: "ping" })), PING_MS);
      };
      ws.onmessage = (event) => {
        const message = JSON.parse(event.data);
        if (message.type === "presence") setMembers(message.members);
        if (message.type === "cheer") {
          const cheer = {
            id: ++cheerId.current,
            emoji: message.emoji,
            from: message.from.name,
            to: message.to,
          };
          setCheers((current) => [...current.slice(-5), cheer]);
          setTimeout(() => setCheers((current) => current.filter((c) => c.id !== cheer.id)), 3500);
        }
      };
      ws.onclose = async (event) => {
        setConnected(false);
        clearInterval(ping);
        if (closed) return;
        if (event.code === 4401) await refreshSession();
        const delay = Math.min(MAX_BACKOFF_MS, 1000 * 2 ** attempt++);
        retry = setTimeout(connect, delay);
      };
    }

    connect();
    return () => {
      closed = true;
      clearInterval(ping);
      clearTimeout(retry);
      wsRef.current?.close();
    };
  }, [room]);

  const cheer = useCallback((emoji: string, to?: string) => {
    wsRef.current?.send(JSON.stringify({ type: "cheer", emoji, to }));
  }, []);

  return { members, cheers, connected, cheer };
}

export const CHEER_EMOJIS = ["👏", "🔥", "📚", "💪", "✨", "❤️"];

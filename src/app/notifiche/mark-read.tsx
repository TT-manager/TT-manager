"use client";
import { useEffect } from "react";
import { markReadAction } from "./actions";

/** Dopo che la pagina è comparsa, segna come letti gli avvisi (una volta). */
export function MarkRead({ unread }: { unread: number }) {
  useEffect(() => { if (unread > 0) markReadAction(); }, [unread]);
  return null;
}

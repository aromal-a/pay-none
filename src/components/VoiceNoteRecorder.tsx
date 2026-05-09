import { useEffect, useRef, useState } from "react";
import { Mic, Square, Trash2, Loader2, HardDrive } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { spendTokens, fetchBalance } from "@/lib/tokens";
import {
  VoiceNote,
  deleteVoiceNote,
  getSessionId,
  listVoiceNotes,
  saveVoiceNote,
  tokensForBytes,
} from "@/lib/voiceNotes";
import { toast } from "sonner";

interface Props {
  onBalanceChange?: (b: number) => void;
}

function pickMime(): string {
  const opts = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"];
  for (const o of opts) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(o)) return o;
  }
  return "audio/webm";
}

function fmtSize(b: number) {
  return b < 1024 ? `${b} B` : b < 1024 * 1024 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1024 / 1024).toFixed(2)} MB`;
}
function fmtDur(ms: number) {
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function VoiceNoteRecorder({ onBalanceChange }: Props) {
  const { user } = useAuth();
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [notes, setNotes] = useState<VoiceNote[]>([]);
  const [busy, setBusy] = useState(false);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const startRef = useRef<number>(0);
  const tickRef = useRef<number | null>(null);
  const urlsRef = useRef<Map<string, string>>(new Map());

  const refresh = async () => {
    if (!user) return;
    try { setNotes(await listVoiceNotes(user.id)); } catch { /* ignore */ }
  };

  useEffect(() => { refresh(); }, [user]);
  useEffect(() => () => {
    urlsRef.current.forEach((u) => URL.revokeObjectURL(u));
    urlsRef.current.clear();
    if (tickRef.current) window.clearInterval(tickRef.current);
  }, []);

  const urlFor = (n: VoiceNote) => {
    let u = urlsRef.current.get(n.id);
    if (!u) { u = URL.createObjectURL(n.blob); urlsRef.current.set(n.id, u); }
    return u;
  };

  const start = async () => {
    if (!user) { toast.error("Please sign in"); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = pickMime();
      const rec = new MediaRecorder(stream, { mimeType: mime });
      chunksRef.current = [];
      rec.ondataavailable = (e) => { if (e.data.size) chunksRef.current.push(e.data); };
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: mime });
        const durationMs = Date.now() - startRef.current;
        const cost = tokensForBytes(blob.size);
        try {
          setBusy(true);
          const spent = await spendTokens(cost, "voice-note:save", {
            originalText: `voice ${fmtDur(durationMs)} · ${fmtSize(blob.size)}`,
            stringAppeal: "audio",
            userCurrency: "tokens",
            currencyIssues: "size-based",
            logHold: "local-indexeddb",
            holdPlace: "browser",
          });
          await saveVoiceNote({
            userId: user.id, sessionId: getSessionId(), mimeType: mime,
            size: blob.size, durationMs, blob,
          });
          onBalanceChange?.(spent.remaining);
          toast.success(`Saved locally · -${cost} tokens · ${spent.remaining} left`);
          await refresh();
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Save failed");
        } finally {
          setBusy(false);
        }
      };
      startRef.current = Date.now();
      setElapsed(0);
      tickRef.current = window.setInterval(
        () => setElapsed(Date.now() - startRef.current), 250
      );
      rec.start();
      recRef.current = rec;
      setRecording(true);
    } catch {
      toast.error("Microphone access denied");
    }
  };

  const stop = () => {
    if (tickRef.current) { window.clearInterval(tickRef.current); tickRef.current = null; }
    recRef.current?.stop();
    recRef.current = null;
    setRecording(false);
  };

  const remove = async (id: string) => {
    await deleteVoiceNote(id);
    const u = urlsRef.current.get(id);
    if (u) { URL.revokeObjectURL(u); urlsRef.current.delete(id); }
    await refresh();
  };

  if (!user) return null;

  const projectedCost = recording
    ? tokensForBytes(Math.max(8 * 1024, Math.round((elapsed / 1000) * 16 * 1024)))
    : 0;

  return (
    <div className="rounded-md border bg-muted/20 p-3 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <HardDrive className="h-3.5 w-3.5" />
          <span>Voice notes — saved on your device only</span>
        </div>
        {recording ? (
          <Button size="sm" variant="destructive" onClick={stop}>
            <Square className="h-4 w-4 mr-1" /> Stop · {fmtDur(elapsed)} · ~{projectedCost}t
          </Button>
        ) : (
          <Button size="sm" variant="secondary" onClick={start} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Mic className="h-4 w-4 mr-1" />}
            Record
          </Button>
        )}
      </div>

      {notes.length > 0 && (
        <ul className="space-y-2 max-h-48 overflow-y-auto">
          {notes.map((n) => (
            <li key={n.id} className="flex items-center gap-2 text-xs">
              <audio controls src={urlFor(n)} className="h-8 flex-1 min-w-0" />
              <span className="text-muted-foreground whitespace-nowrap">
                {fmtDur(n.durationMs)} · {fmtSize(n.size)}
              </span>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => remove(n.id)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

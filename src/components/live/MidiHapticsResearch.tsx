import { useEffect, useMemo, useRef, useState } from "react";
import { MIDIHandler, type MIDICallbackData } from "@/lib/midiHandler";
import { AudioHandler } from "@/lib/audioHandler";

type BoxData = {
  customMIDI: ArrayBuffer | null;
  midiNotes: number[];
  recordedCount: number;
  customMIDIName: string;
};

type RecEvent = { type: "noteOn"; note: number; velocity: number; time: number; box: number };

const emptyBox = (): BoxData => ({
  customMIDI: null,
  midiNotes: [],
  recordedCount: 0,
  customMIDIName: "",
});

const STYLES = `
.mhr { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 16px; padding: 6px; margin-top: 24px; box-shadow: 0 20px 60px rgba(0,0,0,0.18); }
.mhr-inner { background: white; border-radius: 12px; padding: 32px; color: #333; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
.mhr header { text-align: center; margin-bottom: 28px; border-bottom: 3px solid #667eea; padding-bottom: 16px; }
.mhr header h2 { font-size: 1.8em; color: #667eea; margin: 0 0 6px; font-weight: 700; }
.mhr header p { font-size: 1em; color: #666; margin: 0; }
.mhr .controls-section { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px; }
.mhr .midi-controls, .mhr .audio-controls { background: #f5f5f5; padding: 16px; border-radius: 8px; display: flex; flex-direction: column; gap: 10px; }
.mhr .volume-control { display: flex; align-items: center; gap: 10px; margin-top: 6px; }
.mhr .volume-control label { font-weight: 600; min-width: 90px; font-size: 0.9em; }
.mhr .volume-control input { flex: 1; height: 6px; cursor: pointer; }
.mhr .btn { padding: 10px 16px; border: none; border-radius: 8px; font-size: 0.95em; font-weight: 600; cursor: pointer; transition: all 0.3s ease; box-shadow: 0 4px 6px rgba(0,0,0,0.1); color: white; }
.mhr .btn:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 6px 12px rgba(0,0,0,0.15); }
.mhr .btn:disabled { opacity: 0.5; cursor: not-allowed; }
.mhr .btn-primary { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
.mhr .btn-secondary { background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); }
.mhr .btn-record { background: linear-gradient(135deg, #ff4757 0%, #ee5a6f 100%); font-size: 1em; padding: 12px 24px; }
.mhr .btn-record.recording { animation: mhr-pulse 1s infinite; }
@keyframes mhr-pulse { 0%,100%{ opacity:1 } 50%{ opacity:0.7 } }
.mhr .btn-stop { background: linear-gradient(135deg, #2f3542 0%, #57606f 100%); }
.mhr .btn-success { background: linear-gradient(135deg, #26de81 0%, #20c997 100%); }
.mhr .status-badge { display: inline-block; padding: 5px 12px; border-radius: 20px; font-size: 0.8em; font-weight: 600; background: #e0e0e0; color: #666; }
.mhr .status-badge.connected { background: #26de81; color: white; }
.mhr .status-badge.recording { background: #ff4757; color: white; }
.mhr .timer { font-weight: 600; font-size: 1.2em; color: #667eea; font-family: 'Courier New', monospace; }
.mhr .midi-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; background: #f9f9f9; padding: 16px; border-radius: 12px; box-shadow: inset 0 2px 8px rgba(0,0,0,0.1); margin-bottom: 24px; }
.mhr .grid-box { aspect-ratio: 1; border: 3px solid #ddd; border-radius: 12px; background: linear-gradient(135deg, #fafafa 0%, #f0f0f0 100%); cursor: pointer; transition: all 0.15s ease; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; font-weight: 600; user-select: none; }
.mhr .grid-box:hover { border-color: #667eea; background: linear-gradient(135deg, #f5f5f5 0%, #e8e8e8 100%); }
.mhr .grid-box.active { border-color: #667eea; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; }
.mhr .grid-box.active .box-number { color: white; }
.mhr .grid-box.flash { transform: scale(0.95); }
.mhr .grid-box.has-midi { border-color: #26de81; }
.mhr .box-number { font-size: 2em; color: #667eea; }
.mhr .box-info { font-size: 0.7em; opacity: 0.85; }
.mhr .recording-section { display: flex; align-items: center; gap: 16px; background: #f0f0f0; padding: 16px; border-radius: 8px; margin-bottom: 24px; flex-wrap: wrap; }
.mhr .recording-controls { display: flex; gap: 12px; flex: 1; align-items: center; flex-wrap: wrap; }
.mhr .file-section, .mhr .export-section { background: #f5f5f5; padding: 16px; border-radius: 8px; margin-bottom: 16px; }
.mhr .upload-area { display: grid; grid-template-columns: auto 1fr auto auto; gap: 10px; align-items: center; }
.mhr .upload-area label { font-weight: 600; font-size: 0.9em; }
.mhr .upload-area input[type="file"], .mhr .upload-area select { padding: 7px 10px; border: 2px solid #ddd; border-radius: 6px; font-size: 0.9em; background: white; }
.mhr .recording-item { display: flex; justify-content: space-between; align-items: center; padding: 10px 12px; background: white; border: 1px solid #eee; border-radius: 6px; margin-top: 8px; font-size: 0.9em; }
.mhr footer { text-align: center; margin-top: 16px; padding-top: 16px; border-top: 1px solid #eee; color: #999; font-size: 0.85em; }
@media (max-width: 768px) { .mhr-inner { padding: 20px; } .mhr .controls-section { grid-template-columns: 1fr; } .mhr .recording-section { flex-direction: column; } .mhr .upload-area { grid-template-columns: 1fr; } }
`;

export default function MidiHapticsResearch() {
  const midi = useMemo(() => new MIDIHandler(), []);
  const audio = useMemo(() => new AudioHandler(), []);

  const [midiStatus, setMidiStatus] = useState<string>("No MIDI");
  const [micStatus, setMicStatus] = useState<string>("No Mic");
  const [micVolume, setMicVolumeState] = useState(100);

  const [boxes, setBoxes] = useState<BoxData[]>(() =>
    Array.from({ length: 9 }, () => emptyBox())
  );
  const [activeBox, setActiveBox] = useState<number>(-1);
  const [flashBox, setFlashBox] = useState<number>(-1);

  const [isRecording, setIsRecording] = useState(false);
  const [timer, setTimer] = useState("00:00");
  const startedAtRef = useRef(0);
  const seqRef = useRef<RecEvent[]>([]);
  const timerIdRef = useRef<number | null>(null);
  const isRecRef = useRef(false);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadBox, setUploadBox] = useState(0);

  const [downloads, setDownloads] = useState<
    Array<{ id: number; title: string; ts: string; duration: number; audio: Blob | null; midi: RecEvent[] }>
  >([]);

  const mapNoteToBox = (n: number) => (n >= 60 && n < 69 ? n - 60 : -1);

  // Built-in Web Audio synth (fallback when no MIDI output device)
  const audioCtxRef = useRef<AudioContext | null>(null);
  const getCtx = () => {
    if (!audioCtxRef.current) {
      const Ctx = (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext);
      audioCtxRef.current = new Ctx();
    }
    return audioCtxRef.current!;
  };
  const noteToFreq = (n: number) => 440 * Math.pow(2, (n - 69) / 12);
  const synthPlay = (note: number, durationMs = 220, velocity = 100) => {
    try {
      const ctx = getCtx();
      if (ctx.state === "suspended") ctx.resume();
      const t0 = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.value = noteToFreq(note);
      const peak = Math.min(0.35, (velocity / 127) * 0.4);
      gain.gain.setValueAtTime(0, t0);
      gain.gain.linearRampToValueAtTime(peak, t0 + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + durationMs / 1000);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + durationMs / 1000 + 0.05);
    } catch (e) {
      console.error("synth error", e);
    }
  };

  // Per-box loop playback timers
  const loopTimersRef = useRef<Map<number, number[]>>(new Map());
  const [playingBoxes, setPlayingBoxes] = useState<Set<number>>(new Set());

  const stopBoxLoop = (i: number) => {
    const timers = loopTimersRef.current.get(i);
    if (timers) timers.forEach((t) => clearTimeout(t));
    loopTimersRef.current.delete(i);
    setPlayingBoxes((prev) => {
      const next = new Set(prev);
      next.delete(i);
      return next;
    });
  };

  const startBoxLoop = (i: number) => {
    const notes = boxes[i].midiNotes;
    if (!notes.length) return;
    const stepMs = 220;
    const gapMs = 400;
    setPlayingBoxes((prev) => new Set(prev).add(i));
    const playOnce = () => {
      const timers: number[] = [];
      notes.forEach((n, k) => {
        const t = window.setTimeout(() => {
          setFlashBox(i);
          window.setTimeout(() => setFlashBox(-1), 100);
          if (midi.isConnected) {
            midi.sendNoteOn(n, 100);
            window.setTimeout(() => midi.sendNoteOff(n), stepMs - 20);
          }
          synthPlay(n, stepMs);
        }, k * stepMs);
        timers.push(t);
      });
      const loopT = window.setTimeout(() => {
        if (loopTimersRef.current.has(i)) playOnce();
      }, notes.length * stepMs + gapMs);
      timers.push(loopT);
      loopTimersRef.current.set(i, timers);
    };
    playOnce();
  };

  useEffect(() => {
    midi.onMIDIMessage((data: MIDICallbackData) => {
      if (data.type !== "noteOn") return;
      const idx = mapNoteToBox(data.note);
      if (idx === -1) return;
      setActiveBox(idx);
      setFlashBox(idx);
      window.setTimeout(() => setFlashBox(-1), 120);

      if (isRecRef.current) {
        seqRef.current.push({
          type: "noteOn",
          note: data.note,
          velocity: data.velocity,
          time: Date.now() - startedAtRef.current,
          box: idx + 1,
        });
        setBoxes((prev) => {
          const next = prev.slice();
          next[idx] = {
            ...next[idx],
            recordedCount: next[idx].recordedCount + 1,
            midiNotes: [...next[idx].midiNotes, data.note],
          };
          return next;
        });
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const requestMidi = async () => {
    const ok = await midi.requestMIDIAccess();
    setMidiStatus(ok ? "✅ MIDI Connected" : "❌ MIDI Failed");
  };

  const requestMic = async () => {
    const ok = await audio.requestMicrophoneAccess();
    setMicStatus(ok ? "✅ Mic Connected" : "❌ Mic Failed");
  };

  const handleVolume = (v: number) => {
    setMicVolumeState(v);
    audio.setMicVolume(v);
  };

  const startRec = () => {
    if (isRecording) return;
    if (!midi.isConnected) {
      alert("Please connect MIDI first.");
      return;
    }
    seqRef.current = [];
    startedAtRef.current = Date.now();
    isRecRef.current = true;
    setIsRecording(true);
    if (audio.micPermissionGranted) audio.startRecording();

    let secs = 0;
    timerIdRef.current = window.setInterval(() => {
      secs++;
      const m = String(Math.floor(secs / 60)).padStart(2, "0");
      const s = String(secs % 60).padStart(2, "0");
      setTimer(`${m}:${s}`);
    }, 1000);
  };

  const stopRec = async () => {
    if (!isRecording) return;
    isRecRef.current = false;
    setIsRecording(false);
    if (timerIdRef.current !== null) {
      clearInterval(timerIdRef.current);
      timerIdRef.current = null;
    }
    let blob: Blob | null = null;
    if (audio.micPermissionGranted) blob = await audio.stopRecording();
    const duration = (Date.now() - startedAtRef.current) / 1000;
    const title = `Recording_${new Date().toISOString().replace(/[:.]/g, "-")}`;
    setDownloads((prev) => [
      ...prev,
      { id: prev.length + 1, title, ts: new Date().toISOString(), duration, audio: blob, midi: seqRef.current.slice() },
    ]);
    setTimer("00:00");
  };

  const triggerBox = (i: number) => {
    setActiveBox(i);
    setFlashBox(i);
    window.setTimeout(() => setFlashBox(-1), 120);
    const note = boxes[i].midiNotes[0];
    if (note != null && midi.isConnected) {
      midi.sendNoteOn(note, 100);
      setTimeout(() => midi.sendNoteOff(note), 200);
    }
    if (isRecRef.current && note != null) {
      seqRef.current.push({
        type: "noteOn",
        note,
        velocity: 100,
        time: Date.now() - startedAtRef.current,
        box: i + 1,
      });
    }
  };

  const uploadMidi = async () => {
    if (!selectedFile) {
      alert("Please select a MIDI file.");
      return;
    }
    const buf = await selectedFile.arrayBuffer();
    const notes = await midi.parseMIDIFile(buf);
    setBoxes((prev) => {
      const next = prev.slice();
      next[uploadBox] = {
        customMIDI: buf,
        midiNotes: notes.map((n) => n.note),
        recordedCount: next[uploadBox].recordedCount,
        customMIDIName: `MIDI (${notes.length} notes)`,
      };
      return next;
    });
    alert(`Uploaded to Box ${uploadBox + 1} (${notes.length} notes)`);
  };

  const downloadOne = (id: number) => {
    const r = downloads.find((d) => d.id === id);
    if (!r) return;
    if (r.audio) audio.downloadBlob(r.audio, `${r.title}_audio.webm`);
    const midiBlob = new Blob([JSON.stringify(r.midi, null, 2)], { type: "application/json" });
    audio.downloadBlob(midiBlob, `${r.title}_midi.json`);
  };

  const midiConnected = midiStatus.startsWith("✅");
  const micConnected = micStatus.startsWith("✅");

  return (
    <>
      <style>{STYLES}</style>
      <div className="mhr">
        <div className="mhr-inner">
          <header>
            <h2>🎛️ MIDI Haptics Research</h2>
            <p>3×3 Touch MIDI Grid Recorder</p>
          </header>

          <div className="controls-section">
            <div className="midi-controls">
              <button className="btn btn-primary" onClick={requestMidi}>🔌 Request MIDI Access</button>
              <span className={`status-badge${midiConnected ? " connected" : ""}`}>{midiStatus}</span>
            </div>
            <div className="audio-controls">
              <button className="btn btn-secondary" onClick={requestMic}>🎤 Request Microphone</button>
              <span className={`status-badge${micConnected ? " connected" : ""}`}>{micStatus}</span>
              <div className="volume-control">
                <label htmlFor="mhr-mic-vol">Mic Volume:</label>
                <input
                  id="mhr-mic-vol"
                  type="range"
                  min={0}
                  max={100}
                  value={micVolume}
                  onChange={(e) => handleVolume(Number(e.target.value))}
                  disabled={!micConnected}
                />
                <span>{micVolume}%</span>
              </div>
            </div>
          </div>

          <div className="midi-grid">
            {boxes.map((b, i) => {
              const cls = [
                "grid-box",
                activeBox === i ? "active" : "",
                flashBox === i ? "flash" : "",
                b.midiNotes.length > 0 || b.customMIDI ? "has-midi" : "",
              ]
                .filter(Boolean)
                .join(" ");
              const info = b.customMIDI
                ? `📁 ${b.customMIDIName}`
                : b.recordedCount > 0
                ? `🎹 ${b.recordedCount} notes`
                : "empty";
              return (
                <div
                  key={i}
                  className={cls}
                  onClick={() => triggerBox(i)}
                  onPointerDown={() => setFlashBox(i)}
                  onPointerUp={() => setFlashBox(-1)}
                  onPointerLeave={() => setFlashBox(-1)}
                >
                  <div className="box-number">{i + 1}</div>
                  <div className="box-info">{info}</div>
                </div>
              );
            })}
          </div>

          <div className="recording-section">
            <div className="recording-controls">
              <button
                className={`btn btn-record${isRecording ? " recording" : ""}`}
                onClick={startRec}
                disabled={isRecording}
              >
                🔴 Master Record
              </button>
              <button className="btn btn-stop" onClick={stopRec} disabled={!isRecording}>
                ⏹️ Stop Recording
              </button>
              <span className="timer">{timer}</span>
            </div>
            <span className={`status-badge${isRecording ? " recording" : ""}`}>
              {isRecording ? "🔴 RECORDING" : "idle"}
            </span>
          </div>

          <div className="file-section">
            <div className="upload-area">
              <label htmlFor="mhr-file">📁 Upload Custom MIDI to Box:</label>
              <input
                id="mhr-file"
                type="file"
                accept=".mid,.midi"
                onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
              />
              <select value={uploadBox} onChange={(e) => setUploadBox(Number(e.target.value))}>
                {Array.from({ length: 9 }).map((_, i) => (
                  <option key={i} value={i}>
                    Box {i + 1}
                  </option>
                ))}
              </select>
              <button className="btn btn-secondary" onClick={uploadMidi}>
                Upload to Box
              </button>
            </div>
          </div>

          <div className="export-section">
            <button
              className="btn btn-success"
              disabled={downloads.length === 0}
              onClick={() => downloads.length && downloadOne(downloads[downloads.length - 1].id)}
            >
              📥 Export Latest Recording
            </button>
            <div className="recordings-list">
              {downloads.map((r) => (
                <div className="recording-item" key={r.id}>
                  <div>
                    <strong>{r.title}</strong>
                    <br />
                    <small>
                      {r.ts} • {r.duration.toFixed(1)}s
                    </small>
                  </div>
                  <button className="btn btn-primary" onClick={() => downloadOne(r.id)}>
                    Download
                  </button>
                </div>
              ))}
            </div>
          </div>

          <footer>
            <p>Connect a MIDI device, record touches and vocals, export synchronized audio + MIDI</p>
          </footer>
        </div>
      </div>
    </>
  );
}

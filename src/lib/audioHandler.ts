// Audio recording + WAV export. Ported from audioHandler.js.
/* eslint-disable @typescript-eslint/no-explicit-any */

export class AudioHandler {
  audioContext: AudioContext | null = null;
  mediaRecorder: MediaRecorder | null = null;
  mediaStream: MediaStream | null = null;
  recordedChunks: Blob[] = [];
  isRecording = false;
  micPermissionGranted = false;
  micVolume = 1.0;
  gainNode: GainNode | null = null;

  initAudioContext() {
    if (!this.audioContext) {
      const Ctx: typeof AudioContext =
        (window as any).AudioContext || (window as any).webkitAudioContext;
      this.audioContext = new Ctx();
    }
    return this.audioContext;
  }

  async requestMicrophoneAccess(): Promise<boolean> {
    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.micPermissionGranted = true;
      this.setupAudioRecording();
      return true;
    } catch (err) {
      console.error("Microphone access denied:", err);
      this.micPermissionGranted = false;
      return false;
    }
  }

  private setupAudioRecording() {
    if (!this.mediaStream) return;
    const ctx = this.initAudioContext();
    const source = ctx.createMediaStreamSource(this.mediaStream);
    this.gainNode = ctx.createGain();
    this.gainNode.gain.value = this.micVolume;
    source.connect(this.gainNode);

    const opts: MediaRecorderOptions = {
      mimeType: "audio/webm;codecs=opus",
      audioBitsPerSecond: 128000,
    };
    if (!MediaRecorder.isTypeSupported(opts.mimeType!)) opts.mimeType = "audio/webm";
    if (!MediaRecorder.isTypeSupported(opts.mimeType!)) opts.mimeType = "audio/mp4";

    this.mediaRecorder = new MediaRecorder(this.mediaStream, opts);
    this.recordedChunks = [];
    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.recordedChunks.push(e.data);
    };
  }

  setMicVolume(volume: number) {
    this.micVolume = Math.max(0, Math.min(1, volume / 100));
    if (this.gainNode) this.gainNode.gain.value = this.micVolume;
  }

  startRecording() {
    if (!this.mediaRecorder) return false;
    if (this.mediaRecorder.state === "recording") return false;
    this.recordedChunks = [];
    this.mediaRecorder.start();
    this.isRecording = true;
    return true;
  }

  stopRecording(): Promise<Blob | null> {
    return new Promise((resolve) => {
      if (!this.mediaRecorder || this.mediaRecorder.state === "inactive") {
        resolve(null);
        return;
      }
      this.mediaRecorder.onstop = () => {
        this.isRecording = false;
        const blob = new Blob(this.recordedChunks, { type: this.mediaRecorder!.mimeType });
        resolve(blob);
      };
      this.mediaRecorder.stop();
    });
  }

  downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}

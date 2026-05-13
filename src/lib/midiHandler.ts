// MIDI Web API handler. Ported from midiHandler.js.
/* eslint-disable @typescript-eslint/no-explicit-any */

export type MIDICallbackData = {
  type: "noteOn" | "noteOff";
  note: number;
  velocity: number;
  channel: number;
  timestamp: number;
};

export class MIDIHandler {
  midiAccess: any = null;
  inputs = new Map<string, any>();
  outputs = new Map<string, any>();
  isConnected = false;
  callbacks: Array<(d: MIDICallbackData) => void> = [];

  async requestMIDIAccess(): Promise<boolean> {
    try {
      this.midiAccess = await (navigator as any).requestMIDIAccess();
      this.setupMIDIDevices();
      this.isConnected = true;
      return true;
    } catch (err) {
      console.error("MIDI access denied:", err);
      this.isConnected = false;
      return false;
    }
  }

  private setupMIDIDevices() {
    for (const input of this.midiAccess.inputs.values()) {
      this.inputs.set(input.id, input);
      input.onmidimessage = (e: any) => this.handleMIDIMessage(e);
    }
    for (const output of this.midiAccess.outputs.values()) {
      this.outputs.set(output.id, output);
    }
    this.midiAccess.onstatechange = (event: any) => {
      const port = event.port;
      if (port.state === "connected") {
        if (port.type === "input") {
          this.inputs.set(port.id, port);
          port.onmidimessage = (e: any) => this.handleMIDIMessage(e);
        } else if (port.type === "output") {
          this.outputs.set(port.id, port);
        }
      } else if (port.state === "disconnected") {
        this.inputs.delete(port.id);
        this.outputs.delete(port.id);
      }
    };
  }

  private handleMIDIMessage(event: any) {
    const [status, note, velocity] = event.data;
    const channel = status & 0x0f;
    const command = status & 0xf0;
    if (command === 0x90 || command === 0x80) {
      const isNoteOn = command === 0x90 && velocity > 0;
      this.callbacks.forEach((cb) =>
        cb({
          type: isNoteOn ? "noteOn" : "noteOff",
          note,
          velocity,
          channel,
          timestamp: Date.now(),
        })
      );
    }
  }

  onMIDIMessage(cb: (d: MIDICallbackData) => void) {
    this.callbacks.push(cb);
  }

  sendNoteOn(note: number, velocity = 100, channel = 0) {
    if (!this.midiAccess) return;
    for (const out of this.midiAccess.outputs.values()) {
      out.send([0x90 + channel, note, velocity]);
    }
  }

  sendNoteOff(note: number, channel = 0) {
    if (!this.midiAccess) return;
    for (const out of this.midiAccess.outputs.values()) {
      out.send([0x80 + channel, note, 0]);
    }
  }

  noteToString(noteNumber: number) {
    const notes = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
    const octave = Math.floor(noteNumber / 12) - 1;
    return `${notes[noteNumber % 12]}${octave}`;
  }

  async parseMIDIFile(arrayBuffer: ArrayBuffer): Promise<Array<{ note: number; velocity: number; time: number }>> {
    try {
      const view = new Uint8Array(arrayBuffer);
      const notes: Array<{ note: number; velocity: number; time: number }> = [];
      if (view[0] !== 0x4d || view[1] !== 0x54) throw new Error("Invalid MIDI file");
      let pos = 14;
      while (pos < view.length) {
        let deltaTime = 0;
        let byte = 0;
        do {
          byte = view[pos++];
          deltaTime = (deltaTime << 7) | (byte & 0x7f);
        } while (byte & 0x80);
        const eventType = view[pos++];
        if (eventType === 0xff) {
          pos++;
          const length = view[pos++];
          pos += length;
        } else if ((eventType & 0xf0) === 0x90) {
          const note = view[pos++];
          const velocity = view[pos++];
          if (velocity > 0) notes.push({ note, velocity, time: deltaTime });
        } else if ((eventType & 0xf0) === 0x80) {
          pos += 2;
        } else {
          const length = view[pos++];
          pos += length;
        }
      }
      return notes;
    } catch (err) {
      console.error("MIDI parse error:", err);
      return [];
    }
  }
}

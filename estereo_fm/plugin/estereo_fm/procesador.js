// owrx-estereo (EA7CL) · procesador de audio de DOS canales para OpenWebRX+.
// Igual que el original (AudioProcessor.js), pero con un búfer para cada canal.
// Acepta Float32Array (mono: va a los dos canales) o {l: Float32Array, r: Float32Array}.
class Ea7clEstereoProcessor extends AudioWorkletProcessor {
    constructor(options) {
        super(options);
        this.bufferSize = Math.round(options.processorOptions.maxBufferSize / 128) * 128;
        this.bufL = new Float32Array(this.bufferSize);
        this.bufR = new Float32Array(this.bufferSize);
        this.inPos = 0;
        this.outPos = 0;
        this.samplesProcessed = 0;
        // reserva: tras quedarse sin audio, espera a tener ~0,3 s antes de seguir (el DAB llega a golpes)
        this.reserva = Math.min(Math.round(0.3 * sampleRate), this.bufferSize >> 1);
        this.llenando = true;
        this.port.addEventListener('message', (m) => {
            if (typeof m.data === 'string') {
                const json = JSON.parse(m.data);
                if (json.cmd && json.cmd === 'getStats') this.reportStats();
                return;
            }
            const l = m.data instanceof Float32Array ? m.data : m.data.l;
            const r = m.data instanceof Float32Array ? m.data : m.data.r;
            this.escribir(this.bufL, l);
            this.escribir(this.bufR, r);
            this.inPos = (this.inPos + l.length) % this.bufferSize;
        });
        this.port.addEventListener('messageerror', console.error);
        this.port.start();
    }
    escribir(buf, d) {
        if (this.inPos + d.length <= this.bufferSize) {
            buf.set(d, this.inPos);
        } else {
            const resto = this.bufferSize - this.inPos;
            buf.set(d.subarray(0, resto), this.inPos);
            buf.set(d.subarray(resto));
        }
    }
    process(inputs, outputs) {
        const out = outputs[0];
        const quedan = this.remaining();
        if (this.llenando && quedan >= this.reserva) this.llenando = false;
        if (quedan < 128 || this.llenando) {
            if (quedan < 128) this.llenando = true;
            out.forEach((o) => o.fill(0));
            return true;
        }
        out[0].set(this.bufL.subarray(this.outPos, this.outPos + 128));
        if (out.length > 1) out[1].set(this.bufR.subarray(this.outPos, this.outPos + 128));
        this.outPos = (this.outPos + 128) % this.bufferSize;
        this.samplesProcessed += 128;
        return true;
    }
    remaining() {
        const mod = (this.inPos - this.outPos) % this.bufferSize;
        return mod >= 0 ? mod : mod + this.bufferSize;
    }
    reportStats() {
        this.port.postMessage(JSON.stringify({ buffersize: this.remaining(), samplesProcessed: this.samplesProcessed }));
        this.samplesProcessed = 0;
    }
}

registerProcessor('ea7cl-estereo-processor', Ea7clEstereoProcessor);

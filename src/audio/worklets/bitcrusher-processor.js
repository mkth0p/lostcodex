class BitcrusherProcessor extends AudioWorkletProcessor {
    static get parameterDescriptors() {
        return [
            { name: 'bits', defaultValue: 4, minValue: 1, maxValue: 16, automationRate: 'k-rate' },
            { name: 'normFreq', defaultValue: 0.5, minValue: 0.01, maxValue: 1, automationRate: 'k-rate' },
        ];
    }

    constructor() {
        super();
        this.phase = 0;
        this.lastValue = 0;
    }

    process(inputs, outputs, parameters) {
        const input = inputs[0];
        const output = outputs[0];
        if (!input || !input.length) return true;

        const bits = parameters.bits[0];
        const normFreq = parameters.normFreq[0];
        const step = Math.pow(0.5, bits);

        for (let ch = 0; ch < output.length; ch++) {
            const inCh = input[ch] || input[0];
            const outCh = output[ch];
            for (let i = 0; i < outCh.length; i++) {
                this.phase += normFreq;
                if (this.phase >= 1) {
                    this.phase -= 1;
                    this.lastValue = step * Math.floor((inCh[i] || 0) / step + 0.5);
                }
                outCh[i] = this.lastValue;
            }
        }

        return true;
    }
}

registerProcessor('bitcrusher-processor', BitcrusherProcessor);


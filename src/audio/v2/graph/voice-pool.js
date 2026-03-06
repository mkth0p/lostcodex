export class VoicePool {
    constructor({ maxVoices = 72 } = {}) {
        this.maxVoices = Math.max(8, maxVoices);
        this.active = new Map();
        this.sequence = 0;
        this.voiceStealCount = 0;
    }

    setBudget(maxVoices) {
        this.maxVoices = Math.max(8, Math.round(maxVoices || this.maxVoices));
        this._trim();
    }

    requestVoice({ nowSec = 0, ttlSec = 1.2, kind = 'generic', weight = 1 } = {}) {
        this._cleanup(nowSec);
        if (this.active.size >= this.maxVoices) {
            let victimId = null;
            let lowestWeight = Infinity;
            for (const [id, entry] of this.active.entries()) {
                if (entry.weight < lowestWeight) {
                    lowestWeight = entry.weight;
                    victimId = id;
                }
            }
            if (victimId === null) {
                const oldest = this.active.entries().next().value;
                if (!oldest) return { granted: false, id: null };
                victimId = oldest[0];
            }
            this.active.delete(victimId);
            this.voiceStealCount++;
        }
        const id = ++this.sequence;
        this.active.set(id, {
            expiresAt: nowSec + Math.max(0.05, ttlSec),
            kind,
            weight: Math.max(0.1, weight),
        });
        return { granted: true, id };
    }

    releaseVoice(id) {
        if (!id) return;
        this.active.delete(id);
    }

    getState() {
        return {
            activeVoices: this.active.size,
            voiceBudget: this.maxVoices,
            voiceStealCount: this.voiceStealCount,
        };
    }

    _cleanup(nowSec) {
        this.active.forEach((entry, id) => {
            if (entry.expiresAt <= nowSec) this.active.delete(id);
        });
    }

    _trim() {
        while (this.active.size > this.maxVoices) {
            let victimId = null;
            let lowestWeight = Infinity;
            for (const [id, entry] of this.active.entries()) {
                if (entry.weight < lowestWeight) {
                    lowestWeight = entry.weight;
                    victimId = id;
                }
            }
            if (victimId === null) {
                const oldest = this.active.entries().next().value;
                if (!oldest) break;
                victimId = oldest[0];
            }
            this.active.delete(victimId);
            this.voiceStealCount++;
        }
    }
}

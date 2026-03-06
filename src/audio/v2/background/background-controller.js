import { BackgroundTimeline } from './background-timeline.js';

const POLICIES = new Set(['realtime', 'continuity', 'pause']);

export class BackgroundController {
    constructor({ onModeChange, onPolicyChange, onPauseRequested } = {}) {
        this.policy = 'realtime';
        this.mode = 'foreground-realtime';
        this.onModeChange = onModeChange;
        this.onPolicyChange = onPolicyChange;
        this.onPauseRequested = onPauseRequested;
        this.timeline = new BackgroundTimeline();
        this._boundVisibility = () => this._onVisibility();
        this._boundFocus = () => this._onFocus();
        this._boundBlur = () => this._onBlur();
        this._attached = false;
    }

    attach() {
        if (this._attached || typeof document === 'undefined') return;
        document.addEventListener('visibilitychange', this._boundVisibility);
        globalThis.addEventListener?.('focus', this._boundFocus);
        globalThis.addEventListener?.('blur', this._boundBlur);
        this._attached = true;
    }

    dispose() {
        if (!this._attached || typeof document === 'undefined') return;
        document.removeEventListener('visibilitychange', this._boundVisibility);
        globalThis.removeEventListener?.('focus', this._boundFocus);
        globalThis.removeEventListener?.('blur', this._boundBlur);
        this._attached = false;
    }

    setPolicy(nextPolicy = 'realtime') {
        const normalized = POLICIES.has(nextPolicy) ? nextPolicy : 'realtime';
        this.policy = normalized;
        this.onPolicyChange?.(this.policy);
        if (normalized === 'continuity' && this.mode.startsWith('background')) {
            this.timeline.setRemaining(15 * 60 * 1000);
        }
    }

    enterBackgroundMode() {
        if (this.policy === 'pause') {
            this.mode = 'paused-by-focus';
            this.onPauseRequested?.();
            this.onModeChange?.(this.mode);
            return this.mode;
        }
        if (this.policy === 'continuity') {
            this.mode = 'background-continuity';
            this.timeline.setRemaining(15 * 60 * 1000);
            this.onModeChange?.(this.mode);
            return this.mode;
        }
        this.mode = 'background-realtime';
        this.onModeChange?.(this.mode);
        return this.mode;
    }

    exitBackgroundMode() {
        this.mode = 'foreground-realtime';
        this.onModeChange?.(this.mode);
        return this.mode;
    }

    getState() {
        return {
            backgroundMode: this.mode,
            backgroundPolicy: this.policy,
            backgroundTimelineRemainingMs: this.mode === 'background-continuity'
                ? this.timeline.getRemainingMs()
                : 0,
        };
    }

    _onVisibility() {
        if (typeof document === 'undefined') return;
        if (document.hidden) this.enterBackgroundMode();
        else this.exitBackgroundMode();
    }

    _onFocus() {
        if (this.mode !== 'foreground-realtime') this.exitBackgroundMode();
    }

    _onBlur() {
        if (typeof document === 'undefined') return;
        if (!document.hidden) this.enterBackgroundMode();
    }
}

export class NodeRegistry {
    constructor() {
        this._nodes = new Set();
        this._groups = new Set();
    }

    _registerGroup(nodes) {
        const groupNodes = [...new Set(nodes.filter(Boolean))];
        if (!groupNodes.length) return null;

        const group = { nodes: groupNodes, released: false, pendingStops: 0 };
        this._groups.add(group);

        groupNodes.forEach((node) => {
            this._nodes.add(node);

            if (typeof node.stop === 'function' && (typeof node.addEventListener === 'function' || 'onended' in node)) {
                group.pendingStops++;
                const handleEnded = () => {
                    if (group.released) return;
                    group.pendingStops = Math.max(0, group.pendingStops - 1);
                    if (group.pendingStops === 0) this.releaseGroup(group);
                };

                if (typeof node.addEventListener === 'function') {
                    node.addEventListener('ended', handleEnded, { once: true });
                } else {
                    const prevOnEnded = node.onended;
                    node.onended = (...args) => {
                        try {
                            if (typeof prevOnEnded === 'function') prevOnEnded.apply(node, args);
                        } finally {
                            handleEnded();
                        }
                    };
                }
            }
        });

        return group;
    }

    push(...nodes) {
        this._registerGroup(nodes);
        return this._nodes.size;
    }

    pushTransient(durationSeconds, ...nodes) {
        const group = this._registerGroup(nodes);
        if (!group) return this._nodes.size;
        const ttlMs = Math.max(100, (durationSeconds || 0) * 1000);
        group.timeoutId = setTimeout(() => this.releaseGroup(group), ttlMs);
        return this._nodes.size;
    }

    releaseGroup(group) {
        if (!group || group.released) return;
        group.released = true;
        this._groups.delete(group);
        if (group.timeoutId) clearTimeout(group.timeoutId);
        group.nodes.forEach((node) => {
            this._nodes.delete(node);
            try { node.disconnect(); } catch { }
        });
    }

    forEach(cb) {
        Array.from(this._nodes).forEach(cb);
    }

    clear() {
        this._groups.forEach((group) => {
            if (group.timeoutId) clearTimeout(group.timeoutId);
        });
        this._groups.clear();
        this._nodes.clear();
    }

    get size() {
        return this._nodes.size;
    }
}

import { rarityFromScore } from '../../rarity.js';

function fallbackRarityFromAddress(address = '') {
    const len = [...(address || '')].length;
    if (len <= 3) return { key: 'common', label: 'COMMON', className: 'rarity-common' };
    if (len <= 6) return { key: 'standard', label: 'STANDARD', className: 'rarity-standard' };
    if (len <= 10) return { key: 'uncommon', label: 'UNCOMMON', className: 'rarity-uncommon' };
    if (len <= 15) return { key: 'rare', label: 'RARE', className: 'rarity-rare' };
    return { key: 'anomalous', label: 'ANOMALOUS', className: 'rarity-anomalous' };
}

export function resolvePlanetRarity(planet, address = '') {
    const key = planet?.rarityKey;
    const score = planet?.rarityScore;
    const label = planet?.rarityClass;

    if (typeof score === 'number' && Number.isFinite(score)) {
        const rarity = rarityFromScore(score);
        return {
            ...rarity,
            score,
        };
    }

    if (typeof key === 'string' && key) {
        const normalized = key.toLowerCase();
        const fallbackScore = normalized === 'legendary' ? 0.98 : normalized === 'anomalous' ? 0.9 : normalized === 'rare' ? 0.78 : normalized === 'uncommon' ? 0.58 : normalized === 'standard' ? 0.38 : 0.18;
        const rarity = rarityFromScore(fallbackScore);
        return {
            key: rarity.key,
            label: (label || rarity.label).toUpperCase(),
            className: rarity.className,
            score: fallbackScore,
        };
    }

    const fallback = fallbackRarityFromAddress(address);
    return {
        ...fallback,
        score: null,
    };
}

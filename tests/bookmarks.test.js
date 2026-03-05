import { beforeEach, describe, expect, it } from 'vitest';
import { isBookmarked, loadBookmarks, saveBookmarks, toggleBookmark } from '../src/ui/shared/bookmarks.js';

describe('bookmarks', () => {
    beforeEach(() => {
        const store = new Map();
        globalThis.localStorage = {
            getItem(key) {
                return store.has(key) ? store.get(key) : null;
            },
            setItem(key, value) {
                store.set(key, String(value));
            },
            removeItem(key) {
                store.delete(key);
            },
            clear() {
                store.clear();
            },
        };
    });

    it('loads and saves bookmarks', () => {
        const entries = [{ address: 'abc', name: 'planet-a', biomeId: 'desert' }];
        saveBookmarks(entries);
        expect(loadBookmarks()).toEqual(entries);
    });

    it('toggles existing bookmark by address', () => {
        const start = [{ address: 'abc', name: 'x', biomeId: 'forest' }];
        const removed = toggleBookmark(start, { address: 'abc', name: 'x', biomeId: 'forest' });
        expect(removed).toEqual([]);
    });

    it('adds bookmark and enforces max size', () => {
        const start = [{ address: 'a', name: 'a', biomeId: 'forest' }];
        const next = toggleBookmark(start, { address: 'b', name: 'b', biomeId: 'desert' }, 1);
        expect(next).toEqual([{ address: 'b', name: 'b', biomeId: 'desert' }]);
        expect(isBookmarked(next, 'b')).toBe(true);
    });
});

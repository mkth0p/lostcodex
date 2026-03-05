const BOOKMARKS_KEY = 'hc-bookmarks';

export function loadBookmarks() {
    try {
        return JSON.parse(localStorage.getItem(BOOKMARKS_KEY) || '[]');
    } catch {
        return [];
    }
}

export function saveBookmarks(bookmarks) {
    localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(bookmarks));
}

export function toggleBookmark(bookmarks, entry, limit = 20) {
    const next = [...bookmarks];
    const idx = next.findIndex((b) => b.address === entry.address);
    if (idx >= 0) {
        next.splice(idx, 1);
    } else {
        next.unshift(entry);
        if (next.length > limit) next.pop();
    }
    return next;
}

export function isBookmarked(bookmarks, address) {
    return bookmarks.some((b) => b.address === address);
}

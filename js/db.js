/* ===== IndexedDB Database Layer ===== */

const DB_NAME = 'SeriesTrackerDB';
const DB_VERSION = 1;
const STORE_NAME = 'media';

class Database {
    constructor() {
        this.db = null;
    }

    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
                    store.createIndex('type', 'type', { unique: false });
                    store.createIndex('status', 'status', { unique: false });
                    store.createIndex('createdAt', 'createdAt', { unique: false });
                }
            };

            request.onsuccess = (e) => {
                this.db = e.target.result;
                resolve(this.db);
            };

            request.onerror = (e) => {
                reject(e.target.error);
            };
        });
    }

    _getStore(mode = 'readonly') {
        const tx = this.db.transaction(STORE_NAME, mode);
        return tx.objectStore(STORE_NAME);
    }

    async add(item) {
        return new Promise((resolve, reject) => {
            const store = this._getStore('readwrite');
            item.id = item.id || crypto.randomUUID();
            item.createdAt = item.createdAt || Date.now();
            item.updatedAt = Date.now();
            const req = store.add(item);
            req.onsuccess = () => resolve(item);
            req.onerror = (e) => reject(e.target.error);
        });
    }

    async update(item) {
        return new Promise((resolve, reject) => {
            const store = this._getStore('readwrite');
            item.updatedAt = Date.now();
            const req = store.put(item);
            req.onsuccess = () => resolve(item);
            req.onerror = (e) => reject(e.target.error);
        });
    }

    async delete(id) {
        return new Promise((resolve, reject) => {
            const store = this._getStore('readwrite');
            const req = store.delete(id);
            req.onsuccess = () => resolve();
            req.onerror = (e) => reject(e.target.error);
        });
    }

    async getById(id) {
        return new Promise((resolve, reject) => {
            const store = this._getStore();
            const req = store.get(id);
            req.onsuccess = () => resolve(req.result);
            req.onerror = (e) => reject(e.target.error);
        });
    }

    async getAll() {
        return new Promise((resolve, reject) => {
            const store = this._getStore();
            const req = store.getAll();
            req.onsuccess = () => resolve(req.result || []);
            req.onerror = (e) => reject(e.target.error);
        });
    }

    async clearAll() {
        return new Promise((resolve, reject) => {
            const store = this._getStore('readwrite');
            const req = store.clear();
            req.onsuccess = () => resolve();
            req.onerror = (e) => reject(e.target.error);
        });
    }

    // ===== Helper: create a new series object =====
    static createSeries({ title, posterUrl, genre, year, seasons, notes }) {
        const seasonsData = [];
        for (let s = 0; s < seasons.length; s++) {
            const episodes = [];
            for (let e = 0; e < seasons[s]; e++) {
                episodes.push({
                    number: e + 1,
                    title: '',
                    watched: false,
                    rating: 0
                });
            }
            seasonsData.push({
                number: s + 1,
                episodes
            });
        }

        return {
            type: 'series',
            title: title.trim(),
            posterUrl: posterUrl || '',
            genre: genre || '',
            year: year || '',
            rating: 0,
            status: 'plantowatch', // watching, completed, plantowatch
            notes: notes || '',
            seasons: seasonsData
        };
    }

    // ===== Helper: create a new movie object =====
    static createMovie({ title, posterUrl, genre, year, notes }) {
        return {
            type: 'movie',
            title: title.trim(),
            posterUrl: posterUrl || '',
            genre: genre || '',
            year: year || '',
            rating: 0,
            status: 'plantowatch', // watched, plantowatch
            watched: false,
            notes: notes || ''
        };
    }

    // ===== Compute stats for a series =====
    static getSeriesProgress(series) {
        let total = 0;
        let watched = 0;
        for (const season of series.seasons) {
            for (const ep of season.episodes) {
                total++;
                if (ep.watched) watched++;
            }
        }
        return { total, watched, percent: total > 0 ? Math.round((watched / total) * 100) : 0 };
    }

    // ===== Compute global stats =====
    static getGlobalStats(items) {
        let totalSeries = 0;
        let totalMovies = 0;
        let totalEpisodes = 0;
        let watchedEpisodes = 0;
        let watchedMovies = 0;
        let totalRatings = 0;
        let ratingSum = 0;

        for (const item of items) {
            if (item.type === 'series') {
                totalSeries++;
                const prog = Database.getSeriesProgress(item);
                totalEpisodes += prog.total;
                watchedEpisodes += prog.watched;
            } else {
                totalMovies++;
                if (item.watched) watchedMovies++;
            }
            if (item.rating > 0) {
                totalRatings++;
                ratingSum += item.rating;
            }
        }

        return {
            totalSeries,
            totalMovies,
            totalItems: items.length,
            totalEpisodes,
            watchedEpisodes,
            watchedMovies,
            avgRating: totalRatings > 0 ? (ratingSum / totalRatings).toFixed(1) : '—'
        };
    }
}

// Global instance
const db = new Database();

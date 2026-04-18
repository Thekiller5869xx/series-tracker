/* ===== App Controller ===== */

const App = {
    currentPage: 'dashboard',
    currentFilter: 'all',
    currentDetailId: null,
    items: [],
    openSeasons: new Set(),

    // ===== INIT =====
    async init() {
        await db.init();
        this.items = await db.getAll();

        // Register service worker
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('sw.js').catch(() => {});
        }

        // Setup event listeners
        this._setupEvents();

        // Initial render
        this.navigate('dashboard');
    },

    _setupEvents() {
        // Bottom nav
        document.querySelectorAll('.nav-item').forEach(btn => {
            btn.addEventListener('click', () => {
                const page = btn.dataset.page;
                this.navigate(page);
            });
        });

        // FAB
        document.getElementById('fab-add').addEventListener('click', () => {
            this.showAddModal();
        });

        // Back button
        document.getElementById('btn-back').addEventListener('click', () => {
            this.goBack();
        });

        // Search toggle
        document.getElementById('btn-search-toggle').addEventListener('click', () => {
            this.toggleSearch();
        });

        // Search input
        document.getElementById('search-input').addEventListener('input', (e) => {
            this.onSearch(e.target.value);
        });

        // Search clear
        document.getElementById('btn-search-clear').addEventListener('click', () => {
            document.getElementById('search-input').value = '';
            this.onSearch('');
        });

        // Modal close on overlay click
        document.getElementById('modal-overlay').addEventListener('click', (e) => {
            if (e.target === e.currentTarget) {
                this.closeModal();
            }
        });
    },

    // ===== NAVIGATION =====
    navigate(page, id = null) {
        this.currentPage = page;
        const main = document.getElementById('main-content');
        const fab = document.getElementById('fab-add');
        const backBtn = document.getElementById('btn-back');
        const headerTitle = document.getElementById('header-title');
        const searchBtn = document.getElementById('btn-search-toggle');

        // Update nav
        document.querySelectorAll('.nav-item').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.page === page);
        });

        // Reset
        backBtn.classList.add('hidden');
        searchBtn.classList.remove('hidden');
        fab.classList.remove('hidden');
        this.openSeasons.clear();

        switch (page) {
            case 'dashboard':
                headerTitle.textContent = 'SeriesTracker';
                main.innerHTML = UI.renderDashboard(this.items);
                break;

            case 'list':
                headerTitle.textContent = 'Catalogue';
                main.innerHTML = UI.renderList(this.items, this.currentFilter);
                break;

            case 'detail':
                this.currentDetailId = id;
                const item = this.items.find(i => i.id === id);
                headerTitle.textContent = item ? item.title : 'Détail';
                backBtn.classList.remove('hidden');
                fab.classList.add('hidden');
                searchBtn.classList.add('hidden');
                main.innerHTML = UI.renderDetail(item);
                // Auto-open first season
                if (item && item.type === 'series' && item.seasons.length > 0) {
                    this.toggleSeason(1);
                }
                break;

            case 'stats':
                headerTitle.textContent = 'Statistiques';
                fab.classList.add('hidden');
                main.innerHTML = UI.renderStats(this.items);
                break;

            case 'settings':
                headerTitle.textContent = 'Réglages';
                fab.classList.add('hidden');
                searchBtn.classList.add('hidden');
                main.innerHTML = UI.renderSettings();
                break;
        }

        // Close search if open
        document.getElementById('search-bar').classList.add('hidden');

        // Scroll to top
        window.scrollTo(0, 0);
    },

    goBack() {
        this.navigate('list');
    },

    // ===== SEARCH =====
    toggleSearch() {
        const bar = document.getElementById('search-bar');
        bar.classList.toggle('hidden');
        if (!bar.classList.contains('hidden')) {
            document.getElementById('search-input').focus();
        }
    },

    onSearch(query) {
        if (this.currentPage === 'list' || this.currentPage === 'dashboard') {
            if (this.currentPage === 'dashboard' && query) {
                this.currentPage = 'list';
                document.querySelectorAll('.nav-item').forEach(btn => {
                    btn.classList.toggle('active', btn.dataset.page === 'list');
                });
                document.getElementById('header-title').textContent = 'Catalogue';
            }
            const main = document.getElementById('main-content');
            main.innerHTML = UI.renderList(this.items, this.currentFilter, query);
        }
    },

    // ===== FILTERS =====
    setFilter(filter) {
        this.currentFilter = filter;
        const main = document.getElementById('main-content');
        const searchVal = document.getElementById('search-input').value;
        main.innerHTML = UI.renderList(this.items, filter, searchVal);
    },

    // ===== MODAL =====
    showAddModal() {
        const modal = document.getElementById('modal-overlay');
        const content = document.getElementById('modal-content');
        content.innerHTML = UI.renderAddForm();
        modal.classList.remove('hidden');
    },

    async showEditModal(id) {
        const item = this.items.find(i => i.id === id);
        if (!item) return;
        const modal = document.getElementById('modal-overlay');
        const content = document.getElementById('modal-content');
        content.innerHTML = UI.renderAddForm(item);
        modal.classList.remove('hidden');
    },

    closeModal() {
        document.getElementById('modal-overlay').classList.add('hidden');
    },

    // ===== TYPE CHANGE =====
    onTypeChange() {
        const type = document.getElementById('input-type').value;
        const cfg = document.getElementById('seasons-config');
        if (cfg) {
            cfg.classList.toggle('hidden', type === 'movie');
        }
    },

    // ===== SEASON INPUTS =====
    updateSeasonInputs() {
        const count = parseInt(document.getElementById('input-num-seasons').value) || 1;
        const container = document.getElementById('seasons-inputs');
        let html = '';
        for (let i = 1; i <= count; i++) {
            // Try to keep existing value
            const existing = container.querySelector(`[data-season="${i}"]`);
            const val = existing ? existing.value : 10;
            html += `
            <div class="form-group" style="margin-bottom:10px">
                <label class="form-label" style="font-size:0.76rem">Saison ${i} — Nombre d'épisodes</label>
                <input type="number" class="form-input season-ep-count" min="1" max="100" value="${val}" data-season="${i}">
            </div>`;
        }
        container.innerHTML = html;
    },

    // ===== AUTOFILL FROM API =====
    async autoFill() {
        const titleInput = document.getElementById('input-title');
        const type = document.getElementById('input-type').value;
        const title = titleInput.value.trim();
        
        if (!title) {
            UI.showToast('⚠️ Entrez un titre d\\'abord');
            return;
        }

        UI.showToast('🔍 Recherche en cours...');

        try {
            if (type === 'series') {
                // TVMaze API
                const res = await fetch(`https://api.tvmaze.com/search/shows?q=${encodeURIComponent(title)}`);
                const data = await res.json();
                if (!data || data.length === 0) {
                    UI.showToast('❌ Série introuvable');
                    return;
                }
                const best = data[0].show;
                
                // Fetch full info for episodes/seasons
                const epRes = await fetch(`https://api.tvmaze.com/shows/${best.id}?embed=episodes`);
                const epData = await epRes.json();
                
                document.getElementById('input-title').value = best.name;
                if (best.image && best.image.original) {
                    document.getElementById('input-poster').value = best.image.original;
                }
                if (best.genres && best.genres.length > 0) {
                    const genreMap = { 'Action': 'Action', 'Adventure': 'Aventure', 'Anime': 'Animation', 'Comedy': 'Comédie', 'Crime': 'Crime', 'Documentary': 'Documentaire', 'Drama': 'Drame', 'Fantasy': 'Fantastique', 'Horror': 'Horreur', 'Romance': 'Romance', 'Science-Fiction': 'Sci-Fi', 'Thriller': 'Thriller' };
                    // Default to first genre if mapping exists
                    const translated = genreMap[best.genres[0]];
                    if (translated) {
                        document.getElementById('input-genre').value = translated;
                    }
                }
                if (best.premiered) {
                    document.getElementById('input-year').value = best.premiered.substring(0, 4);
                }
                if (best.summary) {
                    let text = best.summary.replace(/<[^>]*>?/gm, ''); // remove html tags
                    document.getElementById('input-notes').value = text;
                }

                // Seasons and episodes
                if (epData._embedded && epData._embedded.episodes) {
                    const episodes = epData._embedded.episodes;
                    const seasonsMap = {};
                    episodes.forEach(ep => {
                        // ignore special seasons which are often 0
                        if (ep.season > 0) {
                            if (!seasonsMap[ep.season]) seasonsMap[ep.season] = 0;
                            seasonsMap[ep.season]++;
                        }
                    });
                    
                    const seasonNumbers = Object.keys(seasonsMap).map(Number).sort((a,b)=>a-b);
                    if (seasonNumbers.length > 0) {
                        const numSeasons = seasonNumbers.length;
                        document.getElementById('input-num-seasons').value = numSeasons;
                        this.updateSeasonInputs();
                        
                        // Set number of episodes per season after DOM updates
                        setTimeout(() => {
                            for (let i = 0; i < numSeasons; i++) {
                                const epCountInput = document.querySelector(`.season-ep-count[data-season="${i+1}"]`);
                                if (epCountInput) {
                                    epCountInput.value = seasonsMap[seasonNumbers[i]];
                                }
                            }
                        }, 50);
                    }
                }
                
                UI.showToast('✅ Données récupérées !');
            } else {
                // iTunes API
                const res = await fetch(`https://itunes.apple.com/search?entity=movie&term=${encodeURIComponent(title)}&limit=1`);
                const data = await res.json();
                
                if (!data || data.resultCount === 0) {
                    UI.showToast('❌ Film introuvable');
                    return;
                }
                const best = data.results[0];
                
                document.getElementById('input-title').value = best.trackName;
                if (best.artworkUrl100) {
                    document.getElementById('input-poster').value = best.artworkUrl100.replace('100x100bb', '600x600bb');
                }
                if (best.releaseDate) {
                    document.getElementById('input-year').value = best.releaseDate.substring(0, 4);
                }
                if (best.longDescription) {
                    document.getElementById('input-notes').value = best.longDescription;
                }
                UI.showToast('✅ Données récupérées !');
            }
        } catch (e) {
            UI.showToast('❌ Erreur de réseau');
            console.error(e);
        }
    },

    // ===== FORM SUBMIT =====
    async submitForm(editId) {
        const type = document.getElementById('input-type').value;
        const title = document.getElementById('input-title').value.trim();
        const posterUrl = document.getElementById('input-poster').value.trim();
        const genre = document.getElementById('input-genre').value;
        const year = document.getElementById('input-year').value;
        const notes = document.getElementById('input-notes').value.trim();

        if (!title) {
            UI.showToast('⚠️ Le titre est obligatoire');
            return;
        }

        if (editId) {
            // Update existing
            const item = this.items.find(i => i.id === editId);
            if (!item) return;

            item.title = title;
            item.posterUrl = posterUrl;
            item.genre = genre;
            item.year = year;
            item.notes = notes;

            // If series, update seasons structure
            if (type === 'series') {
                const numSeasons = parseInt(document.getElementById('input-num-seasons').value) || 1;
                const epCounts = document.querySelectorAll('.season-ep-count');

                // Grow or shrink seasons array
                while (item.seasons.length < numSeasons) {
                    const sNum = item.seasons.length + 1;
                    const epCount = epCounts[sNum - 1] ? parseInt(epCounts[sNum - 1].value) || 10 : 10;
                    const episodes = [];
                    for (let e = 0; e < epCount; e++) {
                        episodes.push({ number: e + 1, title: '', watched: false, rating: 0 });
                    }
                    item.seasons.push({ number: sNum, episodes });
                }
                item.seasons.length = numSeasons;

                // Update episode counts per season
                for (let s = 0; s < numSeasons; s++) {
                    const epCount = epCounts[s] ? parseInt(epCounts[s].value) || 10 : 10;
                    const season = item.seasons[s];
                    season.number = s + 1;

                    while (season.episodes.length < epCount) {
                        season.episodes.push({
                            number: season.episodes.length + 1,
                            title: '',
                            watched: false,
                            rating: 0
                        });
                    }
                    season.episodes.length = epCount;
                    // Renumber
                    season.episodes.forEach((ep, i) => ep.number = i + 1);
                }
            }

            await db.update(item);
            UI.showToast('✅ Modifié avec succès');
        } else {
            // Create new
            let item;
            if (type === 'series') {
                const numSeasons = parseInt(document.getElementById('input-num-seasons').value) || 1;
                const epCounts = document.querySelectorAll('.season-ep-count');
                const seasons = [];
                for (let i = 0; i < numSeasons; i++) {
                    seasons.push(epCounts[i] ? parseInt(epCounts[i].value) || 10 : 10);
                }
                item = Database.createSeries({ title, posterUrl, genre, year, seasons, notes });
            } else {
                item = Database.createMovie({ title, posterUrl, genre, year, notes });
            }
            await db.add(item);
            UI.showToast('✅ Ajouté avec succès');
        }

        // Refresh data
        this.items = await db.getAll();
        this.closeModal();

        // Re-render current view
        if (this.currentPage === 'detail' && editId) {
            this.navigate('detail', editId);
        } else {
            this.navigate(this.currentPage);
        }
    },

    // ===== TOGGLE SEASON =====
    toggleSeason(num) {
        const el = document.getElementById(`episodes-s${num}`);
        const toggle = document.getElementById(`toggle-s${num}`);
        if (!el) return;

        if (this.openSeasons.has(num)) {
            this.openSeasons.delete(num);
            el.classList.remove('open');
            toggle.classList.remove('open');
        } else {
            this.openSeasons.add(num);
            el.classList.add('open');
            toggle.classList.add('open');
        }
    },

    // ===== TOGGLE EPISODE =====
    async toggleEpisode(itemId, seasonNum, epNum) {
        const item = this.items.find(i => i.id === itemId);
        if (!item) return;

        const season = item.seasons.find(s => s.number === seasonNum);
        if (!season) return;

        const ep = season.episodes.find(e => e.number === epNum);
        if (!ep) return;

        ep.watched = !ep.watched;

        // Auto update status
        const prog = Database.getSeriesProgress(item);
        if (prog.percent === 100) item.status = 'completed';
        else if (prog.watched > 0) item.status = 'watching';
        else item.status = 'plantowatch';

        await db.update(item);
        this.items = await db.getAll();

        // Re-render detail
        this.navigate('detail', itemId);
        // Re-open seasons
        const toOpen = [...this.openSeasons];
        toOpen.forEach(s => this.toggleSeason(s));
        // Always keep current season open
        if (!this.openSeasons.has(seasonNum)) {
            this.toggleSeason(seasonNum);
        }
    },

    // ===== MARK ALL SEASON =====
    async markAllSeason(itemId, seasonNum) {
        const item = this.items.find(i => i.id === itemId);
        if (!item) return;

        const season = item.seasons.find(s => s.number === seasonNum);
        if (!season) return;

        const allWatched = season.episodes.every(e => e.watched);
        season.episodes.forEach(e => e.watched = !allWatched);

        // Auto update status
        const prog = Database.getSeriesProgress(item);
        if (prog.percent === 100) item.status = 'completed';
        else if (prog.watched > 0) item.status = 'watching';
        else item.status = 'plantowatch';

        await db.update(item);
        this.items = await db.getAll();
        this.navigate('detail', itemId);
        this.toggleSeason(seasonNum);
    },

    // ===== RATE EPISODE =====
    async rateEpisode(itemId, seasonNum, epNum, rating) {
        const item = this.items.find(i => i.id === itemId);
        if (!item) return;

        const season = item.seasons.find(s => s.number === seasonNum);
        if (!season) return;

        const ep = season.episodes.find(e => e.number === epNum);
        if (!ep) return;

        ep.rating = ep.rating === rating ? 0 : rating;
        await db.update(item);
        this.items = await db.getAll();

        // Just re-render detail
        const openS = [...this.openSeasons];
        this.navigate('detail', itemId);
        openS.forEach(s => this.toggleSeason(s));
    },

    // ===== STAR CLICK (main rating) =====
    async handleStarClick(rating, itemId) {
        const item = this.items.find(i => i.id === itemId);
        if (!item) return;

        item.rating = item.rating === rating ? 0 : rating;
        await db.update(item);
        this.items = await db.getAll();

        const openS = [...this.openSeasons];
        this.navigate('detail', itemId);
        openS.forEach(s => this.toggleSeason(s));
    },

    // ===== TOGGLE MOVIE WATCHED =====
    async toggleMovieWatched(itemId) {
        const item = this.items.find(i => i.id === itemId);
        if (!item || item.type !== 'movie') return;

        item.watched = !item.watched;
        item.status = item.watched ? 'completed' : 'plantowatch';
        await db.update(item);
        this.items = await db.getAll();
        this.navigate('detail', itemId);
        UI.showToast(item.watched ? '✅ Marqué comme vu' : '↩️ Marqué comme non vu');
    },

    // ===== DELETE =====
    confirmDelete(itemId) {
        const item = this.items.find(i => i.id === itemId);
        if (!item) return;

        const modal = document.getElementById('modal-overlay');
        const content = document.getElementById('modal-content');
        content.innerHTML = UI.renderConfirmDialog(
            '🗑️ Supprimer',
            `Voulez-vous vraiment supprimer "${item.title}" ? Cette action est irréversible.`,
            `App.deleteItem('${itemId}')`
        );
        modal.classList.remove('hidden');
    },

    async deleteItem(itemId) {
        await db.delete(itemId);
        this.items = await db.getAll();
        this.closeModal();
        this.navigate('list');
        UI.showToast('🗑️ Supprimé');
    },

    // ===== CLEAR ALL =====
    confirmClearAll() {
        const modal = document.getElementById('modal-overlay');
        const content = document.getElementById('modal-content');
        content.innerHTML = UI.renderConfirmDialog(
            '⚠️ Supprimer toutes les données',
            'Toutes vos séries, films et notes seront définitivement supprimés.',
            'App.clearAll()'
        );
        modal.classList.remove('hidden');
    },

    async clearAll() {
        await db.clearAll();
        this.items = [];
        this.closeModal();
        this.navigate('dashboard');
        UI.showToast('🗑️ Toutes les données supprimées');
    },

    // ===== EXPORT =====
    async exportData() {
        const data = JSON.stringify(this.items, null, 2);
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `seriestracker-backup-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
        UI.showToast('📦 Export téléchargé');
    },

    // ===== IMPORT =====
    async importData(event) {
        const file = event.target.files[0];
        if (!file) return;

        try {
            const text = await file.text();
            const data = JSON.parse(text);
            if (!Array.isArray(data)) throw new Error('Invalid');

            for (const item of data) {
                // Check if already exists
                const existing = await db.getById(item.id);
                if (existing) {
                    await db.update(item);
                } else {
                    await db.add(item);
                }
            }

            this.items = await db.getAll();
            this.navigate(this.currentPage);
            UI.showToast(`📥 ${data.length} éléments importés`);
        } catch (err) {
            UI.showToast('❌ Erreur lors de l\'import');
        }

        // Reset file input
        event.target.value = '';
    }
};

// ===== BOOT =====
document.addEventListener('DOMContentLoaded', () => App.init());

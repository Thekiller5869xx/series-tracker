/* ===== App Controller ===== */

const App = {
    currentPage: 'dashboard',
    currentFilter: 'all',
    currentDetailId: null,
    items: [],
    openSeasons: new Set(),
    tempCast: [],
    tempEpisodes: [],

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
        
        // Only clear open seasons if we are changing pages OR selecting a NEW detail item
        if (page !== 'detail' || this.currentDetailId !== id) {
            this.openSeasons.clear();
        }

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
                // Auto-open first season only if none are open
                if (item && item.type === 'series' && item.seasons.length > 0 && this.openSeasons.size === 0) {
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
        this.tempCast = [];
        content.innerHTML = UI.renderAddForm();
        modal.classList.remove('hidden');
    },

    async showEditModal(id) {
        const item = this.items.find(i => i.id === id);
        if (!item) return;
        const modal = document.getElementById('modal-overlay');
        const content = document.getElementById('modal-content');
        this.tempCast = item.cast || [];
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
            UI.showToast("⚠️ Entrez un titre d'abord");
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
                const epRes = await fetch(`https://api.tvmaze.com/shows/${best.id}?embed[]=episodes&embed[]=cast`);
                const epData = await epRes.json();
                
                // Try to get French info from iTunes as a supplement
                let mainTitle = best.name;
                let mainNotes = best.summary ? best.summary.replace(/<[^>]*>?/gm, '') : '';
                
                try {
                    // Try tvShow first, then tvSeason if failed
                    let itunesRes = await fetch(`https://itunes.apple.com/search?entity=tvShow&term=${encodeURIComponent(title)}&limit=1&lang=fr_fr&country=fr`);
                    let itunesData = await itunesRes.json();
                    
                    if (itunesData.resultCount === 0) {
                        itunesRes = await fetch(`https://itunes.apple.com/search?entity=tvSeason&term=${encodeURIComponent(title)}&limit=1&lang=fr_fr&country=fr`);
                        itunesData = await itunesRes.json();
                    }

                    if (itunesData.resultCount > 0) {
                        const fr = itunesData.results[0];
                        mainTitle = fr.collectionName || fr.artistName || fr.trackName || best.name;
                        if (fr.longDescription) mainNotes = fr.longDescription;
                        else if (fr.description) mainNotes = fr.description;
                    }
                } catch (e) {}

                document.getElementById('input-title').value = mainTitle;
                document.getElementById('input-notes').value = mainNotes;
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
                // (Notes already filled by iTunes logic above)

                // CAST
                this.tempCast = [];
                if (epData._embedded && epData._embedded.cast) {
                    this.tempCast = epData._embedded.cast.map(c => ({
                        name: c.person.name,
                        character: c.character.name,
                        image: c.person.image ? c.person.image.medium : null
                    }));
                }

                // EPISODES DATA
                this.tempEpisodes = [];
                if (epData._embedded && epData._embedded.episodes) {
                    this.tempEpisodes = epData._embedded.episodes.map(e => ({
                        season: e.season,
                        number: e.number,
                        title: e.name,
                        summary: e.summary ? e.summary.replace(/<[^>]*>?/gm, '') : '',
                        image: e.image ? e.image.medium : null
                    }));

                    // TRY TO FETCH FRENCH TITLES/SUMMARIES FROM ITUNES
                    try {
                        const itunesEpRes = await fetch(`https://itunes.apple.com/search?entity=tvEpisode&term=${encodeURIComponent(title)}&limit=200&lang=fr_fr&country=fr`);
                        const itunesEpData = await itunesEpRes.json();
                        
                        if (itunesEpData.resultCount > 0) {
                            itunesEpData.results.forEach(itEp => {
                                const s = itEp.collectionNumber || 1; // Season
                                const e = itEp.trackNumber; // Episode
                                
                                const target = this.tempEpisodes.find(te => te.season === s && te.number === e);
                                if (target) {
                                    if (itEp.trackName) target.title = itEp.trackName;
                                    if (itEp.longDescription) target.summary = itEp.longDescription;
                                }
                            });
                        }
                    } catch (e) {
                        console.error("iTunes episodes fetch failed", e);
                    }
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
                // iTunes API (Movies)
                const res = await fetch(`https://itunes.apple.com/search?entity=movie&term=${encodeURIComponent(title)}&limit=1&lang=fr_fr&country=fr`);
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

                // Since iTunes doesn't give cast easily, we'll try to find it on TVMaze (which sometimes has movie info or actors)
                // but for now, let's just clear cast for movies from iTunes or add a note.
                this.tempCast = [];
                
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
            item.cast = this.tempCast;
            
            // If series, update seasons structure and titles/summaries
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
                    // Renumber and attach auto-fill data
                    season.episodes.forEach((ep, i) => {
                        ep.number = i + 1;
                        if (this.tempEpisodes.length > 0) {
                            const info = this.tempEpisodes.find(te => te.season === season.number && te.number === ep.number);
                            if (info) {
                                ep.title = info.title;
                                ep.summary = info.summary;
                                ep.image = info.image;
                            }
                        }
                    });
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
                item = Database.createSeries({ title, posterUrl, genre, year, seasons, notes, cast: this.tempCast });
                
                // Attach episode info
                if (this.tempEpisodes.length > 0) {
                    item.seasons.forEach(s => {
                        s.episodes.forEach(ep => {
                            const info = this.tempEpisodes.find(te => te.season === s.number && te.number === ep.number);
                            if (info) {
                                ep.title = info.title;
                                ep.summary = info.summary;
                                ep.image = info.image;
                            }
                        });
                    });
                }
            } else {
                item = Database.createMovie({ title, posterUrl, genre, year, notes, cast: this.tempCast });
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

        const wasWatched = ep.watched;
        ep.watched = !wasWatched;

        // SKIP EPISODE LOGIC
        if (!wasWatched) { // if marking as watched
            const skipped = [];
            for (let i = 0; i < epNum - 1; i++) {
                if (!season.episodes[i].watched) {
                    skipped.push(season.episodes[i]);
                }
            }

            if (skipped.length > 0) {
                const modal = document.getElementById('modal-overlay');
                const content = document.getElementById('modal-content');
                const list = skipped.map(e => e.number).join(', ');
                
                content.innerHTML = `
                    <div class="modal-handle"></div>
                    <div class="confirm-dialog">
                        <h3>⏯️ Épisodes précédents</h3>
                        <p>Voulez-vous aussi marquer les épisodes précédents (${list}) comme vus ?</p>
                        <div class="confirm-actions">
                            <button class="btn-cancel" onclick="App.navigate('detail', '${itemId}'); App.closeModal();">Non</button>
                            <button class="btn-confirm" onclick="App.markSkippedWatched('${itemId}', ${seasonNum}, ${epNum})">Oui, tout marquer</button>
                        </div>
                    </div>
                `;
                modal.classList.remove('hidden');
                
                // We still save the current episode first
                await db.update(item);
                this.items = await db.getAll();
                return; // Wait for user decision
            }
        }

        // Auto update status
        const prog = Database.getSeriesProgress(item);
        if (prog.percent === 100) item.status = 'completed';
        else if (prog.watched > 0) item.status = 'watching';
        else item.status = 'plantowatch';

        await db.update(item);
        this.items = await db.getAll();

        // Re-render detail
        this.navigate('detail', itemId);
        // Re-open seasons - fix for toggle logic
        const toOpen = [...this.openSeasons];
        toOpen.forEach(s => {
            const el = document.getElementById(`episodes-s${s}`);
            const toggle = document.getElementById(`toggle-s${s}`);
            if (el && toggle) {
                el.classList.add('open');
                toggle.classList.add('open');
            }
        });
        // Always keep current season open
        if (!this.openSeasons.has(seasonNum)) {
            this.toggleSeason(seasonNum);
        }
    },

    async markSkippedWatched(itemId, seasonNum, epNum) {
        const item = this.items.find(i => i.id === itemId);
        if (!item) return;
        const season = item.seasons.find(s => s.number === seasonNum);
        if (!season) return;

        for (let i = 0; i < epNum - 1; i++) {
            season.episodes[i].watched = true;
        }

        await db.update(item);
        this.items = await db.getAll();
        this.closeModal();
        this.navigate('detail', itemId);
        this.toggleSeason(seasonNum);
    },

    // ===== EPISODE INFO =====
    showEpisodeInfo(itemId, seasonNum, epNum) {
        const item = this.items.find(i => i.id === itemId);
        if (!item) return;
        const season = item.seasons.find(s => s.number === seasonNum);
        if (!season) return;
        const ep = season.episodes.find(e => e.number === epNum);
        if (!ep) return;

        const modal = document.getElementById('modal-overlay');
        const content = document.getElementById('modal-content');

        content.innerHTML = `
            <div class="modal-handle"></div>
            <div class="ep-info-modal">
                <div class="ep-info-header" style="${ep.image ? `background-image: url('${ep.image}')` : ''}">
                    ${!ep.image ? '📺' : ''}
                </div>
                <div class="ep-info-body">
                    <span class="ep-info-tag">Saison ${seasonNum} · Épisode ${epNum}</span>
                    <h3 class="ep-info-title">${ep.title || 'Sans titre'}</h3>
                    <p class="ep-info-summary">${ep.summary || 'Aucun résumé disponible pour le moment.'}</p>
                    <button class="form-submit" onclick="App.closeModal()" style="margin-top: 20px">Fermer</button>
                </div>
            </div>
        `;
        modal.classList.remove('hidden');
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
        
        // Re-open
        const toOpen = [...this.openSeasons];
        toOpen.forEach(s => {
            const el = document.getElementById(`episodes-s${s}`);
            const toggle = document.getElementById(`toggle-s${s}`);
            if (el && toggle) {
                el.classList.add('open');
                toggle.classList.add('open');
            }
        });
        
        if (!this.openSeasons.has(seasonNum)) {
            this.toggleSeason(seasonNum);
        }
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
        const toOpen = [...this.openSeasons];
        this.navigate('detail', itemId);
        toOpen.forEach(s => {
            const el = document.getElementById(`episodes-s${s}`);
            const toggle = document.getElementById(`toggle-s${s}`);
            if (el && toggle) {
                el.classList.add('open');
                toggle.classList.add('open');
            }
        });
    },

    // ===== STAR CLICK (main rating) =====
    async handleStarClick(rating, itemId) {
        const item = this.items.find(i => i.id === itemId);
        if (!item) return;

        item.rating = item.rating === rating ? 0 : rating;
        await db.update(item);
        this.items = await db.getAll();

        const toOpen = [...this.openSeasons];
        this.navigate('detail', itemId);
        toOpen.forEach(s => {
            const el = document.getElementById(`episodes-s${s}`);
            const toggle = document.getElementById(`toggle-s${s}`);
            if (el && toggle) {
                el.classList.add('open');
                toggle.classList.add('open');
            }
        });
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

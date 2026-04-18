/* ===== UI Rendering Functions ===== */

const UI = {
    // ===== ICONS =====
    icons: {
        check: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
        chevronDown: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>',
        edit: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>',
        trash: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>',
        film: '🎬',
        series: '📺',
        star: '★',
        starEmpty: '☆',
        popcorn: '🍿',
        trophy: '🏆',
        chart: '📊',
        clock: '⏳'
    },

    // ===== STARS COMPONENT =====
    renderStars(rating, size = 'normal', clickable = false, dataAttr = '') {
        let html = '<div class="stars">';
        for (let i = 1; i <= 5; i++) {
            const cls = i <= rating ? 'filled' : 'empty';
            const sizeClass = size === 'mini' ? 'star-mini' : 'star';
            const clickData = clickable ? `onclick="App.handleStarClick(${i}, ${dataAttr})" ` : '';
            html += `<span class="${sizeClass} ${cls}" ${clickData}>${i <= rating ? '★' : '☆'}</span>`;
        }
        html += '</div>';
        return html;
    },

    // ===== POSTER BACKGROUND =====
    posterStyle(url) {
        if (!url) return '';
        return `background-image: url('${url}');`;
    },

    posterPlaceholder(type) {
        return `<div class="poster-placeholder">${type === 'series' ? '📺' : '🎬'}</div>`;
    },

    // ===== DASHBOARD =====
    renderDashboard(items) {
        const stats = Database.getGlobalStats(items);
        const inProgress = items.filter(i => {
            if (i.type === 'series') {
                const p = Database.getSeriesProgress(i);
                return p.watched > 0 && p.percent < 100;
            }
            return false;
        });
        const recent = [...items].sort((a, b) => (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt)).slice(0, 10);

        let html = `
        <div class="page-enter">
            <div class="dashboard-greeting">
                <h2>📺 SeriesTracker</h2>
                <p>Votre bibliothèque de séries & films</p>
            </div>

            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-value">${stats.totalSeries}</div>
                    <div class="stat-label">Séries</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${stats.totalMovies}</div>
                    <div class="stat-label">Films</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${stats.watchedEpisodes}</div>
                    <div class="stat-label">Épisodes vus</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${stats.avgRating}</div>
                    <div class="stat-label">Note moyenne</div>
                </div>
            </div>`;

        if (inProgress.length > 0) {
            html += `
            <div class="section-header">
                <h3>▶️ En cours</h3>
            </div>
            <div class="media-scroll">
                ${inProgress.map(item => this._renderSmallCard(item)).join('')}
            </div>
            <div style="margin-bottom: 24px"></div>`;
        }

        if (recent.length > 0) {
            html += `
            <div class="section-header">
                <h3>🕐 Récemment ajoutés</h3>
                <button onclick="App.navigate('list')">Voir tout</button>
            </div>
            <div class="media-scroll">
                ${recent.map(item => this._renderSmallCard(item)).join('')}
            </div>`;
        }

        if (items.length === 0) {
            html += `
            <div class="empty-state">
                <div class="empty-icon">🍿</div>
                <h3>Votre collection est vide</h3>
                <p>Ajoutez votre première série ou film pour commencer le tracking !</p>
                <button onclick="App.showAddModal()">+ Ajouter</button>
            </div>`;
        }

        html += '</div>';
        return html;
    },

    _renderSmallCard(item) {
        const isSeries = item.type === 'series';
        let progressHtml = '';
        let metaText = '';

        if (isSeries) {
            const p = Database.getSeriesProgress(item);
            progressHtml = `<div class="progress-mini"><div class="progress-mini-fill" style="width:${p.percent}%"></div></div>`;
            metaText = `${p.watched}/${p.total} épisodes`;
        } else {
            metaText = item.watched ? '✅ Vu' : '⏳ À voir';
        }

        return `
        <div class="media-card-sm" onclick="App.navigate('detail', '${item.id}')">
            <div class="poster-sm" style="${this.posterStyle(item.posterUrl)}">
                ${!item.posterUrl ? `<div class="poster-placeholder" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:2rem;color:var(--text-muted)">${isSeries ? '📺' : '🎬'}</div>` : ''}
                <span class="type-badge">${isSeries ? 'Série' : 'Film'}</span>
                ${progressHtml}
            </div>
            <div class="title-sm">${item.title}</div>
            <div class="meta-sm">${metaText}</div>
        </div>`;
    },

    // ===== LIST VIEW =====
    renderList(items, filter = 'all', search = '') {
        let filtered = [...items];

        // Search
        if (search) {
            const q = search.toLowerCase();
            filtered = filtered.filter(i => i.title.toLowerCase().includes(q));
        }

        // Filter
        if (filter === 'series') filtered = filtered.filter(i => i.type === 'series');
        else if (filter === 'movies') filtered = filtered.filter(i => i.type === 'movie');
        else if (filter === 'watching') filtered = filtered.filter(i => {
            if (i.type === 'series') {
                const p = Database.getSeriesProgress(i);
                return p.watched > 0 && p.percent < 100;
            }
            return false;
        });
        else if (filter === 'completed') filtered = filtered.filter(i => {
            if (i.type === 'series') return Database.getSeriesProgress(i).percent === 100;
            return i.watched;
        });
        else if (filter === 'plantowatch') filtered = filtered.filter(i => {
            if (i.type === 'series') return Database.getSeriesProgress(i).watched === 0;
            return !i.watched;
        });

        // Sort by updated
        filtered.sort((a, b) => (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt));

        let html = '<div class="page-enter">';

        // Filters
        html += `
        <div class="filter-bar">
            <button class="filter-chip ${filter === 'all' ? 'active' : ''}" onclick="App.setFilter('all')">Tout</button>
            <button class="filter-chip ${filter === 'series' ? 'active' : ''}" onclick="App.setFilter('series')">Séries</button>
            <button class="filter-chip ${filter === 'movies' ? 'active' : ''}" onclick="App.setFilter('movies')">Films</button>
            <button class="filter-chip ${filter === 'watching' ? 'active' : ''}" onclick="App.setFilter('watching')">En cours</button>
            <button class="filter-chip ${filter === 'completed' ? 'active' : ''}" onclick="App.setFilter('completed')">Terminé</button>
            <button class="filter-chip ${filter === 'plantowatch' ? 'active' : ''}" onclick="App.setFilter('plantowatch')">À voir</button>
        </div>`;

        if (filtered.length === 0) {
            html += `
            <div class="empty-state">
                <div class="empty-icon">${search ? '🔍' : '📭'}</div>
                <h3>${search ? 'Aucun résultat' : 'Rien ici'}</h3>
                <p>${search ? 'Essayez un autre terme de recherche' : 'Ajoutez du contenu pour remplir cette section !'}</p>
                ${!search ? '<button onclick="App.showAddModal()">+ Ajouter</button>' : ''}
            </div>`;
        } else {
            html += '<div class="media-grid">';
            filtered.forEach((item, i) => {
                html += this._renderGridCard(item, i);
            });
            html += '</div>';
        }

        html += '</div>';
        return html;
    },

    _renderGridCard(item, index) {
        const isSeries = item.type === 'series';
        let progressHtml = '';
        let statusClass = '';
        let metaText = '';

        if (isSeries) {
            const p = Database.getSeriesProgress(item);
            progressHtml = `<div class="progress-bar-mini"><div class="progress-fill-mini" style="width:${p.percent}%"></div></div>`;
            metaText = `${item.seasons.length} saison${item.seasons.length > 1 ? 's' : ''} · ${p.percent}%`;
            if (p.percent === 100) statusClass = 'completed';
            else if (p.watched > 0) statusClass = 'watching';
            else statusClass = 'plantowatch';
        } else {
            metaText = item.year || (item.watched ? 'Vu' : 'À voir');
            statusClass = item.watched ? 'completed' : 'plantowatch';
        }

        return `
        <div class="media-card" style="animation-delay: ${index * 0.05}s" onclick="App.navigate('detail', '${item.id}')">
            <div class="poster" style="${this.posterStyle(item.posterUrl)}">
                ${!item.posterUrl ? this.posterPlaceholder(item.type) : ''}
                ${item.rating > 0 ? `<div class="rating-badge">★ ${item.rating}</div>` : ''}
                <span class="type-badge">${isSeries ? 'Série' : 'Film'}</span>
                ${progressHtml}
                <div class="status-dot ${statusClass}"></div>
            </div>
            <div class="card-title">${item.title}</div>
            <div class="card-meta">${metaText}</div>
        </div>`;
    },

    // ===== DETAIL VIEW =====
    renderDetail(item) {
        if (!item) return '<div class="empty-state"><h3>Introuvable</h3></div>';

        const isSeries = item.type === 'series';
        let html = '<div class="page-enter">';

        // Hero
        html += `
        <div class="detail-hero">
            <div class="detail-header">
                <div class="detail-poster" style="${this.posterStyle(item.posterUrl)}">
                    ${!item.posterUrl ? `<div class="poster-placeholder">${isSeries ? '📺' : '🎬'}</div>` : ''}
                </div>
                <div class="detail-info">
                    <h2>${item.title}</h2>
                    <div class="detail-tags">
                        <span class="detail-tag">${isSeries ? '📺 Série' : '🎬 Film'}</span>
                        ${item.genre ? `<span class="detail-tag">${item.genre}</span>` : ''}
                        ${item.year ? `<span class="detail-tag">${item.year}</span>` : ''}
                    </div>
                    <div class="detail-rating" id="detail-rating">
                        ${this.renderStars(item.rating, 'normal', true, `'${item.id}'`)}
                    </div>
                </div>
            </div>

            <div class="detail-actions">
                ${isSeries ? '' : `
                    <button class="detail-btn primary" onclick="App.toggleMovieWatched('${item.id}')">
                        ${item.watched ? '✅ Vu' : '👁️ Marquer comme vu'}
                    </button>
                `}
                <button class="detail-btn secondary" onclick="App.showEditModal('${item.id}')">
                    ${this.icons.edit} Modifier
                </button>
                <button class="detail-btn danger" onclick="App.confirmDelete('${item.id}')">
                    ${this.icons.trash}
                </button>
            </div>
        </div>`;

        // Notes
        if (item.notes) {
            html += `
            <div style="margin-top:16px;padding:14px 16px;background:var(--bg-glass);border:1px solid var(--border);border-radius:var(--radius-md)">
                <div style="font-size:0.78rem;font-weight:600;color:var(--text-secondary);margin-bottom:6px">📝 Notes</div>
                <div style="font-size:0.88rem;line-height:1.5;color:var(--text-primary)">${item.notes}</div>
            </div>`;
        }

        // Series progress + episodes
        if (isSeries) {
            const p = Database.getSeriesProgress(item);

            html += `
            <div class="progress-section">
                <div class="progress-header">
                    <span>Progression</span>
                    <strong>${p.watched}/${p.total} (${p.percent}%)</strong>
                </div>
                <div class="progress-track">
                    <div class="progress-fill" style="width:${p.percent}%"></div>
                </div>
            </div>

            <div class="seasons-list">`;

            for (const season of item.seasons) {
                const sWatched = season.episodes.filter(e => e.watched).length;
                const sTotal = season.episodes.length;
                const sPercent = sTotal > 0 ? Math.round((sWatched / sTotal) * 100) : 0;

                html += `
                <div class="season-card">
                    <div class="season-header" onclick="App.toggleSeason(${season.number})">
                        <div class="season-header-left">
                            <h4>Saison ${season.number}</h4>
                            <span class="season-count">${sWatched}/${sTotal}</span>
                        </div>
                        <span class="season-toggle" id="toggle-s${season.number}">${this.icons.chevronDown}</span>
                    </div>
                    <div class="season-episodes" id="episodes-s${season.number}">
                        <button class="season-mark-all" onclick="App.markAllSeason('${item.id}', ${season.number})">
                            ${sWatched === sTotal ? '↩️ Tout décocher' : '✅ Tout marquer comme vu'}
                        </button>`;

                for (const ep of season.episodes) {
                    html += `
                        <div class="episode-item ${ep.watched ? 'watched' : ''}">
                            <div class="episode-checkbox ${ep.watched ? 'checked' : ''}" onclick="App.toggleEpisode('${item.id}', ${season.number}, ${ep.number})">
                                ${this.icons.check}
                            </div>
                            <div class="episode-info">
                                <div class="ep-num">Épisode ${ep.number}</div>
                                ${ep.title ? `<div class="ep-title">${ep.title}</div>` : ''}
                            </div>
                            <div class="episode-rating">
                                ${this._renderMiniStars(ep.rating, item.id, season.number, ep.number)}
                            </div>
                        </div>`;
                }

                html += `
                    </div>
                </div>`;
            }

            html += '</div>';
        }

        html += '</div>';
        return html;
    },

    _renderMiniStars(rating, itemId, seasonNum, epNum) {
        let html = '';
        for (let i = 1; i <= 5; i++) {
            const cls = i <= rating ? 'filled' : 'empty';
            html += `<span class="star-mini ${cls}" onclick="App.rateEpisode('${itemId}', ${seasonNum}, ${epNum}, ${i})">${i <= rating ? '★' : '☆'}</span>`;
        }
        return html;
    },

    // ===== ADD/EDIT FORM =====
    renderAddForm(editItem = null) {
        const isEdit = !!editItem;
        const type = editItem ? editItem.type : 'series';
        const title = editItem ? editItem.title : '';
        const posterUrl = editItem ? editItem.posterUrl : '';
        const genre = editItem ? editItem.genre : '';
        const year = editItem ? editItem.year : '';
        const notes = editItem ? editItem.notes : '';

        let seasonsHtml = '';
        if (!isEdit || type === 'series') {
            const numSeasons = editItem ? editItem.seasons.length : 1;
            seasonsHtml = `
            <div id="seasons-config" class="${type === 'movie' ? 'hidden' : ''}">
                <div class="form-group">
                    <label class="form-label">Nombre de saisons</label>
                    <input type="number" class="form-input" id="input-num-seasons" min="1" max="50" value="${numSeasons}" onchange="App.updateSeasonInputs()">
                </div>
                <div id="seasons-inputs">
                    ${this._renderSeasonInputs(editItem)}
                </div>
            </div>`;
        }

        return `
        <div class="modal-handle"></div>
        <div class="form-container">
            <h3 class="form-title">${isEdit ? '✏️ Modifier' : '➕ Ajouter'}</h3>

            <div class="form-group">
                <label class="form-label">Type</label>
                <select class="form-input" id="input-type" onchange="App.onTypeChange()" ${isEdit ? 'disabled' : ''}>
                    <option value="series" ${type === 'series' ? 'selected' : ''}>📺 Série</option>
                    <option value="movie" ${type === 'movie' ? 'selected' : ''}>🎬 Film</option>
                </select>
            </div>

            <div class="form-group">
                <label class="form-label">Titre *</label>
                <div style="display:flex;gap:8px">
                    <input type="text" class="form-input" id="input-title" placeholder="Ex: Breaking Bad" value="${title}" style="flex:1">
                    <button type="button" onclick="App.autoFill()" style="padding:0 12px;background:var(--bg-glass-strong);border:1px solid var(--border);border-radius:var(--radius-md);color:var(--accent-light);transition:transform 0.1s" onmousedown="this.style.transform='scale(0.95)'" onmouseup="this.style.transform='scale(1)'" onmouseleave="this.style.transform='scale(1)'" title="Rechercher en ligne">🔍 Auto</button>
                </div>
            </div>

            <div class="form-group">
                <label class="form-label">URL du poster (optionnel)</label>
                <input type="url" class="form-input" id="input-poster" placeholder="https://..." value="${posterUrl}">
            </div>

            <div class="form-row">
                <div class="form-group">
                    <label class="form-label">Genre</label>
                    <select class="form-input" id="input-genre">
                        <option value="">— Choisir —</option>
                        <option value="Action" ${genre === 'Action' ? 'selected' : ''}>Action</option>
                        <option value="Aventure" ${genre === 'Aventure' ? 'selected' : ''}>Aventure</option>
                        <option value="Animation" ${genre === 'Animation' ? 'selected' : ''}>Animation</option>
                        <option value="Comédie" ${genre === 'Comédie' ? 'selected' : ''}>Comédie</option>
                        <option value="Crime" ${genre === 'Crime' ? 'selected' : ''}>Crime</option>
                        <option value="Documentaire" ${genre === 'Documentaire' ? 'selected' : ''}>Documentaire</option>
                        <option value="Drame" ${genre === 'Drame' ? 'selected' : ''}>Drame</option>
                        <option value="Fantastique" ${genre === 'Fantastique' ? 'selected' : ''}>Fantastique</option>
                        <option value="Horreur" ${genre === 'Horreur' ? 'selected' : ''}>Horreur</option>
                        <option value="Romance" ${genre === 'Romance' ? 'selected' : ''}>Romance</option>
                        <option value="Sci-Fi" ${genre === 'Sci-Fi' ? 'selected' : ''}>Sci-Fi</option>
                        <option value="Thriller" ${genre === 'Thriller' ? 'selected' : ''}>Thriller</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Année</label>
                    <input type="number" class="form-input" id="input-year" placeholder="2024" min="1900" max="2030" value="${year}">
                </div>
            </div>

            ${seasonsHtml}

            <div class="form-group">
                <label class="form-label">Notes personnelles</label>
                <textarea class="form-input notes-field" id="input-notes" placeholder="Vos impressions...">${notes}</textarea>
            </div>

            <button class="form-submit" onclick="App.submitForm(${isEdit ? `'${editItem.id}'` : ''})">
                ${isEdit ? '💾 Sauvegarder' : '✅ Ajouter'}
            </button>
        </div>`;
    },

    _renderSeasonInputs(editItem) {
        const count = editItem ? editItem.seasons.length : 1;
        let html = '';
        for (let i = 1; i <= count; i++) {
            const epCount = editItem ? editItem.seasons[i - 1].episodes.length : 10;
            html += `
            <div class="form-group" style="margin-bottom:10px">
                <label class="form-label" style="font-size:0.76rem">Saison ${i} — Nombre d'épisodes</label>
                <input type="number" class="form-input season-ep-count" min="1" max="100" value="${epCount}" data-season="${i}">
            </div>`;
        }
        return html;
    },

    // ===== STATS PAGE =====
    renderStats(items) {
        const stats = Database.getGlobalStats(items);
        const totalWatchTime = stats.watchedEpisodes * 45; // ~45min per episode est.
        const hours = Math.floor(totalWatchTime / 60);

        // Genre breakdown
        const genres = {};
        items.forEach(item => {
            if (item.genre) {
                genres[item.genre] = (genres[item.genre] || 0) + 1;
            }
        });

        let genreHtml = '';
        const sortedGenres = Object.entries(genres).sort((a, b) => b[1] - a[1]);
        if (sortedGenres.length > 0) {
            const maxCount = sortedGenres[0][1];
            genreHtml = sortedGenres.map(([name, count]) => `
                <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
                    <span style="font-size:0.82rem;width:90px;text-align:right;color:var(--text-secondary)">${name}</span>
                    <div style="flex:1;height:8px;background:var(--bg-glass-strong);border-radius:var(--radius-full);overflow:hidden">
                        <div style="width:${(count/maxCount)*100}%;height:100%;background:var(--accent-gradient);border-radius:var(--radius-full)"></div>
                    </div>
                    <span style="font-size:0.78rem;color:var(--text-muted);width:24px">${count}</span>
                </div>
            `).join('');
        }

        return `
        <div class="page-enter">
            <div class="stats-big-number">
                <div class="big-num">${stats.watchedEpisodes + stats.watchedMovies}</div>
                <div class="big-label">Contenus visionnés</div>
            </div>

            <div class="stats-row">
                <div class="stats-item">
                    <div class="si-value" style="color:var(--accent-light)">${stats.totalSeries}</div>
                    <div class="si-label">Séries</div>
                </div>
                <div class="stats-item">
                    <div class="si-value" style="color:#22d3ee">${stats.totalMovies}</div>
                    <div class="si-label">Films</div>
                </div>
                <div class="stats-item">
                    <div class="si-value" style="color:#22c55e">${stats.watchedEpisodes}</div>
                    <div class="si-label">Épisodes vus</div>
                </div>
                <div class="stats-item">
                    <div class="si-value" style="color:#f59e0b">~${hours}h</div>
                    <div class="si-label">Temps estimé</div>
                </div>
            </div>

            <div class="stats-row" style="grid-template-columns:1fr">
                <div class="stats-item">
                    <div class="si-value" style="color:#fbbf24">${stats.avgRating} ★</div>
                    <div class="si-label">Note moyenne</div>
                </div>
            </div>

            ${sortedGenres.length > 0 ? `
            <div style="margin-top:24px">
                <div class="section-header"><h3>🎭 Genres favoris</h3></div>
                <div style="margin-top:12px">${genreHtml}</div>
            </div>` : ''}
        </div>`;
    },

    // ===== SETTINGS PAGE =====
    renderSettings() {
        return `
        <div class="page-enter">
            <div class="settings-section">
                <h3>Données</h3>
                <div class="settings-item" onclick="App.exportData()">
                    <div class="settings-item-left">
                        <span class="si-icon">📦</span>
                        <div class="si-text">
                            <h4>Exporter les données</h4>
                            <p>Télécharger un fichier JSON de sauvegarde</p>
                        </div>
                    </div>
                    <span class="si-arrow">›</span>
                </div>
                <div class="settings-item" onclick="document.getElementById('import-file').click()">
                    <div class="settings-item-left">
                        <span class="si-icon">📥</span>
                        <div class="si-text">
                            <h4>Importer des données</h4>
                            <p>Restaurer depuis un fichier JSON</p>
                        </div>
                    </div>
                    <span class="si-arrow">›</span>
                </div>
                <input type="file" id="import-file" accept=".json" style="display:none" onchange="App.importData(event)">
            </div>

            <div class="settings-section">
                <h3>Zone dangereuse</h3>
                <div class="settings-item danger" onclick="App.confirmClearAll()">
                    <div class="settings-item-left">
                        <span class="si-icon">🗑️</span>
                        <div class="si-text">
                            <h4>Supprimer toutes les données</h4>
                            <p>Action irréversible</p>
                        </div>
                    </div>
                    <span class="si-arrow">›</span>
                </div>
            </div>

            <div style="text-align:center;padding:24px;color:var(--text-muted);font-size:0.75rem">
                <p>SeriesTracker v1.0</p>
                <p style="margin-top:4px">PWA — Fonctionne hors-ligne</p>
            </div>
        </div>`;
    },

    // ===== CONFIRM DELETE DIALOG =====
    renderConfirmDialog(title, message, onConfirm) {
        return `
        <div class="modal-handle"></div>
        <div class="confirm-dialog">
            <h3>${title}</h3>
            <p>${message}</p>
            <div class="confirm-actions">
                <button class="btn-cancel" onclick="App.closeModal()">Annuler</button>
                <button class="btn-confirm-danger" onclick="${onConfirm}">Supprimer</button>
            </div>
        </div>`;
    },

    // ===== TOAST =====
    showToast(message) {
        const toast = document.getElementById('toast');
        toast.textContent = message;
        toast.classList.remove('hidden');
        clearTimeout(this._toastTimer);
        this._toastTimer = setTimeout(() => {
            toast.classList.add('hidden');
        }, 2500);
    }
};

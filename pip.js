window.LyricMiniplayer = window.LyricMiniplayer || {};

const L = window.LyricMiniplayer;
const CONFIG = L.CONFIG;
const THEMES = L.THEMES;
const state = L.state;

// ==================== LYRICS FETCHING ====================
async function fetchLyrics(trackUri) {
    try {
        const trackId = trackUri.split(':').pop();

        // Method 1: Color Lyrics API
        try {
            const response = await Spicetify.CosmosAsync.get(
                `https://spclient.wg.spotify.com/color-lyrics/v2/track/${trackId}?format=json&market=from_token`
            );
            if (response?.lyrics?.lines) {
                return {
                    synced: response.lyrics.syncType === 'LINE_SYNCED',
                    lines: response.lyrics.lines.map(line => ({
                        startTime: parseInt(line.startTimeMs),
                        text: line.words || ''
                    }))
                };
            }
        } catch (e) {}

        // Method 2: Platform Lyrics API
        if (Spicetify.Platform?.Lyrics) {
            try {
                const lyrics = await Spicetify.Platform.Lyrics.getLyrics(trackUri);
                if (lyrics?.lines) {
                    return {
                        synced: true,
                        lines: lyrics.lines.map(line => ({
                            startTime: line.startTimeMs || 0,
                            text: line.words || line.text || ''
                        }))
                    };
                }
            } catch (e) {}
        }

        // Method 3: Legacy endpoint
        try {
            const altResponse = await Spicetify.CosmosAsync.get(
                `wg://lyrics/v1/track/${trackId}?format=json&market=from_token`
            );
            if (altResponse?.lines) {
                return {
                    synced: true,
                    lines: altResponse.lines.map(line => ({
                        startTime: parseInt(line.startTimeMs || line.time || 0),
                        text: line.words || line.text || ''
                    }))
                };
            }
        } catch (e) {}

        return null;
    } catch (error) {
        console.error('[Lyric Miniplayer] Error fetching lyrics:', error);
        return null;
    }
}

// ==================== PIP WINDOW CREATION ====================
async function openPictureInPicture() {
    // Close existing PiP window if open
    if (state.pipWindow && !state.pipWindow.closed) {
        state.pipWindow.close();
        state.pipWindow = null;
        return;
    }

    // Reset track URI to force fresh lyrics load
    state.currentTrackUri = null;

    // Check for Document Picture-in-Picture API (Chrome 116+)
    if ('documentPictureInPicture' in window) {
        try {
            state.pipWindow = await window.documentPictureInPicture.requestWindow({
                width: CONFIG.pipWidth,
                height: CONFIG.pipHeight,
            });

            setupPipWindow(state.pipWindow);
            return;
        } catch (err) {
            console.log('[Lyric Miniplayer] Document PiP failed, trying fallback:', err);
        }
    }

    // Fallback: Regular popup window
    try {
        const left = window.screen.width - CONFIG.pipWidth - 30;
        const top = 30;

        state.pipWindow = window.open(
            'about:blank',
            'LyricsOverlayPiP',
            `width=${CONFIG.pipWidth},height=${CONFIG.pipHeight},left=${left},top=${top},resizable=yes,scrollbars=no,toolbar=no,menubar=no,location=no,status=no`
        );

        if (state.pipWindow) {
            setupPipWindow(state.pipWindow);
        } else {
            Spicetify.showNotification('Could not open lyrics window.', true);
        }
    } catch (err) {
        console.error('[Lyric Miniplayer] Fallback popup failed:', err);
        Spicetify.showNotification('Could not open lyrics window', true);
    }
}

function getVolumeIconSvg(volume) {
    if (volume === 0) {
        return `<svg viewBox="0 0 16 16" class="volume-icon" id="volumeIcon">
            <path d="M13.86 5.47a.75.75 0 0 0-1.061 0l-1.47 1.47-1.47-1.47A.75.75 0 0 0 8.8 6.53L10.269 8l-1.47 1.47a.75.75 0 1 0 1.06 1.06l1.47-1.47 1.47 1.47a.75.75 0 0 0 1.06-1.06L12.39 8l1.47-1.47a.75.75 0 0 0 0-1.06z"/>
            <path d="M10.116 1.5A.75.75 0 0 0 8.991.85l-6.925 4a3.642 3.642 0 0 0-1.33 4.967 3.639 3.639 0 0 0 1.33 1.332l6.925 4a.75.75 0 0 0 1.125-.649v-1.906a4.73 4.73 0 0 1-1.5-.694v1.3L2.817 9.852a2.141 2.141 0 0 1-.781-2.92c.187-.324.456-.594.78-.782l5.8-3.35v1.3c.45-.313.956-.55 1.5-.694V1.5z"/>
        </svg>`;
    } else if (volume < 50) {
        return `<svg viewBox="0 0 16 16" class="volume-icon" id="volumeIcon">
            <path d="M9.741.85a.75.75 0 0 1 .375.65v13a.75.75 0 0 1-1.125.65l-6.925-4a3.642 3.642 0 0 1-1.33-4.967 3.639 3.639 0 0 1 1.33-1.332l6.925-4a.75.75 0 0 1 .75 0zm-6.924 5.3a2.139 2.139 0 0 0 0 3.7l5.8 3.35V2.8l-5.8 3.35zm8.683 4.29V5.56a2.75 2.75 0 0 1 0 4.88z"/>
        </svg>`;
    } else {
        return `<svg viewBox="0 0 16 16" class="volume-icon" id="volumeIcon">
            <path d="M9.741.85a.75.75 0 0 1 .375.65v13a.75.75 0 0 1-1.125.65l-6.925-4a3.642 3.642 0 0 1-1.33-4.967 3.639 3.639 0 0 1 1.33-1.332l6.925-4a.75.75 0 0 1 .75 0zm-6.924 5.3a2.139 2.139 0 0 0 0 3.7l5.8 3.35V2.8l-5.8 3.35zm8.683 6.087a4.502 4.502 0 0 0 0-8.474v1.65a2.999 2.999 0 0 1 0 5.175v1.649z"/>
        </svg>`;
    }
}

function generateThemeMenuItems() {
    return Object.entries(THEMES).map(([key, theme]) =>
        `<div class="theme-item ${key === state.currentTheme ? 'active' : ''}" data-theme="${key}">
            <span class="theme-emoji">${theme.emoji}</span>
            <span class="theme-name">${theme.name}</span>
        </div>`
    ).join('');
}

function setupPipWindow(win) {
    const doc = win.document;
    const currentVolume = Math.round((Spicetify.Player.getVolume() || 0) * 100);

    // Build the HTML
    doc.write(`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>♫ Lyrics</title>
    <style id="themeStyles">${L.generateStyles(state.currentTheme)}</style>
</head>
<body>
    <div class="resize-handle" id="resizeHandle" title="Drag to resize"></div>
    <div class="header" id="dragHeader" title="Drag to move window">
        <img class="album-art" id="albumArt" src="" alt="">
        <div class="track-info">
            <div class="track-title" id="trackTitle">Loading...</div>
            <div class="track-artist" id="trackArtist">-</div>
        </div>
        <div class="header-btns">
            <button class="menu-btn" id="menuBtn" title="Settings">
                <div class="menu-row">
                    <div class="menu-dot"></div>
                    <div class="menu-dot"></div>
                </div>
                <div class="menu-row">
                    <div class="menu-dot"></div>
                    <div class="menu-dot"></div>
                </div>
                <div class="menu-row">
                    <div class="menu-dot"></div>
                    <div class="menu-dot"></div>
                </div>
            </button>
            <button class="close-btn ${state.showCloseBtn ? '' : 'hidden'}" id="closeBtn" title="Close">×</button>
        </div>
    </div>

    <!-- Settings Panel - Full Screen -->
    <div class="settings-panel" id="settingsPanel">
        <div class="settings-header">
            <span class="settings-title">⚙️ Settings</span>
            <button class="settings-close" id="settingsClose">✕</button>
        </div>
        <div class="settings-content">
            <button class="theme-btn" id="openThemePicker">
                <span class="theme-btn-preview" id="currentThemeEmoji">${THEMES[state.currentTheme].emoji}</span>
                <div class="theme-btn-info">
                    <div class="theme-btn-label">Theme</div>
                    <div class="theme-btn-name" id="currentThemeName">${THEMES[state.currentTheme].name}</div>
                </div>
                <span class="theme-btn-arrow">›</span>
            </button>
            
            <div class="menu-divider"></div>
            
            <div class="menu-section-title">📺 Display</div>
            <div class="menu-item" id="toggleLyricsItem">
                <span class="menu-item-label">Show Lyrics</span>
                <div class="menu-toggle ${state.showLyrics ? 'on' : ''}" id="toggleLyrics"></div>
            </div>
            <div class="menu-item" id="toggleProgressItem">
                <span class="menu-item-label">Progress Bar</span>
                <div class="menu-toggle ${state.showProgressBar ? 'on' : ''}" id="toggleProgress"></div>
            </div>
            <div class="menu-item" id="toggleCenterItem">
                <span class="menu-item-label">Center Lyrics</span>
                <div class="menu-toggle ${state.centerLyrics ? 'on' : ''}" id="toggleCenter"></div>
            </div>
            <div class="menu-item" id="toggleShuffleItem">
                <span class="menu-item-label">Shuffle Button</span>
                <div class="menu-toggle ${state.showShuffleBtn ? 'on' : ''}" id="toggleShuffle"></div>
            </div>
            <div class="menu-item" id="toggleLikeItem">
                <span class="menu-item-label">Like Button</span>
                <div class="menu-toggle ${state.showLikeBtn ? 'on' : ''}" id="toggleLike"></div>
            </div>
            <div class="menu-item" id="toggleCloseItem">
                <span class="menu-item-label">Close Button</span>
                <div class="menu-toggle ${state.showCloseBtn ? 'on' : ''}" id="toggleClose"></div>
            </div>
            <div class="menu-item" id="toggleFontItem">
                <span class="menu-item-label">Font Size Slider</span>
                <div class="menu-toggle ${state.showFontSlider ? 'on' : ''}" id="toggleFont"></div>
            </div>
            <div class="menu-item" id="toggleVolItem">
                <span class="menu-item-label">Volume Slider</span>
                <div class="menu-toggle ${state.showVolumeSlider ? 'on' : ''}" id="toggleVol"></div>
            </div>
        </div>
    </div>

    <!-- Theme Picker Panel -->
    <div class="theme-picker" id="themePicker">
        <div class="theme-picker-header">
            <button class="theme-picker-back" id="themePickerBack">‹</button>
            <span class="theme-picker-title">Choose Theme</span>
        </div>
        <div class="theme-grid" id="themeGrid">
            ${generateThemeMenuItems()}
        </div>
    </div>

    <div class="controls">
        <button class="ctrl-btn" id="prevBtn" title="Previous">
            <svg viewBox="0 0 16 16"><path d="M3.3 1a.7.7 0 0 1 .7.7v5.15l9.95-5.744a.7.7 0 0 1 1.05.606v12.575a.7.7 0 0 1-1.05.607L4 9.149V14.3a.7.7 0 0 1-.7.7H1.7a.7.7 0 0 1-.7-.7V1.7a.7.7 0 0 1 .7-.7h1.6z"/></svg>
        </button>
        <button class="ctrl-btn play-btn" id="playBtn" title="Play/Pause">
            <svg viewBox="0 0 16 16" id="playIcon"><path d="M3 1.713a.7.7 0 0 1 1.05-.607l10.89 6.288a.7.7 0 0 1 0 1.212L4.05 14.894A.7.7 0 0 1 3 14.288V1.713z"/></svg>
        </button>
        <button class="ctrl-btn" id="nextBtn" title="Next">
            <svg viewBox="0 0 16 16"><path d="M12.7 1a.7.7 0 0 0-.7.7v5.15L2.05 1.107A.7.7 0 0 0 1 1.712v12.575a.7.7 0 0 0 1.05.607L12 9.149V14.3a.7.7 0 0 0 .7.7h1.6a.7.7 0 0 0 .7-.7V1.7a.7.7 0 0 0-.7-.7h-1.6z"/></svg>
        </button>
        <button class="ctrl-btn ${state.showShuffleBtn ? '' : 'hidden'}" id="shuffleBtn" title="Shuffle">
            <svg viewBox="0 0 16 16" id="shuffleIcon"><path d="M13.151.922a.75.75 0 1 0-1.06 1.06L13.109 3H11.16a3.75 3.75 0 0 0-2.873 1.34l-6.173 7.356A2.25 2.25 0 0 1 .39 12.5H0V14h.391a3.75 3.75 0 0 0 2.873-1.34l6.173-7.356a2.25 2.25 0 0 1 1.724-.804h1.947l-1.017 1.018a.75.75 0 0 0 1.06 1.06l2.306-2.306a.75.75 0 0 0 0-1.06L13.15.922zM.391 3.5H0V2h.391c1.109 0 2.16.49 2.873 1.34L4.89 5.277l-.979 1.167-1.796-2.14A2.25 2.25 0 0 0 .39 3.5z"/><path d="m7.5 10.723.98-1.167 1.796 2.14a2.25 2.25 0 0 0 1.724.804h1.947l-1.017-1.018a.75.75 0 1 1 1.06-1.06l2.306 2.306a.75.75 0 0 1 0 1.06l-2.306 2.306a.75.75 0 1 1-1.06-1.06L14.109 14H12.16a3.75 3.75 0 0 1-2.873-1.34l-1.787-2.14z"/></svg>
        </button>
        <button class="ctrl-btn ${state.showLikeBtn ? '' : 'hidden'}" id="likeBtn" title="Save to Liked Songs">
            <svg viewBox="0 0 16 16" id="likeIcon"><path d="M1.69 2A4.582 4.582 0 0 1 8 2.023 4.583 4.583 0 0 1 11.88.817h.002a4.618 4.618 0 0 1 3.782 3.65v.003a4.543 4.543 0 0 1-1.011 3.84L9.35 14.629a1.765 1.765 0 0 1-2.093.464 1.762 1.762 0 0 1-.605-.463L1.348 8.309A4.582 4.582 0 0 1 1.689 2zm3.158.252A3.082 3.082 0 0 0 2.49 7.337l.005.005L7.8 13.664a.264.264 0 0 0 .311.069.262.262 0 0 0 .09-.069l5.312-6.33a3.043 3.043 0 0 0 .68-2.573 3.118 3.118 0 0 0-2.551-2.463 3.079 3.079 0 0 0-2.612.816l-.007.007a1.501 1.501 0 0 1-2.045 0l-.009-.008a3.082 3.082 0 0 0-2.121-.861z"/></svg>
        </button>
    </div>

    <div class="progress-wrap ${state.showProgressBar ? '' : 'collapsed'}" id="progressWrap">
        <span class="time-label" id="currentTimeLabel">0:00</span>
        <input type="range" class="progress-slider" id="progressSlider" min="0" max="1000" value="0">
        <span class="time-label" id="durationLabel">0:00</span>
    </div>
    
    <div class="lyrics-wrap ${state.showLyrics ? '' : 'collapsed'} ${state.centerLyrics ? 'centered' : ''}" id="lyricsContainer">
        <div class="status-msg">
            <div class="spinner"></div>
        </div>
    </div>
    
    <div class="footer" id="footer">
        <div class="footer-row ${state.showFontSlider ? '' : 'collapsed'}" id="fontRow">
            <span class="control-label">Size</span>
            <input type="range" class="slider" id="fontSlider" min="${CONFIG.minFontSize}" max="${CONFIG.maxFontSize}" value="${state.fontSize}">
            <span class="value-display" id="fontValue">${state.fontSize}px</span>
        </div>
        <div class="footer-row ${state.showVolumeSlider ? '' : 'collapsed'}" id="volumeRow">
            <div id="volumeIconWrap">
                ${getVolumeIconSvg(currentVolume)}
            </div>
            <input type="range" class="slider" id="volumeSlider" min="0" max="100" value="${currentVolume}">
            <span class="value-display" id="volumePercent">${currentVolume}%</span>
        </div>
    </div>
</body>
</html>`);
    doc.close();

    // Get elements
    const menuBtn = doc.getElementById('menuBtn');
    const settingsPanel = doc.getElementById('settingsPanel');
    const settingsClose = doc.getElementById('settingsClose');
    const prevBtn = doc.getElementById('prevBtn');
    const playBtn = doc.getElementById('playBtn');
    const nextBtn = doc.getElementById('nextBtn');
    const shuffleBtn = doc.getElementById('shuffleBtn');
    const likeBtn = doc.getElementById('likeBtn');
    const fontSlider = doc.getElementById('fontSlider');
    const fontValue = doc.getElementById('fontValue');
    const fontRow = doc.getElementById('fontRow');
    const volumeRow = doc.getElementById('volumeRow');
    const volumeSlider = doc.getElementById('volumeSlider');
    const volumePercent = doc.getElementById('volumePercent');
    const volumeIconWrap = doc.getElementById('volumeIconWrap');
    const lyricsContainer = doc.getElementById('lyricsContainer');
    const toggleLyricsItem = doc.getElementById('toggleLyricsItem');
    const toggleLyrics = doc.getElementById('toggleLyrics');
    const toggleProgressItem = doc.getElementById('toggleProgressItem');
    const toggleProgress = doc.getElementById('toggleProgress');
    const progressWrap = doc.getElementById('progressWrap');
    const progressSlider = doc.getElementById('progressSlider');
    const currentTimeLabel = doc.getElementById('currentTimeLabel');
    const durationLabel = doc.getElementById('durationLabel');
    const toggleCenterItem = doc.getElementById('toggleCenterItem');
    const toggleCenter = doc.getElementById('toggleCenter');
    const toggleShuffleItem = doc.getElementById('toggleShuffleItem');
    const toggleShuffle = doc.getElementById('toggleShuffle');
    const toggleLikeItem = doc.getElementById('toggleLikeItem');
    const toggleLike = doc.getElementById('toggleLike');
    const toggleCloseItem = doc.getElementById('toggleCloseItem');
    const toggleClose = doc.getElementById('toggleClose');
    const toggleFontItem = doc.getElementById('toggleFontItem');
    const toggleFont = doc.getElementById('toggleFont');
    const toggleVolItem = doc.getElementById('toggleVolItem');
    const toggleVol = doc.getElementById('toggleVol');
    const themeStyles = doc.getElementById('themeStyles');
    const openThemePickerBtn = doc.getElementById('openThemePicker');
    const currentThemeEmoji = doc.getElementById('currentThemeEmoji');
    const currentThemeName = doc.getElementById('currentThemeName');
    const themePicker = doc.getElementById('themePicker');
    const themePickerBack = doc.getElementById('themePickerBack');
    const themeGrid = doc.getElementById('themeGrid');
    const closeBtn = doc.getElementById('closeBtn');

    // Close miniplayer
    closeBtn.onclick = () => {
        win.close();
    };

    // Settings panel toggle
    menuBtn.onclick = (e) => {
        e.stopPropagation();
        settingsPanel.classList.add('open');
    };

    // Close settings panel
    settingsClose.onclick = () => {
        settingsPanel.classList.remove('open');
    };

    // Open theme picker panel
    openThemePickerBtn.onclick = () => {
        themePicker.classList.add('open');
    };

    // Close theme picker (back to settings)
    themePickerBack.onclick = () => {
        themePicker.classList.remove('open');
    };

    // Theme selection
    themeGrid.onclick = (e) => {
        const themeItem = e.target.closest('.theme-item');
        if (themeItem) {
            const newTheme = themeItem.dataset.theme;
            if (newTheme && THEMES[newTheme]) {
                state.currentTheme = newTheme;
                localStorage.setItem('lyrics-overlay-theme', state.currentTheme);

                // Update styles
                themeStyles.textContent = L.generateStyles(state.currentTheme);

                // Update theme button
                currentThemeEmoji.textContent = THEMES[state.currentTheme].emoji;
                currentThemeName.textContent = THEMES[state.currentTheme].name;

                // Update active state
                doc.querySelectorAll('.theme-item').forEach(item => {
                    item.classList.toggle('active', item.dataset.theme === state.currentTheme);
                });

                // Close picker after selection
                themePicker.classList.remove('open');
            }
        }
    };

    // Toggle handlers
    toggleLyricsItem.onclick = () => {
        state.showLyrics = !state.showLyrics;
        toggleLyrics.classList.toggle('on', state.showLyrics);
        lyricsContainer.classList.toggle('collapsed', !state.showLyrics);
        localStorage.setItem('lyrics-overlay-showlyrics', state.showLyrics);
    };

    toggleProgressItem.onclick = () => {
        state.showProgressBar = !state.showProgressBar;
        toggleProgress.classList.toggle('on', state.showProgressBar);
        progressWrap.classList.toggle('collapsed', !state.showProgressBar);
        localStorage.setItem('lyrics-overlay-showprogress', state.showProgressBar);
    };

    toggleCenterItem.onclick = () => {
        state.centerLyrics = !state.centerLyrics;
        toggleCenter.classList.toggle('on', state.centerLyrics);
        lyricsContainer.classList.toggle('centered', state.centerLyrics);
        localStorage.setItem('lyrics-overlay-centerlyrics', state.centerLyrics);
    };

    toggleShuffleItem.onclick = () => {
        state.showShuffleBtn = !state.showShuffleBtn;
        toggleShuffle.classList.toggle('on', state.showShuffleBtn);
        shuffleBtn.classList.toggle('hidden', !state.showShuffleBtn);
        localStorage.setItem('lyrics-overlay-showshuffle', state.showShuffleBtn);
    };

    toggleLikeItem.onclick = () => {
        state.showLikeBtn = !state.showLikeBtn;
        toggleLike.classList.toggle('on', state.showLikeBtn);
        likeBtn.classList.toggle('hidden', !state.showLikeBtn);
        localStorage.setItem('lyrics-overlay-showlike', state.showLikeBtn);
    };

    toggleCloseItem.onclick = () => {
        state.showCloseBtn = !state.showCloseBtn;
        toggleClose.classList.toggle('on', state.showCloseBtn);
        closeBtn.classList.toggle('hidden', !state.showCloseBtn);
        localStorage.setItem('lyrics-overlay-showclose', state.showCloseBtn);
    };

    toggleFontItem.onclick = () => {
        state.showFontSlider = !state.showFontSlider;
        toggleFont.classList.toggle('on', state.showFontSlider);
        fontRow.classList.toggle('collapsed', !state.showFontSlider);
        localStorage.setItem('lyrics-overlay-showfont', state.showFontSlider);
    };

    toggleVolItem.onclick = () => {
        state.showVolumeSlider = !state.showVolumeSlider;
        toggleVol.classList.toggle('on', state.showVolumeSlider);
        volumeRow.classList.toggle('collapsed', !state.showVolumeSlider);
        localStorage.setItem('lyrics-overlay-showvol', state.showVolumeSlider);
    };

    // Control handlers
    prevBtn.onclick = () => Spicetify.Player.back();
    playBtn.onclick = () => Spicetify.Player.togglePlay();
    nextBtn.onclick = () => Spicetify.Player.next();
    shuffleBtn.onclick = () => {
        Spicetify.Player.toggleShuffle();
        updateShuffleState();
    };

    likeBtn.onclick = () => {
        Spicetify.Player.toggleHeart();
    };

    // Update shuffle button state
    function updateShuffleState() {
        const isShuffled = Spicetify.Player.getShuffle();
        shuffleBtn.classList.toggle('shuffle-on', isShuffled);
    }
    updateShuffleState();

    // Update like icon (filled vs outline)
    function updateLikeIcon(isLiked) {
        const likeIcon = doc.getElementById('likeIcon');
        if (!likeIcon) return;

        likeBtn.classList.toggle('liked', isLiked);

        if (isLiked) {
            // Filled heart
            likeIcon.innerHTML = '<path d="M15.724 4.22A4.313 4.313 0 0 0 12.192.814a4.269 4.269 0 0 0-3.622 1.13.837.837 0 0 1-1.14 0 4.272 4.272 0 0 0-6.21 5.855l5.916 7.05a1.128 1.128 0 0 0 1.727 0l5.916-7.05a4.228 4.228 0 0 0 .945-3.577z"/>';
        } else {
            // Outline heart
            likeIcon.innerHTML = '<path d="M1.69 2A4.582 4.582 0 0 1 8 2.023 4.583 4.583 0 0 1 11.88.817h.002a4.618 4.618 0 0 1 3.782 3.65v.003a4.543 4.543 0 0 1-1.011 3.84L9.35 14.629a1.765 1.765 0 0 1-2.093.464 1.762 1.762 0 0 1-.605-.463L1.348 8.309A4.582 4.582 0 0 1 1.689 2zm3.158.252A3.082 3.082 0 0 0 2.49 7.337l.005.005L7.8 13.664a.264.264 0 0 0 .311.069.262.262 0 0 0 .09-.069l5.312-6.33a3.043 3.043 0 0 0 .68-2.573 3.118 3.118 0 0 0-2.551-2.463 3.079 3.079 0 0 0-2.612.816l-.007.007a1.501 1.501 0 0 1-2.045 0l-.009-.008a3.082 3.082 0 0 0-2.121-.861z"/>';
        }
    }

    // Check and update like state
    function updateLikeState() {
        const isLiked = Spicetify.Player.getHeart();
        updateLikeIcon(isLiked);
    }

    // Initial update
    updateLikeState();

    // Font size handler
    fontSlider.oninput = (e) => {
        state.fontSize = parseInt(e.target.value);
        fontValue.textContent = `${state.fontSize}px`;
        localStorage.setItem('lyrics-overlay-fontsize', state.fontSize);
        updatePipFontSize();
    };

    // Volume handlers
    volumeSlider.oninput = (e) => {
        const vol = parseInt(e.target.value);
        Spicetify.Player.setVolume(vol / 100);
        volumePercent.textContent = `${vol}%`;
        volumeIconWrap.innerHTML = getVolumeIconSvg(vol);
    };

    // Click volume icon to mute/unmute
    volumeIconWrap.onclick = () => {
        const currentVol = Math.round((Spicetify.Player.getVolume() || 0) * 100);
        if (currentVol > 0) {
            volumeSlider.dataset.prevVolume = currentVol;
            Spicetify.Player.setVolume(0);
            volumeSlider.value = 0;
            volumePercent.textContent = '0%';
            volumeIconWrap.innerHTML = getVolumeIconSvg(0);
        } else {
            const prevVol = parseInt(volumeSlider.dataset.prevVolume) || 50;
            Spicetify.Player.setVolume(prevVol / 100);
            volumeSlider.value = prevVol;
            volumePercent.textContent = `${prevVol}%`;
            volumeIconWrap.innerHTML = getVolumeIconSvg(prevVol);
        }
    };

    progressSlider.oninput = (e) => {
        state.isSeekingProgress = true;

        const duration = getTrackDuration();
        const rawValue = parseInt(e.target.value) || 0;
        const percent = rawValue / 1000;
        const seekTime = Math.round(duration * percent);

        currentTimeLabel.textContent = formatTime(seekTime);
        progressSlider.style.setProperty('--progress', `${percent * 100}%`);
    };

    progressSlider.onchange = (e) => {
        const duration = getTrackDuration();
        const rawValue = parseInt(e.target.value) || 0;
        const percent = rawValue / 1000;
        const seekTime = Math.round(duration * percent);

        Spicetify.Player.seek(seekTime);

        setTimeout(() => {
            state.isSeekingProgress = false;
        }, 150);
    };

    // Lyrics click to seek
    lyricsContainer.onclick = (e) => {
        if (e.target.classList.contains('lyric')) {
            const time = e.target.dataset.time;
            if (time) Spicetify.Player.seek(parseInt(time));
        }
    };

    // Handle window close
    win.addEventListener('pagehide', () => {
        state.pipWindow = null;
    });

    // Initial update - force load lyrics for current track
    async function initialLoad() {
        const track = Spicetify.Player.data?.item;
        if (track?.uri) {
            state.currentTrackUri = track.uri;
            await loadLyrics(track.uri);
            updatePipLikeState();
        } else {
            // Retry after a short delay if track data not ready
            setTimeout(initialLoad, 200);
        }
    }

    updatePipContent();
    initialLoad();
    startUpdateLoop();
}

// ==================== PIP CONTENT UPDATES ====================
function updatePipContent() {
    if (!state.pipWindow || state.pipWindow.closed) return;

    const doc = state.pipWindow.document;
    const data = Spicetify.Player.data;

    if (!data?.item) return;

    const track = data.item;

    // Update track info
    const titleEl = doc.getElementById('trackTitle');
    const artistEl = doc.getElementById('trackArtist');
    const albumArtEl = doc.getElementById('albumArt');

    if (titleEl) titleEl.textContent = track.name || 'Unknown';
    if (artistEl) artistEl.textContent = track.artists?.map(a => a.name).join(', ') || 'Unknown';
    if (albumArtEl) {
        const imgUrl = track.album?.images?.[0]?.url || track.metadata?.image_url || '';
        albumArtEl.src = imgUrl;
    }

    // Update play button
    updatePipPlayButton();

    // Update volume
    updatePipVolume();

    // Update progress
    updatePipProgress();

    // Check if track changed
    if (track.uri !== state.currentTrackUri) {
        state.currentTrackUri = track.uri;
        loadLyrics(track.uri);
        updatePipLikeState();
    }
}

function updatePipLikeState() {
    if (!state.pipWindow || state.pipWindow.closed) return;

    const doc = state.pipWindow.document;
    const likeBtn = doc.getElementById('likeBtn');
    const likeIcon = doc.getElementById('likeIcon');
    if (!likeBtn || !likeIcon) return;

    const isLiked = Spicetify.Player.getHeart();

    likeBtn.classList.toggle('liked', isLiked);
    if (isLiked) {
        likeIcon.innerHTML = '<path d="M15.724 4.22A4.313 4.313 0 0 0 12.192.814a4.269 4.269 0 0 0-3.622 1.13.837.837 0 0 1-1.14 0 4.272 4.272 0 0 0-6.21 5.855l5.916 7.05a1.128 1.128 0 0 0 1.727 0l5.916-7.05a4.228 4.228 0 0 0 .945-3.577z"/>';
    } else {
        likeIcon.innerHTML = '<path d="M1.69 2A4.582 4.582 0 0 1 8 2.023 4.583 4.583 0 0 1 11.88.817h.002a4.618 4.618 0 0 1 3.782 3.65v.003a4.543 4.543 0 0 1-1.011 3.84L9.35 14.629a1.765 1.765 0 0 1-2.093.464 1.762 1.762 0 0 1-.605-.463L1.348 8.309A4.582 4.582 0 0 1 1.689 2zm3.158.252A3.082 3.082 0 0 0 2.49 7.337l.005.005L7.8 13.664a.264.264 0 0 0 .311.069.262.262 0 0 0 .09-.069l5.312-6.33a3.043 3.043 0 0 0 .68-2.573 3.118 3.118 0 0 0-2.551-2.463 3.079 3.079 0 0 0-2.612.816l-.007.007a1.501 1.501 0 0 1-2.045 0l-.009-.008a3.082 3.082 0 0 0-2.121-.861z"/>';
    }
}

function updatePipPlayButton() {
    if (!state.pipWindow || state.pipWindow.closed) return;

    const playIcon = state.pipWindow.document.getElementById('playIcon');
    if (!playIcon) return;

    const isPlaying = Spicetify.Player.isPlaying();
    playIcon.innerHTML = isPlaying
        ? '<path d="M2.7 1a.7.7 0 0 0-.7.7v12.6a.7.7 0 0 0 .7.7h2.6a.7.7 0 0 0 .7-.7V1.7a.7.7 0 0 0-.7-.7H2.7zm8 0a.7.7 0 0 0-.7.7v12.6a.7.7 0 0 0 .7.7h2.6a.7.7 0 0 0 .7-.7V1.7a.7.7 0 0 0-.7-.7h-2.6z"/>'
        : '<path d="M3 1.713a.7.7 0 0 1 1.05-.607l10.89 6.288a.7.7 0 0 1 0 1.212L4.05 14.894A.7.7 0 0 1 3 14.288V1.713z"/>';
}

function updatePipVolume() {
    if (!state.pipWindow || state.pipWindow.closed) return;

    const doc = state.pipWindow.document;
    const volumeSlider = doc.getElementById('volumeSlider');
    const volumePercent = doc.getElementById('volumePercent');
    const volumeIconWrap = doc.getElementById('volumeIconWrap');

    if (!volumeSlider || !volumePercent || !volumeIconWrap) return;

    // Only update if slider is not being dragged
    if (doc.activeElement !== volumeSlider) {
        const vol = Math.round((Spicetify.Player.getVolume() || 0) * 100);
        volumeSlider.value = vol;
        volumePercent.textContent = `${vol}%`;
        volumeIconWrap.innerHTML = getVolumeIconSvg(vol);
    }
}

function updatePipProgress() {
    if (!state.pipWindow || state.pipWindow.closed) return;

    const doc = state.pipWindow.document;
    const progressSlider = doc.getElementById('progressSlider');
    const currentTimeLabel = doc.getElementById('currentTimeLabel');
    const durationLabel = doc.getElementById('durationLabel');

    if (!progressSlider || !currentTimeLabel || !durationLabel) return;
    if (state.isSeekingProgress || doc.activeElement === progressSlider) return;

    const currentTime = Spicetify.Player.getProgress() || 0;
    const duration = getTrackDuration();

    currentTimeLabel.textContent = formatTime(currentTime);
    durationLabel.textContent = formatTime(duration);

    const percent = duration > 0 ? Math.min(currentTime / duration, 1) : 0;
    const sliderValue = Math.round(percent * 1000);

    progressSlider.value = sliderValue;
    progressSlider.style.setProperty('--progress', `${percent * 100}%`);
}

async function loadLyrics(uri) {
    if (!state.pipWindow || state.pipWindow.closed) return;

    const container = state.pipWindow.document.getElementById('lyricsContainer');
    if (!container) return;

    // Show loading
    container.innerHTML = '<div class="status-msg"><div class="spinner"></div></div>';

    // Fetch lyrics
    state.currentLyrics = await fetchLyrics(uri);

    if (!state.currentLyrics || !state.currentLyrics.lines?.length) {
        container.innerHTML = `
            <div class="status-msg">
                <div class="icon">🎵</div>
                <div class="text">No lyrics available</div>
                <div class="subtext">Lyrics not found for this track</div>
            </div>
        `;
        return;
    }

    // Render lyrics
    const lyricsHtml = state.currentLyrics.lines
        .filter(line => line.text && line.text.trim())
        .map((line, idx) =>
            `<div class="lyric" data-time="${line.startTime}" data-idx="${idx}" style="font-size:${state.fontSize}px">${escapeHtml(line.text)}</div>`
        ).join('');

    container.innerHTML = lyricsHtml || `
        <div class="status-msg">
            <div class="icon">🎶</div>
            <div class="text">Instrumental</div>
        </div>
    `;
}

function updateCurrentLyric() {
    if (!state.pipWindow || state.pipWindow.closed || !state.currentLyrics?.synced) return;

    const doc = state.pipWindow.document;
    const currentTime = Spicetify.Player.getProgress();

    // Find active line
    let activeIdx = -1;
    const filteredLines = state.currentLyrics.lines.filter(l => l.text && l.text.trim());

    for (let i = filteredLines.length - 1; i >= 0; i--) {
        if (currentTime >= filteredLines[i].startTime) {
            activeIdx = i;
            break;
        }
    }

    // Update classes
    const lyrics = doc.querySelectorAll('.lyric');
    const isPlaying = Spicetify.Player.isPlaying();

    lyrics.forEach((el, idx) => {
        el.classList.remove('active', 'past');

        if (idx === activeIdx) {
            el.classList.add('active');
            // Only auto-scroll when playing, allow free scroll when paused
            if (isPlaying) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        } else if (idx < activeIdx) {
            el.classList.add('past');
        }
    });
}

function updatePipFontSize() {
    if (!state.pipWindow || state.pipWindow.closed) return;

    const lyrics = state.pipWindow.document.querySelectorAll('.lyric');
    lyrics.forEach(el => {
        el.style.fontSize = `${state.fontSize}px`;
    });
}

function startUpdateLoop() {
    if (state.updateIntervalId) clearInterval(state.updateIntervalId);

    state.updateIntervalId = setInterval(() => {
        if (!state.pipWindow || state.pipWindow.closed) {
            clearInterval(state.updateIntervalId);
            state.updateIntervalId = null;
            return;
        }

        updateCurrentLyric();
        updatePipPlayButton();
        updatePipLikeState();
        updatePipProgress();
    }, CONFIG.updateInterval);
}

function formatTime(ms) {
    if (!Number.isFinite(ms) || ms < 0) return '0:00';

    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function getTrackDuration() {
    const track = Spicetify.Player.data?.item;

    const possibleDuration =
        track?.duration?.milliseconds ||
        track?.duration?.totalMilliseconds ||
        track?.duration_ms ||
        track?.metadata?.duration ||
        track?.metadata?.duration_ms ||
        0;

    const duration = Number(possibleDuration);

    return Number.isFinite(duration) ? duration : 0;
}

// ==================== UTILITIES ====================
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

L.fetchLyrics = fetchLyrics;
L.openPictureInPicture = openPictureInPicture;
L.getVolumeIconSvg = getVolumeIconSvg;
L.generateThemeMenuItems = generateThemeMenuItems;
L.setupPipWindow = setupPipWindow;
L.updatePipContent = updatePipContent;
L.updatePipLikeState = updatePipLikeState;
L.updatePipPlayButton = updatePipPlayButton;
L.updatePipVolume = updatePipVolume;
L.loadLyrics = loadLyrics;
L.updateCurrentLyric = updateCurrentLyric;
L.updatePipFontSize = updatePipFontSize;
L.startUpdateLoop = startUpdateLoop;
L.escapeHtml = escapeHtml;
L.formatTime = formatTime;
L.getTrackDuration = getTrackDuration;
L.updatePipProgress = updatePipProgress;
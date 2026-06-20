// Lyric Miniplayer - Spicetify Extension
// Creates a floating Picture-in-Picture lyrics window that stays on top of all apps

(async function LyricsOverlay() {
    const scriptTag = document.currentScript;
    const basePath = scriptTag?.src ? scriptTag.src.slice(0, scriptTag.src.lastIndexOf('/') + 1) : '';

    const EXTENSION_FILES = [
        'themes.js',
        'styles.js',
        'pip.js'
    ];

    async function loadExtensionFile(fileName) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = `${basePath}${fileName}`;
            script.onload = resolve;
            script.onerror = () => reject(new Error(`[Lyric Miniplayer] Failed to load ${fileName}`));
            document.head.appendChild(script);
        });
    }

    for (const file of EXTENSION_FILES) {
        await loadExtensionFile(file);
    }

    // Wait for Spicetify to be fully loaded
    while (!Spicetify?.Player?.data || !Spicetify?.Platform || !Spicetify?.CosmosAsync) {
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    const L = window.LyricMiniplayer;
    const state = L.state;

    // Load saved settings
    try {
        const savedSize = localStorage.getItem('lyrics-overlay-fontsize');
        if (savedSize) state.fontSize = parseInt(savedSize);
        const savedShowFont = localStorage.getItem('lyrics-overlay-showfont');
        if (savedShowFont !== null) state.showFontSlider = savedShowFont === 'true';
        const savedShowVol = localStorage.getItem('lyrics-overlay-showvol');
        if (savedShowVol !== null) state.showVolumeSlider = savedShowVol === 'true';
        const savedShowLyrics = localStorage.getItem('lyrics-overlay-showlyrics');
        if (savedShowLyrics !== null) state.showLyrics = savedShowLyrics === 'true';
        const savedShowShuffle = localStorage.getItem('lyrics-overlay-showshuffle');
        const savedShowProgress = localStorage.getItem('lyrics-overlay-showprogress');
        if (savedShowProgress !== null) state.showProgressBar = savedShowProgress === 'true';
        if (savedShowShuffle !== null) state.showShuffleBtn = savedShowShuffle === 'true';
        const savedShowLike = localStorage.getItem('lyrics-overlay-showlike');
        if (savedShowLike !== null) state.showLikeBtn = savedShowLike === 'true';
        const savedShowClose = localStorage.getItem('lyrics-overlay-showclose');
        if (savedShowClose !== null) state.showCloseBtn = savedShowClose === 'true';
        const savedCenterLyrics = localStorage.getItem('lyrics-overlay-centerlyrics');
        if (savedCenterLyrics !== null) state.centerLyrics = savedCenterLyrics === 'true';
        const savedTheme = localStorage.getItem('lyrics-overlay-theme');
        if (savedTheme && L.THEMES[savedTheme]) state.currentTheme = savedTheme;
    } catch (e) {}

    // ==================== TOPBAR BUTTON ====================
    function createButton() {
        if (Spicetify.Topbar?.Button) {
            new Spicetify.Topbar.Button(
                'Lyric Miniplayer',
                `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                    <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
                    <path d="M19 3h-2v2h2v2h2V5h-2V3z" opacity="0.6"/>
                </svg>`,
                L.openPictureInPicture,
                false
            );
        }
    }

    // ==================== EVENT LISTENERS ====================
    Spicetify.Player.addEventListener('songchange', () => {
        L.updatePipContent();
    });

    Spicetify.Player.addEventListener('onplaypause', () => {
        L.updatePipPlayButton();
    });

    // ==================== INIT ====================
    createButton();

    console.log('[Lyric Miniplayer] Ready!');
})();
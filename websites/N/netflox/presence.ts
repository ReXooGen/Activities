import { Assets, getTimestamps } from 'premid';

const presence = new Presence({
    clientId: '503557087041683458' // Official PreMiD Client ID (shows as Playing PreMiD)
});

enum ActivityAssets {
    Logo = 'https://netflox-iota.vercel.app/logo.png'
}

let browsingTimestamp = Math.floor(Date.now() / 1000);
let wasWatchingVideo = false;
let watchTimestamp: number | null = null;

const localStrings = {
    en: {
        browsingDetails: 'Browsing Homepage',
        browsingState: 'Searching for Something Good',
        searchingDetails: 'Searching',
        searchingState: 'Searching: "{query}"',
        searchingEmpty: 'Typing keyword...',
        viewingDetailsMovie: 'Viewing Movie Details',
        viewingDetailsSeries: 'Viewing Series Details',
        hiddenTitle: 'Hidden Title',
        watchingSeriesDetails: 'Watching: {title}',
        watchingSeriesState: 'Season {season} Episode {episode}: {epTitle}',
        watchingSeriesDetailsPrivacy: 'Watching Series',
        watchingMovieDetails: 'Watching Movie:',
        watchingMovieDetailsPrivacy: 'Watching Movie',
        buttonLabel: 'Watch on Netflox',
        paused: 'Paused',
        playing: 'Playing'
    },
    id: {
        browsingDetails: 'Menjelajahi Beranda',
        browsingState: 'Mencari Tayangan Seru',
        searchingDetails: 'Mencari tayangan',
        searchingState: 'Mencari: "{query}"',
        searchingEmpty: 'Mengetik kata kunci...',
        viewingDetailsMovie: 'Melihat Detail Film',
        viewingDetailsSeries: 'Melihat Detail Serial',
        hiddenTitle: 'Menyembunyikan Judul',
        watchingSeriesDetails: 'Menonton: {title}',
        watchingSeriesState: 'Musim {season} Episode {episode}: {epTitle}',
        watchingSeriesDetailsPrivacy: 'Menonton Serial',
        watchingMovieDetails: 'Menonton Film:',
        watchingMovieDetailsPrivacy: 'Menonton Film',
        buttonLabel: 'Tonton di Netflox',
        paused: 'Dijeda',
        playing: 'Memutar'
    }
};

presence.on('UpdateData', async () => {
    // 1. Get settings
    const privacy = await presence.getSetting<boolean>('privacy');
    const time = await presence.getSetting<boolean>('time');
    const buttons = await presence.getSetting<boolean>('buttons');
    const langSetting = await presence.getSetting<string>('lang');
    const lang = typeof langSetting === 'string' ? langSetting : 'en';

    // Parse language code (e.g. "id-ID" -> "id", "en-US" -> "en")
    const langCode = (lang.split('-')[0] || 'en').toLowerCase();
    const strings = langCode === 'id' ? localStrings.id : localStrings.en;

    const data: any = {
        details: '',
        state: '',
        largeImageKey: ActivityAssets.Logo,
        largeImageText: 'Netflox',
        smallImageKey: '',
        smallImageText: ''
    };

    // 2. Detect the page state from our custom attributes on the body
    const page = document.body.getAttribute('data-premid-page');

    // Handle transitions and set watchTimestamp
    if (page === 'watch') {
        if (!wasWatchingVideo) {
            wasWatchingVideo = true;
        }
        if (watchTimestamp === null) {
            watchTimestamp = Math.floor(Date.now() / 1000);
        }
    } else {
        if (wasWatchingVideo) {
            browsingTimestamp = Math.floor(Date.now() / 1000);
            wasWatchingVideo = false;
        }
        watchTimestamp = null;
    }

    // Add browsing timestamps if enabled
    if (time && page !== 'watch') {
        data.startTimestamp = browsingTimestamp;
    }

    if (!page) {
        // Fallback: If no attributes are set yet (e.g. initial load or other page)
        data.details = strings.browsingDetails;
        data.state = strings.browsingState;
        presence.setActivity(data);
        return;
    }

    if (page === 'search') {
        const query = document.body.getAttribute('data-premid-search-query');
        data.details = strings.searchingDetails;
        data.state = query ? strings.searchingState.replace('{query}', query) : strings.searchingEmpty;
        data.largeImageKey = ActivityAssets.Logo;
        data.largeImageText = langCode === 'id' ? 'Pencarian' : 'Search';
        presence.setActivity(data);
        return;
    }

    if (page === 'details') {
        const title = document.body.getAttribute('data-premid-title') || (langCode === 'id' ? 'Detail Tayangan' : 'Show Details');
        const type = document.body.getAttribute('data-premid-type') || 'movie';
        const poster = document.body.getAttribute('data-premid-poster');

        data.details = type === 'series' ? strings.viewingDetailsSeries : strings.viewingDetailsMovie;
        data.state = privacy ? strings.hiddenTitle : title;
        if (poster) {
            data.largeImageKey = poster;
        } else {
            data.largeImageKey = ActivityAssets.Logo;
        }
        data.largeImageText = privacy ? 'Netflox' : title;
        presence.setActivity(data);
        return;
    }

    if (page === 'watch') {
        const title = document.body.getAttribute('data-premid-title') || (langCode === 'id' ? 'Menonton' : 'Watching');
        const type = document.body.getAttribute('data-premid-type') || 'movie';
        const poster = document.body.getAttribute('data-premid-poster');

        if (type === 'series') {
            const season = document.body.getAttribute('data-premid-season-num') || '1';
            const episode = document.body.getAttribute('data-premid-episode-num') || '1';
            const epTitle = document.body.getAttribute('data-premid-episode-title') || `Episode ${episode}`;
            
            data.details = privacy ? strings.watchingSeriesDetailsPrivacy : strings.watchingSeriesDetails.replace('{title}', title);
            data.state = privacy ? strings.hiddenTitle : strings.watchingSeriesState.replace('{season}', season).replace('{episode}', episode).replace('{epTitle}', epTitle);
        } else {
            data.details = privacy ? strings.watchingMovieDetailsPrivacy : strings.watchingMovieDetails;
            data.state = privacy ? strings.hiddenTitle : title;
        }

        if (poster) {
            data.largeImageKey = poster;
        } else {
            data.largeImageKey = ActivityAssets.Logo;
        }
        data.largeImageText = privacy ? 'Netflox' : title;

        // 3. Timeline Tracking (if enabled)
        if (time) {
            // Check for local HTML5 video element (used by ShakaPlayer)
            const video = document.querySelector('video');

            if (video && !isNaN(video.duration) && video.duration > 0) {
                data.smallImageKey = video.paused ? Assets.Pause : Assets.Play;
                data.smallImageText = video.paused ? strings.paused : strings.playing;

                if (!video.paused) {
                    // Set startTimestamp to calculate elapsed time matching the video playback
                    data.startTimestamp = Math.floor(Date.now() / 1000) - Math.floor(video.currentTime);
                } else {
                    // Paused: clear timestamps so Discord stops the ticking timer
                    delete data.startTimestamp;
                    delete data.endTimestamp;
                }
            } else {
                // For cross-origin Iframe (fallback servers: vidplus, embedsu, etc.)
                // We cannot query the timeline directly. We default to showing elapsed watch time.
                data.startTimestamp = watchTimestamp;
                data.smallImageKey = Assets.Play;
                data.smallImageText = strings.playing;
            }
        }

        // 4. Buttons (if enabled)
        if (buttons) {
            data.buttons = [
                {
                    label: strings.buttonLabel,
                    url: document.location.href
                }
            ];
        }

        presence.setActivity(data);
        return;
    }

    // Default Fallback
    data.details = strings.browsingDetails;
    data.state = strings.browsingState;
    presence.setActivity(data);
});

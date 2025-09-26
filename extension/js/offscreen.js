// Audio player for offscreen document
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'playAudio') {
        playAudioFromExtension(request.language, request.params).then(() => {
            sendResponse({ success: true });
        }).catch((error) => {
            console.error('Audio playback failed:', error);
            sendResponse({ success: false, error: error.message });
        });
        return true; // Keep message channel open for async response
    }
});

async function playAudioFromExtension(language, params) {
    try {
        const baseUrl = 'https://www.edbchinese.hk';
        let audioPath;

        if (params.type === 'cantonese') {
            // Cantonese audio URL pattern - /EmbziciwebRes/jyutping/
            audioPath = `/EmbziciwebRes/jyutping/`;
        } else if (params.type === 'mandarin') {
            // Mandarin audio URL pattern - /EmbziciwebRes/pinyin/
            audioPath = `/EmbziciwebRes/pinyin/`;
        } else {
            throw new Error('Unknown audio type');
        }

        // Play only the first audio parameter (main character)
        const audioUrl = baseUrl + audioPath + params.param + ".mp3";
        console.log(`Playing ${language} audio: ${audioUrl}`);

        const audio = new Audio(audioUrl);
        audio.volume = 1.0;

        // Return a promise that resolves when audio finishes
        return new Promise((resolve, reject) => {
            audio.addEventListener('ended', () => {
                console.log('Audio playback completed');
                resolve();
            });

            audio.addEventListener('error', (error) => {
                console.error('Audio playback error:', error);
                reject(new Error('Failed to play audio'));
            });

            // Play the audio
            audio.play().catch((error) => {
                console.error('Audio play failed:', error);
                reject(error);
            });
        });
    } catch (error) {
        console.error('Audio playback setup failed:', error);
        throw error;
    }
}
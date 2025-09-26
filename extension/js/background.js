// Background service worker for EDB Chinese Helper

// Extension installation
chrome.runtime.onInstalled.addListener(() => {
    console.log('EDB Chinese Helper installed');

    // Initialize default settings
    chrome.storage.local.set({
        'learnedWords': [],
        'testResults': [],
        'settings': {
            'difficulty': 'medium',
            'autoPlay': false,    // Disabled by default for new installations
            'reviewInterval': 1
        }
    });

    // Create context menu for quick lookup
    chrome.contextMenus.create({
        id: 'lookupCharacter',
        title: '查找汉字: %s',
        contexts: ['selection']
    });

    // Create offscreen document for audio playback
    createOffscreenDocument();
});

// Create offscreen document for audio playback
async function createOffscreenDocument() {
    try {
        const existingContexts = await chrome.runtime.getContexts({
            contextTypes: ['OFFSCREEN_DOCUMENT'],
            documentUrls: ['offscreen.html']
        });

        if (existingContexts.length > 0) {
            console.log('Offscreen document already exists');
            return;
        }

        await chrome.offscreen.createDocument({
            url: 'offscreen.html',
            reasons: ['AUDIO_PLAYBACK'],
            justification: 'Need to play Chinese audio files for language learning'
        });
        console.log('Offscreen document created successfully');
    } catch (error) {
        console.error('Offscreen document creation failed:', error);
    }
}

// Handle messages from content script or popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    switch (request.action) {
        case 'getWordData':
            // TODO: Fetch word data from storage
            sendResponse({ success: true });
            break;

        case 'saveProgress':
            // TODO: Save learning progress
            chrome.storage.local.set({
                'learnedWords': request.data
            }, () => {
                sendResponse({ success: true });
            });
            break;

        case 'getProgress':
            chrome.storage.local.get(['learnedWords', 'testResults'], (result) => {
                sendResponse({
                    learnedWords: result.learnedWords || [],
                    testResults: result.testResults || []
                });
            });
            break;

        case 'checkAudioPermission':
            // Check if audio permission is enabled for this session
            Promise.all([
                chrome.storage.session.get('audioEnabled'),
                chrome.storage.local.get('audioSessionTimestamp')
            ]).then(([sessionResult, localResult]) => {
                const sessionEnabled = !!sessionResult.audioEnabled;
                const sessionTimestamp = localResult.audioSessionTimestamp || 0;
                const now = Date.now();
                const sessionDuration = 4 * 60 * 60 * 1000; // 4 hours

                // Check if session is still valid (within 4 hours)
                const validSession = sessionEnabled && (now - sessionTimestamp < sessionDuration);

                sendResponse({ enabled: validSession });
            }).catch(() => {
                sendResponse({ enabled: false });
            });
            return true; // Async response

        case 'enableAudioPermission':
            // Enable audio permission for this browser session
            const now = Date.now();
            Promise.all([
                chrome.storage.session.set({ audioEnabled: true }),
                chrome.storage.local.set({ audioSessionTimestamp: now })
            ]).then(() => {
                sendResponse({ success: true });
            }).catch(() => {
                sendResponse({ success: false });
            });
            return true; // Async response

        case 'playAudio':
            console.log('Received audio play request:', request);
            // Forward audio play request to offscreen document
            chrome.runtime.sendMessage({
                action: 'playAudio',
                language: request.language,
                params: request.params
            }).then(response => {
                console.log('Audio playback response:', response);
                if (response && response.success) {
                    console.log('Audio playback completed successfully');
                    sendResponse({ success: true });
                } else {
                    console.error('Audio playback failed:', response?.error || 'Unknown error');
                    sendResponse({ success: false, error: response?.error || 'Unknown error' });
                }
            }).catch(error => {
                console.error('Audio playback failed:', error);
                sendResponse({ success: false, error: error.message });
            });
            return true; // Async response

        default:
            sendResponse({ success: false, error: 'Unknown action' });
    }

    return true; // Keep message channel open for async response
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === 'lookupCharacter') {
        chrome.tabs.sendMessage(tab.id, {
            action: 'lookupCharacter',
            text: info.selectionText
        });
    }
});
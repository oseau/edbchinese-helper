// Background service worker for EDB Chinese Helper

// Import FSRS algorithm
importScripts('fsrs-bundle.js');

// Create global instances for background script
var FSRS = fsrsInstance;
var ChineseCardManager = chineseCardManager;

console.log('Background script loaded, FSRS available:', typeof FSRS);
console.log('ChineseCardManager available:', typeof ChineseCardManager);

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

        case 'addToLearning':
            // Add character to learning list using FSRS
            (async () => {
                try {
                    // Get current learning cards
                    const result = await chrome.storage.local.get('edbLearningCards');
                    const cards = result.edbLearningCards || [];

                    // Check if character already exists
                    const existingCard = cards.find(card => card.characterId === request.data.characterId);
                    if (existingCard) {
                        sendResponse({ success: false, message: '该字符已在学习列表中' });
                        return;
                    }

                    // Create new learning card (ID only)
                    const now = Date.now(); // Unix timestamp in milliseconds
                    const newCard = {
                        id: now.toString(),
                        characterId: request.data.characterId,
                        due: now, // Unix timestamp
                        stability: 0,
                        difficulty: 0,
                        elapsedDays: 0,
                        scheduledDays: 0,
                        reps: 0,
                        lapses: 0,
                        state: 'new',
                        lastReview: null,
                        created: now, // Unix timestamp
                        type: 'character'
                    };

                    cards.push(newCard);
                    await chrome.storage.local.set({ edbLearningCards: cards });

                    console.log(`Added character ID ${request.data.characterId} to learning cards`);
                    sendResponse({ success: true });
                } catch (error) {
                    console.error('Error adding to learning:', error);
                    sendResponse({ success: false, message: '添加失败' });
                }
            })();
            return true; // Async response

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
                    // Mute this error as audio is working fine
                    // console.error('Audio playback failed:', response?.error || 'Unknown error');
                    sendResponse({ success: false, error: response?.error || 'Unknown error' });
                }
            }).catch(error => {
                // Mute this error as audio is working fine
                // console.error('Audio playback failed:', error);
                sendResponse({ success: false, error: error.message });
            });
            return true; // Async response

        case 'rateCard':
            // Rate a learning card
            (async () => {
                try {
                    console.log('rateCard action received:', request.data);
                    const { cardId, quality } = request.data;

                    // Get current learning cards
                    const result = await chrome.storage.local.get('edbLearningCards');
                    const cards = result.edbLearningCards || [];

                    // Find the card
                    const cardIndex = cards.findIndex(card => card.id === cardId);
                    if (cardIndex === -1) {
                        sendResponse({ success: false, message: '卡片不存在' });
                        return;
                    }

                    const card = cards[cardIndex];

                    // Apply FSRS algorithm to update the card
                    const now = new Date();
                    const lastReview = card.lastReview ? new Date(card.lastReview) : now;
                    const elapsedDays = Math.floor((now - lastReview) / (1000 * 60 * 60 * 24));

                    // Simple FSRS-inspired update logic
                    card.reps++;
                    card.lastReview = now;
                    card.elapsedDays = elapsedDays;
                    card.state = 'review';

                    // Update intervals based on quality
                    if (quality === 1) { // Again
                        card.difficulty = Math.min(10, (card.difficulty || 5) + 2);
                        card.stability = Math.max(0.1, (card.stability || 1) * 0.5);
                        card.scheduledDays = 1;
                        card.lapses++;
                    } else if (quality === 2) { // Hard
                        card.difficulty = Math.min(10, (card.difficulty || 5) + 0.5);
                        card.stability = (card.stability || 1) * 1.2;
                        card.scheduledDays = Math.max(1, Math.floor(card.stability));
                    } else if (quality === 3) { // Good
                        card.difficulty = Math.max(1, (card.difficulty || 5) - 0.3);
                        card.stability = (card.stability || 1) * 1.8;
                        card.scheduledDays = Math.floor(card.stability * card.difficulty);
                    } else { // Easy (4)
                        card.difficulty = Math.max(1, (card.difficulty || 5) - 1);
                        card.stability = (card.stability || 1) * 2.5;
                        card.scheduledDays = Math.floor(card.stability * card.difficulty * 1.5);
                    }

                    // Set next due date
                    const dueDate = now + (card.scheduledDays * 24 * 60 * 60 * 1000);
                    card.due = dueDate; // Unix timestamp

                    // Update the card
                    cards[cardIndex] = card;
                    await chrome.storage.local.set({ edbLearningCards: cards });

                    console.log(`Card ${cardId} rated with quality ${quality}, next review in ${card.scheduledDays} days`);
                    sendResponse({ success: true });

                } catch (error) {
                    console.error('Error rating card:', error);
                    sendResponse({ success: false, message: '评分失败' });
                }
            })();
            return true; // Async response

        case 'rateCardAndGetNext':
            // Rate a learning card and get next card in one atomic operation
            (async () => {
                try {
                    console.log('🔄 rateCardAndGetNext action received:', request.data);
                    const { cardId, quality } = request.data;

                    // Step 1: Rate the card
                    console.log('Step 1: Rating card...');
                    const cardResult = await chrome.storage.local.get('edbLearningCards');
                    const cards = cardResult.edbLearningCards || [];

                    const cardIndex = cards.findIndex(card => card.id === cardId);
                    if (cardIndex === -1) {
                        sendResponse({ success: false, message: '卡片不存在' });
                        return;
                    }

                    const card = cards[cardIndex];

                    // Apply FSRS algorithm to update the card
                    const now = Date.now(); // Unix timestamp
                    const lastReview = card.lastReview || now;
                    const elapsedDays = Math.floor((now - lastReview) / (1000 * 60 * 60 * 24));

                    card.reps++;
                    card.lastReview = now; // Unix timestamp
                    card.elapsedDays = elapsedDays;
                    card.state = 'review';

                    // Update intervals based on quality
                    if (quality === 1) {
                        card.difficulty = Math.min(10, (card.difficulty || 5) + 2);
                        card.stability = Math.max(0.1, (card.stability || 1) * 0.5);
                        card.scheduledDays = 1;
                        card.lapses++;
                    } else if (quality === 2) {
                        card.difficulty = Math.min(10, (card.difficulty || 5) + 0.5);
                        card.stability = (card.stability || 1) * 1.2;
                        card.scheduledDays = Math.max(1, Math.floor(card.stability));
                    } else if (quality === 3) {
                        card.difficulty = Math.max(1, (card.difficulty || 5) - 0.3);
                        card.stability = (card.stability || 1) * 1.8;
                        card.scheduledDays = Math.floor(card.stability * card.difficulty);
                    } else {
                        card.difficulty = Math.max(1, (card.difficulty || 5) - 1);
                        card.stability = (card.stability || 1) * 2.5;
                        card.scheduledDays = Math.floor(card.stability * card.difficulty * 1.5);
                    }

                    card.due = now + (card.scheduledDays * 24 * 60 * 60 * 1000); // Unix timestamp
                    cards[cardIndex] = card;
                    await chrome.storage.local.set({ edbLearningCards: cards });
                    console.log('✅ Card rated successfully');

                    // Step 2: Get next card and open tab
                    console.log('Step 2: Getting next card...');
                    const sessionResult = await chrome.storage.local.get('currentLearningSession');
                    const session = sessionResult.currentLearningSession;

                    if (!session || !session.cards || session.cards.length === 0) {
                        sendResponse({ success: false, message: '没有活动的学习会话' });
                        return;
                    }

                    const currentIndex = session.currentIndex || 0;
                    console.log(`Current index: ${currentIndex}, total cards: ${session.cards.length}`);

                    // Get the current card (this is what we're rating)
                    const currentCard = session.cards[currentIndex];
                    console.log('Current card being rated:', currentCard);

                    // Check if this is the last card by comparing index to length
                    const isLastCard = currentIndex >= session.cards.length - 1;
                    console.log(`Is last card check: currentIndex=${currentIndex}, length=${session.cards.length}, isLast=${isLastCard}`);

                    if (isLastCard) {
                        console.log('🎉 This is the last card, session will complete');
                        // Clean up session completely with multiple verification steps
                        await chrome.storage.local.remove('currentLearningSession');
                        await chrome.storage.local.remove('currentPopupSession');

                        // Double-check that session is gone
                        const verify = await chrome.storage.local.get('currentLearningSession');
                        if (verify.currentLearningSession) {
                            console.log('⚠️ Session still exists after removal, removing again');
                            await chrome.storage.local.remove('currentLearningSession');
                        }

                        // Close the current tab after completion
                        if (sender.tab) {
                            setTimeout(() => {
                                chrome.tabs.remove(sender.tab.id);
                            }, 2000); // Give 2 seconds to see the completion message
                        }
                        sendResponse({
                            success: true,
                            hasNextCard: false,
                            sessionInfo: {
                                currentIndex: currentIndex,
                                totalCards: session.cards.length,
                                nextCardId: null
                            },
                            message: '学习会话已完成，此标签页即将关闭'
                        });
                        return;
                    }

                    // Get the next card (now we know it exists)
                    const nextCard = session.cards[currentIndex + 1];
                    console.log('Next card to open:', nextCard);

                    // Update session index for next call
                    const newIndex = currentIndex + 1;
                    session.currentIndex = newIndex;
                    console.log(`📈 Updating session index from ${currentIndex} to ${newIndex}`);
                    console.log('📝 Session object before save:', {
                        currentIndex: session.currentIndex,
                        cards: session.cards.length,
                        characterId: session.cards[currentIndex].characterId
                    });

                    await chrome.storage.local.set({ currentLearningSession: session });
                    console.log('✅ Session saved to storage');

                    // Verify the session was saved correctly
                    const verificationResult = await chrome.storage.local.get('currentLearningSession');
                    const verifiedSession = verificationResult.currentLearningSession;
                    console.log('🔍 Verified session:', {
                        currentIndex: verifiedSession.currentIndex,
                        totalCards: verifiedSession.cards.length,
                        allCharacterIds: verifiedSession.cards.map(c => c.characterId)
                    });
                    console.log(`🔍 Expected index: ${newIndex}, Actual verified index: ${verifiedSession.currentIndex}`);

                    // Open next card in a new tab
                    const nextUrl = `https://www.edbchinese.hk/lexlist_ch/result.jsp?id=${nextCard.characterId}`;
                    console.log(`Opening URL: ${nextUrl}`);
                    await chrome.tabs.create({ url: nextUrl, active: true });

                    console.log(`Opened next card: ${nextCard.characterId}`);

                    // Close the sender tab after a delay
                    if (sender.tab) {
                        setTimeout(() => {
                            chrome.tabs.remove(sender.tab.id);
                        }, 5000);
                    }

                    // Send response with session info for debugging
                    sendResponse({
                        success: true,
                        sessionInfo: {
                            currentIndex: currentIndex,
                            totalCards: session.cards.length,
                            nextCardId: nextCard.characterId,
                            nextUrl: nextUrl,
                            allCards: session.cards.map(card => ({ id: card.id, characterId: card.characterId })),
                            verifiedIndex: verifiedSession.currentIndex,
                            debugNote: `Rated card ${currentCard.characterId} at index ${currentIndex}, Next card ${nextCard.characterId}, Session updated to index ${newIndex}`
                        }
                    });

                } catch (error) {
                    console.error('Error in rateCardAndGetNext:', error);
                    sendResponse({ success: false, message: '操作失败' });
                }
            })();
            return true; // Async response

        case 'getNextCard':
            // Get the next card in the current learning session
            (async () => {
                try {
                    const sessionResult = await chrome.storage.local.get('currentLearningSession');
                    const session = sessionResult.currentLearningSession;

                    if (!session || !session.cards || session.cards.length === 0) {
                        sendResponse({ success: false, message: '没有活动的学习会话' });
                        return;
                    }

                    const currentIndex = session.currentIndex || 0;

                    // Check if we've completed all cards
                    if (currentIndex >= session.cards.length) {
                        // Session complete, clean up
                        await chrome.storage.local.remove('currentLearningSession');
                        sendResponse({ success: false, message: '学习会话已完成' });
                        return;
                    }

                    const nextCard = session.cards[currentIndex];

                    // Update session index for next call
                    session.currentIndex = currentIndex + 1;
                    await chrome.storage.local.set({ currentLearningSession: session });

                    console.log(`Returning card ${currentIndex + 1}/${session.cards.length}:`, nextCard.characterId);
                    sendResponse({ success: true, nextCard: nextCard });

                } catch (error) {
                    console.error('Error getting next card:', error);
                    sendResponse({ success: false, message: '获取下一张卡片失败' });
                }
            })();
            return true; // Async response

        case 'getNextCardAndOpenTab':
            // Get next card and open it in a new tab, then close current tab
            (async () => {
                try {
                    console.log('🚀 getNextCardAndOpenTab action received');

                    const sessionResult = await chrome.storage.local.get('currentLearningSession');
                    const session = sessionResult.currentLearningSession;

                    console.log('Session from storage:', session);

                    if (!session || !session.cards || session.cards.length === 0) {
                        sendResponse({ success: false, message: '没有活动的学习会话' });
                        return;
                    }

                    const currentIndex = session.currentIndex || 0;
                    console.log(`Current index: ${currentIndex}, total cards: ${session.cards.length}`);

                    // Check if we've completed all cards
                    if (currentIndex >= session.cards.length) {
                        // Session complete, clean up
                        await chrome.storage.local.remove('currentLearningSession');
                        sendResponse({ success: false, message: '学习会话已完成' });
                        return;
                    }

                    const nextCard = session.cards[currentIndex];

                    console.log(`Current index: ${currentIndex}, total cards: ${session.cards.length}`);
                    console.log(`Next card:`, nextCard);

                    // Update session index for next call
                    const newIndex = currentIndex + 1;
                    session.currentIndex = newIndex;
                    console.log(`📈 Updating session index from ${currentIndex} to ${newIndex}`);

                    await chrome.storage.local.set({ currentLearningSession: session });
                    console.log('✅ Session saved to storage');

                    // Get the sender tab from the message
                    const senderTab = sender.tab;

                    // Open next card in a new tab
                    const nextUrl = `https://www.edbchinese.hk/lexlist_ch/result.jsp?id=${nextCard.characterId}`;
                    console.log(`Opening URL: ${nextUrl}`);
                    await chrome.tabs.create({ url: nextUrl, active: true });

                    console.log(`Opened next card: ${nextCard.characterId}, closing tab ${senderTab ? senderTab.id : 'unknown'}`);

                    // Close the sender tab after a longer delay to allow time to see logs
                    if (senderTab) {
                        setTimeout(() => {
                            chrome.tabs.remove(senderTab.id);
                        }, 5000); // 5 seconds instead of 1
                    }

                    // Send response with session info for debugging
                    sendResponse({
                        success: true,
                        sessionInfo: {
                            currentIndex: currentIndex,
                            totalCards: session.cards.length,
                            nextCardId: nextCard.characterId,
                            nextUrl: nextUrl,
                            allCards: session.cards.map(card => ({ id: card.id, characterId: card.characterId }))
                        }
                    });

                } catch (error) {
                    console.error('Error getting next card and opening tab:', error);
                    sendResponse({ success: false, message: '获取下一张卡片失败' });
                }
            })();
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
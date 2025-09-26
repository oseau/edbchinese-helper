// Learning Manager for EDB Chinese Helper
// Handles all learning data management using FSRS algorithm

class LearningManager {
    constructor() {
        this.cards = [];
        this.currentSession = null;
        this.init();
    }

    async init() {
        await this.loadCards();
        this.setupStorageListener();
    }

    // Load all cards from Chrome storage
    async loadCards() {
        try {
            const result = await chrome.storage.local.get('edbLearningCards');
            this.cards = result.edbLearningCards || [];
            console.log(`Loaded ${this.cards.length} learning cards`);
        } catch (error) {
            console.error('Error loading learning cards:', error);
            this.cards = [];
        }
    }

    // Save all cards to Chrome storage
    async saveCards() {
        try {
            await chrome.storage.local.set({ edbLearningCards: this.cards });
            console.log(`Saved ${this.cards.length} learning cards`);
        } catch (error) {
            console.error('Error saving learning cards:', error);
        }
    }

    // Add a new character to learning (ID only)
    async addCharacter(characterId) {
        // Check if character already exists
        const existingCard = this.cards.find(card => card.characterId === characterId);
        if (existingCard) {
            console.log(`Character ${characterId} already in learning cards`);
            return existingCard;
        }

        const newCard = window.ChineseCardManager.createCharacterCard(characterId);
        this.cards.push(newCard);
        await this.saveCards();

        console.log(`Added character ${characterId} to learning cards`);
        return newCard;
    }

    // Get card by character ID
    getCard(characterId) {
        return this.cards.find(card => card.characterId === characterId);
    }

    // Get all cards that are due for review
    getDueCards() {
        return window.FSRS.getDueCards(this.cards);
    }

    // Get new cards (never reviewed)
    getNewCards() {
        return window.FSRS.getNewCards(this.cards);
    }

    // Get learning cards
    getLearningCards() {
        return window.FSRS.getLearningCards(this.cards);
    }

    // Start a learning session
    startSession(options = {}) {
        const {
            cardCount = 20,
            includeNew = true,
            includeDue = true,
            includeLearning = true
        } = options;

        let sessionCards = [];
        const usedCardIds = new Set();

        // Priority: due cards, then learning cards, then new cards
        if (includeDue) {
            const dueCards = this.getDueCards();
            for (const card of dueCards) {
                if (!usedCardIds.has(card.id) && sessionCards.length < cardCount) {
                    sessionCards.push(card);
                    usedCardIds.add(card.id);
                }
            }
        }
        if (includeLearning) {
            const learningCards = this.getLearningCards();
            for (const card of learningCards) {
                if (!usedCardIds.has(card.id) && sessionCards.length < cardCount) {
                    sessionCards.push(card);
                    usedCardIds.add(card.id);
                }
            }
        }
        if (includeNew) {
            const newCards = this.getNewCards();
            for (const card of newCards) {
                if (!usedCardIds.has(card.id) && sessionCards.length < cardCount) {
                    sessionCards.push(card);
                    usedCardIds.add(card.id);
                }
            }
        }

        // Log the card selection for debugging
        console.log(`Session card selection - Total unique cards: ${sessionCards.length}`);
        console.log('Card breakdown:', {
            dueCards: sessionCards.filter(card => window.FSRS.getDueCards([card]).length).length,
            learningCards: sessionCards.filter(card => window.FSRS.getLearningCards([card]).length).length,
            newCards: sessionCards.filter(card => window.FSRS.getNewCards([card]).length).length
        });

        this.currentSession = {
            cards: sessionCards,
            currentIndex: 0,
            startTime: new Date(),
            results: []
        };

        console.log(`Started learning session with ${sessionCards.length} unique cards`);
        return this.currentSession;
    }

    // Get current card in session
    getCurrentCard() {
        if (!this.currentSession || this.currentSession.currentIndex >= this.currentSession.cards.length) {
            return null;
        }
        return this.currentSession.cards[this.currentSession.currentIndex];
    }

    // Review current card
    async reviewCurrentCard(quality) {
        if (!this.currentSession || !this.getCurrentCard()) {
            throw new Error('No active session or current card');
        }

        const card = this.getCurrentCard();
        const reviewedCard = window.ChineseCardManager.reviewCard(card, quality);

        // Update card in our array
        const cardIndex = this.cards.findIndex(c => c.id === card.id);
        if (cardIndex !== -1) {
            this.cards[cardIndex] = reviewedCard;
        }

        // Get character name for recording
        const characterName = window.ChineseCardManager.getCharacterById(card.characterId);

        // Record result
        this.currentSession.results.push({
            cardId: card.id,
            characterId: card.characterId,
            character: characterName,
            quality: quality,
            timestamp: new Date()
        });

        // Move to next card
        this.currentSession.currentIndex++;

        // Save changes
        await this.saveCards();

        return {
            reviewedCard: reviewedCard,
            hasNextCard: this.currentSession.currentIndex < this.currentSession.cards.length
        };
    }

    // End current session and save results
    async endSession() {
        if (!this.currentSession) return null;

        const sessionEnd = new Date();
        const sessionDuration = sessionEnd - this.currentSession.startTime;

        const sessionSummary = {
            cardsReviewed: this.currentSession.results.length,
            sessionDuration: sessionDuration,
            averageQuality: this.currentSession.results.reduce((sum, r) => sum + r.quality, 0) / this.currentSession.results.length,
            newCardsLearned: this.currentSession.results.filter(r => r.quality >= 3).length,
            cardsNeedingReview: this.currentSession.results.filter(r => r.quality <= 2).length,
            endTime: sessionEnd
        };

        // Save session summary to storage
        const sessions = await this.getSessionHistory();
        sessions.push({
            ...sessionSummary,
            startTime: this.currentSession.startTime,
            id: Date.now().toString()
        });

        // Keep only last 50 sessions
        if (sessions.length > 50) {
            sessions.splice(0, sessions.length - 50);
        }

        await chrome.storage.local.set({ edbSessionHistory: sessions });

        this.currentSession = null;
        console.log('Session ended and saved');

        return sessionSummary;
    }

    // Get session history
    async getSessionHistory() {
        try {
            const result = await chrome.storage.local.get('edbSessionHistory');
            return result.edbSessionHistory || [];
        } catch (error) {
            console.error('Error loading session history:', error);
            return [];
        }
    }

    // Get learning statistics
    async getStats() {
        const stats = window.ChineseCardManager.getStats(this.cards);

        // Add more detailed statistics
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const dueToday = this.cards.filter(card => {
            const dueDate = new Date(card.due);
            return dueDate >= today && dueDate < tomorrow;
        }).length;

        const sessions = await this.getSessionHistory();
        const todaySessions = sessions.filter(session => {
            const sessionDate = new Date(session.startTime);
            return sessionDate >= today && sessionDate < tomorrow;
        });

        const totalCardsToday = todaySessions.reduce((sum, session) => sum + session.cardsReviewed, 0);

        return {
            ...stats,
            dueToday,
            totalCardsToday,
            totalSessions: sessions.length,
            averageSessionLength: sessions.length > 0 ?
                Math.round(sessions.reduce((sum, session) => sum + session.cardsReviewed, 0) / sessions.length) : 0
        };
    }

    // Remove a card from learning
    async removeCard(characterId) {
        const cardIndex = this.cards.findIndex(card => card.characterId === characterId);
        if (cardIndex !== -1) {
            this.cards.splice(cardIndex, 1);
            await this.saveCards();
            console.log(`Removed card for character ${characterId}`);
            return true;
        }
        return false;
    }

    // Reset a card to new state
    async resetCard(characterId) {
        const card = this.getCard(characterId);
        if (card) {
            const newCard = window.ChineseCardManager.createCharacterCard(card.character, card.characterId);
            const cardIndex = this.cards.findIndex(c => c.id === card.id);
            this.cards[cardIndex] = newCard;
            await this.saveCards();
            console.log(`Reset card for character ${characterId}`);
            return newCard;
        }
        return null;
    }

    // Listen for storage changes from other contexts
    setupStorageListener() {
        chrome.storage.onChanged.addListener((changes, namespace) => {
            if (namespace === 'local' && changes.edbLearningCards) {
                this.cards = changes.edbLearningCards.newValue || [];
                console.log('Learning cards updated from storage change');
            }
        });
    }

    // Export learning data
    async exportData() {
        const stats = await this.getStats();
        const sessions = await this.getSessionHistory();

        return {
            cards: this.cards,
            stats: stats,
            sessions: sessions,
            exportDate: new Date().toISOString()
        };
    }

    // Import learning data
    async importData(data) {
        if (data.cards && Array.isArray(data.cards)) {
            this.cards = data.cards;
            await this.saveCards();
        }
        if (data.sessions && Array.isArray(data.sessions)) {
            await chrome.storage.local.set({ edbSessionHistory: data.sessions });
        }
        console.log('Learning data imported successfully');
    }
}

// Export for use in the extension
window.LearningManager = new LearningManager();
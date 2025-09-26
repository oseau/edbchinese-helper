// FSRS bundled version for Chrome extension
// This file contains the essential FSRS functionality for the extension

class FSRSAlgorithm {
    constructor() {
        // FSRS parameters (simplified version)
        this.params = {
            w: [0.4, 0.6, 2.4, 5.8, 4.93, 0.94, 0.86, 0.01, 1.49, 0.14, 0.94, 2.18, 0.05, 0.34, 1.26, 0.29, 2.61],
            requestRetention: 0.9,
            maximumInterval: 36500
        };
    }

    // Create a new card
    createCard() {
        return {
            id: Date.now().toString(),
            due: new Date(),
            stability: 0,
            difficulty: 0,
            elapsedDays: 0,
            scheduledDays: 0,
            reps: 0,
            lapses: 0,
            state: 'new', // new, learning, review, relearning
            lastReview: null
        };
    }

    // Update card after review
    updateCard(card, quality) {
        // Quality: 1=again, 2=hard, 3=good, 4=easy
        const now = new Date();

        if (card.state === 'new') {
            // First review
            card.state = 'learning';
            card.reps = 1;

            // Initial intervals based on quality
            if (quality === 1) {
                card.scheduledDays = 0; // Same day
            } else if (quality === 2) {
                card.scheduledDays = 1;
            } else if (quality === 3) {
                card.scheduledDays = 3;
            } else { // quality === 4
                card.scheduledDays = 7;
            }

            card.stability = card.scheduledDays;
            card.difficulty = Math.max(1, Math.min(10, 5 - (quality - 3)));

        } else {
            // Subsequent reviews
            card.reps++;
            card.lastReview = card.due;
            card.elapsedDays = Math.floor((now - card.due) / (1000 * 60 * 60 * 24));

            // Update stability and difficulty based on quality
            const difficultyDecay = -0.5;
            const stabilityDecay = -0.8;
            const difficultyGrowth = 1.2;
            const stabilityGrowth = 1.3;

            if (quality === 1) { // Again
                card.difficulty = Math.min(10, card.difficulty + 2);
                card.stability = Math.max(0.1, card.stability * stabilityDecay);
                card.scheduledDays = Math.max(1, Math.floor(card.stability));
                card.lapses++;
            } else if (quality === 2) { // Hard
                card.difficulty = Math.min(10, card.difficulty + 0.5);
                card.stability = card.stability * 0.85;
                card.scheduledDays = Math.max(1, Math.floor(card.stability * 1.2));
            } else if (quality === 3) { // Good
                card.difficulty = Math.max(1, card.difficulty + difficultyDecay);
                card.stability = card.stability * stabilityGrowth;
                card.scheduledDays = Math.floor(card.stability * card.difficulty);
            } else { // Easy
                card.difficulty = Math.max(1, card.difficulty - 1);
                card.stability = card.stability * stabilityGrowth * 1.5;
                card.scheduledDays = Math.floor(card.stability * card.difficulty * 1.5);
            }

            card.state = 'review';
        }

        // Set next due date
        card.due = new Date(now.getTime() + card.scheduledDays * 24 * 60 * 60 * 1000);

        return card;
    }

    // Calculate next review date
    getNextReview(card) {
        return new Date(card.due);
    }

    // Check if card is due for review
    isDue(card) {
        return new Date() >= card.due;
    }

    // Get cards due for review
    getDueCards(cards) {
        const now = new Date();
        return cards.filter(card => new Date(card.due) <= now);
    }

    // Get new cards (never reviewed)
    getNewCards(cards) {
        return cards.filter(card => card.state === 'new');
    }

    // Get learning cards
    getLearningCards(cards) {
        return cards.filter(card => card.state === 'learning');
    }
}

// Create instances that work in both service worker and window contexts
const fsrsInstance = new FSRSAlgorithm();

// Helper functions for managing Chinese character cards (ID-only storage)
const chineseCardManager = {
    // Create a new Chinese character card (ID only)
    createCharacterCard(characterId) {
        const card = fsrsInstance.createCard();
        return {
            ...card,
            characterId: characterId,
            created: new Date(),
            type: 'character'
        };
    },

    // Update card with review result
    reviewCard(card, quality) {
        return fsrsInstance.updateCard(card, quality);
    },

    // Get review statistics
    getStats(cards) {
        const total = cards.length;
        const newCards = fsrsInstance.getNewCards(cards).length;
        const learningCards = fsrsInstance.getLearningCards(cards).length;
        const dueCards = fsrsInstance.getDueCards(cards).length;
        const reviewedCards = cards.filter(card => card.reps > 0).length;

        return {
            total,
            new: newCards,
            learning: learningCards,
            due: dueCards,
            reviewed: reviewedCards,
            retention: reviewedCards > 0 ? ((reviewedCards - cards.filter(card => card.lapses > 0).length) / reviewedCards * 100).toFixed(1) : 0
        };
    },

    // Get character from CHARACTERS data using ID
    getCharacterById(characterId) {
        if (typeof CHARACTERS !== 'undefined') {
            const character = CHARACTERS.find(char => char.id === characterId);
            return character ? character.word : characterId;
        }
        return characterId;
    },

    // Get EDB URL for character
    getCharacterUrl(characterId) {
        return `https://www.edbchinese.hk/lexlist_ch/result.jsp?id=${characterId}`;
    }
};

// Export for use in popup (window context)
if (typeof window !== 'undefined') {
    window.FSRS = fsrsInstance;
    window.ChineseCardManager = chineseCardManager;
}
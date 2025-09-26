class EDBChineseHelper {
    constructor() {
        this.words = [];
        this.currentTab = 'index';
        this.nextCardTimeout = null; // Track pending setTimeout calls
        this.init();
    }

    async init() {
        await this.generateWordList();
        this.setupEventListeners();
        this.renderWordList();

        // Initialize learning stats if LearningManager is available
        setTimeout(() => {
            this.updateLearningStats();
        }, 100);
    }

    async generateWordList() {
        // Load character data from characters.js
        this.words = CHARACTERS.map(char => ({
            id: char.id,
            word: char.word,
            url: `https://www.edbchinese.hk/lexlist_ch/result.jsp?id=${char.id}`
        }));
    }

    setupEventListeners() {
        // Tab switching
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchTab(e.target.dataset.tab);
                if (e.target.dataset.tab === 'learn') {
                    this.updateLearningStats();
                }
            });
        });

        // Search functionality
        document.getElementById('search-btn').addEventListener('click', () => {
            this.searchWords();
        });

        document.getElementById('search-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.searchWords();
            }
        });

        // Learning controls
        document.getElementById('start-learn').addEventListener('click', () => {
            this.startLearning();
        });

        document.getElementById('manage-cards').addEventListener('click', () => {
            this.showManageView();
        });

        // Session controls - show-answer button removed

        document.getElementById('end-session').addEventListener('click', () => {
            if (confirm('確定要結束當前學習會話嗎？')) {
                this.endSession();
            }
        });

        // Rating buttons removed - now handled in content script toolbar

        // Management controls
        document.getElementById('export-data').addEventListener('click', () => {
            this.exportLearningData();
        });

        document.getElementById('import-data').addEventListener('click', () => {
            this.importLearningData();
        });

        document.getElementById('clear-all-data').addEventListener('click', () => {
            this.clearAllLearningData();
        });

        // Test controls
        document.getElementById('start-test').addEventListener('click', () => {
            this.startTest();
        });

        // Global functions for management view
        window.resetCard = async (characterId) => {
            if (!window.LearningManager) return;
            await window.LearningManager.resetCard(characterId);
            this.loadManageViewData();
            this.updateLearningStats();
            this.showNotification('卡片已重置');
        };

        window.removeCard = async (characterId) => {
            if (!window.LearningManager) return;
            await window.LearningManager.removeCard(characterId);
            this.loadManageViewData();
            this.updateLearningStats();
            this.showNotification('卡片已删除');
        };

        // Handle messages from iframe (no longer used, keeping for compatibility)
        window.addEventListener('message', (event) => {
            if (event.data.action === 'cardRated') {
                // Card was rated, but we now handle this through handleCardRated method
                console.log('Received cardRated message, but this is deprecated');
            }
        });
    }

    switchTab(tabName) {
        // Update tab buttons
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

        // Update tab content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        document.getElementById(`${tabName}-tab`).classList.add('active');

        this.currentTab = tabName;
    }

    renderWordList(wordsToRender = this.words) {
        const wordList = document.getElementById('word-list');

        if (wordsToRender.length === 0) {
            wordList.innerHTML = '<div class="loading">沒有找到漢字</div>';
            return;
        }

        // Get learning cards if available
        const learningCards = window.LearningManager ? window.LearningManager.cards : [];

        wordList.innerHTML = wordsToRender.map(word => {
            const card = learningCards.find(c => c.characterId === word.id);
            let cardInfo = '';

            if (card) {
                const dueDate = new Date(card.due);
                const now = new Date();
                const isDue = dueDate <= now;
                const daysUntilDue = Math.ceil((dueDate - now) / (1000 * 60 * 60 * 24));

                let statusText = '';
                let statusClass = '';

                if (card.state === 'new') {
                    statusText = '新卡片';
                    statusClass = 'status-new';
                } else if (isDue) {
                    statusText = '待複習';
                    statusClass = 'status-due';
                } else if (daysUntilDue <= 7) {
                    statusText = `${daysUntilDue}天後`;
                    statusClass = 'status-soon';
                } else {
                    statusText = `${daysUntilDue}天後`;
                    statusClass = 'status-later';
                }

                cardInfo = `
                    <div class="word-card-info">
                        <span class="word-card-status ${statusClass}">${statusText}</span>
                        <span class="word-card-reviews">複習${card.reps}次</span>
                    </div>
                `;
            }

            return `
                <div class="word-item" data-id="${word.id}">
                    <div class="word-main">
                        <div class="word-character">${word.word}</div>
                        <div class="word-id">ID: ${word.id}</div>
                    </div>
                    ${cardInfo}
                </div>
            `;
        }).join('');

        // Add click listeners to word items
        document.querySelectorAll('.word-item').forEach(item => {
            item.addEventListener('click', () => {
                this.showWordDetail(item.dataset.id);
            });
        });
    }

    searchWords() {
        const searchTerm = document.getElementById('search-input').value.toLowerCase().trim();

        if (!searchTerm) {
            this.renderWordList();
            return;
        }

        const filteredWords = this.words.filter(word =>
            word.word.includes(searchTerm) ||
            word.id.includes(searchTerm)
        );

        this.renderWordList(filteredWords);
    }

    showWordDetail(wordId) {
        const word = this.words.find(w => w.id === wordId);
        if (!word) return;

        // Open the word detail page in a new tab
        chrome.tabs.create({ url: word.url });
    }

    async startLearning() {
        if (!window.LearningManager) {
            console.error('LearningManager not available');
            return;
        }

        const wordCount = parseInt(document.getElementById('word-count').value);
        const session = window.LearningManager.startSession({
            cardCount: wordCount,
            includeNew: true,
            includeDue: true,
            includeLearning: true
        });

        if (session.cards.length === 0) {
            this.showNotification('沒有可學習的卡片，請先添加一些漢字到學習列表');
            return;
        }

        this.currentSession = session;
        this.isSessionActive = true;

        // Store session in chrome.storage for cross-tab communication
        await chrome.storage.local.set({
            currentLearningSession: {
                cards: session.cards,
                currentIndex: 0,
                startTime: Date.now()
            }
        });

        this.showSessionActive();
        this.openNextCard();
    }

    showSessionActive() {
        this.hideAllLearningViews();
        document.getElementById('session-view').style.display = 'block';
        document.getElementById('session-active').style.display = 'block';
        document.getElementById('start-learn').textContent = '学习中...';
        document.getElementById('start-learn').disabled = true;

        this.updateSessionProgress();
    }

    async openNextCard() {
        console.log('🚀 openNextCard called - checking session state');

        if (!this.currentSession || !this.isSessionActive) {
            console.log('❌ No active popup session, cannot open next card');
            return;
        }

        // Check if session still exists in storage
        const sessionResult = await chrome.storage.local.get('currentLearningSession');
        const backgroundSession = sessionResult.currentLearningSession;

        if (!backgroundSession) {
            console.log('❌ Session no longer exists in storage, ending session');
            await this.endSession();
            return;
        }

        // Check if LearningManager has an active session
        if (!window.LearningManager || !window.LearningManager.currentSession) {
            console.log('❌ LearningManager session is gone, ending session');
            await this.endSession();
            return;
        }

        // Sync popup session with background session
        this.currentSession.currentIndex = backgroundSession.currentIndex;

        const card = window.LearningManager.getCurrentCard();
        if (!card) {
            console.log('❌ No current card available, ending session');
            await this.endSession();
            return;
        }

        // Final safety check - make sure we're not trying to open a card when session is complete
        if (this.currentSession.currentIndex >= this.currentSession.cards.length) {
            console.log('❌ Session complete, cannot open more cards');
            await this.endSession();
            return;
        }

        console.log(`✅ Opening card ${card.characterId} at index ${this.currentSession.currentIndex}`);

        // Open the EDB page in a new tab
        const url = `https://www.edbchinese.hk/lexlist_ch/result.jsp?id=${card.characterId}`;

        try {
            await chrome.tabs.create({ url: url, active: true });
            console.log(`Opened character page: ${card.characterId}`);

            // Update progress display
            this.updateSessionProgress();
        } catch (error) {
            console.error('Error opening tab:', error);
            this.showNotification('無法打開頁面，請重試');
        }
    }

    hideAllLearningViews() {
        document.getElementById('session-view').style.display = 'none';
        document.getElementById('manage-view').style.display = 'none';
        document.getElementById('default-view').style.display = 'none';
    }

    updateSessionProgress() {
        if (!this.currentSession) return;

        const remaining = this.currentSession.cards.length - this.currentSession.currentIndex;
        const cardsLeft = document.getElementById('session-cards-left');
        const progressFill = document.getElementById('session-progress');
        const progressText = document.getElementById('session-text');

        if (cardsLeft) {
            cardsLeft.textContent = `${remaining}/${this.currentSession.cards.length}`;
        }

        const progress = (this.currentSession.currentIndex / this.currentSession.cards.length) * 100;
        if (progressFill) {
            progressFill.style.width = `${progress}%`;
        }
        if (progressText) {
            progressText.textContent = `${this.currentSession.currentIndex}/${this.currentSession.cards.length}`;
        }
    }

    async handleCardRated(cardId, quality) {
        console.log('🔄 handleCardRated called with:', { cardId, quality, hasActiveSession: this.isSessionActive });

        if (!this.currentSession || !this.isSessionActive) {
            console.log('❌ No active session, ignoring card rating');
            return;
        }

        try {
            // Check if session still exists in storage (might have been completed by content script)
            const sessionResult = await chrome.storage.local.get('currentLearningSession');
            const backgroundSession = sessionResult.currentLearningSession;

            console.log('📋 Background session check:', { exists: !!backgroundSession });

            if (!backgroundSession) {
                console.log('Session no longer exists in storage, ending popup session');
                await this.endSession();
                return;
            }

            // Sync popup session with background session
            this.currentSession.currentIndex = backgroundSession.currentIndex;

            // Check if LearningManager still has an active session
            if (!window.LearningManager || !window.LearningManager.currentSession) {
                console.log('LearningManager session is gone, ending popup session');
                await this.endSession();
                return;
            }

            // Rate the card through LearningManager
            const result = await window.LearningManager.reviewCurrentCard(quality);
            console.log('📊 LearningManager review result:', result);

            if (result.hasNextCard) {
                // Only open next card if background session still exists
                const updatedSessionResult = await chrome.storage.local.get('currentLearningSession');
                if (updatedSessionResult.currentLearningSession) {
                    console.log('✅ Opening next card after delay');
                    // Clear any existing timeout first
                    if (this.nextCardTimeout) {
                        clearTimeout(this.nextCardTimeout);
                    }
                    // Set new timeout and track it
                    this.nextCardTimeout = setTimeout(() => {
                        this.openNextCard();
                        this.nextCardTimeout = null; // Clear reference after execution
                    }, 1000);
                } else {
                    console.log('Session completed by background script, ending popup session');
                    await this.endSession();
                }
            } else {
                console.log('🎉 LearningManager reports session completed');
                // Session completed
                await this.endSession();
            }

            // Update stored session
            await chrome.storage.local.set({
                currentLearningSession: {
                    cards: this.currentSession.cards,
                    currentIndex: this.currentSession.currentIndex,
                    startTime: this.currentSession.startTime
                }
            });

        } catch (error) {
            console.error('Error handling card rating:', error);
            this.showNotification('評分處理失敗');
        }
    }

    // Removed showAnswer method - no longer needed with new design

    // Removed rateCard method - now handled by handleCardRated

    async endSession() {
        if (!this.currentSession) return;

        try {
            // Clear any pending timeouts first
            if (this.nextCardTimeout) {
                clearTimeout(this.nextCardTimeout);
                this.nextCardTimeout = null;
                console.log('🕒 Cleared pending next card timeout');
            }

            // End LearningManager session first
            if (window.LearningManager && window.LearningManager.currentSession) {
                await window.LearningManager.endSession();
            }

            // Clear all session state from storage
            await chrome.storage.local.remove(['currentLearningSession', 'currentPopupSession']);

            this.hideAllLearningViews();
            document.getElementById('default-view').style.display = 'block';

            // Show session summary
            const defaultView = document.getElementById('default-view');
            defaultView.innerHTML = `
                <h3>學習會話完成！</h3>
                <div class="session-summary">
                    <p>學習會話已結束</p>
                    <p>感謝你的學習！</p>
                </div>
                <button onclick="location.reload()" class="primary-btn">繼續學習</button>
            `;

            this.currentSession = null;
            this.isSessionActive = false;
            document.getElementById('start-learn').textContent = '開始學習';
            document.getElementById('start-learn').disabled = false;

            await this.updateLearningStats();

        } catch (error) {
            console.error('Error ending session:', error);
            this.showNotification('結束會話失敗');
        }
    }

    async updateLearningStats() {
        if (!window.LearningManager) return;

        try {
            const stats = await window.LearningManager.getStats();

            document.getElementById('total-cards').textContent = stats.total;
            document.getElementById('due-today').textContent = stats.dueToday;
            document.getElementById('new-cards').textContent = stats.new;
            document.getElementById('retention-rate').textContent = `${stats.retention}%`;
        } catch (error) {
            console.error('Error updating learning stats:', error);
        }
    }

    showManageView() {
        this.hideAllLearningViews();
        document.getElementById('manage-view').style.display = 'block';
        this.loadManageViewData();
    }

    async loadManageViewData() {
        if (!window.LearningManager) return;

        try {
            const cards = window.LearningManager.cards;
            const cardList = document.getElementById('card-list');

            if (cards.length === 0) {
                cardList.innerHTML = '<p>暫無學習卡片</p>';
                return;
            }

            cardList.innerHTML = cards.map(card => {
                const dueDate = new Date(card.due);
                const statusText = this.getCardStatusText(card);

                // Get the actual character to display
                let displayCharacter = card.character || card.word;

                // If we don't have the character stored, look it up from CHARACTERS
                if (!displayCharacter && typeof CHARACTERS !== 'undefined') {
                    const characterData = CHARACTERS.find(char => char.id === card.characterId);
                    if (characterData) {
                        displayCharacter = characterData.word;
                    }
                }

                // Final fallback to characterId if nothing else works
                if (!displayCharacter) {
                    displayCharacter = card.characterId;
                }

                return `
                    <div class="card-item">
                        <div class="card-character">${displayCharacter}</div>
                        <div class="card-status">${statusText}</div>
                        <div class="card-actions">
                            <button onclick="window.resetCard('${card.characterId}')">重置</button>
                            <button onclick="window.removeCard('${card.characterId}')">刪除</button>
                        </div>
                    </div>
                `;
            }).join('');

        } catch (error) {
            console.error('Error loading manage view data:', error);
        }
    }

    getCardStatusText(card) {
        const dueDate = new Date(card.due);
        const now = new Date();
        const isOverdue = dueDate < now;
        const daysUntilDue = Math.ceil((dueDate - now) / (1000 * 60 * 60 * 24));

        if (card.state === 'new') {
            return '新卡片';
        } else if (isOverdue) {
            return `逾期 ${Math.abs(daysUntilDue)} 天`;
        } else if (daysUntilDue === 0) {
            return '今日複習';
        } else {
            return `${daysUntilDue} 天後`;
        }
    }

    async exportLearningData() {
        if (!window.LearningManager) return;

        try {
            const data = await window.LearningManager.exportData();
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `edb-learning-data-${new Date().toISOString().split('T')[0]}.json`;
            a.click();
            URL.revokeObjectURL(url);
            this.showNotification('數據匯出成功');
        } catch (error) {
            console.error('Error exporting data:', error);
            this.showNotification('數據匯出失敗');
        }
    }

    async importLearningData() {
        if (!window.LearningManager) return;

        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (file) {
                try {
                    const text = await file.text();
                    const data = JSON.parse(text);
                    await window.LearningManager.importData(data);
                    await this.updateLearningStats();
                    this.showNotification('數據匯入成功');
                } catch (error) {
                    console.error('Error importing data:', error);
                    this.showNotification('數據匯入失敗，請檢查文件格式');
                }
            }
        };
        input.click();
    }

    async clearAllLearningData() {
        if (!window.LearningManager) return;

        if (confirm('確定要清除所有學習數據嗎？此操作無法撤銷。')) {
            try {
                window.LearningManager.cards = [];
                await window.LearningManager.saveCards();
                await chrome.storage.local.remove(['edbSessionHistory']);
                await this.updateLearningStats();
                this.showNotification('所有學習數據已清除');
                location.reload();
            } catch (error) {
                console.error('Error clearing data:', error);
                this.showNotification('清除數據失敗');
            }
        }
    }

    showNotification(message) {
        const notification = document.createElement('div');
        notification.className = 'notification';
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #27ae60;
            color: white;
            padding: 12px 20px;
            border-radius: 4px;
            z-index: 10000;
            animation: slideIn 0.3s ease;
        `;

        document.body.appendChild(notification);
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }

    startTest() {
        const testContent = document.getElementById('test-content');

        testContent.innerHTML = `
            <h3>測試模式</h3>
            <p>準備開始測試...</p>
            <button id="start-quiz">開始測試</button>
        `;

        document.getElementById('start-quiz').addEventListener('click', () => {
            // TODO: Implement test logic
            console.log('Start quiz');
        });
    }

    getRandomWords(count) {
        const shuffled = [...this.words].sort(() => 0.5 - Math.random());
        return shuffled.slice(0, count);
    }
}

// Initialize the extension
document.addEventListener('DOMContentLoaded', () => {
    new EDBChineseHelper();
});
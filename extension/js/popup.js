class EDBChineseHelper {
    constructor() {
        this.words = [];
        this.currentTab = 'index';
        this.init();
    }

    async init() {
        await this.generateWordList();
        this.setupEventListeners();
        this.renderWordList();
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

        // Test controls
        document.getElementById('start-test').addEventListener('click', () => {
            this.startTest();
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
            wordList.innerHTML = '<div class="loading">没有找到汉字</div>';
            return;
        }

        wordList.innerHTML = wordsToRender.map(word => `
            <div class="word-item" data-id="${word.id}">
                <div class="word-character">${word.word}</div>
                <div class="word-id">ID: ${word.id}</div>
            </div>
        `).join('');

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

    startLearning() {
        const wordCount = parseInt(document.getElementById('word-count').value);
        const learnContent = document.getElementById('learn-content');

        // Get random words for learning
        const randomWords = this.getRandomWords(wordCount);

        learnContent.innerHTML = `
            <h3>开始学习 ${wordCount} 个汉字</h3>
            <p>已选择 ${randomWords.length} 个汉字进行学习</p>
            <button id="next-word">下一个</button>
        `;

        document.getElementById('next-word').addEventListener('click', () => {
            // TODO: Implement learning logic
            console.log('Next word');
        });
    }

    startTest() {
        const testContent = document.getElementById('test-content');

        testContent.innerHTML = `
            <h3>测试模式</h3>
            <p>准备开始测试...</p>
            <button id="start-quiz">开始测试</button>
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
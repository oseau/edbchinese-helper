# EDB Chinese Helper

A Chrome extension that helps you learn Chinese characters from the Hong Kong Education Bureau's Chinese character list (香港小學學習字詞表) using spaced repetition learning.

## Features

### 📚 Character Index (詞表)
- **Complete Character List**: Browse all 4,762 Chinese characters from the EDB database
- **Search Functionality**: Find characters by Chinese characters or ID
- **Inline Status Display**: See learning progress directly in the character list
  - 🔵 新卡片 (New cards)
  - 🔴 待複習 (Due for review)
  - 🟠 X天後 (Due within 7 days)
  - ⚫ X天後 (Due later)
- **Review Count**: Track how many times you've reviewed each character

### 🎯 Spaced Repetition Learning (學習)
- **FSRS Algorithm**: Implements the Free Spaced Repetition Scheduler for optimal review timing
- **Smart Session Management**: Automatic tab navigation and session tracking
- **Due Date Checking**: Prevents premature reviews to maintain algorithm accuracy
- **Progress Tracking**: Visual progress bars and session statistics
- **Flexible Learning Sessions**: Choose 10, 20, or 50 characters per session

### 📊 Learning Dashboard
- **Statistics Overview**: Track total cards, due today, new cards, and retention rate
- **Card Management**: Export/import learning data, reset individual cards
- **Session History**: Review past learning sessions and performance
- **Real-time Updates**: Live statistics as you progress

### 🔧 Interactive Features
- **Auto-play Pronunciation**: Cantonese and Mandarin audio playback
- **Handwriting Animation**: Stroke order visualization
- **Rating Interface**: Quality-based rating system (Again, Hard, Good, Easy)
- **Automatic Tab Management**: Opens next character automatically after rating
- **Session Completion**: Clean session end with automatic tab closure

## Technical Implementation

### Core Components
- **FSRS Algorithm**: Advanced spaced repetition scheduling for optimal memory retention
- **Chrome Extension Architecture**: Content script, background script, and popup interface
- **Chrome Storage API**: Persistent learning data storage
- **Real-time Synchronization**: Session state management across components

### File Structure
```
edbchinese-helper/
├── extension/                 # Chrome extension
│   ├── js/
│   │   ├── characters.js          # Character database
│   │   ├── fsrs-bundle.js         # FSRS algorithm implementation
│   │   ├── learning-manager.js    # Learning session management
│   │   ├── popup.js              # Popup interface logic
│   │   ├── content.js            # Page content script
│   │   └── background.js         # Background service worker
│   ├── css/
│   │   └── popup.css             # Popup styling
│   ├── popup.html                 # Main popup interface
│   ├── manifest.json             # Extension manifest
│   └── images/                   # Extension icons
├── words_data/                # Fetched character data
│   ├── all_words.json           # Complete character database
│   └── summary.json             # Fetch statistics and summary
├── python_scripts/            # Data fetching utilities
│   ├── fetch-words.py          # EDB data fetcher
│   ├── requirements.txt        # Python dependencies
│   └── Dockerfile             # Containerized fetcher
├── package.json               # Node.js dependencies
├── package-lock.json          # Locked dependencies
├── Makefile                   # Build and fetch commands
├── docker-compose.yml         # Docker development environment
└── README.md                  # This file
```

## Installation

### Prerequisites
- Python 3.13+ with uv for dependency management
- Docker (optional, for data fetching)
- Chrome browser with extension developer mode

### Setup Instructions

1. **Clone this repository**
   ```bash
   git clone <repository-url>
   cd edbchinese-helper
   ```

2. **Fetch Character Data** (Choose one method)

   **Using Docker (Recommended):**
   ```bash
   make fetch-words
   ```

   **Using Python directly:**
   ```bash
   uv run fetch-words.py
   ```

3. **Install Extension**
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode" in the top right
   - Click "Load unpacked" and select the `extension` folder
   - The extension will appear in your Chrome toolbar

### Development Commands
```bash
# Fetch words using Docker
make fetch-words

# Run fetch script directly with uv
uv run fetch-words.py

# Run main application (if applicable)
uv run main.py
```

## Data Fetching

### Overview
The project includes a Python data collection component that fetches word data from the Hong Kong Education Bureau's official website (https://www.edbchinese.hk/lexlist_ch/).

### Features
- Fetches complete character database (IDs 0001-4762)
- Implements rate limiting (0.2s delay between requests)
- Handles errors gracefully with progress tracking
- Outputs structured JSON data to `words_data/` directory
- Docker containerization for consistent SSL handling

### Data Structure
- **`words_data/all_words.json`**: Complete character database with IDs and Chinese characters
- **`words_data/summary.json`**: Fetch statistics including success rate and total attempts
- **Character Format**: Each word contains ID (4-digit format) and Chinese character

### Technical Details
- Uses `httpx` for HTTP requests with SSL verification disabled for Docker compatibility
- UTF-8 encoding for proper Chinese character support
- Progress updates and error reporting during fetch process
- Automatic retry and interruption handling

## Usage

### Getting Started
1. Click the extension icon to open the popup
2. Browse characters in the "詞表" tab
3. Click "添加到學習列表" to add characters to your learning deck
4. Switch to the "學習" tab to see your learning statistics

### Learning Sessions
1. Click "開始學習" to start a learning session
2. Select how many characters to review (10, 20, or 50)
3. The extension will automatically open character pages in new tabs
4. Use the rating buttons (再次/困難/良好/簡單) to rate your recall
5. The system automatically opens the next character and closes the current tab

### Managing Your Learning Deck
1. Click "管理卡片" in the learning tab
2. View all your learning cards with their current status
3. Export your data for backup or import previous data
4. Reset individual cards or clear all data if needed

## Data Management

### Storage
- All learning data is stored locally in Chrome's storage
- Card information includes: review history, due dates, difficulty, and stability metrics
- Session history tracks your learning progress over time

### Backup/Restore
- **Export**: Save your learning data as a JSON file
- **Import**: Restore learning data from a previous export
- **Reset**: Clear individual cards or all learning data

## Contributing

This project is designed to help students learn Chinese characters effectively using spaced repetition. If you find issues or have suggestions for improvements, please feel free to contribute.

## License

This project is for educational purposes to help with Chinese character learning from the Hong Kong Education Bureau's official word list.

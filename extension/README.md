# EDB Chinese Helper Extension

This directory contains the Chrome extension for EDB Chinese Helper.

## Installation

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" in the top right
3. Click "Load unpacked" and select this `extension/` directory

## Features

- **词表 (Word List)**: Browse all Chinese characters from the Hong Kong Education Bureau word list
- **学习 (Learning)**: Practice characters with spaced repetition
- **测试 (Testing)**: Test your knowledge of learned characters
- **Content Script**: Enhanced functionality on edbchinese.hk website

## File Structure

```
extension/
├── manifest.json          # Extension manifest
├── popup.html             # Main popup interface
├── popup.js              # Popup functionality
├── background.js         # Background service worker
├── content.js            # Content script for edbchinese.hk
├── css/
│   ├── popup.css         # Popup styles
│   └── content.css       # Content script styles
├── js/
│   ├── popup.js          # Popup logic
│   ├── background.js     # Background logic
│   └── content.js        # Page enhancements
├── data/
│   ├── all_words.json    # Word data
│   └── summary.json      # Fetch statistics
└── images/               # Extension icons (to be added)
```

## Development

- Make changes to the files in this directory
- Reload the extension in Chrome to see changes
- Check the browser console for debugging information

## Permissions

- `storage`: Store learning progress and settings
- `activeTab`: Access current tab for content script
- `scripting`: Inject content scripts
- Content scripts run on `https://www.edbchinese.hk/*`
# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

edbchinese-helper is a Chrome extension designed to help users learn Chinese characters from the Hong Kong Education Bureau's Chinese character list (香港小學學習字詞表). The project includes a data collection component that fetches word data from the official website.

## Development Environment

This project uses Python 3.13+ with uv for dependency management. The main development commands are:

- `make fetch-words` - Fetch words from edbchinese.hk using Docker
- `uv run fetch-words.py` - Alternative way to run the fetch script directly
- `uv run main.py` - Run the main application

## Key Components

### Data Fetching (`fetch-words.py`)
- Fetches word data from IDs 0001 to 4762 from https://www.edbchinese.hk/lexlist_ch/
- Uses httpx for HTTP requests with SSL verification disabled for Docker compatibility
- Implements rate limiting (0.2s delay between requests) to be respectful to the server
- Outputs data to `words_data/` directory as JSON files
- Handles errors gracefully and provides progress updates

### Data Structure
- `words_data/all_words.json` - Contains all fetched words with their IDs and Chinese characters
- `words_data/summary.json` - Contains fetch statistics (success rate, total attempts, etc.)
- Each word has an ID (4-digit format) and the Chinese character

### Chrome Extension Architecture
While the main Chrome extension files are not yet present in the repository, the planned features include:
1. Index page - List all words from edbchinese
2. Word page - Display word, meaning, auto-play pronunciation and handwriting animation
3. Learning page - Select word lists for learning
4. Memory helper - Spaced repetition system for review scheduling
5. Test page - Knowledge testing functionality

## Important Notes

- The project uses Docker for data fetching to ensure consistent SSL handling
- SSL verification is disabled in the fetch script due to Docker environment constraints
- The fetch script implements proper error handling and interruption handling
- Data is stored in UTF-8 encoding to support Chinese characters
- The target website serves Hong Kong primary school Chinese characters, which are the core learning material
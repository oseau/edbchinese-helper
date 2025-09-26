#!/usr/bin/env python3
"""
Script to fetch words from edbchinese.hk
Fetches words from ID 0001 to 4762
"""

import json
import logging
import re
import ssl
import sys
import time
from pathlib import Path

import httpx

START = 1
END = 4762

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)

# Disable httpx request logging
logging.getLogger("httpx").setLevel(logging.WARNING)


def fetch_word_data(word_id):
    """Fetch word data for a specific ID"""
    base_url = "https://www.edbchinese.hk/lexlist_ch/result.jsp"
    params = {"id": f"{word_id:04d}"}

    try:
        # Create SSL context that doesn't verify certificates (for Docker)
        ssl_context = ssl.create_default_context()
        ssl_context.check_hostname = False
        ssl_context.verify_mode = ssl.CERT_NONE

        with httpx.Client(timeout=10.0, verify=False) as client:
            response = client.get(base_url, params=params)
            response.raise_for_status()
            return response.text
    except httpx.RequestError as e:
        logger.error(f"Error fetching word ID {word_id:04d}: {e}")
        return None


def parse_word_data(html_content):
    """Parse word data from HTML content"""
    if not html_content:
        return None

    # Parse HTML and find all comments
    # find "</span>(.)$" and extract the character
    match = re.search(r"</span>(.)$", html_content, re.MULTILINE)
    if match:
        return {"word": match.group(1)}
    return None


def main():
    """Main function to fetch all words"""
    logger.info("Starting to fetch words from edbchinese.hk...")

    # Create output directory
    output_dir = Path("words_data")
    output_dir.mkdir(exist_ok=True)

    # Track progress
    fetch_success = 0
    fetch_fail = 0
    all_words = []

    for word_id in range(START, END + 1):
        logger.info(f"Fetching word ID {word_id:04d}...")

        # Fetch the word data
        html_content = fetch_word_data(word_id)

        if html_content:
            # Parse the data
            word_data = parse_word_data(html_content)

            if word_data:
                word_data["id"] = f"{word_id:04d}"
                all_words.append(word_data)
                fetch_success += 1
            else:
                fetch_fail += 1
                logger.warning("✗ (no data)")
        else:
            fetch_fail += 1
            logger.error("✗ (fetch failed)")

        # Be respectful - add a small delay
        time.sleep(0.2)

        # Progress update every 100 words
        if word_id % 100 == 0:
            logger.info(
                f"Progress: {word_id}/{END}, "
                f"Success: {fetch_success}, "
                f"Failed: {fetch_fail}.",
            )

    # Save all words to a single file in the format you want
    all_words_file = output_dir / "all_words.json"
    output_data = {"words": all_words}
    with open(all_words_file, "w", encoding="utf-8") as f:
        json.dump(output_data, f, ensure_ascii=False, indent=2)

    # Save summary
    summary = {
        "total_attempted": END - START + 1,
        "successful_fetches": fetch_success,
        "failed_fetches": fetch_fail,
        "success_rate": f"{(fetch_success / (END - START + 1)) * 100:.2f}%",
    }

    summary_file = output_dir / "summary.json"
    with open(summary_file, "w", encoding="utf-8") as f:
        json.dump(summary, f, ensure_ascii=False, indent=2)

    logger.info(f"""\nFetching completed!
Total words attempted: {summary["total_attempted"]}
Successful fetches: {fetch_success}
Failed fetches: {fetch_fail}
Success rate: {summary["success_rate"]}
Data saved to: ./{output_dir.name}""")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        logger.info("\nFetching interrupted by user.")
        sys.exit(1)
    except Exception as e:
        logger.error(f"Unexpected error: {e}")
        sys.exit(1)

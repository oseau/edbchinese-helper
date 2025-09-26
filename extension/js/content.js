// Content script for EDB Chinese Helper
// Runs on edbchinese.hk pages

class EDBContentScript {
  constructor() {
    this.settings = {
      autoAudio: false, // Disabled by default for new installations
      autoCantonese: true, // Sub-options remain ready
      autoMandarin: true,
      autoStroke: false, // Disabled by default
      toolbarCollapsed: false, // Track toolbar collapsed state
    };
    this.audioEnabled = false; // Session-based audio permission
    this.audioContext = null; // AudioContext instance created on user gesture
    this.audioContextInitialized = false; // Track if AudioContext has been initialized
    this.strokeAnimationActive = false; // Prevent multiple stroke animation triggers
    this.audioAutoActive = false; // Track audio auto-play state
    this.toolbarCollapsed = false; // Track toolbar state
    this.showingAudioPrompt = false; // Track if we're showing audio prompt
    this.learningMode = false; // Track if we're in learning mode
    this.currentCardId = null; // Track current learning card ID
    this.init();
  }

  async init() {
    await this.loadSettings();
    await this.checkAudioPermission();
    this.makePageScrollable();
    this.setupPageEnhancements();
    this.setupUserInteraction();
    this.listenForMessages();
    this.setupPostMessageListener();
    this.setupAudioErrorSuppression(); // Add AudioContext error suppression
    this.checkLearningSession();
    this.checkIfCharacterShouldShowRating(); // New automatic learning mode detection
    this.checkIfCharacterAlreadyAdded();
  }

  async loadSettings() {
    try {
      const result = await chrome.storage.local.get("edbHelperSettings");
      if (result.edbHelperSettings) {
        this.settings = { ...this.settings, ...result.edbHelperSettings };
      }
    } catch (error) {
      console.error("Error loading settings:", error);
    }
  }

  async saveSettings() {
    try {
      await chrome.storage.local.set({ edbHelperSettings: this.settings });
    } catch (error) {
      console.error("Error saving settings:", error);
    }
  }

  async checkAudioPermission() {
    try {
      // Check if we have session-based audio permission via background script
      const response = await chrome.runtime.sendMessage({
        action: "checkAudioPermission",
      });
      if (response && response.enabled) {
        this.audioEnabled = true;
        console.log("Audio permission restored from session");
      }
    } catch (error) {
      console.error("Error checking audio permission:", error);
    }
  }

  async checkLearningSession() {
    try {
      // Check if there's an active learning session
      const result = await chrome.storage.local.get("currentLearningSession");
      const session = result.currentLearningSession;

      if (session && session.cards && session.cards.length > 0) {
        console.log(
          "Active learning session found with",
          session.cards.length,
          "cards",
        );

        // Get current character ID from URL
        const urlParams = new URLSearchParams(window.location.search);
        const characterId = urlParams.get("id");

        if (characterId) {
          // Find if this character is the current card in the session
          const currentCardIndex = session.currentIndex || 0;
          const currentCard = session.cards[currentCardIndex];

          console.log(
            `🔍 Page characterId: ${characterId}, Session currentCard:`,
            currentCard,
          );

          // Verify this card is actually in the learning deck before showing rating buttons
          const learningCardsResult =
            await chrome.storage.local.get("edbLearningCards");
          const learningCards = learningCardsResult.edbLearningCards || [];
          const cardInLearningDeck = learningCards.find(
            (card) => card.characterId === characterId,
          );

          if (
            currentCard &&
            currentCard.characterId === characterId &&
            cardInLearningDeck
          ) {
            console.log(
              "✅ This is the current learning card AND exists in learning deck, showing rating interface",
            );
            this.showRatingInterface(currentCard.id);
          } else if (
            currentCard &&
            currentCard.characterId === characterId &&
            !cardInLearningDeck
          ) {
            console.log(
              "❌ This card is in session but NOT in learning deck - should not show rating buttons",
            );
          } else {
            console.log(
              "❌ This page does not match the current learning card",
            );
          }
        } else {
          console.log("❌ No characterId found in URL");
        }
      }
    } catch (error) {
      console.error("Error checking learning session:", error);
    }
  }

  async checkIfCharacterShouldShowRating() {
    try {
      // Get current character ID from URL
      const urlParams = new URLSearchParams(window.location.search);
      const characterId = urlParams.get("id");

      if (!characterId) return;

      // Get learning cards from storage
      const result = await chrome.storage.local.get("edbLearningCards");
      const cards = result.edbLearningCards || [];

      // Check if this character is already in the learning deck
      const existingCard = cards.find(
        (card) => card.characterId === characterId,
      );

      if (existingCard) {
        console.log("📚 Character found in learning deck:", existingCard);

        // Check if the card should show rating interface
        const now = new Date();
        // The due field is stored as Unix timestamp (milliseconds), convert to Date
        const dueDate = new Date(existingCard.due);
        const isDue = now >= dueDate;
        const isNew = existingCard.state === "new" && existingCard.reps === 0;

        // Calculate hours until due (negative means overdue)
        const hoursUntilDue = (dueDate - now) / (1000 * 60 * 60);
        const isWithinOneDay = hoursUntilDue <= 24 && hoursUntilDue >= 0; // Due within next 24 hours but not overdue

        console.log(
          `📅 Card state: ${existingCard.state}, reps: ${existingCard.reps}`,
        );
        console.log(
          `📅 Raw due timestamp: ${existingCard.due}, Due date: ${dueDate}`,
        );
        console.log(
          `📅 Current time: ${now}, Current timestamp: ${now.getTime()}`,
        );
        console.log(
          `📅 Hours until due: ${hoursUntilDue.toFixed(1)}, Is due: ${isDue}, Is within 1 day: ${isWithinOneDay}, Is new: ${isNew}`,
        );

        // Show rating interface only if:
        // 1. Card is new (never reviewed before), OR
        // 2. Card is due for review (overdue or due now), OR
        // 3. Card is due within the next 12 hours (reduced from 24 hours)
        if (isNew) {
          console.log("✅ New card - showing rating interface");
          this.showRatingInterface(existingCard.id);
        } else if (isDue) {
          console.log(
            "✅ Card is overdue or due now - showing rating interface",
          );
          this.showRatingInterface(existingCard.id);
        } else if (hoursUntilDue <= 12 && hoursUntilDue >= 0) {
          console.log(
            "✅ Card is due within 12 hours - showing rating interface",
          );
          this.showRatingInterface(existingCard.id);
        } else {
          console.log("⏰ Card is in learning deck but not due for review yet");
          console.log(`   - Due in: ${hoursUntilDue.toFixed(1)} hours`);
          console.log(
            `   - State: ${existingCard.state}, Reps: ${existingCard.reps}`,
          );
          // Ensure rating interface is hidden
          const existingRatingInterface = document.querySelector(
            ".edb-rating-section",
          );
          if (existingRatingInterface) {
            existingRatingInterface.remove();
            console.log(
              "🗑️ Removed existing rating interface since card is not due",
            );
          }
        }
      } else {
        console.log(
          "🆕 Character not in learning deck - should NOT show rating buttons",
        );
        // Ensure rating interface is hidden if card is not in learning deck
        const existingRatingInterface = document.querySelector(
          ".edb-rating-section",
        );
        if (existingRatingInterface) {
          existingRatingInterface.remove();
          console.log(
            "🗑️ Removed existing rating interface since card is not in learning deck",
          );
        }
      }
    } catch (error) {
      console.error("Error checking if character should show rating:", error);
    }
  }

  async checkIfCharacterAlreadyAdded() {
    try {
      // Get current character ID from URL
      const urlParams = new URLSearchParams(window.location.search);
      const characterId = urlParams.get("id");

      if (!characterId) return;

      // Get learning cards from storage
      const result = await chrome.storage.local.get("edbLearningCards");
      const cards = result.edbLearningCards || [];

      // Check if this character is already in the learning deck
      const existingCard = cards.find(
        (card) => card.characterId === characterId,
      );

      if (existingCard) {
        // Hide the "加入学习" button
        const addButton = document.getElementById("edb-add-to-learn");
        if (addButton) {
          addButton.style.display = "none";
          console.log(
            `Character ${characterId} already in learning deck, hiding add button`,
          );
        }

        // Show learning history in toolbar
        this.showLearningHistory(existingCard);
      }
    } catch (error) {
      console.error("Error checking if character already added:", error);
    }
  }

  showLearningHistory(card) {
    try {
      const toolbar = document.getElementById("edb-helper-toolbar");
      if (!toolbar) return;

      // Remove existing learning history section
      const existingHistory = toolbar.querySelector(".edb-learning-history");
      if (existingHistory) {
        existingHistory.remove();
      }

      // Calculate learning metrics
      const now = new Date();

      // Safely parse dates from Chrome storage (Unix timestamps or legacy ISO strings)
      const parseDate = (dateValue) => {
        if (!dateValue) return new Date();
        if (dateValue instanceof Date) return dateValue;
        if (typeof dateValue === "string") {
          // Handle legacy ISO strings
          const parsed = new Date(dateValue);
          return isNaN(parsed.getTime()) ? new Date() : parsed;
        }
        if (typeof dateValue === "number") {
          // Handle Unix timestamps (milliseconds)
          return new Date(dateValue);
        }
        return new Date();
      };

      const dueDate = parseDate(card.due);
      const createdDate = parseDate(card.created);
      const lastReviewDate = parseDate(card.lastReview);

      const isDue = now >= dueDate;
      const daysUntilDue = Math.ceil((dueDate - now) / (1000 * 60 * 60 * 24));
      const daysSinceCreated = Math.floor(
        (now - createdDate) / (1000 * 60 * 60 * 24),
      );

      // Format dates
      const formatDate = (date) => {
        if (!date || isNaN(date.getTime())) {
          return "未知日期";
        }
        return date.toLocaleDateString("zh-CN", {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        });
      };

      // Get status text and color
      const getStatusInfo = () => {
        if (card.state === "new") {
          return { text: "新卡片", color: "#3498db" };
        } else if (isDue) {
          return { text: "待複習", color: "#e74c3c" };
        } else if (isNaN(daysUntilDue) || daysUntilDue <= 1) {
          return { text: "即將到期", color: "#f39c12" };
        } else {
          return { text: `複習中 (${daysUntilDue}天後)`, color: "#27ae60" };
        }
      };

      const status = getStatusInfo();
      const retentionRate =
        card.reps > 0
          ? Math.round(((card.reps - (card.lapses || 0)) / card.reps) * 100)
          : 0;

      // Create learning history section
      const historySection = document.createElement("div");
      historySection.className = "edb-learning-history";
      historySection.innerHTML = `
                <div class="learning-history-header">
                    <span class="learning-status" style="background-color: ${status.color}">${status.text}</span>
                    <span class="learning-stats">複習 ${card.reps} 次</span>
                </div>
                <div class="learning-history-details">
                    <div class="history-row">
                        <span class="history-label">添加日期:</span>
                        <span class="history-value">${formatDate(createdDate)}</span>
                    </div>
                    <div class="history-row">
                        <span class="history-label">下次複習:</span>
                        <span class="history-value">${formatDate(dueDate)}</span>
                    </div>
                    <div class="history-row">
                        <span class="history-label">掌握程度:</span>
                        <span class="history-value">${retentionRate}%</span>
                    </div>
                    <div class="history-row">
                        <span class="history-label">难度:</span>
                        <span class="history-value">${(card.difficulty || 5).toFixed(1)}/10</span>
                    </div>
                    <div class="history-row">
                        <span class="history-label">稳定性:</span>
                        <span class="history-value">${(card.stability || 0).toFixed(1)} 天</span>
                    </div>
                </div>
            `;

      // Insert after the toolbar header but before rating section
      const container = toolbar.querySelector(".edb-toolbar-container");
      const ratingSection = container.querySelector(".edb-rating-section");

      if (ratingSection) {
        container.insertBefore(historySection, ratingSection);
      } else {
        container.appendChild(historySection);
      }

      // Add some CSS for the learning history
      if (!document.getElementById("edb-learning-history-styles")) {
        const style = document.createElement("style");
        style.id = "edb-learning-history-styles";
        style.textContent = `
                    .edb-learning-history {
                        background: #f8f9fa;
                        border: 1px solid #e9ecef;
                        border-radius: 6px;
                        margin: 8px 0;
                        padding: 12px;
                        font-size: 12px;
                    }
                    .learning-history-header {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        margin-bottom: 8px;
                    }
                    .learning-status {
                        background: #3498db;
                        color: white;
                        padding: 2px 8px;
                        border-radius: 12px;
                        font-size: 11px;
                        font-weight: bold;
                    }
                    .learning-stats {
                        color: #666;
                        font-size: 11px;
                    }
                    .learning-history-details {
                        display: grid;
                        grid-template-columns: 80px 1fr;
                        gap: 4px 8px;
                    }
                    .history-row {
                        display: contents;
                    }
                    .history-label {
                        color: #666;
                        font-size: 11px;
                    }
                    .history-value {
                        color: #333;
                        font-size: 11px;
                        font-weight: 500;
                    }
                `;
        document.head.appendChild(style);
      }

      console.log("📊 Learning history displayed for card:", card.characterId);
    } catch (error) {
      console.error("Error showing learning history:", error);
    }
  }

  async enableAudioPermanently() {
    try {
      // Enable audio for this browser session via background script
      await chrome.runtime.sendMessage({
        action: "enableAudioPermission",
      });
      this.audioEnabled = true;
      console.log("Audio permission enabled for session");

      // AudioContext will be created on actual user interaction
    } catch (error) {
      // Silently handle audio permission errors - these are expected due to autoplay restrictions
      console.debug(
        "Audio permission enable failed (this is normal):",
        error.message,
      );
    }
  }

  simulateUserInteraction() {
    // This method is deprecated - AudioContext creation now happens during actual user gestures
    console.log(
      "simulateUserInteraction called - AudioContext will be created during actual user interactions",
    );
  }

  createAudioContextOnGesture() {
    // Mark that we have received a user gesture for future AudioContext creation
    // Don't actually create the AudioContext yet - wait until we need it
    this.hasUserGesture = true;
    console.debug(
      "User gesture recorded for AudioContext (lazy initialization)",
    );
  }

  createAudioContextIfNeeded() {
    // Lazy AudioContext creation - only create when actually needed for playback
    if (!this.audioContext && this.hasUserGesture) {
      try {
        this.audioContext = new (window.AudioContext ||
          window.webkitAudioContext)();
        console.debug("AudioContext created lazily during audio playback");

        // Note: AudioContext will be in suspended state, which is normal
        // We don't need to resume it for our use case since we're using extension-based audio
      } catch (e) {
        console.debug(
          "Lazy AudioContext creation failed (this is normal):",
          e.message,
        );
        this.audioContext = null;
      }
    }
    return this.audioContext;
  }

  setupAudioErrorSuppression() {
    // Set up global error suppression for AudioContext errors
    const originalErrorHandler = window.onerror;
    const originalUnhandledRejectionHandler = window.onunhandledrejection;

    // Suppress AudioContext errors globally
    window.onerror = (msg, url, line, col, error) => {
      if (
        error &&
        error.message &&
        (error.message.includes("AudioContext") ||
          error.message.includes("NotAllowedError") ||
          error.message.includes("autoplay") ||
          error.message.includes("The AudioContext was not allowed to start"))
      ) {
        // Silently suppress AudioContext autoplay errors
        console.debug("AudioContext autoplay error suppressed:", error.message);
        return true; // Prevent default error handling
      }

      // Call original handler for other errors
      if (originalErrorHandler) {
        return originalErrorHandler(msg, url, line, col, error);
      }
      return false;
    };

    // Suppress unhandled promise rejections for AudioContext
    window.onunhandledrejection = (event) => {
      if (
        event.reason &&
        event.reason.message &&
        (event.reason.message.includes("AudioContext") ||
          event.reason.message.includes("NotAllowedError") ||
          event.reason.message.includes("autoplay") ||
          event.reason.message.includes(
            "The AudioContext was not allowed to start",
          ))
      ) {
        // Silently suppress AudioContext promise rejections
        console.debug(
          "AudioContext promise rejection suppressed:",
          event.reason.message,
        );
        event.preventDefault(); // Prevent default unhandled rejection handling
        return;
      }

      // Call original handler for other rejections
      if (originalUnhandledRejectionHandler) {
        return originalUnhandledRejectionHandler(event);
      }
    };

    console.log("AudioContext error suppression enabled");
  }

  attemptAudioContextResume() {
    // More conservative AudioContext resume attempt with better error handling
    if (!this.audioContext || this.audioContext.state !== "suspended") {
      return;
    }

    // Check if we have a valid user gesture context
    const hasUserGesture =
      document.hasStoredUserActivation ||
      (window.performance && window.performance.now() > 0);

    if (!hasUserGesture) {
      console.debug("Skipping AudioContext resume - no user gesture context");
      return;
    }

    // Attempt resume with error suppression
    this.audioContext
      .resume()
      .then(() => {
        console.log("AudioContext resumed successfully");
      })
      .catch((err) => {
        // This is expected behavior when autoplay restrictions apply
        console.debug(
          "AudioContext resume failed (this is normal - autoplay restrictions)",
        );
      });
  }

  updateSettings() {
    // Update settings from current checkbox states
    this.settings.autoAudio =
      document.getElementById("edb-auto-audio")?.checked || false;
    this.settings.autoCantonese =
      document.getElementById("edb-auto-cantonese")?.checked || false;
    this.settings.autoMandarin =
      document.getElementById("edb-auto-mandarin")?.checked || false;
    this.settings.autoStroke =
      document.getElementById("edb-auto-stroke")?.checked || false;
    this.settings.toolbarCollapsed = this.toolbarCollapsed;

    this.saveSettings();
  }

  makePageScrollable() {
    // Fix page layout issues and make it scrollable
    const style = document.createElement("style");
    style.textContent = `
            /* Reset problematic positioning */
            body, html {
                height: auto !important;
                min-height: 100vh !important;
                overflow: auto !important;
                position: static !important;
            }

            /* Fix any fixed/absolute positioning that might break scrolling */
            *[style*="position: fixed"], *[style*="position:absolute"] {
                position: relative !important;
            }

            /* Ensure content flows properly */
            .main-content, .content, #content {
                overflow: visible !important;
                height: auto !important;
            }

            /* Remove any overflow hidden */
            *[style*="overflow: hidden"] {
                overflow: visible !important;
            }

            /* Extension specific enhancements */
            .edb-enhanced {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            }

            .edb-word-highlight {
                background-color: #fff3cd;
                border: 2px solid #ffc107;
                border-radius: 4px;
                padding: 2px 4px;
                margin: 0 2px;
            }
        `;
    document.head.appendChild(style);

    // Attempt to fix any broken layouts
    setTimeout(() => {
      // Find and fix any containers that might be causing issues
      const problematicElements = document.querySelectorAll(
        '[style*="height: 100%"], [style*="position: fixed"]',
      );
      problematicElements.forEach((el) => {
        el.style.height = "auto";
        el.style.position = "relative";
      });
    }, 500);
  }

  setupPageEnhancements() {
    // Add helper buttons to word pages
    this.addWordPageEnhancements();

    // Add word list enhancements
    this.addWordListEnhancements();

    // Add auto-play functionality
    this.addAutoPlayControls();
  }

  addWordPageEnhancements() {
    // Check if we're on a word result page
    if (window.location.href.includes("result.jsp")) {
      this.addWordHelperButtons();
    }
  }

  addWordHelperButtons() {
    const wordContainer = document.querySelector("body");

    // Create helper toolbar with saved settings
    const toolbar = document.createElement("div");
    toolbar.id = "edb-helper-toolbar";
    toolbar.innerHTML = `
            <div class="edb-toolbar-container">
                <div class="checkbox-group">
                    <label>
                        <input type="checkbox" id="edb-auto-audio" ${this.settings.autoAudio ? "checked" : ""}>
                        <span>播放發音</span>
                    </label>
                    <div class="audio-options" id="edb-audio-options" style="display: ${this.settings.autoAudio ? "flex" : "none"};">
                        <label>
                            <input type="checkbox" id="edb-auto-cantonese" ${this.settings.autoCantonese ? "checked" : ""}>
                            <span>粵語</span>
                        </label>
                        <label>
                            <input type="checkbox" id="edb-auto-mandarin" ${this.settings.autoMandarin ? "checked" : ""}>
                            <span>普通話</span>
                        </label>
                    </div>
                </div>
                <div class="checkbox-group">
                    <label>
                        <input type="checkbox" id="edb-auto-stroke" ${this.settings.autoStroke ? "checked" : ""}>
                        <span>顯示筆劃</span>
                    </label>
                </div>
                <button id="edb-add-to-learn">加入學習</button>
                <button id="edb-toggle-helper">隱藏工具欄</button>
            </div>
        `;

    // Add styles
    const style = document.createElement("style");
    style.textContent = `
            body #edb-helper-toolbar {
                position: fixed !important;
                top: 10px !important;
                right: 10px !important;
                z-index: 9999 !important;
                background: white !important;
                border: 2px solid #3498db !important;
                border-radius: 8px !important;
                padding: 10px !important;
                box-shadow: 0 2px 10px rgba(0,0,0,0.1) !important;
                min-width: 150px !important;
                transition: all 0.3s ease !important;
                box-sizing: border-box !important;
            }

            body #edb-helper-toolbar.edb-toolbar-collapsed {
                min-width: 30px !important;
                width: 30px !important;
                height: 30px !important;
                padding: 5px !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                border-radius: 50% !important;
                background: #3498db !important;
                border-color: #3498db !important;
                box-sizing: border-box !important;
                transition: all 0.3s ease !important;
            }

            #edb-helper-toolbar.edb-toolbar-collapsed .edb-toolbar-container {
                display: none !important;
            }

            #edb-helper-toolbar:not(.edb-toolbar-collapsed) .edb-toolbar-container {
                display: flex !important;
            }

                  #edb-helper-toolbar.edb-toolbar-collapsed #edb-toggle-helper {
                background: transparent !important;
                color: white !important;
                border: none !important;
                border-radius: 50% !important;
                padding: 0 !important;
                font-size: 16px !important;
                cursor: pointer !important;
                width: 20px !important;
                height: 20px !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                min-width: 20px !important;
                text-align: center !important;
                line-height: 20px !important;
                position: relative !important;
                z-index: 10000 !important;
                pointer-events: auto !important;
                user-select: none !important;
            }

            #edb-helper-toolbar.edb-toolbar-collapsed {
                cursor: pointer !important;
            }

            #edb-helper-toolbar.edb-toolbar-collapsed #edb-toggle-helper:hover {
                background: rgba(255,255,255,0.2) !important;
            }
            .edb-toolbar-container {
                display: flex;
                gap: 8px;
                flex-direction: column;
            }
            .checkbox-group {
                display: flex;
                flex-direction: column;
                gap: 4px;
            }
            .checkbox-group label {
                display: flex;
                align-items: center;
                gap: 6px;
                font-size: 12px;
                cursor: pointer;
                padding: 4px;
                border-radius: 4px;
            }
            .checkbox-group label:hover {
                background-color: #f0f0f0;
            }
            .checkbox-group input[type="checkbox"] {
                margin: 0;
                cursor: pointer;
            }
            .audio-options {
                margin-left: 20px;
                margin-top: 4px;
                display: flex;
                flex-direction: column;
                gap: 2px;
            }
            .audio-options label {
                font-size: 11px;
                color: #666;
            }
            #edb-helper-toolbar button {
                padding: 8px 12px;
                background: #3498db;
                color: white;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-size: 12px;
            }
            #edb-helper-toolbar button:hover {
                background: #2980b9;
            }

            #edb-toggle-helper {
                background: #3498db;
                color: white;
                border: 1px solid #2980b9;
                border-radius: 4px;
                padding: 4px 8px;
                cursor: pointer;
                font-size: 11px;
                font-weight: bold;
                transition: background 0.2s ease;
            }

            #edb-toggle-helper:hover {
                background: #2980b9;
            }
            .edb-auto-active {
                background-color: #e8f5e8 !important;
                border-color: #27ae60 !important;
            }

            /* Rating section styles */
            .edb-rating-section {
                margin-top: 10px;
                padding-top: 10px;
                border-top: 1px solid #eee;
            }

            .rating-section {
                display: flex;
                flex-direction: column;
                gap: 5px;
            }

            .rating-label {
                font-size: 11px;
                font-weight: bold;
                color: #2c3e50;
                text-align: center;
            }

            .rating-buttons {
                display: grid;
                grid-template-columns: repeat(4, 1fr);
                gap: 3px;
            }

            .rating-btn {
                padding: 4px 6px;
                border: 1px solid;
                border-radius: 3px;
                cursor: pointer;
                font-size: 9px;
                font-weight: bold;
                text-align: center;
                transition: all 0.2s;
            }

            .rating-btn.again {
                background: #e74c3c;
                border-color: #c0392b;
                color: white;
            }

            .rating-btn.hard {
                background: #f39c12;
                border-color: #d68910;
                color: white;
            }

            .rating-btn.good {
                background: #27ae60;
                border-color: #229954;
                color: white;
            }

            .rating-btn.easy {
                background: #2ecc71;
                border-color: #27ae60;
                color: white;
            }

            .rating-btn:hover {
                transform: translateY(-1px);
                box-shadow: 0 2px 4px rgba(0,0,0,0.2);
            }
        `;

    document.head.appendChild(style);
    document.body.appendChild(toolbar);
    console.log("Toolbar created and added to DOM");

    // Apply saved toolbar state
    if (this.settings.toolbarCollapsed) {
      const toolbar = document.getElementById("edb-helper-toolbar");
      const container = toolbar.querySelector(".edb-toolbar-container");
      const toggleButton = document.getElementById("edb-toggle-helper");

      // Apply collapsed state
      toolbar.classList.add("edb-toolbar-collapsed");
      this.toolbarCollapsed = true;
      toggleButton.textContent = "◀";
      console.log("Applied saved collapsed state to toolbar");
    }

    // Setup button handlers
    this.setupToolbarHandlers();

    // Setup auto-play functionality
    this.setupAutoPlayHandlers();
  }

  setupToolbarHandlers() {
    console.log("Setting up toolbar handlers...");
    const toggleButton = document.getElementById("edb-toggle-helper");
    console.log("Toggle button found:", !!toggleButton);
    console.log("Toggle button HTML:", toggleButton?.outerHTML);

    document
      .getElementById("edb-add-to-learn")
      ?.addEventListener("click", (event) => {
        // Create AudioContext during this user gesture
        this.createAudioContextOnGesture();
        this.addToLearningList();
      });

    // Add event listener with better error handling
    if (toggleButton) {
      toggleButton.addEventListener("click", (e) => {
        // Create AudioContext during this user gesture
        this.createAudioContextOnGesture();
        console.log("Toggle button clicked!", e.target);
        console.log("Event type:", e.type);
        console.log("Current target:", e.currentTarget);

        const toolbar = document.getElementById("edb-helper-toolbar");
        const container = toolbar.querySelector(".edb-toolbar-container");
        const currentButton = e.currentTarget; // Use currentTarget to ensure we get the button element

        console.log("Toolbar found:", !!toolbar);
        console.log("Container found:", !!container);
        console.log(
          "Toolbar collapsed state (class):",
          toolbar.classList.contains("edb-toolbar-collapsed"),
        );
        console.log(
          "Toolbar collapsed state (variable):",
          this.toolbarCollapsed,
        );

        // Check if toolbar is currently collapsed using state variable
        if (this.toolbarCollapsed) {
          console.log("Expanding toolbar...");

          // Remove collapsed state first to allow CSS transitions
          toolbar.classList.remove("edb-toolbar-collapsed");
          this.toolbarCollapsed = false;

          // Update button text after CSS transition
          setTimeout(() => {
            currentButton.textContent = "隱藏工具欄";
          }, 100);

          // Save settings to persist toolbar state
          this.updateSettings();
        } else {
          console.log("Collapsing toolbar...");

          // Change button text before adding collapsed class
          currentButton.textContent = "◀";

          // Add collapsed state to trigger CSS transition
          console.log(
            "Original handler - Before adding class:",
            toolbar.className,
          );
          toolbar.classList.add("edb-toolbar-collapsed");
          this.toolbarCollapsed = true;
          console.log(
            "Original handler - After adding class:",
            toolbar.className,
          );

          // Save settings to persist toolbar state
          this.updateSettings();

          // Debug: Check if the button is still clickable
          setTimeout(() => {
            console.log("Post-collapse debug:");
            console.log("  - Button element:", currentButton);
            console.log(
              "  - Button visible:",
              currentButton.offsetParent !== null,
            );
            console.log(
              "  - Button dimensions:",
              currentButton.offsetWidth,
              "x",
              currentButton.offsetHeight,
            );
            console.log("  - Toolbar classes:", toolbar.className);
            console.log("  - Button onclick:", currentButton.onclick);
            console.log(
              "  - Button event listeners:",
              currentButton.hasAttribute("onclick"),
            );
          }, 200);
        }
      });

      // Also add event delegation as backup
      document.addEventListener(
        "click",
        (e) => {
          const toolbar = document.getElementById("edb-helper-toolbar");
          const isToggleButton = e.target.closest("#edb-toggle-helper");
          const isCollapsedToolbar =
            toolbar &&
            toolbar.classList.contains("edb-toolbar-collapsed") &&
            toolbar.contains(e.target);

          if (isToggleButton || isCollapsedToolbar) {
            // Create AudioContext during this user gesture
            this.createAudioContextOnGesture();
            console.log("Toggle button clicked via event delegation!");
            console.log("Is toggle button:", isToggleButton);
            console.log("Is collapsed toolbar:", isCollapsedToolbar);
            e.preventDefault();
            e.stopPropagation();

            const toolbar = document.getElementById("edb-helper-toolbar");
            const container = toolbar.querySelector(".edb-toolbar-container");
            const currentButton =
              e.target.closest("#edb-toggle-helper") ||
              toolbar.querySelector("#edb-toggle-helper");

            console.log("Toolbar found:", !!toolbar);
            console.log("Container found:", !!container);
            console.log(
              "Toolbar collapsed state (class):",
              toolbar.classList.contains("edb-toolbar-collapsed"),
            );
            console.log(
              "Toolbar collapsed state (variable):",
              this.toolbarCollapsed,
            );

            // Check if toolbar is currently collapsed using state variable
            if (this.toolbarCollapsed) {
              console.log("Expanding toolbar via delegation...");
              console.log(
                "Before expansion - collapsed classes:",
                toolbar.className,
              );

              // Remove collapsed state first to allow CSS transitions
              toolbar.classList.remove("edb-toolbar-collapsed");
              this.toolbarCollapsed = false;
              console.log(
                "After class removal - collapsed classes:",
                toolbar.className,
              );

              // Update button text after CSS transition
              setTimeout(() => {
                console.log("Executing expansion timeout...");
                currentButton.textContent = "隱藏工具欄";
                console.log("Button text set to:", currentButton.textContent);
              }, 100);

              // Save settings to persist toolbar state
              this.updateSettings();
            } else {
              console.log("Collapsing toolbar via delegation...");

              // Change button text before adding collapsed class
              currentButton.textContent = "◀";

              // Add collapsed state to trigger CSS transition
              console.log(
                "Before adding class - current classes:",
                toolbar.className,
              );
              toolbar.classList.add("edb-toolbar-collapsed");
              this.toolbarCollapsed = true;
              console.log(
                "After adding class - current classes:",
                toolbar.className,
              );
              console.log(
                "Class contains check immediately after:",
                toolbar.classList.contains("edb-toolbar-collapsed"),
              );

              // Save settings to persist toolbar state
              this.updateSettings();
            }
          }
        },
        true,
      ); // Use capture phase

      // Add comprehensive click logging to debug the green ball issue
      document.addEventListener(
        "click",
        (e) => {
          const toolbar = document.getElementById("edb-helper-toolbar");
          if (toolbar && toolbar.classList.contains("edb-toolbar-collapsed")) {
            console.log("=== GREEN BALL CLICK DEBUG ===");
            console.log("Click target:", e.target);
            console.log("Click target ID:", e.target.id);
            console.log("Click target class:", e.target.className);
            console.log("Click target tag:", e.target.tagName);
            console.log(
              "Is target inside toolbar?",
              toolbar.contains(e.target),
            );
            console.log(
              "Is target the toggle button?",
              e.target.closest("#edb-toggle-helper"),
            );
            console.log(
              "Toolbar bounding rect:",
              toolbar.getBoundingClientRect(),
            );
            console.log(
              "Target bounding rect:",
              e.target.getBoundingClientRect(),
            );
            console.log("Mouse coordinates:", e.clientX, e.clientY);
            console.log("==============================");
          }
        },
        true,
      );
    } else {
      console.error("Toggle button not found when setting up handlers!");
    }
  }

  addWordListEnhancements() {
    // Check if we're on a word list page
    if (window.location.href.includes("lexlist_ch")) {
      this.addListEnhancements();
    }
  }

  addListEnhancements() {
    // Add quick filters and sorting to word lists
    // TODO: Implement word list enhancements
  }

  addAutoPlayControls() {
    // This is now handled by the checkbox controls in the toolbar
  }

  setupAutoPlayHandlers() {
    const audioCheckbox = document.getElementById("edb-auto-audio");
    const audioOptions = document.getElementById("edb-audio-options");
    const strokeCheckbox = document.getElementById("edb-auto-stroke");

    // Show/hide audio options when main audio checkbox is toggled
    audioCheckbox.addEventListener("change", (event) => {
      // Create AudioContext during this user gesture
      this.createAudioContextOnGesture();

      if (audioCheckbox.checked) {
        audioOptions.style.display = "flex";

        // Enable audio permission immediately when checkbox is checked
        if (!this.audioEnabled) {
          this.enableAudioPermanently();
          console.log("Audio permission enabled via checkbox click");
        }

        // Start audio playback
        setTimeout(() => {
          try {
            this.startAutoPlay();
          } catch (err) {
            console.debug(
              "Auto-play start failed (this is normal):",
              err.message,
            );
          }
        }, 100);
      } else {
        audioOptions.style.display = "none";
        this.stopAutoPlay();
      }
      this.updateSettings();
    });

    // Handle sub-checkbox changes
    document
      .getElementById("edb-auto-cantonese")
      .addEventListener("change", (event) => {
        // Create AudioContext during this user gesture
        this.createAudioContextOnGesture();

        if (audioCheckbox.checked) {
          try {
            this.startAutoPlay();
          } catch (err) {
            console.debug(
              "Auto-play start failed (this is normal):",
              err.message,
            );
          }
        }
        this.updateSettings();
      });

    document
      .getElementById("edb-auto-mandarin")
      .addEventListener("change", (event) => {
        // Create AudioContext during this user gesture
        this.createAudioContextOnGesture();

        if (audioCheckbox.checked) {
          try {
            this.startAutoPlay();
          } catch (err) {
            console.debug(
              "Auto-play start failed (this is normal):",
              err.message,
            );
          }
        }
        this.updateSettings();
      });

    // Handle stroke animation checkbox
    strokeCheckbox.addEventListener("change", () => {
      if (strokeCheckbox.checked) {
        this.strokeAnimationActive = true;
        this.startAutoStroke();
      } else {
        this.stopAutoStroke();
      }
      this.updateSettings();
    });

    // Monitor page changes for auto-play
    this.monitorPageChanges();

    // Start auto-play if enabled in settings
    this.initializeAutoPlay();
  }

  startAutoPlay() {
    // Original method without verification (for internal use)
    try {
      const playCantonese =
        document.getElementById("edb-auto-cantonese")?.checked;
      const playMandarin =
        document.getElementById("edb-auto-mandarin")?.checked;

      if (!playCantonese && !playMandarin) return;

      // Add visual indicator for audio only
      this.audioAutoActive = true;
      this.updateToolbarVisualState();

      // Play audio if we have session permission
      if (this.audioEnabled) {
        console.log("Playing audio with session permission");
        // Start audio after a short delay
        setTimeout(() => {
          // Start audio
          if (playCantonese) {
            this.safePlayAudio("cantonese");
          }
        }, 500);

        // Play second audio with delay if needed
        if (playMandarin && playCantonese) {
          setTimeout(() => {
            this.safePlayAudio("mandarin");
          }, 2000);
        } else if (playMandarin) {
          setTimeout(() => {
            this.safePlayAudio("mandarin");
          }, 500);
        }
      } else {
        console.log("Audio auto-play waiting for session permission");
        // Try to enable audio permission one more time
        this.enableAudioPermanently().then(() => {
          // Retry playing audio after enabling permission
          setTimeout(() => {
            if (this.audioEnabled) {
              console.log("Retrying audio playback after enabling permission");
              if (playCantonese) {
                this.safePlayAudio("cantonese");
              }
              if (playMandarin && playCantonese) {
                setTimeout(() => this.safePlayAudio("mandarin"), 2000);
              } else if (playMandarin) {
                setTimeout(() => this.safePlayAudio("mandarin"), 500);
              }
            } else {
              this.showAudioPrompt();
            }
          }, 200);
        });
      }
    } catch (err) {
      // Silently handle auto-play errors
      console.debug("Auto-play failed (this is normal):", err.message);
      this.audioAutoActive = false;
      this.updateToolbarVisualState();
    }
  }

  async startAutoPlayAndVerify() {
    // Method that verifies successful audio playback
    try {
      const playCantonese =
        document.getElementById("edb-auto-cantonese")?.checked;
      const playMandarin =
        document.getElementById("edb-auto-mandarin")?.checked;

      if (!playCantonese && !playMandarin) return false;

      // Add visual indicator for audio only
      this.audioAutoActive = true;
      this.updateToolbarVisualState();

      // Play audio if we have session permission
      if (this.audioEnabled) {
        console.log("Playing audio with session permission and verification");

        return new Promise((resolve) => {
          let audioPlayed = false;

          // Start audio after a short delay
          setTimeout(() => {
            // Start audio
            if (playCantonese) {
              this.safePlayAudio("cantonese");
              audioPlayed = true;
            }
          }, 500);

          // Play second audio with delay if needed
          if (playMandarin && playCantonese) {
            setTimeout(() => {
              this.safePlayAudio("mandarin");
              audioPlayed = true;
            }, 2000);
          } else if (playMandarin) {
            setTimeout(() => {
              this.safePlayAudio("mandarin");
              audioPlayed = true;
            }, 500);
          }

          // Resolve after a reasonable time to confirm audio is working
          setTimeout(
            () => {
              console.log(
                "Audio playback verification completed, success:",
                audioPlayed,
              );
              resolve(audioPlayed);
            },
            playMandarin && playCantonese ? 3000 : 1500,
          );
        });
      } else {
        console.log("Audio auto-play waiting for session permission");
        this.showAudioPrompt();
        return false;
      }
    } catch (err) {
      // Silently handle auto-play verification errors
      console.debug(
        "Auto-play verification failed (this is normal):",
        err.message,
      );
      this.audioAutoActive = false;
      this.updateToolbarVisualState();
      return false;
    }
  }

  stopAutoPlay() {
    this.audioAutoActive = false;
    this.updateToolbarVisualState();
  }

  startAutoStroke() {
    this.updateToolbarVisualState();

    // Start stroke animation immediately
    console.log("Starting stroke animation");
    this.showStrokeAnimation();
  }

  stopAutoStroke() {
    this.strokeAnimationActive = false;
    this.updateToolbarVisualState();

    // Actually stop the stroke animation if it's running
    this.stopStrokeAnimation();
  }

  playAudio(language) {
    // Create AudioContext if needed (lazy initialization)
    this.createAudioContextIfNeeded();

    // Try extension-based audio playback first
    try {
      this.playAudioFromExtension(language);
    } catch (err) {
      // Silently handle audio playback errors
      console.debug(
        `Audio playback failed for ${language} (this is normal):`,
        err.message,
      );
    }
  }

  safePlayAudio(language) {
    // Try extension-based audio playback first (bypasses autoplay restrictions)
    try {
      // Ensure AudioContext is properly initialized before attempting playback
      if (this.audioContext && this.audioContext.state === "suspended") {
        // Don't attempt to resume during playback - just proceed without audio context
        console.debug(
          "AudioContext suspended, proceeding with audio playback anyway",
        );
      }

      this.playAudioFromExtension(language).catch((err) => {
        // Silently handle audio playback errors - these are expected due to autoplay restrictions
        console.debug(
          `Audio playback failed for ${language} (this is normal):`,
          err.message,
        );
      });
    } catch (err) {
      // Silently handle any synchronous errors
      console.debug(
        `Audio playback error for ${language} (this is normal):`,
        err.message,
      );
    }
  }

  async playAudioFromExtension(language) {
    // Create AudioContext if needed (lazy initialization)
    this.createAudioContextIfNeeded();

    try {
      // Extract audio parameters from the page
      const audioParams = this.extractAudioParams(language);
      if (audioParams) {
        // Try to play audio using offscreen document
        const response = await chrome.runtime.sendMessage({
          action: "playAudio",
          language: language,
          params: audioParams,
        });

        if (response && response.success) {
          console.log(`Playing ${language} audio from extension context`);
        } else {
          throw new Error("Extension audio failed");
        }
      } else {
        throw new Error("No audio parameters found");
      }
    } catch (error) {
      console.log(
        "Extension audio failed, falling back to page method:",
        error,
      );
      this.playAudioFromPage(language);
    }
  }

  extractAudioParams(language) {
    // Extract the audio function parameters from the page
    const images = document.querySelectorAll('img[onclick*="doSound"]');
    console.log(`Found ${images.length} audio images for ${language}`);

    for (let img of images) {
      const onclick = img.getAttribute("onclick") || "";
      console.log(`Checking image onclick: ${onclick}`);

      if (language === "cantonese" && onclick.includes("doSoundyp")) {
        // Extract parameter from doSoundyp('jat1')
        const match = onclick.match(/doSoundyp\(['"]([^'"]+)['"]\)/);
        if (match) {
          console.log(`Found Cantonese param: ${match[1]}`);
          return { type: "cantonese", param: match[1] };
        }
      } else if (language === "mandarin" && onclick.includes("doSoundhp")) {
        // Extract parameter from doSoundhp('yi1')
        const match = onclick.match(/doSoundhp\(['"]([^'"]+)['"]\)/);
        if (match) {
          console.log(`Found Mandarin param: ${match[1]}`);
          return { type: "mandarin", param: match[1] };
        }
      }
    }

    console.log(`No ${language} audio parameters found`);
    return null;
  }

  playAudioFromPage(language) {
    // Create AudioContext if needed (lazy initialization)
    this.createAudioContextIfNeeded();

    // Fallback method: click the audio buttons on the page
    setTimeout(() => {
      try {
        if (language === "cantonese") {
          this.playCantoneseAudio();
        } else if (language === "mandarin") {
          this.playMandarinAudio();
        }
      } catch (err) {
        // Silently handle page audio playback errors
        console.debug(
          `Page audio playback failed for ${language} (this is normal):`,
          err.message,
        );
      }
    }, 100);
  }

  playCantoneseAudio() {
    // Create AudioContext if needed (lazy initialization)
    this.createAudioContextIfNeeded();

    try {
      // Method 1: Direct image index approach - $('img')[1]
      const images = document.querySelectorAll("img");
      if (images.length >= 2) {
        const cantoneseImg = images[1];
        if (
          cantoneseImg &&
          cantoneseImg.onclick &&
          cantoneseImg.onclick.toString().includes("doSoundyp")
        ) {
          console.log("Playing Cantonese audio (method 1)");
          cantoneseImg.click();
          return;
        }
      }

      // Method 2: Find by onclick attribute containing 'doSoundyp'
      const soundypElements = document.querySelectorAll(
        '[onclick*="doSoundyp"]',
      );
      if (soundypElements.length > 0) {
        console.log("Playing Cantonese audio (method 2)");
        soundypElements[0].click();
        return;
      }

      // Method 3: Find by alt attribute containing '粵'
      const cantoneseElements = document.querySelectorAll(
        'img[alt*="粵"], img[alt*="Cantonese"], img[alt*="广东"]',
      );
      if (cantoneseElements.length > 0) {
        console.log("Playing Cantonese audio (method 3)");
        cantoneseElements[0].click();
        return;
      }

      console.debug("Cantonese audio not found");
    } catch (err) {
      // Silently handle Cantonese audio playback errors
      console.debug(
        "Cantonese audio playback failed (this is normal):",
        err.message,
      );
    }
  }

  playMandarinAudio() {
    // Create AudioContext if needed (lazy initialization)
    this.createAudioContextIfNeeded();

    try {
      // Method 1: Direct image index approach - $('img')[0]
      const images = document.querySelectorAll("img");
      if (images.length >= 1) {
        const mandarinImg = images[0];
        if (
          mandarinImg &&
          mandarinImg.onclick &&
          mandarinImg.onclick.toString().includes("doSoundhp")
        ) {
          console.log("Playing Mandarin audio (method 1)");
          mandarinImg.click();
          return;
        }
      }

      // Method 2: Find by onclick attribute containing 'doSoundhp'
      const soundhpElements = document.querySelectorAll(
        '[onclick*="doSoundhp"]',
      );
      if (soundhpElements.length > 0) {
        console.log("Playing Mandarin audio (method 2)");
        soundhpElements[0].click();
        return;
      }

      // Method 3: Find by alt attribute containing '普通話' or related terms
      const mandarinElements = document.querySelectorAll(
        'img[alt*="普通话"], img[alt*="Mandarin"], img[alt*="国语"], img[alt*="播放讀音"]',
      );
      if (mandarinElements.length > 0) {
        console.log("Playing Mandarin audio (method 3)");
        mandarinElements[0].click();
        return;
      }

      console.debug("Mandarin audio not found");
    } catch (err) {
      // Silently handle Mandarin audio playback errors
      console.debug(
        "Mandarin audio playback failed (this is normal):",
        err.message,
      );
    }
  }

  setupUserInteraction() {
    // Set up user interaction tracking as backup method
    const interactions = ["click", "touchstart", "keydown"];

    interactions.forEach((event) => {
      document.addEventListener(
        event,
        () => {
          try {
            // Create AudioContext during this user gesture
            this.createAudioContextOnGesture();

            // Enable audio if user interacts and audio features might be needed
            if (!this.audioEnabled) {
              // Check if audio is enabled in settings or currently checked
              const audioCheckbox = document.getElementById("edb-auto-audio");
              const isAudioWanted =
                this.settings.autoAudio || audioCheckbox?.checked;

              if (isAudioWanted || this.showingAudioPrompt) {
                this.enableAudioPermanently();
                console.log(
                  "User interaction detected - audio autoplay enabled",
                );

                // Hide the audio enable button when any interaction occurs
                this.hideAudioEnableButton();

                // If auto-play was enabled, start it now
                if (audioCheckbox?.checked) {
                  setTimeout(() => this.startAutoPlay(), 100);
                }
              }
            }
          } catch (err) {
            // Silently handle user interaction audio setup errors
            console.debug(
              "User interaction audio setup failed (this is normal):",
              err.message,
            );
          }
        },
        { once: true },
      ); // Only need one interaction
    });
  }

  hideAudioEnableButton() {
    // Hide the audio enable button when user interacts with the page
    const toolbar = document.getElementById("edb-helper-toolbar");
    if (!toolbar) return;

    const buttonContainer = toolbar.querySelector(".manual-play-buttons");
    if (buttonContainer) {
      buttonContainer.remove();
      this.showingAudioPrompt = false;
      console.log("Audio enable button hidden due to user interaction");
    }
  }

  addManualPlayButtons() {
    // Only show button if audio is not enabled
    if (this.audioEnabled) return;

    const toolbar = document.getElementById("edb-helper-toolbar");
    if (!toolbar) return;

    // Check if button already exists
    if (toolbar.querySelector(".manual-play-buttons")) return;

    // Mark that we're showing audio prompt
    this.showingAudioPrompt = true;

    const buttonContainer = document.createElement("div");
    buttonContainer.className = "manual-play-buttons";
    buttonContainer.innerHTML = `
            <button id="edb-enable-audio" style="font-size: 10px; padding: 4px 8px; margin-top: 4px;">
                📢 啟用音頻自動播放 (一次即可)
            </button>
        `;

    // Add styles for manual buttons
    const style = document.createElement("style");
    style.textContent = `
            .manual-play-buttons {
                margin-top: 8px;
                padding-top: 8px;
                border-top: 1px solid #eee;
            }
            #edb-enable-audio {
                width: 100%;
                background: #27ae60;
                color: white;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-weight: bold;
            }
            #edb-enable-audio:hover {
                background: #229954;
            }
        `;

    document.head.appendChild(style);
    toolbar.appendChild(buttonContainer);

    // Add click handler
    document
      .getElementById("edb-enable-audio")
      .addEventListener("click", (event) => {
        // Create AudioContext during this user gesture
        this.createAudioContextOnGesture();

        this.enableAudioPermanently();
        this.showNotification("✅ 音頻自動播放已啟用！本會話有效");

        // Remove the button immediately since user interaction enables audio
        buttonContainer.remove();
        this.showingAudioPrompt = false;
        console.log("Audio enable button removed after click");

        // Start auto-play if enabled
        if (this.settings.autoAudio) {
          this.startAutoPlay();
        }
      });
  }

  showAudioPrompt() {
    // Show the manual enable button for user interaction
    this.addManualPlayButtons();
  }

  needsAudioPrompt() {
    // Check if we need to show audio prompt (only when audio features are needed)
    return (
      this.settings.autoAudio ||
      document.getElementById("edb-auto-audio")?.checked ||
      this.showingAudioPrompt
    );
  }

  initializeAutoPlay() {
    // Start auto-play if enabled in saved settings
    setTimeout(() => {
      if (this.settings.autoAudio) {
        this.startAutoPlay();
      }
      if (this.settings.autoStroke) {
        this.startAutoStroke();
      }
    }, 1000); // Wait for page to fully load
  }

  monitorPageChanges() {
    // Monitor for page changes to restart auto-play if needed
    let lastUrl = location.href;

    const observer = new MutationObserver(() => {
      if (location.href !== lastUrl) {
        lastUrl = location.href;

        // Restart auto-play if enabled
        setTimeout(() => {
          if (document.getElementById("edb-auto-audio")?.checked) {
            this.startAutoPlay();
          }
          if (document.getElementById("edb-auto-stroke")?.checked) {
            this.startAutoStroke();
          }
        }, 1000);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  // Legacy methods kept for compatibility
  playWordAudio() {
    // Create AudioContext if needed (lazy initialization)
    this.createAudioContextIfNeeded();

    try {
      this.playAudio("cantonese"); // Default to Cantonese
    } catch (err) {
      // Silently handle word audio playback errors
      console.debug(
        "Word audio playback failed (this is normal):",
        err.message,
      );
    }
  }

  showStrokeAnimation() {
    console.log(
      "showStrokeAnimation called, strokeAnimationActive:",
      this.strokeAnimationActive,
    );

    // The stroke animation controls are inside an iframe
    const iframe = document.querySelector('iframe[src*="stkdemo_js"]');

    if (iframe) {
      try {
        // Access the iframe document
        const iframeDoc =
          iframe.contentDocument || iframe.contentWindow.document;

        if (iframeDoc) {
          // Look for the bishun-show element inside the iframe
          const bishunShow = iframeDoc.querySelector(".bishun-show");

          if (bishunShow) {
            // Click the button and mark as active
            console.log("Activating stroke animation via bishun-show element");
            bishunShow.click();
            this.strokeAnimationActive = true;
            console.log("Stroke animation activated successfully");
          } else {
            // Fallback: look for stroke-related buttons inside iframe
            console.log(
              "bishun-show element not found in iframe, trying fallback methods",
            );

            const fallbackSelectors = [
              '[class*="bishun"]',
              '[class*="stroke"]',
              '[class*="笔画"]',
              'button[onclick*="stroke"]',
              'a[onclick*="stroke"]',
              'button[onclick*="笔画"]',
              'a[onclick*="笔画"]',
              '*[onclick*="bishun"]',
            ];

            let foundButton = false;
            for (const selector of fallbackSelectors) {
              const elements = iframeDoc.querySelectorAll(selector);
              elements.forEach((element) => {
                if (
                  element.textContent.includes("笔画") ||
                  element.textContent.includes("stroke") ||
                  element.getAttribute("title")?.includes("笔画") ||
                  element.getAttribute("title")?.includes("stroke")
                ) {
                  element.click();
                  console.log(
                    "Stroke animation triggered via iframe fallback method:",
                    selector,
                  );
                  this.strokeAnimationActive = true;
                  foundButton = true;
                }
              });
              if (foundButton) break;
            }

            if (!foundButton) {
              console.log("No stroke animation button found in iframe");
              this.strokeAnimationActive = false; // Ensure flag is reset if no button found
            }
          }
        } else {
          console.log("Could not access iframe document");
          this.strokeAnimationActive = false;
        }
      } catch (error) {
        console.error("Error accessing iframe content:", error);
        this.strokeAnimationActive = false;
      }
    } else {
      console.log("Stroke animation iframe not found");
      this.strokeAnimationActive = false;
    }
  }

  stopStrokeAnimation() {
    // Stop the stroke animation if it's running
    const iframe = document.querySelector('iframe[src*="stkdemo_js"]');

    if (iframe) {
      try {
        // Access the iframe document
        const iframeDoc =
          iframe.contentDocument || iframe.contentWindow.document;

        if (iframeDoc) {
          // Try to find and click stop/reset buttons first
          const stopSelectors = [
            '[class*="stop"]',
            '[class*="pause"]',
            '[class*="reset"]',
            '[class*="replay"]',
            'button[onclick*="stop"]',
            'button[onclick*="pause"]',
            'button[onclick*="reset"]',
            'a[onclick*="stop"]',
            'a[onclick*="pause"]',
            'a[onclick*="reset"]',
          ];

          let foundStopButton = false;
          for (const selector of stopSelectors) {
            const elements = iframeDoc.querySelectorAll(selector);
            elements.forEach((element) => {
              const text = element.textContent.toLowerCase();
              const title = (element.getAttribute("title") || "").toLowerCase();

              if (
                text.includes("stop") ||
                text.includes("pause") ||
                text.includes("reset") ||
                text.includes("replay") ||
                title.includes("stop") ||
                title.includes("pause") ||
                title.includes("reset") ||
                title.includes("replay") ||
                text.includes("停止") ||
                text.includes("暂停") ||
                text.includes("重播") ||
                title.includes("停止") ||
                title.includes("暂停") ||
                title.includes("重播")
              ) {
                element.click();
                console.log("Stopped stroke animation via:", selector);
                foundStopButton = true;
              }
            });
            if (foundStopButton) break;
          }

          // If no stop button found, try to click the bishun-show element to toggle off
          if (!foundStopButton) {
            const bishunShow = iframeDoc.querySelector(".bishun-show");
            if (bishunShow) {
              bishunShow.click();
              console.log(
                "Stopped stroke animation by toggling bishun-show element",
              );
            }
          }
        }
      } catch (error) {
        console.error(
          "Error accessing iframe content to stop animation:",
          error,
        );
        // Fallback to iframe reload if direct control fails
        try {
          const currentSrc = iframe.src;
          iframe.src = currentSrc;
          console.log("Fallback: Reset stroke animation by reloading iframe");
        } catch (reloadError) {
          console.error("Even iframe reload failed:", reloadError);
        }
      }
    } else {
      console.log("Stroke animation iframe not found for stopping");
    }
  }

  updateToolbarVisualState() {
    // Update toolbar visual state based on audio and stroke states
    try {
      const toolbar = document.getElementById("edb-helper-toolbar");
      if (!toolbar) return;

      // Add active class if either audio or stroke is active
      if (this.audioAutoActive || this.strokeAnimationActive) {
        toolbar.classList.add("edb-auto-active");
      } else {
        toolbar.classList.remove("edb-auto-active");
      }
    } catch (err) {
      // Silently handle toolbar visual state errors
      console.debug(
        "Toolbar visual state update failed (this is normal):",
        err.message,
      );
    }
  }

  async addToLearningList() {
    // Extract character ID from URL
    let characterId = "";
    const urlMatch = window.location.href.match(/id=([0-9]+)/);
    if (urlMatch) {
      characterId = urlMatch[1].padStart(4, "0");
    } else {
      // Can't determine character ID, can't add to learning list
      return;
    }

    // Find the character from CHARACTERS data
    let character = "";
    if (typeof CHARACTERS !== "undefined") {
      const characterData = CHARACTERS.find((char) => char.id === characterId);
      if (characterData) {
        character = characterData.word;
      }
    }

    try {
      // Send message to background script to add character to learning
      const response = await chrome.runtime.sendMessage({
        action: "addToLearning",
        data: {
          character: character,
          characterId: characterId,
        },
      });

      if (response.success) {
        this.showNotification("已添加到學習列表");
        // Hide the add button since the character is now in the learning deck
        const addButton = document.getElementById("edb-add-to-learn");
        if (addButton) {
          addButton.style.display = "none";
        }
      } else {
        this.showNotification(response.message || "添加失敗");
      }
    } catch (error) {
      console.error("Error adding word to learning:", error);
      this.showNotification("添加失敗，請重試");
    }
  }

  showNotification(message) {
    // Remove any existing notifications first
    const existingNotifications = document.querySelectorAll(
      '#edb-notification, .edb-notification, [id*="notification"], .notification-overlay',
    );
    existingNotifications.forEach((notif) => notif.remove());

    // Remove any existing notification styles
    const existingStyles = document.querySelectorAll(
      "style[data-edb-notification], .notification-style",
    );
    existingStyles.forEach((style) => style.remove());

    // Create an overlay that covers the entire viewport
    const overlay = document.createElement("div");
    overlay.className = "notification-overlay";
    overlay.style.cssText = `
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            width: 100vw !important;
            height: 100vh !important;
            background: rgba(0,0,0,0.3) !important;
            z-index: 99999998 !important;
            display: flex !important;
            align-items: flex-start !important;
            justify-content: center !important;
            padding-top: 50px !important;
        `;

    const notification = document.createElement("div");
    notification.id = "edb-notification-viewport";
    notification.className = "edb-notification-viewport";
    notification.textContent = message;

    // Apply styles inline with maximum priority
    notification.style.cssText = `
            position: relative !important;
            background: #27ae60 !important;
            color: white !important;
            padding: 25px 35px !important;
            border-radius: 15px !important;
            z-index: 99999999 !important;
            box-shadow: 0 10px 30px rgba(0,0,0,0.9) !important;
            font-size: 20px !important;
            font-weight: bold !important;
            text-align: center !important;
            max-width: 85% !important;
            word-wrap: break-word !important;
            border: 5px solid #fff !important;
            outline: 4px solid #27ae60 !important;
            font-family: Arial, sans-serif !important;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.7) !important;
        `;

    overlay.appendChild(notification);
    document.body.appendChild(overlay);

    // Hide notification after normal delay
    setTimeout(() => {
      overlay.remove();
    }, 2000);
  }

  listenForMessages() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === "lookupCharacter") {
        this.handleCharacterLookup(request.text);
        sendResponse({ success: true });
      }
    });
  }

  setupPostMessageListener() {
    window.addEventListener("message", (event) => {
      // Only accept messages from same origin or our extension
      if (
        event.origin !== window.location.origin &&
        !event.source.location.href.includes("edbchinese.hk")
      ) {
        return;
      }

      switch (event.data.action) {
        case "enableLearningMode":
          this.enableLearningMode(event.data.cardId);
          break;
        case "showRatingInterface":
          this.showRatingInterface(event.data.cardId);
          break;
        case "rateCard":
          this.rateCard(event.data.cardId, event.data.quality);
          break;
      }
    });
  }

  handleCharacterLookup(text) {
    // Handle character lookup from context menu
    console.log("Looking up character:", text);
    // TODO: Implement character lookup functionality
  }

  enableLearningMode(cardId) {
    this.learningMode = true;
    this.currentCardId = cardId;
    console.log("Learning mode enabled for card:", cardId);
  }

  showRatingInterface(cardId) {
    this.learningMode = true;
    this.currentCardId = cardId;

    // Show rating buttons in the toolbar
    const toolbar = document.getElementById("edb-helper-toolbar");
    if (!toolbar) return;

    // Add or update rating section in toolbar
    let ratingSection = toolbar.querySelector(".edb-rating-section");
    if (!ratingSection) {
      ratingSection = document.createElement("div");
      ratingSection.className = "edb-rating-section";
      toolbar
        .querySelector(".edb-toolbar-container")
        .appendChild(ratingSection);
    }

    ratingSection.innerHTML = `
            <div class="rating-section">
                <div class="rating-label">請評分:</div>
                <div class="rating-buttons">
                    <button class="rating-btn again" data-quality="1">忘記</button>
                    <button class="rating-btn hard" data-quality="2">困難</button>
                    <button class="rating-btn good" data-quality="3">良好</button>
                    <button class="rating-btn easy" data-quality="4">簡單</button>
                </div>
            </div>
        `;

    // Add rating button event listeners
    ratingSection.querySelectorAll(".rating-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const quality = parseInt(e.target.dataset.quality);
        this.rateCard(cardId, quality);
      });
    });
  }

  async rateCard(cardId, quality) {
    try {
      console.log("rateCard called with cardId:", cardId, "quality:", quality);

      // Get current session info before rating
      const sessionResult = await chrome.storage.local.get(
        "currentLearningSession",
      );
      const session = sessionResult.currentLearningSession;

      if (session && session.cards) {
        const currentIndex = session.currentIndex || 0;
        const currentCard = session.cards[currentIndex];
        const nextCard = session.cards[currentIndex + 1];

        console.log("📍 Session mode detected:");
        console.log("   Current URL:", window.location.href);
        console.log("   Current session index:", currentIndex);
        console.log("   Current card characterId:", currentCard?.characterId);
        console.log("   Current card ID:", currentCard?.id);
        console.log("   Next card characterId:", nextCard?.characterId);
        console.log("   Next card ID:", nextCard?.id);
        console.log(
          "   Session cards:",
          session.cards.map((c) => ({ id: c.id, characterId: c.characterId })),
        );

        // Send rating and request next card in a single action to avoid race conditions
        const response = await chrome.runtime.sendMessage({
          action: "rateCardAndGetNext",
          data: {
            cardId: cardId,
            quality: quality,
          },
        });

        console.log("Background script response:", response);

        if (response.success) {
          this.showNotification(`評分已記錄 (${this.getQualityText(quality)})`);

          // Remove rating interface
          const ratingSection = document.querySelector(".edb-rating-section");
          if (ratingSection) {
            ratingSection.remove();
          }

          const info = response.sessionInfo;
          console.log("📊 Session Info:", info);

          // Check if there's a next card
          if (response.hasNextCard && info.nextCardId) {
            this.showNotification(
              `打開卡片 ${info.currentIndex + 1}/${info.totalCards}: ${info.nextCardId}`,
            );
            // Background script will handle opening next tab and closing current one
            console.log(
              "✅ Next card opening requested - you have 5 seconds to check the console logs before this tab closes",
            );
          } else {
            // No more cards, session complete
            this.showNotification("學習會話已完成！");
            console.log(
              "🎉 Learning session completed - staying on current page",
            );
          }
        } else {
          // Handle error case
          this.showNotification("評分失敗，請重試");
          console.error("❌ Failed to rate card:", response.message);
        }
      } else {
        console.log(
          "📍 Automatic mode detected - no active session, just rating the card",
        );

        // Just rate the card without session progression
        const response = await chrome.runtime.sendMessage({
          action: "rateCard",
          data: {
            cardId: cardId,
            quality: quality,
          },
        });

        console.log("Background script response:", response);

        if (response.success) {
          this.showNotification(`評分已記錄 (${this.getQualityText(quality)})`);

          // Remove rating interface
          const ratingSection = document.querySelector(".edb-rating-section");
          if (ratingSection) {
            ratingSection.remove();
          }

          this.showNotification("卡片評分完成！");
          console.log("✅ Card rated successfully in automatic mode");

          // Refresh learning history to show updated stats
          setTimeout(async () => {
            try {
              const result = await chrome.storage.local.get("edbLearningCards");
              const cards = result.edbLearningCards || [];
              const updatedCard = cards.find((card) => card.id === cardId);
              if (updatedCard) {
                this.showLearningHistory(updatedCard);
              }
            } catch (error) {
              console.error("Error refreshing learning history:", error);
            }
          }, 500);
        } else {
          this.showNotification("評分失敗，請重試");
          console.error("❌ Failed to rate card in automatic mode");
        }
      }
    } catch (error) {
      console.error("Error rating card:", error);
      this.showNotification("評分失敗，請重試");
    }
  }

  getQualityText(quality) {
    const qualityMap = {
      1: "忘記",
      2: "困難",
      3: "良好",
      4: "簡單",
    };
    return qualityMap[quality] || "未知";
  }
}

// Initialize content script
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    new EDBContentScript();
  });
} else {
  new EDBContentScript();
}

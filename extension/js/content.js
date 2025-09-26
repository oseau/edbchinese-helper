// Content script for EDB Chinese Helper
// Runs on edbchinese.hk pages

class EDBContentScript {
    constructor() {
        this.settings = {
            autoAudio: false,      // Disabled by default for new installations
            autoCantonese: true,   // Sub-options remain ready
            autoMandarin: true,
            autoStroke: false,     // Disabled by default
            toolbarCollapsed: false // Track toolbar collapsed state
        };
        this.audioEnabled = false; // Session-based audio permission
        this.audioContext = null; // AudioContext instance created on user gesture
        this.strokeAnimationActive = false; // Prevent multiple stroke animation triggers
        this.audioAutoActive = false; // Track audio auto-play state
        this.toolbarCollapsed = false; // Track toolbar state
        this.showingAudioPrompt = false; // Track if we're showing audio prompt
        this.init();
    }

    async init() {
        await this.loadSettings();
        await this.checkAudioPermission();
        this.makePageScrollable();
        this.setupPageEnhancements();
        this.setupUserInteraction();
        this.listenForMessages();
    }

    async loadSettings() {
        try {
            const result = await chrome.storage.local.get('edbHelperSettings');
            if (result.edbHelperSettings) {
                this.settings = { ...this.settings, ...result.edbHelperSettings };
            }
        } catch (error) {
            console.error('Error loading settings:', error);
        }
    }

    async saveSettings() {
        try {
            await chrome.storage.local.set({ edbHelperSettings: this.settings });
        } catch (error) {
            console.error('Error saving settings:', error);
        }
    }

    async checkAudioPermission() {
        try {
            // Check if we have session-based audio permission via background script
            const response = await chrome.runtime.sendMessage({
                action: 'checkAudioPermission'
            });
            if (response && response.enabled) {
                this.audioEnabled = true;
                console.log('Audio permission restored from session');
            }
        } catch (error) {
            console.error('Error checking audio permission:', error);
        }
    }

    async enableAudioPermanently() {
        try {
            // Enable audio for this browser session via background script
            await chrome.runtime.sendMessage({
                action: 'enableAudioPermission'
            });
            this.audioEnabled = true;
            console.log('Audio permission enabled for session');

            // AudioContext will be created on actual user interaction
        } catch (error) {
            console.error('Error enabling audio permission:', error);
        }
    }

    simulateUserInteraction() {
        // This method is deprecated - AudioContext creation now happens during actual user gestures
        console.log('simulateUserInteraction called - AudioContext will be created during actual user interactions');
    }

    createAudioContextOnGesture() {
        // Create AudioContext during actual user gesture to satisfy autoplay requirements
        try {
            if (!this.audioContext) {
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
                console.log('AudioContext created during user gesture');
            }

            // Resume if suspended
            if (this.audioContext.state === 'suspended') {
                this.audioContext.resume().then(() => {
                    console.log('AudioContext resumed during user gesture');
                }).catch(err => {
                    console.error('Failed to resume AudioContext:', err);
                });
            }
        } catch (e) {
            console.error('Failed to create AudioContext during user gesture:', e);
        }
    }

    updateSettings() {
        // Update settings from current checkbox states
        this.settings.autoAudio = document.getElementById('edb-auto-audio')?.checked || false;
        this.settings.autoCantonese = document.getElementById('edb-auto-cantonese')?.checked || false;
        this.settings.autoMandarin = document.getElementById('edb-auto-mandarin')?.checked || false;
        this.settings.autoStroke = document.getElementById('edb-auto-stroke')?.checked || false;
        this.settings.toolbarCollapsed = this.toolbarCollapsed;

        this.saveSettings();
    }

    makePageScrollable() {
        // Fix page layout issues and make it scrollable
        const style = document.createElement('style');
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
            const problematicElements = document.querySelectorAll('[style*="height: 100%"], [style*="position: fixed"]');
            problematicElements.forEach(el => {
                el.style.height = 'auto';
                el.style.position = 'relative';
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
        if (window.location.href.includes('result.jsp')) {
            this.addWordHelperButtons();
        }
    }

    addWordHelperButtons() {
        const wordContainer = document.querySelector('body');

        // Create helper toolbar with saved settings
        const toolbar = document.createElement('div');
        toolbar.id = 'edb-helper-toolbar';
        toolbar.innerHTML = `
            <div class="edb-toolbar-container">
                <div class="checkbox-group">
                    <label>
                        <input type="checkbox" id="edb-auto-audio" ${this.settings.autoAudio ? 'checked' : ''}>
                        <span>播放发音</span>
                    </label>
                    <div class="audio-options" id="edb-audio-options" style="display: ${this.settings.autoAudio ? 'flex' : 'none'};">
                        <label>
                            <input type="checkbox" id="edb-auto-cantonese" ${this.settings.autoCantonese ? 'checked' : ''}>
                            <span>粵語</span>
                        </label>
                        <label>
                            <input type="checkbox" id="edb-auto-mandarin" ${this.settings.autoMandarin ? 'checked' : ''}>
                            <span>普通話</span>
                        </label>
                    </div>
                </div>
                <div class="checkbox-group">
                    <label>
                        <input type="checkbox" id="edb-auto-stroke" ${this.settings.autoStroke ? 'checked' : ''}>
                        <span>显示笔画</span>
                    </label>
                </div>
                <button id="edb-add-to-learn">加入学习</button>
                <button id="edb-toggle-helper">隐藏工具栏</button>
            </div>
        `;

        // Add styles
        const style = document.createElement('style');
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
        `;

        document.head.appendChild(style);
        document.body.appendChild(toolbar);
        console.log('Toolbar created and added to DOM');

        // Apply saved toolbar state
        if (this.settings.toolbarCollapsed) {
            const toolbar = document.getElementById('edb-helper-toolbar');
            const container = toolbar.querySelector('.edb-toolbar-container');
            const toggleButton = document.getElementById('edb-toggle-helper');

            // Apply collapsed state
            toolbar.classList.add('edb-toolbar-collapsed');
            this.toolbarCollapsed = true;
            toggleButton.textContent = '◀';
            console.log('Applied saved collapsed state to toolbar');
        }

        // Setup button handlers
        this.setupToolbarHandlers();

        // Setup auto-play functionality
        this.setupAutoPlayHandlers();
    }

    setupToolbarHandlers() {
        console.log('Setting up toolbar handlers...');
        const toggleButton = document.getElementById('edb-toggle-helper');
        console.log('Toggle button found:', !!toggleButton);
        console.log('Toggle button HTML:', toggleButton?.outerHTML);

        document.getElementById('edb-add-to-learn')?.addEventListener('click', (event) => {
            // Create AudioContext during this user gesture
            this.createAudioContextOnGesture();
            this.addToLearningList();
        });

        // Add event listener with better error handling
        if (toggleButton) {
            toggleButton.addEventListener('click', (e) => {
                // Create AudioContext during this user gesture
                this.createAudioContextOnGesture();
                console.log('Toggle button clicked!', e.target);
                console.log('Event type:', e.type);
                console.log('Current target:', e.currentTarget);

                const toolbar = document.getElementById('edb-helper-toolbar');
                const container = toolbar.querySelector('.edb-toolbar-container');
                const currentButton = e.currentTarget; // Use currentTarget to ensure we get the button element

                console.log('Toolbar found:', !!toolbar);
                console.log('Container found:', !!container);
                console.log('Toolbar collapsed state (class):', toolbar.classList.contains('edb-toolbar-collapsed'));
                console.log('Toolbar collapsed state (variable):', this.toolbarCollapsed);

                // Check if toolbar is currently collapsed using state variable
                if (this.toolbarCollapsed) {
                    console.log('Expanding toolbar...');

                    // Remove collapsed state first to allow CSS transitions
                    toolbar.classList.remove('edb-toolbar-collapsed');
                    this.toolbarCollapsed = false;

                    // Update button text after CSS transition
                    setTimeout(() => {
                        currentButton.textContent = '隐藏工具栏';
                    }, 100);

                    // Save settings to persist toolbar state
                    this.updateSettings();
                } else {
                    console.log('Collapsing toolbar...');

                    // Change button text before adding collapsed class
                    currentButton.textContent = '◀';

                    // Add collapsed state to trigger CSS transition
                    console.log('Original handler - Before adding class:', toolbar.className);
                    toolbar.classList.add('edb-toolbar-collapsed');
                    this.toolbarCollapsed = true;
                    console.log('Original handler - After adding class:', toolbar.className);

                    // Save settings to persist toolbar state
                    this.updateSettings();

                    // Debug: Check if the button is still clickable
                    setTimeout(() => {
                        console.log('Post-collapse debug:');
                        console.log('  - Button element:', currentButton);
                        console.log('  - Button visible:', currentButton.offsetParent !== null);
                        console.log('  - Button dimensions:', currentButton.offsetWidth, 'x', currentButton.offsetHeight);
                        console.log('  - Toolbar classes:', toolbar.className);
                        console.log('  - Button onclick:', currentButton.onclick);
                        console.log('  - Button event listeners:', currentButton.hasAttribute('onclick'));
                    }, 200);
                }
            });

            // Also add event delegation as backup
            document.addEventListener('click', (e) => {
                const toolbar = document.getElementById('edb-helper-toolbar');
                const isToggleButton = e.target.closest('#edb-toggle-helper');
                const isCollapsedToolbar = toolbar && toolbar.classList.contains('edb-toolbar-collapsed') && toolbar.contains(e.target);

                if (isToggleButton || isCollapsedToolbar) {
                    // Create AudioContext during this user gesture
                    this.createAudioContextOnGesture();
                    console.log('Toggle button clicked via event delegation!');
                    console.log('Is toggle button:', isToggleButton);
                    console.log('Is collapsed toolbar:', isCollapsedToolbar);
                    e.preventDefault();
                    e.stopPropagation();

                    const toolbar = document.getElementById('edb-helper-toolbar');
                    const container = toolbar.querySelector('.edb-toolbar-container');
                    const currentButton = e.target.closest('#edb-toggle-helper') || toolbar.querySelector('#edb-toggle-helper');

                    console.log('Toolbar found:', !!toolbar);
                    console.log('Container found:', !!container);
                    console.log('Toolbar collapsed state (class):', toolbar.classList.contains('edb-toolbar-collapsed'));
                    console.log('Toolbar collapsed state (variable):', this.toolbarCollapsed);

                    // Check if toolbar is currently collapsed using state variable
                    if (this.toolbarCollapsed) {
                        console.log('Expanding toolbar via delegation...');
                        console.log('Before expansion - collapsed classes:', toolbar.className);

                        // Remove collapsed state first to allow CSS transitions
                        toolbar.classList.remove('edb-toolbar-collapsed');
                        this.toolbarCollapsed = false;
                        console.log('After class removal - collapsed classes:', toolbar.className);

                        // Update button text after CSS transition
                        setTimeout(() => {
                            console.log('Executing expansion timeout...');
                            currentButton.textContent = '隐藏工具栏';
                            console.log('Button text set to:', currentButton.textContent);
                        }, 100);

                        // Save settings to persist toolbar state
                        this.updateSettings();
                    } else {
                        console.log('Collapsing toolbar via delegation...');

                        // Change button text before adding collapsed class
                        currentButton.textContent = '◀';

                        // Add collapsed state to trigger CSS transition
                        console.log('Before adding class - current classes:', toolbar.className);
                        toolbar.classList.add('edb-toolbar-collapsed');
                        this.toolbarCollapsed = true;
                        console.log('After adding class - current classes:', toolbar.className);
                        console.log('Class contains check immediately after:', toolbar.classList.contains('edb-toolbar-collapsed'));

                        // Save settings to persist toolbar state
                        this.updateSettings();
                    }
                }
            }, true); // Use capture phase

            // Add comprehensive click logging to debug the green ball issue
            document.addEventListener('click', (e) => {
                const toolbar = document.getElementById('edb-helper-toolbar');
                if (toolbar && toolbar.classList.contains('edb-toolbar-collapsed')) {
                    console.log('=== GREEN BALL CLICK DEBUG ===');
                    console.log('Click target:', e.target);
                    console.log('Click target ID:', e.target.id);
                    console.log('Click target class:', e.target.className);
                    console.log('Click target tag:', e.target.tagName);
                    console.log('Is target inside toolbar?', toolbar.contains(e.target));
                    console.log('Is target the toggle button?', e.target.closest('#edb-toggle-helper'));
                    console.log('Toolbar bounding rect:', toolbar.getBoundingClientRect());
                    console.log('Target bounding rect:', e.target.getBoundingClientRect());
                    console.log('Mouse coordinates:', e.clientX, e.clientY);
                    console.log('==============================');
                }
            }, true);
        } else {
            console.error('Toggle button not found when setting up handlers!');
        }
    }

    addWordListEnhancements() {
        // Check if we're on a word list page
        if (window.location.href.includes('lexlist_ch')) {
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
        const audioCheckbox = document.getElementById('edb-auto-audio');
        const audioOptions = document.getElementById('edb-audio-options');
        const strokeCheckbox = document.getElementById('edb-auto-stroke');

        // Show/hide audio options when main audio checkbox is toggled
        audioCheckbox.addEventListener('change', (event) => {
            // Create AudioContext during this user gesture
            this.createAudioContextOnGesture();

            if (audioCheckbox.checked) {
                audioOptions.style.display = 'flex';

                // Enable audio permission immediately when checkbox is checked
                if (!this.audioEnabled) {
                    this.enableAudioPermanently();
                    console.log('Audio permission enabled via checkbox click');
                }

                // Start audio playback
                setTimeout(() => this.startAutoPlay(), 100);
            } else {
                audioOptions.style.display = 'none';
                this.stopAutoPlay();
            }
            this.updateSettings();
        });

        // Handle sub-checkbox changes
        document.getElementById('edb-auto-cantonese').addEventListener('change', (event) => {
            // Create AudioContext during this user gesture
            this.createAudioContextOnGesture();

            if (audioCheckbox.checked) {
                this.startAutoPlay();
            }
            this.updateSettings();
        });

        document.getElementById('edb-auto-mandarin').addEventListener('change', (event) => {
            // Create AudioContext during this user gesture
            this.createAudioContextOnGesture();

            if (audioCheckbox.checked) {
                this.startAutoPlay();
            }
            this.updateSettings();
        });

        // Handle stroke animation checkbox
        strokeCheckbox.addEventListener('change', () => {
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
        const playCantonese = document.getElementById('edb-auto-cantonese')?.checked;
        const playMandarin = document.getElementById('edb-auto-mandarin')?.checked;

        if (!playCantonese && !playMandarin) return;

        // Add visual indicator for audio only
        this.audioAutoActive = true;
        this.updateToolbarVisualState();

        // Play audio if we have session permission
        if (this.audioEnabled) {
            console.log('Playing audio with session permission');
            // Start audio after a short delay
            setTimeout(() => {
                // Start audio
                if (playCantonese) {
                    this.safePlayAudio('cantonese');
                }
            }, 500);

            // Play second audio with delay if needed
            if (playMandarin && playCantonese) {
                setTimeout(() => {
                    this.safePlayAudio('mandarin');
                }, 2000);
            } else if (playMandarin) {
                setTimeout(() => {
                    this.safePlayAudio('mandarin');
                }, 500);
            }
        } else {
            console.log('Audio auto-play waiting for session permission');
            // Try to enable audio permission one more time
            this.enableAudioPermanently().then(() => {
                // Retry playing audio after enabling permission
                setTimeout(() => {
                    if (this.audioEnabled) {
                        console.log('Retrying audio playback after enabling permission');
                        if (playCantonese) {
                            this.safePlayAudio('cantonese');
                        }
                        if (playMandarin && playCantonese) {
                            setTimeout(() => this.safePlayAudio('mandarin'), 2000);
                        } else if (playMandarin) {
                            setTimeout(() => this.safePlayAudio('mandarin'), 500);
                        }
                    } else {
                        this.showAudioPrompt();
                    }
                }, 200);
            });
        }
    }

    async startAutoPlayAndVerify() {
        // Method that verifies successful audio playback
        const playCantonese = document.getElementById('edb-auto-cantonese')?.checked;
        const playMandarin = document.getElementById('edb-auto-mandarin')?.checked;

        if (!playCantonese && !playMandarin) return false;

        // Add visual indicator for audio only
        this.audioAutoActive = true;
        this.updateToolbarVisualState();

        // Play audio if we have session permission
        if (this.audioEnabled) {
            console.log('Playing audio with session permission and verification');

            return new Promise((resolve) => {
                let audioPlayed = false;

                // Start audio after a short delay
                setTimeout(() => {
                    // Start audio
                    if (playCantonese) {
                        this.safePlayAudio('cantonese');
                        audioPlayed = true;
                    }
                }, 500);

                // Play second audio with delay if needed
                if (playMandarin && playCantonese) {
                    setTimeout(() => {
                        this.safePlayAudio('mandarin');
                        audioPlayed = true;
                    }, 2000);
                } else if (playMandarin) {
                    setTimeout(() => {
                        this.safePlayAudio('mandarin');
                        audioPlayed = true;
                    }, 500);
                }

                // Resolve after a reasonable time to confirm audio is working
                setTimeout(() => {
                    console.log('Audio playback verification completed, success:', audioPlayed);
                    resolve(audioPlayed);
                }, playMandarin && playCantonese ? 3000 : 1500);
            });
        } else {
            console.log('Audio auto-play waiting for session permission');
            this.showAudioPrompt();
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
        console.log('Starting stroke animation');
        this.showStrokeAnimation();
    }

    stopAutoStroke() {
        this.strokeAnimationActive = false;
        this.updateToolbarVisualState();

        // Actually stop the stroke animation if it's running
        this.stopStrokeAnimation();
    }

    playAudio(language) {
        // Try extension-based audio playback first
        this.playAudioFromExtension(language);
    }

    safePlayAudio(language) {
        // Try extension-based audio playback first (bypasses autoplay restrictions)
        this.playAudioFromExtension(language);
    }

    async playAudioFromExtension(language) {
        try {
            // Extract audio parameters from the page
            const audioParams = this.extractAudioParams(language);
            if (audioParams) {
                // Try to play audio using offscreen document
                const response = await chrome.runtime.sendMessage({
                    action: 'playAudio',
                    language: language,
                    params: audioParams
                });

                if (response && response.success) {
                    console.log(`Playing ${language} audio from extension context`);
                } else {
                    throw new Error('Extension audio failed');
                }
            } else {
                throw new Error('No audio parameters found');
            }
        } catch (error) {
            console.log('Extension audio failed, falling back to page method:', error);
            this.playAudioFromPage(language);
        }
    }

    extractAudioParams(language) {
        // Extract the audio function parameters from the page
        const images = document.querySelectorAll('img[onclick*="doSound"]');
        console.log(`Found ${images.length} audio images for ${language}`);

        for (let img of images) {
            const onclick = img.getAttribute('onclick') || '';
            console.log(`Checking image onclick: ${onclick}`);

            if (language === 'cantonese' && onclick.includes('doSoundyp')) {
                // Extract parameter from doSoundyp('jat1')
                const match = onclick.match(/doSoundyp\(['"]([^'"]+)['"]\)/);
                if (match) {
                    console.log(`Found Cantonese param: ${match[1]}`);
                    return { type: 'cantonese', param: match[1] };
                }
            } else if (language === 'mandarin' && onclick.includes('doSoundhp')) {
                // Extract parameter from doSoundhp('yi1')
                const match = onclick.match(/doSoundhp\(['"]([^'"]+)['"]\)/);
                if (match) {
                    console.log(`Found Mandarin param: ${match[1]}`);
                    return { type: 'mandarin', param: match[1] };
                }
            }
        }

        console.log(`No ${language} audio parameters found`);
        return null;
    }

    playAudioFromPage(language) {
        // Fallback method: click the audio buttons on the page
        setTimeout(() => {
            if (language === 'cantonese') {
                this.playCantoneseAudio();
            } else if (language === 'mandarin') {
                this.playMandarinAudio();
            }
        }, 100);
    }

    playCantoneseAudio() {
        // Method 1: Direct image index approach - $('img')[1]
        const images = document.querySelectorAll('img');
        if (images.length >= 2) {
            const cantoneseImg = images[1];
            if (cantoneseImg && cantoneseImg.onclick && cantoneseImg.onclick.toString().includes('doSoundyp')) {
                console.log('Playing Cantonese audio (method 1)');
                cantoneseImg.click();
                return;
            }
        }

        // Method 2: Find by onclick attribute containing 'doSoundyp'
        const soundypElements = document.querySelectorAll('[onclick*="doSoundyp"]');
        if (soundypElements.length > 0) {
            console.log('Playing Cantonese audio (method 2)');
            soundypElements[0].click();
            return;
        }

        // Method 3: Find by alt attribute containing '粵'
        const cantoneseElements = document.querySelectorAll('img[alt*="粵"], img[alt*="Cantonese"], img[alt*="广东"]');
        if (cantoneseElements.length > 0) {
            console.log('Playing Cantonese audio (method 3)');
            cantoneseElements[0].click();
            return;
        }

        console.log('Cantonese audio not found');
    }

    playMandarinAudio() {
        // Method 1: Direct image index approach - $('img')[0]
        const images = document.querySelectorAll('img');
        if (images.length >= 1) {
            const mandarinImg = images[0];
            if (mandarinImg && mandarinImg.onclick && mandarinImg.onclick.toString().includes('doSoundhp')) {
                console.log('Playing Mandarin audio (method 1)');
                mandarinImg.click();
                return;
            }
        }

        // Method 2: Find by onclick attribute containing 'doSoundhp'
        const soundhpElements = document.querySelectorAll('[onclick*="doSoundhp"]');
        if (soundhpElements.length > 0) {
            console.log('Playing Mandarin audio (method 2)');
            soundhpElements[0].click();
            return;
        }

        // Method 3: Find by alt attribute containing '普通話' or related terms
        const mandarinElements = document.querySelectorAll('img[alt*="普通话"], img[alt*="Mandarin"], img[alt*="国语"], img[alt*="播放讀音"]');
        if (mandarinElements.length > 0) {
            console.log('Playing Mandarin audio (method 3)');
            mandarinElements[0].click();
            return;
        }

        console.log('Mandarin audio not found');
    }

    setupUserInteraction() {
        // Set up user interaction tracking as backup method
        const interactions = ['click', 'touchstart', 'keydown'];

        interactions.forEach(event => {
            document.addEventListener(event, () => {
                // Create AudioContext during this user gesture
                this.createAudioContextOnGesture();

                // Enable audio if user interacts and audio features might be needed
                if (!this.audioEnabled) {
                    // Check if audio is enabled in settings or currently checked
                    const audioCheckbox = document.getElementById('edb-auto-audio');
                    const isAudioWanted = this.settings.autoAudio || (audioCheckbox?.checked);

                    if (isAudioWanted || this.showingAudioPrompt) {
                        this.enableAudioPermanently();
                        console.log('User interaction detected - audio autoplay enabled');

                        // Hide the audio enable button when any interaction occurs
                        this.hideAudioEnableButton();

                        // If auto-play was enabled, start it now
                        if (audioCheckbox?.checked) {
                            setTimeout(() => this.startAutoPlay(), 100);
                        }
                    }
                }
            }, { once: true }); // Only need one interaction
        });
    }

    hideAudioEnableButton() {
        // Hide the audio enable button when user interacts with the page
        const toolbar = document.getElementById('edb-helper-toolbar');
        if (!toolbar) return;

        const buttonContainer = toolbar.querySelector('.manual-play-buttons');
        if (buttonContainer) {
            buttonContainer.remove();
            this.showingAudioPrompt = false;
            console.log('Audio enable button hidden due to user interaction');
        }
    }

    addManualPlayButtons() {
        // Only show button if audio is not enabled
        if (this.audioEnabled) return;

        const toolbar = document.getElementById('edb-helper-toolbar');
        if (!toolbar) return;

        // Check if button already exists
        if (toolbar.querySelector('.manual-play-buttons')) return;

        // Mark that we're showing audio prompt
        this.showingAudioPrompt = true;

        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'manual-play-buttons';
        buttonContainer.innerHTML = `
            <button id="edb-enable-audio" style="font-size: 10px; padding: 4px 8px; margin-top: 4px;">
                📢 启用音频自动播放 (一次即可)
            </button>
        `;

        // Add styles for manual buttons
        const style = document.createElement('style');
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
        document.getElementById('edb-enable-audio').addEventListener('click', (event) => {
            // Create AudioContext during this user gesture
            this.createAudioContextOnGesture();

            this.enableAudioPermanently();
            this.showNotification('✅ 音频自动播放已启用！本会话有效');

            // Remove the button immediately since user interaction enables audio
            buttonContainer.remove();
            this.showingAudioPrompt = false;
            console.log('Audio enable button removed after click');

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
        return this.settings.autoAudio ||
               (document.getElementById('edb-auto-audio')?.checked) ||
               this.showingAudioPrompt;
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
                    if (document.getElementById('edb-auto-audio')?.checked) {
                        this.startAutoPlay();
                    }
                    if (document.getElementById('edb-auto-stroke')?.checked) {
                        this.startAutoStroke();
                    }
                }, 1000);
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    // Legacy methods kept for compatibility
    playWordAudio() {
        this.playAudio('cantonese'); // Default to Cantonese
    }

    showStrokeAnimation() {
        console.log('showStrokeAnimation called, strokeAnimationActive:', this.strokeAnimationActive);

        // The stroke animation controls are inside an iframe
        const iframe = document.querySelector('iframe[src*="stkdemo_js"]');

        if (iframe) {
            try {
                // Access the iframe document
                const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;

                if (iframeDoc) {
                    // Look for the bishun-show element inside the iframe
                    const bishunShow = iframeDoc.querySelector('.bishun-show');

                    if (bishunShow) {
                        // Click the button and mark as active
                        console.log('Activating stroke animation via bishun-show element');
                        bishunShow.click();
                        this.strokeAnimationActive = true;
                        console.log('Stroke animation activated successfully');
                    } else {
                        // Fallback: look for stroke-related buttons inside iframe
                        console.log('bishun-show element not found in iframe, trying fallback methods');

                        const fallbackSelectors = [
                            '[class*="bishun"]',
                            '[class*="stroke"]',
                            '[class*="笔画"]',
                            'button[onclick*="stroke"]',
                            'a[onclick*="stroke"]',
                            'button[onclick*="笔画"]',
                            'a[onclick*="笔画"]',
                            '*[onclick*="bishun"]'
                        ];

                        let foundButton = false;
                        for (const selector of fallbackSelectors) {
                            const elements = iframeDoc.querySelectorAll(selector);
                            elements.forEach(element => {
                                if (element.textContent.includes('笔画') ||
                                    element.textContent.includes('stroke') ||
                                    element.getAttribute('title')?.includes('笔画') ||
                                    element.getAttribute('title')?.includes('stroke')) {
                                    element.click();
                                    console.log('Stroke animation triggered via iframe fallback method:', selector);
                                    this.strokeAnimationActive = true;
                                    foundButton = true;
                                }
                            });
                            if (foundButton) break;
                        }

                        if (!foundButton) {
                            console.log('No stroke animation button found in iframe');
                            this.strokeAnimationActive = false; // Ensure flag is reset if no button found
                        }
                    }
                } else {
                    console.log('Could not access iframe document');
                    this.strokeAnimationActive = false;
                }
            } catch (error) {
                console.error('Error accessing iframe content:', error);
                this.strokeAnimationActive = false;
            }
        } else {
            console.log('Stroke animation iframe not found');
            this.strokeAnimationActive = false;
        }
    }

    stopStrokeAnimation() {
        // Stop the stroke animation if it's running
        const iframe = document.querySelector('iframe[src*="stkdemo_js"]');

        if (iframe) {
            try {
                // Access the iframe document
                const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;

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
                        'a[onclick*="reset"]'
                    ];

                    let foundStopButton = false;
                    for (const selector of stopSelectors) {
                        const elements = iframeDoc.querySelectorAll(selector);
                        elements.forEach(element => {
                            const text = element.textContent.toLowerCase();
                            const title = (element.getAttribute('title') || '').toLowerCase();

                            if (text.includes('stop') || text.includes('pause') || text.includes('reset') || text.includes('replay') ||
                                title.includes('stop') || title.includes('pause') || title.includes('reset') || title.includes('replay') ||
                                text.includes('停止') || text.includes('暂停') || text.includes('重播') ||
                                title.includes('停止') || title.includes('暂停') || title.includes('重播')) {
                                element.click();
                                console.log('Stopped stroke animation via:', selector);
                                foundStopButton = true;
                            }
                        });
                        if (foundStopButton) break;
                    }

                    // If no stop button found, try to click the bishun-show element to toggle off
                    if (!foundStopButton) {
                        const bishunShow = iframeDoc.querySelector('.bishun-show');
                        if (bishunShow) {
                            bishunShow.click();
                            console.log('Stopped stroke animation by toggling bishun-show element');
                        }
                    }
                }
            } catch (error) {
                console.error('Error accessing iframe content to stop animation:', error);
                // Fallback to iframe reload if direct control fails
                try {
                    const currentSrc = iframe.src;
                    iframe.src = currentSrc;
                    console.log('Fallback: Reset stroke animation by reloading iframe');
                } catch (reloadError) {
                    console.error('Even iframe reload failed:', reloadError);
                }
            }
        } else {
            console.log('Stroke animation iframe not found for stopping');
        }
    }

    updateToolbarVisualState() {
        // Update toolbar visual state based on audio and stroke states
        const toolbar = document.getElementById('edb-helper-toolbar');
        if (!toolbar) return;

        // Add active class if either audio or stroke is active
        if (this.audioAutoActive || this.strokeAnimationActive) {
            toolbar.classList.add('edb-auto-active');
        } else {
            toolbar.classList.remove('edb-auto-active');
        }
    }

    async addToLearningList() {
        // Extract current word from page
        const wordElement = document.querySelector('span, div, h1, h2, h3');
        if (!wordElement) return;

        const word = wordElement.textContent.trim();
        if (!word || word.length === 0) return;

        try {
            // Send message to background script to save word
            const response = await chrome.runtime.sendMessage({
                action: 'saveProgress',
                data: {
                    word: word,
                    timestamp: Date.now(),
                    status: 'learning'
                }
            });

            if (response.success) {
                this.showNotification('已添加到学习列表');
            }
        } catch (error) {
            console.error('Error saving word:', error);
            this.showNotification('保存失败，请重试');
        }
    }

    showNotification(message) {
        const notification = document.createElement('div');
        notification.id = 'edb-notification';
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

        const style = document.createElement('style');
        style.textContent = `
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
        `;

        document.head.appendChild(style);
        document.body.appendChild(notification);

        setTimeout(() => {
            notification.remove();
        }, 3000);
    }

    listenForMessages() {
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            if (request.action === 'lookupCharacter') {
                this.handleCharacterLookup(request.text);
                sendResponse({ success: true });
            }
        });
    }

    handleCharacterLookup(text) {
        // Handle character lookup from context menu
        console.log('Looking up character:', text);
        // TODO: Implement character lookup functionality
    }
}

// Initialize content script
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        new EDBContentScript();
    });
} else {
    new EDBContentScript();
}
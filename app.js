/* ============================================
   LOFI POMODORO — INTERACTIVE ENGINE V2
   ============================================ */

(() => {
    'use strict';

    // ==========================================
    // DEFAULT SETTINGS
    // ==========================================
    const DEFAULTS = {
        workMinutes: 25,
        shortBreakMinutes: 5,
        longBreakMinutes: 15,
        sessionsBeforeLong: 4,
        autoSequence: true,
        autoStart: true,
        notifSound: true,
        browserNotif: true,
        particles: true,
        timerPosition: 'center-center',
        timerSize: 'medium', // small, medium, large
        workBg: { type: 'image', source: 'assets/lofi-bg.jpg' },
        breakBg: { type: 'default', source: 'assets/lofi-bg.jpg' }
    };

    // ==========================================
    // SETTINGS MANAGER
    // ==========================================
    const Settings = {
        _data: null,

        load() {
            try {
                const saved = localStorage.getItem('lofi-pomodoro-settings');
                this._data = saved ? { ...DEFAULTS, ...JSON.parse(saved) } : { ...DEFAULTS };
            } catch {
                this._data = { ...DEFAULTS };
            }
            return this._data;
        },

        save() {
            try {
                localStorage.setItem('lofi-pomodoro-settings', JSON.stringify(this._data));
            } catch (e) {
                console.warn('Could not save settings:', e);
            }
        },

        get(key) {
            if (!this._data) this.load();
            return this._data[key] ?? DEFAULTS[key];
        },

        set(key, value) {
            if (!this._data) this.load();
            this._data[key] = value;
        },

        resetAll() {
            this._data = { ...DEFAULTS };
            this.save();
        }
    };

    // ==========================================
    // TIMER STATE
    // ==========================================
    const state = {
        timeRemaining: 0,
        totalTime: 0,
        isRunning: false,
        isPaused: false,
        currentMode: 'work',
        currentSession: 1,
        completedSessions: 0,
        intervalId: null
    };

    // ==========================================
    // DOM REFERENCES
    // ==========================================
    let dom = {};

    function cacheDom() {
        dom = {
            // Intro
            introScreen: document.getElementById('intro-screen'),
            hourglassWrapper: document.getElementById('hourglass-wrapper'),
            // Background
            bgImageLayer: document.getElementById('bg-image-layer'),
            bgVideoLayer: document.getElementById('bg-video-layer'),
            bgYoutubeLayer: document.getElementById('bg-youtube-layer'),
            // Canvas
            canvas: document.getElementById('particle-canvas'),
            // Timer Widget
            timerWidget: document.getElementById('timer-widget'),
            minutes: document.getElementById('minutes'),
            seconds: document.getElementById('seconds'),
            modeLabel: document.getElementById('timer-mode-label'),
            btnStart: document.getElementById('btn-start'),
            btnReset: document.getElementById('btn-reset'),
            btnSkip: document.getElementById('btn-skip'),
            progressCircle: document.getElementById('progress-circle'),
            sessionDots: document.getElementById('session-dots'),
            sessionCount: document.getElementById('session-count'),
            modeBtns: document.querySelectorAll('.mode-btn'),
            iconPlay: document.getElementById('icon-play'),
            iconPause: document.getElementById('icon-pause'),
            notifFlash: document.getElementById('notification-flash'),
            // Settings
            settingsBtn: document.getElementById('settings-btn'),
            settingsModal: document.getElementById('settings-modal'),
            settingsClose: document.getElementById('settings-close'),
            settingsCancel: document.getElementById('settings-cancel'),
            settingsSave: document.getElementById('settings-save'),
            settingsBackdrop: document.querySelector('.settings-backdrop'),
            navBtns: document.querySelectorAll('.nav-btn'),
            tabPanels: document.querySelectorAll('.tab-panel'),
            // Settings inputs
            setWork: document.getElementById('set-work'),
            setShort: document.getElementById('set-short'),
            setLong: document.getElementById('set-long'),
            setAutoSequence: document.getElementById('set-auto-sequence'),
            setNotifSound: document.getElementById('set-notif-sound'),
            setBrowserNotif: document.getElementById('set-browser-notif'),
            setAutoStart: document.getElementById('set-auto-start'),
            setParticles: document.getElementById('set-particles'),
            // Background inputs
            workBgUpload: document.getElementById('work-bg-upload'),
            breakBgUpload: document.getElementById('break-bg-upload'),
            workYtUrl: document.getElementById('work-yt-url'),
            breakYtUrl: document.getElementById('break-yt-url'),
            workYtApply: document.getElementById('work-yt-apply'),
            breakYtApply: document.getElementById('break-yt-apply'),
            workBgPreview: document.getElementById('work-bg-preview'),
            breakBgPreview: document.getElementById('break-bg-preview'),
            resetBgBtns: document.querySelectorAll('.reset-bg-btn'),
            // Layout
            positionGrid: document.getElementById('position-grid'),
            posCells: document.querySelectorAll('.pos-cell'),
            timerSizeSlider: document.getElementById('timer-size-slider'),
            sizeValueLabel: document.getElementById('size-value-label'),
            // General
            btnResetAll: document.getElementById('btn-reset-all')
        };
    }

    // ==========================================
    // BACKGROUND MANAGER
    // ==========================================
    const BackgroundManager = {
        currentMode: 'work',

        init() {
            this.applyBackground('work');
        },

        applyBackground(mode) {
            const bgKey = mode === 'work' ? 'workBg' : 'breakBg';
            const bg = Settings.get(bgKey);

            // Reset all layers
            dom.bgImageLayer.style.opacity = '0';
            dom.bgVideoLayer.classList.remove('active');
            dom.bgYoutubeLayer.classList.remove('active');

            if (!bg || bg.type === 'default' || bg.type === 'image') {
                const src = (bg && bg.source) ? bg.source : 'assets/lofi-bg.jpg';
                dom.bgImageLayer.style.backgroundImage = `url('${src}')`;
                dom.bgImageLayer.style.opacity = '1';
                // Pause video if was playing
                dom.bgVideoLayer.pause();
            } else if (bg.type === 'video') {
                dom.bgVideoLayer.src = bg.source;
                dom.bgVideoLayer.classList.add('active');
                dom.bgVideoLayer.play().catch(() => {});
            } else if (bg.type === 'youtube') {
                const videoId = this.extractYouTubeId(bg.source);
                if (videoId) {
                    dom.bgYoutubeLayer.innerHTML = `<iframe 
                        src="https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&loop=1&playlist=${videoId}&controls=0&showinfo=0&rel=0&iv_load_policy=3&modestbranding=1&playsinline=1&enablejsapi=1&vq=hd1080"
                        allow="autoplay; encrypted-media" allowfullscreen></iframe>`;
                    dom.bgYoutubeLayer.classList.add('active');
                }
            }

            this.currentMode = mode;
        },

        switchToMode(mode) {
            const bgKey = mode === 'work' ? 'workBg' : 'breakBg';
            const bg = Settings.get(bgKey);
            // Only switch if there's a specific background for this mode
            if (bg && bg.type !== 'default') {
                this.applyBackground(mode);
            } else if (mode !== 'work') {
                // Use work background as fallback for break
                this.applyBackground('work');
            }
        },

        extractYouTubeId(url) {
            if (!url) return null;
            const patterns = [
                /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
                /^([a-zA-Z0-9_-]{11})$/
            ];
            for (const pattern of patterns) {
                const match = url.match(pattern);
                if (match) return match[1];
            }
            return null;
        },

        handleFileUpload(file, mode) {
            return new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = (e) => {
                    const isVideo = file.type.startsWith('video/');
                    const bgData = {
                        type: isVideo ? 'video' : 'image',
                        source: e.target.result
                    };
                    Settings.set(mode === 'work' ? 'workBg' : 'breakBg', bgData);
                    resolve(bgData);
                };
                reader.readAsDataURL(file);
            });
        },

        updatePreview(mode) {
            const bgKey = mode === 'work' ? 'workBg' : 'breakBg';
            const bg = Settings.get(bgKey);
            const previewEl = mode === 'work' ? dom.workBgPreview : dom.breakBgPreview;

            if (bg && bg.type === 'image' && bg.source) {
                previewEl.style.backgroundImage = `url('${bg.source}')`;
                previewEl.innerHTML = '';
            } else if (bg && bg.type === 'youtube' && bg.source) {
                previewEl.style.backgroundImage = '';
                const videoId = this.extractYouTubeId(bg.source);
                if (videoId) {
                    previewEl.style.backgroundImage = `url('https://img.youtube.com/vi/${videoId}/mqdefault.jpg')`;
                    previewEl.innerHTML = '<span style="font-size:1.2rem">▶</span>';
                }
            } else {
                previewEl.style.backgroundImage = '';
                previewEl.innerHTML = '<span class="bg-preview-placeholder">Varsayılan</span>';
            }
        }
    };

    // ==========================================
    // PARTICLE SYSTEM
    // ==========================================
    let ctx, particles = [], animFrameId;

    function resizeCanvas() {
        if (!dom.canvas) return;
        dom.canvas.width = window.innerWidth;
        dom.canvas.height = window.innerHeight;
    }

    class Particle {
        constructor(type) {
            this.type = type;
            this.reset();
        }

        reset() {
            const w = dom.canvas.width;
            const h = dom.canvas.height;

            switch (this.type) {
                case 'star':
                    this.x = Math.random() * w;
                    this.y = Math.random() * h * 0.4;
                    this.size = Math.random() * 2 + 0.5;
                    this.baseAlpha = Math.random() * 0.5 + 0.15;
                    this.alpha = this.baseAlpha;
                    this.twinkleSpeed = Math.random() * 0.02 + 0.005;
                    this.twinklePhase = Math.random() * Math.PI * 2;
                    this.color = `rgba(${200 + Math.random() * 55}, ${190 + Math.random() * 60}, ${220 + Math.random() * 35}`;
                    break;

                case 'dust':
                    this.x = Math.random() * w;
                    this.y = Math.random() * h;
                    this.size = Math.random() * 2 + 0.5;
                    this.alpha = Math.random() * 0.12 + 0.02;
                    this.vx = (Math.random() - 0.5) * 0.25;
                    this.vy = -Math.random() * 0.15 - 0.03;
                    this.life = 0;
                    this.maxLife = Math.random() * 500 + 200;
                    this.color = `rgba(255, 220, 170`;
                    break;
            }
        }

        update(time) {
            switch (this.type) {
                case 'star':
                    this.alpha = this.baseAlpha + Math.sin(time * this.twinkleSpeed + this.twinklePhase) * 0.25;
                    break;
                case 'dust':
                    this.x += this.vx;
                    this.y += this.vy;
                    this.life++;
                    const ratio = this.life / this.maxLife;
                    if (ratio < 0.1) this.alpha = ratio * 10 * 0.1;
                    else if (ratio > 0.8) this.alpha = (1 - ratio) * 5 * 0.1;
                    if (this.life >= this.maxLife) this.reset();
                    break;
            }
        }

        draw() {
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fillStyle = `${this.color}, ${Math.max(0, this.alpha)})`;
            ctx.fill();
            if (this.type === 'star') {
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.size * 2.5, 0, Math.PI * 2);
                ctx.fillStyle = `${this.color}, ${Math.max(0, this.alpha * 0.12)})`;
                ctx.fill();
            }
        }
    }

    let frameCount = 0;
    function animateParticles() {
        if (!Settings.get('particles')) {
            ctx.clearRect(0, 0, dom.canvas.width, dom.canvas.height);
            animFrameId = requestAnimationFrame(animateParticles);
            return;
        }
        frameCount++;
        ctx.clearRect(0, 0, dom.canvas.width, dom.canvas.height);
        particles.forEach(p => { p.update(frameCount); p.draw(); });
        animFrameId = requestAnimationFrame(animateParticles);
    }

    function initParticles() {
        particles = [];
        for (let i = 0; i < 50; i++) particles.push(new Particle('star'));
        for (let i = 0; i < 30; i++) particles.push(new Particle('dust'));
    }

    // ==========================================
    // TIMER LOGIC
    // ==========================================

    function formatTime(seconds) {
        const m = Math.floor(seconds / 60).toString().padStart(2, '0');
        const s = (seconds % 60).toString().padStart(2, '0');
        return { m, s };
    }

    function updateDisplay() {
        const { m, s } = formatTime(state.timeRemaining);
        dom.minutes.textContent = m;
        dom.seconds.textContent = s;

        const progress = 1 - (state.timeRemaining / state.totalTime);
        const circumference = 2 * Math.PI * 90;
        dom.progressCircle.style.strokeDashoffset = circumference * (1 - progress);

        if (state.isRunning) {
            const modeText = state.currentMode === 'work' ? '🔥' : '☕';
            document.title = `${m}:${s} ${modeText} Lofi Pomodoro`;
        } else {
            document.title = 'Lofi Pomodoro ⏳';
        }
    }

    function updateSessionDots() {
        const total = Settings.get('sessionsBeforeLong');
        dom.sessionDots.innerHTML = '';
        for (let i = 0; i < total; i++) {
            const dot = document.createElement('div');
            dot.className = 'session-dot';
            if (i < state.completedSessions) dot.classList.add('completed');
            if (i === state.completedSessions && state.isRunning && state.currentMode === 'work') {
                dot.classList.add('current');
            }
            dom.sessionDots.appendChild(dot);
        }
        dom.sessionCount.textContent = `Oturum ${state.completedSessions + 1}/${total}`;
    }

    function updateModeButtons() {
        dom.modeBtns.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.mode === state.currentMode);
        });
    }

    function updatePlayPauseIcon() {
        if (state.isRunning && !state.isPaused) {
            dom.iconPlay.style.display = 'none';
            dom.iconPause.style.display = 'block';
        } else {
            dom.iconPlay.style.display = 'block';
            dom.iconPause.style.display = 'none';
        }
    }

    function setMode(mode) {
        state.currentMode = mode;
        state.isPaused = false;
        state.isRunning = false;
        clearInterval(state.intervalId);

        switch (mode) {
            case 'work':
                state.timeRemaining = Settings.get('workMinutes') * 60;
                state.totalTime = Settings.get('workMinutes') * 60;
                dom.modeLabel.textContent = 'ODAKLAN';
                document.body.classList.remove('break-mode');
                break;
            case 'short':
                state.timeRemaining = Settings.get('shortBreakMinutes') * 60;
                state.totalTime = Settings.get('shortBreakMinutes') * 60;
                dom.modeLabel.textContent = 'KISA MOLA';
                document.body.classList.add('break-mode');
                break;
            case 'long':
                state.timeRemaining = Settings.get('longBreakMinutes') * 60;
                state.totalTime = Settings.get('longBreakMinutes') * 60;
                dom.modeLabel.textContent = 'UZUN MOLA';
                document.body.classList.add('break-mode');
                break;
        }

        // Switch background for mode
        if (mode === 'work') {
            BackgroundManager.switchToMode('work');
        } else {
            BackgroundManager.switchToMode('break');
        }

        updateDisplay();
        updateModeButtons();
        updatePlayPauseIcon();
        document.body.classList.remove('timer-running');
    }

    function startTimer() {
        if (state.isPaused) {
            state.isPaused = false;
            state.isRunning = true;
        } else if (!state.isRunning) {
            state.isRunning = true;
        }

        document.body.classList.add('timer-running');
        updatePlayPauseIcon();
        updateSessionDots();

        state.intervalId = setInterval(() => {
            if (state.timeRemaining > 0) {
                state.timeRemaining--;
                updateDisplay();
            } else {
                timerComplete();
            }
        }, 1000);
    }

    function pauseTimer() {
        state.isPaused = true;
        state.isRunning = false;
        clearInterval(state.intervalId);
        document.body.classList.remove('timer-running');
        updatePlayPauseIcon();
    }

    function resetTimer() {
        clearInterval(state.intervalId);
        state.isRunning = false;
        state.isPaused = false;
        setMode(state.currentMode);
    }

    function skipTimer() {
        clearInterval(state.intervalId);
        state.isRunning = false;
        state.isPaused = false;
        timerComplete();
    }

    function timerComplete() {
        clearInterval(state.intervalId);
        state.isRunning = false;
        state.isPaused = false;
        document.body.classList.remove('timer-running');
        updatePlayPauseIcon();

        showNotificationFlash();
        if (Settings.get('notifSound')) playNotificationSound();
        if (Settings.get('browserNotif')) sendNotification();

        if (state.currentMode === 'work') {
            state.completedSessions++;
            if (Settings.get('autoSequence') && state.completedSessions >= Settings.get('sessionsBeforeLong')) {
                state.completedSessions = 0;
                setMode('long');
            } else {
                setMode('short');
            }
        } else {
            setMode('work');
        }

        updateSessionDots();

        if (Settings.get('autoStart')) {
            setTimeout(() => startTimer(), 1500);
        }
    }

    function showNotificationFlash() {
        dom.notifFlash.classList.remove('hidden');
        setTimeout(() => dom.notifFlash.classList.add('hidden'), 600);
    }

    function playNotificationSound() {
        try {
            const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            const playTone = (freq, startTime, duration) => {
                const osc = audioCtx.createOscillator();
                const gain = audioCtx.createGain();
                osc.connect(gain);
                gain.connect(audioCtx.destination);
                osc.type = 'sine';
                osc.frequency.value = freq;
                gain.gain.setValueAtTime(0.12, startTime);
                gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
                osc.start(startTime);
                osc.stop(startTime + duration);
            };
            const now = audioCtx.currentTime;
            playTone(523.25, now, 0.3);
            playTone(659.25, now + 0.15, 0.3);
            playTone(783.99, now + 0.3, 0.5);
        } catch (e) {
            console.log('Audio not available');
        }
    }

    function sendNotification() {
        if ('Notification' in window && Notification.permission === 'granted') {
            const text = state.currentMode === 'work'
                ? 'Çalışma süresi bitti! Mola zamanı ☕'
                : 'Mola bitti! Çalışmaya devam 🔥';
            new Notification('Lofi Pomodoro', { body: text, silent: true });
        }
    }

    // ==========================================
    // INTRO SCREEN
    // ==========================================

    function initIntro() {
        dom.hourglassWrapper.addEventListener('click', () => {
            // Start flip animation
            dom.hourglassWrapper.classList.add('flipping');

            // After flip animation, fade out intro
            setTimeout(() => {
                dom.introScreen.classList.add('fade-out');

                // After fade, remove intro and show app
                setTimeout(() => {
                    dom.introScreen.classList.add('gone');
                    showApp();
                }, 1000);
            }, 1800);
        });
    }

    function showApp() {
        // Apply background
        BackgroundManager.init();

        // Show timer widget
        dom.timerWidget.classList.remove('hidden');

        // Show settings button
        dom.settingsBtn.style.display = 'flex';

        // Initialize timer and auto-start
        setMode('work');
        setTimeout(() => startTimer(), 500);
    }

    // ==========================================
    // SETTINGS UI
    // ==========================================

    function initSettings() {
        // Open settings
        dom.settingsBtn.addEventListener('click', openSettings);

        // Close settings
        dom.settingsClose.addEventListener('click', closeSettings);
        dom.settingsCancel.addEventListener('click', closeSettings);
        dom.settingsBackdrop.addEventListener('click', closeSettings);

        // Save settings
        dom.settingsSave.addEventListener('click', saveSettings);

        // Tab switching
        dom.navBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                dom.navBtns.forEach(b => b.classList.remove('active'));
                dom.tabPanels.forEach(p => p.classList.remove('active'));
                btn.classList.add('active');
                document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
            });
        });

        // Position grid
        dom.posCells.forEach(cell => {
            cell.addEventListener('click', () => {
                dom.posCells.forEach(c => c.classList.remove('active'));
                cell.classList.add('active');
            });
        });

        // Size slider
        dom.timerSizeSlider.addEventListener('input', () => {
            const labels = ['Küçük', 'Orta', 'Büyük'];
            dom.sizeValueLabel.textContent = labels[dom.timerSizeSlider.value];
        });

        // File upload handlers
        dom.workBgUpload.addEventListener('change', async (e) => {
            if (e.target.files[0]) {
                await BackgroundManager.handleFileUpload(e.target.files[0], 'work');
                BackgroundManager.updatePreview('work');
            }
        });

        dom.breakBgUpload.addEventListener('change', async (e) => {
            if (e.target.files[0]) {
                await BackgroundManager.handleFileUpload(e.target.files[0], 'break');
                BackgroundManager.updatePreview('break');
            }
        });

        // YouTube URL apply
        dom.workYtApply.addEventListener('click', () => {
            const url = dom.workYtUrl.value.trim();
            if (url && BackgroundManager.extractYouTubeId(url)) {
                Settings.set('workBg', { type: 'youtube', source: url });
                BackgroundManager.updatePreview('work');
            }
        });

        dom.breakYtApply.addEventListener('click', () => {
            const url = dom.breakYtUrl.value.trim();
            if (url && BackgroundManager.extractYouTubeId(url)) {
                Settings.set('breakBg', { type: 'youtube', source: url });
                BackgroundManager.updatePreview('break');
            }
        });

        // Reset background buttons
        dom.resetBgBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const target = btn.dataset.target;
                Settings.set(target === 'work' ? 'workBg' : 'breakBg', { type: 'default', source: 'assets/lofi-bg.jpg' });
                BackgroundManager.updatePreview(target);
                // Clear YouTube input
                if (target === 'work') dom.workYtUrl.value = '';
                else dom.breakYtUrl.value = '';
            });
        });

        // Reset all
        dom.btnResetAll.addEventListener('click', () => {
            if (confirm('Tüm ayarlar sıfırlansın mı?')) {
                Settings.resetAll();
                populateSettingsUI();
                applyAllSettings();
            }
        });

        // ESC to close settings
        document.addEventListener('keydown', (e) => {
            if (e.code === 'Escape' && !dom.settingsModal.classList.contains('hidden')) {
                closeSettings();
            }
        });
    }

    function openSettings() {
        populateSettingsUI();
        dom.settingsModal.classList.remove('hidden');
    }

    function closeSettings() {
        dom.settingsModal.classList.add('hidden');
    }

    function populateSettingsUI() {
        // Timers
        dom.setWork.value = Settings.get('workMinutes');
        dom.setShort.value = Settings.get('shortBreakMinutes');
        dom.setLong.value = Settings.get('longBreakMinutes');
        dom.setAutoSequence.checked = Settings.get('autoSequence');

        // Sounds
        dom.setNotifSound.checked = Settings.get('notifSound');
        dom.setBrowserNotif.checked = Settings.get('browserNotif');

        // General
        dom.setAutoStart.checked = Settings.get('autoStart');
        dom.setParticles.checked = Settings.get('particles');

        // Position grid
        const pos = Settings.get('timerPosition');
        dom.posCells.forEach(c => {
            c.classList.toggle('active', c.dataset.pos === pos);
        });

        // Size slider
        const sizeMap = { small: 0, medium: 1, large: 2 };
        const sizeLabels = ['Küçük', 'Orta', 'Büyük'];
        const sizeIdx = sizeMap[Settings.get('timerSize')] ?? 1;
        dom.timerSizeSlider.value = sizeIdx;
        dom.sizeValueLabel.textContent = sizeLabels[sizeIdx];

        // Background previews
        BackgroundManager.updatePreview('work');
        BackgroundManager.updatePreview('break');

        // YouTube URLs
        const workBg = Settings.get('workBg');
        const breakBg = Settings.get('breakBg');
        dom.workYtUrl.value = (workBg && workBg.type === 'youtube') ? workBg.source : '';
        dom.breakYtUrl.value = (breakBg && breakBg.type === 'youtube') ? breakBg.source : '';
    }

    function saveSettings() {
        // Read timers
        Settings.set('workMinutes', Math.max(1, Math.min(120, parseInt(dom.setWork.value) || 25)));
        Settings.set('shortBreakMinutes', Math.max(1, Math.min(60, parseInt(dom.setShort.value) || 5)));
        Settings.set('longBreakMinutes', Math.max(1, Math.min(60, parseInt(dom.setLong.value) || 15)));
        Settings.set('autoSequence', dom.setAutoSequence.checked);

        // Read sounds
        Settings.set('notifSound', dom.setNotifSound.checked);
        Settings.set('browserNotif', dom.setBrowserNotif.checked);

        // Read general
        Settings.set('autoStart', dom.setAutoStart.checked);
        Settings.set('particles', dom.setParticles.checked);

        // Read position
        const activePos = document.querySelector('.pos-cell.active');
        if (activePos) Settings.set('timerPosition', activePos.dataset.pos);

        // Read size
        const sizes = ['small', 'medium', 'large'];
        Settings.set('timerSize', sizes[dom.timerSizeSlider.value] || 'medium');

        // Save
        Settings.save();

        // Apply
        applyAllSettings();

        // Close
        closeSettings();
    }

    function applyAllSettings() {
        // Apply position
        dom.timerWidget.dataset.position = Settings.get('timerPosition');

        // Apply size
        dom.timerWidget.dataset.size = Settings.get('timerSize');

        // Apply background
        if (state.currentMode === 'work') {
            BackgroundManager.applyBackground('work');
        } else {
            BackgroundManager.applyBackground('break');
        }

        // Apply timer durations (reset current timer)
        if (!state.isRunning) {
            setMode(state.currentMode);
        }

        // request notification permission
        if (Settings.get('browserNotif') && 'Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }
    }

    // ==========================================
    // EVENT LISTENERS
    // ==========================================

    function initEventListeners() {
        // Start/Pause toggle
        dom.btnStart.addEventListener('click', () => {
            if (state.isRunning && !state.isPaused) {
                pauseTimer();
            } else {
                startTimer();
            }
        });

        // Reset
        dom.btnReset.addEventListener('click', resetTimer);

        // Skip
        dom.btnSkip.addEventListener('click', skipTimer);

        // Mode buttons
        dom.modeBtns.forEach(btn => {
            btn.addEventListener('click', () => setMode(btn.dataset.mode));
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (!dom.settingsModal.classList.contains('hidden')) return; // Don't handle when settings open

            if (e.code === 'Space' && dom.introScreen && dom.introScreen.classList.contains('gone')) {
                e.preventDefault();
                if (state.isRunning && !state.isPaused) {
                    pauseTimer();
                } else {
                    startTimer();
                }
            }
        });

        // Window resize
        window.addEventListener('resize', () => {
            resizeCanvas();
            initParticles();
        });
    }

    // ==========================================
    // SAVED SESSION STATE
    // ==========================================

    function loadSessionState() {
        try {
            const saved = localStorage.getItem('lofi-pomodoro-sessions');
            if (saved) {
                const data = JSON.parse(saved);
                state.completedSessions = data.completedSessions || 0;
            }
        } catch {}
    }

    function saveSessionState() {
        try {
            localStorage.setItem('lofi-pomodoro-sessions', JSON.stringify({
                completedSessions: state.completedSessions
            }));
        } catch {}
    }

    // ==========================================
    // INITIALIZATION
    // ==========================================

    function init() {
        cacheDom();
        Settings.load();

        // Canvas setup
        ctx = dom.canvas.getContext('2d');
        resizeCanvas();
        initParticles();
        animateParticles();

        // Apply saved position/size to widget
        dom.timerWidget.dataset.position = Settings.get('timerPosition');
        dom.timerWidget.dataset.size = Settings.get('timerSize');

        // Hide settings button until intro is done
        dom.settingsBtn.style.display = 'none';

        // Set initial timer display
        state.timeRemaining = Settings.get('workMinutes') * 60;
        state.totalTime = Settings.get('workMinutes') * 60;
        updateDisplay();
        updateSessionDots();
        updateModeButtons();

        // Load session state
        loadSessionState();
        updateSessionDots();

        // Init subsystems
        initIntro();
        initSettings();
        initEventListeners();

        // Request notification permission
        if (Settings.get('browserNotif') && 'Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }

        // Periodically save session state
        setInterval(saveSessionState, 5000);
    }

    // Start
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();

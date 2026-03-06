/* ============================================
   LOFI POMODORO — INTERACTIVE ENGINE
   ============================================ */

(() => {
    'use strict';

    // ==========================================
    // CONFIGURATION
    // ==========================================
    const CONFIG = {
        WORK_MINUTES: 25,
        SHORT_BREAK_MINUTES: 5,
        LONG_BREAK_MINUTES: 15,
        SESSIONS_BEFORE_LONG_BREAK: 4,
        PARTICLES: {
            STARS: 60,
            DUST: 35,
            CITY_LIGHTS: 25
        }
    };

    // ==========================================
    // STATE
    // ==========================================
    const state = {
        timeRemaining: CONFIG.WORK_MINUTES * 60,
        totalTime: CONFIG.WORK_MINUTES * 60,
        isRunning: false,
        isPaused: false,
        currentMode: 'work', // work, short, long
        currentSession: 1,
        completedSessions: 0,
        intervalId: null
    };

    // ==========================================
    // DOM ELEMENTS
    // ==========================================
    const dom = {
        canvas: document.getElementById('particle-canvas'),
        timerPanel: document.getElementById('timer-panel'),
        hourglass: document.getElementById('hourglass-hotspot'),
        minutes: document.getElementById('minutes'),
        seconds: document.getElementById('seconds'),
        modeLabel: document.getElementById('timer-mode-label'),
        btnStart: document.getElementById('btn-start'),
        btnReset: document.getElementById('btn-reset'),
        btnSkip: document.getElementById('btn-skip'),
        closePanel: document.getElementById('close-panel'),
        progressCircle: document.getElementById('progress-circle'),
        sessionDots: document.getElementById('session-dots'),
        sessionCount: document.getElementById('session-count'),
        modeBtns: document.querySelectorAll('.mode-btn'),
        iconPlay: document.getElementById('icon-play'),
        iconPause: document.getElementById('icon-pause'),
        notifFlash: document.getElementById('notification-flash'),
        hourglassGlow: document.getElementById('hourglass-ambient-glow')
    };

    // ==========================================
    // CANVAS PARTICLE SYSTEM
    // ==========================================
    const ctx = dom.canvas.getContext('2d');
    let particles = [];
    let animFrameId;

    function resizeCanvas() {
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
                    this.x = Math.random() * w * 0.7 + w * 0.15;
                    this.y = Math.random() * h * 0.35;
                    this.size = Math.random() * 2 + 0.5;
                    this.baseAlpha = Math.random() * 0.6 + 0.2;
                    this.alpha = this.baseAlpha;
                    this.twinkleSpeed = Math.random() * 0.02 + 0.005;
                    this.twinklePhase = Math.random() * Math.PI * 2;
                    this.color = `rgba(${200 + Math.random() * 55}, ${190 + Math.random() * 60}, ${220 + Math.random() * 35}`;
                    break;

                case 'dust':
                    this.x = Math.random() * w;
                    this.y = Math.random() * h;
                    this.size = Math.random() * 2.5 + 0.5;
                    this.alpha = Math.random() * 0.15 + 0.03;
                    this.vx = (Math.random() - 0.5) * 0.3;
                    this.vy = -Math.random() * 0.2 - 0.05;
                    this.life = 0;
                    this.maxLife = Math.random() * 600 + 300;
                    this.color = `rgba(255, 220, 170`;
                    break;

                case 'cityLight':
                    this.x = w * 0.2 + Math.random() * w * 0.55;
                    this.y = h * 0.18 + Math.random() * h * 0.2;
                    this.size = Math.random() * 2 + 1;
                    this.baseAlpha = Math.random() * 0.4 + 0.1;
                    this.alpha = this.baseAlpha;
                    this.flickerSpeed = Math.random() * 0.03 + 0.01;
                    this.flickerPhase = Math.random() * Math.PI * 2;
                    const colors = [
                        '255, 200, 100',
                        '255, 160, 80',
                        '200, 220, 255',
                        '255, 180, 120',
                        '180, 200, 255'
                    ];
                    this.colorBase = colors[Math.floor(Math.random() * colors.length)];
                    this.color = `rgba(${this.colorBase}`;
                    break;
            }
        }

        update(time) {
            switch (this.type) {
                case 'star':
                    this.alpha = this.baseAlpha + Math.sin(time * this.twinkleSpeed + this.twinklePhase) * 0.3;
                    break;

                case 'dust':
                    this.x += this.vx;
                    this.y += this.vy;
                    this.life++;
                    const lifeRatio = this.life / this.maxLife;
                    if (lifeRatio < 0.1) {
                        this.alpha = lifeRatio * 10 * 0.12;
                    } else if (lifeRatio > 0.8) {
                        this.alpha = (1 - lifeRatio) * 5 * 0.12;
                    }
                    if (this.life >= this.maxLife) this.reset();
                    break;

                case 'cityLight':
                    this.alpha = this.baseAlpha + Math.sin(time * this.flickerSpeed + this.flickerPhase) * 0.2;
                    if (Math.random() < 0.001) {
                        this.alpha = this.baseAlpha * 0.2;
                    }
                    break;
            }
        }

        draw() {
            ctx.beginPath();
            if (this.type === 'star') {
                ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
                ctx.fillStyle = `${this.color}, ${Math.max(0, this.alpha)})`;
                ctx.fill();
                // Glow
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.size * 3, 0, Math.PI * 2);
                ctx.fillStyle = `${this.color}, ${Math.max(0, this.alpha * 0.15)})`;
                ctx.fill();
            } else if (this.type === 'dust') {
                ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
                ctx.fillStyle = `${this.color}, ${Math.max(0, this.alpha)})`;
                ctx.fill();
            } else if (this.type === 'cityLight') {
                ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
                ctx.fillStyle = `${this.color}, ${Math.max(0, this.alpha)})`;
                ctx.fill();
                // Light bloom
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.size * 4, 0, Math.PI * 2);
                ctx.fillStyle = `${this.color}, ${Math.max(0, this.alpha * 0.08)})`;
                ctx.fill();
            }
        }
    }

    // Sand particles for hourglass
    let sandParticles = [];
    class SandParticle {
        constructor() {
            this.reset();
        }

        reset() {
            const w = dom.canvas.width;
            const h = dom.canvas.height;
            // Hourglass position area (approx center of the hourglass in the image)
            this.x = w * 0.455 + (Math.random() - 0.5) * w * 0.025;
            this.startY = h * 0.38;
            this.endY = h * 0.48;
            this.y = this.startY;
            this.size = Math.random() * 1.5 + 0.5;
            this.speed = Math.random() * 0.8 + 0.4;
            this.alpha = Math.random() * 0.6 + 0.3;
            this.delay = Math.random() * 100;
            this.life = -this.delay;
        }

        update() {
            this.life++;
            if (this.life < 0) return;
            this.y += this.speed;
            if (this.y > this.endY) {
                this.reset();
            }
        }

        draw() {
            if (this.life < 0) return;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(244, 190, 80, ${this.alpha})`;
            ctx.fill();
        }
    }

    function initParticles() {
        particles = [];
        for (let i = 0; i < CONFIG.PARTICLES.STARS; i++) {
            particles.push(new Particle('star'));
        }
        for (let i = 0; i < CONFIG.PARTICLES.DUST; i++) {
            particles.push(new Particle('dust'));
        }
        for (let i = 0; i < CONFIG.PARTICLES.CITY_LIGHTS; i++) {
            particles.push(new Particle('cityLight'));
        }

        // Sand particles (initially inactive)
        sandParticles = [];
        for (let i = 0; i < 15; i++) {
            sandParticles.push(new SandParticle());
        }
    }

    let frameCount = 0;
    function animateParticles() {
        frameCount++;
        ctx.clearRect(0, 0, dom.canvas.width, dom.canvas.height);

        particles.forEach(p => {
            p.update(frameCount);
            p.draw();
        });

        // Draw sand only when timer is running
        if (state.isRunning && !state.isPaused) {
            sandParticles.forEach(s => {
                s.update();
                s.draw();
            });
        }

        animFrameId = requestAnimationFrame(animateParticles);
    }

    // ==========================================
    // POMODORO TIMER
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

        // Update progress ring
        const progress = 1 - (state.timeRemaining / state.totalTime);
        const circumference = 2 * Math.PI * 90; // r=90
        dom.progressCircle.style.strokeDashoffset = circumference * (1 - progress);

        // Update page title
        if (state.isRunning) {
            const modeText = state.currentMode === 'work' ? '🔥' : '☕';
            document.title = `${m}:${s} ${modeText} Lofi Pomodoro`;
        } else {
            document.title = 'Lofi Pomodoro ⏳';
        }
    }

    function updateSessionDots() {
        dom.sessionDots.innerHTML = '';
        for (let i = 0; i < CONFIG.SESSIONS_BEFORE_LONG_BREAK; i++) {
            const dot = document.createElement('div');
            dot.className = 'session-dot';
            if (i < state.completedSessions) dot.classList.add('completed');
            if (i === state.completedSessions && state.isRunning && state.currentMode === 'work') {
                dot.classList.add('current');
            }
            dom.sessionDots.appendChild(dot);
        }
        dom.sessionCount.textContent = `Oturum ${state.completedSessions + 1}/${CONFIG.SESSIONS_BEFORE_LONG_BREAK}`;
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
                state.timeRemaining = CONFIG.WORK_MINUTES * 60;
                state.totalTime = CONFIG.WORK_MINUTES * 60;
                dom.modeLabel.textContent = 'ODAKLAN';
                document.body.classList.remove('break-mode');
                break;
            case 'short':
                state.timeRemaining = CONFIG.SHORT_BREAK_MINUTES * 60;
                state.totalTime = CONFIG.SHORT_BREAK_MINUTES * 60;
                dom.modeLabel.textContent = 'KISA MOLA';
                document.body.classList.add('break-mode');
                break;
            case 'long':
                state.timeRemaining = CONFIG.LONG_BREAK_MINUTES * 60;
                state.totalTime = CONFIG.LONG_BREAK_MINUTES * 60;
                dom.modeLabel.textContent = 'UZUN MOLA';
                document.body.classList.add('break-mode');
                break;
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

        // Flash notification
        showNotificationFlash();

        // Play notification sound
        playNotificationSound();

        // Browser notification
        sendNotification();

        if (state.currentMode === 'work') {
            state.completedSessions++;
            if (state.completedSessions >= CONFIG.SESSIONS_BEFORE_LONG_BREAK) {
                state.completedSessions = 0;
                setMode('long');
            } else {
                setMode('short');
            }
        } else {
            setMode('work');
        }

        updateSessionDots();
        // Auto-start next session
        setTimeout(() => startTimer(), 1500);
    }

    function showNotificationFlash() {
        dom.notifFlash.classList.remove('hidden');
        setTimeout(() => dom.notifFlash.classList.add('hidden'), 600);
    }

    function playNotificationSound() {
        // Generate a pleasant notification chime using Web Audio API
        try {
            const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            
            const playTone = (freq, startTime, duration) => {
                const osc = audioCtx.createOscillator();
                const gain = audioCtx.createGain();
                osc.connect(gain);
                gain.connect(audioCtx.destination);
                osc.type = 'sine';
                osc.frequency.value = freq;
                gain.gain.setValueAtTime(0.15, startTime);
                gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
                osc.start(startTime);
                osc.stop(startTime + duration);
            };

            const now = audioCtx.currentTime;
            playTone(523.25, now, 0.3);       // C5
            playTone(659.25, now + 0.15, 0.3); // E5
            playTone(783.99, now + 0.3, 0.5);  // G5
        } catch(e) {
            console.log('Audio not available');
        }
    }

    function sendNotification() {
        if ('Notification' in window && Notification.permission === 'granted') {
            const text = state.currentMode === 'work' 
                ? 'Çalışma süresi bitti! Mola zamanı ☕' 
                : 'Mola bitti! Çalışmaya devam 🔥';
            new Notification('Lofi Pomodoro', {
                body: text,
                icon: 'assets/lofi-bg.jpg',
                silent: true
            });
        }
    }

    // ==========================================
    // EVENT LISTENERS
    // ==========================================

    // Hourglass click -> open timer and start
    dom.hourglass.addEventListener('click', () => {
        dom.timerPanel.classList.remove('hidden');
        if (!state.isRunning && !state.isPaused) {
            startTimer();
        }
    });

    // Close panel
    dom.closePanel.addEventListener('click', () => {
        dom.timerPanel.classList.add('hidden');
    });

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
        btn.addEventListener('click', () => {
            setMode(btn.dataset.mode);
        });
    });

    // Close panel on backdrop click
    dom.timerPanel.addEventListener('click', (e) => {
        if (e.target === dom.timerPanel) {
            dom.timerPanel.classList.add('hidden');
        }
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.code === 'Space' && !dom.timerPanel.classList.contains('hidden')) {
            e.preventDefault();
            if (state.isRunning && !state.isPaused) {
                pauseTimer();
            } else {
                startTimer();
            }
        }
        if (e.code === 'Escape') {
            dom.timerPanel.classList.add('hidden');
        }
    });

    // ==========================================
    // INITIALIZATION
    // ==========================================

    function init() {
        resizeCanvas();
        initParticles();
        animateParticles();
        updateDisplay();
        updateSessionDots();
        updateModeButtons();

        // Request notification permission
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }

        // Load saved state from localStorage
        const saved = localStorage.getItem('lofi-pomodoro-sessions');
        if (saved) {
            const data = JSON.parse(saved);
            state.completedSessions = data.completedSessions || 0;
            updateSessionDots();
        }

        window.addEventListener('resize', () => {
            resizeCanvas();
            // Re-initialize particles on resize for correct positions
            initParticles();
        });

        // Save state periodically
        setInterval(() => {
            localStorage.setItem('lofi-pomodoro-sessions', JSON.stringify({
                completedSessions: state.completedSessions
            }));
        }, 5000);
    }

    // Start everything when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();

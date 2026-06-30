/* ═════════════════════════════════════════════════════════════════
   hud.js — Custom cursor + sound + achievements + pause + keyboard
   ═════════════════════════════════════════════════════════════════ */

const KONAMI = [
    'ArrowUp','ArrowUp','ArrowDown','ArrowDown',
    'ArrowLeft','ArrowRight','ArrowLeft','ArrowRight',
    'b','a'
];

export function initHUD({ onMiniGame, onKonami, scene3d }) {
    const state = {
        muted: localStorage.getItem('bx_muted') === '1',
        achievements: new Set(JSON.parse(localStorage.getItem('bx_ach') || '[]')),
        xp: 0,
        lvl: 24,
        konamiBuf: [],
    };

    // ── custom crosshair cursor ───────────────────────────────────
    const crosshair = document.getElementById('crosshair');
    let cx = window.innerWidth / 2, cy = window.innerHeight / 2;
    let tx = cx, ty = cy;
    window.addEventListener('pointermove', (e) => { tx = e.clientX; ty = e.clientY; });
    function updateCursor() {
        cx += (tx - cx) * 0.35;
        cy += (ty - cy) * 0.35;
        if (crosshair) crosshair.style.transform = `translate(${cx}px, ${cy}px) translate(-50%, -50%) ${crosshair.classList.contains('is-hover') ? 'scale(1.6) rotate(45deg)' : ''}`;
        requestAnimationFrame(updateCursor);
    }
    updateCursor();
    // hover state on interactive elements
    document.addEventListener('mouseover', (e) => {
        const t = e.target;
        if (t.closest && t.closest('a, button, .skill-card, .cartridge, .npc, .lore-card, .cc, input, textarea')) {
            crosshair && crosshair.classList.add('is-hover');
        }
    });
    document.addEventListener('mouseout', (e) => {
        const t = e.target;
        if (t.closest && t.closest('a, button, .skill-card, .cartridge, .npc, .lore-card, .cc, input, textarea')) {
            crosshair && crosshair.classList.remove('is-hover');
        }
    });

    // ── sound effects via Web Audio API ───────────────────────────
    let audioCtx = null;
    function ensureAudio() {
        if (!audioCtx) {
            try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }
            catch(_) { audioCtx = null; }
        }
        if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
        return audioCtx;
    }
    function beep({ freq = 440, type = 'square', dur = 0.08, vol = 0.06, sweep = 0 } = {}) {
        if (state.muted) return;
        const ctx = ensureAudio();
        if (!ctx) return;
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = type;
        o.frequency.value = freq;
        if (sweep) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + sweep), ctx.currentTime + dur);
        g.gain.setValueAtTime(vol, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
        o.connect(g).connect(ctx.destination);
        o.start();
        o.stop(ctx.currentTime + dur);
    }
    // sound presets
    const sfx = {
        hover: () => beep({ freq: 880, type: 'square', dur: 0.04, vol: 0.025 }),
        click: () => beep({ freq: 520, type: 'square', dur: 0.07, vol: 0.05, sweep: 200 }),
        levelUp: () => {
            beep({ freq: 440, dur: 0.08, vol: 0.05 });
            setTimeout(() => beep({ freq: 660, dur: 0.08, vol: 0.05 }), 80);
            setTimeout(() => beep({ freq: 880, dur: 0.12, vol: 0.06 }), 160);
        },
        achievement: () => {
            beep({ freq: 660, type: 'triangle', dur: 0.1, vol: 0.05 });
            setTimeout(() => beep({ freq: 990, type: 'triangle', dur: 0.18, vol: 0.06 }), 110);
        },
        konami: () => {
            [440, 554, 659, 880, 1108].forEach((f, i) =>
                setTimeout(() => beep({ freq: f, type: 'square', dur: 0.1, vol: 0.07 }), i * 110)
            );
        },
        error: () => beep({ freq: 220, type: 'sawtooth', dur: 0.18, vol: 0.06, sweep: -180 }),
    };

    // small hover sound on interactive elements (debounced)
    let lastHover = 0;
    document.addEventListener('mouseover', (e) => {
        const t = e.target;
        if (!t.closest) return;
        if (t.closest('a, button, .skill-card, .cartridge, .npc, .lore-card')) {
            const now = performance.now();
            if (now - lastHover > 80) { sfx.hover(); lastHover = now; }
        }
    });
    document.addEventListener('click', (e) => {
        if (e.target.closest && e.target.closest('a, button')) sfx.click();
    });

    // ── sound toggle button ───────────────────────────────────────
    const soundBtn = document.getElementById('sound-btn');
    function paintSoundBtn() {
        if (!soundBtn) return;
        soundBtn.classList.toggle('is-off', state.muted);
        soundBtn.querySelector('span').textContent = state.muted ? '✕' : '♪';
        soundBtn.title = state.muted ? 'Sound: OFF' : 'Sound: ON';
    }
    paintSoundBtn();
    soundBtn && soundBtn.addEventListener('click', () => {
        state.muted = !state.muted;
        localStorage.setItem('bx_muted', state.muted ? '1' : '0');
        paintSoundBtn();
        if (!state.muted) sfx.click();
    });

    // ── achievement toast ─────────────────────────────────────────
    const toast = document.getElementById('achievement-toast');
    const toastText = document.getElementById('ach-text');
    let toastTimer = null;
    function unlockAchievement(text, force = false) {
        if (!force && state.achievements.has(text)) return;
        state.achievements.add(text);
        localStorage.setItem('bx_ach', JSON.stringify([...state.achievements]));
        if (!toast || !toastText) return;
        toastText.textContent = text;
        toast.classList.add('is-show');
        sfx.achievement();
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => toast.classList.remove('is-show'), 3800);
        gainXP(50);
    }

    // ── XP / level ────────────────────────────────────────────────
    const xpFill = document.getElementById('xp-fill');
    const xpText = document.getElementById('xp-text');
    function gainXP(amount) {
        state.xp += amount;
        while (state.xp >= 100) {
            state.xp -= 100;
            state.lvl++;
            sfx.levelUp();
            unlockAchievement(`Level ${state.lvl} reached!`, true);
        }
        if (xpFill) xpFill.style.setProperty('--w', state.xp + '%');
        if (xpText) xpText.textContent = `LV ${state.lvl}`;
    }
    gainXP(0); // initial paint

    // ── HUD coords (live mouse position display) ──────────────────
    const coords = document.getElementById('hud-coords');
    if (coords) {
        window.addEventListener('pointermove', (e) => {
            const x = String(Math.round(e.clientX)).padStart(4, '0');
            const y = String(Math.round(e.clientY)).padStart(4, '0');
            const z = String(Math.round(window.scrollY)).padStart(4, '0');
            coords.textContent = `X:${x} Y:${y} Z:${z}`;
        });
    }

    // ── keyboard shortcuts ────────────────────────────────────────
    window.addEventListener('keydown', (e) => {
        // ignore when typing in inputs
        if (e.target.matches && e.target.matches('input, textarea')) return;

        // konami
        state.konamiBuf.push(e.key);
        if (state.konamiBuf.length > KONAMI.length) state.konamiBuf.shift();
        if (state.konamiBuf.length === KONAMI.length &&
            state.konamiBuf.every((k, i) => k.toLowerCase() === KONAMI[i].toLowerCase())) {
            state.konamiBuf = [];
            triggerKonami();
        }

        // number warp 1..6
        if (/^[1-6]$/.test(e.key)) {
            const target = document.getElementById('world-' + e.key);
            if (target) {
                target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                sfx.click();
            }
            return;
        }
        if (e.key === '0') {
            document.getElementById('world-0')?.scrollIntoView({ behavior: 'smooth' });
            sfx.click();
        }

        if (e.key.toLowerCase() === 'm') { soundBtn?.click(); }
        if (e.key.toLowerCase() === 'g') {
            const mgOpen = !document.getElementById('minigame-modal')?.hasAttribute('hidden');
            if (!mgOpen) onMiniGame && onMiniGame();
        }
        if (e.key === 'Escape' || e.key.toLowerCase() === 'p') {
            // skip if another modal handles it
            const mgOpen = !document.getElementById('minigame-modal')?.hasAttribute('hidden');
            const konOpen = !document.getElementById('konami-overlay')?.hasAttribute('hidden');
            if (!mgOpen && !konOpen) togglePause();
        }
    });

    // ── pause menu ────────────────────────────────────────────────
    const pause = document.getElementById('pause-menu');
    function togglePause(show) {
        if (!pause) return;
        const open = show === undefined ? pause.hasAttribute('hidden') : show;
        if (open) pause.removeAttribute('hidden');
        else      pause.setAttribute('hidden', '');
        sfx.click();
    }
    document.getElementById('menu-btn')?.addEventListener('click', () => togglePause());
    pause?.addEventListener('click', (e) => {
        const t = e.target.closest('button[data-act]');
        if (!t) return;
        const act = t.dataset.act;
        if (act === 'resume')   togglePause(false);
        if (act === 'minigame') { togglePause(false); onMiniGame && onMiniGame(); }
        if (act === 'mute')     { soundBtn?.click(); }
        if (act === 'restart')  { localStorage.removeItem('bx_started'); location.reload(); }
        if (act === 'credits')  { unlockAchievement('Read the credits (a true gamer)', true); togglePause(false); }
    });

    // ── konami trigger ────────────────────────────────────────────
    const konamiOverlay = document.getElementById('konami-overlay');
    function triggerKonami() {
        sfx.konami();
        if (scene3d && scene3d.konamiBoost) scene3d.konamiBoost();
        konamiOverlay?.removeAttribute('hidden');
        gainXP(999);
        unlockAchievement('Konami code activated', true);
        // particle burst (DOM)
        spawnParticleBurst();
        setTimeout(() => konamiOverlay?.setAttribute('hidden', ''), 2400);
        onKonami && onKonami();
    }

    function spawnParticleBurst() {
        const colors = ['#00ffd0','#ff2bd6','#ffd400','#36ff7a','#8a5cff','#ff6a00'];
        for (let i = 0; i < 80; i++) {
            const p = document.createElement('div');
            p.style.cssText = `
                position:fixed; left:50%; top:50%; width:6px; height:6px;
                background:${colors[i % colors.length]}; border-radius:50%;
                box-shadow:0 0 12px currentColor; color:${colors[i % colors.length]};
                pointer-events:none; z-index:9999;
                transform:translate(-50%,-50%);
                transition:transform 1.6s cubic-bezier(.1,.7,.2,1), opacity 1.6s ease;
            `;
            document.body.appendChild(p);
            requestAnimationFrame(() => {
                const ang = Math.random() * Math.PI * 2;
                const dist = 80 + Math.random() * 480;
                p.style.transform = `translate(calc(-50% + ${Math.cos(ang) * dist}px), calc(-50% + ${Math.sin(ang) * dist}px)) scale(${0.3 + Math.random() * 1.4})`;
                p.style.opacity = '0';
            });
            setTimeout(() => p.remove(), 1700);
        }
    }

    // ── intersection observer to animate sections & unlock achievements ─
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(en => {
            if (en.isIntersecting) {
                en.target.classList.add('is-visible');
                const id = en.target.id;
                const map = {
                    'world-0': 'Booted up the arcade',
                    'world-1': 'Examined the player profile',
                    'world-2': 'Inspected the skill tree',
                    'world-3': 'Browsed the quest log',
                    'world-4': 'Met the NPCs',
                    'world-5': 'Opened the lore archive',
                    'world-6': 'Hailed the comms channel',
                };
                if (map[id]) unlockAchievement(map[id]);
                // update active nav
                document.querySelectorAll('.level-select a').forEach(a => a.classList.remove('is-active'));
                document.querySelector(`.level-select a[href="#${id}"]`)?.classList.add('is-active');
            }
        });
    }, { rootMargin: '-30% 0px -30% 0px', threshold: 0 });
    document.querySelectorAll('.world').forEach(w => observer.observe(w));

    // ── contact form fake-submit ──────────────────────────────────
    window.__gameAPI = window.__gameAPI || {};
    window.__gameAPI.sendTransmission = function (form) {
        sfx.levelUp();
        unlockAchievement('Sent first transmission!', true);
        const btn = form.querySelector('button[type=submit]');
        if (btn) {
            const original = btn.innerHTML;
            btn.innerHTML = '<span>● TRANSMITTING...</span>';
            btn.disabled = true;
            setTimeout(() => {
                btn.innerHTML = '<span>✓ SIGNAL RECEIVED</span>';
                setTimeout(() => {
                    btn.innerHTML = original;
                    btn.disabled = false;
                    form.reset();
                }, 1800);
            }, 1100);
        }
    };

    // game-btn for minigame quick access
    document.getElementById('game-btn')?.addEventListener('click', () => onMiniGame && onMiniGame());

    // smooth nav clicks
    document.querySelectorAll('a[href^="#world-"]').forEach(a => {
        a.addEventListener('click', (e) => {
            const id = a.getAttribute('href').slice(1);
            const t = document.getElementById(id);
            if (t) {
                e.preventDefault();
                t.scrollIntoView({ behavior: 'smooth', block: 'start' });
                sfx.click();
            }
        });
    });

    return {
        sfx,
        unlockAchievement,
        gainXP,
        triggerKonami,
        togglePause,
    };
}

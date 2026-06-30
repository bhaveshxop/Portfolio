/* ═════════════════════════════════════════════════════════════════
   app.js — BHAVESH.EXE main entry
   Boot sequence → mount 3D scene → HUD → mini-game → enjoy
   ═════════════════════════════════════════════════════════════════ */

import { createScene }     from './scene.js';
import { mountSkillCube }  from './skill-cube.js';
import { initHUD }         from './hud.js';
import { initMiniGame }    from './minigame.js';

const body = document.body;
const bootScreen      = document.getElementById('boot-screen');
const startBtn        = document.getElementById('start-btn');
const bootProgressBar = document.querySelector('.boot-progress-bar span');
const bootProgressText= document.getElementById('boot-progress-text');

// ── 1. boot progress animation ───────────────────────────────────
let progress = 0;
let progressTarget = 0;
const progressTimer = setInterval(() => {
    progressTarget = Math.min(100, progressTarget + Math.random() * 12 + 4);
    if (progressTarget >= 100) {
        progressTarget = 100;
        clearInterval(progressTimer);
        startBtn && (startBtn.disabled = false);
    }
}, 280);

function tickProgress() {
    progress += (progressTarget - progress) * 0.18;
    if (bootProgressBar)  bootProgressBar.style.width = progress.toFixed(1) + '%';
    if (bootProgressText) bootProgressText.textContent = `LOADING ${progress.toFixed(0)}%`;
    requestAnimationFrame(tickProgress);
}
tickProgress();

// ── 2. when player presses START → kick everything off ──────────
let started = false;
function startExperience() {
    if (started) return;
    started = true;

    // hide boot
    bootScreen?.classList.add('is-done');
    setTimeout(() => bootScreen?.remove(), 800);
    body.classList.remove('booting');
    body.classList.add('is-playing');

    // 3D background
    const canvas = document.getElementById('webgl-canvas');
    let scene3d = null;
    try {
        scene3d = createScene(canvas);
    } catch (err) {
        console.error('WebGL failed:', err);
    }

    // skill cube
    try {
        mountSkillCube(document.getElementById('skill-cube-canvas'));
    } catch (err) {
        console.error('Skill cube failed:', err);
    }

    // mini-game (placeholder — wired up after HUD so sfx is available)
    let miniGameOpen = () => {};
    const hud = initHUD({
        onMiniGame: () => miniGameOpen(),
        onKonami: () => {},
        scene3d,
    });
    const mini = initMiniGame({
        sfx: hud.sfx,
        unlockAchievement: hud.unlockAchievement,
        gainXP: hud.gainXP,
    });
    miniGameOpen = mini.open;

    // initial achievement
    setTimeout(() => hud.unlockAchievement('Welcome to the Arcade'), 1000);

    // gentle scroll into world 0 to ensure visible state triggers
    setTimeout(() => {
        document.getElementById('world-0')?.scrollIntoView({ behavior: 'auto', block: 'start' });
    }, 50);
}

// ── 3. wire start button + space/enter key + click anywhere ─────
startBtn?.addEventListener('click', () => {
    if (startBtn.disabled) return;
    startExperience();
});

window.addEventListener('keydown', (e) => {
    if (started) return;
    if ((e.key === 'Enter' || e.key === ' ') && !startBtn.disabled) {
        e.preventDefault();
        startExperience();
    }
});

// auto-skip boot for returning visitors (after first full session)
if (localStorage.getItem('bx_started') === '1') {
    // still show briefly so the user sees the aesthetic, but speed it up
    progressTarget = 100;
    setTimeout(() => startBtn && (startBtn.disabled = false), 600);
}
window.addEventListener('beforeunload', () => {
    if (started) localStorage.setItem('bx_started', '1');
});

// ── 4. small safety: if anything crashes during boot, still show
//      the experience after 8 seconds.
setTimeout(() => {
    if (!started) {
        startBtn && (startBtn.disabled = false);
        progressTarget = 100;
    }
}, 8000);

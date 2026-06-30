/* ═════════════════════════════════════════════════════════════════
   minigame.js — BUG HUNT
   Click bugs to score, avoid stars, beat the 30-second timer
   ═════════════════════════════════════════════════════════════════ */

export function initMiniGame({ sfx, unlockAchievement, gainXP }) {
    const modal       = document.getElementById('minigame-modal');
    const canvas      = document.getElementById('minigame-canvas');
    const closeBtn    = document.getElementById('mg-close');
    const startBtn    = document.getElementById('mg-start');
    const restartBtn  = document.getElementById('mg-restart');
    const scoreEl     = document.getElementById('mg-score');
    const timeEl      = document.getElementById('mg-time');
    const finalEl     = document.getElementById('mg-final');
    const highEl      = document.getElementById('mg-high');
    const introEl     = document.getElementById('mg-instructions');
    const overEl      = document.getElementById('mg-gameover');

    if (!modal || !canvas) return { open: () => {} };
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;

    // ── state ─────────────────────────────────────────────────────
    const state = {
        running: false,
        score: 0,
        timeLeft: 30,
        startTs: 0,
        bugs: [],
        stars: [],
        sparks: [],
        spawnBug: 0,
        spawnStar: 0,
        combo: 0,
        comboTimer: 0,
        mouseX: 0,
        mouseY: 0,
        high: parseInt(localStorage.getItem('bx_mghigh') || '0', 10),
        rafId: null,
    };

    // ── helpers ───────────────────────────────────────────────────
    const rand = (a, b) => a + Math.random() * (b - a);

    function spawnBug() {
        const fromLeft = Math.random() < 0.5;
        state.bugs.push({
            x: fromLeft ? -30 : W + 30,
            y: rand(40, H - 40),
            vx: (fromLeft ? 1 : -1) * rand(60, 140),
            vy: rand(-20, 20),
            r: 18,
            wobble: Math.random() * Math.PI * 2,
            hp: 1,
            alive: true,
        });
    }
    function spawnStar() {
        state.stars.push({
            x: rand(40, W - 40),
            y: rand(40, H - 40),
            vx: rand(-40, 40),
            vy: rand(-40, 40),
            r: 14,
            rot: Math.random() * Math.PI,
            alive: true,
        });
    }
    function spark(x, y, color = '#ffd400', n = 10) {
        for (let i = 0; i < n; i++) {
            const a = Math.random() * Math.PI * 2;
            const s = rand(40, 220);
            state.sparks.push({
                x, y,
                vx: Math.cos(a) * s,
                vy: Math.sin(a) * s,
                life: rand(0.4, 0.8),
                age: 0,
                color,
            });
        }
    }

    // ── drawing routines ──────────────────────────────────────────
    function drawBackground() {
        ctx.fillStyle = '#050018';
        ctx.fillRect(0, 0, W, H);
        // grid
        ctx.strokeStyle = 'rgba(0,255,208,0.12)';
        ctx.lineWidth = 1;
        for (let x = 0; x < W; x += 32) {
            ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
        }
        for (let y = 0; y < H; y += 32) {
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
        }
    }
    function drawBug(b) {
        ctx.save();
        ctx.translate(b.x, b.y);
        const wob = Math.sin(b.wobble) * 0.18;
        ctx.rotate(wob + (b.vx > 0 ? 0 : Math.PI));
        // body
        ctx.fillStyle = '#ff2244';
        ctx.shadowColor = '#ff2244';
        ctx.shadowBlur = 14;
        ctx.beginPath();
        ctx.ellipse(0, 0, b.r, b.r * 0.7, 0, 0, Math.PI * 2);
        ctx.fill();
        // stripe
        ctx.fillStyle = '#02000a';
        ctx.fillRect(-b.r, -2, b.r * 2, 4);
        // eyes
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(b.r * 0.4,  -b.r * 0.3, 3.2, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(b.r * 0.55, +b.r * 0.3, 3.2, 0, Math.PI * 2); ctx.fill();
        // legs
        ctx.strokeStyle = '#ff2244';
        ctx.lineWidth = 2;
        for (let i = -1; i <= 1; i++) {
            ctx.beginPath();
            ctx.moveTo(-b.r * 0.4 + i * 6, -b.r * 0.7);
            ctx.lineTo(-b.r * 0.4 + i * 6, -b.r * 1.3);
            ctx.moveTo(-b.r * 0.4 + i * 6, b.r * 0.7);
            ctx.lineTo(-b.r * 0.4 + i * 6, b.r * 1.3);
            ctx.stroke();
        }
        // antennae
        ctx.beginPath();
        ctx.moveTo(b.r * 0.7, -b.r * 0.5); ctx.lineTo(b.r * 1.4, -b.r * 1.2);
        ctx.moveTo(b.r * 0.7, +b.r * 0.5); ctx.lineTo(b.r * 1.4, +b.r * 1.2);
        ctx.stroke();
        ctx.restore();
    }
    function drawStar(s) {
        ctx.save();
        ctx.translate(s.x, s.y);
        ctx.rotate(s.rot);
        ctx.fillStyle = '#ffd400';
        ctx.shadowColor = '#ffd400';
        ctx.shadowBlur = 18;
        ctx.beginPath();
        for (let i = 0; i < 5; i++) {
            const ang = (i * 2 * Math.PI) / 5 - Math.PI / 2;
            ctx.lineTo(Math.cos(ang) * s.r, Math.sin(ang) * s.r);
            const ang2 = ang + Math.PI / 5;
            ctx.lineTo(Math.cos(ang2) * s.r * 0.45, Math.sin(ang2) * s.r * 0.45);
        }
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }
    function drawSparks(dt) {
        for (const sp of state.sparks) {
            sp.age += dt;
            sp.x += sp.vx * dt;
            sp.y += sp.vy * dt;
            sp.vy += 280 * dt; // gravity
            const t = 1 - (sp.age / sp.life);
            if (t <= 0) continue;
            ctx.globalAlpha = t;
            ctx.fillStyle = sp.color;
            ctx.fillRect(sp.x - 1.5, sp.y - 1.5, 3, 3);
        }
        ctx.globalAlpha = 1;
        state.sparks = state.sparks.filter(s => s.age < s.life);
    }
    function drawCursor() {
        ctx.save();
        ctx.translate(state.mouseX, state.mouseY);
        ctx.strokeStyle = '#00ffd0';
        ctx.shadowColor = '#00ffd0';
        ctx.shadowBlur = 12;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-12, 0); ctx.lineTo(-4, 0);
        ctx.moveTo( 4, 0);  ctx.lineTo(12, 0);
        ctx.moveTo(0, -12); ctx.lineTo(0, -4);
        ctx.moveTo(0,  4);  ctx.lineTo(0, 12);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, 0, 1.5, 0, Math.PI * 2);
        ctx.fillStyle = '#ff2bd6';
        ctx.fill();
        ctx.restore();
    }
    function drawCombo() {
        if (state.combo < 2) return;
        ctx.save();
        ctx.fillStyle = '#ffd400';
        ctx.shadowColor = '#ffd400';
        ctx.shadowBlur = 14;
        ctx.font = 'bold 22px "Press Start 2P", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`x${state.combo} COMBO`, W / 2, 40);
        ctx.restore();
    }

    // ── update loop ───────────────────────────────────────────────
    let last = 0;
    function loop(ts) {
        const dt = last ? Math.min((ts - last) / 1000, 0.05) : 0;
        last = ts;
        if (!state.running) return;

        // timer
        state.timeLeft = Math.max(0, 30 - (ts - state.startTs) / 1000);
        timeEl.textContent = `TIME: ${state.timeLeft.toFixed(1)}`;
        if (state.timeLeft <= 0) return endGame();

        // spawning gets harder over time
        const progress = 1 - state.timeLeft / 30;
        state.spawnBug -= dt;
        if (state.spawnBug <= 0) { spawnBug(); state.spawnBug = rand(0.4, 1.0) - progress * 0.4; }
        state.spawnStar -= dt;
        if (state.spawnStar <= 0) { spawnStar(); state.spawnStar = rand(1.4, 2.4); }

        // update bugs
        for (const b of state.bugs) {
            b.x += b.vx * dt;
            b.y += b.vy * dt + Math.sin(b.wobble) * 14 * dt;
            b.wobble += dt * 4;
            if (b.y < 30) b.vy =  Math.abs(b.vy);
            if (b.y > H - 30) b.vy = -Math.abs(b.vy);
            if (b.x < -50 || b.x > W + 50) b.alive = false;
        }
        state.bugs = state.bugs.filter(b => b.alive);

        // update stars
        for (const s of state.stars) {
            s.x += s.vx * dt;
            s.y += s.vy * dt;
            s.rot += dt;
            if (s.x < 20 || s.x > W - 20) s.vx *= -1;
            if (s.y < 20 || s.y > H - 20) s.vy *= -1;
        }

        // combo decay
        if (state.combo > 0) {
            state.comboTimer -= dt;
            if (state.comboTimer <= 0) state.combo = 0;
        }

        // ── render ───
        drawBackground();
        // bottom horizon glow
        const grd = ctx.createLinearGradient(0, H * 0.7, 0, H);
        grd.addColorStop(0, 'rgba(255,43,214,0)');
        grd.addColorStop(1, 'rgba(255,43,214,0.18)');
        ctx.fillStyle = grd;
        ctx.fillRect(0, H * 0.7, W, H * 0.3);

        for (const s of state.stars) drawStar(s);
        for (const b of state.bugs)  drawBug(b);
        drawSparks(dt);
        drawCursor();
        drawCombo();

        state.rafId = requestAnimationFrame(loop);
    }

    // ── input ─────────────────────────────────────────────────────
    canvas.addEventListener('mousemove', (e) => {
        const r = canvas.getBoundingClientRect();
        state.mouseX = (e.clientX - r.left) * (W / r.width);
        state.mouseY = (e.clientY - r.top)  * (H / r.height);
    });
    canvas.addEventListener('touchmove', (e) => {
        if (!e.touches.length) return;
        const r = canvas.getBoundingClientRect();
        state.mouseX = (e.touches[0].clientX - r.left) * (W / r.width);
        state.mouseY = (e.touches[0].clientY - r.top)  * (H / r.height);
    }, { passive: true });

    function onShoot(e) {
        if (!state.running) return;
        const r = canvas.getBoundingClientRect();
        const x = ((e.touches ? e.touches[0].clientX : e.clientX) - r.left) * (W / r.width);
        const y = ((e.touches ? e.touches[0].clientY : e.clientY) - r.top)  * (H / r.height);
        state.mouseX = x; state.mouseY = y;

        // check bug hit
        let hit = false;
        for (const b of state.bugs) {
            const dx = b.x - x, dy = b.y - y;
            if (dx * dx + dy * dy < (b.r + 6) ** 2) {
                b.alive = false;
                hit = true;
                state.combo++;
                state.comboTimer = 1.6;
                const gain = 1 + Math.min(state.combo - 1, 5);
                state.score += gain;
                spark(b.x, b.y, '#ff2244', 14);
                sfx && sfx.click && sfx.click();
                break;
            }
        }
        // star penalty
        if (!hit) {
            for (let i = 0; i < state.stars.length; i++) {
                const s = state.stars[i];
                const dx = s.x - x, dy = s.y - y;
                if (dx * dx + dy * dy < (s.r + 6) ** 2) {
                    state.stars.splice(i, 1);
                    state.startTs -= 2000; // -2s penalty
                    spark(s.x, s.y, '#ffd400', 18);
                    sfx && sfx.error && sfx.error();
                    state.combo = 0;
                    break;
                }
            }
        }
        if (hit) {
            state.bugs = state.bugs.filter(b => b.alive);
        } else {
            state.combo = 0;
        }
        scoreEl.textContent = `SCORE: ${state.score}`;
    }
    canvas.addEventListener('mousedown', onShoot);
    canvas.addEventListener('touchstart', onShoot, { passive: true });

    // ── lifecycle ─────────────────────────────────────────────────
    function startGame() {
        state.running = true;
        state.score = 0;
        state.bugs = [];
        state.stars = [];
        state.sparks = [];
        state.spawnBug = 0;
        state.spawnStar = 1;
        state.combo = 0;
        state.startTs = performance.now();
        state.timeLeft = 30;
        last = 0;
        introEl?.setAttribute('hidden', '');
        overEl?.setAttribute('hidden', '');
        scoreEl.textContent = 'SCORE: 0';
        timeEl.textContent  = 'TIME: 30.0';
        state.rafId = requestAnimationFrame(loop);
    }

    function endGame() {
        state.running = false;
        cancelAnimationFrame(state.rafId);
        if (state.score > state.high) {
            state.high = state.score;
            localStorage.setItem('bx_mghigh', String(state.high));
            unlockAchievement && unlockAchievement('Mini-Game High Score!', true);
        }
        if (state.score >= 30) unlockAchievement && unlockAchievement('Bug Bounty Hunter (30+)');
        if (state.score >= 50) unlockAchievement && unlockAchievement('Exterminator (50+)', true);
        gainXP && gainXP(Math.min(state.score * 2, 200));
        finalEl.textContent = state.score;
        highEl.textContent  = state.high;
        overEl?.removeAttribute('hidden');
    }

    function open() {
        modal.removeAttribute('hidden');
        introEl?.removeAttribute('hidden');
        overEl?.setAttribute('hidden', '');
        scoreEl.textContent = 'SCORE: 0';
        timeEl.textContent  = 'TIME: 30.0';
        highEl && (highEl.textContent = state.high);
    }
    function close() {
        modal.setAttribute('hidden', '');
        state.running = false;
        cancelAnimationFrame(state.rafId);
    }

    closeBtn?.addEventListener('click', close);
    startBtn?.addEventListener('click', startGame);
    restartBtn?.addEventListener('click', startGame);

    window.addEventListener('keydown', (e) => {
        if (modal.hasAttribute('hidden')) return;
        if (e.key === 'Escape') close();
        if (e.key === ' ' && !state.running && !overEl.hasAttribute('hidden')) startGame();
    });

    return { open, close };
}

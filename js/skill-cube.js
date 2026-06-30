/* ═════════════════════════════════════════════════════════════════
   skill-cube.js — A 3D rotating cube whose 6 faces show skills
   Each face is a procedurally-generated canvas texture
   ═════════════════════════════════════════════════════════════════ */

import * as THREE from 'three';

const FACES = [
    { label: 'FRONTEND', sub: 'HTML / CSS / JS / React', color: '#00ffd0' },
    { label: 'BACKEND',  sub: 'Node / Python / APIs',   color: '#ff2bd6' },
    { label: 'DATABASE', sub: 'Mongo / SQL / Redis',    color: '#ffd400' },
    { label: '3D / GL',  sub: 'Three.js / Shaders',     color: '#36ff7a' },
    { label: 'UI / UX',  sub: 'Figma / Motion',         color: '#8a5cff' },
    { label: 'DEVOPS',   sub: 'Docker / CI / Cloud',    color: '#ff6a00' },
];

function makeFaceTexture(face) {
    const c = document.createElement('canvas');
    c.width = 512; c.height = 512;
    const ctx = c.getContext('2d');

    // background gradient
    const bg = ctx.createLinearGradient(0, 0, 512, 512);
    bg.addColorStop(0, '#05000d');
    bg.addColorStop(1, '#110428');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 512, 512);

    // glowing border
    ctx.strokeStyle = face.color;
    ctx.lineWidth = 6;
    ctx.shadowColor = face.color;
    ctx.shadowBlur = 30;
    ctx.strokeRect(18, 18, 476, 476);

    // grid overlay
    ctx.shadowBlur = 0;
    ctx.strokeStyle = face.color + '33';
    ctx.lineWidth = 1;
    for (let i = 0; i < 16; i++) {
        ctx.beginPath();
        ctx.moveTo(0, i * 32); ctx.lineTo(512, i * 32);
        ctx.moveTo(i * 32, 0); ctx.lineTo(i * 32, 512);
        ctx.stroke();
    }

    // corner brackets
    ctx.strokeStyle = face.color;
    ctx.lineWidth = 4;
    ctx.shadowBlur = 16;
    ctx.shadowColor = face.color;
    const b = 26, l = 60;
    [[b,b,1,1],[512-b,b,-1,1],[b,512-b,1,-1],[512-b,512-b,-1,-1]].forEach(([x,y,sx,sy]) => {
        ctx.beginPath();
        ctx.moveTo(x, y + sy * l); ctx.lineTo(x, y); ctx.lineTo(x + sx * l, y);
        ctx.stroke();
    });

    // big label
    ctx.shadowBlur = 18;
    ctx.fillStyle = face.color;
    ctx.font = 'bold 56px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(face.label, 256, 220);

    // subtitle
    ctx.shadowBlur = 6;
    ctx.fillStyle = '#eafffd';
    ctx.font = '22px "Share Tech Mono", monospace';
    ctx.fillText(face.sub, 256, 286);

    // level chip
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#02000a';
    ctx.fillRect(160, 340, 192, 48);
    ctx.strokeStyle = face.color;
    ctx.lineWidth = 2;
    ctx.strokeRect(160, 340, 192, 48);
    ctx.fillStyle = face.color;
    ctx.font = '24px "Press Start 2P", monospace';
    ctx.fillText('LV 99', 256, 366);

    // bottom mini bar
    ctx.fillStyle = '#222';
    ctx.fillRect(80, 420, 352, 10);
    ctx.fillStyle = face.color;
    ctx.shadowBlur = 14;
    ctx.fillRect(80, 420, 320, 10);

    // top tag
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#eafffd';
    ctx.font = '16px "Share Tech Mono", monospace';
    ctx.textAlign = 'left';
    ctx.fillText('// SKILL_MODULE', 56, 72);
    ctx.textAlign = 'right';
    ctx.fillText('★ ★ ★ ★ ★', 456, 72);

    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return tex;
}

export function mountSkillCube(canvas) {
    if (!canvas) return null;

    const renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        alpha: true,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    const w = canvas.clientWidth || 360;
    const h = canvas.clientHeight || 360;
    renderer.setSize(w, h, false);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, w / h, 0.1, 50);
    camera.position.set(0, 0, 6);

    scene.add(new THREE.AmbientLight(0xffffff, 0.95));
    const p1 = new THREE.PointLight(0x00ffd0, 1.8, 30); p1.position.set(5, 5, 5); scene.add(p1);
    const p2 = new THREE.PointLight(0xff2bd6, 1.8, 30); p2.position.set(-5, -3, 4); scene.add(p2);

    const materials = FACES.map(f =>
        new THREE.MeshStandardMaterial({
            map: makeFaceTexture(f),
            emissive: new THREE.Color(f.color),
            emissiveIntensity: 0.35,
            metalness: 0.4,
            roughness: 0.35,
        })
    );
    const cube = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.2, 2.2), materials);
    scene.add(cube);

    // wireframe edges overlay
    const edges = new THREE.LineSegments(
        new THREE.EdgesGeometry(cube.geometry),
        new THREE.LineBasicMaterial({ color: 0x00ffd0, transparent: true, opacity: 0.85 })
    );
    cube.add(edges);

    // ── drag interaction ──────────────────────────────────────────
    let isDragging = false;
    let lastX = 0, lastY = 0;
    let vx = 0.004, vy = 0.006;

    canvas.style.cursor = 'grab';
    const onDown = (e) => {
        isDragging = true;
        canvas.style.cursor = 'grabbing';
        lastX = (e.touches ? e.touches[0].clientX : e.clientX);
        lastY = (e.touches ? e.touches[0].clientY : e.clientY);
    };
    const onMove = (e) => {
        if (!isDragging) return;
        const x = (e.touches ? e.touches[0].clientX : e.clientX);
        const y = (e.touches ? e.touches[0].clientY : e.clientY);
        const dx = x - lastX, dy = y - lastY;
        vx = dy * 0.005;
        vy = dx * 0.005;
        cube.rotation.x += vx;
        cube.rotation.y += vy;
        lastX = x; lastY = y;
    };
    const onUp = () => { isDragging = false; canvas.style.cursor = 'grab'; };
    canvas.addEventListener('mousedown', onDown);
    canvas.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    canvas.addEventListener('touchstart', onDown, { passive: true });
    canvas.addEventListener('touchmove', onMove, { passive: true });
    window.addEventListener('touchend', onUp);

    // ── responsive ────────────────────────────────────────────────
    const ro = new ResizeObserver(() => {
        const ww = canvas.clientWidth, hh = canvas.clientHeight;
        if (!ww || !hh) return;
        renderer.setSize(ww, hh, false);
        camera.aspect = ww / hh;
        camera.updateProjectionMatrix();
    });
    ro.observe(canvas);

    // ── render ────────────────────────────────────────────────────
    function loop() {
        if (!isDragging) {
            cube.rotation.x += vx;
            cube.rotation.y += vy;
            vx *= 0.985; vy *= 0.985;
            // keep a baseline rotation
            if (Math.abs(vx) < 0.002) vx += 0.0003;
            if (Math.abs(vy) < 0.002) vy += 0.0006;
        }
        renderer.render(scene, camera);
        requestAnimationFrame(loop);
    }
    loop();

    return { cube, renderer };
}

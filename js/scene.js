/* ═════════════════════════════════════════════════════════════════
   scene.js — Three.js background world
   Synthwave grid + floating wireframe geometry + particle starfield
   ═════════════════════════════════════════════════════════════════ */

import * as THREE from 'three';

export function createScene(canvas) {
    const isMobile = matchMedia('(max-width: 700px)').matches;
    const dpr = Math.min(window.devicePixelRatio || 1, isMobile ? 1.25 : 1.75);

    const renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: !isMobile,
        alpha: true,
        powerPreference: 'high-performance',
    });
    renderer.setPixelRatio(dpr);
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x0a0118, 0.022);

    const camera = new THREE.PerspectiveCamera(
        62,
        window.innerWidth / window.innerHeight,
        0.1,
        300
    );
    camera.position.set(0, 8, 22);
    camera.lookAt(0, 4, 0);

    // ── lights ─────────────────────────────────────────────────────
    const ambient = new THREE.AmbientLight(0x1a1040, 0.7);
    scene.add(ambient);

    const cyanLight = new THREE.PointLight(0x00ffd0, 4, 60);
    cyanLight.position.set(-12, 10, 6);
    scene.add(cyanLight);

    const magentaLight = new THREE.PointLight(0xff2bd6, 4, 60);
    magentaLight.position.set(14, 6, -2);
    scene.add(magentaLight);

    const yellowLight = new THREE.PointLight(0xffd400, 2.5, 50);
    yellowLight.position.set(0, 18, -10);
    scene.add(yellowLight);

    // ── synthwave grid floor (two layers for parallax) ─────────────
    function makeGridFloor(size, divisions, colorA, colorB, y) {
        const grid = new THREE.GridHelper(size, divisions, colorA, colorB);
        grid.position.y = y;
        const mat = grid.material;
        if (Array.isArray(mat)) {
            mat.forEach(m => {
                m.transparent = true;
                m.opacity = 0.55;
                m.depthWrite = false;
                m.blending = THREE.AdditiveBlending;
            });
        } else {
            mat.transparent = true;
            mat.opacity = 0.55;
            mat.depthWrite = false;
            mat.blending = THREE.AdditiveBlending;
        }
        return grid;
    }

    const grid1 = makeGridFloor(200, 60, 0x00ffd0, 0x4e1a8c, -2.5);
    const grid2 = makeGridFloor(200, 60, 0xff2bd6, 0x1a1040, -2.6);
    grid2.position.z = 100; // start ahead, will scroll back toward us
    scene.add(grid1);
    scene.add(grid2);

    // glowing horizon plane (synthwave sun)
    const sunGeo = new THREE.CircleGeometry(14, 64);
    const sunMat = new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: {
            uTime: { value: 0 },
            uColorA: { value: new THREE.Color(0xff2bd6) },
            uColorB: { value: new THREE.Color(0xffd400) },
        },
        vertexShader: /* glsl */`
            varying vec2 vUv;
            void main() {
                vUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: /* glsl */`
            varying vec2 vUv;
            uniform float uTime;
            uniform vec3 uColorA;
            uniform vec3 uColorB;
            void main() {
                vec2 uv = vUv - 0.5;
                float r = length(uv) * 2.0;
                // soft circular falloff
                float a = smoothstep(1.0, 0.0, r);
                // horizontal bands (vintage scanline sun)
                float bands = step(0.5, fract((vUv.y - uTime * 0.04) * 22.0));
                bands = mix(1.0, bands, smoothstep(0.0, 1.0, vUv.y));
                vec3 col = mix(uColorB, uColorA, vUv.y);
                gl_FragColor = vec4(col * bands, a * bands);
            }
        `
    });
    const sun = new THREE.Mesh(sunGeo, sunMat);
    sun.position.set(0, 8, -55);
    scene.add(sun);

    // ── starfield ─────────────────────────────────────────────────
    const starCount = isMobile ? 600 : 1500;
    const starGeo = new THREE.BufferGeometry();
    const starPos = new Float32Array(starCount * 3);
    const starColor = new Float32Array(starCount * 3);
    const palette = [
        new THREE.Color(0x00ffd0),
        new THREE.Color(0xff2bd6),
        new THREE.Color(0xffd400),
        new THREE.Color(0x8a5cff),
        new THREE.Color(0xffffff),
    ];
    for (let i = 0; i < starCount; i++) {
        const r = 50 + Math.random() * 120;
        const t = Math.random() * Math.PI * 2;
        const p = (Math.random() - 0.5) * Math.PI;
        starPos[i * 3 + 0] = Math.cos(t) * Math.cos(p) * r;
        starPos[i * 3 + 1] = Math.sin(p) * r * 0.6 + 8;
        starPos[i * 3 + 2] = Math.sin(t) * Math.cos(p) * r - 20;
        const c = palette[(Math.random() * palette.length) | 0];
        starColor[i * 3 + 0] = c.r;
        starColor[i * 3 + 1] = c.g;
        starColor[i * 3 + 2] = c.b;
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    starGeo.setAttribute('color', new THREE.BufferAttribute(starColor, 3));
    const starMat = new THREE.PointsMaterial({
        size: 0.5,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.9,
        vertexColors: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
    });
    const stars = new THREE.Points(starGeo, starMat);
    scene.add(stars);

    // ── floating wireframe shapes ─────────────────────────────────
    const shapeCount = isMobile ? 9 : 18;
    const shapeMaterials = palette.slice(0, 4).map(c =>
        new THREE.MeshBasicMaterial({
            color: c,
            wireframe: true,
            transparent: true,
            opacity: 0.85,
        })
    );
    const geoOptions = [
        new THREE.IcosahedronGeometry(1.1, 0),
        new THREE.OctahedronGeometry(1.1, 0),
        new THREE.TorusKnotGeometry(0.8, 0.28, 64, 8),
        new THREE.BoxGeometry(1.6, 1.6, 1.6),
        new THREE.DodecahedronGeometry(1.1, 0),
        new THREE.TetrahedronGeometry(1.3, 0),
    ];
    const shapes = [];
    for (let i = 0; i < shapeCount; i++) {
        const g = geoOptions[i % geoOptions.length];
        const m = shapeMaterials[i % shapeMaterials.length].clone();
        const mesh = new THREE.Mesh(g, m);
        mesh.position.set(
            (Math.random() - 0.5) * 50,
            Math.random() * 18 + 1,
            -Math.random() * 60 - 5
        );
        mesh.userData = {
            spin: new THREE.Vector3(
                (Math.random() - 0.5) * 0.6,
                (Math.random() - 0.5) * 0.6,
                (Math.random() - 0.5) * 0.6
            ),
            float: Math.random() * Math.PI * 2,
            speed: 0.2 + Math.random() * 0.4,
            baseY: Math.random() * 18 + 1,
        };
        scene.add(mesh);
        shapes.push(mesh);
    }

    // ── filled "boss" shape that hovers behind hero text ───────────
    const bossGeo = new THREE.IcosahedronGeometry(3.6, 0);
    const bossMat = new THREE.MeshStandardMaterial({
        color: 0x140033,
        emissive: 0x6a0db8,
        emissiveIntensity: 1.4,
        roughness: 0.25,
        metalness: 0.85,
        wireframe: false,
        flatShading: true,
    });
    const boss = new THREE.Mesh(bossGeo, bossMat);
    boss.position.set(0, 7, -18);
    scene.add(boss);
    // wireframe overlay for boss
    const bossWire = new THREE.Mesh(
        bossGeo.clone(),
        new THREE.MeshBasicMaterial({ color: 0x00ffd0, wireframe: true, transparent: true, opacity: 0.6 })
    );
    bossWire.scale.setScalar(1.03);
    boss.add(bossWire);

    // ── state ─────────────────────────────────────────────────────
    const state = {
        time: 0,
        scrollY: 0,
        targetScroll: 0,
        mouseX: 0,
        mouseY: 0,
        targetMouseX: 0,
        targetMouseY: 0,
        konami: false,
        cameraShake: 0,
    };

    // ── input bindings ────────────────────────────────────────────
    window.addEventListener('pointermove', (e) => {
        state.targetMouseX = (e.clientX / window.innerWidth) * 2 - 1;
        state.targetMouseY = (e.clientY / window.innerHeight) * 2 - 1;
    }, { passive: true });

    window.addEventListener('scroll', () => {
        state.targetScroll = window.scrollY;
    }, { passive: true });

    window.addEventListener('resize', onResize);
    function onResize() {
        const w = window.innerWidth, h = window.innerHeight;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
    }

    // ── animation loop ────────────────────────────────────────────
    const clock = new THREE.Clock();
    function render() {
        const dt = Math.min(clock.getDelta(), 0.05);
        state.time += dt;

        // smooth mouse and scroll
        state.mouseX += (state.targetMouseX - state.mouseX) * 0.05;
        state.mouseY += (state.targetMouseY - state.mouseY) * 0.05;
        state.scrollY += (state.targetScroll - state.scrollY) * 0.08;

        // camera drift based on mouse and scroll
        const scrollNorm = state.scrollY / Math.max(1, document.body.scrollHeight - window.innerHeight);
        const camTargetX = state.mouseX * 2.2;
        const camTargetY = 7 + state.mouseY * -1.4 + scrollNorm * 4;
        const camTargetZ = 22 - scrollNorm * 8;
        camera.position.x += (camTargetX - camera.position.x) * 0.05;
        camera.position.y += (camTargetY - camera.position.y) * 0.05;
        camera.position.z += (camTargetZ - camera.position.z) * 0.05;

        // camera shake (used by konami)
        if (state.cameraShake > 0) {
            camera.position.x += (Math.random() - 0.5) * state.cameraShake;
            camera.position.y += (Math.random() - 0.5) * state.cameraShake;
            state.cameraShake = Math.max(0, state.cameraShake - dt * 1.5);
        }
        camera.lookAt(0, 4 + scrollNorm * 1.5, 0);

        // grids - move toward camera for synthwave effect
        const gridSpeed = 8;
        grid1.position.z = ((grid1.position.z + dt * gridSpeed) % 100);
        grid2.position.z = ((grid2.position.z + dt * gridSpeed) % 100);

        // shapes
        for (let i = 0; i < shapes.length; i++) {
            const s = shapes[i];
            s.rotation.x += s.userData.spin.x * dt;
            s.rotation.y += s.userData.spin.y * dt;
            s.rotation.z += s.userData.spin.z * dt;
            s.userData.float += dt * s.userData.speed;
            s.position.y = s.userData.baseY + Math.sin(s.userData.float) * 0.7;
            // drift forward, recycle when too close
            s.position.z += dt * (1 + s.userData.speed) * 1.3;
            if (s.position.z > 14) {
                s.position.z = -65;
                s.position.x = (Math.random() - 0.5) * 50;
            }
        }

        // boss shape pulse + slow rotation
        boss.rotation.y += dt * 0.18;
        boss.rotation.x += dt * 0.07;
        const pulse = 1 + Math.sin(state.time * 1.4) * 0.04;
        boss.scale.setScalar(pulse);
        bossMat.emissiveIntensity = 1.2 + Math.sin(state.time * 2.0) * 0.4;

        // stars slow rotation
        stars.rotation.y += dt * 0.01;

        // sun shader uniforms
        sunMat.uniforms.uTime.value = state.time;

        // light orbits
        cyanLight.position.x = Math.sin(state.time * 0.4) * 16;
        cyanLight.position.z = Math.cos(state.time * 0.4) * 16 - 5;
        magentaLight.position.x = Math.cos(state.time * 0.3) * 18;
        magentaLight.position.z = Math.sin(state.time * 0.3) * 18 - 5;

        renderer.render(scene, camera);
        requestAnimationFrame(render);
    }

    render();

    // ── public API ────────────────────────────────────────────────
    return {
        scene,
        camera,
        renderer,
        shake(amount = 0.6) {
            state.cameraShake = Math.max(state.cameraShake, amount);
        },
        konamiBoost() {
            state.cameraShake = 1.2;
            shapes.forEach(s => {
                s.userData.spin.multiplyScalar(2.5);
                s.userData.speed *= 1.6;
                s.material.color.setHex(
                    [0x00ffd0, 0xff2bd6, 0xffd400, 0x36ff7a][Math.floor(Math.random() * 4)]
                );
            });
        },
    };
}

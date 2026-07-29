import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
import { GLTFLoader } from 'https://unpkg.com/three@0.160.0/examples/jsm/loaders/GLTFLoader.js';

(function () {
    const storageKey = 'aerodynamixBytePet';
    let state = { hunger: 78, fun: 68, energy: 84, sleeping: false, ...(JSON.parse(localStorage.getItem(storageKey) || '{}')) };
    const canvas = document.getElementById('pet-canvas');
    const stage = document.getElementById('pet-stage');
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(28, 1, .1, 100);
    camera.position.set(0, 1.15, 7.4);
    let renderer = null;
    let webglAvailable = true;
    try {
        renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false, powerPreference: 'low-power', failIfMajorPerformanceCaveat: false });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.shadowMap.enabled = false;
    } catch (error) {
        webglAvailable = false;
        canvas.hidden = true;
        const fallback = document.createElement('img');
        fallback.className = 'pet-fallback';
        fallback.src = 'attached_assets/pet-mascot.png';
        fallback.alt = 'Byte, a stylish bear pet';
        const note = document.createElement('div');
        note.className = 'pet-fallback-note';
        note.textContent = '3D mode will activate when WebGL is available';
        stage.append(fallback, note);
        console.warn('WebGL is unavailable; showing the lightweight pet fallback.', error);
    }
    scene.add(new THREE.HemisphereLight(0xbcefff, 0x071322, 2.2));
    const keyLight = new THREE.DirectionalLight(0xffffff, 3);
    keyLight.position.set(-3, 5, 5);
    scene.add(keyLight);
    const rimLight = new THREE.PointLight(0x43d8ff, 8, 8);
    rimLight.position.set(3, 2, 3);
    scene.add(rimLight);

    const pet = new THREE.Group();
    pet.position.y = -.45;
    scene.add(pet);
    const modelStatus = document.createElement('div');
    modelStatus.className = 'pet-fallback-note';
    modelStatus.textContent = 'Loading Byte from Blender…';
    stage.appendChild(modelStatus);
    const mat = (color, roughness = .72) => new THREE.MeshStandardMaterial({ color, roughness, metalness: .05 });
    const brown = mat(0x684a32), darkBrown = mat(0x3e2a20), cream = mat(0xc6aa8f);
    const white = mat(0xf4f2ed), blue = mat(0x123cbb), grey = mat(0x4c5360);
    const black = mat(0x15171d), glass = new THREE.MeshStandardMaterial({ color:0x69d9ff, metalness:.35, roughness:.2, transparent:true, opacity:.42 });
    function mesh(geometry, material, position, scale = [1,1,1]) {
        const item = new THREE.Mesh(geometry, material); item.position.set(...position); item.scale.set(...scale); item.castShadow = true; pet.add(item); return item;
    }
    // Byte is a real low-poly model assembled from lightweight geometry: no textures or heavy assets.
    mesh(new THREE.SphereGeometry(1.12, 16, 12), brown, [0, 1.3, 0], [1, 1.02, .92]);
    mesh(new THREE.SphereGeometry(.29, 12, 8), brown, [-.73, 2.1, 0], [1, 1.1, .8]);
    mesh(new THREE.SphereGeometry(.29, 12, 8), brown, [.73, 2.1, 0], [1, 1.1, .8]);
    mesh(new THREE.SphereGeometry(.18, 10, 6), cream, [-.73, 2.12, .17]);
    mesh(new THREE.SphereGeometry(.18, 10, 6), cream, [.73, 2.12, .17]);
    mesh(new THREE.SphereGeometry(.38, 12, 8), cream, [0, .95, .94], [1.35, .7, .55]);
    mesh(new THREE.SphereGeometry(.14, 10, 6), darkBrown, [0, 1.02, 1.36]);
    mesh(new THREE.SphereGeometry(.12, 8, 6), black, [-.38, 1.55, .88]);
    mesh(new THREE.SphereGeometry(.12, 8, 6), black, [.38, 1.55, .88]);
    mesh(new THREE.SphereGeometry(.065, 8, 6), white, [-.34, 1.6, .98]);
    mesh(new THREE.SphereGeometry(.065, 8, 6), white, [.42, 1.6, .98]);
    mesh(new THREE.BoxGeometry(.72, .08, .06), white, [-.38, 1.62, 1.02], [1,1,1]);
    mesh(new THREE.BoxGeometry(.72, .08, .06), white, [.38, 1.62, 1.02], [1,1,1]);
    mesh(new THREE.BoxGeometry(.08, .08, .06), white, [0, 1.62, 1.02]);
    mesh(new THREE.BoxGeometry(.06, .5, .04), white, [-.72, 1.62, 1.02], [1,1,1]);
    mesh(new THREE.BoxGeometry(.06, .5, .04), white, [.72, 1.62, 1.02], [1,1,1]);
    mesh(new THREE.CapsuleGeometry(.92, .85, 6, 10), white, [0, -.15, 0], [1.05, 1, .62]);
    mesh(new THREE.BoxGeometry(.7, .85, .18), grey, [-.55, .03, .55], [1,1,1]);
    mesh(new THREE.BoxGeometry(.7, .85, .18), grey, [.55, .03, .55], [1,1,1]);
    mesh(new THREE.BoxGeometry(.24, .32, .05), blue, [.0, .02, .68]);
    mesh(new THREE.CapsuleGeometry(.14, .72, 5, 8), blue, [-.52, -.98, 0], [1,1,.9]);
    mesh(new THREE.CapsuleGeometry(.14, .72, 5, 8), blue, [.52, -.98, 0], [1,1,.9]);
    mesh(new THREE.CapsuleGeometry(.22, .65, 5, 8), white, [-.52, -1.55, .1], [1.15,1,.9]);
    mesh(new THREE.CapsuleGeometry(.22, .65, 5, 8), white, [.52, -1.55, .1], [1.15,1,.9]);
    const proceduralParts = [...pet.children];
    const loader = new GLTFLoader();
    loader.load('attached_assets/dropout-bear.glb', (gltf) => {
        const imported = gltf.scene;
        const bounds = new THREE.Box3().setFromObject(imported);
        const size = bounds.getSize(new THREE.Vector3());
        const center = bounds.getCenter(new THREE.Vector3());
        const targetHeight = 3.75;
        const scale = targetHeight / Math.max(size.y, size.x, size.z);
        imported.scale.setScalar(scale);
        imported.position.set(-center.x * scale, -center.y * scale - .18, -center.z * scale);
        imported.rotation.y = Math.PI;
        imported.traverse((object) => {
            if (object.isMesh) {
                object.frustumCulled = true;
                object.castShadow = false;
                object.receiveShadow = false;
            }
        });
        proceduralParts.forEach((part) => pet.remove(part));
        pet.add(imported);
        modelStatus.textContent = 'Blender model · DropoutBear';
    }, undefined, (error) => {
        modelStatus.textContent = 'Blender model unavailable · using low-poly fallback';
        console.warn('Could not load the exported Blender model.', error);
    });
    const bodyParts = pet.children;
    function resize() { if (!renderer) return; const r = canvas.getBoundingClientRect(); renderer.setSize(r.width, r.height, false); camera.aspect = r.width / r.height; camera.updateProjectionMatrix(); }
    window.addEventListener('resize', resize); resize();
    let targetRotation = 0, rotation = 0, dragging = false, lastX = 0;
    canvas.addEventListener('pointerdown', e => { dragging = true; lastX = e.clientX; canvas.setPointerCapture(e.pointerId); });
    canvas.addEventListener('pointermove', e => { if (dragging) { targetRotation += (e.clientX - lastX) * .012; lastX = e.clientX; } });
    canvas.addEventListener('pointerup', () => { dragging = false; });
    const clock = new THREE.Clock();
    function animate() {
        requestAnimationFrame(animate);
        const t = clock.getElapsedTime();
        if (!dragging) targetRotation += .0022;
        rotation += (targetRotation - rotation) * .08;
        pet.rotation.y = rotation;
        pet.position.y = -.45 + (state.sleeping ? -.08 : Math.sin(t * 1.5) * .055);
        pet.rotation.z = state.sleeping ? -.12 : Math.sin(t * 1.5) * .012;
        if (renderer) renderer.render(scene, camera);
    }
    animate();
    const key = 'aerodynamixBytePet';
    function save() { localStorage.setItem(key, JSON.stringify(state)); }
    function render() {
        ['hunger','fun','energy'].forEach(name => { document.getElementById(name + '-bar').style.width = state[name] + '%'; document.getElementById(name + '-value').textContent = state[name] + '%'; });
        stage.classList.toggle('sleeping', state.sleeping);
        document.getElementById('mood').textContent = state.sleeping ? 'Dozing peacefully' : state.fun < 35 ? 'Needs attention' : 'Feeling good';
        document.getElementById('activity').textContent = state.sleeping ? 'Zzz... power nap' : 'Ready to hang out';
    }
    function act(action) {
        if (action === 'feed') { state.hunger = Math.min(100, state.hunger + 24); state.sleeping = false; document.getElementById('pet-note').textContent = 'Byte had a crunchy snack.'; }
        if (action === 'play') { state.fun = Math.min(100, state.fun + 25); state.energy = Math.max(0, state.energy - 14); state.sleeping = false; document.getElementById('pet-note').textContent = 'Byte is doing a victory dance!'; }
        if (action === 'sleep') { state.sleeping = !state.sleeping; if (!state.sleeping) state.energy = Math.min(100, state.energy + 28); document.getElementById('pet-note').textContent = state.sleeping ? 'Byte is taking a power nap.' : 'Sweet dreams. Energy is back!'; }
        save(); render();
    }
    document.querySelectorAll('[data-action]').forEach(button => button.addEventListener('click', () => act(button.dataset.action)));
    setInterval(() => { if (state.sleeping) state.energy = Math.min(100, state.energy + 1); else { state.hunger = Math.max(0, state.hunger - 1); state.fun = Math.max(0, state.fun - 1); } save(); render(); }, 60000);
    render();
})();
import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { AvatarSettings, Emotion } from '../types';
import { getModelFile } from '../services/db';

interface AvatarCanvasProps {
  settings: AvatarSettings;
  currentEmotion: Emotion;
  audioLevel: number; // 0.0 to 1.0 (from speaking or mic)
  onTapReaction: () => void;
  onLongPress: () => void;
}

export const AvatarCanvas: React.FC<AvatarCanvasProps> = ({
  settings,
  currentEmotion,
  audioLevel,
  onTapReaction,
  onLongPress
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const touchStartTimeRef = useRef<number>(0);
  const touchTimerRef = useRef<any>(null);
  const isLongPressTriggeredRef = useRef<boolean>(false);

  // References for live animation loop
  const animStateRef = useRef({
    settings,
    currentEmotion,
    audioLevel
  });

  useEffect(() => {
    animStateRef.current = { settings, currentEmotion, audioLevel };
  }, [settings, currentEmotion, audioLevel]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // Scene, Camera, Renderer
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      45,
      container.clientWidth / container.clientHeight,
      0.1,
      100
    );
    camera.position.set(0, 0, settings.cameraDistance || 3.8);

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance'
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    container.appendChild(renderer.domElement);

    // Studio Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0x00f2fe, 1.8);
    keyLight.position.set(2, 4, 3);
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0xff007f, 1.6);
    rimLight.position.set(-2, 2, -2);
    scene.add(rimLight);

    const bottomFillLight = new THREE.PointLight(0x7928ca, 1.2, 10);
    bottomFillLight.position.set(0, -2, 2);
    scene.add(bottomFillLight);

    // Root avatar group for transform / position / scale
    const avatarRoot = new THREE.Group();
    scene.add(avatarRoot);

    let customMixer: THREE.AnimationMixer | null = null;
    let customModelGroup: THREE.Group | null = null;
    let morphMeshes: { mesh: THREE.Mesh; jawIndex?: number; blinkIndex?: number }[] = [];

    // Procedural Hologram Elements (used when no custom model)
    const proceduralGroup = new THREE.Group();
    avatarRoot.add(proceduralGroup);

    // 1. Hologram Outer Energy Shell (Glass/Transmission)
    const headGeom = new THREE.SphereGeometry(0.7, 48, 48);
    const headMat = new THREE.MeshPhysicalMaterial({
      color: 0x120c24,
      emissive: 0x4a148c,
      emissiveIntensity: 0.35,
      roughness: 0.15,
      metalness: 0.4,
      transmission: 0.6,
      transparent: true,
      opacity: 0.88,
      wireframe: false
    });
    const headMesh = new THREE.Mesh(headGeom, headMat);
    headMesh.scale.set(0.9, 1.05, 0.95);
    proceduralGroup.add(headMesh);

    // 2. Visor Face Screen (Cyber curved shield)
    const visorGeom = new THREE.CylinderGeometry(0.55, 0.58, 0.45, 32, 1, false, -Math.PI / 3, (Math.PI * 2) / 3);
    const visorMat = new THREE.MeshStandardMaterial({
      color: 0x050510,
      emissive: 0x00f2fe,
      emissiveIntensity: 0.2,
      roughness: 0.2,
      metalness: 0.8,
      transparent: true,
      opacity: 0.9
    });
    const visorMesh = new THREE.Mesh(visorGeom, visorMat);
    visorMesh.position.set(0, 0.05, 0.38);
    visorMesh.rotation.y = Math.PI;
    proceduralGroup.add(visorMesh);

    // 3. Digital Glowing Eyes (Left & Right)
    const eyeGeom = new THREE.PlaneGeometry(0.18, 0.08);
    const eyeMatLeft = new THREE.MeshBasicMaterial({
      color: 0x00f2fe,
      transparent: true,
      opacity: 0.95,
      side: THREE.DoubleSide
    });
    const eyeMeshLeft = new THREE.Mesh(eyeGeom, eyeMatLeft);
    eyeMeshLeft.position.set(-0.22, 0.1, 0.72);
    proceduralGroup.add(eyeMeshLeft);

    const eyeMatRight = eyeMatLeft.clone();
    const eyeMeshRight = new THREE.Mesh(eyeGeom, eyeMatRight);
    eyeMeshRight.position.set(0.22, 0.1, 0.72);
    proceduralGroup.add(eyeMeshRight);

    // 4. Digital Mouth / Viseme Line (Opens with lip-sync audio)
    const mouthGeom = new THREE.PlaneGeometry(0.24, 0.035);
    const mouthMat = new THREE.MeshBasicMaterial({
      color: 0xff3b88,
      transparent: true,
      opacity: 0.95,
      side: THREE.DoubleSide
    });
    const mouthMesh = new THREE.Mesh(mouthGeom, mouthMat);
    mouthMesh.position.set(0, -0.12, 0.71);
    proceduralGroup.add(mouthMesh);

    // 5. Holographic Halo Rings
    const ringGeom1 = new THREE.TorusGeometry(1.05, 0.02, 16, 100);
    const ringMat1 = new THREE.MeshStandardMaterial({
      color: 0x00f2fe,
      emissive: 0x00f2fe,
      emissiveIntensity: 1.2,
      roughness: 0.2
    });
    const haloRing1 = new THREE.Mesh(ringGeom1, ringMat1);
    haloRing1.rotation.x = Math.PI * 0.35;
    proceduralGroup.add(haloRing1);

    const ringGeom2 = new THREE.TorusGeometry(1.22, 0.015, 16, 100);
    const ringMat2 = new THREE.MeshStandardMaterial({
      color: 0xff007f,
      emissive: 0xff007f,
      emissiveIntensity: 1.0,
      roughness: 0.2
    });
    const haloRing2 = new THREE.Mesh(ringGeom2, ringMat2);
    haloRing2.rotation.y = Math.PI * 0.35;
    haloRing2.rotation.z = Math.PI * 0.2;
    proceduralGroup.add(haloRing2);

    // 6. Floating Crystal Core / Torso Base
    const coreGeom = new THREE.OctahedronGeometry(0.35, 0);
    const coreMat = new THREE.MeshStandardMaterial({
      color: 0x8a3ffc,
      emissive: 0x8a3ffc,
      emissiveIntensity: 1.5,
      roughness: 0.1,
      metalness: 0.8
    });
    const coreMesh = new THREE.Mesh(coreGeom, coreMat);
    coreMesh.position.set(0, -1.0, 0);
    proceduralGroup.add(coreMesh);

    // 7. Shoulders / Cyber Collar
    const collarGeom = new THREE.CylinderGeometry(0.85, 0.95, 0.25, 32, 1, true);
    const collarMat = new THREE.MeshStandardMaterial({
      color: 0x16162a,
      emissive: 0x33145a,
      emissiveIntensity: 0.4,
      roughness: 0.3,
      metalness: 0.7
    });
    const collarMesh = new THREE.Mesh(collarGeom, collarMat);
    collarMesh.position.set(0, -1.05, 0);
    proceduralGroup.add(collarMesh);

    // Load custom GLB/GLTF model from IndexedDB if stored
    async function loadCustomModel() {
      try {
        const stored = await getModelFile();
        if (stored && stored.data) {
          const loader = new GLTFLoader();
          loader.parse(
            stored.data,
            '',
            (gltf) => {
              // Hide procedural avatar and add uploaded 3D model
              proceduralGroup.visible = false;
              customModelGroup = gltf.scene;

              // Center model bounds
              const box = new THREE.Box3().setFromObject(customModelGroup);
              const center = box.getCenter(new THREE.Vector3());
              const size = box.getSize(new THREE.Vector3());
              const maxDim = Math.max(size.x, size.y, size.z);
              const scale = 2.0 / (maxDim || 1);
              customModelGroup.scale.setScalar(scale);
              customModelGroup.position.sub(center.multiplyScalar(scale));

              // Find morph targets (jawOpen, mouthOpen, blink)
              morphMeshes = [];
              customModelGroup.traverse((child) => {
                if ((child as THREE.Mesh).isMesh && (child as THREE.Mesh).morphTargetDictionary) {
                  const mesh = child as THREE.Mesh;
                  const dict = mesh.morphTargetDictionary!;
                  let jawIdx: number | undefined;
                  let blinkIdx: number | undefined;

                  for (const [key, idx] of Object.entries(dict)) {
                    const lk = key.toLowerCase();
                    if (lk.includes('jaw') || lk.includes('mouthopen') || lk.includes('viseme_aa') || lk === 'a' || lk === 'o') {
                      jawIdx = idx;
                    }
                    if (lk.includes('blink') || lk.includes('eyeblink')) {
                      blinkIdx = idx;
                    }
                  }
                  morphMeshes.push({ mesh, jawIndex: jawIdx, blinkIndex: blinkIdx });
                }
              });

              // Setup animation mixer if clips exist
              if (gltf.animations && gltf.animations.length > 0) {
                customMixer = new THREE.AnimationMixer(customModelGroup);
                const idleClip = gltf.animations.find(c => c.name.toLowerCase().includes('idle')) || gltf.animations[0];
                const action = customMixer.clipAction(idleClip);
                action.play();
              }

              avatarRoot.add(customModelGroup);
            },
            (error) => {
              console.warn('Could not parse custom 3D model:', error);
              proceduralGroup.visible = true;
            }
          );
        } else {
          proceduralGroup.visible = true;
        }
      } catch (err) {
        console.warn('Error loading custom avatar model:', err);
        proceduralGroup.visible = true;
      }
    }

    loadCustomModel();

    // Clock and animation loop
    const clock = new THREE.Clock();
    let blinkTimer = 0;
    let isBlinking = false;
    let animId: number;

    const animate = () => {
      const delta = clock.getDelta();
      const time = clock.getElapsedTime();
      const current = animStateRef.current;
      const emotion = current.currentEmotion;
      const audio = current.audioLevel;

      // Update Camera & Root settings
      camera.position.z = THREE.MathUtils.damp(camera.position.z, current.settings.cameraDistance || 3.8, 4, delta);
      avatarRoot.scale.setScalar(current.settings.scale || 1.0);
      avatarRoot.position.y = current.settings.verticalPosition || -0.2;

      if (current.settings.autoRotate) {
        avatarRoot.rotation.y += delta * 0.4;
      } else {
        const targetRotY = THREE.MathUtils.degToRad(current.settings.rotationY || 0);
        avatarRoot.rotation.y = THREE.MathUtils.damp(avatarRoot.rotation.y, targetRotY, 6, delta);
      }

      // Update custom GLTF animation mixer if active
      if (customMixer) {
        customMixer.update(delta);
      }

      // State machine logic & physical posture damping
      let targetRotX = 0;
      let targetRotY = 0;
      let targetRotZ = 0;
      let targetPosY = Math.sin(time * 1.8) * 0.05; // Idle breathing float
      let targetHeadPitch = 0;

      switch (emotion) {
        case 'listening':
          // Leans forward toward user, head attentive
          targetRotX = 0.15;
          targetPosY = 0.08 + Math.sin(time * 2.5) * 0.02;
          headMesh.scale.set(0.92, 1.05, 0.96);
          break;
        case 'thinking':
          // Looks slightly aside and upward, gentle pondering wobble
          targetRotY = 0.25;
          targetRotZ = 0.08;
          targetHeadPitch = -0.12;
          break;
        case 'happy':
        case 'laughing':
          // Joyful bounce
          targetPosY = Math.sin(time * 6) * 0.08;
          targetRotZ = Math.sin(time * 3) * 0.06;
          break;
        case 'shy':
          // Head tilted down and aside
          targetRotX = -0.15;
          targetRotY = -0.2;
          targetRotZ = 0.1;
          break;
        case 'surprised':
          // Leans back, upright
          targetRotX = -0.18;
          targetPosY = 0.12;
          break;
        case 'sad':
          // Drooping down
          targetRotX = -0.2;
          targetPosY = -0.1;
          break;
        case 'angry':
          targetRotX = 0.1;
          targetPosY = 0;
          break;
        case 'love':
          // Gentle floating sway
          targetPosY = Math.sin(time * 2) * 0.08;
          targetRotZ = Math.sin(time * 1.5) * 0.05;
          break;
        case 'speaking':
          targetPosY = Math.sin(time * 3.5) * 0.04;
          targetRotX = Math.sin(time * 4) * 0.05;
          break;
      }

      // Apply procedural avatar animations
      proceduralGroup.position.y = THREE.MathUtils.damp(proceduralGroup.position.y, targetPosY, 4, delta);
      proceduralGroup.rotation.x = THREE.MathUtils.damp(proceduralGroup.rotation.x, targetRotX, 4, delta);
      proceduralGroup.rotation.y = THREE.MathUtils.damp(proceduralGroup.rotation.y, targetRotY, 4, delta);
      proceduralGroup.rotation.z = THREE.MathUtils.damp(proceduralGroup.rotation.z, targetRotZ, 4, delta);

      // Rotate halo rings
      haloRing1.rotation.z += delta * 0.8;
      haloRing2.rotation.x += delta * 0.6;
      coreMesh.rotation.y += delta * 1.5;
      coreMesh.rotation.x += delta * 0.8;

      // Pulse core with audio level
      const coreScale = 1.0 + audio * 0.45;
      coreMesh.scale.set(coreScale, coreScale, coreScale);

      // Blinking animation
      blinkTimer += delta;
      if (blinkTimer > 3.2) {
        isBlinking = true;
        if (blinkTimer > 3.4) {
          isBlinking = false;
          blinkTimer = 0;
        }
      }

      // Eye scale / emotion reactions
      let eyeScaleY = isBlinking ? 0.05 : 1.0;
      if (emotion === 'happy' || emotion === 'laughing') {
        eyeScaleY = isBlinking ? 0.05 : 0.4; // smiling squint
      } else if (emotion === 'surprised') {
        eyeScaleY = 1.6; // wide open
      }
      eyeMeshLeft.scale.y = eyeScaleY;
      eyeMeshRight.scale.y = eyeScaleY;

      // Lip-sync: drive mouth opening from TTS audio amplitude
      const mouthOpenAmount = Math.max(0.05, audio * 2.2);
      mouthMesh.scale.y = mouthOpenAmount;
      mouthMesh.scale.x = 1.0 + audio * 0.4;

      // If custom model with morph targets is loaded, drive jawOpen / blink
      if (morphMeshes.length > 0) {
        for (const item of morphMeshes) {
          const influences = item.mesh.morphTargetInfluences;
          if (influences) {
            if (item.jawIndex !== undefined) {
              influences[item.jawIndex] = THREE.MathUtils.damp(influences[item.jawIndex], audio * 1.5, 12, delta);
            }
            if (item.blinkIndex !== undefined) {
              influences[item.blinkIndex] = isBlinking ? 1.0 : 0.0;
            }
          }
        }
      } else if (customModelGroup) {
        // Fallback for custom models with no morph targets: subtle head scale pulse with voice
        const pulse = 1.0 + audio * 0.08;
        customModelGroup.scale.setScalar(pulse);
      }

      // Hologram glow intensity modulation
      if (current.settings.hologramEffect) {
        headMat.emissiveIntensity = 0.35 + audio * 0.6;
        ringMat1.emissiveIntensity = 1.0 + audio * 1.2;
        ringMat2.emissiveIntensity = 0.9 + audio * 1.0;
      }

      renderer.render(scene, camera);
      animId = requestAnimationFrame(animate);
    };

    animate();

    // Resize handler
    const handleResize = () => {
      if (!container) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
      if (renderer.domElement && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  // Handle pointer interactions (tap vs long-press)
  const handlePointerDown = (e: React.PointerEvent) => {
    touchStartTimeRef.current = Date.now();
    isLongPressTriggeredRef.current = false;

    touchTimerRef.current = setTimeout(() => {
      isLongPressTriggeredRef.current = true;
      if (navigator.vibrate) navigator.vibrate(50);
      onLongPress();
    }, 600);
  };

  const handlePointerUp = () => {
    if (touchTimerRef.current) {
      clearTimeout(touchTimerRef.current);
    }
    const duration = Date.now() - touchStartTimeRef.current;
    if (!isLongPressTriggeredRef.current && duration < 400) {
      if (navigator.vibrate) navigator.vibrate(25);
      onTapReaction();
    }
  };

  const handlePointerCancel = () => {
    if (touchTimerRef.current) {
      clearTimeout(touchTimerRef.current);
    }
  };

  return (
    <div
      ref={mountRef}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      className="absolute inset-0 z-10 w-full h-full cursor-pointer touch-none"
      style={{ WebkitTapHighlightColor: 'transparent' }}
    />
  );
};

import React, { useEffect, useRef } from 'react';
import { LightSettings, Emotion } from '../types';

interface RGBBackgroundProps {
  settings: LightSettings;
  currentEmotion: Emotion;
  audioLevel: number; // 0.0 to 1.0 (from mic or tts)
}

// Mood to color palettes
const EMOTION_PALETTES: Record<Emotion, [string, string]> = {
  idle: ['#7928ca', '#00f2fe'],
  listening: ['#00f5d4', '#00bbf9'],
  thinking: ['#9b5de5', '#f15bb5'],
  speaking: ['#ff007f', '#00f2fe'],
  happy: ['#ffbb00', '#ff007f'],
  laughing: ['#ff5e00', '#ffd000'],
  shy: ['#ff99c8', '#e0aaff'],
  surprised: ['#00f2fe', '#7928ca'],
  sad: ['#0072ff', '#00c6ff'],
  angry: ['#ff1744', '#ff5722'],
  love: ['#ff2a85', '#ff758c']
};

export const RGBBackground: React.FC<RGBBackgroundProps> = ({
  settings,
  currentEmotion,
  audioLevel
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    let time = 0;

    // Handle responsive resize
    const handleResize = () => {
      if (!canvas) return;
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    handleResize();
    window.addEventListener('resize', handleResize);

    // Floating particles
    const particles = Array.from({ length: 28 }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      radius: Math.random() * 2.5 + 1.2,
      vx: (Math.random() - 0.5) * 0.4,
      vy: -Math.random() * 0.6 - 0.2,
      alpha: Math.random() * 0.6 + 0.2
    }));

    const render = () => {
      const width = canvas.width;
      const height = canvas.height;
      time += 0.015 * settings.speed;

      // Base background fill
      ctx.fillStyle = '#07070e';
      ctx.fillRect(0, 0, width, height);

      let col1 = settings.primaryColor;
      let col2 = settings.secondaryColor;

      if (settings.mode === 'mood') {
        const palette = EMOTION_PALETTES[currentEmotion] || EMOTION_PALETTES.idle;
        col1 = palette[0];
        col2 = palette[1];
      }

      const pulseFactor = settings.mode === 'audio' 
        ? (1 + audioLevel * 1.8) 
        : (1 + audioLevel * 0.4);

      const effectiveBrightness = Math.min(1, settings.brightness * pulseFactor);

      if (settings.mode === 'rainbow') {
        const hue1 = (time * 40) % 360;
        const hue2 = (hue1 + 140) % 360;
        col1 = `hsl(${hue1}, 85%, 55%)`;
        col2 = `hsl(${hue2}, 90%, 55%)`;
      } else if (settings.mode === 'breathing') {
        const breath = (Math.sin(time * 2) + 1) * 0.5;
        const breathBrightness = (settings.brightness * 0.4) + (breath * settings.brightness * 0.6);
        ctx.globalAlpha = breathBrightness;
      }

      ctx.save();
      ctx.globalAlpha = effectiveBrightness;

      if (settings.mode === 'wave') {
        // Multi-point radial organic ambient blobs
        const cx1 = width * 0.5 + Math.sin(time * 1.2) * (width * 0.35);
        const cy1 = height * 0.4 + Math.cos(time * 0.9) * (height * 0.25);
        const grad1 = ctx.createRadialGradient(cx1, cy1, 10, cx1, cy1, width * 0.7);
        grad1.addColorStop(0, col1);
        grad1.addColorStop(1, 'transparent');
        ctx.fillStyle = grad1;
        ctx.fillRect(0, 0, width, height);

        const cx2 = width * 0.5 + Math.cos(time * 1.4) * (width * 0.3);
        const cy2 = height * 0.6 + Math.sin(time * 1.1) * (height * 0.2);
        const grad2 = ctx.createRadialGradient(cx2, cy2, 10, cx2, cy2, width * 0.65);
        grad2.addColorStop(0, col2);
        grad2.addColorStop(1, 'transparent');
        ctx.fillStyle = grad2;
        ctx.fillRect(0, 0, width, height);
      } else {
        // Center ambient aura
        const cx = width / 2;
        const cy = height * 0.45;
        const radius = Math.min(width, height) * (0.8 + audioLevel * 0.25);

        const gradient = ctx.createRadialGradient(cx, cy, 20, cx, cy, radius);
        gradient.addColorStop(0, col1);
        gradient.addColorStop(0.5, col2);
        gradient.addColorStop(1, 'transparent');

        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);
      }

      ctx.restore();

      // Render glowing floating particles
      if (settings.particles) {
        ctx.save();
        for (const p of particles) {
          p.x += p.vx * settings.speed;
          p.y += p.vy * settings.speed;

          if (p.y < 0) {
            p.y = height + 10;
            p.x = Math.random() * width;
          }
          if (p.x < 0) p.x = width;
          if (p.x > width) p.x = 0;

          const pAlpha = p.alpha * (0.6 + audioLevel * 0.4);
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius * (1 + audioLevel * 0.5), 0, Math.PI * 2);
          ctx.fillStyle = col1;
          ctx.globalAlpha = pAlpha;
          ctx.shadowBlur = 10 * settings.glowIntensity;
          ctx.shadowColor = col2;
          ctx.fill();
        }
        ctx.restore();
      }

      animationId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', handleResize);
    };
  }, [settings, currentEmotion, audioLevel]);

  // Determine current active glow color for the screen edge border
  const activeColor = settings.mode === 'mood'
    ? (EMOTION_PALETTES[currentEmotion]?.[0] || settings.primaryColor)
    : settings.primaryColor;

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden select-none z-0">
      <canvas ref={canvasRef} className="w-full h-full block" />

      {/* Screen edge neon border */}
      {settings.edgeBorder && (
        <div
          className="absolute inset-0 pointer-events-none transition-all duration-300"
          style={{
            boxShadow: `inset 0 0 ${20 * settings.glowIntensity}px ${activeColor}, inset 0 0 ${45 * settings.glowIntensity}px ${settings.secondaryColor}44`,
            border: `2px solid ${activeColor}88`
          }}
        />
      )}
    </div>
  );
};

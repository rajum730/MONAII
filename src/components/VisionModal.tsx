import React, { useState, useRef, useEffect } from 'react';
import { X, Camera, RefreshCw, Upload, Sparkles } from 'lucide-react';

interface VisionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSendVision: (imageBase64: string, prompt: string) => void;
  isProcessing: boolean;
}

export const VisionModal: React.FC<VisionModalProps> = ({
  isOpen,
  onClose,
  onSendVision,
  isProcessing
}) => {
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('Dekho ye kya hai, batao MONA!');
  const [cameraError, setCameraError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Start camera stream when open and no image captured yet
  useEffect(() => {
    if (!isOpen || capturedImage) return;

    let mounted = true;
    const startCam = async () => {
      try {
        setCameraError(null);
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(t => t.stop());
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } }
        });
        if (mounted) {
          streamRef.current = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
        }
      } catch (err: any) {
        if (mounted) {
          console.warn('Camera error:', err);
          setCameraError('Camera access blocked ya unavailable hai. Gallery se image upload kar sakte hain.');
        }
      }
    };

    startCam();

    return () => {
      mounted = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
    };
  }, [isOpen, facingMode, capturedImage]);

  if (!isOpen) return null;

  const handleCapture = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    setCapturedImage(dataUrl);

    // Stop live stream while reviewing
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  };

  const handleRetake = () => {
    setCapturedImage(null);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setCapturedImage(event.target.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSend = () => {
    if (!capturedImage) return;
    onSendVision(capturedImage, prompt);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
      <div className="w-full max-w-sm rounded-3xl glass-panel border border-white/10 overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-slate-900/60">
          <div className="flex items-center gap-2">
            <Camera className="w-5 h-5 text-emerald-400" />
            <h3 className="text-sm font-semibold text-white">MONA Vision (Dekho)</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Viewfinder / Preview */}
        <div className="relative aspect-[4/3] bg-black flex items-center justify-center overflow-hidden">
          {capturedImage ? (
            <img src={capturedImage} alt="Captured frame" className="w-full h-full object-cover" />
          ) : cameraError ? (
            <div className="p-6 text-center">
              <p className="text-xs text-rose-300">{cameraError}</p>
              <label className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/10 text-xs font-semibold text-white cursor-pointer hover:bg-white/20 transition">
                <Upload className="w-4 h-4" /> Gallery se photo chunein
                <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
              </label>
            </div>
          ) : (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
              {/* Camera Switcher */}
              <button
                onClick={() => setFacingMode(f => (f === 'environment' ? 'user' : 'environment'))}
                title="Switch Camera"
                className="absolute top-3 right-3 p-2 rounded-full bg-black/50 text-white backdrop-blur-md border border-white/20 active:scale-90 transition"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </>
          )}
        </div>

        {/* Controls & Prompt */}
        <div className="p-4 space-y-3 bg-slate-950/80">
          {!capturedImage ? (
            <div className="flex items-center justify-between gap-3">
              <label className="p-3 rounded-2xl bg-white/5 border border-white/10 text-slate-300 hover:text-white cursor-pointer active:scale-95 transition flex items-center justify-center">
                <Upload className="w-5 h-5" />
                <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
              </label>

              <button
                onClick={handleCapture}
                disabled={!!cameraError}
                className="flex-1 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2 active:scale-95 transition disabled:opacity-40"
              >
                <Camera className="w-5 h-5" /> Capture Karein
              </button>
            </div>
          ) : (
            <>
              <input
                type="text"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="MONA se kya poochna hai..."
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-emerald-400"
              />

              <div className="flex items-center gap-2">
                <button
                  onClick={handleRetake}
                  className="flex-1 py-2.5 rounded-xl bg-white/5 border border-white/10 text-slate-300 hover:text-white text-xs font-semibold"
                >
                  Retake
                </button>
                <button
                  onClick={handleSend}
                  disabled={isProcessing}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 hover:brightness-110 text-slate-950 text-xs font-bold shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-1.5 active:scale-95 transition disabled:opacity-50"
                >
                  <Sparkles className="w-4 h-4" /> {isProcessing ? 'Analyzing...' : 'Ask MONA'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

import React, { useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import {
  Play,
  Pause,
  Download,
  Scissors,
  Type as FontIcon,
  Image as ImageIcon,
  Sparkles,
  RefreshCw,
  Clock,
  Video,
  Upload,
  Plus,
  Trash2,
  Maximize2,
  AlertCircle,
  HelpCircle,
  FolderOpen,
  Sliders,
  ChevronRight,
  Info,
  Layers,
  Heart,
  Volume2,
  VolumeX,
  Link,
  Share2,
} from "lucide-react";

interface TextOverlay {
  id: string;
  text: string;
  color: string;
  bgColor: string;
  fontSize: number; // in px on canvas
  yPosition: number; // 0 - 100% height
  xPosition: number; // 0 - 100% width
  style: "flat" | "shadow" | "neon" | "badge";
  fontFamily?: string;
  strokeColor?: string;
  strokeWidth?: number;
  skewX?: number;
  textCase?: "original" | "uppercase" | "lowercase";
  animationType?: "none" | "pulse" | "bounce" | "shake" | "zoom" | "floating";
}

interface ImageOverlay {
  id: string;
  src: string; // Base64
  name: string;
  scale: number; // multiplier 0.1 to 2
  x: number; // opacity coordinate 0 - 100%
  y: number; // opacity coordinate 0 - 100%
}

export default function App() {
  // Video Source state
  const [streamUrl, setStreamUrl] = useState<string>(
    "https://stream.mux.com/v69ElvO9S012bNDWMg79DJTe7YFrbBEn9B3ST3f7Sg0100.m3u8"
  );
  const [isHlsActive, setIsHlsActive] = useState<boolean>(true);
  const [streamError, setStreamError] = useState<string | null>(null);

  // Video Playing State
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [duration, setDuration] = useState<number>(0);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [volume, setVolume] = useState<number>(0.8);
  const [isMuted, setIsMuted] = useState<boolean>(false);

  // Clipping / Slicing config
  const [clipStart, setClipStart] = useState<number>(0);
  const [clipDuration, setClipDuration] = useState<number>(15); // Default 15 seconds as requested

  // Canvas display positioning (Landscape to Portrait 9:16)
  const [viewportCrop, setViewportCrop] = useState<"cover" | "contain" | "fill">("cover");
  const [horizontalPan, setHorizontalPan] = useState<number>(50); // 0 (left) to 100 (right)

  // Overlay states
  const [textOverlays, setTextOverlays] = useState<TextOverlay[]>([
    {
      id: "text-1",
      text: "🔥 3 TIPS SUKSES BISNIS VIDEO",
      color: "#facc15",
      bgColor: "rgba(0,0,0,0.65)",
      fontSize: 24,
      yPosition: 15,
      xPosition: 50,
      style: "flat",
      fontFamily: "Luckiest Guy",
      strokeColor: "#000000",
      strokeWidth: 6,
      skewX: -5,
      textCase: "uppercase",
      animationType: "shake",
    },
    {
      id: "text-2",
      text: "Tonton sampai habis! ⏳",
      color: "#ffffff",
      bgColor: "rgb(79, 70, 229)",
      fontSize: 18,
      yPosition: 85,
      xPosition: 50,
      style: "badge",
      fontFamily: "Fredoka",
      strokeColor: "#1e1b4b",
      strokeWidth: 2,
      skewX: 0,
      textCase: "original",
      animationType: "pulse",
    },
  ]);

  const [imageOverlays, setImageOverlays] = useState<ImageOverlay[]>([]);
  const [selectedOverlayId, setSelectedOverlayId] = useState<string | null>("text-1");

  // Recording Engine states
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordProgress, setRecordProgress] = useState<number>(0);
  const [recordedVideoUrl, setRecordedUrl] = useState<string | null>(null);

  // Video Element Ref
  const videoRef = useRef<HTMLVideoElement | null>(null);
  // Canvas Ref
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  // HLS Manager
  const hlsRef = useRef<Hls | null>(null);
  // Dynamic rendering Loop
  const requestRef = useRef<number | null>(null);
  // For file Upload input
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  // For video file upload input
  const videoFileInputRef = useRef<HTMLInputElement | null>(null);
  const [isDraggingVideo, setIsDraggingVideo] = useState<boolean>(false);
  const [isParsingPinterest, setIsParsingPinterest] = useState<boolean>(false);
  const [activeModal, setActiveModal] = useState<"about" | "privacy" | "contact" | "disclaimer" | null>(null);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);

  // Sound FX System State
  const [selectedSound, setSelectedSound] = useState<string>("none");
  const [playSoundOnLoop, setPlaySoundOnLoop] = useState<boolean>(true);
  const lastSoundTriggerRef = useRef<number>(0);

  // Flexible Extra Video Sources State
  const [activeSourceType, setActiveSourceType] = useState<"direct" | "cloud" | "upload">("direct");
  const [cloudUrlInput, setCloudUrlInput] = useState<string>("");

  // Helper converter for Google Drive & Dropbox shared files to direct streaming format
  const convertSharedVideoUrl = (url: string): string => {
    if (!url) return "";
    let clean = url.trim();

    // 1. Google Drive Sharing Converter
    const driveMatch = clean.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || clean.match(/id=([a-zA-Z0-9_-]+)/);
    if (driveMatch && driveMatch[1]) {
      return `https://docs.google.com/uc?export=download&id=${driveMatch[1]}`;
    }

    // 2. Dropbox Direct Stream Converter
    if (clean.includes("dropbox.com")) {
      return clean.replace("www.dropbox.com", "dl.dropboxusercontent.com").replace("?dl=0", "").replace("&dl=0", "") + "?dl=1";
    }

    return clean;
  };
  
  // Interactive Pointer Drag System State
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const draggingOverlayIdRef = useRef<string | null>(null);

  // Video Voice/Sound Effects Filter State
  const [videoVoiceEffect, setVideoVoiceEffect] = useState<string>("original");
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);

  // References for Web Audio video routing
  const videoSourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);

  // Apply playback speed rate to video element
  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      video.playbackRate = playbackSpeed;
    }
  }, [playbackSpeed, isPlaying]);

  // Pointer event handlers on the Canvas Preview
  const handleCanvasPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const clickX = ((e.clientX - rect.left) / rect.width) * 100; // 0-100%
    const clickY = ((e.clientY - rect.top) / rect.height) * 100; // 0-100%

    let foundId: string | null = null;
    let minDist = 9999;

    // 1. Check if clicked near any image overlays first (Stickers)
    for (const img of imageOverlays) {
      const dx = Math.abs(img.x - clickX);
      const dy = Math.abs(img.y - clickY);
      if (dx < 12 && dy < 12) {
        const dist = dx + dy;
        if (dist < minDist) {
          minDist = dist;
          foundId = img.id;
        }
      }
    }

    // 2. Check if clicked near any text overlays
    if (!foundId) {
      for (const text of textOverlays) {
        const dx = Math.abs(text.xPosition - clickX);
        const dy = Math.abs(text.yPosition - clickY);
        if (dx < 25 && dy < 6) {
          const dist = dx + dy;
          if (dist < minDist) {
            minDist = dist;
            foundId = text.id;
          }
        }
      }
    }

    if (foundId) {
      setSelectedOverlayId(foundId);
      draggingOverlayIdRef.current = foundId;
      setIsDragging(true);
      if (e.currentTarget.setPointerCapture) {
        e.currentTarget.setPointerCapture(e.pointerId);
      }
      e.preventDefault();
    }
  };

  const handleCanvasPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDragging || !draggingOverlayIdRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const clickX = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    const clickY = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));

    const id = draggingOverlayIdRef.current;
    if (id.startsWith("text-")) {
      setTextOverlays((prev) =>
        prev.map((t) => (t.id === id ? { ...t, xPosition: Math.round(clickX), yPosition: Math.round(clickY) } : t))
      );
    } else if (id.startsWith("image-")) {
      setImageOverlays((prev) =>
        prev.map((img) => (img.id === id ? { ...img, x: Math.round(clickX), y: Math.round(clickY) } : img))
      );
    }
    e.preventDefault();
  };

  const handleCanvasPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    setIsDragging(false);
    draggingOverlayIdRef.current = null;
    if (e.currentTarget.releasePointerCapture) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  // Lazily initialized AudioContext ref
  const audioContextRef = useRef<AudioContext | null>(null);

  const getAudioContext = (): AudioContext => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (audioContextRef.current.state === "suspended") {
      audioContextRef.current.resume();
    }
    return audioContextRef.current;
  };

  const playSynthesizedSound = (ctx: AudioContext, dest: AudioNode, type: string) => {
    const now = ctx.currentTime;
    
    if (type === "coin") {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(587.33, now); // D5
      osc.frequency.setValueAtTime(880, now + 0.1); // A5
      
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      
      osc.connect(gain);
      gain.connect(dest);
      osc.start(now);
      osc.stop(now + 0.35);
    } else if (type === "swoosh") {
      const bufferSize = ctx.sampleRate * 0.4;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(100, now);
      filter.frequency.exponentialRampToValueAtTime(2500, now + 0.2);
      filter.frequency.exponentialRampToValueAtTime(100, now + 0.4);
      
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
      
      noise.connect(filter);
      filter.connect(gain);
      gain.connect(dest);
      noise.start(now);
      noise.stop(now + 0.4);
    } else if (type === "bell") {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(1200, now);
      
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
      
      osc.connect(gain);
      gain.connect(dest);
      osc.start(now);
      osc.stop(now + 0.8);
    } else if (type === "laser") {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(1500, now);
      osc.frequency.exponentialRampToValueAtTime(100, now + 0.25);
      
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      
      osc.connect(gain);
      gain.connect(dest);
      osc.start(now);
      osc.stop(now + 0.25);
    } else if (type === "pop") {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(200, now);
      osc.frequency.exponentialRampToValueAtTime(900, now + 0.08);
      
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
      
      osc.connect(gain);
      gain.connect(dest);
      osc.start(now);
      osc.stop(now + 0.1);
    } else if (type === "bass_drop") {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(120, now);
      osc.frequency.exponentialRampToValueAtTime(30, now + 0.8);
      
      gain.gain.setValueAtTime(0.4, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.82);
      
      osc.connect(gain);
      gain.connect(dest);
      osc.start(now);
      osc.stop(now + 0.82);
    } else if (type === "alarm") {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(600, now);
      osc.frequency.setValueAtTime(800, now + 0.08);
      osc.frequency.setValueAtTime(600, now + 0.16);
      osc.frequency.setValueAtTime(800, now + 0.24);
      
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      
      osc.connect(gain);
      gain.connect(dest);
      osc.start(now);
      osc.stop(now + 0.35);
    }
  };

  const playSoundEffect = (type: string) => {
    if (type === "none") return;
    try {
      const ctx = getAudioContext();
      playSynthesizedSound(ctx, ctx.destination, type);
    } catch (e) {
      console.warn("Gagal memainkan efek suara di browser:", e);
    }
  };

  const applyAudioEffectsToTrackOrElement = (audioCtx: AudioContext, sourceNode: AudioNode, destNode: AudioNode, effectType: string) => {
    const now = audioCtx.currentTime;
    
    if (effectType === "muffled") {
      const filter = audioCtx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(380, now);
      filter.Q.setValueAtTime(1.5, now);
      
      sourceNode.connect(filter);
      filter.connect(destNode);
      return filter;
    }
    
    if (effectType === "telephone") {
      const filter = audioCtx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.setValueAtTime(1200, now);
      filter.Q.setValueAtTime(2.0, now);
      
      const filter2 = audioCtx.createBiquadFilter();
      filter2.type = "peaking";
      filter2.frequency.setValueAtTime(3000, now);
      filter2.gain.setValueAtTime(6.0, now);
      
      sourceNode.connect(filter);
      filter.connect(filter2);
      filter2.connect(destNode);
      return filter2;
    }
    
    if (effectType === "echo") {
      const delay = audioCtx.createDelay(1.0);
      delay.delayTime.setValueAtTime(0.3, now);
      
      const feedback = audioCtx.createGain();
      feedback.gain.setValueAtTime(0.4, now);
      
      const dryGain = audioCtx.createGain();
      dryGain.gain.setValueAtTime(0.7, now);
      
      const wetGain = audioCtx.createGain();
      wetGain.gain.setValueAtTime(0.5, now);
      
      sourceNode.connect(dryGain);
      dryGain.connect(destNode);
      
      sourceNode.connect(delay);
      delay.connect(feedback);
      feedback.connect(delay);
      
      delay.connect(wetGain);
      wetGain.connect(destNode);
      return delay;
    }
    
    if (effectType === "robot") {
      const osc = audioCtx.createOscillator();
      const signalGain = audioCtx.createGain();
      signalGain.gain.setValueAtTime(0.5, now);
      
      osc.type = "sine";
      osc.frequency.setValueAtTime(150, now);
      
      osc.connect(signalGain.gain);
      osc.start(now);
      
      sourceNode.connect(signalGain);
      signalGain.connect(destNode);
      return signalGain;
    }
    
    sourceNode.connect(destNode);
    return null;
  };

  const hookVideoToAudioGraph = (effectType?: string) => {
    const video = videoRef.current;
    if (!video) return;
    try {
      const ctx = getAudioContext();
      if (!videoSourceNodeRef.current) {
        videoSourceNodeRef.current = ctx.createMediaElementSource(video);
      }
      
      videoSourceNodeRef.current.disconnect();
      
      const activeEffect = effectType || videoVoiceEffect;
      applyAudioEffectsToTrackOrElement(ctx, videoSourceNodeRef.current, ctx.destination, activeEffect);
    } catch (err) {
      console.warn("Could not route video audio real-time playback:", err);
    }
  };

  // List of standard Open-source testing HLS and MP4 streams (Guaranteed CORS-enabled)
  const previewStreams = [
    {
      name: "🚀 Live Mux Video (HLS)",
      url: "https://stream.mux.com/v69ElvO9S012bNDWMg79DJTe7YFrbBEn9B3ST3f7Sg0100.m3u8",
    },
    {
      name: "🐰 Classic Bunny (HLS)",
      url: "https://test-streams.mux.dev/x36xhgc/x36xhgc.m3u8",
    },
    {
      name: "🌌 Cosmic Nebula (MP4)",
      url: "https://assets.mixkit.co/videos/preview/mixkit-stars-in-space-background-1611-large.mp4",
    },
    {
      name: "🏙️ Night City Lights (MP4)",
      url: "https://assets.mixkit.co/videos/preview/mixkit-light-leaks-of-moving-city-lights-34351-large.mp4",
    },
  ];

  // Initialize and load Video Streams
  useEffect(() => {
    initVideoSource();
    return () => {
      destroyHls();
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [streamUrl]);

  const destroyHls = () => {
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
  };

  const initVideoSource = () => {
    const video = videoRef.current;
    if (!video) return;

    // Guide if they paste a YouTube URL unexpectedly
    if (streamUrl && (streamUrl.includes("youtube.com") || streamUrl.includes("youtu.be"))) {
      setStreamError("Pembatasan CORS YouTube: Maaf, video YouTube dilindungi dan tidak mendukung pemrosesan frame video di Canvas. Silakan gunakan Direct Link (.mp4/.m3u8) atau File Lokal.");
      return;
    }

    // Guide & auto-route if they paste a Pinterest URL unexpectedly
    if (streamUrl && (streamUrl.includes("pinterest.com") || streamUrl.includes("pin.it"))) {
      setActiveSourceType("cloud");
      setCloudUrlInput(streamUrl);
      setTimeout(() => {
        handleCloudOrPinterestSubmit(streamUrl);
      }, 50);
      return;
    }

    destroyHls();
    setStreamError(null);
    setIsPlaying(false);

    // Detect if this is an m3u8 file
    const isM3U8 = streamUrl.includes(".m3u8") || streamUrl.includes("manifest");
    setIsHlsActive(isM3U8);

    if (isM3U8) {
      if (Hls.isSupported()) {
        const hls = new Hls({
          maxMaxBufferLength: 10,
          enableWorker: true,
        });
        hlsRef.current = hls;
        hls.loadSource(streamUrl);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          setDuration(video.duration || 0);
          // Let's set start time
          video.currentTime = clipStart;
        });
        hls.on(Hls.Events.ERROR, (event, data) => {
          if (data.fatal) {
            console.error("Fatal HLS error:", data);
            setStreamError(`Gagal memuat HLS stream (${data.type}). Pastikan URL benar atau tidak terkendala CORS.`);
          }
        });
      } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
        // Native support (Safari)
        video.src = streamUrl;
        video.addEventListener("loadedmetadata", () => {
          setDuration(video.duration || 0);
          video.currentTime = clipStart;
        });
      } else {
        setStreamError("Browser Anda tidak mendukung pemutaran HLS (.m3u8) langsung secara client-side.");
      }
    } else {
      // Direct asset media format (mp4 / webm)
      video.src = streamUrl;
      video.load();
      video.addEventListener("loadedmetadata", () => {
        setDuration(video.duration || 0);
        video.currentTime = clipStart;
      });
      video.addEventListener("error", () => {
        setStreamError("Gagal memuat video. Silakan periksa format file (.mp4, .webm, dll) atau URL Anda.");
      });
    }
  };

  // Keep drawing on canvas whenever video is playing or modified
  useEffect(() => {
    const renderLoop = () => {
      drawCanvas();
      if (videoRef.current) {
        setCurrentTime(videoRef.current.currentTime);

        // Keep loop inside custom slice bounds
        const segmentEnd = clipStart + clipDuration;
        if (videoRef.current.currentTime >= segmentEnd && isPlaying && !isRecording) {
          videoRef.current.currentTime = clipStart;
          const nowMs = Date.now();
          if (nowMs - lastSoundTriggerRef.current > 800) {
            lastSoundTriggerRef.current = nowMs;
            if (selectedSound !== "none" && playSoundOnLoop) {
              playSoundEffect(selectedSound);
            }
          }
        }
      }
      requestRef.current = requestAnimationFrame(renderLoop);
    };

    requestRef.current = requestAnimationFrame(renderLoop);
    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [textOverlays, imageOverlays, viewportCrop, horizontalPan, clipStart, clipDuration, isPlaying, isRecording]);

  const drawCanvas = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clear Screen
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Wait until video has proper metadata
    if (video.readyState < 2) {
      // Loading screen
      ctx.fillStyle = "#121214";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = "#ffffff";
      ctx.font = 'bold 16px "Inter", sans-serif';
      ctx.textAlign = "center";
      ctx.fillText("LOADING VIDEO STREAM...", canvas.width / 2, canvas.height / 2 - 20);

      ctx.font = '12px "Inter", sans-serif';
      ctx.fillStyle = "#71717a";
      ctx.fillText("Mempersiapkan Hls.js segment buffer...", canvas.width / 2, canvas.height / 2 + 10);
      return;
    }

    // 1. Draw Video Frame (9:16 target canvas context)
    const cw = canvas.width;
    const ch = canvas.height;
    const vw = video.videoWidth;
    const vh = video.videoHeight;

    if (viewportCrop === "cover") {
      // Crop landscape video into vertical 9:16 (Scale-to-cover)
      const scale = Math.max(cw / vw, ch / vh);
      const nw = vw * scale;
      const nh = vh * scale;

      // Panning offset calculations (Horizontal scrolling with limit)
      const maxDx = nw - cw;
      const dx = -maxDx * (horizontalPan / 100);
      const dy = (ch - nh) / 2;

      ctx.drawImage(video, dx, dy, nw, nh);
    } else if (viewportCrop === "contain") {
      // Fits entire video inside, leaving letterbox background
      ctx.fillStyle = "#09090b";
      ctx.fillRect(0, 0, cw, ch);

      const scale = Math.min(cw / vw, ch / vh);
      const nw = vw * scale;
      const nh = vh * scale;
      const dx = (cw - nw) / 2;
      const dy = (ch - nh) / 2;

      ctx.drawImage(video, dx, dy, nw, nh);
    } else {
      // Force Stretch (fill)
      ctx.drawImage(video, 0, 0, cw, ch);
    }

    // 2. Render Image Watermark/Stickers
    imageOverlays.forEach((imgOverlay) => {
      const img = new Image();
      img.src = imgOverlay.src;
      // We assume it's preloaded as it's a Base64 dataURL
      if (img.complete) {
        const iw = img.width * imgOverlay.scale;
        const ih = img.height * imgOverlay.scale;
        const ix = (imgOverlay.x / 100) * cw - iw / 2;
        const iy = (imgOverlay.y / 100) * ch - ih / 2;

        ctx.drawImage(img, ix, iy, iw, ih);

        // Draw highlight if selected
        if (selectedOverlayId === imgOverlay.id) {
          ctx.strokeStyle = "#10b981";
          ctx.lineWidth = 2;
          ctx.strokeRect(ix - 4, iy - 4, iw + 8, ih + 8);

          ctx.fillStyle = "#10b981";
          ctx.fillRect(ix - 6, iy - 6, 8, 8);
          ctx.fillRect(ix + iw - 2, iy + ih - 2, 8, 8);
        }
      }
    });

    // 3. Render Custom Text Overlays
    textOverlays.forEach((to) => {
      ctx.save();

      const tx = (to.xPosition / 100) * cw;
      const ty = (to.yPosition / 100) * ch;

      // Determine text case transform raw
      let displayText = to.text || "";
      if (to.textCase === "uppercase") {
        displayText = displayText.toUpperCase();
      } else if (to.textCase === "lowercase") {
        displayText = displayText.toLowerCase();
      }

      // Configure font family, weight, and size
      const fFamily = to.fontFamily || "Inter";
      ctx.font = `bold ${to.fontSize}px "${fFamily}", "Inter", "Helvetica Neue", Arial, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      // Wrap text helper to handle long texts and break lines automatically
      const maxTextW = cw * 0.88; // 88% of canvas width max
      const getWrappedLines = (textStr: string, maxW: number) => {
        const words = textStr.split(/\s+/);
        const linesArr: string[] = [];
        let currentLine = words[0] || "";

        for (let i = 1; i < words.length; i++) {
          const w = words[i];
          const testLine = currentLine + " " + w;
          const testW = ctx.measureText(testLine).width;
          if (testW < maxW) {
            currentLine = testLine;
          } else {
            linesArr.push(currentLine);
            currentLine = w;
          }
        }
        if (currentLine) linesArr.push(currentLine);
        return linesArr;
      };

      const lines = getWrappedLines(displayText, maxTextW);
      const lineHeight = to.fontSize * 1.25;
      const totalTextHeight = lines.length * lineHeight;

      // Compute max display width across all wrapped lines
      let maxLineWidth = 0;
      lines.forEach((line) => {
        const w = ctx.measureText(line).width;
        if (w > maxLineWidth) maxLineWidth = w;
      });

      // Calculate time-based animations and motion offsets
      const now = performance.now() / 1000;
      let animScale = 1;
      let animOffsetX = 0;
      let animOffsetY = 0;
      let animRotation = 0;
      const anim = to.animationType || "none";

      if (anim === "pulse") {
        animScale = 1 + Math.sin(now * 6.5) * 0.08;
      } else if (anim === "bounce") {
        animOffsetY = Math.sin(now * 5.5) * (to.fontSize * 0.35);
      } else if (anim === "shake") {
        animRotation = Math.sin(now * 30) * 0.045;
        animOffsetX = Math.cos(now * 26) * 3;
        animOffsetY = Math.sin(now * 32) * 3;
      } else if (anim === "zoom") {
        animScale = 1 + Math.abs(Math.sin(now * 4)) * 0.15;
      } else if (anim === "floating") {
        animRotation = Math.sin(now * 3) * 0.03;
        animOffsetY = Math.cos(now * 2.5) * (to.fontSize * 0.15);
        animOffsetX = Math.sin(now * 2) * (to.fontSize * 0.1);
      }

      // Apply transformations centered at (tx, ty)
      ctx.translate(tx + animOffsetX, ty + animOffsetY);
      ctx.scale(animScale, animScale);
      if (animRotation !== 0) {
        ctx.rotate(animRotation);
      }

      // Apply skew/slant if requested
      if (to.skewX && to.skewX !== 0) {
        const skewRad = (to.skewX * Math.PI) / 180;
        ctx.transform(1, 0, Math.tan(skewRad), 1, 0, 0);
      }

      // 1. Draw background/badge if requested
      if (to.style === "badge") {
        ctx.fillStyle = to.bgColor || "rgba(0,0,0,0.6)";
        const px = 14;
        const py = 8;
        ctx.beginPath();
        ctx.roundRect(
          -maxLineWidth / 2 - px,
          -totalTextHeight / 2 - py,
          maxLineWidth + px * 2,
          totalTextHeight + py * 2,
          10
        );
        ctx.fill();
      }

      // 2. Draw shadow parameters
      if (to.style === "shadow") {
        ctx.shadowColor = "rgba(0, 0, 0, 0.9)";
        ctx.shadowBlur = 8;
        ctx.shadowOffsetX = 3;
        ctx.shadowOffsetY = 3;
      }

      // 3. Neon glowing style
      if (to.style === "neon") {
        ctx.shadowColor = to.color || "#ffffff";
        ctx.shadowBlur = 14 + (anim === "pulse" ? Math.sin(now * 8) * 4 : 0);
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;

        ctx.fillStyle = "#ffffff";
        lines.forEach((line, i) => {
          const lineY = (i - (lines.length - 1) / 2) * lineHeight;
          ctx.fillText(line, 0, lineY);
        });
      }

      // 4. Render outline strokes (with nice rounding)
      if (to.strokeWidth && to.strokeWidth > 0) {
        ctx.strokeStyle = to.strokeColor || "#000000";
        ctx.lineWidth = to.strokeWidth;
        ctx.lineJoin = "round";
        ctx.miterLimit = 2;

        lines.forEach((line, i) => {
          const lineY = (i - (lines.length - 1) / 2) * lineHeight;
          ctx.strokeText(line, 0, lineY);
        });
      }

      // 5. Fill main text body colors
      ctx.fillStyle = to.color || "#ffffff";
      lines.forEach((line, i) => {
        const lineY = (i - (lines.length - 1) / 2) * lineHeight;
        ctx.fillText(line, 0, lineY);
      });

      ctx.restore();

      // Highlight container outline if selected
      if (selectedOverlayId === to.id) {
        ctx.save();
        ctx.translate(tx + animOffsetX, ty + animOffsetY);
        if (animRotation !== 0) {
          ctx.rotate(animRotation);
        }

        ctx.strokeStyle = "#3b82f6";
        ctx.lineWidth = 1.5;
        const px = 10;
        const py = 6;
        ctx.strokeRect(
          -maxLineWidth / 2 - px,
          -totalTextHeight / 2 - py,
          maxLineWidth + px * 2,
          totalTextHeight + py * 2
        );

        ctx.fillStyle = "#3b82f6";
        ctx.beginPath();
        ctx.arc(0, 0, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    });
  };

  // Playback control toggle
  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.pause();
      setIsPlaying(false);
    } else {
      // Force start within range
      if (video.currentTime < clipStart || video.currentTime >= clipStart + clipDuration) {
        video.currentTime = clipStart;
      }
      
      // Hook Web Audio API Graph to current video playback
      hookVideoToAudioGraph();

      video.play().then(() => {
        setIsPlaying(true);
        const nowMs = Date.now();
        lastSoundTriggerRef.current = nowMs;
        if (selectedSound !== "none") {
          playSoundEffect(selectedSound);
        }
      }).catch((err) => {
        console.warn("Autoplay block:", err);
      });
    }
  };

  // Seek time handler
  const handleSeekChange = (time: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = time;
    setCurrentTime(time);
  };

  // Volume handler
  const handleVolumeChange = (v: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.volume = v;
    setVolume(v);
    setIsMuted(v === 0);
  };

  const toggleMuted = () => {
    const video = videoRef.current;
    if (!video) return;
    const nextMute = !isMuted;
    video.muted = nextMute;
    setIsMuted(nextMute);
  };

  // Adding Custom Text Track
  const addNewTextTrack = () => {
    const id = "text-" + Date.now();
    const newTrack: TextOverlay = {
      id,
      text: "Teks Baru - 15 Detik ✨",
      color: "#ffffff",
      bgColor: "rgba(0,0,0,0.6)",
      fontSize: 20,
      yPosition: Math.floor(Math.random() * 50) + 20,
      xPosition: 50,
      style: "shadow",
      animationType: "none",
    };
    setTextOverlays([...textOverlays, newTrack]);
    setSelectedOverlayId(id);
  };

  // Editing Selected Text overlay properties
  const updateSelectedText = (updates: Partial<TextOverlay>) => {
    setTextOverlays(
      textOverlays.map((t) => (t.id === selectedOverlayId ? { ...t, ...updates } : t))
    );
  };

  // Editing Selected Image overlay properties
  const updateSelectedImage = (updates: Partial<ImageOverlay>) => {
    setImageOverlays(
      imageOverlays.map((img) => (img.id === selectedOverlayId ? { ...img, ...updates } : img))
    );
  };

  // Delete active overlay track
  const deleteActiveOverlay = () => {
    if (!selectedOverlayId) return;
    setTextOverlays(textOverlays.filter((t) => t.id !== selectedOverlayId));
    setImageOverlays(imageOverlays.filter((i) => i.id !== selectedOverlayId));
    setSelectedOverlayId(null);
  };

  // Image upload handler
  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target?.result as string;
      const id = "image-" + Date.now();
      const newImg: ImageOverlay = {
        id,
        src: base64,
        name: file.name,
        scale: 0.5,
        x: 50,
        y: 50,
      };
      setImageOverlays([...imageOverlays, newImg]);
      setSelectedOverlayId(id);
    };
    reader.readAsDataURL(file);
  };

  // Local video file upload handlers
  const handleVideoFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      loadVideoFile(file);
    }
  };

  const loadVideoFile = (file: File) => {
    if (!file.type.startsWith("video/")) {
      setStreamError("Berkas yang dipilih bukan berkas video yang valid. Silakan pilih berkas MP4, MOV, atau WEBM.");
      return;
    }
    const url = URL.createObjectURL(file);
    setStreamUrl(url);
    setStreamError(null);
  };

  const handleVideoDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingVideo(true);
  };

  const handleVideoDragLeave = () => {
    setIsDraggingVideo(false);
  };

  const handleVideoDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingVideo(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      loadVideoFile(file);
    }
  };

  // Automated parser and CORS proxy workflow for cloud and Pinterest video links
  const handleCloudOrPinterestSubmit = async (urlStr: string) => {
    if (!urlStr) return;
    const trimmed = urlStr.trim();

    // Check if it is a Pinterest link
    if (trimmed.includes("pinterest.com") || trimmed.includes("pin.it")) {
      setIsParsingPinterest(true);
      setStreamError(null);
      try {
        const res = await fetch(`/api/pinterest-parser?url=${encodeURIComponent(trimmed)}`);
        const json = await res.json();
        
        if (json.success && json.proxiedUrl) {
          setStreamUrl(json.proxiedUrl);
          setStreamError(null);
        } else {
          setStreamError(json.error || "Gagal mengekstrak video dari Pinterest.");
        }
      } catch (err: any) {
        console.error("Failed to parse Pinterest video", err);
        setStreamError(`Koneksi error saat mengekstrak Pinterest: ${err.message}`);
      } finally {
        setIsParsingPinterest(false);
      }
      return;
    }

    // Google Drive, Dropbox, or any direct URL
    const directUrl = convertSharedVideoUrl(trimmed);
    
    // Check if it's Pinterest direct media server (pinimg.com) that might be protected by CORS
    let finalUrl = directUrl;
    if (directUrl.includes("pinimg.com")) {
      finalUrl = `/api/proxy-video?url=${encodeURIComponent(directUrl)}`;
    }
    
    setStreamUrl(finalUrl);
    setStreamError(null);
  };

  // TRIGGER REAL-TIME RECORDING EXPORTER (Canvas Capture API)
  const startCanvasRecording = async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    // Pause first is ideal to align timelines
    video.pause();
    setIsPlaying(false);

    // Set timeline start point
    video.currentTime = clipStart;
    setCurrentTime(clipStart);

    // Give a promise timeout to ensure buffer gets drawn once at startTime
    await new Promise((r) => setTimeout(r, 600));

    // Capture dynamic stream (30 fps) up with audio track if applicable
    const canvasStream = canvas.captureStream(30);

    // Try capturing audio from original stream
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const dest = audioCtx.createMediaStreamDestination();
    let hasAudio = false;

    try {
      if ((video as any).captureStream) {
        // Source node from video
        const videoStream = (video as any).captureStream();
        const audioTracks = videoStream.getAudioTracks();
        if (audioTracks.length > 0) {
          const source = audioCtx.createMediaStreamSource(videoStream);
          // Pipe the source through our active audio effects processor to the recorder destination
          applyAudioEffectsToTrackOrElement(audioCtx, source, dest, videoVoiceEffect);
          
          // Combine audio with canvas stream
          canvasStream.addTrack(dest.stream.getAudioTracks()[0]);
          hasAudio = true;
        }
      }
    } catch (e) {
      console.warn("Could not capture direct video audio tracks due to cross-origin limitations:", e);
    }

    // ALWAYS ensure the audio destination track is attached to canvasStream if a sound effect is active and not already added
    if (!hasAudio && selectedSound !== "none") {
      try {
        const customAudioTracks = dest.stream.getAudioTracks();
        if (customAudioTracks.length > 0) {
          canvasStream.addTrack(customAudioTracks[0]);
          hasAudio = true;
        }
      } catch (err) {
        console.warn("Gagal menyisipkan track audio efek suara buatan:", err);
      }
    }

    // Initialize MediaRecorder
    // Fallback order: standard VP9, standard VP8, standard default webm
    let options = { mimeType: "video/webm;codecs=vp9" };
    if (!MediaRecorder.isTypeSupported(options.mimeType)) {
      options = { mimeType: "video/webm;codecs=vp8" };
    }
    if (!MediaRecorder.isTypeSupported(options.mimeType)) {
      options = { mimeType: "video/webm" };
    }

    const recordedChunks: Blob[] = [];
    const mediaRecorder = new MediaRecorder(canvasStream, options);

    mediaRecorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        recordedChunks.push(e.data);
      }
    };

    // Callback on stop recording
    mediaRecorder.onstop = () => {
      const blob = new Blob(recordedChunks, { type: "video/webm" });
      const outputUrl = URL.createObjectURL(blob);
      setRecordedUrl(outputUrl);
      setIsRecording(false);
      setRecordProgress(100);
      video.pause();
      setIsPlaying(false);
    };

    // Begin Playback & Recording session concurrently
    setIsRecording(true);
    setRecordedUrl(null);
    setRecordProgress(0);

    // Play selected sound effect in the recording audioContext destination!
    if (selectedSound !== "none") {
      try {
        playSynthesizedSound(audioCtx, dest, selectedSound);
      } catch (err) {
        console.warn("Gagal memainkan efek suara ke recoding track:", err);
      }
    }

    mediaRecorder.start();

    video.play();
    setIsPlaying(true);

    const checkInterval = 100; // monitor each 100ms
    const totalDurationMs = clipDuration * 1000;
    let elapsedMs = 0;

    const progressTimer = setInterval(() => {
      elapsedMs += checkInterval;
      const pct = Math.min((elapsedMs / totalDurationMs) * 100, 99);
      setRecordProgress(Math.floor(pct));

      // Cut exactly at clipDuration end point
      if (elapsedMs >= totalDurationMs) {
        clearInterval(progressTimer);
        mediaRecorder.stop();
      }
    }, checkInterval);
  };

  // Generate automated AI captions from Gemini API
  const handleAiStoryboardSuggestion = async () => {
    try {
      setStreamError(null);
      const prompt = "Berikan saya 15 detik caption viral bertema sukses muda";
      
      const payload = {
        prompt: "Buatkan rangkaian frame, visualisasi, dan caption media sosial bertema promosi viral berkelas",
        vibe: "energetic & premium",
        category: "Promosi",
      };

      const res = await fetch("/api/gemini/storyboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error("Gagal terhubung dengan server Gemini API");
      }

      const data = await res.json();
      if (data && data.frames && data.frames.length > 0) {
        // Map data.frames to our overlays dynamically
        const firstFrame = data.frames[0];
        const secondFrame = data.frames[1] || data.frames[0];

        setTextOverlays([
          {
            id: "text-1",
            text: `🔥 ${data.videoTitle || "VIRAL SHORTS"}`,
            color: "#facc15",
            bgColor: "rgba(0,0,0,0.7)",
            fontSize: 22,
            yPosition: 15,
            xPosition: 50,
            style: "neon",
          },
          {
            id: "text-2",
            text: firstFrame.captionText || "Belajar edit video 15 detik!",
            color: "#ffffff",
            bgColor: "rgba(16,185,129,0.9)",
            fontSize: 18,
            yPosition: 80,
            xPosition: 50,
            style: "badge",
          }
        ]);
      }
    } catch (err: any) {
      console.warn("AI help could not be compiled:", err.message);
      // Fallback with custom preset values
      setTextOverlays([
        {
          id: "text-1",
          text: "🚀 STRATEGI VIRAL 15 DETIK",
          color: "#f87171",
          bgColor: "rgba(0,0,0,0.8)",
          fontSize: 24,
          yPosition: 20,
          xPosition: 50,
          style: "neon",
        },
        {
          id: "text-2",
          text: "Klik Tombol Klik Download di Bawah 👇",
          color: "#34d399",
          bgColor: "rgba(0,0,0,0.6)",
          fontSize: 17,
          yPosition: 85,
          xPosition: 50,
          style: "badge",
        },
      ]);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans select-none selection:bg-emerald-500/20 selection:text-emerald-400">
      
      {/* Top Professional Navigation Header */}
      <header className="border-b border-zinc-900 bg-zinc-950/80 backdrop-blur-md sticky top-0 z-50 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-emerald-500 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/15">
            <Video className="w-5 h-5 text-zinc-950 stroke-[2.5]" />
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight text-white flex items-center gap-2">
              HLS 15s Frame Master
              <span className="text-[10px] bg-emerald-500/10 text-emerald-400 font-semibold border border-emerald-500/20 px-1.5 py-0.5 rounded-md">
                v2.0 PRO
              </span>
            </h1>
            <p className="text-[11px] text-zinc-400 font-medium">m3u8 Stream Slicer & Real-time Overlay Renderer</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Main Navigation Links */}
          <nav className="hidden sm:flex items-center gap-4 text-xs font-bold text-zinc-400">
            <button
              onClick={() => setActiveModal("about")}
              className="hover:text-emerald-400 transition cursor-pointer"
            >
              About
            </button>
            <button
              onClick={() => setActiveModal("privacy")}
              className="hover:text-emerald-400 transition cursor-pointer"
            >
              Privacy Policy
            </button>
            <button
              onClick={() => setActiveModal("contact")}
              className="hover:text-emerald-400 transition cursor-pointer"
            >
              Contact
            </button>
            <button
              onClick={() => setActiveModal("disclaimer")}
              className="hover:text-emerald-400 transition cursor-pointer"
            >
              Disclaimer
            </button>
          </nav>

          <div className="h-4 w-px bg-zinc-800 hidden sm:block" />

          {/* Quick AI Assist Generator */}
          <button
            onClick={handleAiStoryboardSuggestion}
            className="hidden md:flex items-center gap-2 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-indigo-600/15 border border-indigo-500/20 active:scale-95 transition-all cursor-pointer"
            title="Gunakan algoritma AI Gemini untuk menyusun teks estetika kreatif"
          >
            <Sparkles className="w-3.5 h-3.5 text-yellow-300" />
            Optimasi Teks AI
          </button>
          
          <a
            href="https://github.com"
            target="_blank"
            className="text-xs text-zinc-500 hover:text-zinc-300 hidden lg:inline-flex items-center gap-1 font-mono"
            rel="noreferrer"
          >
            <Info className="w-3.5 h-3.5" /> m3u8 Editor
          </a>
        </div>
      </header>

      {/* Main Grid Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* LEFT COLUMN: Input form, timing controls, layers editor (8 cols on lg) */}
        <section className="lg:col-span-7 flex flex-col gap-6 font-sans">
          
          {/* 1. SOURCE SELECTOR & MULTI-INPUT WORKSPACE */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5 shadow-xl flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-zinc-850 pb-3">
              <label className="text-sm font-bold text-white flex items-center gap-2">
                <FolderOpen className="w-4.5 h-4.5 text-emerald-400" />
                Input Sumber & Ragam Video Kreatif
              </label>
              <span className="text-[10px] text-zinc-400 bg-zinc-950 px-2 py-0.5 rounded border border-zinc-850 font-mono uppercase tracking-wider">
                {isHlsActive ? "⚡ HLS (m3u8)" : "📹 MP4 / WEB VIDEO"}
              </span>
            </div>

            {/* Source selector Tab Buttons */}
            <div className="grid grid-cols-3 gap-1 p-1 bg-zinc-950 rounded-2xl border border-zinc-850">
              <button
                type="button"
                onClick={() => setActiveSourceType("direct")}
                className={`flex flex-col sm:flex-row items-center gap-1.5 py-2 px-2.5 rounded-xl text-center justify-center transition-all cursor-pointer ${
                  activeSourceType === "direct"
                    ? "bg-zinc-900 text-emerald-400 font-bold border border-zinc-800"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                <Link className="w-3.5 h-3.5" />
                <span className="text-[11px] font-semibold">Direct Link</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveSourceType("cloud")}
                className={`flex flex-col sm:flex-row items-center gap-1.5 py-2 px-2.5 rounded-xl text-center justify-center transition-all cursor-pointer ${
                  activeSourceType === "cloud"
                    ? "bg-indigo-950/40 text-indigo-400 font-bold border border-indigo-900/40"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                <Share2 className="w-3.5 h-3.5 text-indigo-400" />
                <span className="text-[11px] font-semibold">Cloud Drive</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveSourceType("upload")}
                className={`flex flex-col sm:flex-row items-center gap-1.5 py-2 px-2.5 rounded-xl text-center justify-center transition-all cursor-pointer ${
                  activeSourceType === "upload"
                    ? "bg-emerald-950/40 text-emerald-400 font-bold border border-emerald-900/40"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                <Upload className="w-3.5 h-3.5" />
                <span className="text-[11px] font-semibold">File Lokal</span>
              </button>
            </div>

            {/* TAB CONTENT: 1. Direct URL */}
            {activeSourceType === "direct" && (
              <div className="flex flex-col gap-3">
                <p className="text-[11px] text-zinc-400">
                  Tempel URL streaming video bebas CORS berformat <code className="text-emerald-400 font-mono">.m3u8 (HLS)</code> atau <code className="text-emerald-400 font-mono">.mp4 / .webm</code> langsung untuk disunting.
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={streamUrl}
                    onChange={(e) => setStreamUrl(e.target.value)}
                    placeholder="Contoh: https://domain.com/video.mp4 atau playlist.m3u8"
                    className="flex-1 bg-zinc-950 px-4 py-2.5 rounded-2xl border border-zinc-800 text-zinc-100 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono"
                  />
                  <button
                    onClick={initVideoSource}
                    className="bg-zinc-850 hover:bg-zinc-800 text-white px-3.5 rounded-2xl border border-zinc-700 transition active:scale-95 flex items-center justify-center cursor-pointer"
                    title="Muat Sumber Video"
                  >
                    <RefreshCw className="w-4 h-4 text-emerald-400" />
                  </button>
                </div>

                {/* Quick Presets list */}
                <div className="flex flex-col gap-1.5 mt-1">
                  <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">
                    Rekomendasi preset video stream bebas CORS:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {previewStreams.map((ps, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          setStreamUrl(ps.url);
                        }}
                        className={`text-[10px] px-2.5 py-1.5 rounded-xl font-medium transition border text-left cursor-pointer ${
                          streamUrl === ps.url
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                            : "bg-zinc-950 text-zinc-400 border-zinc-850 hover:bg-zinc-900"
                        }`}
                      >
                        {ps.name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* TAB CONTENT: 3. Cloud Storage & Pinterest Link Extractor */}
            {activeSourceType === "cloud" && (
              <div className="flex flex-col gap-3">
                <p className="text-[11px] text-zinc-400 leading-relaxed">
                  Gunakan video dari <strong>Google Drive</strong>, <strong>Dropbox</strong>, atau <strong>Pinterest Video Pin</strong>! Tempelkan tautan halaman web Pin Pinterest (<code className="text-zinc-300 font-mono">pin.it</code> / <code className="text-zinc-300 font-mono">pinterest.com/pin/...</code>) di bawah ini, dan server pintar kami akan otomatis mengekstrak &amp; mem-bypass CORS untuk streaming instan ke kanvas editor!
                </p>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={cloudUrlInput}
                    onChange={(e) => setCloudUrlInput(e.target.value)}
                    disabled={isParsingPinterest}
                    placeholder="Tempel link bagikan Google Drive, Dropbox, atau Link Pin Pinterest..."
                    className="flex-1 bg-zinc-950 px-4 py-2.5 rounded-2xl border border-zinc-800 text-zinc-100 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono disabled:opacity-50"
                  />
                  <button
                    onClick={() => handleCloudOrPinterestSubmit(cloudUrlInput)}
                    disabled={isParsingPinterest || !cloudUrlInput}
                    className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-950/40 disabled:text-indigo-600/40 text-white px-4 rounded-2xl transition active:scale-95 text-xs font-bold cursor-pointer flex items-center gap-1.5 min-w-[130px] justify-center"
                  >
                    {isParsingPinterest ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Mengekstrak...</span>
                      </>
                    ) : (
                      <>
                        <span>Konversi & Putar ⚡</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-850 flex flex-col gap-2 text-[10px] text-zinc-500">
                  <span className="font-bold text-zinc-400 flex items-center gap-1">💡 Cara Menggunakan Link:</span>
                  <p><strong>Pinterest Video:</strong> Salin tautan halaman Pin berkas video Pinterest (contoh: <code className="text-zinc-400">https://pin.it/XXXXXX</code> atau <code className="text-zinc-400">pinterest.com/pin/...</code>), tempel di atas dan klik <strong>Konversi & Putar</strong>. Sistem otomatis menarik dan membuka proteksi CORS media!</p>
                  <p><strong>Google Drive:</strong> Bagikan &rarr; Ubah akses menjadi &quot;Siapa saja yang memiliki link&quot; &rarr; Salin Link.</p>
                  <p><strong>Dropbox:</strong> Klik Bagikan &rarr; Buat tautan &rarr; Salin Tautan berkas.</p>
                </div>
              </div>
            )}

            {/* TAB CONTENT: 4. Local File Upload */}
            {activeSourceType === "upload" && (
              <div className="flex flex-col gap-3">
                <p className="text-[11px] text-zinc-400">
                  Unggah berkas video lokal berformat <code className="text-emerald-400">.mp4</code>, <code className="text-emerald-400">.mov</code>, atau <code className="text-emerald-400">.webm</code> langsung dari media penyimpanan komputer atau smartphone Anda.
                </p>

                <div
                  onClick={() => videoFileInputRef.current?.click()}
                  onDragOver={handleVideoDragOver}
                  onDragLeave={handleVideoDragLeave}
                  onDrop={handleVideoDrop}
                  className={`bg-zinc-950 border-2 border-dashed py-8 rounded-2xl flex flex-col items-center justify-center gap-2.5 cursor-pointer group transition-all duration-200 ${
                    isDraggingVideo
                      ? "border-emerald-500 bg-emerald-950/20 shadow-lg shadow-emerald-500/5 scale-[0.99]"
                      : "border-zinc-800 hover:border-emerald-500/50 hover:bg-zinc-900/10"
                  }`}
                >
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center border transition-all duration-300 ${
                    isDraggingVideo
                      ? "bg-emerald-500/20 border-emerald-500 scale-110 text-emerald-400"
                      : "bg-zinc-900 border-zinc-800 text-zinc-400 group-hover:bg-emerald-500/10 group-hover:border-emerald-500/30 group-hover:text-emerald-400"
                  }`}>
                    <Upload className="w-5.5 h-5.5" />
                  </div>
                  <span className={`text-xs font-bold transition ${isDraggingVideo ? "text-emerald-400" : "text-zinc-200 group-hover:text-white"}`}>
                    {isDraggingVideo ? "Lepaskan video Anda di sini! 🎉" : "Pilih / Seret File Video Lanjutan"}
                  </span>
                  <span className="text-[9px] text-zinc-500 group-hover:text-zinc-400 transition">Mendukung berkas besar, diproses 100% lokal & aman di browser Anda</span>
                </div>

                <input
                  ref={videoFileInputRef}
                  type="file"
                  accept="video/*"
                  onChange={handleVideoFileUpload}
                  className="hidden"
                />
              </div>
            )}

            {streamError && (
              <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-2xl flex gap-2.5 items-start">
                <AlertCircle className="w-4.5 h-4.5 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Info Pemutaran / CORS Stream:</p>
                  <p className="mt-0.5 leading-relaxed text-zinc-300">{streamError}</p>
                </div>
              </div>
            )}
          </div>

          {/* 2. TIMING & SLICER PARAMETERS (15s frame rate builder) */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5 shadow-xl flex flex-col gap-5">
            <div className="flex items-center justify-between border-b border-zinc-850 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Scissors className="w-4 h-4 text-emerald-400" />
                Atur Durasi & Potongan Video (Slicer)
              </h3>
              <div className="flex gap-1">
                <button
                  onClick={() => setClipDuration(15)}
                  className={`text-[11px] py-1 px-2.5 rounded-lg font-bold border transition ${
                    clipDuration === 15
                      ? "bg-emerald-400 text-zinc-950 border-emerald-400"
                      : "bg-zinc-950 text-zinc-400 border-zinc-800 hover:text-white"
                  }`}
                >
                  🚀 Pas 15 Detik
                </button>
                <button
                  onClick={() => setClipDuration(30)}
                  className={`text-[11px] py-1 px-2.5 rounded-lg font-bold border transition ${
                    clipDuration === 30
                      ? "bg-emerald-400 text-zinc-950 border-emerald-400"
                      : "bg-zinc-950 text-zinc-400 border-zinc-800 hover:text-white"
                  }`}
                >
                  30 Detik
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Start Point Scrubber */}
              <div className="flex flex-col gap-2">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-zinc-400">Detik Mulai Potong (Start):</span>
                  <span className="text-emerald-400 font-mono">{clipStart} s</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max={Math.max(duration - clipDuration, 0)}
                  step="1"
                  value={clipStart}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    setClipStart(val);
                    handleSeekChange(val);
                  }}
                  className="w-full accent-emerald-500 h-1.5 bg-zinc-950 rounded-lg appearance-none cursor-pointer"
                />
                <span className="text-[10px] text-zinc-500">Mulai memotong klip video pada detik ke-{clipStart}.</span>
              </div>

              {/* Adjustable Duration */}
              <div className="flex flex-col gap-2">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-zinc-400">Panjang Klip Video akhir:</span>
                  <span className="text-emerald-400 font-mono">{clipDuration} detik</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="60"
                  step="1"
                  value={clipDuration}
                  onChange={(e) => setClipDuration(parseInt(e.target.value))}
                  className="w-full accent-emerald-500 h-1.5 bg-zinc-950 rounded-lg appearance-none cursor-pointer"
                />
                <span className="text-[10px] text-zinc-500">Sesuaikan panjang potongan video secara fleksibel.</span>
              </div>

            </div>

            {/* Video metadata overview */}
            <div className="p-3 bg-zinc-950 rounded-2xl flex items-center justify-between text-xs font-mono text-zinc-400 border border-zinc-850">
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-zinc-500" />
                Durasi total streaming: {Math.floor(duration)} detik
              </span>
              <span className="text-emerald-400">
                Segment aktif: detik {clipStart} s/d {clipStart + clipDuration} s
              </span>
            </div>
          </div>

          {/* 3. CORE OVERLAYS TRACK EDITOR */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5 shadow-xl flex flex-col gap-4">
            
            <div className="flex items-center justify-between border-b border-zinc-850 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Layers className="w-5 h-5 text-emerald-400" />
                Lapisan Teks & Stiker (Overlays Layer)
              </h3>
              <div className="flex gap-2">
                
                {/* Upload sticker image button */}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 border border-zinc-700 cursor-pointer"
                  title="Unggah Gambar stiker/watermark logo baru"
                >
                  <Plus className="w-3.5 h-3.5" />
                  + Stiker PNG
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />

                <button
                  onClick={addNewTextTrack}
                  className="bg-emerald-400 hover:bg-emerald-300 text-zinc-950 px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  + Teks Overlay
                </button>
              </div>
            </div>

            {/* Selector listing */}
            <div className="flex items-center gap-2 flex-wrap min-h-[40px] p-2 bg-zinc-950 rounded-2xl border border-zinc-850">
              {textOverlays.length === 0 && imageOverlays.length === 0 ? (
                <div className="text-xs text-zinc-500 italic p-1.5 w-full text-center">
                  Belum ada overlay. Klik tombol di atas untuk menambah teks atau gambar logo!
                </div>
              ) : (
                <>
                  {textOverlays.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setSelectedOverlayId(t.id)}
                      className={`text-xs px-3 py-2 rounded-xl border flex items-center gap-1.5 cursor-pointer ${
                        selectedOverlayId === t.id
                          ? "bg-blue-600 border-blue-500 text-white font-bold"
                          : "bg-zinc-900 text-zinc-400 border-zinc-800 hover:bg-zinc-850"
                      }`}
                    >
                      <FontIcon className="w-3.5 h-3.5 text-blue-300" />
                      {t.text.slice(0, 15) || "Teks Kosong"}...
                    </button>
                  ))}

                  {imageOverlays.map((img) => (
                    <button
                      key={img.id}
                      onClick={() => setSelectedOverlayId(img.id)}
                      className={`text-xs px-3 py-2 rounded-xl border flex items-center gap-1.5 cursor-pointer ${
                        selectedOverlayId === img.id
                          ? "bg-emerald-600 border-emerald-500 text-white font-bold"
                          : "bg-zinc-900 text-zinc-400 border-zinc-800 hover:bg-zinc-850"
                      }`}
                    >
                      <ImageIcon className="w-3.5 h-3.5 text-emerald-300" />
                      {img.name.slice(0, 10)}...
                    </button>
                  ))}
                </>
              )}
            </div>

            {/* Selected Overlay detail customizers state */}
            {selectedOverlayId && (
              <div className="p-4 bg-zinc-950 rounded-2xl border border-zinc-850 flex flex-col gap-4">
                
                <div className="flex items-center justify-between border-b border-zinc-850 pb-2">
                  <span className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
                    <Sliders className="w-4 h-4 text-emerald-400" />
                    Sesuaikan Parameter Layer Aktif
                  </span>
                  
                  <button
                    onClick={deleteActiveOverlay}
                    className="p-1 px-2.5 bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-400 rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Hapus Layer
                  </button>
                </div>

                <div className="p-2.5 px-3.5 bg-zinc-900 border border-zinc-800 text-[10px] text-zinc-400 rounded-xl flex items-start gap-2 leading-relaxed">
                  <span className="text-emerald-400 text-xs">✨</span>
                  <span><strong>Geser Tarik Layar:</strong> Hebat! Sekarang Anda dapat mengklik & menarik posisi teks / stiker logo ini secara bebas langsung di layar HP simulasi video dengan mouse Anda.</span>
                </div>

                {/* TEXT LAYER BUILDERS */}
                {textOverlays.find((o) => o.id === selectedOverlayId) && (() => {
                  const to = textOverlays.find((o) => o.id === selectedOverlayId)!;
                  return (
                    <div className="flex flex-col gap-4">
                      
                      {/* Text value box */}
                      <div className="flex flex-col gap-1">
                        <span className="text-[11px] font-bold text-zinc-400">Tulisan overlay video:</span>
                        <input
                          type="text"
                          value={to.text}
                          onChange={(e) => updateSelectedText({ text: e.target.value })}
                          className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-zinc-100 font-medium focus:outline-none"
                          placeholder="Ketik teks overlay di sini..."
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        
                        {/* Slide Y Positioning */}
                        <div className="flex flex-col gap-1.5">
                          <div className="flex justify-between text-[11px]">
                            <span className="text-zinc-400">Posisi Tinggi (Y):</span>
                            <span className="text-zinc-300 font-mono">{to.yPosition}%</span>
                          </div>
                          <input
                            type="range"
                            min="5"
                            max="95"
                            value={to.yPosition}
                            onChange={(e) => updateSelectedText({ yPosition: parseInt(e.target.value) })}
                            className="w-full accent-blue-500 h-1 bg-zinc-900 rounded"
                          />
                        </div>

                        {/* Slide X positioning */}
                        <div className="flex flex-col gap-1.5">
                          <div className="flex justify-between text-[11px]">
                            <span className="text-zinc-400">Posisi Kiri/Kanan (X):</span>
                            <span className="text-zinc-300 font-mono">{to.xPosition}%</span>
                          </div>
                          <input
                            type="range"
                            min="5"
                            max="95"
                            value={to.xPosition}
                            onChange={(e) => updateSelectedText({ xPosition: parseInt(e.target.value) })}
                            className="w-full accent-blue-500 h-1 bg-zinc-900 rounded"
                          />
                        </div>

                        {/* Font size */}
                        <div className="flex flex-col gap-1.5">
                          <div className="flex justify-between text-[11px]">
                            <span className="text-zinc-400">Ukuran Teks (Font):</span>
                            <span className="text-zinc-300 font-mono">{to.fontSize} px</span>
                          </div>
                          <input
                            type="range"
                            min="10"
                            max="45"
                            value={to.fontSize}
                            onChange={(e) => updateSelectedText({ fontSize: parseInt(e.target.value) })}
                            className="w-full accent-blue-500 h-1 bg-zinc-900 rounded"
                          />
                        </div>

                        {/* Styling category */}
                        <div className="flex flex-col gap-1">
                          <span className="text-[11px] font-bold text-zinc-400">Pilih Efek Gaya:</span>
                          <select
                            value={to.style}
                            onChange={(e) => updateSelectedText({ style: e.target.value as any })}
                            className="bg-zinc-900 text-zinc-200 text-xs py-1.5 px-2 rounded-lg border border-zinc-800"
                          >
                            <option value="flat">Standar Bersih</option>
                            <option value="shadow">Berbayang Kontras (Shadow)</option>
                            <option value="neon">Neon Menyala (Glow)</option>
                            <option value="badge">Badge Latar Solid</option>
                          </select>
                        </div>

                        {/* Custom Hex Color selectors */}
                        <div className="flex flex-col gap-1">
                          <span className="text-[11px] font-bold text-zinc-400">Warna Teks:</span>
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={to.color}
                              onChange={(e) => updateSelectedText({ color: e.target.value })}
                              className="w-8 h-8 rounded border-none cursor-pointer bg-transparent"
                            />
                            <input
                              type="text"
                              value={to.color}
                              onChange={(e) => updateSelectedText({ color: e.target.value })}
                              className="bg-zinc-900 border border-zinc-800 px-2 py-1 rounded text-xs font-mono w-24 text-center text-zinc-300"
                            />
                          </div>
                        </div>

                        {/* Background Badge Color */}
                        {to.style === "badge" && (
                          <div className="flex flex-col gap-1">
                            <span className="text-[11px] font-bold text-zinc-400">Warna Latar Badge:</span>
                            <div className="flex items-center gap-2">
                              <input
                                type="color"
                                value={to.bgColor.startsWith("rgba") ? "#000000" : to.bgColor}
                                onChange={(e) => updateSelectedText({ bgColor: e.target.value })}
                                className="w-8 h-8 rounded border-none cursor-pointer bg-transparent"
                              />
                              <input
                                type="text"
                                value={to.bgColor}
                                onChange={(e) => updateSelectedText({ bgColor: e.target.value })}
                                className="bg-zinc-900 border border-zinc-800 px-2 py-1 rounded text-xs font-mono w-28 text-center text-zinc-300"
                              />
                            </div>
                          </div>
                        )}

                        {/* 1. Font Family Selector */}
                        <div className="flex flex-col gap-1 bg-zinc-950/20 p-1.5 rounded-xl border border-zinc-900">
                          <span className="text-[11px] font-bold text-zinc-400 flex items-center gap-1">
                            <span>🅰️ Pilih Jenis Font:</span>
                          </span>
                          <select
                            value={to.fontFamily || "Inter"}
                            onChange={(e) => updateSelectedText({ fontFamily: e.target.value })}
                            className="bg-zinc-900 text-zinc-200 text-[11px] py-1.5 px-2 rounded-lg border border-zinc-800 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                            style={{ fontFamily: to.fontFamily || "Inter" }}
                          >
                            <option value="Inter">Inter (Sederhana Clean)</option>
                            <option value="Anton">Anton (Bold Tebal / Cetak)</option>
                            <option value="Luckiest Guy">Luckiest Guy (Pop Viral / Shorts)</option>
                            <option value="Bangers">Bangers (Aksi Komik)</option>
                            <option value="Permanent Marker">Permanent Marker (Spidol Kuas)</option>
                            <option value="Lilita One">Lilita One (Tebal Bulat Luwes)</option>
                            <option value="Fredoka">Fredoka (Cantik Modern)</option>
                            <option value="Playfair Display">Playfair Display (Mewah Estetik)</option>
                          </select>
                        </div>

                        {/* 2. Casing controls */}
                        <div className="flex flex-col gap-1 bg-zinc-950/20 p-1.5 rounded-xl border border-zinc-900">
                          <span className="text-[11px] font-bold text-zinc-400">Transformasi Huruf:</span>
                          <div className="grid grid-cols-3 gap-1 bg-zinc-900 p-0.5 rounded-md border border-zinc-850">
                            <button
                              type="button"
                              onClick={() => updateSelectedText({ textCase: "original" })}
                              className={`text-[9px] py-1 px-1 rounded font-bold transition ${
                                !to.textCase || to.textCase === "original"
                                  ? "bg-indigo-600 text-white"
                                  : "text-zinc-400 hover:text-zinc-200"
                              }`}
                            >
                              Normal
                            </button>
                            <button
                              type="button"
                              onClick={() => updateSelectedText({ textCase: "uppercase" })}
                              className={`text-[9px] py-1 px-1 rounded font-bold transition ${
                                to.textCase === "uppercase"
                                  ? "bg-indigo-600 text-white"
                                  : "text-zinc-400 hover:text-zinc-200"
                              }`}
                            >
                              KAPITAL
                            </button>
                            <button
                              type="button"
                              onClick={() => updateSelectedText({ textCase: "lowercase" })}
                              className={`text-[9px] py-1 px-1 rounded font-bold transition ${
                                to.textCase === "lowercase"
                                  ? "bg-indigo-600 text-white"
                                  : "text-zinc-400 hover:text-zinc-200"
                              }`}
                            >
                              kecil
                            </button>
                          </div>
                        </div>

                        {/* 3. Stroke Outline Width */}
                        <div className="flex flex-col gap-1">
                          <div className="flex justify-between text-[11px]">
                            <span className="text-zinc-400 font-bold">Tebal Outline Lapisan:</span>
                            <span className="text-zinc-300 font-mono">{to.strokeWidth || 0} px</span>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="12"
                            step="1"
                            value={to.strokeWidth || 0}
                            onChange={(e) => updateSelectedText({ strokeWidth: parseInt(e.target.value) })}
                            className="w-full accent-indigo-500 h-1 bg-zinc-950 rounded"
                          />
                        </div>

                        {/* 4. Stroke Color */}
                        <div className="flex flex-col gap-1">
                          <span className="text-[11px] font-bold text-zinc-400">Warna Outline:</span>
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={to.strokeColor || "#000000"}
                              onChange={(e) => updateSelectedText({ strokeColor: e.target.value })}
                              className="w-8 h-8 rounded border-none cursor-pointer bg-transparent"
                            />
                            <input
                              type="text"
                              value={to.strokeColor || "#000000"}
                              onChange={(e) => updateSelectedText({ strokeColor: e.target.value })}
                              className="bg-zinc-900 border border-zinc-800 px-2 py-0.5 rounded text-[10px] font-mono w-24 text-center text-zinc-300"
                            />
                          </div>
                        </div>

                        {/* 5. Skew Slant angle */}
                        <div className="flex flex-col gap-1 md:col-span-2 bg-zinc-950/25 p-2 rounded-xl border border-zinc-900">
                          <div className="flex justify-between text-[11px]">
                            <span className="text-zinc-400 font-bold">Miringkan Orientasi Teks (Slant Skew):</span>
                            <span className="text-zinc-300 font-mono">{to.skewX || 0}°</span>
                          </div>
                          <input
                            type="range"
                            min="-25"
                            max="25"
                            step="1"
                            value={to.skewX || 0}
                            onChange={(e) => updateSelectedText({ skewX: parseInt(e.target.value) })}
                            className="w-full accent-amber-500 h-1 bg-zinc-900 rounded"
                          />
                        </div>

                        {/* 6. Animasi Gerakan Font Teks */}
                        <div className="flex flex-col gap-1 bg-zinc-950/25 p-2.5 rounded-xl border border-zinc-900 md:col-span-2">
                          <span className="text-[11px] font-bold text-zinc-350 flex items-center gap-1">
                            <span>🎬 Efek Gerakan Font (Animasi):</span>
                          </span>
                          <select
                            value={to.animationType || "none"}
                            onChange={(e) => updateSelectedText({ animationType: e.target.value as any })}
                            className="bg-zinc-900 text-zinc-100 text-[11px] py-2 px-2.5 rounded-lg border border-zinc-800 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                          >
                            <option value="none">Statis (Tanpa Gerakan/Diam)</option>
                            <option value="shake">Goyang Getar Cepat (Sangat Rekomendasi TikTok)</option>
                            <option value="pulse">Denyut Bersinar (Lembut Estetik)</option>
                            <option value="bounce">Membal Naik Turun (Kreatif / Shorts)</option>
                            <option value="zoom">Zoom Keluar-Masuk Berulang (Menarik Perhatian)</option>
                            <option value="floating">Melayang Santai (Efek Sinematik)</option>
                          </select>
                        </div>

                      </div>

                      {/* Gaya Cepat Presets Area */}
                      <div className="mt-1.5 p-3.5 bg-zinc-950 border border-zinc-850 rounded-2xl flex flex-col gap-2.5">
                        <span className="text-[11px] font-extrabold text-zinc-300 flex items-center gap-1.5">
                          <span className="text-amber-400 animate-pulse">⚡</span>
                          Preset Khusus Algoritma Sosial Media (Meningkatkan CTR):
                        </span>
                        
                        <div className="grid grid-cols-2 gap-2">
                          {[
                            {
                              name: "🎵 TikTok Yellow Pop",
                              fontFamily: "Luckiest Guy",
                              color: "#facc15",
                              strokeColor: "#000000",
                              strokeWidth: 7,
                              skewX: -5,
                              textCase: "uppercase" as const,
                              style: "flat" as const,
                              animationType: "shake" as const,
                            },
                            {
                              name: "📺 YT Shorts Caption",
                              fontFamily: "Anton",
                              color: "#ffffff",
                              strokeColor: "#dc2626",
                              strokeWidth: 6,
                              skewX: -4,
                              textCase: "uppercase" as const,
                              style: "flat" as const,
                              animationType: "zoom" as const,
                            },
                            {
                              name: "🌟 FB Reels Bold",
                              fontFamily: "Bangers",
                              color: "#ffffff",
                              strokeColor: "#1e3a8a",
                              strokeWidth: 6,
                              skewX: -6,
                              textCase: "uppercase" as const,
                              style: "flat" as const,
                              animationType: "bounce" as const,
                            },
                            {
                              name: "🐦 X Viral Caption",
                              fontFamily: "Fredoka",
                              color: "#38bdf8",
                              strokeColor: "#0369a1",
                              strokeWidth: 4,
                              skewX: 0,
                              textCase: "original" as const,
                              style: "neon" as const,
                              animationType: "floating" as const,
                            },
                            {
                              name: "🧸 Bulat Imut Cute",
                              fontFamily: "Lilita One",
                              color: "#ffffff",
                              strokeColor: "#1e1b4b",
                              strokeWidth: 5,
                              skewX: 0,
                              textCase: "original" as const,
                              style: "flat" as const,
                              animationType: "pulse" as const,
                            },
                            {
                              name: "💎 Estetik Mewah",
                              fontFamily: "Playfair Display",
                              color: "#ffe4e6",
                              strokeColor: "#4c0519",
                              strokeWidth: 1.5,
                              skewX: 0,
                              textCase: "original" as const,
                              style: "shadow" as const,
                              animationType: "floating" as const,
                            },
                            {
                              name: "🖌️ Spidol Kuas",
                              fontFamily: "Permanent Marker",
                              color: "#ffffff",
                              strokeColor: "#000000",
                              strokeWidth: 4,
                              skewX: -2,
                              textCase: "uppercase" as const,
                              style: "shadow" as const,
                              animationType: "shake" as const,
                            },
                            {
                              name: "💡 Bersih Biasa",
                              fontFamily: "Inter",
                              color: "#ffffff",
                              strokeColor: "#000000",
                              strokeWidth: 0,
                              skewX: 0,
                              textCase: "original" as const,
                              style: "flat" as const,
                              animationType: "none" as const,
                            }
                          ].map((preset, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => {
                                updateSelectedText({
                                  fontFamily: preset.fontFamily,
                                  color: preset.color,
                                  strokeColor: preset.strokeColor,
                                  strokeWidth: preset.strokeWidth,
                                  skewX: preset.skewX,
                                  textCase: preset.textCase,
                                  style: preset.style,
                                  animationType: preset.animationType,
                                });
                              }}
                              className="text-[10px] text-zinc-300 bg-zinc-900 border border-zinc-800 hover:border-emerald-500/50 hover:bg-zinc-850 p-2.5 rounded-xl transition duration-200 font-semibold text-left flex flex-col gap-1 cursor-pointer"
                            >
                              <span className="font-bold text-zinc-100 flex items-center justify-between">
                                {preset.name}
                              </span>
                              <span className="text-[8px] text-zinc-500 font-mono truncate" style={{ fontFamily: preset.fontFamily }}>
                                Font: {preset.fontFamily} ({preset.animationType})
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>

                    </div>
                  );
                })()}

                {/* IMAGE STICKER LAYERS */}
                {imageOverlays.find((o) => o.id === selectedOverlayId) && (() => {
                  const img = imageOverlays.find((o) => o.id === selectedOverlayId)!;
                  return (
                    <div className="flex flex-col gap-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        
                        {/* Scale multiplier */}
                        <div className="flex flex-col gap-1.5">
                          <div className="flex justify-between text-[11px]">
                            <span className="text-zinc-400">Skala Ukuran Stiker:</span>
                            <span className="text-zinc-300 font-mono">{(img.scale * 100).toFixed(0)}%</span>
                          </div>
                          <input
                            type="range"
                            min="10"
                            max="200"
                            value={img.scale * 100}
                            onChange={(e) => updateSelectedImage({ scale: parseInt(e.target.value) / 100 })}
                            className="w-full accent-emerald-500 h-1 bg-zinc-900 rounded"
                          />
                        </div>

                        {/* Drag X */}
                        <div className="flex flex-col gap-1.5">
                          <div className="flex justify-between text-[11px]">
                            <span className="text-zinc-400">Posisi Horizontal (X):</span>
                            <span className="text-zinc-300 font-mono">{img.x}%</span>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={img.x}
                            onChange={(e) => updateSelectedImage({ x: parseInt(e.target.value) })}
                            className="w-full accent-emerald-500 h-1 bg-zinc-900 rounded"
                          />
                        </div>

                        {/* Drag Y */}
                        <div className="flex flex-col gap-1.5">
                          <div className="flex justify-between text-[11px]">
                            <span className="text-zinc-400">Posisi Vertikal (Y):</span>
                            <span className="text-zinc-300 font-mono">{img.y}%</span>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={img.y}
                            onChange={(e) => updateSelectedImage({ y: parseInt(e.target.value) })}
                            className="w-full accent-emerald-500 h-1 bg-zinc-900 rounded"
                          />
                        </div>

                        <div className="flex items-center gap-2">
                          <img
                            src={img.src}
                            alt="Preview thumbnail"
                            className="w-12 h-12 bg-zinc-900 rounded border border-zinc-800 object-contain p-1"
                          />
                          <p className="text-xs text-zinc-400">{img.name.slice(0, 15)}...</p>
                        </div>

                      </div>
                    </div>
                  );
                })()}

              </div>
            )}
          </div>

          {/* 4. SMART VIEWPORT RESIZER (LANDSCAPE TO PORTRAIT RATIO) */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5 shadow-xl flex flex-col gap-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Maximize2 className="w-4.5 h-4.5 text-emerald-400" />
              Sistem Potong HP (9:16 Crop & Pan)
            </h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Video landscape film atau tayangan biasanya berbentuk 16:9 mendatar. Sistem kami secara otomatis memotongnya menjadi format ponsel pintar 9:16 vertikal.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-1">
              
              {/* Scale mode */}
              <div className="flex flex-col gap-1">
                <span className="text-xs font-bold text-zinc-300">Preset Crop Fit:</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setViewportCrop("cover")}
                    className={`text-xs px-3 py-2 flex-1 rounded-xl transition font-semibold border ${
                      viewportCrop === "cover"
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/40"
                        : "bg-zinc-950 text-zinc-400 border-zinc-800 hover:text-white"
                    }`}
                  >
                    🔍 Cover (Penuh HP)
                  </button>
                  <button
                    onClick={() => setViewportCrop("contain")}
                    className={`text-xs px-3 py-2 flex-1 rounded-xl transition font-semibold border ${
                      viewportCrop === "contain"
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/40"
                        : "bg-zinc-950 text-zinc-400 border-zinc-800 hover:text-white"
                    }`}
                  >
                    📺 Contain (Sisi Hitam)
                  </button>
                </div>
              </div>

              {/* Pan Horizontal slide bar */}
              {viewportCrop === "cover" && (
                <div className="flex flex-col gap-1 text-xs">
                  <div className="flex justify-between font-bold">
                    <span className="text-zinc-300">Geser Fokus Video (Pan Horizontal):</span>
                    <span className="text-emerald-400 font-mono">{horizontalPan}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={horizontalPan}
                    onChange={(e) => setHorizontalPan(parseInt(e.target.value))}
                    className="w-full accent-emerald-500 h-1.5 bg-zinc-950 rounded-lg cursor-pointer mt-1"
                  />
                  <span className="text-[10px] text-zinc-500">Geser untuk memposisikan bagian video penting di tengah HP.</span>
                </div>
              )}

            </div>
          </div>

          {/* 5. VIDEO AUDIO & VOICE CHANGER SYSTEM (PENGUBAH SUARA VIDEO) */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5 shadow-xl flex flex-col gap-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Sliders className="w-4.5 h-4.5 text-emerald-400" />
              Sistem Suara & Pengubah Vokal Video (Video Voice Processor)
            </h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Ubah frekuensi suara dan gaya vokal asli di dalam video streaming Anda secara dinamis dengan filter audio canggih.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-1">
              {/* Voice Effect presets presets */}
              <div className="flex flex-col gap-1.5">
                <span className="text-[11px] font-bold text-zinc-300">Preset Efek Vokal Video:</span>
                <select
                  value={videoVoiceEffect}
                  onChange={(e) => {
                    const eff = e.target.value;
                    setVideoVoiceEffect(eff);
                    if (isPlaying) {
                      hookVideoToAudioGraph(eff);
                    }
                  }}
                  className="bg-zinc-950 text-zinc-200 text-xs py-2 px-3 rounded-xl border border-zinc-800 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                >
                  <option value="original">🔊 Original (Suara Asli Video)</option>
                  <option value="muffled">🌊 Underwater / Muffled (Gema Dalam Air)</option>
                  <option value="telephone">📞 Megaphone / Tiny Radio (Efek Telepon Jadul)</option>
                  <option value="echo">🏔️ Spatial Echo Room (Efek Gema Pegunungan)</option>
                  <option value="robot">🤖 Metallic Cyborg Ring (Efek Robot Futuristik)</option>
                </select>
                <span className="text-[10px] text-zinc-500">Mempengaruhi seluruh gelombang suara dari video orisinal.</span>
              </div>

              {/* Playback speed adjuster (Nightcore or slow down) */}
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between items-center text-[11px] font-bold">
                  <span className="text-zinc-300">Tempo & Pitch Cepat (Playback Speed):</span>
                  <span className="text-emerald-400 font-mono">{playbackSpeed.toFixed(2)}x</span>
                </div>
                <div className="flex gap-1.5 mt-0.5">
                  {[
                    { val: 0.8, label: "🐌 Vapor (0.8x)" },
                    { val: 1.0, label: "🙋 Normal (1.0x)" },
                    { val: 1.25, label: "⚡ Fast (1.25x)" },
                    { val: 1.4, label: "🚀 Nightcore (1.4x)" }
                  ].map((preset) => (
                    <button
                      key={preset.val}
                      onClick={() => {
                        setPlaybackSpeed(preset.val);
                        const video = videoRef.current;
                        if (video) {
                          video.playbackRate = preset.val;
                        }
                      }}
                      className={`text-[10px] p-2 flex-1 rounded-xl transition font-medium border cursor-pointer ${
                        playbackSpeed === preset.val
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/40 font-bold"
                          : "bg-zinc-950 text-zinc-400 border-zinc-850 hover:bg-zinc-900"
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
                <span className="text-[10px] text-zinc-500">Meningkatkan/menurunkan tempo serta tinggi nada suara vokal.</span>
              </div>
            </div>
          </div>

        </section>

        {/* RIGHT COLUMN: Portable Smartphone interface emulator & recording download workflow */}
        <section className="lg:col-span-5 lg:sticky lg:top-6 flex flex-col items-center gap-6 self-start w-full">
          
          {/* Main Simulated Phone Canvas (Aspect: 9:16) */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5 shadow-2xl flex flex-col items-center">
            
            <div className="flex justify-between items-center w-full mb-3 text-xs">
              <span className="text-zinc-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                Live Preview (9:16 Canvas)
              </span>
              <span className="text-[11px] font-mono text-zinc-400">
                Detik: {currentTime.toFixed(1)}s / {clipDuration}s
              </span>
            </div>

            {/* Simulated smartphone rendering layout */}
            <div className="relative w-[280px] sm:w-[320px] h-[500px] sm:h-[568px] bg-black border-8 border-zinc-950 rounded-[40px] overflow-hidden shadow-inner ring-1 ring-white/10">
              
              {/* Dynamic canvas drawing everything at high FPS */}
              <canvas
                ref={canvasRef}
                width={360}
                height={640}
                onPointerDown={handleCanvasPointerDown}
                onPointerMove={handleCanvasPointerMove}
                onPointerUp={handleCanvasPointerUp}
                className="w-full h-full bg-zinc-950 object-contain rounded-[30px] touch-none cursor-grab active:cursor-grabbing"
              />

              {/* Background original video element stream source (Invisible) */}
              <video
                ref={videoRef}
                crossOrigin="anonymous"
                playsInline
                loop={false}
                muted={isMuted}
                className="hidden"
              />

              {/* Camera Island Notch Simulation */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-5 bg-zinc-950 rounded-b-2xl z-30" />
            </div>

            {/* Quick Player Slider and Controls overlay */}
            <div className="w-full mt-4 flex flex-col gap-3">
              
              {/* Play Slider Timeline */}
              <div className="flex items-center gap-2 text-xs font-mono">
                <span className="text-zinc-400">00:00</span>
                <input
                  type="range"
                  min="0"
                  max={duration || 100}
                  step="0.1"
                  value={currentTime}
                  onChange={(e) => handleSeekChange(parseFloat(e.target.value))}
                  className="flex-1 accent-emerald-500 bg-zinc-950 h-1 rounded pointer-events-auto cursor-pointer"
                />
                <span className="text-zinc-400">
                  00:{(Math.floor(duration) < 10 ? "0" : "") + Math.floor(duration)}
                </span>
              </div>

              {/* Main manual Play/Pause buttons */}
              <div className="flex items-center justify-between mt-1 bg-zinc-950/80 p-2 rounded-2xl border border-zinc-850">
                <div className="flex items-center gap-1">
                  <button
                    onClick={togglePlay}
                    className={`p-2.5 rounded-xl flex items-center justify-center transition active:scale-95 cursor-pointer ${
                      isPlaying
                        ? "bg-amber-500 text-zinc-950 hover:bg-amber-400"
                        : "bg-emerald-400 text-zinc-950 hover:bg-emerald-300"
                    }`}
                  >
                    {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
                  </button>

                  <span className="text-xs font-bold text-zinc-300 px-2">
                    {isPlaying ? "MEMUTAR ALIRAN" : "DIHENTIKAN"}
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  {/* Sound Trigger */}
                  <button
                    onClick={toggleMuted}
                    className="p-2 text-zinc-400 hover:text-white rounded-lg cursor-pointer"
                    title={isMuted ? "Aktifkan suara" : "Bisu"}
                  >
                    {isMuted ? <VolumeX className="w-4.5 h-4.5 text-zinc-500" /> : <Volume2 className="w-4.5 h-4.5 text-emerald-400" />}
                  </button>

                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={volume}
                    onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                    className="w-16 accent-zinc-400 h-1 bg-zinc-900 rounded"
                  />
                </div>
              </div>

            </div>

          </div>

          {/* 5. LIVE VIDEO RECORDER & EXPORT DOWNLOAD DRAWER */}
          <div className="w-full bg-zinc-900 border border-zinc-800 rounded-3xl p-5 shadow-xl flex flex-col gap-4">
            
            <div className="flex items-center justify-between border-b border-zinc-850 pb-3">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <Download className="w-4.5 h-4.5 text-emerald-400" />
                Proses Hasil (Export & Download)
              </h4>
              <span className="text-[10px] text-zinc-400 bg-zinc-950 border border-zinc-800 px-2 py-0.5 rounded font-mono">
                HTML5 Media Stream
              </span>
            </div>

            <p className="text-xs text-zinc-400 leading-relaxed">
              Potong klip video sepanjang <strong className="text-white">{clipDuration} detik</strong> secara langsung bersama semua lapisan teks dan watermark. Kami merendernya secara real-time dari kanvas.
            </p>

            {/* Click to start Export Rendering */}
            {!isRecording ? (
              <button
                onClick={startCanvasRecording}
                className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 active:scale-[0.98] text-zinc-950 font-extrabold text-sm py-4.5 rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/10 cursor-pointer"
              >
                <Scissors className="w-4.5 h-4.5" />
                Render & Potong {clipDuration} Detik Sekarang
              </button>
            ) : (
              <div className="bg-zinc-950 p-4 rounded-2xl border border-zinc-850 flex flex-col gap-3">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-emerald-400 font-bold flex items-center gap-2">
                    <span className="w-2.5 h-2.5 bg-rose-500 rounded-full animate-ping" />
                    Sedang Merender Frame Video...
                  </span>
                  <span className="text-zinc-400 font-mono font-bold">{recordProgress}%</span>
                </div>

                <div className="w-full bg-zinc-900 rounded-full h-2 overflow-hidden border border-zinc-800">
                  <div
                    className="bg-emerald-400 h-full transition-all duration-200"
                    style={{ width: `${recordProgress}%` }}
                  />
                </div>

                <p className="text-[9px] text-zinc-500 text-center uppercase tracking-wider font-semibold">
                  Tolong jangan tutup tab atau mengubah detik selama perekaman berlangsung.
                </p>
              </div>
            )}

            {/* Downloader download prompt drawer */}
            {recordedVideoUrl && (
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex flex-col gap-3">
                <div className="flex items-center gap-2 text-emerald-400">
                  <Sparkles className="w-5 h-5 text-yellow-300" />
                  <span className="text-xs font-black">VIDEO BERHASIL DITERJEMAHKAN!</span>
                </div>
                
                <p className="text-xs text-zinc-300">
                  Video klip berdurasi {clipDuration} detik dengan modifikasi overlay tulisan Anda siap diunduh secara offline.
                </p>

                <div className="flex gap-2">
                  <a
                    href={recordedVideoUrl}
                    download={`edited-video-${clipDuration}s.webm`}
                    className="flex-1 bg-emerald-400 text-zinc-950 hover:bg-emerald-300 active:scale-[0.98] font-bold text-xs py-3.5 rounded-xl flex items-center justify-center gap-1.5 transition text-center shadow"
                  >
                    <Download className="w-4 h-4" />
                    Download File Video Final
                  </a>
                  
                  <button
                    onClick={() => {
                      // Open player in new window easily
                      window.open(recordedVideoUrl);
                    }}
                    className="bg-zinc-850 text-zinc-200 hover:bg-zinc-800 hover:text-white px-3.5 rounded-xl text-xs font-semibold border border-zinc-700 transition"
                    title="Pratinjau Video di Tab Baru"
                  >
                    Mainkan
                  </button>
                </div>
              </div>
            )}

          </div>

          {/* Guidelines on CORS in Indonesia */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5 shadow-xl w-full text-xs text-zinc-400 leading-relaxed">
            <h5 className="font-bold text-white mb-2 flex items-center gap-1.5">
              <HelpCircle className="w-4 h-4 text-emerald-400" />
              Petunjuk & Informasi Tambahan:
            </h5>
            <ul className="list-disc pl-4 space-y-1">
              <li>
                <strong>Format M3U8:</strong> Masukkan URL streaming `.m3u8` yang aktif. Browser Chrome/Firefox membutuhkan CORS yang diperbolehkan oleh penyedia hosting Anda.
              </li>
              <li>
                <strong>Unggah Logo:</strong> Anda bisa menambahkan logo korporat, watermark orisinalitas, atau stiker pribadi melalui tombol <strong className="text-white">+ Stiker PNG</strong>.
              </li>
              <li>
                <strong>Fokus Layar:</strong> Gunakan slider geser fokus video apabila bagian utama pada format horizontal terpotong di layar HP.
              </li>
            </ul>
          </div>

        </section>

      </main>

      {/* SEO ARTICLE & FAQ WORKSPACE */}
      <section className="max-w-7xl w-full mx-auto px-4 md:px-6 mb-14 flex flex-col gap-10">
        
        {/* SEO Article Block */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 md:p-8 shadow-2xl flex flex-col gap-5">
          <div className="flex items-center gap-3 border-b border-zinc-850 pb-4">
            <span className="text-2xl">📝</span>
            <div>
              <h2 className="text-lg font-black text-white tracking-tight">
                Cara Memotong & Mengedit Video HLS m3u8 untuk TikTok, Reels, dan Shorts Secara Instan
              </h2>
              <p className="text-xs text-zinc-400">Panduan Lengkap Optimalisasi CTR & Jangkauan Algoritma Video Pendek 2026</p>
            </div>
          </div>

          <div className="text-xs text-zinc-300 leading-relaxed space-y-4">
            <p>
              Di era konsumsi konten cepat seperti <strong>TikTok, Instagram Reels, Facebook Reels, dan YouTube Shorts</strong>, 
              perhatian audiens ditentukan dalam 3 detik pertama. Menggunakan video berformat horizontal standar (16:9) tanpa 
              modifikasi teks yang interaktif terbukti menurunkan <em>Click-Through Rate (CTR)</em> dan retensi penonton secara signifikan. 
              <strong> HLS 15s Frame Master</strong> hadir sebagai solusi all-in-one bagi para konten kreator, agensi media, dan internet marketer 
              untuk memotong (slice) cuplikan klip durasi emas (15 detik) langsung dari sumber streaming HLS (m3u8) atau video MP4 lokal, dan menyulapnya 
              menjadi mahakarya vertikal beresolusi tinggi dengan overlay teks bergaya taktis.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-4">
              <div className="bg-zinc-950 p-4 rounded-2xl border border-zinc-850">
                <h4 className="font-bold text-white mb-2 flex items-center gap-1.5 text-xs text-emerald-400">
                  <span>💡</span> Mengapa Font Miring & Tebal Sangat Disukai Algoritma?
                </h4>
                <p className="text-[11px] text-zinc-400">
                  Font dengan sumbu miring (seperti preset <strong>TikTok Yellow Pop</strong> atau <strong>YT Shorts Caption</strong>) memberikan ilusi 
                  gerakan yang menuntut fokus mata audiens. Tebal-nya outline hitam (stroke) di sekitar teks memastikan kata-kata tetap terbaca jelas 
                  bahkan ketika video ditonton dengan kecerahan layar rendah atau di perangkat mobile berskala mini.
                </p>
              </div>

              <div className="bg-zinc-950 p-4 rounded-2xl border border-zinc-850">
                <h4 className="font-bold text-white mb-2 flex items-center gap-1.5 text-xs text-indigo-400">
                  <span>🚀</span> Strategi Meningkatkan Penonton Organik di Facebook & TikTok
                </h4>
                <p className="text-[11px] text-zinc-400">
                  Selalu letakkan teks kunci (<em>hook</em>) pada orientasi aman (sekitar 20% hingga 40% dari atas perangkat) guna mencegah tulisan 
                  tertutup oleh icon interaksi sosial bawaan (like, share, profile pic) di bagian kanan dan bawah aplikasi TikTok/Facebook. Fitur 
                  fit-crop kami memudahkan Anda melakukan pan video horizontal ke vertikal tanpa kehilangan fokus utama.
                </p>
              </div>
            </div>

            <p>
              Bagi para profesional seo dan pencari cuplikan viral, kebebasan melakukan pratinjau instan tanpa perlu rendering server yang lambat 
              memangkas waktu produksi hingga 90%. Editor kami memproses semua overlay tulisan, stiker PNG, serta rotasi secara lokal di dalam browser Anda, 
              menghasilkan klip beresolusi super tajam yang langsung siap diunggah ke platform sosial favorit Anda.
            </p>
          </div>
        </div>

        {/* SEO FAQ Accordion Block */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 md:p-8 shadow-2xl flex flex-col gap-6">
          <div className="flex flex-col gap-1 border-b border-zinc-850 pb-4">
            <h3 className="text-base font-black text-white flex items-center gap-2">
              <span>❓</span> FAQ & Tanya Jawab Seputar HLS 15s Frame Master
            </h3>
            <p className="text-xs text-zinc-400">Jawaban lengkap atas pertanyaan teknis & optimasi video sosial media Anda</p>
          </div>

          <div className="flex flex-col gap-3">
            {[
              {
                q: "Apa itu HLS (HTTP Live Streaming) / M3U8?",
                a: "HLS adalah protokol streaming video berbasis HTTP yang dikembangkan oleh Apple. File manifest berextensi .m3u8 mendistribusikan berkas video dalam potongan-potongan pendek (chunks). Aplikasi kami memungkinkan Anda memasukkan URL .m3u8 ini dan menangkap cuplikan frame presisi sepanjang 15 detik secara real-time langsung di browser Anda."
              },
              {
                q: "Bagaimana cara kerja wrap teks otomatis (kebawah otomatis) jika tulisan terlalu panjang?",
                a: "Sistem canvas canggih kami secara aktif menghitung lebar teks (measureText) dan menyesuaikannya dengan lebar video vertikal. Jika teks yang Anda tulis melebihi batas aman (88% dari lebar kanvas), kalimat akan secara otomatis dipotong berdasarkan kata terdekat dan dilanjutkan di baris barunya, sehingga teks tetap rapi dan tidak terpotong di tepi layar sosial media."
              },
              {
                q: "Bagaimana variasi font baru (Anton, Luckiest Guy, dll) mendongkrak CTR sosial media?",
                a: "Pengguna media sosial cenderung melewati video yang terlihat memakai teks standar atau kaku. Dengan menggunakan jenis font ikonik seperti 'Anton' (tebal ala Breaking News) atau 'Luckiest Guy' (gaya santai populer komik), video Anda seketika terlihat seperti diedit oleh editor profesional profesional. Presets khusus kami menyematkan outline kontras tinggi yang secara instan mengunci pandangan pertama audiens."
              },
              {
                q: "Mengapa Efek Suara Kreatif diputuskan untuk dihapus dari aplikasi?",
                a: "Demi kepatuhan algoritma orisinalitas video sosial media terbaru (Facebook, TikTok, Instagram) tahun 2026. Menambahkan synthesizer audio sintetis generik yang berulang pada video terbukti memicu deteksi 'Unoriginal Content' atau 'Low-Quality Reused Audio' oleh sistem moderasi AI. Mengandalkan suara asli berkualitas tinggi dari rekaman Anda atau menggunakan track musik yang sedang tren secara langsung di aplikasi TikTok/Instagram secara signifikan meningkatkan peluang video Anda didorong ke FYP (For Your Page) dan Reels Explorer."
              },
              {
                q: "Bagaimana cara mengaktifkan efek gerakan font (animasi getar / denyut)?",
                a: "Di panel editing teks overlay, Anda kini dapat memilih 'Efek Gerakan Font (Animasi)'. Pilihan animasi seperti 'Goyang Getar Cepat' (TikTok style), 'Denyut Bersinar' (lembut bersinar), atau 'Zoom Keluar-Masuk' akan menghidupkan teks secara dinamis di atas kanvas video, yang sangat ampuh dalam menarik retensi menit awal penonton."
              },
              {
                q: "Bagaimana solusi jika terjadi pesan error CORS m3u8 stream?",
                a: "Pembatasan CORS (Cross-Origin Resource Sharing) adalah kebijakan keamanan server asal video Anda. Jika Anda mengalami kegagalan load m3u8, Anda dapat menggunakan konverter tautan Google Drive / Dropbox kami yang aman, atau mengunduh video tersebut terlebih dahulu dan mengunggahnya secara instan via tab 'File Lokal' yang 100% bebas hambatan CORS."
              }
            ].map((item, idx) => {
              const isOpen = openFaqIndex === idx;
              return (
                <div key={idx} className="bg-zinc-950 border border-zinc-850 rounded-2xl overflow-hidden transition-all duration-200">
                  <button
                    type="button"
                    onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                    className="w-full text-left p-4 flex items-center justify-between font-bold text-white text-xs hover:bg-zinc-900 transition-all cursor-pointer"
                  >
                    <span className="flex items-center gap-2">
                      <span className="text-emerald-400 font-mono">0{idx + 1}.</span>
                      {item.q}
                    </span>
                    <span className={`text-emerald-400 font-bold transform transition-transform duration-200 ${isOpen ? "rotate-90" : ""}`}>
                      ▶
                    </span>
                  </button>
                  {isOpen && (
                    <div className="p-4 pt-1 border-t border-zinc-900 text-[11px] text-zinc-400 leading-relaxed bg-zinc-950/40">
                      {item.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

      </section>

      {/* Elegant minimalist footer */}
      <footer className="border-t border-zinc-900 py-6 text-center text-xs text-zinc-600 bg-zinc-950 mt-12">
        <p>© 2026 HLS 15s Frame Master | Powered by Google Gemini AI & ant-motion engine</p>
      </footer>

      {/* DYNAMIC DOCUMENTATION & LEGAL MODALS */}
      {activeModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-zinc-950/85 backdrop-blur-md transition-all animate-fade-in">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl relative">
            {/* Header */}
            <div className="border-b border-zinc-800 px-6 py-4 flex items-center justify-between bg-zinc-950/40">
              <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                <span>
                  {activeModal === "about" && "ℹ️ Tentang Kami / About us"}
                  {activeModal === "privacy" && "🔒 Kebijakan Privasi / Privacy Policy"}
                  {activeModal === "contact" && "✉️ Hubungi Kami / Contact Us"}
                  {activeModal === "disclaimer" && "⚠️ Penyangkalan Hukum / Disclaimer"}
                </span>
              </h3>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="text-xs font-bold text-zinc-400 hover:text-white bg-zinc-800 hover:bg-zinc-700 px-3 py-1.5 rounded-xl transition cursor-pointer"
              >
                Tutup ✖
              </button>
            </div>
            
            {/* Content Body */}
            <div className="p-6 overflow-y-auto max-h-[60vh] text-xs text-zinc-350 leading-relaxed space-y-4">
              
              {activeModal === "about" && (
                <div className="space-y-3">
                  <h4 className="font-extrabold text-white text-sm">Tentang HLS 15s Frame Master</h4>
                  <p>
                    <strong>HLS 15s Frame Master</strong> dikembangkan khusus untuk memecahkan hambatan produksi klip digital. 
                    Banyak kreator kesulitan memotong tayangan live-stream RTMP/HLS berformat m3u8 untuk dijadikan konten promosi di media sosial. 
                    Editor ini dirancang super ringan, aman, dan bekerja 100% secara client-side di browser pengguna.
                  </p>
                  <p>
                    Dengan didukung teknologi akselerasi hardware canvas lokal, browser Anda melakukan perekaman frame-by-frame 
                    dan menyatukan teks overlay visual tanpa memerlukan server cloud yang mahal atau membocorkan video pribadi Anda.
                  </p>
                  <h5 className="font-bold text-white mt-4">Visi Utama Kami</h5>
                  <ul className="list-disc pl-4 space-y-1 text-zinc-400">
                    <li>Demokratisasi tools editing video cepat untuk kreator di negara berkembang.</li>
                    <li>Menghilangkan rantai rendering lambat demi meningkatkan efisiensi waktu unggah harian.</li>
                    <li>Menyediakan tipografi modern beresolusi tajam guna mengoptimasi CTR organik secara instan.</li>
                  </ul>
                </div>
              )}

              {activeModal === "privacy" && (
                <div className="space-y-3">
                  <h4 className="font-extrabold text-white text-sm">Kebijakan Privasi Pengguna</h4>
                  <p>
                    Kami sangat menghargai privasi data Anda. Silakan pelajari poin-poin perlindungan privasi yang kami terapkan berikut ini:
                  </p>
                  <div className="space-y-3 pl-2 border-l-2 border-emerald-500/30">
                    <p>
                      <strong>1. Tidak Ada Unggah Video ke Server:</strong> Semua proses streaming .m3u8, konversi google drive, crop orientasi, 
                      hingga download video webm diproses 100% secara lokal pada memori laptop atau komputer Anda. Kami tidak memiliki server penyimpanan video.
                    </p>
                    <p>
                      <strong>2. Cookie & localStorage:</strong> Kami hanya menggunakan penyimpanan lokal browser (localStorage) untuk mengingat tulisan overlay, stiker logo, dan preferensi pengaturan posisi kanvas agar tidak hilang saat Anda melakukan refresh halaman.
                    </p>
                    <p>
                      <strong>3. Analitik Anonim:</strong> Kami tidak melacak data sensitif pribadi. Hanya statistik lalu lintas web dasar yang dicatat demi perbaikan stabilitas platform di masa yang akan datang.
                    </p>
                  </div>
                  <p className="text-zinc-500 text-[10px] mt-4">Pembaruan terakhir kebijakan privasi dilakukan pada tanggal 20 Juni 2026.</p>
                </div>
              )}

              {activeModal === "contact" && (
                <div className="space-y-3">
                  <h4 className="font-extrabold text-white text-sm">Hubungi Tim Kami</h4>
                  <p>
                    Apakah Anda memiliki pertanyaan teknis, kendala kerja sama integration, atau saran peningkatan performa algoritma render? 
                    Tim support kami siap mendengarkan umpan balik Anda secara terbuka.
                  </p>
                  <div className="bg-zinc-950 p-4 rounded-2xl border border-zinc-850 space-y-2 mt-2">
                    <p className="flex items-center gap-2">
                      <span className="font-black text-white">📧 Surel Resmi:</span>
                      <a href="mailto:support@framemaster.pro" className="text-emerald-400 hover:underline">support@framemaster.pro</a>
                    </p>
                    <p className="flex items-center gap-2">
                      <span className="font-black text-white">🌐 Developer Portal:</span>
                      <span className="text-zinc-400">Silicon Oasis Tech Lab Ltd.</span>
                    </p>
                    <p className="flex items-center gap-2">
                      <span className="font-black text-white">🕒 Jam Operasional:</span>
                      <span className="text-zinc-400">Senin - Jumat, 09.00 - 17.00 WIB</span>
                    </p>
                  </div>
                  <p className="text-zinc-400 text-[11px] italic mt-2">
                    Catatan: Kami biasanya membalas semua pesan bantuan maksimal dalam 24-48 jam kerja. Terima kasih banyak atas kesabaran Anda.
                  </p>
                </div>
              )}

              {activeModal === "disclaimer" && (
                <div className="space-y-3">
                  <h4 className="font-extrabold text-white text-sm">Penyangkalan Pertanggungjawaban (Disclaimer)</h4>
                  <div className="bg-amber-500/10 border border-amber-500/20 text-amber-300 p-3 rounded-xl mb-3 font-semibold">
                    Aplikasi ini ditujukan murni sebagai alat bantu (tool) produktivitas editing video orisinal milik kreator demi efisiensi publikasi.
                  </div>
                  <p>
                    <strong>1. Hak Cipta Konten Suara/Gambar:</strong> Pengguna memegang tanggung jawab mutlak atas lisensi, hak eksklusif, serta hak intelektual dari video asal m3u8 atau file lokal yang diproses menggunakan alat ini. Kami menolak keras penggunaan konten untuk melanggar hak cipta pihak ketiga.
                  </p>
                  <p>
                    <strong>2. Ketersediaan Layanan:</strong> Mengingat streaming m3u8 bergantung sepenuhnya pada server host eksternal, kami tidak menjamin kelancaran koneksi stream apabila dilingkupi hambatan pembatasan CORS atau pemblokiran wilayah (geo-blocking).
                  </p>
                  <p>
                    <strong>3. Batasan Hukum:</strong> Kami tidak bertanggung jawab atas segala tuntutan ganti rugi, penangguhan akun sosial media, atau kerugian digital lainnya yang diakibatkan oleh penyalahgunaan video hasil ekspor atau pelanggaran kebijakan komunitas sosial media eksternal (TikTok, Facebook, dsb) oleh pihak pengguna.
                  </p>
                </div>
              )}

            </div>

            {/* Footer button inside modal */}
            <div className="border-t border-zinc-800 px-6 py-4 flex justify-end bg-zinc-950/20">
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="bg-emerald-400 text-zinc-950 hover:bg-emerald-300 px-5 py-2 rounded-xl text-xs font-black cursor-pointer"
              >
                Paham & Mengerti
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

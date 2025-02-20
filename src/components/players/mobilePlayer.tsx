/* eslint-disable @typescript-eslint/no-unused-vars */
import React, {
  useState,
  useEffect,
  useRef,
  SVGProps,
  useCallback,
  useMemo,
} from "react";
import { motion, AnimatePresence, PanInfo, useAnimation } from "framer-motion";
import {
  Heart,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  ChevronDown,
  Music,
  Download,
  Share2,
  Radio,
  Plus,
  Library,
  Shuffle,
  Repeat,
  Repeat1,
  Mic2,
  ListMusic,
  ArrowLeft,
  MoreHorizontal,
  Cast,
  Airplay,
  Ban,
  Crown,
  Fan,
  CircleDollarSign,
  Share,
  Star,
  Flag,
  AlertCircle,
  Lock,
  UserPlus,
  Trash2,
  ListX,
  Guitar,
} from "lucide-react";

import { Track, Lyric } from "@/lib/types/types";
import Image from "next/image";
import { usePalette } from 'react-palette';

type AudioQuality = "MAX" | "HIGH" | "NORMAL" | "DATA_SAVER";
type RepeatMode = "off" | "all" | "one";

interface MobilePlayerProps {
  currentTrack: Track;
  isPlaying: boolean;
  previousTracks: Track[];
  setQueue: React.Dispatch<React.SetStateAction<Track[]>>;
  togglePlay: () => void;
  skipTrack: () => void | Promise<void>;
  previousTrack: () => void;
  downloadTrack: (track: Track) => Promise<void>;
  seekPosition: number;
  duration: number;
  handleSeek: (time: number) => void;
  isLiked: boolean;
  repeatMode: RepeatMode;
  setRepeatMode: (mode: RepeatMode) => void;
  toggleLike: () => void;
  removeFromQueue: (index: number) => void;
  lyrics: Lyric[];
  currentLyricIndex: number;
  showLyrics: boolean;
  toggleLyricsView: () => void;
  shuffleOn: boolean;
  shuffleQueue: () => void;
  queue: Track[];
  currentTrackIndex: number;
  onQueueItemClick: (track: Track, index: number) => void;
  setIsPlayerOpen: (isOpen: boolean) => void;
  listenCount: number;
}

// ------------------------------------
// Utility
// ------------------------------------
const formatTime = (seconds: number): string => {
  if (!seconds || isNaN(seconds) || seconds < 0) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

// ------------------------------------
// Seekbar
// ------------------------------------
interface SeekbarProps {
  progress: number; // 0..1
  handleSeek: (time: number) => void;
  isMiniplayer?: boolean;
  duration: number;
}

const Seekbar: React.FC<SeekbarProps> = ({
  progress,
  handleSeek,
  isMiniplayer = false,
  duration,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [localProgress, setLocalProgress] = useState(progress);
  const progressRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isDragging) {
      setLocalProgress(isNaN(progress) ? 0 : progress);
    }
  }, [progress, isDragging]);

  const calculateProgress = useCallback((clientX: number): number => {
    if (!progressRef.current) return 0;
    const rect = progressRef.current.getBoundingClientRect();
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  }, []);

  const handleDragStart = (clientX: number) => {
    setIsDragging(true);
    setLocalProgress(calculateProgress(clientX));
  };

  const handleDragMove = useCallback(
    (clientX: number) => {
      if (isDragging) {
        const newP = calculateProgress(clientX);
        setLocalProgress(isNaN(newP) ? 0 : newP);
      }
    },
    [isDragging, calculateProgress]
  );

  const handleDragEnd = useCallback(() => {
    if (isDragging) {
      handleSeek(localProgress * duration);
      setIsDragging(false);
    }
  }, [isDragging, localProgress, duration, handleSeek]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => handleDragMove(e.clientX);
    const handleTouchMove = (e: TouchEvent) =>
      handleDragMove(e.touches[0].clientX);
    const handleEnd = () => handleDragEnd();

    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("touchmove", handleTouchMove);
      window.addEventListener("mouseup", handleEnd);
      window.addEventListener("touchend", handleEnd);
    }

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("mouseup", handleEnd);
      window.removeEventListener("touchend", handleEnd);
    };
  }, [isDragging, handleDragMove, handleDragEnd]);

  return (
    <div className="mx-4 relative">
      <div
        ref={progressRef}
        className={`seekbar-container relative w-full ${
          isMiniplayer ? "h-0.5" : "h-1"
        } cursor-pointer`}
        onMouseDown={(e) => handleDragStart(e.clientX)}
        onTouchStart={(e) => handleDragStart(e.touches[0].clientX)}
        style={{
          height: isMiniplayer ? "2px" : "4px",
          borderRadius: "2px",
          overflow: "hidden",
          appearance: "none",
        }}
      >
        <motion.div
          className="seekbar-progress absolute left-0 top-0 h-full"
          style={{
            backgroundColor: "#ffffff",
            opacity: 1,
            borderRadius: "2px",
            willChange: "width",
          }}
          animate={{ width: `${isNaN(localProgress) ? 0 : localProgress * 100}%` }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
        />
      </div>
    </div>
  );
};

// ------------------------------------
// Quality Badge
// ------------------------------------
const QualityBadge: React.FC<{
  quality: AudioQuality;
  onClick: () => void;
}> = ({ quality, onClick }) => {
  const icons = {
    MAX: Crown,
    HIGH: Star,
    NORMAL: Fan,
    DATA_SAVER: CircleDollarSign,
  };

  const qualityColors = {
    MAX: "bg-gradient-to-r from-yellow-600 to-yellow-800",
    HIGH: "bg-gradient-to-r from-purple-500 to-purple-700",
    NORMAL: "bg-gradient-to-r from-blue-500 to-blue-700",
    DATA_SAVER: "bg-gradient-to-r from-green-500 to-green-700",
  };

  const Icon = icons[quality];

  return (
    <motion.button
      className={`px-4 py-1 rounded-full text-xs font-medium ${qualityColors[quality]} text-white inline-flex items-center justify-center space-x-1.5`}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
    >
      <Icon className="w-3 h-3" />
      <span>{quality}</span>
    </motion.button>
  );
};

// ------------------------------------
// ActionButton (icon+label cell)
// ------------------------------------
const ActionButton: React.FC<{
  icon: React.FC<SVGProps<SVGSVGElement>>;
  label: string;
  active?: boolean;
  onClick?: () => void;
}> = ({ icon: Icon, label, active, onClick }) => (
  <motion.button
    className="flex flex-col items-center space-y-1"
    onClick={onClick}
    whileHover={{ scale: 1.05 }}
    whileTap={{ scale: 0.95 }}
  >
    <div
      className={`w-12 h-12 rounded-full flex items-center justify-center
        ${
          active
            ? "bg-[#1a237e]/20 text-green-500"
            : "bg-white/10 text-white/60"
        }
        transition-all duration-200 hover:bg-white/20`}
    >
      <Icon className="w-6 h-6" />
    </div>
    <span className="text-xs text-white/60">{label}</span>
  </motion.button>
);

// ------------------------------------
// Main MobilePlayer Component
// ------------------------------------
const MobilePlayer: React.FC<MobilePlayerProps> = ({
  currentTrack,
  isPlaying,
  togglePlay,
  setQueue,
  previousTracks,
  skipTrack,
  previousTrack,
  seekPosition,
  repeatMode,
  setRepeatMode,
  duration,
  handleSeek,
  isLiked,
  listenCount,
  toggleLike,
  lyrics,
  currentLyricIndex,
  showLyrics,
  toggleLyricsView,
  shuffleOn,
  shuffleQueue,
  queue,
  currentTrackIndex,
  removeFromQueue,
  onQueueItemClick,
  setIsPlayerOpen,
  downloadTrack,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [audioQuality, setAudioQuality] = useState<AudioQuality>("MAX");
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  const [showAudioMenu, setShowAudioMenu] = useState(false);
  const [showAddToPlaylistModal, setShowAddToPlaylistModal] = useState(false);
  const [showQueueUI, setShowQueueUI] = useState(false);
  const [miniPlayerTouchStartY, setMiniPlayerTouchStartY] = useState<
    number | null
  >(null);
  const [dominantColor, setDominantColor] = useState<string | null>(null);
  const [userScrolling, setUserScrolling] = useState(false);
  const userScrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const isAutoScrollingRef = useRef(false);
  const lyricsRef = useRef<HTMLDivElement>(null);
  const [canShowActions, setCanShowActions] = useState(true);
  const { data } = usePalette(currentTrack.album.cover_medium);

  useEffect(() => {
    let resizeTimeout: NodeJS.Timeout | null = null;

    const handleResize = () => {
      if (resizeTimeout) clearTimeout(resizeTimeout);

      resizeTimeout = setTimeout(() => {
        setCanShowActions(window.innerWidth > 375);
      }, 100); // Throttle updates
    };

    // Initial call
    handleResize();

    window.addEventListener("resize", handleResize);

    return () => {
      if (resizeTimeout) clearTimeout(resizeTimeout);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  const controls = useAnimation();

  // Additional “More Options” items
  const moreOptionsItems = [
    { icon: Heart, label: "Like", active: isLiked, onClick: toggleLike },
    {
      icon: Ban,
      label: "Dislike",
      onClick: () => console.log("Disliked track"),
    },
    {
      icon: Share2,
      label: "Share",
      onClick: () => console.log("Shared track to social"),
    },
    {
      icon: UserPlus,
      label: "Follow Artist",
      onClick: () => console.log("Followed artist"),
    },
    {
      icon: Radio,
      label: "Start Radio",
      onClick: () => console.log("Started radio"),
    },
    {
      icon: Library,
      label: "Add to Playlist",
      onClick: () => setShowAddToPlaylistModal(true),
    },
    {
      icon: Share,
      label: "Copy Link",
      onClick: () => console.log("Link Copied"),
    },
    {
      icon: Music,
      label: "Lyrics",
      active: showLyrics,
      onClick: toggleLyricsView,
    },
    {
      icon: Flag,
      label: "Report",
      onClick: () => console.log("Reported track"),
    },
    {
      icon: Download,
      label: "Download",
      onClick: () => downloadTrack(currentTrack),
    },
    {
      icon: Lock,
      label: "Audio Quality",
      onClick: () => setShowAudioMenu(true),
    },
    {
      icon: AlertCircle,
      label: "Song Info",
      onClick: () => console.log("Song Info displayed"),
    },
    {
      icon: Mic2,
      label: "Karaoke Mode",
      onClick: () => console.log("Karaoke mode started"),
    },
  ];

  // We can limit certain visible action buttons for smaller screens
  const getVisibleActionButtons = () => {
    // Only show action buttons if screen is large enough and we explicitly want to show them
    if (!canShowActions) {
      return [];
    }
    // For larger screens, return all action buttons
    return [
      { icon: Heart, label: "Like", active: isLiked, onClick: toggleLike },
      {
        icon: Plus,
        label: "Add to",
        onClick: () => setShowAddToPlaylistModal(true),
      },
      {
        icon: Download,
        label: "Download",
        onClick: () => downloadTrack(currentTrack),
      },
    ];
  };

  // Handle user scroll in lyrics
  const handleUserScroll = () => {
    if (isAutoScrollingRef.current) return;
    setUserScrolling(true);
    if (userScrollTimeoutRef.current)
      clearTimeout(userScrollTimeoutRef.current);
    userScrollTimeoutRef.current = setTimeout(() => {
      setUserScrolling(false);
    }, 3000);
  };

  // Expand / collapse main player
  const togglePlayer = () => {
    setIsExpanded(!isExpanded);
    setIsPlayerOpen(!isExpanded);
  };

  // Extract approximate color from track cover
  useEffect(() => {
    if (!currentTrack.album.cover_medium) {
      setDominantColor("#000000");
      return;
    }

    let isCancelled = false;

    const img = new window.Image();
    img.crossOrigin = "Anonymous";
    img.src = currentTrack.album.cover_medium;

    img.onload = () => {
      if (isCancelled) return;

      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      canvas.width = 1;
      canvas.height = 1;
      ctx.drawImage(img, 0, 0, 1, 1);

      const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
      const color = `rgb(${r}, ${g}, ${b})`;
      setDominantColor(color);
    };

    img.onerror = () => {
      if (!isCancelled) setDominantColor("#000000");
    };

    return () => {
      // Prevent state updates on unmounted component
      isCancelled = true;
    };
  }, [currentTrack.album.cover_medium]);

  // Lyrics auto-scroll
  const processedLyrics = useMemo(() => {
    return lyrics.map((lyric, i) => ({
      ...lyric,
      endTime: lyrics[i + 1]?.time || duration,
    }));
  }, [lyrics, duration]);

  const getLyricProgress = () => {
    if (currentLyricIndex === -1 || !processedLyrics[currentLyricIndex])
      return 0;
    const currentL = processedLyrics[currentLyricIndex];
    const start = currentL.time;
    const end = currentL.endTime || duration;
    const segmentDuration = end - start;
    const elapsed = seekPosition - start;
    return Math.min(Math.max(elapsed / segmentDuration, 0), 1);
  };

  const lyricProgress = getLyricProgress();

  useEffect(() => {
    if (!showLyrics || !lyricsRef.current) return;
    if (!userScrolling) {
      const container = lyricsRef.current;
      const currentLyricEl = container.children[
        currentLyricIndex
      ] as HTMLElement;
      if (currentLyricEl) {
        isAutoScrollingRef.current = true;
        const offsetTop = currentLyricEl.offsetTop;
        const offsetHeight = currentLyricEl.offsetHeight;
        const containerHeight = container.clientHeight;
        const scrollPos = offsetTop - containerHeight / 2 + offsetHeight / 2;
        container.scrollTo({ top: scrollPos, behavior: "smooth" });
        setTimeout(() => {
          isAutoScrollingRef.current = false;
        }, 1000);
      }
    }
  }, [currentLyricIndex, showLyrics, userScrolling]);

  // Swipe up to expand miniplayer
  const handleMiniPlayerTouchStart = (e: React.TouchEvent) => {
    setMiniPlayerTouchStartY(e.touches[0].clientY);
  };

  const handleMiniPlayerTouchMove = (e: React.TouchEvent) => {
    if (miniPlayerTouchStartY !== null) {
      const deltaY = miniPlayerTouchStartY - e.touches[0].clientY;
      if (deltaY > 50) {
        setIsExpanded(true);
        setIsPlayerOpen(true);
        setMiniPlayerTouchStartY(null);
      }
    }
  };

  const handleMiniPlayerTouchEnd = () => {
    setMiniPlayerTouchStartY(null);
  };

  // Double-click logic for skip vs. seek
  let backClickCount = 0;
  const handleBackClick = () => {
    backClickCount++;
    if (backClickCount === 1) {
      setTimeout(() => {
        if (backClickCount === 1) {
          if (seekPosition > 5) {
            handleSeek(0);
          } else {
            previousTrack();
          }
        }
        backClickCount = 0;
      }, 300);
    } else if (backClickCount === 2) {
      previousTrack();
      backClickCount = 0;
    }
  };

  let forwardClickCount = 0;
  const handleForwardClick = () => {
    forwardClickCount++;
    if (forwardClickCount === 1) {
      setTimeout(() => {
        if (forwardClickCount === 1) {
          const timeLeft = duration - seekPosition;
          if (timeLeft <= 5) {
            skipTrack();
          } else {
            handleSeek(duration);
          }
        }
        forwardClickCount = 0;
      }, 300);
    } else if (forwardClickCount === 2) {
      skipTrack();
      forwardClickCount = 0;
    }
  };

  // Horizontal drag logic to skip track
  const handleMiniPlayerDragEnd = (info: PanInfo) => {
    const threshold = 100;
    if (info.offset.x > threshold) {
      controls.start({ x: "100%", transition: { duration: 0.3 } }).then(() => {
        previousTrack();
        controls.set({ x: "-100%" });
        controls.start({ x: 0, transition: { duration: 0.3 } });
      });
    } else if (info.offset.x < -threshold) {
      controls.start({ x: "-100%", transition: { duration: 0.3 } }).then(() => {
        skipTrack();
        controls.set({ x: "100%" });
        controls.start({ x: 0, transition: { duration: 0.3 } });
      });
    } else {
      controls.start({ x: 0, transition: { type: "spring", stiffness: 300 } });
    }
  };

  const handleDragEnd = (info: PanInfo) => {
    const threshold = 100;
    if (info.offset.x > threshold) {
      controls.start({ x: "100%", transition: { duration: 0.3 } }).then(() => {
        previousTrack();
        controls.set({ x: "-100%" });
        controls.start({ x: 0, transition: { duration: 0.3 } });
      });
    } else if (info.offset.x < -threshold) {
      controls.start({ x: "-100%", transition: { duration: 0.3 } }).then(() => {
        skipTrack();
        controls.set({ x: "100%" });
        controls.start({ x: 0, transition: { duration: 0.3 } });
      });
    } else {
      controls.start({ x: 0, transition: { type: "spring", stiffness: 300 } });
    }
  };

  // Main player control cluster
  const mainControlButtons = (
    <div className="w-full flex items-center justify-between mb-8">
      <button
        onClick={shuffleQueue}
        className={`p-3 rounded-full ${
          shuffleOn ? "text-green-500" : "text-white/60 hover:bg-white/10"
        }`}
      >
        <Shuffle className="w-6 h-6" />
      </button>
      <div className="flex items-center space-x-8">
        <button
          className="p-2 hover:bg-white/10 rounded-full transition-colors flex items-center justify-center"
          onClick={handleBackClick}
        >
          <SkipBack className="w-6 h-6 text-white" />
        </button>
        <motion.button
          className="w-16 h-16 rounded-full bg-white flex items-center justify-center hover:bg-white/90 transition-colors"
          whileTap={{ scale: 0.95 }}
          onClick={togglePlay}
        >
          {isPlaying ? (
            <Pause className="w-8 h-8 text-black" />
          ) : (
            <Play className="w-8 h-8 text-black ml-1" />
          )}
        </motion.button>
        <button
          className="p-2 hover:bg-white/10 rounded-full transition-colors flex items-center justify-center"
          onClick={handleForwardClick}
        >
          <SkipForward className="w-6 h-6 text-white" />
        </button>
      </div>
      <button
        onClick={() => {
          const modes: RepeatMode[] = ["off", "all", "one"];
          const currentIndex = modes.indexOf(repeatMode);
          const nextMode = modes[(currentIndex + 1) % modes.length];
          setRepeatMode(nextMode);
        }}
        className="p-3 rounded-full"
      >
        {repeatMode === "one" ? (
          <Repeat1 className="w-6 h-6 text-green-500" />
        ) : (
          <Repeat
            className={`w-6 h-6 ${
              repeatMode === "all" ? "text-green-500" : "text-white/60"
            }`}
          />
        )}
      </button>
    </div>
  );

  return (
    <div className="px-6 flex flex-col items-center">
      <div className="fixed bottom-[calc(4rem+env(safe-area-inset-bottom))] left-0 right-0 z-50">
        {/* --- Miniplayer --- */}
        {!isExpanded && (
          <motion.div
            className="mx-2 rounded-xl overflow-hidden mb-[env(safe-area-inset-bottom)]"
            style={{
              background: dominantColor
                ? `linear-gradient(to bottom, ${dominantColor}CC, rgba(0,0,0,0.95))`
                : "rgba(0,0,0,0.85)",
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
            }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.2}
            onDragEnd={(event, info) => handleMiniPlayerDragEnd(info)}
            animate={controls}
            onClick={() => {
              setIsExpanded(true);
              setIsPlayerOpen(true);
            }}
            onTouchStart={handleMiniPlayerTouchStart}
            onTouchMove={handleMiniPlayerTouchMove}
            onTouchEnd={handleMiniPlayerTouchEnd}
          >
            <div className="p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3 flex-1 min-w-0">
                  <motion.div
                    className="relative w-12 h-12 rounded-lg overflow-hidden"
                    whileHover={{ scale: 1.05 }}
                  >
                    <Image
                      src={currentTrack.album.cover_medium || ""}
                      alt={currentTrack.title || ""}
                      fill
                      sizes="(max-width: 768px) 48px, 96px"
                      className="object-cover"
                      priority
                    />
                  </motion.div>
                  <div className="flex-1 min-w-0">
                    <div className="text-white font-medium truncate">
                      {currentTrack.title}
                    </div>
                    <p className="text-white/60 text-sm truncate">
                      {currentTrack.artist.name}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2 justify-center">
                  <button
                    className="p-2 hover:bg-white/10 rounded-full transition-colors"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleBackClick();
                    }}
                  >
                    <SkipBack className="w-5 h-5 text-white" />
                  </button>
                  <button
                    className="p-2 hover:bg-white/10 rounded-full transition-colors"
                    onClick={(e) => {
                      e.stopPropagation();
                      togglePlay();
                    }}
                  >
                    {isPlaying ? (
                      <Pause className="w-5 h-5 text-white" />
                    ) : (
                      <Play className="w-5 h-5 text-white" />
                    )}
                  </button>
                  <button
                    className="p-2 hover:bg-white/10 rounded-full transition-colors"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleForwardClick();
                    }}
                  >
                    <SkipForward className="w-5 h-5 text-white" />
                  </button>
                  <button
                    className="p-2 hover:bg-white/10 rounded-full transition-colors"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleLike();
                    }}
                  >
                    <Heart
                      className={`w-5 h-5 ${
                        isLiked
                          ? "fill-green-500 text-green-500"
                          : "text-white/60"
                      }`}
                    />
                  </button>
                </div>
              </div>
              <div className="mt-2">
                <Seekbar
                  progress={seekPosition / duration}
                  handleSeek={handleSeek}
                  duration={duration}
                  isMiniplayer
                />
              </div>
            </div>
          </motion.div>
        )}

        {/* --- Expanded Player --- */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              className="fixed inset-0 z-50 flex flex-col"
              style={{
                background: "rgba(0,0,0,0.92)",
                backdropFilter: "blur(20px)",
                WebkitBackdropFilter: "blur(20px)",
                paddingBottom: "env(safe-area-inset-bottom)",
              }}
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 26, stiffness: 300 }}
            >
              {/* Header */}
              <div className="flex items-center justify-between p-4">
                <button
                  className="p-2 hover:bg-white/10 rounded-full transition-colors"
                  onClick={togglePlayer}
                >
                  <ChevronDown className="w-6 h-6 text-white" />
                </button>
                <div className="flex items-center space-x-2">
                  <button className="p-2 hover:bg-white/10 rounded-full transition-colors">
                    <Cast className="w-5 h-5 text-white/60" />
                  </button>
                  <button className="p-2 hover:bg-white/10 rounded-full transition-colors">
                    <Airplay className="w-5 h-5 text-white/60" />
                  </button>
                  <button
                    className="p-2 hover:bg-white/10 rounded-full transition-colors"
                    onClick={() => setShowQueueUI(true)}
                  >
                    <ListMusic className="w-5 h-5 text-white/60" />
                  </button>
                  {/* Only show More options in header when action buttons are hidden */}
                  {!canShowActions && (
                    <button
                      className="p-2 hover:bg-white/10 rounded-full transition-colors"
                      onClick={() => setShowMoreOptions(true)}
                    >
                      <MoreHorizontal className="w-5 h-5 text-white/60" />
                    </button>
                  )}
                </div>
              </div>

              <div className="px-4 flex-grow flex flex-col items-center">
                {showQueueUI ? (
                  // Queue UI
                  <div
                    className="h-[calc(100vh-15vh)] w-full overflow-y-auto"
                    style={{
                      paddingBottom: "calc(6rem + env(safe-area-inset-bottom))",
                    }}
                  >
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center">
                        <button
                          onClick={() => setShowQueueUI(false)}
                          className="hover:bg-white/10 p-2 rounded-full transition-colors"
                        >
                          <ArrowLeft className="w-6 h-6 text-white" />
                        </button>
                        <h2 className="text-lg font-semibold text-white ml-4">
                          Up Next
                        </h2>
                      </div>
                      <button
                        onClick={() => setQueue([])}
                        className="flex items-center space-x-2 px-4 py-2 bg-white/10 rounded-full hover:bg-white/20"
                      >
                        <ListX className="w-5 h-5 text-white" />
                        <span className="text-sm text-white">Clear Queue</span>
                      </button>
                    </div>

                    <div className="space-y-4">
                      {/* Previous Tracks (history) */}
                      {previousTracks.map((t, i) => (
                        <motion.div
                          key={`prev-${t.id}-${i}`}
                          className="flex items-center space-x-4 p-2 rounded-lg opacity-50 hover:opacity-70 transition-opacity cursor-pointer"
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => onQueueItemClick(t, -1 * (i + 1))}
                        >
                          <div className="w-12 h-12 rounded-lg overflow-hidden">
                          <Image
                            src={t.album.cover_medium}
                            alt={t.title}
                            fill
                            sizes="(max-width: 768px) 48px, 96px"
                            className="object-cover"
                          />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-gray-400 font-medium truncate">
                              {t.title}
                            </p>
                            <p className="text-gray-500 text-sm truncate">
                              {t.artist.name}
                            </p>
                          </div>
                        </motion.div>
                      ))}

                      {/* Actual Queue */}
                      {queue.map((tr, i) => (
                        <AnimatePresence key={`queue-${tr.id}-${i}`}>
                          <motion.div className="relative">
                            <motion.div
                              className="relative bg-black"
                              drag="x"
                              dragConstraints={{ left: 0, right: 0 }}
                              dragElastic={0.2}
                              onDragEnd={(event, info: PanInfo) => {
                                if (info.offset.x < -100) {
                                  removeFromQueue(i);
                                }
                              }}
                            >
                              <div
                                className={`flex items-center space-x-4 p-2 rounded-lg bg-black ${
                                  tr.id === currentTrack.id
                                    ? "bg-white/10"
                                    : "hover:bg-white/10"
                                }`}
                                onClick={() => onQueueItemClick(tr, i)}
                              >
                                <div className="w-12 h-12 relative rounded-lg overflow-hidden">
                                <Image
                                  src={tr.album.cover_medium}
                                  alt={tr.title}
                                  fill
                                  sizes="(max-width: 768px) 48px, 96px"
                                  className="object-cover"
                                />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-white font-medium truncate">
                                    {tr.title}
                                  </p>
                                  <p className="text-white/60 text-sm truncate">
                                    {tr.artist.name}
                                  </p>
                                </div>
                                <button
                                  className="p-2 hover:bg-white/10 rounded-full transition-colors"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setShowMoreOptions(true);
                                  }}
                                >
                                  <MoreHorizontal className="w-5 h-5 text-white/60" />
                                </button>
                              </div>
                            </motion.div>
                          </motion.div>
                        </AnimatePresence>
                      ))}
                    </div>
                  </div>
                ) : showLyrics ? (
                  // Lyrics View
                  <div
                    className="h-[calc(100vh-10vh)] w-full overflow-y-auto"
                    onScroll={handleUserScroll}
                  >
                    <div className="flex items-center mb-6">
                      <button
                        onClick={toggleLyricsView}
                        className="hover:bg-white/10 p-2 rounded-full transition-colors"
                      >
                        <ArrowLeft className="w-6 h-6 text-white" />
                      </button>
                      <h2 className="text-lg font-semibold text-white ml-4">
                        Lyrics
                      </h2>
                    </div>
                    <div
                      className="space-y-6 overflow-y-auto"
                      ref={lyricsRef}
                      style={{ height: "calc(100% - 4rem)" }}
                    >
                      {processedLyrics.map((ly, idx) => {
                        const isActive = idx === currentLyricIndex;

                        if (!isActive) {
                          return (
                            <motion.p
                              key={idx}
                              initial={{ opacity: 0.5 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                              transition={{ duration: 0.3 }}
                              className="text-lg text-center text-white/40 hover:text-white"
                              onClick={() => handleSeek(ly.time)}
                            >
                              {ly.text}
                            </motion.p>
                          );
                        }

                        // For active lyrics, animate letters
                        const letters = ly.text.split("");
                        const totalLetters = letters.length;
                        const filled = Math.floor(lyricProgress * totalLetters);

                        return (
                          <motion.p
                            key={idx}
                            className="text-lg text-center font-bold text-white"
                            initial="hidden"
                            animate="visible"
                          >
                            {letters.map((letter, i2) => (
                              <motion.span
                                key={i2}
                                initial={{ color: "rgba(255,255,255,0.4)" }}
                                animate={{
                                  color:
                                    i2 < filled
                                      ? "rgba(255,255,255,1)"
                                      : "rgba(255,255,255,0.4)",
                                }}
                                transition={{
                                  duration: 0.3,
                                  delay: i2 * 0.05, // Add delay per letter for smoother animation
                                }}
                              >
                                {letter}
                              </motion.span>
                            ))}
                          </motion.p>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  // Expanded Player (artwork, controls, etc.)
                  <>
                    <div className="relative w-full h-[min(60vw,320px)] flex justify-center items-center mb-8">
                      <div
                        className="absolute inset-0"
                        style={{
                          backgroundImage: `linear-gradient(to bottom, rgba(0,0,0,0.5), rgba(0,0,0,0.8)), url(${currentTrack.album.cover_medium})`,
                          backgroundSize: "cover",
                          backgroundPosition: "center",
                          filter: "blur(25px) brightness(1.2) saturate(1.3)", // Increased brightness and saturation
                          transform: "scale(1.8)", // Slightly reduced from 2 for more visible effect
                          opacity: 0.95, // Increased opacity for more visibility
                          mask: "radial-gradient(circle at center, black 40%, transparent 80%)", // Adjusted gradient stops
                          WebkitMask: "radial-gradient(circle at center, black 40%, transparent 80%)",
                          zIndex: -1,
                        }}
                      />
                      <motion.div
                        drag="x"
                        dragConstraints={{ left: 0, right: 0 }}
                        dragElastic={0.2}
                        onDragEnd={(event, info) => handleDragEnd(info)}
                        className="relative z-10 w-[min(60vw,320px)] h-[min(60vw,320px)]"
                      >
                        <Image
                          src={currentTrack.album.cover_medium || ""}
                          alt={currentTrack.title || ""}
                          fill
                          sizes="(max-width: 768px) 60vw, 320px"
                          className="rounded-lg shadow-xl object-cover"
                          priority
                        />
                      </motion.div>
                    </div>     
                    <div className="w-full text-center mb-8">
                      <h2 className="text-2xl font-bold text-white mb-2">
                        {currentTrack.title}
                      </h2>
                      <p className="text-white/60">
                        {currentTrack.artist.name}
                      </p>
                    </div>
                    <div className="flex flex-col items-center">
                      <QualityBadge
                        quality={audioQuality}
                        onClick={() => setShowAudioMenu(true)}
                      />
                      <p className="text-[#FFD700] text-xs mt-1 flex items-center space-x-1">
                        <Guitar className="w-4 h-4 inline-block" />
                        <span>Listened {listenCount} times</span>
                      </p>
                    </div>
                    <div className="w-full mb-8 mt-6">
                      <Seekbar
                        progress={seekPosition / duration}
                        handleSeek={handleSeek}
                        duration={duration}
                      />
                      <div className="flex justify-between text-sm text-white/60 mt-2 px-6">
                        <span>{formatTime(seekPosition)}</span>
                        <span>{formatTime(duration)}</span>
                      </div>
                    </div>
                    {mainControlButtons}
                    {/* Only render if we have buttons to show */}
                    {getVisibleActionButtons().length > 0 && (
                      <div className="w-full flex flex-wrap justify-center gap-8 mb-4">
                        {getVisibleActionButtons().map((btn, i) => (
                          <ActionButton
                            key={i}
                            icon={btn.icon}
                            label={btn.label}
                            active={btn.active}
                            onClick={btn.onClick}
                          />
                        ))}
                        <div className="md:hidden">
                          <ActionButton
                            icon={MoreHorizontal}
                            label="More"
                            onClick={() => setShowMoreOptions(true)}
                          />
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Audio Quality Menu */}
              <AnimatePresence>
                {showAudioMenu && (
                  <motion.div
                    className="fixed inset-0 bg-black/80 z-50"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setShowAudioMenu(false)}
                  >
                    <motion.div
                      className="absolute bottom-0 left-0 right-0 bg-zinc-900/95 rounded-t-3xl"
                      initial={{ y: "100%" }}
                      animate={{ y: 0 }}
                      exit={{ y: "100%" }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="p-4">
                        <div className="w-12 h-1 bg-white/20 rounded-full mx-auto mb-6" />
                        <h3 className="text-lg font-bold text-white mb-4 text-center">
                          Audio Quality
                        </h3>
                        {(
                          [
                            "MAX",
                            "HIGH",
                            "NORMAL",
                            "DATA_SAVER",
                          ] as AudioQuality[]
                        ).map((qual) => (
                          <button
                            key={qual}
                            className={`w-full flex items-center justify-between p-4 rounded-lg mb-2 transition-all
                              ${
                                audioQuality === qual
                                  ? "bg-white/10"
                                  : "hover:bg-white/5"
                              }`}
                            onClick={() => {
                              setAudioQuality(qual);
                              setShowAudioMenu(false);
                            }}
                          >
                            <div className="flex flex-col items-start justify-center">
                              <p className="text-white font-semibold leading-none">
                                {qual}
                              </p>
                              <p className="text-sm text-white/60 leading-none mt-1">
                                {qual === "MAX" &&
                                  "HiFi Plus (24-bit, up to 192kHz)"}
                                {qual === "HIGH" && "HiFi (16-bit, 44.1kHz)"}
                                {qual === "NORMAL" && "High (320kbps)"}
                                {qual === "DATA_SAVER" &&
                                  "Data Saver (128kbps)"}
                              </p>
                            </div>
                            {qual === audioQuality && (
                              <div className="w-6 h-6 rounded-full bg-[#1a237e] flex items-center justify-center">
                                <motion.div
                                  className="w-3 h-3 bg-white rounded-full"
                                  layoutId="quality-indicator"
                                />
                              </div>
                            )}
                          </button>
                        ))}
                        <button
                          className="w-full py-4 text-white/60 hover:text-white transition-all mt-4 text-center"
                          onClick={() => setShowAudioMenu(false)}
                        >
                          Cancel
                        </button>
                      </div>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* More Options Menu */}
              <AnimatePresence>
                {showMoreOptions && (
                  <motion.div
                    className="fixed inset-0 bg-black/80 z-50"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setShowMoreOptions(false)}
                  >
                    <motion.div
                      className="absolute bottom-0 left-0 right-0 bg-zinc-900/95 rounded-t-3xl max-h-[80%] overflow-y-auto"
                      initial={{ y: "100%" }}
                      animate={{ y: 0 }}
                      exit={{ y: "100%" }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="p-4">
                        <div className="w-12 h-1 bg-white/20 rounded-full mx-auto mb-6" />
                        <div className="grid grid-cols-3 gap-4 mb-8">
                          {moreOptionsItems.map((item, index) => (
                            <ActionButton
                              key={index}
                              icon={item.icon}
                              label={item.label}
                              active={item.active}
                              onClick={() => {
                                item.onClick?.();
                                setShowMoreOptions(false);
                              }}
                            />
                          ))}
                        </div>
                        <button
                          className="w-full py-4 text-white/60 hover:text-white transition-colors"
                          onClick={() => setShowMoreOptions(false)}
                        >
                          Cancel
                        </button>
                      </div>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default MobilePlayer;

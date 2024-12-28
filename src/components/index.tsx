/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @next/next/no-img-element */
'use client';

import React, { useState, useEffect, useRef, useCallback, MouseEvent, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Home,
  Search,
  Library,
  Bell,
  Clock,
  Cog,
  Play,
  Shuffle,
  Plus,
  User,
  Download,
  Music,
  LogOut,
  ChevronLeft,
  X,
  ChevronRight,
  Heart,
  Trash
} from 'lucide-react';
import debounce from 'lodash/debounce';

import { useAudio } from "../lib/useAudio";
import {
  openIDB,
  storeQueue,
  clearQueue,
  storeTrackBlob,
  getOfflineBlob,
  storePlaylist,
  getAllPlaylists,
  deletePlaylistByName,
  storeRecentlyPlayed,
  getRecentlyPlayed,
  storeListenCount,
  getListenCounts,
  storeSetting,
  getSetting,
  getQueue
} from '../lib/idbWrapper';

import MobilePlayer from './mobilePlayer';
import DesktopPlayer from './DesktopPlayer';
import { setupMediaSession } from '../lib/useMediaSession';
import { cn } from '../lib/utils';
import Onboarding from './Onboarding';
import { handleFetchLyrics } from '../lib/lyrics';
import audioElement from '../lib/audioManager';

interface Track {
  id: string;
  title: string;
  artist: { name: string };
  album: {
    title: string;
    cover_medium: string;
    cover_small: string;
    cover_big: string;
    cover_xl: string;
  };
}

interface Playlist {
  name: string;
  image: string;
  tracks: Track[];
  pinned?: boolean;
  downloaded?: boolean;
}

interface Lyric {
  time: number;
  endTime?: number;
  text: string;
}

interface ContextMenuOption {
  label: string;
  action: () => void;
}

interface Position {
  x: number;
  y: number;
}

interface CustomContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  options: ContextMenuOption[];
}

interface TrackItemProps {
  track: Track;
  showArtist?: boolean;
  inPlaylistCreation?: boolean;
  onTrackClick?: (track: Track, index: number) => void;
  addToQueue?: (track: Track) => void;
  openAddToPlaylistModal?: (track: Track) => void;
  toggleLike?: (track: Track) => void;
  isLiked?: boolean;
  index?: number;
  isPrevious?: boolean;
}

interface Artist {
  id: number;
  name: string;
  picture_medium: string;
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface AudioState {
  audioElement: HTMLAudioElement | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
}


declare global {
  interface Window {
    deferredPrompt?: BeforeInstallPromptEvent;
  }
}

const API_BASE_URL = 'https://mbck.cloudgen.xyz';

async function setupDiscordRPC(trackTitle: string, artistName: string) {
  console.log('[Discord RPC] Setting presence:', { trackTitle, artistName });
}

function isDataSaverMode() {
  const nav = navigator as any;
  if (nav.connection && nav.connection.saveData) return true;
  if (nav.connection && nav.connection.effectiveType === '2g') return true;
  return false;
}

function getDynamicGreeting() {
  const now = new Date();
  const currentHour = now.getHours();
  if (currentHour >= 5 && currentHour < 12) return 'Good Morning!';
  else if (currentHour >= 12 && currentHour < 17) return 'Good Afternoon!';
  else if (currentHour >= 17 && currentHour < 21) return 'Good Evening!';
  else return 'Good Night!';
}


export function SpotifyClone() {
  // STATE
  const [view, setView] = useState<'home' | 'search' | 'playlist' | 'settings' | 'library'>('home');
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [jumpBackIn, setJumpBackIn] = useState<Track[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [searchResults, setSearchResults] = useState<Track[]>([]);
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  // const [isPlaying, setIsPlaying] = useState(false);
  const [queue, setQueue] = useState<Track[]>([]); // Initialize queue state
  const [previousTracks, setPreviousTracks] = useState<Track[]>([]);
  const [shuffleOn, setShuffleOn] = useState(false);
  // const [volume, setVolume] = useState(1);
  const [repeatMode, setRepeatMode] = useState<'off' | 'all' | 'one'>('off');
  const [seekPosition, setSeekPosition] = useState(0);
  // const [duration, setDuration] = useState(0);
  const [showQueue, setShowQueue] = useState(false);
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState<Position>({ x: 0, y: 0 });
  const [contextMenuTrack, setContextMenuTrack] = useState<Track | null>(null);
  const [showCreatePlaylist, setShowCreatePlaylist] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [newPlaylistImage, setNewPlaylistImage] = useState<string | null>(null);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [isPlayerOpen, setIsPlayerOpen] = useState(false);
  const [showAddToPlaylistModal, setShowAddToPlaylistModal] = useState(false);
  const [selectedPlaylistForAdd, setSelectedPlaylistForAdd] = useState<string | null>(null);
  const [showSearchInPlaylistCreation, setShowSearchInPlaylistCreation] = useState(false);
  const [selectedTracksForNewPlaylist, setSelectedTracksForNewPlaylist] = useState<Track[]>([]);
  const [currentPlaylist, setCurrentPlaylist] = useState<Playlist | null>(null);
  const [contextMenuOptions, setContextMenuOptions] = useState<ContextMenuOption[]>([]);
  // const [isLiked, setIsLiked] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [isDownloading, setIsDownloading] = useState(false);
  const [showLyrics, setShowLyrics] = useState(false);
  const [lyrics, setLyrics] = useState<Lyric[]>([]);
  const [currentLyricIndex, setCurrentLyricIndex] = useState(0);
  const [listenCount, setListenCount] = useState(0);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [showPwaModal, setShowPwaModal] = useState(false);
  const [greeting, setGreeting] = useState(getDynamicGreeting());
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchType, setSearchType] = useState('tracks');
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [audioQuality, setAudioQuality] = useState<'MAX' | 'HIGH' | 'NORMAL' | 'DATA_SAVER'>('HIGH');
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showArtistSelection, setShowArtistSelection] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [recommendedTracks, setRecommendedTracks] = useState<Track[]>([]);


  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const pausedAtRef = useRef(0);


  const {
    isPlaying,
    setIsPlaying,
    duration,
    volume,
    setVolume,
    getCurrentPlaybackTime,
    pauseAudio,
    handleSeek,
    playTrackFromSource,
    onVolumeChange,
    loadAudioBuffer,
    setOnTrackEndCallback,
  } = useAudio();
  
  

  // Update greeting hourly
  useEffect(() => {
    const timer = setInterval(() => {
      setGreeting(getDynamicGreeting());
    }, 60 * 60 * 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let animFrame: number | null = null;
    function updateLyric() {
      if (!audioElement) {
        animFrame = requestAnimationFrame(updateLyric);
        return;
      }
      const currentTime = audioElement.currentTime;
      const activeIndex = lyrics.findIndex((ly, i) => {
        const isLast = i === lyrics.length - 1;
        const nextTime = isLast ? Infinity : lyrics[i + 1].time;
        return currentTime >= ly.time && currentTime < nextTime;
      });
      if (activeIndex !== -1 && activeIndex !== currentLyricIndex) {
        setCurrentLyricIndex(activeIndex);
      }
      animFrame = requestAnimationFrame(updateLyric);
    }
    animFrame = requestAnimationFrame(updateLyric);
    return () => {
      if (animFrame) cancelAnimationFrame(animFrame);
    };
  }, [lyrics, currentLyricIndex]);

  // Debounced search
  const fetchSearchResults = useMemo(
    () =>
      debounce(async (query: string) => {
        try {
          console.log('Fetching:', query); // Debug
          const resp = await fetch(`${API_BASE_URL}/api/search/tracks?query=${encodeURIComponent(query)}`);
          const data = await resp.json();
          if (data && data.results) {
            console.log('Results:', data.results); // Debug
            setSearchResults(data.results as Track[]);
          }
        } catch (error) {
          console.log('Search error:', error);
        }
      }, 300),
    []
  );
  

  const fetchLyrics = useCallback(async (track: Track) => {
    try {
      const lyrics = await handleFetchLyrics(track);
      setLyrics(lyrics);
    } catch (err) {
      console.log('Lyrics error:', err);
      setLyrics([]);
    }
  }, []);


  // main play
  const playTrack = useCallback((track: Track) => {
    setPreviousTracks((prev) => (currentTrack ? [currentTrack, ...prev] : prev));
    
    setQueue((prev) => {
      const filtered = prev.filter((t) => t.id !== track.id);
      return [track, ...filtered];
    });
  
    setCurrentTrack(track);
    setIsPlaying(true);
    void playTrackFromSource(track, 0);
  }, [currentTrack, setIsPlaying, playTrackFromSource]);
  
  

  const togglePlay = useCallback(() => {
    if (!currentTrack || !audioElement) return;
    
    if (isPlaying) {
      audioElement.pause();
    } else {
      void audioElement.play();
    }
    
    setIsPlaying(!isPlaying);
  }, [currentTrack, isPlaying, setIsPlaying]);

  const previousTrackFunc = useCallback(() => {
    if (!previousTracks.length || !audioElement) {
      alert('Cannot go to the previous track: no track in history.');
      return;
    }
    
    const lastTrack = previousTracks[0];
    setPreviousTracks((prev) => prev.slice(1));
    setQueue((q) => [lastTrack, ...q.filter((tk) => tk.id !== lastTrack.id)]);
    setCurrentTrack(lastTrack);
    
    void playTrackFromSource(lastTrack, 0);
  }, [previousTracks, playTrackFromSource]);
  
  
  const skipTrack = useCallback(() => {
    if (!currentTrack || queue.length <= 1 || !audioElement) {
      alert('Cannot skip track: no next track available.');
      return;
    }

    setPreviousTracks((prev) => (currentTrack ? [currentTrack, ...prev] : prev));

    setQueue((q) => {
      const [, ...rest] = q;
      if (rest.length === 0) {
        setCurrentTrack(null);
        setIsPlaying(false);
      } else {
        setCurrentTrack(rest[0]);
        void playTrackFromSource(rest[0], 0);
      }
      return rest;
    });
  }, [currentTrack, queue, setIsPlaying, playTrackFromSource]);
  
  

  
  
  
  const resetToStart = useCallback(() => {
    if (queue.length === 0) return;
    
    // Keep the original queue intact
    setCurrentTrack(queue[0]);
    setQueue(queue);
  }, [queue]);
  
  const handleTrackEnd = useCallback(() => {
    if (!currentTrack || !audioElement) return;
  
    switch (repeatMode) {
      case 'one':
        audioElement.currentTime = 0;
        void audioElement.play();
        break;
  
      case 'all': {
        const isLastTrack = queue.findIndex((t) => t.id === currentTrack.id) === queue.length - 1;
        if (isLastTrack) {
          setCurrentTrack(queue[0]);
          void playTrackFromSource(queue[0], 0);
        } else {
          skipTrack();
        }
        break;
      }
  
      case 'off':
      default:
        if (queue.length > 1) {
          skipTrack();
        } else {
          setIsPlaying(false);
          audioElement.pause();
        }
        break;
    }
  }, [currentTrack, repeatMode, queue, playTrackFromSource, skipTrack, setIsPlaying]);

   // INTRO: Setup / OnMount
   useEffect(() => {
    setMounted(true);
    
    if (isDataSaverMode()) {
      setAudioQuality('DATA_SAVER');
      void storeSetting('audioQuality', 'DATA_SAVER');
    }

    if (audioElement) {
      audioElement.volume = volume;
      audioElement.addEventListener('timeupdate', () => {
        if (audioElement) {
          setCurrentTime(audioElement.currentTime);
          setSeekPosition(audioElement.currentTime);
        }
      });
      
      audioElement.addEventListener('ended', handleTrackEnd);
    }

    return () => {
      if (audioElement) {
        audioElement.removeEventListener('timeupdate', () => {});
        audioElement.removeEventListener('ended', handleTrackEnd);
      }
    };
  }, [handleTrackEnd, volume]);

  
  // Add this effect to handle playback when currentTrack changes
  useEffect(() => {
    if (currentTrack && audioElement) {
      void playTrackFromSource(currentTrack, 0);
      setIsPlaying(true); // Ensure playing state is true
    }
  }, [currentTrack, playTrackFromSource, setIsPlaying]);

  useEffect(() => {
    if (!audioElement) return;
  
    const handleEnded = () => {
      handleTrackEnd();
    };
  
    audioElement.addEventListener('ended', handleEnded);
  
    return () => {
      if (audioElement) {
        audioElement.removeEventListener('ended', handleEnded);
      }
    };
  }, [handleTrackEnd]);

  // cycle audio
  const onCycleAudioQuality = useCallback(() => {
    const arr: Array<'MAX' | 'HIGH' | 'NORMAL' | 'DATA_SAVER'> = ['MAX', 'HIGH', 'NORMAL', 'DATA_SAVER'];
    const i = arr.indexOf(audioQuality);
    const next = arr[(i + 1) % arr.length];
    setAudioQuality(next);
    void storeSetting('audioQuality', next);
  }, [audioQuality]);

  const isMounted = useRef(false);

    useEffect(() => {
      isMounted.current = true;
      return () => {
        isMounted.current = false;
      };
    }, []);

    useEffect(() => {
      setOnTrackEndCallback(handleTrackEnd);
    }, [handleTrackEnd, setOnTrackEndCallback]);

    // Corresponding useEffect in index.tsx:
    useEffect(() => {
      if (!audioElement) {
        console.warn("Audio element is null during setup");
        return;
      }
    
      const cleanup = setupMediaSession(
        currentTrack,
        isPlaying,
        {
          getCurrentPlaybackTime: () => audioElement?.currentTime || 0,
          handleSeek: (time) => {
            if (audioElement) {
              audioElement.currentTime = time;
            }
          },
          playTrackFromSource,
          pauseAudio,
          previousTrackFunc,
          skipTrack,
          setIsPlaying,
          audioRef: { current: audioElement },
        }
      );
    
      return () => {
        cleanup();
      };
    }, [
      currentTrack,
      isPlaying,
      pauseAudio,
      playTrackFromSource,
      previousTrackFunc,
      skipTrack,
      setIsPlaying,
    ]);
    
  useEffect(() => {
    if (currentTrack) {
      storeSetting('currentTrack', JSON.stringify(currentTrack));
    }
  }, [currentTrack]);

  
  // Onboarding
  const startOnboarding = useCallback(() => {
    setShowOnboarding(true);
  }, []);

  // init
  useEffect(() => {
    async function init() {
      try {
        // Load settings
        const [vol, sOn, qual, pls, rec, onboard, savedTrack, savedQueue] = await Promise.all([
          getSetting('volume'),
          getSetting('shuffleOn'),
          getSetting('audioQuality'),
          getAllPlaylists(),
          getRecentlyPlayed(),
          getSetting('onboardingDone'),
          getSetting('currentTrack'),
          getQueue(),
        ]);
  
        if (vol) setVolume(parseFloat(vol));
        if (sOn) setShuffleOn(JSON.parse(sOn));
        if (qual) setAudioQuality(qual as 'MAX' | 'HIGH' | 'NORMAL' | 'DATA_SAVER');
        if (pls) setPlaylists(pls);
        if (rec) setJumpBackIn(rec);
        if (!onboard) setShowOnboarding(true);
  
        if (savedTrack) {
          const track: Track = JSON.parse(savedTrack);
          setCurrentTrack(track);
          setIsPlaying(true);
        }
  
        if (savedQueue && savedQueue.length > 0) {
          setQueue(savedQueue);
        } else if (savedTrack) {
          // Initialize queue with currentTrack if queue is empty
          setQueue([JSON.parse(savedTrack)]);
        }
      } catch (error) {
        console.error('Initialization error:', error);
      }
    }
  
    void init();
  }, [setIsPlaying, setVolume]);
  
  

  useEffect(() => {
    if (queue.length > 0) {
      void storeQueue(queue).catch((err) =>
        console.error('Failed to store queue in IDB:', err)
      );
    } else {
      void clearQueue().catch((err) =>
        console.error('Failed to clear queue in IDB:', err)
      );
    }
  }, [queue]);
  

  // if current track, load & play
  useEffect(() => {
    if (!currentTrack) return;
    void playTrackFromSource(currentTrack).then(() => {
      setIsPlaying(true);
      // lyrics
      void fetchLyrics(currentTrack);
      // liked?
      const ls = playlists.find((p) => p.name === 'Liked Songs');
      if (ls && ls.tracks.some((t) => t.id === currentTrack.id)) {
        // setIsLiked(true);
      } else {
        // setIsLiked(false);
      }
      // recently
      void storeRecentlyPlayed(currentTrack).then((recent) => setJumpBackIn(recent));
      // count
      void getListenCounts().then((c) => {
        setListenCount(c[currentTrack.id] || 0);
      });
      // Discord RPC
      void setupDiscordRPC(currentTrack.title, currentTrack.artist.name);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTrack]);

  // update seek pos
  useEffect(() => {
    let t: ReturnType<typeof setInterval>;
    if (isPlaying) {
      t = setInterval(() => {
        setSeekPosition(getCurrentPlaybackTime());
      }, 1000);
    }
    return () => clearInterval(t);
  }, [isPlaying, getCurrentPlaybackTime]);

  // track liked
  const isTrackLiked = useCallback(
    (track: Track) => {
      const ls = playlists.find((p) => p.name === 'Liked Songs');
      if (!ls) return false;
      return ls.tracks.some((t) => t.id === track.id);
    },
    [playlists]
  );
  

  const sanitizeTrack = (track: Track): Track => {
    return {
      id: track.id || 'unknown-id', // Provide a default ID if undefined
      title: track.title || 'Unknown Title', // Fallback for missing title
      artist: {
        name: track.artist?.name || 'Unknown Artist', // Safe fallback for artist.name
      },
      album: {
        title: track.album?.title || 'Unknown Album', // Safe fallback for album.title
        cover_medium: track.album?.cover_medium || '',
        cover_small: track.album?.cover_small || '',
        cover_big: track.album?.cover_big || '',
        cover_xl: track.album?.cover_xl || '',
      },
    };
  };
  
  
  
  
  const toggleLike = useCallback(
    (rawTrack: Track) => {
      if (!rawTrack) return;
  
      const track = sanitizeTrack(rawTrack);
      console.log("Toggling like for track:", track);
  
      const likedPlaylist = playlists.find((p) => p.name === 'Liked Songs');
      if (!likedPlaylist) return;
  
      const isAlreadyLiked = likedPlaylist.tracks.some((t) => t.id === track.id);
  
      const updatedPlaylists = playlists.map((playlist) => {
        if (playlist.name === 'Liked Songs') {
          const updatedTracks = isAlreadyLiked
            ? playlist.tracks.filter((t) => t.id !== track.id)
            : [...playlist.tracks, track];
  
          return { ...playlist, tracks: updatedTracks };
        }
        return playlist;
      });
  
      setPlaylists(updatedPlaylists);
  
      console.log("Updated playlists after toggle:", updatedPlaylists);
  
      Promise.all(updatedPlaylists.map((p) => storePlaylist(p))).catch((err) =>
        console.error('Error storing updated playlists:', err)
      );
    },
    [playlists]
  );
  

  const toggleLikeDesktop = useCallback(() => {
    if (currentTrack) {
      toggleLike(currentTrack);
    } else {
      console.warn("No current track to toggle like.");
    }
  }, [currentTrack, toggleLike]);
  
  // Wrapper for MobilePlayer
  const toggleLikeMobile = useCallback(() => {
    if (currentTrack) {
      toggleLike(currentTrack);
    } else {
      console.warn("No current track to toggle like.");
    }
  }, [currentTrack, toggleLike]);
  
  
  

  // queue
  const addToQueue = useCallback((tr: Track | Track[]) => {
    setQueue((prev) => {
      const arr = Array.isArray(tr) ? tr : [tr];
      const filtered = arr.filter((item) => !prev.some((pk) => pk.id === item.id));
      return [...prev, ...filtered];
    });
  }, []);
  
  const removeFromQueue = useCallback((idx: number) => {
    setQueue((q) => q.filter((_, i) => i !== idx));
  }, []);


  const onQueueItemClick = useCallback((track: Track, idx: number) => {
    if (idx < 0) {
      // From previousTracks
      setPreviousTracks((prev) => prev.filter((_, i) => i !== -idx - 1));
      setQueue((q) => [track, ...q]);
    } else {
      // From queue
      setPreviousTracks((prev) => (currentTrack ? [currentTrack, ...prev] : prev));
      setQueue((q) => q.filter((_, i) => i !== idx));
    }
    setCurrentTrack(track);
  }, [currentTrack]);
  
  

  // context menu
  const openAddToPlaylistModal = useCallback((tr: Track) => {
    setContextMenuTrack(tr);
    setShowAddToPlaylistModal(true);
  }, []);


  const handleContextMenu = useCallback(
    (evt: MouseEvent, item: Track | Playlist) => {
      evt.preventDefault();
      let options: ContextMenuOption[] = [];
      if ('id' in item) {
        // track
        options = [
          { label: 'Add to Queue', action: () => addToQueue(item) },
          { label: 'Add to Playlist', action: () => openAddToPlaylistModal(item) },
          { label: 'Add to Liked Songs', action: () => toggleLike(item) }
        ];
      } else {
        // playlist
        options = [
          {
            label: 'Pin Playlist',
            action: () => {
              const up = playlists.map((pl) => {
                if (pl.name === item.name) return { ...pl, pinned: !pl.pinned };
                return pl;
              });
              setPlaylists(up);
              void Promise.all(up.map((p) => storePlaylist(p)));
            }
          },
          {
            label: 'Delete Playlist',
            action: () => {
              void deletePlaylistByName(item.name).then((nl) => setPlaylists(nl));
            }
          }
        ];
      }
      setContextMenuOptions(options);
      setContextMenuPosition({ x: evt.clientX, y: evt.clientY });
      setShowContextMenu(true);
    },
    [addToQueue, openAddToPlaylistModal, toggleLike, playlists]
  );

  const addToPlaylist = useCallback(
    async (t: Track, name: string) => {
      const up = playlists.map((pl) => {
        if (pl.name === name) {
          const merged = [...pl.tracks, t];
          return { ...pl, tracks: merged };
        }
        return pl;
      });
      setPlaylists(up);
      await Promise.all(up.map((p) => storePlaylist(p)));
    },
    [playlists]
  );
  const handleAddToPlaylist = useCallback(() => {
    if (!selectedPlaylistForAdd || !contextMenuTrack) return;
    void addToPlaylist(contextMenuTrack, selectedPlaylistForAdd);
    setShowAddToPlaylistModal(false);
    setSelectedPlaylistForAdd(null);
  }, [selectedPlaylistForAdd, contextMenuTrack, addToPlaylist]);

  const loadImage = useCallback((src: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
}, []); // Empty dependencies array since this function doesn't depend on any props or state

  const createCompositeImage = useCallback(async (urls: string[]): Promise<string> => {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '/images/placeholder-image.png';
  
    const count = Math.min(4, urls.length);
    const size = 128; // quadrant size
    for (let i = 0; i < count; i++) {
      const img = await loadImage(urls[i]);
      const x = (i % 2) * size;
      const y = Math.floor(i / 2) * size;
      ctx.drawImage(img, x, y, size, size);
    }
    return canvas.toDataURL('image/png');
}, [loadImage]);
  

  // new playlist
  const createPlaylist = useCallback(async () => {
    if (!newPlaylistName) return;
    const pl: Playlist = {
      name: newPlaylistName,
      image: newPlaylistImage || '/placeholder.svg',
      tracks: selectedTracksForNewPlaylist
    };
    const up = [...playlists, pl];
    setPlaylists(up);
    setNewPlaylistName('');
    setNewPlaylistImage(null);
    setSelectedTracksForNewPlaylist([]);
    setShowCreatePlaylist(false);
    setShowSearchInPlaylistCreation(false);

    if (!pl.image && pl.tracks.length > 0) {
      // combine up to 4 covers
      const covers = pl.tracks.slice(0, 4).map((t) => t.album.cover_medium);
      // you can do a small canvas in memory that draws these 4 images in quadrant
      // or at least pick the first track cover if you want something simpler
      pl.image = await createCompositeImage(covers);
    }
    
    // Then store
    await storePlaylist(pl);

  }, [newPlaylistName, newPlaylistImage, playlists, selectedTracksForNewPlaylist, createCompositeImage]);

  const toggleTrackSelection = useCallback((tr: Track) => {
    setSelectedTracksForNewPlaylist((prev) =>
      prev.find((x) => x.id === tr.id) ? prev.filter((x) => x.id !== tr.id) : [...prev, tr]
    );
  }, []);

  const openPlaylist = useCallback((pl: Playlist) => {
    setCurrentPlaylist(pl);
    setView('playlist');
  }, []);

  // downloads
  const downloadTrack = useCallback(
    async (tr: Track) => {
      const buf = await loadAudioBuffer(tr.id);
      if (buf) {
        // success, stored in IDB
      }
    },
    [loadAudioBuffer]
  );

  const downloadPlaylist = useCallback(
    async (p: Playlist) => {
      setIsDownloading(true);
      setDownloadProgress(0);
      const total = p.tracks.length;
      let i = 0;
      for (const t of p.tracks) {
        await downloadTrack(t);
        i++;
        setDownloadProgress(Math.round((i / total) * 100));
      }
      p.downloaded = true;
      setIsDownloading(false);
      await storePlaylist(p);
    },
    [downloadTrack]
  );

  // shuffle
  const shuffleQueue = useCallback(() => {
    const cpy = [...queue];
    for (let i = cpy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [cpy[i], cpy[j]] = [cpy[j], cpy[i]];
    }
    setQueue(cpy);
    setShuffleOn(!shuffleOn);
    void storeSetting('shuffleOn', JSON.stringify(!shuffleOn));
  }, [queue, shuffleOn]);

  // show/hide lyrics
  const toggleLyricsView = useCallback(() => {
    setShowLyrics(!showLyrics);
  }, [showLyrics]);

  // Onboarding
  const handleOnboardingComplete = useCallback(() => {
    void storeSetting('onboardingDone', 'true');
    setShowOnboarding(false);
    setShowArtistSelection(false);
    setView('home');
  }, []);

  // Example: fetch from top artists -> recommended queue
  const handleArtistSelectionComplete = useCallback(
    async (artists: Artist[]) => {
      try {
        await storeSetting('favoriteArtists', JSON.stringify(artists));
        setShowArtistSelection(false);

        const fetchPromises = artists.map(async (artist) => {
          const r = await fetch(
            `${API_BASE_URL}/api/search/tracks?query=${encodeURIComponent(artist.name)}`
          );
          const d = await r.json();
          return (d.results || []).slice(0, 5);
        });
        const artistTracks = await Promise.all(fetchPromises);
        const all = artistTracks.flat();
        const shuffled = all.sort(() => Math.random() - 0.5);

        setQueue(shuffled);
        setSearchResults(shuffled);
        setRecommendedTracks(shuffled);

        if (shuffled.length) {
          setCurrentTrack(shuffled[0]);
          setIsPlaying(false);
        }
        const r4 = shuffled.slice(0, 4);
        setJumpBackIn(r4);

        if (!playlists.some((p) => p.name === 'Liked Songs')) {
          const newPL = {
            name: 'Liked Songs',
            image: '/images/liked-songs.webp',
            tracks: []
          };
          const updated = [...playlists, newPL];
          setPlaylists(updated);
          for (const pl of updated) {
            await storePlaylist(pl);
          }
        }
        handleOnboardingComplete();
      } catch (err) {
        console.log('Artist selection error:', err);
      }
    },
    [playlists, handleOnboardingComplete, setIsPlaying]
  );


  useEffect(() => {
    if (previousTracks.length > 0) {
      void storeSetting('previousTracks', JSON.stringify(previousTracks)).catch((err) =>
        console.error('Failed to store previous tracks:', err)
      );
    }
  }, [previousTracks]);
  
  useEffect(() => {
    async function loadPreviousTracks() {
      try {
        const savedPrevious = await getSetting('previousTracks');
        if (savedPrevious) {
          setPreviousTracks(JSON.parse(savedPrevious));
        }
      } catch (error) {
        console.error('Failed to load previous tracks:', error);
      }
    }
    void loadPreviousTracks();
  }, []);
  
  
  
  useEffect(() => {
    async function loadQueue() {
      try {
        const savedQueue = await getQueue(); // Fetch the saved queue
        if (savedQueue && savedQueue.length > 0) {
          setQueue(savedQueue); // Update the state with the loaded queue
        }
      } catch (error) {
        console.error('Failed to load queue from IndexedDB:', error);
      }
    }
    void loadQueue(); // Trigger the function
  }, []); // Empty dependency array ensures this runs only once on mount
  

  // RENDER
  if (showOnboarding) {
    return (
      <div className="fixed inset-0 bg-gradient-to-b from-gray-900 to-black custom-scrollbar overflow-y-auto">
        <Onboarding
          onComplete={handleOnboardingComplete}
          onArtistSelectionComplete={handleArtistSelectionComplete}
          API_BASE_URL={API_BASE_URL}
          setRecommendedTracks={setRecommendedTracks}
        />
      </div>
    );
  }
  


  function handleSearch(newQ: string) {
    // Only store in "recentSearches" after they've typed a full word or pressed enter
    if (newQ.trim().length > 3) {
      if (!recentSearches.includes(newQ)) {
        setRecentSearches((prev) => [...prev, newQ]);
      }
    }
    fetchSearchResults(newQ);
  }

  return (
    <div className="h-[100dvh] flex flex-col bg-black text-white overflow-hidden">
      {/* MOBILE */}
      <div className="md:hidden flex flex-col h-[100dvh]">
        <header className="p-4 flex justify-between items-center">
          <h1 className="text-xl md:text-2xl font-semibold">{greeting}</h1>
          <div className="flex space-x-4">
            <Bell className="w-6 h-6" />
            <Clock className="w-6 h-6" />
            <div className="relative">
              <button
                className="w-6 h-6 rounded-full flex items-center justify-center"
                onClick={() => setShowSettingsMenu((p) => !p)}
              >
                <Cog className="w-6 h-6 text-white" />
              </button>
              {showSettingsMenu && (
                <div className="absolute right-0 mt-2 w-48 bg-[#0a1929] rounded-lg shadow-xl z-[99999] 
                  border border-[#1e3a5f] animate-slideIn">
                  <button
                    className="flex items-center px-4 py-2.5 text-gray-300 hover:bg-[#1a237e] w-full text-left
                      transition-colors duration-200 group rounded-t-lg"
                    onClick={() => {
                      setShowSettingsMenu(false);
                      const dp = window.deferredPrompt;
                      if (dp) {
                        dp.prompt();
                        void dp.userChoice.then(() => {
                          window.deferredPrompt = undefined;
                        });
                      } else {
                        setShowPwaModal(true);
                      }
                    }}
                  >
                    <Download className="w-4 h-4 mr-3 text-[#90caf9] group-hover:text-white" />
                    Install App
                    <span className="ml-2 bg-[#1a237e] text-xs text-white px-2 py-0.5 rounded-full">
                      New
                    </span>
                  </button>
                  <button
                    className="flex items-center px-4 py-2.5 text-gray-300 hover:bg-gray-700 w-full text-left
                      rounded-b-lg"
                    onClick={() => setShowSettingsMenu(false)}
                  >
                    <LogOut className="w-4 h-4 mr-3 text-white" />
                    Log Out
                  </button>
                </div>
              )}
              {showPwaModal && (
                <div
                  className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[999999]
                  transition-all duration-300 animate-fadeIn"
                >
                  <div
                    className="bg-[#0a1929] text-white rounded-xl p-8 w-[90%] max-w-md shadow-2xl 
                    border border-[#1e3a5f] animate-slideIn m-4"
                  >
                    <h2 className="text-2xl font-bold text-center mb-6 text-[#90caf9]">Install App</h2>
                    <p className="text-gray-300">
                      On desktop, you can install the PWA by clicking the "Install App" button in the
                      URL bar if supported, or pressing the "Install" button. On Android, you can
                      tap the three dots menu in Chrome and select "Add to Home screen." On iOS, use
                      Safari's share button and select "Add to Home Screen."
                    </p>
                    <button
                      onClick={() => setShowPwaModal(false)}
                      className="mt-8 px-6 py-3 bg-[#1a237e] text-white rounded-lg w-full
                        transition-all duration-300 hover:bg-[#283593]"
                    >
                      Close
                    </button>
                    <div className="mt-4">
                      <label className="flex items-center text-sm text-gray-400 space-x-2">
                        <input
                          type="checkbox"
                          onChange={() => {
                            // if user wants to hide forever, storeSetting('hidePwaPrompt','true')
                            void storeSetting('hidePwaPrompt', 'true');
                            setShowPwaModal(false);
                          }}
                        />
                        <span>Don’t show again</span>
                      </label>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        <nav className="px-4 mb-4">
          <ul className="flex space-x-2 overflow-x-auto custom-scrollbar">
            <li>
              <button className="bg-gray-800 rounded-full px-4 py-2 text-sm font-medium">Music</button>
            </li>
            <li>
              <button className="bg-gray-800 rounded-full px-4 py-2 text-sm font-medium">Podcasts & Shows</button>
            </li>
            <li>
              <button className="bg-gray-800 rounded-full px-4 py-2 text-sm font-medium">Audiobooks</button>
            </li>
          </ul>
        </nav>

        <main className="flex-1 overflow-y-auto custom-scrollbar px-4 pb-[calc(4rem+2rem+env(safe-area-inset-bottom))]">
          {view === 'playlist' && currentPlaylist ? (
            <section>
              <div className="relative h-64 mb-4">
                <img
                  src={currentPlaylist.image || "assets/"}
                  alt={currentPlaylist.name || "Playlist's Cover"}
                  className="w-full h-full object-cover rounded-lg"
                  style={{ filter: 'blur(5px) brightness(0.5)' }}
                />
                <div className="absolute inset-0 flex flex-col justify-end p-4">
                  <h2 className="text-4xl font-bold mb-2">{currentPlaylist.name}</h2>
                  <div className="flex space-x-2">
                    <button
                      className="bg-white text-black rounded-full px-4 py-2 text-sm font-semibold"
                      onClick={() => {
                        setQueue(currentPlaylist.tracks);
                        setCurrentTrack(currentPlaylist.tracks[0]);
                        setIsPlaying(true);
                      }}
                    >
                      Play
                    </button>
                    <button
                      className="bg-gray-800 text-white rounded-full px-4 py-2 text-sm font-semibold"
                      onClick={shuffleQueue}
                    >
                      <Shuffle className="w-4 h-4" />
                    </button>
                    <button
                      className="bg-gray-800 text-white rounded-full px-4 py-2 text-sm font-semibold"
                      onClick={() => downloadPlaylist(currentPlaylist)}
                    >
                      {isDownloading ? (
                        <div className="relative flex items-center">
                          <Download
                            className={`w-4 h-4 mr-2 ${downloadProgress === 100 ? 'text-blue-500' : ''}`}
                          />
                          <span>{downloadProgress}%</span>
                        </div>
                      ) : (
                        <Download className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                {currentPlaylist.tracks.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-64">
                    <p className="text-gray-400 mb-4">This playlist is empty.</p>
                    <button
                      className="px-4 py-2 bg-blue-700 text-white rounded hover:bg-blue-600"
                      onClick={() => {
                        setShowSearchInPlaylistCreation(true);
                        setCurrentPlaylist(currentPlaylist);
                      }}
                    >
                      Add Songs
                    </button>
                  </div>
                ) : (
                  currentPlaylist.tracks.map((track, idx) => (
                    <TrackItem 
                      key={idx} 
                      track={track}
                      index={idx}
                      onTrackClick={playTrack} 
                      addToQueue={addToQueue} 
                      openAddToPlaylistModal={openAddToPlaylistModal} 
                      toggleLike={toggleLike} 
                      isLiked={isTrackLiked(track)} 
                    />
                  ))
                  
                )}
              </div>
            </section>
          ) : searchQuery ? (
            <section>
              <h2 className="text-2xl font-bold mb-4">Search Results</h2>
              <div
                className="grid gap-4 h-[calc(100vh-40vh)] overflow-y-auto custom-scrollbar"
                style={{ paddingBottom: 'calc(6rem + env(safe-area-inset-bottom))' }}
              >
                {searchResults && searchResults.length > 0 ? (
                  searchResults.map((t, idx) => (
                    <TrackItem 
                      key={t.id} 
                      track={t} 
                      index={idx}
                      onTrackClick={playTrack}
                      addToQueue={addToQueue} 
                      openAddToPlaylistModal={openAddToPlaylistModal} 
                      toggleLike={toggleLike} 
                      isLiked={isTrackLiked(t)} 
                    />
                  ))
                ) : (
                  <p>No results found.</p>
                )}
              </div>
            </section>
          ) : view === 'library' ? (
            <section>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold">Your Library</h2>
                <button className="p-2 rounded-full hover:bg-white/10" onClick={() => setShowCreatePlaylist(true)}>
                  <Plus className="w-6 h-6 text-white" />
                </button>
              </div>
              <div className={cn(
  "grid gap-4",
  sidebarCollapsed ? "grid-cols-1" : "grid-cols-1"
)}>
  {playlists.map((playlist) => (
    <div
      key={playlist.name}
      className={cn(
        "bg-gray-800 bg-opacity-40 rounded-lg flex items-center cursor-pointer relative",
        sidebarCollapsed ? "p-2 justify-center" : "p-4",
        playlist.pinned && "border-2 border-blue-900"
      )}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', playlist.name);
        e.dataTransfer.effectAllowed = 'move';
      }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        const name = e.dataTransfer.getData('text/plain');
        const di = playlists.findIndex((p) => p.name === name);
        const ti = playlists.findIndex((p) => p.name === playlist.name);
        const up = [...playlists];
        const [dragPL] = up.splice(di, 1);
        up.splice(ti, 0, dragPL);
        setPlaylists(up);
        void Promise.all(up.map((pl) => storePlaylist(pl)));
      }}
      onClick={() => openPlaylist(playlist)}
      style={{ userSelect: 'none' }}
    >
      <img 
        src={playlist.image || 'assets/'} 
        alt={playlist.name || 'Playlist Cover'} 
        className={cn(
          "rounded",
          sidebarCollapsed ? "w-10 h-10" : "w-12 h-12 mr-3"
        )} 
      />
      {!sidebarCollapsed && (
        <>
          <span className="font-medium text-sm flex-1">{playlist.name}</span>
          {playlist.downloaded && <Download className="w-4 h-4 text-green-500 ml-2" />}
          <button
            className="absolute top-2 right-2 p-1 rounded-full hover:bg-white/10"
            onClick={(e) => {
              e.stopPropagation();
              const opts: ContextMenuOption[] = [
                {
                  label: 'Pin Playlist',
                  action: () => {
                    const u2 = playlists.map((pl) =>
                      pl.name === playlist.name ? { ...pl, pinned: !pl.pinned } : pl
                    );
                    setPlaylists(u2);
                    void Promise.all(u2.map((p) => storePlaylist(p)));
                  }
                },
                {
                  label: 'Delete Playlist',
                  action: () => {
                    void deletePlaylistByName(playlist.name).then((nl) => setPlaylists(nl));
                  }
                },
                {
                  label: 'Download Playlist',
                  action: () => downloadPlaylist(playlist)
                }
              ];
              setContextMenuPosition({ x: e.clientX, y: e.clientY });
              setContextMenuOptions(opts);
              setShowContextMenu(true);
            }}
          >
            <span className="w-4 h-4 text-white">•••</span>
          </button>
        </>
      )}
    </div>
  ))}
</div>
            </section>
          ) : (
            <>
              {/* HOME */}
              <section className="mb-6">
                <div className="grid grid-cols-2 gap-2">
                  {playlists.map((pl) => (
                    <div
                      key={pl.name}
                      className="flex items-center space-x-3 bg-gray-800 bg-opacity-40 rounded-md p-2 cursor-pointer hover:bg-gray-600 transition-colors duration-200"
                    >
                      <img src={pl.image || 'assets/'} alt={pl.name || 'Playlist Cover'} className="w-10 h-10 rounded-md" />
                      <span className="font-medium text-sm">{pl.name}</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          void deletePlaylistByName(pl.name).then((nl) => setPlaylists(nl));
                        }}
                        className="ml-auto p-1 text-red-400 hover:text-red-500"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  ))}
                </div>
              </section>
              <section className="mb-6">
                {jumpBackIn.length > 0 && <h2 className="text-2xl font-bold mb-4">Jump Back In</h2>}
                {jumpBackIn.length > 0 ? (
                  <div className="flex space-x-4 overflow-x-auto custom-scrollbar no-scrollbar">
                    {jumpBackIn.map((track, idx) => (
                      <motion.div
                        key={idx}
                        className="flex-shrink-0 w-40"
                        drag="x"
                        dragConstraints={{ left: -100, right: 100 }}
                        onDragEnd={(e, info) => {
                          if (info.offset.x < -80) {
                            playTrack(track);
                          }
                        }}
                        whileTap={{ scale: 0.95 }}
                      >
                        <div className="relative">
                          <img
                            src={track.album.cover_medium || 'assets/'}
                            alt={track.title || "bruh"}
                            className="w-40 h-40 object-cover rounded-lg mb-2"
                          />
                          <button
                            className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity"
                            onClick={() => playTrack(track)}
                          >
                            <Play className="w-12 h-12 text-white" />
                          </button>
                        </div>
                        <p className="font-medium text-sm text-center">{track.title}</p>
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  <div>
                    <h2 className="text-2xl font-bold mb-4">Suggested for you</h2>
                    <div className="flex space-x-4 overflow-x-auto custom-scrollbar">
                      {searchResults.slice(0, 5).map((track, idx) => (
                        <div key={idx} className="flex-shrink-0 w-40">
                          <div className="relative">
                            <img
                              src={track.album.cover_medium || 'assets/'}
                              alt={track.title || "nruh"}
                              className="w-40 h-40 object-cover rounded-lg mb-2"
                            />
                            <button
                              className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity"
                              onClick={() => playTrack(track)}
                            >
                              <Play className="w-12 h-12 text-white" />
                            </button>
                          </div>
                          <p className="font-medium text-sm">{track.title}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </section>
              <section className="flex-1 overflow-y-auto custom-scrollbar pb-[calc(4rem+2rem+env(safe-area-inset-bottom))]">
                <h2 className="text-2xl font-bold mb-4">Recommended for you</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {recommendedTracks.length > 0 ? (
                    recommendedTracks.map((track, idx) => (
                      <TrackItem
                        key={track.id}
                        track={track}
                        index={idx}
                        onTrackClick={playTrack}
                        addToQueue={addToQueue}
                        openAddToPlaylistModal={openAddToPlaylistModal}
                        toggleLike={toggleLike}
                        isLiked={isTrackLiked(track)}
                      />
                    ))
                  ) : (
                    <p className="text-gray-400">No recommendations available.</p>
                  )}
                </div>
              </section>


            </>
          )}
        </main>

        {/* Mobile Footer Nav */}
        {!isPlayerOpen && (
          <footer
            className="bg-black p-4 flex justify-around fixed bottom-0 left-0 right-0 pb-[env(safe-area-inset-bottom)]"
            style={{ zIndex: 9999, paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom))' }}
          >
            <button
              className="flex flex-col items-center text-gray-400 hover:text-white"
              onClick={() => {
                setView('home');
                setSearchQuery('');
              }}
            >
              <Home className="w-6 h-6" />
              <span className="text-xs mt-1">Home</span>
            </button>
            <button
              className="flex flex-col items-center text-gray-400 hover:text-white"
              onClick={() => {
                setIsSearchOpen(true);
                setView('search');
              }}
            >
              <Search className="w-6 h-6" />
              <span className="text-xs mt-1">Search</span>
            </button>

            {/* Search Drawer */}
            {isSearchOpen && view === 'search' && (
              <motion.div
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 500 }}
                className="fixed inset-0 bg-black z-50 flex flex-col"
              >
                <div className="flex items-center justify-between p-4 border-b border-gray-800">
                  <button
                    onClick={() => {
                      setIsSearchOpen(false);
                      setView('home');
                    }}
                    className="p-2"
                  >
                    <ChevronLeft className="w-6 h-6 text-white" />
                  </button>
                  <h1 className="text-lg font-semibold">Search</h1>
                  <div className="w-10" />
                </div>
                <div className="p-4">
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (searchQuery.trim()) handleSearch(searchQuery);
                    }}
                    className="relative"
                  >
                    <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-500" />
                    <input
                      type="text"
                      placeholder="What do you want to listen to?"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && searchQuery.trim()) {
                          handleSearch(searchQuery);
                        }
                      }}
                      className="w-full px-4 py-3 rounded-full bg-gray-800 text-white placeholder-gray-500 
                                focus:outline-none focus:ring-2 focus:ring-green-500 pl-12 transition-all 
                                duration-200 ease-in-out"
                    />
                  </form>
                  <div className="flex gap-2 mt-4">
                    <button
                      onClick={() => setSearchType('tracks')}
                      className={`px-4 py-2 rounded-full text-sm font-medium ${
                        searchType === 'tracks'
                          ? 'bg-white text-black'
                          : 'bg-gray-800 text-white hover:bg-gray-700'
                      }`}
                    >
                      Tracks
                    </button>
                  </div>
                </div>

                {/* Recent searches */}
                {!searchQuery && recentSearches.length > 0 && (
                  <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-xl font-bold text-white/90">Recent Searches</h3>
                      <button
                        onClick={() => setRecentSearches([])}
                        className="px-4 py-2 text-sm font-medium bg-red-500 rounded hover:bg-red-600 text-white"
                      >
                        Clear All
                      </button>
                    </div>
                    <div className="space-y-2">
                      {recentSearches.map((query, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between px-4 py-3 rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors duration-200"
                        >
                          <button
                            onClick={() => {
                              setSearchQuery(query);
                              handleSearch(query);
                            }}
                            className="flex items-center space-x-4 text-left"
                          >
                            <Clock className="w-5 h-5 text-purple-400" />
                            <span className="truncate">{query}</span>
                          </button>
                          <button
                            onClick={() => {
                              const upd = recentSearches.filter((_, i2) => i2 !== idx);
                              setRecentSearches(upd);
                            }}
                            className="text-red-400 hover:text-red-500"
                          >
                            <X className="w-5 h-5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Results */}
                {searchQuery && (
                  <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
                    {searchResults.length === 0 ? (
                      <div className="text-center py-12">
                        <p className="text-gray-400">No results found for "{searchQuery}"</p>
                      </div>
                    ) : (
                      <>
                        <h2 className="text-2xl font-bold mb-4">Search Results</h2>
                        <div className="grid grid-cols-1 gap-4">
                        {searchResults.map((res, idx) => (
                          <TrackItem
                            key={res.id}
                            track={res}
                            index={idx}
                            addToQueue={addToQueue}
                            openAddToPlaylistModal={openAddToPlaylistModal}
                            toggleLike={toggleLike}
                            isLiked={isTrackLiked(res)}
                            onTrackClick={(t) => {
                              playTrack(t);
                              setIsSearchOpen(false);
                              setView('home');
                            }}
                          />
                        ))}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </motion.div>
            )}

            <button
              className="flex flex-col items-center text-gray-400 hover:text-white"
              onClick={() => setView('library')}
            >
              <Library className="w-6 h-6" />
              <span className="text-xs mt-1">Your Library</span>
            </button>
          </footer>
        )}

        {mounted && currentTrack && (
          <MobilePlayer
            currentTrack={currentTrack}
            currentTrackIndex={queue.findIndex((t) => t.id === currentTrack?.id)}
            isPlaying={isPlaying}
            removeFromQueue={removeFromQueue}
            setQueue={setQueue}
            togglePlay={togglePlay}
            skipTrack={skipTrack}
            previousTrack={previousTrackFunc}
            seekPosition={seekPosition}
            duration={duration}
            listenCount={listenCount}
            handleSeek={handleSeek}
            isLiked={currentTrack ? isTrackLiked(currentTrack) : false}
            repeatMode={repeatMode}
            setRepeatMode={setRepeatMode}
            toggleLike={toggleLikeMobile}
            lyrics={lyrics}
            currentLyricIndex={currentLyricIndex}
            queue={queue}
            previousTracks={previousTracks}
            shuffleOn={shuffleOn}
            shuffleQueue={shuffleQueue}
            showLyrics={showLyrics}
            toggleLyricsView={toggleLyricsView}
            onQueueItemClick={onQueueItemClick}
            setIsPlayerOpen={setIsPlayerOpen}
          />
        )}
      </div>

      {/* DESKTOP LAYOUT */}
      <div className="hidden md:flex flex-1 gap-2 p-2 overflow-y-auto custom-scrollbar">
        {showContextMenu && (
          <CustomContextMenu
            x={contextMenuPosition.x}
            y={contextMenuPosition.y}
            onClose={() => setShowContextMenu(false)}
            options={contextMenuOptions}
          />
        )}
        {/* Collapsible sidebar if wanted: an example toggle or just show it */}
        <aside
  className={cn(
    'bg-gradient-to-b from-gray-900 to-black rounded-lg p-4 overflow-y-auto custom-scrollbar transition-all duration-300',
    sidebarCollapsed ? 'w-20' : 'w-64'
  )}
>
  <button 
    onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
    className="p-2 rounded-full hover:bg-white/10 transition-colors duration-200"
  >
    {sidebarCollapsed ? (
      <ChevronRight className="w-5 h-5 text-white" />
    ) : (
      <ChevronLeft className="w-5 h-5 text-white" />
    )}
  </button>
  <nav className="space-y-4">
    <div className="bg-gray-800 bg-opacity-40 rounded-lg p-3 space-y-2">
      <button
        className={cn(
          "flex items-center text-white w-full py-2 px-3 rounded-lg transition-colors duration-200",
          sidebarCollapsed && "justify-center"
        )}
        onClick={() => setView('home')}
      >
        <Home className="w-6 h-6" />
        {!sidebarCollapsed && <span className="ml-3">Home</span>}
      </button>
      <button
        className={cn(
          "flex items-center text-white w-full py-2 px-3 rounded-lg transition-colors duration-200",
          sidebarCollapsed && "justify-center"
        )}
        onClick={() => setView('search')}
      >
        <Search className="w-6 h-6" />
        {!sidebarCollapsed && <span className="ml-3">Search</span>}
      </button>
    </div>
    <div className="bg-gray-800 bg-opacity-40 rounded-lg p-3">
      <div className={cn(
        "flex items-center mb-2 text-white",
        sidebarCollapsed ? "justify-center" : "justify-between"
      )}>
        <Library className="w-6 h-6" />
        {!sidebarCollapsed && (
          <>
            <span className="ml-3">Your Library</span>
            <button
              className="p-2 rounded-full hover:bg-white/10"
              onClick={() => setShowCreatePlaylist(true)}
            >
              <Plus className="w-5 h-5 text-white" />
            </button>
          </>
        )}
      </div>
      <div className="space-y-2">
        {playlists.map((pl) => (
          <div
            key={pl.name}
            className={cn(
              'flex items-center space-x-3 bg-gray-800 bg-opacity-40 rounded-md p-2 cursor-pointer hover:bg-gray-600 transition-colors duration-200',
              pl.pinned && 'border-2 border-blue-900',
              sidebarCollapsed && "justify-center"
            )}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData('text/plain', pl.name);
              e.dataTransfer.effectAllowed = 'move';
            }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const name = e.dataTransfer.getData('text/plain');
              const di = playlists.findIndex((p) => p.name === name);
              const ti = playlists.findIndex((p) => p.name === pl.name);
              const up = [...playlists];
              const [dragPL] = up.splice(di, 1);
              up.splice(ti, 0, dragPL);
              setPlaylists(up);
              void Promise.all(up.map((xx) => storePlaylist(xx)));
            }}
            onClick={() => openPlaylist(pl)}
            style={{ userSelect: 'none' }}
          >
            <img src={pl.image || "placeholder"} alt={pl.name || 'Playlist'} className="w-10 h-10 rounded-md" />
            {!sidebarCollapsed && (
              <>
                <span className="font-medium text-sm">{pl.name}</span>
                {pl.downloaded && <Download className="w-4 h-4 text-green-500 ml-2" />}
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  </nav>
</aside>

        <main className="flex-1 overflow-y-auto custom-scrollbar px-4 pb-[calc(4rem+env(safe-area-inset-bottom))] bg-gradient-to-b from-gray-900 to-black rounded-lg p-6">
          <header className="flex justify-between items-center mb-8">
            <h1 className="text-xl md:text-2xl font-semibold">{greeting}</h1>
            <div className="relative flex items-center">
              {mounted &&
                !(window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) && (
                  <>
                    <button
                      className="bg-[#1a237e] text-white rounded-full px-6 py-2.5 text-sm font-semibold ml-4
                        transition-all duration-300 hover:bg-[#283593] hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-[#1a237e] focus:ring-offset-2"
                      onClick={() => {
                        const dp = window.deferredPrompt;
                        if (dp) {
                          dp.prompt();
                          void dp.userChoice.then(() => {
                            window.deferredPrompt = undefined;
                          });
                        } else {
                          setShowPwaModal(true);
                        }
                      }}
                    >
                      <span className="flex items-center">
                        <Download className="w-5 h-5 mr-2" />
                        Install App
                      </span>
                    </button>
                    {showPwaModal && (
                      <div
                        className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[999999] 
                        transition-all duration-300 animate-fadeIn"
                      >
                        <div
                          className="bg-[#0a1929] text-white rounded-xl p-8 w-[90%] max-w-md shadow-2xl 
                          border border-[#1e3a5f] animate-slideIn"
                        >
                          <h2 className="text-2xl font-bold text-center mb-6 text-[#90caf9]">Install App</h2>
                          <p className="text-gray-300 text-center">
                            You can install this as a PWA on desktop or mobile. If your browser
                            supports it, you’ll see an install icon in the address bar or you can use
                            the button above.
                          </p>
                          <button
                            onClick={() => setShowPwaModal(false)}
                            className="mt-8 px-6 py-3 bg-[#1a237e] text-white rounded-lg w-full
                              transition-all duration-300 hover:bg-[#283593]"
                          >
                            Close
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              <div className="relative ml-4">
                <button
                  className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center"
                  onClick={() => setShowUserMenu(!showUserMenu)}
                >
                  <User className="w-5 h-5" />
                </button>
                {showUserMenu && (
                  <div className="absolute right-0 mt-2 w-64 bg-gray-900 rounded-lg shadow-xl z-10 border border-gray-700">
                    <button
                      className="flex items-center px-6 py-3 text-lg text-gray-300 hover:bg-gray-700 w-full text-left rounded-t-lg"
                      onClick={() => {
                        setView('settings');
                        setShowUserMenu(false);
                      }}
                    >
                      <Cog className="w-5 h-5 mr-3" />
                      Settings
                    </button>
                    <button
                      className="flex items-center px-6 py-3 text-lg text-gray-300 hover:bg-gray-700 w-full text-left"
                      onClick={() => setShowUserMenu(false)}
                    >
                      <User className="w-5 h-5 mr-3" />
                      Profile
                    </button>
                    <button
                      className="flex items-center px-6 py-3 text-lg text-gray-300 hover:bg-gray-700 w-full text-left rounded-b-lg"
                      onClick={() => setShowUserMenu(false)}
                    >
                      <LogOut className="w-5 h-5 mr-3" />
                      Log out
                    </button>
                  </div>
                )}
              </div>
            </div>
          </header>

          {view === 'settings' ? (
            <section>
              <h2 className="text-2xl font-bold mb-4">Settings</h2>
              <div className="space-y-4">
                <div className="bg-gray-800 bg-opacity-40 rounded-lg p-4">
                  <h3 className="text-xl font-semibold mb-2">Account</h3>
                  <p className="text-gray-400">Manage your account settings and e-mail preferences.</p>
                </div>
                <div className="bg-gray-800 bg-opacity-40 rounded-lg p-4">
                  <h3 className="text-xl font-semibold mb-2">Playback</h3>
                  <p className="text-gray-400">Customize your playback settings.</p>
                  <div className="mt-2">
                    <label className="block text-sm font-medium text-gray-400 mb-1">Default Volume</label>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.01"
                      value={volume}
                      onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
                      className="w-full h-1 bg-gray-700 rounded-full appearance-none cursor-pointer"
                    />
                  </div>
                  <div className="mt-2">
                    <label className="block text-sm font-medium text-gray-400 mb-1">Default Music Quality</label>
                    <select
                      className="w-full p-2 rounded bg-gray-700 text-white"
                      onChange={(e) => {
                        void storeSetting('musicQuality', e.target.value);
                        setAudioQuality(e.target.value as any);
                      }}
                      value={audioQuality}
                    >
                      <option value="MAX">MAX</option>
                      <option value="HIGH">HIGH</option>
                      <option value="NORMAL">NORMAL</option>
                      <option value="DATA_SAVER">DATA_SAVER</option>
                    </select>
                  </div>
                </div>
                <div className="bg-gray-800 bg-opacity-40 rounded-lg p-4">
                  <h3 className="text-xl font-semibold mb-2">Data Saver</h3>
                  <p className="text-gray-400">
                    Automatically reduce streaming quality when on cellular or if user preference is
                    set. Currently: {audioQuality}
                  </p>
                </div>
                <div className="bg-gray-800 bg-opacity-40 rounded-lg p-4">
                  <h3 className="text-xl font-semibold mb-2">Privacy</h3>
                  <p className="text-gray-400">Control your privacy settings and data usage.</p>
                </div>
                <div className="bg-gray-800 bg-opacity-40 rounded-lg p-4">
                  <h3 className="text-xl font-semibold mb-2">Notifications</h3>
                  <p className="text-gray-400">Set your notification preferences.</p>
                </div>
                <div className="bg-gray-800 bg-opacity-40 rounded-lg p-4">
                  <h3 className="text-xl font-semibold mb-2">Beta Features</h3>
                  <p className="text-gray-400">Toggle beta features on or off.</p>
                </div>
              </div>
            </section>
          ) : view === 'playlist' && currentPlaylist ? (
            <section>
              <div className="relative h-64 mb-4">
                <img
                  src={currentPlaylist.image || 'https://via.placeholder.com/150'}
                  alt={currentPlaylist.name || 'Playlist'}
                  className="w-full h-full object-cover rounded-lg"
                  style={{ filter: 'blur(5px) brightness(0.5)' }}
                />
                <div className="absolute inset-0 flex items-end p-4">
                  <div className="flex-grow">
                    <h2 className="text-4xl font-bold mb-2">{currentPlaylist.name}</h2>
                    <p className="text-sm text-gray-300">{currentPlaylist.tracks.length} tracks</p>
                  </div>
                  <div className="flex space-x-2">
                    <button
                      className="bg-white text-black rounded-full px-4 py-2 text-sm font-semibold"
                      onClick={() => {
                        setQueue(currentPlaylist.tracks);
                        setCurrentTrack(currentPlaylist.tracks[0]);
                        setIsPlaying(true);
                      }}
                    >
                      Play
                    </button>
                    <button className="bg-gray-800 text-white rounded-full px-4 py-2 text-sm font-semibold" onClick={shuffleQueue}>
                      <Shuffle className="w-4 h-4" />
                    </button>
                    <button
                      className="bg-gray-800 text-white rounded-full px-4 py-2 text-sm font-semibold"
                      onClick={() => downloadPlaylist(currentPlaylist)}
                    >
                      {isDownloading ? (
                        <div className="relative">
                          <Download className="w-4 h-4" />
                          <div
                            className="absolute inset-0 rounded-full border-2 border-green-500"
                            style={{ clipPath: `circle(${downloadProgress}% at 50% 50%)` }}
                          />
                        </div>
                      ) : (
                        <Download className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
              {currentPlaylist.tracks.map((track, idx) => (
                <TrackItem 
                  key={track.id} 
                  track={track}
                  index={idx}
                  onTrackClick={playTrack} 
                  addToQueue={addToQueue} 
                  openAddToPlaylistModal={openAddToPlaylistModal} 
                  toggleLike={toggleLike} 
                  isLiked={isTrackLiked(track)} 
                />
              ))}

              </div>
            </section>
          ) : view === 'search' ? (
            <section className="min-h-screen bg-transparent backdrop-blur-sm px-4 py-6">
              <div className="max-w-7xl mx-auto flex flex-col gap-8">
                <div className="flex flex-col space-y-6">
                  <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-purple-400 to-pink-500 text-transparent bg-clip-text text-center animate-gradient">
                    Discover Your Music
                  </h1>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (searchQuery.trim()) handleSearch(searchQuery);
                    }}
                    className="w-full max-w-2xl mx-auto"
                  >
                    <div className="relative group">
                      <Search className="absolute left-5 top-1/2 transform -translate-y-1/2 w-5 h-5 text-purple-400 group-hover:text-pink-400 transition-colors duration-300" />
                      <input
                        type="text"
                        placeholder="Search for songs, artists, or albums..."
                        value={searchQuery}
                        onChange={(e) => {
                          setSearchQuery(e.target.value);
                          if (e.target.value.trim().length > 3) fetchSearchResults(e.target.value);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && searchQuery.trim()) {
                            handleSearch(searchQuery);
                          }
                        }}                        
                        className="w-full px-14 py-4 rounded-full bg-black/20 backdrop-blur-lg
                          text-white placeholder-gray-400 border border-purple-500/20
                          focus:outline-none focus:ring-2 focus:ring-purple-500/50
                          text-[15px] transition-all duration-300 hover:bg-black/30"
                      />
                      {searchQuery && (
                        <button
                          onClick={() => {
                            setSearchQuery('');
                            fetchSearchResults('');
                          }}
                          className="absolute right-5 top-1/2 transform -translate-y-1/2 text-purple-400 
                            hover:text-pink-400 transition-colors duration-300"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                  </form>
                  <div className="flex gap-3 justify-center">
                    <button
                      onClick={() => setSearchType('tracks')}
                      className={`px-6 py-2 rounded-full text-sm font-medium transition-all duration-300 ${
                        searchType === 'tracks'
                          ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:opacity-90'
                          : 'bg-black/20 backdrop-blur-lg text-white hover:bg-black/30 border border-purple-500/20'
                      }`}
                    >
                      Tracks
                    </button>
                  </div>
                </div>
                {!searchQuery && recentSearches.length > 0 && (
                  <div className="animate-fadeIn">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-xl font-bold text-white/90">Recent Searches</h3>
                      <button
                        onClick={() => setRecentSearches([])}
                        className="px-4 py-2 text-sm font-medium bg-red-500 rounded hover:bg-red-600 text-white"
                      >
                        Clear All
                      </button>
                    </div>
                    <div className="space-y-2">
                      {recentSearches.map((q, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between px-4 py-3 rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors duration-200"
                        >
                          <button
                            onClick={() => {
                              setSearchQuery(q);
                              fetchSearchResults(q);
                            }}
                            className="flex items-center space-x-4 text-left"
                          >
                            <Clock className="w-5 h-5 text-purple-400" />
                            <span className="truncate">{q}</span>
                          </button>
                          <button
                            onClick={() => {
                              const upd = recentSearches.filter((_, i2) => i2 !== i);
                              setRecentSearches(upd);
                            }}
                            className="text-red-400 hover:text-red-500"
                          >
                            <X className="w-5 h-5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {searchQuery && (
                  <div className="animate-fadeIn">
                    {searchResults.length === 0 ? (
                      <div className="text-center py-16">
                        <p className="text-gray-400 text-lg">No results found for "{searchQuery}"</p>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center justify-between mb-6">
                          <h2 className="text-xl font-bold bg-gradient-to-r from-purple-400 to-pink-500 text-transparent bg-clip-text">
                            Search Results
                          </h2>
                          <span className="text-sm text-purple-400">{searchResults.length} items found</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {searchResults.map((r, idx) => (
                          <TrackItem
                            key={r.id}
                            track={r}
                            index={idx}
                            onTrackClick={playTrack}
                            addToQueue={addToQueue}
                            openAddToPlaylistModal={(t) => {
                              setContextMenuTrack(t);
                              setShowAddToPlaylistModal(true);
                            }}
                            toggleLike={toggleLike}
                            isLiked={isTrackLiked(r)}
                          />
                        ))}

                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            </section>
          ) : (
            <>
              {/* Possibly “Made For You” or “Recently Played” or “Listening History” */}
              {playlists.length > 0 && (
                <section className="mb-8 overflow-y-auto custom-scrollbar">
                  <h2 className="text-2xl font-bold mb-4">Recently played</h2>
                  <div className="grid grid-cols-3 gap-4">
                    {playlists.slice(0, 6).map((pl, i) => (
                      <div
                        key={i}
                        className="bg-gray-800 bg-opacity-40 rounded-lg p-4 flex items-center cursor-pointer"
                        onClick={() => openPlaylist(pl)}
                      >
                        <img src={pl.image || ''} alt={pl.name || ''} className="w-16 h-16 rounded mr-4" />
                        <span className="font-medium">{pl.name}</span>
                      </div>
                    ))}
                  </div>
                </section>
              )}
              <section className="mb-8">
                <h2 className="text-2xl font-bold mb-4">Jump Back In</h2>
                <div className="grid grid-cols-4 gap-4">
                  {jumpBackIn.map((track, i) => (
                    <div key={i}>
                      <div className="relative">
                        <img
                          src={track.album.cover_medium || ''}
                          alt={track.title || ''}
                          className="w-30 aspect-square object-cover rounded-lg mb-2"
                        />
                        <button
                          className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity"
                          onClick={() => playTrack(track)}
                        >
                          <Play className="w-12 h-12 text-white" />
                        </button>
                      </div>
                      <p className="font-medium">{track.title}</p>
                      <p className="text-sm text-gray-400">{track.artist.name}</p>
                    </div>
                  ))}
                </div>
              </section>
              <section className='flex-1 overflow-y-auto custom-scrollbar pb-32'>
                <h2 className="text-2xl font-bold mb-4">Recommended</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {recommendedTracks.length > 0 ? (
                    recommendedTracks.map((track, idx) => (
                      <TrackItem
                        key={track.id}
                        track={track}
                        index={idx}
                        onTrackClick={playTrack}
                        addToQueue={addToQueue}
                        openAddToPlaylistModal={(t) => {
                          setContextMenuTrack(t);
                          setShowAddToPlaylistModal(true);
                        }}
                        toggleLike={toggleLike}
                        isLiked={isTrackLiked(track)}
                      />
                    ))
                  ) : (
                    <p className="text-gray-400">No recommendations available.</p>
                  )}
                </div>
              </section>

            </>
          )}
        </main>

        {/* showQueue aside if wanted */}
{showQueue && (
  <aside className="w-64 bg-gradient-to-b from-gray-900 to-black rounded-lg p-4 overflow-y-auto custom-scrollbar">
    <h2 className="text-xl font-bold mb-4">Queue</h2>
    {queue.length === 0 && previousTracks.length === 0 ? (
      <div>
        <p className="text-gray-400 mb-4">Your queue is empty.</p>
        <button
          className="w-full px-4 py-2 bg-gray-800 text-white rounded hover:bg-gray-600 transition-all duration-200"
          onClick={() => {
            // Implement Add Suggestions or relevant functionality
          }}
        >
          Add Suggestions
        </button>
      </div>
    ) : (
      <div className="space-y-2">
        {previousTracks.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold mb-2 text-gray-300">Previous Tracks</h3>
            {previousTracks.map((track, idx) => (
              <TrackItem
                key={`prev-${track.id}`} // Unique key
                track={track}
                index={idx}
                isPrevious={true}
                onTrackClick={onQueueItemClick}
                addToQueue={addToQueue}
                openAddToPlaylistModal={openAddToPlaylistModal}
                toggleLike={toggleLike}
                isLiked={isTrackLiked(track)}
              />
            ))}
          </div>
        )}
        {queue.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold mb-2 text-gray-300">Up Next</h3>
            {queue.map((track, idx) => (
              <TrackItem
                key={`queue-${track.id}`} // Unique key
                track={track}
                index={idx}
                isPrevious={false}
                onTrackClick={onQueueItemClick}
                addToQueue={addToQueue}
                openAddToPlaylistModal={openAddToPlaylistModal}
                toggleLike={toggleLike}
                isLiked={isTrackLiked(track)}
              />
            ))}
          </div>
        )}
      </div>
    )}
  </aside>
)}

      </div>

      {mounted && (
  currentTrack ? (
    <footer className="fixed bottom-0 left-0 right-0">
      <DesktopPlayer
        currentTrack={currentTrack}
        isPlaying={isPlaying}
        previousTracks={previousTracks}
        setQueue={setQueue}
        togglePlay={togglePlay}
        skipTrack={skipTrack}
        previousTrack={previousTrackFunc}
        seekPosition={seekPosition}
        duration={duration}
        handleSeek={handleSeek}
        isLiked={isTrackLiked(currentTrack)}
        repeatMode={repeatMode}
        setRepeatMode={setRepeatMode}
        toggleLike={toggleLikeDesktop}
        lyrics={lyrics}
        currentLyricIndex={currentLyricIndex}
        showLyrics={showLyrics}
        toggleLyricsView={toggleLyricsView}
        shuffleOn={shuffleOn}
        shuffleQueue={shuffleQueue}
        queue={queue}
        currentTrackIndex={queue.findIndex((x) => x.id === currentTrack.id)}
        removeFromQueue={removeFromQueue}
        onQueueItemClick={onQueueItemClick}
        setIsPlayerOpen={setIsPlayerOpen}
        volume={volume}
        onVolumeChange={onVolumeChange}
        audioQuality={audioQuality}
        onCycleAudioQuality={onCycleAudioQuality}
        listenCount={listenCount}
      />
    </footer>
  ) : (
    <footer className="fixed bottom-0 left-0 right-0">
      {/* Optional: Placeholder or message when no track is playing */}
      <div className="bg-gray-800 text-white p-4 text-center">
        No track is currently playing.
      </div>
    </footer>
  )
)}

      {/* Create Playlist Modal */}
      {showCreatePlaylist && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[99999] p-4">
          <div className="bg-gradient-to-b from-gray-900 to-black rounded-2xl p-8 w-full max-w-md border border-gray-800">
            <h2 className="text-3xl font-bold mb-6 bg-gradient-to-r from-green-400 to-blue-500 text-transparent bg-clip-text">
              Create Your Playlist
            </h2>
            <div className="space-y-6">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Give your playlist a name"
                  value={newPlaylistName}
                  onChange={(e) => setNewPlaylistName(e.target.value)}
                  className="w-full px-5 py-4 rounded-xl bg-gray-800/50 text-white placeholder-gray-400
                     border border-gray-700 focus:border-green-500 focus:ring-1 focus:ring-green-500
                     transition-all duration-300 text-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-3">Choose a Cover Image</label>
                <div className="relative group">
                  <label
                    htmlFor="playlist-image"
                    className="relative flex flex-col items-center justify-center w-full aspect-square
                       rounded-xl cursor-pointer overflow-hidden transition-all duration-300
                       bg-gradient-to-br from-gray-800/50 to-gray-900/50
                       group-hover:from-gray-700/50 group-hover:to-gray-800/50
                       border-2 border-dashed border-gray-600 group-hover:border-green-500"
                  >
                    {newPlaylistImage ? (
                      <img src={newPlaylistImage || ''} alt="Playlist Cover" className="w-full h-full object-cover absolute inset-0" />
                    ) : (
                      <div className="flex flex-col items-center justify-center p-6 text-center">
                        <div className="w-16 h-16 mb-4 rounded-full bg-gray-700/50 flex items-center justify-center">
                          <svg
                            className="w-8 h-8 text-gray-400"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                          </svg>
                        </div>
                        <p className="text-sm font-medium text-gray-300 mb-1">Drop your image here</p>
                        <p className="text-xs text-gray-400">or click to browse</p>
                      </div>
                    )}
                    <input
                      id="playlist-image"
                      type="file"
                      className="hidden"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const r = new FileReader();
                        r.onloadend = () => {
                          setNewPlaylistImage(r.result as string);
                        };
                        r.readAsDataURL(file);
                      }}
                    />
                  </label>
                </div>
              </div>
              <div className="flex gap-4">
                <button
                  onClick={() => setShowCreatePlaylist(false)}
                  className="flex-1 py-3 rounded-xl border border-gray-600 text-gray-300 font-medium
                     hover:bg-gray-800/50 transition-all duration-300"
                >
                  Cancel
                </button>
                <button
                  onClick={() => void createPlaylist()}
                  className="flex-1 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600
                     hover:from-blue-600 hover:to-blue-700 text-white font-medium
                     transform transition-all duration-300 hover:scale-[1.02]"
                >
                  Create
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add songs after creation */}
      {showSearchInPlaylistCreation && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[99999] p-4">
          <div className="bg-gradient-to-b from-gray-900 to-black rounded-2xl p-8 w-full max-w-2xl border border-gray-800">
            <h2 className="text-3xl font-bold mb-6 bg-gradient-to-r from-green-400 to-blue-500 text-transparent bg-clip-text">
              Add Songs to Your Playlist
            </h2>
            <div className="relative mb-6">
              <input
                type="text"
                placeholder="Search for songs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-5 py-4 rounded-xl bg-gray-800/50 text-white placeholder-gray-400
                   border border-gray-700 focus:border-green-500 focus:ring-1 focus:ring-green-500
                   transition-all duration-300"
              />
              <Search className="absolute right-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            </div>
            <div className="space-y-2 mb-6 max-h-[50vh] overflow-y-auto custom-scrollbar">
            {searchResults.map((t, idx) => (
              <TrackItem 
                key={t.id} 
                track={t} 
                index={idx}
                inPlaylistCreation={true} 
                onTrackClick={toggleTrackSelection} 
              />
            ))}
            </div>
            <div className="flex items-center justify-between pt-4 border-t border-gray-800">
              <p className="text-sm font-medium text-gray-400">
                {selectedTracksForNewPlaylist.length} songs selected
              </p>
              <div className="flex gap-4">
                <button
                  onClick={() => setShowSearchInPlaylistCreation(false)}
                  className="px-6 py-3 rounded-xl border border-gray-600 text-gray-300
                     hover:bg-gray-800/50 transition-all duration-300"
                >
                  Cancel
                </button>
                <button
                  onClick={() => setShowSearchInPlaylistCreation(false)}
                  className="px-6 py-3 rounded-xl bg-gradient-to-r from-green-500 to-green-600
                     hover:from-green-600 hover:to-green-700 text-white font-medium
                     transform transition-all duration-300 hover:scale-[1.02]"
                >
                  Add Selected
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Context Menu
async function CustomContextMenu({ x, y, onClose, options }: CustomContextMenuProps) {
  return (
    <div
      className="fixed bg-gray-800 rounded-lg shadow-lg p-2 z-[999999]"
      style={{ top: y, left: x }}
      onMouseLeave={onClose}
    >
      {options.map((opt, i) => (
        <button
          key={i}
          className="block w-full text-left px-4 py-2 hover:bg-gray-700 text-white"
          onClick={() => {
            opt.action();
            onClose();
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function TrackItem({
  track,
  showArtist = true,
  inPlaylistCreation = false,
  onTrackClick,
  addToQueue,
  openAddToPlaylistModal,
  toggleLike,
  isLiked,
  index = 0,
  isPrevious = false, // Destructure the new prop
}: TrackItemProps) {
  const [isHovered, setIsHovered] = useState(false);

  const handleClick = (evt: React.MouseEvent) => {
    if (!inPlaylistCreation && onTrackClick) {
      onTrackClick(track, index);
    }
  };

  // Determine classes based on whether it's a previous track
  const trackClasses = cn(
    'group flex items-center gap-4 bg-gray-800/40 rounded-lg p-3 relative',
    'hover:bg-gray-700/40 transition-colors duration-200',
    inPlaylistCreation ? 'selectable' : 'cursor-pointer',
    isPrevious && 'opacity-50' // Dim previous tracks
  );

  const ActionButtons = () => (
    <div className="flex items-center space-x-2 transition-all duration-200">
      {addToQueue && (
        <ActionButton
          onClick={() => addToQueue(track)}
          icon={<Plus className="w-4 h-4" />}
        />
      )}
      {openAddToPlaylistModal && (
        <ActionButton
          onClick={() => openAddToPlaylistModal(track)}
          icon={<Library className="w-4 h-4" />}
        />
      )}
      {toggleLike && (
        <ActionButton
          onClick={() => toggleLike(track)}
          icon={
            <Heart
              className={`w-4 h-4 transition-colors ${
                isLiked ? 'fill-green-500 text-green-500' : 'text-white'
              }`}
            />
          }
        />
      )}
    </div>
  );

  return (
    <div
      className={trackClasses}
      onClick={handleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="relative min-w-[48px]">
        <img
          src={track.album?.cover_medium || '/images/placeholder-image.png'}
          alt={`${track.title || 'Track'} album cover`}
          className="w-12 h-12 rounded-md object-cover"
          loading="lazy"
        />
      </div>

      <div className="flex-grow min-w-0">
        <p className="font-medium truncate">{track.title}</p>
        {showArtist && (
          <p className="text-sm text-gray-400 truncate">
            {track.artist?.name || 'Unknown Artist'}
          </p>
        )}
      </div>

      <div className={cn(
        'transition-opacity duration-200',
        isHovered || inPlaylistCreation ? 'opacity-100' : 'opacity-0'
      )}>
        {inPlaylistCreation ? (
          <input
            type="checkbox"
            className="h-5 w-5 rounded-full border-none bg-gray-700 checked:bg-green-500 
                     transition-colors duration-200 cursor-pointer"
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <ActionButtons />
        )}
      </div>
    </div>
  );
}

// Reusable button component with tooltip
function ActionButton({ 
  onClick, 
  icon, 
}: { 
  onClick: (e: React.MouseEvent) => void,
  icon: React.ReactNode,
}) {
  return (
    <button
      className="bg-gray-700 hover:bg-gray-600 rounded-full p-2 transition-colors 
                duration-200 group relative"
      onClick={(e) => {
        e.stopPropagation();
        onClick(e);
      }}
    >
      <span className="text-white">{icon}</span>
    </button>
  );
}
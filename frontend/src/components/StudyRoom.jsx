import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Play, Pause, Square, Plus, Trash2, Camera, Mic, MicOff, VideoOff, ScreenShare, Volume2, ShieldAlert, Award, MessageSquare, Clock, Users, X, Monitor, LogOut, LogIn, CheckCircle2, Link as LinkIcon, Share2, ClipboardList, Target, AlertCircle, Headphones, Sparkles } from 'lucide-react';
import { LiveKitRoom, useTracks, VideoTrack, useLocalParticipant, RoomAudioRenderer } from '@livekit/components-react';
import { Track } from 'livekit-client';

import confetti from 'canvas-confetti';
import { fetchApi } from '../utils/api';
import { useSocket } from '../context/SocketContext';
import { getLevelInfo } from '../utils/leveling';
import YouTubePlayer from './YouTubePlayer';

const AUDIO_TRACKS = {
  none: { name: 'No Ambient Audio', url: null },
  rain: { name: 'Heavy Rain', url: 'https://actions.google.com/sounds/v1/weather/rain_heavy_loud.ogg' },
  forest: { name: 'Morning Forest', url: 'https://actions.google.com/sounds/v1/ambiences/forest_morning.ogg' },
  cafe: { name: 'Coffee Shop', url: 'https://actions.google.com/sounds/v1/ambiences/coffee_shop.ogg' },
  stream: { name: 'Flowing Stream', url: 'https://actions.google.com/sounds/v1/water/small_stream_flowing.ogg' },
  custom_youtube: { name: 'Custom YouTube Link', url: null }
};

const LiveKitVideoSidebar = () => {
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false },
  );
  return (
    <div className="video-sidebar">
      {tracks.map((trackRef) => (
        <div key={trackRef.participant.identity + trackRef.source} className="video-wrapper">
          <VideoTrack trackRef={trackRef} />
          <div className="video-overlay-info">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="participant-label">{trackRef.participant.name} {trackRef.participant.isLocal ? '(You)' : ''}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

const LiveKitMicSync = ({ isMicMuted }) => {
  const { localParticipant } = useLocalParticipant();
  
  useEffect(() => {
    if (!roomId) return;
    const storedPersonalTime = localStorage.getItem(study_timer_);
    if (storedPersonalTime) {
      setSeconds(parseInt(storedPersonalTime, 10));
    }
  }, [roomId]);

  useEffect(() => {
    if (localParticipant) {
      localParticipant.setMicrophoneEnabled(!isMicMuted);
    }
  }, [isMicMuted, localParticipant]);
  return null;
};

const EnsoCircle = () => (
  <svg 
    style={{ 
      position: 'absolute', 
      top: '50%', 
      left: '50%', 
      transform: 'translate(-50%, -50%)', 
      opacity: 0.04, 
      pointerEvents: 'none', 
      width: '85vh', 
      height: '85vh',
      maxWidth: '800px',
      maxHeight: '800px',
      animation: 'ensoRotate 60s linear infinite'
    }}
    viewBox="0 0 200 200" 
    xmlns="http://www.w3.org/2000/svg"
  >
    <path 
      fill="none" 
      stroke="#ffffff" 
      strokeWidth="5" 
      strokeLinecap="round"
      d="M100,20 C144.18278,20 180,55.81722 180,100 C180,144.18278 144.18278,180 100,180 C55.81722,180 20,144.18278 20,100 C20,60 50,25 90,20"
      style={{ filter: 'blur(1.5px)' }}
    />
  </svg>
);

function StudyRoom({ currentUser }) {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const isSolo = roomId === 'solo-focus';

  // --- STATE VARIABLES ---
  const [roomName, setRoomName] = useState(isSolo ? 'Private Workspace' : 'Loading Room...');
  const [tasks, setTasks] = useState([]);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [activeTaskId, setActiveTaskId] = useState(null);
  const [activeSidebarTab, setActiveSidebarTab] = useState('objectives'); // 'objectives' | 'history'
  const [completingTasks, setCompletingTasks] = useState([]);
  
  // Zen Mode & Objectives State
  const [isObjectivesCollapsed, setIsObjectivesCollapsed] = useState(false);
  const [isZenMode, setIsZenMode] = useState(false);
  
  // Stopwatch states
  const [seconds, setSeconds] = useState(0); // Personal study timer
  const [roomUptimeSeconds, setRoomUptimeSeconds] = useState(0); // Global room uptime
  const [timerRunning, setTimerRunning] = useState(false);
  const [isPersonalTimerRunning, setIsPersonalTimerRunning] = useState(false);
  
  // Ambient Audio
  const [ambientAudio, setAmbientAudio] = useState('none');
  const [audioVolume, setAudioVolume] = useState(0.5);
  const [youtubeUrlInput, setYoutubeUrlInput] = useState('');
  
  const user = currentUser;
  const [participants, setParticipants] = useState([]);
  const [moderatorId, setModeratorId] = useState(null);
  
  // Setup & Permissions (LOBBY FIRST)
  const [webcamEnabled, setWebcamEnabled] = useState(false);
  const [screenEnabled, setScreenEnabled] = useState(false);
  const [workspaceEntered, setWorkspaceEntered] = useState(false);
  const [setupError, setSetupError] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [isMicMuted, setIsMicMuted] = useState(false);

  // Lobby Context & Devices
  const [lobbyParticipants, setLobbyParticipants] = useState([]);
  const [videoDevices, setVideoDevices] = useState([]);
  const [audioDevices, setAudioDevices] = useState([]);
  const [selectedVideoId, setSelectedVideoId] = useState('');
  const [selectedAudioId, setSelectedAudioId] = useState('');

  // State for LiveKit
  const [liveKitToken, setLiveKitToken] = useState('');
  const [liveKitUrl, setLiveKitUrl] = useState('');
  const [liveKitError, setLiveKitError] = useState('');

  const toggleMic = () => {
    const nextMuteState = !isMicMuted;
    setIsMicMuted(nextMuteState);
    if (localCameraStreamRef.current) {
      const audioTrack = localCameraStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !nextMuteState;
      }
    }
  };

  // Ensure webcam feed attaches correctly when entering workspace
  useEffect(() => {
    if (workspaceEntered && localCameraStreamRef.current) {
      const videoEl = document.getElementById('local-webcam-feed');
      if (videoEl && videoEl.srcObject !== localCameraStreamRef.current) {
        videoEl.srcObject = localCameraStreamRef.current;
      }
    }
  }, [workspaceEntered]);

  // Invite online users state
  const [onlineUsersList, setOnlineUsersList] = useState([]);
  const [invitedUsers, setInvitedUsers] = useState({}); // maps userId -> Boolean

  // Alerts & competition announcements
  const [announcements, setAnnouncements] = useState([]);

  // --- REFS & WEBRTC CONFIG ---
  const socketRef = useRef(null);
  const localCameraStreamRef = useRef(null);
  const localScreenStreamRef = useRef(null);
  const timerIntervalRef = useRef(null);
  const heartbeatIntervalRef = useRef(null);
  const canvasRef = useRef(null); 
  const lastFrameDataRef = useRef(null); 
  const idleTicksRef = useRef(0); 
  const audioRef = useRef(null);
  const workspaceEnteredRef = useRef(false);
  const activeTaskIdRef = useRef(null);

  useEffect(() => {
    activeTaskIdRef.current = activeTaskId;
  }, [activeTaskId]);

  const globalSocket = useSocket();

  // Let LiveKit handle disconnects natively via its components


  // --- WEBSOCKET & PEERJS ROOM SYNC ---
  useEffect(() => {
    if (!user || !globalSocket) return;

    socketRef.current = globalSocket;

    // Fetch room configurations from API
    if (!isSolo) {
      fetchApi(`/api/rooms/${roomId}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.error) {
            alert('Room not found or access denied.');
            navigate('/dashboard');
          } else {
            setRoomName(data.room.name);
            setTasks(data.tasks);
            if (data.activeParticipants) {
              setLobbyParticipants(data.activeParticipants);
            }
          }
        })
        .catch(() => navigate('/dashboard'));
    } else {
      const localTasks = JSON.parse(localStorage.getItem('solo_tasks') || '[]');
      setTasks(localTasks);
    }

    const handleOnlineUsersUpdated = (users) => setOnlineUsersList(users);
    const handleRoomStateUpdated = ({ moderatorId, roomStartTime, participants, ambientAudio: serverAudio }) => {
      setModeratorId(moderatorId);
      setParticipants(participants);
      if (serverAudio) setAmbientAudio(serverAudio);
      
      if (roomStartTime) {
        setRoomUptimeSeconds(Math.floor((Date.now() - roomStartTime) / 1000));
      }
    };
    const handleRoomTimerStarted = () => {
      // Ignored: Timer is now personal
    };
    const handleTasksUpdated = (updatedTasks) => setTasks(updatedTasks);
    const handleAmbientAudioUpdated = ({ trackId }) => setAmbientAudio(trackId);
    const handleNotification = ({ message }) => alert(`Notification: ${message}`);
    const handleTaskAnnouncement = ({ username, taskTitle, timeSpentString }) => {
      const alertMsg = `${username} completed "${taskTitle}" after ${timeSpentString}!`;
      setAnnouncements((prev) => [...prev, alertMsg]);
      setTimeout(() => {
        setAnnouncements((prev) => prev.filter((msg) => msg !== alertMsg));
      }, 7000);
      confetti({ particleCount: 60, spread: 50, origin: { y: 0.8 } });
    };
    const handleRoomClosed = () => {
      alert('The host has ended this study session. Returning to dashboard.');
      navigate('/dashboard');
    };
    const handleBadgeEarned = (badge) => alert(`🏆 Achievement Unlocked: ${badge.name}! \n${badge.description}`);

    globalSocket.on('online-users-updated', handleOnlineUsersUpdated);
    globalSocket.on('room-state-updated', handleRoomStateUpdated);
    globalSocket.on('room-timer-started', handleRoomTimerStarted);
    globalSocket.on('tasks-updated', handleTasksUpdated);
    globalSocket.on('ambient-audio-updated', handleAmbientAudioUpdated);
    globalSocket.on('notification', handleNotification);
    globalSocket.on('task-announcement', handleTaskAnnouncement);
    globalSocket.on('room-closed', handleRoomClosed);
    globalSocket.on('badge-earned', handleBadgeEarned);

    // Auto-rejoin room if socket briefly drops and reconnects
    const handleConnect = () => {
      if (workspaceEnteredRef.current) {
        if (!isSolo) {
          globalSocket.emit('join-room', {
            roomId,
            userId: user.id,
            username: user.username,
            peerId: 'livekit-peer'
          });
        } else if (isSolo) {
          globalSocket.emit('join-room', {
            roomId: 'solo-focus',
            userId: user.id,
            username: user.username,
            peerId: 'solo'
          });
        }
      }
    };
    globalSocket.on('connect', handleConnect);

    return () => {
      globalSocket.off('online-users-updated', handleOnlineUsersUpdated);
      globalSocket.off('room-state-updated', handleRoomStateUpdated);
      globalSocket.off('room-timer-started', handleRoomTimerStarted);
      globalSocket.off('tasks-updated', handleTasksUpdated);
      globalSocket.off('ambient-audio-updated', handleAmbientAudioUpdated);
      globalSocket.off('notification', handleNotification);
      globalSocket.off('task-announcement', handleTaskAnnouncement);
      globalSocket.off('room-closed', handleRoomClosed);
      globalSocket.off('badge-earned', handleBadgeEarned);
      globalSocket.off('connect', handleConnect);
      
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);

      if (workspaceEnteredRef.current && !isSolo) {
        globalSocket.emit('leave-room');
      }

      // PeerJS has been removed in favor of LiveKit
      stopStreams();
    };
  }, [user, roomId, isSolo, navigate, globalSocket]);

  // --- AUDIO SYNC EFFECT ---
  useEffect(() => {
    if (audioRef.current) {
      if (ambientAudio === 'none' || ambientAudio.startsWith('youtube:') || ambientAudio === 'custom_youtube') {
        audioRef.current.pause();
      } else {
        if (AUDIO_TRACKS[ambientAudio]) {
          audioRef.current.src = AUDIO_TRACKS[ambientAudio].url;
          audioRef.current.volume = audioVolume;
          audioRef.current.play().catch(e => console.log('Audio autoplay blocked', e));
        }
      }
    }
  }, [ambientAudio]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = audioVolume;
    }
  }, [audioVolume]);

  const handleChangeAmbientAudio = (e) => {
    const trackId = e.target.value;
    if (isSolo) {
      setAmbientAudio(trackId);
    } else {
      if (moderatorId === user?.id) {
        socketRef.current.emit('change-ambient-audio', { trackId });
        setAmbientAudio(trackId);
      }
    }
  };

  const handleSetYoutubeUrl = () => {
    if (!youtubeUrlInput) return;
    const trackId = `youtube:${youtubeUrlInput}`;
    if (isSolo) {
      setAmbientAudio(trackId);
    } else {
      if (moderatorId === user?.id) {
        socketRef.current.emit('change-ambient-audio', { trackId });
        setAmbientAudio(trackId);
      }
    }
  };

  // --- PERSONAL STOPWATCH ENGINE ---
  useEffect(() => {
    if (!isPersonalTimerRunning) return;
    
    // Increment timer display locally every 1 second
    timerIntervalRef.current = setInterval(() => {
      setSeconds((prev) => {
        const newSeconds = prev + 1;
        if (roomId) localStorage.setItem(study_timer_, newSeconds);
        return newSeconds;
      });
      
      // Increment the active task's time spent locally!
      const currentActiveId = activeTaskIdRef.current;
      if (currentActiveId) {
        setTasks((prevTasks) => {
          let updated = false;
          const newTasks = prevTasks.map((t) => {
            if (t.id === currentActiveId) {
              updated = true;
              return { ...t, time_spent_seconds: (t.time_spent_seconds || 0) + 1 };
            }
            return t;
          });
          if (updated && isSoloRef.current) {
            localStorage.setItem('solo_tasks', JSON.stringify(newTasks));
          }
          return updated ? newTasks : prevTasks;
        });
      }
      
      runCameraPresenceAI();
    }, 1000);

    // Sync progress to DB via heartbeat every 15 seconds
    heartbeatIntervalRef.current = setInterval(() => {
      if (socketRef.current && !isSoloRef.current) {
        socketRef.current.emit('timer-heartbeat', {
          incrementSeconds: 15,
          activeTaskId: activeTaskIdRef.current
        });
      }
    }, 15000);

    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
      }
    };
  }, [isPersonalTimerRunning, roomId]);

  const stopStreams = () => {
    if (localCameraStreamRef.current) {
      localCameraStreamRef.current.getTracks().forEach((track) => track.stop());
    }
    if (localScreenStreamRef.current) {
      localScreenStreamRef.current.getTracks().forEach((track) => track.stop());
    }
  };

  // --- LOBBY PERMISSION ACQUISITION ---
  const authorizeWebcam = async (vidId = selectedVideoId, audId = selectedAudioId) => {
    setSetupError('');
    try {
      let constraints = { 
        video: vidId ? { deviceId: { exact: vidId } } : true, 
        audio: audId ? { deviceId: { exact: audId } } : true 
      };
      
      if (navigator.connection && navigator.connection.effectiveType) {
        const type = navigator.connection.effectiveType;
        if (type === '2g' || type === '3g') {
          constraints.video = vidId ? { deviceId: { exact: vidId }, width: { ideal: 320 }, height: { ideal: 240 }, frameRate: { ideal: 15 } } : { width: { ideal: 320 }, height: { ideal: 240 }, frameRate: { ideal: 15 } };
        } else {
          constraints.video = vidId ? { deviceId: { exact: vidId }, width: { ideal: 640 }, height: { ideal: 360 }, frameRate: { ideal: 24 } } : { width: { ideal: 640 }, height: { ideal: 360 }, frameRate: { ideal: 24 } };
        }
      }

      if (localCameraStreamRef.current) {
        localCameraStreamRef.current.getTracks().forEach(t => t.stop());
      }

      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (audioErr) {
        console.warn('Failed to get video+audio, falling back to video only:', audioErr);
        constraints.audio = false;
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      }
      
      localCameraStreamRef.current = stream;
      setWebcamEnabled(true);
      
      const previewVideo = document.getElementById('lobby-webcam-preview');
      if (previewVideo) {
        previewVideo.srcObject = stream;
      }

      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !isMicMuted;
      }

      const devices = await navigator.mediaDevices.enumerateDevices();
      const vDevices = devices.filter(d => d.kind === 'videoinput');
      const aDevices = devices.filter(d => d.kind === 'audioinput');
      setVideoDevices(vDevices);
      setAudioDevices(aDevices);

      if (!vidId && vDevices.length > 0) setSelectedVideoId(vDevices[0].deviceId);
      if (!audId && aDevices.length > 0) setSelectedAudioId(aDevices[0].deviceId);

    } catch (err) {
      console.error(err);
      setSetupError('Camera access denied. Ensure your browser has permission.');
    }
  };

  const handleVideoDeviceChange = (e) => {
    setSelectedVideoId(e.target.value);
    authorizeWebcam(e.target.value, selectedAudioId);
  };

  const handleAudioDeviceChange = (e) => {
    setSelectedAudioId(e.target.value);
    authorizeWebcam(selectedVideoId, e.target.value);
  };

  const handleEnterWorkspace = async () => {
    setWebcamEnabled(true);
    setWorkspaceEntered(true);
    workspaceEnteredRef.current = true;

    if (!isSolo) {
      // Fetch LiveKit Token
      try {
        if (localCameraStreamRef.current) {
          localCameraStreamRef.current.getTracks().forEach(t => t.stop());
          localCameraStreamRef.current = null;
        }

        const res = await fetchApi(`/api/rooms/${roomId}/token`);
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || "Could not fetch LiveKit token");
        }
        const { token, serverUrl } = await res.json();
        
        setLiveKitToken(token);
        setLiveKitUrl(serverUrl);
      } catch (err) {
        console.error("LiveKit Join Error:", err);
        setLiveKitError(err.message);
      }

      socketRef.current.emit('join-room', {
        roomId,
        userId: user.id,
        username: user.username,
        peerId: user.id
      });
    } else {
      socketRef.current.emit('join-room', {
        roomId: 'solo-focus',
        userId: user.id,
        username: user.username,
        peerId: 'solo'
      });
    }
  };

  // --- ANTI-CHEAT ENGINE (Canvas Motion Detection) ---
  const runCameraPresenceAI = () => {
    // Function disabled to prevent high CPU usage / crashing
    return;
  };

  // --- TIMER STARTER TRIGGER ---
  const handleTogglePersonalTimer = () => {
    if (tasks.length === 0) {
      alert('Please add at least one objective before starting the session!');
      return;
    }
    setIsPersonalTimerRunning(prev => !prev);
  };

  const handleAddTask = (e) => {
    e.preventDefault();
    if (!newTaskTitle) return;

    const randomId = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
    const newTask = {
      id: randomId,
      title: newTaskTitle,
      is_completed: false,
      time_spent_seconds: 0,
      owner_id: user?.id,
      owner_name: user?.username
    };
    
    // Optimistic UI Update
    const updatedTasks = [...tasks, newTask];
    setTasks(updatedTasks);

    if (isSolo) {
      localStorage.setItem('solo_tasks', JSON.stringify(updatedTasks));
    } else {
      socketRef.current.emit('task-create', { id: randomId, title: newTaskTitle });
    }
    setNewTaskTitle('');
  };

  const handleToggleTask = (taskId) => {
    // Optimistic UI update
    const updatedTasks = tasks.map((t) => {
      if (t.id === taskId) {
        const completed = !t.is_completed;
        if (completed) {
          confetti({ particleCount: 80, spread: 60 });
          if (activeTaskId === taskId) {
            setActiveTaskId(null);
          }
          setCompletingTasks(prev => [...prev, taskId]);
          setTimeout(() => {
            setCompletingTasks(prev => prev.filter(id => id !== taskId));
          }, 1500);
        }
        return { ...t, is_completed: completed };
      }
      return t;
    });
    setTasks(updatedTasks);

    if (isSolo) {
      localStorage.setItem('solo_tasks', JSON.stringify(updatedTasks));
    } else {
      socketRef.current.emit('task-toggle', { taskId });
    }
  };

  const handleEndRoomSession = async () => {
    if (isSolo) {
      localStorage.removeItem('solo_tasks');
      setTasks([]);
      navigate('/dashboard');
      return;
    }
    
    if (!isSolo && socketRef.current) socketRef.current.emit('leave-room', { roomId });
    navigate('/dashboard');
    return;

    const confirmEnd = window.confirm('Are you sure you want to end this study session? This will close the room for everyone and delete all tasks.');
    if (!confirmEnd) return;

    try {
      const response = await fetchApi(`/api/rooms/${roomId}`, {
        method: 'DELETE'
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to end room session.');
      }
    } catch (err) {
      alert(err.message);
    }
  };

  const handleSendPlatformInvite = (targetUserId) => {
    if (!socketRef.current) return;
    socketRef.current.emit('send-invite', {
      targetUserId,
      roomId,
      roomName,
      hostName: user.username
    });
    setInvitedUsers(prev => ({ ...prev, [targetUserId]: true }));
    setTimeout(() => {
      setInvitedUsers(prev => ({ ...prev, [targetUserId]: false }));
    }, 5000);
  };

  // --- HELPERS ---
  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const showToast = (message) => {
    const alertMsg = `ℹ️ ${message}`;
    setAnnouncements((prev) => [...prev, alertMsg]);
    setTimeout(() => {
      setAnnouncements((prev) => prev.filter((msg) => msg !== alertMsg));
    }, 5000);
  };

  const formatTime = (totalSecs) => {
    const hrs = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const formatTaskTimer = (totalSecs) => {
    if (!totalSecs || totalSecs <= 0) return '0:00';
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Determine which layout to show
  const showLobby = !workspaceEntered;

  return (
    <div className="container" style={{ position: 'relative' }}>
      {/* Hidden Audio Element */}
      <audio ref={audioRef} loop />

      {/* Toast Announcements container */}
      <div className="toast-container">
        {announcements.map((msg, index) => (
          <div key={index} className="toast-alert">
            {msg}
          </div>
        ))}
      </div>

      {/* 1. MANDATORY PERMISSIONS LOBBY */}
      {showLobby ? (
        <div style={{ padding: '60px 0', maxWidth: '600px', margin: '0 auto' }}>
          <div className="glass-panel" style={{ padding: '40px', textAlign: 'center' }}>
            <h2 style={{ fontSize: '1.8rem', marginBottom: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', color: 'var(--color-text-title)' }}><Camera size={28} color="#6366f1" /> {roomName !== 'Loading Room...' ? `Joining: ${roomName}` : 'Permissions Lobby'}</h2>
            {!isSolo && lobbyParticipants.length > 0 && (
              <p style={{ color: '#10b981', fontSize: '0.9rem', marginBottom: '16px', fontWeight: '600', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                <Users size={16} /> {lobbyParticipants.length} people are already here: {lobbyParticipants.map(p => p.username).join(', ')}
              </p>
            )}
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.95rem', marginBottom: '32px', lineHeight: '1.5' }}>
              StudySync requires your Webcam and Tab Share permissions to verify desk presence and active work before you can join the room.
            </p>

            {setupError && (
              <div style={{ padding: '12px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', color: '#ef4444', borderRadius: '8px', marginBottom: '24px', fontSize: '0.85rem' }}>
                {setupError}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', marginBottom: '32px' }}>
              <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'rgba(0,0,0,0.02)', borderRadius: '12px', border: '1px solid rgba(0,0,0,0.06)' }}>
                <h4 style={{ color: 'var(--color-text-title)', fontSize: '1.1rem', marginBottom: '6px' }}>1. Device Setup</h4>
                <p style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem', marginBottom: '16px' }}>Verify your presence and check your audio.</p>
                
                {webcamEnabled ? (
                  <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                    <div style={{ width: '220px', aspectRatio: '16/9', borderRadius: '8px', overflow: 'hidden', border: '2px solid #10b981', boxShadow: '0 4px 10px rgba(16,185,129,0.2)' }}>
                      <video 
                        id="lobby-webcam-preview" 
                        ref={(el) => { if (el && localCameraStreamRef.current && el.srcObject !== localCameraStreamRef.current) el.srcObject = localCameraStreamRef.current; }}
                        autoPlay muted playsInline 
                        style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} 
                      />
                    </div>
                    
                    <div style={{ width: '100%', maxWidth: '300px', display: 'flex', flexDirection: 'column', gap: '10px', textAlign: 'left' }}>
                      {videoDevices.length > 0 && (
                        <div>
                          <label style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '4px', display: 'block' }}>Camera</label>
                          <select className="form-input" style={{ width: '100%', padding: '8px', fontSize: '0.85rem' }} value={selectedVideoId} onChange={handleVideoDeviceChange}>
                            {videoDevices.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label || 'Camera'}</option>)}
                          </select>
                        </div>
                      )}
                      
                      {audioDevices.length > 0 && (
                        <div>
                          <label style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '4px', display: 'block' }}>Microphone</label>
                          <select className="form-input" style={{ width: '100%', padding: '8px', fontSize: '0.85rem' }} value={selectedAudioId} onChange={handleAudioDeviceChange}>
                            {audioDevices.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label || 'Microphone'}</option>)}
                          </select>
                        </div>
                      )}
                      
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '8px', background: 'rgba(0,0,0,0.03)', padding: '10px 12px', borderRadius: '8px' }}>
                        <span style={{ fontSize: '0.85rem', color: 'var(--color-text-title)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {isMicMuted ? <MicOff size={16} color="#ef4444" /> : <Mic size={16} color="#10b981" />} 
                          Microphone
                        </span>
                        <button onClick={toggleMic} className={`btn ${isMicMuted ? 'btn-danger' : 'btn-secondary'}`} style={{ padding: '6px 12px', fontSize: '0.75rem' }}>
                          {isMicMuted ? 'Unmute' : 'Mute'}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => authorizeWebcam()} className="btn btn-primary" style={{ padding: '10px 24px', fontSize: '0.9rem' }}>
                    Enable Devices
                  </button>
                )}
              </div>
            </div>

            <button
              onClick={handleEnterWorkspace}
              className="btn btn-primary"
              style={{ width: '100%', padding: '16px', fontSize: '1.1rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}
              disabled={!webcamEnabled}
            >
              <LogIn size={18} /> Enter Study Workspace
            </button>

            <div style={{ marginTop: '20px' }}>
              <Link to="/dashboard" style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', textDecoration: 'none', fontWeight: 500 }}>← Back to Dashboard</Link>
            </div>
          </div>
        </div>
      ) : (
        /* 2. ACTIVE STUDY WORKSPACE (LOBBY IS PASSED) */
        /* 2. ACTIVE STUDY WORKSPACE (LOBBY IS PASSED) */
        <>
        <div className={`zen-backdrop ${isZenMode ? 'zen-active' : ''}`}>
          <EnsoCircle />
        </div>
        <div className={`room-v2-container ${isZenMode ? 'zen-aizome' : ''}`}>
          
          {/* Main Stage (Left/Center) */}
          <div className="room-main-stage">
            
            {/* Floating Timer */}
            <div className={`floating-timer ${isZenMode ? 'zen-active-timer' : ''}`}>
              {!isPersonalTimerRunning ? (
                <p style={{ color: '#f59e0b', fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '6px', margin: 0 }}>
                  <ClipboardList size={14} /> Planning
                </p>
              ) : (
                <p style={{ color: '#10b981', fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '6px', margin: 0 }}>
                  <Play size={14} /> Focusing
                </p>
              )}
              <div className="timer-digits">
                {formatTime(seconds)}
              </div>
              
              <button 
                onClick={handleTogglePersonalTimer} 
                className={`btn ${!isPersonalTimerRunning ? 'btn-primary' : 'btn-secondary'}`} 
                style={{ padding: '6px 16px', fontSize: '0.8rem', marginTop: '4px' }}
              >
                {!isPersonalTimerRunning ? (
                  <><Play size={14} /> Start Focus</>
                ) : (
                  <><svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg> Pause Focus</>
                )}
              </button>
            </div>

            {/* Zen Mode Tasks Overlay */}
            {isZenMode && (
              <>
                {/* 1. Active Focus Pill (Centered under timer) */}
                {tasks.find(t => t.id === activeTaskId) && (
                  <div style={{ position: 'absolute', top: '210px', left: '50%', transform: 'translateX(-50%)', zIndex: 10 }}>
                    <div className="zen-focus-pill">
                      <Target size={18} className="zen-pill-icon" />
                      <span style={{ fontWeight: 600 }}>{tasks.find(t => t.id === activeTaskId).title}</span>
                      <span className="zen-pill-timer">
                        {formatTaskTimer(tasks.find(t => t.id === activeTaskId).time_spent_seconds || 0)}
                      </span>
                    </div>
                  </div>
                )}

                {/* 2. Minimalist Task List (Bottom Left) */}
                <div className="zen-minimal-task-list">
                  {tasks.filter(t => (t.owner_id === user?.id || (!t.owner_id && isSolo)) && !t.is_completed && t.id !== activeTaskId).length > 0 && (
                    <div style={{ fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'rgba(248, 250, 252, 0.8)', marginBottom: '6px' }}>Up Next</div>
                  )}
                  {tasks.filter(t => (t.owner_id === user?.id || (!t.owner_id && isSolo)) && !t.is_completed && t.id !== activeTaskId).map((task) => (
                    <div key={task.id} className="zen-minimal-task" onClick={() => setActiveTaskId(task.id)}>
                      <div className="zen-minimal-checkbox"></div>
                      <span>{task.title}</span>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Top Row: Video Gallery */}
            <div className="video-gallery">
              {isSolo ? (
                <div className="video-wrapper">
                  <video id="local-webcam-feed" ref={(el) => { if(el && el.srcObject !== localCameraStreamRef.current) el.srcObject = localCameraStreamRef.current; }} autoPlay muted playsInline />
                  
                  <div className="video-overlay-info">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className="participant-label">{user?.username} (You)</span>
                      <span style={{ background: 'linear-gradient(135deg, #8b5cf6 0%, #a855f7 100%)', color: '#fff', fontSize: '0.65rem', fontWeight: 'bold', padding: '2px 6px', borderRadius: '50px', boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }}>
                        Lv {getLevelInfo(user?.xp || 0).level}
                      </span>
                    </div>
                    <span className="participant-status-badge" style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      {!isPersonalTimerRunning ? 'Planning' : 'Focusing'}
                      {isPersonalTimerRunning && <span style={{ color: '#fff', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}><Clock size={12} /> {formatTime(seconds)}</span>}
                    </span>
                  </div>
                </div>
              ) : liveKitError ? (
                <div style={{ padding: '20px', color: '#ef4444', textAlign: 'center', fontSize: '0.9rem', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '8px', width: '100%', alignSelf: 'center' }}>
                  <ShieldAlert size={24} style={{ marginBottom: '8px' }} />
                  <br />
                  <strong>LiveKit Server Error:</strong> {liveKitError}
                  <p style={{ marginTop: '10px', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                    Check your Render environment variables (LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET) to make sure they are correct.
                  </p>
                </div>
              ) : liveKitToken && liveKitUrl ? (
                <LiveKitRoom
                  video={true}
                  audio={!isMicMuted}
                  token={liveKitToken}
                  serverUrl={liveKitUrl}
                  connect={true}
                  options={{
                    videoCaptureDefaults: selectedVideoId ? { deviceId: selectedVideoId } : undefined,
                    audioCaptureDefaults: selectedAudioId ? { deviceId: selectedAudioId } : undefined,
                  }}
                >
                  <LiveKitMicSync isMicMuted={isMicMuted} />
                  <LiveKitVideoSidebar />
                  <RoomAudioRenderer />
                </LiveKitRoom>
              ) : (
                <div style={{ padding: '20px', color: '#64748b', textAlign: 'center', fontSize: '0.9rem', width: '100%', alignSelf: 'center' }}>Connecting to Video Server...</div>
              )}
            </div>

            {/* Bottom Control Dock */}
            <div className="bottom-dock">
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', paddingRight: '16px', borderRight: '1px solid rgba(255,255,255,0.1)' }}>
                <span style={{ color: '#fff', fontWeight: 600, fontSize: '0.9rem' }}>{roomName}</span>
                {!isSolo && <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.8rem' }}>| {participants.length} in room</span>}
              </div>

              <button onClick={toggleMic} className={`btn ${isMicMuted ? 'btn-danger' : 'btn-secondary'}`} style={{ padding: '10px' }} title={isMicMuted ? "Unmute Microphone" : "Mute Microphone"}>
                {isMicMuted ? <MicOff size={20} /> : <Mic size={20} />}
              </button>
              
              <button onClick={() => setIsZenMode(!isZenMode)} className={`btn ${isZenMode ? 'btn-primary' : 'btn-secondary'}`} style={{ padding: '10px' }} title={isZenMode ? "Exit Zen Mode" : "Enter Zen Mode"}>
                <Sparkles size={20} />
              </button>

              {(isSolo || moderatorId === user?.id) && (
                <button onClick={handleEndRoomSession} className="btn btn-danger" style={{ padding: '10px' }} title={isSolo ? 'Clear Workspace' : 'End Room Session'}>
                  <Trash2 size={20} />
                </button>
              )}

              <Link to="/dashboard" className="btn btn-danger" style={{ padding: '10px' }} title="Exit Room">
                <LogOut size={20} />
              </Link>
            </div>

          </div>

          {/* Right Sidebar */}
          <div className={`room-sidebar ${isZenMode ? 'zen-hidden' : ''}`}>
            
            {/* Objectives */}
            <div className="glass-panel tasks-panel" style={{ padding: '20px' }}>
              <div className="sidebar-tabs">
                <button 
                  className={`sidebar-tab ${activeSidebarTab === 'objectives' ? 'active' : ''}`}
                  onClick={() => setActiveSidebarTab('objectives')}
                >
                  <Target size={14} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'text-bottom' }} /> Objectives
                </button>
                <button 
                  className={`sidebar-tab ${activeSidebarTab === 'history' ? 'active' : ''}`}
                  onClick={() => setActiveSidebarTab('history')}
                >
                  <Clock size={14} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'text-bottom' }} /> History
                </button>
              </div>

              {activeSidebarTab === 'objectives' && (
                <>
                  <div className="objective-progress-container" style={{ marginBottom: '16px' }}>
                    <div 
                      className="objective-progress-bar" 
                      style={{ width: `${tasks.length > 0 ? (tasks.filter(t => t.is_completed).length / tasks.length) * 100 : 0}%` }}
                    />
                  </div>

                  <form onSubmit={handleAddTask} className="objective-input-group" style={{ marginBottom: '12px' }}>
                    <input
                      type="text"
                      value={newTaskTitle}
                      onChange={(e) => setNewTaskTitle(e.target.value)}
                      placeholder="Add an objective..."
                    />
                    <button type="submit" className="btn btn-primary" style={{ padding: '6px 12px', fontSize: '0.8rem' }}>
                      Add
                    </button>
                  </form>

                  <div className="task-list">
                    {tasks.filter(t => !t.is_completed || completingTasks.includes(t.id)).length === 0 ? (
                      <p style={{ color: '#64748b', fontSize: '0.8rem', textAlign: 'center', padding: '10px 0' }}>No active tasks.</p>
                    ) : (
                      <>
                        <div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {tasks.filter(t => (t.owner_id === user?.id || (!t.owner_id && isSolo)) && (!t.is_completed || completingTasks.includes(t.id))).map((task) => (
                              <div key={task.id} className={`objective-card ${completingTasks.includes(task.id) ? 'task-completing' : ''} ${activeTaskId === task.id ? 'active-focus' : ''}`}>
                                <div onClick={() => handleToggleTask(task.id)} className="objective-checkbox">
                                  <svg viewBox="0 0 24 24" style={{ stroke: task.is_completed ? '#10b981' : 'transparent' }}><path d="M5 13l4 4L19 7"/></svg>
                                </div>
                                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <span className="task-title" style={{ fontSize: '0.85rem' }}>{task.title}</span>
                                </div>

                                {!task.is_completed && (
                                  <button
                                    onClick={() => setActiveTaskId(activeTaskId === task.id ? null : task.id)}
                                    className="btn"
                                    style={{
                                      background: activeTaskId === task.id ? 'var(--color-primary)' : 'transparent',
                                      border: '1px solid var(--color-border-glass)',
                                      padding: '2px 8px',
                                      fontSize: '0.7rem',
                                      color: activeTaskId === task.id ? '#fff' : 'var(--color-text-main)',
                                      borderRadius: '4px'
                                    }}
                                  >
                                    {activeTaskId === task.id ? 'Focusing' : 'Focus'}
                                  </button>
                                )}

                                {(task.is_completed || task.time_spent_seconds > 0 || activeTaskId === task.id) && (
                                  <span 
                                    className={`task-meta ${activeTaskId === task.id ? 'timer-pulse' : ''}`} 
                                    style={{ 
                                      display: 'flex', 
                                      alignItems: 'center', 
                                      gap: '6px',
                                      color: activeTaskId === task.id ? 'var(--color-accent)' : 'var(--color-text-muted)',
                                      fontWeight: activeTaskId === task.id ? '700' : '600',
                                      marginLeft: 'auto'
                                    }}
                                  >
                                    <Clock size={12} />
                                    {formatTaskTimer(task.time_spent_seconds || 0)}
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>

                        {!isSolo && Array.from(new Set(tasks.filter(t => t.owner_id !== user?.id && t.owner_id && (!t.is_completed || completingTasks.includes(t.id))).map(t => t.owner_id))).map(peerId => {
                          const peerTasks = tasks.filter(t => t.owner_id === peerId && (!t.is_completed || completingTasks.includes(t.id)));
                          if (peerTasks.length === 0) return null;
                          const peerName = peerTasks[0]?.owner_name || 'Classmate';
                          const peerParticipant = participants.find(p => p.userId === peerId);
                          const peerActiveTaskId = peerParticipant?.activeTaskId;
                          return (
                            <div key={peerId} style={{ marginTop: '12px' }}>
                              <h4 style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '6px' }}>{peerName}'s Tasks</h4>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                {peerTasks.map((task) => {
                                  const isPeerFocusing = peerActiveTaskId === task.id;
                                  return (
                                    <div key={task.id} className={`peer-task-card ${completingTasks.includes(task.id) ? 'task-completing' : ''} ${isPeerFocusing ? 'is-focusing' : ''}`}>
                                      <div className="peer-task-checkbox">
                                        {!!task.is_completed && <svg viewBox="0 0 24 24"><path d="M5 13l4 4L19 7"/></svg>}
                                      </div>
                                      <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
                                        <span className="task-title" style={{ fontSize: '0.8rem', color: isPeerFocusing ? 'var(--color-success)' : 'inherit' }}>{task.title}</span>
                                      </div>
                                      {(task.is_completed || task.time_spent_seconds > 0 || isPeerFocusing) && (
                                        <span className={`task-meta ${isPeerFocusing ? 'timer-pulse' : ''}`} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: isPeerFocusing ? 'var(--color-success)' : 'var(--color-text-muted)', marginLeft: 'auto' }}>
                                          <Clock size={10} />
                                          {formatTaskTimer(task.time_spent_seconds || 0)}
                                        </span>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </>
                    )}
                  </div>
                </>
              )}

              {activeSidebarTab === 'history' && (
                <div className="task-list">
                  {tasks.filter(t => t.is_completed && !completingTasks.includes(t.id)).length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--color-text-muted)' }}>
                      <Clock size={24} style={{ margin: '0 auto 8px', opacity: 0.5 }} />
                      <p style={{ fontSize: '0.85rem' }}>No completed tasks yet.</p>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {tasks.filter(t => t.is_completed && !completingTasks.includes(t.id)).map((task) => (
                        <div key={task.id} className="objective-card completed">
                          <div className="objective-checkbox">
                            <svg viewBox="0 0 24 24"><path d="M5 13l4 4L19 7"/></svg>
                          </div>
                          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                            <span className="task-title" style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>{task.title}</span>
                            {!isSolo && task.owner_id !== user?.id && (
                              <span style={{ fontSize: '0.65rem', color: '#64748b' }}>by {task.owner_name || 'Classmate'}</span>
                            )}
                          </div>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: '#10b981', fontWeight: 600, marginLeft: 'auto' }}>
                            <Clock size={12} />
                            {formatTaskTimer(task.time_spent_seconds || 0)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Ambient Audio panel */}
            <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <h3 style={{ fontSize: '1.05rem', color: 'var(--color-text-title)', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                <Headphones size={18} /> Ambient Audio
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <select 
                  value={ambientAudio.startsWith('youtube:') ? 'custom_youtube' : ambientAudio} 
                  onChange={handleChangeAmbientAudio}
                  disabled={!isSolo && moderatorId !== user?.id}
                  className="form-input"
                  style={{ width: '100%', fontSize: '0.85rem' }}
                >
                  {Object.entries(AUDIO_TRACKS).map(([key, track]) => (
                    <option key={key} value={key}>{track.name}</option>
                  ))}
                </select>

                {(ambientAudio === 'custom_youtube' || ambientAudio.startsWith('youtube:')) && (isSolo || moderatorId === user?.id) && (
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input 
                      type="text" 
                      placeholder="YouTube URL..." 
                      className="form-input" 
                      value={youtubeUrlInput}
                      onChange={(e) => setYoutubeUrlInput(e.target.value)}
                      style={{ flex: 1, fontSize: '0.8rem' }}
                    />
                    <button onClick={handleSetYoutubeUrl} className="btn btn-primary" style={{ padding: '6px 12px', fontSize: '0.8rem' }}>Set</button>
                  </div>
                )}

                <YouTubePlayer videoUrl={ambientAudio.startsWith('youtube:') ? ambientAudio.replace('youtube:', '') : ''} volume={audioVolume} />
                
                {ambientAudio.startsWith('youtube:') && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-primary)', background: 'rgba(16, 185, 129, 0.1)', padding: '8px 12px', borderRadius: '8px', fontSize: '0.8rem', fontWeight: '600' }}>
                    <Headphones className="animate-pulse" size={16} /> 
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                       Playing Audio
                    </span>
                  </div>
                )}
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Volume</span>
                  <input 
                    type="range" min="0" max="1" step="0.05" 
                    value={audioVolume} 
                    onChange={(e) => setAudioVolume(parseFloat(e.target.value))}
                    style={{ flex: 1, cursor: 'pointer', height: '4px', accentColor: 'var(--color-primary)' }}
                  />
                </div>
              </div>
            </div>

            {/* Invite link widget */}
            {!isSolo && (
              <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <h4 style={{ fontSize: '0.9rem', color: 'var(--color-text-title)' }}>Invite Classmates</h4>
                
                <div style={{ display: 'flex', gap: '8px', marginBottom: '4px' }}>
                  <input 
                    type="text" className="form-input" value={window.location.href} readOnly 
                    style={{ fontSize: '0.75rem', padding: '6px 10px', background: 'rgba(0,0,0,0.4)', flex: 1 }}
                  />
                  <button onClick={handleCopyLink} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.75rem' }}>
                    {copiedLink ? 'Copied!' : 'Copy'}
                  </button>
                </div>

                <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                  <input
                    type="text" className="form-input" id="inviteUsernameInput" placeholder="Friend's username"
                    style={{ fontSize: '0.75rem', padding: '6px 10px', flex: 1 }}
                  />
                  <button
                    onClick={() => {
                      const username = document.getElementById('inviteUsernameInput').value.trim();
                      if (!username) return;
                      if (!socketRef.current) return;
                      socketRef.current.emit('send-invite-username', { targetUsername: username, roomId, roomName, hostName: user.username });
                      document.getElementById('inviteUsernameInput').value = '';
                    }}
                    className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.75rem' }}
                  >
                    Send
                  </button>
                </div>
              </div>
            )}
          </div>

        </div>
        </>
      )}

      {/* Hidden Canvas for Local Motion / Presence AI Detection */}
      <canvas ref={canvasRef} width="32" height="24" style={{ display: 'none' }}></canvas>
    </div>
  );
}

export default StudyRoom;

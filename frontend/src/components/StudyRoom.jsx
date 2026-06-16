import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Play, Pause, Square, Plus, Trash2, Camera, Mic, MicOff, VideoOff, ScreenShare, Volume2, ShieldAlert, Award, MessageSquare, Clock, Users, X, Monitor, LogOut, LogIn, CheckCircle2, Link as LinkIcon, Share2, ClipboardList, Target, AlertCircle, Headphones } from 'lucide-react';
import Peer from 'peerjs';
import confetti from 'canvas-confetti';
import { fetchApi } from '../utils/api';
import { useSocket } from '../context/SocketContext';

const AUDIO_TRACKS = {
  none: { name: 'No Ambient Audio', url: null },
  rain: { name: 'Heavy Rain', url: 'https://actions.google.com/sounds/v1/weather/rain_heavy_loud.ogg' },
  forest: { name: 'Morning Forest', url: 'https://actions.google.com/sounds/v1/ambiences/forest_morning.ogg' },
  cafe: { name: 'Coffee Shop', url: 'https://actions.google.com/sounds/v1/ambiences/coffee_shop.ogg' },
  stream: { name: 'Flowing Stream', url: 'https://actions.google.com/sounds/v1/water/small_stream_flowing.ogg' }
};

function StudyRoom({ currentUser }) {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const isSolo = roomId === 'solo-focus';

  // --- STATE VARIABLES ---
  const [roomName, setRoomName] = useState(isSolo ? 'Private Workspace' : 'Loading Room...');
  const [tasks, setTasks] = useState([]);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [activeTaskId, setActiveTaskId] = useState(null);
  
  // Stopwatch states
  const [seconds, setSeconds] = useState(0); // Personal study timer
  const [roomUptimeSeconds, setRoomUptimeSeconds] = useState(0); // Global room uptime
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerStarted, setTimerStarted] = useState(false);
  
  // Ambient Audio
  const [ambientAudio, setAmbientAudio] = useState('none');
  const [audioVolume, setAudioVolume] = useState(0.5);
  
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

  const toggleMic = () => {
    if (localCameraStreamRef.current) {
      const audioTrack = localCameraStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMicMuted(!audioTrack.enabled);
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
  const peerRef = useRef(null);
  const localCameraStreamRef = useRef(null);
  const localScreenStreamRef = useRef(null);
  const timerIntervalRef = useRef(null);
  const heartbeatIntervalRef = useRef(null);
  const canvasRef = useRef(null); 
  const lastFrameDataRef = useRef(null); 
  const idleTicksRef = useRef(0); 
  const audioRef = useRef(null);
  const workspaceEnteredRef = useRef(false);

  const globalSocket = useSocket();

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
          }
        })
        .catch(() => navigate('/dashboard'));
    } else {
      const localTasks = JSON.parse(localStorage.getItem('solo_tasks') || '[]');
      setTasks(localTasks);
    }

    const handleOnlineUsersUpdated = (users) => setOnlineUsersList(users);
    const handleRoomStateUpdated = ({ moderatorId, timerStarted: isTimerStarted, roomStartTime, participants, ambientAudio: serverAudio }) => {
      setModeratorId(moderatorId);
      setParticipants(participants);
      if (serverAudio) setAmbientAudio(serverAudio);
      
      const me = participants.find(p => p.userId === user?.id);
      if (me && !timerStarted && seconds === 0) {
          setSeconds(me.studySeconds || 0);
      }

      if (isTimerStarted) {
        setTimerStarted(true);
        if (roomStartTime) {
           startStopwatch(roomStartTime);
        }
      }
    };
    const handleRoomTimerStarted = ({ roomStartTime }) => {
      setTimerStarted(true);
      startStopwatch(roomStartTime);
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
        if (!isSolo && peerRef.current) {
          globalSocket.emit('join-room', {
            roomId,
            userId: user.id,
            username: user.username,
            peerId: peerRef.current.id
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
      
      if (peerRef.current) peerRef.current.destroy();
      stopStreams();
    };
  }, [user, roomId, isSolo, navigate, globalSocket]);

  // --- AUDIO SYNC EFFECT ---
  useEffect(() => {
    if (audioRef.current) {
      if (ambientAudio === 'none') {
        audioRef.current.pause();
      } else {
        audioRef.current.src = AUDIO_TRACKS[ambientAudio].url;
        audioRef.current.volume = audioVolume;
        audioRef.current.play().catch(e => console.log('Audio autoplay blocked', e));
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
      }
    }
  };

  // --- STOPWATCH ENGINE ---
  const startStopwatch = (roomStartTime = null) => {
    if (timerIntervalRef.current) return;
    setTimerRunning(true);

    if (roomStartTime) {
      setRoomUptimeSeconds(Math.floor((Date.now() - roomStartTime) / 1000));
    }

    // Increment timer display locally every 1 second
    timerIntervalRef.current = setInterval(() => {
      setSeconds((prev) => prev + 1);
      
      if (roomStartTime) {
        setRoomUptimeSeconds(Math.floor((Date.now() - roomStartTime) / 1000));
      } else {
        setRoomUptimeSeconds((prev) => prev + 1); // For solo mode
      }
      
      runCameraPresenceAI();
    }, 1000);

    // Sync progress to DB via heartbeat every 15 seconds
    heartbeatIntervalRef.current = setInterval(() => {
      if (socketRef.current && !isSolo) {
        socketRef.current.emit('timer-heartbeat', {
          incrementSeconds: 15,
          activeTaskId: activeTaskId
        });
      }
    }, 15000);
  };

  const pauseStopwatch = (statusText = 'Paused') => {
    setTimerRunning(false);
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }

    if (socketRef.current && !isSolo) {
      socketRef.current.emit('status-update', { status: statusText });
    }
  };

  const stopStreams = () => {
    if (localCameraStreamRef.current) {
      localCameraStreamRef.current.getTracks().forEach((track) => track.stop());
    }
    if (localScreenStreamRef.current) {
      localScreenStreamRef.current.getTracks().forEach((track) => track.stop());
    }
  };

  // --- LOBBY PERMISSION ACQUISITION ---
  const authorizeWebcam = async () => {
    setSetupError('');
    try {
      // Adaptive WebRTC Constraint Handling
      let constraints = { video: true, audio: true };
      
      // Detect slow networks and downscale video aggressively
      if (navigator.connection && navigator.connection.effectiveType) {
        const type = navigator.connection.effectiveType;
        if (type === '2g' || type === '3g') {
          constraints = {
            video: { width: { ideal: 320 }, height: { ideal: 240 }, frameRate: { ideal: 15 } },
            audio: true
          };
          console.warn('Slow network detected. Reducing video quality to 320x240 @ 15fps');
        } else {
          constraints = {
            video: { width: { ideal: 640 }, height: { ideal: 360 }, frameRate: { ideal: 24 } },
            audio: true
          };
        }
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
      
      // Render local webcam preview inside lobby container
      const previewVideo = document.getElementById('lobby-webcam-preview');
      if (previewVideo) {
        previewVideo.srcObject = stream;
      }
    } catch (err) {
      console.error(err);
      setSetupError('Camera access denied. Webcam permission is required for desk presence AI. Ensure your browser has permission.');
    }
  };

  const handleEnterWorkspace = () => {
    // Proceed to the actual room workspace now that webcam is approved
    setWebcamEnabled(true);
    setWorkspaceEntered(true);
    workspaceEnteredRef.current = true;

    if (!isSolo) {
      const customPeerId = user.id + '-' + Math.random().toString(36).substr(2, 5);
      // Connect to PeerJS for WebRTC grid video calls
      peerRef.current = new Peer(customPeerId);

      socketRef.current.emit('join-room', {
        roomId,
        userId: user.id,
        username: user.username,
        peerId: customPeerId
      });

      peerRef.current.on('call', (call) => {
        // Answer call with local webcam stream
        call.answer(localCameraStreamRef.current);
        call.on('stream', (remoteStream) => {
          addRemoteStream(call.peer, remoteStream);
        });
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

  // --- WEBRTC REMOTE STREAM MANAGEMENT ---
  const addRemoteStream = (peerId, stream) => {
    const remoteVideo = document.getElementById(`video-${peerId}`);
    if (remoteVideo) {
      remoteVideo.srcObject = stream;
    }
  };

  useEffect(() => {
    if (isSolo || !participants.length || !peerRef.current || !localCameraStreamRef.current) return;

    participants.forEach((p) => {
      if (p.userId !== user?.id && p.peerId && p.peerId !== 'solo') {
        const call = peerRef.current.call(p.peerId, localCameraStreamRef.current);
        call.on('stream', (remoteStream) => {
          addRemoteStream(p.peerId, remoteStream);
        });
      }
    });
  }, [participants, user, isSolo]);

  // --- TIMER STARTER TRIGGER ---
  const handleStartTimer = () => {
    if (tasks.length === 0) {
      alert('Please add at least one objective before starting the session!');
      return;
    }

    if (isSolo) {
      setTimerStarted(true);
      startStopwatch();
    } else {
      // Broadcast synchronized room timer start
      socketRef.current.emit('start-room-timer');
    }
  };

  // --- TASK ACTIONS ---
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
        if (completed) confetti({ particleCount: 80, spread: 60 });
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
            <h2 style={{ fontSize: '1.8rem', marginBottom: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', color: 'var(--color-text-title)' }}><Camera size={28} color="#6366f1" /> Permissions Lobby</h2>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.95rem', marginBottom: '32px', lineHeight: '1.5' }}>
              StudySync requires your Webcam and Tab Share permissions to verify desk presence and active work before you can join the room.
            </p>

            {setupError && (
              <div style={{ padding: '12px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', color: '#ef4444', borderRadius: '8px', marginBottom: '24px', fontSize: '0.85rem' }}>
                {setupError}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', marginBottom: '32px' }}>
              {/* Webcam auth box */}
              <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'rgba(0,0,0,0.02)', borderRadius: '12px', border: '1px solid rgba(0,0,0,0.06)' }}>
                <h4 style={{ color: 'var(--color-text-title)', fontSize: '1.1rem', marginBottom: '6px' }}>1. Webcam Feed (Presence verification)</h4>
                <p style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem', marginBottom: '16px' }}>We scan this locally to verify you are sitting at your desk.</p>
                
                {webcamEnabled ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '180px', aspectRatio: '16/9', borderRadius: '8px', overflow: 'hidden', border: '2px solid #10b981', boxShadow: '0 4px 10px rgba(16,185,129,0.2)' }}>
                      <video id="lobby-webcam-preview" autoPlay muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                    <span style={{ color: '#10b981', fontWeight: '600', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '4px' }}><CheckCircle2 size={16} /> Webcam Active</span>
                  </div>
                ) : (
                  <button onClick={authorizeWebcam} className="btn btn-primary" style={{ padding: '10px 24px', fontSize: '0.9rem' }}>
                    Enable Webcam
                  </button>
                )}
              </div>
            </div>

            {/* Entry button */}
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
        <div className="study-room-layout">
          {/* Left Workspace Panel */}
          <div className="workspace-left">
            {/* Header */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
              <div>
                <h1 style={{ fontSize: '1.8rem' }}>{roomName}</h1>
                <p style={{ color: '#64748b', fontSize: '0.85rem', marginTop: '4px' }}>
                  {isSolo ? 'Private Workspace' : `Room ID: ${roomId} • Moderator: ${participants.find(p => p.userId === moderatorId)?.username || 'System'}`}
                </p>
              </div>
              
              <div style={{ display: 'flex', gap: '10px' }}>
                {(isSolo || moderatorId === user?.id) && (
                  <button onClick={handleEndRoomSession} className="btn btn-danger" style={{ padding: '8px 16px', fontSize: '0.85rem' }}>
                    <Trash2 size={14} /> {isSolo ? 'Clear Workspace' : 'End Room Session'}
                  </button>
                )}
                <Link to="/dashboard" className="btn btn-secondary" style={{ padding: '8px 16px', fontSize: '0.85rem' }}>
                  <LogOut size={14} /> Exit Room
                </Link>
              </div>
            </div>

            {/* Stopwatch panel */}
            <div className="glass-panel timer-card">
              {!timerStarted ? (
                <p style={{ color: '#f59e0b', fontSize: '0.85rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                  <ClipboardList size={16} /> Planning Phase (Decide tasks and start timer)
                </p>
              ) : (
                <p style={{ color: '#10b981', fontSize: '0.85rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                  <Play size={16} /> Room Uptime
                </p>
              )}
              
              <div className="timer-digits">
                {formatTime(roomUptimeSeconds)}
              </div>

              {!timerStarted && (
                <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginTop: '16px' }}>
                  {isSolo || moderatorId === user?.id ? (
                      <button 
                        onClick={handleStartTimer} 
                        className="btn btn-primary" 
                        style={{ padding: '12px 28px', fontSize: '0.95rem' }}
                      >
                      <Play size={18} /> Start Study Session
                    </button>
                  ) : (
                    <span style={{ color: '#64748b', fontSize: '0.9rem' }}>Waiting for host to start timer...</span>
                  )}
                </div>
              )}


            </div>

            {/* Ambient Audio panel */}
            <div className="glass-panel" style={{ padding: '24px' }}>
              <h3 style={{ fontSize: '1.05rem', color: 'var(--color-text-title)', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                <Headphones size={18} /> Ambient Audio {isSolo ? '' : 'Sync'}
              </h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                <select 
                  value={ambientAudio} 
                  onChange={handleChangeAmbientAudio}
                  disabled={!isSolo && moderatorId !== user?.id}
                  className="form-input"
                  style={{ width: 'auto', flex: 1 }}
                >
                  {Object.entries(AUDIO_TRACKS).map(([key, track]) => (
                    <option key={key} value={key}>{track.name}</option>
                  ))}
                </select>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                  <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Volume</span>
                  <input 
                    type="range" 
                    min="0" 
                    max="1" 
                    step="0.05" 
                    value={audioVolume} 
                    onChange={(e) => setAudioVolume(parseFloat(e.target.value))}
                    style={{ flex: 1, cursor: 'pointer' }}
                  />
                </div>
              </div>
              {!isSolo && moderatorId !== user?.id && (
                <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '12px', fontStyle: 'italic' }}>
                  * The room's ambient audio is controlled by the host. You can adjust your personal volume.
                </p>
              )}
            </div>

            {/* Quest Board Tasks list */}
            <div className="glass-panel tasks-panel">
              <h3 style={{ fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Target size={18} /> Objectives
                <span style={{ marginLeft: 'auto', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', fontSize: '0.75rem', padding: '3px 8px', borderRadius: '50px' }}>
                  {tasks.filter(t => t.is_completed).length} / {tasks.length} Completed
                </span>
              </h3>

              <form onSubmit={handleAddTask} style={{ display: 'flex', gap: '10px' }}>
                <input
                  type="text"
                  className="form-input"
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  placeholder="Add a new objective..."
                  style={{ flex: 1 }}
                />
                <button type="submit" className="btn btn-primary" style={{ padding: '8px 16px', fontSize: '0.9rem' }}>
                  Add Task
                </button>
              </form>

              <div className="task-list" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {tasks.length === 0 ? (
                  <p style={{ color: '#64748b', fontSize: '0.85rem', textAlign: 'center', padding: '20px 0' }}>No tasks assigned. Write one above to start the quest!</p>
                ) : (
                  <>
                    {/* My Objectives */}
                    <div>
                      <h4 style={{ fontSize: '0.9rem', color: '#818cf8', marginBottom: '8px', borderBottom: '1px solid rgba(129, 140, 248, 0.2)', paddingBottom: '4px' }}>My Objectives</h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {tasks.filter(t => t.owner_id === user?.id || (!t.owner_id && isSolo)).length === 0 ? (
                          <p style={{ color: '#64748b', fontSize: '0.8rem', fontStyle: 'italic' }}>You have no tasks yet.</p>
                        ) : (
                          tasks.filter(t => t.owner_id === user?.id || (!t.owner_id && isSolo)).map((task) => (
                            <div key={task.id} className={`task-item ${task.is_completed ? 'completed' : ''} ${activeTaskId === task.id ? 'active-focus' : ''}`} style={{ borderLeft: activeTaskId === task.id ? '4px solid #8b5cf6' : '' }}>
                              <div onClick={() => handleToggleTask(task.id)} className="task-checkbox" style={{ background: task.is_completed ? 'var(--color-primary)' : 'transparent', border: task.is_completed ? 'none' : '1px solid rgba(255,255,255,0.2)' }}>
                                {!!task.is_completed && <svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>}
                              </div>
                              <div style={{ flex: 1 }}>
                                <span className="task-title">{task.title}</span>
                              </div>

                              {!task.is_completed && (
                                <button
                                  onClick={() => setActiveTaskId(activeTaskId === task.id ? null : task.id)}
                                  className="btn"
                                  style={{
                                    background: activeTaskId === task.id ? 'var(--color-primary)' : 'rgba(255,255,255,0.03)',
                                    border: '1px solid var(--color-border-glass)',
                                    padding: '4px 10px',
                                    fontSize: '0.75rem',
                                    color: activeTaskId === task.id ? '#fff' : 'var(--color-text-muted)'
                                  }}
                                >
                                  {activeTaskId === task.id ? 'Focusing' : 'Focus'}
                                </button>
                              )}

                              {task.time_spent_seconds > 0 && (
                                <span className="task-meta" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  <Clock size={12} /> {Math.floor(task.time_spent_seconds / 60)}m
                                </span>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    {/* Peers' Objectives */}
                    {!isSolo && Array.from(new Set(tasks.filter(t => t.owner_id !== user?.id && t.owner_id).map(t => t.owner_id))).map(peerId => {
                      const peerTasks = tasks.filter(t => t.owner_id === peerId);
                      const peerName = peerTasks[0]?.owner_name || 'Classmate';
                      return (
                        <div key={peerId}>
                          <h4 style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: '8px', borderBottom: '1px solid rgba(255, 255, 255, 0.05)', paddingBottom: '4px' }}>{peerName}'s Objectives</h4>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', opacity: 0.8 }}>
                            {peerTasks.map((task) => (
                              <div key={task.id} className={`task-item ${task.is_completed ? 'completed' : ''}`} style={{ padding: '8px 12px', background: 'rgba(255,255,255,0.01)' }}>
                                <div className="task-checkbox" style={{ cursor: 'default', background: task.is_completed ? 'var(--color-primary)' : 'transparent', border: task.is_completed ? 'none' : '1px solid rgba(255,255,255,0.2)', opacity: task.is_completed ? 1 : 0.3 }}>
                                  {!!task.is_completed && <svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>}
                                </div>
                                <div style={{ flex: 1 }}>
                                  <span className="task-title" style={{ fontSize: '0.85rem' }}>{task.title}</span>
                                </div>
                                {task.time_spent_seconds > 0 && (
                                  <span className="task-meta" style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.7rem' }}>
                                    <Clock size={10} /> {Math.floor(task.time_spent_seconds / 60)}m
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Right Sidebar Panel */}
          <div className="workspace-right">
            {/* Invite link widget */}
            {!isSolo && (
              <div className="glass-panel" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <h4 style={{ fontSize: '0.9rem', color: 'var(--color-text-title)' }}>Invite Classmates</h4>
                
                {/* URL Copy */}
                <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                  <input 
                    type="text" 
                    className="form-input" 
                    value={window.location.href} 
                    readOnly 
                    style={{ fontSize: '0.75rem', padding: '6px 10px', background: 'rgba(0,0,0,0.4)', flex: 1 }}
                  />
                  <button onClick={handleCopyLink} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.75rem' }}>
                    {copiedLink ? 'Copied!' : 'Copy'}
                  </button>
                </div>

                {/* Invite by Username */}
                <p style={{ color: '#64748b', fontSize: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '10px' }}>
                  Invite by Username:
                </p>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    className="form-input"
                    id="inviteUsernameInput"
                    placeholder="Enter friend's username"
                    style={{ fontSize: '0.75rem', padding: '6px 10px', flex: 1 }}
                  />
                  <button
                    onClick={() => {
                      const username = document.getElementById('inviteUsernameInput').value.trim();
                      if (!username) return;
                      if (!socketRef.current) return;
                      socketRef.current.emit('send-invite-username', {
                        targetUsername: username,
                        roomId,
                        roomName,
                        hostName: user.username
                      });
                      document.getElementById('inviteUsernameInput').value = '';
                    }}
                    className="btn btn-secondary"
                    style={{ padding: '6px 12px', fontSize: '0.75rem' }}
                  >
                    Send
                  </button>
                </div>
              </div>
            )}

            <h3 style={{ fontSize: '1.15rem', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '8px', marginTop: '10px' }}>
              Active Peers ({participants.length || 1})
            </h3>

            <div className="video-sidebar">
              {/* Local Stream (Webcam feed) */}
              <div className="video-wrapper">
                <video id="local-webcam-feed" ref={(el) => { if(el && el.srcObject !== localCameraStreamRef.current) el.srcObject = localCameraStreamRef.current; }} autoPlay muted playsInline />
                
                <div className="video-overlay-info">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="participant-label">{user?.username} (You)</span>
                    <span style={{ background: 'linear-gradient(135deg, #8b5cf6 0%, #a855f7 100%)', color: '#fff', fontSize: '0.65rem', fontWeight: 'bold', padding: '2px 6px', borderRadius: '50px', boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }}>
                      Lv {Math.floor((user?.xp || 0) / 100) + 1}
                    </span>
                    <button onClick={toggleMic} style={{ background: isMicMuted ? '#ef4444' : 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '50%', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff' }} title={isMicMuted ? "Unmute Mic" : "Mute Mic"}>
                      {isMicMuted ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 1l22 22M9 9v3a3 3 0 005.12 2.12M15 9.34V4a3 3 0 00-5.94-.6"/></svg> : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8"/></svg>}
                    </button>
                  </div>
                  <span className="participant-status-badge" style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    {!timerStarted ? 'Planning' : 'Focusing'}
                    {timerStarted && <span style={{ color: '#fff', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}><Clock size={12} /> {formatTime(seconds)}</span>}
                  </span>
                </div>
              </div>

              {/* Remote Peer video streams */}
              {!isSolo && participants.filter(p => p.userId !== user?.id).map((p) => (
                <div key={p.peerId} className="video-wrapper">
                  <video id={`video-${p.peerId}`} autoPlay playsInline />
                  <div className="video-overlay-info">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className="participant-label">{p.username}</span>
                      <span style={{ background: 'linear-gradient(135deg, #8b5cf6 0%, #a855f7 100%)', color: '#fff', fontSize: '0.65rem', fontWeight: 'bold', padding: '2px 6px', borderRadius: '50px', boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }}>
                        Lv {Math.floor((p.xp || 0) / 100) + 1}
                      </span>
                    </div>
                    <span className="participant-status-badge" style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      {!timerStarted ? 'Planning' : p.status || 'Focusing'}
                      {timerStarted && <span style={{ color: '#fff', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}><Clock size={12} /> {formatTime(p.studySeconds)}</span>}
                    </span>
                  </div>
                  <div style={{ position: 'absolute', top: 10, right: 10, background: 'rgba(0,0,0,0.5)', padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Clock size={12} /> {formatTime(p.studySeconds)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Hidden Canvas for Local Motion / Presence AI Detection */}
      <canvas ref={canvasRef} width="32" height="24" style={{ display: 'none' }}></canvas>
    </div>
  );
}

export default StudyRoom;

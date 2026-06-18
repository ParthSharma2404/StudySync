import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Users, Clock, Shield, Target, Flame, Headphones, ArrowRight, CheckCircle2, LayoutDashboard, Video, MessageSquare, Plus, Mic, Trophy, Image, Lock, EyeOff } from 'lucide-react';

const ScrollRevealSection = ({ children, style, className }) => {
  const ref = useRef(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.unobserve(entry.target);
        }
      },
      { threshold: 0.15 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => {
      if (ref.current) observer.unobserve(ref.current);
    };
  }, []);

  return (
    <section ref={ref} className={`${className} scroll-reveal ${isVisible ? 'active' : ''}`} style={{ ...style, position: 'relative' }}>
      {children}
    </section>
  );
};

function Landing({ currentUser }) {
  
  // Live User Ticker State
  const [activeUsers, setActiveUsers] = useState(1243);
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveUsers(prev => prev + Math.floor(Math.random() * 5) - 2);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  // Mockup Interaction State
  const [isHoveringMockup, setIsHoveringMockup] = useState(false);
  const [mockTimer, setMockTimer] = useState(9910); // 02:45:10 in seconds
  const [isTimerRunning, setIsTimerRunning] = useState(false);

  useEffect(() => {
    let interval;
    if (isTimerRunning) {
      interval = setInterval(() => setMockTimer(prev => prev + 1), 1000);
    }
    return () => clearInterval(interval);
  }, [isTimerRunning]);

  const formatTime = (totalSeconds) => {
    const hours = Math.floor(totalSeconds / 3600).toString().padStart(2, '0');
    const minutes = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, '0');
    const seconds = (totalSeconds % 60).toString().padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
  };

  const handleMouseMove = (e) => {
    const cards = document.querySelectorAll('.feature-card');
    cards.forEach((card) => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      card.style.setProperty('--mouse-x', `${x}px`);
      card.style.setProperty('--mouse-y', `${y}px`);
    });
  };

  return (
    <div style={{ position: 'relative', overflow: 'hidden' }}>
      {/* Subtle Background Glow Elements Removed for Sketchbook Theme */}
      
      {/* Hero Section */}
      <section className="hero-section container" style={{ position: 'relative', zIndex: 1, textAlign: 'center', minHeight: 'calc(100vh - 64px)', display: 'flex', flexDirection: 'column', justifyContent: 'center', paddingTop: '40px', paddingBottom: '20px' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <div className="animate-fade-up delay-1" style={{ display: 'inline-block', marginBottom: '16px', padding: '6px 12px', borderRadius: '50px', background: 'rgba(99, 102, 241, 0.1)', border: '1px solid rgba(99, 102, 241, 0.2)' }}>
            <span className="hero-tagline" style={{ margin: 0, color: '#a5b4fc', fontSize: '0.8rem', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>StudySync 2.0 is Live</span>
          </div>
          <h1 className="hero-title animate-fade-up delay-2" style={{ fontSize: 'clamp(2.5rem, 6vw, 4.5rem)', fontWeight: 800, letterSpacing: '-0.04em', lineHeight: '1', marginBottom: '16px' }}>
            <span style={{ color: '#2b2b2b' }}>The Professional</span><br />
            <span style={{ display: 'inline-block', background: '#fef08a', color: '#2b2b2b', padding: '4px 16px', transform: 'rotate(-1deg)', border: '2px solid #2b2b2b', borderRadius: '4px 8px 3px 6px / 6px 3px 8px 4px', boxShadow: '4px 4px 0 rgba(0,0,0,0.1)' }}>Co-working Space.</span>
          </h1>
          <p className="hero-desc animate-fade-up delay-3" style={{ fontSize: 'clamp(1rem, 2vw, 1.15rem)', color: 'var(--color-text-muted)', margin: '0 auto 24px auto', maxWidth: '600px', lineHeight: '1.5' }}>
            Transform solitary study into a highly focused, collaborative experience. Track active hours, stream your progress, and crush your objectives in persistent virtual rooms.
          </p>
          <div className="animate-fade-up delay-4" style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap' }}>
            {currentUser ? (
              <Link to="/dashboard" className="btn btn-primary" style={{ padding: '16px 32px', fontSize: '1.1rem', borderRadius: '12px', boxShadow: '0 8px 25px rgba(99, 102, 241, 0.4)' }}>
                Go to Dashboard
                <ArrowRight size={20} />
              </Link>
            ) : (
              <>
                <Link to="/register" className="btn btn-primary" style={{ padding: '16px 32px', fontSize: '1.1rem', borderRadius: '12px', boxShadow: '4px 4px 0 rgba(0,0,0,0.8)' }}>
                  Start For Free
                  <ArrowRight size={20} />
                </Link>
                <Link to="/login" className="btn btn-secondary" style={{ padding: '16px 32px', fontSize: '1.1rem', borderRadius: '12px', background: 'rgba(0,0,0,0.05)', border: '2px solid #2b2b2b', color: '#2b2b2b' }}>Sign In</Link>
              </>
            )}
          </div>
          
          {/* Live Pulse Ticker */}
          <div className="animate-fade-up delay-4" style={{ marginTop: '32px', display: 'flex', justifyContent: 'center', position: 'relative' }}>

            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', background: 'rgba(16, 185, 129, 0.1)', border: '2px solid rgba(16, 185, 129, 0.4)', padding: '8px 24px 8px 12px', borderRadius: '255px 15px 225px 15px / 15px 225px 15px 255px', color: '#34d399', fontSize: '1rem', fontWeight: 500, boxShadow: '4px 4px 0 rgba(16, 185, 129, 0.2)' }}>
              
              <div style={{ display: 'flex' }}>
                <img src="/avatar1.png" alt="User" style={{ width: '28px', height: '28px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #fdfbf7' }} />
                <img src="/avatar2.png" alt="User" style={{ width: '28px', height: '28px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #fdfbf7', marginLeft: '-10px' }} />
                <img src="/avatar3.png" alt="User" style={{ width: '28px', height: '28px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #fdfbf7', marginLeft: '-10px' }} />
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ position: 'relative', width: '8px', height: '8px' }}>
                  <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: '#10b981', borderRadius: '50%' }}></div>
                  <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: '#10b981', borderRadius: '50%', animation: 'pulseGlow 2s infinite' }}></div>
                </div>
                {activeUsers.toLocaleString()} students currently in deep focus
              </div>
            </div>
          </div>
        </div>

        {/* CSS UI Mockup - The Dashboard */}
        <div 
          className="animate-fade-up delay-4 glass-panel" 
          onMouseEnter={() => setIsHoveringMockup(true)}
          onMouseLeave={() => setIsHoveringMockup(false)}
          style={{ 
            marginTop: '64px', 
            maxWidth: '1000px', 
            margin: '64px auto 0 auto', 
            background: '#ffffff', 
            height: 'auto',
            minHeight: '600px',
            border: '2px solid #2b2b2b',
            display: 'flex', 
            flexDirection: 'column', 
            flexDirection: 'column', 
            boxShadow: isHoveringMockup 
              ? '10px 10px 0 rgba(99, 102, 241, 0.5), 0 0 80px rgba(99, 102, 241, 0.3)' 
              : '6px 6px 0 rgba(99, 102, 241, 0.3), 0 0 40px rgba(99, 102, 241, 0.1)',
            transform: isHoveringMockup ? 'perspective(1000px) rotateX(2deg) scale(1.02)' : 'perspective(1000px) rotateX(0deg) scale(1)',
            transition: 'all 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
            position: 'relative'
          }}
        >
          {/* Sketchy Tape */}
          <div style={{ position: 'absolute', top: '-15px', left: '50%', transform: 'translateX(-50%) rotate(-2deg)', width: '140px', height: '35px', background: 'rgba(255, 255, 255, 0.7)', border: '1px solid rgba(0,0,0,0.1)', boxShadow: '2px 2px 5px rgba(0,0,0,0.1)', zIndex: 100 }}>
             <svg width="100%" height="100%">
               <path d="M 10 10 Q 70 5 130 15 M 5 20 Q 60 15 135 25 M 15 30 Q 80 28 125 32" fill="none" stroke="#2b2b2b" strokeWidth="1" opacity="0.2" />
             </svg>
          </div>
            {/* Window Header */}
            <div style={{ padding: '16px 24px', borderBottom: '2px solid #2b2b2b', display: 'flex', gap: '8px', alignItems: 'center' }}>
              <div style={{ width: '12px', height: '12px', borderRadius: '50%', border: '2px solid #2b2b2b', background: '#ef4444' }}></div>
              <div style={{ width: '12px', height: '12px', borderRadius: '50%', border: '2px solid #2b2b2b', background: '#f59e0b' }}></div>
              <div style={{ width: '12px', height: '12px', borderRadius: '50%', border: '2px solid #2b2b2b', background: '#10b981' }}></div>
              <div style={{ flex: 1, textAlign: 'center', color: '#2b2b2b', fontSize: '1rem', fontWeight: 600, fontFamily: 'monospace' }}>app.studysync.com</div>
            </div>
            {/* Window Content Layout */}
            <div style={{ display: 'flex', flex: 1, padding: '24px', gap: '24px' }}>
              <div style={{ width: '200px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px', borderRadius: '8px', color: '#2b2b2b', fontSize: '1.1rem' }}>
                  <LayoutDashboard size={18} /> Dashboard
                </div>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '8px', padding: '8px', background: '#bbf7d0', borderRadius: '4px 8px 3px 6px / 6px 3px 8px 4px', border: '2px solid #2b2b2b', color: '#2b2b2b', fontSize: '1.1rem', fontWeight: 600, transform: 'rotate(-1deg)' }}>
                  {/* Annotation: Focus Sidebar */}
                  <div style={{ position: 'absolute', top: '-5px', left: '-130px', width: '120px', height: '50px', zIndex: 50, pointerEvents: 'none' }}>
                    <div style={{ position: 'absolute', top: '-10px', left: '0px', fontFamily: 'Kalam, cursive', color: '#2b2b2b', fontSize: '1.2rem', fontWeight: 700, transform: 'rotate(-4deg)', whiteSpace: 'nowrap' }}>Focus Sidebar</div>
                    <svg viewBox="0 0 120 50" style={{ width: '100%', height: '100%', overflow: 'visible', marginTop: '10px' }}>
                      <path d="M 0 25 Q 50 15 110 25" fill="none" stroke="#2b2b2b" strokeWidth="2" strokeDasharray="6 6" />
                      <path d="M 100 15 L 110 25 L 100 35" fill="none" stroke="#2b2b2b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <Video size={18} /> Active Room
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px', borderRadius: '8px', color: '#2b2b2b', fontSize: '1.1rem' }}>
                  <Users size={18} /> Friends
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px', borderRadius: '8px', color: '#2b2b2b', fontSize: '1.1rem' }}>
                  <Target size={18} /> Objectives
                </div>
                
                {/* Profile Mock */}
                <div style={{ marginTop: 'auto', padding: '16px', border: '2px solid #2b2b2b', background: 'rgba(0,0,0,0.02)', borderRadius: '255px 15px 225px 15px / 15px 225px 15px 255px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                  <div style={{ position: 'relative' }}>
                    <img src="/avatar1.png" alt="Profile" style={{ width: '48px', height: '48px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #2b2b2b' }} />
                    <div style={{ position: 'absolute', bottom: '-8px', left: '50%', transform: 'translateX(-50%)', background: '#6366f1', color: '#fff', fontSize: '0.65rem', fontWeight: 'bold', padding: '2px 8px', borderRadius: '12px', border: '2px solid #2b2b2b', whiteSpace: 'nowrap' }}>
                      Lv 2
                    </div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '0.95rem', color: '#2b2b2b', fontWeight: 700 }}>Parth</div>
                    <div style={{ fontSize: '0.75rem', color: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', background: '#fef3c7', padding: '4px 8px', borderRadius: '12px', border: '1px solid #f59e0b', marginTop: '6px' }}>
                      <Flame size={12} /> 3 Day Streak
                    </div>
                  </div>
                </div>
              </div>

              {/* Main Content Mock */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {/* Header Area */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h2 style={{ fontSize: '1.4rem', color: '#2b2b2b', margin: 0, fontWeight: 700, position: 'relative', display: 'inline-block' }}>
                      E2E Test Room
                      <svg style={{ position: 'absolute', bottom: '-2px', left: '-5%', width: '110%', height: '12px', zIndex: -1, pointerEvents: 'none' }} viewBox="0 0 100 12" preserveAspectRatio="none">
                        <path d="M 0 8 Q 20 2 50 6 T 100 4" fill="none" stroke="#fbbf24" strokeWidth="4" strokeLinecap="round" opacity="0.6" />
                        <path d="M 5 10 Q 30 6 60 8 T 95 6" fill="none" stroke="#fbbf24" strokeWidth="3" strokeLinecap="round" opacity="0.4" />
                      </svg>
                    </h2>
                    <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', margin: '4px 0 0 0' }}>Deep work session in progress...</p>
                  </div>
                  {/* Timer */}
                  <div style={{ position: 'relative' }}>
                    {/* Annotation: Shared Timer */}
                    <div style={{ position: 'absolute', top: '-55px', right: '40px', width: '100px', height: '60px', zIndex: 50, pointerEvents: 'none' }}>
                      <div style={{ position: 'absolute', top: '-15px', left: '-10px', fontFamily: 'Kalam, cursive', color: '#2b2b2b', fontSize: '1.2rem', fontWeight: 700, transform: 'rotate(-4deg)', whiteSpace: 'nowrap' }}>Sync'd Timer</div>
                      <svg viewBox="0 0 100 60" style={{ width: '100%', height: '100%', overflow: 'visible', marginTop: '15px' }}>
                        <path d="M 10 5 Q 50 5 90 50" fill="none" stroke="#2b2b2b" strokeWidth="2" strokeDasharray="6 6" />
                        <path d="M 75 45 L 90 50 L 85 35" fill="none" stroke="#2b2b2b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                    <div 
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsTimerRunning(!isTimerRunning);
                    }}
                    style={{ background: 'rgba(16, 185, 129, 0.1)', border: '2px solid rgba(16, 185, 129, 0.4)', borderRadius: '255px 15px 225px 15px / 15px 225px 15px 255px', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '8px', color: '#34d399', fontWeight: 600, fontSize: '1.2rem', fontFamily: 'monospace', cursor: 'pointer', transition: 'all 0.2s', boxShadow: '4px 4px 0 rgba(16, 185, 129, 0.2)' }}
                    onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.05)'; e.currentTarget.style.background = 'rgba(16, 185, 129, 0.2)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.background = 'rgba(16, 185, 129, 0.1)'; }}
                  >
                    <Clock size={18} /> {formatTime(mockTimer)}
                  </div>
                  </div>
                </div>

                {/* Video Grid Mock */}
                <div style={{ position: 'relative', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', flex: 1, minHeight: '400px' }}>
                  {/* Annotation: P2P Video Feeds */}
                  <div style={{ position: 'absolute', bottom: '-110px', left: '10%', width: '150px', height: '80px', zIndex: 50, pointerEvents: 'none' }}>
                    <svg viewBox="0 0 150 80" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
                      <path d="M 30 65 Q 80 55 140 10" fill="none" stroke="#2b2b2b" strokeWidth="2" strokeDasharray="6 6" />
                      <path d="M 125 15 L 140 10 L 135 25" fill="none" stroke="#2b2b2b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <div style={{ position: 'absolute', top: '70px', left: '-5px', fontFamily: 'Kalam, cursive', color: '#2b2b2b', fontSize: '1.2rem', fontWeight: 700, transform: 'rotate(6deg)', whiteSpace: 'nowrap' }}>Live P2P Feeds</div>
                  </div>
                  {/* Video 1 */}
                  <div style={{ background: 'transparent', borderRadius: '12px', border: `2px solid ${isHoveringMockup ? '#6366f1' : '#2b2b2b'}`, position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'border 0.3s', borderRadius: '255px 15px 225px 15px / 15px 225px 15px 255px' }}>
                     {/* Floating Speech Bubble (You) */}
                     <div className="animate-bounce" style={{ position: 'absolute', top: '20px', right: '20px', zIndex: 10, animationDuration: '2.5s' }}>
                       <svg width="60" height="40" viewBox="0 0 60 40">
                         <path d="M 5 5 Q 30 -5 55 5 Q 65 20 55 30 Q 40 40 25 30 Q 10 35 5 35 Q 10 25 5 20 Q -5 10 5 5" fill="#fdfbf7" stroke="#2b2b2b" strokeWidth="2" />
                         <circle cx="20" cy="18" r="2" fill="#2b2b2b" />
                         <circle cx="30" cy="18" r="2" fill="#2b2b2b" />
                         <circle cx="40" cy="18" r="2" fill="#2b2b2b" />
                       </svg>
                     </div>
                     <img src="/avatar1.png" alt="You" className="avatar-breathe" style={{ width: '110%', height: '110%', objectFit: 'cover' }} />
                     <div style={{ position: 'absolute', bottom: '12px', left: '12px', padding: '4px 10px', background: '#fdfbf7', border: '2px solid #2b2b2b', borderRadius: '255px 15px 225px 15px / 15px 225px 15px 255px', color: '#2b2b2b', fontSize: '0.75rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px', zIndex: 20 }}>
                       <div className="animate-pulse" style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', border: '1px solid #2b2b2b' }}></div> You
                     </div>
                  </div>

                  {/* Video 2 */}
                  <div style={{ background: 'transparent', borderRadius: '12px', border: '2px solid #2b2b2b', position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '15px 255px 15px 225px / 255px 15px 225px 15px' }}>
                     {/* Floating Reaction (Alex) */}
                     <div className="animate-bounce" style={{ position: 'absolute', top: '20px', left: '20px', zIndex: 10, animationDuration: '2s', animationDelay: '1s' }}>
                       <svg width="30" height="40" viewBox="0 0 30 40">
                         <path d="M 15 5 L 15 25" fill="none" stroke="#fbbf24" strokeWidth="4" strokeLinecap="round" />
                         <circle cx="15" cy="35" r="3" fill="#fbbf24" />
                       </svg>
                     </div>
                     <img src="/avatar2.png" alt="Alex" className="avatar-bob" style={{ width: '110%', height: '110%', objectFit: 'cover' }} />
                     <div style={{ position: 'absolute', bottom: '12px', left: '12px', padding: '4px 10px', background: '#fdfbf7', border: '2px solid #2b2b2b', borderRadius: '255px 15px 225px 15px / 15px 225px 15px 255px', color: '#2b2b2b', fontSize: '0.75rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px', zIndex: 20 }}>
                       <div className="animate-pulse" style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', border: '1px solid #2b2b2b' }}></div> Alex
                     </div>
                  </div>
                </div>
              </div>
            </div>
        </div>
      </section>

      {/* Feature Grid Section */}
      <ScrollRevealSection className="container" style={{ position: 'relative', zIndex: 1, paddingTop: '150px', paddingBottom: '150px' }}>
        <div style={{ textAlign: 'center', marginBottom: '64px' }}>
          <h2 style={{ fontSize: '2.5rem', marginBottom: '16px' }}>Engineered for Productivity</h2>
          <p style={{ color: 'var(--color-text-muted)', maxWidth: '600px', margin: '0 auto', fontSize: '1.1rem', lineHeight: '1.6' }}>
            Built specifically for structured study groups and intense personal discipline, StudySync bridges the gap between solitary work and team accountability.
          </p>
        </div>

        <div onMouseMove={handleMouseMove} className="bento-grid">
          
          {/* 1. Persistent Study Rooms (Span 2) */}
          <div className="glass-panel feature-card bento-card bento-span-2" style={{ padding: '32px', gap: '16px' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(99, 102, 241, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#818cf8' }}>
              <Users size={24} />
            </div>
            <h3 style={{ fontSize: '1.25rem', marginTop: '8px' }}>Persistent Study Rooms</h3>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.95rem', lineHeight: '1.6', maxWidth: '80%' }}>
              Create permanent, shareable workspaces. If the host leaves, the room stays active and privileges transition seamlessly to keep the session alive.
            </p>
            <div className="bento-card-visual" style={{ background: 'linear-gradient(to right, rgba(99, 102, 241, 0.05), transparent)' }}>
              <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '80%', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', background: '#fff', borderRadius: '8px', border: '2px solid #2b2b2b', boxShadow: '4px 4px 0 rgba(0,0,0,0.1)' }}>
                  <div style={{ fontWeight: 600 }}>CS101 Prep Room <span style={{ fontSize: '0.75rem', color: '#10b981', marginLeft: '8px' }}>● 12 Online</span></div>
                  <div style={{ color: '#6366f1', fontWeight: 'bold' }}>Join</div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', background: '#fff', borderRadius: '8px', border: '2px dashed #d1d5db', opacity: 0.7, transform: 'scale(0.95)' }}>
                  <div style={{ fontWeight: 500, color: '#6b7280' }}>Medical Board Study Group <span style={{ fontSize: '0.75rem', color: '#9ca3af', marginLeft: '8px' }}>○ Empty</span></div>
                </div>
              </div>
            </div>
          </div>

          {/* 2. Synchronized Timers */}
          <div className="glass-panel feature-card bento-card" style={{ padding: '32px', gap: '16px' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(16, 185, 129, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#34d399' }}>
              <Clock size={24} />
            </div>
            <h3 style={{ fontSize: '1.25rem', marginTop: '8px' }}>Synchronized Timers</h3>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.95rem', lineHeight: '1.6' }}>
              Track cumulative study seconds collectively. Active times are broadcasted to peers in real-time to enforce accountability.
            </p>
          </div>

          {/* 3. Global Leaderboards */}
          <div className="glass-panel feature-card bento-card" style={{ padding: '32px', gap: '16px' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(56, 189, 248, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7dd3fc' }}>
              <Trophy size={24} />
            </div>
            <h3 style={{ fontSize: '1.25rem', marginTop: '8px' }}>Global Leaderboards</h3>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.95rem', lineHeight: '1.6' }}>
              Compete against students worldwide. Climb the ranks to earn the glowing Champion badge.
            </p>
          </div>

          {/* 4. Progressive RPG Leveling (Span 2) */}
          <div className="glass-panel feature-card bento-card bento-span-2" style={{ padding: '32px', gap: '16px' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(168, 85, 247, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#c084fc' }}>
              <Flame size={24} />
            </div>
            <h3 style={{ fontSize: '1.25rem', marginTop: '8px' }}>Progressive RPG Leveling</h3>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.95rem', lineHeight: '1.6', maxWidth: '80%' }}>
              Earn XP to rank up your Level. Every rank is exponentially harder to achieve. Maintain True Study Streaks—start a timer and do the work to keep your flame alive.
            </p>
            <div className="bento-card-visual" style={{ background: 'rgba(255,255,255,0.5)' }}>
              <div style={{ width: '80%', maxWidth: '300px' }}>
                 <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontWeight: 'bold' }}>
                   <span>Level 4</span>
                   <span style={{ color: '#a855f7' }}>180 / 200 XP</span>
                 </div>
                 <div style={{ height: '12px', background: '#f3f4f6', borderRadius: '8px', overflow: 'hidden', border: '1px solid #d1d5db' }}>
                   <div className="animate-pulse" style={{ width: '90%', height: '100%', background: 'linear-gradient(90deg, #c084fc, #818cf8)', borderRadius: '8px' }}></div>
                 </div>
              </div>
            </div>
          </div>

          {/* 5. Zen Mode Environments (Span 2) */}
          <div className="glass-panel feature-card bento-card bento-span-2" style={{ padding: '32px', gap: '16px' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(239, 68, 68, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f87171' }}>
              <Image size={24} />
            </div>
            <h3 style={{ fontSize: '1.25rem', marginTop: '8px' }}>Zen Mode Environments</h3>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.95rem', lineHeight: '1.6', maxWidth: '80%' }}>
              Immerse yourself in beautiful, pixel-art lo-fi backgrounds designed to reduce stress and induce deep focus while studying.
            </p>
            <div className="bento-card-visual" style={{ background: 'url("https://images.unsplash.com/photo-1550684848-fac1c5b4e853?q=80&w=600&auto=format&fit=crop")', backgroundSize: 'cover', backgroundPosition: 'center', border: '2px solid #2b2b2b' }}>
              <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ background: 'rgba(255,255,255,0.9)', padding: '8px 16px', borderRadius: '25px', fontWeight: 'bold', fontSize: '0.9rem', border: '2px solid #2b2b2b' }}>Zen Mode: Activated</div>
              </div>
            </div>
          </div>

          {/* 6. Shared Objectives */}
          <div className="glass-panel feature-card bento-card" style={{ padding: '32px', gap: '16px' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(245, 158, 11, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fbbf24' }}>
              <Target size={24} />
            </div>
            <h3 style={{ fontSize: '1.25rem', marginTop: '8px' }}>Shared Objectives</h3>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.95rem', lineHeight: '1.6' }}>
              Establish a central task list for the group. Complete the list to secure session achievements.
            </p>
          </div>

          {/* 7. Live Video & Audio */}
          <div className="glass-panel feature-card bento-card" style={{ padding: '32px', gap: '16px' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(236, 72, 153, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f472b6' }}>
              <Video size={24} />
            </div>
            <h3 style={{ fontSize: '1.25rem', marginTop: '8px' }}>Live Video & Audio</h3>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.95rem', lineHeight: '1.6' }}>
              Communicate seamlessly with high-performance LiveKit video and audio feeds. Share your screen for real-time collaboration.
            </p>
          </div>

          {/* 8. Private Workspaces (Span 2) */}
          <div className="glass-panel feature-card bento-card bento-span-2" style={{ padding: '32px', gap: '16px' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(148, 163, 184, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
              <LayoutDashboard size={24} />
            </div>
            <h3 style={{ fontSize: '1.25rem', marginTop: '8px' }}>Private Workspaces</h3>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.95rem', lineHeight: '1.6', maxWidth: '80%' }}>
              Need absolute focus? Enter an isolated private workspace to track your personal timers and complete local tasks without any group distractions.
            </p>
            <div className="bento-card-visual" style={{ background: '#f8fafc' }}>
               <div style={{ width: '70%', height: '60%', border: '2px solid #2b2b2b', background: '#fff', borderRadius: '8px 8px 0 0', display: 'flex', flexDirection: 'column' }}>
                 <div style={{ borderBottom: '2px solid #2b2b2b', padding: '6px 12px', display: 'flex', gap: '6px' }}>
                   <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ef4444' }}></div>
                   <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#f59e0b' }}></div>
                   <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }}></div>
                 </div>
                 <div style={{ flex: 1, padding: '12px', display: 'flex', gap: '12px' }}>
                   <div style={{ flex: 1, background: '#f1f5f9', borderRadius: '4px', border: '1px dashed #cbd5e1' }}></div>
                   <div style={{ width: '40%', background: '#f1f5f9', borderRadius: '4px', border: '1px dashed #cbd5e1' }}></div>
                 </div>
               </div>
            </div>
          </div>

        </div>
      </ScrollRevealSection>

      {/* Security & Privacy Section */}
      <ScrollRevealSection className="container" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', paddingTop: '150px', paddingBottom: '150px', borderTop: '1px solid var(--color-border-glass)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '64px', alignItems: 'center' }}>
          
          {/* Text Side */}
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '6px 12px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid #34d399', borderRadius: '20px', color: '#059669', fontSize: '0.85rem', fontWeight: 'bold', marginBottom: '24px' }}>
              <Lock size={14} /> Privacy First
            </div>
            <h2 style={{ fontSize: '2.5rem', marginBottom: '24px', lineHeight: '1.2' }}>Your focus is your business. <br/><span style={{ color: 'var(--color-text-muted)' }}>Not ours.</span></h2>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '1.1rem', lineHeight: '1.6', marginBottom: '32px' }}>
              We built StudySync because we wanted a place to focus, not a place to be tracked. We take a radical approach to your data security.
            </p>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div style={{ display: 'flex', gap: '16px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(99, 102, 241, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6366f1', flexShrink: 0 }}>
                  <EyeOff size={20} />
                </div>
                <div>
                  <h4 style={{ fontSize: '1.1rem', marginBottom: '8px' }}>Secure Media Routing</h4>
                  <p style={{ color: 'var(--color-text-muted)', fontSize: '0.95rem', lineHeight: '1.5' }}>All video and audio streams are securely routed via an encrypted SFU architecture. We never record or store your sessions. Period.</p>
                </div>
              </div>
              
              <div style={{ display: 'flex', gap: '16px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(245, 158, 11, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fbbf24', flexShrink: 0 }}>
                  <Shield size={20} />
                </div>
                <div>
                  <h4 style={{ fontSize: '1.1rem', marginBottom: '8px' }}>Strict Authentication</h4>
                  <p style={{ color: 'var(--color-text-muted)', fontSize: '0.95rem', lineHeight: '1.5' }}>Your study analytics and streaks are bound to your account using secure JWT tokens. No unauthorized access.</p>
                </div>
              </div>
            </div>
          </div>
          
          {/* Visual Side */}
          <div style={{ position: 'relative' }}>
            <div className="glass-panel" style={{ padding: '32px', border: '2px solid #2b2b2b', borderRadius: '255px 15px 225px 15px / 15px 225px 15px 255px', background: '#fdfbf7', position: 'relative', zIndex: 10 }}>
              <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', margin: '0 auto 16px auto', border: '3px solid #2b2b2b' }}>
                  <CheckCircle2 size={32} />
                </div>
                <h3 style={{ fontSize: '1.4rem', color: '#2b2b2b' }}>Connection Secure</h3>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', background: 'rgba(0,0,0,0.03)', borderRadius: '8px', fontSize: '0.9rem', color: '#2b2b2b' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Lock size={14} color="#10b981" /> LiveKit Media</span>
                  <span style={{ fontWeight: 'bold' }}>E2E Secure</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', background: 'rgba(0,0,0,0.03)', borderRadius: '8px', fontSize: '0.9rem', color: '#2b2b2b' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Lock size={14} color="#10b981" /> Account Data</span>
                  <span style={{ fontWeight: 'bold' }}>JWT Authenticated</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', background: 'rgba(0,0,0,0.03)', borderRadius: '8px', fontSize: '0.9rem', color: '#2b2b2b' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><EyeOff size={14} color="#10b981" /> Advertising</span>
                  <span style={{ fontWeight: 'bold', color: '#10b981' }}>Disabled</span>
                </div>
              </div>
            </div>
            
            {/* Background Decor */}
            <div style={{ position: 'absolute', top: '20px', right: '-20px', width: '100%', height: '100%', border: '2px dashed #d1d5db', borderRadius: '15px 255px 15px 225px / 255px 15px 225px 15px', zIndex: 0 }}></div>
          </div>
          
        </div>
      </ScrollRevealSection>

      {/* How It Works Section */}
      <ScrollRevealSection className="container" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', paddingTop: '60px', paddingBottom: '60px', borderTop: '1px solid var(--color-border-glass)' }}>
        <div style={{ textAlign: 'center', marginBottom: '64px' }}>
          <h2 style={{ fontSize: '2.5rem', marginBottom: '16px' }}>How StudySync Works</h2>
          <p style={{ color: 'var(--color-text-muted)', maxWidth: '600px', margin: '0 auto', fontSize: '1.1rem', lineHeight: '1.6' }}>
            Three simple steps to enter a flow state and maximize your productivity.
          </p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '32px', position: 'relative' }}>
          {/* Step 1 */}
          <div style={{ textAlign: 'center', padding: '24px' }}>
            <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(99, 102, 241, 0.1)', border: '1px solid rgba(99, 102, 241, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', fontWeight: 'bold', color: '#818cf8', margin: '0 auto 24px auto' }}>1</div>
            <h3 style={{ fontSize: '1.5rem', marginBottom: '12px' }}>Create Your Space</h3>
            <p style={{ color: 'var(--color-text-muted)', lineHeight: '1.6' }}>Launch a Private Workspace for solo focus, or create a persistent Study Room for group accountability.</p>
          </div>
          {/* Step 2 */}
          <div style={{ textAlign: 'center', padding: '24px' }}>
            <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(168, 85, 247, 0.1)', border: '1px solid rgba(168, 85, 247, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', fontWeight: 'bold', color: '#c084fc', margin: '0 auto 24px auto' }}>2</div>
            <h3 style={{ fontSize: '1.5rem', marginBottom: '12px' }}>Invite the Team</h3>
            <p style={{ color: 'var(--color-text-muted)', lineHeight: '1.6' }}>Send live invites to online peers. Activate synchronized timers, ambient audio, and shared tasks.</p>
          </div>
          {/* Step 3 */}
          <div style={{ textAlign: 'center', padding: '24px' }}>
            <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', fontWeight: 'bold', color: '#34d399', margin: '0 auto 24px auto' }}>3</div>
            <h3 style={{ fontSize: '1.5rem', marginBottom: '12px' }}>Crush Your Goals</h3>
            <p style={{ color: 'var(--color-text-muted)', lineHeight: '1.6' }}>Track active hours, maintain daily streaks, earn XP to level up, and watch your productivity metrics soar.</p>
          </div>
        </div>
      </ScrollRevealSection>

      {/* Wall of Love Section */}
      <ScrollRevealSection className="container" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', paddingTop: '60px', paddingBottom: '60px', borderTop: '1px solid var(--color-border-glass)' }}>
        <div style={{ textAlign: 'center', marginBottom: '64px' }}>
          <h2 style={{ fontSize: '2.5rem', marginBottom: '16px' }}>Wall of Love</h2>
          <p style={{ color: 'var(--color-text-muted)', maxWidth: '600px', margin: '0 auto', fontSize: '1.1rem', lineHeight: '1.6' }}>
            Join thousands of students and professionals who have leveled up their focus.
          </p>
        </div>
        <div onMouseMove={handleMouseMove} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
          <div className="glass-panel feature-card" style={{ padding: '32px' }}>
            <div style={{ display: 'flex', gap: '4px', color: '#fbbf24', marginBottom: '16px' }}>
              ★ ★ ★ ★ ★
            </div>
            <p style={{ fontSize: '1.1rem', lineHeight: '1.6', marginBottom: '24px', fontStyle: 'italic' }}>
              "StudySync's synchronized timers completely eliminated my procrastination. Seeing my team's timers ticking down forces me to stay locked in."
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <img src="/avatar2.png" alt="Sarah Jenkins" style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }} />
              <div>
                <h4 style={{ fontSize: '1rem' }}>Sarah Jenkins</h4>
                <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>Medical Student</p>
              </div>
            </div>
          </div>
          <div className="glass-panel feature-card" style={{ padding: '32px' }}>
            <div style={{ display: 'flex', gap: '4px', color: '#fbbf24', marginBottom: '16px' }}>
              ★ ★ ★ ★ ★
            </div>
            <p style={{ fontSize: '1.1rem', lineHeight: '1.6', marginBottom: '24px', fontStyle: 'italic' }}>
              "The persistent study rooms are a game-changer. We leave our room open 24/7, and anyone can hop in when they need a burst of collaborative energy."
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <img src="/avatar3.png" alt="Marcus Chen" style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }} />
              <div>
                <h4 style={{ fontSize: '1rem' }}>Marcus Chen</h4>
                <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>Senior Software Engineer</p>
              </div>
            </div>
          </div>
          <div className="glass-panel feature-card" style={{ padding: '32px' }}>
            <div style={{ display: 'flex', gap: '4px', color: '#fbbf24', marginBottom: '16px' }}>
              ★ ★ ★ ★ ★
            </div>
            <p style={{ fontSize: '1.1rem', lineHeight: '1.6', marginBottom: '24px', fontStyle: 'italic' }}>
              "I use the Private Workspace every morning. The streak tracking keeps me honest, and the UI is incredibly sleek. Highly recommend!"
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <img src="/avatar1.png" alt="Elena Rodriguez" style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }} />
              <div>
                <h4 style={{ fontSize: '1rem' }}>Elena Rodriguez</h4>
                <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>Freelance Designer</p>
              </div>
            </div>
          </div>
        </div>
      </ScrollRevealSection>

      {/* Solo vs Group Info Section */}
      <ScrollRevealSection className="container" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', paddingTop: '60px', paddingBottom: '60px', borderTop: '1px solid var(--color-border-glass)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '64px', alignItems: 'center' }}>
          <div>
            <h2 style={{ fontSize: '2.5rem', marginBottom: '24px', letterSpacing: '-0.02em' }}>Work Alone, or Together.</h2>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '1.1rem', lineHeight: '1.6', marginBottom: '32px' }}>
              Whether you need absolute isolation for deep thinking, or the ambient energy of peers to keep you accountable, StudySync adapts to your workflow.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                <div style={{ marginTop: '2px', color: '#34d399' }}><CheckCircle2 size={20} /></div>
                <div>
                  <h4 style={{ fontSize: '1.1rem', marginBottom: '4px' }}>Private Workspace</h4>
                  <p style={{ color: 'var(--color-text-muted)', fontSize: '0.95rem', lineHeight: '1.5' }}>A distraction-free terminal to track personal hours, manage localized tasks, and securely log your streaks.</p>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                <div style={{ marginTop: '2px', color: '#34d399' }}><CheckCircle2 size={20} /></div>
                <div>
                  <h4 style={{ fontSize: '1.1rem', marginBottom: '4px' }}>Group Workspaces</h4>
                  <p style={{ color: 'var(--color-text-muted)', fontSize: '0.95rem', lineHeight: '1.5' }}>Instant connection via P2P web-RTC, shared objectives, and precision-synced timers to keep the team aligned.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="glass-panel" style={{ padding: '40px', display: 'flex', flexDirection: 'column', gap: '24px', background: 'transparent' }}>
            <h3 style={{ fontSize: '1.5rem', color: '#2b2b2b', marginBottom: '8px', transform: 'rotate(-2deg)', display: 'inline-block' }}>Platform Telemetry</h3>
            
            <div style={{ padding: '20px', border: '2px solid #2b2b2b', borderRadius: '255px 15px 225px 15px / 15px 225px 15px 255px', background: 'transparent' }}>
              <h4 style={{ fontSize: '2.5rem', color: '#2b2b2b', fontWeight: 700, letterSpacing: '-0.02em', textShadow: '2px 2px 0 #fef08a' }}>98.4%</h4>
              <p style={{ color: 'var(--color-text-main)', fontSize: '0.95rem', fontWeight: 500, marginTop: '4px' }}>Average Task Completion Rate</p>
            </div>
            
            <div style={{ padding: '20px', border: '2px solid #2b2b2b', borderRadius: '15px 255px 15px 225px / 255px 15px 225px 15px', background: 'transparent' }}>
              <h4 style={{ fontSize: '2.5rem', color: '#2b2b2b', fontWeight: 700, letterSpacing: '-0.02em', textShadow: '2px 2px 0 #bbf7d0' }}>45 min</h4>
              <p style={{ color: 'var(--color-text-main)', fontSize: '0.95rem', fontWeight: 500, marginTop: '4px' }}>Median Deep-Work Duration</p>
            </div>
            
            <div style={{ padding: '20px', border: '2px solid #2b2b2b', borderRadius: '225px 15px 255px 15px / 15px 255px 15px 225px', background: 'transparent' }}>
              <h4 style={{ fontSize: '2.5rem', color: '#2b2b2b', fontWeight: 700, letterSpacing: '-0.02em', textShadow: '2px 2px 0 #bfdbfe' }}>Zero</h4>
              <p style={{ color: 'var(--color-text-main)', fontSize: '0.95rem', fontWeight: 500, marginTop: '4px' }}>Cloud Server Video Storage</p>
            </div>
          </div>
        </div>
      </ScrollRevealSection>

      {/* Footer */}
      <ScrollRevealSection as="footer" style={{ borderTop: '1px solid var(--color-border-glass)', padding: '48px 0', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
        <p>&copy; {new Date().getFullYear()} StudySync. Engineered for professional focus.</p>
      </ScrollRevealSection>
    </div>
  );
}

export default Landing;

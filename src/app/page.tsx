"use client";

import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";

const API_URL = "http://localhost:8080";

export default function DevOpsLabClient() {
  const { user, login, signup, logout } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [authError, setAuthError] = useState("");
  const [labType, setLabType] = useState("");
  const [challenges, setChallenges] = useState<any[]>([]);
  const [attempts, setAttempts] = useState<any[]>([]);
  const [isChallengesLoading, setIsChallengesLoading] = useState(true);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [labUrl, setLabUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<{ type: "info" | "success" | "error" | null; message: string }>({
    type: null,
    message: "",
  });

  const [timer, setTimer] = useState<number>(0);
  const [challengeResult, setChallengeResult] = useState<{ type: "success" | "error" | "info" | null; message: string; output?: string }>({
    type: null,
    message: "",
  });

  const [isLoading, setIsLoading] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [loadingQuoteIndex, setLoadingQuoteIndex] = useState(0);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isInstantKill, setIsInstantKill] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("All");

  const categories = React.useMemo(() => {
    return ["All", ...Array.from(new Set(challenges.flatMap(c => c.tags || [])))];
  }, [challenges]);

  const filteredChallenges = React.useMemo(() => {
    return selectedCategory === "All"
      ? challenges
      : challenges.filter(c => (c.tags || []).includes(selectedCategory));
  }, [challenges, selectedCategory]);

  const quotes = [
    "“If it hurts, do it more frequently, and bring the pain forward.” — Jez Humble",
    "“Automation is cost-cutting by tightening the corners and not cutting them.” — J. Vlissides",
    "“There is always a better way.” — Thomas Edison",
    "“DevOps is not a goal, but a never-ending process of continual improvement.” — Jez Humble",
    "“The most powerful tool we have as developers is automation.” — Scott Hanselman",
    "“To improve is to change; to be perfect is to change often.” — Winston Churchill",
    "“Code is read much more often than it is written.” — Guido van Rossum",
  ];

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const quoteTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (quoteTimerRef.current) clearInterval(quoteTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const fetchChallenges = async () => {
      try {
        const response = await fetch(`${API_URL}/api/challenges`);
        if (!response.ok) throw new Error("Networking issue");
        const data = await response.json();
        setChallenges(data || []);
        if (data && data.length > 0) {
          setLabType(data[0].id);
        }
      } catch (e) {
        // Suppress console.error here so Next.js doesn't throw a full-screen dev overlay when the Go server is offline
      } finally {
        setIsChallengesLoading(false);
      }
    };
    fetchChallenges();
  }, [user]);

  useEffect(() => {
    if (timer > 0) {
      timerRef.current = setTimeout(() => setTimer(timer - 1), 1000);
    } else if (timer === 0 && sessionId) {
      setStatus({ type: "error", message: "Time Expired. Stopping lab..." });
      stopLab();
    }
    return () => clearTimeout(timerRef.current as NodeJS.Timeout);
  }, [timer, sessionId]);

  useEffect(() => {
    if (user) {
      fetchAttempts();
    } else {
      setAttempts([]);
    }
  }, [user]);

  const fetchAttempts = async () => {
    if (!user) return;
    try {
      const response = await fetch(`${API_URL}/api/attempts?userId=${user.uid}`);
      if (response.ok) {
        const data = await response.json();
        setAttempts(data || []);
      }
    } catch (e) { }
  };

  const totalScore = attempts.reduce((acc, curr) => acc + (curr.scoreEarned || 0), 0);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    setIsLoading(true);
    setIsAuthenticating(true);
    try {
      if (isLoginMode) {
        await login(email, password);
      } else {
        await signup(email, password, displayName);
      }
    } catch (err: any) {
      setAuthError(err.message || "Authentication failed");
    } finally {
      setIsLoading(false);
      setIsAuthenticating(false);
    }
  };

  const startLab = async (challengeId?: string | any) => {
    const activeLabTypeId = typeof challengeId === 'string' ? challengeId : labType;
    if (typeof challengeId === 'string') setLabType(challengeId);

    setIsLoading(true);
    setLoadingQuoteIndex(0);
    setStatus({ type: "info", message: "Provisioning Cloud Run container..." });
    setChallengeResult({ type: null, message: "" });

    // Start rotating quotes
    quoteTimerRef.current = setInterval(() => {
      setLoadingQuoteIndex((prev) => (prev + 1) % quotes.length);
    }, 7000);

    try {
      const response = await fetch(`${API_URL}/start-lab`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ labType: activeLabTypeId, userId: user?.uid, userEmail: user?.email, userDisplayName: user?.displayName }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      setSessionId(data.sessionID);
      setLabUrl(data.url);
      setTimer(5 * 60);
      setStatus({ type: "success", message: "Lab successfully started!" });
    } catch (error: any) {
      setStatus({ type: "error", message: `Error: ${error.message}` });
      setSessionId(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStopLab = (instant: boolean = false) => {
    setIsInstantKill(instant);
    setShowConfirmModal(true);
  };

  const confirmStopLab = () => {
    setShowConfirmModal(false);
    stopLab(isInstantKill);
  };

  const cancelStopLab = () => {
    setShowConfirmModal(false);
    setIsInstantKill(false);
  };

  const stopLab = async (skipEvaluation: boolean = false) => {
    if (!sessionId) return;
    setIsLoading(true);
    if (!skipEvaluation) {
      setIsEvaluating(true);
      setStatus({ type: "info", message: "Evaluated your changes" });
    } else {
      setStatus({ type: "info", message: "Ending session instantly..." });
    }

    try {
      const response = await fetch(`${API_URL}/stop-lab`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionID: sessionId, skipEvaluation }),
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();

      resetLabState();

      if (data.result === "SUCCESS") {
        setChallengeResult({ type: "success", message: "Challenge Passed!", output: data.output });
      } else if (data.result === "FAILURE") {
        setChallengeResult({ type: "error", message: "Challenge Failed", output: data.output });
      } else if (data.result) {
        setChallengeResult({ type: "info", message: "Evaluation Completed", output: data.output });
      } else {
        setStatus({ type: "success", message: isInstantKill ? "Lab stopped successfully." : "Lab submitted successfully." });
      }
      fetchAttempts();
    } catch (error: any) {
      setStatus({ type: "error", message: `Error stopping lab: ${error.message}` });
    } finally {
      setIsLoading(false);
      setIsEvaluating(false);
    }
  };



  const resetLabState = () => {
    setSessionId(null);
    setLabUrl(null);
    setTimer(0);
    if (timerRef.current) clearTimeout(timerRef.current);
  };

  const formatTime = (totalSeconds: number) => {
    const min = Math.floor(totalSeconds / 60);
    const sec = totalSeconds % 60;
    return `${min.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  };

  const activeChallengeDef = challenges.find((c) => c.id === labType);

  return (
    <>
      {showConfirmModal && (
        <div className="confirm-modal-overlay">
          <div className="confirm-modal-content glass-panel" style={{ maxWidth: '400px', border: isInstantKill ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid rgba(99, 102, 241, 0.3)' }}>
            <h2 style={{ color: 'white', marginBottom: '1rem' }}>{isInstantKill ? "Stop Session?" : "Submit Lab?"}</h2>
            <p style={{ color: '#94a3b8', marginBottom: '2rem' }}>
              {isInstantKill
                ? "This will instantly destroy your container. Any unsaved progress will be lost and NO evaluation will be performed."
                : "Are you ready to submit? This will end your session and evaluate your configuration changes."}
            </p>
            <div className="modal-actions" style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <button className="button-secondary" onClick={cancelStopLab}>
                Cancel
              </button>
              <button className={isInstantKill ? "button-danger" : "button-primary"} onClick={confirmStopLab}>
                {isInstantKill ? "Yes, Stop" : "Yes, Submit"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className={`loading-overlay ${(isLoading && !sessionId) || isEvaluating ? "visible" : ""}`}>
        <div className="loading-content">
          <div className="loading-spinner"></div>
          <h2 className="loading-title">
            {isEvaluating ? "Analyzing Your Changes..." : isAuthenticating ? "Authenticating..." : "Preparing the Lab"}
          </h2>
          <p className="loading-quote">
            {isEvaluating ? "“Quality is not an act, it is a habit.” — Aristotle" : isAuthenticating ? "Please wait while we sign you in..." : quotes[loadingQuoteIndex]}
          </p>
        </div>
      </div>

      {!user ? (
        <div className="portal-container">
          <header className="portal-header">
            <img src="/deployit-logo.png" alt="Deploy(it) Logo" className="portal-logo" />
          </header>
          <div className="portal-main">
            <div className="portal-content-box" style={{ maxWidth: '400px', margin: '0 auto' }}>
              <div className="glass-panel" style={{ padding: '2.5rem' }}>
                <h1 style={{ fontSize: '1.75rem', fontWeight: 900, color: 'white', marginBottom: '0.5rem', textAlign: 'center' }}>
                  {isLoginMode ? "Sign In" : "Create Account"}
                </h1>
                <p style={{ color: '#94a3b8', marginBottom: '2rem', textAlign: 'center', fontSize: '0.9rem' }}>
                  to access your DevOps Lab
                </p>

                {authError && (
                  <div className="status-badge status-error" style={{ marginBottom: '1.5rem', fontSize: '0.85rem' }}>
                    {authError}
                  </div>
                )}

                <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {!isLoginMode && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <label style={{ color: '#cbd5e1', fontSize: '0.8rem', fontWeight: 600 }}>Full Name</label>
                      <input
                        type="text"
                        required
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder="Your Name"
                        className="challenge-input"
                        style={{ width: '100%' }}
                      />
                    </div>
                  )}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <label style={{ color: '#cbd5e1', fontSize: '0.8rem', fontWeight: 600 }}>Email Address</label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Your Email"
                      className="challenge-input"
                      style={{ width: '100%' }}
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <label style={{ color: '#cbd5e1', fontSize: '0.8rem', fontWeight: 600 }}>Password</label>
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="challenge-input"
                      style={{ width: '100%' }}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="button-primary"
                    style={{ width: '100%', marginTop: '1rem', padding: '1rem' }}
                  >
                    {isLoading ? "Please wait..." : (isLoginMode ? "Login" : "Sign Up")}
                  </button>
                </form>

                <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
                  <button
                    onClick={() => { setIsLoginMode(!isLoginMode); setAuthError(""); }}
                    style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '0.9rem' }}
                  >
                    {isLoginMode ? "Don't have an account? Sign Up" : "Already have an account? Login"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : !sessionId ? (
        <div className={`portal-container ${isLoading ? "blurred" : ""}`}>
          <header className="portal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
              <Link href="/">
                <img src="/deployit-logo.png" alt="Deploy(it) Logo" className="portal-logo" style={{ cursor: 'pointer' }} />
              </Link>
              <nav style={{ display: 'flex', gap: '1.5rem' }}>
                <Link href="/" style={{ color: 'white', fontSize: '0.9rem', fontWeight: 600, textDecoration: 'none', borderBottom: '2px solid var(--primary)', paddingBottom: '4px' }}>Challenges</Link>
                <Link href="/history" style={{ color: '#94a3b8', fontSize: '0.9rem', fontWeight: 600, textDecoration: 'none' }}>History</Link>
              </nav>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
              <div style={{ background: 'rgba(99, 102, 241, 0.1)', padding: '0.4rem 1rem', borderRadius: '12px', border: '1px solid rgba(99, 102, 241, 0.2)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#818cf8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Score</span>
                <span style={{ fontSize: '1.1rem', fontWeight: 900, color: 'white' }}>{totalScore}</span>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ color: 'white', fontSize: '0.9rem', fontWeight: 600 }}>{user.displayName}</div>
                <div style={{ color: '#94a3b8', fontSize: '0.75rem' }}>{user.email}</div>
              </div>
              <button onClick={logout} className="button-secondary" style={{ padding: '0.5rem 1rem', fontSize: '0.8rem' }}>Logout</button>
            </div>
          </header>

          <div className="portal-main">
            <div className="portal-content-box">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>

                {status.message && (
                  <div className={`status-badge ${status.type === "info" ? "status-info" : status.type === "success" ? "status-success" : "status-error"}`}>
                    {status.message}
                  </div>
                )}

                {challengeResult.message && (
                  <div className={`result-page-card ${challengeResult.type === "success" ? "result-success" : "result-failure"}`}
                    style={{
                      padding: '2rem',
                      borderRadius: '16px',
                      background: challengeResult.type === "success" ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                      border: challengeResult.type === "success" ? '1px solid rgba(16, 185, 129, 0.2)' : '1px solid rgba(239, 68, 68, 0.2)',
                      textAlign: 'center'
                    }}>
                    <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>
                      {challengeResult.type === "success" ? "🏆" : "❌"}
                    </div>
                    <h2 style={{ fontSize: '2rem', fontWeight: 900, margin: 0, color: challengeResult.type === "success" ? '#10b981' : '#ef4444' }}>
                      {challengeResult.message}
                    </h2>
                    <p style={{ color: '#94a3b8', marginTop: '0.5rem' }}>
                      {challengeResult.type === "success" ? "Great job! You have met all the evaluation criteria." : "Keep trying! Your changes didn't meet the requirements yet."}
                    </p>

                    {challengeResult.output && (
                      <div style={{ marginTop: '1.5rem', textAlign: 'left' }}>
                        <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b', marginBottom: '0.5rem', fontWeight: 700 }}>Evaluation Logs</div>
                        <pre style={{ background: 'rgba(0,0,0,0.4)', padding: '1rem', borderRadius: '8px', fontSize: '0.85rem', color: '#cbd5e1', overflow: 'auto', maxHeight: '200px', border: '1px solid rgba(255,255,255,0.05)', fontFamily: 'monospace' }}>
                          {challengeResult.output}
                        </pre>
                      </div>
                    )}

                    <button
                      onClick={() => setChallengeResult({ type: null, message: "" })}
                      className="button-secondary"
                      style={{ marginTop: '2rem' }}
                    >
                      Back to Challenges
                    </button>
                  </div>
                )}

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'white', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      Available Challenges
                    </h2>

                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      {categories.map(cat => (
                        <button
                          key={cat}
                          onClick={() => setSelectedCategory(cat)}
                          style={{
                            padding: '0.4rem 1rem',
                            borderRadius: '20px',
                            border: '1px solid',
                            borderColor: selectedCategory === cat ? 'var(--primary)' : 'rgba(255,255,255,0.1)',
                            background: selectedCategory === cat ? 'rgba(245, 158, 11, 0.1)' : 'transparent',
                            color: selectedCategory === cat ? 'var(--primary)' : '#94a3b8',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="challenge-cards" style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(450px, 1fr))',
                    gap: '1.5rem'
                  }}>
                    {isChallengesLoading ? (
                      <p style={{ color: '#94a3b8' }}>Loading challenges...</p>
                    ) : filteredChallenges.length === 0 ? (
                      <p style={{ color: '#94a3b8' }}>No challenges found for this category.</p>
                    ) : (
                      filteredChallenges.map((c) => (
                        <div
                          key={c.id}
                          className="glass-panel"
                          style={{
                            border: labType === c.id ? '1px solid var(--primary)' : '1px solid rgba(255, 255, 255, 0.1)',
                            borderRadius: '12px', padding: '1.5rem', position: 'relative', overflow: 'hidden', transition: 'all 0.2s ease',
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '2rem'
                          }}
                        >
                          <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', background: labType === c.id ? 'var(--primary)' : 'transparent', transition: 'background 0.2s ease' }}></div>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                              <div style={{ background: labType === c.id ? 'rgba(99, 102, 241, 0.15)' : 'rgba(255,255,255,0.05)', padding: '0.5rem', borderRadius: '8px', color: labType === c.id ? 'var(--primary)' : '#94a3b8' }}>
                                <img src="/file.svg" alt="Challenge File Icon" style={{ width: '20px', height: '20px', display: 'block', filter: labType === c.id ? 'invert(60%) sepia(85%) saturate(3002%) hue-rotate(218deg) brightness(98%) contrast(92%)' : 'invert(75%) sepia(12%) saturate(366%) hue-rotate(185deg) brightness(88%) contrast(85%)' }} />
                              </div>
                              <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'white' }}>{c.title}</h4>
                            </div>
                            <p style={{ fontSize: '0.85rem', color: '#cbd5e1', lineHeight: 1.6, marginBottom: '0' }}>
                              {c.description}
                            </p>
                            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
                              <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#10b981', background: 'rgba(16, 185, 129, 0.1)', padding: '0.2rem 0.6rem', borderRadius: '4px', marginRight: '0.5rem' }}>+{c.score} pts</span>
                              <span style={{ fontSize: '0.7rem', background: 'rgba(255,255,255,0.1)', padding: '0.2rem 0.5rem', borderRadius: '4px', color: '#cbd5e1' }}>{c.difficulty}</span>
                              {c.tags?.map((t: string) => (
                                <span key={t} style={{ fontSize: '0.7rem', background: 'rgba(99,102,241,0.1)', padding: '0.2rem 0.5rem', borderRadius: '4px', color: '#818cf8' }}>{t}</span>
                              ))}
                            </div>
                          </div>
                          <div>
                            <button onClick={() => startLab(c.id)} disabled={isLoading && labType === c.id} className="button-primary" style={{ whiteSpace: 'nowrap' }}>
                              {isLoading && labType === c.id ? "Starting..." : "Start Challenge"}
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>



              </div>
            </div>
          </div>
        </div >
      ) : (
        <div className="active-lab-container">
          <div className="lab-top">
            <div className="lab-top-left">
              <div className="active-challenge">
                <div className="inline-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <img src="/deployit-logo.png" alt="Deploy(it) Logo" style={{ height: "36px", objectFit: "contain" }} />
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ color: 'white', fontSize: '0.8rem', fontWeight: 600 }}>{user?.displayName}</div>
                      <div style={{ color: '#94a3b8', fontSize: '0.7rem' }}>{user?.email}</div>
                    </div>
                  </div>
                </div>

                <h3 className="challenge-title">
                  <img src="/file.svg" alt="Challenge File Icon" style={{ width: '16px', height: '16px', display: 'inline-block', marginRight: '8px', filter: 'invert(80%) sepia(20%) saturate(300%) hue-rotate(180deg) brightness(98%) contrast(92%)' }} />
                  {activeChallengeDef?.title || "DevOps Challenge"}
                </h3>
                <p className="challenge-desc">
                  {activeChallengeDef?.description || "A secret flag string is injected into the container. Find and extract it!"}
                </p>


                {challengeResult.message && (
                  <div className={`status-badge mt-4 ${challengeResult.type === "success" ? "status-success" : challengeResult.type === "error" ? "status-error" : "status-info"}`}>
                    {challengeResult.message}
                  </div>
                )}
              </div>
            </div>

            <div className="lab-top-right">
              <div className="active-timer-wrapper">
                <div className="dominant-timer active-timer">
                  <span className="dominant-timer-label">Time Remaining</span>
                  <div className={`timer-value ${timer < 60 ? "timer-danger" : "timer-safe"}`}>
                    {formatTime(timer)}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '220px' }}>
                  <button onClick={() => handleStopLab(false)} disabled={isLoading} className="button-primary" style={{ padding: '0.6rem 2rem', fontSize: '0.9rem', width: '100%' }}>
                    Submit
                  </button>
                  <button onClick={() => handleStopLab(true)} disabled={isLoading} className="button-danger" style={{ padding: '0.6rem 2rem', fontSize: '0.8rem', background: '#dc2626', borderColor: '#dc2626', color: 'white', width: '100%' }}>
                    Stop Session
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="lab-terminal">
            <div className="iframe-container">
              <div className="iframe-header">
                <div className="mac-dots">
                  <div className="mac-dot dot-red"></div>
                  <div className="mac-dot dot-yellow"></div>
                  <div className="mac-dot dot-green"></div>
                </div>
                <div className="header-title">
                  cloud-run-tty: {labType} — bash (ID: {sessionId})
                </div>
              </div>

              {labUrl && (
                <iframe
                  src={labUrl}
                  className="iframe-window"
                  title="Lab Terminal"
                  allow="clipboard-read; clipboard-write"
                />
              )}
            </div>
          </div>
        </div>
      )
      }
    </>
  );
}

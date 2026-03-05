"use client";

import React, { useState, useEffect, useRef } from "react";
import { useAuth, authHeaders } from "@/context/AuthContext";
import Link from "next/link";

const API_URL = "http://localhost:8080";

export default function DevOpsLabClient() {
  const { user, login, signup, logout, resetPassword, sendVerificationEmail } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [isForgotPasswordMode, setIsForgotPasswordMode] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [verificationSent, setVerificationSent] = useState(false);
  const [authError, setAuthError] = useState("");
  const [profileImageFile, setProfileImageFile] = useState<File | null>(null);
  const [profileImagePreview, setProfileImagePreview] = useState<string | null>(null);
  const profileImageInputRef = React.useRef<HTMLInputElement>(null);

  const handleProfileImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const MAX_SIZE_MB = 1;
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      setAuthError(`Profile image must be smaller than ${MAX_SIZE_MB}MB. Your file is ${(file.size / 1024 / 1024).toFixed(2)}MB.`);
      e.target.value = ""; // Reset input
      setProfileImageFile(null);
      setProfileImagePreview(null);
      return;
    }

    setAuthError("");
    setProfileImageFile(file);
    setProfileImagePreview(URL.createObjectURL(file));
  };
  const [labType, setLabType] = useState<string>("");
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

  // Reset to page 1 whenever filter changes
  const handleCategoryChange = (cat: string) => {
    setSelectedCategory(cat);
    setCurrentPage(1);
  };

  const categories = React.useMemo(() => {
    return ["All", ...Array.from(new Set(challenges.flatMap(c => c.tags || [])))];
  }, [challenges]);

  const ITEMS_PER_PAGE = 6;
  const [currentPage, setCurrentPage] = useState(1);

  const filteredChallenges = React.useMemo(() => {
    const all = selectedCategory === "All"
      ? challenges
      : challenges.filter(c => (c.tags || []).includes(selectedCategory));
    // Filter out locked challenges from the student view
    return all.filter(c => !c.locked);
  }, [challenges, selectedCategory]);

  const totalPages = Math.ceil(filteredChallenges.length / ITEMS_PER_PAGE);

  const pagedChallenges = React.useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredChallenges.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredChallenges, currentPage, ITEMS_PER_PAGE]);

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

  // ── Restore active session from sessionStorage on page refresh ──────────────
  useEffect(() => {
    const savedSession = sessionStorage.getItem("active_lab_session");
    if (savedSession) {
      try {
        const { sessionId: sid, labUrl: url, labType: lt, timer: t } = JSON.parse(savedSession);
        if (sid && url) {
          setSessionId(sid);
          setLabUrl(url);
          if (lt) setLabType(lt);
          if (t && t > 0) setTimer(t);
          setStatus({ type: "success", message: "Session restored after refresh." });
        }
      } catch { /* ignore parse errors */ }
    }
  }, []);

  // ── Persist session state to sessionStorage whenever it changes ─────────────
  useEffect(() => {
    if (sessionId && labUrl) {
      sessionStorage.setItem("active_lab_session", JSON.stringify({ sessionId, labUrl, labType, timer }));
    }
  }, [sessionId, labUrl, labType, timer]);

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

  // Keep-alive script: Since Cloud Run uses request-based billing (CPU throttling), 
  // background container processes will freeze without active requests. This pings the container
  // to trick it into staying awake until the user requests an evaluation.
  useEffect(() => {
    let keepAliveInterval: NodeJS.Timeout;
    if (sessionId && labUrl) {
      keepAliveInterval = setInterval(() => {
        console.log(`[Keep-Alive] Pinging container at ${labUrl} to prevent instance sleep...`);
        fetch(labUrl, { mode: 'no-cors' }).catch((err) => {
          console.warn("[Keep-Alive] Ping failed:", err);
        });
      }, 10000);
    }
    return () => {
      if (keepAliveInterval) clearInterval(keepAliveInterval);
    };
  }, [sessionId, labUrl]);

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
      const response = await fetch(`${API_URL}/api/attempts?userId=${user.uid}`, {
        headers: authHeaders(),
      });
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
        await signup(email, password, displayName, profileImageFile);
      }

      // Mark first login verification as needed if logging in for the first time
      if (!localStorage.getItem(`devops_verified_${email}`)) {
        localStorage.setItem(`devops_first_login_${email}`, "true");
      }
    } catch (err: any) {
      setAuthError(err.message || "Authentication failed");
    } finally {
      setIsLoading(false);
      setIsAuthenticating(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setAuthError("Please enter your email to reset password.");
      return;
    }
    setIsLoading(true);
    setAuthError("");
    try {
      await resetPassword(email);
      setResetSent(true);
    } catch (err: any) {
      setAuthError(err.message || "Failed to send reset email");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendVerification = async () => {
    try {
      setVerificationSent(true);
      if (user?.email) {
        localStorage.setItem(`devops_verified_${user.email}`, "true");
        localStorage.removeItem(`devops_first_login_${user.email}`);
      }
      await sendVerificationEmail();
    } catch (e: any) {
      console.warn("Verification failed", e);
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
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ labType: activeLabTypeId, userId: user?.uid, userEmail: user?.email, userDisplayName: user?.displayName }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      setSessionId(data.sessionID);
      setLabUrl(data.url);
      setTimer(data.timeLimit || 300); // Dynamic timer depending on challenge
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
        headers: { "Content-Type": "application/json", ...authHeaders() },
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
    sessionStorage.removeItem("active_lab_session"); // clear persisted session
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
          {(!isEvaluating && !isAuthenticating) && (
            <div style={{ marginTop: '1rem', fontSize: '0.85rem', color: '#94a3b8', fontWeight: 600, letterSpacing: '0.05em' }}>
              (This takes 30 seconds to 1 minute)
            </div>
          )}
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
                  {isForgotPasswordMode ? "Reset Password" : isLoginMode ? "Sign In" : "Create Account"}
                </h1>
                <p style={{ color: '#94a3b8', marginBottom: '2rem', textAlign: 'center', fontSize: '0.9rem' }}>
                  {isForgotPasswordMode ? "Enter your email to receive a reset link" : "to access your DevOps Lab"}
                </p>

                {authError && (
                  <div className="status-badge status-error" style={{ marginBottom: '1.5rem', fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <span>{authError}</span>
                    {authError.toLowerCase().includes("already exists") && (
                      <button
                        type="button"
                        onClick={() => { setIsLoginMode(true); setAuthError(""); }}
                        style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 700, padding: 0, textAlign: 'left' }}
                      >
                        → Log in instead
                      </button>
                    )}
                  </div>
                )}

                {resetSent && isForgotPasswordMode ? (
                  <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
                    <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📧</div>
                    <div style={{ color: '#10b981', fontWeight: 700, marginBottom: '1rem' }}>Reset link sent!</div>
                    <p style={{ color: '#cbd5e1', fontSize: '0.85rem' }}>Please check your inbox (and spam folder) for further instructions.</p>
                    <button onClick={() => { setIsForgotPasswordMode(false); setResetSent(false); }} className="button-secondary" style={{ marginTop: '1.5rem' }}>Back to Login</button>
                  </div>
                ) : isForgotPasswordMode ? (
                  <form onSubmit={handleForgotPassword} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
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
                    <button type="submit" disabled={isLoading} className="button-primary" style={{ width: '100%', marginTop: '1rem', padding: '1rem' }}>
                      {isLoading ? "Sending..." : "Send Reset Link"}
                    </button>
                    <div style={{ marginTop: '1rem', textAlign: 'center' }}>
                      <button type="button" onClick={() => setIsForgotPasswordMode(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '0.85rem' }}>Back to Login</button>
                    </div>
                  </form>
                ) : (
                  <>
                    <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      {!isLoginMode && (
                        <>
                          {/* Profile Image Upload */}
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                            <div
                              onClick={() => profileImageInputRef.current?.click()}
                              style={{
                                width: 80, height: 80, borderRadius: '50%',
                                background: profileImagePreview ? 'transparent' : 'rgba(99,102,241,0.15)',
                                border: '2px dashed rgba(99,102,241,0.4)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                cursor: 'pointer', overflow: 'hidden', position: 'relative',
                                transition: 'border-color 0.2s',
                              }}
                            >
                              {profileImagePreview ? (
                                <img src={profileImagePreview} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              ) : (
                                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="rgba(99,102,241,0.7)" strokeWidth="1.5">
                                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                  <circle cx="12" cy="7" r="4" />
                                </svg>
                              )}
                            </div>
                            <input
                              ref={profileImageInputRef}
                              type="file"
                              accept="image/*"
                              style={{ display: 'none' }}
                              onChange={handleProfileImageChange}
                            />
                            <span style={{ color: '#64748b', fontSize: '0.72rem' }}>
                              {profileImagePreview ? 'Click to change photo' : 'Click to add profile photo (optional)'}
                            </span>
                          </div>

                          {/* Full Name */}
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
                        </>
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
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <label style={{ color: '#cbd5e1', fontSize: '0.8rem', fontWeight: 600 }}>Password</label>
                          {isLoginMode && (
                            <button
                              type="button"
                              onClick={() => setIsForgotPasswordMode(true)}
                              style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }}
                            >
                              Forgot Password?
                            </button>
                          )}
                        </div>
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
                        onClick={() => { setIsLoginMode(!isLoginMode); setAuthError(""); setIsForgotPasswordMode(false); }}
                        style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '0.9rem' }}
                      >
                        {isLoginMode ? "Don't have an account? Sign Up" : "Already have an account? Login"}
                      </button>
                    </div>
                  </>
                )}
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
              {/* Profile Avatar */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{
                  width: 38, height: 38, borderRadius: '50%',
                  overflow: 'hidden', flexShrink: 0,
                  border: '2px solid rgba(99,102,241,0.4)',
                  background: 'rgba(99,102,241,0.15)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {user.photoUrl ? (
                    <img src={user.photoUrl} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <span style={{ color: '#818cf8', fontWeight: 900, fontSize: '1rem' }}>
                      {user.displayName?.charAt(0)?.toUpperCase() || '?'}
                    </span>
                  )}
                </div>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ color: 'white', fontSize: '0.9rem', fontWeight: 600 }}>{user.displayName}</div>
                  <div style={{ color: '#94a3b8', fontSize: '0.75rem' }}>{user.email}</div>
                </div>
              </div>
              <button onClick={logout} className="button-secondary" style={{ padding: '0.5rem 1rem', fontSize: '0.8rem' }}>Logout</button>
            </div>
          </header>

          <div className="portal-main">
            {user?.email && localStorage.getItem(`devops_first_login_${user.email}`) && !localStorage.getItem(`devops_verified_${user.email}`) && (
              <div style={{ background: 'rgba(245, 158, 11, 0.15)', borderBottom: '1px solid rgba(245, 158, 11, 0.3)', padding: '1rem', textAlign: 'center', color: '#fcd34d' }}>
                <span style={{ fontWeight: 600, marginRight: '1rem' }}>Welcome! For full platform access, please verify your email address. </span>
                {verificationSent ? (
                  <span style={{ color: '#10b981', fontWeight: 700 }}>Verification sent!</span>
                ) : (
                  <button onClick={handleSendVerification} style={{ background: 'transparent', border: '1px solid #f59e0b', color: '#fcd34d', padding: '0.25rem 0.75rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}>Send Verification Link</button>
                )}
              </div>
            )}
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
                          onClick={() => handleCategoryChange(cat)}
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

                  {/* Challenge cards grid */}
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
                      pagedChallenges.map((c) => (
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

                  {/* ── Pagination bar ── */}
                  {totalPages > 1 && (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.5rem',
                      marginTop: '2rem',
                      flexWrap: 'wrap',
                    }}>
                      {/* Prev */}
                      <button
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        style={{
                          padding: '0.45rem 1rem',
                          borderRadius: '8px',
                          border: '1px solid rgba(255,255,255,0.1)',
                          background: 'transparent',
                          color: currentPage === 1 ? '#475569' : '#94a3b8',
                          fontSize: '0.8rem',
                          fontWeight: 700,
                          cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                          transition: 'all 0.2s ease',
                        }}
                      >
                        ← Prev
                      </button>

                      {/* Page numbers */}
                      {Array.from({ length: totalPages }, (_, i) => i + 1)
                        .filter(page => {
                          // Show first, last, current ±1, and ellipsis hints
                          if (totalPages <= 7) return true;
                          return page === 1 || page === totalPages ||
                            Math.abs(page - currentPage) <= 1;
                        })
                        .reduce<(number | '...')[]>((acc, page, idx, arr) => {
                          if (idx > 0 && typeof arr[idx - 1] === 'number' && (arr[idx - 1] as number) + 1 < page) {
                            acc.push('...');
                          }
                          acc.push(page);
                          return acc;
                        }, [])
                        .map((item, idx) =>
                          item === '...' ? (
                            <span key={`ellipsis-${idx}`} style={{ color: '#475569', padding: '0 0.25rem', fontSize: '0.85rem' }}>…</span>
                          ) : (
                            <button
                              key={item}
                              onClick={() => setCurrentPage(item as number)}
                              style={{
                                width: '36px',
                                height: '36px',
                                borderRadius: '8px',
                                border: '1px solid',
                                borderColor: currentPage === item ? 'var(--primary)' : 'rgba(255,255,255,0.1)',
                                background: currentPage === item ? 'rgba(245,158,11,0.15)' : 'transparent',
                                color: currentPage === item ? 'var(--primary)' : '#94a3b8',
                                fontSize: '0.8rem',
                                fontWeight: currentPage === item ? 800 : 600,
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                              }}
                            >
                              {item}
                            </button>
                          )
                        )
                      }

                      {/* Next */}
                      <button
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        style={{
                          padding: '0.45rem 1rem',
                          borderRadius: '8px',
                          border: '1px solid rgba(255,255,255,0.1)',
                          background: 'transparent',
                          color: currentPage === totalPages ? '#475569' : '#94a3b8',
                          fontSize: '0.8rem',
                          fontWeight: 700,
                          cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                          transition: 'all 0.2s ease',
                        }}
                      >
                        Next →
                      </button>

                      {/* Count summary */}
                      <span style={{ fontSize: '0.75rem', color: '#475569', marginLeft: '0.5rem' }}>
                        {(currentPage - 1) * ITEMS_PER_PAGE + 1}–{Math.min(currentPage * ITEMS_PER_PAGE, filteredChallenges.length)} of {filteredChallenges.length}
                      </span>
                    </div>
                  )}
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

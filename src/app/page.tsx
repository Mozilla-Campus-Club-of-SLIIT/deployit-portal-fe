"use client";

import React, { useState, useEffect, useRef } from "react";
import { useAuth, authHeaders } from "@/context/AuthContext";
import { useLab } from "@/context/LabContext";
import { useRouter } from "next/navigation";
import Link from "next/link";
import ProvisioningBanner from "@/components/ProvisioningBanner";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

export default function DevOpsLabClient() {
  const { user, login, signup, logout, resetPassword, sendVerificationEmail, verifyOtp } = useAuth();
  const { 
    sessionId, setSessionId, labUrl, setLabUrl, labType, setLabType, 
    timer, setTimer, isLoading, setIsLoading, status, setStatus,
    challengeResult, setChallengeResult, isEvaluating, setIsEvaluating,
    resetLabState, recoverSession, setIsProvisioning, isProvisioning
  } = useLab();

  const router = useRouter();

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
  const [otpCode, setOtpCode] = useState("");
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
  const [challenges, setChallenges] = useState<any[]>([]);
  const [attempts, setAttempts] = useState<any[]>([]);
  const [isChallengesLoading, setIsChallengesLoading] = useState(true);
  const [isSendingVerification, setIsSendingVerification] = useState(false);
  const [loadingQuoteIndex, setLoadingQuoteIndex] = useState(0);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isInstantKill, setIsInstantKill] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [showProvisioningPopup, setShowProvisioningPopup] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const isProcessingRef = useRef(false);

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

  const quoteTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
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
        if (data && data.length > 0 && !labType) {
          setLabType(data[0].id);
        }
      } catch (e) {
      } finally {
        setIsChallengesLoading(false);
      }
    };
    fetchChallenges();
  }, [user]);

  // Keep-alive script
  useEffect(() => {
    let keepAliveInterval: NodeJS.Timeout;
    if (sessionId && labUrl) {
      keepAliveInterval = setInterval(() => {
        fetch(labUrl, { mode: 'no-cors' }).catch(() => {});
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

      // No longer using localStorage hacks for verification tracking
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
      setIsSendingVerification(true);
      await sendVerificationEmail();
      setVerificationSent(true);
      setAuthError("");
    } catch (e: any) {
      console.warn("Verification failed", e);
      setAuthError("Failed to send verification code.");
    } finally {
      setIsSendingVerification(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (otpCode.trim().length < 6) {
        setAuthError("Please enter a valid 6-digit verification code.");
        return;
    }
    setAuthError("");
    setIsSendingVerification(true);
    try {
        await verifyOtp(otpCode);
    } catch (e: any) {
        setAuthError(e.message);
    } finally {
        setIsSendingVerification(false);
    }
  };

  const startLab = async (challengeId?: string | any) => {
    const activeLabTypeId = typeof challengeId === 'string' ? challengeId : labType;

    // Prevent multiple concurrent operations
    if (isProcessingRef.current || isLoading || isProvisioning || isEvaluating) {
      if (isProvisioning) {
        setShowProvisioningPopup(true);
      }
      return;
    }

    // Prevent multiple concurrent labs
    if (sessionId) {
      if (activeLabTypeId === labType) {
        setStatus({ type: "info", message: "You already have an active lab session for this challenge." });
      } else {
        setStatus({ type: "error", message: "A lab session is already running. Please stop your current lab before starting a new one." });
      }
      return;
    }

    isProcessingRef.current = true;
    setIsLoading(true);
    setIsProvisioning(true);

    if (typeof challengeId === 'string') setLabType(challengeId);
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
        const errorText = (await response.text()).trim();
        if (response.status === 409) {
          setShowProvisioningPopup(true);
          
          recoverSession(true); // Sync with actual provisioning lab metadata
          return;
        }
        throw new Error(errorText || `HTTP ${response.status}`);
      }

      const data = await response.json();
      
      // If we got back an existing session, make sure we show the correct lab metadata
      if (data.challengeID && data.challengeID !== labType) {
        setLabType(data.challengeID);
        setStatus({ type: "info", message: "Redirecting to your existing active lab session..." });
      } else {
        setStatus({ type: "success", message: "Lab successfully started!" });
      }

      setSessionId(data.sessionID);
      setLabUrl(data.url);
      setTimer(data.timeLimit || 300); // Dynamic timer depending on challenge
      setIsProvisioning(false);
    } catch (error: any) {
      setStatus({ type: "error", message: `Error: ${error.message}` });
      setSessionId(null);
      setIsProvisioning(false);
      router.push("/");
    } finally {
      setIsLoading(false);
      isProcessingRef.current = false;
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
    if (!sessionId || isProcessingRef.current || isLoading) return;
    isProcessingRef.current = true;
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
        setStatus({ type: "success", message: skipEvaluation ? "Lab stopped successfully." : "Lab submitted successfully." });
      }
      fetchAttempts();
    } catch (error: any) {
      setStatus({ type: "error", message: `Error stopping lab: ${error.message}` });
    } finally {
      setIsLoading(false);
      isProcessingRef.current = false;
      setIsEvaluating(false);
    }
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

      {showProvisioningPopup && (
        <div className="confirm-modal-overlay">
          <div className="confirm-modal-content glass-panel" style={{ maxWidth: '400px', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
            <h2 style={{ color: 'white', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div className="loading-spinner" style={{ width: '20px', height: '20px', margin: 0, borderWidth: '2px' }}></div>
              Provisioning in Progress
            </h2>
            <p style={{ color: '#94a3b8', marginBottom: '2rem' }}>
              A session is currently being provisioned for your account. Please wait for it to complete before starting a new challenge.
            </p>
            <div className="modal-actions" style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', alignItems: 'center' }}>
              <button className="button-primary" onClick={() => setShowProvisioningPopup(false)}>
                Understood
              </button>
            </div>
          </div>
        </div>
      )}

      <div className={`loading-overlay ${isEvaluating ? "visible" : ""}`}>
        <div className="loading-content">
          <div className="loading-spinner"></div>
          <h2 className="loading-title">
            {isEvaluating ? "Analyzing Your Changes..." : isAuthenticating ? "Authenticating..." : ""}
          </h2>
          <p className="loading-quote">
            {isEvaluating ? "“Quality is not an act, it is a habit.” — Aristotle" : isAuthenticating ? "Please wait while we sign you in..." : ""}
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
        <div className={`portal-container ${isLoading && !isProvisioning ? "blurred" : ""}`}>
          <header className="portal-header">
            <div className="portal-header-left">
              <Link href="/">
                <img src="/deployit-logo.png" alt="Deploy(it) Logo" className="portal-logo" style={{ cursor: 'pointer' }} />
              </Link>
              <nav style={{ display: 'flex', gap: '1.5rem' }}>
                <Link href="/" style={{ color: 'white', fontSize: '0.9rem', fontWeight: 600, textDecoration: 'none', borderBottom: '2px solid var(--primary)', paddingBottom: '4px' }}>Challenges</Link>
                <Link href="/history" style={{ color: '#94a3b8', fontSize: '0.9rem', fontWeight: 600, textDecoration: 'none' }}>History</Link>
                <Link href="/leaderboard" style={{ color: '#94a3b8', fontSize: '0.9rem', fontWeight: 600, textDecoration: 'none' }}>Leaderboard</Link>
              </nav>
            </div>
            <div className="portal-header-right">
              <div className="score-badge">
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#818cf8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Score</span>
                <span style={{ fontSize: '1.1rem', fontWeight: 900, color: 'white' }}>{totalScore}</span>
              </div>
              {/* Profile Avatar */}
              <div className="profile-section">
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
                <div className="profile-info">
                  <div style={{ color: 'white', fontSize: '0.9rem', fontWeight: 600 }}>{user.displayName}</div>
                  <div style={{ color: '#94a3b8', fontSize: '0.75rem' }}>{user.email}</div>
                </div>
              </div>
              <button onClick={logout} className="button-secondary logout-btn">Logout</button>
            </div>
          </header>

          <div className="portal-main">
            {user && !user.verified ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', padding: '2rem' }}>
                <div className="glass-panel" style={{ padding: '3rem 2rem', maxWidth: '500px', width: '100%', textAlign: 'center', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
                  <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>✉️</div>
                  <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'white', marginBottom: '1rem' }}>Please Verify Your Email</h2>
                  <p style={{ color: '#cbd5e1', marginBottom: '2rem', lineHeight: 1.6 }}>
                    Welcome! For full platform access, please verify your email address. You won't be able to access challenges until you do.
                  </p>

                  {authError && (
                    <div className="status-badge status-error" style={{ marginBottom: '1.5rem', fontSize: '0.85rem' }}>
                      {authError}
                    </div>
                  )}

                  {verificationSent ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
                      <div style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', padding: '1rem', borderRadius: '8px', fontWeight: 700, marginBottom: '0.5rem' }}>
                        Verification code sent! Check your inbox.
                      </div>
                      <input 
                        type="text" 
                        value={otpCode}
                        onChange={(e) => setOtpCode(e.target.value)}
                        placeholder="Enter 6-digit code" 
                        className="challenge-input" 
                        style={{ textAlign: 'center', fontSize: '1.2rem', letterSpacing: '0.2em' }}
                        maxLength={6}
                      />
                      <button 
                        onClick={handleVerifyOtp} 
                        className="button-primary"
                        disabled={isSendingVerification}
                        style={{ width: '100%', padding: '1rem' }}
                      >
                        {isSendingVerification ? "Verifying..." : "Verify Code"}
                      </button>
                      <button 
                        onClick={handleSendVerification} 
                        disabled={isSendingVerification}
                        style={{ background: 'transparent', border: 'none', color: '#94a3b8', marginTop: '0.5rem', cursor: isSendingVerification ? 'not-allowed' : 'pointer', fontSize: '0.85rem', textDecoration: 'underline' }}
                      >
                        Resend Code
                      </button>
                    </div>
                  ) : (
                    <button 
                      onClick={handleSendVerification} 
                      className="button-primary"
                      disabled={isSendingVerification}
                      style={{ width: '100%', padding: '1rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}
                    >
                      {isSendingVerification ? "Sending..." : "Send Verification Code"}
                    </button>
                  )}
                </div>
              </div>
            ) : isProvisioning && !sessionId ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 'calc(100vh - 120px)', padding: '1rem', textAlign: 'center', overflow: 'hidden' }}>
                <div style={{ maxWidth: '800px', width: '100%' }}>
                  <div className="loading-spinner" style={{ width: '60px', height: '60px', borderWidth: '4px', margin: '0 auto 1.5rem' }}></div>
                  <h1 style={{ fontSize: '3rem', fontWeight: 900, marginBottom: '1rem', background: 'linear-gradient(135deg, #fff 0%, #94a3b8 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                    Preparing Your Lab
                  </h1>
                  <p style={{ color: '#94a3b8', fontSize: '1.1rem', lineHeight: 1.5, marginBottom: '2rem' }}>
                    We're spinning up a dedicated lab environment for <span style={{ color: 'var(--primary)', fontWeight: 800 }}>{labType || "your challenge"}</span>.<br />
                    This usually takes under a minute.
                  </p>
                  
                  <div className="glass-panel" style={{ maxWidth: '600px', margin: '0 auto', padding: '1.5rem', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                    <p style={{ fontStyle: 'italic', color: '#cbd5e1', fontSize: '1rem', margin: 0 }}>
                      {quotes[loadingQuoteIndex]}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
            <div className="portal-content-box">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                <ProvisioningBanner />

                {status.message && (
                  <div className={`status-badge ${status.type === "info" ? "status-info" : status.type === "success" ? "status-success" : "status-error"}`}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                      <span>{status.message}</span>
                    </div>
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
                  <div className="challenges-header">
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'white', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      Available Challenges
                    </h2>

                    <div className="category-tabs">
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

                  <div className="challenge-cards">
                    {isChallengesLoading ? (
                      <p style={{ color: '#94a3b8' }}>Loading challenges...</p>
                    ) : filteredChallenges.length === 0 ? (
                      <p style={{ color: '#94a3b8' }}>No challenges found for this category.</p>
                    ) : (
                      pagedChallenges.map((c) => (
                        <div
                          key={c.id}
                          className="glass-panel challenge-card-panel"
                          style={{
                            border: labType === c.id ? '1px solid var(--primary)' : '1px solid rgba(255, 255, 255, 0.1)',
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
                            {sessionId && labType === c.id ? (
                               <button 
                                 onClick={() => startLab(c.id)} 
                                 disabled={isLoading || isProvisioning || isEvaluating} 
                                 className="button-primary" 
                                 style={{ 
                                   whiteSpace: 'nowrap', 
                                   background: 'rgba(16, 185, 129, 0.2)', 
                                   border: '1px solid #10b981', 
                                   color: '#10b981',
                                   opacity: (isLoading || isProvisioning || isEvaluating) ? 0.5 : 1,
                                   cursor: (isLoading || isProvisioning || isEvaluating) ? 'not-allowed' : 'pointer'
                                 }}
                               >
                                 {(isLoading || isProvisioning) && labType === c.id ? "Connecting..." : "Resume Lab"}
                               </button>
                            ) : (
                              <button 
                                onClick={() => startLab(c.id)} 
                                disabled={isLoading || isProvisioning || isEvaluating || (sessionId !== null)} 
                                className="button-primary" 
                                style={{ 
                                  whiteSpace: 'nowrap',
                                  opacity: (isLoading || isProvisioning || isEvaluating || sessionId !== null) ? 0.5 : 1,
                                  cursor: (isLoading || isProvisioning || isEvaluating || sessionId !== null) ? 'not-allowed' : 'pointer'
                                }}
                              >
                                {(isLoading || isProvisioning) && labType === c.id ? "Preparing..." : "Start Challenge"}
                              </button>
                            )}
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
            )}
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
                <div className="lab-actions">
                  <button onClick={() => handleStopLab(false)} disabled={isLoading} className="button-primary submit-btn">
                    Submit
                  </button>
                  <button onClick={() => handleStopLab(true)} disabled={isLoading} className="button-danger stop-session-btn">
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

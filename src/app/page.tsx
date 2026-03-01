"use client";

import React, { useState, useEffect, useRef } from "react";

const API_URL = "http://localhost:8080";

export default function DevOpsLabClient() {
  const [labType, setLabType] = useState("ubuntu");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [labUrl, setLabUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<{ type: "info" | "success" | "error" | null; message: string }>({
    type: null,
    message: "",
  });

  const [timer, setTimer] = useState<number>(0);
  const [flagAnswer, setFlagAnswer] = useState("");
  const [challengeResult, setChallengeResult] = useState<{ type: "success" | "error" | "info" | null; message: string }>({
    type: null,
    message: "",
  });

  const [isLoading, setIsLoading] = useState(false);
  const [loadingQuoteIndex, setLoadingQuoteIndex] = useState(0);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

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
    if (timer > 0) {
      timerRef.current = setTimeout(() => setTimer(timer - 1), 1000);
    } else if (timer === 0 && sessionId) {
      setStatus({ type: "error", message: "Time Expired. Stopping lab..." });
      stopLab();
    }
    return () => clearTimeout(timerRef.current as NodeJS.Timeout);
  }, [timer, sessionId]);

  const startLab = async () => {
    setIsLoading(true);
    setLoadingQuoteIndex(0);
    setStatus({ type: "info", message: "Provisioning Cloud Run container..." });
    setChallengeResult({ type: null, message: "" });
    setFlagAnswer("");

    // Start rotating quotes
    quoteTimerRef.current = setInterval(() => {
      setLoadingQuoteIndex((prev) => (prev + 1) % quotes.length);
    }, 7000);

    try {
      const response = await fetch(`${API_URL}/start-lab`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ labType }),
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

  const handleStopLab = () => {
    setShowConfirmModal(true);
  };

  const confirmStopLab = () => {
    setShowConfirmModal(false);
    stopLab();
  };

  const cancelStopLab = () => {
    setShowConfirmModal(false);
  };

  const stopLab = async () => {
    if (!sessionId) return;
    setIsLoading(true);
    setStatus({ type: "info", message: "Stopping lab container cleanly..." });

    try {
      const response = await fetch(`${API_URL}/stop-lab`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionID: sessionId }),
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      resetLabState();
      setStatus({ type: "success", message: "Lab stopped successfully." });
    } catch (error: any) {
      setStatus({ type: "error", message: `Error stopping lab: ${error.message}` });
    } finally {
      setIsLoading(false);
    }
  };

  const submitChallenge = async () => {
    if (!sessionId) return;
    if (!flagAnswer.trim()) {
      setChallengeResult({ type: "error", message: "Please enter a flag first." });
      return;
    }

    setIsLoading(true);
    setChallengeResult({ type: "info", message: "Verifying flag and stopping lab..." });

    try {
      const response = await fetch(`${API_URL}/submit-challenge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionID: sessionId, answer: flagAnswer.trim() }),
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json();

      resetLabState();
      setStatus({ type: "info", message: "Lab stopped upon challenge submission." });

      if (data.correct) {
        setChallengeResult({ type: "success", message: "✅ Correct! Great job!" });
      } else {
        setChallengeResult({ type: "error", message: "❌ Incorrect flag! The lab has been stopped." });
      }
    } catch (error: any) {
      setChallengeResult({ type: "error", message: `Error: ${error.message}` });
    } finally {
      setIsLoading(false);
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

  return (
    <>
      {showConfirmModal && (
        <div className="confirm-modal-overlay">
          <div className="confirm-modal-content glass-panel">
            <h2 className="modal-title" style={{ color: 'white', fontSize: '1.5rem', fontWeight: 800, marginTop: 0, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <svg width="24" height="24" fill="none" stroke="var(--danger)" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              Terminate Session?
            </h2>
            <div className="modal-actions" style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '2rem' }}>
              <button className="button-secondary" onClick={cancelStopLab}>
                Cancel
              </button>
              <button className="button-danger" onClick={confirmStopLab}>
                Yes
              </button>
            </div>
          </div>
        </div>
      )}

      <div className={`loading-overlay ${isLoading && !sessionId ? "visible" : ""}`}>
        <div className="loading-content">
          <div className="loading-spinner"></div>
          <h2 className="loading-title">Preparing the eLab</h2>
          <p className="loading-quote">{quotes[loadingQuoteIndex]}</p>
        </div>
      </div>

      {!sessionId ? (
        <div className={`portal-container ${isLoading ? "blurred" : ""}`}>
          <header className="portal-header">
            <img src="/deployit-logo.png" alt="Deploy(it) Logo" className="portal-logo" />
          </header>

          <div className="portal-main">
            <div className="portal-content-box">
              <div className="glass-panel">

                {status.message && (
                  <div className={`status-badge ${status.type === "info" ? "status-info" : status.type === "success" ? "status-success" : "status-error"}`}>
                    {status.message}
                  </div>
                )}

                <div style={{ marginBottom: '2rem' }}>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'white', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    Available Challenges
                  </h2>
                  <div className="challenge-cards" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
                    <div className="challenge-card" style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: '12px', padding: '1.5rem', position: 'relative', overflow: 'hidden' }}>
                      <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', background: 'var(--primary)' }}></div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                        <div style={{ background: 'rgba(245, 158, 11, 0.15)', padding: '0.5rem', borderRadius: '8px', color: 'var(--warning)' }}>
                          <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
                          </svg>
                        </div>
                        <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'white' }}>Find the Secret Flag</h4>
                      </div>
                      <p style={{ fontSize: '0.85rem', color: '#cbd5e1', lineHeight: 1.6, marginBottom: '0' }}>
                        A secret flag string is injected into <code className="challenge-code">/root/flag.txt</code>. Start the session to unlock the terminal and extract the flag!
                      </p>
                    </div>
                  </div>
                </div>

                <div className="button-group">
                  <button onClick={startLab} disabled={isLoading} className="button-primary">
                    {isLoading ? "Starting..." : "Start Challenge"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="active-lab-container">
          <div className="lab-top">
            <div className="lab-top-left">
              <div className="active-challenge">
                <div className="inline-header">
                  <img src="/deployit-logo.png" alt="Deploy(it) Logo" style={{ height: "36px", objectFit: "contain" }} />
                </div>

                <h3 className="challenge-title">
                  <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
                  </svg>
                  DevOps Challenge
                </h3>
                <p className="challenge-desc">
                  A secret flag string is injected into <code className="challenge-code">/root/flag.txt</code> in your container. Find and extract it!
                </p>
                <div className="challenge-input-row">
                  <input
                    type="text"
                    placeholder="FLAG{...}"
                    value={flagAnswer}
                    onChange={(e) => setFlagAnswer(e.target.value)}
                    disabled={isLoading}
                    className="challenge-input"
                  />
                  <button
                    onClick={submitChallenge}
                    disabled={isLoading || !flagAnswer.trim()}
                    className="challenge-btn"
                  >
                    Submit Flag
                  </button>
                </div>

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
                <button onClick={handleStopLab} disabled={isLoading} className="button-danger stop-button">
                  Stop Session
                </button>
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
      )}
    </>
  );
}

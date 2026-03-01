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

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
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
    setStatus({ type: "info", message: "Provisioning Cloud Run container..." });
    setChallengeResult({ type: null, message: "" });
    setFlagAnswer("");

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
    <div className="app-container">
      <div className="panel-left">
        <div className="glass-panel">
          <div className="header">
            <div className="logo-icon">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
              </svg>
            </div>
            <h1 className="title">Deploy<span className="title-highlight">(it)</span></h1>
          </div>

          {status.message && (
            <div className={`status-badge ${status.type === "info" ? "status-info" : status.type === "success" ? "status-success" : "status-error"}`}>
              {status.message}
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Target OS Image</label>
            <select
              title="Lab Type"
              value={labType}
              onChange={(e) => setLabType(e.target.value)}
              className="input-field"
              disabled={!!sessionId || isLoading}
            >
              <option value="ubuntu">Ubuntu 20.04 (Focal Fossa)</option>
            </select>
          </div>

          <div className="button-group">
            <button onClick={startLab} disabled={!!sessionId || isLoading} className="button-primary">
              {isLoading && !sessionId ? "Starting..." : "Start Lab"}
            </button>
            <button onClick={stopLab} disabled={!sessionId || isLoading} className="button-danger">
              Stop Session
            </button>
          </div>

          {sessionId && (
            <div className="session-details">
              <h3 className="session-header">Active Session Details</h3>
              <div className="session-row">
                <span className="session-label">Session ID</span>
                <span className="session-value">{sessionId}</span>
              </div>
              <div>
                <span className="session-label">Container Lifetime</span>
                <span className={`timer-value ${timer < 60 ? "timer-danger" : "timer-safe"}`}>
                  {formatTime(timer)}
                </span>
              </div>
            </div>
          )}

          {sessionId && (
            <div className="challenge-box">
              <h3 className="challenge-title">
                <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                DevOps Challenge
              </h3>
              <p className="challenge-desc">
                A secret flag string is injected into <code className="challenge-code">/root/flag.txt</code> in your container. Find and extract it!
              </p>
              <div className="challenge-input-group">
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
            </div>
          )}

          {challengeResult.message && (
            <div className={`status-badge mt-4 ${challengeResult.type === "success" ? "status-success" : challengeResult.type === "error" ? "status-error" : "status-info"}`}>
              {challengeResult.message}
            </div>
          )}
        </div>
      </div>

      <div className="panel-right">
        <div className="iframe-container">
          <div className="iframe-header">
            <div className="mac-dots">
              <div className="mac-dot dot-red"></div>
              <div className="mac-dot dot-yellow"></div>
              <div className="mac-dot dot-green"></div>
            </div>
            <div className="header-title">
              {sessionId ? `cloud-run-tty: ${labType} — bash` : "terminal - disconnected"}
            </div>
          </div>

          {labUrl ? (
            <iframe
              src={labUrl}
              className="iframe-window"
              title="Lab Terminal"
              allow="clipboard-read; clipboard-write"
            />
          ) : (
            <div className="iframe-empty">
              <svg className="empty-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p>No active session. Click "Start Lab" in the control panel to boot a container.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

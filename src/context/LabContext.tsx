"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { useAuth, authHeaders } from "@/context/AuthContext";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

interface LabStatus {
    type: "info" | "success" | "error" | null;
    message: string;
}

interface ChallengeResult {
    type: "success" | "error" | "info" | null;
    message: string;
    output?: string;
}

interface LabContextType {
    sessionId: string | null;
    setSessionId: (s: string | null) => void;
    labUrl: string | null;
    setLabUrl: (u: string | null) => void;
    labType: string;
    setLabType: (type: string) => void;
    timer: number;
    setTimer: (t: number) => void;
    isLoading: boolean;
    setIsLoading: (l: boolean) => void;
    isEvaluating: boolean;
    setIsEvaluating: (e: boolean) => void;
    status: LabStatus;
    setStatus: (s: LabStatus) => void;
    challengeResult: ChallengeResult;
    setChallengeResult: (r: ChallengeResult) => void;
    isProvisioning: boolean;
    setIsProvisioning: (p: boolean) => void;
    recoverSession: (isSilent?: boolean) => Promise<boolean>;
    resetLabState: () => void;
}

const LabContext = createContext<LabContextType | undefined>(undefined);

export const LabProvider = ({ children }: { children: React.ReactNode }) => {
    const { user } = useAuth();
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [labUrl, setLabUrl] = useState<string | null>(null);
    const [labType, setLabType] = useState<string>("");
    const [timer, setTimer] = useState<number>(0);
    const [isLoading, setIsLoading] = useState(false);
    const [isEvaluating, setIsEvaluating] = useState(false);
    const [isProvisioningState, setIsProvisioningState] = useState(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem("lab_provisioning") === "true";
        }
        return false;
    });
    const isProvisioning = isProvisioningState;
    const setIsProvisioning = useCallback((p: boolean) => {
        setIsProvisioningState(p);
        if (typeof window !== 'undefined') {
            if (p) {
                localStorage.setItem("lab_provisioning", "true");
            } else {
                localStorage.removeItem("lab_provisioning");
            }
        }
    }, []);
    const [status, setStatus] = useState<LabStatus>({ type: null, message: "" });
    const [challengeResult, setChallengeResult] = useState<ChallengeResult>({ type: null, message: "" });

    const timerRef = useRef<NodeJS.Timeout | null>(null);

    const resetLabState = useCallback(() => {
        setSessionId(null);
        setLabUrl(null);
        setTimer(0);
        setIsProvisioning(false);
        if (timerRef.current) clearTimeout(timerRef.current);
        localStorage.removeItem("active_lab_session");
    }, []);

    const recoverSession = useCallback(async (isSilent = false) => {
        if (!user?.uid) return false;
        if (!isSilent) setIsLoading(true);
        try {
            const res = await fetch(`${API_URL}/api/current-session?userId=${user.uid}`, {
                headers: authHeaders()
            });
            if (res.ok) {
                // Check if it's still being provisioned (HTTP 202)
                if (res.status === 202) {
                    setIsProvisioning(true);
                    return false;
                }
                const data = await res.json();
                setSessionId(data.sessionID);
                setLabUrl(data.url);
                setLabType(data.challengeID);
                setTimer(data.timeLimit);
                setStatus({ type: "success", message: "Successfully connected to your lab session!" });
                setIsProvisioning(false); 
                return true;
            } else if (res.status === 404) {
                if (!isSilent) {
                    setIsProvisioning(false);
                }
            }
            return false;
        } catch (e) {
            console.error("Failed to recover session", e);
            return false;
        } finally {
            if (!isSilent) setIsLoading(false);
        }
    }, [user]);

    // Timer Logic Integration
    useEffect(() => {
        if (timer > 0) {
            timerRef.current = setTimeout(() => setTimer(timer - 1), 1000);
        } else if (timer === 0 && sessionId) {
            // Need a stopLab hook here or trigger it from the consumer
        }
        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, [timer, sessionId]);

    // localStorage Persistence (Cross-Tab)
    useEffect(() => {
        if (sessionId && labUrl) {
            localStorage.setItem("active_lab_session", JSON.stringify({ sessionId, labUrl, labType, timer }));
        }
    }, [sessionId, labUrl, labType, timer]);

    // Initial Recovery & Cross-Tab Sync for Session
    useEffect(() => {
        const loadSessionFromStorage = () => {
            const savedSession = localStorage.getItem("active_lab_session");
            if (savedSession && !sessionId) {
                try {
                    const { sessionId: sid, labUrl: url, labType: lt, timer: t } = JSON.parse(savedSession);
                    if (sid && url) {
                        setSessionId(sid);
                        setLabUrl(url);
                        setLabType(lt || "");
                        setTimer(t || 0);
                    }
                } catch { }
            }
        };

        loadSessionFromStorage();

        const handleStorageSession = (e: StorageEvent) => {
            if (e.key === "active_lab_session") {
                if (e.newValue) {
                    loadSessionFromStorage();
                } else {
                    // Another tab deleted the session
                    setSessionId(null);
                    setLabUrl(null);
                }
            }
        };

        if (typeof window !== 'undefined') {
            window.addEventListener("storage", handleStorageSession);
        }
        
        if (user?.uid && !sessionId) {
            recoverSession();
        }

        return () => {
            if (typeof window !== 'undefined') {
                window.removeEventListener("storage", handleStorageSession);
            }
        };
    }, [user, sessionId, recoverSession]);

    // Provisioning Watcher & Cross-Tab Sync
    useEffect(() => {
        let interval: NodeJS.Timeout;
        
        // Storage sync
        const handleStorage = (e: StorageEvent) => {
            if (e.key === "lab_provisioning") {
                setIsProvisioningState(e.newValue === "true");
            }
        };
        
        if (typeof window !== 'undefined') {
            window.addEventListener("storage", handleStorage);
            // Read initial state
            if (localStorage.getItem("lab_provisioning") === "true" && !sessionId) {
                setIsProvisioningState(true);
            }
        }

        if (isProvisioning && !sessionId) {
            interval = setInterval(() => {
                recoverSession(true);
            }, 4000);
        }
        
        return () => {
            if (interval) clearInterval(interval);
            if (typeof window !== 'undefined') {
                window.removeEventListener("storage", handleStorage);
            }
        };
    }, [isProvisioning, sessionId, recoverSession]);

    return (
        <LabContext.Provider value={{
            sessionId, setSessionId, labUrl, setLabUrl, labType, setLabType, timer, setTimer,
            isLoading, setIsLoading, isEvaluating, setIsEvaluating,
            status, setStatus, challengeResult, setChallengeResult,
            isProvisioning, setIsProvisioning, recoverSession, resetLabState
        }}>
            {children}
        </LabContext.Provider>
    );
};

export const useLab = () => {
    const context = useContext(LabContext);
    if (context === undefined) {
        throw new Error("useLab must be used within a LabProvider");
    }
    return context;
};

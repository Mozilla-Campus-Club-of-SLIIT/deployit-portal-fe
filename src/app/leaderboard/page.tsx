"use client";

import React, { useState, useEffect } from "react";
import { useAuth, authHeaders } from "@/context/AuthContext";
import Link from "next/link";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

const RANK_STYLE: Record<number, { bg: string; text: string; label: string }> = {
    0: { bg: "bg-yellow-400", text: "text-black", label: "🥇" },
    1: { bg: "bg-gray-300", text: "text-black", label: "🥈" },
    2: { bg: "bg-amber-700", text: "text-white", label: "🥉" },
};

function Avatar({ photoUrl, displayName, size = 40 }: { photoUrl?: string; displayName: string; size?: number }) {
    const [imgError, setImgError] = useState(false);
    const initials = (displayName || "?")
        .split(" ")
        .map((w) => w[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);

    if (photoUrl && !imgError) {
        return (
            <div
                style={{
                    width: size,
                    height: size,
                    borderRadius: "50%",
                    overflow: "hidden",
                    flexShrink: 0,
                    border: "2px solid rgba(99,102,241,0.4)",
                    position: "relative",
                }}
            >
                <img
                    src={photoUrl}
                    alt={displayName}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    onError={() => setImgError(true)}
                />
            </div>
        );
    }

    return (
        <div
            style={{
                width: size,
                height: size,
                borderRadius: "50%",
                flexShrink: 0,
                background: "rgba(99,102,241,0.15)",
                border: "2px solid rgba(99,102,241,0.4)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: size * 0.4,
                fontWeight: 900,
                color: "#818cf8",
            }}
        >
            {initials}
        </div>
    );
}

export default function LeaderboardPage() {
    const { user, logout } = useAuth();
    const [leaderboard, setLeaderboard] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const ITEMS_PER_PAGE = 10;
    const [currentPage, setCurrentPage] = useState(1);

    const totalPages = Math.ceil(leaderboard.length / ITEMS_PER_PAGE);
    
    const pagedLeaderboard = React.useMemo(() => {
        const start = (currentPage - 1) * ITEMS_PER_PAGE;
        return leaderboard.slice(start, start + ITEMS_PER_PAGE);
    }, [leaderboard, currentPage]);

    // To display total score in header
    const [attempts, setAttempts] = useState<any[]>([]);

    useEffect(() => {
        const fetchAttempts = async () => {
            if (!user) return;
            try {
                const res = await fetch(`${API_URL}/api/attempts?userId=${user.uid}`, { headers: authHeaders() });
                if (res.ok) {
                    const data = await res.json();
                    setAttempts(data || []);
                }
            } catch (e) {
                console.error("Failed to fetch user attempts", e);
            }
        };
        fetchAttempts();
    }, [user]);

    const totalScore = React.useMemo(() => {
        return attempts
            .filter(a => a.result === 'SUCCESS' || a.result === 'FAILURE')
            .reduce((acc, curr) => acc + (curr.scoreEarned || 0), 0);
    }, [attempts]);

    useEffect(() => {
        const fetchLeaderboard = async () => {
            if (!user) return;
            try {
                // Use the public /api/leaderboard endpoint
                const response = await fetch(`${API_URL}/api/leaderboard`, {
                    cache: "no-store",
                });
                if (response.ok) {
                    const data = await response.json();
                    setLeaderboard((data || []).filter((u: any) => u.totalScore > 0));
                } else {
                    setError("Synchronization failed.");
                }
            } catch (error) {
                console.error("Failed to fetch leaderboard", error);
                setError("Network error: Link to Core Engine lost.");
            } finally {
                setLoading(false);
            }
        };

        fetchLeaderboard();
    }, [user]);

    if (!user) {
        return (
            <div className="portal-container">
                <div className="portal-main">
                    <div className="portal-content-box" style={{ textAlign: "center", color: "white" }}>
                        <h1 style={{ marginBottom: "1rem" }}>Access Denied</h1>
                        <p style={{ marginBottom: "2rem", color: "#94a3b8" }}>Please sign in to view the leaderboard.</p>
                        <Link href="/" className="button-primary" style={{ textDecoration: 'none' }}>Go to Login</Link>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="portal-container">
            <header className="portal-header">
                <div className="portal-header-left">
                    <Link href="/">
                        <img src="/deployit-logo.png" alt="Deploy(it) Logo" className="portal-logo" style={{ cursor: 'pointer' }} />
                    </Link>
                    <nav style={{ display: 'flex', gap: '1.5rem' }}>
                        <Link href="/" style={{ color: '#94a3b8', fontSize: '0.9rem', fontWeight: 600, textDecoration: 'none' }}>Challenges</Link>
                        <Link href="/history" style={{ color: '#94a3b8', fontSize: '0.9rem', fontWeight: 600, textDecoration: 'none' }}>History</Link>
                        <Link href="/leaderboard" style={{ color: 'white', fontSize: '0.9rem', fontWeight: 600, textDecoration: 'none', borderBottom: '2px solid var(--primary)', paddingBottom: '4px' }}>Leaderboard</Link>
                    </nav>
                </div>
                <div className="portal-header-right">
                    <div className="score-badge">
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#818cf8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Score</span>
                        <span style={{ fontSize: '1.1rem', fontWeight: 900, color: 'white' }}>{totalScore}</span>
                    </div>
                    <div className="profile-section">
                        {user.photoUrl ? (
                            <div style={{ width: 38, height: 38, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, border: '2px solid rgba(99,102,241,0.4)' }}>
                                <img src={user.photoUrl} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            </div>
                        ) : (
                            <div style={{ width: 38, height: 38, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, border: '2px solid rgba(99,102,241,0.4)', background: 'rgba(99,102,241,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <span style={{ color: '#818cf8', fontWeight: 900, fontSize: '1rem' }}>
                                    {user.displayName?.charAt(0)?.toUpperCase() || '?'}
                                </span>
                            </div>
                        )}
                        <div className="profile-info">
                            <div style={{ color: 'white', fontSize: '0.9rem', fontWeight: 600 }}>{user.displayName}</div>
                            <div style={{ color: '#94a3b8', fontSize: '0.75rem' }}>{user.email}</div>
                        </div>
                    </div>
                    <button onClick={logout} className="button-secondary logout-btn">Logout</button>
                </div>
            </header>

            <div className="portal-main">
                <div className="portal-content-box" style={{ maxWidth: '1000px', margin: '0 auto' }}>
                    <div style={{ marginBottom: '2.5rem', textAlign: 'center' }}>
                        <h1 style={{ fontSize: '3rem', fontWeight: 900, color: 'white' }}>
                            <span style={{ color: '#fbbf24' }}>Leaderboard</span>
                        </h1>
                        <p style={{ color: '#94a3b8', fontSize: '1.1rem', marginTop: '1rem' }}>
                            Precision, speed, and mastery. The Ninja elite of Deploy(it).
                        </p>
                    </div>

                    {error && (
                        <div style={{ marginBottom: '2rem', padding: '1rem', borderRadius: '12px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', color: '#ef4444', textAlign: 'center', fontSize: '0.85rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                            ⚠️ INFRA ALERT: {error}
                        </div>
                    )}

                    <div className="glass-panel" style={{ overflow: 'hidden', borderRadius: '16px', border: '1px solid rgba(255, 255, 255, 0.1)', background: 'rgba(0, 0, 0, 0.2)' }}>
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ background: 'rgba(255, 255, 255, 0.05)', borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                                        <th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Rank</th>
                                        <th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Ninja</th>
                                        <th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em', textAlign: 'right' }}>Reputation</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loading ? (
                                        <tr>
                                            <td colSpan={3} style={{ padding: '3rem 1.5rem', textAlign: 'center', color: '#64748b', fontStyle: 'italic', fontSize: '0.875rem' }}>
                                                Synchronizing global rankings...
                                            </td>
                                        </tr>
                                    ) : leaderboard.length === 0 && !error ? (
                                        <tr>
                                            <td colSpan={3} style={{ padding: '3rem 1.5rem', textAlign: 'center', color: '#64748b', fontStyle: 'italic', fontSize: '0.875rem' }}>
                                                No field data recorded yet.
                                            </td>
                                        </tr>
                                    ) : (
                                        pagedLeaderboard.map((u, idx) => {
                                            const globalIndex = (currentPage - 1) * ITEMS_PER_PAGE + idx;
                                            const rank = RANK_STYLE[globalIndex];
                                            const isTop3 = globalIndex < 3;
                                            return (
                                                <tr
                                                    key={u.id}
                                                    style={{
                                                        borderBottom: idx === pagedLeaderboard.length - 1 ? 'none' : '1px solid rgba(255, 255, 255, 0.05)',
                                                        background: isTop3 ? `rgba(245, 158, 11, ${0.03 - globalIndex * 0.01})` : 'transparent',
                                                        transition: 'background 0.2s',
                                                    }}
                                                    onMouseEnter={(e) => e.currentTarget.style.background = isTop3 ? `rgba(245, 158, 11, ${0.05 - globalIndex * 0.01})` : 'rgba(255, 255, 255, 0.05)'}
                                                    onMouseLeave={(e) => e.currentTarget.style.background = isTop3 ? `rgba(245, 158, 11, ${0.03 - globalIndex * 0.01})` : 'transparent'}
                                                >
                                                    <td style={{ padding: '1.25rem 1.5rem', width: '80px' }}>
                                                        <span
                                                            style={{
                                                                display: 'flex', width: '36px', height: '36px', alignItems: 'center', justifyContent: 'center', borderRadius: '8px', fontSize: '0.875rem', fontWeight: 900, boxShadow: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.06)',
                                                                background: rank ? undefined : 'rgba(255, 255, 255, 0.05)',
                                                                color: rank ? undefined : '#94a3b8',
                                                                backgroundColor: rank?.bg === "bg-yellow-400" ? "#facc15" : rank?.bg === "bg-gray-300" ? "#d1d5db" : rank?.bg === "bg-amber-700" ? "#b45309" : undefined,
                                                            }}
                                                        >
                                                            {rank ? rank.label : globalIndex + 1}
                                                        </span>
                                                    </td>

                                                    <td style={{ padding: '1.25rem 1.5rem' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                            <Avatar
                                                                photoUrl={u.photoUrl}
                                                                displayName={u.displayName || "Anonymous"}
                                                                size={40}
                                                            />
                                                            <div>
                                                                <div style={{ fontWeight: 600, color: 'white', transition: 'color 0.2s' }}>
                                                                    {u.displayName || "Anonymous Ninja"}
                                                                </div>
                                                                {u.role === "admin" && (
                                                                    <div style={{ fontSize: '0.7rem', color: 'rgba(234, 179, 8, 0.7)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: '0.125rem' }}>
                                                                        Admin
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </td>

                                                    <td style={{ padding: '1.25rem 1.5rem', textAlign: 'right' }}>
                                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', borderRadius: '9999px', background: 'rgba(250, 204, 21, 0.1)', padding: '0.25rem 0.75rem', fontSize: '0.875rem', fontWeight: 800, color: '#facc15', border: '1px solid rgba(250, 204, 21, 0.2)' }}>
                                                            {u.totalScore || 0} PTS
                                                        </span>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {!loading && leaderboard.length > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1.5rem', marginTop: '2rem' }}>
                            <button
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                style={{
                                    padding: '0.6rem 1.25rem',
                                    borderRadius: '8px',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    background: 'rgba(0,0,0,0.2)',
                                    color: currentPage === 1 ? '#475569' : '#e2e8f0',
                                    fontSize: '0.85rem',
                                    fontWeight: 700,
                                    cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                                    transition: 'all 0.2s ease',
                                }}
                            >
                                ← Prev
                            </button>
                            <span style={{ color: '#94a3b8', fontSize: '0.9rem', fontWeight: 600 }}>
                                Page {currentPage} of {totalPages}
                            </span>
                            <button
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages}
                                style={{
                                    padding: '0.6rem 1.25rem',
                                    borderRadius: '8px',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    background: 'rgba(0,0,0,0.2)',
                                    color: currentPage === totalPages ? '#475569' : '#e2e8f0',
                                    fontSize: '0.85rem',
                                    fontWeight: 700,
                                    cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                                    transition: 'all 0.2s ease',
                                }}
                            >
                                Next →
                            </button>
                        </div>
                    )}

                    <div style={{ marginTop: '3rem', textAlign: 'center', color: '#64748b', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.2em', opacity: 0.5 }}>
                        &copy; 2026 DEPLOY(IT)
                    </div>
                </div>
            </div>
        </div>
    );
}

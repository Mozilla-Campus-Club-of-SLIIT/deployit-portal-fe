"use client";

import React, { useState, useEffect } from "react";
import { useAuth, authHeaders } from "@/context/AuthContext";
import Link from "next/link";
import ProvisioningBanner from "@/components/ProvisioningBanner";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

export default function HistoryPage() {
    const { user, logout } = useAuth();
    const [attempts, setAttempts] = useState<any[]>([]);
    const [challenges, setChallenges] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 10;

    useEffect(() => {
        const fetchData = async () => {
            if (!user) return;
            setIsLoading(true);
            try {
                const [attemptsRes, challengesRes] = await Promise.all([
                    fetch(`${API_URL}/api/attempts?userId=${user.uid}`, {
                        headers: authHeaders()
                    }),
                    fetch(`${API_URL}/api/challenges`)
                ]);

                if (attemptsRes.ok) {
                    const data = await attemptsRes.json();
                    setAttempts(data || []);
                }
                if (challengesRes.ok) {
                    const data = await challengesRes.json();
                    setChallenges(data || []);
                }
            } catch (e) {
                console.error("Failed to fetch history:", e);
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, [user]);

    const filteredAttempts = React.useMemo(() => {
        let all = attempts.filter(a => a.result === 'SUCCESS' || a.result === 'FAILURE');
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            all = all.filter(a => {
                const challenge = challenges.find(c => c.id === a.challengeId);
                return challenge?.title?.toLowerCase().includes(query) || a.challengeId.toLowerCase().includes(query);
            });
        }
        return all;
    }, [attempts, searchQuery, challenges]);

    const totalPages = Math.ceil(filteredAttempts.length / ITEMS_PER_PAGE);
    
    const pagedAttempts = React.useMemo(() => {
        const start = (currentPage - 1) * ITEMS_PER_PAGE;
        return filteredAttempts.slice(start, start + ITEMS_PER_PAGE);
    }, [filteredAttempts, currentPage]);

    const totalScore = filteredAttempts.reduce((acc, curr) => acc + (curr.scoreEarned || 0), 0);

    if (!user) {
        return (
            <div className="portal-container">
                <div className="portal-main">
                    <div className="portal-content-box" style={{ textAlign: "center", color: "white" }}>
                        <h1 style={{ marginBottom: "1rem" }}>Access Denied</h1>
                        <p style={{ marginBottom: "2rem", color: "#94a3b8" }}>Please sign in to view your history.</p>
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
                        <Link href="/history" style={{ color: 'white', fontSize: '0.9rem', fontWeight: 600, textDecoration: 'none', borderBottom: '2px solid var(--primary)', paddingBottom: '4px' }}>History</Link>
                        <Link href="/leaderboard" style={{ color: '#94a3b8', fontSize: '0.9rem', fontWeight: 600, textDecoration: 'none' }}>Leaderboard</Link>
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
                <div className="portal-content-box">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                        <ProvisioningBanner />
                        <div>
                                <div className="page-header-flex">
                                    <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'white', margin: 0, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                        <svg width="24" height="24" fill="none" stroke="var(--primary)" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        Evaluation History
                                    </h2>

                                    <div className="search-container">
                                        <input
                                            type="text"
                                            placeholder="Search by challenge name..."
                                            value={searchQuery}
                                            onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                                            className="search-input"
                                        />
                                        <svg
                                            className="search-icon"
                                            width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                                        >
                                            <circle cx="11" cy="11" r="8"></circle>
                                            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                                        </svg>
                                    </div>
                                </div>

                            <div className="glass-panel" style={{ padding: '0', overflow: 'hidden' }}>
                                {isLoading ? (
                                    <div style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>
                                        <div className="loading-spinner" style={{ margin: '0 auto 1rem' }}></div>
                                        Loading your history...
                                    </div>
                                ) : filteredAttempts.length === 0 ? (
                                    <div style={{ padding: '4rem 2rem', textAlign: 'center', color: '#94a3b8' }}>
                                        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📜</div>
                                        <h3 style={{ color: 'white', marginBottom: '0.5rem' }}>No records found</h3>
                                        <p>{searchQuery ? "Try adjusting your search query." : "You haven't completed any challenges yet. Your results will appear here!"}</p>
                                        <Link href="/" className="button-primary" style={{ marginTop: '1.5rem', display: 'inline-block', textDecoration: 'none' }}>View Challenges</Link>
                                    </div>
                                ) : (
                                    <div style={{ overflowX: 'auto' }}>
                                        <table style={{ minWidth: '600px', width: '100%', borderCollapse: 'collapse', color: '#cbd5e1', fontSize: '0.9rem' }}>
                                            <thead>
                                            <tr style={{ background: 'rgba(255,255,255,0.05)', textAlign: 'left' }}>
                                                <th style={{ padding: '1.25rem' }}>Challenge</th>
                                                <th style={{ padding: '1.25rem' }}>Points</th>
                                                <th style={{ padding: '1.25rem' }}>Result</th>
                                                <th style={{ padding: '1.25rem' }}>Date & Time</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {pagedAttempts.map((attempt, idx) => {
                                                const challenge = challenges.find(c => c.id === attempt.challengeId);
                                                return (
                                                    <tr key={attempt.id} style={{ borderBottom: idx === pagedAttempts.length - 1 ? 'none' : '1px solid rgba(255,255,255,0.05)', transition: 'background 0.2s ease' }} className="history-row">
                                                        <td style={{ padding: '1.25rem' }}>
                                                            <div style={{ fontWeight: 700, color: 'white' }}>{challenge?.title || attempt.challengeId}</div>
                                                        </td>
                                                        <td style={{ padding: '1.25rem' }}>
                                                            <span style={{ color: attempt.scoreEarned > 0 ? '#10b981' : '#64748b', fontWeight: 700 }}>
                                                                {attempt.scoreEarned > 0 ? `+${attempt.scoreEarned}` : '0'} pts
                                                            </span>
                                                        </td>
                                                        <td style={{ padding: '1.25rem' }}>
                                                            <span style={{
                                                                padding: '0.4rem 0.75rem',
                                                                borderRadius: '6px',
                                                                background: attempt.result === 'SUCCESS' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                                                                color: attempt.result === 'SUCCESS' ? '#10b981' : '#ef4444',
                                                                fontWeight: 800,
                                                                fontSize: '0.75rem',
                                                                letterSpacing: '0.05em'
                                                            }}>
                                                                {attempt.result === 'SUCCESS' ? 'Passed' :
                                                                    attempt.result === 'FAILURE' ? 'Failed' :
                                                                        attempt.result}
                                                            </span>
                                                        </td>
                                                        <td style={{ padding: '1.25rem', color: '#64748b' }}>
                                                            <div style={{ color: '#cbd5e1' }}>{new Date(attempt.timestamp).toLocaleDateString(undefined, { dateStyle: 'medium' })}</div>
                                                            <div style={{ fontSize: '0.8rem' }}>{new Date(attempt.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                        </table>
                                    </div>
                                )}
                                
                                {!isLoading && totalPages > 1 && (
                                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem', padding: '1.5rem', borderTop: '1px solid rgba(255, 255, 255, 0.05)', background: 'rgba(0,0,0,0.1)' }}>
                                        <button
                                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                            disabled={currentPage === 1}
                                            style={{
                                                padding: '0.5rem 1rem', background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.1)', color: currentPage === 1 ? '#64748b' : 'white', borderRadius: '8px', cursor: currentPage === 1 ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: '0.85rem', transition: 'all 0.2s'
                                            }}
                                            onMouseEnter={(e) => !e.currentTarget.disabled && (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)')}
                                            onMouseLeave={(e) => !e.currentTarget.disabled && (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)')}
                                        >
                                            Previous
                                        </button>
                                        <div style={{ color: '#94a3b8', fontSize: '0.85rem', fontWeight: 600 }}>
                                            Page <span style={{ color: 'white' }}>{currentPage}</span> of <span style={{ color: 'white' }}>{totalPages}</span>
                                        </div>
                                        <button
                                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                            disabled={currentPage === totalPages}
                                            style={{
                                                padding: '0.5rem 1rem', background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.1)', color: currentPage === totalPages ? '#64748b' : 'white', borderRadius: '8px', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: '0.85rem', transition: 'all 0.2s'
                                            }}
                                            onMouseEnter={(e) => !e.currentTarget.disabled && (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)')}
                                            onMouseLeave={(e) => !e.currentTarget.disabled && (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)')}
                                        >
                                            Next
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

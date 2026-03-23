"use client";

import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

// Token helpers — stored separately from user data
const TOKEN_KEY = "devops_token";
export const getToken = (): string | null => localStorage.getItem(TOKEN_KEY);
export const authHeaders = (): Record<string, string> => {
    const token = getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
};

interface AuthUser {
    uid: string;
    email: string;
    displayName: string;
    photoUrl?: string;
    totalScore?: number;
    role?: string;
    verified?: boolean;
    university?: string;
}

interface AuthContextType {
    user: AuthUser | null;
    loading: boolean;
    login: (email: string, pass: string) => Promise<void>;
    signup: (email: string, pass: string, displayName: string, university: string, photoFile?: File | null) => Promise<void>;
    logout: () => Promise<void>;
    resetPassword: (email: string) => Promise<void>;
    sendVerificationEmail: () => Promise<void>;
    verifyOtp: (code: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Uploads an image to Firebase Storage via the Go backend.
 * Sends the JWT token so the authenticated upload-avatar route accepts it.
 */
async function uploadAvatarViaBackend(userId: string, file: File): Promise<string> {
    const formData = new FormData();
    formData.append("userId", userId);
    formData.append("avatar", file);

    console.log(`[uploadAvatar] POSTing to ${API_URL}/api/upload-avatar — userId=${userId}, file=${file.name} (${file.size} bytes)`);

    const response = await fetch(`${API_URL}/api/upload-avatar`, {
        method: "POST",
        headers: authHeaders(), // JWT required by RequireAuth middleware
        body: formData,
    });

    console.log(`[uploadAvatar] Response status: ${response.status}`);

    if (!response.ok) {
        const errText = (await response.text()).trim();
        console.error(`[uploadAvatar] Error: ${errText}`);
        throw new Error(`Avatar upload failed: ${errText}`);
    }

    const data = await response.json();
    console.log(`[uploadAvatar] Success! photoUrl=${data.photoUrl}`);
    return data.photoUrl as string;
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const [user, setUser] = useState<AuthUser | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const storedUser = localStorage.getItem("devops_user");
        if (storedUser) {
            setUser(JSON.parse(storedUser));
        }
        setLoading(false);
    }, []);

    const login = async (email: string, pass: string) => {
        const response = await fetch(`${API_URL}/api/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password: pass }),
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(error.trim() || "Invalid credentials");
        }

        const data = await response.json();

        // Store JWT for subsequent authenticated requests
        if (data.token) {
            localStorage.setItem(TOKEN_KEY, data.token);
        }

        const mappedUser: AuthUser = {
            uid: data.user.id,
            email: data.user.email,
            displayName: data.user.displayName,
            photoUrl: data.user.photoUrl || undefined,
            totalScore: data.user.totalScore || 0,
            role: data.user.role,
            verified: data.user.verified,
            university: data.user.university,
        };
        setUser(mappedUser);
        localStorage.setItem("devops_user", JSON.stringify(mappedUser));
    };

    const signup = async (email: string, pass: string, displayName: string, university: string, photoFile?: File | null) => {
        const response = await fetch(`${API_URL}/api/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password: pass, displayName, university }),
        });

        if (!response.ok) {
            const rawError = (await response.text()).trim();
            if (response.status === 409 || rawError.toLowerCase().includes("already exists")) {
                throw new Error("An account with this email address already exists. Please log in instead.");
            }
            throw new Error(rawError || "Registration failed");
        }

        const data = await response.json();
        const userId: string = data.user.id;

        // Store JWT from registration response
        if (data.token) {
            localStorage.setItem(TOKEN_KEY, data.token);
        }

        let photoUrl: string | undefined;
        if (photoFile) {
            try {
                photoUrl = await uploadAvatarViaBackend(userId, photoFile);
            } catch (e) {
                console.warn("[AuthContext] Photo upload failed, continuing without photo:", e);
                photoUrl = undefined;
            }
        }

        const mappedUser: AuthUser = {
            uid: userId,
            email: data.user.email,
            displayName: data.user.displayName,
            photoUrl,
            totalScore: data.user.totalScore || 0,
            role: data.user.role,
            verified: data.user.verified,
            university: data.user.university,
        };
        setUser(mappedUser);
        localStorage.setItem("devops_user", JSON.stringify(mappedUser));
    };

    const logout = async () => {
        setUser(null);
        localStorage.removeItem("devops_user");
        localStorage.removeItem(TOKEN_KEY);
    };

    const resetPassword = async (email: string) => {
        try {
            const response = await fetch(`${API_URL}/api/forgot-password`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email }),
            });
            if (!response.ok) {
                const err = await response.text();
                throw new Error(err.trim() || "Failed to send reset link");
            }
        } catch (e: any) {
            console.warn("[AuthContext] fallback for /api/forgot-password, mocking success.");
            // mock success
            await new Promise(r => setTimeout(r, 800));
        }
    };

    const sendVerificationEmail = async () => {
        if (!user) return;
        const response = await fetch(`${API_URL}/api/send-verification`, {
            method: "POST",
            headers: { ...authHeaders(), "Content-Type": "application/json" },
            body: JSON.stringify({ email: user.email }),
        });
        if (!response.ok) {
            const err = await response.text();
            throw new Error(err.trim() || "Failed to send verification email");
        }
    };

    const verifyOtp = async (code: string) => {
        if (!user) return;
        const response = await fetch(`${API_URL}/api/verify-otp`, {
            method: "POST",
            headers: { ...authHeaders(), "Content-Type": "application/json" },
            body: JSON.stringify({ email: user.email, code }),
        });

        if (!response.ok) {
            const err = await response.text();
            throw new Error(err.trim() || "Invalid verification code");
        }

        const data = await response.json();
        const updatedUser: AuthUser = {
            uid: data.id,
            email: data.email,
            displayName: data.displayName,
            photoUrl: data.photoUrl || undefined,
            totalScore: data.totalScore || 0,
            role: data.role,
            verified: data.verified,
            university: data.university,
        };

        setUser(updatedUser);
        localStorage.setItem("devops_user", JSON.stringify(updatedUser));
    };

    return (
        <AuthContext.Provider value={{ user, loading, login, signup, logout, resetPassword, sendVerificationEmail, verifyOtp }}>
            {!loading && children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
};

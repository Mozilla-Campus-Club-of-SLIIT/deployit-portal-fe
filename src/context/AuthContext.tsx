"use client";

import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";

const API_URL = "http://localhost:8080";

interface AuthUser {
    uid: string;
    email: string;
    displayName: string;
}

interface AuthContextType {
    user: AuthUser | null;
    loading: boolean;
    login: (email: string, pass: string) => Promise<void>;
    signup: (email: string, pass: string, displayName: string) => Promise<void>;
    logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

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
            throw new Error(error || "Invalid credentials");
        }

        const data = await response.json();
        const mappedUser = { uid: data.user.id, email: data.user.email, displayName: data.user.displayName };
        setUser(mappedUser);
        localStorage.setItem("devops_user", JSON.stringify(mappedUser));
    };

    const signup = async (email: string, pass: string, displayName: string) => {
        const response = await fetch(`${API_URL}/api/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password: pass, displayName }),
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(error || "Registration failed");
        }

        const data = await response.json();
        const mappedUser = { uid: data.user.id, email: data.user.email, displayName: data.user.displayName };
        setUser(mappedUser);
        localStorage.setItem("devops_user", JSON.stringify(mappedUser));
    };

    const logout = async () => {
        setUser(null);
        localStorage.removeItem("devops_user");
    };

    return (
        <AuthContext.Provider value={{ user, loading, login, signup, logout }}>
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

"use client";

import React from "react";
import { useLab } from "@/context/LabContext";
import { usePathname } from "next/navigation";
import Link from "next/link";

export default function ProvisioningBanner() {
    const { isProvisioning, labType } = useLab();
    const pathname = usePathname();

    if (!isProvisioning) return null;

    return (
        <div className="provisioning-section">
            <div className="provisioning-card glass-panel">
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', minWidth: 0, flex: 1 }}>
                    <div className="loading-spinner" style={{ width: '22px', height: '22px', margin: 0, borderWidth: '2px', flexShrink: 0 }}></div>
                    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                        <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            Provisioning in Progress
                        </span>
                        <span style={{ fontSize: '1rem', color: 'white', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            Preparing: <span style={{ color: 'var(--primary)', fontWeight: 800 }}>{labType}</span>
                        </span>
                    </div>
                </div>
            </div>
            
            <style jsx>{`
                .provisioning-section {
                    margin-bottom: 2rem;
                    animation: fadeIn 0.4s ease-out;
                }
                .provisioning-card {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 1.5rem;
                    padding: 1.25rem 2rem;
                    background: linear-gradient(135deg, rgba(30, 27, 75, 0.7) 0%, rgba(49, 46, 129, 0.7) 100%);
                    border: 1px solid rgba(99, 102, 241, 0.3);
                    box-shadow: 0 10px 30px -10px rgba(0,0,0,0.5);
                }

                @media (max-width: 640px) {
                    .provisioning-card {
                        flex-direction: column;
                        gap: 1rem;
                        padding: 1.25rem;
                        text-align: center;
                    }
                    .provisioning-card div {
                        justify-content: center;
                    }
                }

                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(-10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </div>
    );
}

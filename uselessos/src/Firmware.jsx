import React, { useEffect, useState } from "react";

const getStoragePath = () => {
    try {
        if (typeof window !== "undefined" && window.electronAPI?.getAppDataPath) {
            return window.electronAPI.getAppDataPath();
        }
    } catch {
        // ignore
    }
    return "Browser storage (localStorage)";
};

const Firmware = ({ onBack }) => {
    const [storagePath, setStoragePath] = useState("Loading...");

    useEffect(() => {
        setStoragePath(getStoragePath());
    }, []);

    const copyStoragePath = async () => {
        if (!storagePath || storagePath === "Loading...") return;

        try {
            if (navigator.clipboard?.writeText) {
                await navigator.clipboard.writeText(storagePath);
            }
        } catch {
            // ignore clipboard failures
        }
    };

    return (
        <div
            style={{
                width: "100vw",
                height: "100vh",
                background: "#000",
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily:
                    '-apple-system,BlinkMacSystemFont,"SF Pro Display","Segoe UI",sans-serif',
                userSelect: "none",
                padding: 24,
            }}
        >
            <div style={{ maxWidth: 760, lineHeight: 1.5 }}>
                <button
                    onClick={onBack}
                    style={{
                        marginBottom: 16,
                        padding: "8px 14px",
                        borderRadius: 999,
                        border: "1px solid rgba(255,255,255,0.2)",
                        background: "rgba(255,255,255,0.08)",
                        color: "#fff",
                        cursor: "pointer",
                    }}
                >
                    ← Back
                </button>

                <div style={{ fontSize: 32, fontWeight: 600, marginBottom: 8 }}>
                    UselessOS
                </div>
                <div style={{ fontSize: 14, color: "#8d8d8d", marginBottom: 16 }}>
                    Open source • JavaScript • ElectronJS • ReactJS
                </div>

                <div style={{ fontSize: 14, color: "#e8e8e8", marginBottom: 14 }}>
                    Available on <a href="https://github.com/arhamzaman124/uselessos">GitHub</a>. Performance depends on your system specifications.
                </div>

                <div style={{ marginTop: 12 }}>
                    <div style={{ fontWeight: 600, marginBottom: 6 }}>Minimum Hardware Requirements</div>
                    <div style={{ fontSize: 13, color: "#cfcfcf" }}>
                        RAM: 4 GB minimum (8 GB recommended)<br />
                        CPU: 1 GHz or faster 64-bit processor<br />
                        Disk Space: ~1–2 GB free
                    </div>
                </div>

                <div style={{ marginTop: 12 }}>
                    <div style={{ fontWeight: 600, marginBottom: 6 }}>Minimum Operating System Requirements</div>
                    <div style={{ fontSize: 13, color: "#cfcfcf" }}>
                        Windows 10+, macOS 11+, Ubuntu 22.04+ / Fedora 32+ / Debian 10+
                    </div>
                </div>

                <div style={{ marginTop: 12 }}>
                    <div style={{ fontWeight: 600, marginBottom: 6 }}>Storage Directory</div>
                    <div
                        onClick={copyStoragePath}
                        style={{
                            fontSize: 13,
                            color: "#cfcfcf",
                            wordBreak: "break-all",
                            cursor: "pointer",
                            textDecoration: "underline",
                        }}
                    >
                        {storagePath}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Firmware;

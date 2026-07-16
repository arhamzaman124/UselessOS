import React, { useEffect, useState } from "react";
import Boot64 from "./Boot";
import Main from "./OS";
import Firmware from "./Firmware";
import logo from "./icon.png";
import settings from "./settings.webp";

const bootEntries = [
    {
        id: 1,
        name: "UselessOS",
        icon: logo,
        component: Main,
    },
    {
        id: 2,
        name: "Firmware",
        icon: settings,
        component: Firmware,
        loadingLabel: "Firmware Setup Loading",
    },
];

const buttonStyle = {
    width: 48,
    height: 48,
    borderRadius: "50%",
    border: "1px solid rgba(255,255,255,.18)",
    background: "rgba(255,255,255,.08)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    cursor: "pointer",
    transition: ".2s",
    backdropFilter: "blur(12px)",
};

const App = () => {
    const [stage, setStage] = useState("menu");
    const [selected, setSelected] = useState(0);
    const [bootedEntryId, setBootedEntryId] = useState(null);
    const [bootMessage, setBootMessage] = useState(null);
    const [shutdownStage, setShutdownStage] = useState(false);

    const boot = (entryIndex) => {
        const entry = bootEntries[entryIndex] ?? bootEntries[0];
        setStage("booting");
        setBootedEntryId(entry.id);
        setBootMessage(entry.loadingLabel || null);

        setTimeout(() => {
            setStage("booted");
        }, 6125);
    };

    const rebootToBootScreen = () => {
        setStage("booting");
        setBootMessage(null);
        setTimeout(() => {
            setStage("booted");
        }, 6125);
    };

    const restart = () => {
        setStage("menu");
        setSelected(0);
        setBootedEntryId(null);
        setBootMessage(null);
        setShutdownStage(false);
    };

    const shutdown = () => {
        setShutdownStage(true);
        setTimeout(() => {
            if (typeof window !== "undefined" && window.close) {
                window.close();
            }
            if (typeof window !== "undefined" && window.location) {
                window.location.href = "about:blank";
            }
        }, 900);
    };

    useEffect(() => {
        const handleBeforeUnload = (e) => {
            if (stage === "menu" || stage === "booting" || stage === "booted") {
                e.preventDefault();
                e.returnValue = "";
            }
        };

        const handleKeyDown = (e) => {
            if (e.code === "KeyR" && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                return;
            }
        };

        window.addEventListener("beforeunload", handleBeforeUnload);
        window.addEventListener("keydown", handleKeyDown);

        return () => {
            window.removeEventListener("beforeunload", handleBeforeUnload);
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, [stage]);

    useEffect(() => {
        if (stage !== "menu") return;

        const handleKeyDown = (e) => {
            switch (e.code) {
                case "ArrowLeft":
                    setSelected((s) => Math.max(0, s - 1));
                    break;

                case "ArrowRight":
                    setSelected((s) =>
                        Math.min(bootEntries.length - 1, s + 1)
                    );
                    break;

                case "Enter":
                case "NumpadEnter":
                    boot(selected);
                    break;

                default:
                    break;
            }
        };

        window.addEventListener("keydown", handleKeyDown);

        return () =>
            window.removeEventListener("keydown", handleKeyDown);
    }, [stage, selected]);

    if (shutdownStage) {
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
                }}
            >
                <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 24, fontWeight: 600, marginBottom: 8 }}>Shutting down…</div>
                    <div style={{ fontSize: 14, color: "#8d8d8d" }}>Goodbye.</div>
                </div>
            </div>
        );
    }

    if (stage === "booting") {
        return <Boot64 message={bootMessage} />;
    }

    if (stage === "booted") {
        const bootedEntry =
            bootEntries.find((entry) => entry.id === bootedEntryId) ??
            bootEntries[0];
        const Component = bootedEntry.component;

        if (bootedEntry.id === 2) {
            return <Component onBack={restart} />;
        }

        return <Component onReboot={rebootToBootScreen} />;
    }

    return (
        <div
            style={{
                width: "100vw",
                height: "100vh",
                background: "#000",
                color: "#fff",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                fontFamily:
                    '-apple-system,BlinkMacSystemFont,"SF Pro Display","Segoe UI",sans-serif',
                userSelect: "none",
                overflow: "hidden",
            }}
        >
            <div
                style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    width: "100%",
                    height: "100%",
                }}
            >
                {/* Startup Disks */}
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 90,
                        flex: 1,
                    }}
                >
                    {bootEntries.map((entry, index) => (
                        <div
                            key={entry.id}
                            onClick={() => {
                                setSelected(index);
                                boot(index);
                            }}
                            style={{
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "center",
                                cursor: "pointer",
                                opacity: selected === index ? 0.6 : 1,
                                transition: "opacity .2s ease",
                            }}
                        >
                            <img
                                src={entry.icon}
                                alt={entry.name}
                                style={{
                                    width: 128,
                                    height: 128,
                                    borderRadius: 28,
                                    border:
                                        selected === index
                                            ? "1px solid #ffffff26"
                                            : "1px solid transparent",
                                    transition: "all .2s ease",
                                    padding: "20px",
                                }}
                            />

                            <div
                                style={{
                                    marginTop: 18,
                                    fontSize: 21,
                                    fontWeight: 500,
                                }}
                            >
                                {entry.name}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Bottom Controls */}
                <div
                    style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        marginBottom: 45,
                    }}
                >
                    <div
                        style={{
                            display: "flex",
                            gap: 18,
                        }}
                    >
                        {/* Shutdown */}
                        <button
                            style={buttonStyle}
                            onClick={shutdown}
                        >
                            <svg
                                width="20"
                                height="20"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="white"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            >
                                <path d="M12 2v10" />
                                <path d="M6.2 5.2a9 9 0 1011.6 0" />
                            </svg>
                        </button>

                        {/* Restart */}
                        <button
                            style={buttonStyle}
                            onClick={restart}
                        >
                            <svg
                                width="20"
                                height="20"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="white"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            >
                                <polyline points="23 4 23 10 17 10" />
                                <polyline points="1 20 1 14 7 14" />
                                <path d="M3.5 9a9 9 0 0114.7-3L23 10" />
                                <path d="M20.5 15a9 9 0 01-14.7 3L1 14" />
                            </svg>
                        </button>
                    </div>

                    <div
                        style={{
                            marginTop: 22,
                            color: "#8d8d8d",
                            fontSize: 15,
                            textAlign: "center",
                        }}
                    >
                        Use ← → to select a startup disk.<br />
                        Press Enter to continue.
                    </div>
                </div>
            </div>
        </div>
    );
};

export default App;
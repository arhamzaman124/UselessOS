import React, { useState, useEffect, useRef, useCallback } from "react";
import {
    loadDisk,
    saveDisk,
    wipeDisk,
    diskUsageBytes,
    clone,
    resolvePath,
    getNode,
    getParent,
    ensureDir,
    displayPath,
    loadPathMap,
    savePathMap,
    loadLibMap,
    saveLibMap,
    loadBootServices,
    saveBootServices,
    buildBackup,
    parseBackup,
} from "./lib/fs";
import "./css/styles.css";

const wait = (ms) => new Promise((res) => setTimeout(res, ms));

const HELP_TEXT = [
    "Filesystem:",
    "  ls [-a] [path]          list directory contents",
    "  cd [path]                change directory",
    "  pwd                      print working directory",
    "  mkdir [-p] <dir>          make directory",
    "  touch <file>             create empty file",
    "  cat <file>               print file contents",
    "  echo <text> [>|>> f]    print text, or write/append to a file",
    "  rm [-r] <path>           remove file or directory",
    "  rmdir <dir>              remove empty directory",
    "  mv <src> <dst>           move / rename",
    "  cp <src> <dst>           copy a file",
    "  download <url>           fetch a URL and save it in the current dir",
    "  chmod +x|-x <file>       mark a file executable / not executable",
    "",
    "Scripting (.useless files):",
    "  ./file.useless [args]    run an executable .useless file",
    "  <alias> [args]           run via a PATH alias",
    '  addition towards PATH "file.useless" as "alias"',
    "                           register a PATH alias for a script",
    "  Inside a .useless file you get: printf(), scanf(), execute(),",
    "  bufferscreenclear(), bufferscreenexitprogramservices(), sleep(),",
    "  signal(), process, getenv()/setenv()/unsetenv(), the File API",
    "  (readFile/writeFile/appendFile/exists/mkdir/remove/listDir), and",
    "  function main(argc, argv) { ... } is your entry point.",
    "  IMPORTANT: if main() ever calls await scanf(...)/sleep(...)/execute(...)",
    "  or any File API call, or if it needs to keep running after a",
    "  bufferscreenclear() session (e.g. inside a setTimeout/interval/event",
    "  handler) declare it as:",
    "    async function main(argc, argv) { ... }",
    "  and use `await`. A non-async main() that calls an async builtin",
    "  without awaiting it will not receive the resolved value.",
    "  execute(cmd) resolves to { stdout, stderr, exitCode }, not a string.",
    "",
    "Imports (.useless files can import other .useless files):",
    '  import { add } from "math";        // library-name import (via libman)',
    '  import { add } from "./lib.useless"; // static path import',
    "  export function foo(...) { ... }    top-level only, in the importee",
    "",
    "Libraries (libman):",
    "  libman list                          show registered libraries",
    "  libman add <name> <path>            register a library",
    "  libman remove <name>                 unregister a library",
    "  libman path <name>                   print the path a name resolves to",
    "",
    "Boot services:",
    "  onbootservices list                       show registered services",
    "  onbootservices add <name> <path>          register a service",
    "  onbootservices start <name>               enable + run now",
    "  onbootservices restart <name>             run again now",
    "  onbootservices pause <name>               skip at next boot",
    "  onbootservices remove <name>              unregister",
    "  onbootservices reset                      clear all services",
    "",
    "Backups:",
    "  backup save              download a .bak snapshot of the disk",
    "  backup load               pick a .bak file and restore from it",
    "",
    "System:",
    "  clear / history / whoami / hostname / uname -a / date",
    "  df -h / neofetch / reboot / shutdown / reset --confirm / man <cmd>",
];

// ---- crash dump helpers ----
const hex = (n = 8) =>
    "0x" + Array.from({ length: n }, () => "0123456789abcdef"[Math.floor(Math.random() * 16)]).join("");

const memRow = (addr) => {
    const bytes = Array.from({ length: 8 }, () =>
        Math.floor(Math.random() * 256).toString(16).padStart(2, "0")
    ).join(" ");
    const ascii = Array.from({ length: 8 }, () => {
        const c = 33 + Math.floor(Math.random() * 90);
        return Math.random() > 0.3 ? String.fromCharCode(c) : ".";
    }).join("");
    return `${addr}  ${bytes}  ${bytes}  |${ascii}${ascii}|`;
};

function buildCrashScreens() {
    return [
        [
            "rm: descending into '/'...",
            "rm: removing '/bin'...",
            "rm: removing '/bin/sh'...",
            "rm: removing '/etc'...",
            "rm: removing '/etc/motd'...",
            "rm: removing '/home/user'...",
            "rm: removing '/home/user/readme.txt'...",
            "rm: removing '/var/log'...",
            "rm: removing '/tmp'...",
            "rm: removing '/proc'... permission denied, forcing anyway",
            "rm: removing '/dev/null'... wait, that shouldn't be possible",
            "rm: removing '/sys/kernel'...",
        ],
        [
            "vfs: root filesystem vanished beneath running process",
            "vfs: mount table corrupted, inode 0 unreachable",
            "vfs: cannot find superblock on device localStorage:/dev/disk0",
            "EXT-fake-fs error (device disk0): orphan inode list corrupted",
            "EXT-fake-fs error (device disk0): journal has aborted",
            "JBD2: Detected IO errors while flushing file data",
            "Buffer I/O error on device disk0, logical block 88213",
            "Buffer I/O error on device disk0, logical block 88214",
            "lost+found: directory entry table missing",
            "sd 0:0:0:0: [disk0] tag#12 uncorrectable error, dev disk0",
        ],
        [
            "Oops: 0000 [#1] SMP PTI",
            "CPU: 0 PID: 1 Comm: init Not tainted 0.9.3-useless #1",
            "Hardware name: Virtual/QEMU-fake, BIOS 1.0.0-fake",
            `RIP: 0010:${hex(12)}`,
            `RSP: 0018:${hex(12)} EFLAGS: 00010246`,
            `RAX: ${hex(12)} RBX: ${hex(12)} RCX: ${hex(12)}`,
            `RDX: ${hex(12)} RSI: ${hex(12)} RDI: ${hex(12)}`,
            `RBP: ${hex(12)} R08: ${hex(12)} R09: ${hex(12)}`,
            `R10: ${hex(12)} R11: ${hex(12)} R12: ${hex(12)}`,
            "CR2: 0000000000000000 CR3: 000000000200a000 CR4: 00000000000006e0",
        ],
        [
            "Dumping physical memory 0xffffffff81000000 -> 0xffffffff81000200",
            ...Array.from({ length: 10 }, (_, i) => memRow("0x" + (0x81000000 + i * 16).toString(16))),
        ],
        [
            "ps: kernel process table corrupted, dumping last known state",
            "  PID TTY      STAT   TIME COMMAND",
            "    1 ?        Zs     0:01 init <defunct>",
            "   17 ?        Sw     0:00 [rcu_sched]",
            "   88 ?        Rs     9:12 [vfs_reaper]",
            "  213 ?        Ds     0:03 [disk0_flush]",
            "  404 ?        Zs     0:00 shell <defunct>",
            " 1337 ?        Rs   66:06 [rm_-rf_root] <runaway>",
            " 9999 ?        Ss     0:00 [watchdog] tickling nothing",
            "ps: warning: 3 zombie processes could not be reaped",
        ],
        [
            "Call Trace:",
            " <IRQ>",
            "  vfs_unlink_all+0x142/0x3a0",
            "  path_destroy_recursive+0x88/0x120",
            "  do_rm_dash_rf+0x256/0x400",
            "  ? should_have_asked_for_confirmation+0x0/0x10",
            "  init_teardown+0x1a2/0x1a2",
            "  worker_thread+0x4c/0x3d0",
            "  ret_from_fork+0x1f/0x30",
            " </IRQ>",
            "---[ end trace 0000000000000000 ]---",
        ],
        [
            "EXT-fake-fs: sync failed on all devices",
            "Buffer I/O error on device disk0, logical block 102441",
            "Buffer I/O error on device disk0, logical block 102442",
            "localStorage: quota exceeded while writing crash context",
            "watchdog: BUG: soft lockup - CPU#0 stuck for 22s!",
            "systemd-journald[1]: Failed to write entry, ignoring: I/O error",
            "note: init[1] exited with irrecoverable error",
        ],
        [
            "kernel: BUG: unable to handle page fault at 0xFFFFFFFFDEADC0DE",
            "kernel: vfs: root filesystem vanished beneath running process",
            "kernel: Fatal exception in interrupt",
            "kernel: Kernel panic - not syncing: Attempted to kill init!",
            "kernel: Kernel Offset: disabled",
            "kernel: ---[ end Kernel panic - not syncing: Attempted to kill init! ]---",
            "",
            "Rebooting in 3 seconds...",
        ],
    ];
}

function asciiLogo() {
    return [
        "   ____ ____ ____ ____ ____ ____ ",
        "  ||U |||O |||S |||  |||  |||  ||",
        "  ||__|||__|||__|||__|||__|||__||",
        "  |/__\\|/__\\|/__\\|/__\\|/__\\|/__\\|",
    ];
}

const formatPrintf = (fmt, args) => {
    let i = 0;
    return String(fmt).replace(/%[sdif%]/g, (m) => {
        if (m === "%%") return "%";
        const val = args[i++];
        if (m === "%d" || m === "%i") return String(Math.trunc(Number(val)));
        if (m === "%f") return String(Number(val));
        return String(val);
    });
};

// ---- .useless import/export parsing helpers (§12) ----
// A deliberately simple, line-oriented parser: import statements must be the
// very first thing in a file, one per line, before any other top-level code.

const parseLeadingImports = (code) => {
    const lines = code.split(/\r?\n/);
    const imports = [];
    let i = 0;
    while (i < lines.length) {
        const trimmed = lines[i].trim();
        if (trimmed === "" || trimmed.startsWith("//")) {
            i++;
            continue;
        }
        const namedMatch = trimmed.match(/^import\s*{\s*([^}]+)\s*}\s*from\s*["']([^"']+)["']\s*;?$/);
        const defaultMatch = trimmed.match(/^import\s+(\w+)\s+from\s*["']([^"']+)["']\s*;?$/);
        if (namedMatch) {
            imports.push({
                form: "named",
                names: namedMatch[1].split(",").map((s) => s.trim()).filter(Boolean),
                source: namedMatch[2],
            });
            i++;
            continue;
        }
        if (defaultMatch) {
            imports.push({ form: "default", localName: defaultMatch[1], source: defaultMatch[2] });
            i++;
            continue;
        }
        break; // first non-import, non-blank, non-comment line ends the import block
    }
    return { imports, rest: lines.slice(i).join("\n") };
};

// `new Function(...)` bodies can't contain the `export` keyword, so it's
// stripped before the code is handed to the Function constructor. The names
// it applied to are captured first via findExportedNames.
const stripExportKeyword = (code) => code.replace(/\bexport\s+function\b/g, "function");

const findExportedNames = (code) => {
    const names = [];
    const re = /\bexport\s+function\s+(\w+)\s*\(/g;
    let m;
    while ((m = re.exec(code))) names.push(m[1]);
    return names;
};

const isLibrarySpecifier = (source) => !(source.startsWith("./") || source.startsWith("../") || source.startsWith("/"));

export default function Main({ onReboot }) {
    const [booted, setBooted] = useState(false);
    const [bootedLines, setBootedLines] = useState([]);
    const [processes, setProcesses] = useState([]);
    const [fs, setFs] = useState(null);
    const [cwd, setCwd] = useState("/home/user");
    const [output, setOutput] = useState([]);
    const [input, setInput] = useState("");
    const [history, setHistory] = useState([]);
    const [histIndex, setHistIndex] = useState(null);
    const [screenBufferActive, setScreenBufferActive] = useState(false);
    const [awaitingProgramInput, setAwaitingProgramInput] = useState(false);
    const [scanfPromptLabel, setScanfPromptLabel] = useState("");

    const [crashState, setCrashState] = useState(null);
    const [crashScreens, setCrashScreens] = useState([]);
    const [crashScreenIdx, setCrashScreenIdx] = useState(0);
    const [crashLines, setCrashLines] = useState([]);
    const [bgProcessMessages, setBgProcessMessages] = useState([]);

    const bootTime = useRef(Date.now());
    const outputRef = useRef(null);
    const inputRef = useRef(null);
    const screenInputRef = useRef(null);
    const fileInputRef = useRef(null);

    // refs mirror state so async/nested command execution always reads fresh data
    const fsRef = useRef(null);
    const cwdRef = useRef("/home/user");
    const pathMapRef = useRef({});
    const libMapRef = useRef({});
    const bootServicesRef = useRef([]);
    const historyRef = useRef([]);
    const awaitingInputResolveRef = useRef(null);
    const inProgramExecutionRef = useRef(false);

    // Environment variables (§10) — shared across the whole boot session,
    // not private per script, and NOT persisted across reboot.
    const envRef = useRef({ HOME: "/home/user", USER: "user" });

    // Signals & process control (§9). Keyed by pid so process.kill(pid, sig)
    // and Ctrl+C both route through the same delivery path regardless of
    // whether the target is the foreground program or a background one.
    const signalHandlersRef = useRef(new Map()); // pid -> Map(signalName -> handler)
    const pendingInterruptRef = useRef(new Map()); // pid -> cancel(reason) for an in-flight scanf/sleep
    const forceCloseRef = useRef(new Map()); // pid -> function that force-closes the screen & unwinds
    const foregroundPidRef = useRef(null); // pid Ctrl+C should be delivered to right now

    const setFsBoth = (next) => {
        fsRef.current = next;
        setFs(next);
        saveDisk(next);
    };
    const setCwdBoth = (next) => {
        cwdRef.current = next;
        setCwd(next);
    };
    const setPathMapBoth = (next) => {
        pathMapRef.current = next;
        savePathMap(next);
    };
    const setLibMapBoth = (next) => {
        libMapRef.current = next;
        saveLibMap(next);
    };
    const setBootServicesBoth = (next) => {
        bootServicesRef.current = next;
        saveBootServices(next);
    };

    const generatePid = () => Date.now() + Math.floor(Math.random() * 1000);

    const pushTermLines = (lines) => {
        if (!lines.length) return;
        setOutput((o) => [...o, ...lines]);
    };

    const spawnBackgroundProcess = useCallback((proc) => {
        const entry = { id: proc.pid, ...proc };
        setProcesses((prev) => [...prev, entry]);
        setBgProcessMessages((prev) => [...prev, `Background process ${entry.id} started: ${entry.name}`]);
        return entry;
    }, []);

    const pickupProcess = useCallback(async (pid) => {
        const proc = processes.find((p) => p.id === Number(pid));
        if (!proc) {
            setOutput((o) => [...o, { kind: "line", text: `pickup: no such process '${pid}'`, cls: "err" }]);
            return;
        }
        setProcesses((prev) => prev.filter((p) => p.id !== Number(pid)));
        setOutput((o) => [...o, { kind: "line", text: `Picking up process ${proc.id} (${proc.name})`, cls: "accent" }]);
        try {
            const exitCode = await proc.runner();
            setOutput((o) => [
                ...o,
                {
                    kind: "line",
                    text: `process ${proc.id} (${proc.name}) finished with exit code ${exitCode ?? 0}`,
                    cls: exitCode ? "err" : "accent",
                },
            ]);
        } catch (e) {
            setOutput((o) => [...o, { kind: "line", text: `process ${proc.id} exited with error: ${e.message || String(e)}`, cls: "err" }]);
        }
    }, [processes]);

    // Delivers `signalName` to the program running as `pid` (§9.1/§9.2). If
    // that program registered a signal(...) handler, the handler runs and
    // any in-flight scanf()/sleep() for that pid is interrupted so the
    // handler can take over immediately. Otherwise, SIGINT falls back to the
    // runtime default: close any open screen buffer and terminate.
    const deliverSignal = useCallback((pid, name) => {
        if (pid === null || pid === undefined) return;
        const handlers = signalHandlersRef.current.get(pid);
        const handler = handlers && handlers.get(name);
        const cancel = pendingInterruptRef.current.get(pid);
        if (handler) {
            if (cancel) cancel({ __exitUselessProgram: true, __signalInterrupt: true });
            Promise.resolve()
                .then(() => handler())
                .catch((e) => {
                    if (!(e && e.__exitUselessProgram)) {
                        console.error("signal handler error:", e);
                    }
                });
        } else if (name === "SIGINT") {
            if (cancel) cancel({ __exitUselessProgram: true });
            const fc = forceCloseRef.current.get(pid);
            if (fc) fc();
            if (pid === foregroundPidRef.current) {
                setOutput((o) => [...o, { kind: "line", text: "^C" }]);
            }
        }
    }, []);

    // ---- boot sequence ----
    const runBoot = useCallback(async () => {
        setBooted(false);
        setBootedLines([]);
        const { fs: loadedFs, isNew } = loadDisk();
        const loadedPathMap = loadPathMap();
        const loadedLibMap = loadLibMap();
        const loadedBootServices = loadBootServices();

        fsRef.current = loadedFs;
        cwdRef.current = "/home/user";
        pathMapRef.current = loadedPathMap;
        libMapRef.current = loadedLibMap;
        bootServicesRef.current = loadedBootServices;
        envRef.current = { HOME: "/home/user", USER: "user" };
        signalHandlersRef.current = new Map();
        pendingInterruptRef.current = new Map();
        forceCloseRef.current = new Map();
        foregroundPidRef.current = null;

        setFs(loadedFs);
        setCwd("/home/user");
        setOutput([
            { kind: "line", text: getNode(loadedFs, "/etc/motd")?.content?.trim() || "" },
            { kind: "line", text: "" },
        ]);
        setBooted(true);

        const services = bootServicesRef.current.filter((s) => s.enabled && !s.paused);
        for (const svc of services) {
            setOutput((o) => [...o, { kind: "line", text: `Starting boot service '${svc.name}'...`, cls: "accent" }]);
            await runServiceByPath(svc.path, [svc.name], { fromBoot: true });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        runBoot();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (booted && !crashState && !screenBufferActive && inputRef.current) inputRef.current.focus();
    }, [booted, crashState, screenBufferActive, output]);

    // Keep focus on the in-overlay input whenever a screen-buffer program is
    // waiting on scanf(), since the normal terminal input row is unmounted
    // while screenBufferActive is true.
    useEffect(() => {
        if (screenBufferActive && awaitingProgramInput && screenInputRef.current) {
            screenInputRef.current.focus();
        }
    }, [screenBufferActive, awaitingProgramInput]);

    useEffect(() => {
        if (outputRef.current) outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }, [output, bootedLines]);

    const focusInput = () => {
        if (crashState) return;
        if (screenBufferActive) {
            if (awaitingProgramInput && screenInputRef.current) screenInputRef.current.focus();
            return;
        }
        if (inputRef.current) inputRef.current.focus();
    };

    // ---- crash sequence ----
    const triggerCrash = async () => {
        const screens = buildCrashScreens();
        setCrashScreens(screens);
        setCrashState("panicking");

        for (let s = 0; s < screens.length; s++) {
            setCrashScreenIdx(s);
            setCrashLines([]);
            const screenLines = screens[s];
            for (let i = 0; i < screenLines.length; i++) {
                setCrashLines((prev) => [...prev, screenLines[i]]);
                await wait(55 + Math.random() * 70);
            }
            await wait(s === screens.length - 1 ? 900 : 480);
        }

        setCrashState("glitching");
        await wait(3200);

        const wiped = wipeDisk();
        fsRef.current = wiped;
        cwdRef.current = "/home/user";
        historyRef.current = [];
        setHistory([]);
        setCrashState(null);
        setCrashScreens([]);
        setCrashScreenIdx(0);
        setCrashLines([]);
        runBoot();
    };

    // ---- .useless runtime helpers ----
    const printf = (fmt, ...args) => {
        const text = formatPrintf(fmt, args);
        const parts = text.split("\n");
        setOutput((o) => [...o, ...parts.map((t) => ({ kind: "line", text: t }))]);
    };

    // scanf() works whether or not a screen-buffer overlay is active, and,
    // when given a pid, is interruptible by a SIGINT delivered to that pid
    // (§4.2, §9.1). Only one scanf() resolves at a time — this mirrors the
    // single floating/terminal input row the UI actually renders.
    const scanf = (promptLabel = "", pid = null) => {
        return new Promise((resolve, reject) => {
            if (promptLabel && !screenBufferActiveRef.current) {
                setOutput((o) => [...o, { kind: "line", text: promptLabel }]);
            }
            setScanfPromptLabel(promptLabel || "");
            awaitingInputResolveRef.current = (val) => {
                if (pid !== null) pendingInterruptRef.current.delete(pid);
                resolve(val);
            };
            if (pid !== null) {
                pendingInterruptRef.current.set(pid, (reason) => {
                    pendingInterruptRef.current.delete(pid);
                    awaitingInputResolveRef.current = null;
                    setAwaitingProgramInput(false);
                    setScanfPromptLabel("");
                    reject(reason || { __exitUselessProgram: true });
                });
            }
            setAwaitingProgramInput(true);
        });
    };

    // sleep(ms) (§9.3) — interruptible the same way scanf() is.
    const sleepImpl = (ms, pid = null) => {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                if (pid !== null) pendingInterruptRef.current.delete(pid);
                resolve();
            }, ms);
            if (pid !== null) {
                pendingInterruptRef.current.set(pid, (reason) => {
                    clearTimeout(timer);
                    pendingInterruptRef.current.delete(pid);
                    reject(reason || { __exitUselessProgram: true });
                });
            }
        });
    };

    // mirror screenBufferActive in a ref so scanf() (captured once per .useless
    // execution via closures inside runUselessFile) always reads the live value
    const screenBufferActiveRef = useRef(false);
    useEffect(() => {
        screenBufferActiveRef.current = screenBufferActive;
    }, [screenBufferActive]);

    const bufferscreenclear = () => {
        let el = document.getElementById("screen");
        if (!el) {
            el = document.createElement("div");
            el.id = "screen";
            document.body.appendChild(el);
        }
        el.style.position = "fixed";
        el.style.inset = "0";
        el.style.zIndex = "999";
        el.style.background = "#000";
        el.style.color = "#fff";
        el.style.fontFamily = "monospace";
        el.style.overflow = "auto";
        el.innerHTML = "";
        setScreenBufferActive(true);
        return el;
    };

    // ---- environment variables (§10) ----
    const getenv = (name) => (Object.prototype.hasOwnProperty.call(envRef.current, name) ? envRef.current[name] : null);
    const setenv = (name, value) => {
        envRef.current = { ...envRef.current, [name]: String(value) };
    };
    const unsetenv = (name) => {
        const next = { ...envRef.current };
        delete next[name];
        envRef.current = next;
    };

    // ---- File API (§11) — resolves relative paths against cwdRef, same as
    // the shell builtins, and persists through the same setFsBoth as everything
    // else so `execute("cat ...")` sees writes made via the File API and
    // vice versa. ----
    const apiReadFile = async (path) => {
        const target = resolvePath(cwdRef.current, path);
        const node = getNode(fsRef.current, target);
        if (!node || node.type !== "file") throw new Error(`readFile: no such file '${path}'`);
        return node.content || "";
    };

    const apiWriteFile = async (path, data) => {
        const target = resolvePath(cwdRef.current, path);
        const working = clone(fsRef.current);
        const { parent, name: n } = getParent(working, target);
        if (!parent || parent.type !== "dir") throw new Error(`writeFile: no such directory for '${path}'`);
        const existing = parent.children[n];
        parent.children[n] = { type: "file", content: String(data), executable: existing?.executable || false };
        setFsBoth(working);
        return true;
    };

    const apiAppendFile = async (path, data) => {
        const target = resolvePath(cwdRef.current, path);
        const working = clone(fsRef.current);
        const { parent, name: n } = getParent(working, target);
        if (!parent || parent.type !== "dir") throw new Error(`appendFile: no such directory for '${path}'`);
        const existing = parent.children[n];
        const prevContent = existing?.type === "file" ? existing.content || "" : "";
        parent.children[n] = { type: "file", content: prevContent + String(data), executable: existing?.executable || false };
        setFsBoth(working);
        return true;
    };

    const apiExists = async (path) => {
        const target = resolvePath(cwdRef.current, path);
        return !!getNode(fsRef.current, target);
    };

    const apiMkdir = async (path) => {
        const target = resolvePath(cwdRef.current, path);
        const working = clone(fsRef.current);
        ensureDir(working, target);
        setFsBoth(working);
        return true;
    };

    const apiRemove = async (path) => {
        const target = resolvePath(cwdRef.current, path);
        const working = clone(fsRef.current);
        const { parent, name: n } = getParent(working, target);
        if (parent && parent.children && parent.children[n]) {
            delete parent.children[n];
            setFsBoth(working);
        }
        return true;
    };

    const apiListDir = async (path) => {
        const target = resolvePath(cwdRef.current, path);
        const node = getNode(fsRef.current, target);
        if (!node || node.type !== "dir") throw new Error(`listDir: '${path}' is not a directory`);
        return Object.entries(node.children).map(([name, child]) => ({
            name,
            isDirectory: child.type === "dir",
        }));
    };

    // ---- import/export/libman resolution (§12) ----
    // Loads a .useless file as an importable module: resolves its own leading
    // imports first (recursively), then evaluates its top-level code (with
    // `export` stripped) inside a Function built from the given builtins plus
    // whatever it imported, and returns the namespace of its exported names.
    const loadUselessModule = async (path, builtins, visitedStack) => {
        if (visitedStack.includes(path)) {
            throw new Error(`circular import detected: ${[...visitedStack, path].join(" -> ")}`);
        }
        const node = getNode(fsRef.current, path);
        if (!node || node.type !== "file") {
            throw new Error(`cannot resolve import: '${path}' does not exist`);
        }
        const nextVisited = [...visitedStack, path];
        const { bindings, rest } = await resolveImportsAndBindings(node.content || "", builtins, nextVisited);
        const exportedNames = findExportedNames(rest);
        const strippedRest = stripExportKeyword(rest);

        const builtinNames = Object.keys(builtins);
        const bindingNames = Object.keys(bindings);
        const namespaceExpr = exportedNames
            .map((n) => `${JSON.stringify(n)}: typeof ${n} !== "undefined" ? ${n} : undefined`)
            .join(", ");
        const fnBody = `${strippedRest}
;return { main: typeof main === "function" ? main : undefined, __namespace: { ${namespaceExpr} } };`;
        // eslint-disable-next-line no-new-func
        const factory = new Function(...builtinNames, ...bindingNames, fnBody);
        const result = factory(...builtinNames.map((n) => builtins[n]), ...bindingNames.map((n) => bindings[n]));
        return { namespace: result.__namespace || {}, main: result.main };
    };

    // Resolves the leading `import` block of `code` into a flat bindings
    // object of {localIdentifier: value} to inject into the Function scope
    // that will run `code`, per the library-name vs. static-path rules in
    // §12.2. `visitedStack` carries the chain of paths currently being
    // loaded so circular imports are rejected before main runs (§12.3).
    const resolveImportsAndBindings = async (code, builtins, visitedStack = []) => {
        const { imports, rest } = parseLeadingImports(code);
        const bindings = {};
        for (const imp of imports) {
            const isLib = isLibrarySpecifier(imp.source);
            let resolvedPath;
            if (isLib) {
                resolvedPath = libMapRef.current[imp.source];
                if (!resolvedPath) {
                    throw new Error(`cannot resolve library '${imp.source}': not registered with libman (see 'libman add')`);
                }
            } else {
                resolvedPath = resolvePath(cwdRef.current, imp.source);
            }
            const mod = await loadUselessModule(resolvedPath, builtins, visitedStack);
            if (isLib) {
                // Library-name imports always bind the whole namespace to an
                // identifier matching the library's name, regardless of
                // whether `{ x }` or default form was written (§12.2).
                bindings[imp.source] = mod.namespace;
            } else if (imp.form === "named") {
                for (const n of imp.names) bindings[n] = mod.namespace[n];
            } else {
                bindings[imp.localName] = mod.namespace;
            }
        }
        return { bindings, rest };
    };

    const execute = async (command) => {
        const result = await runCommandLine(String(command), { silent: true });
        return { stdout: result.stdout, stderr: result.stderr, exitCode: result.exitCode };
    };

    const runUselessFile = async (node, argv, opts = {}) => {
        const code = node.content || "";
        const argc = argv.length;
        const isBackground = Boolean(opts.background) || /\/\/\s*DEFINE\s+<BACKPROCESS>/i.test(code.split(/\r?\n/)[0] || "");
        const startLabel = isBackground ? "starting background process" : "running";
        const programName = argv[0] || "program";
        const pid = generatePid();
        const selfPath = opts.filePath || null;

        if (opts.fromBoot && !isBackground) {
            setOutput((o) => [...o, { kind: "line", text: `Starting ${programName}...`, cls: "accent" }]);
        }

        const executeProgram = async () => {
            inProgramExecutionRef.current = true;
            if (!isBackground) foregroundPidRef.current = pid;
            signalHandlersRef.current.set(pid, new Map());

            // Whether this program has an open screen-buffer session that hasn't
            // been closed yet. If main() returns while this is still true (e.g.
            // it scheduled bufferscreenexitprogramservices() inside a
            // setTimeout/event handler), the program is NOT finished — we hold
            // execution open until the exit call actually happens.
            let screenActive = false;
            let mainHasReturned = false;
            let settled = false;
            let exitCode = 0;
            let resolveScreenSession;
            const screenSessionPromise = new Promise((resolve) => {
                resolveScreenSession = resolve;
            });

            const terminateProgram = (code = 0) => {
                exitCode = code;
                const el = document.getElementById("screen");
                if (el) el.remove();
                setScreenBufferActive(false);
                setAwaitingProgramInput(false);
                screenActive = false;
                if (!settled) {
                    settled = true;
                    resolveScreenSession();
                }
                // If we're still inside main()'s own synchronous (or awaited)
                // execution path, unwind the rest of the script. If this is
                // called later (setTimeout, event handler, SIGINT handler,
                // etc. after main() already returned), there's nothing
                // meaningful left to unwind — just resolve the pending
                // session promise above so executeProgram() can finish.
                if (!mainHasReturned) {
                    throw { __exitUselessProgram: true };
                }
            };

            forceCloseRef.current.set(pid, () => terminateProgram(0));

            const localBufferscreenclear = () => {
                screenActive = true;
                return bufferscreenclear();
            };

            const localExit = () => terminateProgram(0);
            const localScanf = (promptLabel) => scanf(promptLabel, pid);
            const localSleep = (ms) => sleepImpl(ms, pid);
            const localSignal = (name, handler) => {
                const map = signalHandlersRef.current.get(pid) || new Map();
                map.set(name, handler);
                signalHandlersRef.current.set(pid, map);
            };
            const procObj = {
                pid,
                argv,
                exit: (code = 0) => terminateProgram(code),
                kill: (targetPid, signalName = "SIGINT") => deliverSignal(Number(targetPid), signalName),
            };

            const builtins = {
                printf,
                scanf: localScanf,
                execute,
                bufferscreenclear: localBufferscreenclear,
                bufferscreenexitprogramservices: localExit,
                sleep: localSleep,
                signal: localSignal,
                process: procObj,
                getenv,
                setenv,
                unsetenv,
                readFile: apiReadFile,
                writeFile: apiWriteFile,
                appendFile: apiAppendFile,
                exists: apiExists,
                mkdir: apiMkdir,
                remove: apiRemove,
                listDir: apiListDir,
            };

            try {
                const { bindings, rest } = await resolveImportsAndBindings(code, builtins, selfPath ? [selfPath] : []);
                const fnBody = `${stripExportKeyword(rest)}
;return (async () => {
  if (typeof main !== "function") {
    throw new Error("main: not defined. Define 'function main(argc, argv) { ... }' in your .useless file.");
  }
  return await main(argc, argv);
})();`;
                const builtinNames = Object.keys(builtins);
                const bindingNames = Object.keys(bindings);
                // eslint-disable-next-line no-new-func
                const runner = new Function(...builtinNames, "argc", "argv", ...bindingNames, fnBody);
                await runner(
                    ...builtinNames.map((n) => builtins[n]),
                    argc,
                    argv,
                    ...bindingNames.map((n) => bindings[n])
                );
                mainHasReturned = true;

                // main() returned but a screen session is still open — the
                // program is waiting on something async (timer, listener) to
                // eventually call bufferscreenexitprogramservices(). Keep the
                // process alive until that happens.
                if (screenActive) {
                    await screenSessionPromise;
                }
            } catch (e) {
                if (!(e && e.__exitUselessProgram)) {
                    setOutput((o) => [
                        ...o,
                        { kind: "line", text: `Segmentation fault (core dumped) — ${programName}`, cls: "err" },
                        { kind: "line", text: `  ${e && e.message ? e.message : String(e)}`, cls: "err" },
                    ]);
                } else if (exitCode) {
                    setOutput((o) => [
                        ...o,
                        { kind: "line", text: `${programName}: exited with code ${exitCode}`, cls: "err" },
                    ]);
                }
            } finally {
                inProgramExecutionRef.current = false;
                const el = document.getElementById("screen");
                if (el) el.remove();
                setScreenBufferActive(false);
                setAwaitingProgramInput(false);
                signalHandlersRef.current.delete(pid);
                pendingInterruptRef.current.delete(pid);
                forceCloseRef.current.delete(pid);
                if (foregroundPidRef.current === pid) foregroundPidRef.current = null;
                return exitCode;
            }
        };

        if (isBackground) {
            const proc = spawnBackgroundProcess({
                pid,
                name: programName,
                runner: executeProgram,
            });
            setOutput((o) => [...o, { kind: "line", text: `${startLabel} '${programName}' [pid ${proc.id}]`, cls: "accent" }]);
            return proc;
        }

        setOutput((o) => [...o, { kind: "line", text: `${startLabel} '${programName}'`, cls: "accent" }]);
        await executeProgram();
        return null;
    };

    const runServiceByPath = async (path, argv, opts = {}) => {
        const node = getNode(fsRef.current, path);
        if (!node || node.type !== "file") {
            setOutput((o) => [...o, { kind: "line", text: `boot: '${path}' not found, skipping`, cls: "err" }]);
            return;
        }
        await runUselessFile(node, argv, { ...opts, filePath: path });
    };

    // Builds the {stdout, stderr, exitCode} result object execute() (§4.3)
    // promises. stdout is every non-error line, stderr is every line marked
    // with cls "err"; exitCode defaults to 1 whenever anything landed on
    // stderr and wasn't explicitly overridden (e.g. exitCode: 0 for a
    // successful program dispatch that merely happened to print nothing).
    const buildExecResult = (lines, extra = {}) => {
        const stdout = lines
            .filter((l) => l.cls !== "err")
            .map((l) => (l.kind === "ls" ? l.items.map((it) => it.name).join(" ") : l.text))
            .join("\n");
        const stderr = lines
            .filter((l) => l.cls === "err")
            .map((l) => l.text)
            .join("\n");
        const exitCode = extra.exitCode !== undefined ? extra.exitCode : stderr ? 1 : 0;
        return { plainText: stdout, stdout, stderr, exitCode };
    };

    // ---- core command interpreter (used by shell AND execute()) ----
    const runCommandLine = async (raw, opts = {}) => {
        const silent = !!opts.silent;
        const trimmed = raw.trim();
        const promptLine = { kind: "cmd", cwd: displayPath(cwdRef.current), text: raw };

        if (!trimmed) {
            if (!silent) pushTermLines([promptLine]);
            return buildExecResult([]);
        }

        // special literal syntax: addition towards PATH "x.useless" as "alias"
        const additionMatch = trimmed.match(/^addition\s+towards\s+PATH\s+"([^"]+)"\s+as\s+"([^"]+)"$/i);
        if (additionMatch) {
            const [, filePath, aliasName] = additionMatch;
            const target = resolvePath(cwdRef.current, filePath);
            const node = getNode(fsRef.current, target);
            const lines = [];
            if (!node) lines.push({ kind: "line", text: `addition: '${filePath}' does not exist`, cls: "err" });
            else {
                const nextMap = { ...pathMapRef.current, [aliasName]: target };
                setPathMapBoth(nextMap);
                lines.push({ kind: "line", text: `Added '${aliasName}' -> ${target} to PATH` });
            }
            if (!silent) pushTermLines([promptLine, ...lines]);
            setHistory((h) => [...h, raw]);
            historyRef.current = [...historyRef.current, raw];
            return buildExecResult(lines);
        }

        const tokens = trimmed.split(/\s+/);
        const name = tokens[0];
        const args = tokens.slice(1);

        let fsWorking = clone(fsRef.current);
        let pathMapWorking = { ...pathMapRef.current };
        let libMapWorking = { ...libMapRef.current };
        let bootServicesWorking = clone(bootServicesRef.current);
        let newCwd = cwdRef.current;
        let lines = [];
        let clearScreenFlag = false;
        let didRunProgram = false;

        const err = (msg) => lines.push({ kind: "line", text: msg, cls: "err" });
        const listFlagsAndPaths = (arr) => {
            const flags = arr.filter((a) => a.startsWith("-"));
            const paths = arr.filter((a) => !a.startsWith("-"));
            return { flags: flags.join(""), paths };
        };

        // ---- executable dispatch: ./file, /abs/path, or PATH alias ----
        let runTarget = null;
        if (name.startsWith("./") || name.startsWith("/")) {
            runTarget = resolvePath(cwdRef.current, name);
        } else if (pathMapWorking[name]) {
            runTarget = pathMapWorking[name];
        }

        if (runTarget !== null) {
            const node = getNode(fsWorking, runTarget);
            if (!node) err(`${name}: no such file or directory`);
            else if (node.type !== "file") err(`${name}: is a directory`);
            else if (!node.executable) err(`${name}: permission denied (try: chmod +x ${name})`);
            else if (!runTarget.endsWith(".useless")) err(`${name}: cannot execute binary file`);
            else {
                if (!silent) pushTermLines([promptLine]);
                setHistory((h) => [...h, raw]);
                historyRef.current = [...historyRef.current, raw];
                await runUselessFile(node, [name, ...args], { background: false, filePath: runTarget });
                didRunProgram = true;
            }
            if (!didRunProgram) {
                if (!silent) pushTermLines([promptLine, ...lines]);
                setHistory((h) => [...h, raw]);
                historyRef.current = [...historyRef.current, raw];
            }
            return buildExecResult(didRunProgram ? [] : lines);
        }

        switch (name) {
            case "help":
                lines = HELP_TEXT.map((t) => ({ kind: "line", text: t }));
                break;

            case "pickup": {
                const pid = args[0];
                if (args[0] === "-pid" && args[1]) {
                    await pickupProcess(args[1]);
                } else if (pid) {
                    await pickupProcess(pid);
                } else {
                    err("pickup: usage: pickup -pid <processid>");
                }
                break;
            }

            case "pwd":
                lines.push({ kind: "line", text: cwdRef.current });
                break;

            case "ls": {
                const { flags, paths } = listFlagsAndPaths(args);
                const target = paths[0] ? resolvePath(cwdRef.current, paths[0]) : cwdRef.current;
                const node = getNode(fsWorking, target);
                if (!node) err(`ls: cannot access '${paths[0] || target}': No such file or directory`);
                else if (node.type === "file") lines.push({ kind: "line", text: paths[0] });
                else {
                    const names = Object.keys(node.children).sort();
                    const items = names
                        .filter((n) => flags.includes("a") || !n.startsWith("."))
                        .map((n) => ({
                            name:
                                n +
                                (node.children[n].type === "dir" ? "/" : node.children[n].executable ? "*" : ""),
                            cls: node.children[n].type === "dir" ? "dir" : "file",
                        }));
                    if (items.length) lines.push({ kind: "ls", items });
                }
                break;
            }

            case "cd": {
                const target = resolvePath(cwdRef.current, args[0] || "~");
                const node = getNode(fsWorking, target);
                if (!node) err(`cd: no such file or directory: ${args[0] || "~"}`);
                else if (node.type !== "dir") err(`cd: not a directory: ${args[0]}`);
                else newCwd = target;
                break;
            }

            case "mkdir": {
                const { flags, paths } = listFlagsAndPaths(args);
                if (!paths.length) err("mkdir: missing operand");
                for (const p of paths) {
                    const target = resolvePath(cwdRef.current, p);
                    const { parent, name: n } = getParent(fsWorking, target);
                    if (!parent || parent.type !== "dir") {
                        if (flags.includes("p")) {
                            try {
                                ensureDir(fsWorking, target);
                            } catch (e) {
                                err(`mkdir: cannot create directory '${p}': ${e.message}`);
                            }
                        } else {
                            err(`mkdir: cannot create directory '${p}': No such file or directory`);
                        }
                    } else if (parent.children[n]) {
                        err(`mkdir: cannot create directory '${p}': File exists`);
                    } else {
                        parent.children[n] = { type: "dir", children: {} };
                    }
                }
                break;
            }

            case "touch": {
                if (!args.length) err("touch: missing operand");
                for (const p of args) {
                    const target = resolvePath(cwdRef.current, p);
                    const { parent, name: n } = getParent(fsWorking, target);
                    if (!parent) err(`touch: cannot touch '${p}': No such file or directory`);
                    else if (!parent.children[n]) parent.children[n] = { type: "file", content: "", executable: false };
                }
                break;
            }

            case "cat": {
                if (!args.length) err("cat: missing operand");
                for (const p of args) {
                    const node = getNode(fsWorking, resolvePath(cwdRef.current, p));
                    if (!node) err(`cat: ${p}: No such file or directory`);
                    else if (node.type === "dir") err(`cat: ${p}: Is a directory`);
                    else (node.content || "").split("\n").forEach((l) => lines.push({ kind: "line", text: l }));
                }
                break;
            }

            case "echo": {
                const gtIdx = args.indexOf(">");
                const gtgtIdx = args.indexOf(">>");
                if (gtIdx !== -1 || gtgtIdx !== -1) {
                    const append = gtgtIdx !== -1;
                    const idx = append ? gtgtIdx : gtIdx;
                    const text = args.slice(0, idx).join(" ");
                    const fileArg = args[idx + 1];
                    if (!fileArg) {
                        err("echo: syntax error: missing file after redirect");
                        break;
                    }
                    const target = resolvePath(cwdRef.current, fileArg);
                    const { parent, name: n } = getParent(fsWorking, target);
                    if (!parent) err(`echo: ${fileArg}: No such file or directory`);
                    else {
                        const existing = parent.children[n];
                        const prevContent = append && existing?.type === "file" ? existing.content : "";
                        parent.children[n] = {
                            type: "file",
                            content: prevContent + (prevContent ? "\n" : "") + text,
                            executable: existing?.executable || false,
                        };
                    }
                } else {
                    lines.push({ kind: "line", text: args.join(" ") });
                }
                break;
            }

            case "rm": {
                const { flags, paths } = listFlagsAndPaths(args);
                const isRoot = paths.some((p) => {
                    const resolved = resolvePath(cwdRef.current, p.replace(/\*$/, ""));
                    return resolved === "/" || p === "/" || p === "/*" || p === "--no-preserve-root";
                });
                if (flags.includes("r") && flags.includes("f") && isRoot) {
                    if (!silent) pushTermLines([promptLine]);
                    setHistory((h) => [...h, raw]);
                    historyRef.current = [...historyRef.current, raw];
                    triggerCrash();
                    return buildExecResult([]);
                }
                if (!paths.length) err("rm: missing operand");
                for (const p of paths) {
                    const target = resolvePath(cwdRef.current, p);
                    const { parent, name: n } = getParent(fsWorking, target);
                    const node = parent && parent.children[n];
                    if (!node) err(`rm: cannot remove '${p}': No such file or directory`);
                    else if (node.type === "dir" && !flags.includes("r") && Object.keys(node.children).length)
                        err(`rm: cannot remove '${p}': Is a directory (use -r)`);
                    else delete parent.children[n];
                }
                break;
            }

            case "rmdir": {
                if (!args.length) err("rmdir: missing operand");
                for (const p of args) {
                    const target = resolvePath(cwdRef.current, p);
                    const { parent, name: n } = getParent(fsWorking, target);
                    const node = parent && parent.children[n];
                    if (!node || node.type !== "dir") err(`rmdir: failed to remove '${p}': Not a directory`);
                    else if (Object.keys(node.children).length) err(`rmdir: failed to remove '${p}': Directory not empty`);
                    else delete parent.children[n];
                }
                break;
            }

            case "mv":
            case "cp": {
                if (args.length < 2) {
                    err(`${name}: missing destination operand`);
                    break;
                }
                const srcPath = resolvePath(cwdRef.current, args[0]);
                const dstPath = resolvePath(cwdRef.current, args[1]);
                const srcNode = getNode(fsWorking, srcPath);
                if (!srcNode) {
                    err(`${name}: cannot stat '${args[0]}': No such file or directory`);
                    break;
                }
                let { parent: dstParent, name: dstName } = getParent(fsWorking, dstPath);
                const dstNodeExisting = getNode(fsWorking, dstPath);
                if (dstNodeExisting && dstNodeExisting.type === "dir") {
                    dstParent = dstNodeExisting;
                    dstName = args[0].split("/").pop();
                }
                if (!dstParent) {
                    err(`${name}: cannot create '${args[1]}': No such file or directory`);
                    break;
                }
                dstParent.children[dstName] = clone(srcNode);
                if (name === "mv") {
                    const { parent: srcParent, name: srcName } = getParent(fsWorking, srcPath);
                    if (srcParent) delete srcParent.children[srcName];
                }
                break;
            }

            case "download": {
                const url = args[0];
                if (!url) {
                    err("download: missing URL");
                    break;
                }
                try {
                    const res = await fetch(url);
                    if (!res.ok) throw new Error(`HTTP ${res.status}`);
                    const text = await res.text();
                    const filename = url.split("/").filter(Boolean).pop() || "downloaded_file";
                    const target = resolvePath(cwdRef.current, filename);
                    const { parent, name: n } = getParent(fsWorking, target);
                    if (!parent) {
                        err("download: cannot write to current directory");
                        break;
                    }
                    parent.children[n] = { type: "file", content: text, executable: false };
                    lines.push({ kind: "line", text: `Downloaded '${filename}' (${text.length} bytes) to ${displayPath(cwdRef.current)}` });
                } catch (e) {
                    err(`download: failed to fetch '${url}': ${e.message} (CORS or network restriction may apply)`);
                }
                break;
            }

            case "chmod": {
                const flag = args[0];
                const file = args[1];
                if (!flag || !file) {
                    err("chmod: usage: chmod +x <file>");
                    break;
                }
                const target = resolvePath(cwdRef.current, file);
                const node = getNode(fsWorking, target);
                if (!node) err(`chmod: cannot access '${file}': No such file or directory`);
                else if (node.type !== "file") err(`chmod: ${file}: not a regular file`);
                else if (flag === "+x") {
                    node.executable = true;
                    lines.push({ kind: "line", text: `'${file}' is now executable` });
                } else if (flag === "-x") {
                    node.executable = false;
                    lines.push({ kind: "line", text: `'${file}' is no longer executable` });
                } else err(`chmod: unrecognized flag '${flag}'`);
                break;
            }

            case "libman": {
                const sub = args[0];
                if (!sub || sub === "list") {
                    const entries = Object.entries(libMapWorking);
                    if (!entries.length) lines.push({ kind: "line", text: "No libraries registered." });
                    else {
                        lines.push({ kind: "line", text: "NAME            PATH" });
                        entries.forEach(([n, p]) => lines.push({ kind: "line", text: `${n.padEnd(16)}${p}` }));
                    }
                } else if (sub === "add") {
                    const libName = args[1];
                    const libPath = args[2];
                    if (!libName || !libPath) {
                        err("libman add: usage: libman add <name> <path>");
                        break;
                    }
                    const target = resolvePath(cwdRef.current, libPath);
                    if (!getNode(fsWorking, target)) {
                        err(`libman add: '${libPath}' does not exist`);
                        break;
                    }
                    libMapWorking = { ...libMapWorking, [libName]: target };
                    lines.push({ kind: "line", text: `Registered library '${libName}' -> ${target}` });
                } else if (sub === "remove") {
                    const libName = args[1];
                    if (libMapWorking[libName]) {
                        const next = { ...libMapWorking };
                        delete next[libName];
                        libMapWorking = next;
                        lines.push({ kind: "line", text: `Removed library '${libName}'` });
                    } else err(`libman remove: no such library '${libName}'`);
                } else if (sub === "path") {
                    const libName = args[1];
                    if (libMapWorking[libName]) lines.push({ kind: "line", text: libMapWorking[libName] });
                    else err(`libman path: no such library '${libName}'`);
                } else {
                    err(`libman: unknown subcommand '${sub}'`);
                }
                break;
            }

            case "onbootservices": {
                const sub = args[0];
                if (!sub || sub === "list") {
                    if (!bootServicesWorking.length) {
                        lines.push({ kind: "line", text: "No boot services registered." });
                    } else {
                        lines.push({ kind: "line", text: "NAME            PATH                              STATUS" });
                        bootServicesWorking.forEach((s) => {
                            const status = !s.enabled ? "disabled" : s.paused ? "paused" : "enabled";
                            lines.push({
                                kind: "line",
                                text: `${s.name.padEnd(16)}${s.path.padEnd(34)}${status}`,
                            });
                        });
                    }
                } else if (sub === "add") {
                    const svcName = args[1];
                    const svcPath = args[2];
                    if (!svcName || !svcPath) {
                        err("onbootservices add: usage: onbootservices add <name> <path>");
                        break;
                    }
                    const target = resolvePath(cwdRef.current, svcPath);
                    if (!getNode(fsWorking, target)) {
                        err(`onbootservices add: '${svcPath}' does not exist`);
                        break;
                    }
                    bootServicesWorking = bootServicesWorking.filter((s) => s.name !== svcName);
                    bootServicesWorking.push({ name: svcName, path: target, enabled: true, paused: false });
                    lines.push({ kind: "line", text: `Registered boot service '${svcName}' -> ${target}` });
                } else if (sub === "start" || sub === "restart") {
                    const svcName = args[1];
                    const svc = bootServicesWorking.find((s) => s.name === svcName);
                    if (!svc) {
                        err(`onbootservices ${sub}: no such service '${svcName}'`);
                        break;
                    }
                    svc.enabled = true;
                    svc.paused = false;
                    lines.push({ kind: "line", text: `Service '${svcName}' ${sub === "start" ? "started" : "restarted"}. Running now...` });
                    setFsBoth(fsWorking);
                    setBootServicesBoth(bootServicesWorking);
                    if (!silent) pushTermLines([promptLine, ...lines]);
                    setHistory((h) => [...h, raw]);
                    historyRef.current = [...historyRef.current, raw];
                    await runServiceByPath(svc.path, [svcName]);
                    return buildExecResult(lines);
                } else if (sub === "pause") {
                    const svcName = args[1];
                    const svc = bootServicesWorking.find((s) => s.name === svcName);
                    if (!svc) err(`onbootservices pause: no such service '${svcName}'`);
                    else {
                        svc.paused = true;
                        lines.push({ kind: "line", text: `Service '${svcName}' paused (will not run at next boot)` });
                    }
                } else if (sub === "remove") {
                    const svcName = args[1];
                    const before = bootServicesWorking.length;
                    bootServicesWorking = bootServicesWorking.filter((s) => s.name !== svcName);
                    lines.push({
                        kind: "line",
                        text: bootServicesWorking.length < before ? `Removed service '${svcName}'` : `No such service '${svcName}'`,
                        cls: bootServicesWorking.length < before ? undefined : "err",
                    });
                } else if (sub === "reset") {
                    bootServicesWorking = [];
                    lines.push({ kind: "line", text: "All boot services cleared." });
                } else {
                    err(`onbootservices: unknown subcommand '${sub}'`);
                }
                break;
            }

            case "backup": {
                const sub = args[0];
                if (sub === "save") {
                    const text = buildBackup(fsWorking, pathMapWorking, bootServicesWorking, libMapWorking);
                    const blob = new Blob([text], { type: "application/octet-stream" });
                    const a = document.createElement("a");
                    const ts = new Date().toISOString().replace(/[:.]/g, "-");
                    a.href = URL.createObjectURL(blob);
                    a.download = `uselessos-backup-${ts}.bak`;
                    document.body.appendChild(a);
                    a.click();
                    a.remove();
                    lines.push({ kind: "line", text: "Backup downloaded. Check your downloads folder." });
                } else if (sub === "load") {
                    if (fileInputRef.current) fileInputRef.current.click();
                    lines.push({ kind: "line", text: "Opening file picker to load a .bak file..." });
                } else {
                    err("backup: usage: backup save | backup load");
                }
                break;
            }

            case "ps":
                if (!processes.length) lines.push({ kind: "line", text: "No background processes." });
                else {
                    lines.push({ kind: "line", text: "PID  COMMAND" });
                    processes.forEach((p) => lines.push({ kind: "line", text: `${p.id}  ${p.name}` }));
                }
                break;

            case "clear":
                clearScreenFlag = true;
                break;

            case "history":
                historyRef.current.forEach((h, i2) => lines.push({ kind: "line", text: `  ${i2 + 1}  ${h}` }));
                break;

            case "whoami":
                lines.push({ kind: "line", text: "user" });
                break;

            case "hostname":
                lines.push({ kind: "line", text: "uselessos" });
                break;

            case "uname":
                lines.push({
                    kind: "line",
                    text: args.includes("-a")
                        ? "UselessOS 0.9.3 uselessos x86_fake JS-Kernel/localStorage"
                        : "UselessOS",
                });
                break;

            case "date":
                lines.push({ kind: "line", text: new Date().toString() });
                break;

            case "df": {
                const used = diskUsageBytes(fsWorking);
                const total = 5 * 1024 * 1024;
                const pct = Math.min(100, Math.round((used / total) * 100));
                const barLen = 24;
                const filled = Math.round((pct / 100) * barLen);
                const bar = "#".repeat(filled) + "-".repeat(barLen - filled);
                lines.push({ kind: "line", text: "Filesystem      Size  Used  Avail  Use%" });
                lines.push({
                    kind: "line",
                    text: `/dev/disk0      5.0M  ${(used / 1024).toFixed(1)}K  ${((total - used) / 1024).toFixed(
                        1
                    )}K   [${bar}] ${pct}%`,
                });
                break;
            }

            case "neofetch": {
                const used = (diskUsageBytes(fsWorking) / 1024).toFixed(1);
                const uptimeSec = Math.floor((Date.now() - bootTime.current) / 1000);
                const info = [
                    "user@uselessos",
                    "--------------",
                    "OS: UselessOS 0.9.3",
                    "Kernel: JS-Kernel/localStorage",
                    "Shell: fakesh 1.0",
                    `Uptime: ${uptimeSec}s`,
                    `Disk: ${used}K / 5.0M`,
                    `Services: ${bootServicesWorking.length}`,
                ];
                const logo = asciiLogo();
                const maxLen = Math.max(...logo.map((l) => l.length));
                for (let i2 = 0; i2 < Math.max(logo.length, info.length); i2++) {
                    const l = (logo[i2] || "").padEnd(maxLen + 3, " ");
                    lines.push({ kind: "line", text: l + (info[i2] || ""), cls: "accent" });
                }
                break;
            }

            case "reboot":
                lines.push({ kind: "line", text: "Rebooting..." });
                setFsBoth(fsWorking);
                if (!silent) pushTermLines([promptLine, ...lines]);
                setHistory((h) => [...h, raw]);
                historyRef.current = [...historyRef.current, raw];
                await wait(400);
                if (typeof onReboot === "function") {
                    onReboot();
                } else {
                    runBoot();
                }
                return buildExecResult(lines);

            case "shutdown":
                lines.push({ kind: "line", text: "Shutting down..." });
                setFsBoth(fsWorking);
                if (!silent) pushTermLines([promptLine, ...lines]);
                setHistory((h) => [...h, raw]);
                historyRef.current = [...historyRef.current, raw];
                await wait(400);
                setTimeout(() => {
                    window.electronAPI.shutdown();
                }, 1000)
                return buildExecResult(lines);

            case "reset":
                if (args[0] === "--confirm") {
                    fsWorking = wipeDisk();
                    newCwd = "/home/user";
                    lines.push({ kind: "line", text: "Disk image wiped. Filesystem reinitialized." });
                } else {
                    lines.push({
                        kind: "line",
                        text: "This will erase the entire disk image. Run 'reset --confirm' to proceed.",
                        cls: "err",
                    });
                }
                break;

            case "man": {
                const target = HELP_TEXT.find((l) => l.trim().startsWith(args[0]));
                lines.push({ kind: "line", text: target ? target.trim() : `No manual entry for ${args[0] || ""}` });
                break;
            }

            default:
                err(`${name}: command not found`);
        }

        setFsBoth(fsWorking);
        setCwdBoth(newCwd);
        setPathMapBoth(pathMapWorking);
        setLibMapBoth(libMapWorking);
        setBootServicesBoth(bootServicesWorking);
        setHistory((h) => [...h, raw]);
        historyRef.current = [...historyRef.current, raw];
        setHistIndex(null);

        if (!silent) {
            if (clearScreenFlag) setOutput([]);
            else pushTermLines([promptLine, ...lines]);
        }

        return buildExecResult(lines);
    };

    // Shared submit logic for both the terminal input row and the in-overlay
    // scanf input row.
    const submitAwaitingInput = () => {
        const val = input;
        if (!screenBufferActiveRef.current) {
            setOutput((o) => [...o, { kind: "line", text: `> ${val}` }]);
        }
        setInput("");
        setAwaitingProgramInput(false);
        setScanfPromptLabel("");
        const resolve = awaitingInputResolveRef.current;
        awaitingInputResolveRef.current = null;
        if (resolve) resolve(val);
    };

    // Ctrl+C: deliver SIGINT to whichever program is currently in the
    // foreground (§9.1). Handled here (rather than a global keydown
    // listener) since these are the two input rows that stay focused while
    // a foreground program is running or awaiting input.
    const handlePossibleSigint = (e) => {
        if (e.ctrlKey && (e.key === "c" || e.key === "C")) {
            e.preventDefault();
            if (foregroundPidRef.current !== null) {
                deliverSignal(foregroundPidRef.current, "SIGINT");
            }
            return true;
        }
        return false;
    };

    const onKeyDown = (e) => {
        if (handlePossibleSigint(e)) return;
        if (e.key === "Enter") {
            if (awaitingProgramInput) {
                submitAwaitingInput();
                return;
            }
            const raw = input;
            setInput("");
            runCommandLine(raw);
        } else if (e.key === "ArrowUp" && !awaitingProgramInput) {
            e.preventDefault();
            const h = historyRef.current;
            if (!h.length) return;
            const idx = histIndex === null ? h.length - 1 : Math.max(0, histIndex - 1);
            setHistIndex(idx);
            setInput(h[idx]);
        } else if (e.key === "ArrowDown" && !awaitingProgramInput) {
            e.preventDefault();
            const h = historyRef.current;
            if (histIndex === null) return;
            const idx = histIndex + 1;
            if (idx >= h.length) {
                setHistIndex(null);
                setInput("");
            } else {
                setHistIndex(idx);
                setInput(h[idx]);
            }
        }
    };

    // Enter key handler for the floating input rendered inside the
    // bufferscreenclear() overlay while a program is waiting on scanf().
    const onScreenInputKeyDown = (e) => {
        if (handlePossibleSigint(e)) return;
        if (e.key === "Enter") {
            e.preventDefault();
            submitAwaitingInput();
        }
    };

    const onBackupFileSelected = async (e) => {
        const file = e.target.files && e.target.files[0];
        e.target.value = "";
        if (!file) return;
        try {
            const text = await file.text();
            const { fs: restoredFs, pathMap: restoredPathMap, bootServices: restoredBootServices, libMap: restoredLibMap } = parseBackup(text);
            saveDisk(restoredFs);
            savePathMap(restoredPathMap);
            saveBootServices(restoredBootServices);
            saveLibMap(restoredLibMap);
            setOutput((o) => [...o, { kind: "line", text: `Restored backup from '${file.name}'. Rebooting...` }]);
            await wait(500);
            runBoot();
        } catch (err) {
            setOutput((o) => [...o, { kind: "line", text: `backup load: ${err.message}`, cls: "err" }]);
        }
    };

    const totalScreens = crashScreens.length;
    const isLastCrashScreen = crashScreenIdx >= totalScreens - 1;
    const currentScreenLines = crashScreens[crashScreenIdx] || [];

    return (
        <div className="term-screen" onClick={focusInput}>
            <input
                ref={fileInputRef}
                type="file"
                accept=".bak"
                style={{ display: "none" }}
                onChange={onBackupFileSelected}
            />

            <div className="term-body" ref={outputRef}>
                {!booted &&
                    bootedLines.map((l, i) => (
                        <div key={i} className="boot-line">
                            {l}
                        </div>
                    ))}

                {booted &&
                    output.map((line, i) => {
                        if (line.kind === "cmd") {
                            return (
                                <div key={i} className="term-line">
                                    <span className="prompt">
                                        <span className="prompt-user">user@uselessos</span>
                                        <span className="prompt-sep">:</span>
                                        <span className="prompt-path">{line.cwd}</span>
                                        <span className="prompt-dollar">$</span>
                                    </span>{" "}
                                    <span>{line.text}</span>
                                </div>
                            );
                        }
                        if (line.kind === "ls") {
                            return (
                                <div key={i} className="term-line ls-row">
                                    {line.items.map((it, j) => (
                                        <span key={j} className={`ls-item ${it.cls}`}>
                                            {it.name}
                                        </span>
                                    ))}
                                </div>
                            );
                        }
                        return (
                            <div key={i} className={`term-line ${line.cls || ""}`}>
                                {line.text || "\u00A0"}
                            </div>
                        );
                    })}

                {booted && !crashState && !screenBufferActive && (
                    <div className="term-line input-row">
                        {
                            awaitingProgramInput ? <></> : <span className="prompt">
                                <span className="prompt-user">user@UselessOS</span>
                                <span className="prompt-sep">:</span>
                                <span className="prompt-path">{displayPath(cwd)}</span>
                                <span className="prompt-dollar">$</span>
                            </span>
                        }
                        <input
                            ref={inputRef}
                            className="term-input"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={onKeyDown}
                            autoFocus
                            spellCheck={false}
                            autoComplete="off"
                        />
                    </div>
                )}
            </div>

            {/*
              Floating scanf() input bar for programs running inside a
              bufferscreenclear() overlay. The overlay itself is raw DOM
              (created by bufferscreenclear via document.createElement), so
              this React-rendered bar sits on top of it at a higher z-index
              and is only shown while that program is actually awaiting input.
            */}
            {booted && !crashState && screenBufferActive && awaitingProgramInput && (
                <div className="screen-scanf-bar">
                    {scanfPromptLabel ? <span className="screen-scanf-label">{scanfPromptLabel}</span> : null}
                    <input
                        ref={screenInputRef}
                        className="screen-scanf-input"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={onScreenInputKeyDown}
                        autoFocus
                        spellCheck={false}
                        autoComplete="off"
                    />
                </div>
            )}

            {crashState && (
                <div className={`crash-overlay ${crashState}`}>
                    {crashState === "panicking" && totalScreens > 0 && (
                        <div className="crash-screen-label">
                            PANIC SCREEN {crashScreenIdx + 1} / {totalScreens}
                        </div>
                    )}
                    <div className="crash-lines">
                        {currentScreenLines.slice(0, crashLines.length).map((l, i) => (
                            <div
                                key={i}
                                className={
                                    l.startsWith("kernel:") ? "crash-kernel" : l.startsWith("rm:") ? "crash-rm" : "crash-line"
                                }
                            >
                                {l || "\u00A0"}
                            </div>
                        ))}
                    </div>
                    {crashState === "panicking" && isLastCrashScreen && crashLines.length >= currentScreenLines.length && (
                        <div className="crash-panic-box">
                            <div>*** KERNEL PANIC ***</div>
                            <div className="crash-panic-sub">System halted. Rebooting in a moment...</div>
                        </div>
                    )}
                    {crashState === "glitching" && <div className="crash-matrix" />}
                </div>
            )}
        </div>
    );
}
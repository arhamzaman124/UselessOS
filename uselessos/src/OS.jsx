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
    displayPath,
    loadPathMap,
    savePathMap,
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
    "  bufferscreenclear(), bufferscreenexitprogramservices(),",
    "  and function main(argc, argv) { ... } is your entry point.",
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

    const [crashState, setCrashState] = useState(null);
    const [crashScreens, setCrashScreens] = useState([]);
    const [crashScreenIdx, setCrashScreenIdx] = useState(0);
    const [crashLines, setCrashLines] = useState([]);
    const [bgProcessMessages, setBgProcessMessages] = useState([]);

    const bootTime = useRef(Date.now());
    const outputRef = useRef(null);
    const inputRef = useRef(null);
    const fileInputRef = useRef(null);

    // refs mirror state so async/nested command execution always reads fresh data
    const fsRef = useRef(null);
    const cwdRef = useRef("/home/user");
    const pathMapRef = useRef({});
    const bootServicesRef = useRef([]);
    const historyRef = useRef([]);
    const awaitingInputResolveRef = useRef(null);

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
    const setBootServicesBoth = (next) => {
        bootServicesRef.current = next;
        saveBootServices(next);
    };

    const pushTermLines = (lines) => {
        if (!lines.length) return;
        setOutput((o) => [...o, ...lines]);
    };

    const spawnBackgroundProcess = useCallback((proc) => {
        const nextId = Date.now() + Math.floor(Math.random() * 1000);
        const entry = { id: nextId, ...proc };
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
            await proc.runner();
        } catch (e) {
            setOutput((o) => [...o, { kind: "line", text: `process ${proc.id} exited with error: ${e.message || String(e)}`, cls: "err" }]);
        }
    }, [processes]);

    // ---- boot sequence ----
    const runBoot = useCallback(async () => {
        setBooted(false);
        setBootedLines([]);
        const { fs: loadedFs, isNew } = loadDisk();
        const loadedPathMap = loadPathMap();
        const loadedBootServices = loadBootServices();

        fsRef.current = loadedFs;
        cwdRef.current = "/home/user";
        pathMapRef.current = loadedPathMap;
        bootServicesRef.current = loadedBootServices;

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

    useEffect(() => {
        if (outputRef.current) outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }, [output, bootedLines]);

    const focusInput = () => {
        if (!crashState && !screenBufferActive && inputRef.current) inputRef.current.focus();
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

    const scanf = (promptLabel = "") => {
        return new Promise((resolve) => {
            if (promptLabel) setOutput((o) => [...o, { kind: "line", text: promptLabel }]);
            awaitingInputResolveRef.current = resolve;
            setAwaitingProgramInput(true);
        });
    };

    const bufferscreenclear = () => {
        let el = document.getElementById("screen");
        if (!el) {
            el = document.createElement("div");
            el.id = "screen";
            document.body.appendChild(el);
        }
        el.style.position = "fixed";
        el.style.inset = "0";
        el.style.zIndex = "500";
        el.style.background = "#000";
        el.style.color = "#0f0";
        el.style.fontFamily = "monospace";
        el.style.overflow = "auto";
        el.innerHTML = "";
        setScreenBufferActive(true);
        return el;
    };

    const bufferscreenexitprogramservices = () => {
        const el = document.getElementById("screen");
        if (el) el.remove();
        setScreenBufferActive(false);
        setAwaitingProgramInput(false);
        // sentinel thrown to unwind out of the running .useless program cleanly
        throw { __exitUselessProgram: true };
    };

    const execute = async (command) => {
        const result = await runCommandLine(String(command), { silent: true });
        return result.plainText;
    };

    const runUselessFile = async (node, argv, opts = {}) => {
        const code = node.content || "";
        const argc = argv.length;
        const isBackground = Boolean(opts.background) || /\/\/\s*DEFINE\s+<BACKPROCESS>/i.test(code.split(/\r?\n/)[0] || "");
        const startLabel = isBackground ? "starting background process" : "running";
        const programName = argv[0] || "program";

        if (opts.fromBoot && !isBackground) {
            setOutput((o) => [...o, { kind: "line", text: `Starting ${programName}...`, cls: "accent" }]);
        }

        const executeProgram = async () => {
            try {
                const fnBody = `${code}
;return (async () => {
  if (typeof main !== "function") {
    throw new Error("main: not defined. Define 'function main(argc, argv) { ... }' in your .useless file.");
  }
  return await main(argc, argv);
})();`;
                // eslint-disable-next-line no-new-func
                const runner = new Function(
                    "printf",
                    "scanf",
                    "execute",
                    "bufferscreenclear",
                    "bufferscreenexitprogramservices",
                    "argc",
                    "argv",
                    fnBody
                );
                await runner(printf, scanf, execute, bufferscreenclear, bufferscreenexitprogramservices, argc, argv);
            } catch (e) {
                if (!(e && e.__exitUselessProgram)) {
                    setOutput((o) => [
                        ...o,
                        { kind: "line", text: `Segmentation fault (core dumped) — ${programName}`, cls: "err" },
                        { kind: "line", text: `  ${e && e.message ? e.message : String(e)}`, cls: "err" },
                    ]);
                }
            } finally {
                const el = document.getElementById("screen");
                if (el) el.remove();
                setScreenBufferActive(false);
                setAwaitingProgramInput(false);
            }
        };

        if (isBackground) {
            const proc = spawnBackgroundProcess({
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
        await runUselessFile(node, argv, opts);
    };

    // ---- core command interpreter (used by shell AND execute()) ----
    const runCommandLine = async (raw, opts = {}) => {
        const silent = !!opts.silent;
        const trimmed = raw.trim();
        const promptLine = { kind: "cmd", cwd: displayPath(cwdRef.current), text: raw };

        if (!trimmed) {
            if (!silent) pushTermLines([promptLine]);
            return { plainText: "" };
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
            return { plainText: lines.map((l) => l.text).join("\n") };
        }

        const tokens = trimmed.split(/\s+/);
        const name = tokens[0];
        const args = tokens.slice(1);

        let fsWorking = clone(fsRef.current);
        let pathMapWorking = { ...pathMapRef.current };
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
                await runUselessFile(node, [name, ...args], { background: false });
                didRunProgram = true;
            }
            if (!didRunProgram) {
                if (!silent) pushTermLines([promptLine, ...lines]);
                setHistory((h) => [...h, raw]);
                historyRef.current = [...historyRef.current, raw];
            }
            return { plainText: didRunProgram ? "" : lines.map((l) => l.text).join("\n") };
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
                            const parts = target.split("/").filter(Boolean);
                            let cursor = fsWorking;
                            for (const part of parts) {
                                if (!cursor.children[part]) cursor.children[part] = { type: "dir", children: {} };
                                cursor = cursor.children[part];
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
                    return { plainText: "" };
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
                    return { plainText: lines.map((l) => l.text).join("\n") };
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
                    const text = buildBackup(fsWorking, pathMapWorking, bootServicesWorking);
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
                return { plainText: lines.map((l) => l.text).join("\n") };

            case "shutdown":
                lines.push({ kind: "line", text: "Shutting down..." });
                setFsBoth(fsWorking);
                if (!silent) pushTermLines([promptLine, ...lines]);
                setHistory((h) => [...h, raw]);
                historyRef.current = [...historyRef.current, raw];
                await wait(400);
                if (typeof window !== "undefined" && window.close) {
                    window.close();
                }
                if (typeof window !== "undefined" && window.location) {
                    window.location.href = "about:blank";
                }
                return { plainText: lines.map((l) => l.text).join("\n") };

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
        setBootServicesBoth(bootServicesWorking);
        setHistory((h) => [...h, raw]);
        historyRef.current = [...historyRef.current, raw];
        setHistIndex(null);

        const plainText = lines
            .map((l) => (l.kind === "ls" ? l.items.map((it) => it.name).join(" ") : l.text))
            .join("\n");

        if (!silent) {
            if (clearScreenFlag) setOutput([]);
            else pushTermLines([promptLine, ...lines]);
        }

        return { plainText };
    };

    const onKeyDown = (e) => {
        if (e.key === "Enter") {
            if (awaitingProgramInput) {
                const val = input;
                setOutput((o) => [...o, { kind: "line", text: `> ${val}` }]);
                setInput("");
                setAwaitingProgramInput(false);
                const resolve = awaitingInputResolveRef.current;
                awaitingInputResolveRef.current = null;
                if (resolve) resolve(val);
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

    const onBackupFileSelected = async (e) => {
        const file = e.target.files && e.target.files[0];
        e.target.value = "";
        if (!file) return;
        try {
            const text = await file.text();
            const { fs: restoredFs, pathMap: restoredPathMap, bootServices: restoredBootServices } = parseBackup(text);
            saveDisk(restoredFs);
            savePathMap(restoredPathMap);
            saveBootServices(restoredBootServices);
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
                        <span className="prompt">
                            <span className="prompt-user">user@uselessos</span>
                            <span className="prompt-sep">:</span>
                            <span className="prompt-path">{displayPath(cwd)}</span>
                            <span className="prompt-dollar">{awaitingProgramInput ? "?" : "$"}</span>
                        </span>
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
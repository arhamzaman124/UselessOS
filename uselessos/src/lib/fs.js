const DISK_KEY = "uselessos-disk-v1";
const PATH_KEY = "uselessos-pathmap-v1";
const BOOT_KEY = "uselessos-bootservices-v1";
const FS_MANIFEST_KEY = "uselessos-fs-manifest-v1";

const getNativeStorage = () => {
    if (typeof window !== "undefined" && window.electronAPI?.hasNativeStorage) {
        return window.electronAPI;
    }
    return null;
};

const readStoredValue = (key, fallback = null) => {
    const api = getNativeStorage();
    if (api?.readFile) {
        try {
            const value = api.readFile(key);
            return value === null || value === undefined ? fallback : value;
        } catch {
            // fall back to localStorage
        }
    }

    try {
        const raw = localStorage.getItem(key);
        return raw === null ? fallback : raw;
    } catch {
        return fallback;
    }
};

const writeStoredValue = (key, value) => {
    const api = getNativeStorage();
    if (api?.writeFile) {
        try {
            api.writeFile(key, value);
            return true;
        } catch {
            // fall back to localStorage
        }
    }

    try {
        localStorage.setItem(key, typeof value === "string" ? value : JSON.stringify(value));
        return true;
    } catch {
        return false;
    }
};

const removeStoredValue = (key) => {
    const api = getNativeStorage();
    if (api?.removeFile) {
        try {
            api.removeFile(key);
            return true;
        } catch {
            // fall back to localStorage
        }
    }

    try {
        localStorage.removeItem(key);
        return true;
    } catch {
        return false;
    }
};

const readStoredJSON = (key) => {
    const raw = readStoredValue(key, null);
    if (raw === null || raw === undefined) return null;
    if (typeof raw === "string") {
        try {
            return JSON.parse(raw);
        } catch {
            return raw;
        }
    }
    return raw;
};

const writeStoredJSON = (key, value) => writeStoredValue(key, JSON.stringify(value));
const removeStoredJSON = (key) => removeStoredValue(key);

const createNode = (type, extra = {}) => ({ type, ...extra });

const normalizePath = (path) => {
    if (!path || path === "/") return "/";
    return `/${path.split("/").filter(Boolean).join("/")}`;
};

const joinPath = (parent, child) => {
    const parentPath = normalizePath(parent);
    const childPath = normalizePath(child);
    if (childPath === "/") return parentPath;
    if (parentPath === "/") return childPath;
    return `${parentPath}/${childPath.replace(/^\//, "")}`;
};

const fileStorageKey = (path) => `fs-file:${encodeURIComponent(normalizePath(path))}`;

const defaultFS = () => {
    const root = createNode("dir", { children: {} });
    const manifest = {
        "/": { type: "dir", children: ["bin", "etc", "home", "var", "tmp"] },
        "/bin": { type: "dir", children: [] },
        "/etc": { type: "dir", children: ["motd"] },
        "/etc/motd": { type: "file" },
        "/home": { type: "dir", children: ["user"] },
        "/home/user": { type: "dir", children: ["readme.txt"] },
        "/home/user/readme.txt": { type: "file" },
        "/var": { type: "dir", children: ["log"] },
        "/var/log": { type: "dir", children: [] },
        "/tmp": { type: "dir", children: [] },
    };

    const seedFiles = {
        [fileStorageKey("/etc/motd")]: "Welcome to UselessOS.\n",
        [fileStorageKey("/home/user/readme.txt")]:
            "This is a simulated unix-like filesystem.\n" +
            "It persists to your system as JSON-based storage —\n" +
            "close the tab, come back, everything's still here.\n\n" +
            "Try: ls -a, cat readme.txt, mkdir projects, echo hi > note.txt, neofetch\n\n" +
            "Scripting:\n" +
            "  1. echo '...' > hello.useless\n" +
            "  2. chmod +x hello.useless\n" +
            "  3. ./hello.useless\n" +
            "See 'help' for the full command list.\n",
    };

    for (const [key, value] of Object.entries(seedFiles)) {
        writeStoredValue(key, value);
    }

    writeStoredJSON(FS_MANIFEST_KEY, manifest);
    
    // Build the tree structure from the manifest instead of returning empty root
    const buildNode = (path) => {
        const nodeDef = manifest?.[path] || { type: "dir", children: [] };
        if (nodeDef.type === "file") {
            return createNode("file", {
                content: readStoredValue(fileStorageKey(path), ""),
            });
        }

        const dirNode = createNode("dir", { children: {} });
        for (const childName of nodeDef.children || []) {
            const childPath = joinPath(path, childName);
            dirNode.children[childName] = buildNode(childPath);
        }
        return dirNode;
    };

    return { root: buildNode("/"), manifest };
};

const buildTreeFromManifest = (manifest) => {
    const root = createNode("dir", { children: {} });

    const buildNode = (path) => {
        const nodeDef = manifest?.[path] || { type: "dir", children: [] };
        if (nodeDef.type === "file") {
            return createNode("file", {
                content: readStoredValue(fileStorageKey(path), ""),
            });
        }

        const dirNode = createNode("dir", { children: {} });
        for (const childName of nodeDef.children || []) {
            const childPath = joinPath(path, childName);
            dirNode.children[childName] = buildNode(childPath);
        }
        return dirNode;
    };

    return { root: buildNode("/"), manifest };
};

const buildManifestFromTree = (tree) => {
    const manifest = {};
    const visit = (node, path) => {
        const currentPath = normalizePath(path);
        const children = node?.type === "dir" ? Object.keys(node.children || {}) : [];
        manifest[currentPath] = { type: node?.type || "dir", children };
        if (node?.type === "dir") {
            for (const childName of children) {
                visit(node.children[childName], joinPath(currentPath, childName));
            }
        }
    };
    visit(tree?.root || tree, "/");
    return manifest;
};

const hasStoredDiskState = () => {
    const raw = readStoredValue(FS_MANIFEST_KEY, null);
    if (raw === null || raw === undefined || raw === "") return false;

    try {
        const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
        return parsed && typeof parsed === "object" && Object.keys(parsed).length > 0;
    } catch {
        return false;
    }
};

export function loadDisk() {
    try {
        if (!hasStoredDiskState()) return { fs: defaultFS(), isNew: true };
        const storedManifest = readStoredJSON(FS_MANIFEST_KEY);
        const fsData = buildTreeFromManifest(storedManifest);
        return { fs: fsData, isNew: false };
    } catch {
        return { fs: defaultFS(), isNew: true };
    }
}

export function saveDisk(fs) {
    try {
        const manifest = buildManifestFromTree(fs);
        writeStoredJSON(FS_MANIFEST_KEY, manifest);

        const visit = (node, path) => {
            if (node?.type === "file") {
                writeStoredValue(fileStorageKey(path), node.content || "");
            } else if (node?.type === "dir") {
                for (const [childName, childNode] of Object.entries(node.children || {})) {
                    visit(childNode, joinPath(path, childName));
                }
            }
        };

        visit(fs?.root || fs, "/");
    } catch {
        /* disk full — silently drop the write, like real hardware under pressure */
    }
}

export function wipeDisk() {
    removeStoredJSON(FS_MANIFEST_KEY);
    return defaultFS();
}

export function diskUsageBytes(fs) {
    return new Blob([JSON.stringify(fs)]).size;
}

export const clone = (o) => JSON.parse(JSON.stringify(o));

export function resolvePath(cwd, target) {
    if (!target) return cwd;
    let parts;
    if (target.startsWith("/")) parts = target.split("/").filter(Boolean);
    else if (target === "~") parts = ["home", "user"];
    else if (target.startsWith("~/"))
        parts = ("home/user/" + target.slice(2)).split("/").filter(Boolean);
    else parts = (cwd + "/" + target).split("/").filter(Boolean);

    const resolved = [];
    for (const p of parts) {
        if (p === "." || p === "") continue;
        if (p === "..") resolved.pop();
        else resolved.push(p);
    }
    return "/" + resolved.join("/");
}

const getFSRoot = (fs) => (fs && fs.root ? fs.root : fs);
const getFSNodes = (fs) => (fs && fs.nodes ? fs.nodes : {});

export function getNode(fs, path) {
    const root = getFSRoot(fs);
    if (path === "/") return root;

    let node = root;
    for (const p of path.split("/").filter(Boolean)) {
        if (!node || node.type !== "dir" || !node.children[p]) {
            const nodes = getFSNodes(fs);
            const key = path.split("/").filter(Boolean).slice(0, path.split("/").filter(Boolean).indexOf(p) + 1).join("/");
            const stored = nodes[key];
            if (!stored) return null;
            node = stored;
            continue;
        }
        node = node.children[p];
    }
    return node;
}

export function getParent(fs, path) {
    const parts = path.split("/").filter(Boolean);
    const name = parts.pop();
    const parentPath = "/" + parts.join("/");
    return { parent: getNode(fs, parentPath), parentPath, name };
}

export function displayPath(path) {
    return path === "/home/user" ? "~" : path.replace(/^\/home\/user/, "~");
}

/* ---- PATH alias registry ---- */

export function loadPathMap() {
    try {
        const stored = readStoredJSON(PATH_KEY);
        return stored || {};
    } catch {
        return {};
    }
}

export function savePathMap(map) {
    try {
        writeStoredJSON(PATH_KEY, map);
    } catch {
        /* ignore */
    }
}

/* ---- Boot services registry ---- */

export function loadBootServices() {
    try {
        const stored = readStoredJSON(BOOT_KEY);
        return stored || [];
    } catch {
        return [];
    }
}

export function saveBootServices(list) {
    try {
        writeStoredJSON(BOOT_KEY, list);
    } catch {
        /* ignore */
    }
}

/* ---- Backup / restore (.bak) ---- */

export function buildBackup(fs, pathMap, bootServices) {
    return JSON.stringify(
        {
            format: "uselessos-backup",
            version: 1,
            savedAt: new Date().toISOString(),
            fs,
            pathMap,
            bootServices,
        },
        null,
        2
    );
}

export function parseBackup(text) {
    const data = JSON.parse(text);
    if (!data || typeof data !== "object" || !data.fs) {
        throw new Error("not a valid UselessOS backup file");
    }
    return {
        fs: data.fs,
        pathMap: data.pathMap || {},
        bootServices: data.bootServices || [],
    };
}
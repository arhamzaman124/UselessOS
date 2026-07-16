const { app, BrowserWindow, ipcMain } = require("electron");
const fs = require("fs");
const path = require("path");

const isDev = !app.isPackaged;
const appId = "com.uselessos.app";
app.setAppUserModelId(appId);

const storageDir = path.join(app.getPath("userData"), "uselessos-data");

const ensureStorageDir = () => {
    try {
        if (!fs.existsSync(storageDir)) {
            fs.mkdirSync(storageDir, { recursive: true });
        }
    } catch {
        // ignore directory creation failures
    }
};

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
    app.quit();
}

let mainWindow = null;
const pngIcon = path.join(__dirname, "png", "Drive_White_Stripe_ilbFbWM4mM-512x512x32.png");
const icnsIcon = path.join(__dirname, "icns", "Drive_White_Stripe_ilbFbWM4mM-0755005eb4.icns");

const { nativeImage } = require("electron");

const loadIconImage = (iconPath) => {
    try {
        if (!iconPath) return null;
        if (!fs.existsSync(iconPath)) return null;
        const buf = fs.readFileSync(iconPath);
        const img = nativeImage.createFromBuffer(buf);
        if (img && !img.isEmpty()) return img;
    } catch (e) {
        // ignore failures to load icon
    }
    return null;
};

const createWindow = () => {
    const icnsImage = loadIconImage(icnsIcon);
    const pngImage = loadIconImage(pngIcon);

    if (process.platform === "darwin") {
        if (icnsImage) {
            app.dock.setIcon(icnsImage);
        }
    }

    mainWindow = new BrowserWindow({
        width: 1280,
        height: 720,
        minWidth: 900,
        minHeight: 600,
        title: "UselessOS",
        icon: pngImage || icnsImage || undefined,
        backgroundColor: "#000000",
        autoHideMenuBar: true,
        show: false,
        webPreferences: {
            preload: path.join(__dirname, "preload.js"),
            contextIsolation: true,
            nodeIntegration: false,
            enableRemoteModule: false,
        },
    });

    if (isDev) {
        mainWindow.loadURL("http://localhost:5173");
        mainWindow.webContents.openDevTools({ mode: "detach" });
    } else {
        mainWindow.loadFile(path.join(__dirname, "./uselessos/dist/index.html"));
    }

    mainWindow.once("ready-to-show", () => {
        mainWindow.show();
    });

    mainWindow.on("closed", () => {
        mainWindow = null;
    });
};

ipcMain.on("uselessos:read-json-sync", (event, name) => {
    try {
        const filePath = path.join(storageDir, name);
        if (!fs.existsSync(filePath)) {
            event.returnValue = null;
            return;
        }
        const raw = fs.readFileSync(filePath, "utf8");
        event.returnValue = JSON.parse(raw);
    } catch {
        event.returnValue = null;
    }
});

ipcMain.on("uselessos:write-json-sync", (event, name, value) => {
    try {
        const filePath = path.join(storageDir, name);
        fs.writeFileSync(filePath, JSON.stringify(value));
        event.returnValue = true;
    } catch {
        event.returnValue = false;
    }
});

ipcMain.on("uselessos:remove-json-sync", (event, name) => {
    try {
        const filePath = path.join(storageDir, name);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
        event.returnValue = true;
    } catch {
        event.returnValue = false;
    }
});

ipcMain.on("uselessos:get-app-data-path-sync", (event) => {
    event.returnValue = storageDir;
});

app.on("second-instance", () => {
    if (mainWindow) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.focus();
    }
});

app.whenReady().then(() => {
    ensureStorageDir();
    createWindow();
});

app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
        app.quit();
    }
});

app.on("activate", () => {
    if (mainWindow === null) {
        createWindow();
    }
});

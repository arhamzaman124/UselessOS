# 9. Signals and the `process` API

## 9.1 `signal(name, handler)`

Registers a handler function that runs when the named signal is delivered
to this script.

Currently supported signal names:

| Signal | Delivered when |
|---|---|
| `"SIGINT"` | The user presses Ctrl+C while this script has focus, or another script sends it via `process.kill(pid, "SIGINT")` (§9.2) |

```js
function main(argc, argv) {
  const screen = bufferscreenclear();
  screen.innerHTML = "<p style='color:#7ee787'>Running... press Ctrl+C to stop</p>";

  signal("SIGINT", () => {
    printf("Interrupted!\n");
    bufferscreenexitprogramservices();
  });
}
```

Notes:
- Registering a handler for a signal replaces any previously registered
  handler for that same signal in this script.
- If a script never calls `signal(...)`, `SIGINT` falls back to the
  runtime default: close any open screen buffer (as if
  `bufferscreenexitprogramservices()` were called) and terminate the
  script immediately.
- Handlers run even while the script is `await`-ing something (`scanf`,
  `sleep`, a pending `execute`, a File API call) — the runtime interrupts
  the wait to invoke the handler.
- A handler is expected to actually stop the program (call
  `bufferscreenexitprogramservices()`, `process.exit()`, `return`, etc.).
  A handler that does neither leaves the process visibly "hung" in `ps`
  even after Ctrl+C, since the runtime keeps it registered as running
  until it's told otherwise.

---

## 9.2 `process`

An object available in every script's scope:

| Property / method | Description |
|---|---|
| `process.pid` | This script's process id — the same id shown by `ps` and used with `pickup -pid`/`process.kill`. |
| `process.argv` | Same array passed as `argv` to `main` — handy for helper functions that don't receive `argv` directly. |
| `process.exit(code = 0)` | Terminates the script immediately, whether or not a screen buffer is open (closes it automatically). `code` is recorded and shown by `ps`/`pickup` as the exit status; a non-zero code is reported the same way as an uncaught error, but without the `Segmentation fault` banner (§13). |
| `process.kill(pid, signalName = "SIGINT")` | Delivers a signal to another running (typically background) process by `pid`. Only has an effect if the target script registered a `signal(...)` handler for that signal name — otherwise the target falls back to its own default handling for the signal (e.g. an un-handled `SIGINT` still terminates it, §9.1). |

```js
async function main(argc, argv) {
  printf("My pid is %d\n", process.pid);
  await sleep(5000);
  process.exit(0);
}
```

```js
// stop a background process by pid, politely
async function main(argc, argv) {
  const targetPid = Number(argv[1]);
  process.kill(targetPid, "SIGINT");
}
```

---

## 9.3 `sleep(ms)` — **async, must be awaited**

Pauses the script for `ms` milliseconds without blocking the rest of the
shell.

```js
async function main(argc, argv) {
  printf("Waiting...\n");
  await sleep(2000);
  printf("Done.\n");
}
```

- An in-flight `sleep` is interrupted immediately if a `SIGINT` handler is
  registered and fires (§9.1) — the handler runs right away instead of
  waiting for the timer to finish.
- Forgetting `await` starts the timer but doesn't pause execution — the
  same "pending `Promise`" mistake described for `scanf` in §4.2.

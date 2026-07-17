# 4. Runtime built-ins

These functions are injected into every `.useless` file's scope. You do not
declare or import them — they're just available inside `main` (and any
function it calls). (Additional built-ins — `signal`, `process`, `sleep`,
`getenv`/`setenv`/`unsetenv`, and the File API — are covered in their own
files: §9, §10, §11.)

---

### 4.1 `printf(format, ...args)`

Prints formatted text to the terminal (or, if a screen buffer is open, this
still writes to the terminal underneath — see [`03-fullscreen-programs.md`](./03-fullscreen-programs.md) for the DOM overlay).

**Format specifiers:**

| Specifier | Meaning |
|---|---|
| `%s` | String |
| `%d`, `%i` | Integer (value is truncated toward zero) |
| `%f` | Number, printed as-is |
| `%%` | Literal `%` |

`\n` in the format string produces a new terminal line.

```js
function main(argc, argv) {
  printf("Name: %s\n", "root");
  printf("Uptime: %d seconds\n", 42);
  printf("Load: %f\n", 0.73);
  printf("100%% done\n");
}
```

---

### 4.2 `scanf(promptLabel)` — **async, must be awaited**

Prompts for a line of input and resolves with what the user typed once they
press Enter.

```js
async function main(argc, argv) {
  const name = await scanf("What's your name? ");
  printf("Hello, %s!\n", name);
}
```

- `promptLabel` is optional; pass `""` or omit it for a silent prompt.
- `scanf` works both in the normal terminal **and** inside a
  `bufferscreenclear()` overlay session (§5) — a floating input bar appears
  automatically when a screen-buffer program is waiting on input.
- Only one `scanf()` call resolves at a time; queuing multiple simultaneous
  calls is not supported — always `await` before calling it again.
- A pending `scanf()` is interrupted immediately if a `SIGINT` handler is
  registered and fires (§9.1).

**Common mistake:**

```js
// WRONG — main is not async, so `await` is illegal here, and without
// await this returns a Promise object, not a string.
function main(argc, argv) {
  const name = scanf("Name: ");
  printf("Hi %s", name); // prints "Hi [object Promise]"
}
```

---

### 4.3 `execute(commandString)` — **async, must be awaited**

Runs a full shell command line (any built-in command, or another
`.useless` script) as if it had been typed at the prompt, but silently —
nothing is echoed to the terminal.

Note: it doesn't create a new instance — it talks directly to the one and
only running bash instance started at `BootProcess`.

`execute` resolves to a **result object**, not a plain string:

```js
async function main(argc, argv) {
  const result = await execute("ls -a /home/user");

  printf("%s\n", result.stdout);

  if (result.exitCode !== 0) {
    printf("command failed: %s\n", result.stderr);
  }

  await execute("mkdir -p /home/user/backups");
  await execute("./other-script.useless some-arg");
}
```

| Field | Type | Description |
|---|---|---|
| `result.stdout` | `string` | Standard output produced by the command |
| `result.stderr` | `string` | Standard error output produced by the command |
| `result.exitCode` | `number` | `0` on success, non-zero if the command failed |

> **Migration note:** earlier versions of the runtime resolved `execute()`
> directly to the plain-text output string. Scripts written against that
> behavior need a small update — `printf("%s", await execute("ls"))` now
> prints `[object Object]`; use `(await execute("ls")).stdout` instead.

Use this to compose scripts out of shell commands or chain scripts
together without duplicating filesystem logic — or use the File API
(§11) directly when you just need to read/write files without going
through a shell command.

---

### 4.4 `bufferscreenclear()`

Opens a full-viewport overlay (`<div id="screen">`) on top of the terminal
and returns that DOM element. Use it for anything more visual than
line-by-line `printf` output — you get direct `innerHTML`/DOM access.

```js
function main(argc, argv) {
  const screen = bufferscreenclear();
  screen.innerHTML = '<h1 style="color: white;">Hello, World!</h1>';

  setTimeout(() => {
    bufferscreenexitprogramservices();
  }, 5000);
}
```

- Calling it again while already open reuses the same element (its
  `innerHTML` is cleared first).
- While the overlay is open, the normal terminal input is hidden. If your
  program calls `scanf()` during this time, a small floating input bar
  appears over the overlay so the user can still type (§5).
- **The program is not considered finished just because `main()` returns**
  while a screen session is open — the runtime keeps it "running" until
  `bufferscreenexitprogramservices()` is actually called, however long that
  takes (a `setTimeout`, waiting on `scanf`, a click handler you attach to
  elements inside `screen`, etc.) — or until a `SIGINT` closes it (§9.1).

---

### 4.5 `bufferscreenexitprogramservices()`

Closes the overlay opened by `bufferscreenclear()` and returns control to
the terminal.

- If called **synchronously within `main`'s own execution** (i.e. before
  `main` has returned), it immediately stops the rest of the script from
  running — nothing after this call executes.
- If called **later** (from a `setTimeout`, an event listener you attached
  to something inside `screen`, a resolved promise, a `SIGINT` handler,
  etc., after `main` has already returned), it simply closes the overlay
  and lets the program finish cleanly — no special unwinding needed.

```js
function main(argc, argv) {
  const screen = bufferscreenclear();
  screen.innerHTML = "<p style='color:#0f0'>Press any key to continue...</p>";

  const onKey = () => {
    document.removeEventListener("keydown", onKey);
    bufferscreenexitprogramservices();
  };
  document.addEventListener("keydown", onKey);

  // Ctrl+C also closes this cleanly, even mid-wait:
  signal("SIGINT", () => {
    printf("Interrupted!\n");
    bufferscreenexitprogramservices();
  });
}
```

You do not need to manually remove the `#screen` element or reset input
state yourself — `bufferscreenexitprogramservices()` and the runtime's own
cleanup handle that, including on crashes and `SIGINT` (see §13).

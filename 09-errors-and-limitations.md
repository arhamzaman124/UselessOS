# 13–14. Error handling and limitations

## 13. Error handling

If your script throws an uncaught error (a real JS error — not the
internal overlay-exit signal, and not a `SIGINT` handled by `signal(...)`,
§9.1), the runtime reports it and moves on without crashing the shell:

```
Segmentation fault (core dumped) — hello.useless
  <error message>
```

Common causes:
- `main` is not defined, or isn't a function.
- A runtime error inside `main` (e.g. calling a method on `undefined`).
- Forgetting `await` before an async built-in (`scanf`, `sleep`,
  `execute`, any File API call), then using its result as if it were
  already resolved.
- An unresolved `import` — a `libman` name with no registration, or a
  static path that doesn't exist — which fails before `main` even runs
  (§12).
- A rejected File API call (missing file for `readFile`, etc.) that
  wasn't wrapped in `try/catch` (§11).

`process.exit(code)` with a non-zero `code` is reported similarly (as an
exit status visible to `ps`/`pickup`) but without the `Segmentation fault`
banner — it's a deliberate exit, not a crash (§9.2).

This is isolated per-script — one broken program does not corrupt the
filesystem or affect other running processes.

---

## 14. What's *not* available inside `.useless` scripts

To keep scripts sandboxed and predictable, the following are **not**
injected into `.useless` scope and will throw `ReferenceError` if used
directly (aside from what's reachable through `bufferscreenclear()`'s
returned element, which does give you real DOM access):

- `fetch` / network access outside of `execute("download <url>")`
- Real JS `import` / `require` of arbitrary modules — the `.useless`
  `import`/`export`/`libman` system (§12) is a separate, simpler
  mechanism for pulling in other `.useless` files only, not a way to load
  npm packages or host-app code.
- Direct access to the host app's React state or `localStorage`

Filesystem access, by contrast, **is** available directly — either
through the File API (`readFile`, `writeFile`, `appendFile`, `exists`,
`mkdir`, `remove`, `listDir`; §11), or by shelling out with `execute(...)`
(`ls`, `cat`, `mkdir`, `download`, etc. — see `help` in the shell for the
full command list). Use whichever fits the task better.

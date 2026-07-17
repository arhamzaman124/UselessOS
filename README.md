This literally has no use, figure out how to build it yourself.
Or just download the binaries.

Website: uselesos.omniasync.com

So cut the BS, and just see how the useless scripting works, because there aint no way you can figure it out without a panic attack.

# `.useless` Scripting Reference

This reference used to be one file. It's split up now so it's easier to find
what you need and easier to keep growing without one file turning into a
wall of text. Read in order if you're new; jump straight to a section if
you already know the basics.

| # | File | Covers |
|---|---|---|
| 1–3 | [`01-quickstart-and-running.md`](./01-quickstart-and-running.md) | Quick start, running a script, `main(argc, argv)` |
| 4 | [`02-builtins-core.md`](./02-builtins-core.md) | `printf`, `scanf`, `execute`, `bufferscreenclear`, `bufferscreenexitprogramservices` |
| 5 | [`03-fullscreen-programs.md`](./03-fullscreen-programs.md) | Building interactive full-screen tools |
| 6–8 | [`04-path-background-boot.md`](./04-path-background-boot.md) | PATH aliases, background processes, boot services |
| 9 | [`05-signals-process.md`](./05-signals-process.md) | `signal()`, `SIGINT`, the `process` API, `sleep(ms)` |
| 10 | [`06-environment-variables.md`](./06-environment-variables.md) | `getenv`, `setenv`, `unsetenv` |
| 11 | [`07-file-api.md`](./07-file-api.md) | `readFile`, `writeFile`, `appendFile`, `exists`, `mkdir`, `remove`, `listDir` |
| 12 | [`08-imports-libman.md`](./08-imports-libman.md) | `import`, `export`, and the default library manager `libman` |
| 13–14 | [`09-errors-and-limitations.md`](./09-errors-and-limitations.md) | Error handling, what's not available |
| — | [`10-full-example.md`](./10-full-example.md) | A complete worked example touching most of the above |

## What changed in this revision

- `execute()` now returns `{ stdout, stderr, exitCode }` instead of a plain
  string (§4.3).
- Added `signal(name, handler)` and a `process` object (`process.pid`,
  `process.argv`, `process.exit(code)`, `process.kill(pid, signalName)`) —
  §9.
- Added `sleep(ms)` — §9.3.
- Added environment variables: `getenv`, `setenv`, `unsetenv` — §10.
- Added a File API: `readFile`, `writeFile`, `appendFile`, `exists`,
  `mkdir`, `remove`, `listDir` — §11.
- Added an `import` / `export` system with a default library manager,
  `libman` — §12.
- Split the single reference file into the files listed above.

Everything from the previous single-file version is preserved — nothing
here reverts earlier edits, it's the same content reorganized plus the
additions above.
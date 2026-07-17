# 1–3. Quick start, running scripts, and `main`

`.useless` files are the executable scripts of UselessOS. Each one is a
JavaScript file that exports a single entry point, `main(argc, argv)`, and
runs inside a sandboxed function with a small set of runtime built-ins
injected for it — no `import` of arbitrary JS modules, no access to the
outer app, no DOM access except through the built-ins below (`.useless`
files *do* have their own `import`/`export` system for pulling in other
`.useless` files — see [`08-imports-libman.md`](./08-imports-libman.md)).

---

## 1. Quick start

### Method 1 "Manual Write via Bash"
```bash
echo 'function main(argc, argv) {
  printf("Hello, %s!\n", argv[0]);
}' > hello.useless
```

### Method 2 "Write in a Code Editor and download by uploading to URL" (Recommended)
Firstly write your `.useless` file using Visual Studio Code or any editor of your choice then:
1. Upload it to a url or start a local server and copy the link of your `.useless` file.
```bash
download <URL>
```
2. Finally you will have your file downloaded into the current working directory.

```bash
chmod +x hello.useless
./hello.useless
```

```
running 'hello.useless'
Hello, hello.useless!
```

Every `.useless` file must define:

```js
function main(argc, argv) { ... }
```

or, if it needs to `await` anything (`scanf`, `sleep`, `execute`, timers,
promises, the File API):

```js
async function main(argc, argv) { ... }
```

`main` is your entry point — nothing runs before or after it except the
runtime's own setup/teardown (including resolving any `import`s at the top
of the file — see §12).

---

## 2. Running a script

| Method | Example | Notes |
|---|---|---|
| Direct path | `./hello.useless` | Requires execute permission (see `chmod`) |
| Absolute path | `/home/user/hello.useless` | Same permission rules |
| PATH alias | `hello` | Register with `addition towards PATH` (§6) |
| Boot service | `onbootservices add hello /home/user/hello.useless` | Runs automatically at boot |
| From inside another script | `await execute("./hello.useless")` | See `execute()` (§4.3) |

A file **must**:
- have the `.useless` extension
- be marked executable (`chmod +x file.useless`)

Otherwise you'll get `permission denied` or `cannot execute binary file`.

---

## 3. `main(argc, argv)`

| Parameter | Type | Description |
|---|---|---|
| `argc` | `number` | Argument count, including the program name (`argv[0]`) |
| `argv` | `string[]` | `argv[0]` is the name/path used to invoke the script; `argv[1..]` are the arguments passed on the command line |

```bash
./greet.useless world
```

```js
function main(argc, argv) {
  // argc === 2
  // argv === ["./greet.useless", "world"]
  printf("Hi, %s! (%d args)\n", argv[1], argc);
}
```

`argv` is also reachable anywhere in the script as `process.argv`, without
threading it through function calls — see §9.2.

### Declaring `main` correctly

| You need to... | Declare `main` as |
|---|---|
| Just print output, no waiting | `function main(argc, argv) { ... }` |
| `await scanf(...)`, `await sleep(...)`, or any File API call | `async function main(argc, argv) { ... }` |
| Keep running after `main` logically "returns" (e.g. a `setTimeout` that later calls `bufferscreenexitprogramservices()`) | `async function main(argc, argv) { ... }` recommended, though a plain `function` also works here since the runtime tracks the open screen session for you |

**Rule of thumb:** if your script uses `await` anywhere, `main` must be
`async`. A non-`async` `main` cannot `await`, so `const x = scanf(...)`
without `await` gives you a pending `Promise` object, not the typed value —
and `printf("%s", x)` will print `[object Promise]` instead of the input.
The same mistake applies to `sleep(...)`, `execute(...)`, and every File API
call (§9.3, §4.3, §11).

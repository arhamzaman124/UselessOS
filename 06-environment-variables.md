# 10. Environment variables

```js
getenv(name)          // -> string | null
setenv(name, value)
unsetenv(name)
```

### `getenv(name)`
Returns the current value of an environment variable as a string, or
`null` if it isn't set. Two are pre-populated by the runtime at boot:

```js
function main(argc, argv) {
  printf("Home: %s\n", getenv("HOME")); // e.g. "/home/user"
  printf("User: %s\n", getenv("USER")); // e.g. "user"
}
```

### `setenv(name, value)`
Sets (or overwrites) an environment variable.

```js
function main(argc, argv) {
  setenv("EDITOR", "nano");
  printf("Editor: %s\n", getenv("EDITOR")); // "nano"
}
```

### `unsetenv(name)`
Removes a variable entirely — a subsequent `getenv` call for that name
returns `null`, not an empty string.

```js
function main(argc, argv) {
  setenv("EDITOR", "nano");
  unsetenv("EDITOR");
  printf("%s\n", getenv("EDITOR") === null ? "unset" : getenv("EDITOR"));
  // -> "unset"
}
```

### Scope and persistence

Environment variables are shared across the whole boot session, not
private per script — since `execute()` and every script talk to the one
running bash instance started at `BootProcess` (§4.3), a variable set by
one script is immediately visible to the next script that runs, including
background processes started afterward. They are **not** persisted like
PATH aliases (§6): a fresh boot starts with only `HOME` and `USER` set,
and anything else you `setenv` is gone.

If you need a setting to survive reboot, write it to a file with the File
API (§11) and read it back at startup, instead of relying on `setenv`.

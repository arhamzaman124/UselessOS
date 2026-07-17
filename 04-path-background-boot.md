# 6–8. PATH aliases, background processes, and boot services

## 6. PATH aliases

Register a short alias for a script so it can be run by name instead of by
path:

```bash
addition towards PATH "hello.useless" as "hello"
```

- The path is resolved relative to your current directory at the time you
  register it (or absolute, if given as one).
- Once registered, you can run it as `hello arg1 arg2` from anywhere.
- Aliases are stored persistently and survive reboot.
- The target file does not need to exist at run time in the *same*
  location it was registered from — it's resolved to the path stored at
  registration.

---

## 7. Background processes

Any `.useless` file can be run in the background instead of blocking the
terminal. There are two ways to mark a script as a background process:

**1. Header comment**, first line of the file:

```js
// DEFINE <BACKPROCESS>
function main(argc, argv) {
  // long-running work
}
```

**2. Boot service registration** — services started via
`onbootservices start <name>` / at boot run in the foreground by default
unless the script itself declares `<BACKPROCESS>`.

Background processes:
- Print `starting background process 'name' [pid <id>]` when launched.
  This `<id>` is the same value the script sees as `process.pid` (§9.2).
- Are listed with `ps`.
- Can be reattached to the foreground with `pickup -pid <id>` (or
  `pickup <id>`), which awaits their completion and surfaces any errors
  (or the exit code passed to `process.exit(code)`, §9.2).
- Can be sent signals from another script via `process.kill(pid,
  signalName)` (§9.2), or from the shell (`kill -SIGINT <id>`, if your
  script registered a handler for it via `signal(...)`, §9.1).
- Get their own independent execution context — a crash in one does not
  affect the shell or other processes.

---

## 8. Boot services

Scripts can be registered to run automatically every time UselessOS boots:

```bash
onbootservices add mydaemon /home/user/mydaemon.useless
onbootservices list
onbootservices start mydaemon      # run it right now, enable it for next boot
onbootservices restart mydaemon    # run it again right now
onbootservices pause mydaemon      # skip it at the next boot, keep registration
onbootservices remove mydaemon     # unregister entirely
onbootservices reset               # clear all registered services
```

At boot, enabled and unpaused services run in registration order, each
printing `Starting boot service '<name>'...` before it runs. A foreground
boot service that never resolves (e.g. an interactive script awaiting
`scanf`) will block the rest of boot from proceeding — prefer
`<BACKPROCESS>` scripts, or scripts that finish on their own, for boot
services that need to run unattended.

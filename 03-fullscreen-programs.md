# 5. Interactive full-screen programs

Combine `bufferscreenclear()`, DOM manipulation, and `scanf()` to build
simple full-screen interactive tools (menus, forms, games):

```js
async function main(argc, argv) {
  const screen = bufferscreenclear();
  screen.innerHTML = "<h2 style='color:#7ee787'>Setup Wizard</h2>";

  const name = await scanf("Enter your name: ");
  screen.innerHTML += `<p style="color:white">Hi, ${name}!</p>`;

  const confirmed = await scanf("Type 'yes' to continue: ");
  if (confirmed.toLowerCase() !== "yes") {
    screen.innerHTML += "<p style='color:#ff6b6b'>Cancelled.</p>";
    await sleep(1500);
    bufferscreenexitprogramservices();
    return;
  }

  screen.innerHTML += "<p style='color:#7ee787'>All set!</p>";
  setTimeout(() => bufferscreenexitprogramservices(), 2000);
}
```

Notes:
- `scanf()` prompts are shown in the floating input bar over the overlay,
  not printed into `screen.innerHTML` — print your own prompt text into the
  overlay if you want it visible there too.
- Because `main` is `async` and uses `await scanf(...)` (and `await
  sleep(...)`), it must be declared `async function main(...)`.
- If the user hits Ctrl+C while a screen session like this is open and you
  haven't registered your own `signal("SIGINT", ...)` handler, the runtime
  default kicks in: it closes the overlay for you and terminates the
  script (§9.1). Register your own handler if you want a chance to clean
  up or print something first, as shown in §4.5.

# Full example

A tiny interactive counter, demonstrating `printf`, `scanf`, a
`bufferscreenclear()` session that stays open until the user quits, a
`SIGINT` handler, and a save-to-disk feature using the File API.

```js
// A tiny interactive counter.

async function main(argc, argv) {
  let count = 0;
  const savePath = "/tmp/counter-save.txt";

  if (await exists(savePath)) {
    count = Number(await readFile(savePath)) || 0;
  }

  const screen = bufferscreenclear();

  const render = () => {
    screen.innerHTML = `
      <div style="font-family: monospace; color: #7ee787; padding: 40px;">
        <h1>Count: ${count}</h1>
        <p>Type "inc", "dec", or "quit". Ctrl+C also saves and quits.</p>
      </div>
    `;
  };
  render();

  const save = async () => {
    await writeFile(savePath, String(count));
  };

  signal("SIGINT", async () => {
    await save();
    printf("Saved at %d. Interrupted!\n", count);
    bufferscreenexitprogramservices();
  });

  while (true) {
    const cmd = await scanf("> ");
    if (cmd === "inc") count++;
    else if (cmd === "dec") count--;
    else if (cmd === "quit") break;
    render();
  }

  await save();
  bufferscreenexitprogramservices();
}
```

```bash
chmod +x counter.useless
./counter.useless
```

Related sections: `bufferscreenclear`/`scanf` (§4), full-screen programs
(§5), `signal`/`SIGINT` (§9.1), the File API (§11).

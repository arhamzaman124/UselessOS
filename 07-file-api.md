# 11. File API

All File API calls are **async and must be awaited**. They operate on the
same filesystem that shell commands like `ls`, `cat`, and `mkdir` use via
`execute()` (§4.3) — use whichever fits better: the File API skips the
overhead and text-parsing of shelling out for simple reads/writes, while
`execute()` is still the way to run other scripts or shell built-ins that
don't have a direct function equivalent.

```js
await readFile(path)
await writeFile(path, data)
await appendFile(path, data)
await exists(path)
await mkdir(path)
await remove(path)
await listDir(path)
```

| Call | Resolves to | Notes |
|---|---|---|
| `readFile(path)` | file contents as a `string` | Rejects if the path doesn't exist or is a directory — wrap in `try/catch` if the file may be missing. |
| `writeFile(path, data)` | `true` on success | Creates the file if missing, overwrites it if it already exists. The parent directory must already exist (use `mkdir` first). |
| `appendFile(path, data)` | `true` on success | Creates the file if missing; otherwise adds `data` to the end of the existing content. |
| `exists(path)` | `boolean` | Never rejects — `true` for either a file or a directory. |
| `mkdir(path)` | `true` on success | Creates intermediate directories as needed (like `mkdir -p`). Resolves `true` with no error if the directory already exists. |
| `remove(path)` | `true` on success | Deletes a file, or a directory and everything inside it. Resolves `true` with no error if the path doesn't exist. |
| `listDir(path)` | `Array<{ name, isDirectory }>` | One entry per item directly inside `path` (not recursive). Rejects if `path` doesn't exist or isn't a directory. |

```js
async function main(argc, argv) {
  if (!(await exists("/tmp/notes"))) {
    await mkdir("/tmp/notes");
  }

  await writeFile("/tmp/notes/a.txt", "first line\n");
  await appendFile("/tmp/notes/a.txt", "second line\n");

  const contents = await readFile("/tmp/notes/a.txt");
  printf("%s", contents);

  const entries = await listDir("/tmp/notes");
  for (const entry of entries) {
    printf("%s%s\n", entry.name, entry.isDirectory ? "/" : "");
  }

  await remove("/tmp/notes/a.txt");
}
```

`try/catch` around calls that can reject (`readFile`, `listDir`) keeps a
missing file from crashing the whole script with a `Segmentation fault`
(§13):

```js
async function main(argc, argv) {
  try {
    const data = await readFile("/home/test.txt");
    printf("%s\n", data);
  } catch {
    printf("no such file\n");
  }
}
```

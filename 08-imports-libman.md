# 12. `import` / `export` and `libman`

`.useless` files can share code with each other through a small,
deliberately simple `import` system — separate from (and not to be
confused with) real JS `import`/`require`, which is still not available
(§14).

`import` statements are the very first thing in a file, before any other
top-level code, `main()` included. The runtime resolves all of them up
front, before `main` runs.

```js
import { add } from "math";              // library-name import
import math from "math";                 // same library, default form
import { add } from "./mylib.useless";    // static path import
```

There are two kinds of import source:

1. **Library name** (e.g. `"math"`, no `/` or leading `.`) — resolved
   through `libman`, the default library manager, to an actual
   `.useless` file (§12.3).
2. **Static path** (`./...`, `../...`, or an absolute `/...` path) — a
   direct reference to another `.useless` file on disk, resolved the same
   way `execute("./other.useless")` resolves paths (§4.3).

The two behave differently on purpose — see below.

---

## 12.1 Exporting from a `.useless` file

Any file can make functions available to importers with `export`:

```js
// /useless/lib/math.useless
export function add(a, b) { return a + b; }
export function sub(a, b) { return a - b; }
```

- A file that's only meant to be imported (a "library file") doesn't need
  a `main()`. If it has one, it can still be run directly as its own
  script *and* imported elsewhere.
- `export` only works at the top level of the file, alongside `import` —
  not conditionally, and not from inside `main`.

---

## 12.2 Library-name imports vs. static path imports

**Library-name imports** (resolved via `libman`) always bind the whole
exported namespace to a local identifier matching the library's name —
regardless of whether you wrote `import { add } from "math"` or `import
math from "math"`. Either way, you call `math.add(...)`:

```js
import { add } from "math";

function main(argc, argv) {
  printf("%d\n", math.add(1, 2)); // note: math.add, not add
}
```

This is deliberate: it keeps every lib import consistent no matter how
many functions you use from it, and avoids collisions when two libraries
happen to export a function with the same name. Think of the `{ add }`
form here as documentation of intent, not a destructuring guarantee.

**Static path imports**, by contrast, support real destructuring — a
named import gives you a bare identifier, a default import gives you the
whole namespace:

```js
import { add } from "./mylib.useless";
add(2, 3); // "add" is directly in scope, no namespace wrapper

import helpers from "./mylib.useless";
helpers.add(2, 3); // default-style import still gives the whole namespace
```

| Import source | `import { add } from X` gives you | `import name from X` gives you |
|---|---|---|
| Library name (`"math"`) | `math.add` (namespace, named by the lib) | `math.add` (same) |
| Static path (`"./..."`) | bare `add` | `name.add` (namespace, named by you) |

---

## 12.3 `libman`, the default library manager

`libman` maps a short library name to the `.useless` file that actually
implements it — the same way PATH aliases (§6) map a command name to a
script, but for importable libraries instead of runnable commands.

```bash
libman list
libman add <name> <path>
libman remove <name>
libman path <name>
```

Shipped by default:

| Name | Resolves to |
|---|---|
| `math` | `/useless/lib/math.useless` |

- `libman add` registers a new name, resolved the same way a static path
  would be at registration time (relative or absolute).
- `libman remove` unregisters a name; existing scripts that `import` it
  afterward fail to resolve at load time, before `main` runs.
- Registrations persist across reboot, like PATH aliases.
- A library file registered with `libman` can itself `import` other
  libraries, whether by library name or by static path — libraries can be
  built out of other libraries. A chain of imports that eventually
  imports itself is a circular import and is rejected at load time (before
  `main` runs), rather than causing a runtime crash mid-script.

```js
// /useless/lib/geometry.useless — a library built on another library
import { add } from "math";

export function perimeter(sides) {
  return sides.reduce((total, side) => math.add(total, side), 0);
}
```

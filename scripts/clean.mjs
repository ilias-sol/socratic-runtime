import { rm } from "node:fs/promises";
import path from "node:path";
import { root } from "./lib.mjs";

for (const entry of ["dist", "dist-types"])
  await rm(path.join(root, entry), { recursive: true, force: true });

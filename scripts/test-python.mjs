import path from "node:path";
import { pythonFor, root, run } from "./lib.mjs";

const exercises = [
  {
    name: "binary-search",
    valid: ["valid_inclusive.py", "valid_half_open.py", "valid_unusual.py"],
    invalid: "invalid_boundary.py",
  },
  {
    name: "merge-intervals",
    valid: ["valid_scan.py", "valid_components.py"],
    invalid: "invalid_touching.py",
  },
  {
    name: "number-of-islands",
    valid: ["valid_bfs.py", "valid_union_find.py"],
    invalid: "invalid_diagonal.py",
  },
  {
    name: "lru-cache",
    valid: ["valid_ordered_dict.py", "valid_linked.py"],
    invalid: "invalid_fifo.py",
  },
];

let acceptedStrategies = 0;
const python = pythonFor(path.join(root, "sample-workspace", "binary-search"));
for (const exercise of exercises) {
  const workspace = path.join(root, "sample-workspace", exercise.name);
  for (const fixture of exercise.valid) {
    console.log(`Verifying ${exercise.name} accepted strategy: ${fixture}`);
    await run(python, ["-m", "pytest", "-q", "-p", "no:cacheprovider"], {
      cwd: workspace,
      env: {
        SOCRATIC_SOLUTION: path.join(workspace, "tests", "fixtures", fixture),
      },
    });
    acceptedStrategies += 1;
  }
  console.log(`Verifying ${exercise.name} rejects ${exercise.invalid}`);
  const invalid = await run(
    python,
    ["-m", "pytest", "-q", "-p", "no:cacheprovider"],
    {
      cwd: workspace,
      env: {
        SOCRATIC_SOLUTION: path.join(
          workspace,
          "tests",
          "fixtures",
          exercise.invalid,
        ),
      },
      allowFailure: true,
      capture: true,
    },
  );
  if (invalid.code === 0)
    throw new Error(
      `${exercise.name} incorrect fixture was unexpectedly accepted`,
    );
}
console.log(
  `Cross-problem Python verification passed (${exercises.length} exercises, ${acceptedStrategies} valid strategies accepted, ${exercises.length} incorrect strategies rejected).`,
);

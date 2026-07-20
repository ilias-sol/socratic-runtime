import * as vscode from "vscode";
import type { ExerciseConfig } from "./types.js";
import { validateExerciseConfig } from "./exerciseConfig.js";

export { validateExerciseConfig } from "./exerciseConfig.js";

export async function loadExerciseConfig(
  folder: vscode.WorkspaceFolder,
): Promise<ExerciseConfig | null> {
  const uri = vscode.Uri.joinPath(folder.uri, ".socratic", "exercise.json");
  try {
    const bytes = await vscode.workspace.fs.readFile(uri);
    return validateExerciseConfig(
      JSON.parse(Buffer.from(bytes).toString("utf8")) as unknown,
    );
  } catch (error) {
    if (
      error instanceof vscode.FileSystemError &&
      error.code === "FileNotFound"
    )
      return null;
    throw error;
  }
}

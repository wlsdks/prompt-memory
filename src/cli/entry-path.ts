import { existsSync, readFileSync } from "node:fs";
import { dirname, join, parse, sep } from "node:path";
import { fileURLToPath } from "node:url";

export function resolveCliEntryPath(
  importMetaUrl: string,
  relativePath: string,
): string {
  const moduleRelativePath = fileURLToPath(
    new URL(relativePath, importMetaUrl),
  );

  if (!isSourcePath(moduleRelativePath)) {
    return moduleRelativePath;
  }

  const packageRoot = findPackageRoot(dirname(moduleRelativePath));
  if (!packageRoot) {
    return moduleRelativePath;
  }

  const distCliPath = join(packageRoot, "dist", "cli", "index.js");
  return existsSync(distCliPath) ? distCliPath : moduleRelativePath;
}

function isSourcePath(path: string): boolean {
  return path.split(sep).includes("src");
}

function findPackageRoot(startDir: string): string | undefined {
  let current = startDir;
  const root = parse(startDir).root;

  while (current !== root) {
    const packageJsonPath = join(current, "package.json");
    if (isPromptCoachPackage(packageJsonPath)) {
      return current;
    }

    current = dirname(current);
  }

  return undefined;
}

function isPromptCoachPackage(packageJsonPath: string): boolean {
  if (!existsSync(packageJsonPath)) {
    return false;
  }

  try {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8")) as {
      name?: string;
    };
    return packageJson.name === "prompt-coach";
  } catch {
    return false;
  }
}

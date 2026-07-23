import path from "path";
import { PROJECTS_DIR } from "@doc-flip/shared";

export function projectDir(id) {
  if (!/^[a-z0-9-]{8,64}$/.test(id)) throw new Error("项目 ID 无效");
  return path.join(PROJECTS_DIR, id);
}

export function assetPath(project, assetId) {
  const asset = project.assets.find((item) => item.id === assetId);
  if (!asset) throw new Error("素材不存在");
  return path.join(projectDir(project.id), "uploads", asset.file);
}

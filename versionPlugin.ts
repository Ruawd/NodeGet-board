// vite.config.ts
import fs from "fs";
import crypto from "crypto";
import path from "path";
import { fileURLToPath } from "url";

// 获取当前 vite.config.ts 所在目录
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const versionPlugin = {
  name: "post-build-hash",
  closeBundle() {
    console.log("Vite build finished!");

    // 相对于 vite.config.ts 的路径
    const manifestPath = path.resolve(__dirname, "dist/.vite/manifest.json");
    if (!fs.existsSync(manifestPath)) {
      console.warn("manifest.json not found!");
      return;
    }

    const content = fs.readFileSync(manifestPath);
    const hash = crypto.createHash("sha256").update(content).digest("hex");
    const version = {
      hash,
      timeStamp: Date.now(),
    };

    // 写入 dist/manifest.hash
    const hashFile = path.resolve(__dirname, "dist/.vite/version.json");
    fs.writeFileSync(hashFile, JSON.stringify(version));
  },
};

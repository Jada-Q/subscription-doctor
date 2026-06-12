import { defineConfig } from "vite";

// GitHub Pages 部署在 /<repo>/ 子路径下，由 CI 注入 BASE_PATH；本地开发保持 /
export default defineConfig({
  base: process.env.BASE_PATH ?? "/",
});

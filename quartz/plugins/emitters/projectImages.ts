import { FilePath, joinSegments } from "../../util/path"
import { QuartzEmitterPlugin } from "../types"
import fs from "fs"
import path from "path"
import { glob } from "../../util/glob"

/**
 * ProjectImages —— 把仓库根目录的 `img/` 复制到构建产物的 `img/`
 * ----------------------------------------------------------------------------
 * 为什么不用 quartz/static/：
 *   Quartz 的 Static emitter 只认 quartz/static/，且输出带 static/ 前缀。
 *   项目自有图片（如 banner 默认图）希望 URL 干净（/img/...），故单列 emitter。
 *
 * 为什么必须读仓库内（process.cwd()/img）而不是仓库外的上级目录：
 *   本地构建 cwd = D:/website/quartz，上级是 D:/website（碰巧有 img/）；
 *   但 Cloudflare 干净构建时 cwd = CI 里的仓库根，上级目录是空的——
 *   曾因此导致线上 /img/banner_1.jpg 404、子页面 banner 空白。
 *   站点依赖的一切资源必须进 git 仓库，路径必须以 cwd（仓库根）为基准。
 *
 * 最终访问路径：/img/banner_1.jpg
 */
export const ProjectImages: QuartzEmitterPlugin = () => ({
  name: "ProjectImages",
  async *emit({ argv }) {
    // 仓库根目录 = 构建工作目录（本地与 Cloudflare CI 一致）
    const projectRoot = process.cwd()
    const srcDir = path.join(projectRoot, "img")

    if (!fs.existsSync(srcDir)) return

    const outputDir = joinSegments(argv.output, "img")
    await fs.promises.mkdir(outputDir, { recursive: true })

    const fps = await glob("**", srcDir, [])
    for (const fp of fps) {
      const src = path.join(srcDir, fp)
      if (!fs.statSync(src).isFile()) continue

      const dest = path.join(outputDir, fp)
      await fs.promises.mkdir(path.dirname(dest), { recursive: true })
      await fs.promises.copyFile(src, dest)
      yield dest as FilePath
    }
  },
  async *partialEmit() {},
})

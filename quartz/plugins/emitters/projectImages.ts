import { FilePath, joinSegments } from "../../util/path"
import { QuartzEmitterPlugin } from "../types"
import fs from "fs"
import path from "path"
import { glob } from "../../util/glob"

/**
 * ProjectImages —— 把项目根目录的 `img/` 复制到构建产物的 `img/`
 * ----------------------------------------------------------------------------
 * 为什么不用 quartz/static/：
 *   Quartz 的构建流程会清空 quartz/static/ 中以插件名命名的目录，
 *   放在那里的自定义图片会在下次构建时被删除。因此单列一个 emitter，
 *   从项目根的 img/ 读取，直接写入 output/img/。
 *
 * 最终访问路径：/img/banner_1.jpg
 */
export const ProjectImages: QuartzEmitterPlugin = () => ({
  name: "ProjectImages",
  async *emit({ argv }) {
    // 项目根目录（process.cwd() 即 quartz/ 的上级）
    const projectRoot = path.resolve(process.cwd(), "..")
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

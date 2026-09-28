# 图谱插件本地定制补丁

本目录是 `@quartz-community/graph@1.0.0`（node_modules 安装副本）的**本地 fork**，
在 `quartz.config.yaml` 中以 `source: ./local-plugins/graph` 引用，
构建时由插件加载器以 symlink 方式链接到 `.quartz/plugins/graph`。

## 定制需求

1. **节点标签始终显示**（原版：hover 才显示，或 zoom 放大到一定程度才渐显）
2. **hover 某节点时，显示其关联节点的名称**（原版：hover 只放大/显示被 hover 节点自己的标签）

## 改动明细（全部位于 `dist/index.js` 的内联渲染脚本）

| # | 原代码 | 改为 | 作用 |
|---|--------|------|------|
| A | `Du.anchor.set(.5,1.2),Du.alpha=0,` | `Du.alpha=1,` | 节点标签创建时直接可见（原为 alpha=0 隐藏）|
| B | `_u===v.simulationData.id?(v.label.alpha=1,v.label.scale.set(l)):v.label.scale.set(i)}` | `...(v.label.scale.set(i),v.label.alpha=_u===null?1:v.active?1:.55)}` | hover 逻辑：被 hover 节点高亮放大；**关联节点（active）标签 alpha=1**（显示关联名称）；无 hover 时全部恢复 alpha=1；与当前 hover 无关节点淡化至 0.55（仍可见）|
| C | `v.indexOf(T)===-1&&(T.alpha=F)}` | `v.indexOf(T)===-1&&(T.alpha=Math.max(F,.85))}` | zoom 缩小时标签保底 0.85 可见度，不再完全隐藏 |

变量说明（压缩后代码）：`_u`=当前 hover 节点 id（null=无），`v.active`=是否为 hover 节点的关联节点，`F`=zoom 推导出的标签透明度。

## 升级注意

若将来升级上游插件，需在新 dist 上重新应用这三处补丁。
原始未修改副本可随时从 `node_modules/@quartz-community/graph/dist/index.js` 对照。

## Windows 构建提示

插件加载器在 Windows 上用 `fs.symlinkSync(..., "dir")` 建链（需开发者模式/管理员）。
若构建报 symlink 权限错误，可手动用 junction 替代（无需管理员）：

```powershell
New-Item -ItemType Junction -Path .quartz\plugins\graph -Target ..\..\local-plugins\graph
```

加载器检测到已存在的正确链接会跳过重建。

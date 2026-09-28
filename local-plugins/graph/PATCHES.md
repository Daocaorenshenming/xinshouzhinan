# 图谱插件本地定制补丁

本目录是 `@quartz-community/graph@1.0.0`（node_modules 安装副本）的**本地 fork**，
在 `quartz.config.yaml` 中以 `source: ./local-plugins/graph` 引用，
构建时由插件加载器以 symlink 方式链接到 `.quartz/plugins/graph`。

## 定制需求（v2，2026-09-28）

1. **当前页面的节点文字永远显示**（局部图/全局图中的当前页节点）
2. **hover 某节点时：只显示被 hover 节点 + 1 步邻居（直接相连）的文字，其他节点文字隐藏**
3. 非 hover 状态下放大图谱（zoom in）时，其余标签按原版逻辑渐显（便于浏览全图）

## 改动明细（全部位于 `dist/index.js` 与 `dist/components/index.js` 的内联渲染脚本）

> 注意：两份文件是重复打包产物，**组件实际从 `./components` 子路径加载**，补丁必须两边同步打。

| # | 原代码 | 改为 | 作用 |
|---|--------|------|------|
| 1a | `for(var k=0;k<ru.length;k++){var iu=ru[k],ae=iu.id,` | 前插 `var $curLabel=null,$curId=we()===""?"/":we();` | `$curId`=当前页 slug。注意：节点 id 经过 `cu()` 规范化，**首页节点的 id 是 `"/"` 而非 `"index"`**（`we()` 对 `/` 返回空串，映射到 `"/"`）|
| 1b | `Du.anchor.set(.5,1.2),Du.alpha=0,` | `Du.alpha=ae===$curId?($curLabel=Du,1):0,` | 创建标签时：当前页节点 alpha=1（永远显示），其余 alpha=0 |
| 2 | `...(v.label.alpha=1,v.label.scale.set(l)):v.label.scale.set(i)}` | `:(v.label.scale.set(i),v.label.alpha=_u===null?(v.simulationData.id===$curId?1:0):v.active?1:0)}` | hover 更新：无 hover → 只显示当前页；hover X → X 邻居（active=1 步）显示，其他 0 |
| 3 | `v.indexOf(T)===-1&&(T.alpha=F)}` | `...&&(T.alpha=_u!==null?(T===$curLabel?1:0):F)}` | zoom 覆盖保护：hover 状态下严格邻域显示（当前页保底 1）；非 hover 保持原版 zoom 渐显 |

变量说明（压缩后代码）：`_u`=当前 hover 节点 id（null=无），`v.active`=是否为 hover 节点的 1 步邻居，`F`=zoom 推导的标签透明度，`we()`=当前页 slug。

### v1 → v2 变更记录

v1（标签全显 + hover 淡化 0.55）已废弃。v2 按新需求：常态只显示当前页标签，hover 展示 1 步邻域，其余隐藏。

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

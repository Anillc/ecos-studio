# ECOS GUI 从 Tauri 重构到 Electron 的架构设计

日期：2026-04-27

## 1. 背景

当前 `ecos/gui` 是一个基于 `Vue 3 + Vite + Tauri 2` 的桌面端 GUI。现状中，桌面运行时能力分散在两处：

- 前端 renderer 直接调用 Tauri API
- `src-tauri` 中的 Rust 壳层负责窗口、权限、本地文件访问、FastAPI 子进程和部分本地预处理能力

这种结构在从 Tauri 迁移到 Electron 时会暴露出几个问题：

- renderer 与桌面壳层强耦合，难以平滑替换运行时
- Tauri 命令、前端 `invoke(...)` payload、事件名和返回值缺少统一 contract
- 与 UI 强相关的本地能力、桌面壳逻辑和通用后端能力存在职责混杂
- 当前打包链路围绕 Tauri 建立，无法直接复用到 Electron

本次工作不仅是“换壳”，而是借迁移机会对 `ecos/gui` 做一次边界清晰的内部重构。

## 2. 设计目标

### 2.1 目标

1. 将桌面壳从 Tauri 替换为 Electron
2. 目标平台先限定为 Linux
3. 后续开发集中在 `ecos/gui` 目录内完成
4. 不保留浏览器独立开发模式，开发模式收敛为 Electron-only
5. 移除目标架构中对 Rust 桌面壳的依赖
6. 将 renderer、桌面壳、共享协议、本地 helper 的职责边界做硬
7. 保持现有关键用户能力可用：
   - 打开/创建工程
   - 最近工程与设置持久化
   - PDK 目录选择
   - 自定义窗口控制
   - FastAPI 子进程管理
   - layout tile 生成与缓存
   - Linux 打包发布

### 2.2 非目标

1. 第一阶段不覆盖 Windows 或 macOS
2. 第一阶段不设计浏览器独立运行的 fallback
3. 第一阶段不把 GUI 拆到 `ecos/` 顶层多个平级产品目录
4. 第一阶段不追求把所有本地 helper 都抽成单独外部仓库
5. 第一阶段不改动 FastAPI 业务接口本身，除非为 Electron 集成必须调整

## 3. 关键约束与选择

本次设计已确认以下决策：

- 平台范围：仅 Linux
- 目标优先级：借迁移顺手做架构清理，而不是最短路径跑通
- 工作范围：仍集中在 `ecos/gui`
- 结构策略：采用方案 C 的思路，但在 `ecos/gui` 内做多包式硬分层
- 瓦片生成与缓存：不迁回 FastAPI，不继续糊在桌面壳中，而是保留为桌面侧本地 helper 能力

## 4. 当前架构痛点

从当前代码可观察到以下耦合：

- renderer 中多个文件直接依赖 Tauri API，例如：
  - `src/composables/useWorkspace.ts`
  - `src/composables/useLayoutTileGen.ts`
  - `src/components/TopBar.vue`
  - `src/App.vue`
- `src-tauri/src/main.rs` 同时承担：
  - 窗口生命周期和命令注册
  - FastAPI 子进程启动/端口发现/退出清理
  - project root 权限登记与路径校验
  - layout tile 相关命令入口
- `src-tauri/src/tile_cache.rs` 与 `src-tauri/src/gen_layout_tiles.rs` 实现的是偏本地 UI 预处理的能力，但当前被绑定在壳层内部
- `ecos/scripts/build-gui.sh` 完全围绕 Tauri 产物与打包流程设计

如果直接原地把 Tauri 调用替换成 Electron API，只会把耦合从一种 runtime 复制到另一种 runtime，长期维护成本不会显著下降。

## 5. 目标目录结构

目标是在 `ecos/gui` 内形成内部 workspace，所有开发入口仍从这里发起。

```text
ecos/gui/
  package.json
  pnpm-workspace.yaml

  apps/
    renderer/
      src/
      package.json
      vite.config.ts

    desktop-electron/
      electron/
        main/
        preload/
        ipc/
        services/
      package.json
      electron-builder.yml

  packages/
    shared/
      src/
        contracts/
        types/
        constants/
      package.json

    tile-helper/
      src/
      package.json

  scripts/
  docs/
```

## 6. 包职责边界

### 6.1 `apps/renderer`

负责：

- Vue 页面、组件、路由、Pinia、编辑器 UI
- 与 FastAPI 的 HTTP / SSE 通信
- 调用共享 contract 定义的桌面能力接口

不负责：

- 直接引用 `electron` 或 `node:*`
- 直接访问文件系统、窗口对象或本地子进程
- 直接定义一套临时 IPC 协议

### 6.2 `apps/desktop-electron`

负责：

- Electron `main` / `preload`
- BrowserWindow 生命周期
- 菜单、窗口控制、外链打开、原生 dialog
- IPC handler
- FastAPI 子进程管理
- project scope 守卫
- Linux 打包与应用启动入口

不负责：

- Vue 业务状态和页面逻辑
- 承载复杂领域算法本体

### 6.3 `packages/shared`

负责：

- renderer 与 Electron 之间共享的类型
- IPC contract、事件名、错误码、常量
- 统一定义桌面能力接口

不负责：

- 运行时副作用
- Electron 依赖
- 文件访问、进程启动、窗口控制的实际实现

### 6.4 `packages/tile-helper`

负责：

- layout tile 生成
- tile cache 命中判断
- 输出目录与 manifest 生成
- 提供可被 Electron 调度的本地 helper 能力

不负责：

- 窗口、原生权限 UI
- 前端状态管理
- 直接暴露给 renderer 使用

## 7. 依赖方向约束

目标依赖方向如下：

- `apps/renderer -> packages/shared`
- `apps/desktop-electron -> packages/shared`
- `apps/desktop-electron -> packages/tile-helper`
- `packages/tile-helper -> packages/shared`（可选）

明确禁止：

- `apps/renderer -> apps/desktop-electron`
- `apps/renderer -> packages/tile-helper`
- `packages/shared -> electron`

这样做的目的，是把“边界”从约定升级为包级约束，避免 renderer 再次直接侵入桌面 runtime。

## 8. 运行时架构

迁移后的目标分层如下：

1. Renderer 层
2. Desktop Bridge 层
3. Electron Main Services 层
4. Backend Processes / Local Helpers 层

### 8.1 Renderer 层

- 负责 UI 渲染与交互状态
- 通过 `packages/shared` 中定义的 contract 调用桌面能力
- 不持有 Electron/Node 对象

### 8.2 Desktop Bridge 层

- 通过 preload 暴露类型安全 API 给 renderer
- 对外提供稳定能力面，例如：
  - `window.minimize()`
  - `window.maximize()`
  - `window.close()`
  - `workspace.openProject()`
  - `system.openExternal(url)`
  - `tiles.generate(...)`

### 8.3 Electron Main Services 层

- 接住 preload 发来的 IPC 调用
- 承担窗口对象操作与系统 API 接入
- 管理 FastAPI 子进程
- 调度 tile helper
- 执行 project root 范围校验

### 8.4 Backend Processes / Local Helpers 层

- FastAPI：继续承载业务 API
- Tile helper：承载本地 tile 预处理与缓存

## 9. 关键运行流

### 9.1 打开/创建工程

1. renderer 发起用户意图
2. preload 调用 Electron main 的 workspace service
3. main 负责：
   - 目录选择
   - 路径规范化
   - 最近工程持久化
   - project scope 校验
   - 启动或复用 FastAPI
4. main 返回 `workspaceId`、`projectPath`、`apiPort`
5. renderer 再建立 HTTP / SSE 连接

### 9.2 layout tile 生成

1. renderer 调用共享 contract，例如 `generateTiles(stepKey, layoutJsonPath)`
2. Electron main 校验参数并调度 tile helper
3. tile helper 负责：
   - layout JSON 路径解析
   - cache key 计算
   - 目录准备
   - manifest / tile 产出
4. main 返回可安全消费的本地资源入口给 renderer

### 9.3 窗口与系统能力

renderer 只能表达意图：

- 最小化
- 最大化/还原
- 关闭
- 设置标题
- 打开外链

真正的窗口对象只存在于 Electron main。

## 10. 错误模型与失败兜底

目标是把当前散落在多处的底层异常，统一收敛为结构化错误。

### 10.1 统一原则

- IPC 返回稳定错误对象，而不是直接抛底层字符串
- renderer 只处理业务可见的错误状态和 toast 展示
- Electron main 负责底层资源回收与超时管理

### 10.2 需要稳定建模的错误类别

- FastAPI 启动失败
- 端口冲突
- 工程目录无效
- project scope 越界访问
- 设置存取失败
- tile 生成失败
- tile cache 目录写入失败
- 外链/系统调用失败

### 10.3 子进程生命周期要求

- Electron main 负责子进程创建、健康检查、退出清理
- 应用关闭或窗口销毁时要正确释放 FastAPI 进程
- 端口发现失败或健康检查超时时，renderer 能得到可重试的错误

## 11. 迁移顺序

推荐按“先拆结构，再迁能力，最后删旧壳”的顺序推进。

### 阶段 1：建立内部 workspace 结构

- 在 `ecos/gui` 下建立 `apps/` 与 `packages/`
- 建立 workspace 管理和新的开发命令
- 暂不迁移具体业务能力

### 阶段 2：迁移 renderer

- 将现有 Vue 应用主体迁入 `apps/renderer`
- 先保持行为不变
- 暂时允许适配层存在，但开始停止新增 Tauri 直连

### 阶段 3：抽出 shared contract

- 统一定义 IPC contract、类型、事件名、错误模型
- 收口现有 `invoke(...)` 命令与 payload

### 阶段 4：建立最小可运行 Electron 壳

- 搭建 `main`、`preload`、基础 BrowserWindow
- 跑通 renderer 加载

### 阶段 5：按能力分片迁移

建议顺序：

1. 窗口与菜单
2. dialog / fs / path / settings / project scope
3. FastAPI 子进程管理
4. tile helper

### 阶段 6：删除 Tauri

- 删除 `src-tauri/`
- 删除 `@tauri-apps/*` 依赖
- 删除 Tauri 打包与构建脚本
- 切换到 Electron dev/build/release 流程

## 12. 主要风险

### 12.1 结构迁移与能力迁移交叉过多

风险：同时改目录结构、runtime 和业务逻辑，会让迁移难以验证。  
对策：每一步只解决一个维度的问题。

### 12.2 旧 renderer 继续偷偷直连 runtime

风险：迁到 Electron 后仍然保留隐式强耦合。  
对策：通过包边界、依赖约束和共享 contract 收口。

### 12.3 tile helper 被重新塞回壳层

风险：Electron main 变成新的“大泥球”。  
对策：明确 main 只调度，不承担 tile 算法主体。

### 12.4 Linux 打包链中断

风险：开发环境迁完了，但无法产出桌面包。  
对策：尽早定义 Electron 打包入口与资源注入方式，避免把发布链留到最后才收拾。

## 13. 验收标准

满足以下条件时，视为迁移完成：

1. 在 `ecos/gui` 内可以通过新命令启动 Electron 开发环境
2. 创建/打开工程、最近工程、PDK 选择、窗口标题、菜单和自定义窗口控制正常
3. FastAPI 子进程启动、健康检查、端口发现与退出清理正常
4. layout tile 生成与缓存能力不低于当前 Tauri 版本
5. Linux 打包链可产出可安装桌面应用
6. renderer 代码中不再直接依赖 Tauri 或 Electron runtime API

## 14. 后续实现原则

1. 优先把 contract 和边界做清楚，再做底层实现替换
2. 优先让 Electron main 成为调度层，而不是新的业务聚合层
3. 对 renderer 的成功标准不是“能编译”，而是“不能再直接碰桌面 runtime”
4. tile helper 的成功标准不是“从 Rust 改写成 Node”，而是“职责位置正确且可被独立演进”

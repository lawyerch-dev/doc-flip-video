# 转场效果参考

## 转场类型

| 类型         | 说明                 | 要求                                      |
| ------------ | -------------------- | ----------------------------------------- |
| `builtin`    | FFmpeg 内置转场      | 标准 FFmpeg                               |
| `expression` | 需要 expression 文件 | 标准 FFmpeg + `vendor/xfade-easing/expr/` |
| `glsl`       | GLSL 着色器转场      | 自定义 FFmpeg (`build/ffmpeg-custom`)     |

## 标准转场 (builtin)

这些转场在任何 FFmpeg 环境下都可用：

| 名称          | FFmpeg 名称 | 说明     |
| ------------- | ----------- | -------- |
| `fade`        | dissolve    | 淡入淡出 |
| `wipeleft`    | wipeleft    | 向左擦除 |
| `wiperight`   | wiperight   | 向右擦除 |
| `wipeup`      | wipeup      | 向上擦除 |
| `wipedown`    | wipedown    | 向下擦除 |
| `slideleft`   | slideleft   | 向左滑动 |
| `slideright`  | slideright  | 向右滑动 |
| `slideup`     | slideup     | 向上滑动 |
| `slidedown`   | slidedown   | 向下滑动 |
| `pushleft`    | pushleft    | 向左推挤 |
| `pushright`   | pushright   | 向右推挤 |
| `pushup`      | pushup      | 向上推挤 |
| `pushdown`    | pushdown    | 向下推挤 |
| `coverleft`   | coverleft   | 向左覆盖 |
| `coverright`  | coverright  | 向右覆盖 |
| `coverup`     | coverup     | 向上覆盖 |
| `coverdown`   | coverdown   | 向下覆盖 |
| `revealleft`  | revealleft  | 向左揭开 |
| `revealright` | revealright | 向右揭开 |
| `revealup`    | revealup    | 向上揭开 |
| `revealdown`  | revealdown  | 向下揭开 |

## Expression 转场

这些转场需要 `vendor/xfade-easing/expr/` 目录下的 expression 文件：

| 名称          | 说明       |
| ------------- | ---------- |
| `circleclose` | 圆形关闭   |
| `circleopen`  | 圆形打开   |
| `horzclose`   | 水平关闭   |
| `horzopen`    | 水平打开   |
| `vertclose`   | 垂直关闭   |
| `vertopen`    | 垂直打开   |
| `diagbl`      | 左下对角线 |
| `diagbr`      | 右下对角线 |
| `diagtl`      | 左上对角线 |
| `diagtr`      | 右上对角线 |
| `hlslice`     | 水平左切片 |
| `hrslice`     | 水平右切片 |
| `vuslice`     | 垂直上切片 |
| `vdslice`     | 垂直下切片 |
| `radial`      | 径向       |
| `smoothleft`  | 平滑向左   |
| `smoothright` | 平滑向右   |
| `smoothup`    | 平滑向上   |
| `smoothdown`  | 平滑向下   |
| `circlecrop`  | 圆形裁剪   |
| `zoomin`      | 放大进入   |

## GLSL 转场

这些转场需要自定义 FFmpeg (`build/ffmpeg-custom`)：

### 翻页类

| 名称          | FFmpeg 名称         | 说明                   |
| ------------- | ------------------- | ---------------------- |
| `page-curl`   | gl_InvertedPageCurl | 翻页效果               |
| `simple-curl` | gl_SimplePageCurl   | 简单翻页（可配置方向） |
| `book-curl`   | gl_SimpleBookCurl   | 书本翻页               |

### 3D 类

| 名称      | FFmpeg 名称 | 说明      |
| --------- | ----------- | --------- |
| `cube`    | gl_cube     | 3D 立方体 |
| `doorway` | gl_doorway  | 门道效果  |
| `flip`    | gl_Flip     | 翻转      |

### 几何类

| 名称        | FFmpeg 名称  | 说明   |
| ----------- | ------------ | ------ |
| `diamond`   | gl_Diamond   | 菱形   |
| `bowtie`    | gl_Bowtie    | 蝴蝶结 |
| `butterfly` | gl_Butterfly | 蝴蝶   |
| `circle`    | gl_Circle    | 圆形   |
| `pinwheel`  | gl_Pinwheel  | 风车   |
| `polar`     | gl_Polar     | 极坐标 |
| `star`      | gl_StarWipe  | 星形   |

### 动画类

| 名称       | FFmpeg 名称 | 说明     |
| ---------- | ----------- | -------- |
| `bounce`   | gl_Bounce   | 弹跳     |
| `wind`     | gl_Wind     | 风吹     |
| `swap`     | gl_Swap     | 交换     |
| `squeezeh` | gl_SqueezeH | 水平挤压 |
| `squeezev` | gl_SqueezeV | 垂直挤压 |

### 自然类

| 名称      | FFmpeg 名称      | 说明     |
| --------- | ---------------- | -------- |
| `flower`  | gl_Flower        | 花朵     |
| `fan-in`  | gl_FanIn         | 扇形进入 |
| `fan-out` | gl_FanOut        | 扇形退出 |
| `fan-up`  | gl_FanUp         | 向上扇形 |
| `curtain` | gl_StageCurtains | 舞台幕布 |

### 特效类

| 名称                | FFmpeg 名称          | 说明     |
| ------------------- | -------------------- | -------- |
| `bars`              | gl_Bars              | 条纹     |
| `cross-out`         | gl_CrossOut          | 十字退出 |
| `corner-vanish`     | gl_CornerVanish      | 角落消失 |
| `stripe-wipe`       | gl_Stripe_Wipe       | 条纹擦除 |
| `exponential-swish` | gl_Exponential_Swish | 指数甩动 |

### 随机

| 名称     | FFmpeg 名称 | 说明         |
| -------- | ----------- | ------------ |
| `random` | gl_random   | 随机选择转场 |

## 缓动函数

所有转场都支持以下缓动函数：

| 名称             | 说明                 |
| ---------------- | -------------------- |
| `linear`         | 线性                 |
| `ease`           | 缓动                 |
| `ease-in`        | 缓入                 |
| `ease-out`       | 缓出                 |
| `ease-in-out`    | 缓入缓出             |
| `cubic-in`       | 三次缓入             |
| `cubic-out`      | 三次缓出             |
| `cubic-in-out`   | 三次缓入缓出（默认） |
| `quad-in`        | 二次缓入             |
| `quad-out`       | 二次缓出             |
| `quad-in-out`    | 二次缓入缓出         |
| `sine-in`        | 正弦缓入             |
| `sine-out`       | 正弦缓出             |
| `sine-in-out`    | 正弦缓入缓出         |
| `expo-in`        | 指数缓入             |
| `expo-out`       | 指数缓出             |
| `expo-in-out`    | 指数缓入缓出         |
| `elastic-in`     | 弹性缓入             |
| `elastic-out`    | 弹性缓出             |
| `elastic-in-out` | 弹性缓入缓出         |
| `back-in`        | 回弹缓入             |
| `back-out`       | 回弹缓出             |
| `back-in-out`    | 回弹缓入缓出         |
| `bounce-in`      | 弹跳缓入             |
| `bounce-out`     | 弹跳缓出             |
| `bounce-in-out`  | 弹跳缓入缓出         |

## 使用示例

### 工作流 JSON 中使用转场

```json
{
  "effects": [
    {
      "type": "transition",
      "params": {
        "duration": 2.5,
        "transition": "page-curl",
        "easing": "cubic-in-out"
      }
    }
  ]
}
```

### 使用 GLSL 转场带参数

```json
{
  "effects": [
    {
      "type": "transition",
      "params": {
        "duration": 2.0,
        "transition": "simple-curl",
        "easing": "cubic-in-out",
        "extraParams": {
          "angle": 30,
          "radius": 0.15,
          "roll": 1
        }
      }
    }
  ]
}
```

### 使用随机转场

```json
{
  "effects": [
    {
      "type": "transition",
      "params": {
        "duration": 2.0,
        "transition": "random"
      }
    }
  ]
}
```

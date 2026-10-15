// The studio's models in one place: the name people see, what each one makes and who makes it. Everything that shows a model's
// name reads it from here (the price table, /v1/config.registry for the page). The engine model behind each id and the lengths it
// can really make live with the engine (providers/kie.js: KIE_BUILTIN, kieDur); prices live in lib/billing.js.
const V = (name, maker) => ({ kind: "video", name, maker }), I = (name, maker) => ({ kind: "image", name, maker });
export const REGISTRY = {
  auto: V("nooi Auto", "nooi"),
  kling40: V("Kling 3.0", "Kuaishou"), kling30: V("Kling 3.0", "Kuaishou"), kling: V("Kling", "Kuaishou"), kling26: V("Kling 2.6", "Kuaishou"),
  seedance25: V("Seedance 2.5", "ByteDance"), seedance20: V("Seedance 2.0", "ByteDance"), seedance: V("Seedance 2 Fast", "ByteDance"),
  hailuoh3: V("MiniMax H3", "MiniMax"), hailuo: V("MiniMax", "MiniMax"),
  wan30: V("WAN 3.0", "Alibaba"), wan27: V("WAN 2.7", "Alibaba"), wan22: V("WAN 2.2", "Alibaba"), qwenwan: V("Qwen WAN", "Alibaba"), hunyuan: V("HunyuanVideo", "Tencent"),
  ltx23: V("LTX-2.3", "Lightricks"), ltxfast: V("LTX Fast", "Lightricks"),
  veo: V("Veo 3", "Google"), veofast: V("Veo 3 Fast", "Google"), veo31: V("Veo 3.1", "Google"), veo31f: V("Veo 3.1 Fast", "Google"),
  grok: V("Grok Imagine", "xAI"), pixverse6: V("PixVerse 6", "PixVerse"),
  // v83: faster / cheaper engines and Motion Control (a character performs the movement of a video)
  kling30t: V("Kling 3.0 Turbo", "Kuaishou"), seedance2mini: V("Seedance 2.0 Mini", "ByteDance"), gemomni: V("Gemini Omni Video", "Google"), grok15: V("Grok Imagine 1.5", "xAI"),
  happyhorse: V("HappyHorse", "Alibaba"), mc26: V("Motion Control 2.6", "Kuaishou"), mc30: V("Motion Control 3.0", "Kuaishou"),
  dotimg: I("nooi Image", "nooi"), nano: I("Nano Banana", "Google"), nanopro: I("Nano Banana Pro", "Google"), img20: I("GPT Image 2", "OpenAI"),
  img25: I("Seedream 4.5", "ByteDance"), seedream5: I("Seedream 5", "ByteDance"), qwen: I("Qwen Image", "Alibaba"), qwen2: I("Qwen Image 2", "Alibaba"),
  flux: I("FLUX.1 dev", "Black Forest Labs"), flux2: I("FLUX.2", "Black Forest Labs"), sdxl: I("SDXL", "Stability AI"), mj: I("Midjourney", "Midjourney"),
  imagen4: I("Imagen 4", "Google"), ideogram3: I("Ideogram 3", "Ideogram"), grokimg: I("Grok Image", "xAI"),
  nano2lite: I("Nano Banana 2 Lite", "Google"), seedream5lite: I("Seedream 5 Lite", "ByteDance"), zimage: I("Z-Image", "Z.ai"),
};
export const modelNames = () => Object.fromEntries(Object.entries(REGISTRY).map(([k, v]) => [k, v.name]));
export const publicRegistry = () => Object.fromEntries(Object.entries(REGISTRY).map(([k, v]) => [k, { kind: v.kind, name: v.name, maker: v.maker }]));

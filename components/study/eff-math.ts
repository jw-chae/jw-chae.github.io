/** Arithmetic behind the efficiency chapter: one conv layer counted four ways (parameters, multiply-adds, bytes, time)
 *  on a hand-set device, then the published numbers of RepViT and YOLOv10 that the prose quotes. Import-free so node can run it. */

/* ---- the hand-set device and counting rule ---- */

/** Two bytes per number, as in 16-bit inference. */
export const BYTES = 2;
/** A device made up for illustration: 4 trillion floating-point operations per second, 40 GB per second from memory. */
export type Device = { peak: number; bw: number };
export const DEVICE: Device = { peak: 4e12, bw: 40e9 };
/** FLOP per byte at which the two limits meet. */
export const ridge = (d: Device = DEVICE) => d.peak / d.bw;

/** One step the device runs on its own: weights it reads, multiply-adds, other operations, activation numbers it reads and writes, per image. */
export type Step = { name: string; weights: number; macs: number; other: number; read: number; write: number };

/** A k×k convolution on an H×H map, stride 1, padding so the map keeps its size, no bias. Depthwise: one k×k filter per channel. */
export function conv(name: string, H: number, cin: number, cout: number, k: number, depthwise = false): Step {
  const weights = depthwise ? k * k * cin : k * k * cin * cout;
  const outC = depthwise ? cin : cout;
  return { name, weights, macs: (depthwise ? k * k : k * k * cin) * H * H * outC, other: 0, read: H * H * cin, write: H * H * outC };
}

/** Elementwise add of two H×H×C maps written to a third. */
export const addStep = (name: string, H: number, C: number): Step => ({ name, weights: 0, macs: 0, other: H * H * C, read: 2 * H * H * C, write: H * H * C });

/** Two steps run as one: the map between them never leaves the chip. */
export const fuse = (name: string, a: Step, b: Step): Step => ({ name, weights: a.weights + b.weights, macs: a.macs + b.macs, other: a.other + b.other, read: a.read, write: b.write });

export type Cost = { flops: number; bytes: number; wBytes: number; aBytes: number; compute: number; memory: number; time: number; bound: "compute" | "memory"; intensity: number };

/** Counting rule: weights are read once per call, every activation number is read or written once, and inside one step
 *  computing and moving overlap, so the step takes the longer of the two. Times in microseconds. */
export function cost(s: Step, n = 1, d: Device = DEVICE): Cost {
  const flops = n * (2 * s.macs + s.other);
  const wBytes = s.weights * BYTES, aBytes = n * (s.read + s.write) * BYTES, bytes = wBytes + aBytes;
  const compute = (flops / d.peak) * 1e6, memory = (bytes / d.bw) * 1e6;
  return { flops, bytes, wBytes, aBytes, compute, memory, time: Math.max(compute, memory), bound: compute >= memory ? "compute" : "memory", intensity: flops / bytes };
}

/** Steps run one after another: times add. */
export function seqCost(steps: Step[], n = 1, d: Device = DEVICE) {
  const parts = steps.map((s) => cost(s, n, d));
  const flops = parts.reduce((a, p) => a + p.flops, 0), bytes = parts.reduce((a, p) => a + p.bytes, 0), time = parts.reduce((a, p) => a + p.time, 0);
  return { parts, flops, bytes, time, intensity: flops / bytes, achieved: flops / (time * 1e-6) };
}

/* ---- 01 · the running example: the 3×3 conv in the middle of a ResNet-50 layer1 block ---- */

export const L1 = conv("3×3 conv, 56×56, 64→64", 56, 64, 64, 3);
/** Multiply-adds behind one output number: a 3×3 window on every one of the 64 input channels. */
export const MACS_PER_OUT = 3 * 3 * 64;
export const OUT_NUMBERS = 56 * 56 * 64;
export const POSITIONS = 56 * 56;
/** One change at a time. */
export const VARIANTS: Step[] = [
  L1,
  conv("해상도 절반", 28, 64, 64, 3),
  conv("채널 두 배", 56, 128, 128, 3),
  conv("1×1 커널", 56, 64, 64, 1),
];

/* ---- 02 · bytes and time on the hand-set device ---- */

export const L1_COST = cost(L1);
/** Bandwidth below which this layer waits on memory rather than on arithmetic. */
export const L1_CROSS_GBS = L1_COST.bytes / (L1_COST.compute * 1e-6) / 1e9;
export const BW_STEPS = [10, 15, 20, 25, 30, 35, 40, 50, 60, 80];
export const withBw = (gbs: number): Device => ({ peak: DEVICE.peak, bw: gbs * 1e9 });

/* ---- 03 · depthwise 3×3 plus pointwise 1×1 ---- */

export const DW = conv("depthwise 3×3", 56, 64, 64, 3, true);
export const PW = conv("pointwise 1×1", 56, 64, 64, 1);
export const SEP_FUSED = fuse("depthwise + pointwise, 한 단계", DW, PW);
/** MobileNet's ratio of costs, 1/N + 1/D_K², for N = 64 output channels and a 3×3 kernel. */
export const MOBILENET_RATIO = 1 / 64 + 1 / 9;
export const SEP_BW = [20, 40, 80];
export function sepCompare(gbs: number) {
  const d = withBw(gbs);
  const std = seqCost([L1], 1, d), fused = seqCost([SEP_FUSED], 1, d), split = seqCost([DW, PW], 1, d);
  return { std, fused, split, speedFused: std.time / fused.time, speedSplit: std.time / split.time };
}

/* ---- 04 · same multiply-adds, different layer: the 3×3 conv in the middle of a ResNet-50 layer4 block ---- */

export const L4 = conv("3×3 conv, 7×7, 512→512", 7, 512, 512, 3);
export const L4_COST = cost(L4);

/* ---- 05 · batch: latency and throughput ---- */

export const BATCHES = [1, 2, 4, 8, 16];
export function batchRow(s: Step, n: number) {
  const c = cost(s, n);
  return { n, time: c.time, perSec: n / (c.time * 1e-6), bound: c.bound, compute: c.compute, memory: c.memory, held: c.bytes, wBytes: c.wBytes, aBytes: c.aBytes };
}
/** Smallest batch at which L1 holds more bytes than L4 (weights + input and output maps of the whole batch). */
export const HOLD_CROSS = (() => { for (let n = 1; n < 64; n++) if (cost(L1, n).bytes > cost(L4, n).bytes) return n; return -1; })();

/* ---- 06 · RepViT Table 1 (arXiv 2307.09283 v8): latency on iPhone 12, iOS 16, Core ML Tools, batch 1; throughput on an RTX 3090 at the largest power-of-two batch ---- */

export type RepRow = { name: string; family: "RepViT" | "EfficientFormerV2" | "EfficientFormer" | "FastViT" | "SwiftFormer" | "MobileViG"; params: number; gmacs: number; ms: number; thr: number; top1: number };
export const REPVIT_TABLE: RepRow[] = [
  { name: "MobileViG-Ti", family: "MobileViG", params: 5.2, gmacs: 0.7, ms: 1.0, thr: 4337, top1: 75.7 },
  { name: "FastViT-T8", family: "FastViT", params: 3.6, gmacs: 0.7, ms: 0.9, thr: 3909, top1: 76.7 },
  { name: "SwiftFormer-XS", family: "SwiftFormer", params: 3.5, gmacs: 0.6, ms: 1.0, thr: 4304, top1: 75.7 },
  { name: "EfficientFormerV2-S0", family: "EfficientFormerV2", params: 3.5, gmacs: 0.4, ms: 0.9, thr: 1274, top1: 75.7 },
  { name: "RepViT-M0.9", family: "RepViT", params: 5.1, gmacs: 0.8, ms: 0.9, thr: 4817, top1: 78.7 },
  { name: "RepViT-M1.0", family: "RepViT", params: 6.8, gmacs: 1.1, ms: 1.0, thr: 3910, top1: 80.0 },
  { name: "MobileViG-S", family: "MobileViG", params: 7.2, gmacs: 1.0, ms: 1.2, thr: 2985, top1: 78.2 },
  { name: "EfficientFormer-L1", family: "EfficientFormer", params: 12.3, gmacs: 1.3, ms: 1.4, thr: 3360, top1: 79.2 },
  { name: "SwiftFormer-S", family: "SwiftFormer", params: 6.1, gmacs: 1.0, ms: 1.2, thr: 3376, top1: 78.5 },
  { name: "EfficientFormerV2-S1", family: "EfficientFormerV2", params: 6.1, gmacs: 0.7, ms: 1.1, thr: 1153, top1: 79.0 },
  { name: "RepViT-M1.1", family: "RepViT", params: 8.2, gmacs: 1.3, ms: 1.1, thr: 3604, top1: 80.7 },
  { name: "MobileViG-M", family: "MobileViG", params: 14.0, gmacs: 1.5, ms: 1.6, thr: 2491, top1: 80.6 },
  { name: "FastViT-S12", family: "FastViT", params: 8.8, gmacs: 1.8, ms: 1.5, thr: 2313, top1: 80.9 },
  { name: "FastViT-SA12", family: "FastViT", params: 10.9, gmacs: 1.9, ms: 1.8, thr: 2181, top1: 81.9 },
  { name: "SwiftFormer-L1", family: "SwiftFormer", params: 12.1, gmacs: 1.6, ms: 1.6, thr: 2576, top1: 80.9 },
  { name: "EfficientFormerV2-S2", family: "EfficientFormerV2", params: 12.6, gmacs: 1.3, ms: 1.6, thr: 611, top1: 81.6 },
  { name: "RepViT-M1.5", family: "RepViT", params: 14.0, gmacs: 2.3, ms: 1.5, thr: 2151, top1: 82.3 },
  { name: "MobileViG-B", family: "MobileViG", params: 26.7, gmacs: 2.8, ms: 2.7, thr: 1446, top1: 82.6 },
  { name: "EfficientFormer-L3", family: "EfficientFormer", params: 31.3, gmacs: 3.9, ms: 2.7, thr: 1422, top1: 82.4 },
  { name: "EfficientFormer-L7", family: "EfficientFormer", params: 82.1, gmacs: 10.2, ms: 6.6, thr: 619, top1: 83.3 },
  { name: "SwiftFormer-L3", family: "SwiftFormer", params: 28.5, gmacs: 4.0, ms: 2.9, thr: 1474, top1: 83.0 },
  { name: "EfficientFormerV2-L", family: "EfficientFormerV2", params: 26.1, gmacs: 2.6, ms: 2.7, thr: 399, top1: 83.3 },
  { name: "RepViT-M2.3", family: "RepViT", params: 22.9, gmacs: 4.5, ms: 2.3, thr: 1184, top1: 83.3 },
];
export const repRow = (name: string) => REPVIT_TABLE.find((r) => r.name === name)!;
/** The three rows at 1.3 GMACs, and the pair that ties at 0.9 ms. */
export const REP_SAME_MACS = REPVIT_TABLE.filter((r) => r.gmacs === 1.3).map((r) => r.name);
export const REP_TIE = ["EfficientFormerV2-S0", "RepViT-M0.9"];
/** Roadmap from MobileNetV3-L (Section 3): first and last step, latency on iPhone 12 and top-1. */
export const REP_ROADMAP = { start: { ms: 1.01, top1: 71.5 }, end: { ms: 0.87, top1: 77.4 } };

/* ---- 07 · YOLOv10 Table 1 (arXiv 2405.14458 v2): T4 GPU, TensorRT FP16, batch 1, COCO val average; Latency includes post-processing, Latency^f is the forward pass only ---- */

export type YoloRow = { name: string; params: number; gflops: number; ap: number; ms: number; msF: number };
export const YOLO_TABLE: YoloRow[] = [
  { name: "YOLOv9-C", params: 25.3, gflops: 102.1, ap: 52.5, ms: 10.57, msF: 6.13 },
  { name: "YOLOv10-B", params: 19.1, gflops: 92.0, ap: 52.5, ms: 5.74, msF: 5.67 },
  { name: "YOLOv8-N", params: 3.2, gflops: 8.7, ap: 37.3, ms: 6.16, msF: 1.77 },
  { name: "YOLOv10-N", params: 2.3, gflops: 6.7, ap: 38.5, ms: 1.84, msF: 1.79 },
  { name: "YOLOv8-S", params: 11.2, gflops: 28.6, ap: 44.9, ms: 7.07, msF: 2.33 },
  { name: "YOLOv10-S", params: 7.2, gflops: 21.6, ap: 46.3, ms: 2.49, msF: 2.39 },
];
export const yoloRow = (name: string) => YOLO_TABLE.find((r) => r.name === name)!;
export const YOLO_PAIRS: [string, string][] = [["YOLOv9-C", "YOLOv10-B"], ["YOLOv8-N", "YOLOv10-N"], ["YOLOv8-S", "YOLOv10-S"]];
/** Change from the older model to YOLOv10, as a share of the older value (negative = smaller). */
export function yoloChange(a: string, b: string) {
  const x = yoloRow(a), y = yoloRow(b), ch = (p: number, q: number) => (q - p) / p;
  return { params: ch(x.params, y.params), gflops: ch(x.gflops, y.gflops), msF: ch(x.msF, y.msF), ms: ch(x.ms, y.ms), postA: x.ms - x.msF, postB: y.ms - y.msF, postShareA: (x.ms - x.msF) / x.ms };
}

/* ---- 08 · one more branch: the shortcut around the running conv ---- */

export const ADD = addStep("더하기", 56, 64);
export const BRANCH = (() => {
  const one = seqCost([L1]), two = seqCost([L1, ADD]);
  const sepOne = seqCost([SEP_FUSED]), sepTwo = seqCost([SEP_FUSED, ADD]);
  /** Add folded into the conv step: the conv step reads x once more for the shortcut and writes only the sum. */
  const foldL1 = cost({ ...L1, other: ADD.other, read: L1.read * 2 }), foldSep = cost({ ...SEP_FUSED, other: ADD.other, read: SEP_FUSED.read * 2 });
  return {
    one, two, sepOne, sepTwo, foldL1, foldSep,
    timeUp: two.time / one.time - 1, flopsUp: two.flops / one.flops - 1, sepTimeUp: sepTwo.time / sepOne.time - 1,
    foldL1Up: foldL1.time / one.time - 1, foldSepUp: foldSep.time / sepOne.time - 1,
  };
})();

/* ---- derived numbers the prose quotes ---- */

export const DERIVED = (() => {
  const c = L1_COST, c10 = cost(L1, 1, withBw(10)), r = sepCompare(40);
  const bytes8 = L1.weights + L1.read + L1.write;   // one byte per number
  const rr = (n: string) => repRow(n);
  return {
    actShare: c.aBytes / c.bytes, weightShare: c.wBytes / c.bytes,
    idleAt10: 1 - c10.compute / c10.time, noOverlap: c.compute + c.memory,
    bytes8, mem8: (bytes8 / DEVICE.bw) * 1e6,
    pwShare: PW.macs / SEP_FUSED.macs,
    macRatio: SEP_FUSED.macs / L1.macs, bytesRatio: r.fused.bytes / r.std.bytes, timeRatio: r.fused.time / r.std.time,
    splitBytesRatio: r.split.bytes / r.std.bytes, splitTimeRatio: r.split.time / r.std.time,
    repSlowest: rr("EfficientFormerV2-S2").ms / rr("RepViT-M1.1").ms, repThrTie: rr("RepViT-M0.9").thr / rr("EfficientFormerV2-S0").thr,
    repThrS2: rr("RepViT-M1.1").thr / rr("EfficientFormerV2-S2").thr, repFlip: rr("EfficientFormer-L1").thr / rr("EfficientFormerV2-S1").thr,
    sepBranchRatio: BRANCH.sepTwo.time / BRANCH.sepOne.time,
  };
})();

/* ---- related · memory-bank nearest-neighbour search on the same device ---- */

/** Distances of q query patches to N stored patches of d numbers each, with only the nearest kept: FLOP per byte read and written. */
export function bankIntensity(q: number, N: number, d: number) {
  const flops = 2 * q * N * d, bytes = BYTES * (N * d + q * d + q);
  return flops / bytes;
}

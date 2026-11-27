/** Arithmetic behind the pruning chapter. Import-free so node can run it; every number the prose, captions, symbols and doubts
 *  quote is computed here or pasted here from a measurement.
 *
 *  The toy: the owner's cat head picture (public/study/cat-head.png) cut into 16 x 16 = 256 cells. Input per cell: its mean colour
 *  R, G, B (0..1). Label: the dominant part of the cell (bg, cream, point, ear, eye). Network: 3 colours -> 8 hidden ReLU units ->
 *  5 parts, W1 8 x 3, W2 5 x 8. Trained for real with numpy (Adam, full batch, fixed seeds) by prune_toy_run.py, kept with this
 *  chapter's report; the trained weights are rounded to 4 decimals and pasted below. Everything that needs only forward passes
 *  is recomputed by the functions at the bottom; what needs training (retraining, tickets, C-SGD, ResRep, students) is pasted
 *  from that script's output. All of it is measured on this toy, not on any real model. */

/* ------------------------------------------------------------------ */
/* measured data                                                       */
/* ------------------------------------------------------------------ */

/** Class order used everywhere: background, cream fur, dark brown fur (point), inner ear, eye. */
export const CLASSES = ["bg", "cream", "point", "ear", "eye"];
/** Copied from cat-grids.ts (CAT_HEAD_RGB_16, CAT_HEAD_PARTS_16), flattened row by row: cell r * 16 + c. */
export const HEAD_RGB: number[][] = [[1.0, 0.93, 0.89], [0.99, 0.93, 0.89], [0.99, 0.93, 0.89], [0.99, 0.93, 0.89], [0.99, 0.93, 0.9], [0.99, 0.93, 0.9], [0.99, 0.93, 0.9], [0.99, 0.93, 0.9], [0.99, 0.93, 0.9], [0.99, 0.93, 0.89], [0.99, 0.93, 0.89], [1.0, 0.93, 0.89], [0.7, 0.63, 0.59], [0.66, 0.58, 0.54], [1.0, 0.93, 0.89], [0.99, 0.93, 0.89], [0.99, 0.93, 0.89], [0.99, 0.93, 0.89], [0.99, 0.93, 0.89], [0.99, 0.93, 0.9], [0.99, 0.93, 0.9], [0.99, 0.93, 0.9], [0.99, 0.93, 0.89], [0.99, 0.93, 0.89], [0.99, 0.93, 0.89], [0.99, 0.93, 0.89], [1.0, 0.93, 0.89], [0.69, 0.63, 0.6], [0.53, 0.32, 0.26], [0.56, 0.36, 0.29], [0.91, 0.85, 0.81], [1.0, 0.93, 0.89], [0.99, 0.93, 0.89], [0.96, 0.9, 0.87], [0.99, 0.93, 0.89], [0.99, 0.93, 0.89], [0.99, 0.93, 0.89], [0.99, 0.93, 0.89], [0.99, 0.93, 0.89], [0.99, 0.93, 0.89], [0.99, 0.93, 0.89], [1.0, 0.93, 0.89], [0.93, 0.87, 0.84], [0.38, 0.24, 0.2], [0.66, 0.42, 0.35], [0.73, 0.49, 0.41], [0.76, 0.67, 0.63], [1.0, 0.93, 0.89], [0.73, 0.66, 0.63], [0.4, 0.24, 0.19], [0.45, 0.33, 0.29], [0.76, 0.69, 0.65], [1.0, 0.93, 0.89], [1.0, 0.93, 0.89], [1.0, 0.93, 0.89], [1.0, 0.93, 0.89], [1.0, 0.93, 0.89], [1.0, 0.93, 0.89], [0.57, 0.5, 0.47], [0.44, 0.25, 0.19], [0.67, 0.43, 0.36], [0.76, 0.51, 0.44], [0.73, 0.6, 0.55], [1.0, 0.93, 0.89], [0.7, 0.61, 0.57], [0.65, 0.41, 0.35], [0.6, 0.37, 0.3], [0.4, 0.23, 0.18], [0.52, 0.43, 0.39], [0.95, 0.88, 0.84], [1.0, 0.93, 0.89], [1.0, 0.93, 0.89], [1.0, 0.93, 0.89], [0.95, 0.89, 0.85], [0.25, 0.17, 0.14], [0.48, 0.27, 0.21], [0.66, 0.42, 0.35], [0.76, 0.5, 0.43], [0.71, 0.58, 0.53], [1.0, 0.93, 0.89], [0.8, 0.73, 0.69], [0.67, 0.44, 0.37], [0.7, 0.45, 0.38], [0.56, 0.34, 0.27], [0.38, 0.2, 0.16], [0.37, 0.27, 0.23], [0.79, 0.72, 0.68], [0.94, 0.85, 0.78], [0.93, 0.84, 0.75], [0.75, 0.62, 0.52], [0.27, 0.16, 0.12], [0.64, 0.47, 0.39], [0.58, 0.36, 0.28], [0.65, 0.4, 0.32], [0.61, 0.47, 0.42], [1.0, 0.93, 0.89], [0.98, 0.91, 0.88], [0.6, 0.41, 0.35], [0.75, 0.49, 0.43], [0.65, 0.42, 0.35], [0.48, 0.28, 0.23], [0.32, 0.18, 0.13], [0.25, 0.16, 0.13], [0.84, 0.69, 0.55], [0.91, 0.73, 0.58], [0.81, 0.6, 0.45], [0.84, 0.65, 0.5], [0.98, 0.85, 0.72], [0.92, 0.8, 0.68], [0.6, 0.41, 0.32], [0.49, 0.38, 0.34], [1.0, 0.93, 0.89], [1.0, 0.93, 0.89], [0.71, 0.61, 0.57], [0.72, 0.47, 0.4], [0.64, 0.4, 0.33], [0.49, 0.29, 0.23], [0.73, 0.58, 0.48], [0.86, 0.71, 0.58], [0.82, 0.6, 0.45], [0.52, 0.32, 0.21], [0.46, 0.28, 0.19], [0.51, 0.32, 0.22], [0.66, 0.47, 0.34], [0.84, 0.66, 0.52], [0.87, 0.73, 0.6], [0.53, 0.44, 0.39], [1.0, 0.93, 0.89], [1.0, 0.93, 0.89], [0.97, 0.91, 0.87], [0.47, 0.3, 0.24], [0.56, 0.33, 0.27], [0.69, 0.53, 0.43], [0.98, 0.85, 0.72], [0.91, 0.74, 0.59], [0.58, 0.4, 0.29], [0.38, 0.23, 0.16], [0.31, 0.2, 0.16], [0.28, 0.17, 0.13], [0.28, 0.16, 0.11], [0.34, 0.33, 0.35], [0.46, 0.33, 0.27], [0.74, 0.58, 0.46], [1.0, 0.93, 0.89], [1.0, 0.93, 0.89], [1.0, 0.93, 0.89], [0.64, 0.55, 0.51], [0.38, 0.22, 0.17], [0.73, 0.56, 0.44], [0.95, 0.78, 0.62], [0.62, 0.43, 0.31], [0.32, 0.2, 0.15], [0.24, 0.13, 0.09], [0.25, 0.16, 0.13], [0.25, 0.16, 0.13], [0.27, 0.23, 0.23], [0.35, 0.49, 0.56], [0.47, 0.38, 0.34], [0.7, 0.52, 0.4], [1.0, 0.93, 0.89], [1.0, 0.93, 0.89], [1.0, 0.93, 0.89], [1.0, 0.93, 0.89], [0.36, 0.29, 0.26], [0.78, 0.6, 0.46], [0.55, 0.37, 0.27], [0.4, 0.44, 0.47], [0.21, 0.28, 0.34], [0.25, 0.29, 0.33], [0.24, 0.15, 0.11], [0.24, 0.16, 0.14], [0.33, 0.27, 0.24], [0.46, 0.44, 0.42], [0.38, 0.22, 0.15], [0.8, 0.63, 0.51], [1.0, 0.93, 0.89], [0.99, 0.93, 0.9], [1.0, 0.93, 0.89], [1.0, 0.93, 0.89], [0.86, 0.78, 0.75], [0.75, 0.53, 0.38], [0.41, 0.24, 0.16], [0.43, 0.31, 0.26], [0.47, 0.55, 0.56], [0.43, 0.39, 0.38], [0.19, 0.11, 0.09], [0.21, 0.14, 0.12], [0.23, 0.15, 0.12], [0.32, 0.19, 0.14], [0.5, 0.33, 0.23], [0.91, 0.8, 0.7], [0.99, 0.93, 0.9], [0.99, 0.93, 0.89], [1.0, 0.93, 0.89], [1.0, 0.93, 0.89], [1.0, 0.93, 0.89], [0.89, 0.76, 0.67], [0.76, 0.54, 0.38], [0.42, 0.24, 0.16], [0.32, 0.18, 0.12], [0.29, 0.17, 0.12], [0.22, 0.13, 0.1], [0.19, 0.13, 0.12], [0.23, 0.16, 0.15], [0.34, 0.2, 0.15], [0.73, 0.57, 0.45], [0.95, 0.88, 0.83], [0.99, 0.94, 0.9], [0.99, 0.93, 0.89], [1.0, 0.93, 0.89], [1.0, 0.93, 0.89], [1.0, 0.93, 0.89], [0.99, 0.93, 0.89], [0.89, 0.75, 0.64], [0.87, 0.68, 0.53], [0.75, 0.56, 0.44], [0.5, 0.35, 0.27], [0.32, 0.19, 0.14], [0.21, 0.12, 0.09], [0.19, 0.11, 0.08], [0.45, 0.29, 0.21], [0.88, 0.74, 0.62], [0.99, 0.93, 0.9], [0.99, 0.93, 0.89], [1.0, 0.93, 0.89], [1.0, 0.93, 0.9], [1.0, 0.93, 0.89], [0.99, 0.93, 0.89], [0.99, 0.94, 0.9], [0.93, 0.84, 0.76], [0.93, 0.75, 0.59], [0.91, 0.74, 0.59], [0.87, 0.7, 0.56], [0.69, 0.51, 0.38], [0.48, 0.31, 0.21], [0.52, 0.33, 0.22], [0.89, 0.69, 0.53], [0.94, 0.83, 0.73], [0.99, 0.93, 0.89], [0.99, 0.93, 0.89], [1.0, 0.93, 0.9], [1.0, 0.93, 0.89], [1.0, 0.93, 0.89], [0.99, 0.93, 0.89], [0.98, 0.91, 0.87], [0.92, 0.8, 0.68], [0.98, 0.85, 0.72], [0.94, 0.77, 0.62], [0.91, 0.7, 0.53], [0.9, 0.66, 0.47], [0.92, 0.67, 0.48], [0.96, 0.74, 0.56], [0.99, 0.84, 0.69], [0.95, 0.85, 0.76], [0.99, 0.92, 0.88], [0.99, 0.93, 0.89]];
export const HEAD_LABEL: number[] = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 3, 3, 0, 0, 0, 2, 2, 0, 0, 0, 0, 0, 0, 0, 2, 2, 3, 3, 0, 0, 0, 3, 3, 2, 2, 0, 0, 0, 0, 0, 2, 2, 3, 3, 0, 0, 0, 3, 3, 2, 2, 2, 0, 0, 1, 1, 2, 2, 2, 3, 2, 0, 0, 3, 3, 3, 2, 2, 2, 1, 1, 1, 1, 1, 1, 2, 2, 0, 0, 0, 3, 3, 2, 1, 1, 1, 2, 2, 2, 2, 1, 1, 2, 0, 0, 0, 2, 2, 2, 1, 1, 2, 2, 2, 2, 2, 4, 2, 1, 0, 0, 0, 0, 2, 1, 1, 3, 2, 2, 2, 2, 4, 4, 4, 2, 0, 0, 0, 0, 2, 1, 2, 4, 4, 4, 2, 2, 4, 4, 2, 1, 0, 0, 0, 0, 0, 1, 2, 2, 4, 4, 2, 2, 2, 2, 2, 0, 0, 0, 0, 0, 0, 0, 1, 2, 2, 2, 2, 2, 2, 2, 1, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 2, 2, 2, 2, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 1, 1, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0];

/** Weights before training (seed 0; W ~ N(0, 2/fan_in), first-layer bias 0.5) and after 4000 Adam steps (lr 0.03, weight decay 1e-4). */
export const INIT = { W1: [[0.1027, -0.1079, 0.5229], [0.0857, -0.4374, 0.2952], [1.0647, 0.7733, -0.5746], [-1.0332, -0.5089, 0.0337], [-1.8984, -0.1786, -1.0173], [-0.5979, -0.4444, -0.2583], [0.3361, 0.8512, -0.1049], [1.1157, -0.5431, 0.287]], b1: [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5], W2: [[0.4517, 0.047, -0.3717, -0.4609, -0.2289, 0.1101, -0.5048, -0.1046], [-0.0796, 0.2704, 0.1073, 0.1777, -0.3269, -0.0648, 0.392, 0.7467], [-0.6295, 0.757, 0.6729, 0.3907, 0.1322, -0.157, 0.729, 0.9801], [0.9008, 0.6576, 0.1787, -0.6042, -0.0022, 0.3282, -0.6442, 0.1976], [0.2149, 0.348, -0.5921, -0.3309, -0.2182, -0.5849, 0.8697, -0.248]], b2: [0.0, 0.0, 0.0, 0.0, 0.0] };
export const DENSE = { W1: [[0.7571, 1.0796, 4.3323], [-0.2658, -6.9078, 2.7046], [3.4594, 3.6701, -0.9865], [-2.8154, -1.2976, -0.6388], [-5.9184, 2.0949, -4.266], [6.2375, -0.832, -7.0917], [-0.8901, 6.5295, 2.9859], [1.8627, -0.6114, -1.1509]], b1: [1.6691, 4.0055, -1.8704, 3.2551, 6.5292, 1.4931, -3.1798, 0.108], W2: [[2.7995, 2.2621, 0.0143, -0.7117, -4.3962, -4.2414, 0.5535, -0.4359], [-1.6878, -7.207, 3.508, -1.8719, 1.6738, 4.5145, 2.1142, 0.6295], [-2.8519, 0.344, 0.339, 1.7764, 4.0548, 1.9467, 3.9503, 0.2354], [0.2634, 3.8944, 0.0147, -0.9024, -4.6879, 3.7827, -7.1834, 1.3603], [1.3864, 0.5428, -3.5582, 1.7771, 3.5361, -6.1332, -2.7952, -1.6261]], b2: [0.5038, -1.8323, -0.2843, -0.6594, 1.7439] };
/** Python's own check of the dense net: accuracy, eye cells right of 11, tracked eye cell's eye probability, mean loss. */
export const DENSE_CHECK = {"acc": 0.98046875, "eye": 10, "eyeProb": 0.9999, "loss": 0.0522};

/** 03 · layer-wise magnitude pruning at sparsity s (both layers), one-shot and after 1500 Adam steps (lr 0.01) with the mask fixed. */
export const RETRAIN: { s: number; kept: number; keptW1: number; keptW2: number; oneshot: number; retrain: number; eye: number; eyeProb: number }[] = [{"s": 0.0, "kept": 64, "keptW1": 24, "keptW2": 40, "oneshot": 0.98046875, "retrain": 0.97265625, "eye": 10, "eyeProb": 0.9999}, {"s": 0.1, "kept": 58, "keptW1": 22, "keptW2": 36, "oneshot": 0.98046875, "retrain": 0.98046875, "eye": 10, "eyeProb": 1.0}, {"s": 0.2, "kept": 51, "keptW1": 19, "keptW2": 32, "oneshot": 0.5625, "retrain": 0.9765625, "eye": 10, "eyeProb": 1.0}, {"s": 0.3, "kept": 45, "keptW1": 17, "keptW2": 28, "oneshot": 0.4609375, "retrain": 0.98046875, "eye": 10, "eyeProb": 1.0}, {"s": 0.4, "kept": 38, "keptW1": 14, "keptW2": 24, "oneshot": 0.40625, "retrain": 0.98046875, "eye": 10, "eyeProb": 0.9999}, {"s": 0.5, "kept": 32, "keptW1": 12, "keptW2": 20, "oneshot": 0.4296875, "retrain": 0.98046875, "eye": 9, "eyeProb": 0.9998}, {"s": 0.6, "kept": 26, "keptW1": 10, "keptW2": 16, "oneshot": 0.3359375, "retrain": 0.9765625, "eye": 9, "eyeProb": 0.9995}, {"s": 0.7, "kept": 19, "keptW1": 7, "keptW2": 12, "oneshot": 0.46484375, "retrain": 0.96484375, "eye": 9, "eyeProb": 0.9211}, {"s": 0.8, "kept": 13, "keptW1": 5, "keptW2": 8, "oneshot": 0.4296875, "retrain": 0.95703125, "eye": 8, "eyeProb": 0.9328}, {"s": 0.85, "kept": 10, "keptW1": 4, "keptW2": 6, "oneshot": 0.37890625, "retrain": 0.63671875, "eye": 9, "eyeProb": 0.7058}, {"s": 0.9, "kept": 6, "keptW1": 2, "keptW2": 4, "oneshot": 0.04296875, "retrain": 0.45703125, "eye": 0, "eyeProb": 0.0569}];
/** 03 · iterative: each round removes 20% of the surviving weights of each layer, then retrains 1500 steps. */
export const ITERATIVE: { round: number; kept: number; acc: number; eye: number }[] = [{"round": 1, "kept": 51, "acc": 0.9765625, "eye": 10}, {"round": 2, "kept": 41, "acc": 0.98046875, "eye": 10}, {"round": 3, "kept": 33, "acc": 0.96875, "eye": 9}, {"round": 4, "kept": 27, "acc": 0.9765625, "eye": 10}, {"round": 5, "kept": 22, "acc": 0.96484375, "eye": 9}, {"round": 6, "kept": 17, "acc": 0.9609375, "eye": 9}, {"round": 7, "kept": 14, "acc": 0.9609375, "eye": 9}, {"round": 8, "kept": 11, "acc": 0.96484375, "eye": 9}, {"round": 9, "kept": 9, "acc": 0.6875, "eye": 6}, {"round": 10, "kept": 7, "acc": 0.6953125, "eye": 0}];
/** 04 · lottery ticket rounds (20% per round): the ticket rewinds the survivors to INIT and trains 4000 steps from there;
 *  reinit keeps the mask with five fresh random initialisations (seeds 100..104); randMask keeps INIT with three random masks of the same size. */
export const TICKET: { round: number; kept: number; ticket: number; ticketEye: number; reinit: number[]; randMask: number[] }[] = [{"round": 1, "kept": 51, "ticket": 0.97265625, "ticketEye": 10, "reinit": [0.97265625, 0.97265625, 0.9765625, 0.97265625, 0.96875], "randMask": [0.96875, 0.97265625, 0.96484375]}, {"round": 2, "kept": 41, "ticket": 0.96875, "ticketEye": 10, "reinit": [0.97265625, 0.96875, 0.96484375, 0.96875, 0.96875], "randMask": [0.96875, 0.9765625, 0.98046875]}, {"round": 3, "kept": 33, "ticket": 0.96875, "ticketEye": 10, "reinit": [0.9765625, 0.96484375, 0.97265625, 0.96875, 0.96484375], "randMask": [0.96484375, 0.97265625, 0.97265625]}, {"round": 4, "kept": 27, "ticket": 0.96484375, "ticketEye": 9, "reinit": [0.96875, 0.96875, 0.97265625, 0.9609375, 0.9375], "randMask": [0.94140625, 0.96484375, 0.94140625]}, {"round": 5, "kept": 22, "ticket": 0.96875, "ticketEye": 10, "reinit": [0.96875, 0.9609375, 0.98046875, 0.96484375, 0.96484375], "randMask": [0.95703125, 0.95703125, 0.97265625]}, {"round": 6, "kept": 17, "ticket": 0.9609375, "ticketEye": 9, "reinit": [0.9609375, 0.96484375, 0.97265625, 0.9453125, 0.93359375], "randMask": [0.84375, 0.65234375, 0.93359375]}, {"round": 7, "kept": 14, "ticket": 0.96875, "ticketEye": 10, "reinit": [0.953125, 0.9609375, 0.9609375, 0.94921875, 0.90625], "randMask": [0.87109375, 0.7421875, 0.71484375]}, {"round": 8, "kept": 11, "ticket": 0.96875, "ticketEye": 10, "reinit": [0.94140625, 0.92578125, 0.96484375, 0.93359375, 0.96875], "randMask": [0.875, 0.45703125, 0.8125]}, {"round": 9, "kept": 9, "ticket": 0.5234375, "ticketEye": 0, "reinit": [0.45703125, 0.45703125, 0.5234375, 0.5234375, 0.5234375], "randMask": [0.69921875, 0.45703125, 0.60546875]}, {"round": 10, "kept": 7, "ticket": 0.5234375, "ticketEye": 0, "reinit": [0.45703125, 0.45703125, 0.5234375, 0.5234375, 0.45703125], "randMask": [0.45703125, 0.45703125, 0.70703125]}];
/** 06 · drop k hidden units in the order of the L1 norm of their incoming weights; one-shot and after 1500 retraining steps. */
export const STRUCTURED: { k: number; dropped: number[]; oneshot: number; retrain: number; eye: number; eyeProb: number }[] = [{"k": 0, "dropped": [], "oneshot": 0.98046875, "retrain": 0.97265625, "eye": 10, "eyeProb": 0.9999}, {"k": 1, "dropped": [7], "oneshot": 0.9765625, "retrain": 0.97265625, "eye": 10, "eyeProb": 0.9999}, {"k": 2, "dropped": [7, 3], "oneshot": 0.97265625, "retrain": 0.9765625, "eye": 10, "eyeProb": 0.9999}, {"k": 3, "dropped": [7, 3, 0], "oneshot": 0.40234375, "retrain": 0.9765625, "eye": 9, "eyeProb": 0.991}, {"k": 4, "dropped": [7, 3, 0, 2], "oneshot": 0.27734375, "retrain": 0.96484375, "eye": 9, "eyeProb": 0.984}, {"k": 5, "dropped": [7, 3, 0, 2, 1], "oneshot": 0.31640625, "retrain": 0.921875, "eye": 9, "eyeProb": 0.9684}, {"k": 6, "dropped": [7, 3, 0, 2, 1, 6], "oneshot": 0.421875, "retrain": 0.92578125, "eye": 9, "eyeProb": 0.9804}];
/** 07 · C-SGD: k-means on the rows of W1 into 4 clusters, 3000 steps of the centripetal update (tau 0.05, epsilon 0.1), then merge. */
export const CSGD = { clusters: [[0, 6], [1, 3], [2, 5, 7], [4]], snaps: [{"step": 0, "W1": [[0.7571, 1.0796, 4.3323], [-0.2658, -6.9078, 2.7046], [3.4594, 3.6701, -0.9865], [-2.8154, -1.2976, -0.6388], [-5.9184, 2.0949, -4.266], [6.2375, -0.832, -7.0917], [-0.8901, 6.5295, 2.9859], [1.8627, -0.6114, -1.1509]], "b1": [1.6691, 4.0055, -1.8704, 3.2551, 6.5292, 1.4931, -3.1798, 0.108], "acc": 0.98046875, "eyeProb": 0.9999, "spread": 4.0153}, {"step": 50, "W1": [[0.5245, 1.6509, 4.1563], [-0.5238, -6.2636, 2.3541], [3.5296, 3.0024, -1.4681], [-2.5077, -1.8982, -0.2475], [-6.0234, 2.0235, -4.3232], [5.6913, -0.5008, -6.2186], [-0.7572, 5.8916, 3.1086], [2.2872, -0.3291, -1.596]], "b1": [1.0459, 3.9463, -1.4938, 3.3624, 6.3646, 1.1234, -2.7271, 0.0456], "acc": 0.96875, "eyeProb": 0.9996, "spread": 3.1244}, {"step": 100, "W1": [[0.297, 2.0652, 3.9945], [-0.7382, -5.772, 2.0747], [3.5676, 2.464, -1.862], [-2.2819, -2.3752, 0.0504], [-6.1297, 1.9547, -4.3772], [5.2497, -0.2619, -5.5585], [-0.7003, 5.365, 3.1793], [2.6009, -0.1283, -1.9615]], "b1": [0.4739, 3.8771, -1.215, 3.4227, 6.2034, 0.8215, -2.462, -0.0172], "acc": 0.9609375, "eyeProb": 0.9988, "spread": 2.4311}, {"step": 200, "W1": [[-0.0539, 2.6159, 3.7518], [-1.0715, -5.121, 1.6654], [3.6022, 1.6955, -2.4321], [-2.0062, -3.0643, 0.4398], [-6.277, 1.8724, -4.4394], [4.6206, 0.045, -4.6702], [-0.6578, 4.6137, 3.2582], [3.0169, 0.1259, -2.4924]], "b1": [-0.3979, 3.73, -0.8395, 3.4549, 5.9673, 0.3935, -2.1754, -0.1142], "acc": 0.96484375, "eyeProb": 0.995, "spread": 1.472}, {"step": 400, "W1": [[-0.4535, 3.1157, 3.4834], [-1.4418, -4.5348, 1.2279], [3.5978, 0.9043, -3.03], [-1.7844, -3.7809, 0.7785], [-6.4448, 1.7917, -4.5036], [3.9711, 0.2992, -3.8504], [-0.6749, 3.8481, 3.3024], [3.3832, 0.3289, -3.052]], "b1": [-1.3394, 3.5466, -0.4864, 3.4458, 5.6697, -0.0343, -1.991, -0.2205], "acc": 0.96875, "eyeProb": 0.9277, "spread": 0.5396}, {"step": 800, "W1": [[-0.6654, 3.3585, 3.3193], [-1.6051, -4.2335, 1.043], [3.5477, 0.4297, -3.4191], [-1.6511, -4.1322, 0.9826], [-6.49, 1.8203, -4.4939], [3.5979, 0.3484, -3.5294], [-0.6951, 3.4569, 3.295], [3.5189, 0.3524, -3.4221]], "b1": [-1.834, 3.4768, -0.2414, 3.4633, 5.496, -0.1807, -1.9216, -0.2057], "acc": 0.953125, "eyeProb": 0.7613, "spread": 0.0725}, {"step": 1600, "W1": [[-0.7155, 3.4129, 3.2701], [-1.6217, -4.1961, 1.0731], [3.4861, 0.2537, -3.6068], [-1.6225, -4.1943, 1.072], [-6.3636, 1.9718, -4.4324], [3.487, 0.2523, -3.6088], [-0.7161, 3.4147, 3.2697], [3.4855, 0.2524, -3.6068]], "b1": [-1.9482, 3.4734, -0.1003, 3.4731, 5.4523, -0.0992, -1.9498, -0.0996], "acc": 0.953125, "eyeProb": 0.8741, "spread": 0.0013}, {"step": 3000, "W1": [[-0.7233, 3.4673, 3.2615], [-1.61, -4.2134, 1.1444], [3.4384, 0.1541, -3.7346], [-1.61, -4.2134, 1.1443], [-6.1645, 2.1253, -4.4553], [3.4385, 0.1541, -3.7346], [-0.7233, 3.4673, 3.2615], [3.4384, 0.1541, -3.7346]], "b1": [-2.0004, 3.4914, 0.0072, 3.4914, 5.4, 0.0072, -2.0004, 0.0072], "acc": 0.9609375, "eyeProb": 0.9292, "spread": 0.0}] as { step: number; W1: number[][]; b1: number[]; acc: number; eyeProb: number; spread: number }[], before: 0.9609375, after: 0.9609375, eyeBefore: 0.9292, eyeAfter: 0.9292, maxOutDiff: 9.92905264851629e-06, merged: { W1: [[-0.7233, 3.4673, 3.2615], [-1.61, -4.2134, 1.1444], [3.4384, 0.1541, -3.7346], [-6.1645, 2.1253, -4.4553]], b1: [-2.0004, 3.4914, 0.0072, 5.4], W2: [[3.3853, 1.5524, -4.6827, -4.3729], [0.8333, -9.0039, 9.0836, 1.7119], [-0.2076, 1.0772, 1.1196, 4.0686], [-6.9403, 4.1684, 5.9633, -4.2044], [-0.4704, 2.1111, -11.1387, 2.9748]], b2: [0.5677, -1.7308, -1.1411, -0.3927, 2.1686] } };
/** 07 · ResRep: an 8 x 8 compactor Q (identity at the start) between W1 and the ReLU; SGD lr 0.002, momentum 0.9 (0.99 on Q),
 *  penalty strength 0.01 on Q only; one more row of Q selected to forget every 200 steps from step 200 until 4 rows; 4000 steps. */
export const RESREP = { snaps: [{"step": 0, "norms": [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0], "mask": [1, 1, 1, 1, 1, 1, 1, 1], "acc": 0.98046875, "eyeProb": 0.9999}, {"step": 200, "norms": [0.8948, 0.9283, 0.8465, 0.8046, 0.9393, 0.9769, 0.9184, 0.7852], "mask": [1, 1, 1, 1, 1, 1, 1, 0], "acc": 0.97265625, "eyeProb": 0.9996}, {"step": 400, "norms": [0.8093, 0.8187, 0.6416, 0.5095, 0.8516, 0.9113, 0.7834, 0.4193], "mask": [1, 1, 1, 0, 1, 1, 1, 0], "acc": 0.97265625, "eyeProb": 0.9989}, {"step": 600, "norms": [0.774, 0.7492, 0.5053, 0.1672, 0.8156, 0.8768, 0.6791, 0.0247], "mask": [1, 1, 0, 0, 1, 1, 1, 0], "acc": 0.9765625, "eyeProb": 0.9985}, {"step": 800, "norms": [0.8058, 0.6957, 0.2458, 0.0419, 0.8045, 0.8878, 0.6685, 0.0222], "mask": [1, 1, 0, 0, 1, 1, 0, 0], "acc": 0.9765625, "eyeProb": 0.9987}, {"step": 1200, "norms": [0.4129, 0.6536, 0.0085, 0.0024, 0.749, 0.721, 0.1027, 0.0005], "mask": [1, 1, 0, 0, 1, 1, 0, 0], "acc": 0.94921875, "eyeProb": 0.9873}, {"step": 1600, "norms": [1.3154, 0.779, 0.001, 0.0002, 1.4279, 0.8301, 0.0072, 0.0007], "mask": [1, 1, 0, 0, 1, 1, 0, 0], "acc": 0.96875, "eyeProb": 1.0}, {"step": 2400, "norms": [1.0506, 0.6592, 0.0001, 0.0007, 1.1151, 0.903, 0.0001, 0.0004], "mask": [1, 1, 0, 0, 1, 1, 0, 0], "acc": 0.96484375, "eyeProb": 1.0}, {"step": 4000, "norms": [0.8795, 0.6711, 0.0, 0.0003, 1.0832, 0.9207, 0.0001, 0.0002], "mask": [1, 1, 0, 0, 1, 1, 0, 0], "acc": 0.96484375, "eyeProb": 1.0}] as { step: number; norms: number[]; mask: number[]; acc: number; eyeProb: number }[], kept: [0, 1, 4, 5], trainAcc: 0.96484375, mergedAcc: 0.96484375, eye: 9, eyeProb: 1.0, merged: { W1: [[2.3922, 3.4084, 5.1079], [-0.7017, -5.7168, 3.0568], [-6.653, 7.5568, -2.4934], [7.8602, 0.9004, -5.5383]], b1: [-1.2878, 3.173, 3.5245, -0.7191], W2: [[3.5464, 2.3136, -4.2446, -3.9629], [-1.3433, -7.2615, 1.733, 4.7964], [-2.6066, 0.403, 4.211, 2.0001], [-0.4852, 3.8845, -4.9232, 3.4341], [0.7983, 0.4967, 3.4044, -6.3984]], b2: [0.6596, -1.7245, -0.2444, -0.8419, 1.6229] } };
/** 05 · W2 pruned 2:4 or 50% unstructured, retrained 1500 steps with the pattern fixed. */
export const W2SPARSE = {"r24": 0.9765625, "r24eye": 9, "r24eyeProb": 0.9999, "unstr": 0.96484375, "unstrEye": 9};
/** 09 · a 4-unit student trained 4000 steps on labels only, or with the dense net as teacher (T = 2, half label loss, half T²·KL);
 *  pruneKd: the 4-unit structured net of section 06 retrained 1500 steps with the same teacher. */
export const DISTILL = {"T": 2.0, "alpha": 0.5, "labels": 0.96875, "labelsEye": 10, "labelsEyeProb": 1.0, "kd": 0.9765625, "kdEye": 10, "kdEyeProb": 1.0, "pruneKd": 0.953125, "pruneKdEye": 9, "pruneKdEyeProb": 0.9929};

/* ================================================================== */
/* the network and one forward pass                                    */
/* ================================================================== */

export type Net = { W1: number[][]; b1: number[]; W2: number[][]; b2: number[] };
export type Pass = { a: number[]; h: number[]; z: number[]; q: number[] };

export const N_CELLS = HEAD_RGB.length;           // 256
export const N_HID = DENSE.W1.length;             // 8
export const EYE_CELL = 9 * 16 + 12;              // row 9, column 12: the bluest cell of the right eye in the picture
export const BG_CELL = 0;                         // top-left corner, plain background
export const EYE = 4;                             // class index of "eye"

export const dot = (a: number[], b: number[]) => a.reduce((s, v, i) => s + v * b[i], 0);
export const clone = (n: Net): Net => ({ W1: n.W1.map((r) => [...r]), b1: [...n.b1], W2: n.W2.map((r) => [...r]), b2: [...n.b2] });

export function softmax(z: number[]): number[] {
  const m = Math.max(...z);
  const e = z.map((v) => Math.exp(v - m));
  const s = e.reduce((a, b) => a + b, 0);
  return e.map((v) => v / s);
}

/** One cell through the network: pre-activations a (one per hidden unit), ReLU h, part scores z, probabilities q. */
export function pass(n: Net, x: number[]): Pass {
  const a = n.W1.map((row, i) => dot(row, x) + n.b1[i]);
  const h = a.map((v) => Math.max(0, v));
  const z = n.W2.map((row, k) => dot(row, h) + n.b2[k]);
  return { a, h, z, q: softmax(z) };
}

export const argmax = (v: number[]) => v.reduce((best, x, i) => (x > v[best] ? i : best), 0);
export const correct = (n: Net) => HEAD_RGB.reduce((c, x, i) => c + (argmax(pass(n, x).q) === HEAD_LABEL[i] ? 1 : 0), 0);
export const accuracy = (n: Net) => correct(n) / N_CELLS;
export const eyeCells = HEAD_LABEL.map((y, i) => (y === EYE ? i : -1)).filter((i) => i >= 0);
export const eyeCorrect = (n: Net) => eyeCells.filter((i) => argmax(pass(n, HEAD_RGB[i]).q) === EYE).length;
export const prob = (n: Net, cell: number, cls: number) => pass(n, HEAD_RGB[cell]).q[cls];
/** Mean cross-entropy over the 256 cells, natural log. The training objective without weight decay. */
export const meanLoss = (n: Net) => -HEAD_RGB.reduce((s, x, i) => s + Math.log(pass(n, x).q[HEAD_LABEL[i]]), 0) / N_CELLS;
/** Cells per class, in the order bg, cream, point, ear, eye. */
export const classCount = [0, 1, 2, 3, 4].map((k) => HEAD_LABEL.filter((y) => y === k).length);

/** Indices sorted by value, ties kept in index order (numpy's argsort kind="stable"). */
export function argsort(v: number[]): number[] {
  return v.map((x, i) => [x, i] as [number, number]).sort((p, q) => p[0] - q[0] || p[1] - q[1]).map((p) => p[1]);
}

/* ================================================================== */
/* 01 · magnitude on the first layer, one cell at a time              */
/* ================================================================== */

/** The 24 weights of W1 flattened row by row (unit i, colour j  ->  3i + j), smallest |w| first. */
export const W1_FLAT = DENSE.W1.flat();
export const MAG_ORDER_W1 = argsort(W1_FLAT.map(Math.abs));
/** Zero the listed W1 entries (flat indices). */
export function cutW1(n: Net, flat: number[]): Net {
  const c = clone(n);
  flat.forEach((f) => { c.W1[Math.floor(f / 3)][f % 3] = 0; });
  return c;
}
export const cutFirst = (order: number[], k: number) => cutW1(DENSE, order.slice(0, k));
export const unitOf = (f: number) => Math.floor(f / 3);
export const colourOf = (f: number) => f % 3;

/* ================================================================== */
/* 02 · Optimal Brain Damage on the same 24 weights                    */
/* ================================================================== */

/** Exact diagonal of the Hessian of the mean loss for each W1 entry (the ReLU kink has zero second derivative):
 *  h_ij = mean over cells of [unit i active] · x_j² · c_iᵀ (diag(q) − q qᵀ) c_i,   c_i = column i of W2. */
export function hessDiagW1(n: Net): number[][] {
  const H = n.W1.map((r) => r.map(() => 0));
  HEAD_RGB.forEach((x) => {
    const { a, q } = pass(n, x);
    for (let i = 0; i < n.W1.length; i++) {
      if (a[i] <= 0) continue;
      const c = n.W2.map((row) => row[i]);
      const qc = dot(q, c);
      const v = q.reduce((s, qk, k) => s + qk * c[k] * c[k], 0) - qc * qc;
      for (let j = 0; j < 3; j++) H[i][j] += (v * x[j] * x[j]) / N_CELLS;
    }
  });
  return H;
}
export const HESS_W1 = hessDiagW1(DENSE);
/** OBD saliency ½ h w²: the predicted rise of the loss when one weight alone is set to zero. */
export const SAL_W1 = DENSE.W1.map((row, i) => row.map((w, j) => 0.5 * HESS_W1[i][j] * w * w));
export const OBD_ORDER_W1 = argsort(SAL_W1.flat());
export const LOSS0 = meanLoss(DENSE);
/** The real rise of the loss when one weight alone is set to zero. */
export const DL_W1 = W1_FLAT.map((_, f) => meanLoss(cutW1(DENSE, [f])) - LOSS0);
export const CUT_MAX = 12;
export const CURVE_MAG = Array.from({ length: CUT_MAX + 1 }, (_, k) => accuracy(cutFirst(MAG_ORDER_W1, k)));
export const CURVE_OBD = Array.from({ length: CUT_MAX + 1 }, (_, k) => accuracy(cutFirst(OBD_ORDER_W1, k)));

/* ================================================================== */
/* 03 · layer-wise magnitude masks for both layers                     */
/* ================================================================== */

/** In W1 and in W2 separately, zero the round(s · size) entries with the smallest |w| (numpy rounds halves to even). */
const roundHalfEven = (v: number) => { const f = Math.floor(v), d = v - f; return d > 0.5 + 1e-9 ? f + 1 : d < 0.5 - 1e-9 ? f : f % 2 === 0 ? f : f + 1; };
export function magMask(W: number[][], s: number): number[][] {
  const flat = W.flat(), k = roundHalfEven(s * flat.length), m = flat.map(() => 1);
  argsort(flat.map(Math.abs)).slice(0, k).forEach((f) => { m[f] = 0; });
  return W.map((r, i) => r.map((_, j) => m[i * r.length + j]));
}
export function applyMasks(n: Net, m1: number[][], m2: number[][]): Net {
  return { W1: n.W1.map((r, i) => r.map((w, j) => w * m1[i][j])), b1: [...n.b1], W2: n.W2.map((r, i) => r.map((w, j) => w * m2[i][j])), b2: [...n.b2] };
}
export const oneShot = (s: number) => applyMasks(DENSE, magMask(DENSE.W1, s), magMask(DENSE.W2, s));
export const countKept = (m: number[][]) => m.flat().reduce((a, b) => a + b, 0);

/* ================================================================== */
/* 04 · lottery ticket summaries                                       */
/* ================================================================== */

export const mean = (v: number[]) => v.reduce((a, b) => a + b, 0) / v.length;
export const TICKET_ROWS = TICKET.map((r) => ({ ...r, reinitMean: mean(r.reinit), reinitMin: Math.min(...r.reinit), reinitMax: Math.max(...r.reinit), randMean: mean(r.randMask) }));

/* ================================================================== */
/* 05 · what a sparse table costs to store, and 2:4                    */
/* ================================================================== */

/** Bits to store an R × C table: dense (every entry), CSR (values, column index per value, R + 1 row starts),
 *  2:4 (half the values plus 2 bits of position per kept value). */
export const denseBits = (R: number, C: number, valBits = 16) => R * C * valBits;
export const csrBits = (R: number, nnz: number, valBits = 16, idxBits = 16, ptrBits = 16) => nnz * valBits + nnz * idxBits + (R + 1) * ptrBits;
export const bits24 = (R: number, C: number, valBits = 16) => (R * C / 2) * (valBits + 2);
export const BIG = 4096;
export const MB = (bits: number) => bits / 8 / 1e6;

/** 2:4 mask: in every group of four neighbouring weights of a row, zero the two smallest |w|. */
export function mask24(W: number[][]): number[][] {
  return W.map((row) => {
    const m = row.map(() => 1);
    for (let g = 0; g < row.length; g += 4) argsort(row.slice(g, g + 4).map(Math.abs)).slice(0, 2).forEach((j) => { m[g + j] = 0; });
    return m;
  });
}
export const ONES_W1 = DENSE.W1.map((r) => r.map(() => 1));
export const ONES_W2 = DENSE.W2.map((r) => r.map(() => 1));
export const M24_W2 = mask24(DENSE.W2);
export const MU50_W2 = magMask(DENSE.W2, 0.5);
export const NET_24 = applyMasks(DENSE, ONES_W1, M24_W2);
export const NET_U50 = applyMasks(DENSE, ONES_W1, MU50_W2);

/* ================================================================== */
/* 06 · whole hidden units                                             */
/* ================================================================== */

/** Li et al.'s filter score on this layer: the sum of |w| over a unit's incoming weights (its row of W1). */
export const L1_UNITS = DENSE.W1.map((r) => r.reduce((s, w) => s + Math.abs(w), 0));
export const L1_ORDER = argsort(L1_UNITS);
export function dropUnits(n: Net, units: number[]): Net {
  const keep = n.W1.map((_, i) => i).filter((i) => !units.includes(i));
  return { W1: keep.map((i) => [...n.W1[i]]), b1: keep.map((i) => n.b1[i]), W2: n.W2.map((r) => keep.map((i) => r[i])), b2: [...n.b2] };
}
export const dropFirst = (k: number) => dropUnits(DENSE, L1_ORDER.slice(0, k));
export const paramCount = (n: Net) => n.W1.flat().length + n.W2.flat().length;

/* ================================================================== */
/* 07 · C-SGD and ResRep                                               */
/* ================================================================== */

/** Merge identical units: keep the first of each cluster, add the cluster's outgoing columns together. */
export function mergeClusters(n: Net, clusters: number[][]): Net {
  return {
    W1: clusters.map((c) => [...n.W1[c[0]]]), b1: clusters.map((c) => n.b1[c[0]]),
    W2: n.W2.map((r) => clusters.map((c) => c.reduce((s, i) => s + r[i], 0))), b2: [...n.b2],
  };
}
export const CSGD_MERGED: Net = CSGD.merged;
export const RESREP_MERGED: Net = RESREP.merged;
/** Largest gap between a unit's incoming weights and its cluster's mean, at one C-SGD snapshot. */
export const clusterSpread = (W1: number[][], clusters: number[][]) =>
  Math.max(...clusters.map((c) => Math.max(...c.flatMap((i) => W1[i].map((w, j) => Math.abs(w - mean(c.map((u) => W1[u][j]))))))));

/* ================================================================== */
/* 08 · pruning a layer without retraining: magnitude, Wanda, update   */
/* ================================================================== */

/** The eight hidden values over the 256 cells: the inputs of W2. ‖h_j‖ is the l2 norm of column j. */
export function hiddenNorms(n: Net): number[] {
  const s = n.b1.map(() => 0);
  HEAD_RGB.forEach((x) => pass(n, x).h.forEach((v, j) => { s[j] += v * v; }));
  return s.map(Math.sqrt);
}
/** Per output row, zero the k entries with the smallest score (Wanda compares inside each row). */
export function perRowMask(score: number[][], k: number): number[][] {
  return score.map((row) => { const m = row.map(() => 1); argsort(row).slice(0, k).forEach((j) => { m[j] = 0; }); return m; });
}
/** Write hidden unit j at c times its size: incoming weights and bias × c, outgoing column ÷ c. ReLU(c·a) = c·ReLU(a) for c > 0,
 *  so every cell's output is unchanged. */
export function rescaleUnit(n: Net, j: number, c: number): Net {
  const r = clone(n);
  r.W1[j] = r.W1[j].map((w) => w * c); r.b1[j] *= c;
  r.W2 = r.W2.map((row) => row.map((w, i) => (i === j ? w / c : w)));
  return r;
}
/** Solve A w = b for a small square system (Gaussian elimination with partial pivoting). */
export function solve(A: number[][], b: number[]): number[] {
  const n = b.length, M = A.map((r, i) => [...r, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    [M[c], M[p]] = [M[p], M[c]];
    for (let r = c + 1; r < n; r++) { const f = M[r][c] / M[c][c]; for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k]; }
  }
  const w = new Array(n).fill(0);
  for (let r = n - 1; r >= 0; r--) w[r] = (M[r][n] - M[r].slice(r + 1, n).reduce((s, v, k) => s + v * w[r + 1 + k], 0)) / M[r][r];
  return w;
}
/** SparseGPT's problem for one fixed mask, solved exactly on this small layer: in each row keep the mask and choose the kept
 *  weights that best reproduce the row's original output W2[i]·h over the 256 cells (least squares). The bias is not touched. */
export function reconW2(n: Net, mask: number[][]): Net {
  const H = HEAD_RGB.map((x) => pass(n, x).h);
  const W2 = n.W2.map((row, i) => {
    const keep = mask[i].map((m, j) => (m > 0 ? j : -1)).filter((j) => j >= 0);
    const t = H.map((h) => dot(row, h));
    const A = keep.map((u) => keep.map((v) => H.reduce((s, h) => s + h[u] * h[v], 0)));
    const b = keep.map((u) => H.reduce((s, h, c) => s + h[u] * t[c], 0));
    const w = solve(A, b), out = row.map(() => 0);
    keep.forEach((j, k) => { out[j] = w[k]; });
    return out;
  });
  return { ...clone(n), W2 };
}
export type LlmMethod = "mag" | "wanda" | "update";
export const LLM_K = 4;                 // 4 of the 8 weights in each row: 50%
export const RESCALE_UNIT = 0, RESCALE_C = 10;
export function llmPrune(method: LlmMethod, rescaled: boolean) {
  const base = rescaled ? rescaleUnit(DENSE, RESCALE_UNIT, RESCALE_C) : DENSE;
  const norms = hiddenNorms(base);
  const score = method === "mag" ? base.W2.map((r) => r.map(Math.abs)) : base.W2.map((r) => r.map((w, j) => Math.abs(w) * norms[j]));
  const mask = perRowMask(score, LLM_K);
  const net = method === "update" ? reconW2(base, mask) : applyMasks(base, ONES_W1, mask);
  return { base, norms, score, mask, net };
}

/* ================================================================== */
/* 09 · the same toy through quantization, and the size of everything */
/* ================================================================== */

/** Symmetric per-row quantization (the compression chapter's "줄마다 s"): codes in −(2^(b−1)−1)..2^(b−1)−1, one scale per row. */
export function quantRows(W: number[][], bits: number): number[][] {
  const qm = 2 ** (bits - 1) - 1;
  return W.map((row) => { const s = Math.max(...row.map(Math.abs)) / qm; return row.map((w) => Math.max(-qm, Math.min(qm, Math.round(w / s))) * s); });
}
export const quantNet = (n: Net, bits: number): Net => ({ W1: quantRows(n.W1, bits), b1: [...n.b1], W2: quantRows(n.W2, bits), b2: [...n.b2] });
export const NET_Q8 = quantNet(DENSE, 8);
export const NET_Q4 = quantNet(DENSE, 4);
/** Weight bits of each variant of the toy (biases not counted). 16-bit values; CSR with 16-bit column indices and row starts;
 *  quantized tables keep one 16-bit scale per row (8 rows of W1, 5 rows of W2). */
export const TOY_BITS = {
  dense: denseBits(8, 3) + denseBits(5, 8),
  csr50: csrBits(8, 12) + csrBits(5, 20),
  w24: denseBits(8, 3) + bits24(5, 8),
  units4: denseBits(4, 3) + denseBits(5, 4),
  q8: 64 * 8 + 13 * 16,
  q4: 64 * 4 + 13 * 16,
  student4: denseBits(4, 3) + denseBits(5, 4),
};
/** The same rules on one 4096 × 4096 layer, in bits. */
export const BIG_BITS = {
  dense: denseBits(BIG, BIG),
  csr50: csrBits(BIG, (BIG * BIG) / 2),
  csr90: csrBits(BIG, (BIG * BIG) / 10),
  w24: bits24(BIG, BIG),
  half: denseBits(BIG / 2, BIG),
  q8: BIG * BIG * 8 + BIG * 16,
  q4: BIG * BIG * 4 + BIG * 16,
};

/* ================================================================== */
/* side calculations quoted in the doubts                               */
/* ================================================================== */

/** Mean colour of each part over its cells. */
export const CLASS_MEAN_RGB = [0, 1, 2, 3, 4].map((k) => {
  const cells = HEAD_RGB.filter((_, i) => HEAD_LABEL[i] === k);
  return [0, 1, 2].map((j) => cells.reduce((s, x) => s + x[j], 0) / cells.length);
});
/** Smallest and largest first-layer Hessian diagonal: the last factor is a variance, so every entry is at least 0. */
export const HESS_MIN = Math.min(...HESS_W1.flat());
/** CSR of the 50% W2 with 3-bit column numbers (8 columns fit in 3 bits). */
export const CSR_W2_3BIT = csrBits(5, 20, 16, 3, 16);
/** Unit order by the l2 norm of incoming weights, and by the size of the unit's values over the 256 cells. */
export const L2_ORDER = argsort(DENSE.W1.map((r) => Math.hypot(...r)));
export const ACT_ORDER = argsort(hiddenNorms(DENSE));
export const dropBy = (order: number[], k: number) => dropUnits(DENSE, order.slice(0, k));
/** Wanda's score compared across the whole of W2 instead of inside each row: the 20 smallest of 40. */
export function wandaLayerwise(): Net {
  const norms = hiddenNorms(DENSE);
  const flat = DENSE.W2.flatMap((r) => r.map((w, j) => Math.abs(w) * norms[j]));
  const m = flat.map(() => 1);
  argsort(flat).slice(0, 20).forEach((f) => { m[f] = 0; });
  return applyMasks(DENSE, ONES_W1, DENSE.W2.map((r, i) => r.map((_, j) => m[i * 8 + j])));
}

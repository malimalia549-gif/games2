import { useEffect, useRef, useState } from "react";
import cottageText from "../game/cottageMarks.txt?raw";
import maskText from "../game/groundMask.txt?raw";
import { useGame } from "../game/store";
import treeText from "../game/treeMarks.txt?raw";
import tulipText from "../game/tulipMarks.txt?raw";

const BASE_ROWS = maskText.trim().split(/\r?\n/);
const BASE_COLS = BASE_ROWS[0]?.length ?? 0;
const PAD_COLS = 204; // +816px new world land on West & +816px on East -> 2800px total width
const PAD_ROWS = 127; // +508px new world land on North & +508px on South -> 1800px total height
const COLS = BASE_COLS + PAD_COLS * 2;
const TOTAL_ROWS = BASE_ROWS.length + PAD_ROWS * 2;
const SCALE = 4;
const OX = PAD_COLS * SCALE; // 816
const OY = PAD_ROWS * SCALE; // 508
const FIELD_H = TOTAL_ROWS * SCALE; // 1800
const WIDTH = COLS * SCALE; // 2800
const HEIGHT = FIELD_H; // 1800
const TULIP_MARKS = JSON.parse(`[${tulipText}]`) as Array<[number, number, number, number, number]>;
const TREE_MARKS = JSON.parse(`[${treeText}]`) as Array<[number, number, number]>;
const COTTAGE_MARKS = JSON.parse(`[${cottageText}]`) as Array<[number, number, number, number, number]>;
const LEAF_PAL: Array<[number, number, number]> = [
  [18, 52, 18],
  [26, 74, 22],
  [38, 100, 28],
  [56, 126, 34],
  [82, 152, 40],
  [114, 178, 48],
  [148, 202, 58],
  [182, 222, 76],
];

const LILY_PADS: Array<[number, number]> = [
  // Central Koi Pond lily pads
  [96 + OX, 304 + OY],
  [142 + OX, 296 + OY],
  [186 + OX, 314 + OY],
  [118 + OX, 338 + OY],
  [168 + OX, 344 + OY],
  // Eastern Forest Lake lily pads
  [1544 + OX, 508 + OY],
  [1598 + OX, 496 + OY],
  [1636 + OX, 528 + OY],
  [1568 + OX, 548 + OY],
  [1618 + OX, 558 + OY],
];

// 4 Fenced Fodder & Crop Plots in the Western Agricultural Estate
const FODDER_PLOTS: Array<{ x0: number; x1: number; y0: number; y1: number }> = [
  { x0: 58 + OX, x1: 244 + OX, y0: 514 + OY, y1: 610 + OY }, // Plot 1: East-Top (Original Greenleaf Fodder Field)
  { x0: -324 + OX, x1: -138 + OX, y0: 514 + OY, y1: 610 + OY }, // Plot 2: West-Top (Golden Wheat & Clover Field)
  { x0: -324 + OX, x1: -138 + OX, y0: 648 + OY, y1: 744 + OY }, // Plot 3: West-Bottom (Alfalfa & Grain Field)
  { x0: 58 + OX, x1: 244 + OX, y0: 648 + OY, y1: 744 + OY }, // Plot 4: East-Bottom (Sweet Fodder & Herb Field)
];

function isLilyPadAt(px: number, py: number): boolean {
  for (const [lx, ly] of LILY_PADS) {
    const dx = px - lx;
    const dy = py - ly;
    if (dx >= -7 && dx <= 7 && dy >= -5 && dy <= 5) {
      if ((dx * dx) / 49 + (dy * dy) / 25 <= 1) {
        if (!(dx > 2 && dy >= -2 && dy <= 1)) return true;
      }
      if ((lx + ly) % 2 === 0 && dx >= -3 && dx <= 0 && dy >= -3 && dy <= -1) {
        return true;
      }
    }
  }
  return false;
}

function hash(x: number, y: number) {
  let n = Math.imul(x, 374761393) + Math.imul(y, 668265263);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return (n ^ (n >>> 16)) >>> 0;
}

function cellVal(cx: number, cy: number) {
  const bx = cx - PAD_COLS;
  const by = cy - PAD_ROWS;

  // Eastern Forest Pond (Danau Hutan Timur)
  const dxLake = (bx - 396) / 29;
  const dyLake = (by - 132) / 18;
  if (dxLake * dxLake + dyLake * dyLake <= 1.0) return 3;

  // 1. North Ranch Roads & Grand Red Barn Courtyard
  if (by >= -58 && by <= 23 && ((bx >= 93 && bx <= 99) || (bx >= 180 && bx <= 187))) return 2;
  if (by >= -62 && by <= -52 && bx >= 88 && bx <= 192) return 2;

  // 2. West Agricultural Highway, Farmhouse Courtyard & Fodder Estate Lanes
  if (by >= 111 && by <= 117 && bx >= -156 && bx <= 25) return 2;
  if (bx >= -96 && bx <= -89 && by >= 46 && by <= 114) return 2;
  if (by >= 40 && by <= 48 && bx >= -114 && bx <= -72) return 2;
  if (bx >= -22 && bx <= -15 && by >= 114 && by <= 202) return 2;
  if (bx >= -108 && bx <= -102 && by >= 114 && by <= 202) return 2;
  if (by >= 196 && by <= 202 && bx >= -108 && bx <= 150) return 2;

  // 3. East Orchard & Forest Lake Avenue
  if (by >= 52 && by <= 58 && bx >= 243 && bx <= 360) return 2;
  if (by >= 154 && by <= 160 && bx >= 221 && bx <= 360) return 2;
  if (bx >= 348 && bx <= 355 && by >= 52 && by <= 160) return 2;

  // 4. South Main Road & Crossroads
  if (by >= 171 && bx >= 146 && bx <= 153) return 2;
  if (by >= 238 && by <= 244 && bx >= 68 && bx <= 232) return 2;

  if (by < 0 || by >= BASE_ROWS.length || bx < 0 || bx >= BASE_COLS) return 1;
  const cell = BASE_ROWS[by]?.[bx];
  return cell === "p" ? 2 : cell === "w" ? 3 : 1;
}

function paint(ctx: CanvasRenderingContext2D, grass: HTMLImageElement) {
  const mask = new Uint8Array(WIDTH * FIELD_H);
  for (let cy = 0; cy < TOTAL_ROWS; cy += 1) {
    for (let cx = 0; cx < COLS; cx += 1) {
      const center = cellVal(cx, cy);
      for (let qy = 0; qy < 2; qy += 1) {
        const vert = cellVal(cx, cy + (qy === 1 ? 1 : -1));
        for (let qx = 0; qx < 2; qx += 1) {
          const horz = cellVal(cx + (qx === 1 ? 1 : -1), cy);
          const value = horz === vert && horz !== center ? horz : center;
          for (let dy = 0; dy < 2; dy += 1) {
            const py = cy * SCALE + qy * 2 + dy;
            const start = py * WIDTH + cx * SCALE + qx * 2;
            mask[start] = value;
            mask[start + 1] = value;
          }
        }
      }
    }
  }

  // Tile grass-field.png at native 1:1 pixel resolution across the entire 2800x1800 world canvas
  const gw = grass.naturalWidth || 1168;
  const gh = grass.naturalHeight || 784;
  const startY = (OY % gh) - gh;
  const startX = (OX % gw) - gw;
  for (let ty = startY; ty < HEIGHT; ty += gh) {
    for (let tx = startX; tx < WIDTH; tx += gw) {
      ctx.drawImage(grass, tx, ty);
    }
  }
  const image = ctx.getImageData(0, 0, WIDTH, HEIGHT);
  const data = image.data;
  const put = (x: number, y: number, r: number, g: number, b: number) => {
    if (x < 0 || y < 0 || x >= WIDTH || y >= HEIGHT) return;
    const i = (y * WIDTH + x) * 4;
    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
    data[i + 3] = 255;
  };
  const at = (x: number, y: number) =>
    y < 0 || y >= FIELD_H || x < 0 || x >= WIDTH ? 1 : mask[y * WIDTH + x];

  for (let y = 0; y < FIELD_H; y += 1) {
    const gy = y >> 1;
    for (let x = 0; x < WIDTH; x += 1) {
      const cell = at(x, y);
      if (cell !== 2 && cell !== 3) continue;
      const gx = x >> 1;
      const hv = hash(gx, gy);
      if (cell === 3) {
        let dist = 10;
        for (let r = 1; r < 10; r += 1) {
          if (
            at(x - r, y) !== 3 ||
            at(x + r, y) !== 3 ||
            at(x, y - r) !== 3 ||
            at(x, y + r) !== 3
          ) {
            dist = r;
            break;
          }
        }
        if (dist <= 2) {
          if (hv % 3 === 0) put(x, y, 106, 144, 48);
          else if (hv % 3 === 1) put(x, y, 132, 166, 62);
          else put(x, y, 138, 126, 94);
        } else if (dist <= 5) {
          if (hv % 6 === 0) put(x, y, 118, 204, 232);
          else put(x, y, 88, 184, 218);
        } else if (dist <= 8) {
          put(x, y, 64, 158, 204);
        } else {
          const ripple = gy % 9 === 0 && (gx + gy * 5) % 17 < 3;
          if (ripple) put(x, y, 136, 212, 238);
          else if ((gx + gy + (hv % 3)) % 4 === 0) put(x, y, 46, 128, 182);
          else put(x, y, 56, 142, 196);
        }
      } else {
        const edge1 =
          at(x - 2, y) !== 2 ||
          at(x + 2, y) !== 2 ||
          at(x, y - 2) !== 2 ||
          at(x, y + 2) !== 2;
        const edge2 =
          !edge1 &&
          (at(x - 4, y) !== 2 ||
            at(x + 4, y) !== 2 ||
            at(x, y - 4) !== 2 ||
            at(x, y + 4) !== 2);
        const edge3 =
          !edge1 &&
          !edge2 &&
          (at(x - 6, y) !== 2 ||
            at(x + 6, y) !== 2 ||
            at(x, y - 6) !== 2 ||
            at(x, y + 6) !== 2);
        if (edge1) {
          if (hv % 5 < 2) {
            put(x, y, hv % 2 === 0 ? 118 : 138, hv % 2 === 0 ? 156 : 174, 44);
          } else if (hv % 2 === 0) {
            put(x, y, 160, 116, 66);
          } else {
            put(x, y, 174, 128, 74);
          }
        } else if (edge2) {
          if (hv % 4 === 0) put(x, y, 174, 128, 74);
          else if (hv % 3 === 0) put(x, y, 190, 144, 84);
          else put(x, y, 204, 158, 94);
        } else if (edge3) {
          if (hv % 4 === 0) put(x, y, 194, 148, 88);
          else put(x, y, 212, 168, 102);
        } else {
          const dxP = (x - (568 + OX)) / 110;
          const dyP = (y - (336 + OY)) / 86;
          const inPlaza = dxP * dxP + dyP * dyP < 0.88;
          const rowId = Math.floor(gy / 4);
          const colShift = rowId * 3 + (hash(0, rowId) % 3);
          const colId = Math.floor((gx + colShift) / 5);
          const localX = (gx + colShift) % 5;
          const localY = gy % 4;
          const stoneH = hash(colId, rowId);
          if (inPlaza && stoneH % 7 !== 0) {
            if (localX === 0 || localY === 0) put(x, y, 198, 152, 92);
            else if (localX === 1 && localY === 1) put(x, y, 228, 188, 124);
            else if ((stoneH + hv) % 4 === 0) put(x, y, 222, 180, 114);
            else put(x, y, 214, 170, 102);
          } else if (hv % 19 === 0) {
            put(x, y, 186, 142, 82);
          } else if (hv % 13 === 0) {
            put(x, y, 226, 186, 120);
          } else if (hv % 5 === 0) {
            put(x, y, 208, 164, 98);
          } else {
            put(x, y, 216, 172, 104);
          }
        }
      }
    }
  }

  for (const [lx, ly] of LILY_PADS) {
    for (let dy = -5; dy <= 5; dy += 1) {
      for (let dx = -7; dx <= 7; dx += 1) {
        if ((dx * dx) / 49 + (dy * dy) / 25 <= 1) {
          if (dx > 2 && dy >= -2 && dy <= 1) continue;
          if (dy < -2 || dx < -3) put(lx + dx, ly + dy, 126, 192, 68);
          else if (dy > 2) put(lx + dx, ly + dy, 64, 124, 38);
          else put(lx + dx, ly + dy, 92, 162, 52);
        }
      }
    }
    if ((lx + ly) % 2 === 0) {
      for (let dy = -2; dy <= 0; dy += 1) {
        for (let dx = -2; dx <= 1; dx += 1) {
          put(lx + dx - 1, ly + dy - 1, 250, 210, (dx + dy) % 2 === 0 ? 224 : 245);
        }
      }
    }
  }

  const safeGrass = (x: number, y: number, pad = 8) => {
    for (let dy = -pad; dy <= pad; dy += pad) {
      for (let dx = -pad; dx <= pad; dx += pad) {
        if (at(x + dx, y + dy) !== 1) return false;
      }
    }
    return true;
  };

  const dot = (x: number, y: number, r: number, g: number, b: number) => {
    const cell = at(x, y);
    if (cell === 1 || cell === 2) put(x, y, r, g, b);
  };

  const paintMarks = (x: number, y: number, marks: Array<[number, number, [number, number, number]]>) => {
    const scale = 2;
    for (const [dx, dy, color] of marks) {
      for (let sy = 0; sy < scale; sy += 1) {
        for (let sx = 0; sx < scale; sx += 1) {
          dot(x + dx * scale + sx, y + dy * scale + sy, color[0], color[1], color[2]);
        }
      }
    }
  };

  const daisy = (x: number, y: number, petal: [number, number, number], shade: [number, number, number]) => {
    if (!safeGrass(x, y, 8)) return;
    const goldH: [number, number, number] = [255, 226, 96];
    const gold: [number, number, number] = [238, 188, 42];
    const core: [number, number, number] = [198, 140, 26];
    const stem: [number, number, number] = [64, 118, 32];
    const leafD: [number, number, number] = [52, 102, 28];
    const leaf: [number, number, number] = [84, 142, 38];
    const leafL: [number, number, number] = [118, 174, 50];
    paintMarks(x, y, [
      [-4, 2, leafD], [-3, 3, leaf], [4, 2, leafD], [4, 3, leaf],
      [-3, 4, leafL], [-2, 4, leaf], [-1, 4, stem], [2, 4, stem], [3, 4, leaf], [4, 4, leafL],
      [-4, 5, leafD], [-3, 5, leaf], [-2, 5, leafL], [-1, 5, leaf], [0, 5, stem], [1, 5, stem], [2, 5, leaf], [3, 5, leafL], [4, 5, leafD],
      [-3, 6, leafD], [-2, 6, leaf], [-1, 6, leafL], [0, 6, stem], [1, 6, leaf], [2, 6, leafL], [3, 6, leafD],
      [0, -4, shade], [1, -4, petal],
      [0, -3, petal], [1, -3, petal],
      [-3, -3, shade], [-2, -3, petal], [-3, -2, petal], [-2, -2, petal], [-1, -2, shade],
      [3, -3, petal], [4, -3, shade], [2, -2, shade], [3, -2, petal], [4, -2, petal],
      [-4, 0, shade], [-3, 0, petal], [-2, 0, petal],
      [-4, 1, petal], [-3, 1, petal], [-2, 1, shade],
      [3, 0, petal], [4, 0, petal], [5, 0, shade],
      [3, 1, shade], [4, 1, petal], [5, 1, petal],
      [-3, 3, shade], [-2, 3, petal], [-3, 2, shade], [-2, 2, petal], [-1, 2, petal],
      [3, 3, petal], [4, 3, shade], [2, 2, petal], [3, 2, petal], [4, 2, shade],
      [0, 3, petal], [1, 3, petal],
      [0, 4, petal], [1, 4, shade],
      [-1, -1, petal], [0, -2, petal], [1, -2, petal], [2, -1, petal],
      [-1, 0, petal], [2, 0, petal],
      [-1, 1, shade], [2, 1, shade],
      [0, 2, petal], [1, 2, petal],
      [0, -1, gold], [1, -1, gold],
      [0, 0, goldH], [1, 0, gold],
      [0, 1, gold], [1, 1, core],
    ]);
  };

  const yellowCluster = (x: number, y: number) => {
    if (!safeGrass(x, y, 10)) return;
    const bright: [number, number, number] = [244, 206, 52];
    const mid: [number, number, number] = [228, 176, 28];
    const dark: [number, number, number] = [186, 132, 22];
    const leaf: [number, number, number] = [72, 122, 34];
    const leafL: [number, number, number] = [112, 160, 44];
    const bloom = (ox: number, oy: number): Array<[number, number, [number, number, number]]> => [
      [ox, oy - 2, bright], [ox + 1, oy - 2, bright],
      [ox - 1, oy - 1, bright], [ox, oy - 1, mid], [ox + 1, oy - 1, bright], [ox + 2, oy - 1, bright],
      [ox - 1, oy, mid], [ox, oy, dark], [ox + 1, oy, mid], [ox + 2, oy, bright],
      [ox, oy + 1, bright], [ox + 1, oy + 1, mid],
    ];
    paintMarks(x, y, [
      [-2, 3, leaf], [-1, 4, leafL], [0, 4, leaf], [1, 5, leaf], [2, 4, leafL],
      [3, 5, leaf], [4, 4, leaf], [5, 5, leafL], [6, 4, leaf], [7, 3, leafL], [8, 4, leaf],
      ...bloom(0, 0),
      ...bloom(5, -1),
      ...bloom(2, 3),
      ...bloom(7, 2),
    ]);
  };

  const tulip = (x: number, y: number) => {
    if (!safeGrass(x, y + 6, 8)) return;
    for (const [dx, dy, r, g, b] of TULIP_MARKS) dot(x + dx, y + dy, r, g, b);
  };

  const white: [number, number, number] = [248, 250, 236];
  const whiteShade: [number, number, number] = [226, 230, 206];
  const purple: [number, number, number] = [176, 104, 206];
  const purpleShade: [number, number, number] = [132, 70, 168];

  const LAVENDER: Array<[number, number]> = [
    [880 + OX, 300 + OY], [960 + OX, 292 + OY], [1040 + OX, 308 + OY], [1110 + OX, 328 + OY],
    [910 + OX, 370 + OY], [990 + OX, 360 + OY], [1070 + OX, 390 + OY],
  ];
  for (const [x, y] of LAVENDER) daisy(x, y, purple, purpleShade);

  for (let y = 36; y < FIELD_H - 20; y += 86) {
    for (let x = 28; x < WIDTH - 24; x += 96) {
      const roll = hash(x, y);
      if (roll % 4 === 0) continue;
      const fx = x + (roll % 25) - 12;
      const fy = y + (hash(x + 4, y) % 23) - 11;
      if (fx > 850 + OX && fx < 1130 + OX && fy > 260 + OY && fy < 430 + OY) continue;
      if (fx > 725 + OX && fx < 1055 + OX && fy > 25 + OY && fy < 215 + OY) continue;
      if (fx > 400 + OX && fx < 720 + OX && fy > 35 + OY && fy < 165 + OY) continue;
      if (fx > 95 + OX && fx < 210 + OX && fy > 225 + OY && fy < 280 + OY) continue;
      // Exclude Western Agricultural Fodder Estate & Farmhouse Homestead
      if (fx > -350 + OX && fx < 268 + OX && fy > 475 + OY && fy < 770 + OY) continue;
      if (fx > -480 + OX && fx < -260 + OX && fy > 15 + OY && fy < 210 + OY) continue;
      // Exclude Northern Red Barn Ranch & Paddock
      if (fx > 310 + OX && fx < 820 + OX && fy > -390 + OY && fy < -180 + OY) continue;
      // Exclude Eastern Orchard
      if (fx > 1060 + OX && fx < 1560 + OX && fy > 20 + OY && fy < 360 + OY) continue;
      if (roll % 3 === 0) yellowCluster(fx, fy);
      else daisy(fx, fy, white, whiteShade);
    }
  }

  const TULIPS: Array<[number, number]> = [
    [286 + OX, 140 + OY], [312 + OX, 136 + OY], [338 + OX, 144 + OY],
    [286 + OX, 468 + OY], [312 + OX, 464 + OY], [338 + OX, 472 + OY],
    [690 + OX, 486 + OY], [716 + OX, 480 + OY], [742 + OX, 490 + OY],
    [856 + OX, 190 + OY], [882 + OX, 186 + OY], [908 + OX, 194 + OY],
    // Farmhouse & Southern Crossroads tulip beds
    [-448 + OX, 186 + OY], [-422 + OX, 182 + OY], [-396 + OX, 188 + OY],
    [-340 + OX, 186 + OY], [-314 + OX, 182 + OY], [-288 + OX, 188 + OY],
    [520 + OX, 926 + OY], [546 + OX, 922 + OY], [572 + OX, 928 + OY],
    [630 + OX, 926 + OY], [656 + OX, 922 + OY], [682 + OX, 928 + OY],
  ];
  for (const [x, y] of TULIPS) tulip(x, y);

  const POND: Array<[number, number]> = [
    [238 + OX, 272 + OY], [254 + OX, 368 + OY], [216 + OX, 392 + OY], [148 + OX, 396 + OY], [84 + OX, 390 + OY], [216 + OX, 260 + OY],
    [1510 + OX, 456 + OY], [1660 + OX, 462 + OY], [1682 + OX, 562 + OY], [1540 + OX, 598 + OY],
  ];
  for (const [x, y] of POND) {
    if (hash(x, y) % 3 === 0) yellowCluster(x, y);
    else daisy(x, y, white, whiteShade);
  }

  const fruitTree = (
    cx: number,
    cy: number,
    apples: Array<[number, number, "red" | "gold" | "gold_small"]>,
  ) => {
    for (let gy = 27; gy <= 33; gy += 1) {
      for (let gx = -10; gx <= 10; gx += 1) {
        if ((gx / 10) ** 2 + ((gy - 30.5) / 3.2) ** 2 <= 1) {
          for (let sy = 0; sy < 2; sy += 1) {
            for (let sx = 0; sx < 2; sx += 1) {
              const px = cx + gx * 2 + sx;
              const py = cy + gy * 2 + sy;
              if (cellVal(px >> 2, py >> 2) === 1) {
                const idx = (py * WIDTH + px) * 4;
                data[idx] = Math.round(data[idx] * 0.65);
                data[idx + 1] = Math.round(data[idx + 1] * 0.72);
                data[idx + 2] = Math.round(data[idx + 2] * 0.6);
              }
            }
          }
        }
      }
    }

    for (let gy = 14; gy <= 32; gy += 1) {
      const halfW = gy < 24 ? 4.6 - (gy - 14) * 0.08 : 3.8 + (gy - 24) * 0.48;
      for (let gx = -9; gx <= 9; gx += 1) {
        if (gy >= 30 && (gx === -3 || gx === -2 || gx === 2 || gx === 3)) continue;
        if (gy === 32 && Math.abs(gx) !== 0 && Math.abs(gx) !== 1 && Math.abs(gx) !== 5 && Math.abs(gx) !== 6) {
          continue;
        }
        if (Math.abs(gx) <= halfW) {
          let col: [number, number, number];
          if (Math.abs(gx) >= halfW - 0.9 || gy === 32) col = [38, 22, 12];
          else if (gy < 17) col = gy === 14 ? [38, 22, 12] : [72, 42, 20];
          else if (gx === -1 || gx === 2 || gx > 3) col = [72, 42, 20];
          else if (gx === -2 && gy < 28) col = [138, 88, 44];
          else col = [108, 66, 32];
          for (let sy = 0; sy < 2; sy += 1) {
            for (let sx = 0; sx < 2; sx += 1) {
              put(cx + gx * 2 + sx, cy + gy * 2 + sy, col[0], col[1], col[2]);
            }
          }
        }
      }
    }

    for (const [gx, gy, palIdx] of TREE_MARKS) {
      const col = LEAF_PAL[palIdx] ?? LEAF_PAL[0];
      for (let sy = 0; sy < 2; sy += 1) {
        for (let sx = 0; sx < 2; sx += 1) {
          put(cx + gx * 2 + sx, cy + gy * 2 + sy, col[0], col[1], col[2]);
        }
      }
    }

    for (const [ax, ay, kind] of apples) {
      if (kind === "gold_small") {
        const smallMarks: Array<[number, number, [number, number, number]]> = [
          [0, -1, [68, 88, 24]], [1, -1, [68, 88, 24]],
          [-1, 0, [168, 108, 22]], [0, 0, [248, 208, 68]], [1, 0, [232, 172, 42]], [2, 0, [124, 78, 18]],
          [-1, 1, [148, 92, 18]], [0, 1, [228, 164, 38]], [1, 1, [196, 128, 28]], [2, 1, [92, 56, 14]],
          [0, 2, [92, 56, 14]], [1, 2, [92, 56, 14]],
        ];
        for (const [dx, dy, col] of smallMarks) {
          for (let sy = 0; sy < 2; sy += 1) {
            for (let sx = 0; sx < 2; sx += 1) {
              put(cx + (ax + dx) * 2 + sx, cy + (ay + dy) * 2 + sy, col[0], col[1], col[2]);
            }
          }
        }
        continue;
      }
      const aOut: [number, number, number] = kind === "red" ? [58, 14, 14] : [68, 42, 12];
      const aShd: [number, number, number] = kind === "red" ? [148, 22, 24] : [182, 108, 20];
      const aMid: [number, number, number] = kind === "red" ? [212, 38, 34] : [238, 168, 34];
      const aBrt: [number, number, number] = kind === "red" ? [242, 74, 58] : [252, 208, 62];
      const aHlt: [number, number, number] = kind === "red" ? [255, 168, 148] : [255, 244, 156];
      const appleMarks: Array<[number, number, [number, number, number]]> = [
        [-1, -3, aOut], [0, -3, [52, 92, 24]], [1, -3, [128, 188, 52]], [2, -3, aOut],
        [-2, -2, aOut], [-1, -2, aBrt], [0, -2, aMid], [1, -2, aBrt], [2, -2, aMid], [3, -2, aOut],
        [-3, -1, aOut], [-2, -1, aBrt], [-1, -1, aHlt], [0, -1, aBrt], [1, -1, aBrt], [2, -1, aMid], [3, -1, aShd], [4, -1, aOut],
        [-3, 0, aOut], [-2, 0, aMid], [-1, 0, aBrt], [0, 0, aBrt], [1, 0, aMid], [2, 0, aMid], [3, 0, aShd], [4, 0, aOut],
        [-3, 1, aOut], [-2, 1, aShd], [-1, 1, aMid], [0, 1, aMid], [1, 1, aMid], [2, 1, aShd], [3, 1, aShd], [4, 1, aOut],
        [-2, 2, aOut], [-1, 2, aShd], [0, 2, aShd], [1, 2, aShd], [2, 2, aShd], [3, 2, aOut],
        [-1, 3, aOut], [0, 3, aOut], [1, 3, aOut], [2, 3, aOut],
      ];
      for (const [dx, dy, col] of appleMarks) {
        for (let sy = 0; sy < 2; sy += 1) {
          for (let sx = 0; sx < 2; sx += 1) {
            put(cx + (ax + dx) * 2 + sx, cy + (ay + dy) * 2 + sy, col[0], col[1], col[2]);
          }
        }
      }
    }
  };

  // Central Orchard
  fruitTree(836 + OX, 72 + OY, [
    [-11, -6, "red"],
    [-4, 2, "red"],
    [8, -4, "red"],
  ]);
  fruitTree(938 + OX, 84 + OY, [
    [-9, 5, "red"],
    [4, -8, "gold"],
    [8, 2, "gold"],
  ]);
  fruitTree(780 + OX, 100 + OY, [
    [-4, -8, "red"],
    [-11, 2, "red"],
    [4, 2, "gold"],
    [-4, 11, "gold_small"],
  ]);
  fruitTree(996 + OX, 126 + OY, [
    [-6, -5, "gold"],
    [8, 2, "gold"],
    [-8, 7, "gold"],
    [5, 13, "gold_small"],
  ]);

  // Eastern Grand Orchard (Kebun Buah & Hutan Timur)
  fruitTree(1140 + OX, 88 + OY, [[-9, -5, "red"], [5, 2, "red"], [-3, 6, "gold"]]);
  fruitTree(1260 + OX, 82 + OY, [[-8, 4, "gold"], [6, -6, "gold"], [8, 3, "red"]]);
  fruitTree(1380 + OX, 92 + OY, [[-10, -4, "red"], [-2, 3, "red"], [7, -2, "red"]]);
  fruitTree(1190 + OX, 276 + OY, [[-7, -6, "gold"], [5, 4, "gold"], [-5, 7, "gold_small"]]);
  fruitTree(1310 + OX, 284 + OY, [[-9, 2, "red"], [4, -7, "red"], [8, 2, "gold"]]);
  fruitTree(1490 + OX, 260 + OY, [[-8, -5, "red"], [6, 3, "gold"], [-4, 6, "red"]]);

  // Farmhouse Homestead & Northern Ranch Trees
  fruitTree(-496 + OX, 76 + OY, [[-8, -4, "red"], [6, 2, "gold"], [-3, 5, "red"]]);
  fruitTree(-244 + OX, 78 + OY, [[-7, 3, "gold"], [5, -6, "red"], [7, 4, "gold"]]);
  fruitTree(256 + OX, -292 + OY, [[-9, -4, "red"], [5, 2, "red"]]);
  fruitTree(864 + OX, -292 + OY, [[-7, -5, "gold"], [6, 3, "gold"]]);
  fruitTree(390 + OX, 860 + OY, [[-8, -4, "red"], [5, 3, "gold"]]);
  fruitTree(796 + OX, 860 + OY, [[-7, 3, "red"], [6, -5, "red"]]);

  // Helper for 2.5D wooden post-and-rail perimeter fence
  const drawFenceRailH = (x0: number, x1: number, yTop: number) => {
    for (let px = x0; px <= x1; px += 1) {
      const gx = px >> 1;
      put(px, yTop, 42, 24, 12);
      put(px, yTop + 1, 198, 138, 72);
      put(px, yTop + 2, gx % 4 === 0 ? 162 : 176, gx % 4 === 0 ? 104 : 116, 54);
      put(px, yTop + 3, 124, 76, 34);
      put(px, yTop + 4, 42, 24, 12);
      put(px, yTop + 6, 42, 24, 12);
      put(px, yTop + 7, 178, 118, 56);
      put(px, yTop + 8, 134, 82, 38);
      put(px, yTop + 9, 42, 24, 12);
    }
  };

  const drawFenceRailV = (xLeft: number, y0: number, y1: number) => {
    for (let py = y0; py <= y1; py += 1) {
      const gy = py >> 1;
      put(xLeft, py, 42, 24, 12);
      put(xLeft + 1, py, 192, 132, 68);
      put(xLeft + 2, py, gy % 4 === 0 ? 154 : 168, gy % 4 === 0 ? 98 : 110, 50);
      put(xLeft + 3, py, 122, 74, 34);
      put(xLeft + 4, py, 42, 24, 12);
    }
  };

  const drawFencePost = (cx: number, cy: number) => {
    for (let dy = -7; dy <= 5; dy += 1) {
      for (let dx = -3; dx <= 3; dx += 1) {
        const isOut = dx === -3 || dx === 3 || dy === -7 || dy === 5;
        if (isOut) put(cx + dx, cy + dy, 38, 22, 10);
        else if (dy === -6 || dy === -5) put(cx + dx, cy + dy, dy === -6 ? 224 : 198, dy === -6 ? 172 : 142, dy === -6 ? 102 : 76);
        else if (dy === -4) put(cx + dx, cy + dy, 74, 44, 20);
        else if (dx === -2) put(cx + dx, cy + dy, 186, 126, 62);
        else if (dx === -1 || dx === 0) put(cx + dx, cy + dy, 158, 100, 46);
        else put(cx + dx, cy + dy, 116, 70, 30);
      }
    }
  };

  const drawHayBale = (bx: number, by: number) => {
    for (let dy = -6; dy <= 6; dy += 1) {
      for (let dx = -9; dx <= 9; dx += 1) {
        if (dy === 6 && Math.abs(dx) <= 8) {
          put(bx + dx, by + dy, 64, 82, 24);
          continue;
        }
        if (Math.abs(dx) === 9 || dy === -6 || dy === 5) {
          if (Math.abs(dx) === 9 && (dy === -6 || dy === 5)) continue;
          put(bx + dx, by + dy, 68, 42, 16);
        } else if (dx === -3 || dx === 3) {
          put(bx + dx, by + dy, dy < 0 ? 148 : 112, dy < 0 ? 92 : 66, 32);
        } else if (dy <= -2) {
          put(bx + dx, by + dy, (dx + dy) % 2 === 0 ? 255 : 244, (dx + dy) % 2 === 0 ? 228 : 202, 78);
        } else if (dy <= 1) {
          put(bx + dx, by + dy, (dx + dy) % 2 === 0 ? 238 : 216, (dx + dy) % 2 === 0 ? 184 : 158, 46);
        } else {
          put(bx + dx, by + dy, (dx + dy) % 2 === 0 ? 194 : 172, (dx + dy) % 2 === 0 ? 136 : 116, 30);
        }
      }
    }
  };

  // Render all 4 Fenced Fodder & Crop Plots in the Western Agricultural Estate
  for (const plot of FODDER_PLOTS) {
    const { x0: FX0, x1: FX1, y0: FY0, y1: FY1 } = plot;
    for (let py = FY0 - 3; py <= FY1 + 4; py += 1) {
      for (let px = FX0 - 3; px <= FX1 + 3; px += 1) {
        if (px >= FX0 && px <= FX1 && py >= FY0 && py <= FY1) continue;
        if (at(px, py) === 1) {
          const idx = (py * WIDTH + px) * 4;
          data[idx] = Math.round(data[idx] * 0.76);
          data[idx + 1] = Math.round(data[idx + 1] * 0.81);
          data[idx + 2] = Math.round(data[idx + 2] * 0.7);
        }
      }
    }

    const GREEN_ROW_YS = [FY0 + 54, FY0 + 70, FY0 + 86];
    for (let py = FY0 + 4; py <= FY1 - 4; py += 1) {
      const gy = py >> 1;
      for (let px = FX0 + 4; px <= FX1 - 4; px += 1) {
        const gx = px >> 1;
        const hv = hash(gx, gy);
        if (py <= FY0 + 42) {
          if ((gx + gy) % 3 === 0) put(px, py, 78, 46, 22);
          else put(px, py, 92, 56, 26);
        } else {
          let minDy = 99;
          for (const ry of GREEN_ROW_YS) {
            if (Math.abs(py - ry) < Math.abs(minDy)) minDy = py - ry;
          }
          if (px <= FX0 + 7 || px >= FX1 - 7 || minDy <= -6 || minDy >= 5) {
            put(px, py, (gx + gy) % 2 === 0 ? 56 : 64, (gx + gy) % 2 === 0 ? 32 : 38, 16);
          } else if (minDy === -5 || minDy === -4) {
            put(px, py, hv % 3 === 0 ? 122 : 112, hv % 3 === 0 ? 74 : 66, 32);
          } else if (minDy >= -3 && minDy <= 2) {
            put(px, py, (gx + gy) % 2 === 0 ? 100 : 92, (gx + gy) % 2 === 0 ? 58 : 52, 26);
          } else {
            put(px, py, 74, 42, 20);
          }
        }
      }
    }

    drawFenceRailH(FX0, FX1, FY0 - 4);
    drawFenceRailV(FX0, FY0, FY1);
    drawFenceRailV(FX1 - 4, FY0, FY0 + 36);
    drawFenceRailV(FX1 - 4, FY0 + 64, FY1);

    for (const px of [FX0 + 2, FX0 + 37, FX0 + 74, FX0 + 111, FX0 + 148, FX1 - 2]) {
      drawFencePost(px, FY0);
    }
    drawFencePost(FX0 + 2, FY0 + 32);
    drawFencePost(FX0 + 2, FY0 + 64);
    drawFencePost(FX1 - 2, FY0 + 34);
    drawFencePost(FX1 - 2, FY0 + 64);

    drawHayBale(FX0 + 16, FY0 - 18);
    drawHayBale(FX0 + 38, FY0 - 17);
    drawHayBale(FX0 + 27, FY0 - 25);
  }

  // ---------------------------------------------------------------------------
  // LANDMARK 1: Grand Red Barn & Stone Fodder Silo (Northern Ranch Zone)
  // ---------------------------------------------------------------------------
  const barnCx = 560 + OX; // 1376
  const barnCy = -296 + OY; // 212
  // Northern Ranch Paddock Fence around Barn Courtyard
  drawFenceRailH(336 + OX, 784 + OX, -366 + OY);
  drawFenceRailV(336 + OX, -366 + OY, -220 + OY);
  drawFenceRailV(780 + OX, -366 + OY, -220 + OY);
  for (let px = 338 + OX; px <= 782 + OX; px += 64) drawFencePost(px, -362 + OY);
  drawFencePost(338 + OX, -290 + OY);
  drawFencePost(338 + OX, -220 + OY);
  drawFencePost(782 + OX, -290 + OY);
  drawFencePost(782 + OX, -220 + OY);

  // Cylindrical Stone & Copper Fodder Silo (to the right of the Red Barn)
  const siloX = barnCx + 96;
  const siloY = barnCy + 6;
  for (let dy = -66; dy <= 36; dy += 1) {
    const halfW = dy < -44 ? Math.round(Math.sqrt(Math.max(0, 1 - ((dy + 44) / 22) ** 2)) * 22) : 22;
    for (let dx = -halfW; dx <= halfW; dx += 1) {
      const isOut = Math.abs(dx) === halfW || dy === -66 || dy === 36 || dy === -44;
      const shade = dx > 10 ? 0.78 : dx < -8 ? 1.08 : 0.94;
      if (isOut) {
        put(siloX + dx, siloY + dy, 38, 24, 16);
      } else if (dy < -44) {
        // Cobalt-blue dome roof matching homestead.jpg reference
        put(
          siloX + dx,
          siloY + dy,
          Math.min(255, Math.round(52 * shade)),
          Math.min(255, Math.round(102 * shade)),
          Math.min(255, Math.round(182 * shade)),
        );
      } else if (dy % 14 === 0) {
        // Iron hoop bands
        put(siloX + dx, siloY + dy, 74, 78, 86);
      } else {
        // Warm cream-stone stave wall
        const brick = ((dx + (dy >> 2) * 5) % 9 === 0) ? 0.9 : 1;
        put(
          siloX + dx,
          siloY + dy,
          Math.min(255, Math.round(218 * shade * brick)),
          Math.min(255, Math.round(196 * shade * brick)),
          Math.min(255, Math.round(162 * shade * brick)),
        );
      }
    }
  }

  // Classic 2.5D Red Barn with Cobalt-Blue Gambrel Roof & White X-Braced Doors (matching homestead.jpg)
  for (let dy = -58; dy <= 40; dy += 1) {
    const halfW =
      dy < -36
        ? 22 + Math.round(((dy + 58) / 22) * 34)
        : dy < -14
          ? 56 + Math.round(((dy + 36) / 22) * 18)
          : 70;
    for (let dx = -halfW; dx <= halfW; dx += 1) {
      const bx = barnCx + dx;
      const by = barnCy + dy;
      const isRoof = dy < -14;
      const isTrim =
        Math.abs(dx) >= halfW - 2 ||
        (isRoof && (Math.abs(dy + 36) <= 1 || Math.abs(dy + 14) <= 2));
      if (Math.abs(dx) === halfW || dy === -58 || dy === 40) {
        put(bx, by, 38, 20, 14);
      } else if (isTrim) {
        put(bx, by, 248, 244, 232);
      } else if (isRoof) {
        // Deep navy/cobalt-blue roof shingles matching homestead.jpg
        const shingle = (dx + dy * 3) % 7 === 0 ? 0.84 : (dx + dy) % 5 === 0 ? 1.06 : 0.96;
        put(bx, by, Math.round(46 * shingle), Math.round(84 * shingle), Math.round(148 * shingle));
      } else {
        // Crimson red vertical wood plank siding
        const plank = dx % 6 === 0 ? 0.82 : dx % 3 === 0 ? 0.94 : 1.0;
        // White corner pillars
        if (Math.abs(dx) >= 64) {
          put(bx, by, 244, 238, 224);
        } else if (dy >= -8 && dy <= 6 && Math.abs(dx) <= 14) {
          // Hayloft window frame & golden hay inside
          if (Math.abs(dx) >= 12 || dy <= -6 || dy >= 5) put(bx, by, 246, 240, 226);
          else if (dy >= 1) put(bx, by, (dx + dy) % 2 === 0 ? 246 : 224, (dx + dy) % 2 === 0 ? 196 : 168, 52);
          else put(bx, by, 48, 30, 20);
        } else if (dy >= 12 && Math.abs(dx) <= 26) {
          // Double barn doors with white X-bracing
          const inDoor = Math.abs(dx) <= 23 && dy >= 15;
          if (!inDoor) {
            put(bx, by, 248, 242, 228);
          } else if (
            Math.abs(dx) <= 1 ||
            Math.abs(Math.abs(dx) - (dy - 14) * 0.9) <= 1.6 ||
            Math.abs(Math.abs(dx) - (40 - dy) * 0.9) <= 1.6
          ) {
            put(bx, by, 246, 240, 226);
          } else {
            put(bx, by, 142, 34, 28);
          }
        } else {
          put(bx, by, Math.round(188 * plank), Math.round(44 * plank), Math.round(36 * plank));
        }
      }
    }
  }
  drawHayBale(barnCx - 54, barnCy + 42);
  drawHayBale(barnCx - 34, barnCy + 43);
  drawHayBale(barnCx - 44, barnCy + 35);

  // ---------------------------------------------------------------------------
  // LANDMARK 3: Wooden Fishing Pier on Eastern Forest Pond
  // ---------------------------------------------------------------------------
  const pierX0 = 1436 + OX;
  const pierX1 = 1504 + OX;
  const pierY0 = 516 + OY;
  const pierY1 = 540 + OY;
  for (let py = pierY0; py <= pierY1; py += 1) {
    for (let px = pierX0; px <= pierX1; px += 1) {
      if (py === pierY0 || py === pierY1 || px === pierX0 || px === pierX1) {
        put(px, py, 44, 26, 14);
      } else if (px % 6 === 0) {
        put(px, py, 118, 72, 34);
      } else {
        put(px, py, (px + py) % 3 === 0 ? 176 : 190, (px + py) % 3 === 0 ? 116 : 128, 62);
      }
    }
  }
  for (const px of [pierX0 + 4, pierX0 + 34, pierX1 - 4]) {
    drawFencePost(px, pierY0);
    drawFencePost(px, pierY1);
  }

  // ---------------------------------------------------------------------------
  // LANDMARK 2: Pixel-by-Pixel Blue-Roofed Reference Cottages (COTTAGE_MARKS)
  // ---------------------------------------------------------------------------
  const drawPixelCottage = (cx: number, bottomY: number, scale = 2) => {
    // Soft ground shadow under cottage base
    for (let gy = -4; gy <= 5; gy += 1) {
      for (let gx = -38; gx <= 38; gx += 1) {
        if ((gx / 38) ** 2 + (gy / 4.5) ** 2 <= 1) {
          for (let sy = 0; sy < scale; sy += 1) {
            for (let sx = 0; sx < scale; sx += 1) {
              const px = cx + gx * scale + sx;
              const py = bottomY + gy * scale + sy;
              if (px >= 0 && px < WIDTH && py >= 0 && py < HEIGHT && at(px, py) === 1) {
                const idx = (py * WIDTH + px) * 4;
                data[idx] = Math.round(data[idx] * 0.72);
                data[idx + 1] = Math.round(data[idx + 1] * 0.78);
                data[idx + 2] = Math.round(data[idx + 2] * 0.66);
              }
            }
          }
        }
      }
    }

    // Render every pixel mark of the blue-roofed cottage directly into image.data
    for (const [gx, gy, r, g, b] of COTTAGE_MARKS) {
      for (let sy = 0; sy < scale; sy += 1) {
        for (let sx = 0; sx < scale; sx += 1) {
          put(cx + gx * scale + sx, bottomY + gy * scale + sy, r, g, b);
        }
      }
    }
  };

  // 1. Rumah Utama Petani (Western Homestead Cottage)
  drawPixelCottage(-372 + OX, 158 + OY, 2);
  // 2. Sunnyvale Cottage (Northwest of Village Plaza, matching village.jpg)
  drawPixelCottage(242 + OX, 148 + OY, 2);
  // 3. Riverbend Cottage (South of Village Plaza, matching village.jpg)
  drawPixelCottage(424 + OX, 652 + OY, 2);
  // 4. Meadow Orchard Cottage (Northeast Orchard, matching village.jpg)
  drawPixelCottage(892 + OX, 246 + OY, 2);
  // 5. Lavender Acres Cottage (East Lavender Meadow, matching village.jpg)
  drawPixelCottage(1018 + OX, 434 + OY, 2);

  ctx.putImageData(image, 0, 0);
  return image;
}

type CowDir = "left" | "right" | "up" | "down";

const TROUGH_1_X = 568 + OX;
const TROUGH_1_Y = 86 + OY;
const TROUGH_2_X = 468 + OX;
const TROUGH_2_Y = 86 + OY;
const PIG_BOWL_X = 632 + OX;
const PIG_BOWL_Y = 134 + OY;
const CHICK_DISH_X = 552 + OX;
const CHICK_DISH_Y = 134 + OY;

const W_OUT: [number, number, number] = [32, 18, 10];
const W_INN: [number, number, number] = [58, 32, 14];
const W_DRK: [number, number, number] = [84, 48, 20];
const W_MID: [number, number, number] = [134, 80, 36];
const W_BRT: [number, number, number] = [176, 114, 54];
const W_HLT: [number, number, number] = [212, 152, 84];
const IRON: [number, number, number] = [68, 66, 64];

const G_OUT: [number, number, number] = [18, 52, 18];
const G_DRK: [number, number, number] = [32, 108, 38];
const G_MID: [number, number, number] = [54, 160, 58];
const G_BRT: [number, number, number] = [96, 210, 84];
const G_HLT: [number, number, number] = [162, 244, 138];
const H_DRK: [number, number, number] = [184, 122, 22];
const H_GLD: [number, number, number] = [238, 180, 38];
const H_BRT: [number, number, number] = [255, 226, 92];

// Empty wooden trough interior basin (always drawn first; visible when grass decreases / runs out)
const TROUGH_EMPTY_BACK: Array<[number, number, [number, number, number]]> = [
  [-12, -6, W_OUT], [-11, -6, W_OUT], [-10, -6, W_OUT], [-9, -6, W_OUT], [-8, -6, W_OUT], [-7, -6, W_OUT], [-6, -6, W_OUT], [-5, -6, W_OUT], [-4, -6, W_OUT], [-3, -6, W_OUT], [-2, -6, W_OUT], [-1, -6, W_OUT], [0, -6, W_OUT], [1, -6, W_OUT], [2, -6, W_OUT], [3, -6, W_OUT], [4, -6, W_OUT], [5, -6, W_OUT], [6, -6, W_OUT], [7, -6, W_OUT], [8, -6, W_OUT], [9, -6, W_OUT], [10, -6, W_OUT], [11, -6, W_OUT], [12, -6, W_OUT],
  [-12, -5, W_OUT], [-11, -5, W_BRT], [-10, -5, W_MID], [-9, -5, W_MID], [-8, -5, W_MID], [-7, -5, W_MID], [-6, -5, W_MID], [-5, -5, W_MID], [-4, -5, W_MID], [-3, -5, W_MID], [-2, -5, W_MID], [-1, -5, W_MID], [0, -5, W_MID], [1, -5, W_MID], [2, -5, W_MID], [3, -5, W_MID], [4, -5, W_MID], [5, -5, W_MID], [6, -5, W_MID], [7, -5, W_MID], [8, -5, W_MID], [9, -5, W_MID], [10, -5, W_MID], [11, -5, W_BRT], [12, -5, W_OUT],
  [-12, -4, W_OUT], [-11, -4, W_MID], [-10, -4, W_DRK], [-9, -4, W_DRK], [-8, -4, W_DRK], [-7, -4, W_DRK], [-6, -4, W_DRK], [-5, -4, W_DRK], [-4, -4, W_DRK], [-3, -4, W_DRK], [-2, -4, W_DRK], [-1, -4, W_DRK], [0, -4, W_DRK], [1, -4, W_DRK], [2, -4, W_DRK], [3, -4, W_DRK], [4, -4, W_DRK], [5, -4, W_DRK], [6, -4, W_DRK], [7, -4, W_DRK], [8, -4, W_DRK], [9, -4, W_DRK], [10, -4, W_DRK], [11, -4, W_MID], [12, -4, W_OUT],
  [-12, -3, W_OUT], [-11, -3, W_MID], [-10, -3, W_DRK], [-9, -3, W_INN], [-8, -3, W_INN], [-7, -3, W_INN], [-6, -3, W_INN], [-5, -3, W_INN], [-4, -3, W_INN], [-3, -3, W_INN], [-2, -3, W_INN], [-1, -3, W_INN], [0, -3, W_INN], [1, -3, W_INN], [2, -3, W_INN], [3, -3, W_INN], [4, -3, W_INN], [5, -3, W_INN], [6, -3, W_INN], [7, -3, W_INN], [8, -3, W_INN], [9, -3, W_INN], [10, -3, W_DRK], [11, -3, W_MID], [12, -3, W_OUT],
  [-12, -2, W_OUT], [-11, -2, W_DRK], [-10, -2, W_OUT], [-9, -2, W_INN], [-8, -2, W_INN], [-7, -2, W_INN], [-6, -2, W_INN], [-5, -2, W_INN], [-4, -2, W_INN], [-3, -2, W_INN], [-2, -2, W_INN], [-1, -2, W_INN], [0, -2, W_INN], [1, -2, W_INN], [2, -2, W_INN], [3, -2, W_INN], [4, -2, W_INN], [5, -2, W_INN], [6, -2, W_INN], [7, -2, W_INN], [8, -2, W_INN], [9, -2, W_INN], [10, -2, W_OUT], [11, -2, W_DRK], [12, -2, W_OUT],
];

// Progressive fodder layers (1 = 25% low, 2 = 50% half, 3 = 75% high, 4 = 100% overflowing)
const FODDER_LVL_1: Array<[number, number, [number, number, number]]> = [
  [-8, -2, G_DRK], [-7, -2, G_MID], [-6, -2, H_DRK], [-5, -2, G_BRT], [-4, -2, G_DRK],
  [-2, -2, G_MID], [-1, -2, H_GLD], [0, -2, G_BRT], [1, -2, G_DRK],
  [4, -2, G_DRK], [5, -2, G_MID], [6, -2, H_GLD], [7, -2, G_BRT], [8, -2, G_DRK],
  [-7, -3, G_MID], [-6, -3, G_BRT], [-1, -3, G_MID], [0, -3, H_BRT], [5, -3, G_BRT], [6, -3, G_MID],
];

const FODDER_LVL_2: Array<[number, number, [number, number, number]]> = [
  [-9, -3, G_DRK], [-8, -3, H_GLD], [-7, -3, G_BRT], [-6, -3, G_DRK], [-5, -3, G_BRT], [-4, -3, H_BRT], [-3, -3, G_MID], [-2, -3, G_BRT], [-1, -3, G_DRK], [0, -3, G_HLT], [1, -3, G_BRT], [2, -3, H_GLD], [3, -3, G_MID], [4, -3, G_DRK], [5, -3, G_BRT], [6, -3, H_BRT], [7, -3, G_MID], [8, -3, G_BRT], [9, -3, G_DRK],
  [-8, -4, G_OUT], [-7, -4, G_MID], [-6, -4, H_GLD], [-5, -4, G_BRT], [-4, -4, G_OUT],
  [-2, -4, G_OUT], [-1, -4, G_BRT], [0, -4, G_HLT], [1, -4, H_GLD], [2, -4, G_OUT],
  [4, -4, G_OUT], [5, -4, G_MID], [6, -4, G_BRT], [7, -4, H_GLD], [8, -4, G_OUT],
];

const FODDER_LVL_3: Array<[number, number, [number, number, number]]> = [
  [-9, -4, G_DRK], [-8, -4, G_BRT], [-7, -4, H_BRT], [-6, -4, G_MID], [-5, -4, G_HLT], [-4, -4, G_BRT], [-3, -4, H_GLD], [-2, -4, G_BRT], [-1, -4, G_MID], [0, -4, G_BRT], [1, -4, G_HLT], [2, -4, G_BRT], [3, -4, H_BRT], [4, -4, G_MID], [5, -4, G_HLT], [6, -4, G_BRT], [7, -4, H_GLD], [8, -4, G_MID], [9, -4, G_DRK],
  [-9, -5, G_OUT], [-8, -5, G_MID], [-7, -5, G_BRT], [-6, -5, G_HLT], [-5, -5, H_BRT], [-4, -5, G_MID], [-3, -5, G_OUT], [-2, -5, G_MID], [-1, -5, G_BRT], [0, -5, G_HLT], [1, -5, G_BRT], [2, -5, G_MID], [3, -5, G_OUT], [4, -5, G_MID], [5, -5, H_BRT], [6, -5, G_HLT], [7, -5, G_BRT], [8, -5, G_MID], [9, -5, G_OUT],
];

const FODDER_LVL_4: Array<[number, number, [number, number, number]]> = [
  [-7, -7, G_OUT], [-6, -7, G_OUT], [-5, -7, G_OUT], [-1, -7, G_OUT], [0, -7, G_OUT], [1, -7, G_OUT], [5, -7, G_OUT], [6, -7, G_OUT], [7, -7, G_OUT],
  [-7, -6, G_OUT], [-6, -6, G_BRT], [-5, -6, G_HLT], [-2, -6, G_OUT], [-1, -6, G_BRT], [0, -6, H_BRT], [1, -6, G_BRT], [2, -6, G_OUT], [5, -6, G_HLT], [6, -6, G_BRT], [7, -6, G_OUT],
];

const TROUGH_FRONT_BASE: Array<[number, number, [number, number, number]]> = [
  // Front wooden lip (gy = -1)
  [-12, -1, W_OUT], [-11, -1, W_BRT], [-10, -1, W_BRT], [-9, -1, W_HLT], [-8, -1, W_HLT], [-7, -1, W_HLT], [-6, -1, W_HLT], [-5, -1, W_HLT], [-4, -1, W_HLT], [-3, -1, W_HLT], [-2, -1, W_HLT], [-1, -1, W_HLT], [0, -1, W_HLT], [1, -1, W_HLT], [2, -1, W_HLT], [3, -1, W_HLT], [4, -1, W_HLT], [5, -1, W_HLT], [6, -1, W_HLT], [7, -1, W_HLT], [8, -1, W_HLT], [9, -1, W_HLT], [10, -1, W_BRT], [11, -1, W_BRT], [12, -1, W_OUT],
  // Upper front oak plank & iron corner brackets (gy = 0..1)
  [-12, 0, W_OUT], [-11, 0, IRON], [-10, 0, IRON], [-9, 0, W_MID], [-8, 0, W_BRT], [-7, 0, W_BRT], [-6, 0, W_MID], [-5, 0, W_BRT], [-4, 0, W_BRT], [-3, 0, W_MID], [-2, 0, W_BRT], [-1, 0, W_BRT], [0, 0, W_BRT], [1, 0, W_MID], [2, 0, W_BRT], [3, 0, W_BRT], [4, 0, W_MID], [5, 0, W_BRT], [6, 0, W_BRT], [7, 0, W_MID], [8, 0, W_BRT], [9, 0, W_MID], [10, 0, IRON], [11, 0, IRON], [12, 0, W_OUT],
  [-12, 1, W_OUT], [-11, 1, W_DRK], [-10, 1, W_DRK], [-9, 1, W_DRK], [-8, 1, W_MID], [-7, 1, W_DRK], [-6, 1, W_MID], [-5, 1, W_MID], [-4, 1, W_DRK], [-3, 1, W_MID], [-2, 1, W_MID], [-1, 1, W_DRK], [0, 1, W_MID], [1, 1, W_MID], [2, 1, W_DRK], [3, 1, W_MID], [4, 1, W_MID], [5, 1, W_DRK], [6, 1, W_MID], [7, 1, W_MID], [8, 1, W_DRK], [9, 1, W_DRK], [10, 1, W_DRK], [11, 1, W_DRK], [12, 1, W_OUT],
  // Lower front oak plank & iron corner brackets (gy = 2..3)
  [-11, 2, W_OUT], [-10, 2, IRON], [-9, 2, W_DRK], [-8, 2, W_MID], [-7, 2, W_MID], [-6, 2, W_DRK], [-5, 2, W_MID], [-4, 2, W_MID], [-3, 2, W_DRK], [-2, 2, W_MID], [-1, 2, W_MID], [0, 2, W_DRK], [1, 2, W_MID], [2, 2, W_MID], [3, 2, W_DRK], [4, 2, W_MID], [5, 2, W_MID], [6, 2, W_DRK], [7, 2, W_MID], [8, 2, W_MID], [9, 2, W_DRK], [10, 2, IRON], [11, 2, W_OUT],
  [-11, 3, W_OUT], [-10, 3, W_DRK], [-9, 3, W_OUT], [-8, 3, W_OUT], [-7, 3, W_OUT], [-6, 3, W_OUT], [-5, 3, W_OUT], [-4, 3, W_OUT], [-3, 3, W_OUT], [-2, 3, W_OUT], [-1, 3, W_OUT], [0, 3, W_OUT], [1, 3, W_OUT], [2, 3, W_OUT], [3, 3, W_OUT], [4, 3, W_OUT], [5, 3, W_OUT], [6, 3, W_OUT], [7, 3, W_OUT], [8, 3, W_OUT], [9, 3, W_OUT], [10, 3, W_DRK], [11, 3, W_OUT],
  // Sturdy wooden legs (gy = 4..5)
  [-11, 4, W_OUT], [-10, 4, W_MID], [-9, 4, W_DRK], [-8, 4, W_OUT], [8, 4, W_OUT], [9, 4, W_MID], [10, 4, W_DRK], [11, 4, W_OUT],
  [-11, 5, W_OUT], [-10, 5, W_OUT], [-9, 5, W_OUT], [9, 5, W_OUT], [10, 5, W_OUT], [11, 5, W_OUT],
];

const COW_OUT: [number, number, number] = [28, 22, 18];
const COW_BLK: [number, number, number] = [44, 42, 46];
const COW_BHL: [number, number, number] = [68, 66, 72];
const COW_WHT: [number, number, number] = [250, 248, 242];
const COW_WSH: [number, number, number] = [218, 212, 198];
const COW_WDK: [number, number, number] = [182, 174, 158];
const COW_PNK: [number, number, number] = [242, 174, 162];
const COW_PMD: [number, number, number] = [218, 132, 122];
const COW_NST: [number, number, number] = [132, 54, 52];
const COW_HRN: [number, number, number] = [224, 196, 144];

const COW_TORSO_MARKS: Array<[number, number, [number, number, number]]> = [
  [0, -7, COW_OUT], [1, -7, COW_OUT], [2, -7, COW_OUT], [3, -7, COW_OUT], [4, -7, COW_OUT], [5, -7, COW_OUT], [6, -7, COW_OUT],
  [-4, -6, COW_OUT], [-3, -6, COW_OUT], [-2, -6, COW_OUT], [-1, -6, COW_OUT], [0, -6, COW_BLK], [1, -6, COW_BLK], [2, -6, COW_BHL], [3, -6, COW_BLK], [4, -6, COW_WHT], [5, -6, COW_WHT], [6, -6, COW_WHT], [7, -6, COW_OUT], [8, -6, COW_OUT],
  [-4, -5, COW_BLK], [-3, -5, COW_WHT], [-2, -5, COW_WHT], [-1, -5, COW_WHT], [0, -5, COW_BLK], [1, -5, COW_BHL], [2, -5, COW_BHL], [3, -5, COW_BLK], [4, -5, COW_BLK], [5, -5, COW_WHT], [6, -5, COW_WHT], [7, -5, COW_WHT], [8, -5, COW_WHT], [9, -5, COW_OUT],
  [-4, -4, COW_BLK], [-3, -4, COW_WHT], [-2, -4, COW_WHT], [-1, -4, COW_WHT], [0, -4, COW_BLK], [1, -4, COW_BHL], [2, -4, COW_BHL], [3, -4, COW_BLK], [4, -4, COW_BLK], [5, -4, COW_WHT], [6, -4, COW_WHT], [7, -4, COW_WHT], [8, -4, COW_WHT], [9, -4, COW_WHT], [10, -4, COW_OUT],
  [-4, -3, COW_BLK], [-3, -3, COW_WHT], [-2, -3, COW_WHT], [-1, -3, COW_WHT], [0, -3, COW_WHT], [1, -3, COW_BLK], [2, -3, COW_BHL], [3, -3, COW_BLK], [4, -3, COW_BLK], [5, -3, COW_WHT], [6, -3, COW_WHT], [7, -3, COW_WHT], [8, -3, COW_WSH], [9, -3, COW_WHT], [10, -3, COW_OUT],
  [-4, -2, COW_WHT], [-3, -2, COW_WHT], [-2, -2, COW_WHT], [-1, -2, COW_WHT], [0, -2, COW_BLK], [1, -2, COW_BLK], [2, -2, COW_BLK], [3, -2, COW_BLK], [4, -2, COW_WHT], [5, -2, COW_WHT], [6, -2, COW_WSH], [7, -2, COW_BLK], [8, -2, COW_BLK], [9, -2, COW_WSH], [10, -2, COW_OUT],
  [-4, -1, COW_WSH], [-3, -1, COW_WHT], [-2, -1, COW_WHT], [-1, -1, COW_WHT], [0, -1, COW_BLK], [1, -1, COW_BLK], [2, -1, COW_BLK], [3, -1, COW_WHT], [4, -1, COW_WHT], [5, -1, COW_WSH], [6, -1, COW_BLK], [7, -1, COW_BHL], [8, -1, COW_BLK], [9, -1, COW_WSH], [10, -1, COW_OUT],
  [-4, 0, COW_WSH], [-3, 0, COW_WHT], [-2, 0, COW_WHT], [-1, 0, COW_WHT], [0, 0, COW_WHT], [1, 0, COW_BLK], [2, 0, COW_BLK], [3, 0, COW_WHT], [4, 0, COW_WSH], [5, 0, COW_WSH], [6, 0, COW_BLK], [7, 0, COW_BLK], [8, 0, COW_BLK], [9, 0, COW_WDK], [10, 0, COW_OUT],
  [-6, 1, COW_WDK], [-5, 1, COW_WSH], [-4, 1, COW_WSH], [-3, 1, COW_WHT], [-2, 1, COW_WHT], [-1, 1, COW_WHT], [0, 1, COW_WHT], [1, 1, COW_WHT], [2, 1, COW_WSH], [3, 1, COW_WSH], [4, 1, COW_WSH], [5, 1, COW_WSH], [6, 1, COW_BLK], [7, 1, COW_BLK], [8, 1, COW_WDK], [9, 1, COW_WDK], [10, 1, COW_OUT],
  [-7, 2, COW_OUT], [-6, 2, COW_WDK], [-5, 2, COW_WSH], [-4, 2, COW_WSH], [-3, 2, COW_WHT], [-2, 2, COW_WHT], [-1, 2, COW_WHT], [0, 2, COW_WSH], [1, 2, COW_WSH], [2, 2, COW_WSH], [3, 2, COW_WDK], [4, 2, COW_WDK], [5, 2, COW_WSH], [6, 2, COW_WSH], [7, 2, COW_WSH], [8, 2, COW_WDK], [9, 2, COW_OUT],
  [-6, 3, COW_OUT], [-5, 3, COW_OUT], [-4, 3, COW_OUT], [-3, 3, COW_WSH], [-2, 3, COW_WHT], [-1, 3, COW_WHT], [0, 3, COW_WSH], [1, 3, COW_WDK], [2, 3, COW_WDK], [3, 3, COW_WDK], [4, 3, COW_OUT], [5, 3, COW_OUT], [6, 3, COW_OUT], [7, 3, COW_OUT], [8, 3, COW_OUT],
  [0, 4, COW_OUT], [1, 4, COW_OUT], [2, 4, COW_OUT], [3, 4, COW_PMD], [4, 4, COW_PMD], [5, 4, COW_OUT],
  [3, 5, COW_OUT], [4, 5, COW_PMD], [5, 5, COW_OUT],
];

const COW_HEAD_MARKS: Array<[number, number, [number, number, number]]> = [
  [-12, -9, COW_OUT], [-11, -9, COW_HRN], [-9, -9, COW_OUT], [-8, -9, COW_OUT], [-5, -9, COW_OUT], [-4, -9, COW_HRN],
  [-12, -8, COW_OUT], [-11, -8, COW_BHL], [-10, -8, COW_OUT], [-9, -8, COW_WHT], [-8, -8, COW_WHT], [-7, -8, COW_OUT], [-6, -8, COW_OUT], [-5, -8, COW_BLK], [-4, -8, COW_OUT],
  [-11, -7, COW_OUT], [-10, -7, COW_WHT], [-9, -7, COW_WHT], [-8, -7, COW_WHT], [-7, -7, COW_BLK], [-6, -7, COW_BLK], [-5, -7, COW_BLK], [-4, -7, COW_OUT],
  [-11, -6, COW_OUT], [-10, -6, COW_WHT], [-9, -6, COW_WHT], [-8, -6, COW_WHT], [-7, -6, COW_BHL], [-6, -6, COW_BLK], [-5, -6, COW_BLK], [-4, -6, COW_OUT],
  [-12, -5, COW_OUT], [-11, -5, COW_BLK], [-10, -5, COW_WHT], [-9, -5, COW_WHT], [-8, -5, COW_WHT], [-7, -5, COW_BHL], [-6, -5, COW_BLK], [-5, -5, COW_BLK], [-4, -5, COW_BLK],
  [-12, -4, COW_OUT], [-11, -4, COW_BLK], [-10, -4, COW_WHT], [-9, -4, COW_WHT], [-8, -4, COW_OUT], [-7, -4, COW_OUT], [-6, -4, COW_WSH], [-5, -4, COW_BHL], [-4, -4, COW_BLK],
  [-12, -3, COW_OUT], [-11, -3, COW_WSH], [-10, -3, COW_WHT], [-9, -3, COW_WHT], [-8, -3, COW_OUT], [-7, -3, COW_OUT], [-6, -3, COW_BHL], [-5, -3, COW_BHL], [-4, -3, COW_BLK],
  [-13, -2, COW_OUT], [-12, -2, COW_PNK], [-11, -2, COW_PNK], [-10, -2, COW_PNK], [-9, -2, COW_PNK], [-8, -2, COW_PMD], [-7, -2, COW_BHL], [-6, -2, COW_BHL], [-5, -2, COW_BLK],
  [-13, -1, COW_OUT], [-12, -1, COW_PNK], [-11, -1, COW_NST], [-10, -1, COW_PNK], [-9, -1, COW_NST], [-8, -1, COW_PMD], [-7, -1, COW_BHL], [-6, -1, COW_BHL], [-5, -1, COW_WSH],
  [-13, 0, COW_OUT], [-12, 0, COW_PMD], [-11, 0, COW_PMD], [-10, 0, COW_PMD], [-9, 0, COW_PMD], [-8, 0, COW_PMD], [-7, 0, COW_BHL], [-6, 0, COW_BHL], [-5, 0, COW_WSH],
  [-12, 1, COW_OUT], [-11, 1, COW_OUT], [-10, 1, COW_OUT], [-9, 1, COW_OUT], [-8, 1, COW_OUT], [-7, 1, COW_OUT],
];

const COW_LEG_FF: Array<[number, number, [number, number, number]]> = [
  [-7, 3, COW_OUT], [-6, 3, COW_WSH], [-5, 3, COW_WDK], [-4, 3, COW_OUT],
  [-7, 4, COW_OUT], [-6, 4, COW_WSH], [-5, 4, COW_WDK], [-4, 4, COW_OUT],
  [-7, 5, COW_OUT], [-6, 5, COW_WSH], [-5, 5, COW_WDK], [-4, 5, COW_OUT],
  [-7, 6, COW_OUT], [-6, 6, COW_WSH], [-5, 6, COW_OUT],
  [-7, 7, COW_OUT], [-6, 7, COW_OUT], [-5, 7, COW_OUT],
];

const COW_LEG_FB: Array<[number, number, [number, number, number]]> = [
  [4, 3, COW_OUT], [5, 3, COW_WDK], [6, 3, COW_OUT],
  [4, 4, COW_OUT], [5, 4, COW_WDK], [6, 4, COW_OUT],
  [4, 5, COW_OUT], [5, 5, COW_WDK], [6, 5, COW_OUT],
  [4, 6, COW_OUT], [5, 6, COW_WDK], [6, 6, COW_OUT],
  [4, 7, COW_OUT], [5, 7, COW_OUT], [6, 7, COW_OUT],
];

const COW_LEG_NF: Array<[number, number, [number, number, number]]> = [
  [-3, 3, COW_WSH], [-2, 3, COW_WHT], [-1, 3, COW_WHT], [0, 3, COW_WSH],
  [-3, 4, COW_OUT], [-2, 4, COW_WHT], [-1, 4, COW_WHT], [0, 4, COW_OUT],
  [-3, 5, COW_OUT], [-2, 5, COW_WHT], [-1, 5, COW_WHT], [0, 5, COW_OUT],
  [-3, 6, COW_OUT], [-2, 6, COW_WHT], [-1, 6, COW_WSH], [0, 6, COW_OUT],
  [-3, 7, COW_OUT], [-2, 7, COW_WHT], [-1, 7, COW_WSH], [0, 7, COW_OUT],
  [-3, 8, COW_OUT], [-2, 8, COW_OUT], [-1, 8, COW_OUT], [0, 8, COW_OUT],
];

const COW_LEG_NB: Array<[number, number, [number, number, number]]> = [
  [6, 3, COW_WSH], [7, 3, COW_WSH], [8, 3, COW_WSH], [9, 3, COW_OUT],
  [6, 4, COW_OUT], [7, 4, COW_WSH], [8, 4, COW_WSH], [9, 4, COW_OUT],
  [6, 5, COW_OUT], [7, 5, COW_WSH], [8, 5, COW_WSH], [9, 5, COW_OUT],
  [6, 6, COW_OUT], [7, 6, COW_WSH], [8, 6, COW_WDK], [9, 6, COW_OUT],
  [6, 7, COW_OUT], [7, 7, COW_OUT], [8, 7, COW_OUT], [9, 7, COW_OUT],
];

const COW_DOWN_TORSO: Array<[number, number, [number, number, number]]> = [
  [-3, -9, COW_OUT], [-2, -9, COW_OUT], [-1, -9, COW_OUT], [0, -9, COW_OUT], [1, -9, COW_OUT], [2, -9, COW_OUT], [3, -9, COW_OUT],
  [-5, -8, COW_OUT], [-4, -8, COW_WHT], [-3, -8, COW_WHT], [-2, -8, COW_BLK], [-1, -8, COW_BLK], [0, -8, COW_BLK], [1, -8, COW_WHT], [2, -8, COW_WHT], [3, -8, COW_WHT], [4, -8, COW_OUT],
  [-6, -7, COW_OUT], [-5, -7, COW_WHT], [-4, -7, COW_WHT], [-3, -7, COW_BLK], [-2, -7, COW_BHL], [-1, -7, COW_BLK], [0, -7, COW_WHT], [1, -7, COW_WHT], [2, -7, COW_WHT], [3, -7, COW_BLK], [4, -7, COW_WHT], [5, -7, COW_OUT],
  [-7, -6, COW_OUT], [-6, -6, COW_WHT], [-5, -6, COW_WHT], [-4, -6, COW_WHT], [-3, -6, COW_BLK], [-2, -6, COW_BLK], [-1, -6, COW_WHT], [0, -6, COW_WHT], [1, -6, COW_WHT], [2, -6, COW_BLK], [3, -6, COW_BLK], [4, -6, COW_BLK], [5, -6, COW_WHT], [6, -6, COW_OUT],
  [-7, -5, COW_OUT], [-6, -5, COW_BLK], [-5, -5, COW_BHL], [-4, -5, COW_WHT], [-3, -5, COW_WHT], [-2, -5, COW_WHT], [-1, -5, COW_WHT], [0, -5, COW_WHT], [1, -5, COW_WHT], [2, -5, COW_WHT], [3, -5, COW_BLK], [4, -5, COW_BLK], [5, -5, COW_WSH], [6, -5, COW_OUT],
  [-7, -4, COW_OUT], [-6, -4, COW_BLK], [-5, -4, COW_BLK], [-4, -4, COW_WHT], [-3, -4, COW_WHT], [-2, -4, COW_WHT], [-1, -4, COW_WHT], [0, -4, COW_WHT], [1, -4, COW_WHT], [2, -4, COW_WHT], [3, -4, COW_WHT], [4, -4, COW_WHT], [5, -4, COW_WSH], [6, -4, COW_OUT],
  [-7, -3, COW_OUT], [-6, -3, COW_WHT], [-5, -3, COW_WHT], [-4, -3, COW_WHT], [-3, -3, COW_WHT], [-2, -3, COW_WHT], [-1, -3, COW_WHT], [0, -3, COW_WHT], [1, -3, COW_WHT], [2, -3, COW_WHT], [3, -3, COW_WHT], [4, -3, COW_WHT], [5, -3, COW_WSH], [6, -3, COW_OUT],
  [-7, -2, COW_OUT], [-6, -2, COW_WSH], [-5, -2, COW_WHT], [-4, -2, COW_WHT], [-3, -2, COW_WHT], [-2, -2, COW_WHT], [-1, -2, COW_WHT], [0, -2, COW_WHT], [1, -2, COW_WHT], [2, -2, COW_WHT], [3, -2, COW_WHT], [4, -2, COW_WHT], [5, -2, COW_WSH], [6, -2, COW_OUT],
  [-7, -1, COW_OUT], [-6, -1, COW_WSH], [-5, -1, COW_WHT], [-4, -1, COW_WSH], [-3, -1, COW_WHT], [-2, -1, COW_WHT], [-1, -1, COW_WHT], [0, -1, COW_WHT], [1, -1, COW_WHT], [2, -1, COW_WHT], [3, -1, COW_WSH], [4, -1, COW_WSH], [5, -1, COW_WDK], [6, -1, COW_OUT],
  [-6, 0, COW_OUT], [-5, 0, COW_WSH], [-4, 0, COW_WHT], [-3, 0, COW_WHT], [-2, 0, COW_WHT], [-1, 0, COW_WHT], [0, 0, COW_WHT], [1, 0, COW_WHT], [2, 0, COW_WHT], [3, 0, COW_WHT], [4, 0, COW_WSH], [5, 0, COW_OUT],
  [-6, 1, COW_OUT], [-5, 1, COW_WDK], [-4, 1, COW_WSH], [-3, 1, COW_WHT], [-2, 1, COW_WHT], [-1, 1, COW_WHT], [0, 1, COW_WHT], [1, 1, COW_WHT], [2, 1, COW_WHT], [3, 1, COW_WSH], [4, 1, COW_WDK], [5, 1, COW_OUT],
  [-5, 2, COW_OUT], [-4, 2, COW_WSH], [-3, 2, COW_WHT], [-2, 2, COW_WHT], [-1, 2, COW_WSH], [0, 2, COW_WSH], [1, 2, COW_WHT], [2, 2, COW_WHT], [3, 2, COW_WSH], [4, 2, COW_OUT],
  [-5, 3, COW_OUT], [-4, 3, COW_WSH], [-3, 3, COW_WHT], [-2, 3, COW_OUT], [-1, 3, COW_PMD], [0, 3, COW_PMD], [1, 3, COW_OUT], [2, 3, COW_WHT], [3, 3, COW_WSH], [4, 3, COW_OUT],
  [-1, 4, COW_OUT], [0, 4, COW_OUT],
  [-6, 2, COW_OUT], [-6, 3, COW_OUT], [-5, 4, COW_OUT], [-5, 5, COW_OUT],
  [5, 2, COW_OUT], [5, 3, COW_OUT], [4, 4, COW_OUT], [4, 5, COW_OUT],
];

const COW_DOWN_LEG_L: Array<[number, number, [number, number, number]]> = [
  [-4, 4, COW_OUT], [-3, 4, COW_WHT], [-2, 4, COW_WSH], [-1, 4, COW_OUT],
  [-4, 5, COW_OUT], [-3, 5, COW_WHT], [-2, 5, COW_WSH], [-1, 5, COW_OUT],
  [-4, 6, COW_OUT], [-3, 6, COW_WHT], [-2, 6, COW_WSH], [-1, 6, COW_OUT],
  [-4, 7, COW_OUT], [-3, 7, COW_OUT], [-2, 7, COW_OUT], [-1, 7, COW_OUT],
];

const COW_DOWN_LEG_R: Array<[number, number, [number, number, number]]> = [
  [0, 4, COW_OUT], [1, 4, COW_WHT], [2, 4, COW_WSH], [3, 4, COW_OUT],
  [0, 5, COW_OUT], [1, 5, COW_WHT], [2, 5, COW_WSH], [3, 5, COW_OUT],
  [0, 6, COW_OUT], [1, 6, COW_WHT], [2, 6, COW_WSH], [3, 6, COW_OUT],
  [0, 7, COW_OUT], [1, 7, COW_OUT], [2, 7, COW_OUT], [3, 7, COW_OUT],
];

const COW_DOWN_HEAD: Array<[number, number, [number, number, number]]> = [
  [-5, -7, COW_OUT], [-4, -7, COW_HRN], [-3, -7, COW_OUT], [-2, -7, COW_OUT], [-1, -7, COW_OUT], [0, -7, COW_OUT], [1, -7, COW_OUT], [2, -7, COW_OUT], [3, -7, COW_HRN], [4, -7, COW_OUT],
  [-6, -6, COW_OUT], [-5, -6, COW_BLK], [-4, -6, COW_OUT], [-3, -6, COW_BLK], [-2, -6, COW_WHT], [-1, -6, COW_WHT], [0, -6, COW_WHT], [1, -6, COW_BLK], [2, -6, COW_BLK], [3, -6, COW_OUT], [4, -6, COW_BLK], [5, -6, COW_OUT],
  [-6, -5, COW_OUT], [-5, -5, COW_OUT], [-4, -5, COW_BLK], [-3, -5, COW_BHL], [-2, -5, COW_WHT], [-1, -5, COW_WHT], [0, -5, COW_WHT], [1, -5, COW_BHL], [2, -5, COW_BLK], [3, -5, COW_BLK], [4, -5, COW_OUT], [5, -5, COW_OUT],
  [-5, -4, COW_OUT], [-4, -4, COW_BLK], [-3, -4, COW_OUT], [-2, -4, COW_WHT], [-1, -4, COW_WHT], [0, -4, COW_WHT], [1, -4, COW_WHT], [2, -4, COW_OUT], [3, -4, COW_BLK], [4, -4, COW_OUT],
  [-5, -3, COW_OUT], [-4, -3, COW_BHL], [-3, -3, COW_OUT], [-2, -3, COW_WHT], [-1, -3, COW_WHT], [0, -3, COW_WHT], [1, -3, COW_WHT], [2, -3, COW_OUT], [3, -3, COW_BHL], [4, -3, COW_OUT],
  [-5, -2, COW_OUT], [-4, -2, COW_PNK], [-3, -2, COW_PNK], [-2, -2, COW_PNK], [-1, -2, COW_PNK], [0, -2, COW_PNK], [1, -2, COW_PNK], [2, -2, COW_PNK], [3, -2, COW_PMD], [4, -2, COW_OUT],
  [-5, -1, COW_OUT], [-4, -1, COW_PNK], [-3, -1, COW_NST], [-2, -1, COW_PNK], [-1, -1, COW_PNK], [0, -1, COW_PNK], [1, -1, COW_PNK], [2, -1, COW_NST], [3, -1, COW_PMD], [4, -1, COW_OUT],
  [-4, 0, COW_OUT], [-3, 0, COW_PMD], [-2, 0, COW_PMD], [-1, 0, COW_PMD], [0, 0, COW_PMD], [1, 0, COW_PMD], [2, 0, COW_PMD], [3, 0, COW_OUT],
  [-3, 1, COW_OUT], [-2, 1, COW_OUT], [-1, 1, COW_OUT], [0, 1, COW_OUT], [1, 1, COW_OUT], [2, 1, COW_OUT],
];

const COW_UP_HEAD: Array<[number, number, [number, number, number]]> = [
  [-5, -9, COW_OUT], [-4, -9, COW_HRN], [-3, -9, COW_OUT], [-2, -9, COW_OUT], [-1, -9, COW_OUT], [0, -9, COW_OUT], [1, -9, COW_OUT], [2, -9, COW_OUT], [3, -9, COW_HRN], [4, -9, COW_OUT],
  [-6, -8, COW_OUT], [-5, -8, COW_BLK], [-4, -8, COW_BLK], [-3, -8, COW_BLK], [-2, -8, COW_WHT], [-1, -8, COW_WHT], [0, -8, COW_WHT], [1, -8, COW_BLK], [2, -8, COW_BLK], [3, -8, COW_BLK], [4, -8, COW_BLK], [5, -8, COW_OUT],
  [-6, -7, COW_OUT], [-5, -7, COW_OUT], [-4, -7, COW_BLK], [-3, -7, COW_BHL], [-2, -7, COW_WHT], [-1, -7, COW_WHT], [0, -7, COW_WHT], [1, -7, COW_BHL], [2, -7, COW_BLK], [3, -7, COW_BLK], [4, -7, COW_OUT], [5, -7, COW_OUT],
];

const COW_UP_TORSO: Array<[number, number, [number, number, number]]> = [
  [-5, -6, COW_OUT], [-4, -6, COW_WHT], [-3, -6, COW_WHT], [-2, -6, COW_WHT], [-1, -6, COW_WHT], [0, -6, COW_BLK], [1, -6, COW_BLK], [2, -6, COW_WHT], [3, -6, COW_WHT], [4, -6, COW_OUT],
  [-6, -5, COW_OUT], [-5, -5, COW_WHT], [-4, -5, COW_WHT], [-3, -5, COW_BLK], [-2, -5, COW_BLK], [-1, -5, COW_BLK], [0, -5, COW_BHL], [1, -5, COW_BLK], [2, -5, COW_WHT], [3, -5, COW_WHT], [4, -5, COW_WHT], [5, -5, COW_OUT],
  [-7, -4, COW_OUT], [-6, -4, COW_WHT], [-5, -4, COW_BLK], [-4, -4, COW_BHL], [-3, -4, COW_BHL], [-2, -4, COW_BLK], [-1, -4, COW_BLK], [0, -4, COW_BLK], [1, -4, COW_WHT], [2, -4, COW_WHT], [3, -4, COW_WHT], [4, -4, COW_WSH], [5, -4, COW_OUT],
  [-7, -3, COW_OUT], [-6, -3, COW_WHT], [-5, -3, COW_BLK], [-4, -3, COW_BHL], [-3, -3, COW_BLK], [-2, -3, COW_BLK], [-1, -3, COW_WHT], [0, -3, COW_WHT], [1, -3, COW_WHT], [2, -3, COW_BLK], [3, -3, COW_BLK], [4, -3, COW_WSH], [5, -3, COW_OUT],
  [-7, -2, COW_OUT], [-6, -2, COW_WSH], [-5, -2, COW_BLK], [-4, -2, COW_BLK], [-3, -2, COW_WHT], [-2, -2, COW_WHT], [-1, -2, COW_OUT], [0, -2, COW_OUT], [1, -2, COW_WHT], [2, -2, COW_BLK], [3, -2, COW_BHL], [4, -2, COW_BLK], [5, -2, COW_OUT],
  [-7, -1, COW_OUT], [-6, -1, COW_WSH], [-5, -1, COW_WHT], [-4, -1, COW_WHT], [-3, -1, COW_WHT], [-2, -1, COW_WHT], [-1, -1, COW_OUT], [0, -1, COW_WSH], [1, -1, COW_WHT], [2, -1, COW_BLK], [3, -1, COW_BLK], [4, -1, COW_WSH], [5, -1, COW_OUT],
  [-6, 0, COW_OUT], [-5, 0, COW_WSH], [-4, 0, COW_WHT], [-3, 0, COW_WHT], [-2, 0, COW_WSH], [-1, 0, COW_OUT], [0, 0, COW_WSH], [1, 0, COW_WSH], [2, 0, COW_WSH], [3, 0, COW_WDK], [4, 0, COW_WDK], [5, 0, COW_OUT],
  [-6, 1, COW_OUT], [-5, 1, COW_WDK], [-4, 1, COW_WSH], [-3, 1, COW_WSH], [-2, 1, COW_WSH], [-1, 1, COW_BLK], [0, 1, COW_OUT], [1, 1, COW_WSH], [2, 1, COW_WSH], [3, 1, COW_WDK], [4, 1, COW_WDK], [5, 1, COW_OUT],
  [-5, 2, COW_OUT], [-4, 2, COW_WDK], [-3, 2, COW_WSH], [-2, 2, COW_WDK], [-1, 2, COW_BLK], [0, 2, COW_BLK], [1, 2, COW_WDK], [2, 2, COW_WSH], [3, 2, COW_WDK], [4, 2, COW_OUT],
  [-5, 3, COW_OUT], [-4, 3, COW_WDK], [-3, 3, COW_WSH], [-2, 3, COW_OUT], [-1, 3, COW_OUT], [0, 3, COW_OUT], [1, 3, COW_OUT], [2, 3, COW_WSH], [3, 3, COW_WDK], [4, 3, COW_OUT],
  [-1, 4, COW_PMD], [0, 4, COW_PMD], [-1, 5, COW_OUT], [0, 5, COW_OUT],
];

const COW_UP_LEG_L: Array<[number, number, [number, number, number]]> = [
  [-4, 4, COW_OUT], [-3, 4, COW_WSH], [-2, 4, COW_WDK], [-1, 4, COW_OUT],
  [-4, 5, COW_OUT], [-3, 5, COW_WSH], [-2, 5, COW_WDK], [-1, 5, COW_OUT],
  [-4, 6, COW_OUT], [-3, 6, COW_WSH], [-2, 6, COW_WDK], [-1, 6, COW_OUT],
  [-4, 7, COW_OUT], [-3, 7, COW_OUT], [-2, 7, COW_OUT], [-1, 7, COW_OUT],
];

const COW_UP_LEG_R: Array<[number, number, [number, number, number]]> = [
  [0, 4, COW_OUT], [1, 4, COW_WDK], [2, 4, COW_WSH], [3, 4, COW_OUT],
  [0, 5, COW_OUT], [1, 5, COW_WDK], [2, 5, COW_WSH], [3, 5, COW_OUT],
  [0, 6, COW_OUT], [1, 6, COW_WDK], [2, 6, COW_WSH], [3, 6, COW_OUT],
  [0, 7, COW_OUT], [1, 7, COW_OUT], [2, 7, COW_OUT], [3, 7, COW_OUT],
];

// 4-phase diagonal quadruped walk gait: [dxFF, dyFF, dxNF, dyNF, dxFB, dyFB, dxNB, dyNB, headBobPx, tailSwish]
const COW_GAIT: Array<[number, number, number, number, number, number, number, number, number, number]> = [
  [1, 0, -1, 0, -1, 0, 1, 0, 0, 0],
  [0, -1, 0, 0, 0, 0, 0, -1, 1, 1],
  [-1, 0, 1, 0, 1, 0, -1, 0, 0, 0],
  [0, 0, 0, -1, 0, -1, 0, 0, 1, -1],
];

const BRN_BLK: [number, number, number] = [122, 58, 24];
const BRN_BHL: [number, number, number] = [158, 84, 38];

const P_LGT: [number, number, number] = [252, 198, 196];
const P_MID: [number, number, number] = [242, 162, 160];
const P_SHD: [number, number, number] = [214, 126, 126];
const P_SNT: [number, number, number] = [228, 118, 122];
const P_NST: [number, number, number] = [138, 48, 52];

const S_WHT: [number, number, number] = [252, 250, 242];
const S_CRM: [number, number, number] = [234, 228, 212];
const S_SHD: [number, number, number] = [202, 194, 176];
const S_FCE: [number, number, number] = [58, 52, 48];

const GT_TAN: [number, number, number] = [218, 188, 142];
const GT_SHD: [number, number, number] = [182, 148, 102];
const GT_DRK: [number, number, number] = [118, 86, 52];
const GT_HRN: [number, number, number] = [196, 174, 128];

const C_RED: [number, number, number] = [216, 42, 38];
const C_YLW: [number, number, number] = [246, 192, 42];
const C_ORG: [number, number, number] = [242, 132, 34];
const C_WHT: [number, number, number] = [252, 250, 244];
const C_WSH: [number, number, number] = [224, 218, 202];
const C_BRN: [number, number, number] = [178, 98, 44];

interface NestState {
  id: number;
  x: number;
  y: number;
  kind: "chicken" | "duck";
  eggs: number;
  sparkleTimer: number;
}

interface AnimalState {
  id: string;
  kind:
    | "cow_holstein"
    | "cow_brown"
    | "calf_holstein"
    | "calf_brown"
    | "pig"
    | "sheep"
    | "goat"
    | "hen"
    | "rooster"
    | "duck"
    | "chick"
    | "duckling";
  x: number;
  y: number;
  dir: CowDir;
  mode: "walk" | "eat" | "turn" | "lay";
  phase: number;
  stepAccum: number;
  biteAccum: number;
  timerUntil: number;
  wpIdx: number;
  speed: number;
  troughId?: 1 | 2;
  nestId?: number;
  parentId?: string;
  trailLag?: number;
  trail?: Array<{ x: number; y: number; dir: CowDir }>;
  waypoints: Array<{
    x: number;
    y: number;
    eatAfter?: boolean;
    layEggAfter?: boolean;
    eatDir?: CowDir;
    refillFodder?: boolean;
  }>;
}

function drawLivestockScene(
  data: Uint8ClampedArray,
  animals: AnimalState[],
  nests: NestState[],
  fodder1: number,
  fodder2: number,
) {
  const putPx = (x: number, y: number, r: number, g: number, b: number) => {
    if (x < 0 || x >= WIDTH || y < 0 || y >= HEIGHT) return;
    const i = (y * WIDTH + x) * 4;
    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
    data[i + 3] = 255;
  };

  const paintAt = (
    ox: number,
    oy: number,
    gx: number,
    gy: number,
    col: [number, number, number],
    extraPy = 0,
  ) => {
    for (let sy = 0; sy < 2; sy += 1) {
      for (let sx = 0; sx < 2; sx += 1) {
        putPx(ox + gx * 2 + sx, oy + gy * 2 + sy + extraPy, col[0], col[1], col[2]);
      }
    }
  };

  const paintShadow = (cx: number, cy: number, rx: number, ry: number, gyOff: number) => {
    for (let gy = gyOff - 2; gy <= gyOff + 2; gy += 1) {
      for (let gx = -12; gx <= 12; gx += 1) {
        if ((gx / rx) ** 2 + ((gy - gyOff) / ry) ** 2 <= 1) {
          for (let sy = 0; sy < 2; sy += 1) {
            for (let sx = 0; sx < 2; sx += 1) {
              const px = cx + gx * 2 + sx;
              const py = cy + gy * 2 + sy;
              if (cellVal(px >> 2, py >> 2) === 1) {
                const idx = (py * WIDTH + px) * 4;
                data[idx] = Math.round(data[idx] * 0.68);
                data[idx + 1] = Math.round(data[idx + 1] * 0.74);
                data[idx + 2] = Math.round(data[idx + 2] * 0.62);
              }
            }
          }
        }
      }
    }
  };

  const drawTroughBack = (tx: number, ty: number, fodder: number) => {
    paintShadow(tx, ty, 12.2, 2.2, 4.5);
    for (const [gx, gy, col] of TROUGH_EMPTY_BACK) paintAt(tx, ty, gx, gy, col);
    if (fodder >= 1) for (const [gx, gy, col] of FODDER_LVL_1) paintAt(tx, ty, gx, gy, col);
    if (fodder >= 2) for (const [gx, gy, col] of FODDER_LVL_2) paintAt(tx, ty, gx, gy, col);
    if (fodder >= 3) for (const [gx, gy, col] of FODDER_LVL_3) paintAt(tx, ty, gx, gy, col);
    if (fodder >= 4) for (const [gx, gy, col] of FODDER_LVL_4) paintAt(tx, ty, gx, gy, col);
  };

  const drawTroughFront = (tx: number, ty: number, fodder: number, isEatingHere: boolean, phase: number) => {
    if (isEatingHere && fodder >= 1) {
      const munchGrass: Array<[number, number, [number, number, number]]> =
        phase % 2 === 0
          ? [[-3, -2, G_BRT], [-2, -2, H_BRT], [0, -2, G_MID], [1, -2, G_BRT], [2, -2, H_GLD]]
          : [[-3, -2, H_BRT], [-1, -2, G_HLT], [0, -2, G_BRT], [2, -2, G_MID], [3, -2, H_BRT]];
      for (const [gx, gy, col] of munchGrass) paintAt(tx, ty, gx, gy, col);
    }
    for (const [gx, gy, col] of TROUGH_FRONT_BASE) paintAt(tx, ty, gx, gy, col);
    if (fodder >= 3) {
      const wisps: Array<[number, number, [number, number, number]]> = [
        [-8, -1, G_BRT], [-5, -1, H_BRT], [-1, -1, G_BRT], [0, -1, H_GLD], [3, -1, G_BRT], [6, -1, H_BRT],
      ];
      if (fodder >= 4) wisps.push([-4, -1, G_MID], [7, -1, G_MID], [-1, 0, G_MID]);
      for (const [gx, gy, col] of wisps) paintAt(tx, ty, gx, gy, col);
    }
  };

  // Draw small pig feed trough & chicken grain feeder dish
  const drawSmallFeeders = () => {
    // Pig wooden feed bowl at (PIG_BOWL_X, PIG_BOWL_Y)
    paintShadow(PIG_BOWL_X, PIG_BOWL_Y, 5.5, 1.8, 2);
    const pigBowl: Array<[number, number, [number, number, number]]> = [
      [-4, -2, W_OUT], [-3, -2, W_OUT], [-2, -2, W_OUT], [-1, -2, W_OUT], [0, -2, W_OUT], [1, -2, W_OUT], [2, -2, W_OUT], [3, -2, W_OUT], [4, -2, W_OUT],
      [-5, -1, W_OUT], [-4, -1, W_BRT], [-3, -1, H_GLD], [-2, -1, H_BRT], [-1, -1, G_BRT], [0, -1, H_GLD], [1, -1, H_BRT], [2, -1, G_MID], [3, -1, W_BRT], [4, -1, W_OUT],
      [-5, 0, W_OUT], [-4, 0, W_HLT], [-3, 0, W_HLT], [-2, 0, W_HLT], [-1, 0, W_HLT], [0, 0, W_HLT], [1, 0, W_HLT], [2, 0, W_HLT], [3, 0, W_HLT], [4, 0, W_OUT],
      [-5, 1, W_OUT], [-4, 1, W_MID], [-3, 1, W_BRT], [-2, 1, W_MID], [-1, 1, W_BRT], [0, 1, W_MID], [1, 1, W_BRT], [2, 1, W_MID], [3, 1, W_DRK], [4, 1, W_OUT],
      [-4, 2, W_OUT], [-3, 2, W_OUT], [-2, 2, W_OUT], [-1, 2, W_OUT], [0, 2, W_OUT], [1, 2, W_OUT], [2, 2, W_OUT], [3, 2, W_OUT],
    ];
    for (const [gx, gy, col] of pigBowl) paintAt(PIG_BOWL_X, PIG_BOWL_Y, gx, gy, col);

    // Chicken grain dish & scattered golden corn kernels at (CHICK_DISH_X, CHICK_DISH_Y)
    paintShadow(CHICK_DISH_X, CHICK_DISH_Y, 4.5, 1.5, 1);
    const chickDish: Array<[number, number, [number, number, number]]> = [
      [-3, -1, W_OUT], [-2, -1, H_BRT], [-1, -1, H_GLD], [0, -1, H_BRT], [1, -1, H_GLD], [2, -1, W_OUT],
      [-4, 0, W_OUT], [-3, 0, W_BRT], [-2, 0, H_GLD], [-1, 0, H_BRT], [0, 0, H_GLD], [1, 0, H_BRT], [2, 0, W_BRT], [3, 0, W_OUT],
      [-3, 1, W_OUT], [-2, 1, W_MID], [-1, 1, W_MID], [0, 1, W_MID], [1, 1, W_MID], [2, 1, W_OUT],
      // Scattered grain specs around dish
      [-6, 1, H_BRT], [-5, 2, H_GLD], [5, 1, H_BRT], [6, 2, H_GLD], [0, 3, H_BRT],
    ];
    for (const [gx, gy, col] of chickDish) paintAt(CHICK_DISH_X, CHICK_DISH_Y, gx, gy, col);
  };

  const mapCowCol = (col: [number, number, number], isBrown: boolean): [number, number, number] => {
    if (!isBrown) return col;
    if (col === COW_BLK) return BRN_BLK;
    if (col === COW_BHL) return BRN_BHL;
    return col;
  };

  const drawCow = (a: AnimalState, bodyOnly = false, headOnly = false) => {
    const cx = Math.round(a.x);
    const cy = Math.round(a.y);
    const isBrown = a.kind === "cow_brown";
    const { dir, phase, mode } = a;

    if (!headOnly) {
      paintShadow(cx, cy, dir === "left" || dir === "right" ? 9.2 : 6.2, 2.2, 7.2);
    }

    if (dir === "left" || dir === "right") {
      if (headOnly) return;
      const sign = dir === "left" ? 1 : -1;
      const [dxFF, dyFF, dxNF, dyNF, dxFB, dyFB, dxNB, dyNB, headBobPx, tailSwish] =
        mode === "turn"
          ? [0, 0, 0, 0, 0, 0, 0, 0, 1, phase % 2 === 0 ? 0 : 1]
          : COW_GAIT[phase % 4];

      for (const [gx, gy, col] of COW_LEG_FF) paintAt(cx, cy, (gx + dxFF) * sign, gy + (gy >= 4 ? dyFF : 0), mapCowCol(col, isBrown));
      for (const [gx, gy, col] of COW_LEG_FB) paintAt(cx, cy, (gx + dxFB) * sign, gy + (gy >= 4 ? dyFB : 0), mapCowCol(col, isBrown));
      for (const [gx, gy, col] of COW_TORSO_MARKS) paintAt(cx, cy, gx * sign, gy, mapCowCol(col, isBrown));
      const tailMarks: Array<[number, number, [number, number, number]]> =
        tailSwish > 0
          ? [[11, -3, COW_OUT], [11, -2, COW_BLK], [12, -1, COW_BLK], [12, 0, COW_OUT]]
          : [[11, -3, COW_OUT], [11, -2, COW_BLK], [11, -1, COW_BLK], [11, 0, COW_OUT]];
      for (const [gx, gy, col] of tailMarks) paintAt(cx, cy, gx * sign, gy, mapCowCol(col, isBrown));
      for (const [gx, gy, col] of COW_LEG_NB) paintAt(cx, cy, (gx + dxNB) * sign, gy + (gy >= 4 ? dyNB : 0), mapCowCol(col, isBrown));
      for (const [gx, gy, col] of COW_LEG_NF) paintAt(cx, cy, (gx + dxNF) * sign, gy + (gy >= 4 ? dyNF : 0), mapCowCol(col, isBrown));
      for (const [gx, gy, col] of COW_HEAD_MARKS) paintAt(cx, cy, gx * sign, gy, mapCowCol(col, isBrown), headBobPx);
      return;
    }

    if (dir === "up") {
      if (headOnly) return;
      const dyL = mode === "walk" ? (phase % 4 === 0 ? -1 : phase % 4 === 2 ? 1 : 0) : 0;
      const dyR = mode === "walk" ? (phase % 4 === 2 ? -1 : phase % 4 === 0 ? 1 : 0) : 0;
      const headBob = mode === "walk" && phase % 2 === 1 ? 1 : 0;
      for (const [gx, gy, col] of COW_UP_HEAD) paintAt(cx, cy, gx, gy, mapCowCol(col, isBrown), headBob);
      for (const [gx, gy, col] of COW_UP_TORSO) paintAt(cx, cy, gx, gy, mapCowCol(col, isBrown));
      for (const [gx, gy, col] of COW_UP_LEG_L) paintAt(cx, cy, gx, gy + (gy >= 5 ? dyL : 0), mapCowCol(col, isBrown));
      for (const [gx, gy, col] of COW_UP_LEG_R) paintAt(cx, cy, gx, gy + (gy >= 5 ? dyR : 0), mapCowCol(col, isBrown));
      return;
    }

    // dir === "down"
    if (headOnly) {
      const f = a.troughId === 2 ? fodder2 : fodder1;
      const eatHeadBob = f === 0 ? 2 : phase % 2 === 0 ? 6 : 4;
      for (const [gx, gy, col] of COW_DOWN_HEAD) paintAt(cx, cy, gx, gy, mapCowCol(col, isBrown), eatHeadBob);
      return;
    }
    const dyL = mode === "walk" ? (phase % 4 === 0 ? 1 : phase % 4 === 2 ? -1 : 0) : 0;
    const dyR = mode === "walk" ? (phase % 4 === 2 ? 1 : phase % 4 === 0 ? -1 : 0) : 0;
    for (const [gx, gy, col] of COW_DOWN_TORSO) paintAt(cx, cy, gx, gy, mapCowCol(col, isBrown));
    for (const [gx, gy, col] of COW_DOWN_LEG_L) paintAt(cx, cy, gx, gy + (gy >= 5 ? dyL : 0), mapCowCol(col, isBrown));
    for (const [gx, gy, col] of COW_DOWN_LEG_R) paintAt(cx, cy, gx, gy + (gy >= 5 ? dyR : 0), mapCowCol(col, isBrown));
    if (!bodyOnly || mode !== "eat") {
      const headBob = mode === "eat" ? (phase % 2 === 0 ? 5 : 3) : mode === "walk" && phase % 2 === 1 ? 1 : 0;
      for (const [gx, gy, col] of COW_DOWN_HEAD) paintAt(cx, cy, gx, gy, mapCowCol(col, isBrown), headBob);
    }
  };

  const drawCalf = (a: AnimalState) => {
    const cx = Math.round(a.x);
    const cy = Math.round(a.y);
    const isBrown = a.kind === "calf_brown";
    const { dir, phase, mode } = a;
    const headBob = mode === "eat" ? (phase % 2 === 0 ? 2 : 1) : mode === "walk" && phase % 2 === 1 ? 1 : 0;

    if (dir === "left" || dir === "right") {
      paintShadow(cx, cy, 7.6, 2.3, 4.8);
      const sign = dir === "left" ? 1 : -1;
      const liftA = mode === "walk" && phase % 4 === 0 ? -1 : 0;
      const liftB = mode === "walk" && phase % 4 === 2 ? -1 : 0;

      // Proportional calf legs (gy = 2..5) anchored under a fuller chest & rump
      const legFF: Array<[number, number, [number, number, number]]> = [
        [-5, 2, COW_OUT], [-4, 2, COW_WSH], [-3, 2, COW_OUT],
        [-5, 3, COW_OUT], [-4, 3, COW_WSH], [-3, 3, COW_OUT],
        [-5, 4, COW_OUT], [-4, 4, COW_OUT],
      ];
      const legFB: Array<[number, number, [number, number, number]]> = [
        [3, 2, COW_OUT], [4, 2, COW_WSH], [5, 2, COW_OUT],
        [3, 3, COW_OUT], [4, 3, COW_WSH], [5, 3, COW_OUT],
        [3, 4, COW_OUT], [4, 4, COW_OUT],
      ];
      const legNF: Array<[number, number, [number, number, number]]> = [
        [-2, 2, COW_WSH], [-1, 2, COW_WHT], [0, 2, COW_WSH],
        [-2, 3, COW_OUT], [-1, 3, COW_WHT], [0, 3, COW_OUT],
        [-2, 4, COW_OUT], [-1, 4, COW_WSH], [0, 4, COW_OUT],
        [-2, 5, COW_OUT], [-1, 5, COW_OUT], [0, 5, COW_OUT],
      ];
      const legNB: Array<[number, number, [number, number, number]]> = [
        [5, 2, COW_WSH], [6, 2, COW_WHT], [7, 2, COW_OUT],
        [5, 3, COW_OUT], [6, 3, COW_WHT], [7, 3, COW_OUT],
        [5, 4, COW_OUT], [6, 4, COW_WSH], [7, 4, COW_OUT],
        [5, 5, COW_OUT], [6, 5, COW_OUT], [7, 5, COW_OUT],
      ];

      // Plump, fuller calf torso (gx = -5..7, gy = -5..2) with chest extending under neck & tail at gx = 8
      const torso: Array<[number, number, [number, number, number]]> = [
        [-3, -5, COW_OUT], [-2, -5, COW_OUT], [-1, -5, COW_OUT], [0, -5, COW_OUT], [1, -5, COW_OUT], [2, -5, COW_OUT], [3, -5, COW_OUT], [4, -5, COW_OUT], [5, -5, COW_OUT], [6, -5, COW_OUT],
        [-4, -4, COW_BLK], [-3, -4, COW_WHT], [-2, -4, COW_WHT], [-1, -4, COW_BLK], [0, -4, COW_BHL], [1, -4, COW_BLK], [2, -4, COW_WHT], [3, -4, COW_WHT], [4, -4, COW_BLK], [5, -4, COW_BHL], [6, -4, COW_WHT], [7, -4, COW_OUT],
        [-4, -3, COW_BLK], [-3, -3, COW_WHT], [-2, -3, COW_WHT], [-1, -3, COW_BLK], [0, -3, COW_BHL], [1, -3, COW_BLK], [2, -3, COW_WHT], [3, -3, COW_WHT], [4, -3, COW_BLK], [5, -3, COW_BLK], [6, -3, COW_WHT], [7, -3, COW_OUT], [8, -3, COW_OUT],
        [-4, -2, COW_WHT], [-3, -2, COW_WHT], [-2, -2, COW_WHT], [-1, -2, COW_WHT], [0, -2, COW_BLK], [1, -2, COW_BLK], [2, -2, COW_WHT], [3, -2, COW_WHT], [4, -2, COW_WHT], [5, -2, COW_BLK], [6, -2, COW_WHT], [7, -2, COW_OUT], [8, -2, COW_WHT],
        [-5, -1, COW_WSH], [-4, -1, COW_WHT], [-3, -1, COW_WHT], [-2, -1, COW_WHT], [-1, -1, COW_WHT], [0, -1, COW_BLK], [1, -1, COW_WHT], [2, -1, COW_WHT], [3, -1, COW_WHT], [4, -1, COW_WSH], [5, -1, COW_BLK], [6, -1, COW_WSH], [7, -1, COW_OUT], [8, -1, COW_BLK],
        [-5, 0, COW_OUT], [-4, 0, COW_WSH], [-3, 0, COW_WHT], [-2, 0, COW_WHT], [-1, 0, COW_WHT], [0, 0, COW_WHT], [1, 0, COW_WHT], [2, 0, COW_WSH], [3, 0, COW_WSH], [4, 0, COW_WSH], [5, 0, COW_WSH], [6, 0, COW_WDK], [7, 0, COW_OUT], [8, 0, COW_OUT],
        [-5, 1, COW_OUT], [-4, 1, COW_WDK], [-3, 1, COW_WSH], [-2, 1, COW_WHT], [-1, 1, COW_WHT], [0, 1, COW_WSH], [1, 1, COW_WSH], [2, 1, COW_WDK], [3, 1, COW_WDK], [4, 1, COW_WSH], [5, 1, COW_WSH], [6, 1, COW_WDK], [7, 1, COW_OUT],
        [-4, 2, COW_OUT], [-3, 2, COW_OUT], [-2, 2, COW_WSH], [-1, 2, COW_WHT], [0, 2, COW_WSH], [1, 2, COW_OUT], [2, 2, COW_OUT], [3, 2, COW_OUT], [4, 2, COW_OUT], [5, 2, COW_WSH], [6, 2, COW_OUT],
      ];

      // Compact, proportional calf head (gy = -6..0) seamlessly joined to the neck (no black vertical seam at gx = -4)
      const head: Array<[number, number, [number, number, number]]> = [
        [-7, -6, COW_HRN], [-6, -6, COW_OUT], [-5, -6, COW_OUT], [-4, -6, COW_HRN],
        [-8, -5, COW_OUT], [-7, -5, COW_BLK], [-6, -5, COW_WHT], [-5, -5, COW_BLK], [-4, -5, COW_BLK], [-3, -5, COW_OUT],
        [-8, -4, COW_OUT], [-7, -4, COW_WHT], [-6, -4, COW_WHT], [-5, -4, COW_BHL], [-4, -4, COW_BLK],
        [-8, -3, COW_OUT], [-7, -3, COW_WHT], [-6, -3, COW_OUT], [-5, -3, COW_WSH], [-4, -3, COW_BHL],
        // Neat, compact 2-row bottom cow muzzle (gy = -2..-1) above the chest level
        [-9, -2, COW_OUT], [-8, -2, COW_PNK], [-7, -2, COW_PNK], [-6, -2, COW_PNK], [-5, -2, COW_BHL], [-4, -2, COW_WHT],
        [-9, -1, COW_OUT], [-8, -1, COW_NST], [-7, -1, COW_PMD], [-6, -1, COW_NST], [-5, -1, COW_WSH],
        [-8, 0, COW_OUT], [-7, 0, COW_OUT], [-6, 0, COW_OUT],
      ];

      for (const [gx, gy, col] of legFF) paintAt(cx, cy, gx * sign, gy + liftA, mapCowCol(col, isBrown));
      for (const [gx, gy, col] of legFB) paintAt(cx, cy, gx * sign, gy + liftB, mapCowCol(col, isBrown));
      for (const [gx, gy, col] of torso) paintAt(cx, cy, gx * sign, gy, mapCowCol(col, isBrown));
      for (const [gx, gy, col] of legNF) paintAt(cx, cy, gx * sign, gy + liftB, mapCowCol(col, isBrown));
      for (const [gx, gy, col] of legNB) paintAt(cx, cy, gx * sign, gy + liftA, mapCowCol(col, isBrown));
      for (const [gx, gy, col] of head) paintAt(cx, cy, gx * sign, gy, mapCowCol(col, isBrown), headBob);
      return;
    }

    paintShadow(cx, cy, 5.2, 2.3, 4.8);
    const dyL = mode === "walk" && phase % 4 === 0 ? -1 : 0;
    const dyR = mode === "walk" && phase % 4 === 2 ? -1 : 0;
    if (dir === "down") {
      const downTorsoAndLegs: Array<[number, number, [number, number, number], number]> = [
        [-4, -4, COW_OUT, 0], [-3, -4, COW_WHT, 0], [-2, -4, COW_BLK, 0], [-1, -4, COW_WHT, 0], [0, -4, COW_WHT, 0], [1, -4, COW_BLK, 0], [2, -4, COW_WHT, 0], [3, -4, COW_OUT, 0],
        [-5, -3, COW_OUT, 0], [-4, -3, COW_WHT, 0], [-3, -3, COW_WHT, 0], [-2, -3, COW_BLK, 0], [-1, -3, COW_WHT, 0], [0, -3, COW_WHT, 0], [1, -3, COW_BLK, 0], [2, -3, COW_WHT, 0], [3, -3, COW_WHT, 0], [4, -3, COW_OUT, 0],
        [-5, -2, COW_OUT, 0], [-4, -2, COW_WHT, 0], [-3, -2, COW_WHT, 0], [-2, -2, COW_WHT, 0], [-1, -2, COW_WHT, 0], [0, -2, COW_WHT, 0], [1, -2, COW_WHT, 0], [2, -2, COW_WHT, 0], [3, -2, COW_WHT, 0], [4, -2, COW_OUT, 0],
        [-5, -1, COW_OUT, 0], [-4, -1, COW_WSH, 0], [-3, -1, COW_WHT, 0], [-2, -1, COW_WHT, 0], [-1, -1, COW_WHT, 0], [0, -1, COW_WHT, 0], [1, -1, COW_WHT, 0], [2, -1, COW_WHT, 0], [3, -1, COW_WSH, 0], [4, -1, COW_OUT, 0],
        [-4, 0, COW_OUT, 0], [-3, 0, COW_WSH, 0], [-2, 0, COW_WSH, 0], [-1, 0, COW_WHT, 0], [0, 0, COW_WHT, 0], [1, 0, COW_WSH, 0], [2, 0, COW_WSH, 0], [3, 0, COW_OUT, 0],
        [-4, 1, COW_OUT, 0], [-3, 1, COW_OUT, 0], [-2, 1, COW_WSH, 0], [-1, 1, COW_WSH, 0], [0, 1, COW_WSH, 0], [1, 1, COW_WSH, 0], [2, 1, COW_OUT, 0], [3, 1, COW_OUT, 0],
        [-3, 2, COW_OUT, dyL], [-2, 2, COW_WHT, dyL], [-1, 2, COW_OUT, dyL], [0, 2, COW_OUT, dyR], [1, 2, COW_WHT, dyR], [2, 2, COW_OUT, dyR],
        [-3, 3, COW_OUT, dyL], [-2, 3, COW_WHT, dyL], [-1, 3, COW_OUT, dyL], [0, 3, COW_OUT, dyR], [1, 3, COW_WHT, dyR], [2, 3, COW_OUT, dyR],
        [-3, 4, COW_OUT, dyL], [-2, 4, COW_WSH, dyL], [-1, 4, COW_OUT, dyL], [0, 4, COW_OUT, dyR], [1, 4, COW_WSH, dyR], [2, 4, COW_OUT, dyR],
        [-3, 5, COW_OUT, dyL], [-2, 5, COW_OUT, dyL], [1, 5, COW_OUT, dyR], [2, 5, COW_OUT, dyR],
      ];
      const downHead: Array<[number, number, [number, number, number]]> = [
        [-2, -6, COW_HRN], [-1, -6, COW_OUT], [0, -6, COW_OUT], [1, -6, COW_HRN],
        [-3, -5, COW_OUT], [-2, -5, COW_BLK], [-1, -5, COW_WHT], [0, -5, COW_WHT], [1, -5, COW_BLK], [2, -5, COW_OUT],
        [-3, -4, COW_OUT], [-2, -4, COW_OUT], [-1, -4, COW_WHT], [0, -4, COW_WHT], [1, -4, COW_OUT], [2, -4, COW_OUT],
        [-3, -3, COW_OUT], [-2, -3, COW_PNK], [-1, -3, COW_PNK], [0, -3, COW_PNK], [1, -3, COW_PNK], [2, -3, COW_OUT],
        [-3, -2, COW_OUT], [-2, -2, COW_NST], [-1, -2, COW_PMD], [0, -2, COW_PMD], [1, -2, COW_NST], [2, -2, COW_OUT],
        [-2, -1, COW_OUT], [-1, -1, COW_OUT], [0, -1, COW_OUT], [1, -1, COW_OUT],
      ];
      for (const [gx, gy, col, dy] of downTorsoAndLegs) paintAt(cx, cy, gx, gy + dy, mapCowCol(col, isBrown));
      for (const [gx, gy, col] of downHead) paintAt(cx, cy, gx, gy, mapCowCol(col, isBrown), headBob);
      return;
    }

    const upMarks: Array<[number, number, [number, number, number], number]> = [
      [-2, -6, COW_HRN, 0], [-1, -6, COW_OUT, 0], [0, -6, COW_OUT, 0], [1, -6, COW_HRN, 0],
      [-3, -5, COW_OUT, 0], [-2, -5, COW_BLK, 0], [-1, -5, COW_WHT, 0], [0, -5, COW_WHT, 0], [1, -5, COW_BLK, 0], [2, -5, COW_OUT, 0],
      [-4, -4, COW_OUT, 0], [-3, -4, COW_WHT, 0], [-2, -4, COW_BLK, 0], [-1, -4, COW_BLK, 0], [0, -4, COW_WHT, 0], [1, -4, COW_BLK, 0], [2, -4, COW_WHT, 0], [3, -4, COW_OUT, 0],
      [-5, -3, COW_OUT, 0], [-4, -3, COW_WHT, 0], [-3, -3, COW_WHT, 0], [-2, -3, COW_BLK, 0], [-1, -3, COW_WHT, 0], [0, -3, COW_WHT, 0], [1, -3, COW_BLK, 0], [2, -3, COW_WHT, 0], [3, -3, COW_WHT, 0], [4, -3, COW_OUT, 0],
      [-5, -2, COW_OUT, 0], [-4, -2, COW_WHT, 0], [-3, -2, COW_WHT, 0], [-2, -2, COW_WHT, 0], [-1, -2, COW_OUT, 0], [0, -2, COW_BLK, 0], [1, -2, COW_WHT, 0], [2, -2, COW_WHT, 0], [3, -2, COW_WHT, 0], [4, -2, COW_OUT, 0],
      [-5, -1, COW_OUT, 0], [-4, -1, COW_WSH, 0], [-3, -1, COW_WHT, 0], [-2, -1, COW_WHT, 0], [-1, -1, COW_OUT, 0], [0, -1, COW_BLK, 0], [1, -1, COW_WHT, 0], [2, -1, COW_WHT, 0], [3, -1, COW_WSH, 0], [4, -1, COW_OUT, 0],
      [-4, 0, COW_OUT, 0], [-3, 0, COW_WSH, 0], [-2, 0, COW_WSH, 0], [-1, 0, COW_BLK, 0], [0, 0, COW_BLK, 0], [1, 0, COW_WSH, 0], [2, 0, COW_WSH, 0], [3, 0, COW_OUT, 0],
      [-4, 1, COW_OUT, 0], [-3, 1, COW_OUT, 0], [-2, 1, COW_OUT, 0], [-1, 1, COW_OUT, 0], [0, 1, COW_OUT, 0], [1, 1, COW_OUT, 0], [2, 1, COW_OUT, 0], [3, 1, COW_OUT, 0],
      [-3, 2, COW_OUT, dyL], [-2, 2, COW_WSH, dyL], [-1, 2, COW_OUT, dyL], [0, 2, COW_OUT, dyR], [1, 2, COW_WSH, dyR], [2, 2, COW_OUT, dyR],
      [-3, 3, COW_OUT, dyL], [-2, 3, COW_WSH, dyL], [-1, 3, COW_OUT, dyL], [0, 3, COW_OUT, dyR], [1, 3, COW_WSH, dyR], [2, 3, COW_OUT, dyR],
      [-3, 4, COW_OUT, dyL], [-2, 4, COW_WSH, dyL], [-1, 4, COW_OUT, dyL], [0, 4, COW_OUT, dyR], [1, 4, COW_WSH, dyR], [2, 4, COW_OUT, dyR],
      [-3, 5, COW_OUT, dyL], [-2, 5, COW_OUT, dyL], [1, 5, COW_OUT, dyR], [2, 5, COW_OUT, dyR],
    ];
    for (const [gx, gy, col, dy] of upMarks) paintAt(cx, cy, gx, gy + dy, mapCowCol(col, isBrown));
  };

  const drawPig = (a: AnimalState) => {
    const cx = Math.round(a.x);
    const cy = Math.round(a.y);
    const { dir, phase, mode } = a;
    const headBob = mode === "eat" ? (phase % 2 === 0 ? 3 : 1) : mode === "walk" && phase % 2 === 1 ? 1 : 0;

    if (dir === "left" || dir === "right") {
      paintShadow(cx, cy, 6.8, 1.8, 2.2);
      const sign = dir === "left" ? 1 : -1;
      const liftA = mode === "walk" && phase % 4 === 0 ? -1 : 0;
      const liftB = mode === "walk" && phase % 4 === 2 ? -1 : 0;
      const marks: Array<[number, number, [number, number, number]]> = [
        [-6, -6, COW_OUT], [-5, -6, P_MID], [-4, -6, COW_OUT], [-2, -6, COW_OUT], [-1, -6, P_MID], [0, -6, COW_OUT],
        [1, -6, COW_OUT], [2, -6, COW_OUT], [3, -6, COW_OUT], [4, -6, COW_OUT], [5, -6, COW_OUT],
        [-7, -5, COW_OUT], [-6, -5, P_LGT], [-5, -5, P_MID], [-4, -5, P_LGT], [-3, -5, P_LGT], [-2, -5, P_MID], [-1, -5, P_LGT], [0, -5, P_LGT], [1, -5, P_LGT], [2, -5, P_LGT], [3, -5, P_LGT], [4, -5, P_LGT], [5, -5, P_MID], [6, -5, COW_OUT],
        [-7, -4, COW_OUT], [-6, -4, P_LGT], [-5, -4, COW_OUT], [-4, -4, P_LGT], [-3, -4, P_LGT], [-2, -4, P_LGT], [-1, -4, P_LGT], [0, -4, P_LGT], [1, -4, P_LGT], [2, -4, P_LGT], [3, -4, P_LGT], [4, -4, P_LGT], [5, -4, P_MID], [6, -4, P_MID], [7, -4, COW_OUT],
        [-9, -3, COW_OUT], [-8, -3, P_SNT], [-7, -3, P_LGT], [-6, -3, P_LGT], [-5, -3, COW_OUT], [-4, -3, P_MID], [-3, -3, P_LGT], [-2, -3, P_LGT], [-1, -3, P_LGT], [0, -3, P_LGT], [1, -3, P_LGT], [2, -3, P_LGT], [3, -3, P_MID], [4, -3, P_MID], [5, -3, P_MID], [6, -3, P_SHD], [7, -3, COW_OUT], [8, -3, P_MID],
        [-9, -2, COW_OUT], [-8, -2, P_NST], [-7, -2, P_SNT], [-6, -2, P_MID], [-5, -2, P_MID], [-4, -2, P_MID], [-3, -2, P_LGT], [-2, -2, P_LGT], [-1, -2, P_LGT], [0, -2, P_MID], [1, -2, P_MID], [2, -2, P_MID], [3, -2, P_MID], [4, -2, P_MID], [5, -2, P_SHD], [6, -2, P_SHD], [7, -2, COW_OUT], [8, -2, COW_OUT],
        [-8, -1, COW_OUT], [-7, -1, COW_OUT], [-6, -1, P_SHD], [-5, -1, P_SHD], [-4, -1, P_SHD], [-3, -1, P_MID], [-2, -1, P_MID], [-1, -1, P_MID], [0, -1, P_SHD], [1, -1, P_SHD], [2, -1, P_SHD], [3, -1, P_SHD], [4, -1, P_SHD], [5, -1, P_SHD], [6, -1, COW_OUT],
        [-6, 0, COW_OUT], [-5, 0, P_SHD], [-4, 0, P_SHD], [-3, 0, COW_OUT], [-2, 0, P_MID], [-1, 0, P_SHD], [0, 0, COW_OUT], [1, 0, COW_OUT], [2, 0, P_SHD], [3, 0, P_SHD], [4, 0, P_MID], [5, 0, P_SHD], [6, 0, COW_OUT],
        [-5, 1 + liftA, COW_OUT], [-4, 1 + liftA, P_SHD], [-2, 1 + liftB, P_MID], [-1, 1 + liftB, COW_OUT], [2, 1 + liftB, COW_OUT], [3, 1 + liftB, P_SHD], [4, 1 + liftA, P_MID], [5, 1 + liftA, COW_OUT],
        [-5, 2 + liftA, COW_OUT], [-4, 2 + liftA, COW_OUT], [-2, 2 + liftB, COW_OUT], [-1, 2 + liftB, COW_OUT], [2, 2 + liftB, COW_OUT], [3, 2 + liftB, COW_OUT], [4, 2 + liftA, COW_OUT], [5, 2 + liftA, COW_OUT],
      ];
      for (const [gx, gy, col] of marks) {
        paintAt(cx, cy, gx * sign, gy, col, gx <= -4 && gy <= -1 ? headBob : 0);
      }
      return;
    }

    paintShadow(cx, cy, 5.2, 1.8, 2.2);
    const dyL = mode === "walk" && phase % 4 === 0 ? -1 : 0;
    const dyR = mode === "walk" && phase % 4 === 2 ? -1 : 0;
    const frontBack: Array<[number, number, [number, number, number]]> =
      dir === "down"
        ? [
            [-3, -6, COW_OUT], [-2, -6, P_MID], [-1, -6, COW_OUT], [0, -6, COW_OUT], [1, -6, P_MID], [2, -6, COW_OUT],
            [-4, -5, COW_OUT], [-3, -5, P_LGT], [-2, -5, P_LGT], [-1, -5, P_LGT], [0, -5, P_LGT], [1, -5, P_LGT], [2, -5, P_LGT], [3, -5, COW_OUT],
            [-5, -4, COW_OUT], [-4, -4, P_LGT], [-3, -4, COW_OUT], [-2, -4, P_LGT], [-1, -4, P_LGT], [0, -4, P_LGT], [1, -4, P_LGT], [2, -4, COW_OUT], [3, -4, P_LGT], [4, -4, COW_OUT],
            [-5, -3, COW_OUT], [-4, -3, P_MID], [-3, -3, P_SNT], [-2, -3, P_NST], [-1, -3, P_SNT], [0, -3, P_SNT], [1, -3, P_NST], [2, -3, P_SNT], [3, -3, P_MID], [4, -3, COW_OUT],
            [-5, -2, COW_OUT], [-4, -2, P_MID], [-3, -2, P_SNT], [-2, -2, P_SNT], [-1, -2, P_SNT], [0, -2, P_SNT], [1, -2, P_SNT], [2, -2, P_SNT], [3, -2, P_MID], [4, -2, COW_OUT],
            [-4, -1, COW_OUT], [-3, -1, P_SHD], [-2, -1, P_MID], [-1, -1, P_MID], [0, -1, P_MID], [1, -1, P_MID], [2, -1, P_SHD], [3, -1, COW_OUT],
            [-4, 0, COW_OUT], [-3, 0, P_SHD], [-2, 0, P_SHD], [-1, 0, COW_OUT], [0, 0, COW_OUT], [1, 0, P_SHD], [2, 0, P_SHD], [3, 0, COW_OUT],
            [-3, 1 + dyL, COW_OUT], [-2, 1 + dyL, P_MID], [1, 1 + dyR, P_MID], [2, 1 + dyR, COW_OUT],
            [-3, 2 + dyL, COW_OUT], [-2, 2 + dyL, COW_OUT], [1, 2 + dyR, COW_OUT], [2, 2 + dyR, COW_OUT],
          ]
        : [
            [-3, -6, COW_OUT], [-2, -6, P_MID], [-1, -6, COW_OUT], [0, -6, COW_OUT], [1, -6, P_MID], [2, -6, COW_OUT],
            [-4, -5, COW_OUT], [-3, -5, P_LGT], [-2, -5, P_LGT], [-1, -5, P_LGT], [0, -5, P_LGT], [1, -5, P_LGT], [2, -5, P_LGT], [3, -5, COW_OUT],
            [-5, -4, COW_OUT], [-4, -4, P_LGT], [-3, -4, P_LGT], [-2, -4, P_LGT], [-1, -4, P_LGT], [0, -4, P_LGT], [1, -4, P_LGT], [2, -4, P_LGT], [3, -4, P_LGT], [4, -4, COW_OUT],
            [-5, -3, COW_OUT], [-4, -3, P_MID], [-3, -3, P_LGT], [-2, -3, P_LGT], [-1, -3, P_MID], [0, -3, P_SNT], [1, -3, P_LGT], [2, -3, P_LGT], [3, -3, P_MID], [4, -3, COW_OUT],
            [-5, -2, COW_OUT], [-4, -2, P_SHD], [-3, -2, P_MID], [-2, -2, P_MID], [-1, -2, COW_OUT], [0, -2, P_SNT], [1, -2, P_MID], [2, -2, P_MID], [3, -2, P_SHD], [4, -2, COW_OUT],
            [-4, -1, COW_OUT], [-3, -1, P_SHD], [-2, -1, P_SHD], [-1, -1, P_SHD], [0, -1, P_SHD], [1, -1, P_SHD], [2, -1, P_SHD], [3, -1, COW_OUT],
            [-4, 0, COW_OUT], [-3, 0, P_SHD], [-2, 0, P_SHD], [-1, 0, COW_OUT], [0, 0, COW_OUT], [1, 0, P_SHD], [2, 0, P_SHD], [3, 0, COW_OUT],
            [-3, 1 + dyL, COW_OUT], [-2, 1 + dyL, P_SHD], [1, 1 + dyR, P_SHD], [2, 1 + dyR, COW_OUT],
            [-3, 2 + dyL, COW_OUT], [-2, 2 + dyL, COW_OUT], [1, 2 + dyR, COW_OUT], [2, 2 + dyR, COW_OUT],
          ];
    for (const [gx, gy, col] of frontBack) {
      paintAt(cx, cy, gx, gy, col, gy <= -2 ? headBob : 0);
    }
  };

  const drawSheepOrGoat = (a: AnimalState) => {
    const cx = Math.round(a.x);
    const cy = Math.round(a.y);
    const isGoat = a.kind === "goat";
    const { dir, phase, mode } = a;
    const headBob = mode === "eat" ? (phase % 2 === 0 ? 4 : 2) : mode === "walk" && phase % 2 === 1 ? 1 : 0;
    const c1 = isGoat ? GT_TAN : S_WHT;
    const c2 = isGoat ? GT_SHD : S_CRM;
    const c3 = isGoat ? GT_DRK : S_SHD;
    const fce = isGoat ? GT_DRK : S_FCE;

    if (dir === "left" || dir === "right") {
      paintShadow(cx, cy, 6.8, 1.8, 2.2);
      const sign = dir === "left" ? 1 : -1;
      const liftA = mode === "walk" && phase % 4 === 0 ? -1 : 0;
      const liftB = mode === "walk" && phase % 4 === 2 ? -1 : 0;
      const marks: Array<[number, number, [number, number, number]]> = [
        ...(isGoat ? ([[-6, -8, GT_HRN], [-5, -8, GT_HRN], [-5, -7, GT_HRN]] as Array<[number, number, [number, number, number]]>) : []),
        [-4, -7, COW_OUT], [-3, -7, COW_OUT], [-1, -7, COW_OUT], [0, -7, COW_OUT], [1, -7, COW_OUT], [3, -7, COW_OUT], [4, -7, COW_OUT],
        [-7, -6, COW_OUT], [-6, -6, c2], [-5, -6, COW_OUT], [-4, -6, c1], [-3, -6, c1], [-2, -6, c2], [-1, -6, c1], [0, -6, c1], [1, -6, c1], [2, -6, c2], [3, -6, c1], [4, -6, c1], [5, -6, COW_OUT],
        [-8, -5, COW_OUT], [-7, -5, fce], [-6, -5, c1], [-5, -5, c1], [-4, -5, c1], [-3, -5, c1], [-2, -5, c1], [-1, -5, c1], [0, -5, c1], [1, -5, c1], [2, -5, c1], [3, -5, c1], [4, -5, c2], [5, -5, c1], [6, -5, COW_OUT],
        [-9, -4, COW_OUT], [-8, -4, fce], [-7, -4, COW_OUT], [-6, -4, fce], [-5, -4, c2], [-4, -4, c1], [-3, -4, c1], [-2, -4, c2], [-1, -4, c1], [0, -4, c1], [1, -4, c2], [2, -4, c1], [3, -4, c1], [4, -4, c2], [5, -4, c2], [6, -4, c1], [7, -4, COW_OUT],
        [-9, -3, COW_OUT], [-8, -3, fce], [-7, -3, fce], [-6, -3, fce], [-5, -3, c1], [-4, -3, c1], [-3, -3, c2], [-2, -3, c1], [-1, -3, c1], [0, -3, c2], [1, -3, c1], [2, -3, c1], [3, -3, c2], [4, -3, c2], [5, -3, c3], [6, -3, c2], [7, -3, COW_OUT],
        [-8, -2, COW_OUT], [-7, -2, isGoat ? c1 : COW_OUT], [-6, -2, c3], [-5, -2, c2], [-4, -2, c2], [-3, -2, c2], [-2, -2, c2], [-1, -2, c2], [0, -2, c2], [1, -2, c2], [2, -2, c3], [3, -2, c2], [4, -2, c3], [5, -2, c3], [6, -2, COW_OUT],
        [-6, -1, COW_OUT], [-5, -1, c3], [-4, -1, c3], [-3, -1, c3], [-2, -1, c3], [-1, -1, c3], [0, -1, c3], [1, -1, c3], [2, -1, c3], [3, -1, c3], [4, -1, c3], [5, -1, COW_OUT],
        [-5, 0, COW_OUT], [-4, 0, fce], [-3, 0, COW_OUT], [-2, 0, fce], [-1, 0, COW_OUT], [1, 0, COW_OUT], [2, 0, fce], [3, 0, COW_OUT], [4, 0, fce], [5, 0, COW_OUT],
        [-5, 1 + liftA, COW_OUT], [-4, 1 + liftA, fce], [-2, 1 + liftB, fce], [-1, 1 + liftB, COW_OUT], [1, 1 + liftB, COW_OUT], [2, 1 + liftB, fce], [4, 1 + liftA, fce], [5, 1 + liftA, COW_OUT],
        [-5, 2 + liftA, COW_OUT], [-4, 2 + liftA, COW_OUT], [-2, 2 + liftB, COW_OUT], [2, 2 + liftB, COW_OUT], [4, 2 + liftA, COW_OUT],
      ];
      for (const [gx, gy, col] of marks) {
        paintAt(cx, cy, gx * sign, gy, col, gx <= -6 && gy <= -2 ? headBob : 0);
      }
      return;
    }

    paintShadow(cx, cy, 5.2, 1.8, 2.2);
    const dyL = mode === "walk" && phase % 4 === 0 ? -1 : 0;
    const dyR = mode === "walk" && phase % 4 === 2 ? -1 : 0;
    const marks: Array<[number, number, [number, number, number]]> = [
      ...(isGoat ? ([[-3, -7, GT_HRN], [2, -7, GT_HRN]] as Array<[number, number, [number, number, number]]>) : []),
      [-3, -6, COW_OUT], [-2, -6, c1], [-1, -6, c1], [0, -6, c1], [1, -6, c1], [2, -6, COW_OUT],
      [-4, -5, COW_OUT], [-3, -5, c1], [-2, -5, c1], [-1, -5, c2], [0, -5, c1], [1, -5, c1], [2, -5, c1], [3, -5, COW_OUT],
      [-5, -4, COW_OUT], [-4, -4, c1], [-3, -4, dir === "down" ? COW_OUT : c1], [-2, -4, dir === "down" ? fce : c2], [-1, -4, dir === "down" ? fce : c1], [0, -4, dir === "down" ? fce : c1], [1, -4, dir === "down" ? fce : c2], [2, -4, dir === "down" ? COW_OUT : c1], [3, -4, c1], [4, -4, COW_OUT],
      [-5, -3, COW_OUT], [-4, -3, c2], [-3, -3, dir === "down" ? fce : c1], [-2, -3, dir === "down" ? fce : c1], [-1, -3, dir === "down" ? fce : c2], [0, -3, dir === "down" ? fce : c2], [1, -3, dir === "down" ? fce : c1], [2, -3, dir === "down" ? fce : c1], [3, -3, c2], [4, -3, COW_OUT],
      [-5, -2, COW_OUT], [-4, -2, c2], [-3, -2, c2], [-2, -2, dir === "down" ? fce : c2], [-1, -2, dir === "down" ? fce : c1], [0, -2, dir === "down" ? fce : c1], [1, -2, dir === "down" ? fce : c2], [2, -2, c2], [3, -2, c2], [4, -2, COW_OUT],
      [-4, -1, COW_OUT], [-3, -1, c3], [-2, -1, c3], [-1, -1, c3], [0, -1, c3], [1, -1, c3], [2, -1, c3], [3, -1, COW_OUT],
      [-3, 0, COW_OUT], [-2, 0, fce], [-1, 0, COW_OUT], [0, 0, COW_OUT], [1, 0, fce], [2, 0, COW_OUT],
      [-3, 1 + dyL, COW_OUT], [-2, 1 + dyL, fce], [1, 1 + dyR, fce], [2, 1 + dyR, COW_OUT],
      [-3, 2 + dyL, COW_OUT], [-2, 2 + dyL, COW_OUT], [1, 2 + dyR, COW_OUT], [2, 2 + dyR, COW_OUT],
    ];
    for (const [gx, gy, col] of marks) {
      paintAt(cx, cy, gx, gy, col, dir === "down" && gy <= -2 ? headBob : 0);
    }
  };

  const ST_OUT: [number, number, number] = [104, 68, 24];
  const ST_DRK: [number, number, number] = [148, 100, 34];
  const ST_MID: [number, number, number] = [206, 158, 54];
  const ST_BRT: [number, number, number] = [242, 204, 82];
  const ST_HLT: [number, number, number] = [254, 232, 128];

  const drawNestBack = (n: NestState) => {
    const nx = Math.round(n.x);
    const ny = Math.round(n.y);
    paintShadow(nx, ny, 7.2, 2.5, 1.5);

    // Back wall & deep interior hollow of the woven straw nest
    const backMarks: Array<[number, number, [number, number, number]]> = [
      [-4, -4, ST_OUT], [-3, -4, ST_OUT], [-2, -4, ST_OUT], [-1, -4, ST_OUT], [0, -4, ST_OUT], [1, -4, ST_OUT], [2, -4, ST_OUT], [3, -4, ST_OUT],
      [-5, -3, ST_OUT], [-4, -3, ST_MID], [-3, -3, ST_BRT], [-2, -3, ST_HLT], [-1, -3, ST_MID], [0, -3, ST_BRT], [1, -3, ST_HLT], [2, -3, ST_BRT], [3, -3, ST_MID], [4, -3, ST_OUT],
      [-6, -2, ST_OUT], [-5, -2, ST_BRT], [-4, -2, ST_DRK], [-3, -2, ST_OUT], [-2, -2, ST_DRK], [-1, -2, ST_OUT], [0, -2, ST_DRK], [1, -2, ST_OUT], [2, -2, ST_DRK], [3, -2, ST_DRK], [4, -2, ST_BRT], [5, -2, ST_OUT],
      [-6, -1, ST_OUT], [-5, -1, ST_MID], [-4, -1, ST_DRK], [-3, -1, ST_OUT], [-2, -1, ST_OUT], [-1, -1, ST_DRK], [0, -1, ST_OUT], [1, -1, ST_OUT], [2, -1, ST_DRK], [3, -1, ST_DRK], [4, -1, ST_MID], [5, -1, ST_OUT],
      [-6, 0, ST_OUT], [-5, 0, ST_DRK], [-4, 0, ST_DRK], [-3, 0, ST_DRK], [-2, 0, ST_DRK], [-1, 0, ST_DRK], [0, 0, ST_DRK], [1, 0, ST_DRK], [2, 0, ST_DRK], [3, 0, ST_DRK], [4, 0, ST_DRK], [5, 0, ST_OUT],
    ];
    for (const [gx, gy, col] of backMarks) {
      paintAt(nx, ny, gx, gy, col);
    }

    // Draw 1 to 3 eggs sitting inside the straw hollow
    const drawSingleEgg = (ex: number, ey: number, isDuckEgg: boolean) => {
      const eBase: [number, number, number] = isDuckEgg ? [216, 244, 238] : [248, 226, 194];
      const eHlt: [number, number, number] = isDuckEgg ? [246, 255, 254] : [255, 248, 236];
      const eShd: [number, number, number] = isDuckEgg ? [174, 212, 204] : [212, 178, 138];
      const eOut: [number, number, number] = [78, 56, 36];

      const eggPixels: Array<[number, number, [number, number, number]]> = [
        [-1, -3, eOut], [0, -3, eOut],
        [-2, -2, eOut], [-1, -2, eHlt], [0, -2, eBase], [1, -2, eOut],
        [-2, -1, eOut], [-1, -1, eHlt], [0, -1, eBase], [1, -1, eShd], [2, -1, eOut],
        [-2, 0, eOut], [-1, 0, eBase], [0, 0, eBase], [1, 0, eShd], [2, 0, eOut],
        [-1, 1, eOut], [0, 1, eShd], [1, 1, eOut],
      ];
      for (const [dx, dy, c] of eggPixels) {
        putPx(ex + dx, ey + dy, c[0], c[1], c[2]);
      }
    };

    const isDuck = n.kind === "duck";
    if (n.eggs >= 3) drawSingleEgg(nx, ny - 3, isDuck);
    if (n.eggs >= 1) drawSingleEgg(nx - 4, ny - 1, isDuck);
    if (n.eggs >= 2) drawSingleEgg(nx + 3, ny - 1, isDuck);
  };

  const drawNestFront = (n: NestState) => {
    const nx = Math.round(n.x);
    const ny = Math.round(n.y);

    // Front raised woven straw rim drawn IN FRONT OF the sitting bird & eggs so the bird is truly inside the nest!
    const frontMarks: Array<[number, number, [number, number, number]]> = [
      // Side walls & raised front straw wisps overlapping the bird's lower chest/belly
      [-6, -1, ST_OUT], [-5, -1, ST_BRT], [4, -1, ST_BRT], [5, -1, ST_OUT],
      [-6, 0, ST_OUT], [-5, 0, ST_MID], [-4, 0, ST_HLT], [-3, 0, ST_BRT], [-2, 0, ST_HLT], [-1, 0, ST_MID], [0, 0, ST_HLT], [1, 0, ST_BRT], [2, 0, ST_HLT], [3, 0, ST_BRT], [4, 0, ST_MID], [5, 0, ST_OUT],
      [-5, 1, ST_OUT], [-4, 1, ST_DRK], [-3, 1, ST_MID], [-2, 1, ST_BRT], [-1, 1, ST_HLT], [0, 1, ST_MID], [1, 1, ST_BRT], [2, 1, ST_MID], [3, 1, ST_DRK], [4, 1, ST_OUT],
      [-4, 2, ST_OUT], [-3, 2, ST_OUT], [-2, 2, ST_DRK], [-1, 2, ST_MID], [0, 2, ST_DRK], [1, 2, ST_MID], [2, 2, ST_OUT], [3, 2, ST_OUT],
    ];
    for (const [gx, gy, col] of frontMarks) {
      paintAt(nx, ny, gx, gy, col);
    }

    // Sparkle celebration right when a new egg is laid
    if (n.sparkleTimer > 0) {
      const lift = Math.round((1 - n.sparkleTimer / 0.9) * 6);
      const spCol: [number, number, number] = [255, 248, 152];
      paintAt(nx, ny - lift, -4, -5, spCol);
      paintAt(nx, ny - lift, 3, -6, C_WHT);
      paintAt(nx, ny - lift, 0, -7, spCol);
    }
  };

  const drawBird = (a: AnimalState) => {
    const cx = Math.round(a.x);
    const cy = Math.round(a.y);
    const isRooster = a.kind === "rooster";
    const isDuck = a.kind === "duck";
    const isBrownHen = a.id === "hen2";
    const { dir, phase, mode } = a;
    const isLaying = mode === "lay";
    const inWater =
      isDuck &&
      !isLaying &&
      (cellVal(cx >> 2, cy >> 2) === 3 ||
        cellVal((cx - 4) >> 2, (cy + 2) >> 2) === 3 ||
        cellVal((cx + 4) >> 2, (cy + 2) >> 2) === 3);

    // When laying in nest, sit centered inside the nest cavity (sitDrop = 1) so the front nest wall wraps in front!
    const sitDrop = isLaying ? 1 : inWater ? 4 : 0;
    const headBob =
      mode === "eat"
        ? phase % 2 === 0
          ? inWater
            ? 4
            : 3
          : 1
        : isLaying
          ? phase % 2 === 0
            ? 1
            : 0
          : !inWater && mode === "walk" && phase % 2 === 1
            ? 1
            : 0;

    const body1: [number, number, number] = isRooster
      ? [232, 162, 68]
      : isBrownHen
        ? [216, 148, 86]
        : C_WHT;
    const body2: [number, number, number] = isRooster
      ? [198, 122, 42]
      : isBrownHen
        ? [184, 114, 56]
        : C_WSH;
    const tailc: [number, number, number] = isRooster
      ? [42, 92, 78]
      : isDuck
        ? C_WSH
        : isBrownHen
          ? [122, 68, 32]
          : C_BRN;
    const beakc: [number, number, number] = isDuck ? C_ORG : C_YLW;

    const blendWaterPx = (px: number, py: number, r: number, g: number, b: number, alpha: number) => {
      if (px < 0 || px >= WIDTH || py < 0 || py >= HEIGHT) return;
      const i = (py * WIDTH + px) * 4;
      data[i] = Math.round(data[i] * (1 - alpha) + r * alpha);
      data[i + 1] = Math.round(data[i + 1] * (1 - alpha) + g * alpha);
      data[i + 2] = Math.round(data[i + 2] * (1 - alpha) + b * alpha);
      data[i + 3] = 255;
    };

    const drawWaterlineAndWake = () => {
      const rCol1: [number, number, number] = [212, 246, 255];
      const rCol2: [number, number, number] = [132, 212, 242];
      const wDark: [number, number, number] = [44, 134, 188];

      // 1. Faintly visible submerged orange webbed feet paddling beneath the water
      const paddle = phase % 2 === 0 ? -1 : 1;
      for (let sy = 0; sy < 2; sy += 1) {
        for (let sx = 0; sx < 2; sx += 1) {
          blendWaterPx(cx + (-2 + paddle) * 2 + sx, cy + 4 + sy, beakc[0], beakc[1], beakc[2], 0.35);
          blendWaterPx(cx + (2 - paddle) * 2 + sx, cy + 4 + sy, beakc[0], beakc[1], beakc[2], 0.35);
        }
      }

      // 2. Water refraction band across the submerged lower belly (y = cy + 2..3)
      const bellySpan = dir === "left" || dir === "right" ? 4 : 3;
      for (let gx = -bellySpan; gx <= bellySpan; gx += 1) {
        for (let sy = 0; sy < 2; sy += 1) {
          for (let sx = 0; sx < 2; sx += 1) {
            blendWaterPx(cx + gx * 2 + sx, cy + 2 + sy, wDark[0], wDark[1], wDark[2], 0.52);
          }
        }
      }

      // 3. Crisp white/cyan waterline foam & oval ripple ring ON TOP OF the duck's waterline
      const ringMarks: Array<[number, number, [number, number, number]]> =
        dir === "left" || dir === "right"
          ? phase % 2 === 0
            ? [
                [-5, 1, rCol1], [-4, 1, rCol2], [-2, 1, rCol1], [0, 1, rCol2], [2, 1, rCol1], [4, 1, rCol2], [5, 1, rCol1],
                [-4, 2, rCol2], [-1, 2, rCol1], [1, 2, rCol1], [3, 2, rCol2],
              ]
            : [
                [-6, 1, rCol2], [-4, 1, rCol1], [-1, 1, rCol2], [1, 1, rCol1], [3, 1, rCol2], [5, 1, rCol1],
                [-5, 2, rCol2], [-2, 2, rCol1], [0, 2, rCol2], [2, 2, rCol1], [4, 2, rCol2],
              ]
          : phase % 2 === 0
            ? [
                [-4, 1, rCol1], [-3, 1, rCol2], [-1, 1, rCol1], [1, 1, rCol1], [3, 1, rCol2], [4, 1, rCol1],
                [-3, 2, rCol2], [0, 2, rCol1], [2, 2, rCol2],
              ]
            : [
                [-4, 1, rCol2], [-2, 1, rCol1], [0, 1, rCol2], [2, 1, rCol1], [4, 1, rCol2],
                [-2, 2, rCol1], [1, 2, rCol1],
              ];
      for (const [gx, gy, col] of ringMarks) {
        paintAt(cx, cy, gx, gy, col);
      }

      // 4. Trailing V-shaped water wake behind swimming duck
      if (mode === "walk") {
        const shift = phase % 2;
        if (dir === "left" || dir === "right") {
          const wSign = dir === "right" ? -1 : 1;
          paintAt(cx, cy, (6 + shift) * wSign, 1, rCol1);
          paintAt(cx, cy, (8 + shift) * wSign, 0, rCol2);
          paintAt(cx, cy, (8 + shift) * wSign, 2, rCol2);
        } else {
          const wSign = dir === "down" ? -1 : 1;
          paintAt(cx, cy, -2, (3 + shift) * wSign, rCol2);
          paintAt(cx, cy, 2, (3 + shift) * wSign, rCol2);
        }
      }
    };

    if (dir === "left" || dir === "right") {
      if (!inWater && !isLaying) paintShadow(cx, cy, 4.2, 1.4, 2.0);
      const sign = dir === "right" ? -1 : 1;
      const liftL = mode === "walk" && phase % 2 === 0 ? -1 : 0;
      const liftR = mode === "walk" && phase % 2 === 1 ? -1 : 0;
      const fullBodyMarks: Array<[number, number, [number, number, number]]> = isDuck
        ? [
            [-5, -5, COW_OUT], [-4, -5, body1], [-3, -5, body1], [-2, -5, COW_OUT],
            [-7, -4, beakc], [-6, -4, beakc], [-5, -4, body1], [-4, -4, COW_OUT], [-3, -4, body1], [-2, -4, COW_OUT], [3, -4, COW_OUT], [4, -4, body1], [5, -4, COW_OUT],
            [-7, -3, beakc], [-6, -3, beakc], [-5, -3, body1], [-4, -3, body1], [-3, -3, body1], [-2, -3, body1], [-1, -3, body1], [0, -3, body1], [1, -3, body1], [2, -3, body1], [3, -3, body2], [4, -3, body2], [5, -3, COW_OUT],
            [-5, -2, COW_OUT], [-4, -2, body1], [-3, -2, body1], [-2, -2, body2], [-1, -2, body2], [0, -2, body2], [1, -2, body1], [2, -2, body2], [3, -2, body2], [4, -2, COW_OUT],
            [-4, -1, COW_OUT], [-3, -1, body2], [-2, -1, body2], [-1, -1, body2], [0, -1, body2], [1, -1, body2], [2, -1, body2], [3, -1, COW_OUT],
            [-3, 0, COW_OUT], [-2, 0, body2], [-1, 0, body2], [0, 0, body2], [1, 0, body2], [2, 0, COW_OUT],
          ]
        : [
            [-4, -6, C_RED], [-3, -6, C_RED], [-2, -6, C_RED],
            [-5, -5, COW_OUT], [-4, -5, C_RED], [-3, -5, C_RED], [-2, -5, COW_OUT], [3, -5, COW_OUT], [4, -5, tailc], [5, -5, COW_OUT],
            [-5, -4, COW_OUT], [-4, -4, body1], [-3, -4, COW_OUT], [-2, -4, body1], [-1, -4, COW_OUT], [2, -4, COW_OUT], [3, -4, tailc], [4, -4, tailc], [5, -4, COW_OUT],
            [-6, -3, C_YLW], [-5, -3, C_YLW], [-4, -3, body1], [-3, -3, body1], [-2, -3, body1], [-1, -3, body1], [0, -3, body1], [1, -3, body1], [2, -3, body2], [3, -3, tailc], [4, -3, COW_OUT],
            [-5, -2, C_RED], [-4, -2, body1], [-3, -2, body1], [-2, -2, body2], [-1, -2, body2], [0, -2, body2], [1, -2, body1], [2, -2, body2], [3, -2, body2], [4, -2, COW_OUT],
            [-4, -1, COW_OUT], [-3, -1, body1], [-2, -1, body2], [-1, -1, body2], [0, -1, body2], [1, -1, body2], [2, -1, body2], [3, -1, COW_OUT],
            [-3, 0, COW_OUT], [-2, 0, body2], [-1, 0, body2], [0, 0, body2], [1, 0, body2], [2, 0, COW_OUT],
          ];
      // When in water or sitting in nest, tuck the bottom row (gy === 0) so the dark bottom outline is hidden
      const bodyMarks = inWater || isLaying ? fullBodyMarks.filter(([, gy]) => gy <= -1) : fullBodyMarks;
      const legMarks: Array<[number, number, [number, number, number]]> =
        inWater || isLaying
          ? []
          : isDuck
            ? [
                [-2, 1 + liftL, beakc], [-1, 1 + liftL, beakc], [1, 1 + liftR, beakc],
                [-3, 2 + liftL, beakc], [-2, 2 + liftL, beakc], [0, 2 + liftR, beakc], [1, 2 + liftR, beakc],
              ]
            : [
                [-1, 1 + liftL, C_YLW], [1, 1 + liftR, C_YLW],
                [-2, 2 + liftL, C_YLW], [-1, 2 + liftL, C_YLW], [0, 2 + liftR, C_YLW], [1, 2 + liftR, C_YLW],
              ];
      for (const [gx, gy, col] of [...bodyMarks, ...legMarks]) {
        paintAt(cx, cy, gx * sign, gy, col, sitDrop + (gx <= -2 && gy <= -2 ? headBob : 0));
      }
      if (inWater) drawWaterlineAndWake();
      return;
    }

    // Front (dir === "down") or Back (dir === "up") view so vertical walking never slides sideways
    if (!inWater && !isLaying) paintShadow(cx, cy, 3.6, 1.5, 2.0);
    const dyL = mode === "walk" && phase % 2 === 0 ? -1 : 0;
    const dyR = mode === "walk" && phase % 2 === 1 ? -1 : 0;
    const fullBodyMarks: Array<[number, number, [number, number, number]]> =
      dir === "down"
        ? [
            ...(isDuck ? [] : ([[-1, -6, C_RED], [0, -6, C_RED]] as Array<[number, number, [number, number, number]]>)),
            [-2, -5, COW_OUT], [-1, -5, isDuck ? body1 : C_RED], [0, -5, isDuck ? body1 : C_RED], [1, -5, COW_OUT],
            [-3, -4, COW_OUT], [-2, -4, body1], [-1, -4, COW_OUT], [0, -4, body1], [1, -4, COW_OUT], [2, -4, COW_OUT],
            [-3, -3, COW_OUT], [-2, -3, body1], [-1, -3, beakc], [0, -3, beakc], [1, -3, body1], [2, -3, COW_OUT],
            [-4, -2, COW_OUT], [-3, -2, body2], [-2, -2, body1], [-1, -2, isDuck ? beakc : C_RED], [0, -2, isDuck ? beakc : C_RED], [1, -2, body1], [2, -2, body2], [3, -2, COW_OUT],
            [-4, -1, COW_OUT], [-3, -1, body2], [-2, -1, body1], [-1, -1, body1], [0, -1, body1], [1, -1, body1], [2, -1, body2], [3, -1, COW_OUT],
            [-3, 0, COW_OUT], [-2, 0, body2], [-1, 0, body2], [0, 0, body2], [1, 0, body2], [2, 0, COW_OUT],
          ]
        : [
            ...(isDuck ? [] : ([[-1, -6, C_RED], [0, -6, C_RED]] as Array<[number, number, [number, number, number]]>)),
            [-2, -5, COW_OUT], [-1, -5, body1], [0, -5, body1], [1, -5, COW_OUT],
            [-3, -4, COW_OUT], [-2, -4, body1], [-1, -4, tailc], [0, -4, tailc], [1, -4, body1], [2, -4, COW_OUT],
            [-4, -3, COW_OUT], [-3, -3, body2], [-2, -3, tailc], [-1, -3, tailc], [0, -3, tailc], [1, -3, tailc], [2, -3, body2], [3, -3, COW_OUT],
            [-4, -2, COW_OUT], [-3, -2, body2], [-2, -2, body2], [-1, -2, tailc], [0, -2, tailc], [1, -2, body2], [2, -2, body2], [3, -2, COW_OUT],
            [-4, -1, COW_OUT], [-3, -1, body2], [-2, -1, body2], [-1, -1, body2], [0, -1, body2], [1, -1, body2], [2, -1, body2], [3, -1, COW_OUT],
            [-3, 0, COW_OUT], [-2, 0, body2], [-1, 0, body2], [0, 0, body2], [1, 0, body2], [2, 0, COW_OUT],
          ];
    const bodyMarks = inWater || isLaying ? fullBodyMarks.filter(([, gy]) => gy <= -1) : fullBodyMarks;
    const legMarks: Array<[number, number, [number, number, number]]> =
      inWater || isLaying
        ? []
        : [
            [-2, 1 + dyL, beakc], [1, 1 + dyR, beakc],
            [-2, 2 + dyL, beakc], [1, 2 + dyR, beakc],
          ];
    for (const [gx, gy, col] of [...bodyMarks, ...legMarks]) {
      paintAt(cx, cy, gx, gy, col, sitDrop + (dir === "down" && gy <= -2 ? headBob : 0));
    }
    if (inWater) drawWaterlineAndWake();
  };

  const drawBabyBird = (a: AnimalState) => {
    const cx = Math.round(a.x);
    const cy = Math.round(a.y);
    const isDuckling = a.kind === "duckling";
    const { dir, phase, mode } = a;
    const inWater =
      isDuckling &&
      (cellVal(cx >> 2, cy >> 2) === 3 ||
        cellVal((cx - 3) >> 2, (cy + 1) >> 2) === 3 ||
        cellVal((cx + 3) >> 2, (cy + 1) >> 2) === 3);

    const sitDrop = inWater ? 2 : 0;
    const headBob = mode === "eat" ? (phase % 2 === 0 ? 2 : 0) : !inWater && mode === "walk" && phase % 2 === 1 ? 1 : 0;

    const isBrownChick = !isDuckling && a.parentId === "hen2";

    // Chick: matches mother hen! Brown Hen (hen2) -> warm russet/caramel brown chick; White Hen (hen1) -> pale creamy yellow chick
    const cYlw: [number, number, number] = isBrownChick ? [204, 136, 74] : [254, 244, 156];
    const cShd: [number, number, number] = isBrownChick ? [164, 98, 46] : [228, 206, 112];
    const cComb: [number, number, number] = [234, 72, 46];

    // Duckling (White Pekin Duckling): bright sunny golden-yellow all over, elongated boat-like body, flat orange bill
    const dYlw: [number, number, number] = [255, 232, 68];
    const dWng: [number, number, number] = [240, 198, 42];
    const dShd: [number, number, number] = [218, 174, 32];
    const bill: [number, number, number] = [250, 126, 24];

    const rCol1: [number, number, number] = [212, 246, 255];
    const rCol2: [number, number, number] = [132, 212, 242];

    if (dir === "left" || dir === "right") {
      if (!inWater) paintShadow(cx, cy, isDuckling ? 3.2 : 2.4, 1.0, 1.0);
      const sign = dir === "right" ? -1 : 1;
      const liftL = mode === "walk" && phase % 2 === 0 ? -1 : 0;
      const liftR = mode === "walk" && phase % 2 === 1 ? -1 : 0;

      const fullMarks: Array<[number, number, [number, number, number]]> = isDuckling
        ? [
            // White Pekin Duckling: sunny golden-yellow head & boat body, long flat orange bill (-5, -4), upturned tail (3)
            [-3, -4, COW_OUT], [-2, -4, dYlw], [-1, -4, dYlw], [0, -4, COW_OUT],
            [-5, -3, bill], [-4, -3, bill], [-3, -3, dYlw], [-2, -3, COW_OUT], [-1, -3, dYlw], [0, -3, COW_OUT], [2, -3, COW_OUT], [3, -3, dWng],
            [-5, -2, bill], [-4, -2, bill], [-3, -2, dYlw], [-2, -2, dYlw], [-1, -2, dYlw], [0, -2, dYlw], [1, -2, dWng], [2, -2, dWng], [3, -2, COW_OUT],
            [-3, -1, COW_OUT], [-2, -1, dWng], [-1, -1, dWng], [0, -1, dWng], [1, -1, dShd], [2, -1, dShd], [3, -1, COW_OUT],
            [-2, 0, COW_OUT], [-1, 0, COW_OUT], [0, 0, COW_OUT], [1, 0, COW_OUT], [2, 0, COW_OUT],
          ]
        : [
            // Barnyard Chick: round upright puffball with tiny red-orange head tuft (-1, -4) and short beak (-3, -2)
            [-2, -4, COW_OUT], [-1, -4, cComb], [0, -4, COW_OUT],
            [-2, -3, COW_OUT], [-1, -3, cYlw], [0, -3, cYlw], [1, -3, COW_OUT],
            [-3, -2, C_ORG], [-2, -2, COW_OUT], [-1, -2, cYlw], [0, -2, cShd], [1, -2, cYlw], [2, -2, COW_OUT],
            [-2, -1, COW_OUT], [-1, -1, cYlw], [0, -1, cShd], [1, -1, cShd], [2, -1, COW_OUT],
            [-1, 0, COW_OUT], [0, 0, COW_OUT], [1, 0, COW_OUT],
          ];
      const bodyMarks = inWater ? fullMarks.filter(([, gy]) => gy <= -1) : fullMarks;
      const legMarks: Array<[number, number, [number, number, number]]> = inWater
        ? []
        : isDuckling
          ? [
              [-1, 0 + liftL, bill], [1, 0 + liftR, bill],
              [-2, 1 + liftL, bill], [-1, 1 + liftL, bill], [0, 1 + liftR, bill], [1, 1 + liftR, bill],
            ]
          : [
              [-1, 0 + liftL, C_YLW], [1, 0 + liftR, C_YLW],
              [-1, 1 + liftL, C_YLW], [1, 1 + liftR, C_YLW],
            ];

      for (const [gx, gy, col] of [...bodyMarks, ...legMarks]) {
        paintAt(cx, cy, gx * sign, gy, col, sitDrop + (gx <= -1 && gy <= -2 ? headBob : 0));
      }

      if (inWater) {
        const ring: Array<[number, number, [number, number, number]]> =
          phase % 2 === 0
            ? [[-4, 0, rCol1], [-2, 0, rCol2], [0, 0, rCol1], [2, 0, rCol2], [4, 0, rCol1]]
            : [[-4, 0, rCol2], [-1, 0, rCol1], [1, 0, rCol2], [3, 0, rCol1], [5 * sign, 0, rCol2]];
        for (const [gx, gy, col] of ring) paintAt(cx, cy, gx, gy, col);
      }
      return;
    }

    if (!inWater) paintShadow(cx, cy, isDuckling ? 2.6 : 2.2, 1.0, 1.0);
    const dyL = mode === "walk" && phase % 2 === 0 ? -1 : 0;
    const dyR = mode === "walk" && phase % 2 === 1 ? -1 : 0;
    const fullMarks: Array<[number, number, [number, number, number]]> =
      dir === "down"
        ? isDuckling
          ? [
              [-1, -4, COW_OUT], [0, -4, dYlw], [1, -4, COW_OUT],
              [-2, -3, COW_OUT], [-1, -3, dYlw], [0, -3, dYlw], [1, -3, dYlw], [2, -3, COW_OUT],
              [-2, -2, COW_OUT], [-1, -2, bill], [0, -2, bill], [1, -2, dYlw], [2, -2, COW_OUT],
              [-2, -1, COW_OUT], [-1, -1, dWng], [0, -1, dYlw], [1, -1, dWng], [2, -1, COW_OUT],
              [-1, 0, COW_OUT], [0, 0, COW_OUT], [1, 0, COW_OUT],
            ]
          : [
              [0, -4, cComb],
              [-1, -3, COW_OUT], [0, -3, cYlw], [1, -3, COW_OUT],
              [-2, -2, COW_OUT], [-1, -2, cYlw], [0, -2, C_ORG], [1, -2, cYlw], [2, -2, COW_OUT],
              [-2, -1, COW_OUT], [-1, -1, cShd], [0, -1, cYlw], [1, -1, cShd], [2, -1, COW_OUT],
              [-1, 0, COW_OUT], [0, 0, COW_OUT], [1, 0, COW_OUT],
            ]
        : isDuckling
          ? [
              [-1, -4, COW_OUT], [0, -4, dYlw], [1, -4, COW_OUT],
              [-2, -3, COW_OUT], [-1, -3, dYlw], [0, -3, dYlw], [1, -3, dYlw], [2, -3, COW_OUT],
              [-2, -2, COW_OUT], [-1, -2, dWng], [0, -2, dWng], [1, -2, dWng], [2, -2, COW_OUT],
              [-2, -1, COW_OUT], [-1, -1, dShd], [0, -1, dWng], [1, -1, dShd], [2, -1, COW_OUT],
              [-1, 0, COW_OUT], [0, 0, COW_OUT], [1, 0, COW_OUT],
            ]
          : [
              [0, -4, cComb],
              [-1, -3, COW_OUT], [0, -3, cYlw], [1, -3, COW_OUT],
              [-2, -2, COW_OUT], [-1, -2, cYlw], [0, -2, cShd], [1, -2, cYlw], [2, -2, COW_OUT],
              [-2, -1, COW_OUT], [-1, -1, cShd], [0, -1, cShd], [1, -1, cShd], [2, -1, COW_OUT],
              [-1, 0, COW_OUT], [0, 0, COW_OUT], [1, 0, COW_OUT],
            ];
    const bodyMarks = inWater ? fullMarks.filter(([, gy]) => gy <= -1) : fullMarks;
    const legCol = isDuckling ? bill : C_YLW;
    const legMarks: Array<[number, number, [number, number, number]]> = inWater
      ? []
      : [
          [-1, 0 + dyL, legCol], [1, 0 + dyR, legCol],
          [-1, 1 + dyL, legCol], [1, 1 + dyR, legCol],
        ];
    for (const [gx, gy, col] of [...bodyMarks, ...legMarks]) {
      paintAt(cx, cy, gx, gy, col, sitDrop + (dir === "down" && gy <= -2 ? headBob : 0));
    }
    if (inWater) {
      const ring: Array<[number, number, [number, number, number]]> =
        phase % 2 === 0
          ? [[-3, 0, rCol1], [-1, 0, rCol2], [1, 0, rCol1], [3, 0, rCol2]]
          : [[-3, 0, rCol2], [0, 0, rCol1], [2, 0, rCol2]];
      for (const [gx, gy, col] of ring) paintAt(cx, cy, gx, gy, col);
    }
  };

  drawSmallFeeders();

  // Depth-sort all renderables by Y coordinate
  interface RenderItem {
    y: number;
    draw: () => void;
  }
  const items: RenderItem[] = [];

  for (const n of nests) {
    items.push({
      y: n.y - 1,
      draw: () => drawNestBack(n),
    });
    items.push({
      y: n.y + 1,
      draw: () => drawNestFront(n),
    });
  }

  const cow1 = animals.find((a) => a.id === "cow1")!;
  const cow2 = animals.find((a) => a.id === "cow2")!;

  // Trough 1 (x=568, y=86) with Cow 1
  items.push({
    y: TROUGH_1_Y,
    draw: () => {
      const eatingHere = cow1.mode === "eat" && cow1.dir === "down" && cow1.y <= TROUGH_1_Y;
      drawTroughBack(TROUGH_1_X, TROUGH_1_Y, fodder1);
      if (eatingHere) drawCow(cow1, false, true);
      drawTroughFront(TROUGH_1_X, TROUGH_1_Y, fodder1, eatingHere, cow1.phase);
    },
  });

  // Trough 2 (x=468, y=86) with Cow 2
  items.push({
    y: TROUGH_2_Y,
    draw: () => {
      const eatingHere = cow2.mode === "eat" && cow2.dir === "down" && cow2.y <= TROUGH_2_Y;
      drawTroughBack(TROUGH_2_X, TROUGH_2_Y, fodder2);
      if (eatingHere) drawCow(cow2, false, true);
      drawTroughFront(TROUGH_2_X, TROUGH_2_Y, fodder2, eatingHere, cow2.phase);
    },
  });

  for (const a of animals) {
    items.push({
      y: a.y,
      draw: () => {
        if (a.kind === "cow_holstein" || a.kind === "cow_brown") {
          const tY = a.troughId === 2 ? TROUGH_2_Y : TROUGH_1_Y;
          const eatingOverTrough = a.mode === "eat" && a.dir === "down" && a.y <= tY;
          drawCow(a, eatingOverTrough, false);
        } else if (a.kind === "calf_holstein" || a.kind === "calf_brown") {
          drawCalf(a);
        } else if (a.kind === "pig") {
          drawPig(a);
        } else if (a.kind === "sheep" || a.kind === "goat") {
          drawSheepOrGoat(a);
        } else if (a.kind === "chick" || a.kind === "duckling") {
          drawBabyBird(a);
        } else {
          drawBird(a);
        }
      },
    });
  }

  items.sort((a, b) => a.y - b.y);
  for (const item of items) item.draw();
}

interface PondFishState {
  id: string;
  kind: "koi_kohaku" | "goldfish" | "koi_gold" | "koi_showa";
  x: number;
  y: number;
  dir: CowDir;
  mode: "swim" | "jump";
  phase: number;
  stepAccum: number;
  speed: number;
  wpIdx: number;
  waypoints: Array<{ x: number; y: number; jumpHere?: boolean }>;
  jumpProgress: number;
  jumpDuration: number;
  lastSplashX: number;
  lastSplashY: number;
  splashTimer: number;
}

function drawPondFishScene(data: Uint8ClampedArray, fishes: PondFishState[]) {
  const putOpaque = (x: number, y: number, r: number, g: number, b: number) => {
    if (x < 0 || x >= WIDTH || y < 0 || y >= HEIGHT) return;
    const i = (y * WIDTH + x) * 4;
    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
    data[i + 3] = 255;
  };

  const putBlend = (
    x: number,
    y: number,
    r: number,
    g: number,
    b: number,
    alpha: number,
    respectLilyPad: boolean,
  ) => {
    if (x < 0 || x >= WIDTH || y < 0 || y >= HEIGHT) return;
    if (respectLilyPad && isLilyPadAt(x, y)) return;
    const i = (y * WIDTH + x) * 4;
    data[i] = Math.round(data[i] * (1 - alpha) + r * alpha);
    data[i + 1] = Math.round(data[i + 1] * (1 - alpha) + g * alpha);
    data[i + 2] = Math.round(data[i + 2] * (1 - alpha) + b * alpha);
    data[i + 3] = 255;
  };

  const getFishColors = (kind: PondFishState["kind"]) => {
    if (kind === "koi_kohaku") {
      return {
        c1: [248, 250, 252] as [number, number, number],
        c2: [238, 72, 46] as [number, number, number],
        c3: [196, 46, 28] as [number, number, number],
        fin: [246, 236, 232] as [number, number, number],
      };
    }
    if (kind === "goldfish") {
      return {
        c1: [252, 146, 38] as [number, number, number],
        c2: [255, 192, 68] as [number, number, number],
        c3: [212, 96, 22] as [number, number, number],
        fin: [255, 214, 102] as [number, number, number],
      };
    }
    if (kind === "koi_gold") {
      return {
        c1: [252, 212, 58] as [number, number, number],
        c2: [255, 238, 118] as [number, number, number],
        c3: [214, 162, 32] as [number, number, number],
        fin: [255, 242, 148] as [number, number, number],
      };
    }
    return {
      c1: [244, 246, 250] as [number, number, number],
      c2: [232, 68, 44] as [number, number, number],
      c3: [44, 50, 62] as [number, number, number],
      fin: [236, 240, 246] as [number, number, number],
    };
  };

  // 1. Draw expanding water ripples (riak air) for active splashes
  for (const f of fishes) {
    if (f.splashTimer > 0) {
      const p = 1 - f.splashTimer / 0.55; // 0 -> 1
      const rx1 = 3 + p * 12;
      const ry1 = 1.6 + p * 6;
      const rx2 = Math.max(1.5, rx1 - 3.5);
      const ry2 = Math.max(1.0, ry1 - 1.8);
      const alpha = Math.max(0.15, (1 - p) * 0.75);
      const sx = Math.round(f.lastSplashX);
      const sy = Math.round(f.lastSplashY);

      for (let dy = -9; dy <= 9; dy += 1) {
        for (let dx = -16; dx <= 16; dx += 1) {
          const d1 = Math.sqrt((dx * dx) / (rx1 * rx1) + (dy * dy) / (ry1 * ry1));
          if (Math.abs(d1 - 1) < 0.14) {
            putBlend(sx + dx, sy + dy, 198, 242, 255, alpha, true);
          } else if (p > 0.2) {
            const d2 = Math.sqrt((dx * dx) / (rx2 * rx2) + (dy * dy) / (ry2 * ry2));
            if (Math.abs(d2 - 1) < 0.16) {
              putBlend(sx + dx, sy + dy, 148, 222, 246, alpha * 0.7, true);
            }
          }
        }
      }

      // White splash droplets flying up right at takeoff / landing
      if (p < 0.48) {
        const dropLift = Math.round(Math.sin((p / 0.48) * Math.PI) * 6);
        const dropOffsets: Array<[number, number]> = [
          [-4, -2 - dropLift],
          [4, -2 - dropLift],
          [-2, -4 - dropLift],
          [2, -4 - dropLift],
          [0, -3 - Math.round(dropLift * 0.7)],
        ];
        for (const [ox, oy] of dropOffsets) {
          putOpaque(sx + ox, sy + oy, 236, 252, 255);
        }
      }
    }
  }

  // 2. Draw swimming fishes (submerged underneath water & lily pads)
  for (const f of fishes) {
    if (f.mode !== "swim") continue;
    const cx = Math.round(f.x);
    const cy = Math.round(f.y);
    const { c1, c2, c3, fin } = getFishColors(f.kind);
    const wag = f.phase === 0 ? -1 : f.phase === 2 ? 1 : 0;

    if (f.dir === "left" || f.dir === "right") {
      const sign = f.dir === "left" ? 1 : -1;
      const bodyMarks: Array<[number, number, [number, number, number], number]> = [
        // Fins
        [-1, -3, fin, 0.48], [0, -3, fin, 0.48],
        [-1, 3, fin, 0.48], [0, 3, fin, 0.48],
        // Upper & lower body contour
        [-4, -1, c1, 0.64], [-3, -2, c1, 0.62], [-2, -2, c2, 0.64], [-1, -2, c2, 0.64], [0, -2, c1, 0.62], [1, -2, c3, 0.62], [2, -1, c1, 0.60],
        // Center spine & head
        [-5, 0, c2, 0.68], [-4, 0, COW_OUT, 0.55], [-3, 0, c1, 0.70], [-2, 0, c2, 0.72], [-1, 0, c2, 0.72], [0, 0, c1, 0.70], [1, 0, c3, 0.68], [2, 0, c2, 0.66], [3, 0, c1, 0.62],
        // Lower belly
        [-4, 1, c1, 0.64], [-3, 1, c1, 0.66], [-2, 1, c1, 0.66], [-1, 1, c2, 0.66], [0, 1, c1, 0.64], [1, 1, c3, 0.62], [2, 1, c1, 0.58],
        // Wagging tail fin
        [4, wag, fin, 0.58], [5, wag - 1, fin, 0.52], [5, wag, c2, 0.56], [5, wag + 1, fin, 0.52], [6, wag - 1, fin, 0.44], [6, wag + 1, fin, 0.44],
      ];
      for (const [gx, gy, col, a] of bodyMarks) {
        putBlend(cx + gx * sign, cy + gy, col[0], col[1], col[2], a, true);
      }
      // Subtle trailing water shimmer behind tail
      if (f.phase % 2 === 0) {
        putBlend(cx + 8 * sign, cy - wag, 156, 226, 248, 0.55, true);
        putBlend(cx + 9 * sign, cy - wag, 156, 226, 248, 0.40, true);
      }
    } else {
      const sign = f.dir === "up" ? 1 : -1;
      const bodyMarks: Array<[number, number, [number, number, number], number]> = [
        // Side pectoral fins
        [-3, -1, fin, 0.48], [-3, 0, fin, 0.48],
        [3, -1, fin, 0.48], [3, 0, fin, 0.48],
        // Body
        [0, -5, c2, 0.68],
        [-1, -4, c1, 0.64], [0, -4, COW_OUT, 0.55], [1, -4, c1, 0.64],
        [-2, -3, c1, 0.62], [-1, -3, c1, 0.68], [0, -3, c1, 0.70], [1, -3, c1, 0.68], [2, -3, c1, 0.62],
        [-2, -2, c2, 0.64], [-1, -2, c2, 0.70], [0, -2, c2, 0.72], [1, -2, c2, 0.70], [2, -2, c1, 0.62],
        [-2, -1, c2, 0.64], [-1, -1, c2, 0.70], [0, -1, c2, 0.72], [1, -1, c1, 0.68], [2, -1, c1, 0.62],
        [-2, 0, c1, 0.62], [-1, 0, c1, 0.68], [0, 0, c1, 0.70], [1, 0, c3, 0.68], [2, 0, c3, 0.62],
        [-1, 1, c3, 0.62], [0, 1, c3, 0.68], [1, 1, c1, 0.62],
        [-1, 2, c1, 0.58], [0, 2, c2, 0.64], [1, 2, c1, 0.58],
        [0, 3, c1, 0.60],
        // Wagging tail fin
        [wag, 4, fin, 0.58], [wag - 1, 5, fin, 0.52], [wag, 5, c2, 0.56], [wag + 1, 5, fin, 0.52], [wag - 1, 6, fin, 0.44], [wag + 1, 6, fin, 0.44],
      ];
      for (const [gx, gy, col, a] of bodyMarks) {
        putBlend(cx + gx, cy + gy * sign, col[0], col[1], col[2], a, true);
      }
      if (f.phase % 2 === 0) {
        putBlend(cx - wag, cy + 8 * sign, 156, 226, 248, 0.55, true);
      }
    }
  }

  // 3. Draw jumping fishes (leaping high above the water in a parabolic arc)
  for (const f of fishes) {
    if (f.mode !== "jump") continue;
    const cx = Math.round(f.x);
    const cy = Math.round(f.y);
    const t = Math.max(0, Math.min(1, f.jumpProgress));
    const arcY = Math.round(Math.sin(t * Math.PI) * 16);
    const { c1, c2, c3, fin } = getFishColors(f.kind);

    // Dark shadow on water surface directly below the jumping fish
    const shRx = Math.max(2.5, 4.8 - arcY * 0.12);
    const shRy = Math.max(1.2, 2.0 - arcY * 0.05);
    for (let dy = -3; dy <= 3; dy += 1) {
      for (let dx = -6; dx <= 6; dx += 1) {
        if ((dx * dx) / (shRx * shRx) + (dy * dy) / (shRy * shRy) <= 1) {
          putBlend(cx + dx, cy + 2 + dy, 18, 62, 96, 0.38, true);
        }
      }
    }

    const sign = f.dir === "right" ? -1 : 1;
    // Dynamic body tilt: rising (t < 0.36), cresting arch (0.36..0.64), diving (t > 0.64)
    const tilt = t < 0.36 ? 1 : t > 0.64 ? -1 : 0;
    const arch = t >= 0.36 && t <= 0.64 ? 1 : 0;

    const jumpMarks: Array<[number, number, [number, number, number]]> = [
      // Dark outline around leaping fish
      [-6, 0, COW_OUT], [-5, -1, COW_OUT], [-5, 1, COW_OUT],
      [-4, -2, COW_OUT], [-3, -3, COW_OUT], [-2, -3, COW_OUT], [-1, -3, COW_OUT], [0, -3, COW_OUT], [1, -3, COW_OUT], [2, -2, COW_OUT], [3, -2, COW_OUT],
      [-4, 2, COW_OUT], [-3, 2, COW_OUT], [-2, 3, COW_OUT], [-1, 3, COW_OUT], [0, 3, COW_OUT], [1, 2, COW_OUT], [2, 2, COW_OUT], [3, 1, COW_OUT],
      // Dorsal & ventral fins
      [-1, -4, fin], [0, -4, fin], [1, -4, c2],
      [-1, 4, fin], [0, 4, fin],
      // Crisp vivid body
      [-5, 0, c2],
      [-4, -1, c1], [-4, 0, COW_OUT], [-4, 1, c1],
      [-3, -2, c1], [-3, -1, c2], [-3, 0, c2], [-3, 1, c1],
      [-2, -2, c2], [-2, -1, c2], [-2, 0, c2], [-2, 1, c1], [-2, 2, c1],
      [-1, -2, c2], [-1, -1, c1], [-1, 0, c2], [-1, 1, c1], [-1, 2, c1],
      [0, -2, c1], [0, -1, c1], [0, 0, c3], [0, 1, c1], [0, 2, c1],
      [1, -2, c3], [1, -1, c3], [1, 0, c3], [1, 1, c2],
      [2, -1, c1], [2, 0, c2], [2, 1, c1],
      [3, -1, c1], [3, 0, c1],
      // Forked tail fin
      [4, -1, fin], [4, 0, c2], [4, 1, fin],
      [5, -2, fin], [5, -1, fin], [5, 1, fin], [5, 2, fin],
      [6, -2, COW_OUT], [6, 2, COW_OUT],
      // Wet white specular shine on top of the fish
      [-2, -2, C_WHT], [-1, -2, C_WHT],
    ];

    for (const [gx, gy, col] of jumpMarks) {
      const curveY = arch ? Math.round((gx * gx) * 0.08) - 1 : Math.round(gx * 0.35 * tilt);
      putOpaque(cx + gx * sign, cy - arcY + gy + curveY, col[0], col[1], col[2]);
    }

    // Sparkling water droplets trailing the leaping fish in mid-air
    const dropPhase = f.phase % 2;
    putOpaque(cx + (6 + dropPhase) * sign, cy - arcY + 3, 232, 250, 255);
    putOpaque(cx + (4 - dropPhase) * sign, cy - arcY - 5, 192, 240, 255);
    putOpaque(cx - 5 * sign, cy - arcY + 4, 232, 250, 255);
  }
}

function drawFodderFieldScene(data: Uint8ClampedArray, nowMs: number) {
  const put1 = (px: number, py: number, r: number, g: number, b: number) => {
    if (px < 0 || py < 0 || px >= WIDTH || py >= HEIGHT) return;
    const idx = (py * WIDTH + px) * 4;
    data[idx] = r;
    data[idx + 1] = g;
    data[idx + 2] = b;
    data[idx + 3] = 255;
  };

  const WH_SHD: [number, number, number] = [118, 70, 16];
  const WH_DRK: [number, number, number] = [162, 102, 22];
  const WH_AMB: [number, number, number] = [208, 148, 32];
  const WH_GLD: [number, number, number] = [244, 192, 48];
  const WH_BRT: [number, number, number] = [254, 222, 80];
  const WH_TOP: [number, number, number] = [255, 244, 134];

  const WHEAT_TUFT: Array<[number, number, [number, number, number]]> = [
    [-5, -10, WH_TOP], [-1, -11, WH_TOP], [2, -10, WH_TOP], [5, -9, WH_BRT],
    [-6, -9, WH_BRT], [-5, -9, WH_GLD], [-2, -10, WH_BRT], [-1, -10, WH_GLD], [1, -9, WH_BRT], [2, -9, WH_GLD], [4, -8, WH_BRT], [5, -8, WH_GLD],
    [-6, -8, WH_GLD], [-5, -8, WH_AMB], [-4, -8, WH_TOP], [-3, -8, WH_BRT], [-2, -9, WH_GLD], [-1, -9, WH_AMB], [0, -8, WH_TOP], [1, -8, WH_GLD], [2, -8, WH_AMB], [3, -7, WH_BRT], [4, -7, WH_GLD], [5, -7, WH_AMB],
    [-7, -7, WH_BRT], [-6, -7, WH_GLD], [-5, -7, WH_SHD], [-4, -7, WH_BRT], [-3, -7, WH_GLD], [-2, -7, WH_DRK], [-1, -7, WH_BRT], [0, -7, WH_GLD], [1, -7, WH_DRK], [2, -7, WH_BRT], [3, -6, WH_GLD], [4, -6, WH_DRK], [5, -6, WH_BRT], [6, -6, WH_GLD],
    [-7, -6, WH_GLD], [-6, -6, WH_AMB], [-5, -6, WH_DRK], [-4, -6, WH_GLD], [-3, -6, WH_BRT], [-2, -6, WH_AMB], [-1, -6, WH_GLD], [0, -6, WH_BRT], [1, -6, WH_AMB], [2, -6, WH_GLD], [3, -5, WH_BRT], [4, -5, WH_AMB], [5, -5, WH_GLD], [6, -5, WH_AMB],
    [-6, -5, WH_AMB], [-5, -5, WH_GLD], [-4, -5, WH_DRK], [-3, -5, WH_GLD], [-2, -5, WH_BRT], [-1, -5, WH_SHD], [0, -5, WH_GLD], [1, -5, WH_BRT], [2, -5, WH_DRK], [3, -4, WH_GLD], [4, -4, WH_BRT], [5, -4, WH_DRK], [6, -4, WH_AMB],
    [-6, -4, WH_DRK], [-5, -4, WH_GLD], [-4, -4, WH_BRT], [-3, -4, WH_AMB], [-2, -4, WH_GLD], [-1, -4, WH_DRK], [0, -4, WH_BRT], [1, -4, WH_GLD], [2, -4, WH_AMB], [3, -3, WH_DRK], [4, -3, WH_GLD], [5, -3, WH_AMB],
    [-6, -3, WH_SHD], [-5, -3, WH_AMB], [-4, -3, WH_GLD], [-3, -3, WH_DRK], [-2, -3, WH_BRT], [-1, -3, WH_AMB], [0, -3, WH_GLD], [1, -3, WH_DRK], [2, -3, WH_BRT], [3, -2, WH_AMB], [4, -2, WH_GLD], [5, -2, WH_DRK],
    [-6, -2, WH_SHD], [-5, -2, WH_DRK], [-4, -2, WH_AMB], [-3, -2, WH_GLD], [-2, -2, WH_DRK], [-1, -2, WH_GLD], [0, -2, WH_AMB], [1, -2, WH_DRK], [2, -2, WH_GLD], [3, -1, WH_DRK], [4, -1, WH_AMB], [5, -1, WH_SHD],
    [-5, -1, WH_SHD], [-4, -1, WH_DRK], [-3, -1, WH_AMB], [-2, -1, WH_SHD], [-1, -1, WH_AMB], [0, -1, WH_DRK], [1, -1, WH_SHD], [2, -1, WH_AMB], [3, 0, WH_DRK], [4, 0, WH_SHD],
    [-5, 0, WH_SHD], [-4, 0, WH_DRK], [-3, 0, WH_SHD], [-2, 0, WH_DRK], [-1, 0, WH_AMB], [0, 0, WH_SHD], [1, 0, WH_DRK], [2, 0, WH_SHD],
  ];

  const LF_SHD: [number, number, number] = [44, 78, 16];
  const LF_DRK: [number, number, number] = [72, 122, 24];
  const LF_MID: [number, number, number] = [112, 168, 34];
  const LF_BRT: [number, number, number] = [156, 206, 48];
  const LF_YLW: [number, number, number] = [214, 228, 68];
  const LF_GLD: [number, number, number] = [248, 212, 64];

  const LEAFY_CROP: Array<[number, number, [number, number, number]]> = [
    [-3, -9, LF_GLD], [1, -10, LF_GLD], [4, -8, LF_YLW],
    [-5, -8, LF_YLW], [-4, -8, LF_BRT], [-3, -8, LF_YLW], [-1, -9, LF_YLW], [0, -9, LF_BRT], [1, -9, LF_YLW], [3, -8, LF_BRT], [4, -7, LF_BRT], [5, -7, LF_YLW],
    [-6, -7, LF_BRT], [-5, -7, LF_MID], [-3, -7, LF_BRT], [-2, -7, LF_MID], [-1, -8, LF_BRT], [0, -8, LF_MID], [1, -7, LF_BRT], [2, -7, LF_MID], [3, -7, LF_BRT], [5, -6, LF_BRT], [6, -6, LF_MID],
    [-6, -6, LF_MID], [-5, -6, LF_DRK], [-4, -6, LF_BRT], [-3, -6, LF_MID], [-2, -6, LF_DRK], [-1, -6, LF_BRT], [0, -6, LF_YLW], [1, -6, LF_MID], [2, -6, LF_DRK], [3, -6, LF_BRT], [4, -5, LF_MID], [5, -5, LF_DRK],
    [-5, -5, LF_DRK], [-4, -5, LF_MID], [-3, -5, LF_BRT], [-2, -5, LF_MID], [-1, -5, LF_DRK], [0, -5, LF_BRT], [1, -5, LF_MID], [2, -5, LF_BRT], [3, -5, LF_MID], [4, -4, LF_DRK],
    [-5, -4, LF_SHD], [-4, -4, LF_DRK], [-3, -4, LF_MID], [-2, -4, LF_BRT], [-1, -4, LF_MID], [0, -4, LF_DRK], [1, -4, LF_BRT], [2, -4, LF_MID], [3, -4, LF_DRK], [4, -3, LF_SHD],
    [-4, -3, LF_SHD], [-3, -3, LF_DRK], [-2, -3, LF_MID], [-1, -3, LF_BRT], [0, -3, LF_MID], [1, -3, LF_DRK], [2, -3, LF_MID], [3, -3, LF_SHD],
    [-3, -2, LF_SHD], [-2, -2, LF_DRK], [-1, -2, LF_MID], [0, -2, LF_BRT], [1, -2, LF_DRK], [2, -2, LF_SHD],
    [-3, -1, LF_SHD], [-2, -1, LF_SHD], [-1, -1, LF_DRK], [0, -1, LF_MID], [1, -1, LF_DRK], [2, -1, LF_SHD],
    [-2, 0, LF_SHD], [-1, 0, LF_SHD], [0, 0, LF_DRK], [1, 0, LF_SHD],
  ];

  const drawFrontPost = (cx: number, cy: number) => {
    for (let dy = -7; dy <= 5; dy += 1) {
      for (let dx = -3; dx <= 3; dx += 1) {
        const isOut = dx === -3 || dx === 3 || dy === -7 || dy === 5;
        if (isOut) put1(cx + dx, cy + dy, 38, 22, 10);
        else if (dy === -6 || dy === -5) put1(cx + dx, cy + dy, dy === -6 ? 224 : 198, dy === -6 ? 172 : 142, dy === -6 ? 102 : 76);
        else if (dy === -4) put1(cx + dx, cy + dy, 74, 44, 20);
        else if (dx === -2) put1(cx + dx, cy + dy, 186, 126, 62);
        else if (dx === -1 || dx === 0) put1(cx + dx, cy + dy, 158, 100, 46);
        else put1(cx + dx, cy + dy, 116, 70, 30);
      }
    }
  };

  for (const plot of FODDER_PLOTS) {
    const { x0: FX0, x1: FX1, y0: FY0, y1: FY1 } = plot;

    // 1. UPPER BED: Dense, continuous golden wheat rows
    const wheatRowYs = [FY0 + 14, FY0 + 22, FY0 + 30, FY0 + 38];
    for (let rIdx = 0; rIdx < wheatRowYs.length; rIdx += 1) {
      const cy = wheatRowYs[rIdx];
      const xStart = FX0 + 11 + (rIdx % 2) * 5;
      for (let cx = xStart; cx <= FX1 - 12; cx += 11) {
        const sway = Math.round(Math.sin(nowMs * 0.0025 + cx * 0.07 + rIdx * 0.6));
        for (const [dx, dy, col] of WHEAT_TUFT) {
          const shift = dy <= -6 ? sway : 0;
          put1(cx + dx + shift, cy + dy, col[0], col[1], col[2]);
          put1(cx + dx + shift, cy + dy + 1, col[0], col[1], col[2]);
        }
      }
    }

    // 2. LOWER BED: 3 continuous rows of closely-spaced leafy green-gold plants
    const greenRowYs = [FY0 + 55, FY0 + 71, FY0 + 87];
    for (let rIdx = 0; rIdx < greenRowYs.length; rIdx += 1) {
      const cy = greenRowYs[rIdx];
      for (let cx = FX0 + 12; cx <= FX1 - 12; cx += 11) {
        const sway = Math.round(Math.sin(nowMs * 0.0026 + cx * 0.08 + rIdx * 0.7));
        for (const [dx, dy, col] of LEAFY_CROP) {
          const shift = dy <= -6 ? sway : 0;
          put1(cx + dx + shift, cy + dy, col[0], col[1], col[2]);
          put1(cx + dx + shift, cy + dy + 1, col[0], col[1], col[2]);
        }
      }
    }

    // 3. 2.5D FRONT WOODEN FENCE OVERLAY
    const yTop = FY1 - 8;
    for (let px = FX0; px <= FX1; px += 1) {
      const gx = px >> 1;
      put1(px, yTop, 42, 24, 12);
      put1(px, yTop + 1, 198, 138, 72);
      put1(px, yTop + 2, gx % 4 === 0 ? 162 : 176, gx % 4 === 0 ? 104 : 116, 54);
      put1(px, yTop + 3, 124, 76, 34);
      put1(px, yTop + 4, 42, 24, 12);
      put1(px, yTop + 6, 42, 24, 12);
      put1(px, yTop + 7, 178, 118, 56);
      put1(px, yTop + 8, 134, 82, 38);
      put1(px, yTop + 9, 42, 24, 12);
    }
    for (const px of [FX0 + 2, FX0 + 37, FX0 + 74, FX0 + 111, FX0 + 148, FX1 - 2]) {
      drawFrontPost(px, FY1 - 2);
    }
  }
}

interface PlayerState {
  x: number;
  y: number;
  dir: CowDir;
  facingSign: 1 | -1;
  phase: number;
  walkCycle: number;
  stepAccum: number;
  moving: boolean;
  target: { x: number; y: number } | null;
  patrolIdx: number;
  idleTimer: number;
}

interface CameraState {
  x: number;
  y: number;
  zoom: number;
  follow: boolean;
}

const WORLD_ZONES = [
  { id: "plaza", label: "Alun-Alun", x: 568 + OX, y: 336 + OY },
  { id: "ranch", label: "Lumbung Utara", x: 560 + OX, y: -215 + OY },
  { id: "pasture", label: "Kandang Sapi", x: 540 + OX, y: 158 + OY },
  { id: "fodder", label: "Lahan Pakan", x: -40 + OX, y: 580 + OY },
  { id: "house", label: "Rumah Petani", x: -372 + OX, y: 182 + OY },
  { id: "east", label: "Danau Timur", x: 1405 + OX, y: 525 + OY },
] as const;

// Automatic Village Patrol Route when the player is not actively pressing keys / clicking
const FARMER_PATROL = [
  { x: 410 + OX, y: 336 + OY }, // Jalan Barat Alun-Alun
  { x: 255 + OX, y: 336 + OY }, // Dekat Kolam Koi & Bebek
  { x: 255 + OX, y: 475 + OY }, // Persimpangan Lahan Pakan
  { x: 65 + OX, y: 475 + OY },  // Depan Lahan Gandum & Pakan
  { x: 255 + OX, y: 475 + OY }, // Kembali ke Persimpangan
  { x: 568 + OX, y: 475 + OY }, // Jalan Selatan Alun-Alun
  { x: 568 + OX, y: 215 + OY }, // Gerbang Padang Ternak Sapi
  { x: 568 + OX, y: 336 + OY }, // Pusat Alun-Alun Desa
] as const;

function drawFarmerAndOverlays(
  ctx: CanvasRenderingContext2D,
  camX: number,
  camY: number,
  zoom: number,
  player: PlayerState,
  farmerName: string,
  nowMs: number,
) {
  const toScreenX = (wx: number) => Math.round((wx - camX) * zoom);
  const toScreenY = (wy: number) => Math.round((wy - camY) * zoom);

  // 1. Draw click-to-walk target ring on the ground if active
  if (player.target) {
    const tx = toScreenX(player.target.x);
    const ty = toScreenY(player.target.y);
    const pulse = 1 + Math.sin(nowMs * 0.008) * 0.2;
    ctx.save();
    ctx.strokeStyle = "rgba(255, 238, 128, 0.92)";
    ctx.lineWidth = Math.max(2, Math.round(2 * zoom));
    ctx.beginPath();
    ctx.ellipse(tx, ty, 10 * zoom * pulse, 5 * zoom * pulse, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "rgba(255, 210, 64, 0.45)";
    ctx.beginPath();
    ctx.ellipse(tx, ty, 4 * zoom, 2 * zoom, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // ===========================================================================
  // 2. 100% HAND-CRAFTED MULTI-JOINTED SKELETAL PIXEL-ART FARMER CHARACTER
  //    (Hip -> Knee -> Ankle -> Sneaker + Shoulder -> Elbow -> Wrist -> Hand)
  // ===========================================================================
  const sx = toScreenX(player.x);
  const sy = toScreenY(player.y);
  const px = Math.max(1, zoom * 1.12);
  const isSide = player.dir === "left" || player.dir === "right";
  // Only mirror horizontally for "right"; keep "up" and "down" 100% straight and symmetrical!
  const sign = player.dir === "right" ? -1 : 1;
  const phi = player.moving ? player.walkCycle : 0;
  const idleBreath = !player.moving && Math.floor(nowMs / 520) % 2 === 1 ? -1 : 0;
  // Calm, natural human walking vertical glide (not a running bounce!)
  // Slightly stronger bob on vertical walks so up/down feels as lively as left/right
  const bobAmp = player.dir === "up" || player.dir === "down" ? 1.7 : 1.2;
  const bobY = player.moving ? Math.round(-Math.abs(Math.cos(phi)) * bobAmp) : idleBreath;
  const hairBounceY = player.moving ? Math.round(-Math.abs(Math.cos(phi - 0.55)) * (bobAmp > 1.2 ? 1.35 : 1.0)) : 0;

  // Integer Pixel Buffer (45 × 64) so every limb & body part renders as razor-sharp pixel art
  const GW = 45;
  const GH = 64;
  const GX0 = 22; // gx in [-22..22]
  const GY0 = 56; // gy in [-56..7]
  const bufR = new Uint8Array(GW * GH);
  const bufG = new Uint8Array(GW * GH);
  const bufB = new Uint8Array(GW * GH);
  const bufA = new Uint8Array(GW * GH);

  const putPx = (gx: number, gy: number, r: number, g: number, b: number) => {
    const ix = Math.round(gx) + GX0;
    const iy = Math.round(gy) + GY0;
    if (ix < 0 || ix >= GW || iy < 0 || iy >= GH) return;
    const idx = iy * GW + ix;
    bufR[idx] = r;
    bufG[idx] = g;
    bufB[idx] = b;
    bufA[idx] = 255;
  };

  const rectPx = (gx0: number, gy0: number, gw: number, gh: number, r: number, g: number, b: number) => {
    for (let y = gy0; y < gy0 + gh; y += 1) {
      for (let x = gx0; x < gx0 + gw; x += 1) {
        putPx(x, y, r, g, b);
      }
    }
  };

  // Seamless Multi-Joint Limb Chain Rasterizer (draws Hip->Knee->Ankle or Shoulder->Elbow->Wrist
  // with a continuous unbroken 1px dark outline, directional cel-shading, and optional knee/elbow highlight)
  const drawJointChain = (
    joints: Array<{ x: number; y: number; r: number }>,
    outCol: readonly [number, number, number],
    fillCol: readonly [number, number, number],
    hltCol: readonly [number, number, number],
    shdCol: readonly [number, number, number],
    lightDirX: number,
    lightDirY: number,
    highlightJointIdx = -1,
  ) => {
    let minX = 999;
    let maxX = -999;
    let minY = 999;
    let maxY = -999;
    for (const j of joints) {
      minX = Math.min(minX, Math.floor(j.x - j.r - 1));
      maxX = Math.max(maxX, Math.ceil(j.x + j.r + 1));
      minY = Math.min(minY, Math.floor(j.y - j.r - 1));
      maxY = Math.max(maxY, Math.ceil(j.y + j.r + 1));
    }

    for (let gy = minY; gy <= maxY; gy += 1) {
      for (let gx = minX; gx <= maxX; gx += 1) {
        let bestNorm = 999;
        let bestCx = gx;
        let bestCy = gy;
        let bestR = 1;

        for (let i = 0; i < joints.length - 1; i += 1) {
          const a = joints[i];
          const b = joints[i + 1];
          const vx = b.x - a.x;
          const vy = b.y - a.y;
          const lenSq = vx * vx + vy * vy;
          const t = lenSq > 0.0001 ? Math.max(0, Math.min(1, ((gx - a.x) * vx + (gy - a.y) * vy) / lenSq)) : 0;
          const cx = a.x + vx * t;
          const cy = a.y + vy * t;
          const r = a.r + (b.r - a.r) * t;
          const dist = Math.hypot(gx - cx, gy - cy);
          const norm = dist / r;
          if (norm < bestNorm) {
            bestNorm = norm;
            bestCx = cx;
            bestCy = cy;
            bestR = r;
          }
        }

        if (bestNorm <= 1.0) {
          const outThresh = 1.0 - 0.92 / Math.max(1.2, bestR);
          if (bestNorm >= outThresh) {
            putPx(gx, gy, outCol[0], outCol[1], outCol[2]);
          } else {
            const dot = (gx - bestCx) * lightDirX + (gy - bestCy) * lightDirY;
            const nearKnee =
              highlightJointIdx >= 0 &&
              Math.hypot(gx - joints[highlightJointIdx].x, gy - joints[highlightJointIdx].y) <= 1.45;
            if (nearKnee || dot > 0.25) {
              putPx(gx, gy, hltCol[0], hltCol[1], hltCol[2]);
            } else if (dot < -0.55) {
              putPx(gx, gy, shdCol[0], shdCol[1], shdCol[2]);
            } else {
              putPx(gx, gy, fillCol[0], fillCol[1], fillCol[2]);
            }
          }
        }
      }
    }
  };

  // Dynamic ground shadow & walking dust puffs under farmer's feet
  const strideSpread = player.moving && isSide ? Math.abs(Math.sin(phi)) * 4.5 : 0;
  ctx.fillStyle = "rgba(20, 34, 10, 0.42)";
  ctx.beginPath();
  ctx.ellipse(sx, sy + 2 * zoom, (10.5 + strideSpread) * zoom, 4.2 * zoom, 0, 0, Math.PI * 2);
  ctx.fill();

  if (player.moving) {
    // Animated footstep dust clouds trailing behind the pushing-off foot
    const stepPulse = Math.abs(Math.sin(phi));
    if (stepPulse > 0.65) {
      const trailX = isSide ? (player.dir === "left" ? 8 : -8) : Math.sin(phi) > 0 ? -3 : 3;
      const trailY = player.dir === "down" ? -4 : player.dir === "up" ? 2 : 1;
      ctx.fillStyle = `rgba(238, 226, 198, ${(stepPulse - 0.5) * 0.95})`;
      ctx.beginPath();
      ctx.arc(sx + trailX * px, sy + trailY * px, 2.4 * px, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Clean Hand-Crafted Color Palettes
  const OUT_DARK = [12, 14, 22] as const;
  // Denim-Slate Pants (Near leg vs Far leg depth contrast so both legs are unmistakably distinct!)
  const PANT_NEAR_HLT = [88, 114, 152] as const;
  const PANT_NEAR_MID = [54, 72, 102] as const;
  const PANT_NEAR_SHD = [34, 46, 68] as const;
  const PANT_FAR_HLT = [52, 68, 96] as const;
  const PANT_FAR_MID = [32, 44, 64] as const;
  const PANT_FAR_SHD = [20, 28, 42] as const;

  // Navy-Blue Hoodie Palette
  const HOOD_HLT = [64, 92, 142] as const;
  const HOOD_MID = [40, 60, 98] as const;
  const HOOD_SHD = [24, 36, 62] as const;
  const HOOD_FAR = [28, 42, 72] as const;

  // Warm Peach Skin Palette
  const SKIN_HLT = [255, 224, 194] as const;
  const SKIN_MID = [246, 202, 166] as const;
  const SKIN_SHD = [208, 158, 122] as const;

  // Spiky Crimson-Auburn Hair Palette
  const HAIR_OUT = [24, 8, 14] as const;
  const HAIR_SHD = [72, 16, 28] as const;
  const HAIR_MID = [118, 28, 42] as const;
  const HAIR_BRT = [156, 42, 58] as const;
  const HAIR_HLT = [192, 68, 84] as const;

  // ===========================================================================
  // UNIFIED PENDULUM ARM SWING ("melambai") & PENDULUM LEG STRIDE FOR ALL 4 DIRECTIONS
  // Both Left/Right and Up/Down use the exact same trigonometric pendulum equations
  // so walking Up/Down has the exact same smooth arm wave & leg stride as Left/Right!
  // ===========================================================================
  const drawPendulumArm = (armPhi: number, isFar: boolean, shOffsetX = 0) => {
    const s = player.moving ? Math.sin(armPhi) : 0;
    const shX = (isFar ? -1.0 : 0.4) + shOffsetX;
    const shY = -28 + bobY;
    // Upper arm swings ±40° on a true pendulum arc (-sin(theta) horizontally, +cos(theta) vertically);
    // Forearm bends naturally forward at the elbow so the arm waves ("melambai") and never pumps straight up/down!
    const thetaUpper = s * 0.72;
    const elbowX = shX - Math.sin(thetaUpper) * 6.0;
    const elbowY = shY + Math.cos(thetaUpper) * 6.0;
    const thetaFore = thetaUpper + 0.42 + Math.max(0, s) * 0.34;
    const wristX = elbowX - Math.sin(thetaFore) * 5.6;
    const wristY = elbowY + Math.cos(thetaFore) * 5.6;

    drawJointChain(
      [
        { x: shX, y: shY, r: 2.3 },
        { x: elbowX, y: elbowY, r: 2.1 },
        { x: wristX, y: wristY, r: 1.9 },
      ],
      OUT_DARK,
      isFar ? HOOD_FAR : HOOD_MID,
      isFar ? HOOD_MID : HOOD_HLT,
      HOOD_SHD,
      -0.8,
      -0.6,
      1,
    );

    // Warm skin hand & fingers at wrist
    const hx = Math.round(wristX - Math.sin(thetaFore) * 1.2);
    const hy = Math.round(wristY + Math.cos(thetaFore) * 1.2);
    rectPx(hx - 2, hy - 1, 4, 4, OUT_DARK[0], OUT_DARK[1], OUT_DARK[2]);
    rectPx(
      hx - 1,
      hy,
      2,
      2,
      isFar ? SKIN_SHD[0] : SKIN_MID[0],
      isFar ? SKIN_SHD[1] : SKIN_MID[1],
      isFar ? SKIN_SHD[2] : SKIN_MID[2],
    );
    putPx(hx - 1, hy, SKIN_HLT[0], SKIN_HLT[1], SKIN_HLT[2]);
  };

  const drawPendulumLegAndSneaker = (
    legPhi: number,
    isFar: boolean,
    hipOffsetX = 0,
    stepDepthY = 0,
  ) => {
    const s = player.moving ? Math.sin(legPhi) : isFar ? -0.14 : 0.14;
    const c = player.moving ? Math.cos(legPhi) : -1;

    // 1. Hip -> Knee -> Ankle Pendulum Kinematics (identical smooth walking gait in all 4 directions!)
    const hipX = -s * 1.2 + (isFar ? 0.6 : 0) + hipOffsetX;
    const hipY = -16 + bobY + s * stepDepthY;

    // Thigh swings wide forward (+42°) and backward (-37°), lifting smoothly during the passing phase (c > 0)
    const thetaThigh = s * 0.68 + Math.max(0, c) * 0.26;
    const L1 = 7.6;
    const kneeX = hipX - Math.sin(thetaThigh) * L1;
    const kneeY = hipY + Math.cos(thetaThigh) * L1;

    // Human knee flexes backward (up to 62° = 1.08 rad) as the foot lifts from back to front during swing phase!
    const kneeBend = player.moving
      ? Math.max(0, Math.cos(legPhi - 0.28)) * 1.08 + (s < 0 ? -s * 0.16 : 0)
      : 0.05;
    const thetaCalf = thetaThigh - kneeBend;
    const L2 = 7.4;
    const ankleX = kneeX - Math.sin(thetaCalf) * L2;
    const ankleY = Math.min(-1 + s * stepDepthY, kneeY + Math.cos(thetaCalf) * L2);

    drawJointChain(
      [
        { x: hipX, y: hipY, r: 2.8 },
        { x: kneeX, y: kneeY, r: 2.4 },
        { x: ankleX, y: ankleY, r: 2.1 },
      ],
      OUT_DARK,
      isFar ? PANT_FAR_MID : PANT_NEAR_MID,
      isFar ? PANT_FAR_HLT : PANT_NEAR_HLT,
      isFar ? PANT_FAR_SHD : PANT_NEAR_SHD,
      -0.85,
      -0.4,
      1, // Highlight the knee joint so knee flexion is unmistakably clear!
    );

    // 2. Articulated Sneaker at Ankle (tilts toe up on heel-strike, tilts heel up on toe-off)
    const footAngle =
      !player.moving
        ? 0
        : c > 0.25
          ? thetaCalf * 0.55 // Tilted in mid-air with the bent calf
          : s > 0.45
            ? 0.32 // Heel-strike: toe angled UP!
            : s < -0.45
              ? -0.35 // Toe-off: heel lifted UP!
              : 0;

    const ax = ankleX;
    const ay = ankleY;
    const cosF = Math.cos(footAngle);
    const sinF = Math.sin(footAngle);
    const rotFootPx = (lx: number, ly: number, r: number, g: number, b: number) => {
      const rx = ax + lx * cosF - ly * sinF;
      const ry = ay + lx * sinF + ly * cosF;
      putPx(rx, ry, r, g, b);
    };

    // Sneaker silhouette in local foot space (lx = -5..+2 where -5 is toe tip, ly = -2..+2 where +2 is rubber sole)
    for (let ly = -2; ly <= 2; ly += 1) {
      const xMin = ly >= 0 ? -5 : -4;
      const xMax = 2;
      for (let lx = xMin; lx <= xMax; lx += 1) {
        const isBorder = lx === xMin || lx === xMax || ly === -2;
        if (ly === 2) {
          // Thick bright white rubber sneaker sole (#f4f7fb) — high contrast against ground!
          rotFootPx(lx, ly, isFar ? 195 : 246, isFar ? 202 : 249, isFar ? 214 : 255);
        } else if (ly === 1 && lx <= -3) {
          // White rubber toe-cap bumper at front of sneaker
          rotFootPx(lx, ly, isFar ? 185 : 236, isFar ? 192 : 242, isFar ? 206 : 250);
        } else if (isBorder) {
          rotFootPx(lx, ly, OUT_DARK[0], OUT_DARK[1], OUT_DARK[2]);
        } else if (ly === -1 && lx <= -2) {
          // Crimson-red sneaker tongue & white laces
          if (lx === -2) rotFootPx(lx, ly, 186, 42, 54);
          else rotFootPx(lx, ly, 232, 238, 248);
        } else {
          // Navy-charcoal sneaker upper
          rotFootPx(lx, ly, isFar ? 34 : 52, isFar ? 44 : 66, isFar ? 64 : 92);
        }
      }
    }
  };

  if (isSide) {
    // LAYER 1: Far Arm (behind torso, swinging on pendulum arc)
    drawPendulumArm(phi, true, 0);

    // LAYER 2: Far Leg (behind near leg)
    drawPendulumLegAndSneaker(phi + Math.PI, true, 0, 0);

    // LAYER 3: Side-Profile Navy-Blue Hoodie Torso (gy = -31..-15)
    const leanX = player.moving ? -1 : 0;
    drawJointChain(
      [
        { x: leanX, y: -30 + bobY, r: 4.6 },
        { x: 0, y: -23 + bobY, r: 5.0 },
        { x: 0, y: -17 + bobY, r: 4.6 },
      ],
      OUT_DARK,
      HOOD_MID,
      HOOD_HLT,
      HOOD_SHD,
      -0.85,
      -0.3,
    );
    // Folded navy hood draped behind the neck (gx = +1..+6, gy = -32..-26)
    rectPx(1 + leanX, -32 + bobY, 6, 6, OUT_DARK[0], OUT_DARK[1], OUT_DARK[2]);
    rectPx(2 + leanX, -31 + bobY, 4, 4, HOOD_MID[0], HOOD_MID[1], HOOD_MID[2]);
    rectPx(2 + leanX, -31 + bobY, 2, 3, HOOD_HLT[0], HOOD_HLT[1], HOOD_HLT[2]);
    // White hoodie drawstring dangling on front chest (-X side)
    const swayStr = player.moving ? Math.round(Math.sin(phi) * 1.2) : 0;
    putPx(-3 + leanX, -29 + bobY, 238, 242, 248);
    putPx(-3 + leanX + swayStr, -27 + bobY, 238, 242, 248);
    putPx(-3 + leanX + swayStr, -26 + bobY, 212, 218, 228);
    // Ribbed waist hem & front kangaroo pocket seam
    for (let x = -4; x <= 4; x += 1) {
      putPx(x, -16 + bobY, HOOD_SHD[0], HOOD_SHD[1], HOOD_SHD[2]);
    }

    // LAYER 4: Near Leg (in front, bright denim-slate highlight + crisp knee bend)
    drawPendulumLegAndSneaker(phi, false, 0, 0);

    // LAYER 5: Near Arm (swings across side of torso in counter-phase to Near Leg)
    drawPendulumArm(phi + Math.PI, false, 0);

    // LAYER 6: Clean Hand-Crafted Side-Profile Head, Face & Spiky Crimson Hair
    const hx = leanX;
    const hy = bobY;
    // Neck
    rectPx(hx - 2, -33 + hy, 4, 3, SKIN_SHD[0], SKIN_SHD[1], SKIN_SHD[2]);
    // Side head cranium & jawline (gx = -6..+4, gy = -45..-33)
    for (let gy = -45; gy <= -33; gy += 1) {
      const xMin = gy <= -42 ? -5 : -6;
      const xMax = gy <= -35 ? 4 : 2;
      for (let gx = xMin; gx <= xMax; gx += 1) {
        if (gx === xMin || gx === xMax || gy === -33) {
          putPx(hx + gx, gy + hy, OUT_DARK[0], OUT_DARK[1], OUT_DARK[2]);
        } else if (gx <= -3) {
          putPx(hx + gx, gy + hy, SKIN_HLT[0], SKIN_HLT[1], SKIN_HLT[2]);
        } else if (gx <= 0) {
          putPx(hx + gx, gy + hy, SKIN_MID[0], SKIN_MID[1], SKIN_MID[2]);
        } else {
          putPx(hx + gx, gy + hy, SKIN_SHD[0], SKIN_SHD[1], SKIN_SHD[2]);
        }
      }
    }
    // Side-profile nose tip jutting forward at gx = -7, gy = -37..-36
    putPx(hx - 8, -37 + hy, OUT_DARK[0], OUT_DARK[1], OUT_DARK[2]);
    putPx(hx - 7, -37 + hy, SKIN_HLT[0], SKIN_HLT[1], SKIN_HLT[2]);
    putPx(hx - 7, -36 + hy, SKIN_SHD[0], SKIN_SHD[1], SKIN_SHD[2]);
    // Expressive side-profile anime eye looking forward (-X)
    rectPx(hx - 5, -39 + hy, 3, 1, HAIR_OUT[0], HAIR_OUT[1], HAIR_OUT[2]); // Eyebrow & upper lash
    putPx(hx - 5, -38 + hy, 128, 28, 38); // Crimson iris
    putPx(hx - 4, -38 + hy, 250, 252, 255); // White sclera/catchlight
    putPx(hx - 5, -37 + hy, 42, 14, 22);
    putPx(hx - 4, -37 + hy, 232, 236, 244);
    // Side ear (gx = 0..1, gy = -38..-36)
    rectPx(hx, -38 + hy, 2, 3, SKIN_MID[0], SKIN_MID[1], SKIN_MID[2]);
    putPx(hx + 1, -37 + hy, SKIN_SHD[0], SKIN_SHD[1], SKIN_SHD[2]);

    // Dynamic Spiky Crimson-Auburn Hair (with secondary hairBounceY follow-through!)
    const hby = hy + hairBounceY;
    const sideHairSpikes: Array<[number, number, number, number, readonly [number, number, number]]> = [
      // Crown & top spikes
      [-6, -49, 11, 5, HAIR_OUT],
      [-4, -51, 7, 3, HAIR_OUT],
      [-2, -52, 4, 2, HAIR_OUT],
      // Forward-sweeping bangs over forehead (-X)
      [-9, -45, 5, 4, HAIR_OUT],
      [-10, -43, 4, 3, HAIR_OUT],
      [-8, -41, 3, 2, HAIR_OUT],
      // Back-sweeping layered spikes (+X)
      [1, -47, 8, 5, HAIR_OUT],
      [2, -43, 9, 5, HAIR_OUT],
      [1, -39, 8, 5, HAIR_OUT],
      [1, -35, 6, 4, HAIR_OUT],
    ];
    for (const [x0, y0, w, h] of sideHairSpikes) {
      rectPx(hx + x0, y0 + hby, w, h, HAIR_OUT[0], HAIR_OUT[1], HAIR_OUT[2]);
      if (w > 2 && h > 2) {
        rectPx(hx + x0 + 1, y0 + 1 + hby, w - 2, h - 2, HAIR_MID[0], HAIR_MID[1], HAIR_MID[2]);
      }
    }
    // Crisp crimson & ruby highlight tufts inside hair
    rectPx(hx - 5, -48 + hby, 8, 3, HAIR_BRT[0], HAIR_BRT[1], HAIR_BRT[2]);
    rectPx(hx - 3, -50 + hby, 5, 2, HAIR_HLT[0], HAIR_HLT[1], HAIR_HLT[2]);
    rectPx(hx - 8, -44 + hby, 4, 2, HAIR_BRT[0], HAIR_BRT[1], HAIR_BRT[2]);
    rectPx(hx + 2, -46 + hby, 5, 3, HAIR_BRT[0], HAIR_BRT[1], HAIR_BRT[2]);
    rectPx(hx + 3, -42 + hby, 6, 3, HAIR_MID[0], HAIR_MID[1], HAIR_MID[2]);
    rectPx(hx + 2, -38 + hby, 5, 3, HAIR_SHD[0], HAIR_SHD[1], HAIR_SHD[2]);
    // Sideburn in front of ear
    rectPx(hx - 1, -42 + hby, 2, 5, HAIR_MID[0], HAIR_MID[1], HAIR_MID[2]);
  } else {
    // =========================================================================
    // FRONT ("down") & BACK ("up") WALK — MATCHING THE EXACT ORGANIC SPIKY HAIR,
    // ROUNDED TORSO, BENT-ELBOW ARM SWING, AND CLEAR KNEE-BEND STRIDE OF SIDE VIEW!
    // =========================================================================
    const isUp = player.dir === "up";
    const swayX = player.moving ? Math.sin(phi) * 0.7 : 0;
    const tx = Math.round(swayX);

    // 1. Articulated Left & Right Arms with True Pendulum Wave ("melambai" via sin/cos, NOT vertical piston pumping!)
    const drawFrontBackArm = (isLeft: boolean) => {
      const side = isLeft ? -1 : 1;
      // Both arms wave in graceful counter-phase pendulum arcs using the EXACT same sin(theta)/cos(theta) physics as Side View!
      const s = player.moving ? (isUp ? -Math.sin(phi) : Math.sin(phi)) : 0;
      const isFore = side * s >= 0;

      const shX = side * 4.8 + swayX;
      const shY = -28 + bobY;
      // True pendulum angle (`thetaUpper`, `thetaFore`): horizontal wave (`Math.sin`) with natural constant arm length (`Math.cos`)
      // so hands wave smoothly ("melambai") and NEVER pump up and down!
      // Stronger pendulum (closer to side-view energy) while keeping constant arm length
      const thetaUpper = s * 0.62 + side * 0.18;
      const elbowX = shX + Math.sin(thetaUpper) * 5.8;
      const elbowY = shY + Math.cos(thetaUpper) * 5.8;

      const thetaFore = s * 0.72 + side * 0.12;
      const wristX = elbowX + Math.sin(thetaFore) * 5.4;
      const wristY = elbowY + Math.cos(thetaFore) * 5.4;

      drawJointChain(
        [
          { x: shX, y: shY, r: 2.1 },
          { x: elbowX, y: elbowY, r: 1.9 },
          { x: wristX, y: wristY, r: 1.8 },
        ],
        OUT_DARK,
        isFore ? HOOD_MID : HOOD_FAR,
        isFore ? HOOD_HLT : HOOD_MID,
        HOOD_SHD,
        -side * 0.75,
        -0.55,
        1, // Highlight the elbow joint just like in Side View!
      );

      // Outlined 4×4 warm peach hand at the wrist (matching Side View hand!)
      const hx = Math.round(wristX + Math.sin(thetaFore) * 1.0);
      const hy = Math.round(wristY + Math.cos(thetaFore) * 1.0);
      rectPx(hx - 2, hy - 1, 4, 4, OUT_DARK[0], OUT_DARK[1], OUT_DARK[2]);
      rectPx(
        hx - 1,
        hy,
        2,
        2,
        isFore ? SKIN_MID[0] : SKIN_SHD[0],
        isFore ? SKIN_MID[1] : SKIN_SHD[1],
        isFore ? SKIN_MID[2] : SKIN_SHD[2],
      );
      putPx(hx - 1, hy, SKIN_HLT[0], SKIN_HLT[1], SKIN_HLT[2]);
    };

    // 2. Articulated Left & Right Legs with Level Hip Line, Pendulum Stride, and Clean Sneakers
    const drawFrontBackLeg = (isLeft: boolean) => {
      const side = isLeft ? -1 : 1;
      const legPhi = isLeft ? phi : phi + Math.PI;
      const rawS = player.moving ? Math.sin(legPhi) : 0;
      const rawC = player.moving ? Math.cos(legPhi) : -1;
      const s = isUp ? -rawS : rawS;
      const lift = player.moving ? Math.max(0, rawC) : 0; // Smooth passing-phase knee bend & lift (just like Side View `c > 0`!)

      // Both hips start evenly under the hoodie hem (`hipY = -16 + bobY`) so one thigh never pokes up into the stomach!
      const hipX = side * 3.2 + swayX * 0.45;
      const hipY = -16.0 + bobY;
      // Wider thigh swing (was 0.22). Closer to side-view, adapted for front/back.
      const thetaThigh = s * 0.58 + Math.max(0, lift) * 0.22 + side * 0.03;
      const L1 = 7.4;
      const kneeX = hipX + Math.sin(thetaThigh) * L1 * 0.55;
      const kneeY = hipY + Math.cos(thetaThigh) * L1 - lift * 2.4;
      const kneeBend = player.moving
        ? Math.max(0, Math.cos(legPhi - 0.28)) * 0.85 + (s < 0 ? -s * 0.12 : 0)
        : 0.04;
      const thetaCalf = thetaThigh - kneeBend;
      const L2 = 7.2;
      const ankleX = kneeX + Math.sin(thetaCalf) * (isUp ? -0.8 : 0.8) * Math.abs(s);
      const ankleY = Math.min(-1.2, kneeY + Math.cos(thetaCalf) * L2 - lift * 1.8);

      const isNearLeg = s >= 0;

      // Draw Hip -> Knee -> Ankle with continuous 1px outline & bright knee highlight
      drawJointChain(
        [
          { x: hipX, y: hipY, r: 2.3 },
          { x: kneeX, y: kneeY, r: 2.1 },
          { x: ankleX, y: ankleY, r: 1.9 },
        ],
        OUT_DARK,
        isNearLeg ? PANT_NEAR_MID : PANT_FAR_MID,
        isNearLeg ? PANT_NEAR_HLT : PANT_FAR_HLT,
        isNearLeg ? PANT_NEAR_SHD : PANT_FAR_SHD,
        -side * 0.7,
        -0.6,
        1, // Highlight the knee joint just like in Side View!
      );

      // Articulated Sneaker at (ankleX, ankleY)
      const bx = Math.round(ankleX);
      const by = Math.round(ankleY);
      if (lift > 0.35) {
        // Lifted Foot in passing phase: raised sneaker with white rubber sole rim & tread
        rectPx(bx - 3, by - 2, 6, 4, OUT_DARK[0], OUT_DARK[1], OUT_DARK[2]);
        rectPx(bx - 2, by - 1, 4, 2, 238, 244, 252);
        rectPx(bx - 1, by, 2, 1, 38, 44, 56);
      } else {
        // Planted / Striding Foot: full sneaker with crimson tongue/heel-tab, white toe-cap, and bright white rubber sole
        rectPx(bx - 3, by - 2, 6, 4, OUT_DARK[0], OUT_DARK[1], OUT_DARK[2]);
        rectPx(bx - 2, by - 1, 4, 2, isNearLeg ? 52 : 38, isNearLeg ? 68 : 50, isNearLeg ? 96 : 74);
        putPx(bx, by - 1, 186, 42, 54); // Crimson tongue (front) or heel-tab (back)
        if (!isUp) {
          rectPx(bx - 2, by, 4, 1, 234, 240, 250); // White toe-cap bumper
        }
        // Thick bright white rubber sole at bottom
        rectPx(bx - 3, by + 1, 6, 1, isNearLeg ? 246 : 210, isNearLeg ? 249 : 216, isNearLeg ? 255 : 228);
      }
    };

    const leftLegNear = (isUp ? -Math.sin(phi) : Math.sin(phi)) >= 0;

    // LAYER 1: Far Leg & Near Leg (both drawn cleanly below the hoodie hem so the waist never splits lopsidedly!)
    drawFrontBackLeg(!leftLegNear);
    drawFrontBackLeg(leftLegNear);

    // LAYER 2: Organic Rounded Navy-Blue Hoodie Torso using `drawJointChain` with a level waist hem at gy = -15
    drawJointChain(
      [
        { x: tx - 2.4, y: -28 + bobY, r: 3.4 },
        { x: tx + 2.4, y: -28 + bobY, r: 3.4 },
      ],
      OUT_DARK,
      HOOD_MID,
      HOOD_HLT,
      HOOD_SHD,
      -0.6,
      -0.7,
    );
    drawJointChain(
      [
        { x: tx, y: -28 + bobY, r: 5.0 },
        { x: tx, y: -23 + bobY, r: 4.8 },
        { x: tx, y: -19 + bobY, r: 4.5 },
      ],
      OUT_DARK,
      HOOD_MID,
      HOOD_HLT,
      HOOD_SHD,
      -0.75,
      -0.4,
    );
    // Level ribbed waist hem seam across bottom of hoodie
    for (let gx = -4; gx <= 4; gx += 1) {
      putPx(tx + gx, -16 + bobY, HOOD_SHD[0], HOOD_SHD[1], HOOD_SHD[2]);
      putPx(tx + gx, -15 + bobY, OUT_DARK[0], OUT_DARK[1], OUT_DARK[2]);
    }

    if (!isUp) {
      // Front V-neck collar, white hoodie drawstrings & kangaroo pocket seam
      rectPx(tx - 2, -31 + bobY, 4, 2, SKIN_SHD[0], SKIN_SHD[1], SKIN_SHD[2]);
      const swayStr = player.moving ? Math.round(Math.sin(phi) * 0.9) : 0;
      for (let dy = -29; dy <= -25; dy += 1) {
        putPx(tx - 2 + (dy <= -27 ? 0 : swayStr), dy + bobY, 240, 244, 250);
        putPx(tx + 2 + (dy <= -27 ? 0 : swayStr), dy + bobY, 240, 244, 250);
      }
      for (let gx = -3; gx <= 3; gx += 1) {
        putPx(tx + gx, -21 + bobY, HOOD_SHD[0], HOOD_SHD[1], HOOD_SHD[2]);
      }
    } else {
      // Rounded 3D Back Hoodie Hood draped on upper back (using `drawJointChain` so it's organic, not boxy!)
      drawJointChain(
        [
          { x: tx - 1.5, y: -30 + bobY, r: 3.2 },
          { x: tx + 1.5, y: -30 + bobY, r: 3.2 },
          { x: tx, y: -25 + bobY, r: 3.6 },
        ],
        OUT_DARK,
        HOOD_MID,
        HOOD_HLT,
        HOOD_SHD,
        -0.7,
        -0.5,
      );
    }

    // LAYER 3: Both Left & Right Arms swinging with true pendulum wave (`sin/cos`) along the sides of the torso
    drawFrontBackArm(true);
    drawFrontBackArm(false);

    // LAYER 6: Clean Neck, Head & Multi-Tuft Spiky Crimson-Auburn Hair (matching Side View's exact spiky style!)
    const hy = bobY;
    const hby = bobY + hairBounceY;
    // Clean 4×3 warm neck (no stray yellow corner pixels!)
    rectPx(tx - 2, -33 + hy, 4, 3, SKIN_SHD[0], SKIN_SHD[1], SKIN_SHD[2]);

    if (!isUp) {
      // Front Face & Jawline (gy = -44..-33)
      for (let gy = -44; gy <= -33; gy += 1) {
        const hw = gy >= -34 ? 4 : gy >= -36 ? 5 : 6;
        for (let gx = -hw; gx <= hw; gx += 1) {
          if (Math.abs(gx) === hw || gy === -33) {
            putPx(tx + gx, gy + hy, OUT_DARK[0], OUT_DARK[1], OUT_DARK[2]);
          } else if (gx <= -2) {
            putPx(tx + gx, gy + hy, SKIN_HLT[0], SKIN_HLT[1], SKIN_HLT[2]);
          } else if (gx >= 3 || gy === -34) {
            putPx(tx + gx, gy + hy, SKIN_SHD[0], SKIN_SHD[1], SKIN_SHD[2]);
          } else {
            putPx(tx + gx, gy + hy, SKIN_MID[0], SKIN_MID[1], SKIN_MID[2]);
          }
        }
      }
      // Front ears
      rectPx(tx - 7, -38 + hy, 2, 3, SKIN_SHD[0], SKIN_SHD[1], SKIN_SHD[2]);
      rectPx(tx + 6, -38 + hy, 2, 3, SKIN_SHD[0], SKIN_SHD[1], SKIN_SHD[2]);

      // Expressive Front Anime Eyes (gx = -4..-2 and +2..+4, gy = -38..-36)
      for (const ex of [-4, 2]) {
        rectPx(tx + ex, -39 + hy, 3, 1, HAIR_OUT[0], HAIR_OUT[1], HAIR_OUT[2]);
        putPx(tx + ex, -38 + hy, 250, 252, 255);
        putPx(tx + ex + 1, -38 + hy, 128, 28, 38);
        putPx(tx + ex + 2, -38 + hy, 32, 12, 18);
        putPx(tx + ex, -37 + hy, 232, 236, 244);
        putPx(tx + ex + 1, -37 + hy, 88, 18, 28);
        putPx(tx + ex + 2, -37 + hy, 128, 28, 38);
      }
      // Subtle nose & confident smile
      putPx(tx, -36 + hy, SKIN_SHD[0], SKIN_SHD[1], SKIN_SHD[2]);
      putPx(tx - 1, -34 + hy, 148, 78, 68);
      putPx(tx, -34 + hy, 148, 78, 68);

      // Organic Spiky Crimson-Auburn Crown & Parted Bangs (matching Side View's tuft construction!)
      const frontSpikes: Array<[number, number, number, number]> = [
        [-6, -49, 13, 5],
        [-4, -51, 9, 3],
        [-2, -52, 5, 2],
        [-9, -46, 5, 4],
        [5, -46, 5, 4],
        [-10, -42, 4, 4],
        [7, -42, 4, 4],
        [-8, -39, 3, 4],
        [6, -39, 3, 4],
        // Forehead spiky bangs
        [-5, -43, 3, 4],
        [-1, -44, 3, 5],
        [3, -43, 3, 4],
      ];
      for (const [x0, y0, w, h] of frontSpikes) {
        rectPx(tx + x0, y0 + hby, w, h, HAIR_OUT[0], HAIR_OUT[1], HAIR_OUT[2]);
        if (w > 2 && h > 2) {
          rectPx(tx + x0 + 1, y0 + 1 + hby, w - 2, h - 2, HAIR_MID[0], HAIR_MID[1], HAIR_MID[2]);
        }
      }
      rectPx(tx - 5, -48 + hby, 11, 3, HAIR_BRT[0], HAIR_BRT[1], HAIR_BRT[2]);
      rectPx(tx - 3, -50 + hby, 7, 2, HAIR_HLT[0], HAIR_HLT[1], HAIR_HLT[2]);
      rectPx(tx - 8, -45 + hby, 3, 2, HAIR_BRT[0], HAIR_BRT[1], HAIR_BRT[2]);
      rectPx(tx + 6, -45 + hby, 3, 2, HAIR_BRT[0], HAIR_BRT[1], HAIR_BRT[2]);
      putPx(tx - 4, -41 + hby, HAIR_BRT[0], HAIR_BRT[1], HAIR_BRT[2]);
      putPx(tx, -41 + hby, HAIR_BRT[0], HAIR_BRT[1], HAIR_BRT[2]);
      putPx(tx + 4, -41 + hby, HAIR_BRT[0], HAIR_BRT[1], HAIR_BRT[2]);
    } else {
      // Back View ("up"): Organic Multi-Tuft Spiky Crimson-Auburn Hair (NO rectangular box or polka-dots!)
      // Warm ears peeking slightly on left & right sides of head
      rectPx(tx - 7, -38 + hy, 2, 3, SKIN_MID[0], SKIN_MID[1], SKIN_MID[2]);
      rectPx(tx + 6, -38 + hy, 2, 3, SKIN_SHD[0], SKIN_SHD[1], SKIN_SHD[2]);

      const backHairSpikes: Array<[number, number, number, number]> = [
        // Top crown spikes
        [-2, -52, 5, 3],
        [-5, -51, 11, 4],
        [-7, -49, 15, 5],
        // Upper left & right fanning spikes
        [-10, -46, 6, 4],
        [5, -46, 6, 4],
        // Middle left & right bold anime spikes jutting outward
        [-11, -42, 6, 5],
        [6, -42, 6, 5],
        // Center back hair mass
        [-7, -45, 15, 11],
        // Lower left & right spikes tapering toward nape
        [-9, -38, 5, 4],
        [5, -38, 5, 4],
        // Nape spikes above hood collar
        [-6, -35, 13, 4],
      ];
      for (const [x0, y0, w, h] of backHairSpikes) {
        rectPx(tx + x0, y0 + hby, w, h, HAIR_OUT[0], HAIR_OUT[1], HAIR_OUT[2]);
        if (w > 2 && h > 2) {
          rectPx(tx + x0 + 1, y0 + 1 + hby, w - 2, h - 2, HAIR_MID[0], HAIR_MID[1], HAIR_MID[2]);
        }
      }
      // Clean solid cel-shaded crimson & ruby layers matching Side View (`media_1793044885723_7e9063e9.png`)!
      rectPx(tx - 3, -50 + hby, 7, 2, HAIR_HLT[0], HAIR_HLT[1], HAIR_HLT[2]);
      rectPx(tx - 6, -48 + hby, 13, 3, HAIR_BRT[0], HAIR_BRT[1], HAIR_BRT[2]);
      rectPx(tx - 8, -45 + hby, 4, 2, HAIR_BRT[0], HAIR_BRT[1], HAIR_BRT[2]);
      rectPx(tx + 5, -45 + hby, 4, 2, HAIR_BRT[0], HAIR_BRT[1], HAIR_BRT[2]);
      rectPx(tx - 9, -41 + hby, 4, 3, HAIR_MID[0], HAIR_MID[1], HAIR_MID[2]);
      rectPx(tx + 6, -41 + hby, 4, 3, HAIR_MID[0], HAIR_MID[1], HAIR_MID[2]);
      rectPx(tx - 5, -44 + hby, 11, 5, HAIR_MID[0], HAIR_MID[1], HAIR_MID[2]);
      rectPx(tx - 3, -44 + hby, 7, 2, HAIR_BRT[0], HAIR_BRT[1], HAIR_BRT[2]);
      // Lower nape shadow band & V-tuft dark separators
      rectPx(tx - 6, -38 + hby, 13, 3, HAIR_SHD[0], HAIR_SHD[1], HAIR_SHD[2]);
      rectPx(tx - 5, -34 + hby, 11, 2, HAIR_SHD[0], HAIR_SHD[1], HAIR_SHD[2]);
      putPx(tx - 4, -40 + hby, HAIR_OUT[0], HAIR_OUT[1], HAIR_OUT[2]);
      putPx(tx, -39 + hby, HAIR_OUT[0], HAIR_OUT[1], HAIR_OUT[2]);
      putPx(tx + 4, -40 + hby, HAIR_OUT[0], HAIR_OUT[1], HAIR_OUT[2]);
    }
  }

  // Flush the 45×64 integer pixel buffer onto the viewport canvas
  const cellW = Math.ceil(px);
  for (let iy = 0; iy < GH; iy += 1) {
    for (let ix = 0; ix < GW; ix += 1) {
      const idx = iy * GW + ix;
      if (bufA[idx] === 0) continue;
      const gx = ix - GX0;
      const gy = iy - GY0;
      ctx.fillStyle = `rgb(${bufR[idx]},${bufG[idx]},${bufB[idx]})`;
      ctx.fillRect(
        Math.round(sx + gx * sign * px),
        Math.round(sy + gy * px),
        cellW,
        cellW,
      );
    }
  }

  // 3. Draw Floating Farmer Name Badge
  if (zoom >= 1.0) {
    const charH = Math.round(54 * px);
    ctx.save();
    ctx.font = "800 11px Nunito, sans-serif";
    const label = farmerName || "Petani Robin";
    const tw = ctx.measureText(label).width;
    const bx = sx - tw / 2 - 7;
    const by = sy - charH - 18;
    ctx.fillStyle = "rgba(36, 24, 15, 0.86)";
    ctx.strokeStyle = "#e7a02d";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(bx, by, tw + 14, 18, 9);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#fff8e8";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, sx, by + 9.5);
    ctx.restore();
  }

  // 4. Draw World Landmark Signposts when visible in viewport
  const landmarks = [
    { x: 560 + OX, y: -362 + OY, title: "Lumbung & Silo Utara" },
    { x: 540 + OX, y: 38 + OY, title: "Padang Ternak Sapi & Domba" },
    { x: -372 + OX, y: -22 + OY, title: "Rumah Petani" },
    { x: -35 + OX, y: 492 + OY, title: "Kawasan Lahan Pakan & Gandum" },
    { x: 140 + OX, y: 274 + OY, title: "Danau Koi & Bebek" },
    { x: 1590 + OX, y: 468 + OY, title: "Danau Hutan & Dermaga Timur" },
    { x: 1260 + OX, y: 42 + OY, title: "Kebun Buah Raya Timur" },
  ];
  ctx.save();
  ctx.font = "800 11px Nunito, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (const lm of landmarks) {
    const lx = toScreenX(lm.x);
    const ly = toScreenY(lm.y);
    if (lx < -120 || lx > ctx.canvas.width + 120 || ly < -60 || ly > ctx.canvas.height + 60) continue;
    const w = ctx.measureText(lm.title).width + 16;
    ctx.fillStyle = "rgba(46, 30, 18, 0.82)";
    ctx.strokeStyle = "#c98b43";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(lx - w / 2, ly - 10, w, 20, 6);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#f9ecd2";
    ctx.fillText(lm.title, lx, ly + 0.5);
  }
  ctx.restore();
}

export function VillageGround() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const minimapRef = useRef<HTMLCanvasElement>(null);
  const farmerName = useGame((state) => state.name);
  const [zoomUi, setZoomUi] = useState(175);
  const [followUi, setFollowUi] = useState(true);
  const [activeZone, setActiveZone] = useState("plaza");

  const playerRef = useRef<PlayerState>({
    x: 568 + OX,
    y: 336 + OY,
    dir: "left",
    facingSign: 1,
    phase: 0,
    walkCycle: 0,
    stepAccum: 0,
    moving: true,
    target: { x: FARMER_PATROL[0].x, y: FARMER_PATROL[0].y },
    patrolIdx: 0,
    idleTimer: 3.0,
  });

  const cameraRef = useRef<CameraState>({
    x: 568 + OX - 450,
    y: 336 + OY - 260,
    zoom: 1.75,
    follow: true,
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Offscreen 2800x1800 World Canvas for 60fps hardware-accelerated camera viewport blitting
    const worldCanvas = document.createElement("canvas");
    worldCanvas.width = WIDTH;
    worldCanvas.height = HEIGHT;
    const worldCtx = worldCanvas.getContext("2d");
    if (!worldCtx) return;

    const syncViewportSize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      ctx.imageSmoothingEnabled = false;
    };
    syncViewportSize();
    window.addEventListener("resize", syncViewportSize);

    const keys = new Set<string>();
    const onKeyDown = (e: KeyboardEvent) => {
      if (["INPUT", "TEXTAREA"].includes((e.target as HTMLElement)?.tagName)) return;
      const k = e.key.toLowerCase();
      if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright", "shift"].includes(k)) {
        if (k.startsWith("arrow")) e.preventDefault();
        keys.add(k);
        playerRef.current.idleTimer = 0;
        cameraRef.current.follow = true;
        setFollowUi(true);
      } else if (k === " ") {
        e.preventDefault();
        cameraRef.current.follow = true;
        setFollowUi(true);
      } else if (k === "=" || k === "+") {
        const next = Math.min(3.0, +(cameraRef.current.zoom + 0.2).toFixed(2));
        cameraRef.current.zoom = next;
        setZoomUi(Math.round(next * 100));
      } else if (k === "-") {
        const next = Math.max(0.85, +(cameraRef.current.zoom - 0.2).toFixed(2));
        cameraRef.current.zoom = next;
        setZoomUi(Math.round(next * 100));
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keys.delete(e.key.toLowerCase());
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    let animId = 0;
    const grass = new Image();
    grass.src = "/art/grass-field.png";
    grass.onload = () => {
      const baseImage = paint(worldCtx, grass);
      const frameImage = new ImageData(new Uint8ClampedArray(baseImage.data), WIDTH, HEIGHT);

      let fodder1 = 4;
      let fodder2 = 4;

      const nests: NestState[] = [
        // 1. Sarang Ayam Putih (hen1) di kandang ayam tengah-kiri
        { id: 1, x: 520, y: 122, kind: "chicken", eggs: 1, sparkleTimer: 0 },
        // 2. Sarang Ayam Kampung Cokelat (hen2) di kandang ayam tengah-kanan
        { id: 2, x: 584, y: 112, kind: "chicken", eggs: 2, sparkleTimer: 0 },
        // 3. Sarang Bebek 1 (duck1) di padang rumput kering utara kolam (jauh di atas bibir air)
        { id: 3, x: 124, y: 250, kind: "duck", eggs: 1, sparkleTimer: 0 },
        // 4. Sarang Bebek 2 (duck2) di padang rumput kering utara kolam sebelah kanan
        { id: 4, x: 172, y: 250, kind: "duck", eggs: 2, sparkleTimer: 0 },
      ];

      const animals: AnimalState[] = [
        // 1. Holstein Cow (upper-center pasture & Trough 1 — strictly axis-aligned waypoints)
        {
          id: "cow1",
          kind: "cow_holstein",
          x: 612,
          y: 68,
          dir: "left",
          mode: "walk",
          phase: 0,
          stepAccum: 0,
          biteAccum: 0,
          timerUntil: 0,
          wpIdx: 0,
          speed: 24,
          troughId: 1,
          waypoints: [
            { x: 568, y: 68, eatAfter: true, eatDir: "down" },
            { x: 632, y: 68 },
            { x: 632, y: 100 },
            { x: 536, y: 100, refillFodder: true },
            { x: 536, y: 68 },
          ],
        },
        // 2. Brown & White Dairy Cow (upper-left pasture & Trough 2 — strictly axis-aligned waypoints)
        {
          id: "cow2",
          kind: "cow_brown",
          x: 442,
          y: 68,
          dir: "right",
          mode: "walk",
          phase: 2,
          stepAccum: 0,
          biteAccum: 0,
          timerUntil: 0,
          wpIdx: 0,
          speed: 22,
          troughId: 2,
          waypoints: [
            { x: 468, y: 68, eatAfter: true, eatDir: "down" },
            { x: 508, y: 68 },
            { x: 508, y: 98 },
            { x: 434, y: 98, refillFodder: true },
            { x: 434, y: 68 },
          ],
        },
        // 3. Fluffy White Sheep (lower-left meadow — strictly axis-aligned rectangle)
        {
          id: "sheep1",
          kind: "sheep",
          x: 480,
          y: 114,
          dir: "left",
          mode: "walk",
          phase: 1,
          stepAccum: 0,
          biteAccum: 0,
          timerUntil: 0,
          wpIdx: 0,
          speed: 18,
          waypoints: [
            { x: 454, y: 114, eatAfter: true, eatDir: "left" },
            { x: 502, y: 114 },
            { x: 502, y: 134, eatAfter: true, eatDir: "down" },
            { x: 454, y: 134 },
          ],
        },
        // 4. Horned Farm Goat (upper-right meadow — strictly axis-aligned rectangle)
        {
          id: "goat1",
          kind: "goat",
          x: 660,
          y: 72,
          dir: "right",
          mode: "walk",
          phase: 3,
          stepAccum: 0,
          biteAccum: 0,
          timerUntil: 0,
          wpIdx: 0,
          speed: 21,
          waypoints: [
            { x: 694, y: 72, eatAfter: true, eatDir: "right" },
            { x: 694, y: 98 },
            { x: 652, y: 98, eatAfter: true, eatDir: "left" },
            { x: 652, y: 72 },
          ],
        },
        // 5. Pink Farm Pig (lower-right pen around pig bowl at 632, 134 — strictly axis-aligned rectangle)
        {
          id: "pig1",
          kind: "pig",
          x: 650,
          y: 124,
          dir: "left",
          mode: "walk",
          phase: 0,
          stepAccum: 0,
          biteAccum: 0,
          timerUntil: 0,
          wpIdx: 0,
          speed: 19,
          waypoints: [
            { x: 632, y: 124, eatAfter: true, eatDir: "down" },
            { x: 604, y: 124 },
            { x: 604, y: 146 },
            { x: 658, y: 146 },
            { x: 658, y: 124 },
          ],
        },
        // 6. White Laying Hen (eats at grain dish 552,134 and lays eggs in Nest 1 at 520,122)
        {
          id: "hen1",
          kind: "hen",
          x: 528,
          y: 122,
          dir: "left",
          mode: "walk",
          phase: 0,
          stepAccum: 0,
          biteAccum: 0,
          timerUntil: 0,
          wpIdx: 0,
          speed: 20,
          nestId: 1,
          waypoints: [
            { x: 520, y: 122, layEggAfter: true, eatDir: "right" },
            { x: 540, y: 122 },
            { x: 540, y: 134, eatAfter: true, eatDir: "right" },
            { x: 540, y: 148 },
            { x: 520, y: 148 },
          ],
        },
        // 7. Brown Kampung Laying Hen (eats at grain dish 552,134 and lays eggs in Nest 2 at 584,112)
        {
          id: "hen2",
          kind: "hen",
          x: 564,
          y: 126,
          dir: "down",
          mode: "walk",
          phase: 1,
          stepAccum: 0,
          biteAccum: 0,
          timerUntil: 0,
          wpIdx: 0,
          speed: 19,
          nestId: 2,
          waypoints: [
            { x: 564, y: 134, eatAfter: true, eatDir: "left" },
            { x: 584, y: 134 },
            { x: 584, y: 112, layEggAfter: true, eatDir: "left" },
            { x: 564, y: 112 },
          ],
        },
        // 8. Golden Rooster (patrols chicken yard around grain dish)
        {
          id: "rooster1",
          kind: "rooster",
          x: 576,
          y: 148,
          dir: "left",
          mode: "walk",
          phase: 2,
          stepAccum: 0,
          biteAccum: 0,
          timerUntil: 0,
          wpIdx: 0,
          speed: 22,
          waypoints: [
            { x: 552, y: 148, eatAfter: true, eatDir: "up" },
            { x: 552, y: 140 },
            { x: 588, y: 140 },
            { x: 588, y: 148, eatAfter: true, eatDir: "left" },
          ],
        },
        // 9. Pond Duck 1 (walks down from Nest 3 on north dry grass meadow into pond, swims continuously, then walks back up to Nest 3 to lay eggs)
        {
          id: "duck1",
          kind: "duck",
          x: 124,
          y: 262,
          dir: "down",
          mode: "walk",
          phase: 0,
          stepAccum: 0,
          biteAccum: 0,
          timerUntil: 0,
          wpIdx: 0,
          speed: 21,
          nestId: 3,
          waypoints: [
            { x: 124, y: 312 },
            { x: 92, y: 312 },
            { x: 92, y: 340 },
            { x: 144, y: 340 },
            { x: 144, y: 296 },
            { x: 124, y: 296 },
            { x: 124, y: 250, layEggAfter: true, eatDir: "down" },
          ],
        },
        // 10. Pond Duck 2 (swims in pond, walks up onto north dry grass meadow to Nest 4 to lay eggs, then walks back down into pond)
        {
          id: "duck2",
          kind: "duck",
          x: 172,
          y: 306,
          dir: "up",
          mode: "walk",
          phase: 2,
          stepAccum: 0,
          biteAccum: 0,
          timerUntil: 0,
          wpIdx: 0,
          speed: 20,
          nestId: 4,
          waypoints: [
            { x: 172, y: 250, layEggAfter: true, eatDir: "down" },
            { x: 172, y: 332 },
            { x: 116, y: 332 },
            { x: 116, y: 306 },
            { x: 186, y: 306 },
            { x: 186, y: 324 },
            { x: 172, y: 324 },
          ],
        },
        // 11. Anak Ayam 1 & 2 (berbaris mengikuti induk ayam putih hen1)
        {
          id: "chick1",
          kind: "chick",
          x: 540,
          y: 122,
          dir: "left",
          mode: "walk",
          phase: 0,
          stepAccum: 0,
          biteAccum: 0,
          timerUntil: 0,
          wpIdx: 0,
          speed: 20,
          parentId: "hen1",
          trailLag: 13,
          waypoints: [],
        },
        {
          id: "chick2",
          kind: "chick",
          x: 540,
          y: 132,
          dir: "up",
          mode: "walk",
          phase: 2,
          stepAccum: 0,
          biteAccum: 0,
          timerUntil: 0,
          wpIdx: 0,
          speed: 20,
          parentId: "hen1",
          trailLag: 22,
          waypoints: [],
        },
        // 12. Anak Ayam Cokelat 3 & 4 (berbaris mengikuti induk ayam cokelat hen2)
        {
          id: "chick3",
          kind: "chick",
          x: 564,
          y: 114,
          dir: "down",
          mode: "walk",
          phase: 1,
          stepAccum: 0,
          biteAccum: 0,
          timerUntil: 0,
          wpIdx: 0,
          speed: 19,
          parentId: "hen2",
          trailLag: 13,
          waypoints: [],
        },
        {
          id: "chick4",
          kind: "chick",
          x: 572,
          y: 112,
          dir: "left",
          mode: "walk",
          phase: 3,
          stepAccum: 0,
          biteAccum: 0,
          timerUntil: 0,
          wpIdx: 0,
          speed: 19,
          parentId: "hen2",
          trailLag: 22,
          waypoints: [],
        },
        // 13. Anak Bebek 1 & 2 (berbaris mengikuti induk bebek duck1 ke darat & berenang di kolam)
        {
          id: "duckling1",
          kind: "duckling",
          x: 124,
          y: 250,
          dir: "down",
          mode: "walk",
          phase: 1,
          stepAccum: 0,
          biteAccum: 0,
          timerUntil: 0,
          wpIdx: 0,
          speed: 21,
          parentId: "duck1",
          trailLag: 14,
          waypoints: [],
        },
        {
          id: "duckling2",
          kind: "duckling",
          x: 134,
          y: 250,
          dir: "left",
          mode: "walk",
          phase: 3,
          stepAccum: 0,
          biteAccum: 0,
          timerUntil: 0,
          wpIdx: 0,
          speed: 21,
          parentId: "duck1",
          trailLag: 23,
          waypoints: [],
        },
        // 14. Anak Bebek 3 & 4 (berbaris mengikuti induk bebek duck2 berenang di kolam & ke sarang)
        {
          id: "duckling3",
          kind: "duckling",
          x: 172,
          y: 320,
          dir: "up",
          mode: "walk",
          phase: 0,
          stepAccum: 0,
          biteAccum: 0,
          timerUntil: 0,
          wpIdx: 0,
          speed: 20,
          parentId: "duck2",
          trailLag: 14,
          waypoints: [],
        },
        {
          id: "duckling4",
          kind: "duckling",
          x: 180,
          y: 324,
          dir: "left",
          mode: "walk",
          phase: 2,
          stepAccum: 0,
          biteAccum: 0,
          timerUntil: 0,
          wpIdx: 0,
          speed: 20,
          parentId: "duck2",
          trailLag: 23,
          waypoints: [],
        },
        // 15. Anak Sapi Holstein (calf1 — mengikuti induk sapi Holstein cow1)
        {
          id: "calf1",
          kind: "calf_holstein",
          x: 632,
          y: 68,
          dir: "left",
          mode: "walk",
          phase: 1,
          stepAccum: 0,
          biteAccum: 0,
          timerUntil: 0,
          wpIdx: 0,
          speed: 24,
          parentId: "cow1",
          trailLag: 25,
          waypoints: [],
        },
        // 16. Anak Sapi Cokelat-Putih (calf2 — mengikuti induk sapi perah cokelat cow2)
        {
          id: "calf2",
          kind: "calf_brown",
          x: 434,
          y: 84,
          dir: "up",
          mode: "walk",
          phase: 3,
          stepAccum: 0,
          biteAccum: 0,
          timerUntil: 0,
          wpIdx: 0,
          speed: 22,
          parentId: "cow2",
          trailLag: 25,
          waypoints: [],
        },
      ];

      const fishes: PondFishState[] = [
        // 1. Koi Kohaku (Merah-Putih) — upper-middle pond loop
        {
          id: "fish1",
          kind: "koi_kohaku",
          x: 110,
          y: 306,
          dir: "right",
          mode: "swim",
          phase: 0,
          stepAccum: 0,
          speed: 22,
          wpIdx: 0,
          jumpProgress: 0,
          jumpDuration: 0.72,
          lastSplashX: 110,
          lastSplashY: 306,
          splashTimer: 0,
          waypoints: [
            { x: 126, y: 306, jumpHere: true },
            { x: 174, y: 306 },
            { x: 174, y: 324 },
            { x: 96, y: 324 },
            { x: 96, y: 306 },
          ],
        },
        // 2. Ikan Mas Oranye (Goldfish) — lower-middle pond loop
        {
          id: "fish2",
          kind: "goldfish",
          x: 172,
          y: 334,
          dir: "left",
          mode: "swim",
          phase: 2,
          stepAccum: 0,
          speed: 20,
          wpIdx: 0,
          jumpProgress: 0,
          jumpDuration: 0.74,
          lastSplashX: 172,
          lastSplashY: 334,
          splashTimer: 0,
          waypoints: [
            { x: 146, y: 334, jumpHere: true },
            { x: 88, y: 334 },
            { x: 88, y: 316 },
            { x: 176, y: 316 },
            { x: 176, y: 334 },
          ],
        },
        // 3. Koi Kuning Emas (Yamabuki) — center pond loop
        {
          id: "fish3",
          kind: "koi_gold",
          x: 92,
          y: 320,
          dir: "right",
          mode: "swim",
          phase: 1,
          stepAccum: 0,
          speed: 19,
          wpIdx: 0,
          jumpProgress: 0,
          jumpDuration: 0.70,
          lastSplashX: 92,
          lastSplashY: 320,
          splashTimer: 0,
          waypoints: [
            { x: 154, y: 320 },
            { x: 154, y: 344 },
            { x: 140, y: 344, jumpHere: true },
            { x: 98, y: 344 },
            { x: 98, y: 320 },
          ],
        },
        // 4. Koi Tricolor Showa (Merah-Hitam-Putih) — lower-right pond loop
        {
          id: "fish4",
          kind: "koi_showa",
          x: 126,
          y: 348,
          dir: "right",
          mode: "swim",
          phase: 3,
          stepAccum: 0,
          speed: 21,
          wpIdx: 0,
          jumpProgress: 0,
          jumpDuration: 0.72,
          lastSplashX: 126,
          lastSplashY: 348,
          splashTimer: 0,
          waypoints: [
            { x: 138, y: 348, jumpHere: true },
            { x: 182, y: 348 },
            { x: 182, y: 312 },
            { x: 124, y: 312 },
            { x: 124, y: 348 },
          ],
        },
      ];

      // Shift all nests, animals, and pond fishes into the expanded 1600x880 map coordinates
      for (const n of nests) {
        n.x += OX;
        n.y += OY;
      }
      for (const a of animals) {
        a.x += OX;
        a.y += OY;
        for (const wp of a.waypoints) {
          wp.x += OX;
          wp.y += OY;
        }
      }
      for (const f of fishes) {
        f.x += OX;
        f.y += OY;
        f.lastSplashX += OX;
        f.lastSplashY += OY;
        for (const wp of f.waypoints) {
          wp.x += OX;
          wp.y += OY;
        }
      }

      let lastTime = performance.now();
      const dirty = { x: 400 + OX, y: 40 + OY, w: 330, h: 130 };
      const pondDirty = { x: 44 + OX, y: 228 + OY, w: 210, h: 156 };
      // Bounding box covering all 4 fodder plots in the Western Agricultural Estate
      const cropDirty = { x: -332 + OX, y: 504 + OY, w: 586, h: 252 };

      const getMoveDir = (fromX: number, fromY: number, toX: number, toY: number): CowDir => {
        const dx = toX - fromX;
        const dy = toY - fromY;
        if (Math.abs(dx) >= Math.abs(dy)) {
          return dx >= 0 ? "right" : "left";
        }
        return dy >= 0 ? "down" : "up";
      };

      // Initialize orthogonal breadcrumb trail for parent cows, hens & ducks so calves/chicks/ducklings follow cleanly
      for (const a of animals) {
        if (
          a.id === "cow1" ||
          a.id === "cow2" ||
          a.id === "hen1" ||
          a.id === "hen2" ||
          a.id === "duck1" ||
          a.id === "duck2"
        ) {
          const trail: Array<{ x: number; y: number; dir: CowDir }> = [];
          let curX = a.x;
          let curY = a.y;
          let prevWpIdx = (a.wpIdx - 1 + a.waypoints.length) % a.waypoints.length;
          let curDir = a.dir;
          for (let i = 0; i < 40; i += 1) {
            trail.push({ x: curX, y: curY, dir: curDir });
            const prevWp = a.waypoints[prevWpIdx];
            const bdx = prevWp.x - curX;
            const bdy = prevWp.y - curY;
            const bdist = Math.hypot(bdx, bdy);
            if (bdist <= 1) {
              curX = prevWp.x;
              curY = prevWp.y;
              const nextWp = prevWp;
              prevWpIdx = (prevWpIdx - 1 + a.waypoints.length) % a.waypoints.length;
              curDir = getMoveDir(a.waypoints[prevWpIdx].x, a.waypoints[prevWpIdx].y, nextWp.x, nextWp.y);
            } else {
              curDir = getMoveDir(prevWp.x, prevWp.y, curX, curY);
              curX += bdx / bdist;
              curY += bdy / bdist;
            }
          }
          a.trail = trail;
        }
      }

      for (const a of animals) {
        if (a.parentId && a.trailLag) {
          const mom = animals.find((m) => m.id === a.parentId);
          if (mom?.trail) {
            const pt = mom.trail[Math.min(a.trailLag, mom.trail.length - 1)];
            a.x = pt.x;
            a.y = pt.y;
            a.dir = pt.dir;
          }
        }
      }

      drawFodderFieldScene(frameImage.data, lastTime);
      drawPondFishScene(frameImage.data, fishes);
      drawLivestockScene(frameImage.data, animals, nests, fodder1, fodder2);
      worldCtx.putImageData(frameImage, 0, 0);

      const tick = (now: number) => {
        const dt = Math.min(0.05, (now - lastTime) / 1000);
        lastTime = now;

        // 1. Update Playable Farmer Movement (WASD / Arrow Keys / Click-to-Walk / Auto-Stroll Patrol)
        const player = playerRef.current;
        const cam = cameraRef.current;
        let moveX = 0;
        let moveY = 0;
        if (keys.has("w") || keys.has("arrowup")) moveY -= 1;
        if (keys.has("s") || keys.has("arrowdown")) moveY += 1;
        if (keys.has("a") || keys.has("arrowleft")) moveX -= 1;
        if (keys.has("d") || keys.has("arrowright")) moveX += 1;

        const isAutoPatrol = moveX === 0 && moveY === 0 && player.idleTimer >= 2.2;
        const walkSpeed = keys.has("shift") ? 225 : isAutoPatrol ? 98 : 150;

        if (moveX !== 0 || moveY !== 0) {
          player.idleTimer = 0;
          const len = Math.hypot(moveX, moveY);
          const nx = moveX / len;
          const ny = moveY / len;
          const step = walkSpeed * dt;
          // Axis-separated collision so vertical walking slides along obstacles.
          const candX = Math.max(48, Math.min(WIDTH - 48, player.x + nx * step));
          const candY = Math.max(56, Math.min(HEIGHT - 48, player.y + ny * step));
          const footCell = (px: number, py: number) =>
            cellVal(Math.round(px) >> 2, Math.round(py) >> 2);
          if (footCell(candX, player.y) !== 3) {
            player.x = candX;
          }
          if (footCell(player.x, candY) !== 3) {
            player.y = candY;
          }
          // Project a smooth stride target 36px ahead so tapping or holding keys animates legs with the exact same smooth continuity as mouse-click!
          const aheadX = Math.max(48, Math.min(WIDTH - 48, player.x + nx * 36));
          const aheadY = Math.max(56, Math.min(HEIGHT - 48, player.y + ny * 36));
          if (footCell(aheadX, aheadY) !== 3) {
            player.target = { x: aheadX, y: aheadY };
          }
          if (moveX > 0) player.facingSign = -1;
          else if (moveX < 0) player.facingSign = 1;
          player.dir = Math.abs(moveX) >= Math.abs(moveY) ? (moveX > 0 ? "right" : "left") : moveY > 0 ? "down" : "up";
          player.moving = true;
        } else if (player.target) {
          const dx = player.target.x - player.x;
          const dy = player.target.y - player.y;
          const dist = Math.hypot(dx, dy);
          if (dist <= walkSpeed * dt || dist < 4) {
            player.x = player.target.x;
            player.y = player.target.y;
            if (player.idleTimer >= 2.2) {
              // Advance to next village patrol waypoint so the farmer keeps strolling naturally
              player.patrolIdx = (player.patrolIdx + 1) % FARMER_PATROL.length;
              const nextWp = FARMER_PATROL[player.patrolIdx];
              player.target = { x: nextWp.x, y: nextWp.y };
              player.dir = getMoveDir(player.x, player.y, nextWp.x, nextWp.y);
              if (nextWp.x - player.x > 4) player.facingSign = -1;
              else if (nextWp.x - player.x < -4) player.facingSign = 1;
              player.moving = true;
            } else {
              player.target = null;
              player.moving = false;
            }
          } else {
            const candX = Math.max(48, Math.min(WIDTH - 48, player.x + (dx / dist) * walkSpeed * dt));
            const candY = Math.max(56, Math.min(HEIGHT - 48, player.y + (dy / dist) * walkSpeed * dt));
            if (cellVal(Math.round(candX) >> 2, Math.round(candY) >> 2) === 3) {
              player.target = null;
              player.moving = false;
            } else {
              player.x = candX;
              player.y = candY;
              player.dir = getMoveDir(player.x, player.y, player.target.x, player.target.y);
              if (dx > 4) player.facingSign = -1;
              else if (dx < -4) player.facingSign = 1;
              player.moving = true;
            }
          }
        } else {
          player.moving = false;
          player.idleTimer += dt;
          if (player.idleTimer >= 2.2) {
            const nextWp = FARMER_PATROL[player.patrolIdx];
            player.target = { x: nextWp.x, y: nextWp.y };
            player.moving = true;
          }
        }

        if (player.moving) {
          const cycleSpeed = keys.has("shift") ? 12.0 : 8.6;
          player.walkCycle = (player.walkCycle + dt * cycleSpeed) % (Math.PI * 2);
          player.stepAccum += dt;
          if (player.stepAccum >= 0.11) {
            player.stepAccum -= 0.11;
            player.phase = (player.phase + 1) % 4;
          }
        } else {
          player.phase = 0;
          player.stepAccum = 0;
        }

        // Smooth Harvest Moon Camera Follow & Boundary Clamping
        const viewW = canvas.width / cam.zoom;
        const viewH = canvas.height / cam.zoom;
        const maxCamX = Math.max(0, WIDTH - viewW);
        const maxCamY = Math.max(0, HEIGHT - viewH);
        if (cam.follow) {
          const targetCamX = Math.max(0, Math.min(maxCamX, player.x - viewW / 2));
          const targetCamY = Math.max(0, Math.min(maxCamY, player.y - viewH / 2));
          const smooth = 1 - Math.exp(-10 * dt);
          cam.x += (targetCamX - cam.x) * smooth;
          cam.y += (targetCamY - cam.y) * smooth;
        } else {
          cam.x = Math.max(0, Math.min(maxCamX, cam.x));
          cam.y = Math.max(0, Math.min(maxCamY, cam.y));
        }

        for (let py = dirty.y; py < dirty.y + dirty.h; py += 1) {
          const rowStart = (py * WIDTH + dirty.x) * 4;
          const rowEnd = rowStart + dirty.w * 4;
          frameImage.data.set(baseImage.data.subarray(rowStart, rowEnd), rowStart);
        }
        for (let py = pondDirty.y; py < pondDirty.y + pondDirty.h; py += 1) {
          const rowStart = (py * WIDTH + pondDirty.x) * 4;
          const rowEnd = rowStart + pondDirty.w * 4;
          frameImage.data.set(baseImage.data.subarray(rowStart, rowEnd), rowStart);
        }
        for (let py = cropDirty.y; py < cropDirty.y + cropDirty.h; py += 1) {
          const rowStart = (py * WIDTH + cropDirty.x) * 4;
          const rowEnd = rowStart + cropDirty.w * 4;
          frameImage.data.set(baseImage.data.subarray(rowStart, rowEnd), rowStart);
        }

        for (const n of nests) {
          if (n.sparkleTimer > 0) {
            n.sparkleTimer = Math.max(0, n.sparkleTimer - dt);
          }
        }

        for (const a of animals) {
          if (a.parentId && a.trailLag) {
            const mom = animals.find((m) => m.id === a.parentId);
            if (mom?.trail) {
              const pt = mom.trail[Math.min(a.trailLag, mom.trail.length - 1)];
              a.x = pt.x;
              a.y = pt.y;
              a.dir = mom.troughId && mom.mode === "eat" ? "down" : pt.dir;
              a.mode = mom.mode === "walk" ? "walk" : "eat";
              a.stepAccum += dt;
              const interval = a.mode === "walk" ? 0.12 : 0.24;
              if (a.stepAccum >= interval) {
                a.stepAccum -= interval;
                a.phase = (a.phase + 1) % 4;
              }
            }
            continue;
          }

          if (a.mode === "walk") {
            const target = a.waypoints[a.wpIdx];
            const dx = target.x - a.x;
            const dy = target.y - a.y;
            const dist = Math.hypot(dx, dy);
            a.dir = getMoveDir(a.x, a.y, target.x, target.y);

            a.stepAccum += dt;
            if (a.stepAccum >= 0.17) {
              a.stepAccum -= 0.17;
              a.phase = (a.phase + 1) % 4;
            }

            if (dist <= a.speed * dt) {
              a.x = target.x;
              a.y = target.y;
              if (a.trail && Math.hypot(a.x - a.trail[0].x, a.y - a.trail[0].y) >= 0.8) {
                a.trail.unshift({ x: a.x, y: a.y, dir: a.dir });
                if (a.trail.length > 40) a.trail.pop();
              }
              if (target.refillFodder) {
                if (a.troughId === 1 && fodder1 === 0) fodder1 = 4;
                if (a.troughId === 2 && fodder2 === 0) fodder2 = 4;
              }
              if (target.layEggAfter) {
                if (target.eatDir) a.dir = target.eatDir;
                a.mode = "lay";
                a.biteAccum = 0;
                a.timerUntil = now + 2400;
                a.phase = 0;
                a.stepAccum = 0;
              } else if (target.eatAfter) {
                if (target.eatDir) a.dir = target.eatDir;
                else if (a.troughId) a.dir = "down";
                a.mode = "eat";
                a.biteAccum = 0;
                a.timerUntil = now + (a.troughId ? 4400 : 2200);
                a.phase = 0;
                a.stepAccum = 0;
              } else {
                a.wpIdx = (a.wpIdx + 1) % a.waypoints.length;
                a.dir = getMoveDir(a.x, a.y, a.waypoints[a.wpIdx].x, a.waypoints[a.wpIdx].y);
                a.mode = "turn";
                a.timerUntil = now + 240;
                a.phase = 0;
                a.stepAccum = 0;
              }
            } else {
              a.x += (dx / dist) * a.speed * dt;
              a.y += (dy / dist) * a.speed * dt;
              if (a.trail && Math.hypot(a.x - a.trail[0].x, a.y - a.trail[0].y) >= 1.0) {
                a.trail.unshift({ x: a.x, y: a.y, dir: a.dir });
                if (a.trail.length > 40) a.trail.pop();
              }
            }
          } else if (a.mode === "lay") {
            a.stepAccum += dt;
            if (a.stepAccum >= 0.28) {
              a.stepAccum -= 0.28;
              a.phase = (a.phase + 1) % 4;
            }
            if (now >= a.timerUntil) {
              if (a.nestId) {
                const nest = nests.find((n) => n.id === a.nestId);
                if (nest) {
                  nest.eggs = (nest.eggs % 3) + 1;
                  nest.sparkleTimer = 0.9;
                }
              }
              a.wpIdx = (a.wpIdx + 1) % a.waypoints.length;
              a.dir = getMoveDir(a.x, a.y, a.waypoints[a.wpIdx].x, a.waypoints[a.wpIdx].y);
              a.mode = "walk";
              a.phase = 0;
              a.stepAccum = 0;
            }
          } else if (a.mode === "eat") {
            a.stepAccum += dt;
            if (a.stepAccum >= 0.25) {
              a.stepAccum -= 0.25;
              a.phase = (a.phase + 1) % 4;
            }
            if (a.troughId) {
              a.biteAccum += dt;
              const baseX = a.troughId === 1 ? TROUGH_1_X : TROUGH_2_X;
              if (a.biteAccum >= 1.0) {
                a.biteAccum -= 1.0;
                if (a.troughId === 1 && fodder1 > 0) {
                  fodder1 = Math.max(0, fodder1 - 1);
                  a.x = fodder1 === 3 ? baseX - 5 : fodder1 === 2 ? baseX + 5 : baseX;
                } else if (a.troughId === 2 && fodder2 > 0) {
                  fodder2 = Math.max(0, fodder2 - 1);
                  a.x = fodder2 === 3 ? baseX - 5 : fodder2 === 2 ? baseX + 5 : baseX;
                }
              }
            }
            if (now >= a.timerUntil) {
              if (a.troughId) {
                a.x = a.troughId === 1 ? TROUGH_1_X : TROUGH_2_X;
              }
              a.wpIdx = (a.wpIdx + 1) % a.waypoints.length;
              a.dir = getMoveDir(a.x, a.y, a.waypoints[a.wpIdx].x, a.waypoints[a.wpIdx].y);
              a.mode = "walk";
              a.phase = 0;
              a.stepAccum = 0;
            }
          } else {
            a.stepAccum += dt;
            if (a.stepAccum >= 0.3) {
              a.stepAccum -= 0.3;
              a.phase = (a.phase + 1) % 4;
            }
            if (now >= a.timerUntil) {
              a.dir = getMoveDir(a.x, a.y, a.waypoints[a.wpIdx].x, a.waypoints[a.wpIdx].y);
              a.mode = "walk";
              a.phase = 0;
              a.stepAccum = 0;
            }
          }
        }

        for (const f of fishes) {
          if (f.splashTimer > 0) {
            f.splashTimer = Math.max(0, f.splashTimer - dt);
          }

          f.stepAccum += dt;
          const phaseInterval = f.mode === "jump" ? 0.09 : 0.14;
          if (f.stepAccum >= phaseInterval) {
            f.stepAccum -= phaseInterval;
            f.phase = (f.phase + 1) % 4;
          }

          const target = f.waypoints[f.wpIdx];
          const dx = target.x - f.x;
          const dy = target.y - f.y;
          const dist = Math.hypot(dx, dy);
          f.dir = getMoveDir(f.x, f.y, target.x, target.y);

          if (f.mode === "jump") {
            f.jumpProgress += dt / f.jumpDuration;
            const jumpSpeed = f.speed * 1.45;
            if (dist > jumpSpeed * dt) {
              f.x += (dx / dist) * jumpSpeed * dt;
              f.y += (dy / dist) * jumpSpeed * dt;
            } else {
              f.x = target.x;
              f.y = target.y;
            }
            if (f.jumpProgress >= 1) {
              f.mode = "swim";
              f.jumpProgress = 0;
              f.lastSplashX = f.x;
              f.lastSplashY = f.y;
              f.splashTimer = 0.55;
            }
          } else {
            if (dist <= f.speed * dt) {
              f.x = target.x;
              f.y = target.y;
              const shouldJump = Boolean(target.jumpHere);
              f.wpIdx = (f.wpIdx + 1) % f.waypoints.length;
              f.dir = getMoveDir(f.x, f.y, f.waypoints[f.wpIdx].x, f.waypoints[f.wpIdx].y);
              if (shouldJump) {
                f.mode = "jump";
                f.jumpProgress = 0;
                f.lastSplashX = f.x;
                f.lastSplashY = f.y;
                f.splashTimer = 0.55;
              }
            } else {
              f.x += (dx / dist) * f.speed * dt;
              f.y += (dy / dist) * f.speed * dt;
            }
          }
        }

        drawFodderFieldScene(frameImage.data, now);
        drawPondFishScene(frameImage.data, fishes);
        drawLivestockScene(frameImage.data, animals, nests, fodder1, fodder2);
        worldCtx.putImageData(frameImage, 0, 0, dirty.x, dirty.y, dirty.w, dirty.h);
        worldCtx.putImageData(frameImage, 0, 0, pondDirty.x, pondDirty.y, pondDirty.w, pondDirty.h);
        worldCtx.putImageData(frameImage, 0, 0, cropDirty.x, cropDirty.y, cropDirty.w, cropDirty.h);

        // Render visible camera viewport from the 2800x1800 World Canvas with crisp pixel-art scaling
        ctx.imageSmoothingEnabled = false;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(
          worldCanvas,
          cam.x,
          cam.y,
          viewW,
          viewH,
          0,
          0,
          canvas.width,
          canvas.height,
        );
        drawFarmerAndOverlays(ctx, cam.x, cam.y, cam.zoom, player, farmerName, now);

        // Render live Interactive Minimap
        const mini = minimapRef.current;
        if (mini) {
          const mctx = mini.getContext("2d");
          if (mctx) {
            const mw = mini.width;
            const mh = mini.height;
            mctx.imageSmoothingEnabled = false;
            mctx.drawImage(worldCanvas, 0, 0, WIDTH, HEIGHT, 0, 0, mw, mh);
            // Camera viewport rectangle on minimap
            mctx.strokeStyle = "#fff8dc";
            mctx.lineWidth = 1.5;
            mctx.strokeRect(
              (cam.x / WIDTH) * mw,
              (cam.y / HEIGHT) * mh,
              Math.min(mw, (viewW / WIDTH) * mw),
              Math.min(mh, (viewH / HEIGHT) * mh),
            );
            // Glowing Farmer pin on minimap
            const px = (player.x / WIDTH) * mw;
            const py = (player.y / HEIGHT) * mh;
            mctx.fillStyle = "#e53935";
            mctx.beginPath();
            mctx.arc(px, py, 3.6, 0, Math.PI * 2);
            mctx.fill();
            mctx.strokeStyle = "#fff8dc";
            mctx.lineWidth = 1.2;
            mctx.stroke();
          }
        }

        animId = requestAnimationFrame(tick);
      };

      animId = requestAnimationFrame(tick);
    };

    return () => {
      if (animId) cancelAnimationFrame(animId);
      window.removeEventListener("resize", syncViewportSize);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [farmerName]);

  // Pointer Drag-to-Pan & Click-to-Walk state
  const dragRef = useRef<{
    active: boolean;
    moved: boolean;
    startX: number;
    startY: number;
    camStartX: number;
    camStartY: number;
  }>({ active: false, moved: false, startX: 0, startY: 0, camStartX: 0, camStartY: 0 });

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      active: true,
      moved: false,
      startX: e.clientX,
      startY: e.clientY,
      camStartX: cameraRef.current.x,
      camStartY: cameraRef.current.y,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const d = dragRef.current;
    if (!d.active) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (Math.hypot(dx, dy) > 6) {
      d.moved = true;
      cameraRef.current.follow = false;
      setFollowUi(false);
      const z = cameraRef.current.zoom;
      cameraRef.current.x = d.camStartX - dx / z;
      cameraRef.current.y = d.camStartY - dy / z;
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const d = dragRef.current;
    if (!d.active) return;
    d.active = false;
    e.currentTarget.releasePointerCapture(e.pointerId);
    if (!d.moved) {
      // Click-to-Walk! Convert screen click to world coordinates
      const rect = e.currentTarget.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const wx = Math.max(48, Math.min(WIDTH - 48, cameraRef.current.x + sx / cameraRef.current.zoom));
      const wy = Math.max(56, Math.min(HEIGHT - 48, cameraRef.current.y + sy / cameraRef.current.zoom));
      playerRef.current.idleTimer = 0;
      playerRef.current.target = { x: wx, y: wy };
      cameraRef.current.follow = true;
      setFollowUi(true);
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    const cam = cameraRef.current;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const worldBeforeX = cam.x + mouseX / cam.zoom;
    const worldBeforeY = cam.y + mouseY / cam.zoom;

    const factor = e.deltaY < 0 ? 1.12 : 0.89;
    const nextZoom = Math.max(0.85, Math.min(3.0, +(cam.zoom * factor).toFixed(2)));
    cam.zoom = nextZoom;
    cam.x = worldBeforeX - mouseX / nextZoom;
    cam.y = worldBeforeY - mouseY / nextZoom;
    setZoomUi(Math.round(nextZoom * 100));
  };

  const handleMinimapClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const rx = (e.clientX - rect.left) / rect.width;
    const ry = (e.clientY - rect.top) / rect.height;
    const wx = Math.max(48, Math.min(WIDTH - 48, rx * WIDTH));
    const wy = Math.max(56, Math.min(HEIGHT - 48, ry * HEIGHT));
    const canvas = canvasRef.current;
    const viewW = (canvas?.width ?? window.innerWidth) / cameraRef.current.zoom;
    const viewH = (canvas?.height ?? window.innerHeight) / cameraRef.current.zoom;
    cameraRef.current.x = Math.max(0, Math.min(WIDTH - viewW, wx - viewW / 2));
    cameraRef.current.y = Math.max(0, Math.min(HEIGHT - viewH, wy - viewH / 2));
    cameraRef.current.follow = false;
    setFollowUi(false);
  };

  const jumpToZone = (zoneId: string, x: number, y: number) => {
    setActiveZone(zoneId);
    playerRef.current.x = x + 68;
    playerRef.current.y = y;
    playerRef.current.idleTimer = 0;
    playerRef.current.target = { x, y };
    playerRef.current.moving = true;
    cameraRef.current.follow = true;
    setFollowUi(true);
  };

  const changeZoom = (delta: number) => {
    const cam = cameraRef.current;
    const nextZoom = Math.max(0.85, Math.min(3.0, +(cam.zoom + delta).toFixed(2)));
    cam.zoom = nextZoom;
    setZoomUi(Math.round(nextZoom * 100));
  };

  return (
    <div className="village-stage">
      <canvas
        ref={canvasRef}
        className="village-canvas cursor-grab active:cursor-grabbing"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onWheel={handleWheel}
      />

      {/* Harvest Moon Camera & Interactive Minimap Dock (Bottom-Left) */}
      <div className="fixed bottom-4 left-4 z-30 flex flex-col gap-2">
        {/* Quick-Jump Zone Pills */}
        <div className="flex flex-wrap items-center gap-1 max-w-[330px]">
          {WORLD_ZONES.map((z) => (
            <button
              key={z.id}
              type="button"
              onClick={() => jumpToZone(z.id, z.x, z.y)}
              className={`rounded-full border-2 border-[#140e0a] px-2.5 py-0.5 text-[10px] font-extrabold shadow-[0_2px_0_#140e0a] transition-transform hover:-translate-y-0.5 ${
                activeZone === z.id
                  ? "bg-[#e7a02d] text-[#24180f]"
                  : "bg-[#2e1e12]/90 text-[#f6ecd8] hover:bg-[#3e2919]"
              }`}
            >
              {z.label}
            </button>
          ))}
        </div>

        {/* Minimap & Camera Controls Frame */}
        <div className="rounded-2xl border-3 border-[#140e0a] bg-gradient-to-b from-[#3c2718]/95 to-[#26180f]/95 p-2 shadow-[0_5px_0_#140e0a] backdrop-blur-xs">
          <div className="mb-1.5 flex items-center justify-between gap-2 px-1">
            <span className="text-[11px] font-extrabold text-[#f6ecd8]">
              Peta Dunia (2800×1800)
            </span>
            <button
              type="button"
              onClick={() => {
                cameraRef.current.follow = !cameraRef.current.follow;
                setFollowUi(cameraRef.current.follow);
              }}
              className={`rounded-lg border border-[#140e0a] px-2 py-0.5 text-[10px] font-extrabold ${
                followUi
                  ? "bg-[#46b852] text-[#fffef8]"
                  : "bg-[#e7a02d] text-[#24180f]"
              }`}
              title="Tekan Spasi untuk memusatkan kamera ke Petani"
            >
              {followUi ? "🎥 Ikuti Petani" : "✋ Kamera Bebas"}
            </button>
          </div>

          <canvas
            ref={minimapRef}
            width={210}
            height={135}
            onClick={handleMinimapClick}
            className="block rounded-lg border-2 border-[#140e0a] cursor-pointer shadow-inner"
            title="Klik di minimap untuk menggeser kamera ke lokasi tersebut"
          />

          <div className="mt-1.5 flex items-center justify-between gap-1.5 text-[10px] font-bold text-[#e7c9a0]">
            <span className="truncate">WASD / Klik Tanah: Jalan</span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => changeZoom(-0.25)}
                className="grid h-5 w-5 place-items-center rounded border border-[#140e0a] bg-[#f4e4c6] font-extrabold text-[#24180f] hover:bg-[#fff6e5]"
                aria-label="Perkecil Kamera"
              >
                -
              </button>
              <span className="min-w-[34px] text-center font-extrabold text-[#f6ecd8]">
                {zoomUi}%
              </span>
              <button
                type="button"
                onClick={() => changeZoom(0.25)}
                className="grid h-5 w-5 place-items-center rounded border border-[#140e0a] bg-[#f4e4c6] font-extrabold text-[#24180f] hover:bg-[#fff6e5]"
                aria-label="Perbesar Kamera"
              >
                +
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

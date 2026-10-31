import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const COLORS = Object.freeze({ magenta: [255, 0, 255], green: [0, 255, 0] });
const clamp = (value) => Math.max(0, Math.min(255, value));

export async function extractPlaneChroma({ inputPath, outputPath, color = 'magenta', scope = 'connected' }) {
  if (!inputPath || !outputPath) throw new Error('inputPath and outputPath are required.');
  const background = COLORS[color];
  if (!background) throw new Error("color must be 'magenta' or 'green'.");
  if (!['connected', 'global'].includes(scope)) throw new Error("scope must be 'connected' or 'global'.");
  const { data, info } = await sharp(resolve(inputPath), { failOn: 'warning' })
    .rotate().removeAlpha().toColourspace('srgb').raw().toBuffer({ resolveWithObject: true });
  const count = info.width * info.height;
  const connected = new Uint8Array(count);
  const queue = new Int32Array(count);
  let head = 0;
  let tail = 0;
  const distance = (pixel) => {
    const offset = pixel * 3;
    return Math.sqrt((background[0] - data[offset]) ** 2
      + (background[1] - data[offset + 1]) ** 2
      + (background[2] - data[offset + 2]) ** 2);
  };
  const add = (pixel) => {
    if (connected[pixel] || distance(pixel) > 200) return;
    connected[pixel] = 1;
    queue[tail++] = pixel;
  };
  if (scope === 'global') {
    for (let pixel = 0; pixel < count; pixel += 1) {
      if (distance(pixel) <= 200) connected[pixel] = 1;
    }
  } else {
    for (let x = 0; x < info.width; x += 1) { add(x); add((info.height - 1) * info.width + x); }
    for (let y = 0; y < info.height; y += 1) { add(y * info.width); add(y * info.width + info.width - 1); }
    while (head < tail) {
      const pixel = queue[head++];
      const x = pixel % info.width;
      const y = Math.floor(pixel / info.width);
      if (x > 0) add(pixel - 1);
      if (x + 1 < info.width) add(pixel + 1);
      if (y > 0) add(pixel - info.width);
      if (y + 1 < info.height) add(pixel + info.width);
    }
  }
  const rgba = Buffer.alloc(count * 4);
  for (let pixel = 0; pixel < count; pixel += 1) {
    const source = pixel * 3;
    const target = pixel * 4;
    const alpha = connected[pixel] ? clamp(Math.round(((distance(pixel) - 8) / 192) * 255)) : 255;
    const opacity = alpha / 255;
    for (let channel = 0; channel < 3; channel += 1) {
      rgba[target + channel] = alpha
        ? clamp(Math.round((data[source + channel] - background[channel] * (1 - opacity)) / opacity))
        : 0;
    }
    rgba[target + 3] = alpha;
  }
  const output = Buffer.from(rgba);
  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const offset = (y * info.width + x) * 4;
      if (rgba[offset + 3] === 0 || rgba[offset + 3] === 255) continue;
      let nearest = null;
      let nearestDistance = Infinity;
      for (let dy = -3; dy <= 3; dy += 1) {
        for (let dx = -3; dx <= 3; dx += 1) {
          const candidateX = x + dx;
          const candidateY = y + dy;
          if (candidateX < 0 || candidateY < 0 || candidateX >= info.width || candidateY >= info.height) continue;
          const candidate = (candidateY * info.width + candidateX) * 4;
          if (rgba[candidate + 3] !== 255) continue;
          const squaredDistance = dx ** 2 + dy ** 2;
          if (squaredDistance < nearestDistance) { nearest = candidate; nearestDistance = squaredDistance; }
        }
      }
      if (nearest !== null) {
        output[offset] = rgba[nearest];
        output[offset + 1] = rgba[nearest + 1];
        output[offset + 2] = rgba[nearest + 2];
      }
    }
  }
  await mkdir(dirname(resolve(outputPath)), { recursive: true });
  await sharp(output, { raw: { width: info.width, height: info.height, channels: 4 } })
    .png().toFile(resolve(outputPath));
  return { width: info.width, height: info.height, color, scope };
}

function parseArguments(argv) {
  const options = {};
  const names = new Map([['--input', 'inputPath'], ['--output', 'outputPath'], ['--color', 'color'], ['--scope', 'scope']]);
  for (let index = 0; index < argv.length; index += 2) {
    const key = names.get(argv[index]);
    if (!key || index + 1 >= argv.length) throw new Error(`Unknown or incomplete argument '${argv[index]}'.`);
    options[key] = argv[index + 1];
  }
  return options;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify(await extractPlaneChroma(parseArguments(process.argv.slice(2))), null, 2));
}

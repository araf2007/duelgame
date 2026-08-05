import { Jimp } from 'jimp';
import fs from 'fs';
import path from 'path';

const publicDir = 'public';

async function processSpriteSheet(filename, outname) {
    const filePath = path.join(publicDir, filename);
    if (!fs.existsSync(filePath)) {
        console.log("Missing " + filename);
        return;
    }
    console.log("Processing " + filename + "...");
    const img = await Jimp.read(filePath);
    
    const w = img.bitmap.width;
    const h = img.bitmap.height;
    
    // 1. Make white background transparent
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const hex = img.getPixelColor(x, y);
            const rgba = { r: (hex >>> 24) & 255, g: (hex >>> 16) & 255, b: (hex >>> 8) & 255, a: hex & 255 };
            if (rgba.r > 240 && rgba.g > 240 && rgba.b > 240) {
                img.setPixelColor(0x00000000, x, y);
            }
        }
    }
    
    // 2. Find bounding boxes using BFS on non-transparent pixels
    const visited = new Uint8Array(w * h);
    const boxes = [];
    
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const idx = y * w + x;
            if (visited[idx]) continue;
            visited[idx] = 1;
            
            const hex = img.getPixelColor(x, y);
            const rgba = { r: (hex >>> 24) & 255, g: (hex >>> 16) & 255, b: (hex >>> 8) & 255, a: hex & 255 };
            
            if (rgba.a > 10) {
                let minX = x, maxX = x, minY = y, maxY = y;
                const q = [[x, y]];
                let head = 0;
                
                while(head < q.length) {
                    const [cx, cy] = q[head++];
                    
                    const neighbors = [
                        [cx+1, cy], [cx-1, cy], [cx, cy+1], [cx, cy-1],
                        [cx+1, cy+1], [cx-1, cy-1], [cx+1, cy-1], [cx-1, cy+1]
                    ];
                    
                    for (const [nx, ny] of neighbors) {
                        if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
                            const nidx = ny * w + nx;
                            if (!visited[nidx]) {
                                visited[nidx] = 1;
                                const nhex = img.getPixelColor(nx, ny);
                                const nrgba = { r: (nhex >>> 24) & 255, g: (nhex >>> 16) & 255, b: (nhex >>> 8) & 255, a: nhex & 255 };
                                if (nrgba.a > 10) {
                                    if (nx < minX) minX = nx;
                                    if (nx > maxX) maxX = nx;
                                    if (ny < minY) minY = ny;
                                    if (ny > maxY) maxY = ny;
                                    q.push([nx, ny]);
                                }
                            }
                        }
                    }
                }
                
                const bw = maxX - minX + 1;
                const bh = maxY - minY + 1;
                
                if (bw > 100 && bh > 100 && bw < 600 && bh < 600) {
                    if (bw / bh < 3.0) {
                        boxes.push({x: minX, y: minY, w: bw, h: bh});
                    }
                }
            }
        }
    }
    
    if (boxes.length === 0) {
        console.log("No valid sprites found in " + filename);
        return;
    }
    
    boxes.sort((a, b) => (a.y + a.h/2) - (b.y + b.h/2));
    
    const rows = [];
    let currentRow = [];
    let lastY = boxes[0].y + boxes[0].h/2;
    
    for (const box of boxes) {
        const y = box.y + box.h/2;
        if (Math.abs(y - lastY) > 60) {
            rows.push(currentRow);
            currentRow = [];
        }
        currentRow.push(box);
        lastY = y;
    }
    rows.push(currentRow);
    
    for (const row of rows) {
        row.sort((a, b) => a.x - b.x);
    }
    
    let maxW = 0, maxH = 0;
    let maxCols = 0;
    for (const row of rows) {
        if (row.length > maxCols) maxCols = row.length;
        for (const box of row) {
            if (box.w > maxW) maxW = box.w;
            if (box.h > maxH) maxH = box.h;
        }
    }
    
    const padding = 10;
    const frameW = maxW + padding * 2;
    const frameH = maxH + padding * 2;
    const numRows = rows.length;
    
    console.log(`${filename}: Detected ${numRows} rows, max cols ${maxCols}`);
    console.log(`${filename}: Max size: ${maxW}x${maxH}, Frame Size: ${frameW}x${frameH}`);
    
    const outImg = new Jimp({ width: maxCols * frameW, height: numRows * frameH, color: 0x00000000 });
    
    for (let r = 0; r < rows.length; r++) {
        for (let c = 0; c < rows[r].length; c++) {
            const box = rows[r][c];
            const sprite = img.clone();
            sprite.crop({ x: box.x, y: box.y, w: box.w, h: box.h });
            
            const pasteX = c * frameW + Math.floor((frameW - box.w) / 2);
            const pasteY = r * frameH + Math.floor((frameH - box.h) / 2);
            
            outImg.composite(sprite, pasteX, pasteY);
        }
    }
    
    await outImg.write(path.join(publicDir, outname));
    console.log(`Saved ${outname}. PHASER CONFIG: ${frameW}x${frameH}`);
    fs.writeFileSync(path.join(publicDir, outname + '.json'), JSON.stringify({frameWidth: frameW, frameHeight: frameH, rows, maxCols}));
}

async function processBg() {
    const filePath = path.join(publicDir, 'duel_bg.png');
    if (!fs.existsSync(filePath)) return;
    console.log("Processing bg...");
    const img = await Jimp.read(filePath);
    img.resize({ w: 800, h: 600 });
    await img.write(path.join(publicDir, 'duel_bg_clean.png'));
    console.log("Saved bg.");
}

async function main() {
    await processSpriteSheet('blue_wiz_sprite.png', 'blue_wiz_clean.png');
    await processSpriteSheet('red_wiz_sprite.png', 'red_wiz_clean.png');
    await processBg();
}

main().catch(console.error);

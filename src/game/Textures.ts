import * as THREE from 'three';

export function createMetalPanelTexture(
  baseHex: string,
  lineHex: string,
  maxAnisotropy: number
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = baseHex;
  ctx.fillRect(0, 0, 256, 256);

  // Anisotropic brushed metal grain
  for (let i = 0; i < 800; i++) {
    ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.07)';
    ctx.fillRect(Math.random() * 256, Math.random() * 256, 24, 1);
  }

  // Beveled industrial panel seams
  ctx.strokeStyle = lineHex;
  ctx.lineWidth = 2;
  ctx.strokeRect(4, 4, 248, 248);
  ctx.beginPath();
  ctx.moveTo(0, 128);
  ctx.lineTo(256, 128);
  ctx.moveTo(128, 0);
  ctx.lineTo(128, 256);
  ctx.stroke();

  // Diagonal tech chamfer lines
  ctx.strokeStyle = 'rgba(255,255,255,0.05)';
  ctx.beginPath();
  ctx.moveTo(6, 6);
  ctx.lineTo(250, 6);
  ctx.moveTo(6, 130);
  ctx.lineTo(250, 130);
  ctx.stroke();

  // Corner bolts
  ctx.fillStyle = lineHex;
  const bolts = [
    [14, 14],
    [242, 14],
    [14, 242],
    [242, 242],
    [118, 118],
    [138, 138]
  ];
  for (const [bx, by] of bolts) {
    ctx.beginPath();
    ctx.arc(bx, by, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createPanelNormalMap(): THREE.DataTexture {
  const size = 128;
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      let nx = 128;
      let ny = 128;
      const border = x < 4 || x > size - 5 || y < 4 || y > size - 5 || Math.abs(x - 64) < 2 || Math.abs(y - 64) < 2;
      if (border) {
        nx = x < 64 ? 95 : 160;
        ny = y < 64 ? 95 : 160;
      } else {
        nx = 124 + ((x * 7 + y * 13) % 9);
        ny = 124 + ((x * 11 + y * 5) % 9);
      }
      data[idx] = nx;
      data[idx + 1] = ny;
      data[idx + 2] = 255;
      data[idx + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.needsUpdate = true;
  return tex;
}

export function createSkyscraperFacadeTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#0a101a';
  ctx.fillRect(0, 0, 512, 512);

  // Fine metallic curtain-wall mullions
  ctx.fillStyle = '#162234';
  for (let x = 0; x < 512; x += 16) {
    ctx.fillRect(x, 0, 3, 512);
  }

  // Realistic multi-story glass curtain wall with subtle interior lighting
  for (let y = 6; y < 506; y += 10) {
    ctx.fillStyle = '#111a29';
    ctx.fillRect(0, y - 2, 512, 2);
    for (let x = 4; x < 508; x += 16) {
      const r = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
      const frac = r - Math.floor(r);
      if (frac > 0.84) {
        ctx.fillStyle = frac > 0.94 ? '#ffaa44' : '#38e8ff';
      } else if (frac > 0.55) {
        ctx.fillStyle = '#183049';
      } else {
        ctx.fillStyle = '#0c1522';
      }
      ctx.fillRect(x, y, 10, 6);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 2);
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createCarbonArmorTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#1b2638';
  ctx.fillRect(0, 0, 128, 128);

  // Carbon fiber weave pattern
  for (let y = 0; y < 128; y += 8) {
    for (let x = 0; x < 128; x += 8) {
      ctx.fillStyle = (x + y) % 16 === 0 ? '#24334a' : '#141d2b';
      ctx.fillRect(x, y, 7, 7);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 4);
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createTerrainGridTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#8b9bb0';
  ctx.fillRect(0, 0, 512, 512);

  // Organic multi-scale surface grit & rock speckles
  for (let i = 0; i < 4500; i++) {
    const shade = 105 + Math.floor(Math.random() * 75);
    ctx.fillStyle = `rgb(${shade},${shade + 2},${shade + 8})`;
    const sz = (i % 4) + 1.5;
    ctx.fillRect(Math.random() * 512, Math.random() * 512, sz, sz);
  }

  // Subtle weathered pavement cracks
  ctx.strokeStyle = 'rgba(20, 30, 45, 0.22)';
  ctx.lineWidth = 1.5;
  for (let p = 0; p <= 512; p += 128) {
    ctx.beginPath();
    ctx.moveTo(p, 0);
    ctx.lineTo(p, 512);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, p);
    ctx.lineTo(512, p);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(40, 40);
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createContactShadowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createRadialGradient(64, 64, 6, 64, 64, 60);
  grad.addColorStop(0, 'rgba(0, 0, 0, 0.76)');
  grad.addColorStop(0.55, 'rgba(0, 0, 0, 0.34)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0.0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

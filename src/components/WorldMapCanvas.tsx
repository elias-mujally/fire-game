import { useEffect, useRef } from 'react';
import { HudSnapshot } from '../game/types';

interface WorldMapCanvasProps {
  snap: HudSnapshot;
}

export function WorldMapCanvas({ snap }: WorldMapCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;

    const worldToCanvas = (wx: number, wz: number): [number, number] => {
      // World spans roughly X: [-160, 160], Z: [-220, 220]
      // Map North (-Z) to top, South (+Z) to bottom, or horizontal orientation
      const cx = ((wx + 180) / 360) * W;
      const cy = ((wz + 220) / 440) * H;
      return [cx, cy];
    };

    ctx.fillStyle = '#050a14';
    ctx.fillRect(0, 0, W, H);

    // Region zones (North = Nexus, Center = Wastelands, South = Meridian City)
    const [, nexusEndY] = worldToCanvas(0, -95);
    const [, wasteEndY] = worldToCanvas(0, 30);

    // Nexus Research Complex
    ctx.fillStyle = 'rgba(6, 182, 212, 0.08)';
    ctx.fillRect(0, 0, W, nexusEndY);

    // Ashen Wastelands
    ctx.fillStyle = 'rgba(245, 158, 11, 0.06)';
    ctx.fillRect(0, nexusEndY, W, wasteEndY - nexusEndY);

    // Meridian City
    ctx.fillStyle = 'rgba(59, 130, 246, 0.07)';
    ctx.fillRect(0, wasteEndY, W, H - wasteEndY);

    // Subtle grid
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.1)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= W; x += 48) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
    }
    for (let y = 0; y <= H; y += 48) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }

    // Region dividers & labels
    ctx.strokeStyle = 'rgba(6, 182, 212, 0.28)';
    ctx.beginPath();
    ctx.moveTo(0, nexusEndY);
    ctx.lineTo(W, nexusEndY);
    ctx.moveTo(0, wasteEndY);
    ctx.lineTo(W, wasteEndY);
    ctx.stroke();

    ctx.font = '600 11px "Chakra Petch", sans-serif';
    ctx.fillStyle = 'rgba(226, 241, 255, 0.55)';
    ctx.fillText('NEXUS RESEARCH COMPLEX (NORTH)', 14, 22);
    ctx.fillText('THE ASHEN WASTELANDS (CENTRAL)', 14, nexusEndY + 20);
    ctx.fillText('MERIDIAN CITY (SOUTH)', 14, wasteEndY + 20);

    // Interactables (caches, beacons, terminals)
    for (const item of snap.interactablesMap) {
      if (item.used && item.type === 'cache') continue;
      const [ix, iy] = worldToCanvas(item.x, item.z);
      ctx.beginPath();
      if (item.type === 'beacon') {
        ctx.fillStyle = '#38bdf8';
        ctx.arc(ix, iy, 4.5, 0, Math.PI * 2);
      } else if (item.type === 'cache') {
        ctx.fillStyle = '#10b981';
        ctx.arc(ix, iy, 3.2, 0, Math.PI * 2);
      } else if (item.type === 'terminal') {
        ctx.fillStyle = '#f59e0b';
        ctx.arc(ix, iy, 4.5, 0, Math.PI * 2);
      } else {
        ctx.fillStyle = '#a78bfa';
        ctx.arc(ix, iy, 2.8, 0, Math.PI * 2);
      }
      ctx.fill();
    }

    // Boss Markers
    for (const b of snap.bossesMap) {
      if (!b.alive) continue;
      const [bx, by] = worldToCanvas(b.x, b.z);
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(bx, by, 6.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.font = '600 10px "Chakra Petch", sans-serif';
      ctx.fillStyle = '#fca5a5';
      ctx.fillText(b.name, bx + 9, by + 3);
    }

    // Active Quest Objective Marker
    const mainQ = snap.activeMainQuest;
    if (mainQ) {
      const nextObj = mainQ.objectives.find((o) => !o.completed && o.targetPos);
      if (nextObj?.targetPos) {
        const [ox, oy] = worldToCanvas(nextObj.targetPos.x, nextObj.targetPos.z);
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(ox, oy, 9, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    // Player Marker
    const [px, py] = worldToCanvas(snap.playerPos.x, snap.playerPos.z);
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(-snap.playerPos.yaw + Math.PI);
    ctx.fillStyle = '#06b6d4';
    ctx.beginPath();
    ctx.moveTo(0, -8);
    ctx.lineTo(6, 7);
    ctx.lineTo(-6, 7);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }, [snap]);

  return (
    <div className="flex flex-col items-center gap-3">
      <canvas
        ref={canvasRef}
        width={760}
        height={390}
        className="w-full max-w-[760px] rounded border border-cyan-500/30 bg-[#050a14]"
      />
      <div className="flex flex-wrap items-center justify-center gap-6 text-xs text-slate-300">
        <span>Operative (Cyan Arrow)</span>
        <span aria-hidden="true">·</span>
        <span className="text-amber-400">Objective (Amber Ring)</span>
        <span aria-hidden="true">·</span>
        <span className="text-red-400">Apex Threat (Red Node)</span>
        <span aria-hidden="true">·</span>
        <span className="text-sky-400">Neural Beacon (Blue)</span>
        <span aria-hidden="true">·</span>
        <span className="text-emerald-400">Supply Cache (Green)</span>
      </div>
    </div>
  );
}

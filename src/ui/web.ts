import type { Sim } from '../sim/sim';
// Relationship web: villagers on a ring, edges coloured by mutual opinion.
export function drawWeb(c: HTMLCanvasElement, s: Sim, col: Record<string, string>, portrait: (id: string) => HTMLCanvasElement) {
  const g = c.getContext('2d')!, W = c.width, H = c.height, cx = W / 2, cy = H / 2 + 10, R = Math.min(W, H) * .38, vs = s.villagers;
  const pos = new Map(vs.map((v, i) => [v.id, [cx + Math.cos(i / vs.length * 6.283 - 1.57) * R, cy + Math.sin(i / vs.length * 6.283 - 1.57) * R]]));
  g.fillStyle = '#fbf4e4'; g.fillRect(0, 0, W, H);
  for (let i = 0; i < vs.length; i++) for (let j = i + 1; j < vs.length; j++) {
    const a = vs[i], b = vs[j], o = ((a.opinion[b.id] ?? 0) + (b.opinion[a.id] ?? 0)) / 2; if (Math.abs(o) < 12) continue;
    const [x1, y1] = pos.get(a.id)!, [x2, y2] = pos.get(b.id)!; g.strokeStyle = o > 0 ? `rgba(60,160,80,${Math.min(1, .25 + o / 80)})` : `rgba(210,60,50,${Math.min(1, .25 - o / 80)})`; g.lineWidth = 1 + Math.abs(o) / 12;
    if (o < 0) g.setLineDash([8, 6]); else g.setLineDash([]); g.beginPath(); g.moveTo(x1, y1); g.quadraticCurveTo(cx + (x1 + x2 - 2 * cx) * .15, cy + (y1 + y2 - 2 * cy) * .15, x2, y2); g.stroke();
  }
  g.setLineDash([]);
  for (const v of vs) { const [x, y] = pos.get(v.id)!, p = portrait(v.id), al = v.alliance ? s.alliances.find(a => a.id === v.alliance) : null;
    g.save(); g.beginPath(); g.arc(x, y, 38, 0, 6.283); g.fillStyle = '#fff'; g.fill(); g.lineWidth = 5; g.strokeStyle = al ? al.color : col[v.id]; g.stroke(); g.clip(); g.drawImage(p, x - 38, y - 38, 76, 76); g.restore();
    g.fillStyle = '#4a3b28'; g.font = 'bold 15px Georgia, serif'; g.textAlign = 'center'; g.fillText(v.first + (al ? ' 🚩' : ''), x, y + 56); }
}

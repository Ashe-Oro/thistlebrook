import type { Sim } from '../sim/sim';
// Relationship web: villagers on a ring. Default view shows mutual opinion as undirected edges;
// hovering/tapping a face reveals directional feelings — outgoing (→) vs incoming (←) — with values.
// Crushes (💗) and sweethearts (💞) get distinct edge styling. Redraws live while the modal is open.
export function drawWeb(c: HTMLCanvasElement, s: Sim, col: Record<string, string>, portrait: (id: string) => HTMLCanvasElement) {
  const g = c.getContext('2d')!, W = c.width, H = c.height, cx = W / 2, cy = H / 2 + 10, R = Math.min(W, H) * .38, vs = s.villagers, NR = 38;
  const pos = new Map(vs.map((v, i) => [v.id, [cx + Math.cos(i / vs.length * 6.283 - 1.57) * R, cy + Math.sin(i / vs.length * 6.283 - 1.57) * R] as [number, number]]));
  let hover: string | null = null, sel: string | null = null;

  const at = (e: MouseEvent) => { const r = c.getBoundingClientRect(); const x = (e.clientX - r.left) * (c.width / r.width), y = (e.clientY - r.top) * (c.height / r.height); let hit: string | null = null; for (const v of vs) { const [px, py] = pos.get(v.id)!; if (Math.hypot(x - px, y - py) <= NR + 6) hit = v.id; } return hit; };
  c.onmousemove = (e) => { const hit = at(e); c.style.cursor = hit ? 'pointer' : 'default'; if (hit !== hover) { hover = hit; render(); } };
  c.onmouseleave = () => { if (hover) { hover = null; render(); } };
  c.onclick = (e) => { const hit = at(e); sel = sel === hit ? null : hit; render(); };

  function arrow(x1: number, y1: number, x2: number, y2: number, o: number, side: number) {
    const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L, nx = -uy, ny = ux;
    const sx = x1 + ux * (NR + 4) + nx * side * 7, sy = y1 + uy * (NR + 4) + ny * side * 7;
    const ex = x2 - ux * (NR + 8) + nx * side * 7, ey = y2 - uy * (NR + 8) + ny * side * 7;
    const mag = Math.min(1, Math.abs(o) / 80);
    g.strokeStyle = o >= 0 ? `rgba(60,160,80,${.4 + mag * .55})` : `rgba(210,60,50,${.4 + mag * .55})`;
    g.fillStyle = g.strokeStyle; g.lineWidth = 1.5 + Math.abs(o) / 16; g.setLineDash([]);
    g.beginPath(); g.moveTo(sx, sy); g.lineTo(ex, ey); g.stroke();
    const a = Math.atan2(ey - sy, ex - sx), hl = 9 + Math.abs(o) / 20;
    g.beginPath(); g.moveTo(ex, ey); g.lineTo(ex - hl * Math.cos(a - .4), ey - hl * Math.sin(a - .4)); g.lineTo(ex - hl * Math.cos(a + .4), ey - hl * Math.sin(a + .4)); g.closePath(); g.fill();
    // value label near the arrowhead
    const lx = ex - ux * 16, ly = ey - uy * 16; g.font = 'bold 12px sans-serif'; const t = (o > 0 ? '+' : '') + Math.round(o), tw = g.measureText(t).width;
    g.fillStyle = 'rgba(255,255,255,.85)'; g.fillRect(lx - tw / 2 - 3, ly - 8, tw + 6, 15); g.fillStyle = o >= 0 ? '#2f7a43' : '#b43a30'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(t, lx, ly);
  }
  function heartEdge(aId: string, bId: string, emoji: string, color: string) {
    const [x1, y1] = pos.get(aId)!, [x2, y2] = pos.get(bId)!; g.strokeStyle = color; g.lineWidth = 3.5; g.setLineDash([2, 5]); g.lineCap = 'round';
    g.beginPath(); g.moveTo(x1, y1); g.quadraticCurveTo(cx + (x1 + x2 - 2 * cx) * .12, cy + (y1 + y2 - 2 * cy) * .12, x2, y2); g.stroke(); g.setLineDash([]); g.lineCap = 'butt';
    g.font = '16px serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(emoji, (x1 + x2) / 2, (y1 + y2) / 2);
  }
  function render() {
    if (!c.isConnected) { clearInterval(timer); return; }
    g.fillStyle = '#fbf4e4'; g.fillRect(0, 0, W, H);
    const active = hover ?? sel, av = active ? s.byId.get(active) : null;
    if (!av) {
      // clean default: undirected mutual-opinion web
      for (let i = 0; i < vs.length; i++) for (let j = i + 1; j < vs.length; j++) {
        const a = vs[i], b = vs[j], o = ((a.opinion[b.id] ?? 0) + (b.opinion[a.id] ?? 0)) / 2; if (Math.abs(o) < 12) continue;
        const [x1, y1] = pos.get(a.id)!, [x2, y2] = pos.get(b.id)!; g.strokeStyle = o > 0 ? `rgba(60,160,80,${Math.min(1, .25 + o / 80)})` : `rgba(210,60,50,${Math.min(1, .25 - o / 80)})`; g.lineWidth = 1 + Math.abs(o) / 12;
        g.setLineDash(o < 0 ? [8, 6] : []); g.beginPath(); g.moveTo(x1, y1); g.quadraticCurveTo(cx + (x1 + x2 - 2 * cx) * .15, cy + (y1 + y2 - 2 * cy) * .15, x2, y2); g.stroke();
      }
      g.setLineDash([]);
      // sweethearts are public — always shown with their distinct styling
      for (const v of vs) if (v.partner && v.id < v.partner) heartEdge(v.id, v.partner, '💞', '#e36aa8');
    } else {
      // directional view for the active node
      for (const u of vs) { if (u === av) continue; const out = av.opinion[u.id] ?? 0, inc = u.opinion[av.id] ?? 0; const [ax, ay] = pos.get(av.id)!, [ux, uy] = pos.get(u.id)!;
        if (Math.abs(out) >= 8) arrow(ax, ay, ux, uy, out, 1);   // what the active villager feels
        if (Math.abs(inc) >= 8) arrow(ux, uy, ax, ay, inc, 1);   // what they feel back
      }
      // crushes & sweethearts for the active node
      if (av.partner) heartEdge(av.id, av.partner, '💞', '#e36aa8');
      if (av.crush && av.crush !== av.partner) heartEdge(av.id, av.crush, '💗', '#f08fc0');
      for (const u of vs) if (u !== av && u.crush === av.id && u.id !== av.partner) heartEdge(u.id, av.id, '💗', '#f0aed0');
    }
    for (const v of vs) { const [x, y] = pos.get(v.id)!, p = portrait(v.id), al = v.alliance ? s.alliances.find(a => a.id === v.alliance) : null, isActive = v.id === (hover ?? sel);
      g.save(); g.beginPath(); g.arc(x, y, NR, 0, 6.283); g.fillStyle = '#fff'; g.fill(); g.lineWidth = isActive ? 7 : 5; g.strokeStyle = isActive ? '#c7743b' : al ? al.color : col[v.id]; g.stroke(); g.clip(); g.drawImage(p, x - NR, y - NR, NR * 2, NR * 2); g.restore();
      if (!isActive && (hover ?? sel)) { g.save(); g.beginPath(); g.arc(x, y, NR, 0, 6.283); g.fillStyle = 'rgba(251,244,228,.45)'; g.fill(); g.restore(); }
      g.fillStyle = '#4a3b28'; g.font = 'bold 15px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'alphabetic'; g.fillText(v.first + (al ? ' 🚩' : ''), x, y + NR + 18); }
  }
  const timer = setInterval(render, 1000); // keep the web live while the modal is open
  render();
}

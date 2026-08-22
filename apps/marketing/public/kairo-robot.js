const POSES = ["idle", "walk", "turn_left", "turn_right", "wave", "look", "happy", "thinking"];
// eye centres per pose, in source-image pixels
const EYES = {
  idle: [
    [40.3, 42],
    [74.8, 41],
  ],
  walk: [
    [39, 43],
    [75, 41],
  ],
  turn_left: [
    [39.8, 39.5],
    [73.5, 39.5],
  ],
  turn_right: [
    [38.3, 42],
    [67.1, 39.5],
  ],
  wave: [
    [36.3, 36],
    [79.5, 37],
  ],
  look: [
    [35.3, 39],
    [68.8, 41],
  ],
  happy: [
    [32.5, 41],
    [73.9, 43],
  ],
  thinking: [
    [34.4, 42],
    [70.5, 39],
  ],
};
const AMBIENT = ["idle", "look", "thinking", "happy", "turn_left", "turn_right", "idle"];

class KairoRobot extends HTMLElement {
  connectedCallback() {
    if (this._up) return;
    this._up = true;
    const shadow = this.attachShadow({ mode: "open" });
    shadow.innerHTML =
      "<style>:host{display:block;position:relative;width:100%;height:100%}canvas{display:block;width:100%;height:100%}</style>";
    const cv = document.createElement("canvas");
    shadow.appendChild(cv);
    const ctx = cv.getContext("2d");
    ctx.imageSmoothingQuality = "high";

    const sprites = {};
    let loaded = 0;
    for (const p of POSES) {
      const im = new Image();
      im.src = `/poses/${p}.png`;
      im.onload = () => {
        loaded++;
      };
      sprites[p] = im;
    }

    const HOME = 0.74;
    const st = { px: HOME, py: 0.5, active: false, hover: false, lean: 0, sway: 0 };
    let W = 1,
      H = 1,
      dpr = Math.min(devicePixelRatio, 2);
    let box = { x: 0, y: 0, w: 0, h: 0 };
    let pose = "idle",
      prev = "idle",
      fade = 1,
      hold = 3,
      hoverAge = 0;
    let blink = 0,
      nextBlink = 2 + Math.random() * 3;
    const look = { x: 0, y: 0 };

    const host = this.parentElement || this;
    const onMove = (e) => {
      const r = host.getBoundingClientRect();
      st.px = (e.clientX - r.left) / r.width;
      st.py = (e.clientY - r.top) / r.height;
      st.active = st.px > -0.1 && st.px < 1.1 && st.py > -0.1 && st.py < 1.1;
      const lx = e.clientX - r.left,
        ly = e.clientY - r.top;
      const inside = lx > box.x && lx < box.x + box.w && ly > box.y && ly < box.y + box.h;
      if (inside && !st.hover) hoverAge = 0;
      st.hover = inside;
    };
    window.addEventListener("mousemove", onMove);
    this._cleanup = () => window.removeEventListener("mousemove", onMove);

    const resize = () => {
      W = this.clientWidth || 1;
      H = this.clientHeight || 1;
      cv.width = W * dpr;
      cv.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.imageSmoothingQuality = "high";
    };
    resize();
    new ResizeObserver(resize).observe(this);

    const setPose = (next, dur) => {
      if (next === pose) {
        hold = dur;
        return;
      }
      prev = pose;
      pose = next;
      fade = 0;
      hold = dur;
    };

    let last = performance.now(),
      t = 0;
    const tick = (now) => {
      this._raf = requestAnimationFrame(tick);
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      t += dt;
      ctx.clearRect(0, 0, W, H);
      if (loaded < POSES.length) return;

      hoverAge += dt;
      hold -= dt;
      if (st.hover) {
        setPose(hoverAge < 1.3 ? "wave" : "happy", 0.6);
      } else if (hold <= 0) {
        setPose(AMBIENT[(Math.random() * AMBIENT.length) | 0], 2.6 + Math.random() * 3.4);
      }
      fade = Math.min(1, fade + dt * 3.2);
      nextBlink -= dt;
      if (nextBlink < 0) {
        blink = 1;
        nextBlink = 2.6 + Math.random() * 4;
      }
      blink = Math.max(0, blink - dt * 7);
      const tx = st.active ? Math.max(-1, Math.min(1, (st.px - HOME) * 3.2)) : 0;
      const ty = st.active ? Math.max(-1, Math.min(1, (st.py - 0.42) * 2.2)) : 0;
      look.x += (tx - look.x) * Math.min(1, dt * 7);
      look.y += (ty - look.y) * Math.min(1, dt * 7);

      // the body stays put; it only breathes, sways and leans toward the pointer
      const aim = st.active ? st.px - HOME : 0;
      st.lean += (Math.max(-1, Math.min(1, aim)) * 0.05 - st.lean) * Math.min(1, dt * 3);
      st.sway += (Math.max(-1, Math.min(1, aim)) * 14 - st.sway) * Math.min(1, dt * 2.4);

      const drawPose = (name, alpha) => {
        const sp = sprites[name];
        const h = Math.min(H * 0.8, 430);
        const scale = h / sp.height,
          w = sp.width * scale;
        const cx = HOME * W + st.sway;
        const breathe = Math.sin(t * 1.5) * h * 0.007;
        const groundY = H - h * 0.06;
        const topY = groundY - h + breathe;
        if (alpha > 0.5) box = { x: cx - w * 0.32, y: topY + h * 0.04, w: w * 0.64, h: h * 0.92 };
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(cx, topY + h / 2);
        ctx.rotate(st.lean * 0.4);
        ctx.scale(1, 1 + Math.sin(t * 1.5) * 0.004);
        ctx.drawImage(sp, -w / 2, -h / 2, w, h);
        const eyes = EYES[name];
        if (eyes && alpha > 0.35) {
          const S = (v) => v * scale;
          for (const [ex, ey] of eyes) {
            const px = -w / 2 + S(ex),
              py = -h / 2 + S(ey);
            ctx.beginPath();
            ctx.ellipse(px, py, S(8.5), S(7), 0, 0, Math.PI * 2);
            ctx.fillStyle = "#07050e";
            ctx.fill();
            ctx.save();
            ctx.shadowColor = "#c98bff";
            ctx.shadowBlur = S(6);
            ctx.strokeStyle = "#e3ccff";
            ctx.fillStyle = "#e3ccff";
            ctx.lineCap = "round";
            const gx = px + S(look.x * 3.2),
              gy = py + S(look.y * 2.2);
            if (blink > 0.5) {
              ctx.lineWidth = S(2.4);
              ctx.beginPath();
              ctx.moveTo(gx - S(5), gy);
              ctx.lineTo(gx + S(5), gy);
              ctx.stroke();
            } else if (name === "happy" || name === "wave") {
              ctx.lineWidth = S(2.8);
              ctx.beginPath();
              ctx.arc(gx, gy + S(2), S(5), Math.PI * 1.12, Math.PI * 1.88);
              ctx.stroke();
            } else {
              ctx.beginPath();
              ctx.ellipse(gx, gy, S(3), S(4.4), 0, 0, Math.PI * 2);
              ctx.fill();
            }
            ctx.restore();
          }
        }
        ctx.restore();
        return { cx, groundY, w, h };
      };

      if (fade < 1) drawPose(prev, 1 - fade * 0.15);
      const geo = drawPose(pose, fade);
      const g = ctx.createRadialGradient(geo.cx, geo.groundY, 2, geo.cx, geo.groundY, geo.w * 0.42);
      g.addColorStop(0, "rgba(150,90,255,.45)");
      g.addColorStop(1, "rgba(150,90,255,0)");
      ctx.globalCompositeOperation = "destination-over";
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(geo.cx, geo.groundY, geo.w * 0.4, geo.h * 0.04, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalCompositeOperation = "source-over";
      if (fade < 1) drawPose(prev, 1 - fade);
    };
    this._raf = requestAnimationFrame(tick);
  }
  disconnectedCallback() {
    cancelAnimationFrame(this._raf);
    this._cleanup && this._cleanup();
  }
}
if (!customElements.get("kairo-robot")) customElements.define("kairo-robot", KairoRobot);

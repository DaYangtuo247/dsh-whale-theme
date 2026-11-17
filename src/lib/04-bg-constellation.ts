
/* ------------------------------------------------------------------ *
 * 星座网格引擎（2D canvas）
 * ------------------------------------------------------------------ */
function startConstellation(bg) {
  var canvas = bg.constellationCanvas;
  var reducedMotion = bg.reducedMotion;
  var ctx = canvas.getContext("2d");
  if (!ctx) return;

  var dpr = Math.min(window.devicePixelRatio || 1, 2);
  var dots = [], cols = 0, rows = 0;
  var mouse = { x: NaN, y: NaN };
  var raf = 0 // the pending frame id: 0 while the loop is idle (mirrors the aurora engine)
  var drawnAt = -1; // bg.epoch of the frame on screen
  var idle = false;
  var last = 0;
  var FRAME = 1000 / 30;
  var resizeTimer = null;

  function buildGrid() {
    var w = canvas.clientWidth, h = canvas.clientHeight;
    cols = Math.ceil(w / 90) + 1;
    rows = Math.ceil(h / 90) + 1;
    var ox = (w - (cols - 1) * 90) / 2;
    var oy = (h - (rows - 1) * 90) / 2;
    dots = [];
    for (var y = 0; y < rows; y++) {
      for (var x = 0; x < cols; x++) {
        var rx = ox + 90 * x, ry = oy + 90 * y;
        dots.push({ restX: rx, restY: ry, x: rx, y: ry, vx: 0, vy: 0 });
      }
    }
  }
  function resize() {
    canvas.width = canvas.clientWidth * dpr;
    canvas.height = canvas.clientHeight * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    buildGrid();
  }
  resize();

  function onMove(e) {
    var r = canvas.getBoundingClientRect();
    mouse.x = e.clientX - r.left;
    mouse.y = e.clientY - r.top;
    wake();
  }
  if (!reducedMotion) window.addEventListener("mousemove", onMove, { passive: true });

  function draw(mx, my) {
    var opts = bg.constellation();
    var w = canvas.clientWidth, h = canvas.clientHeight;
    ctx.clearRect(0, 0, w, h);

    ctx.strokeStyle = opts.lineColor + " " + opts.lineOpacity + ")";
    ctx.lineWidth = 0.5;
    var i, j, a, b, dx, dy, dist, ux, uy;
    for (j = 0; j < rows; j++) {
      for (i = 0; i < cols - 1; i++) {
        a = dots[j * cols + i]; b = dots[j * cols + i + 1];
        dx = b.x - a.x; dy = b.y - a.y;
        dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 20) continue;
        ux = dx / dist; uy = dy / dist;
        ctx.beginPath();
        ctx.moveTo(a.x + 10 * ux, a.y + 10 * uy);
        ctx.lineTo(b.x - 10 * ux, b.y - 10 * uy);
        ctx.stroke();
      }
    }
    for (i = 0; i < cols; i++) {
      for (j = 0; j < rows - 1; j++) {
        a = dots[j * cols + i]; b = dots[(j + 1) * cols + i];
        dx = b.x - a.x; dy = b.y - a.y;
        dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 20) continue;
        ux = dx / dist; uy = dy / dist;
        ctx.beginPath();
        ctx.moveTo(a.x + 10 * ux, a.y + 10 * uy);
        ctx.lineTo(b.x - 10 * ux, b.y - 10 * uy);
        ctx.stroke();
      }
    }

    ctx.fillStyle = opts.dotColor + " " + opts.dotOpacity + ")";
    for (i = 0; i < dots.length; i++) {
      var p = dots[i];
      var n = 1.8, alpha = opts.dotOpacity;
      if (!isNaN(mx) && !isNaN(my)) {
        dx = p.x - mx; dy = p.y - my;
        dist = Math.sqrt(dx * dx + dy * dy);
        var l = Math.max(0, 1 - dist / 140);
        n = 1.8 + 2 * l;
        alpha = opts.dotOpacity + 0.4 * l;
      }
      ctx.globalAlpha = alpha;
      if (opts.round) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, n, 0, 2 * Math.PI);
        ctx.fill();
      } else {
        ctx.fillRect(p.x - n, p.y - n, 2 * n, 2 * n);
      }
    }
    ctx.globalAlpha = 1;
  }

  function wake() {
    if (idle) {
      idle = false;
      last = 0;
      if (!raf) raf = requestAnimationFrame(loop);
    }
  }

  function loop(now) {
    if (bg.halted('grid') && drawnAt === bg.epoch) { idle = true; raf = 0; return; } // still / hidden: no motion
    if (now - last < FRAME) { raf = requestAnimationFrame(loop); return; }
    last = now - (now - last) % FRAME;

    // 布局未就绪时补一次尺寸同步
    if (Math.round(canvas.clientWidth * dpr) !== canvas.width ||
        Math.round(canvas.clientHeight * dpr) !== canvas.height) {
      resize();
    }

    var mx = mouse.x, my = mouse.y;
    var maxSpeed = 0;
    for (var i = 0; i < dots.length; i++) {
      var p = dots[i];
      if (!isNaN(mx) && !isNaN(my)) {
        var dx = p.x - mx, dy = p.y - my;
        var d = Math.sqrt(dx * dx + dy * dy);
        if (d < 140 && d > 0.1) {
          var e = (1 - d / 140) * 30;
          var ux = dx / d, uy = dy / d;
          p.vx += ux * e * 0.1;
          p.vy += uy * e * 0.1;
        }
      }
      p.vx += 0.05 * (p.restX - p.x);
      p.vy += 0.05 * (p.restY - p.y);
      p.vx *= 0.85;
      p.vy *= 0.85;
      p.x += p.vx;
      p.y += p.vy;
      var sp = Math.abs(p.vx) + Math.abs(p.vy);
      if (sp > maxSpeed) maxSpeed = sp;
    }
    draw(mx, my);
    drawnAt = bg.epoch;
    if (maxSpeed < 0.01 || bg.halted('grid')) {
      idle = true;
      raf = 0;
      return;
    }
    raf = requestAnimationFrame(loop);
  }

  bg.onResume(wake); // theme / settings changed: draw again

  if (reducedMotion) {
    draw(NaN, NaN); // 静态单帧
  } else {
    idle = false;
    raf = requestAnimationFrame(loop);
  }

  window.addEventListener("resize", function () {
    if (resizeTimer) clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      resize();
      drawnAt = -1; // the canvas was cleared: draw again even while halted
      wake();
    }, 150);
  }, { passive: true });
}

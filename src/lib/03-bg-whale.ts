function startWhale(bg) {
  var canvas = bg.whaleCanvas;
  // premultipliedAlpha:true —— three.js WebGLRenderer 官方默认值，
  // 与官网 R3F 渲染管线一致（gl: {alpha:true, antialias:true}）
  var gl = canvas.getContext("webgl2", { alpha: true, premultipliedAlpha: true, antialias: true });
  if (!gl) { canvas.dataset.state = "no-webgl2"; return; }
  var img = new Image();
  img.onload = function () {
    var data;
    try { data = sampleWhalePixels(img); } catch (e) { canvas.dataset.state = "sample-fail"; return; }
    if (!data || data.count === 0) { canvas.dataset.state = "sample-empty"; return; }
    canvas.dataset.count = data.count;
    initWhaleGL(bg, gl, canvas, data);
  };
  img.onerror = function () { canvas.dataset.state = "img-fail"; };
  img.src = WHALE_SRC;
}

function initWhaleGL(bg, gl, canvas, data) {
  var reducedMotion = bg.reducedMotion;
  function compile(type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      if (typeof console !== "undefined") console.error("whale shader:", gl.getShaderInfoLog(s));
      return null;
    }
    return s;
  }
  var prog = gl.createProgram();
  gl.attachShader(prog, compile(gl.VERTEX_SHADER, WHALE_VS));
  gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, WHALE_FS));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    canvas.dataset.state = "link-fail";
    return;
  }
  canvas.dataset.state = "shader-ok";
  gl.useProgram(prog);

  function buf(attr, arr, size) {
    var loc = gl.getAttribLocation(prog, attr);
    var b = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, b);
    gl.bufferData(gl.ARRAY_BUFFER, arr, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
  }
  buf("aCenter", data.positions, 3);
  buf("aScattered", data.scatteredPositions, 3);
  buf("aOpacity", data.opacities, 1);
  buf("aEdge", data.edges, 1);
  var idx = new Float32Array(data.count);
  for (var i = 0; i < data.count; i++) idx[i] = i;
  buf("aIndex", idx, 1);
  // 官方实例缩放：s = .5 + 1*Math.random()（0.5–1.5）——粒子大小有变化，
  // 大粒子呈现小方块，是官方鲸鱼层次感的关键（chunk 776 源码原逻辑）
  var scaleArr = new Float32Array(data.count);
  for (var i2 = 0; i2 < data.count; i2++) scaleArr[i2] = 0.5 + 1 * Math.random();
  buf("aScale", scaleArr, 1);
  // position 属性默认 (0,0,0,1) —— 官方 BoxGeometry 的局部偏移对点精灵为 0

  var u: Record<string, WebGLUniformLocation | null> = {};
  ["uTime","uWaveSpeed","uWaveAmount","uMouse","uMouseRadius","uMouseStrength","uMouseDistort",
   "uAssembly","uLoose","uScatter","uLightPos","uLightRange","uShadeMin","uShadeMax",
   "uModel","uView","uProj","uPointScale","uColor"].forEach(function (n) { u[n] = gl.getUniformLocation(prog, n); });

  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE); // three.js AdditiveBlending
  gl.disable(gl.DEPTH_TEST);

  // 鼠标状态机（官方：mouseActive / mouseHasMoved）
  // the pointer in window pixels; turned into whale space each frame, taking out bg.shift (the layer is
  // moved onto the content area) so the particles still react under the cursor
  var mouse = { cx: 0, cy: 0, active: false, hasMoved: false };
  function onMove(e) {
    mouse.active = true;
    mouse.hasMoved = true;
    mouse.cx = e.clientX;
    mouse.cy = e.clientY;
  }
  function onLeave() { mouse.active = false; }
  function onVis() { if (document.hidden) mouse.active = false; }
  if (!reducedMotion) {
    window.addEventListener("mousemove", onMove, { passive: true });
    window.addEventListener("mouseleave", onLeave);
    document.addEventListener("visibilitychange", onVis);
  }

  var start = performance.now();
  var raf = 0;
  var drawn = false; // never pause before the first frame is on screen
  var drawnAt = -1; // bg.epoch of the frame on screen
  var last = 0;
  var FRAME = 1000 / 30;
  var strength = 0;
  var b = { x: 0, y: 0 };
  var FOV = 50 * Math.PI / 180;
  // 相机距离：官方 18 → 15（18/15 = 1.2），鲸鱼整体等比放大 1.2 倍
  var CAM_DIST = 15;
  var HALF_H = Math.tan(FOV / 2) * CAM_DIST; // viewport（z=0 平面）半高
  var view = m4Translation(0, 0, -15);

  function resize() {
    var w = canvas.clientWidth || 1, h = canvas.clientHeight || 1;
    var dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    gl.viewport(0, 0, canvas.width, canvas.height);
  }
  resize();

  function frame(now) {
    if (bg.halted('whale') && drawn && drawnAt === bg.epoch) { raf = 0; return; } // idle / still / hidden: the last frame stays on screen
    raf = requestAnimationFrame(frame);
    if (now - last < FRAME) return;
    var dt = Math.min(0.5, (now - last) / 1000);
    last = now - (now - last) % FRAME;

    var w = canvas.clientWidth || 1;
    if (Math.round(w * Math.min(window.devicePixelRatio || 1, 1.5)) !== canvas.width) resize();

    if (bg.still() && now - start < 3000) start = now - 30000; // 静止 before the 3 s assembly is done: the assembled whale
    var elapsed = (now - start) / 1000;
    var L = Math.max(0, Math.min(1, (elapsed - 0.3) / 2.5));
    var D = 1 - Math.pow(1 - L, 3); // 官方 easeOutCubic 组装

    // 官方 group 变换（fish：spin=false）
    var rotZ = elapsed * ((1 - D) * 0.3) + 0.04 * Math.sin(0.25 * elapsed);
    var rotX = 0.05 * Math.sin(0.08 * elapsed * 0.7);
    var rotY = 0.1 * Math.sin(0.08 * elapsed);
    var posY = 0.15 * Math.sin(0.4 * elapsed);
    var scale = 0.75 + 0.25 * D;
    var model = m4Mul(m4Mul(m4Translation(0, posY, 0),
      m4Mul(m4RotationZ(rotZ), m4Mul(m4RotationY(rotY), m4RotationX(rotX)))), m4Scale(scale));

    var aspect = canvas.width / canvas.height;
    var proj = m4Perspective(FOV, aspect, 0.1, 100);
    gl.uniformMatrix4fv(u.uModel, false, model);
    gl.uniformMatrix4fv(u.uView, false, view);
    gl.uniformMatrix4fv(u.uProj, false, proj);
    gl.uniform1f(u.uTime, elapsed);
    gl.uniform1f(u.uWaveSpeed, WAVE_DEFAULTS.speed);
    gl.uniform1f(u.uWaveAmount, WAVE_DEFAULTS.amount);
    gl.uniform1f(u.uAssembly, D);
    gl.uniform1f(u.uLoose, 1);
    gl.uniform1f(u.uScatter, 0);
    gl.uniform1f(u.uMouseRadius, MOUSE_DEFAULTS.radius);
    gl.uniform1f(u.uMouseDistort, MOUSE_DEFAULTS.distort);
    // 鼠标强度：官方以 (1-0.05^dt) 插值
    var target = mouse.active ? MOUSE_DEFAULTS.strength : 0;
    strength += (target - strength) * (1 - Math.pow(0.05, dt));
    gl.uniform1f(u.uMouseStrength, strength);
    // 光线：官方 lightParams.followX —— light.x 跟随鼠标世界坐标
    var halfW = HALF_H * aspect;
    var vw = window.innerWidth || 1, vh = window.innerHeight || 1;
    var mx = ((mouse.cx - bg.shift.x) / vw) * 2 - 1;
    var my = -(((mouse.cy - bg.shift.y) / vh) * 2 - 1);
    gl.uniform3f(u.uLightPos, LIGHT_DEFAULTS.x + mx * halfW * LIGHT_DEFAULTS.followX, LIGHT_DEFAULTS.y, LIGHT_DEFAULTS.z);
    gl.uniform1f(u.uLightRange, LIGHT_DEFAULTS.range);
    gl.uniform1f(u.uShadeMin, LIGHT_DEFAULTS.shadeMin);
    gl.uniform1f(u.uShadeMax, LIGHT_DEFAULTS.shadeMax);
    // uMouse：屏幕鼠标 → 世界(z=0) → 组局部空间（官方 matrixWorld 逆变换）
    if (mouse.hasMoved) {
      var wx = mx * halfW, wy = my * HALF_H;
      if (strength < 0.01) { b.x = wx; b.y = wy; }
      else { b.x += (wx - b.x) * MOUSE_DEFAULTS.decay; b.y += (wy - b.y) * MOUSE_DEFAULTS.decay; }
    }
    var inv = m4Inverse(model);
    var ux = inv[0]*b.x + inv[4]*b.y + inv[12];
    var uy = inv[1]*b.x + inv[5]*b.y + inv[13];
    gl.uniform2f(u.uMouse, ux, uy);
    // 颜色：官方 uColor = (.75P, .8P, .9P)，P = D*max(0,1-1.5E)
    // Light theme: the layer is shown as the dark whale's negative (CSS multiply through #dsh-ds-ink).
    // Additive blending puts more colour than alpha into the canvas, which a CSS filter would clamp, so
    // here alpha accumulates too and the colour is halved: a valid premultiplied image of the dark brightness.
    var light = !bg.state.dark, cs = light ? 0.5 : 1;
    gl.uniform3f(u.uColor, 0.75 * D * cs, 0.8 * D * cs, 0.9 * D * cs);
    if (light) gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE, gl.ONE, gl.ONE);
    else gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
    // 点尺寸：官方 BoxGeometry 0.06 单位 × 实例缩放 × 组缩放
    gl.uniform1f(u.uPointScale, 0.06 * scale * (canvas.height / (2 * HALF_H)));

    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.POINTS, 0, data.count);
    drawn = true;
    drawnAt = bg.epoch;
  }

  if (reducedMotion) {
    start = performance.now() - 30000; // 组装动画已完成的状态下绘制单帧
    last = 0;
    frame(performance.now());
    cancelAnimationFrame(raf);
    raf = 0;
  } else {
    raf = requestAnimationFrame(frame);
    bg.onResume(function () { if (!raf && !document.hidden) { last = 0; raf = requestAnimationFrame(frame); } });
  }
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible") {
      if (!raf && (!bg.halted('whale') || drawnAt !== bg.epoch)) raf = requestAnimationFrame(frame);
    } else if (raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
  });
}

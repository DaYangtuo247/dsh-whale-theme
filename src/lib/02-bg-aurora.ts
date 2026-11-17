/* ------------------------------------------------------------------ *
 * 极光引擎（WebGL2）
 * ------------------------------------------------------------------ */
function startAurora(bg) {
  var canvas = bg.auroraCanvas;
  var reducedMotion = bg.reducedMotion, coarse = bg.coarse, isWindows = bg.isWindows;
  var gl = canvas.getContext("webgl2", { alpha: true, premultipliedAlpha: false, powerPreference: "low-power" });
  if (!gl) return;

  function compile(type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null;
  }
  function link(vs, fs) {
    var p = gl.createProgram();
    gl.attachShader(p, vs);
    gl.attachShader(p, fs);
    gl.linkProgram(p);
    return gl.getProgramParameter(p, gl.LINK_STATUS) ? p : null;
  }
  var vs = compile(gl.VERTEX_SHADER, VERT);
  var progFlow = link(vs, compile(gl.FRAGMENT_SHADER, FLOWMAP_FS));
  var progFluid = link(vs, compile(gl.FRAGMENT_SHADER, FLUID_FS));
  if (!progFlow || !progFluid) return;

  var uFlow = {
    prev: gl.getUniformLocation(progFlow, "u_prev"),
    mouse: gl.getUniformLocation(progFlow, "u_mouse"),
    velocity: gl.getUniformLocation(progFlow, "u_velocity"),
    brushRadius: gl.getUniformLocation(progFlow, "u_brushRadius"),
    brushStrength: gl.getUniformLocation(progFlow, "u_brushStrength"),
    decay: gl.getUniformLocation(progFlow, "u_decay")
  };
  var uFluid = {
    time: gl.getUniformLocation(progFluid, "u_time"),
    resolution: gl.getUniformLocation(progFluid, "u_resolution"),
    scale: gl.getUniformLocation(progFluid, "u_scale"),
    offset: gl.getUniformLocation(progFluid, "u_offset"),
    grain: gl.getUniformLocation(progFluid, "u_grain"),
    speed: gl.getUniformLocation(progFluid, "u_speed"),
    flowmap: gl.getUniformLocation(progFluid, "u_flowmap"),
    distortBoost: gl.getUniformLocation(progFluid, "u_distortBoost"),
    swirlBoost: gl.getUniformLocation(progFluid, "u_swirlBoost"),
    glowIntensity: gl.getUniformLocation(progFluid, "u_glowIntensity"),
    glowColor1: gl.getUniformLocation(progFluid, "u_glowColor1"),
    glowColor2: gl.getUniformLocation(progFluid, "u_glowColor2"),
    glowColor3: gl.getUniformLocation(progFluid, "u_glowColor3"),
    c1: gl.getUniformLocation(progFluid, "u_c1"),
    c2: gl.getUniformLocation(progFluid, "u_c2"),
    c3: gl.getUniformLocation(progFluid, "u_c3"),
    c4: gl.getUniformLocation(progFluid, "u_c4"),
    c5: gl.getUniformLocation(progFluid, "u_c5"),
    lightPos: gl.getUniformLocation(progFluid, "u_lightPos"),
    lightCore: gl.getUniformLocation(progFluid, "u_lightCore"),
    lightHalo: gl.getUniformLocation(progFluid, "u_lightHalo"),
    vignette: gl.getUniformLocation(progFluid, "u_vignette"),
    bloomThreshold: gl.getUniformLocation(progFluid, "u_bloomThreshold"),
    bloomRange: gl.getUniformLocation(progFluid, "u_bloomRange"),
    bloomStrength: gl.getUniformLocation(progFluid, "u_bloomStrength")
  };

  var buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  function bindAttrib(prog) {
    var loc = gl.getAttribLocation(prog, "a_position");
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  }
  function makeTarget(w, h, data) {
    var tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    if (data) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
    else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    var fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return { fbo: fbo, tex: tex };
  }

  var W = 0, H = 0, wQ = 0, hQ = 0;
  var flip = false;
  var k = Math.min(window.devicePixelRatio || 1, 1.5);
  function resizeAll() {
    W = Math.round(canvas.clientWidth * k);
    H = Math.round(canvas.clientHeight * k);
    canvas.width = W; canvas.height = H;
    wQ = Math.round(W / 4); hQ = Math.round(H / 4);
    var init = new Uint8Array(wQ * hQ * 4);
    for (var i = 0; i < wQ * hQ; i++) { init[4 * i] = 0; init[4 * i + 1] = 128; init[4 * i + 2] = 128; init[4 * i + 3] = 255; }
    [targetA, targetB].forEach(function (t) { if (t) { gl.deleteTexture(t.tex); gl.deleteFramebuffer(t.fbo); } });
    targetA = makeTarget(wQ, hQ, init);
    targetB = makeTarget(wQ, hQ, init);
  }
  var targetA = null, targetB = null;
  resizeAll();

  var mouse = { x: 0.5, y: 0.5, smoothX: 0.5, smoothY: 0.5, vx: 0, vy: 0, svx: 0, svy: 0 };
  var useMouse = !reducedMotion && !coarse && !isWindows;
  function onMove(e) {
    var r = canvas.getBoundingClientRect();
    mouse.x = (e.clientX - r.left) / r.width;
    mouse.y = 1 - (e.clientY - r.top) / r.height;
  }
  if (useMouse) window.addEventListener("mousemove", onMove, { passive: true });

  var start = performance.now();
  var raf = 0;
  var drawn = false; // never pause before the first frame is on screen
  var drawnAt = -1; // bg.epoch of the frame on screen
  var running = true;
  var last = 0;
  var FRAME = 1000 / 30;

  function hex2rgb(hex) {
    var h = hex.replace("#", "");
    return [parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255];
  }

  function frame(now) {
    if (bg.halted('aurora') && drawn && drawnAt === bg.epoch) { raf = 0; return; } // idle / still / hidden: the last frame stays on screen
    raf = requestAnimationFrame(frame);
    if (!running || now - last < FRAME) return;
    last = now - (now - last) % FRAME;
    var cfg = bg.aurora();

    var kk = Math.min(window.devicePixelRatio || 1, 1.5);
    var w = Math.round(canvas.clientWidth * kk);
    var h = Math.round(canvas.clientHeight * kk);
    if (w !== W || h !== H) resizeAll();

    mouse.smoothX += (mouse.x - mouse.smoothX) * cfg.mouseSmoothing;
    mouse.smoothY += (mouse.y - mouse.smoothY) * cfg.mouseSmoothing;
    mouse.svx += ((mouse.x - mouse.smoothX) * 0.5 - mouse.svx) * cfg.mouseVelocity;
    mouse.svy += ((mouse.y - mouse.smoothY) * 0.5 - mouse.svy) * cfg.mouseVelocity;

    // --- flowmap pass（鼠标笔刷 → 低分辨率流场，双缓冲乒乓） ---
    var src = flip ? targetA : targetB;
    var dst = flip ? targetB : targetA;
    flip = !flip;
    gl.bindFramebuffer(gl.FRAMEBUFFER, dst.fbo);
    gl.viewport(0, 0, wQ, hQ);
    gl.useProgram(progFlow);
    bindAttrib(progFlow);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, src.tex);
    gl.uniform1i(uFlow.prev, 0);
    gl.uniform2f(uFlow.mouse, mouse.smoothX, mouse.smoothY);
    gl.uniform2f(uFlow.velocity, mouse.svx, mouse.svy);
    gl.uniform1f(uFlow.brushRadius, cfg.mouseRadius);
    gl.uniform1f(uFlow.brushStrength, useMouse ? cfg.mouseStrength : 0);
    gl.uniform1f(uFlow.decay, cfg.decay);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, W, H);

    // --- 渲染 ---
    var t = (performance.now() - start) * 0.001 * (cfg.speed / 100);
    gl.useProgram(progFluid);
    bindAttrib(progFluid);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, dst.tex);
    gl.uniform1i(uFluid.flowmap, 0);
    gl.uniform1f(uFluid.time, t);
    gl.uniform2f(uFluid.resolution, W, H);
    gl.uniform1f(uFluid.scale, cfg.scale);
    gl.uniform2f(uFluid.offset, cfg.offsetX / 100, cfg.offsetY / 100);
    gl.uniform1f(uFluid.grain, cfg.grain);
    gl.uniform1f(uFluid.distortBoost, cfg.distortBoost);
    gl.uniform1f(uFluid.swirlBoost, cfg.swirlBoost);
    var lx = cfg.lightX != null ? cfg.lightX : 0.89;
    var lf = useMouse && cfg.lightFollow != null ? cfg.lightFollow : 0;
    gl.uniform2f(uFluid.lightPos, lx + (mouse.smoothX - lx) * lf, cfg.lightY != null ? cfg.lightY : 0.46);
    gl.uniform1f(uFluid.lightCore, coarse ? 0 : (cfg.lightCore != null ? cfg.lightCore : 0.14));
    gl.uniform1f(uFluid.lightHalo, coarse ? 0 : (cfg.lightHalo != null ? cfg.lightHalo : 0.2));
    gl.uniform1f(uFluid.vignette, cfg.vignette != null ? cfg.vignette : 0.38);
    gl.uniform1f(uFluid.bloomThreshold, cfg.bloomThreshold != null ? cfg.bloomThreshold : 0.61);
    gl.uniform1f(uFluid.bloomRange, cfg.bloomRange != null ? cfg.bloomRange : 0.18);
    gl.uniform1f(uFluid.bloomStrength, cfg.bloomStrength != null ? cfg.bloomStrength : 0.4);
    gl.uniform1f(uFluid.glowIntensity, cfg.glowIntensity);
    var gc1 = hex2rgb(cfg.glowColors[0] || "#ffffff");
    var gc2 = hex2rgb(cfg.glowColors[1] || cfg.glowColors[0] || "#ffffff");
    var gc3 = hex2rgb(cfg.glowColors[2] || cfg.glowColors[0] || "#ffffff");
    gl.uniform3f(uFluid.glowColor1, gc1[0], gc1[1], gc1[2]);
    gl.uniform3f(uFluid.glowColor2, gc2[0], gc2[1], gc2[2]);
    gl.uniform3f(uFluid.glowColor3, gc3[0], gc3[1], gc3[2]);
    var cs = cfg.colors || [];
    for (var ci = 0; ci < 5; ci++) {
      var c = hex2rgb(cs[ci] || cs[cs.length - 1] || "#000000");
      gl.uniform3f([uFluid.c1, uFluid.c2, uFluid.c3, uFluid.c4, uFluid.c5][ci], c[0], c[1], c[2]);
    }
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    drawn = true;
    drawnAt = bg.epoch;
  }

  if (reducedMotion) {
    // 单帧静态
    last = 0;
    running = true;
    frame(performance.now());
    cancelAnimationFrame(raf);
    raf = 0;
    running = false;
  } else {
    raf = requestAnimationFrame(frame);
    bg.onResume(function () { if (!raf && !document.hidden) { last = 0; raf = requestAnimationFrame(frame); } });
  }

  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible") {
      if (!raf && (!bg.halted('aurora') || drawnAt !== bg.epoch)) raf = requestAnimationFrame(frame);
    } else if (raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
  });
  // window resize: the frame itself re-measures; 05-background.js bumps bg.epoch so a halted loop draws once more
}

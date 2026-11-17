/*!
 * Background assets (top level, shared by the background engines): the WebGL shaders, the whale
 * texture and its particle sampling, and 4x4 matrix helpers. Pure data and functions, no page state.
 * Shaders and parameters are the deepseek.com hero's, as extracted by the original
 * dsh-client-ui-deepseek-bg v1.0.0 (MIT).
 */
/* ------------------------------------------------------------------ *
 * 着色器（与 DeepSeek 打包产物逐字一致）
 * ------------------------------------------------------------------ */
var VERT = "#version 300 es\nin vec4 a_position;\nout vec2 vUv;\nvoid main() {\n  vUv = a_position.xy * 0.5 + 0.5;\n  gl_Position = a_position;\n}\n";

var FLOWMAP_FS = "#version 300 es\n" +
  "precision mediump float;\n" +
  "in vec2 vUv;\n" +
  "uniform sampler2D u_prev;\n" +
  "uniform vec2 u_mouse;\n" +
  "uniform vec2 u_velocity;\n" +
  "uniform float u_brushRadius;\n" +
  "uniform float u_brushStrength;\n" +
  "uniform float u_decay;\n" +
  "out vec4 fragColor;\n" +
  "\n" +
  "void main() {\n" +
  "  vec4 prev = texture(u_prev, vUv);\n" +
  "\n" +
  "  prev.r *= u_decay;\n" +
  "  prev.gb = mix(vec2(0.5), prev.gb, u_decay);\n" +
  "\n" +
  "  float dist = distance(vUv, u_mouse);\n" +
  "\n" +
  "  float influence = exp(-dist * dist / (u_brushRadius * u_brushRadius * 0.5));\n" +
  "  influence = max(0.0, influence - 0.01);\n" +
  "\n" +
  "  float speed = length(u_velocity);\n" +
  "  float presenceStrength = u_brushStrength * 0.3;\n" +
  "  float velBonus = min(speed * 3.0, 0.7) * u_brushStrength;\n" +
  "  float totalStrength = presenceStrength + velBonus;\n" +
  "\n" +
  "  prev.r = max(prev.r, influence * totalStrength);\n" +
  "  float blendAmt = influence * min(totalStrength, 0.4) * 0.3;\n" +
  "  prev.g = mix(prev.g, clamp(u_velocity.x * 2.0 + 0.5, 0.0, 1.0), blendAmt);\n" +
  "  prev.b = mix(prev.b, clamp(u_velocity.y * 2.0 + 0.5, 0.0, 1.0), blendAmt);\n" +
  "\n" +
  "  fragColor = prev;\n" +
  "}\n";

var FLUID_FS = "#version 300 es\n" +
  "precision mediump float;\n" +
  "in vec2 vUv;\n" +
  "uniform float u_time;\n" +
  "uniform vec2 u_resolution;\n" +
  "uniform vec3 u_c1, u_c2, u_c3, u_c4, u_c5;\n" +
  "uniform float u_scale;\n" +
  "uniform vec2 u_offset;\n" +
  "uniform float u_grain;\n" +
  "uniform float u_speed;\n" +
  "uniform sampler2D u_flowmap;\n" +
  "uniform float u_distortBoost;\n" +
  "uniform float u_swirlBoost;\n" +
  "uniform float u_glowIntensity;\n" +
  "uniform vec3 u_glowColor1;\n" +
  "uniform vec3 u_glowColor2;\n" +
  "uniform vec3 u_glowColor3;\n" +
  "uniform vec2 u_lightPos;\n" +
  "uniform float u_lightCore;\n" +
  "uniform float u_lightHalo;\n" +
  "uniform float u_vignette;\n" +
  "uniform float u_bloomThreshold;\n" +
  "uniform float u_bloomRange;\n" +
  "uniform float u_bloomStrength;\n" +
  "out vec4 fragColor;\n" +
  "\n" +
  "vec3 mod289v3(vec3 x){return x-floor(x*(1./289.))*289.;}\n" +
  "vec4 mod289v4(vec4 x){return x-floor(x*(1./289.))*289.;}\n" +
  "vec4 permute(vec4 x){return mod289v4(((x*34.)+1.)*x);}\n" +
  "vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-.85373472095314*r;}\n" +
  "\n" +
  "float snoise(vec3 v){\n" +
  "  const vec2 C=vec2(1./6.,1./3.);\n" +
  "  const vec4 D=vec4(0.,.5,1.,2.);\n" +
  "  vec3 i=floor(v+dot(v,C.yyy));\n" +
  "  vec3 x0=v-i+dot(i,C.xxx);\n" +
  "  vec3 g=step(x0.yzx,x0.xyz);\n" +
  "  vec3 l=1.-g;\n" +
  "  vec3 i1=min(g.xyz,l.zxy);\n" +
  "  vec3 i2=max(g.xyz,l.zxy);\n" +
  "  vec3 x1=x0-i1+C.xxx;\n" +
  "  vec3 x2=x0-i2+C.yyy;\n" +
  "  vec3 x3=x0-D.yyy;\n" +
  "  i=mod289v3(i);\n" +
  "  vec4 p=permute(permute(permute(i.z+vec4(0.,i1.z,i2.z,1.))+i.y+vec4(0.,i1.y,i2.y,1.))+i.x+vec4(0.,i1.x,i2.x,1.));\n" +
  "  float n_=.142857142857;\n" +
  "  vec3 ns=n_*D.wyz-D.xzx;\n" +
  "  vec4 j=p-49.*floor(p*ns.z*ns.z);\n" +
  "  vec4 x_=floor(j*ns.z);\n" +
  "  vec4 y_=floor(j-7.*x_);\n" +
  "  vec4 x=x_*ns.x+ns.yyyy;\n" +
  "  vec4 y=y_*ns.x+ns.yyyy;\n" +
  "  vec4 h=1.-abs(x)-abs(y);\n" +
  "  vec4 b0=vec4(x.xy,y.xy);\n" +
  "  vec4 b1=vec4(x.zw,y.zw);\n" +
  "  vec4 s0=floor(b0)*2.+1.;\n" +
  "  vec4 s1=floor(b1)*2.+1.;\n" +
  "  vec4 sh=-step(h,vec4(0.));\n" +
  "  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;\n" +
  "  vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;\n" +
  "  vec3 p0=vec3(a0.xy,h.x);vec3 p1=vec3(a0.zw,h.y);\n" +
  "  vec3 p2=vec3(a1.xy,h.z);vec3 p3=vec3(a1.zw,h.w);\n" +
  "  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));\n" +
  "  p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;\n" +
  "  vec4 m=max(.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.);\n" +
  "  m=m*m;\n" +
  "  return 42.*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));\n" +
  "}\n" +
  "\n" +
  "float hash(vec2 p){\n" +
  "  vec3 p3=fract(vec3(p.xyx)*.1031);\n" +
  "  p3+=dot(p3,p3.yzx+33.33);\n" +
  "  return fract((p3.x+p3.y)*p3.z);\n" +
  "}\n" +
  "\n" +
  "float fbm(vec3 p){\n" +
  "  float v=0.,amp=.6;vec3 shift=vec3(100.);\n" +
  "  for(int i=0;i<1;i++){v+=amp*snoise(p);p=p*2.+shift;amp*=.4;}\n" +
  "  return v;\n" +
  "}\n" +
  "\n" +
  "float fluidNoise(vec2 uv,float t){\n" +
  "  float n1=fbm(vec3(uv*.6,t*.06));\n" +
  "  float n2=fbm(vec3(uv*.6+5.2,t*.06+1.3));\n" +
  "  vec2 w1=vec2(n1,n2)*.6;\n" +
  "  float n3=fbm(vec3((uv+w1)*.7+1.7,t*.05+3.1));\n" +
  "  float n4=fbm(vec3((uv+w1)*.7+9.2,t*.05+5.7));\n" +
  "  vec2 w2=vec2(n3,n4)*.5;\n" +
  "  return fbm(vec3((uv+w1+w2)*.5,t*.04));\n" +
  "}\n" +
  "\n" +
  "vec2 curlish(vec2 uv,float t){\n" +
  "  float eps=.02;\n" +
  "  float n=snoise(vec3(uv*.8,t));\n" +
  "  float nx=snoise(vec3((uv+vec2(eps,0.))*.8,t));\n" +
  "  float ny=snoise(vec3((uv+vec2(0.,eps))*.8,t));\n" +
  "  return vec2(-(ny-n)/eps,(nx-n)/eps)*.003;\n" +
  "}\n" +
  "\n" +
  "void main(){\n" +
  "  float aspect=u_resolution.x/u_resolution.y;\n" +
  "  vec2 uv=gl_FragCoord.xy/u_resolution;\n" +
  "  vec2 suv=vec2(uv.x*aspect, uv.y) * u_scale + u_offset;\n" +
  "  float t=u_time;\n" +
  "\n" +
  "  // Mouse interaction via flowmap\n" +
  "  vec4 flow = texture(u_flowmap, uv);\n" +
  "  float influence = flow.r;\n" +
  "  vec2 flowDir = (flow.gb - 0.5) * 2.0;\n" +
  "\n" +
  "  // Apply mouse distortion to UV\n" +
  "  suv += flowDir * influence * u_distortBoost * 0.8;\n" +
  "  // Apply mouse swirl\n" +
  "  float swirlAngle = influence * u_swirlBoost * 2.5;\n" +
  "  float cs = cos(swirlAngle), sn = sin(swirlAngle);\n" +
  "  vec2 delta = suv - vec2(uv.x * aspect, uv.y) * u_scale;\n" +
  "  suv += (mat2(cs, sn, -sn, cs) * delta - delta) * influence;\n" +
  "\n" +
  "  vec2 curl=curlish(suv,t*.04);\n" +
  "  vec2 uvD=suv+curl*12.;\n" +
  "  float f=fluidNoise(uvD,t);\n" +
  "  float swirl=snoise(vec3(uvD*.8+f*1.5,t*.035))*.5+.5;\n" +
  "  float n=f*.5+.5;\n" +
  "  vec3 col=mix(u_c1,u_c2,smoothstep(.2,.5,n));\n" +
  "  col=mix(col,u_c3,smoothstep(.35,.65,n+swirl*.25));\n" +
  "  col=mix(col,u_c4,smoothstep(.6,.85,swirl)*.55);\n" +
  "  col=mix(col,u_c5,smoothstep(.5,.8,n*swirl)*.35);\n" +
  "\n" +
  "  // Mouse proximity color shift: 3-color glow blended by distance + noise\n" +
  "  float glow = smoothstep(0.0, 0.8, influence);\n" +
  "  float glowNoise = snoise(vec3(uvD * 1.5, t * 0.08)) * 0.5 + 0.5;\n" +
  "  float glowDist = smoothstep(0.0, 1.0, influence);\n" +
  "  vec3 glowMix = mix(u_glowColor3, u_glowColor2, glowDist);\n" +
  "  glowMix = mix(glowMix, u_glowColor1, glowDist * glowNoise);\n" +
  "  col = mix(col, glowMix, glow * u_glowIntensity);\n" +
  "\n" +
  "  if(u_grain>0.0){\n" +
  "    vec2 flowOffset = (uvD - suv) * u_resolution.y;\n" +
  "    vec2 gp = floor((gl_FragCoord.xy + flowOffset) / 5.0);\n" +
  "    float gr=hash(gp)*2.-1.;\n" +
  "    col+=gr*u_grain;\n" +
  "  }\n" +
  "\n" +
  "  // Self-luminance bloom: bright fluid regions become their own light spots,\n" +
  "  // so glow follows the flow and mouse disturbance instead of a fixed point\n" +
  "  float luma=dot(col,vec3(.299,.587,.114));\n" +
  "  float bloom=smoothstep(u_bloomThreshold-u_bloomRange,u_bloomThreshold+u_bloomRange,luma);\n" +
  "  col+=(col*.85+vec3(.15,.145,.13))*bloom*u_bloomStrength;\n" +
  "\n" +
  "  // Virtual light source: soft warm core (same side as helm lighting)\n" +
  "  float ld=length((uv-u_lightPos)*vec2(aspect,1.));\n" +
  "  float core=exp(-ld*ld*4.5);\n" +
  "  float halo=exp(-ld*1.8);\n" +
  "  col+=vec3(1.,.97,.9)*core*u_lightCore+vec3(.72,.8,1.)*halo*u_lightHalo;\n" +
  "\n" +
  "  float vig=1.-smoothstep(.35,.75,length(uv-.5));\n" +
  "  col=mix(col*(1.-u_vignette),col,vig);\n" +
  "  fragColor=vec4(col,1.);\n" +
  "}\n";

/* ------------------------------------------------------------------ *
 * 粒子化鲸鱼引擎（官方移植：HeroDigitileR3F → 原生 WebGL2）
 * 源码取自官网 harness 页懒加载 chunk 776（未进缓存，已从官网抓取）：
 *   - 粒子位置：官方算法从 hero-whale.svg 像素亮度采样（60x60，边缘保留）
 *   - 顶点/片元 shader：官方 GLSL 逐字移植（three.js 矩阵替换为原生 uniform）
 *   - 交互：鼠标扭曲粒子（radius/strength/decay/distort）、光线跟随鼠标
 *     （lightParams.followX）、入场组装动画、松散漂移、游泳波动
 *   - 参数：DIGITILE_LIGHT_DEFAULTS / DIGITILE_MOUSE_DEFAULTS 与官方一致
 * ------------------------------------------------------------------ */
// 官方鲸鱼纹理（hero-whale.svg，抓自 https://www.deepseek.com/harness/images/hero-whale.svg）
var WHALE_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="18" viewBox="0 0 24 18" fill="none"><path d="M22.9168 1.43018C22.6713 1.31018 22.5658 1.53918 22.4223 1.65519C22.3733 1.69269 22.3318 1.74169 22.2903 1.78669C21.9317 2.1697 21.5127 2.42121 20.9657 2.39121C20.1657 2.34621 19.4827 2.59771 18.8787 3.20973C18.7502 2.45521 18.3236 2.0047 17.6746 1.71569C17.3351 1.56568 16.9916 1.41518 16.7536 1.08867C16.5876 0.856163 16.5421 0.597155 16.4591 0.341647C16.4061 0.187643 16.3536 0.0301382 16.1761 0.00363739C15.9836 -0.0263635 15.9081 0.135141 15.8326 0.270145C15.5306 0.822162 15.4136 1.43018 15.4251 2.0462C15.4516 3.43174 16.0366 4.53527 17.1991 5.3203C17.3311 5.4103 17.3651 5.5003 17.3236 5.63181C17.2441 5.90231 17.1501 6.16482 17.0671 6.43533C17.0141 6.60784 16.9351 6.64584 16.7501 6.57033C16.1121 6.30383 15.5611 5.90931 15.074 5.4328C14.2475 4.63328 13.5 3.75075 12.568 3.05973C12.349 2.89822 12.13 2.74822 11.9034 2.60522C10.9524 1.68169 12.028 0.923165 12.277 0.833162C12.5375 0.739159 12.3675 0.41615 11.5259 0.42015C10.6844 0.42365 9.91439 0.705658 8.93286 1.08117C8.78935 1.13767 8.63835 1.17867 8.48384 1.21267C7.59332 1.04367 6.66829 1.00617 5.70226 1.11517C3.88321 1.31768 2.43016 2.1777 1.36213 3.64575C0.0790928 5.4103 -0.222916 7.41536 0.146595 9.50642C0.535106 11.7105 1.66014 13.535 3.38869 14.9616C5.18125 16.4406 7.24581 17.1657 9.60138 17.0266C11.0319 16.9441 12.6245 16.7526 14.421 15.2321C14.874 15.4576 15.3496 15.5476 16.1381 15.6151C16.7456 15.6716 17.3306 15.5851 17.7836 15.4911C18.4931 15.3411 18.4441 14.6841 18.1876 14.5636C16.1081 13.595 16.5646 13.9891 16.1496 13.67C17.2061 12.42 18.8202 10.1979 19.3182 7.17235C19.3672 6.83834 19.4297 6.36783 19.4222 6.09732C19.4182 5.93231 19.4562 5.86831 19.6447 5.84931C20.1657 5.78931 20.6712 5.64681 21.1357 5.3913C22.4833 4.65528 23.0268 3.44624 23.1548 1.9972C23.1738 1.77569 23.1508 1.54668 22.9168 1.43018ZM11.1749 14.4736C9.15936 12.889 8.18184 12.3675 7.77832 12.39C7.40081 12.4125 7.46881 12.8445 7.55182 13.126C7.63882 13.404 7.75182 13.5955 7.91033 13.8396C8.01983 14.0011 8.09533 14.2411 7.80083 14.4216C7.15181 14.8231 6.02327 14.2866 5.97027 14.2601C4.65673 13.4865 3.5587 12.4655 2.78467 11.069C2.03715 9.72493 1.60314 8.28289 1.53164 6.74384C1.51264 6.37233 1.62214 6.24082 1.99215 6.17332C2.47916 6.08332 2.98118 6.06432 3.46769 6.13582C5.52476 6.43633 7.27581 7.35586 8.74385 8.8129C9.58188 9.64243 10.2159 10.634 10.8689 11.6025C11.5634 12.631 12.3105 13.611 13.262 14.4146C13.598 14.6961 13.866 14.9101 14.1225 15.0681C13.349 15.1546 12.058 15.1731 11.1749 14.4746V14.4736ZM12.141 8.25988C12.141 8.09488 12.273 7.96338 12.439 7.96338C12.4765 7.96338 12.5105 7.97088 12.541 7.98188C12.5825 7.99688 12.6205 8.01938 12.6505 8.05338C12.7035 8.10588 12.7335 8.18088 12.7335 8.25988C12.7335 8.42489 12.6015 8.55639 12.4355 8.55639C12.2695 8.55639 12.141 8.42489 12.141 8.25988ZM15.1415 9.79893C14.949 9.87793 14.7565 9.94544 14.5715 9.95294C14.2845 9.96794 13.9715 9.85143 13.8015 9.70893C13.5375 9.48742 13.3485 9.36342 13.2695 8.97691C13.2355 8.8119 13.2545 8.55639 13.2845 8.40989C13.3525 8.09438 13.277 7.89187 13.0545 7.70787C12.8735 7.55786 12.643 7.51636 12.39 7.51636C12.2955 7.51636 12.209 7.47486 12.1445 7.44136C12.039 7.38886 11.9519 7.25735 12.035 7.09585C12.0615 7.04335 12.19 6.91584 12.22 6.89334C12.5635 6.69784 12.9595 6.76184 13.326 6.90834C13.6655 7.04735 13.9225 7.30236 14.292 7.66287C14.6695 8.09838 14.7375 8.21838 14.9525 8.54539C15.1225 8.8009 15.277 9.06341 15.3831 9.36392C15.4471 9.55142 15.3641 9.70493 15.1415 9.79893Z" fill="#FFFFFF"/></svg>';
var WHALE_SRC = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(WHALE_SVG);
// 官方参数（chunk 776 源码常量，fish 变体：shadeMin .2 / shadeMax .4*2.79）——原值，未调参
var LIGHT_DEFAULTS = { x: 4.5, y: 5.5, z: 3, range: 14, shadeMin: 0.2, shadeMax: 1.116, followX: 1.05 };
var MOUSE_DEFAULTS = { radius: 4.9, strength: 0.8, decay: 0.2, distort: 5 };
var WAVE_DEFAULTS = { speed: 1.5, amount: 0.06 };

function sampleWhalePixels(img) {
  var T = 60;
  var c = document.createElement("canvas");
  c.width = T; c.height = T;
  var a = c.getContext("2d");
  a.fillStyle = "#000"; a.fillRect(0, 0, T, T);
  var r = Math.min(T / img.width, T / img.height);
  var o = img.width * r, s = img.height * r;
  a.drawImage(img, (T - o) / 2, (T - s) / 2, o, s);
  var d = a.getImageData(0, 0, T, T);
  var lum = new Float32Array(T * T);
  for (var i = 0; i < T * T; i++) lum[i] = (0.299 * d.data[4*i] + 0.587 * d.data[4*i+1] + 0.114 * d.data[4*i+2]) / 255;
  var positions = [], scattered = [], opacities = [], edges = [];
  var half = T / 2;
  function isEdge(x, y) {
    for (var yy = -2; yy <= 2; yy++) for (var xx = -2; xx <= 2; xx++) {
      if (xx === 0 && yy === 0) continue;
      var nx = x + xx, ny = y + yy;
      if (nx < 0 || ny < 0 || nx >= T || ny >= T) continue;
      if (lum[ny * T + nx] > 0.2) return false;
    }
    return true;
  }
  for (var y = 0; y < T; y++) for (var x = 0; x < T; x++) {
    var l = lum[y * T + x];
    if (l > 0.2 && !isEdge(x, y)) {
      positions.push((x - half) * 0.18, (half - y) * 0.18, 0);
      opacities.push(l);
      var ec = 0;
      for (var yy = -1; yy <= 1; yy++) for (var xx = -1; xx <= 1; xx++) {
        if (xx === 0 && yy === 0) continue;
        var nx = x + xx, ny = y + yy;
        if (nx < 0 || ny < 0 || nx >= T || ny >= T || lum[ny * T + nx] <= 0.2) ec++;
      }
      edges.push(ec / 8);
      var phi = Math.random() * Math.PI * 2;
      var th = Math.acos(2 * Math.random() - 1);
      var rad = 3 * (0.4 + 0.6 * Math.random());
      scattered.push(Math.sin(th) * Math.cos(phi) * rad, Math.sin(th) * Math.sin(phi) * rad, Math.cos(th) * rad * 0.5);
    }
  }
  return {
    positions: new Float32Array(positions),
    scatteredPositions: new Float32Array(scattered),
    opacities: new Float32Array(opacities),
    edges: new Float32Array(edges),
    count: positions.length / 3
  };
}

// ---- 官方 shader（GLSL 逐字移植，three.js 内建矩阵换为原生 uniform） ----
var WHALE_VS = "#version 300 es\n" +
  "precision highp float;\n" +
  "in vec3 position;\n" +
  "in float aOpacity;\n" +
  "in float aIndex;\n" +
  "in float aEdge;\n" +
  "in vec3 aScattered;\n" +
  "in vec3 aCenter;\n" +
  "in float aScale;\n" +
  "uniform float uTime;\n" +
  "uniform float uWaveSpeed;\n" +
  "uniform float uWaveAmount;\n" +
  "uniform vec2 uMouse;\n" +
  "uniform float uMouseRadius;\n" +
  "uniform float uMouseStrength;\n" +
  "uniform float uMouseDistort;\n" +
  "uniform float uAssembly;\n" +
  "uniform float uLoose;\n" +
  "uniform float uScatter;\n" +
  "uniform vec3 uLightPos;\n" +
  "uniform float uLightRange;\n" +
  "uniform float uShadeMin;\n" +
  "uniform float uShadeMax;\n" +
  "uniform mat4 uModel;\n" +
  "uniform mat4 uView;\n" +
  "uniform mat4 uProj;\n" +
  "uniform float uPointScale;\n" +
  "out float vOpacity;\n" +
  "out vec3 vWorldPos;\n" +
  "out float vAssembly;\n" +
  "out float vLight;\n" +
  "void main() {\n" +
  "  vOpacity = aOpacity;\n" +
  "  vAssembly = uAssembly;\n" +
  "  vec3 targetCenter = aCenter;\n" +
  "  vec3 localOffset = position * aScale;\n" +
  "  vec3 scatteredCenter = aScattered;\n" +
  "  float assembly = smoothstep(0.0, 1.0, uAssembly);\n" +
  "  vec3 center = mix(scatteredCenter, targetCenter, assembly);\n" +
  "  vec3 pos = center + localOffset;\n" +
  "  vWorldPos = center;\n" +
  "  float loose = uLoose * mix(0.25, 1.0, aEdge) * assembly;\n" +
  "  if (loose > 0.001) {\n" +
  "    vec3 jitter = vec3(\n" +
  "      fract(sin(aIndex * 12.9898) * 43758.5453) - 0.5,\n" +
  "      fract(sin(aIndex * 78.2330) * 12543.1230) - 0.5,\n" +
  "      fract(sin(aIndex * 39.4250) * 26711.7700) - 0.5\n" +
  "    );\n" +
  "    pos += jitter * 0.05 * loose;\n" +
  "    pos.x += sin(uTime * 0.50 + aIndex * 0.53) * 0.06 * loose;\n" +
  "    pos.y += cos(uTime * 0.42 + aIndex * 0.71) * 0.06 * loose;\n" +
  "    pos.z += sin(uTime * 0.36 + aIndex * 0.91) * 0.08 * loose;\n" +
  "    float tail = smoothstep(0.5, 4.5, targetCenter.x) * uLoose * assembly;\n" +
  "    pos.y += sin(uTime * 1.1 - targetCenter.x * 0.7) * 0.1 * tail;\n" +
  "    pos.z += cos(uTime * 0.9 - targetCenter.x * 0.55) * 0.06 * tail;\n" +
  "  }\n" +
  "  if (uScatter > 0.001) {\n" +
  "    float disperse = uScatter * mix(0.5, 1.0, aEdge);\n" +
  "    pos += (scatteredCenter - center) * disperse;\n" +
  "    pos.z += sin(uTime * 0.6 + aIndex * 0.3) * disperse * 0.6;\n" +
  "  }\n" +
  "  if (assembly > 0.95) {\n" +
  "    float effectStrength = (assembly - 0.95) * 20.0;\n" +
  "    float dist = length(center.xy);\n" +
  "    float waveFade = smoothstep(0.0, 3.0, dist);\n" +
  "    float wave = sin(dist * 3.0 - uTime * uWaveSpeed) * uWaveAmount * effectStrength * waveFade;\n" +
  "    pos.z += wave;\n" +
  "  }\n" +
  "  if (assembly > 0.8) {\n" +
  "    float mouseEffect = (assembly - 0.8) * 5.0;\n" +
  "    vec2 toMouse = center.xy - uMouse;\n" +
  "    float mouseDist = length(toMouse);\n" +
  "    if (mouseDist < uMouseRadius && mouseDist > 0.001) {\n" +
  "      float t = 1.0 - mouseDist / uMouseRadius;\n" +
  "      float force = t * t * t * mouseEffect * uMouseStrength;\n" +
  "      vec2 radialDir = toMouse / mouseDist;\n" +
  "      float noiseAngle = sin(aIndex * 0.37 + uTime * 0.5) * uMouseDistort;\n" +
  "      float ca = cos(noiseAngle);\n" +
  "      float sa = sin(noiseAngle);\n" +
  "      vec2 pushDir = vec2(radialDir.x * ca - radialDir.y * sa, radialDir.x * sa + radialDir.y * ca);\n" +
  "      pos.xy += pushDir * force * 2.0;\n" +
  "      pos.z += sin(aIndex * 1.7 + uTime) * force * 0.8;\n" +
  "    }\n" +
  "  }\n" +
  "  if (assembly < 0.9) {\n" +
  "    float scatter = smoothstep(0.9, 0.0, assembly);\n" +
  "    pos.x += sin(uTime * 0.5 + aIndex * 0.1) * 0.2 * scatter;\n" +
  "    pos.y += cos(uTime * 0.4 + aIndex * 0.07) * 0.2 * scatter;\n" +
  "    pos.z += sin(uTime * 0.3 + aIndex * 0.13) * 0.15 * scatter;\n" +
  "  }\n" +
  "  vec4 worldPos = uModel * vec4(pos, 1.0);\n" +
  "  float lightDist = distance(worldPos.xyz, uLightPos);\n" +
  "  float lit = clamp(1.0 - lightDist / uLightRange, 0.0, 1.0);\n" +
  "  vLight = mix(uShadeMin, uShadeMax, lit * lit);\n" +
  "  vec4 mvPosition = uView * uModel * vec4(pos, 1.0);\n" +
  "  gl_PointSize = max(1.0, uPointScale * aScale);\n" +
  "  gl_Position = uProj * mvPosition;\n" +
  "}\n";

var WHALE_FS = "#version 300 es\n" +
  "precision highp float;\n" +
  "in float vOpacity;\n" +
  "in vec3 vWorldPos;\n" +
  "in float vAssembly;\n" +
  "in float vLight;\n" +
  "uniform float uTime;\n" +
  "uniform vec3 uColor;\n" +
  "out vec4 fragColor;\n" +
  "void main() {\n" +
  "  float dist = length(vWorldPos.xy);\n" +
  "  float glow = smoothstep(8.0, 0.0, dist) * 0.3 * vAssembly;\n" +
  "  float baseAlpha = mix(0.45, 0.75, vAssembly);\n" +
  "  float alpha = vOpacity * (baseAlpha + glow);\n" +
  "  float shimmer = sin(uTime * 1.5 + vWorldPos.x * 5.0 + vWorldPos.y * 3.0) * 0.1 + 0.9;\n" +
  "  alpha *= shimmer * min(vLight, 1.0);\n" +
  "  vec3 color = (uColor + glow * vec3(0.2, 0.3, 0.5)) * vLight;\n" +
  "  color = mix(color, color * vec3(1.07, 1.02, 0.94), clamp(vLight - 1.0, 0.0, 1.0));\n" +
  "  fragColor = vec4(color, alpha);\n" +
  "}\n";

// ---- 4x4 矩阵工具（列主序，与 WebGL uniform 一致） ----
function m4Identity() { return new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]); }
function m4Mul(a, b) {
  var o = new Float32Array(16);
  for (var c = 0; c < 4; c++) for (var r = 0; r < 4; r++) {
    o[c*4+r] = a[0*4+r]*b[c*4+0] + a[1*4+r]*b[c*4+1] + a[2*4+r]*b[c*4+2] + a[3*4+r]*b[c*4+3];
  }
  return o;
}
function m4Translation(tx, ty, tz) {
  var m = m4Identity(); m[12] = tx; m[13] = ty; m[14] = tz; return m;
}
function m4RotationX(a) { var c = Math.cos(a), s = Math.sin(a); var m = m4Identity(); m[5] = c; m[6] = s; m[9] = -s; m[10] = c; return m; }
function m4RotationY(a) { var c = Math.cos(a), s = Math.sin(a); var m = m4Identity(); m[0] = c; m[2] = -s; m[8] = s; m[10] = c; return m; }
function m4RotationZ(a) { var c = Math.cos(a), s = Math.sin(a); var m = m4Identity(); m[0] = c; m[1] = s; m[4] = -s; m[5] = c; return m; }
function m4Scale(s) { var m = m4Identity(); m[0] = s; m[5] = s; m[10] = s; return m; }
function m4Perspective(fovY, aspect, near, far) {
  var f = 1 / Math.tan(fovY / 2), nf = 1 / (near - far);
  return new Float32Array([f/aspect,0,0,0, 0,f,0,0, 0,0,(far+near)*nf,-1, 0,0,2*far*near*nf,0]);
}
function m4Inverse(m) {
  var o = new Float32Array(16);
  var i = new Float32Array([m[0],m[4],m[8],m[12], m[1],m[5],m[9],m[13], m[2],m[6],m[10],m[14], m[3],m[7],m[11],m[15]]);
  var d = 1 / (i[0]*i[5]*i[10]*i[15] - i[0]*i[5]*i[11]*i[14] - i[0]*i[9]*i[6]*i[15] + i[0]*i[9]*i[7]*i[14] +
              i[0]*i[13]*i[6]*i[11] - i[0]*i[13]*i[7]*i[10] - i[4]*i[1]*i[10]*i[15] + i[4]*i[1]*i[11]*i[14] +
              i[4]*i[9]*i[2]*i[15] - i[4]*i[9]*i[3]*i[14] - i[4]*i[13]*i[2]*i[11] + i[4]*i[13]*i[3]*i[10] +
              i[8]*i[1]*i[6]*i[15] - i[8]*i[1]*i[7]*i[14] - i[8]*i[5]*i[2]*i[15] + i[8]*i[5]*i[3]*i[14] +
              i[8]*i[13]*i[2]*i[7] - i[8]*i[13]*i[3]*i[6] - i[12]*i[1]*i[6]*i[11] + i[12]*i[1]*i[7]*i[10] +
              i[12]*i[5]*i[2]*i[11] - i[12]*i[5]*i[3]*i[10] - i[12]*i[9]*i[2]*i[7] + i[12]*i[9]*i[3]*i[6]);
  o[0] = (i[5]*i[10]*i[15] - i[5]*i[11]*i[14] - i[9]*i[6]*i[15] + i[9]*i[7]*i[14] + i[13]*i[6]*i[11] - i[13]*i[7]*i[10]) * d;
  o[4] = (-i[4]*i[10]*i[15] + i[4]*i[11]*i[14] + i[8]*i[6]*i[15] - i[8]*i[7]*i[14] - i[12]*i[6]*i[11] + i[12]*i[7]*i[10]) * d;
  o[8] = (i[4]*i[9]*i[15] - i[4]*i[11]*i[13] - i[8]*i[5]*i[15] + i[8]*i[7]*i[13] + i[12]*i[5]*i[11] - i[12]*i[9]*i[7]) * d;
  o[12] = (-i[4]*i[9]*i[14] + i[4]*i[10]*i[13] + i[8]*i[5]*i[14] - i[8]*i[6]*i[13] - i[12]*i[5]*i[10] + i[12]*i[9]*i[6]) * d;
  o[1] = (-i[1]*i[10]*i[15] + i[1]*i[11]*i[14] + i[9]*i[2]*i[15] - i[9]*i[3]*i[14] - i[13]*i[2]*i[11] + i[13]*i[3]*i[10]) * d;
  o[5] = (i[0]*i[10]*i[15] - i[0]*i[11]*i[14] - i[8]*i[2]*i[15] + i[8]*i[3]*i[14] + i[12]*i[2]*i[11] - i[12]*i[3]*i[10]) * d;
  o[9] = (-i[0]*i[9]*i[15] + i[0]*i[11]*i[13] + i[8]*i[1]*i[15] - i[8]*i[3]*i[13] - i[12]*i[1]*i[11] + i[12]*i[9]*i[3]) * d;
  o[13] = (i[0]*i[9]*i[14] - i[0]*i[10]*i[13] - i[8]*i[1]*i[14] + i[8]*i[2]*i[13] + i[12]*i[1]*i[10] - i[12]*i[9]*i[2]) * d;
  o[2] = (i[1]*i[6]*i[15] - i[1]*i[7]*i[14] - i[5]*i[2]*i[15] + i[5]*i[3]*i[14] + i[13]*i[2]*i[7] - i[13]*i[3]*i[6]) * d;
  o[6] = (-i[0]*i[6]*i[15] + i[0]*i[7]*i[14] + i[4]*i[2]*i[15] - i[4]*i[3]*i[14] - i[12]*i[2]*i[7] + i[12]*i[3]*i[6]) * d;
  o[10] = (i[0]*i[5]*i[15] - i[0]*i[7]*i[13] - i[4]*i[1]*i[15] + i[4]*i[3]*i[13] + i[12]*i[1]*i[7] - i[12]*i[5]*i[3]) * d;
  o[14] = (-i[0]*i[5]*i[14] + i[0]*i[6]*i[13] + i[4]*i[1]*i[14] - i[4]*i[2]*i[13] - i[12]*i[1]*i[6] + i[12]*i[5]*i[2]) * d;
  o[3] = (-i[1]*i[6]*i[11] + i[1]*i[7]*i[10] + i[5]*i[2]*i[11] - i[5]*i[3]*i[10] - i[9]*i[2]*i[7] + i[9]*i[3]*i[6]) * d;
  o[7] = (i[0]*i[6]*i[11] - i[0]*i[7]*i[10] - i[4]*i[2]*i[11] + i[4]*i[3]*i[10] + i[8]*i[2]*i[7] - i[8]*i[3]*i[6]) * d;
  o[11] = (-i[0]*i[5]*i[11] + i[0]*i[7]*i[9] + i[4]*i[1]*i[11] - i[4]*i[3]*i[9] - i[8]*i[1]*i[7] + i[8]*i[5]*i[3]) * d;
  o[15] = (i[0]*i[5]*i[10] - i[0]*i[6]*i[9] - i[4]*i[1]*i[10] + i[4]*i[2]*i[9] + i[8]*i[1]*i[6] - i[8]*i[5]*i[2]) * d;
  return o;
}

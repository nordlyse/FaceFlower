function startPrismBackground(canvas) {
  const gl = canvas.getContext("webgl", {
    alpha: false,
    antialias: false,
    depth: false,
    stencil: false,
    powerPreference: "low-power",
  });
  if (!gl) {
    return;
  }

  const vertexSrc =
    "attribute vec2 aPos;void main(){gl_Position=vec4(aPos,0.0,1.0);}";

  const fragmentSrc = [
    "precision highp float;",
    "uniform vec2 uRes;",
    "uniform float uTime;",
    "float sdOcta(vec3 p,float s){p=abs(p);return (p.x+p.y+p.z-s)*0.57735027;}",
    "float sdCrystal(vec3 p){float body=sdOcta(p,1.05);float cut=-p.y-0.22;return max(body,cut);}",
    "void main(){",
    "  vec2 uv=(gl_FragCoord.xy-0.5*uRes)/min(uRes.x,uRes.y);",
    "  uv.y+=0.08;",
    "  float t=uTime*0.42;",
    "  float c=cos(t); float s=sin(t);",
    "  mat2 yaw=mat2(c,-s,s,c);",
    "  float c2=cos(0.48); float s2=sin(0.48);",
    "  mat2 tilt=mat2(c2,-s2,s2,c2);",
    "  vec3 ro=vec3(0.0,0.18,2.9);",
    "  vec3 rd=normalize(vec3(uv*1.2,-1.38));",
    "  vec3 acc=vec3(0.0);",
    "  float z=0.0;",
    "  for(int i=0;i<52;i++){",
    "    vec3 p=ro+rd*z;",
    "    p.xz=yaw*p.xz;",
    "    p.yz=tilt*p.yz;",
    "    float d=abs(sdCrystal(p))*0.3+0.016;",
    "    z+=d;",
    "    vec3 pal=0.54+0.46*cos(6.28318*(vec3(0.0,0.33,0.67)+p.y*0.9+z*0.11+t*0.12));",
    "    acc+=pal/(11.0+d*95.0);",
    "  }",
    "  acc*=1.7;",
    "  acc=acc/(1.0+acc);",
    "  float peak=max(acc.r,max(acc.g,acc.b));",
    "  vec3 chroma=acc/max(peak,0.001);",
    "  acc=mix(vec3(0.90,0.905,0.93),chroma,clamp(peak*1.48,0.0,0.86));",
    "  gl_FragColor=vec4(acc,1.0);",
    "}",
  ].join("\n");

  function compile(type, src) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, src);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  const vs = compile(gl.VERTEX_SHADER, vertexSrc);
  const fs = compile(gl.FRAGMENT_SHADER, fragmentSrc);
  if (!vs || !fs) {
    return;
  }

  const program = gl.createProgram();
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.bindAttribLocation(program, 0, "aPos");
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    return;
  }
  gl.useProgram(program);

  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  const uRes = gl.getUniformLocation(program, "uRes");
  const uTime = gl.getUniformLocation(program, "uTime");
  const startedAt = performance.now();
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let frame = 0;

  function resize() {
    const dpr = Math.min(1.25, window.devicePixelRatio || 1);
    const w = Math.max(1, window.innerWidth);
    const h = Math.max(1, window.innerHeight);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(uRes, canvas.width, canvas.height);
  }

  function draw(now) {
    if (document.hidden) {
      return;
    }
    gl.uniform1f(uTime, reduced ? 0.8 : (now - startedAt) * 0.001);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    if (!reduced) {
      frame = window.requestAnimationFrame(draw);
    }
  }

  function onVis() {
    if (document.hidden) {
      window.cancelAnimationFrame(frame);
    } else {
      frame = window.requestAnimationFrame(draw);
    }
  }

  window.addEventListener("resize", resize);
  document.addEventListener("visibilitychange", onVis);
  resize();
  frame = window.requestAnimationFrame(draw);
  canvas._prismFrame = frame;
}

document.addEventListener("DOMContentLoaded", () => {
  const canvas = document.getElementById("prism-bg");
  if (canvas) {
    startPrismBackground(canvas);
  }
});

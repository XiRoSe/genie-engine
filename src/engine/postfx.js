import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { Pass } from "three/addons/postprocessing/Pass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

// AAA post-processing chain, engine-wide. The scene is rendered THROUGH the cel-shade OutlineEffect into a
// linear HDR target (so the ink outlines survive), then bloom lights up all the emissive/neon, a linear-space
// colour-grade + vignette shapes the mood, and OutputPass does the ACES tone-map (+ renderer exposure) + sRGB.
// Tone-mapping happens ONLY in OutputPass (the intermediate targets are linear), so nothing is double-mapped.

// render the active scene via the OutlineEffect into the composer's read buffer (mirrors three's RenderPass)
class OutlineRenderPass extends Pass {
  constructor(outline, getActive) { super(); this.outline = outline; this.getActive = getActive; this.clear = true; this.needsSwap = false; }
  render(renderer, writeBuffer, readBuffer) {
    const a = this.getActive(); if (!a) return;
    const oldAutoClear = renderer.autoClear; renderer.autoClear = false;
    renderer.setRenderTarget(this.renderToScreen ? null : readBuffer);
    if (this.clear) renderer.clear(renderer.autoClearColor, renderer.autoClearDepth, renderer.autoClearStencil);
    this.outline.render(a.scene, a.camera);
    renderer.autoClear = oldAutoClear;
  }
}

// linear-space colour grade + vignette (applied before OutputPass tone-maps)
const GradeShader = {
  uniforms: {
    tDiffuse: { value: null }, saturation: { value: 1.12 }, contrast: { value: 1.05 },
    tint: { value: new THREE.Vector3(1, 1, 1) }, vignette: { value: 0.3 },
  },
  vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float saturation, contrast, vignette; uniform vec3 tint; varying vec2 vUv;
    void main() {
      vec3 col = texture2D(tDiffuse, vUv).rgb;
      float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
      col = mix(vec3(l), col, saturation);          // saturation
      col = mix(vec3(0.18), col, contrast);         // contrast around linear mid-grey
      col *= tint;                                  // hue push
      vec2 d = vUv - 0.5; col *= 1.0 - vignette * dot(d, d); // vignette (darker corners)
      gl_FragColor = vec4(max(col, 0.0), 1.0);
    }`,
};

export class PostFX {
  constructor(renderer, outline, getActive) {
    const size = renderer.getSize(new THREE.Vector2());
    this.composer = new EffectComposer(renderer);
    this.composer.setPixelRatio(renderer.getPixelRatio());
    this.composer.addPass(new OutlineRenderPass(outline, getActive));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), 0.5, 0.7, 0.85); // (res, strength, radius, threshold)
    this.composer.addPass(this.bloom);
    this.grade = new ShaderPass(GradeShader);
    this.composer.addPass(this.grade);
    this.composer.addPass(new OutputPass());               // ACES tone-map (+ renderer exposure) + sRGB → screen
  }
  setSize(w, h) { this.composer.setSize(w, h); }
  render(dt) { this.composer.render(dt); }
  // per-level look — omit a field to keep the tasteful default
  configure({ bloom, radius, threshold, saturation, contrast, tint, vignette } = {}) {
    if (bloom != null) this.bloom.strength = bloom;
    if (radius != null) this.bloom.radius = radius;
    if (threshold != null) this.bloom.threshold = threshold;
    const u = this.grade.uniforms;
    if (saturation != null) u.saturation.value = saturation;
    if (contrast != null) u.contrast.value = contrast;
    if (vignette != null) u.vignette.value = vignette;
    if (tint) u.tint.value.set(tint[0], tint[1], tint[2]);
  }
}

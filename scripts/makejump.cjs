// Convert the Mixamo "Salsa Dancing" FBX (already on Rick's UE4 skeleton) into a tiny animation-only GLB —
// same shape as rick_walk/rick_run/rick_gun: strip the mesh + skin, keep only the animation, zero the root
// translation so Rick dances IN PLACE (doesn't drift off the podium).
const convert = require("fbx2gltf");
const { NodeIO } = require("@gltf-transform/core");
const { prune } = require("@gltf-transform/functions");
const path = require("path");

const SRC = "C:/Users/aniha/Downloads/rick model/Jump.fbx";
const TMP = path.resolve("./scripts/_jump_raw.glb");
const OUT = path.resolve("./public/models/rick_jump.glb");

(async () => {
  console.log("converting FBX -> GLB ...");
  await convert(SRC, TMP, ["--binary"]);
  console.log("processing (strip mesh, zero root) ...");
  const io = new NodeIO();
  const doc = await io.read(TMP);
  const root = doc.getRoot();

  // strip all meshes off the nodes + dispose them (keep the skeleton nodes so the animation still binds by name)
  for (const node of root.listNodes()) if (node.getMesh()) node.setMesh(null);
  for (const mesh of root.listMeshes()) mesh.dispose();
  for (const skin of root.listSkins()) skin.dispose();

  // zero the root translation keyframes → dance in place. The root/hips node drives global position.
  const anims = root.listAnimations();
  let zeroed = 0;
  for (const anim of anims) {
    for (const ch of anim.listChannels()) {
      if (ch.getTargetPath() !== "translation") continue;
      const node = ch.getTargetNode();
      const nm = (node && node.getName() || "").toLowerCase();
      if (!/hips|pelvis|root|armature/.test(nm)) continue; // only the root drives world drift
      const samp = ch.getSampler(); const out = samp.getOutput();
      const arr = Array.from(out.getArray());
      const stride = 3; // vec3 translation
      // hold the first frame's value for every keyframe → no motion
      for (let i = 0; i < arr.length; i += stride) { arr[i] = arr[0]; arr[i + 1] = arr[1]; arr[i + 2] = arr[2]; }
      out.setArray(new Float32Array(arr));
      zeroed++;
    }
  }
  doc.transform(prune());
  await io.write(OUT, doc);
  const dur = root.listAnimations().map((a) => a.listChannels().length);
  console.log(`wrote ${OUT}  (anims=${anims.length}, rootChannelsZeroed=${zeroed}, channelsPerAnim=${dur})`);
})().catch((e) => { console.error("ERR", e); process.exit(1); });

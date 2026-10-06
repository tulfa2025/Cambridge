// Materials override v2.2 — fix de environment y lighting para que la
// cabina se vea como un interior real (no como bajo cielo abierto).
//
// Se activa con ?materials=v2 en la URL.
//
// Cambios respecto al default:
//   1. Bloquea el HDR exterior (suburban_garden) y lo reemplaza por un
//      environment procedural NEUTRO interior (cielo blanco suave, piso gris).
//   2. Elimina la PointLight warm (era la que daba el spot amarillo en techo).
//   3. Agrega SpotLight cenital que simula los plafones del propio elevador.
//   4. Repeats por categoría + normal/roughness procedurales.
//   5. Clearcoat en maderas/melaminas, envMapIntensity contenido (no quiero
//      que las paredes mireen el environment con fuerza).

import * as THREE from "./vendor/three/three.module.js";

const procTextureCache = new Map();
const imageCache = new Map();

function loadImage(path) {
  if (imageCache.has(path)) return imageCache.get(path);
  const promise = new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = path;
  });
  imageCache.set(path, promise);
  return promise;
}

function getProceduralMaps(path, { THREE }) {
  if (procTextureCache.has(path)) return procTextureCache.get(path);

  const normalPlaceholder = new THREE.DataTexture(
    new Uint8Array([128, 128, 255, 255]), 1, 1, THREE.RGBAFormat
  );
  normalPlaceholder.needsUpdate = true;
  normalPlaceholder.wrapS = THREE.RepeatWrapping;
  normalPlaceholder.wrapT = THREE.RepeatWrapping;

  const roughPlaceholder = new THREE.DataTexture(
    new Uint8Array([180, 180, 180, 255]), 1, 1, THREE.RGBAFormat
  );
  roughPlaceholder.needsUpdate = true;
  roughPlaceholder.wrapS = THREE.RepeatWrapping;
  roughPlaceholder.wrapT = THREE.RepeatWrapping;

  const entry = { normalMap: normalPlaceholder, roughnessMap: roughPlaceholder };
  procTextureCache.set(path, entry);

  loadImage(path).then((img) => {
    const size = Math.min(1024, Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, size, size);
    const src = ctx.getImageData(0, 0, size, size).data;

    const lum = new Float32Array(size * size);
    for (let i = 0, j = 0; i < src.length; i += 4, j += 1) {
      lum[j] = 0.299 * src[i] + 0.587 * src[i + 1] + 0.114 * src[i + 2];
    }

    // Normal map por gradiente fuerte (luego atenuado con normalScale).
    const normalData = new Uint8Array(size * size * 4);
    const strength = 6.0;
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const xm = (x - 1 + size) % size;
        const xp = (x + 1) % size;
        const ym = (y - 1 + size) % size;
        const yp = (y + 1) % size;
        const dx = (lum[y * size + xp] - lum[y * size + xm]) / 255 * strength;
        const dy = (lum[yp * size + x] - lum[ym * size + x]) / 255 * strength;
        const nx = -dx;
        const ny = -dy;
        const nz = 1.0;
        const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
        const k = (y * size + x) * 4;
        normalData[k]     = Math.round((nx / len * 0.5 + 0.5) * 255);
        normalData[k + 1] = Math.round((ny / len * 0.5 + 0.5) * 255);
        normalData[k + 2] = Math.round((nz / len * 0.5 + 0.5) * 255);
        normalData[k + 3] = 255;
      }
    }

    // Roughness derivado: vetas (oscuro) más rugosas, claros más lisos.
    const roughData = new Uint8Array(size * size * 4);
    for (let j = 0, k = 0; j < lum.length; j += 1, k += 4) {
      const r = 0.7 - (lum[j] / 255) * 0.35;
      const v = Math.round(r * 255);
      roughData[k] = v;
      roughData[k + 1] = v;
      roughData[k + 2] = v;
      roughData[k + 3] = 255;
    }

    const normalTex = new THREE.DataTexture(normalData, size, size, THREE.RGBAFormat);
    normalTex.colorSpace = THREE.NoColorSpace;
    normalTex.wrapS = THREE.RepeatWrapping;
    normalTex.wrapT = THREE.RepeatWrapping;
    normalTex.needsUpdate = true;

    const roughTex = new THREE.DataTexture(roughData, size, size, THREE.RGBAFormat);
    roughTex.colorSpace = THREE.NoColorSpace;
    roughTex.wrapS = THREE.RepeatWrapping;
    roughTex.wrapT = THREE.RepeatWrapping;
    roughTex.needsUpdate = true;

    entry.normalMap = normalTex;
    entry.roughnessMap = roughTex;
    console.info(`[materials-v2] procedural maps generados para ${path} (${size}px)`);
  }).catch((err) => {
    console.warn(`[materials-v2] FALLO procedural maps para ${path}:`, err);
  });

  return entry;
}

function classifyTexture(path) {
  if (path.includes("cab-finishes/")) {
    if (path.includes("mdf")) return "cabMdf";
    if (path.includes("melamine") || path.includes("alabaster") || path.includes("palomino") || path.includes("gibraltar")) return "cabMelamine";
    return "cabWood";
  }
  if (path.includes("fixtures/")) {
    if (path.includes("brass") || path.includes("nickel") || path.includes("bronze") || path.includes("oil-rubbed")) return "metal";
    if (path.includes("textured")) return "powderCoat";
    return "solid";
  }
  return "default";
}

// Repeats más altos en madera/melamina para que se vean varios "tablones"
// como en la referencia de Vectary.
const REPEATS = {
  cabWood:     [3.0, 5.0],
  cabMelamine: [3.5, 5.0],
  cabMdf:      [3.0, 3.0],
  metal:       [2.5, 2.5],
  powderCoat:  [2.5, 2.5],
  solid:       [3.0, 3.0],
  handrail:    [6.0, 1.0],
  default:     [2.0, 2.0],
};

function repeatForOption(option) {
  if (option?.repeat) return option.repeat;
  const key = classifyTexture(option?.texture || "");
  const r = REPEATS[key] || REPEATS.default;
  return new THREE.Vector2(r[0], r[1]);
}

const v2TextureCache = new Map();

function textureForV2(path, settings, { THREE, textureLoader, renderer }) {
  const repeat = settings.repeat || new THREE.Vector2(...REPEATS.default);
  const key = `${path}|${repeat.x}:${repeat.y}|v2`;
  if (v2TextureCache.has(key)) return v2TextureCache.get(key);
  const texture = textureLoader.load(path);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.copy(repeat);
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  texture.generateMipmaps = true;
  v2TextureCache.set(key, texture);
  return texture;
}

// Triplanar projection en shader — sampleo por posición LOCAL del mesh
// (object space), no world. Esto es robusto a normalizaciones de modelo.
// Si DEBUG_TRIPLANAR es true, el output se reemplaza por el color =
// posición local, para ver si el shader realmente se está aplicando.
const DEBUG_TRIPLANAR = new URLSearchParams(window.location.search).get("debug") === "worldpos";

function applyTriplanar(material, { THREE }, scaleArr, opts = {}) {
  const scaleVec = new THREE.Vector2(scaleArr[0], scaleArr[1]);
  const luminanceMode = !!opts.luminanceMode;
  const singleAxis = !!opts.singleAxis;
  const worldSpace = !!opts.worldSpace;

  // Marcamos el material para que prepareMesh re-aplique después del clone.
  material.userData.__triplanarScale = [scaleArr[0], scaleArr[1]];
  material.userData.__triplanarLuminance = luminanceMode;
  material.userData.__triplanarSingleAxis = singleAxis;
  material.userData.__triplanarWorldSpace = worldSpace;

  material.onBeforeCompile = (shader) => {
    shader.uniforms.triplanarScale = { value: scaleVec };

    // VERTEX: varyings — local o world según opt.
    shader.vertexShader = "varying vec3 vTriLocalPos;\nvarying vec3 vTriLocalNormal;\n" + shader.vertexShader;
    const posSetup = worldSpace
      ? "vTriLocalPos = (modelMatrix * vec4(transformed, 1.0)).xyz;\n" +
        "vTriLocalNormal = normalize(mat3(modelMatrix) * objectNormal);\n"
      : "vTriLocalPos = transformed;\n" +
        "vTriLocalNormal = normalize(objectNormal);\n";
    shader.vertexShader = shader.vertexShader.replace(
      "#include <project_vertex>",
      posSetup + "#include <project_vertex>"
    );

    // FRAGMENT: helper triplanar y reemplazo del map_fragment.
    shader.fragmentShader =
      "varying vec3 vTriLocalPos;\n" +
      "varying vec3 vTriLocalNormal;\n" +
      "uniform vec2 triplanarScale;\n" +
      "vec4 triSample(sampler2D tex, vec3 wp, vec3 b, vec2 s) {\n" +
      "  vec4 cX = texture2D(tex, wp.zy * s);\n" +
      "  vec4 cY = texture2D(tex, wp.xz * s);\n" +
      "  vec4 cZ = texture2D(tex, wp.xy * s);\n" +
      "  return cX * b.x + cY * b.y + cZ * b.z;\n" +
      "}\n" +
      shader.fragmentShader;

    const debugBlock = DEBUG_TRIPLANAR
      ? `// DEBUG: mostrar posición local como color (R=X, G=Y, B=Z, fracted)
         diffuseColor = vec4(fract(vTriLocalPos * triplanarScale.x), 1.0);`
      : singleAxis
        // Modo single-axis: proyección FIJA en XY de world space.
        // No depende de la normal (evita discontinuidades entre folds
        // del BiFold accordion). U = pos.x, V = pos.y. Como usamos world
        // space, Y es siempre vertical → vetas verticales del brushed
        // salen verticales siempre.
        ? `#ifdef USE_MAP
            vec2 uvSA = vTriLocalPos.xy * triplanarScale;
            vec4 sampledDiffuseColor = texture2D(map, uvSA);
            diffuseColor *= sampledDiffuseColor;
           #endif`
        : luminanceMode
          // Modo luminancia: textura solo por variación de brillo (powder
          // coat, micro-textura). Color base viene de material.color.
          ? `#ifdef USE_MAP
              vec3 triBlend = abs(vTriLocalNormal);
              triBlend = pow(triBlend, vec3(4.0));
              triBlend = triBlend / max(triBlend.x + triBlend.y + triBlend.z, 0.0001);
              vec4 sampledLum = triSample(map, vTriLocalPos, triBlend, triplanarScale);
              float lum = dot(sampledLum.rgb, vec3(0.299, 0.587, 0.114));
              float mod_ = 0.88 + (lum - 0.55) * 0.5;
              diffuseColor.rgb *= mod_;
             #endif`
          : `#ifdef USE_MAP
              vec3 triBlend = abs(vTriLocalNormal);
              triBlend = pow(triBlend, vec3(4.0));
              triBlend = triBlend / max(triBlend.x + triBlend.y + triBlend.z, 0.0001);
              vec4 sampledDiffuseColor = triSample(map, vTriLocalPos, triBlend, triplanarScale);
              // Boost contraste +saturación para que la veta sea visible
              // incluso en maderas pálidas tipo alabaster.
              vec3 c = sampledDiffuseColor.rgb;
              c = (c - 0.5) * 1.35 + 0.5;
              float lumC = dot(c, vec3(0.299, 0.587, 0.114));
              c = mix(vec3(lumC), c, 1.25);
              sampledDiffuseColor.rgb = clamp(c, 0.0, 1.0);
              diffuseColor *= sampledDiffuseColor;
             #endif`;

    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <map_fragment>",
      debugBlock
    );

    console.info(`[materials-v2] triplanar shader compilado (scale ${scaleVec.x}×${scaleVec.y}, debug=${DEBUG_TRIPLANAR})`);
  };
  material.needsUpdate = true;
}

// Cab finish — MeshStandard + triplanar para que el diffuse mande sin
// depender de UVs del GLB.
function createFinishMaterialV2(option, { THREE, textureFor }) {
  const category = classifyTexture(option.texture || "");
  const isWood = category === "cabWood";
  const isMelamine = category === "cabMelamine";

  const material = new THREE.MeshStandardMaterial({
    color: option.color ?? 0xffffff,
    roughness: isWood ? 0.6 : (isMelamine ? 0.45 : 0.7),
    metalness: 0.0,
    envMapIntensity: 0.35,
  });
  material.name = `Cab ${option.label}`;
  // Marcamos el valor que queremos preservar — tuneMaterialForRender lo
  // pisará pero reapplyTriplanarOnClone lo restaura desde userData.
  material.userData.__envMapIntensity = 0.35;

  if (option.texture) {
    // Pasamos repeat 1×1 al diffuse porque el repeat real lo controla
    // ahora triplanarScale en el shader.
    material.map = textureFor(option.texture, { repeat: new THREE.Vector2(1, 1) });
    material.color.set(0xffffff);

    const maps = getProceduralMaps(option.texture, { THREE });
    material.normalMap = maps.normalMap;
    material.normalScale = new THREE.Vector2(isWood ? 1.4 : 0.9, isWood ? 1.4 : 0.9);
    material.roughnessMap = maps.roughnessMap;

    // Tiles por unidad local del mesh. El GLB del Cambridge usa coords
    // locales aprox 1m, así que scale 3 → 3 tiles por metro local.
    // Tunear hacia arriba si la veta sale muy grande.
    applyTriplanar(material, { THREE }, [3.0, 3.0]);
  }
  return material;
}

function createFixtureTextureMaterialV2(option, { THREE, textureFor }) {
  const category = classifyTexture(option.texture || "");
  const isMetal = category === "metal";
  const isHandrail = (option.label || "").startsWith("Handrail");

  // Todas las texturas que el cliente entregó se respetan tal cual — color
  // sale 100% de la textura. Triplanar normal (no luminance override).
  const targetEnv = isMetal ? 0.85 : 0.45;
  const material = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: option.roughness ?? (isMetal ? 0.32 : 0.5),
    metalness: option.metalness ?? (isMetal ? 0.85 : 0.4),
    envMapIntensity: targetEnv,
    map: textureFor(option.texture, { repeat: new THREE.Vector2(1, 1) }),
  });
  material.name = `Fixture ${option.label}`;
  material.userData.__envMapIntensity = targetEnv;

  const maps = getProceduralMaps(option.texture, { THREE });
  material.normalMap = maps.normalMap;
  material.normalScale = new THREE.Vector2(isMetal ? 0.4 : 0.9, isMetal ? 0.4 : 0.9);
  material.roughnessMap = maps.roughnessMap;

  const scale = isHandrail ? [8.0, 8.0] : [4.0, 4.0];
  applyTriplanar(material, { THREE }, scale);
  return material;
}

// Detectamos si la opción debería verse metálica pulida basado en el nombre.
// Para esas, ignoramos el metalness/roughness "moderado" de la opción y
// forzamos valores que se vean realmente como metal con reflejos visibles.
const POLISHED_METAL_HINTS = ["stainless", "bronze", "brass", "nickel", "chrome", "oil", "alumifold"];

function looksLikePolishedMetal(name) {
  const lower = (name || "").toLowerCase();
  return POLISHED_METAL_HINTS.some((hint) => lower.includes(hint));
}

// Textura real de stainless brushed (en assets/textures/fixtures/).
const STAINLESS_BRUSHED_PATH = "./assets/textures/fixtures/stainless-brushed.png";

// Cache de textura stainless cargada (se carga una sola vez).
let stainlessTextureCached = null;
function loadStainlessBrushed(THREE) {
  if (stainlessTextureCached) return stainlessTextureCached;
  const loader = new THREE.TextureLoader();
  stainlessTextureCached = loader.load(STAINLESS_BRUSHED_PATH);
  // MirroredRepeatWrapping: cada repetición se espeja en el borde con la
  // siguiente. La textura tiene gradiente vertical (más oscuro arriba/abajo),
  // sin mirror se ven juntas obvias. Con mirror las costuras desaparecen
  // porque los bordes coinciden por reflexión.
  stainlessTextureCached.wrapS = THREE.MirroredRepeatWrapping;
  stainlessTextureCached.wrapT = THREE.MirroredRepeatWrapping;
  stainlessTextureCached.colorSpace = THREE.SRGBColorSpace;
  stainlessTextureCached.anisotropy = 16;
  return stainlessTextureCached;
}

function createMetalMaterialV2(option, name, { THREE }) {
  const polishedMetal = looksLikePolishedMetal(name) || looksLikePolishedMetal(option.label);
  const isStainless = /stainless/i.test(name) || /stainless/i.test(option.label || "");

  const targetEnv = polishedMetal ? 1.5 : 0.85;
  const material = new THREE.MeshStandardMaterial({
    color: option.color ?? 0xd8d8d8,
    roughness: polishedMetal ? 0.18 : (option.roughness ?? 0.3),
    metalness: polishedMetal ? 0.95 : (option.metalness ?? 0.85),
    envMapIntensity: targetEnv,
  });
  material.name = name;
  material.userData.__envMapIntensity = targetEnv;

  // Stainless: world space + single-axis FIJO en XY (sin elegir según
  // normal). Y es vertical en world space del modelo, así las vetas
  // verticales salen siempre verticales. Scale bajo (0.4-0.3) para ver
  // ~1 instancia completa de la textura sin banding de repeticiones.
  if (isStainless) {
    material.color.set(0xffffff);
    material.map = loadStainlessBrushed(THREE);
    material.metalness = 0.9;
    material.roughness = 0.25;
    applyTriplanar(material, { THREE }, [0.5, 0.35], { singleAxis: true, worldSpace: true });
  }

  return material;
}

// Setup que pidió el equipo 3D para el nuevo GLB (?model=test):
// HDRI=0, sin maps de env, 3 PointLights centro intensity 500 sin shadows.
// Es el setup contra el cual bakearon todos los maps (AO/Normal/Emissive).
function apply3DTeamLighting({ THREE, scene, renderer, lights }) {
  // 1. Apagar HDRI / environment map
  scene.environment = null;
  scene.environmentIntensity = 0;
  document.body.dataset.environment = "3d-team-no-env";

  // 2. Apagar TODAS las luces directas existentes (ambient, hemi, key, fill, warm)
  Object.values(lights).forEach((light) => {
    if (light && "intensity" in light) light.intensity = 0;
  });

  // 3. Exposure — tuneable via ?exposure=X
  const expOverride = parseFloat(new URLSearchParams(window.location.search).get("exposure"));
  renderer.toneMappingExposure = Number.isFinite(expOverride) ? expOverride : 1.0;

  // 4. Las 3 PointLights pedidas por el equipo 3D.
  // Equipo dice intensity 500 — eso es para su escala (probablemente 2m
  // real). Nuestro modelo está normalizado a ~1 unidad, así que con
  // decay=2 (inverse square) las luces caen mucho más rápido y 500
  // sobreexpone. Calibración default: 125 (= 500 × 0.5²).
  // URL param ?lightIntensity=X permite tunear en vivo sin recompilar.
  const intensityOverride = parseFloat(new URLSearchParams(window.location.search).get("lightIntensity"));
  const intensity = Number.isFinite(intensityOverride) ? intensityOverride : 125;

  // También quito emissive contribution de los materiales (los maps
  // Emissive del nuevo GLB están auto-iluminando todo). Toggle con
  // ?keepEmissive=1 para mantenerlos si los queremos ver.
  const keepEmissive = new URLSearchParams(window.location.search).get("keepEmissive") === "1";
  if (!keepEmissive) {
    scene.traverse((obj) => {
      if (obj.isMesh && obj.material) {
        if ("emissiveIntensity" in obj.material) obj.material.emissiveIntensity = 0;
        if (obj.material.emissive) obj.material.emissive.setHex(0x000000);
        obj.material.needsUpdate = true;
      }
    });
  }

  if (!scene.userData.__teamLights) {
    // 3 PointLights apiladas en el centro del modelo (X=0, Z=0, Y=0.5).
    const teamLights = [];
    for (let i = 0; i < 3; i += 1) {
      const pl = new THREE.PointLight(0xffffff, intensity, 0, 2);
      pl.position.set(0, 0.5, 0);
      pl.castShadow = false;
      scene.add(pl);
      teamLights.push(pl);
    }
    scene.userData.__teamLights = teamLights;
  }

  console.info(`[materials-v2] 3D team lighting: 3 PointLights intensity ${intensity}, exposure ${renderer.toneMappingExposure}, emissive ${keepEmissive ? "kept" : "killed"}`);
}

// --- Environment interior procedural ---
// Genera un equirectangular gris/blanco con HIGHLIGHTS brillantes que los
// metales pulidos reflejan visiblemente — sin esto los metales se ven
// "matte" porque no hay contraste en el env para reflejar.
function createNeutralInteriorEnvironment(THREE) {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");

  // Cielo: gradiente blanco cálido → blanco neutro
  const sky = ctx.createLinearGradient(0, 0, 0, canvas.height * 0.5);
  sky.addColorStop(0, "#f5f2ec");
  sky.addColorStop(1, "#dad7d3");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, canvas.width, canvas.height * 0.5);

  // Suelo: gris medio-oscuro (contrasta con el techo brillante)
  const floor = ctx.createLinearGradient(0, canvas.height * 0.5, 0, canvas.height);
  floor.addColorStop(0, "#888581");
  floor.addColorStop(1, "#5e5b58");
  ctx.fillStyle = floor;
  ctx.fillRect(0, canvas.height * 0.5, canvas.width, canvas.height * 0.5);

  // HIGHLIGHTS brillantes en el techo — son lo que los metales reflejan
  // y dan la sensación de "metal pulido". Pequeños y brillantes (= sharp
  // highlights al reflejarse).
  const highlight = (cx, cy, w, h, alpha, color = "rgb(255,253,245)") => {
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, w);
    g.addColorStop(0, color.replace("rgb", "rgba").replace(")", `,${alpha})`));
    g.addColorStop(0.5, color.replace("rgb", "rgba").replace(")", `,${alpha * 0.3})`));
    g.addColorStop(1, color.replace("rgb", "rgba").replace(")", `,0)`));
    ctx.fillStyle = g;
    ctx.fillRect(cx - w, cy - h * 0.5, w * 2, h);
  };
  // 4 highlights distribuidos en el cielo (visibles desde varios ángulos)
  highlight(canvas.width * 0.15, canvas.height * 0.15, 90, 60, 1.0);
  highlight(canvas.width * 0.40, canvas.height * 0.10, 70, 50, 0.95);
  highlight(canvas.width * 0.65, canvas.height * 0.12, 100, 70, 1.0);
  highlight(canvas.width * 0.88, canvas.height * 0.18, 80, 55, 0.9);

  // Banda horizontal de luz cerca del horizonte — simula ventanas/lámparas
  // laterales. Da reflejo "wraparound" típico de interiores iluminados.
  const horizonGlow = ctx.createLinearGradient(0, canvas.height * 0.38, 0, canvas.height * 0.50);
  horizonGlow.addColorStop(0, "rgba(255,250,240,0)");
  horizonGlow.addColorStop(0.5, "rgba(255,250,240,0.5)");
  horizonGlow.addColorStop(1, "rgba(255,250,240,0)");
  ctx.fillStyle = horizonGlow;
  ctx.fillRect(0, canvas.height * 0.38, canvas.width, canvas.height * 0.12);

  const tex = new THREE.CanvasTexture(canvas);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  tex.name = "interior_neutral";
  return tex;
}

// Suprimimos el HDR exterior. Permitimos solo el environment "interior_neutral".
function suppressEnvironmentTexture(texture) {
  return texture.name !== "interior_neutral";
}

function applyNeutralEnvironment({ THREE, scene, renderer }) {
  const envTex = createNeutralInteriorEnvironment(THREE);
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  const envMap = pmrem.fromEquirectangular(envTex).texture;
  scene.environment = envMap;
  scene.environmentIntensity = 1.0;
  envTex.dispose();
  pmrem.dispose();
  document.body.dataset.environment = "interior_neutral";
}

// Si el usuario carga ?model=test, el equipo 3D especificó: HDRI=0, sin
// otros maps de env, solo 3 PointLights en el centro intensity 500 sin
// shadows. Eso es el setup contra el cual bakearon AO/Emissive/Normal.
const USE_3D_TEAM_LIGHTING = new URLSearchParams(window.location.search).get("model") === "test";

function onSceneReady({ THREE, scene, renderer, lights }) {
  if (USE_3D_TEAM_LIGHTING) {
    apply3DTeamLighting({ THREE, scene, renderer, lights });
    return;
  }
  applyNeutralEnvironment({ THREE, scene, renderer });

  // Exposure conservadora — antes lo subí a 1.0 y eso desaturaba la
  // madera (los lighter texels se quemaban a casi blanco). 0.85 da más
  // saturación sin perder visibilidad.
  renderer.toneMappingExposure = 0.85;

  // Lighting punto medio — suficiente para que la cabina no se vea
  // oscura, sin "lavar" las texturas de madera.
  if (lights.ambient) lights.ambient.intensity = 0.35;
  if (lights.hemi) {
    lights.hemi.intensity = 0.7;
    lights.hemi.color.setHex(0xffffff);
    lights.hemi.groundColor.setHex(0x8a8783);
  }
  if (lights.key) {
    lights.key.intensity = 0.55;
    lights.key.color.setHex(0xffffff);
  }
  if (lights.fill) {
    lights.fill.intensity = 0.22;
    lights.fill.color.setHex(0xffffff);
  }
  if (lights.warm) lights.warm.intensity = 0;

  // SpotLight cenital reducido aún más — el piso se estaba quemando.
  if (!scene.userData.__v2CeilingLight) {
    const ceiling = new THREE.SpotLight(0xfff8ec, 0.3, 5, Math.PI / 2.2, 0.85, 1.5);
    ceiling.position.set(0, 2.6, 0);
    ceiling.target.position.set(0, 0, 0);
    scene.add(ceiling);
    scene.add(ceiling.target);
    scene.userData.__v2CeilingLight = [ceiling];
  }
}

// --- UV fix: detecta y reemplaza UVs degeneradas con planar projection
// desde el bbox local del mesh. Esto es lo que arregla el "textura se ve
// como color sólido" — el GLB de Cambridge tiene varios meshes con UVs
// colapsadas a un punto, por eso la textura mostraba 1 pixel estirado.
function prepareMeshUVs(mesh, { THREE }) {
  if (!mesh.geometry || !mesh.geometry.attributes.position) return;
  if (mesh.userData.__v2UVFixed === true) return;
  if (mesh.userData.__v2UVFixed === false) return; // ya evaluado y OK

  const geom = mesh.geometry;
  const pos = geom.attributes.position;
  const existingUV = geom.attributes.uv;

  // Medir rango de UV existente
  let uMin = Infinity, uMax = -Infinity, vMin = Infinity, vMax = -Infinity;
  if (existingUV) {
    for (let i = 0; i < existingUV.count; i += 1) {
      const u = existingUV.getX(i);
      const v = existingUV.getY(i);
      if (u < uMin) uMin = u;
      if (u > uMax) uMax = u;
      if (v < vMin) vMin = v;
      if (v > vMax) vMax = v;
    }
  }
  const uRange = uMax - uMin;
  const vRange = vMax - vMin;
  const uvDegenerate = !existingUV || uRange < 0.01 || vRange < 0.01;

  if (!uvDegenerate) {
    mesh.userData.__v2UVFixed = false;
    return;
  }

  // Regenerar: detectar el plano dominante del mesh (eje con menor extensión
  // = normal del plano) y proyectar los otros dos ejes a UV.
  geom.computeBoundingBox();
  const bb = geom.boundingBox;
  const size = new THREE.Vector3();
  bb.getSize(size);
  const dims = [
    { axis: 0, len: size.x },
    { axis: 1, len: size.y },
    { axis: 2, len: size.z },
  ].sort((a, b) => a.len - b.len);
  const normalAxis = dims[0].axis;
  const uAxis = dims[2].axis; // el más largo → u
  const vAxis = dims[1].axis; // el segundo → v

  const uLen = dims[2].len || 1;
  const vLen = dims[1].len || 1;
  const min = bb.min;

  const newUV = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i += 1) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const coords = [x, y, z];
    const minCoords = [min.x, min.y, min.z];
    newUV[i * 2]     = (coords[uAxis] - minCoords[uAxis]) / uLen;
    newUV[i * 2 + 1] = (coords[vAxis] - minCoords[vAxis]) / vLen;
  }
  geom.setAttribute("uv", new THREE.BufferAttribute(newUV, 2));
  mesh.userData.__v2UVFixed = true;

  console.info(
    `[materials-v2] UV regenerada en ${mesh.name || "(unnamed)"} — ` +
    `normal axis ${["X", "Y", "Z"][normalAxis]}, size ${uLen.toFixed(2)}×${vLen.toFixed(2)}`
  );
}

// Re-aplica el onBeforeCompile triplanar al material clonado por
// applyMaterialToTargets. Sin esto, el clon no tiene la inyección de shader
// y sampleará con UVs del GLB (muchas veces colapsadas).
function reapplyTriplanarOnClone(mesh, { THREE }) {
  if (!mesh.material) return;
  const userData = mesh.material.userData;
  if (!userData) return;

  // Restaurar envMapIntensity — app.js tuneMaterialForRender lo pisa a 1.5
  // después de nuestro override.
  if (typeof userData.__envMapIntensity === "number") {
    mesh.material.envMapIntensity = userData.__envMapIntensity;
  }

  const scaleArr = userData.__triplanarScale;
  if (!scaleArr) return;
  const luminanceMode = userData.__triplanarLuminance === true;
  const singleAxis = userData.__triplanarSingleAxis === true;
  const worldSpace = userData.__triplanarWorldSpace === true;
  applyTriplanar(mesh.material, { THREE }, scaleArr, { luminanceMode, singleAxis, worldSpace });
}

window.__materialOverrides = {
  textureFor: textureForV2,
  createFinishMaterial: createFinishMaterialV2,
  createFixtureTextureMaterial: createFixtureTextureMaterialV2,
  createMetalMaterial: createMetalMaterialV2,
  onSceneReady,
  suppressEnvironmentTexture,
  prepareMesh: reapplyTriplanarOnClone,
};

if (window.__elevatorScene) onSceneReady(window.__elevatorScene);

document.body?.setAttribute("data-materials-version", "v2.24");
console.info("[materials-v2.24] active — revertido override de colores: respetar texturas del cliente tal cual");

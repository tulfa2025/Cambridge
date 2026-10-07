import * as THREE from "./vendor/three/three.module.js";
import { GLTFLoader } from "./vendor/three/GLTFLoader.js";
import { KTX2Loader } from "./vendor/three/KTX2Loader.js";

// Mobile-safe asset tier (2026-09-08, see HANDOFF session #75). Client asked to bring back
// full-catalog texture preloading (see prefetchFullCatalogInBackground() further down) without
// reintroducing the 2026-08-26 iOS crash, which was caused by decoding a huge chunk of the raw
// catalog concurrently. Fix here is two-part: (1) mobile gets a pre-converted LIGHTER texture tier
// (AO 4096->1200px, cab-finishes/fixtures 1024->400px — verified visually indistinguishable via
// pixel diff against the full-res renders, see HANDOFF) so the total catalog is small enough to
// safely prefetch in the background; (2) desktop keeps the untouched full-resolution tier with
// ordinary on-demand loading (no prefetch — desktop was never the crash risk, and full-res looks
// best there). Same breakpoint the CSS already uses to mean "mobile" (session #73's mobile logo
// hide) — reusing it keeps "mobile" defined in exactly one place across CSS and JS.
const IS_MOBILE_TIER = window.matchMedia("(max-width: 1024px)").matches;

// Remaps a cab-finish/fixture texture path to its mobile-tier sibling folder — called ONLY at the
// point a network request is actually made (inside loadCompressedTexture() below), never by mutating
// option.texture/alphaMap or any other stored path. That matters: HORIZONTAL_GRAIN_TEXTURES and other
// Sets/dicts elsewhere do `.has(option.texture)` membership checks against the literal desktop-style
// path — if the stored path were rewritten instead, those lookups would silently stop matching on
// mobile. AO's own mobile tier is handled separately (AO_EXPORT5_DIR below swaps by directory
// constant) since every AO_BASE_EXPORT5 entry is already built from that one shared constant.
function tierPath(path) {
  if (!IS_MOBILE_TIER) return path;
  return path.replace("/cab-finishes/", "/cab-finishes-mobile/").replace("/fixtures/", "/fixtures-mobile/");
}

const platedAndPowderCoatFinishes = [
  { id: "stainless", label: "Stainless Steel", thumb: "metal", metalness: 0.78, roughness: 0.24, color: 0xdad9d2, texture: "./assets/textures/fixtures/stainless-brushed.png" },
  { id: "antiqueBrass", label: "Antique Brass", thumb: "metal brass", texture: "./assets/textures/fixtures/antique-brass-01.jpg", metalness: 0.62, roughness: 0.33 },
  { id: "antiqueNickel", label: "Antique Nickel", thumb: "metal nickel", texture: "./assets/textures/fixtures/antique-nickel-01.jpg", metalness: 0.65, roughness: 0.32 },
  { id: "oilBronze", label: "Oil Rubbed Bronze", thumb: "metal oil", texture: "./assets/textures/fixtures/oil-rubbed-bronze-01.jpg", metalness: 0.58, roughness: 0.38 },
  { id: "beige", label: "Beige", thumb: "solid-beige", texture: "./assets/textures/fixtures/beige-01.jpg", metalness: 0.2, roughness: 0.48 },
  { id: "black", label: "Black", thumb: "solid-black", texture: "./assets/textures/fixtures/black-textured-01.jpg", metalness: 0.32, roughness: 0.48 },
  { id: "bronze", label: "Bronze", thumb: "metal bronze", texture: "./assets/textures/fixtures/bronze-01.jpg", metalness: 0.6, roughness: 0.34 },
  { id: "grey", label: "Grey", thumb: "solid-grey", texture: "./assets/textures/fixtures/grey-01.jpg", metalness: 0.28, roughness: 0.44 },
  { id: "white", label: "White", thumb: "solid-white", texture: "./assets/textures/fixtures/white-01.jpg", metalness: 0.18, roughness: 0.44 },
];

const options = [
  {
    id: "gate",
    title: "1. Door Style",
    type: "gate",
    items: [
      { id: "bifold", label: "Bi-Fold Gate", thumb: "gate-thumb bifold", thumbImg: "./assets/ui/door-bifold.png", node: "BiFold_gate" },
      { id: "accordion", label: "Accordion Gate", thumb: "gate-thumb accordion", thumbImg: "./assets/ui/door-accordion.png", node: "Accordion_Gate" },
      { id: "sliding", label: "Sliding Door Panels", thumb: "gate-thumb sliding", thumbImg: "./assets/ui/door-sliding.png", node: "Sliding_Doors" },
    ],
  },
  {
    id: "gateFinish",
    title: "2. Door Finish",
    type: "swatch",
    items: [
      { id: "bifoldWhite", label: "White", thumb: "solid-white", gate: "bifold", color: 0xf1eee7, metalness: 0.18, roughness: 0.42 },
      { id: "bifoldStainless", label: "Stainless", thumb: "metal", gate: "bifold", color: 0xd8d8d3, metalness: 0.8, roughness: 0.28, tile: 3, texture: "./assets/textures/fixtures/stainless-brushed.png" },
      // 2026-09-19: real client photo textures (delivered in "Accordion Gates" folder), replacing the
      // old flat hex color + shared generic opacity.png mask. Each finish's own color PNG can't serve as
      // its own alphaMap (alpha channel is uniformly 255 — the cutout pattern lives in RGB color only,
      // and Black/Bronze's pills are drawn WHITE/opaque — same inverse-polarity issue documented for the
      // old files on 2026-07-03; Clear's metal color is light enough to sit above alphaTest 0.5 too), so
      // 3 new alpha masks were derived by luminance threshold from each color file itself — guarantees
      // pixel-perfect alignment with its own texture, unlike reusing the old opacity.png (different
      // pattern/aspect ratio entirely).
      { id: "alumifoldBlackPerf", label: "Alumifold Black Perforated", thumb: "solid-black", gate: "accordion", texture: "./assets/textures/fixtures/perforated-new/Alumifold-Black-Perforated_01.png", alphaMap: "./assets/textures/fixtures/perforated-new/black-alpha.png", metalness: 1, roughness: 0.5, tile: 8 },
      { id: "alumifoldBlackSolid", label: "Alumifold Black Solid", thumb: "solid-black", gate: "accordion", color: 0x262626, metalness: 1, roughness: 0.5 },
      { id: "alumifoldBronzePerf", label: "Alumifold Bronze Perforated", thumb: "metal bronze", gate: "accordion", texture: "./assets/textures/fixtures/perforated-new/Alumifold-Bronze-Perforated_001.png", alphaMap: "./assets/textures/fixtures/perforated-new/bronze-alpha.png", metalness: 1, roughness: 0.5, tile: 8 },
      { id: "alumifoldBronzeSolid", label: "Alumifold Bronze Solid", thumb: "metal bronze", gate: "accordion", color: 0x7a6742, metalness: 0.5, roughness: 0.5 },
      { id: "alumifoldClearPerf", label: "Alumifold Clear Perforated", thumb: "solid-grey", gate: "accordion", texture: "./assets/textures/fixtures/perforated-new/Alumifold-Clear-Perforated_01.png", alphaMap: "./assets/textures/fixtures/perforated-new/clear-alpha.png", metalness: 0.4, roughness: 0.36, tile: 8 },
      { id: "alumifoldClearSolid", label: "Alumifold Clear Solid", thumb: "solid-grey", gate: "accordion", color: 0xffffff, metalness: 1, roughness: 0.3 },
      // Dedicated door textures (2026-07-03, replacing the shared cab-finish images which read too dark
      // on the door) — own files so the Cab Finish wall option (which still uses the cab-finishes/ image)
      // is unaffected. All 4 ship with vertical grain already, so none need `rotate`.
      { id: "vinylBirch", label: "Vinyl Birch", thumb: "wood-birch", gate: "accordion", texture: "./assets/textures/fixtures/vinyl-door/birch.jpg", metalness: 0, roughness: 0.6, tile: 2 },
      { id: "vinylOak", label: "Vinyl Light Oak", thumb: "wood-oak", gate: "accordion", texture: "./assets/textures/fixtures/vinyl-door/oak.jpg", metalness: 0, roughness: 0.6 },
      { id: "vinylTeak", label: "Vinyl Teak", thumb: "wood-cherry", gate: "accordion", texture: "./assets/textures/fixtures/vinyl-door/teak.jpg", metalness: 0, roughness: 0.6 },
      { id: "vinylWalnut", label: "Vinyl Walnut", thumb: "wood-walnut", gate: "accordion", texture: "./assets/textures/fixtures/vinyl-door/walnut.jpg", metalness: 0, roughness: 0.6 },
      { id: "vinylWhite", label: "Vinyl White", thumb: "solid-white", gate: "accordion", color: 0xFFFEFA, metalness: 0.02, roughness: 0.55 },
      { id: "visifoldBlackClear", label: "Visifold Black, Clear Panels", thumb: "solid-black", gate: "accordion", glass: true, color: 0x222222, metalness: 0.55, roughness: 0.22 },
      { id: "visifoldBronzeClear", label: "Visifold Bronze, Clear Panels", thumb: "metal bronze", gate: "accordion", glass: true, color: 0x8a5226, metalness: 0.6, roughness: 0.24 },
      // Client, 2026-08-13: "Tinted Panels" had zero transparency (color-only material, no `glass`
      // flag) — should be see-through with a smoky tinge, distinct from Clear Panels' clean glass. See
      // ACCORDION_TINTED_GLASS for the actual tint/opacity used.
      { id: "visifoldBronzeTinted", label: "Visifold Bronze, Tinted Panels", thumb: "metal bronze", gate: "accordion", glass: true, color: 0x9f8f82, metalness: 0.62, roughness: 0.3 },
      { id: "visifoldClearClear", label: "Visifold Clear, Clear Panels", thumb: "metal", gate: "accordion", glass: true, color: 0xc7c8c4, metalness: 0.72, roughness: 0.22 },
      { id: "visifoldClearTinted", label: "Visifold Clear, Tinted Panels", thumb: "metal", gate: "accordion", glass: true, color: 0xffffff, metalness: 1, roughness: 0.3 },
      { id: "slidingStainless", label: "Stainless Steel", thumb: "metal", gate: "sliding", color: 0xd8d8d3, metalness: 0.8, roughness: 0.28, tile: 3, texture: "./assets/textures/fixtures/stainless-brushed.png" },
      { id: "slidingBeige", label: "Beige Powder Coat", thumb: "solid-beige", gate: "sliding", color: 0xfff2d1, metalness: 0.2, roughness: 0.48 },
      { id: "slidingBlack", label: "Black Powder Coat", thumb: "solid-black", gate: "sliding", texture: "./assets/textures/fixtures/black-textured-01.jpg", metalness: 0.32, roughness: 0.48, tile: 10 },
      { id: "slidingGrey", label: "Grey Powder Coat", thumb: "solid-grey", gate: "sliding", texture: "./assets/textures/fixtures/grey-01.jpg", metalness: 0.28, roughness: 0.44 },
      { id: "slidingBronze", label: "Low Lights Bronze", thumb: "metal bronze", gate: "sliding", color: 0xCD7F32, metalness: 0.6, roughness: 0.34, tile: 6 },
      { id: "slidingGlass", label: "Glass - Stainless Panels", thumb: "metal", gate: "sliding", glass: true, color: 0xb9c1c3, metalness: 0.74, roughness: 0.22 },
    ],
  },
  {
    id: "cabStyle",
    title: "3. Cab Style",
    type: "cab",
    items: [
      { id: "flatVeneer", label: "Flat Veneer", thumb: "cab-thumb flat", mode: "flat", finishGroup: "veneer" },
      { id: "flatMelamine", label: "Flat Melamine", thumb: "cab-thumb flat", mode: "flat", finishGroup: "melamine" },
      { id: "recessedSingle", label: "Recessed Single", thumb: "cab-thumb recessed single", mode: "recessedSingle", finishGroup: "veneer" },
      { id: "recessedFour", label: "Recessed 4 Panel", thumb: "cab-thumb recessed", mode: "recessedFour", finishGroup: "veneer" },
      { id: "raisedStripe", label: "Raised Accent Stripe", thumb: "cab-thumb stripe", mode: "raisedStripe", finishGroup: "all" },
      { id: "raisedFour", label: "Raised 4 Panel", thumb: "cab-thumb raised", mode: "raisedFour", finishGroup: "mdf" },
      { id: "stainlessSteel", label: "Stainless Steel", thumb: "cab-thumb steel", mode: "stainlessSteel", finishGroup: "none" },
      { id: "glass", label: "Glass Cab", thumb: "cab-thumb glass", mode: "glass", finishGroup: "all" },
    ],
  },
  {
    id: "cabFinish",
    title: "4. Cab Finish",
    type: "swatch",
    items: [
      // Client, 2026-08-13: Walnut Veneer/Oak and Palomino/Walnut Melamine content was swapped —
      // ids/labels stay put, only the underlying `texture` (+ its tile) moved to the other entry.
      // 2026-09-07: client asked to swap Palomino's texture over to Walnut Melamine (below) and give
      // Palomino a brand-new file, M2015-Apres-Ski.png (saved as apres-ski-melamine.png). Continues the
      // 2026-08-13 swap above — the tile value travels WITH the image, not the label, same as back then.
      { id: "palomino", label: "Palomino", thumb: "wood-palomino", group: "melamine", texture: "./assets/textures/cab-finishes/apres-ski-melamine.png" },
      { id: "walnutVeneer", label: "Walnut Veneer", thumb: "wood-walnut", group: "veneer", texture: "./assets/textures/cab-finishes/oak-veneer.png" },
      { id: "birch", label: "Birch", thumb: "wood-birch", group: "veneer", texture: "./assets/textures/cab-finishes/birch-veneer.jpg" },
      { id: "oak", label: "Oak", thumb: "wood-oak", group: "veneer", texture: "./assets/textures/cab-finishes/walnut-veneer.png" },
      { id: "cherry", label: "Cherry", thumb: "wood-cherry", group: "veneer", texture: "./assets/textures/cab-finishes/cherry-veneer.png", tile: 2 },
      { id: "mapleVeneer", label: "Maple Veneer", thumb: "wood-maple", group: "veneer", texture: "./assets/textures/cab-finishes/maple-veneer.png", tile: 5 },
      { id: "gibraltar", label: "Gibraltar", thumb: "wood-gibraltar", group: "melamine", texture: "./assets/textures/cab-finishes/gibraltar-melamine.png" },
      { id: "walnutMelamine", label: "Walnut Melamine", thumb: "wood-walnut", group: "melamine", texture: "./assets/textures/cab-finishes/walnut-melamine.png", tile: 4 },
      { id: "mapleMelamine", label: "Maple Melamine", thumb: "wood-maple", group: "melamine", texture: "./assets/textures/cab-finishes/maple-melamine.png", tile: 5 },
      { id: "alabaster", label: "Alabaster", thumb: "wood-alabaster", group: "melamine", texture: "./assets/textures/cab-finishes/alabaster-melamine.png" },
      { id: "mdf", label: "MDF", thumb: "wood-mdf", group: "mdf", texture: "./assets/textures/cab-finishes/mdf.jpg" },
      { id: "white", label: "White", thumb: "solid-white", group: "melamine", color: 0xf4f1e9 },
    ],
  },
  {
    // 3D team addition (2026-08-13, merged in from their handoff-package copy of app.js): a
    // dedicated finish picker for the Raised Accent Stripe panel, independent from the wall Cab
    // Finish. Only rendered when cabStyle=raisedStripe — see isGroupVisible(). Same item list as
    // cabFinish (kept as a literal duplicate, matching their version, rather than a shared reference,
    // so the two pickers can diverge later without side effects).
    id: "raisedStripeFinish",
    title: "Raised Stripe Finish",
    type: "swatch",
    items: [
      // 2026-09-07: client asked to swap Palomino's texture over to Walnut Melamine (below) and give
      // Palomino a brand-new file, M2015-Apres-Ski.png (saved as apres-ski-melamine.png). Continues the
      // 2026-08-13 swap above — the tile value travels WITH the image, not the label, same as back then.
      { id: "palomino", label: "Palomino", thumb: "wood-palomino", group: "melamine", texture: "./assets/textures/cab-finishes/apres-ski-melamine.png" },
      { id: "walnutVeneer", label: "Walnut Veneer", thumb: "wood-walnut", group: "veneer", texture: "./assets/textures/cab-finishes/oak-veneer.png" },
      { id: "birch", label: "Birch", thumb: "wood-birch", group: "veneer", texture: "./assets/textures/cab-finishes/birch-veneer.jpg" },
      { id: "oak", label: "Oak", thumb: "wood-oak", group: "veneer", texture: "./assets/textures/cab-finishes/walnut-veneer.png" },
      { id: "cherry", label: "Cherry", thumb: "wood-cherry", group: "veneer", texture: "./assets/textures/cab-finishes/cherry-veneer.png", tile: 2 },
      { id: "mapleVeneer", label: "Maple Veneer", thumb: "wood-maple", group: "veneer", texture: "./assets/textures/cab-finishes/maple-veneer.png", tile: 5 },
      { id: "gibraltar", label: "Gibraltar", thumb: "wood-gibraltar", group: "melamine", texture: "./assets/textures/cab-finishes/gibraltar-melamine.png" },
      { id: "walnutMelamine", label: "Walnut Melamine", thumb: "wood-walnut", group: "melamine", texture: "./assets/textures/cab-finishes/walnut-melamine.png", tile: 4 },
      { id: "mapleMelamine", label: "Maple Melamine", thumb: "wood-maple", group: "melamine", texture: "./assets/textures/cab-finishes/maple-melamine.png" },
      { id: "alabaster", label: "Alabaster", thumb: "wood-alabaster", group: "melamine", texture: "./assets/textures/cab-finishes/alabaster-melamine.png" },
      { id: "mdf", label: "MDF", thumb: "wood-mdf", group: "mdf", texture: "./assets/textures/cab-finishes/mdf.jpg" },
      { id: "white", label: "White", thumb: "solid-white", group: "melamine", color: 0xf4f1e9 },
    ],
  },
  {
    id: "lighting",
    title: "5. Lighting",
    type: "lights",
    columns: 2,
    items: [
      { id: "led", label: "LED Lights", thumb: "lights-thumb lights-four", thumbImg: "./assets/ui/lights-led.png", dots: 4, group: "led" },
      { id: "pin", label: "Pin Spotlights", thumb: "lights-thumb lights-two", thumbImg: "./assets/ui/lights-pin.png", dots: 2, group: "pin" },
    ],
  },
  {
    id: "cop",
    title: "6. Car Operating Panel (COP)",
    type: "cop",
    items: [
      { id: "standard", label: "Standard", thumb: "cop-thumb", node: "Standard COP" },
      { id: "integrated", label: "Integrated Phone", thumb: "cop-thumb black", node: "IntergratedCOP" },
      { id: "shortRath", label: "Short With Rath", thumb: "cop-thumb short-rath", node: "ShortCOP" },
    ],
  },
  {
    id: "handrail",
    title: "8. Handrail",
    type: "rail",
    items: [
      { id: "flat15", label: "1.5 in Flat", thumb: "rail-thumb flat", node: "Flat1_5In", holder: "Flat_Holder" },
      { id: "flat3", label: "3 in Flat", thumb: "rail-thumb flat wide", node: "Flat3In", holder: "Flat_Holder" },
      { id: "flatCurved15", label: "1.5 in Curved", thumb: "rail-thumb curved flat", node: "FlatC1_5In", holder: "Flat_Holder" },
      { id: "flatCurved3", label: "3 in Curved", thumb: "rail-thumb curved flat wide", node: "FlatC3In", holder: "Flat_Holder" },
      { id: "cylinder2", label: "2 in Cylinder", thumb: "rail-thumb", node: "Cylinder2In", holder: "Cylinder_Holder" },
      { id: "cylinderCurved2", label: "2 in Cylinder Curved", thumb: "rail-thumb curved", node: "CylinderC2In", holder: "Cylinder_Holder" },
    ],
  },
  {
    id: "copFinish",
    title: "7. COP & Handrail Finish",
    // Client, 2026-09-28: back to ONE set of buttons driving both COP and Handrail at once (the
    // 2026-09-25 two-section version — independent COP/Handrail pickers stacked in one step — is what's
    // being replaced here). This group is now the ONLY finish control rendered; its click handler in
    // buildControls() also writes state.handrailFinish, so `handrailFinish` below never shows its own
    // step (see isGroupVisible()) but keeps driving the handrail's own rendering (applyHandrailFinish())
    // untouched — same flat colours / textures as always, just no longer its own button set.
    type: "swatch",
    // Client, 2026-08-13: rename "Bronze" -> "Low Lights Bronze" for COP Finish only (matches the
    // label already used for the sliding-door bronze finish). Mapped to a new object so the shared
    // `platedAndPowderCoatFinishes` array (also used by Handrail Finish) keeps its own "Bronze" label.
    items: platedAndPowderCoatFinishes.map((item) =>
      item.id === "bronze" ? { ...item, label: "Low Lights Bronze" } : item
    ),
  },
  {
    id: "handrailFinish",
    title: "9. Handrail Finish",
    type: "swatch",
    items: platedAndPowderCoatFinishes.map((item) => item.id === "bronze"
      ? { ...item, texture: "./assets/textures/fixtures/handrail-low-lights-bronze-20260930.png" }
      : item),
  },
];

const state = {
  gate: "bifold",
  // Client (Matt Carey), 2026-10-07: standard options pre-selected as the customer's starting configuration.
  gateFinish: "bifoldStainless",
  cabStyle: "recessedFour",
  cabFinish: "oak",
  raisedStripeFinish: "walnutVeneer",
  lighting: "led",
  cop: "standard",
  copFinish: "stainless",
  handrail: "flat15",
  handrailFinish: "stainless",
  view: "front",
};

// QA helper: force initial selections via URL, e.g. ?lighting=pin&cabStyle=glass&view=right
const __urlParams = new URLSearchParams(window.location.search);
["gate", "gateFinish", "cabStyle", "cabFinish", "raisedStripeFinish", "lighting", "cop", "copFinish", "handrail", "handrailFinish", "view"].forEach((key) => {
  const value = __urlParams.get(key);
  if (value) state[key] = value;
});
// COP & Handrail Finish is ONE button set now (2026-09-28) — always force handrailFinish to match
// copFinish at boot, regardless of which one (if either) came in via the URL, so a stray
// ?handrailFinish= left over from testing can't desync the two.
state.handrailFinish = state.copFinish;

// Live lighting tuning via URL, e.g. ?light=0.8&exposure=0.9&env=0.3 (defaults below).
const tuneFloat = (key, fallback) => {
  const v = parseFloat(__urlParams.get(key));
  return Number.isFinite(v) ? v : fallback;
};

let activeOptionIndex = 0;

// Interior HDRI shipped by the 3D team (mirrored hall) — matches how they validated the full GLB.
const environmentPath = "./assets/environment/mirrored_hall_1k.hdr";
const materialRenderSettings = {
  envMapIntensity: 4.0,
};

// Node taxonomy for the full GLB delivered by the 3D team (Elevator3D/models/elevator.glb).
// Doors/lights/cops are parent groups holding sub-meshes; toggling the parent hides all children.
const nodeNames = {
  // Door parent groups (each contains its own sub-meshes for wall, border, handle, pattern, etc.)
  // "Glass_Door" isn't a selectable gate yet (see ?model=v6 comment in loadModel) — listed here only so
  // it gets hidden like any other unselected gate instead of rendering visible by default.
  gates: ["BiFold_gate", "Accordion_Gate", "Sliding_Doors", "Glass_Door"],
  // Lighting (per Excel: LED = x4 in cab, Pin Spotlights = x6 in cab). The GLB models 6 LED meshes
  // in a 3x2 grid; LED uses the 4 corners (drops the two center ones, LedLight_2 / LedLight_5).
  // _RS variants (4 each) are for the Recessed Single ceiling layout.
  lighting: {
    ledShow: ["LedLight_1", "LedLight_3", "LedLight_4", "LedLight_6"], // 4 corners
    pinShow: ["PinSpotligh_1", "PinSpotligh_2", "PinSpotligh_3", "PinSpotligh_4", "PinSpotligh_5", "PinSpotligh_6"], // 6
    ledRS: ["LedLight_RS_1", "LedLight_RS_2", "LedLight_RS_3", "LedLight_RS_4"],
    pinRS: ["PinSpotligh_RS_1", "PinSpotligh_RS_2", "PinSpotligh_RS_3", "PinSpotligh_RS_4"],
    all: [
      "LedLight_1", "LedLight_2", "LedLight_3", "LedLight_4", "LedLight_5", "LedLight_6",
      "PinSpotligh_1", "PinSpotligh_2", "PinSpotligh_3", "PinSpotligh_4", "PinSpotligh_5", "PinSpotligh_6",
      "LedLight_RS_1", "LedLight_RS_2", "LedLight_RS_3", "LedLight_RS_4",
      "PinSpotligh_RS_1", "PinSpotligh_RS_2", "PinSpotligh_RS_3", "PinSpotligh_RS_4",
    ],
  },
  cops: ["ShortCOP", "Standard COP", "IntergratedCOP"],
  copsMoved: ["ShortCOP_Moved", "Standard COP_Moved", "IntergratedCOP_Moved"],
  handrails: ["Flat1_5In", "FlatC1_5In", "Flat3In", "FlatC3In", "Cylinder2In", "CylinderC2In"],
  handrailHolders: ["Flat_Holder", "Cylinder_Holder"],
  // Walls: base shell (always on unless replaced) + floor.
  baseWalls: ["Back_wall", "COP_wall", "Handrail_wall", "Top_wall"],
  floor: ["Base_wall"],
  // Every wall-design variant mesh, hidden by default and toggled per cab style.
  allWallVariants: [
    "COP_wall_RS", "Handrail_wall_RS", "Top_Wall_RS",
    "Top_Extra_P4", "COP_wall_P4", "Handrail_wall_P4",
    "Glass", "Back_GW", "Handrail_wall_GW", "Outerwall_GlassCOP",
    "Recessed_4_Pannel", "Raised_Stripe",
    // v2 geometry only (no-op on the production GLB, which lacks these meshes):
    "Back_wall_P4", "Back_wall_RS",
  ],
};

// Per cab-style descriptor: which variant meshes to show, which base walls to hide,
// and which meshes receive the chosen wood/melamine finish material (glass excluded).
const CAB_STYLE_NODES = {
  flat:           { show: [], hideBase: [], finish: ["Back_wall", "COP_wall", "Handrail_wall", "Top_wall"] },
  recessedSingle: { show: ["COP_wall_RS", "Handrail_wall_RS", "Top_Wall_RS"], hideBase: ["COP_wall", "Handrail_wall", "Top_wall"], finish: ["Back_wall", "COP_wall_RS", "Handrail_wall_RS", "Top_Wall_RS"] },
  recessedFour:   { show: ["Recessed_4_Pannel"], hideBase: [], finish: ["Back_wall", "COP_wall", "Handrail_wall", "Top_wall", "Recessed_4_Pannel"] },
  // "Raised_Stripe" removed from `finish` 2026-08-13: it now gets its own dedicated finish via
  // applyRaisedStripeFinish() (the new raisedStripeFinish picker), not the regular Cab Finish choice.
  raisedStripe:   { show: ["Raised_Stripe"], hideBase: [], finish: ["Back_wall", "COP_wall", "Handrail_wall", "Top_wall"] },
  raisedFour:     { show: ["COP_wall_P4", "Handrail_wall_P4", "Top_Extra_P4"], hideBase: ["COP_wall", "Handrail_wall"], finish: ["Back_wall", "COP_wall_P4", "Handrail_wall_P4", "Top_wall", "Top_Extra_P4"] },
  glass:          { show: ["Glass", "Back_GW", "Handrail_wall_GW", "Outerwall_GlassCOP"], hideBase: ["Back_wall", "Handrail_wall"], finish: ["Back_GW", "COP_wall", "Handrail_wall_GW", "Top_wall"] },
  stainlessSteel: { show: [], hideBase: [], finish: ["Back_wall", "COP_wall", "Handrail_wall", "Top_wall"], metal: true },
};

// The v2 geometry gives recessedSingle and raisedFour their own back-wall mesh (Back_wall_RS /
// Back_wall_P4) instead of reusing the shared Back_wall. Swap it into show / hideBase / finish.
function withOwnBackWall(cfg, backWall) {
  return {
    ...cfg,
    show: [...cfg.show, backWall],
    hideBase: [...cfg.hideBase, "Back_wall"],
    finish: cfg.finish.map((n) => (n === "Back_wall" ? backWall : n)),
  };
}

// Detect which geometry is loaded (sentinel: the per-variant back wall) and pick the cab-style map.
// Runs once after the registry is built; both GLBs flow through the same render path afterwards.
function resolveGeometryVariant() {
  geometryV2 = registry.has("Back_wall_P4") || registry.has("Back_wall_RS");
  // Check the actual glass meshes, not the "Glass_Door" wrapper group: export5 (2026-07-28, 3D team
  // confirmed "for sliding door we have normal door and a glass door panel, visible only when glass
  // material is selected") ships Glass_D/GlassBorder_D as direct children of Sliding_Doors instead of
  // grouped under their own "Glass_Door" node — registry.has("Glass_Door") would miss them entirely.
  hasGlassDoor = registry.has("Glass_D");
  cabStyleNodes = geometryV2
    ? {
        ...CAB_STYLE_NODES,
        recessedSingle: withOwnBackWall(CAB_STYLE_NODES.recessedSingle, "Back_wall_RS"),
        raisedFour: withOwnBackWall(CAB_STYLE_NODES.raisedFour, "Back_wall_P4"),
      }
    : CAB_STYLE_NODES;
  document.body.dataset.geometryVariant = geometryV2 ? "v2" : "legacy";
}

const canvas = document.getElementById("elevatorCanvas");
const status = document.getElementById("modelStatus");
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x101010);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = tuneFloat("exposure", 0.95);
renderer.localClippingEnabled = true;
// Shadows off: the 3D team bakes occlusion into AO maps, so realtime shadows are redundant.
renderer.shadowMap.enabled = false;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

// Wheel-zoom bounds — also each view button's landing fov (see setCameraView's `views` object), so
// picking a view already sits at the max-zoomed-out ceiling instead of leaving room to scroll out
// further (client, 2026-08-13). 35 = zoomed in (telephoto), 80 = zoomed out (wide).
const VIEW_FOV_MIN = 35;
const VIEW_FOV_MAX = 80;

const camera = new THREE.PerspectiveCamera(VIEW_FOV_MAX, 1, 0.01, 200); // matches the view FOV (no jump on load)
const targetCamera = {
  position: new THREE.Vector3(),
  target: new THREE.Vector3(),
  fov: VIEW_FOV_MAX,
};
const cameraTarget = new THREE.Vector3();
const interiorLook = {
  yaw: Math.PI,
  pitch: -0.02,
  fov: 68,
  dragging: false,
  lastX: 0,
  lastY: 0,
};

const modelRoot = new THREE.Group();
scene.add(modelRoot);

const cutawayPlane = new THREE.Plane(new THREE.Vector3(0, 0, -1), 1);
renderer.clippingPlanes = [];

const registry = new Map();
const baseMaterials = new Map();
const materialLibrary = new Map();
const textureLoader = new THREE.TextureLoader();
const textureCache = new Map();

// KTX2/Basis Universal: material maps ship as .ktx2 (converted from the original .jpg/.png/.webp,
// see convert.sh in the handoff). Raw 4096x4096 JPEGs decode to ~64MB each of uncompressed GPU
// memory; the default configuration alone loads enough of those at once (wall AO + cab finish +
// COP art) to cross ~1GB and crash the WebKit tab on iOS (client-reported "A problem repeatedly
// occurred", 2026-08-26). KTX2/UASTC transcodes to a GPU-native compressed format instead, so the
// texture stays compressed in GPU memory (~1/4-1/6 the footprint) rather than being decoded to raw
// RGBA on upload.
const ktx2Loader = new KTX2Loader();
ktx2Loader.setTranscoderPath("./vendor/three/libs/basis/");
ktx2Loader.detectSupport(renderer);

function ktx2PathFor(path) {
  return path.replace(/\.(jpe?g|png|webp)$/i, ".ktx2");
}

// While non-null, every loadCompressedTexture() call appends its completion promise here so boot()
// can await the exact set of textures the initial applyConfiguration() kicked off — see boot() below.
// Reset to null once boot finishes; later option changes (user picking a different finish) go back to
// firing-and-forgetting, same as before, no loading-screen involvement.
let bootTexturePromises = null;
// Runs in lockstep with bootTexturePromises above (same lifecycle, same reset point) — one
// {loaded, total} entry per in-flight boot texture, updated live from each fetch's real download
// progress. Client, 2026-09-08: the bar used to jump straight to 40% (model downloads fast) then sit
// there a long time — texP was `doneFiles / totalFiles`, which only moves when a WHOLE file finishes,
// so it stalls completely while waiting on whichever texture happens to be the biggest. Tracking real
// bytes per file (KTX2Loader forwards native fetch progress the same way GLTFLoader already does for
// the model half, see loadModel()'s `event.loaded / event.total`) makes the bar move continuously the
// entire time something is in flight, not just when a file crosses the finish line.
let bootTextureProgress = null;

// Client, 2026-09-09: "por que la barra llega a 100% antes de que este listo todo... y te mantiene
// esperando en 100%?" — real bug, not a misunderstanding. KTX2Loader's onLoad (and this file's
// `ready` promise) only resolves AFTER the WASM transcode finishes, but this function was scoring
// each entry purely on DOWNLOAD bytes — so the aggregate could read 100% the moment every file
// finished downloading, while the transcode work (through a small worker pool, see
// vendor/utils/WorkerPool.js's default of 4) was still queued behind it. Got much more visible once
// desktop started preloading the full ~90-file catalog at boot instead of just the ~34-file default
// config (see preloadFullCatalogTexturesForBoot()) — more files means a longer transcode backlog
// after the same download phase. Fix: each entry can only reach 90% of its own weight from download
// bytes; the remaining 10% — and the true 100% — only lands once `entry.ready` is actually set (in
// loadCompressedTexture()'s onLoad/onError below, i.e. transcode really done). The bar now visibly
// creeps through that last stretch as files actually finish, instead of freezing at a dishonest 100%.
function paintBootTextureProgress() {
  if (!bootTextureProgress || !bootTextureProgress.length) return;
  let sum = 0;
  for (const entry of bootTextureProgress) {
    if (entry.ready) {
      sum += 1;
    } else {
      const frac = entry.total > 0 ? entry.loaded / entry.total : 0;
      sum += Math.min(frac, 1) * 0.9;
    }
  }
  bootLoader.setTextures(sum / bootTextureProgress.length);
}

// Mirrors THREE.TextureLoader's own pattern: return a texture synchronously so every existing
// call site (`texture.colorSpace = ...`, `texture.flipY = ...`, etc. right after the load call)
// keeps working unchanged, then fill in the real (compressed) pixel data once the async
// fetch+transcode finishes. Only the pixel-data fields are copied from the loaded texture — every
// property the caller sets on the placeholder (colorSpace, flipY, wrap modes, anisotropy, repeat,
// rotation) is left untouched, so it survives the later swap intact.
// onFail (optional): called right before resolving on a load error, so the caller can evict its own
// textureCache entry — otherwise a texture that fails once (transient network blip, server hiccup) stays
// cached as a permanently-empty CompressedTexture for the rest of the session: every wrapper below sets
// its cache entry BEFORE the async load settles (deliberately, so concurrent requests for the same
// texture share one in-flight fetch instead of firing duplicates), so a failure needs an explicit way
// to undo that. Client, 2026-09-09: reported combos (Flat Veneer+Walnut, Flat Melamine+Gibraltar) never
// reproduced locally, but this closes the specific failure mode that would explain it without needing a
// page refresh to fix itself.
// DESKTOP-ONLY EXPERIMENT (2026-09-12, separate deployment — Cambridge-Configurator-RGB/, NOT the
// production default): client asked to test reverting desktop back to the original uncompressed
// jpg/png/webp files (loaded via plain THREE.TextureLoader, no KTX2 at all), suspecting the KTX2/UASTC
// migration (session #68) made things look/feel worse, not better — and to test it on a separate link
// rather than production. Mobile is explicitly excluded (keeps KTX2 + the lightweight tier exactly as
// deployed) — this experiment is scoped to desktop only, same convention as every other tier-specific
// change in this file. THREE.TextureLoader already implements the same "return a texture synchronously,
// fill the image in once it loads" pattern loadCompressedTexture() has to hand-roll for KTX2Loader below
// — no manual field-copying needed, the loader's own returned Texture IS the one to use.
function loadRawTexture(path, onFail) {
  const progressEntry = bootTextureProgress ? { loaded: 0, total: 0, ready: false } : null;
  if (progressEntry) bootTextureProgress.push(progressEntry);
  let resolveReady;
  const ready = new Promise((resolve) => { resolveReady = resolve; });
  const texture = textureLoader.load(
    path, // the ORIGINAL file — no ktx2PathFor() swap
    () => {
      if (progressEntry) { progressEntry.ready = true; paintBootTextureProgress(); }
      resolveReady();
    },
    progressEntry ? (event) => {
      progressEntry.loaded = event.loaded;
      if (event.lengthComputable) progressEntry.total = event.total;
      paintBootTextureProgress();
    } : undefined,
    (error) => {
      console.error("Texture failed to load:", path, error);
      if (progressEntry) { progressEntry.ready = true; paintBootTextureProgress(); }
      onFail?.();
      resolveReady();
    }
  );
  bootTexturePromises?.push(ready);
  return texture;
}

function loadCompressedTexture(path, onFail) {
  const resolvedPath = tierPath(path);
  if (!IS_MOBILE_TIER) return loadRawTexture(resolvedPath, onFail);
  const texture = new THREE.CompressedTexture();
  // Only set up while boot() is actively collecting the default configuration's textures (see
  // bootTextureProgress above) — later on-demand loads (user picking a new finish) skip the tracking
  // entirely, same as they already skip bootTexturePromises.
  const progressEntry = bootTextureProgress ? { loaded: 0, total: 0, ready: false } : null;
  if (progressEntry) bootTextureProgress.push(progressEntry);
  const ready = new Promise((resolve) => {
    ktx2Loader.load(
      ktx2PathFor(resolvedPath),
      (loaded) => {
        if (progressEntry) {
          // Transcode actually finished here — this is the real "done" signal, not the download tick.
          progressEntry.ready = true;
          paintBootTextureProgress();
        }
        texture.source = loaded.source;
        texture.mipmaps = loaded.mipmaps;
        texture.format = loaded.format;
        texture.internalFormat = loaded.internalFormat;
        texture.type = loaded.type;
        texture.needsUpdate = true;
        loaded.dispose();
        resolve();
      },
      progressEntry ? (event) => {
        progressEntry.loaded = event.loaded;
        if (event.lengthComputable) progressEntry.total = event.total;
        paintBootTextureProgress();
      } : undefined,
      (error) => {
        console.error("KTX2 texture failed to load:", ktx2PathFor(resolvedPath), error);
        if (progressEntry) {
          // A failed fetch must never hang the bar below 100% forever — count it as its own "done".
          progressEntry.ready = true;
          paintBootTextureProgress();
        }
        onFail?.(); // let the caller uncache this key so a later pick retries instead of staying black
        resolve(); // a failed texture must never hang the boot loader — it just stays untextured
      }
    );
  });
  bootTexturePromises?.push(ready);
  return texture;
}
let loadedModel = null;
let modelSize = 1;
let normalizedBox = new THREE.Box3();
let modelLocalBox = new THREE.Box3();
let activeEnvironmentMap = null;
// True when the loaded GLB is the 2026-06-23+ geometry: per-variant back walls (Back_wall_P4 /
// Back_wall_RS) and full-space accordion door (no Doorwall_AG). Detected from the registry after
// load so the same code path serves both the current production GLB and the newer one.
let geometryV2 = false;
// True when the loaded GLB has the dedicated "Glass_Door" mesh group (Glass_D + GlassBorder_D), added
// 2026-07-02 (elevator-v6). Older models fall back to re-texturing the opaque Sliding_Doors leaf.
let hasGlassDoor = false;
let cabStyleNodes = null; // resolved per-model in resolveGeometryVariant()
// Which ?model= variant is loaded (set in loadModel()). Used to gate model-specific behavior, e.g. the
// AO bake in applyBaseAO() doesn't match the "smalltest" preview GLB's UVs (client, 2026-07-20: remove it).
let activeModelParam = null;

// ---------------------------------------------------------------------------
// Boot loader — hold a full-screen overlay until the GLB is downloaded (plus a
// couple of small UI icons). Finish textures load lazily as .ktx2 through
// KTX2Loader when each option is actually applied — see collectPreloadUrls()
// for why the old eager preload-everything approach was removed.
// ---------------------------------------------------------------------------
const bootLoader = (() => {
  const el = document.getElementById("appLoader");
  const fill = document.getElementById("appLoaderFill");
  const text = document.getElementById("appLoaderText");
  let modelP = 0;
  let texP = 0;
  const paint = () => {
    // Weight: model download 40%, texture warm-up 60% of the bar.
    const raw = modelP * 0.4 + texP * 0.6;
    // Math.round() used to show "100%" whenever raw rounded up from e.g. 99.6% — which happened
    // whenever all-but-one boot texture had actually finished (transcode complete) while the last one
    // was still finishing up (see paintBootTextureProgress() below for why "downloaded" != "ready").
    // That 0.4%-ish rounding gap was enough to read as the bar freezing at 100% for real seconds while
    // still legitimately waiting (client, 2026-09-09). floor() (with 100 reserved for the true 1.0)
    // means "100%" only ever displays at the exact instant everything really is ready.
    const pct = raw >= 1 ? 100 : Math.floor(raw * 100);
    if (fill) fill.style.width = `${pct}%`;
    if (text) text.textContent = `Loading ${pct}%`;
  };
  return {
    setModel(p) { modelP = Math.min(1, Math.max(modelP, p || 0)); paint(); },
    setTextures(p) { texP = Math.min(1, Math.max(texP, p || 0)); paint(); },
    finish() {
      modelP = 1; texP = 1; paint();
      if (text) text.textContent = "Ready";
      if (!el) return;
      el.classList.add("is-hidden");
      setTimeout(() => el.remove(), 600); // drop after the fade so it can't intercept clicks
    },
  };
})();

function preloadImage(url) {
  return new Promise((resolve) => {
    const img = new Image();
    const done = () => resolve();
    // decode() forces the browser to fully decode now, not on first paint.
    img.onload = () => { (img.decode ? img.decode() : Promise.resolve()).then(done, done); };
    img.onerror = done; // a missing/broken texture must never stall the loader
    img.src = url;
  });
}

// Only the small UI icon PNGs get warmed here now. Material textures (item.texture/alphaMap, the
// COP artwork combos, the AO/floor/lights set) used to be preloaded too via plain `new Image()` +
// `decode()` — that meant decoding 100+ full-resolution 4096px images concurrently before the
// configurator even finished booting, regardless of which options were actually selected. That's
// the real crash: on iOS the WebKit tab runs out of memory mid-decode and the page reloads with
// "A problem repeatedly occurred" (client-reported, 2026-08-26) before "Loading" even reaches 1%.
// It's also moot now that materials load as .ktx2 (see loadCompressedTexture) — warming the browser's
// decode cache for the old .jpg/.png/.webp files no longer helps the texture that actually gets
// applied. Each material's .ktx2 now loads on demand, through Three.js/KTX2Loader, exactly when its
// option is applied — never more than the handful of textures the current configuration needs.
function collectPreloadUrls() {
  const urls = new Set();
  options.forEach((group) => (group.items || []).forEach((item) => {
    if (item.thumbImg) urls.add(item.thumbImg);
  }));
  return Array.from(urls);
}

async function preloadAllTextures(onProgress) {
  const urls = collectPreloadUrls();
  if (!urls.length) { onProgress?.(1); return; }
  let done = 0;
  onProgress?.(0);
  await Promise.all(urls.map((url) => preloadImage(url).then(() => {
    done += 1;
    onProgress?.(done / urls.length);
  })));
}

// ---------------------------------------------------------------------------
// Full-catalog background prefetch — BOTH tiers (see IS_MOBILE_TIER at the top of the file; desktop
// enabled 2026-09-09, was mobile-only at first). Client asked to bring back "preload everything" (no
// black flash on first pick of an untried option) without reintroducing the 2026-08-26 iOS crash. That
// crash had two causes (see the boot() comment below and HANDOFF session #68): decoding raw RGBA via
// new Image()+decode(), and firing 100+ of those concurrently via Promise.all. Neither applies here:
//   - This only ever does a plain fetch() of the already-KTX2-compressed bytes and lets the browser
//     cache them — it never creates a THREE texture, never decodes to RGBA, never touches the GPU. Zero
//     GPU-memory cost; the browser's own HTTP cache can be evicted under memory pressure, unlike a
//     resident WebGL texture.
//   - Strictly sequential — one file awaited (with a fixed pacing delay, see the comment inside
//     prefetchFullCatalogInBackground for why not requestIdleCallback) at a time, never Promise.all.
//     Peak concurrent memory/bandwidth is "one file", regardless of catalog size.
// The real material helpers (aoTexture()/copTexture()/textureFor()/etc.) are UNCHANGED — they still run
// their usual KTX2Loader transcode + GPU upload the first time an option is actually picked. What this
// buys is the network round-trip: once a URL is warm, that fetch resolves from cache instead of going
// over the wire. collectFullCatalogTexturePaths()/tierPath() already resolve to whichever tier's
// folders are active (AO_EXPORT5_DIR, cab-finishes[-mobile]/, fixtures[-mobile]/), so this naturally
// prefetches the full-resolution catalog on desktop and the lighter one on mobile — no tier-specific
// branching needed here, just running it unconditionally in boot().
function collectFullCatalogTexturePaths() {
  const paths = new Set();
  options.forEach((group) => (group.items || []).forEach((item) => {
    if (item.texture) paths.add(item.texture);
    if (item.alphaMap) paths.add(item.alphaMap);
  }));
  Object.values(AO_BASE_EXPORT5).forEach((p) => paths.add(p));
  Object.values(WALL_STYLE_AO_EXPORT5).forEach((overrides) => {
    Object.values(overrides).forEach((p) => paths.add(p));
  });
  const copFinishIds = (options.find((g) => g.id === "copFinish")?.items || []).map((item) => item.id);
  Object.values(copFinishFolders).forEach((folder) => {
    const base = `./assets/textures/cop/${folder}`;
    copFinishIds.forEach((id) => paths.add(copFinishTexturePath(folder, id)));
    paths.add(`${base}/normal.png`);
    paths.add(`${base}/opacity.webp`);
  });
  Object.values(LIGHT_FIXTURE).forEach((fixture) => {
    paths.add(fixture.map);
    paths.add(fixture.normal);
  });
  paths.add("./assets/textures/floor/base-color.jpg");
  paths.add("./assets/textures/floor/normal.png");
  paths.add("./assets/textures/environment/outer-hdri.jpg");
  return Array.from(paths);
}

async function prefetchFullCatalogInBackground() {
  const urls = collectFullCatalogTexturePaths().map((p) => ktx2PathFor(tierPath(p)));
  // requestIdleCallback doesn't fire reliably here: the render loop's continuous
  // requestAnimationFrame (animate(), camera lerp every frame) keeps the main thread just busy enough
  // that Chromium's scheduler never considers the page truly idle — verified directly (0 fetches after
  // 20s with requestIdleCallback). A fixed setTimeout pacing gives up "true idle" politeness but
  // guarantees forward progress; 150ms between fetches is plenty slow to stay one-file-at-a-time (the
  // actual safety property that matters, not idleness).
  for (const url of urls) {
    await new Promise((resolve) => setTimeout(resolve, 150));
    try {
      await fetch(url, { cache: "force-cache" }).then((r) => r.blob());
    } catch {
      // A failed prefetch must never break anything — the real loader just fetches it fresh later.
    }
  }
}

// DESKTOP ONLY, called from boot() before the loading screen hides (see below). Cycles state through
// every real option combination and calls the SAME applyConfiguration() a user's click would, so every
// texture in the catalog gets loaded through the real helpers (aoTexture()/copTexture()/textureFor()/
// etc.) — real cache keys, real per-node rotation/tile settings, not guessed. Safe to do this "loudly"
// (mutating the live scene through every combination) because the canvas is still hidden behind
// #appLoader this entire time — the user never sees any of the intermediate states. Client, 2026-09-09:
// asked for zero black-flash on desktop specifically (mobile explicitly NOT included — see IS_MOBILE_TIER
// gate in boot() — mobile is exactly the device class this whole tiered-loading architecture exists to
// protect, and mobile's lighter background-fetch-only prefetch stays as-is).
async function preloadFullCatalogTexturesForBoot() {
  const savedState = { ...state };

  // Paced, not a synchronous burst (client-reported, 2026-09-09: some finish combos — Flat Veneer +
  // Walnut, Flat Melamine + Gibraltar, reported by multiple people — rendered black on first load).
  // Root cause was never pinned down with certainty (never reproduced locally, against production, on
  // either tier), but firing ~90 applyConfiguration() calls back-to-back with zero pacing was always
  // inconsistent with how carefully this file paces literally every other bulk-load path (see the
  // 150ms delay in prefetchFullCatalogInBackground() below, added specifically to never repeat the
  // 2026-08-26 crash shape of "everything at once"). A burst that size can plausibly exhaust a
  // browser's per-origin connection pool or a slow real connection's bandwidth per request badly
  // enough for a fetch or the KTX2 worker-pool transcode to fail — and a failed load still gets cached
  // (see loadCompressedTexture()'s onError, which marks the entry "ready" so boot() doesn't hang
  // forever) as a permanently-empty CompressedTexture, which is exactly what a black wall looks like.
  // A small delay between each state change keeps this sweep's request shape closer to "steady trickle"
  // than "stampede", same spirit as the rest of this file.
  const visit = async () => {
    applyConfiguration();
    await new Promise((resolve) => setTimeout(resolve, 40));
  };

  // cabStyle first: applyWallStyleAOExport5() only loads a style's OWN wall-AO override (P4/RS/raised
  // Stripe wall bakes) while that style is actually selected — those 3 styles' unique files never get
  // requested otherwise, no matter what else runs below.
  try {
    for (const item of options.find((g) => g.id === "cabStyle")?.items || []) {
      state.cabStyle = item.id;
      await visit();
    }

    // gateFinish: pair state.gate with each item's own .gate field (exactly what the UI only ever lets
    // a user do) so applyGateFinish() resolves the same target nodes/rotation a real pick would — the
    // texture cache key includes that rotation, not just the file path, so getting this wrong would
    // cache the wrong variant.
    for (const item of options.find((g) => g.id === "gateFinish")?.items || []) {
      state.gate = item.gate;
      state.gateFinish = item.id;
      await visit();
    }

    // Independent single-axis groups — each item only affects the one field it belongs to.
    for (const groupId of ["cabFinish", "raisedStripeFinish", "handrailFinish", "lighting"]) {
      for (const item of options.find((g) => g.id === groupId)?.items || []) {
        state[groupId] = item.id;
        await visit();
      }
    }

    // COP art is a real cross product (folder x finish, see copFinishFolders/applyCopFinish()), not
    // two independent axes — has to be a nested loop or 2/3 of the combinations never get requested.
    const copItems = options.find((g) => g.id === "cop")?.items || [];
    const copFinishItems = options.find((g) => g.id === "copFinish")?.items || [];
    for (const copItem of copItems) {
      state.cop = copItem.id;
      for (const finishItem of copFinishItems) {
        state.copFinish = finishItem.id;
        await visit();
      }
    }
  } finally {
    // Restore the real default even if something above threw — otherwise the canvas would come out from
    // behind the loading screen showing whatever combination the sweep happened to be on at that point.
    Object.assign(state, savedState);
    applyConfiguration();
  }
}

async function boot() {
  bootTexturePromises = [];
  bootTextureProgress = [];
  const iconsReady = preloadAllTextures(() => {});
  const modelReady = new Promise((resolve) =>
    loadModel((p) => bootLoader.setModel(p), () => resolve()));
  // loadModel()'s GLTFLoader onLoad runs applyConfiguration() before resolving modelReady, so by the
  // time this await settles, bootTexturePromises already holds every .ktx2 the default configuration
  // needs (wall AO, cab/handrail/COP finish, etc.) — same set that used to render solid black for a
  // few seconds while still in flight (client-reported, 2026-08-26). Wait for those too before hiding
  // the loading screen, so the model only appears once it's actually textured.
  await Promise.all([modelReady, iconsReady]);
  // Desktop only (see preloadFullCatalogTexturesForBoot() above): pushes the ENTIRE catalog onto
  // bootTexturePromises/bootTextureProgress, the same arrays the default config above already used —
  // captured together below, so the loading bar keeps reflecting real combined progress instead of
  // resetting.
  if (!IS_MOBILE_TIER) await preloadFullCatalogTexturesForBoot();
  const pending = bootTexturePromises;
  bootTexturePromises = null;
  if (!pending.length) bootLoader.setTextures(1);
  // No manual done/total bookkeeping here anymore — each texture's own onProgress callback (see
  // loadCompressedTexture()) already repaints the bar in real time as bytes come in.
  await Promise.all(pending);
  bootTextureProgress = null;
  bootLoader.finish();
  // Fire-and-forget. Mobile only now: desktop just loaded the full catalog for real above (transcoded,
  // GPU-resident), so a background fetch()-only cache warm afterward would be pure redundant work.
  if (IS_MOBILE_TIER) prefetchFullCatalogInBackground();
}
const HDRI_ROTATION = 45;
const sceneLights = {};
setupLights();
setupEnvironment();
buildControls();
setupInteriorLookControls();
setupQuoteModal();
boot();
animate();

window.__elevatorScene = { THREE, scene, renderer, lights: sceneLights };
window.__materialOverrides?.onSceneReady?.(window.__elevatorScene);

function setupLights() {
  // Lowered from the old values: without materials-v2's onSceneReady rebalance the cab was
  // washing out. Ambient/hemi/fill dropped hard; key kept to give the walls shape. ?light=N scales all.
  const m = tuneFloat("light", 1);
  sceneLights.ambient = new THREE.AmbientLight(0xfff7ed, 0.22 * m);
  scene.add(sceneLights.ambient);

  sceneLights.hemi = new THREE.HemisphereLight(0xffffff, 0x8a8783, 0.45 * m);
  scene.add(sceneLights.hemi);

  sceneLights.key = new THREE.DirectionalLight(0xffffff, 1.3 * m);
  sceneLights.key.position.set(-3.5, 5.2, 4.2);
  sceneLights.key.castShadow = true;
  sceneLights.key.shadow.bias = -0.0002;
  sceneLights.key.shadow.normalBias = 0.025;
  sceneLights.key.shadow.mapSize.set(1024, 1024);
  scene.add(sceneLights.key);

  sceneLights.fill = new THREE.DirectionalLight(0xdce8ff, 0.4 * m);
  sceneLights.fill.position.set(3.5, 2.6, -2.8);
  scene.add(sceneLights.fill);

  // Warm accent light. Aligned to a real ceiling LED fixture (front-center, LedLight_5 at
  // x0 z0.353 y2.623) so its glow reads as coming from an actual light instead of floating
  // off-fixture on the ceiling. Just below the ceiling plane (~2.69).
  sceneLights.warm = new THREE.PointLight(0xffdfb8, 0.3 * m, 8);
  sceneLights.warm.position.set(0, 2.62, 0.353);
  scene.add(sceneLights.warm);
}

function setupEnvironment() {
  const envTexture = createStudioEnvironmentTexture();
  applyEnvironmentTexture(envTexture, 1.15);
  envTexture.dispose();

  loadRadianceEnvironment(environmentPath)
    .then((hdrTexture) => {
      applyEnvironmentTexture(hdrTexture, tuneFloat("env", 0.7));
      hdrTexture.dispose();
    })
    .catch((error) => {
      document.body.dataset.environment = "procedural-fallback";
      document.body.dataset.environmentError = error.message;
    });
}

function applyEnvironmentTexture(texture, intensity = 1) {
  if (!texture) return;

  const rotation = THREE.MathUtils.degToRad(HDRI_ROTATION);

  // Rotate the equirectangular HDR horizontally.
  // The HDR is represented as a DataTexture, so rotate its pixels
  // before sending it through PMREM.
  const width = texture.image.width;
  const height = texture.image.height;
  const source = texture.image.data;

  if (width && height && source) {
    const channels = source.length / (width * height);
    const rotated = new source.constructor(source.length);

    const shift = Math.round((HDRI_ROTATION / 360) * width);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let sourceX = (x - shift) % width;
        if (sourceX < 0) sourceX += width;

        const srcIndex = (y * width + sourceX) * channels;
        const dstIndex = (y * width + x) * channels;

        for (let c = 0; c < channels; c++) {
          rotated[dstIndex + c] = source[srcIndex + c];
        }
      }
    }

    texture.image.data = rotated;
    texture.needsUpdate = true;
  }

  texture.mapping = THREE.EquirectangularReflectionMapping;
  texture.colorSpace = THREE.LinearSRGBColorSpace;

  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  const envMap = pmrem.fromEquirectangular(texture).texture;

  if (activeEnvironmentMap) {
    activeEnvironmentMap.dispose();
  }

  activeEnvironmentMap = envMap;

  scene.environment = envMap;
  scene.environmentIntensity = intensity;

  pmrem.dispose();
}

async function loadRadianceEnvironment(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`Could not load HDR environment: ${path}`);
  const buffer = await response.arrayBuffer();
  const texture = parseRadianceHDR(buffer);
  texture.name = "mirrored_hall_1k.hdr";
  return texture;
}

function parseRadianceHDR(buffer) {
  const bytes = new Uint8Array(buffer);
  let position = 0;
  const headerLines = [];

  while (position < bytes.length) {
    let line = "";
    while (position < bytes.length) {
      const char = String.fromCharCode(bytes[position++]);
      if (char === "\n") break;
      line += char;
    }
    headerLines.push(line);
    if (/^[+-]Y\s+\d+\s+[+-]X\s+\d+/u.test(line)) break;
  }

  const header = headerLines.join("\n");
  const resolutionMatch = header.match(/-Y\s+(\d+)\s+\+X\s+(\d+)/u);
  if (!resolutionMatch) throw new Error("Unsupported HDR resolution header");
  const height = Number(resolutionMatch[1]);
  const width = Number(resolutionMatch[2]);
  const rgbe = decodeRGBEScanlines(bytes, position, width, height);
  const data = new Float32Array(width * height * 4);

  for (let i = 0, j = 0; i < rgbe.length; i += 4, j += 4) {
    const exponent = rgbe[i + 3];
    if (exponent) {
      const scale = Math.pow(2, exponent - 128) / 255;
      data[j] = rgbe[i] * scale;
      data[j + 1] = rgbe[i + 1] * scale;
      data[j + 2] = rgbe[i + 2] * scale;
    }
    data[j + 3] = 1;
  }

  const texture = new THREE.DataTexture(data, width, height, THREE.RGBAFormat, THREE.FloatType);
  texture.mapping = THREE.EquirectangularReflectionMapping;
  texture.colorSpace = THREE.LinearSRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function decodeRGBEScanlines(bytes, offset, width, height) {
  const data = new Uint8Array(width * height * 4);
  let position = offset;
  const scanline = new Uint8Array(width * 4);

  for (let y = 0; y < height; y += 1) {
    if (bytes[position] !== 2 || bytes[position + 1] !== 2 || (bytes[position + 2] & 0x80)) {
      data.set(bytes.subarray(position, position + width * height * 4), y * width * 4);
      return data;
    }

    const scanlineWidth = (bytes[position + 2] << 8) | bytes[position + 3];
    if (scanlineWidth !== width) throw new Error("HDR scanline width mismatch");
    position += 4;

    for (let channel = 0; channel < 4; channel += 1) {
      let x = 0;
      while (x < width) {
        const count = bytes[position++];
        if (count > 128) {
          const runLength = count - 128;
          const value = bytes[position++];
          scanline.fill(value, channel * width + x, channel * width + x + runLength);
          x += runLength;
        } else {
          scanline.set(bytes.subarray(position, position + count), channel * width + x);
          position += count;
          x += count;
        }
      }
    }

    const outputOffset = y * width * 4;
    for (let x = 0; x < width; x += 1) {
      data[outputOffset + x * 4] = scanline[x];
      data[outputOffset + x * 4 + 1] = scanline[width + x];
      data[outputOffset + x * 4 + 2] = scanline[width * 2 + x];
      data[outputOffset + x * 4 + 3] = scanline[width * 3 + x];
    }
  }

  return data;
}

function createStudioEnvironmentTexture() {
  const envCanvas = document.createElement("canvas");
  envCanvas.width = 1024;
  envCanvas.height = 512;
  const context = envCanvas.getContext("2d");
  const sky = context.createLinearGradient(0, 0, 0, envCanvas.height);
  sky.addColorStop(0, "#fff5e6");
  sky.addColorStop(0.38, "#d6c9b7");
  sky.addColorStop(0.62, "#7d766e");
  sky.addColorStop(1, "#211f1d");
  context.fillStyle = sky;
  context.fillRect(0, 0, envCanvas.width, envCanvas.height);

  drawSoftPanel(context, envCanvas.width * 0.18, envCanvas.height * 0.22, 260, 92, "rgba(255, 247, 232, 0.92)");
  drawSoftPanel(context, envCanvas.width * 0.56, envCanvas.height * 0.18, 360, 112, "rgba(255, 255, 255, 0.78)");
  drawSoftPanel(context, envCanvas.width * 0.68, envCanvas.height * 0.48, 260, 72, "rgba(255, 224, 180, 0.42)");

  const texture = new THREE.CanvasTexture(envCanvas);
  texture.mapping = THREE.EquirectangularReflectionMapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function drawSoftPanel(context, x, y, width, height, color) {
  const fadedColor = color.replace(/[\d.]+\)$/u, "0.28)");
  const gradient = context.createRadialGradient(x, y, 0, x, y, Math.max(width, height));
  gradient.addColorStop(0, color);
  gradient.addColorStop(0.55, fadedColor);
  gradient.addColorStop(1, "rgba(255, 255, 255, 0)");
  context.fillStyle = gradient;
  context.fillRect(x - width * 0.5, y - height * 0.5, width, height);
}

function buildControls() {
  const stepRoot = document.getElementById("stepNav");
  renderAccordion(stepRoot);

  stepRoot.addEventListener("click", (event) => {
    const header = event.target.closest(".step-header");
    if (header) {
      const index = Number(header.dataset.step);
      activeOptionIndex = activeOptionIndex === index ? -1 : index;
      renderAccordion(stepRoot);
      updateOptionAvailability();
      scrollOpenStepIntoView(stepRoot);
      return;
    }

    const card = event.target.closest(".option-card");
    if (!card) return;
    const { group, value } = card.dataset;
    state[group] = value;

    // Client, 2026-09-28: "COP & Handrail Finish" is ONE set of buttons — picking a copFinish swatch
    // drives the handrail too (same id in both, e.g. "bronze"). Each side still renders its own way
    // (applyCopFinish()'s per-COP-type texture cross-product vs applyHandrailFinish()'s flat colours),
    // this just keeps them in sync instead of giving Handrail its own (now hidden) button set.
    if (group === "copFinish") state.handrailFinish = value;

    // Glass Cab only ever shows with the sliding door + its own "Glass - Stainless Panels" finish
    // (merged from the 3D team's copy, 2026-08-13) — Door Style/Door Finish are hidden for this cab
    // style (see isGroupVisible), so force the values they'd otherwise have picked.
    if (group === "cabStyle" && value === "glass") {
      state.gate = "sliding";
      state.gateFinish = "slidingGlass";
    }

    renderAccordion(stepRoot);
    updateOptionAvailability();
    applyConfiguration();
  });

  document.querySelectorAll(".view-button").forEach((button) => {
    button.addEventListener("click", () => {
      state.view = button.dataset.view;
      setCameraView(state.view);
      document.querySelectorAll(".view-button").forEach((other) => {
        const isActive = other === button;
        other.classList.toggle("active", isActive);
        other.setAttribute("aria-pressed", String(isActive));
      });
    });
  });

  updateOptionAvailability();
}

// Groups that only make sense for certain state (2026-08-13, merged from the 3D team's copy):
// raisedStripeFinish only when the Raised Accent Stripe cab style is active; gate/gateFinish are
// moot for Glass Cab (forced to sliding + "Glass - Stainless Panels" the moment it's picked, see
// the cabStyle click handler in buildControls()). Shared by renderAccordion (which of the 9-or-10
// steps to render) and the quote summary (collectConfiguration/buildQuoteSummary), so a hidden step
// never leaves a stray "Raised Stripe Finish: Walnut Veneer" line in a quote for a non-striped cab.
function isGroupVisible(group) {
  if (group.id === "raisedStripeFinish" && state.cabStyle !== "raisedStripe") return false;
  if ((group.id === "gate" || group.id === "gateFinish") && state.cabStyle === "glass") return false;
  // Client, 2026-09-28: Handrail Finish no longer has its own step/button set — the copFinish click
  // handler (buildControls()) writes state.handrailFinish too, so this group is data-only now (still
  // read by applyHandrailFinish() and the texture-prefetch/QA sweeps), never rendered or listed in the
  // quote summary (collectConfiguration/buildQuoteSummary both filter through isGroupVisible()).
  if (group.id === "handrailFinish") return false;
  return true;
}

function renderAccordion(stepRoot) {
  // Step numbers count only VISIBLE groups (not raw array position) so an optional step like
  // Raised Stripe Finish doesn't leave a gap in the numbering when hidden, or shift every later
  // step by one when shown — client, 2026-08-13, flagged exactly this risk before the step existed:
  // "Cab Finish es 4, Lighting es 6... a un cliente le va a parecer que no sabemos contar".
  // (2026-09-28: reverted to one-group-per-step — Handrail Finish is hidden via isGroupVisible() and
  // copFinish's own click handler drives both, see buildControls().)
  let visibleCount = 0;
  stepRoot.innerHTML = options
    .map((group, index) => {
      if (!isGroupVisible(group)) return "";
      visibleCount += 1;
      const displayNumber = visibleCount;
      const title = group.title.replace(/^\d+\.\s*/, "");
      const isOpen = index === activeOptionIndex;
      const complete = Boolean(state[group.id]);
      const currentLabel = labelFor(group.id, state[group.id]) || "Select option";
      const visibleItems = visibleItemsForGroup(group);
      const bodyHtml = visibleItems
        .map((item) => {
          const active = state[group.id] === item.id ? " active" : "";
          return `
            <button class="option-card${active}" type="button" data-group="${group.id}" data-value="${item.id}" aria-pressed="${state[group.id] === item.id}">
              <span class="thumb">${renderThumb(group, item)}<span class="check">✓</span></span>
              <span class="label">${item.label}</span>
            </button>`;
        })
        .join("");
      return `
        <div class="step-item${isOpen ? " is-open" : ""}${complete ? " complete" : ""}" data-option-group="${group.id}" data-step-index="${index}">
          <button class="step-header" type="button" data-step="${index}" aria-expanded="${isOpen}" aria-label="${group.title}">
            <span class="step-icon" style="--step-icon: url('${stepIconFor(group.id)}')" aria-hidden="true"></span>
            <span class="step-number">${displayNumber}</span>
            <span class="step-copy">
              <strong>${title}</strong>
              <span>${currentLabel}</span>
            </span>
            <span class="step-chevron" aria-hidden="true"></span>
          </button>
          <div class="step-body">
            <div class="option-grid">${bodyHtml}</div>
          </div>
        </div>`;
    })
    .join("");
}

function scrollOpenStepIntoView(stepRoot) {
  if (activeOptionIndex < 0) return;
  const item = stepRoot.querySelector(`[data-step-index="${activeOptionIndex}"]`);
  if (!item) return;
  item.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function visibleItemsForGroup(group) {
  if (group.id === "gateFinish") {
    return group.items.filter((item) => item.gate === state.gate);
  }

  if (group.id === "cabFinish") {
    const style = itemFor("cabStyle", state.cabStyle);
    if (style.finishGroup === "none") return [];
    return group.items.filter((item) => style.finishGroup === "all" || style.finishGroup === item.group);
  }

  return group.items;
}

function stepIconFor(groupId) {
  const icons = {
    gate: "./cambridge_svg_icons/door-style.svg",
    gateFinish: "./cambridge_svg_icons/material-finish.svg",
    cabStyle: "./cambridge_svg_icons/cab-style.svg",
    cabFinish: "./cambridge_svg_icons/material-finish.svg",
    lighting: "./cambridge_svg_icons/lighting.svg",
    cop: "./cambridge_svg_icons/car-operating-panel.svg",
    copFinish: "./cambridge_svg_icons/fixtures-finish.svg",
    handrail: "./cambridge_svg_icons/handrails.svg",
    handrailFinish: "./cambridge_svg_icons/fixtures-finish.svg",
  };
  return icons[groupId] || "./cambridge_svg_icons/summary.svg";
}

function selectionPrompt(groupId) {
  const prompts = {
    gate: "Select the door style for your elevator.",
    gateFinish: "Choose the available finish for the selected door.",
    cabStyle: "Select the interior cab style.",
    cabFinish: "Choose the material or finish for the interior walls.",
    lighting: "Select the interior lighting package.",
    cop: "Select the car operating panel.",
    copFinish: "Choose the finish for the COP and the handrail.",
    handrail: "Select the handrail profile.",
    handrailFinish: "Choose the handrail finish.",
  };
  return prompts[groupId] || "Select an option.";
}

function renderThumb(group, item) {
  // A thumbImg (PNG icon) takes priority over the CSS-drawn artwork (used for Door Style + Lighting).
  if (item.thumbImg) return `<span class="thumb-img" style="background-image:url('${item.thumbImg}')"></span>`;
  if (group.type === "swatch") return `<span class="swatch ${item.thumb}"></span>`;
  if (group.type === "lights") {
    return `<span class="${item.thumb}">${Array.from({ length: item.dots }, () => "<span class='dot'></span>").join("")}</span>`;
  }
  return `<span class="${item.thumb}"></span>`;
}

// Generate planar UVs for a geometry that has none. Projects vertex positions along the two
// widest axes (the third, thinnest axis is the wall's normal). UVs are in local units scaled by
// PLANAR_UV_TILE; finish materials set texture.repeat to dial the wood grain size from there.
const PLANAR_UV_TILE = 680; // lower = finer/denser wood grain (was 1000)
function ensurePlanarUV(geometry) {
  if (geometry.attributes.uv) return;
  const pos = geometry.attributes.position;
  if (!pos) return;
  geometry.computeBoundingBox();
  const bb = geometry.boundingBox;
  const sx = bb.max.x - bb.min.x;
  const sy = bb.max.y - bb.min.y;
  const sz = bb.max.z - bb.min.z;
  let a, b; // the two axes to project onto (drop the thinnest)
  if (sx <= sy && sx <= sz) { a = "z"; b = "y"; }
  else if (sy <= sx && sy <= sz) { a = "x"; b = "z"; }
  else { a = "x"; b = "y"; }
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i += 1) {
    const comp = { x: pos.getX(i), y: pos.getY(i), z: pos.getZ(i) };
    uv[i * 2] = comp[a] / PLANAR_UV_TILE;
    uv[i * 2 + 1] = comp[b] / PLANAR_UV_TILE;
  }
  geometry.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  geometry.userData.__generatedUV = true; // mark: not the team's AO-unwrapped UVs
}

// COP quads shipping a narrow vertical sliver of UVs (U ~0.40-0.60, V 0-1) instead of the full 0-1
// square — the per-finish COP texture (a tall single image, no atlas) renders as a thin cropped strip
// stretched across the whole quad. First seen 2026-07-20 on the "smalltest" preview GLB's single generic
// "COP" mesh (client: "texture is still getting stretched", fixed in session #27). Same root cause found
// again 2026-07-28 in elevator-export5.glb, this time on ALL SIX named COP meshes (ShortCOP/Standard_COP/
// IntergratedCOP + their _Moved pairs) — confirmed via the same GLB-accessor inspection: every one reads
// U=[0.3992,0.6008]. It's authored that way in the GLB (probably a leftover from another texture scheme
// on the 3D team's end), not an app.js bug. Rescale the existing UVs so their bounding box maps to the
// full [0,1] square.
function normalizeUVRange(geometry) {
  const uv = geometry.attributes.uv;
  if (!uv) return;
  let minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity;
  for (let i = 0; i < uv.count; i += 1) {
    const u = uv.getX(i);
    const v = uv.getY(i);
    if (u < minU) minU = u;
    if (u > maxU) maxU = u;
    if (v < minV) minV = v;
    if (v > maxV) maxV = v;
  }
  const spanU = maxU - minU || 1;
  const spanV = maxV - minV || 1;
  for (let i = 0; i < uv.count; i += 1) {
    uv.setXY(i, (uv.getX(i) - minU) / spanU, (uv.getY(i) - minV) / spanV);
  }
  uv.needsUpdate = true;
}

// ShortCOP/ShortCOP_Moved in elevator-export5.glb share the EXACT same quad bounds as Standard_COP /
// IntergratedCOP (all three: local x=1.35, y=1.00 — unlike v7, where ShortCOP's own quad was genuinely
// shorter). But the "short" finish images (assets/textures/cop/short/*.png) bundle TWO stacked panels
// in one file — the COP display/buttons on top, the separate "RATH" intercom module below — at a native
// aspect (~988x3184 = 0.31 W/H) much wider-relative-to-height than Standard/Integrated's own images
// (~0.195 W/H, tuned to fill this exact quad correctly). Stretching the "short" image to fill the same
// quad as Standard/Integrated (after normalizeUVRange()) squishes it recognizably (client relaying 3D
// team feedback, 2026-07-28: "Short with rath is stretched"). Crop the V range to a centered band whose
// aspect matches the "short" image natively — the top/bottom margins clamp to the image's edge pixel
// (wrapT=ClampToEdge) instead of distorting the panel/RATH artwork.
function fixExport5ShortCOPAspect(geometry) {
  const uv = geometry.attributes.uv;
  if (!uv) return;
  const STANDARD_ASPECT = 649 / 3337; // Standard/Integrated finish images: consistent ~0.195 W/H
  const SHORT_ASPECT = 988 / 3184; // "short" folder finish images: consistent ~0.310 W/H
  const span = STANDARD_ASPECT / SHORT_ASPECT; // fraction of the quad's height the image should occupy
  const margin = (1 - span) / 2;
  for (let i = 0; i < uv.count; i += 1) {
    uv.setY(i, (uv.getY(i) - margin) / span);
  }
  uv.needsUpdate = true;
}

// "Raised_Stripe" in elevator-export5.glb is really two separate trim strips baked into ONE mesh — one
// hugging the Handrail-side wall (local X <= 0), one hugging the COP-side wall (X > 0) — and the 3D
// team's unwrap put them on inconsistent axes. Swap U/V on just the Handrail-side vertices so both
// wall strips read the same way. Do not try to isolate the ceiling return by position: that geometry
// shares indexed vertices across all three runs and doing so breaks the orientation at every side.
function fixExport5RaisedStripeUVs(geometry) {
  const pos = geometry.attributes.position;
  const uv = geometry.attributes.uv;
  if (!pos || !uv) return geometry;
  for (let i = 0; i < uv.count; i += 1) {
    if (pos.getX(i) > 0) continue; // Handrail-side strip only; ceiling keeps its native orientation.
    const u = uv.getX(i);
    const v = uv.getY(i);
    uv.setXY(i, v, u);
  }
  uv.needsUpdate = true;
  return geometry;
}

const EXPORT5_STRETCHED_COP_NODES = new Set([
  "ShortCOP", "ShortCOP_Moved", "Standard_COP", "Standard_COP_Moved",
  "IntergratedCOP", "IntergratedCOP_Moved",
]);
const EXPORT5_SHORTCOP_NODES = new Set(["ShortCOP", "ShortCOP_Moved"]);

function loadModel(onProgress, onDone) {
  status.textContent = "Loading model";
  const loader = new GLTFLoader();
  // Default: full GLB delivered by the 3D team (doors/lights/cops/handrails + baked PBR).
  // ?model=legacy carga el GLB viejo (requiere app.legacy.js, solo para comparación histórica).
  // ?model=test carga el GLB parcial "separate mesh".
  const modelParam = new URLSearchParams(window.location.search).get("model");
  // export5b is a preview-only alias for a re-export the 3D team sent 2026-08-13 (node names 100%
  // identical to export5, confirmed via pygltflib diff — same 83 nodes, no renames). Normalize it to
  // "export5" internally so it picks up the same export5-specific fixes (COP UV normalization, the
  // Raised_Stripe UV swap, the AO_BASE_EXPORT5 table, the camera inset multiplier) — modelPath below
  // still resolves the DISTINCT file. NOTE per the 2026-08-13 audit: this re-export does NOT contain
  // the promised smaller PIN Spotlight geometry (bounding box unchanged from the current export5), and
  // Raised_Stripe/Recessed_4_Pannel have different vertex counts than export5 — the UV-swap fix below
  // may not produce identical results on the new topology, needs visual confirmation.
  // Client, 2026-08-19: export5 promoted to the DEFAULT model (no ?model= param at all) — treat a
  // missing param the same as "export5" so every activeModelParam === "export5" gate (wall AO table,
  // wall tile scale, camera inset) still fires on the plain link, not just on ?model=export5 itself.
  activeModelParam = (modelParam === "export5b" || modelParam === "export5c" || !modelParam) ? "export5" : modelParam;
  const modelPath =
    modelParam === "legacy" ? "./assets/models/elevator-export.glb"
    : modelParam === "test" ? "./assets/models/elevator-test.glb"
    // ?model=uv: 2026-06-10 GLB with real UVs but no lights/COP yet (walls/doors/handrails only).
    : modelParam === "uv" ? "./assets/models/elevator-uv.glb"
    // ?model=v2: 2026-06-23 export — accordion door fills the space (no Doorwall_AG), per-variant back
    // walls (Back_wall_P4 / Back_wall_RS), StandardCOP (no space). The code auto-detects this geometry
    // (see geometryV2) and applies the v2 wiring + interior camera framing.
    : modelParam === "v2" ? "./assets/models/elevator-v2.glb"
    // ?model=full forces the previous (pre-2026-06-23) geometry; kept on the server as a rollback.
    : modelParam === "full" ? "./assets/models/elevator-full.glb"
    : modelParam === "v3" ? "./assets/models/elevator-v3.glb"
    : modelParam === "v4" ? "./assets/models/elevator-v4.glb"
    : modelParam === "v5" ? "./assets/models/elevator-v5.glb"
    // ?model=v6: 2026-07-02 export ("elevator_NewV1"), the previous default. Superset of v5 node names
    // (nothing removed/renamed, no .001 dups). Adds the "Glass_Door" gate group (see below) and still has
    // "Outerwall_GlassCOP" (removed in v7). Kept for rollback if v7 turns out to regress the Glass Cab
    // style or the Outer_HDRI mesh causes issues.
    : modelParam === "v6" ? "./assets/models/elevator-v6.glb"
    // ?model=smalltest: 2026-07-20 preview model from the client ("Test Elevator.glb"), a smaller/simpler
    // build than the production geometry (18 nodes vs. 85 in v7 — only Flat cab style, Sliding door,
    // Light_2/Light_4, one COP, no Cab Finish/Handrail variants). Loaded through the normal pipeline
    // (findObject() already tolerates missing nodes), for the client to preview only — not the default.
    : modelParam === "smalltest" ? "./assets/models/elevator-smalltest.glb"
    // ?model=export4: 2026-07-27 export from the 3D team ("elevator export 4.glb"), sent to confirm mesh
    // names before they build the AO map. 65 nodes vs. 85 in v7: same door/wall/cab/handrail node names,
    // but the COP variants collapsed into one generic "COP"/"COP_Moved" (no ShortCOP/StandardCOP/
    // IntergratedCOP) and the Pin Spotlight lighting collapsed into one generic "Light" (no PinSpotligh_1-6
    // / PinSpotligh_RS_*); "Glass_Door" is also absent (falls back to the pre-v6 re-texture behavior via
    // hasGlassDoor). Test-only, not the default — see reply to 3D team about restoring the per-variant
    // names before they proceed.
    : modelParam === "export4" ? "./assets/models/elevator-export4.glb"
    // ?model=export5: 2026-07-28 export from the 3D team ("elevator export 5.glb"), reply to the export4
    // feedback. 83 nodes vs. 85 in v7 (same delta pattern as export4: no "Glass_Door", "Untitled" junk node
    // dropped). Unlike export4, THIS one restores the per-variant COP names (ShortCOP/IntergratedCOP +
    // "Standard_COP" — underscore instead of the old "Standard COP" with a space, already handled by
    // findObject()'s space-to-underscore fallback) and the full Pin Spotlight set (PinSpotligh_1-6 +
    // PinSpotligh_RS_1-4). Sent together with a new AO_Maps folder (~2026-07-28) — see AO_BASE comments
    // for the wall-AO wiring done against this model. Test-only via this param, not yet the default.
    : modelParam === "export5" ? "./assets/models/elevator-export5.glb"
    // ?model=export5b: 2026-08-13 re-export from the 3D team, sent as an updated "elevator-export5.glb"
    // — kept under its own filename/param rather than overwriting the live export5 GLB, since it's
    // unconfirmed whether it's the intended PIN Spotlight fix (audit found it isn't) and 2 meshes have
    // different vertex counts. Test-only, purely for the client to preview live; does not touch the
    // default or the ?model=export5 link.
    : modelParam === "export5b" ? "./assets/models/elevator-export5b.glb"
    // ?model=export5c: kept only as an explicit alias/rollback pointer — the 2026-09-04 re-export (new
    // elevator-export5.glb + Door_SD/DoorWall_SD/Glass/Glass_D AO, see AO_BASE_EXPORT5 above) IS the
    // plain default as of 2026-09-08 (session #75), on both asset tiers (see IS_MOBILE_TIER at the top
    // of the file).
    : modelParam === "export5c" ? "./assets/models/elevator-export5c.glb"
    // Default promoted to export5 (client, 2026-08-19) — this is the model the client's been testing
    // and fixing all along under ?model=export5; the plain link (no ?model= at all) now loads the same
    // GLB. activeModelParam above already treats a missing param as "export5" too, so the
    // export5-specific wiring (AO_BASE_EXPORT5 table, EXPORT5_WALL_TILE_SCALE, camera inset
    // multiplier) applies here exactly like it does on the explicit ?model=export5 link. v7 was the
    // default from 2026-07-02 until now; ?model=v7 still loads it for rollback/comparison, along with
    // v6/v5/v4/v3/v2/export4/export5b for the same reason.
    : modelParam === "v7" ? "./assets/models/elevator-v7.glb"
    : "./assets/models/elevator-export5.glb";
  loader.load(
    modelPath,
    (gltf) => {
      loadedModel = gltf.scene;
      loadedModel.traverse((object) => {
        if (object.name && !registry.has(object.name)) registry.set(object.name, object);
        if (object.isMesh) {
          object.castShadow = true;
          object.receiveShadow = true;
          // The full GLB ships walls/doors/panels with NO UVs (only POSITION+NORMAL), so any
          // applied finish texture would collapse to a flat color. Generate planar UVs for them.
          if (object.geometry) ensurePlanarUV(object.geometry);
          if (object.material) {
            object.userData.originalMaterialName = object.material.name || "";
            object.material = object.material.clone();
            tuneMaterialForRender(object.material);
            baseMaterials.set(object.uuid, object.material.clone());
            if (object.userData.originalMaterialName) {
              materialLibrary.set(object.userData.originalMaterialName, object.material.clone());
            }
          }
        }
      });
      document.body.dataset.registryKeys = Array.from(registry.keys()).join("|");
      resolveGeometryVariant();
      modelRoot.add(loadedModel);
      normalizeModel(loadedModel);
      // Create runtime lights ONCE
      createRuntimeLights();
      window.cambridgeConfigurator = { THREE, scene, camera, modelRoot, registry, state, setCameraView, applyConfiguration, inspectConfiguration };
      applyConfiguration();
      setCameraView("front", true);
      status.classList.add("hidden");
      onDone?.(true);
    },
    (event) => {
      if (event.total) {
        const progress = Math.round((event.loaded / event.total) * 100);
        status.textContent = `Loading model ${progress}%`;
        onProgress?.(event.loaded / event.total);
      }
    },
    (error) => {
       console.error("GLB LOAD ERROR:", error);
       console.error("MODEL PATH:", modelPath);
      status.textContent = "Model failed to load";
      onDone?.(false); // don't leave the boot overlay hanging if the GLB fails
    },
  );
}

function normalizeModel(model) {
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  modelSize = Math.max(size.x, size.y, size.z) || 1;
  const scale = 3.08 / modelSize;
  model.scale.setScalar(scale);
  model.position.sub(center.multiplyScalar(scale));

  normalizedBox = new THREE.Box3().setFromObject(model);
  const bottom = normalizedBox.min.y;
  model.position.y -= bottom;
  modelLocalBox.setFromObject(model);
  modelRoot.rotation.y = 0;
  normalizedBox.setFromObject(modelRoot);
}

// Runtime ceiling lights (created once after the GLB loads)
const runtimeLights = {
  led: [],
  pin: [],
  ledRS: [],
  pinRS: [],
};

const LIGHT_SETTINGS = {
  color: 0xffffff,
  intensity: .1,
  distance: 1,
  angle: Math.PI/2,
  penumbra: 1,
  decay: 2,
};

function createRuntimeLights() {

  const createSpot = (name) => {

    const mesh = findObject(name);
    if (!mesh) return;

    const light = new THREE.SpotLight(
      LIGHT_SETTINGS.color,
      LIGHT_SETTINGS.intensity,
      LIGHT_SETTINGS.distance,
      LIGHT_SETTINGS.angle,
      LIGHT_SETTINGS.penumbra,
      LIGHT_SETTINGS.decay
    );

    // Start OFF
    light.visible = false;

    // You can move these later
    light.position.set(0, 0, 10);

    // Create target
    const target = new THREE.Object3D();
    target.position.set(0, 0, -1);

    mesh.add(light);
    mesh.add(target);

    light.target = target;

    mesh.userData.runtimeLight = light;

    return light;
  };

  runtimeLights.led =
    nodeNames.lighting.ledShow
      .map(createSpot)
      .filter(Boolean);

  runtimeLights.pin =
    nodeNames.lighting.pinShow
      .map(createSpot)
      .filter(Boolean);

  runtimeLights.ledRS =
    nodeNames.lighting.ledRS
      .map(createSpot)
      .filter(Boolean);

  runtimeLights.pinRS =
    nodeNames.lighting.pinRS
     .map(createSpot)
     .filter(Boolean); 
}

function applyConfiguration() {
  document.body.dataset.configRequested = JSON.stringify(state);
  if (!loadedModel) {
    document.body.dataset.configApplied = "waiting-for-model";
    return;
  }
  document.body.dataset.configApplied = JSON.stringify(state);
  resetModelMaterials();

  applyGate();
  applyGateFinish();
  applyBifoldHardware();
  applyAccordionHandle();
  applyCabStyle();
  applyCabFinish();
  applyRaisedStripeFinish();
  applyGlassMaterial();
  applyLighting();
  applyCop();
  applyCopFinish();

  const handrail = itemFor("handrail", state.handrail);
  const activeRail = handrail.node;
  nodeNames.handrails.forEach((name) => setVisible(name, name === activeRail));
  nodeNames.handrailHolders.forEach((name) => setVisible(name, name === handrail.holder));
  applyHandrailFinish();
  applyFloor();
  applyOuterHDRI();
  // Layer baked AO onto the (now final) wall + floor materials.
  applyBaseAO();
  applyWallStyleAOExport5(); // must run after applyBaseAO() so it overrides, not gets overridden
  window.cambridgeConfigurator = { THREE, scene, camera, modelRoot, registry, state, setCameraView, applyConfiguration, inspectConfiguration };
  document.body.dataset.configDebug = JSON.stringify(inspectConfiguration());
}

function inspectConfiguration() {
  const vis = (name) => ({ name, visible: findObject(name)?.visible ?? null });
  const allLights = nodeNames.lighting.all;
  return {
    state: { ...state },
    gates: nodeNames.gates.map((name) => ({
      name,
      visible: findObject(name)?.visible ?? null,
      meshVisible: firstMeshState(name)?.visible ?? null,
      material: firstMeshState(name)?.material ?? null,
    })),
    cabStyle: {
      base: nodeNames.baseWalls.map(vis),
      variants: nodeNames.allWallVariants.map(vis),
    },
    lighting: allLights.map(vis),
    cops: [...nodeNames.cops, ...nodeNames.copsMoved].map(vis),
    handrails: nodeNames.handrails.map(vis),
    handrailHolders: nodeNames.handrailHolders.map(vis),
  };
}

function firstMeshState(name) {
  const object = findObject(name);
  let state = null;
  object?.traverse((child) => {
    if (!state && child.isMesh) {
      state = {
        visible: child.visible,
        material: child.material?.name || "",
      };
    }
  });
  return state;
}

function resetModelMaterials() {
  loadedModel.traverse((object) => {
    if (!object.isMesh) return;
    const base = baseMaterials.get(object.uuid);
    if (base) {
      object.material = base.clone();
      tuneMaterialForRender(object.material);
    }
    object.visible = true;
  });
}

function applyGate() {
  const activeGate = itemFor("gate", state.gate).node;
  const finish = itemFor("gateFinish", state.gateFinish);
  // Client feedback 2026-07-02: picking the "Glass - Stainless Panels" sliding finish should swap in
  // the dedicated Glass_Door mesh (Glass_D + GlassBorder_D) instead of re-texturing the opaque leaf —
  // only once the loaded model actually has that geometry (see hasGlassDoor).
  // !! coerces to a real boolean — finish.glass is `undefined` (not `false`) on every non-glass finish,
  // and `setVisible(name, undefined)` left `object.visible` as `undefined`, which Three.js's `=== false`
  // visibility check doesn't treat as hidden, so the glass mesh kept rendering behind every other finish.
  const useGlassDoorMesh = !!(hasGlassDoor && state.gate === "sliding" && finish.glass);
  nodeNames.gates.forEach((name) => {
    if (name === "Glass_Door") return setVisible(name, useGlassDoorMesh);
    setVisible(name, name === activeGate);
  });
  // Toggle the glass meshes directly too, not just the "Glass_Door" wrapper above: on export5 they hang
  // straight off Sliding_Doors (see hasGlassDoor comment in resolveGeometryVariant()), so the
  // Sliding_Doors visibility pass just above (which traverses ALL its children) would otherwise leave
  // them stuck visible any time gate=sliding is active, regardless of the selected finish. Harmless
  // no-op on v7, where they're already covered by the Glass_Door group toggle.
  setVisible("Glass_D", useGlassDoorMesh);
  setVisible("GlassBorder_D", useGlassDoorMesh);
  if (useGlassDoorMesh) {
    // Glass_Door only replaces the opaque door skin (Door_SD); DoorWall_SD (the surrounding opening
    // panel), Silver_rough_SD (frame) and Rubber_SD (gasket) all stay visible alongside it (client
    // feedback 2026-07-02).
    setVisible("Door_SD", false);
  }
}

function applyGateFinish() {
  const finish = itemFor("gateFinish", state.gateFinish);

  // "Glass - Stainless Panels" sliding door: the leaves are see-through glass in a stainless frame,
  // NOT one opaque metal panel. On models with the dedicated Glass_Door mesh (see hasGlassDoor / the
  // visibility swap in applyGate), paint that mesh; older models fall back to re-texturing the opaque
  // Door_SD leaf in place. Either way: glass panel + brushed-stainless frame.
  if (finish.glass && state.gate === "sliding") {
    const [panelTarget, frameTarget] = hasGlassDoor ? ["Glass_D", "GlassBorder_D"] : ["Door_SD", "Silver_rough_SD"];
    applyMaterialToTargets([panelTarget], createDoorGlassMaterial());
    applyMaterialToTargets([frameTarget], createFixtureTextureMaterial({
      texture: "./assets/textures/fixtures/stainless-brushed.png",
      metalness: 0.78, roughness: 0.24, tile: 3, label: "Door Stainless Frame",
    }));
    return;
  }

  // Accordion "...Clear Panels" (Visifold Black/Bronze/Clear, Clear Panels): actual see-through glass
  // panel, not an opaque metal one (client spec 2026-07-03). Border_Metal_AG/Handle_AG keep their own
  // fixed palette regardless (applyAccordionHandle) — only the panel itself becomes glass.
  // "...Tinted Panels" (Visifold Bronze/Clear) also glass as of 2026-08-13, but smokier — see
  // ACCORDION_TINTED_GLASS.
  if (finish.glass && state.gate === "accordion") {
    const tinted = ACCORDION_TINTED_GLASS[finish.id];
    applyMaterialToTargets(["Door_Mat_AG"], tinted
      ? createDoorGlassMaterial(tinted.color, tinted.opacity)
      : createDoorGlassMaterial());
    return;
  }

  const material = createSelectableMaterial(finish, `Door ${finish.label}`);
  // Repaint the door skin AND its metal frame so the whole door takes the chosen finish
  // (handles/rubber/Plastic_Bi keep their own fixed material, see applyBifoldHardware). Frame
  // meshes: sliding = Silver_rough_SD, bifold = Mainframe_Bi (already the frame). Accordion's frame
  // (Border_Metal_AG) does NOT follow the finish — it has its own fixed palette, see
  // applyAccordionHardware.
  const targetMap = {
    bifold: ["Mainframe_Bi"],
    accordion: ["Door_Mat_AG"],
    sliding: ["Door_SD", "Silver_rough_SD"],
  };
  applyMaterialToTargets(targetMap[state.gate] || [], material);

  // envMapIntensity override (GATE_FINISH_ENV_OVERRIDE): applyMaterialToTargets() clones the material
  // and re-runs tuneMaterialForRender() on the clone, which resets envMapIntensity to the global default
  // — so this has to run AFTER, directly on the live scene node, not inside the material factory.
  if (finish.id === "bifoldStainless" || finish.id === "slidingStainless") {
    (targetMap[state.gate] || []).forEach((name) => {
      findObject(name)?.traverse((child) => {
        if (child.isMesh && child.material && scene.environment) {
          child.material.envMap = scene.environment;
          child.material.envMapIntensity = scene.environmentIntensity * STAINLESS_ENV_BOOST;
          child.material.needsUpdate = true;
        }
      });
    });
  }
  const envOverride = GATE_FINISH_ENV_OVERRIDE[finish.id];
  if (envOverride !== undefined) {
    (targetMap[state.gate] || []).forEach((name) => {
      const object = findObject(name);
      object?.traverse((child) => {
        if (child.isMesh && child.material) child.material.envMapIntensity = envOverride;
      });
    });
  }
}

// Bi-Fold gate hardware that stays fixed (never repainted by the door finish picker) — the main
// frame/track, the small top-center caps + what sits behind them, the pull handles, and the
// patterned plastic insert. Fixed per client feedback 2026-07-02.
function applyBifoldHardware() {
  if (state.gate !== "bifold") return;
  // Main frame/track (mullion + top/bottom rails): white satin metal.
  applyMaterialToTargets(["SilverRough_Bi"], new THREE.MeshStandardMaterial({
    color: 0xffffff,
    metalness: 1,
    roughness: 0.4,
    name: "Bi-Fold Frame",
  }));
  // Small caps at the top center: light grey, semi-gloss metal.
  applyMaterialToTargets(["Silver_Bi"], new THREE.MeshStandardMaterial({
    color: 0xd9d9d9,
    metalness: 1,
    roughness: 0.2,
    name: "Bi-Fold Top Cap",
  }));
  // Pull handles (circles at the sides): light grey, non-metallic.
  applyMaterialToTargets(["Handle_Bi"], new THREE.MeshStandardMaterial({
    color: 0xbfbfbf,
    metalness: 0,
    roughness: 0.2,
    name: "Bi-Fold Handle",
  }));
  // Rubber behind the top-center caps: black rubber.
  applyMaterialToTargets(["Rubber_Bi"], new THREE.MeshStandardMaterial({
    color: 0x000000,
    metalness: 0,
    roughness: 0.7,
    name: "Bi-Fold Rubber",
  }));
  // Patterned plastic insert: fixed amber, non-metallic, fully matte.
  applyMaterialToTargets(["Plastic_Bi"], new THREE.MeshStandardMaterial({
    color: 0xffbb59,
    metalness: 0,
    roughness: 1,
    name: "Bi-Fold Plastic",
  }));
}

// Accordion Gate hardware palette 2026-07-02: Handle_AG and Border_Metal_AG both get a FIXED color per
// finish family (never the finish's own color/texture) — same color map for both, but Handle_AG reads as
// plastic (roughness 0.6, metalness 0) and Border_Metal_AG reads as metal (roughness 0.4, metalness 1).
const ACCORDION_HARDWARE_COLOR = {
  alumifoldBlackPerf: 0x1a1a1a,
  alumifoldBlackSolid: 0x1a1a1a,
  alumifoldBronzePerf: 0x5c3a21,
  alumifoldBronzeSolid: 0x5c3a21,
  alumifoldClearPerf: 0x8c8c8c,
  alumifoldClearSolid: 0x8c8c8c,
  vinylBirch: 0x5c3a21,
  vinylOak: 0x5c3a21,
  vinylTeak: 0x5c3a21,
  vinylWalnut: 0x5c3a21,
  vinylWhite: 0x8c8c8c,
  visifoldBlackClear: 0x1a1a1a,
  visifoldBronzeClear: 0x5c3a21,
  visifoldBronzeTinted: 0x5c3a21,
  visifoldClearClear: 0x8c8c8c,
  visifoldClearTinted: 0x8c8c8c,
};

// Border_Metal_AG full material spec per finish (client table 2026-07-03) — replaces the earlier
// family-color + metalness-only override, since roughness now also varies by group (0.5 black / 0.6
// bronze / 0.4 clear+wood+white), not just a single fixed 0.4 for every finish.
const ACCORDION_BORDER_MATERIAL = {
  alumifoldBlackPerf: { color: 0x404040, roughness: 0.5, metalness: 0.5 },
  alumifoldBlackSolid: { color: 0x404040, roughness: 0.5, metalness: 0.5 },
  alumifoldBronzePerf: { color: 0x524231, roughness: 0.6, metalness: 0.5 },
  alumifoldBronzeSolid: { color: 0x524231, roughness: 0.6, metalness: 0.5 },
  alumifoldClearPerf: { color: 0xffffff, roughness: 0.4, metalness: 1 },
  alumifoldClearSolid: { color: 0xffffff, roughness: 0.4, metalness: 1 },
  vinylBirch: { color: 0x704a25, roughness: 0.4, metalness: 1 },
  vinylOak: { color: 0x704a25, roughness: 0.4, metalness: 1 },
  vinylTeak: { color: 0x704a25, roughness: 0.4, metalness: 1 },
  vinylWalnut: { color: 0x704a25, roughness: 0.4, metalness: 1 },
  vinylWhite: { color: 0xffffff, roughness: 0.4, metalness: 1 },
  visifoldBlackClear: { color: 0x404040, roughness: 0.5, metalness: 0.5 },
  visifoldBronzeClear: { color: 0x524231, roughness: 0.6, metalness: 0.5 },
  visifoldBronzeTinted: { color: 0x524231, roughness: 0.6, metalness: 0.5 },
  visifoldClearClear: { color: 0xffffff, roughness: 0.4, metalness: 1 },
  visifoldClearTinted: { color: 0xffffff, roughness: 0.4, metalness: 1 },
};

// Handle_AG color override — these diverge from the shared family palette (client feedback 2026-07-03);
// every other finish keeps the family color from ACCORDION_HARDWARE_COLOR. Matches Border_Metal_AG's
// white treatment for the same "Clear" group (vinylWhite excluded — not mentioned, stays family grey).
const ACCORDION_HANDLE_OVERRIDE = {
  alumifoldClearPerf: { color: 0xffffff },
  alumifoldClearSolid: { color: 0xffffff },
  visifoldClearClear: { color: 0xffffff },
  visifoldClearTinted: { color: 0xffffff },
};

function applyAccordionHandle() {
  if (state.gate !== "accordion") return;
  const color = ACCORDION_HARDWARE_COLOR[state.gateFinish];
  if (color === undefined) return;
  const handleOverride = ACCORDION_HANDLE_OVERRIDE[state.gateFinish];
  applyMaterialToTargets(["Handle_AG"], new THREE.MeshStandardMaterial({
    color: handleOverride?.color ?? color,
    metalness: 0,
    roughness: 0.6,
    name: "Accordion Handle",
  }));
  const border = ACCORDION_BORDER_MATERIAL[state.gateFinish];
  if (border) {
    applyMaterialToTargets(["Border_Metal_AG"], new THREE.MeshStandardMaterial({
      color: border.color,
      metalness: border.metalness,
      roughness: border.roughness,
      name: "Accordion Frame",
    }));
  }
}

// Accordion "Tinted Panels" (Visifold Bronze/Clear): client, 2026-08-13, wants "a smoke like tinge but
// some transparency" — deliberately smokier/darker and less see-through than the clean architectural
// glass used by "Clear Panels" (default tint/opacity below, untouched — not part of this complaint).
const ACCORDION_TINTED_GLASS = {
  visifoldBronzeTinted: { color: 0x6b4a2e, opacity: 0.62 },
  visifoldClearTinted: { color: 0x555a5c, opacity: 0.55 },
};

// Transparent glass for the sliding "Glass - Stainless Panels" door leaf, and the accordion "Clear"/
// "Tinted Panels" Visifold finishes. Named with "glass" so applyGlassMaterial() gives it the same
// see-through opacity/depth handling as the cab glass panes.
function createDoorGlassMaterial(tintColor = 0xaeb9bd, opacity = GLASS_OPACITY) {
  const material = new THREE.MeshStandardMaterial({
    color: tintColor, // default: faint cool tint, like architectural glass
    roughness: 0.06,
    metalness: 0.0,
    transparent: true,
    opacity,
    depthWrite: false,
  });
  material.name = "Door Glass";
  // applyGlassMaterial() re-traverses the whole model on every applyConfiguration() pass and force-resets
  // ANY material whose name includes "glass" (case-insensitive) back to the default architectural tint/
  // GLASS_OPACITY — it would clobber a custom tinted opacity (ACCORDION_TINTED_GLASS) right after this
  // function sets it. This flag tells it to leave materials from this function alone (they already set
  // their own tint/opacity/roughness/transparency above, so there's nothing for it to add).
  material.userData.skipGlobalGlassTint = true;
  return tuneMaterialForRender(material);
}

// Each door brings its own front wall (the panel surrounding the doorway); it should take the
// same cab finish as the other walls. BiFold has no front wall (its frame is the gate itself).
const DOOR_FRONT_WALL = { accordion: "Doorwall_AG", sliding: "DoorWall_SD" };

function cabFinishTargets(cfg) {
  const frontWall = DOOR_FRONT_WALL[state.gate];
  return frontWall ? [...cfg.finish, frontWall] : cfg.finish;
}

// Side walls (left/right): grain must run vertical → texture rotated 90°. Everything else
// (back wall, roof, door wall) keeps the unwrap orientation.
// NOTE: the Recessed-Single variants (COP_wall_RS / Handrail_wall_RS) are intentionally NOT here.
// Their UV unwrap already runs vertical, so the blanket 90° rotation (correct for the flat walls)
// would flip THEM to horizontal. Each mesh's correct rotation depends on its own unwrap.
const SIDE_WALLS = new Set([
  "COP_wall", "Handrail_wall",
  "COP_wall_P4", "Handrail_wall_P4",
  // Raised Accent Stripe panel (covers the COP wall in that cab style) shares COP_wall's vertical
  // unwrap, not the back wall's — without this, vertical-grain finishes (palomino, gibraltar, etc.)
  // came out horizontal on it (client, 2026-07-04).
  "Raised_Stripe",
]);

// Source textures whose wood grain is authored HORIZONTAL in the file (verified by edge analysis +
// visual). Most finishes are authored vertical; these need the opposite rotation to end up vertical
// like the rest. Without this, e.g. flat + walnut-melamine, or oak/birch on any wall, came out sideways.
const HORIZONTAL_GRAIN_TEXTURES = new Set([
  "./assets/textures/cab-finishes/oak-veneer.png",
  "./assets/textures/cab-finishes/birch-veneer.jpg",
  "./assets/textures/cab-finishes/maple-veneer.png",
  "./assets/textures/cab-finishes/walnut-melamine.png",
]);

// The two vertical side walls, split so a finish can be rotated on one but not the other.
// Raised_Stripe (the decorative panel overlaying the COP wall in that cab style) counts as a COP
// wall here too, so finishes with a "cop" override treat it the same as the plain COP_wall.
const COP_WALLS = new Set(["COP_wall", "COP_wall_P4", "Raised_Stripe"]);
const HANDRAIL_WALLS = new Set(["Handrail_wall", "Handrail_wall_P4"]);

// Client fine-tuning (2026-06-30): per cab-finish, add an extra 90° grain turn on ONE side wall only.
// "cop" = the COP wall, "handrail" = the handrail wall. Layered on top of the default SIDE_WALLS rule.
const FINISH_WALL_ROTATE = {
  walnutVeneer: "cop",
  birch: "cop",
  oak: "cop",
  cherry: "handrail",
  mapleVeneer: "handrail",
  // walnutMelamine shares walnutVeneer's raw grain photo (just a different sheen/finish of the same
  // wood), so it needs the same "cop" turn — without it, Walnut Melamine came out horizontal on the
  // COP wall / Raised_Stripe (client, 2026-07-04).
  walnutMelamine: "cop",
  // Same root cause, found while auditing every wall per the client's "no wall should ever show
  // horizontal grain" directive (2026-07-04): these 4 melamine finishes have no override at all, so
  // they came out horizontal on the plain COP wall / Raised_Stripe (Handrail wall was already fine).
  palomino: "cop",
  gibraltar: "cop",
  mapleMelamine: "cop",
  alabaster: "cop",
};
// Handrail finishes whose texture needs a 90° turn (source brush pattern authored horizontal;
// antique-brass-01.jpg has the same horizontal brush pattern as antique-nickel-01.jpg, client
// 2026-07-04: "rotar las texturas de antique brass").
const HANDRAIL_FINISH_ROTATE = new Set(["antiqueNickel", "antiqueBrass"]);

// Handrail-only flat colours (client, 2026-08-13): Beige/Grey/White looked "sponge-painted"
// because they reuse the shared powder-coat photo textures from `platedAndPowderCoatFinishes` (those
// textures stay as-is for Door Finish/COP Finish — only the handrail swaps to a flat, textureless colour).
const HANDRAIL_FLAT_COLORS = {
  // beige updated 2026-08-13: client's first pass gave 0xf5f5dc, then corrected it to 0xac9362
  // in a follow-up message ("Beige use this color") before the first pass ever shipped to a client-facing
  // deploy — 0xac9362 is the one that's actually live.
  beige: 0xac9362,
  grey: 0x949292,
  white: 0xffffff,
  // 2026-09-30: Bronze now uses the client's handrail-only Low Lights Bronze texture.
};

// alumifoldBlackPerf (2026-09-19): unlike Bronze/Clear's Perforated photos (real photographs — the
// metal region carries its true colour, the holes are blown-out white from backlight, confirmed by
// connected-component analysis: metal is ONE contiguous region, holes are ~45 disconnected islands),
// the Black photo is a schematic B/W mask, not a colour photo — the pill/hole shapes are the
// DISCONNECTED islands drawn flat black, and the metal (the contiguous region) is drawn flat white
// (254,254,254), not black. Its alphaMap is derived correctly from that file (white/metal region ->
// opaque, black/hole islands -> transparent), but using the photo's own pixel colour for the opaque
// region would render the metal WHITE, not black. Tint multiplies that white metal area down to the
// same 0x262626 as alumifoldBlackSolid, while the (already-transparent) hole pixels don't matter.
// Stainless doors: client, 2026-10-07, "the stainless steel looks more bronze now". The brushed texture is a
// neutral grey; the warm cast is the HDRI (warm ceiling/floor) reflected by the 0.8-metalness material. A cool
// tint multiplies the warmth out (measured door R/B 1.25 -> 1.00); STAINLESS_ENV_BOOST buys back the brightness the
// tint costs. Applied in applyGateFinish() with an explicit material.envMap: three r165 ignores a material's own
// envMapIntensity while material.envMap is null (it uses scene.environmentIntensity), so GATE_FINISH_ENV_OVERRIDE
// can't do this job.
const STAINLESS_DOOR_TINT = 0xb0c0d8;
const STAINLESS_ENV_BOOST = 2.1;
const GATE_FINISH_TINT = { alumifoldBlackPerf: 0x262626, bifoldStainless: STAINLESS_DOOR_TINT, slidingStainless: STAINLESS_DOOR_TINT };

// Sliding-door "Beige Powder Coat": client, 2026-08-13, gave RAL 1013 as the target ("Looks dark... needs
// to be more beige"). The shared beige-01.jpg fixture photo is a near-flat sage-green, not beige (see
// feedback_cambridge_preserve_client_textures — these fixture photos are mislabeled concrete/stucco
// swatches, not real color references), and the code never tinted it (hardcoded to color:0xffffff), so
// the door rendered as raw sage-green. First attempt tinted the existing texture (multiply blend), but
// that came out olive, not beige — the source photo has almost no grain to preserve anyway, so flat is
// both simpler and correct. Sliding-door "Low Lights Bronze": client says the colour already reads
// correctly, just wants the concrete/sponge pattern gone — same ask and same real-world colour as
// Handrail's bronze (HANDRAIL_FLAT_COLORS.bronze), so reusing that hex here.
const GATE_FINISH_FLAT_COLORS = {
  slidingBeige: 0xeae6ca,
  slidingBronze: 0xcd7f32,
};

// Accordion "Vinyl White": client, 2026-08-13, reported a bright glow around each panel's edge — the
// dielectric Fresnel reflectance of a near-white, low-roughness surface catching the HDRI environment at
// grazing angles. Dial back envMapIntensity for this one finish only (global default is 1.0, see
// materialRenderSettings) rather than touching every material.
const GATE_FINISH_ENV_OVERRIDE = {
  vinylWhite: 0.35,
};

// Handrail_wall_GW (Glass Cab's glass-frame side wall) and DoorWall_SD (the sliding-door surround)
// are NOT side walls despite the name/location — like Back_wall/Top_wall, they keep their native
// unwrap orientation, so a finish only needs a turn here if its HORIZONTAL_GRAIN_TEXTURES flag is
// wrong. Root-caused 2026-07-04 after the client flagged first Glass Cab (walnutVeneer/oak/
// walnutMelamine, then cherry/mapleVeneer/gibraltar/mapleMelamine/alabaster/palomino too — i.e.
// every finish except birch) and then sliding doors (mapleVeneer, cherry) as non-vertical: both
// reports trace to the SAME two pre-existing mis-classifications —
// maple-veneer.jpg is flagged horizontal in HORIZONTAL_GRAIN_TEXTURES but is actually vertical-authored;
// cherry-veneer.png is NOT flagged but is actually horizontal-authored (both verified by direct pixel
// inspection of the source files). Neither can be fixed at the flag (that break COP_wall/Handrail_wall,
// where FINISH_WALL_ROTATE's cop/handrail turn currently cancels the error out) — so these two meshes
// carry their own compensating turn for exactly these 2 finishes instead.
const KEEP_UNWRAP_WALLS = new Set(["Handrail_wall_GW", "DoorWall_SD"]);
const MISCLASSIFIED_GRAIN_FINISHES = new Set(["mapleVeneer", "cherry"]);
const CHERRY_MAPLE_ROTATE_WALLS = new Set([
  "Back_wall",
  "Back_wall_RS",
  "COP_wall_RS",
  "Handrail_wall_RS",
  "Back_GW"
]);

function wallExtraRotate(finishId, wallName) {

  if (KEEP_UNWRAP_WALLS.has(wallName))
    return MISCLASSIFIED_GRAIN_FINISHES.has(finishId);

  // Cherry + Maple Veneer: rotate only the Back_wall
if (
  (finishId === "cherry" || finishId === "mapleVeneer") &&
  CHERRY_MAPLE_ROTATE_WALLS.has(wallName)
) {
  return true;
}

  const which = FINISH_WALL_ROTATE[finishId];

  return which === "cop"
    ? COP_WALLS.has(wallName)
    : which === "handrail"
      ? HANDRAIL_WALLS.has(wallName)
      : false;
}

function applyCabStyle() {
  const style = itemFor("cabStyle", state.cabStyle);
  const nodes = cabStyleNodes || CAB_STYLE_NODES;
  const cfg = nodes[style.mode] || nodes.flat;

  // Base shell + floor on; every design variant off, then reveal this style's variant meshes.
  nodeNames.baseWalls.forEach((name) => setVisible(name, true));
  nodeNames.floor.forEach((name) => setVisible(name, true));
  nodeNames.allWallVariants.forEach((name) => setVisible(name, false));
  cfg.hideBase.forEach((name) => setVisible(name, false));
  cfg.show.forEach((name) => setVisible(name, true));

  if (cfg.metal) {
    // Stainless brushed on the cab walls. FIX round 2 (client, 2026-08-17): first attempt applied the
    // SIDE_WALLS/HANDRAIL_WALLS XOR from the wood-finish path (rotate COP_wall, not Handrail_wall) on
    // the theory that Handrail_wall's unwrap runs opposite to COP_wall's like it does for wood — but the
    // client then reported COP_wall newly horizontal while Handrail_wall (left unrotated) was fine.
    // That's the SAME symptom moved to the other wall: on THIS texture/mesh pairing, whichever wall gets
    // `rotate: true` turns horizontal — i.e. for brushed-steel on export5's current geometry, COP_wall
    // and Handrail_wall are NOT opposite-unwrapped like the wood case (the wood finding may no longer
    // hold on this reexported GLB either, but that wasn't touched here — scope stays stainless-only).
    // Both walls read vertical with NO rotation at all. No per-finish wallExtraRotate term — that table
    // is wood cabFinish-only.
    // AUDIT FIND (2026-08-17): the EXPORT5_WALL_TILE_SCALE fix below only touched applyCabFinish()/
    // applyRaisedStripeFinish() — this metal branch was still hardcoding `tile: 3` for every target
    // including DoorWall_SD, so Stainless Steel walls carry the exact same ~47.5% UV-scale mismatch
    // vs the door surround that wood finishes had before the fix (same mesh geometry, texture-agnostic).
    // createFixtureTextureMaterialDefault has no tileScale param (unlike createFinishMaterialDefault),
    // so scale the tile value directly per target here instead.
    cabFinishTargets(cfg).forEach((t) => {
      const tile = activeModelParam === "export5" && !EXPORT5_DOOR_WALL_NODES.has(t)
        ? 3 * EXPORT5_WALL_TILE_SCALE
        : 3;
      const material = createFixtureTextureMaterial({
        texture: "./assets/textures/fixtures/stainless-brushed.png",
        metalness: 0.8, roughness: 0.28, tile, label: "Stainless Steel Cab",
        rotate: false,
      });
      applyMaterialToTargets([t], material, { skipGlass: true });
    });
  }
}

// export5 only (client, 2026-08-17): "texture tiling of the walls is not matching visually with
// Door wall" — measured directly from the GLB (world-space triangle area / UV-space triangle area,
// per mesh): DoorWall_SD's unwrap runs at ~1261.9 world-units per UV-unit, while Back_wall/COP_wall/
// Handrail_wall/Top_wall/Raised_Stripe all share ~1861.8 — a real ~47.5% UV-scale mismatch baked into
// the 3D team's export, not a code bug. Client wants the door wall's (denser) grain kept as-is and
// the other walls scaled up to match it, so multiply their repeat count by the measured ratio
// (1861.8 / 1261.9). Does not apply to v7 (measured ~1600 across the board, walls already consistent
// there) or to any other model variant.
const EXPORT5_WALL_TILE_SCALE = 1.4754;
const EXPORT5_DOOR_WALL_NODES = new Set(["DoorWall_SD", "Doorwall_AG"]);

function applyCabFinish() {
  const style = itemFor("cabStyle", state.cabStyle);
  if (style.finishGroup === "none" || state.cabStyle === "stainlessSteel") return;

  const nodes = cabStyleNodes || CAB_STYLE_NODES;
  const cfg = nodes[style.mode] || nodes.flat;
  const finish = itemFor("cabFinish", state.cabFinish);
  const targets = cabFinishTargets(cfg);
  // Default: side walls get the 90°-rotated grain, back wall / roof keep the unwrap orientation.
  // Per-finish override (FINISH_WALL_ROTATE) adds one more 90° turn on a single side wall.
  //
  // Handrail_wall's unwrap runs 90° opposite to COP_wall's (client, 2026-08-13: "las texturas de la
  // pared que tiene la baranda estan rotadas de lado... creo que es para todas las texturas" — confirmed
  // true for every finish tested, both "cop"- and "handrail"-tagged in FINISH_WALL_ROTATE, so it's a
  // baseline unwrap mismatch between the two walls, not a per-finish quirk). SIDE_WALLS/wallExtraRotate
  // above already gets COP_wall right; toggle the result once more for Handrail_wall/Handrail_wall_P4 to
  // compensate. Does NOT apply to Handrail_wall_RS (its unwrap already runs vertical, see SIDE_WALLS
  // comment) or Handrail_wall_GW (KEEP_UNWRAP_WALLS, separately audited) — neither is in HANDRAIL_WALLS.
  targets.forEach((t) => {
    const rotate = (SIDE_WALLS.has(t) !== wallExtraRotate(finish.id, t)) !== HANDRAIL_WALLS.has(t);
    const tileScale = activeModelParam === "export5" && !EXPORT5_DOOR_WALL_NODES.has(t)
      ? EXPORT5_WALL_TILE_SCALE
      : 1;
    applyMaterialToTargets([t], createFinishMaterial(finish, { rotate, tileScale }), { skipGlass: true });
  });
}

// Raised Accent Stripe's own finish (merged from the 3D team's copy, 2026-08-13) — independent from
// the wall Cab Finish. "Raised_Stripe" is COP_WALLS-classified (see SIDE_WALLS/COP_WALLS above), same
// as the plain COP wall, so it uses the same rotate calculation applyCabFinish() uses for COP_wall
// (not the Handrail_wall flip — Raised_Stripe was never in HANDRAIL_WALLS).
function applyRaisedStripeFinish() {
  if (state.cabStyle !== "raisedStripe") return;
  const finish = itemFor("raisedStripeFinish", state.raisedStripeFinish);
  if (!finish) return;
  const rotate = SIDE_WALLS.has("Raised_Stripe") !== wallExtraRotate(finish.id, "Raised_Stripe");
  const tileScale = activeModelParam === "export5" ? EXPORT5_WALL_TILE_SCALE : 1;
  applyMaterialToTargets(["Raised_Stripe"], createFinishMaterial(finish, { rotate, tileScale }), { skipGlass: true });
}

// The cab glass panes (and any mesh whose baked material is named "glass"). They keep their
// GLB material but we force see-through transparency. Tunable live via ?glassOpacity=0.3.
const GLASS_MESHES = new Set(["Glass", "GlassWall"]);
const GLASS_OPACITY = (() => {
  const v = parseFloat(__urlParams.get("glassOpacity"));
  return Number.isFinite(v) ? Math.min(Math.max(v, 0), 1) : 0.3;
})();

function applyGlassMaterial() {
  loadedModel.traverse((object) => {
    if (!object.isMesh) return;
    // Only the actual glass panes. NOT every child of the "GlassWall" group: its siblings
    // Back_GW / Handrail_wall_GW are the solid wood walls of the glass cab and must stay opaque
    // (the old parent-name check turned them see-through — the "missing glass material" bug).
    const isGlass = object.name === "Glass" || object.name === "GlassWall" ||
      object.material?.name?.toLowerCase().includes("glass");
    if (!isGlass) return;
    const mats = Array.isArray(object.material) ? object.material : [object.material];
    mats.forEach((mat) => {
      if (!mat || mat.userData?.skipGlobalGlassTint) return;
      // The baked Glass_Mat is a flat rough grey (looks like haze). Turn it into clear architectural
      // glass: faint cool tint + low roughness so it catches the HDRI reflection. Keep any client map.
      if (!mat.map) mat.color = new THREE.Color(0xaeb9bd);
      mat.roughness = 0.06;
      mat.metalness = 0;
      mat.transparent = true;
      mat.opacity = GLASS_OPACITY;
      mat.depthWrite = false; // avoid sorting artifacts on the thin pane
      mat.needsUpdate = true;
    });
  });
}

function applyLighting() {
  const group = itemFor("lighting", state.lighting).group; // "led" | "pin"
  const useRS = state.cabStyle === "raisedStripe"; // recessed-single ceiling uses the 4-light _RS layout
  const { ledShow, pinShow, ledRS, pinRS, all } = nodeNames.lighting;
  all.forEach((name) => setVisible(name, false));
  // "smalltest" preview GLB ships 2 generic light meshes ("Light_2"/"Light_4"), not the named
  // LedLight_N/PinSpotligh_N fixtures the rest of this function targets — point the fixture-texture
  // treatment below at them directly (client, 2026-07-20: light texture wasn't applied).
  const active = activeModelParam === "smalltest" ? ["Light_2", "Light_4"]
    : useRS ? (group === "led" ? ledRS : pinRS) : (group === "led" ? ledShow : pinShow);
  active.forEach((name) => setVisible(name, true));

  // The GLB fixtures have no emissive of their own, so they look "off". Make the active
  // set glow as if powered on; LED reads cooler, Pin spotlights warmer.
  const glow = new THREE.Color(group === "led" ? 0xfff4e6 : 0xffe7c2);
  const fixture = LIGHT_FIXTURE[group] || LIGHT_FIXTURE.led;
  active.forEach((name) => {
    const object = findObject(name);
    if (!object) return;
    object.traverse((child) => {
      const mat = child.isMesh ? child.material : null;
      if (!mat || !("emissive" in mat)) return;
      // Textureless light meshes (v2 GLB) render as flat white squares — give them the recessed
      // downlight texture (diffuse + normal) so they read as real fixtures. The diffuse doubles as the
      // emissive map so the LEDs glow. Models with a baked map keep their own.
      if (!mat.map) {
        const tex = lightTexture(fixture.map);
        mat.map = tex;
        mat.emissiveMap = tex;
        if (fixture.normal) mat.normalMap = lightTexture(fixture.normal, { linear: true });
        mat.transparent = true; // round fixture, transparent corners (alpha cutout)
      }
      mat.emissive = glow;
      mat.emissiveIntensity = 1.6;
      mat.toneMapped = false; // let it bloom past the tone-mapping clamp so it clearly reads as "on"
      mat.needsUpdate = true;
    });
  });
}

// The Raised Accent Stripe runs down the wall where the standard COP is mounted, hiding it,
// so that cab style uses the COP's alternate ("_Moved") mount instead. Every other cab style
// keeps the standard position. (Client, 2026-07-01: "when Raised Accent Strip is clicked we
// need to switch the COP, the normal COP won't be visible".)
function copUsesMovedMount() {
  return state.cabStyle === "raisedStripe";
}

function activeCopNode() {
  const node = itemFor("cop", state.cop).node;
  return copUsesMovedMount() ? `${node}_Moved` : node;
}

function applyCop() {
  const activeCop = activeCopNode();
  // Toggle across BOTH the standard and the moved COP sets so only the active mount shows.
  [...nodeNames.cops, ...nodeNames.copsMoved].forEach((name) => setVisible(name, name === activeCop));
}

// COP node id -> texture folder. Each COP ships one base-color texture per finish
// (4 plated + 5 powder coat) baked by the 3D team; the finish swaps only the .map.
const copFinishFolders = { standard: "standard", integrated: "integrated", shortRath: "short" };

// Versioned client replacements avoid stale browser caches in both raw and KTX2 tiers.
function copFinishTexturePath(folder, finish) {
  const revision = finish === "beige" || (finish === "antiqueNickel" && folder === "short")
    ? "-20260930-r2"
    : ["beige", "antiqueNickel"].includes(finish) ? "-20260930" : "";
  return `./assets/textures/cop/${folder}/${finish}${revision}.webp`;
}

// Recessed light-fixture textures (extracted from the pre-2026-06 baked GLB). Re-applied at runtime
// to GLBs whose light meshes ship without a baked map (the v2 export), so the ceiling reads as real
// LED downlights instead of flat white squares. flipY=false to match the glTF UVs on the light quads.
// 2026-06-25: 3D team's fixture textures — LED = single-LED downlight, Pin = three-LED downlight, each
// with a diffuse + normal map. diff doubles as the emissive map (the lit LEDs are the bright pixels).
const LIGHT_FIXTURE = {
  led: { map: "./assets/textures/lights/led-fixture.png", normal: "./assets/textures/lights/led-normal.png" },
  pin: { map: "./assets/textures/lights/pin-fixture.png", normal: "./assets/textures/lights/pin-normal.png" },
};
function lightTexture(path, opts = {}) {
  const key = opts.linear ? `${path}|linear` : path;
  if (textureCache.has(key)) return textureCache.get(key);
  const texture = loadCompressedTexture(path, () => textureCache.delete(key));
  texture.colorSpace = opts.linear ? THREE.NoColorSpace : THREE.SRGBColorSpace; // normal maps are linear
  texture.flipY = false;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);
  textureCache.set(key, texture);
  return texture;
}

function copTexture(path, opts = {}) {
  // Normal maps are linear data, not color — load them in NoColorSpace. Key the cache on that too.
  const key = opts.linear ? `${path}|linear` : path;
  if (textureCache.has(key)) return textureCache.get(key);
  const texture = loadCompressedTexture(path, () => textureCache.delete(key));
  texture.colorSpace = opts.linear ? THREE.NoColorSpace : THREE.SRGBColorSpace;
  texture.flipY = false; // match the glTF UV convention so the COP artwork isn't upside down
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  if (opts.noMipmap) {
    // Client, 2026-08-17: COP silhouette still looks irregular/wobbly despite alphaToCoverage. Root
    // cause: the source PNG's alpha channel is 100% binary (0 or 255, verified with Pillow — zero
    // anti-aliased edge pixels), and default mipmap generation averages that binary alpha per mip
    // level, warping the cutout shape at whatever mip the GPU actually samples on screen. Disabling
    // mipmaps for the COP's diffuse/alpha map (not the normal map) keeps the binary alpha intact at
    // native resolution so alphaToCoverage has a clean edge to anti-alias, instead of an
    // already-mip-distorted one. Mitigation only — the real fix is a feathered alpha in the source art.
    texture.generateMipmaps = true;
texture.minFilter = THREE.LinearMipmapLinearFilter;
texture.magFilter = THREE.LinearFilter;
texture.anisotropy = Math.min(
  renderer.capabilities.getMaxAnisotropy(),
  16
);
  } else {
    texture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);
  }
  textureCache.set(key, texture);
  return texture;
}

// Base AO maps from the 3D team (one per wall, D2 + flat-handrail variant for now — the full
// combinatorial set keyed on COP position / handrail / wall design comes later; switched from D1 to
// D2 2026-07-02 per client feedback). The team unwrapped TEXCOORD_0 specifically for AO, so the
// aoMap reads from channel 0.
const AO_BASE = {
  Back_wall: "./assets/textures/ao/back_wall.jpg",
  COP_wall: "./assets/textures/ao/cop_wall.jpg",
  Handrail_wall: "./assets/textures/ao/handrail_wall.jpg",
  Top_wall: "./assets/textures/ao/top_wall.jpg",
  Base_wall: "./assets/textures/ao/base_wall.jpg",
  Recessed_4_Pannel: "./assets/textures/ao/recessed_4.jpg",
  Raised_Stripe: "./assets/textures/ao/raised_stripe.jpg",
  // Raised 4 Panel (raisedFour) — the "_P4" wall variants, only visible in that cab style. Design D1
  // (matches the model), raised-panel bake ("RP4" in the 3D team's library). COP + back walls share one
  // material/UV map (COPWalls_Mat.003), so both read from the same AO. (Client, 2026-07-01: AO missing.)
  COP_wall_P4: "./assets/textures/ao/raised4/cop_rp4.jpg",
  Back_wall_P4: "./assets/textures/ao/raised4/cop_rp4.jpg",
  Handrail_wall_P4: "./assets/textures/ao/raised4/handrail_rp4_f.jpg",
  Top_Extra_P4: "./assets/textures/ao/raised4/top_extra_rp4.jpg",
  // Door + handrail AO from the 3D team's library (2026-07-01). Layered onto each part's material.
  // Accordion gate:
  Border_Metal_AG: "./assets/textures/ao/door/ag-border.jpg",
  Handle_AG: "./assets/textures/ao/door/ag-handle.jpg",
  Door_Mat_AG: "./assets/textures/ao/door/ag-pattern.jpg",
  // Bi-fold gate:
  Silver_Bi: "./assets/textures/ao/door/bi-silver.jpg",
  SilverRough_Bi: "./assets/textures/ao/door/bi-silverrough.jpg",
  Rubber_Bi: "./assets/textures/ao/door/bi-rubber.jpg",
  Handle_Bi: "./assets/textures/ao/door/bi-handle.jpg",
  Plastic_Bi: "./assets/textures/ao/door/bi-pattern.jpg",
  // Sliding doors:
  Door_SD: "./assets/textures/ao/door/sliding-door.jpg",
  DoorWall_SD: "./assets/textures/ao/door/sliding-wall.jpg",
  Silver_rough_SD: "./assets/textures/ao/door/sliding-silverr.jpg",
  Rubber_SD: "./assets/textures/ao/door/sliding-rubber.jpg",
  // Glass Wall:
  Back_GW: "./assets/textures/ao/BackWall_AO.jpg",
  Handrail_wall_GW: "./assets/textures/ao/HandrailWal_AO.jpg",
  Glass: "./assets/textures/ao/Glass_AO.jpg",
  // Handrails:
  Cylinder2In: "./assets/textures/ao/handrail/cyl2.jpg",
  CylinderC2In: "./assets/textures/ao/handrail/cyl2c.jpg",
  Flat1_5In: "./assets/textures/ao/handrail/flat1.jpg",
  Flat3In: "./assets/textures/ao/handrail/flat3.jpg",
  FlatC3In: "./assets/textures/ao/handrail/flat3c.jpg",
  FlatC1_5In: "./assets/textures/ao/handrail/flatc1.jpg",
};

// AO set for ?model=export5 (2026-07-28 "AO_Maps" folder from the 3D team, baked specifically for
// elevator-export5.glb — do NOT mix with the v7 AO_BASE above, different UV atlas). Suffix meaning was
// NOT given by the client in writing; inferred by cross-checking filenames against CAB_STYLE_NODES and
// the existing "_P4"/"RP4" comment above:
//   _RS  = recessedSingle (matches the existing COP_wall_RS/Handrail_wall_RS/Top_Wall_RS node suffix)
//   _P4  = raisedFour (matches the existing "_P4" node suffix; confirmed by "Top_Mat_P4_AO", the only
//          candidate for Top_Extra_P4, which only exists in the raisedFour style)
//   _RP  = recessedFour ("Recessed Panel" — NEW, no dedicated node; "Pannel4_RP_AO" is the only
//          candidate for the Recessed_4_Pannel overlay mesh, confirming RP != P4)
//   _Raised (COP/Handrail only) = raisedStripe ("Rasiedstrip_Mat_Mixed_AO" directly names Raised_Stripe)
// recessedFour and raisedStripe REUSE the shared Back_wall/COP_wall/Handrail_wall/Top_wall nodes (see
// CAB_STYLE_NODES), so their wall AO can't be a static per-node entry like the rest of this file — it
// has to swap reactively with cabStyle. See WALL_STYLE_AO_EXPORT5 + applyWallStyleAOExport5().
// TENTATIVE: not yet confirmed with the 3D team/client. Test-only via ?model=export5, never applied to
// the production v7 default.
// Mobile tier swap (see IS_MOBILE_TIER at the top of the file): every AO_BASE_EXPORT5 entry below is
// built from this one constant, so this single line is the only place that needs to branch.
const AO_EXPORT5_DIR = IS_MOBILE_TIER ? "./assets/textures/ao/export5-mobile/" : "./assets/textures/ao/export5/";
const AO_BASE_EXPORT5 = {
  Back_wall: `${AO_EXPORT5_DIR}BackWall_AO.jpg`,
  COP_wall: `${AO_EXPORT5_DIR}COPWalls_AO.jpg`,
  Handrail_wall: `${AO_EXPORT5_DIR}HandrailWal_AO.jpg`,
  Top_wall: `${AO_EXPORT5_DIR}TopWall_AO.jpg`,
  Base_wall: `${AO_EXPORT5_DIR}Base_Mat_AO.jpg`,
  // recessedSingle — previously had NO AO at all in AO_BASE (v7 gap); these are new, not a remap.
  Back_wall_RS: `${AO_EXPORT5_DIR}BackWall_RS_AO.jpg`,
  COP_wall_RS: `${AO_EXPORT5_DIR}COPWalls_RS_AO.jpg`,
  Handrail_wall_RS: `${AO_EXPORT5_DIR}HandrailWall_RS_AO.jpg`,
  Top_Wall_RS: `${AO_EXPORT5_DIR}TopWall_RS_AO.jpg`,
  // raisedFour — replaces the v7 hack where COP_wall_P4 and Back_wall_P4 shared one file.
  Back_wall_P4: `${AO_EXPORT5_DIR}BackWall_P4_AO.jpg`,
  COP_wall_P4: `${AO_EXPORT5_DIR}COPWalls_P4_AO.jpg`,
  Handrail_wall_P4: `${AO_EXPORT5_DIR}HandrailWall_P4_AO.jpg`,
  Top_Extra_P4: `${AO_EXPORT5_DIR}Top_Mat_P4_AO.jpg`,
  // Glass Wall — dedicated files; v7 reused the base Back/Handrail wall AO as a placeholder here.
  Back_GW: `${AO_EXPORT5_DIR}BackWall_Glass_AO.jpg`,
  Handrail_wall_GW: `${AO_EXPORT5_DIR}HandrailWall_Glass_AO.jpg`,
  // Refreshed 2026-09-04 (3D team re-export, session #72) — replaces the older bake.
  Glass: `${AO_EXPORT5_DIR}Glass_AO.jpg`,
  // Panel overlay meshes (own AO, independent of the wall behind them).
  Recessed_4_Pannel: `${AO_EXPORT5_DIR}Pannel4_RP_AO.jpg`,
  Raised_Stripe: `${AO_EXPORT5_DIR}raised_stripe.jpg`,
  // Sliding door (2026-09-04, 3D team re-export, session #72): Door_SD/DoorWall_SD had NO entry at all
  // here before — this table is an exclusive OR against AO_BASE (see applyBaseAO()), it does NOT fall
  // back to AO_BASE's legacy ao/door/sliding-*.jpg set the way v7 still does, so both nodes rendered
  // with zero aoMap in every export5-family mode until this delivery closed the gap.
  Door_SD: `${AO_EXPORT5_DIR}SlidingDoor_AO.jpg`,
  DoorWall_SD: `${AO_EXPORT5_DIR}DoorWall_AO.jpg`,
  // Glass_D (the see-through glass door leaf, visible only when gateFinish has finish.glass===true —
  // see applyGate()/applyGateFinish()) never had an aoMap: applyBaseAO() skips any material named
  // "glass" ("AO would dirty the glass"), and Glass_D's material is unconditionally named "Door Glass"
  // (createDoorGlassMaterial()) any time it's visible. Client confirmed (2026-09-07, in chat) this file
  // IS meant to show on that glass, so applyBaseAO() below carries a one-node exception for Glass_D
  // specifically — every other glass surface (cab Glass/GlassWall, tinted accordion panels) keeps the
  // no-AO rule untouched. Promoted to the real default 2026-09-08 (session #75) — was staged behind
  // ?model=export5c since session #72, now ships unconditionally on both asset tiers.
  Glass_D: `${AO_EXPORT5_DIR}SlidingDoorGlass_AO.jpg`,
};

// Reactive overrides for the shared wall nodes — see comment on AO_BASE_EXPORT5 above.
const WALL_STYLE_AO_EXPORT5 = {
  recessedFour: {
    Back_wall: `${AO_EXPORT5_DIR}BackWall_RP_AO.jpg`,
    COP_wall: `${AO_EXPORT5_DIR}COPWalls_RP_AO.jpg`,
    Handrail_wall: `${AO_EXPORT5_DIR}HandrailWall_RP_AO.jpg`,
    Top_wall: `${AO_EXPORT5_DIR}TopWall_RP_AO.jpg`,
  },
  raisedStripe: {
    // Only COP + Handrail were provided for this style; Back_wall/Top_wall fall back to base AO.
    COP_wall: `${AO_EXPORT5_DIR}COPWalls_Raised_AO.jpg`,
    Handrail_wall: `${AO_EXPORT5_DIR}HandrailWall_Raised_AO.jpg`,
  },
  // raisedFour hides COP_wall/Handrail_wall (they get their own COP_wall_P4/Handrail_wall_P4 static
  // nodes) but Top_wall stays visible (Top_Extra_P4 only adds a piece, doesn't replace it) — and the
  // client's file set includes a dedicated "TopWall_P4_AO.jpg" for exactly this case.
  raisedFour: {
    Top_wall: `${AO_EXPORT5_DIR}TopWall_P4_AO.jpg`,
  },
};

const SHARED_WALL_NODES_EXPORT5 = ["Back_wall", "COP_wall", "Handrail_wall", "Top_wall"];

// NOTE (2026-08-17): there used to be an EXPORT5B_AO_OVERRIDES table here that swapped in 2 updated
// Top_wall bakes (TopWall_RP_AO.jpg / TopWall_P4_AO.jpg, sent by the 3D team 2026-08-13) ONLY for the
// ?model=export5b preview link, leaving the ?model=export5 default on the older 2026-07-28 bakes. That
// gate is exactly why export5 was found serving stale Top_wall AO for raisedFour/recessedFour weeks
// after the update existed — removed. The files under AO_EXPORT5_DIR are now the updated ones directly
// (export5b's copies were pixel-diffed to confirm a real, localized re-bake, not just JPEG noise, before
// overwriting), so both ?model=export5 and ?model=export5b read the same current AO with no branching.

// Runs after applyCabStyle() so the just-shown shared wall nodes get the right AO for the new style.
// Re-picks ALL four nodes every call (not just the ones this style overrides) so switching AWAY from
// recessedFour/raisedStripe reverts Back_wall/COP_wall/etc back to their base AO instead of staying
// stuck on the previous style's texture.
function applyWallStyleAOExport5() {
  if (activeModelParam !== "export5") return;
  const overrides = WALL_STYLE_AO_EXPORT5[state.cabStyle] || {};
  SHARED_WALL_NODES_EXPORT5.forEach((node) => {
    const path = overrides[node] || AO_BASE_EXPORT5[node];
    if (!path) return;
    const object = findObject(node);
    if (!object) return;
    object.traverse((child) => {
      if (!child.isMesh || !child.material) return;
      if (child.geometry?.userData?.__generatedUV) return;
      if (child.material.name?.toLowerCase().includes("glass")) return;
      child.material.aoMap = aoTexture(path);
      child.material.aoMapIntensity = 1;
      child.material.needsUpdate = true;
    });
  });
}

function aoTexture(path) {
  const key = `ao:${path}`;
  if (textureCache.has(key)) return textureCache.get(key);
  const texture = loadCompressedTexture(path, () => textureCache.delete(key));
  texture.flipY = false; // glTF UV convention
  texture.colorSpace = THREE.NoColorSpace; // AO is linear occlusion data, not color
  texture.channel = 0; // read TEXCOORD_0 (the set the team unwrapped for AO)
  textureCache.set(key, texture);
  return texture;
}

// Assign AO to the wall materials. Runs after the finishes so the aoMap layers on the final
// material; skips meshes whose UVs we generated (those aren't aligned to the AO bake).
function applyBaseAO() {
  if (activeModelParam === "smalltest") return; // client, 2026-07-20: remove AO from the smalltest preview
  const table = activeModelParam === "export5" ? AO_BASE_EXPORT5 : AO_BASE;
  Object.entries(table).forEach(([node, path]) => {
    const object = findObject(node);
    if (!object) return;
    object.traverse((child) => {
      if (!child.isMesh || !child.material) return;
      if (child.geometry?.userData?.__generatedUV) return;
      // Glass_D only: SlidingDoorGlass_AO.jpg is a deliberate exception, client-confirmed (2026-09-07)
      // to belong on the sliding door's glass pane specifically. Every other glass surface (cab
      // Glass/GlassWall, accordion tinted panels) keeps the no-AO rule below untouched.
      const isException = node === "Glass_D";
      if (!isException && child.material.name?.toLowerCase().includes("glass")) return; // AO would dirty the glass
      child.material.aoMap = aoTexture(path);
      child.material.aoMapIntensity = 1;
      child.material.needsUpdate = true;
    });
  });
}

// Floor (Base_wall). The GLB ships no floor material, so the cab sat on a grey slab. The 3D team's
// baked tile texture set matches the floor's UVs (top face maps to the tile region), so map it 1:1.
// flipY=false to match the glTF UVs.
function floorTexture(path, opts = {}) {
  const key = opts.linear ? `${path}|linear|${FLOOR_TILE}` : `${path}|${FLOOR_TILE}`;
  if (textureCache.has(key)) return textureCache.get(key);
  const texture = loadCompressedTexture(path, () => textureCache.delete(key));
  texture.colorSpace = opts.linear ? THREE.NoColorSpace : THREE.SRGBColorSpace;
  texture.flipY = false;
  // Was a single stretched image across the whole floor (ClampToEdge, no repeat) — the client's real
  // Normal/Roughness maps (2026-07-03, replacing flat placeholders) read as a repeating tile pattern, so
  // it now tiles like every other finish texture. Tunable live via ?floorTile= for a quick look.
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(FLOOR_TILE, FLOOR_TILE);
  texture.offset.set(1.61,1.65);
  texture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);
  textureCache.set(key, texture);
  return texture;
}

const FLOOR_TILE = (() => {
  const v = parseFloat(__urlParams.get("floorTile"));
  // 4, not 6: the client's Normal/Roughness maps (2026-07-03) already bake in a 4x4 grid of their own
  // (grout-line squares); base-color.jpg is now their tile diffuse (BaseFloor_R.jpg, no longer the old
  // wood plank image) at the same 4x4, so all three layers repeat at the same frequency.
  return Number.isFinite(v) && v > 0 ? v : 4;
})();

function applyFloor() {
  const material = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: floorTexture("./assets/textures/floor/base-color.jpg"),
    normalMap: floorTexture("./assets/textures/floor/normal.png"),
    roughness: .5,
    metalness: 0,
  });
  material.name = "Cab Floor";
  applyMaterialToTargets(nodeNames.floor, material);
}

// Single stretched copy of the backdrop photo — NOT floorTexture() (that one repeats via FLOOR_TILE for
// the floor's own tile pattern; reusing it here tiled the HDRI photo into a grid, bug reported
// 2026-07-03). Own cache key/texture so the two never collide.
function hdriTexture(path) {
  const key = `${path}|hdri`;
  if (textureCache.has(key)) return textureCache.get(key);
  const texture = loadCompressedTexture(path, () => textureCache.delete(key));
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.flipY = false;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);
  textureCache.set(key, texture);
  return texture;
}

// Backdrop photo for the huge root-level "Outer_HDRI" shell added in elevator-v7 (see loadModel).
// MeshBasicMaterial (unlit) so it reads as a flat photo backdrop instead of a lit surface; DoubleSide
// since the camera sits inside this mesh and its face winding isn't confirmed. No-op on older models
// (findObject returns null). Client-provided photo 2026-07-02 ("WallTexture.png" -> sent for Outer_HDRI).
function applyOuterHDRI() {
  const object = findObject("Outer_HDRI");
  if (!object) return;
  const material = new THREE.MeshBasicMaterial({
    map: hdriTexture("./assets/textures/environment/outer-hdri.jpg"),
    side: THREE.DoubleSide,
  });
  material.name = "Outer HDRI Backdrop";
  applyMaterialToTargets(["Outer_HDRI"], material);
}

// Per-COP normal map (3D team). Standard + Short/Rath ship one; Integrated still renders flat.
const COP_NORMAL = {
  standard: "./assets/textures/cop/standard/_noramal.png",
  shortRath: "./assets/textures/cop/short/_normal.png",
};

let shortCopInnerMask = null;
function getShortCopInnerMask() {
  if (shortCopInnerMask) return shortCopInnerMask;

  // The Short/Rath diffuse images include a bright, finish-independent bevel around both panels.
  // At an oblique camera angle that baked bevel reads as the reported white line on the right/bottom;
  // it is not z-fighting (the export5 COP plane sits ~0.023 world units clear of COP_wall). Keep only
  // the two inner panel faces with an aligned alpha mask. Coordinates come from the shared 988x3184
  // layout used by all nine short COP finishes; the 25 px inset removes the bevel without touching
  // controls or labels. Drawing at the source aspect keeps filtering stable across every finish size.
  const canvas = document.createElement("canvas");
  canvas.width = 988;
  canvas.height = 3184;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "black";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "white";
  ctx.beginPath();
  // Leave a 14 px safety band beyond the inner face. The first version matched the face too tightly
  // and visually shaved its rounded corners after linear filtering at oblique angles.
  ctx.roundRect(232, 252, 514, 1514, 38);
  ctx.roundRect(232, 2027, 514, 874, 38);
  ctx.fill();

  shortCopInnerMask = new THREE.CanvasTexture(canvas);
  shortCopInnerMask.name = "Short COP inner-face mask";
  shortCopInnerMask.colorSpace = THREE.NoColorSpace;
  shortCopInnerMask.flipY = false;
  shortCopInnerMask.wrapS = THREE.ClampToEdgeWrapping;
  shortCopInnerMask.wrapT = THREE.ClampToEdgeWrapping;
  shortCopInnerMask.generateMipmaps = false;
  shortCopInnerMask.minFilter = THREE.LinearFilter;
  shortCopInnerMask.magFilter = THREE.LinearFilter;
  return shortCopInnerMask;
}

// REVERTED 2026-08-17: tried wiring COP_OPACITY (a standalone soft-edge alphaMap from the 3D team's
// "COP" handoff folder, opacity-map.png / op.png) here — same aspect ratio as the per-finish color
// PNGs so it looked like a safe UV-aligned drop-in, and the G channel does carry a real 32-50-value
// gradient (confirmed the channel Three.js reads for alphaMap). But client reported Integrated Phone
// and Short/Rath COPs went COMPLETELY INVISIBLE after deploy. Root cause found by checking the actual
// G-channel distribution: 72% of opacity-map.png's canvas is near-black (Integrated) — almost
// certainly transparent PADDING around the panel on the OLD uncropped 1665x8560 canvas (the "new"
// per-finish color PNGs were individually cropped tight to the opaque bbox by the 3D team when they
// downsized them for the site, but the opacity map is still the old full-canvas layout). Multiplying
// the tightly-cropped color map's alpha against this mostly-black full-canvas mask discarded nearly
// the whole panel. Do NOT re-attempt without the 3D team confirming the opacity map's crop origin
// matches the "new" color PNGs, or sending one that's cropped the same way.

function applyCopFinish() {
  const folder = copFinishFolders[state.cop];
  if (!folder) return;

  // "smalltest" preview GLB ships one generic "COP" mesh instead of the named Standard/Integrated/Short
  // panels activeCopNode() looks for — fall back to it so the chosen finish still renders (client,
  // 2026-07-20: COP texture wasn't applied).
  const object = findObject(activeCopNode()) || (activeModelParam === "smalltest" ? findObject("COP") : null);
  if (!object) return;
  const basePath = `./assets/textures/cop/${folder}`;
  const texture = copTexture(
  copFinishTexturePath(folder, state.copFinish),
  { noMipmap: true }
);

const normalMap = copTexture(
  `${basePath}/normal.png`,
  { linear: true }
);

const opacityMap = copTexture(
  `${basePath}/opacity.webp`,
  { linear: true, noMipmap: true }
);


  // COP material overrides (per finish)
  const copOverrides = {
    stainless: {
      metalness: .5,
      roughness: 0.3,
    },

    antiqueBrass: {
      metalness: .5,
      roughness: 0.3,
    },

    antiqueNickel: {
      metalness: .5,
      roughness: 0.3,
    },

    oilBronze: {
      metalness: 0,
      roughness: 0.3,
    },

    beige: {
      metalness: 0.2,
      roughness: 0.48,
    },

    black: {
      metalness: 0.32,
      roughness: 0.48,
    },

    bronze: {
      metalness: 0.6,
      roughness: 0.34,
    },

    grey: {
      metalness: 0.28,
      roughness: 0.44,
    },

    white: {
      metalness: 0.18,
      roughness: 0.44,
    },
  };

  const override = copOverrides[state.copFinish];

  object.traverse((child) => {
    if (!child.isMesh || !child.material) return;

    child.material.map = texture;
    child.material.normalMap = normalMap;
    child.material.alphaMap = opacityMap;

    if (normalMap)
      child.material.normalMap = normalMap;

    if (override) {
      child.material.metalness = override.metalness;
      child.material.roughness = override.roughness;
    }

    // TEMP (2026-08-19, client request): put back exactly as the 3D team sent it (0) to see it live —
    // this is what made the COPs render white (see HANDOFF session #63: 84% of the diffuse .webp
    // canvas is near-white transparent padding that alphaTest=0 no longer discards). Not a fix, a
    // deliberate side-by-side check requested by the client. If they confirm they want the fixed
    // behavior back, restore to 0.5.
    child.material.alphaTest = 0;
    // Client, 2026-08-13: jagged/pixelated edge around the COP silhouette + a visible dither pattern
    // on Integrated Phone with lighter finishes — both are the hard alphaTest cutoff (binary
    // in/out per pixel, no smoothing). alphaToCoverage uses MSAA sample coverage instead of a hard
    // discard, so the cutout edge anti-aliases like the rest of the scene (renderer already has
    // antialias:true). Client's own suggestion: "try anti aliasing if that solves".
    child.material.alphaToCoverage = true;

    // REVERTED 2026-08-17: tried `polygonOffset`/`polygonOffsetFactor`/`polygonOffsetUnits` here on a
    // z-fighting theory for the Short/Rath white-edge report — didn't help either (5th failed attempt
    // in a row on this same issue; see HANDOFF sessions #43/#49/#50/#51/#53). Root cause still unknown;
    // likely needs the 3D team to check the actual mesh placement/clearance from the wall in their own
    // tools, not another code-side guess. Do not re-attempt blind — see HANDOFF for what's already
    // ruled out (texture content confirmed clean pixel-by-pixel, mipmaps, color bleed, Fresnel, UV
    // padding, z-fighting offset).
    child.material.needsUpdate = true;
  });
}

function applyHandrailFinish() {
  const finish = itemFor("handrailFinish", state.handrailFinish);
  const rotate = HANDRAIL_FINISH_ROTATE.has(finish.id);
  const flatColor = HANDRAIL_FLAT_COLORS[finish.id];

  const material = flatColor !== undefined
    ? createMetalMaterial(
        { color: flatColor, metalness: finish.metalness, roughness: finish.roughness },
        `Handrail ${finish.label}`
      )
    : createSelectableMaterial(
        { ...finish, rotate },
        `Handrail ${finish.label}`
      );

  // Handrail-only overrides
  const handrailOverrides = {
    antiqueBrass: {
      tile: 4,
      metalness: .8,
      roughness: 0.2,
    },

    antiqueNickel: {
      tile: 4,
      metalness: .8,
      roughness: 0.2,
    },

    oilBronze: {
      tile: 4,
      metalness: .8,
      roughness: 0.2,
    },

    stainless: {
      tile: 4,
    },

    black: {
      tile: 6,
    },

    bronze: {
      tile: 6,
    },
  };

  const override = handrailOverrides[finish.id];

  if (override) {
    if (material.map && override.tile !== undefined) {
      material.map.repeat.set(override.tile, override.tile);
      // No `.needsUpdate = true` here: repeat/tiling is picked up automatically via the UV
      // transform matrix on the next render, no re-upload needed. Forcing needsUpdate on a
      // texture that's still loading its .ktx2 in the background (mipmaps not populated yet)
      // makes the renderer try to upload it prematurely and throw (client-reported crash/freeze,
      // 2026-08-26, right after the KTX2 migration — see loadCompressedTexture()).
    }

    if (override.metalness !== undefined) {
      material.metalness = override.metalness;
    }

    if (override.roughness !== undefined) {
      material.roughness = override.roughness;
    }

    material.needsUpdate = true;
  }

  applyMaterialToTargets(
    [...nodeNames.handrails, ...nodeNames.handrailHolders],
    material
  );
}

function applyMaterialToTargets(targetNames, material, rules = {}) {
  const prepareMesh = window.__materialOverrides?.prepareMesh;
  targetNames.forEach((name) => {
    const object = findObject(name);
    if (!object) return;
    object.traverse((child) => {
      if (!child.isMesh || (rules.skipGlass && child.material?.name?.toLowerCase().includes("glass"))) return;
      child.material = material.clone();
      tuneMaterialForRender(child.material);
      if (prepareMesh) prepareMesh(child, { THREE });
    });
  });
}

function createFinishMaterial(option, opts = {}) {
  const override = window.__materialOverrides?.createFinishMaterial;
  if (override) return tuneMaterialForRender(override(option, { THREE, textureFor }));
  return createFinishMaterialDefault(option, opts);
}

function createFinishMaterialDefault(option, opts = {}) {
  const material = new THREE.MeshStandardMaterial({
    color: option.color ?? 0xffffff,
    roughness: 0.72, // matte wood: higher roughness tames the HDRI specular wash
    metalness: 0.02,
  });
  material.name = `Cab ${option.label}`;
  if (option.texture) {
    // 3D team spec: tile X=3, Y=3 by default. Per-finish override via option.tile (e.g. Cherry=2
    // for a larger grain / fewer seams). Side walls are rotated 90° so the grain runs vertical;
    // back wall / roof keep the unwrap orientation. opts.tileScale (see EXPORT5_WALL_TILE_SCALE)
    // compensates for a mesh whose UV unwrap runs at a different world-space scale than the rest.
    const tile = (option.tile ?? 3) * (opts.tileScale ?? 1);
    const settings = { repeat: new THREE.Vector2(tile, tile) };
    // Final grain = mesh unwrap (opts.rotate, from SIDE_WALLS) XOR the texture's own grain direction.
    // Horizontal-grain source textures need the opposite rotation to come out vertical.
    const horizontalGrain = HORIZONTAL_GRAIN_TEXTURES.has(option.texture);
    if (Boolean(opts.rotate) !== horizontalGrain) settings.rotation = Math.PI / 2;
    material.map = textureFor(option.texture, settings);
    material.color.set(0xffffff);
  }
  return tuneMaterialForRender(material);
}

function createFixtureTextureMaterial(option) {
  const override = window.__materialOverrides?.createFixtureTextureMaterial;
  if (override) return tuneMaterialForRender(override(option, { THREE, textureFor }));
  return createFixtureTextureMaterialDefault(option);
}

function createFixtureTextureMaterialDefault(option) {
  // Sliding "Low Lights Bronze": flat colour, no texture at all — see GATE_FINISH_FLAT_COLORS.
  const flatColor = GATE_FINISH_FLAT_COLORS[option.id];
  if (flatColor !== undefined) {
    const flat = new THREE.MeshStandardMaterial({
      color: flatColor,
      roughness: option.roughness ?? 0.36,
      metalness: option.metalness ?? 0.5,
    });
    flat.name = `Fixture ${option.label}`;
    return tuneMaterialForRender(flat);
  }

  // Door finishes default to ~1:1 on the panel; option.tile overrides for a smaller/repeated pattern.
  const repeat = option.tile ?? 1.05;
  const settings = { repeat: new THREE.Vector2(repeat, repeat) };
  // Same grain issue as the cab walls: textures authored horizontal need a 90° turn to run vertical
  // along the (vertical-slat) door panels. vinyl birch / vinyl oak use those textures. option.rotate
  // forces an extra 90° (used for the stainless cab wall + antique-nickel handrail per client request).
  if (HORIZONTAL_GRAIN_TEXTURES.has(option.texture) !== Boolean(option.rotate)) settings.rotation = Math.PI / 2;
  const material = new THREE.MeshStandardMaterial({
    // GATE_FINISH_TINT multiplies the (mislabeled/generic) fixture photo toward the client's actual
    // target colour instead of showing the raw, untinted photo — see slidingBeige/RAL 1013 above.
    color: GATE_FINISH_TINT[option.id] ?? 0xffffff,
    roughness: option.roughness ?? 0.36,
    metalness: option.metalness ?? 0.5,
    map: textureFor(option.texture, settings),
  });
  // Perforated metal finishes (accordion Alumifold *Perforated): a shared black/white cutout mask
  // (same repeat as the base map, so the holes line up with the color pattern) punches actual see-through
  // holes via alphaTest, same convention as the COP finish cutout.
  if (option.alphaMap) {
    material.alphaMap = textureFor(option.alphaMap, settings);
    material.alphaTest = 0.5;
    material.alphaToCoverage = true; // smooths the perforated-metal cutout edge, same fix as the COP
  }
  material.name = `Fixture ${option.label}`;
  return tuneMaterialForRender(material);
}

function createSelectableMaterial(option, name) {
  return option.texture
    ? createFixtureTextureMaterial({ ...option, label: name })
    : createMetalMaterial(option, name);
}

function createMetalMaterial(option, name) {
  const override = window.__materialOverrides?.createMetalMaterial;
  if (override) return tuneMaterialForRender(override(option, name, { THREE }));
  return createMetalMaterialDefault(option, name);
}

function createMetalMaterialDefault(option, name) {
  const material = new THREE.MeshStandardMaterial({
    color: option.color ?? 0xd8d8d8,
    roughness: option.roughness ?? 0.28,
    metalness: option.metalness ?? 0.75,
  });
  // Perforated metal finishes with a flat material color (client spec 2026-07-03: Alumifold */Perforated
  // moved from a textured diffuse to a flat color + per-finish cutout mask) — same alphaTest convention
  // as the textured path (createFixtureTextureMaterialDefault) and the COP cutout.
  if (option.alphaMap) {
    const repeat = option.tile ?? 1;
    material.alphaMap = textureFor(option.alphaMap, { repeat: new THREE.Vector2(repeat, repeat) });
    material.alphaTest = 0.5;
    material.alphaToCoverage = true; // smooths the perforated-metal cutout edge, same fix as the COP
  }
  material.name = name;
  return tuneMaterialForRender(material);
}

function textureFor(path, settings = {}) {
  const override = window.__materialOverrides?.textureFor;
  if (override) return override(path, settings, { THREE, textureLoader, textureCache, renderer });
  return textureForDefault(path, settings);
}

function textureForDefault(path, settings = {}) {
  const repeatKey = settings.repeat ? `${settings.repeat.x}:${settings.repeat.y}` : "1:1";
  const rotKey = settings.rotation ? `r${settings.rotation.toFixed(3)}` : "r0";
  const key = `${path}|${repeatKey}|${rotKey}`;
  if (textureCache.has(key)) return textureCache.get(key);
  const texture = loadCompressedTexture(path, () => textureCache.delete(key));
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  if (settings.repeat) texture.repeat.copy(settings.repeat);
  if (settings.rotation) {
    texture.center.set(0.5, 0.5);
    texture.rotation = settings.rotation;
  }
  texture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);
  textureCache.set(key, texture);
  return texture;
}

function updateOptionAvailability() {
  updateGateFinishAvailability();
  updateCabFinishAvailability();
}

function updateGateFinishAvailability() {
  const gate = state.gate;
  const isAllowed = (item) => item.gate === gate;
  const currentFinish = itemFor("gateFinish", state.gateFinish);
  if (!isAllowed(currentFinish)) {
    const replacement = options.find((entry) => entry.id === "gateFinish").items.find(isAllowed);
    if (replacement) state.gateFinish = replacement.id;
  }

  const finishButtons = Array.from(document.querySelectorAll('[data-group="gateFinish"]'));
  if (!finishButtons.length) return;
  finishButtons.forEach((button) => {
    const item = itemFor("gateFinish", button.dataset.value);
    const hidden = !isAllowed(item);
    button.classList.toggle("is-hidden", hidden);
    button.disabled = hidden;
    const active = state.gateFinish === item.id && !hidden;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
}

function updateCabFinishAvailability() {
  const style = itemFor("cabStyle", state.cabStyle);
  const isAllowed = (item) => style.finishGroup === "all" || style.finishGroup === item.group;
  const currentFinish = itemFor("cabFinish", state.cabFinish);
  if (!isAllowed(currentFinish)) {
    const replacement = options.find((entry) => entry.id === "cabFinish").items.find(isAllowed);
    if (replacement) state.cabFinish = replacement.id;
  }

  const finishButtons = Array.from(document.querySelectorAll('[data-group="cabFinish"]'));
  if (!finishButtons.length) return;
  finishButtons.forEach((button) => {
    const item = itemFor("cabFinish", button.dataset.value);
    const hidden = style.finishGroup === "none" || !isAllowed(item);
    button.classList.toggle("is-hidden", hidden);
    button.disabled = hidden;
    const active = state.cabFinish === item.id && !hidden;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });

  document.querySelector('.step-item[data-option-group="cabFinish"]')?.classList.toggle("is-hidden", style.finishGroup === "none");
}

function tuneMaterialForRender(material) {
  if ("envMapIntensity" in material) material.envMapIntensity = materialRenderSettings.envMapIntensity;
  material.needsUpdate = true;
  return material;
}

function setVisible(name, visible) {
  const object = findObject(name);
  if (!object) return;
  object.visible = visible;
  object.traverse((child) => {
    child.visible = visible;
  });
}

function findObject(nameOrNames) {
  const names = Array.isArray(nameOrNames) ? nameOrNames : [nameOrNames];
  for (const name of names) {
    // three's GLTFLoader sanitizes node names (spaces -> "_"), so match that form too.
    // Also match a space-stripped form: the 3D team's newer exports drop the space
    // ("Standard COP" -> "StandardCOP"), so this resolves the node on both old and new GLBs.
    const object = registry.get(name)
      || registry.get(name.replace(/\s/g, "_"))
      || registry.get(name.replace(/\s/g, ""));
    if (object) return object;
  }
  return null;
}

function setCameraView(view, immediate = false) {
  const box = loadedModel ? new THREE.Box3().setFromObject(modelRoot) : new THREE.Box3(new THREE.Vector3(-2, 0, -2), new THREE.Vector3(2, 3, 2));
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  // modelLocalBox is measured once at load and includes hidden variant meshes / doors / far COPs that
  // bloat it to ±1.46, while the real cab interior is only ~±0.7 — that put the preset cameras OUTSIDE
  // the walls. For the v2 geometry, frame from the currently-visible cab instead so cameras sit inside.
  const localBox = !loadedModel ? box : interiorShellBox();
  const cameraRig = measuredInteriorCameraRig(localBox);
  cutawayPlane.constant = center.z + size.z * 0.34;
  // Views named by what you SEE (per client): Front shows the doors, Back shows the rear wall,
  // Left shows the left wall, Right shows the right wall. Each camera sits against the OPPOSITE
  // wall for maximum distance (less "zoomed in").
  // fov 80 = VIEW_FOV_MAX (the wheel-zoom ceiling below): client, 2026-08-13, wanted each view button to
  // land on the most-zoomed-out framing already, since the old default (72) left room to still scroll
  // out further. Do NOT go below 72 here — the client explicitly rejected a narrower/more-zoomed-in
  // default (33.4°/~40mm) in a past session (2026-07-16, see HANDOFF #23), this is the opposite direction.
  const views = {
    front: { fov: VIEW_FOV_MAX, position: cameraRig.frontPos, target: cameraRig.frontTarget },
    back: { fov: VIEW_FOV_MAX, position: cameraRig.backPos, target: cameraRig.backTarget },
    left: { fov: VIEW_FOV_MAX, position: cameraRig.leftPos, target: cameraRig.leftTarget },
    right: { fov: VIEW_FOV_MAX, position: cameraRig.rightPos, target: cameraRig.rightTarget },
    center: { fov: VIEW_FOV_MAX, position: cameraRig.centerPos, target: cameraRig.centerTarget },
  };
  const preset = views[view] || views.front;
  syncInteriorLookFromCamera(preset.position, preset.target);
  interiorLook.fov = preset.fov;
  targetCamera.fov = preset.fov;
  targetCamera.position.copy(preset.position);
  targetCamera.target.copy(preset.target);
  markActiveView(view);
  // immediate = snap (used on initial load); otherwise animate() eases the camera over.
  if (immediate) {
    camera.position.copy(targetCamera.position);
    cameraTarget.copy(targetCamera.target);
    camera.fov = targetCamera.fov;
    camera.updateProjectionMatrix();
  }
}

function measuredInteriorCameraRig(localBox) {
  const center = localBox.getCenter(new THREE.Vector3());
  const size = localBox.getSize(new THREE.Vector3());
  const min = localBox.min;
  const max = localBox.max;
  // export5's cab box measures notably smaller than v7's (~0.67 wide vs ~1.06) while Outer_HDRI (the
  // photo backdrop) sits at the same absolute world size/position in both — so the usual 4% inset puts
  // the camera close enough to the near wall that free-look (drag to turn around) can see past its edge
  // into Outer_HDRI's kitchen/garden photo (client, 2026-07-28: "se ve el plano de la imagen que estaba
  // detras"). Confirmed NOT reproducible on v7 at the same inset ratio. Scoped multiplier, export5 only.
  const insetMultiplier = activeModelParam === "export5" ? 3 : 1;
  const inset = Math.min(size.x, size.z) * 0.04 * insetMultiplier; // sit a touch inside the wall so it doesn't clip (lower = wider/less zoom)
  const eyeY = min.y + size.y * 0.52;            // eye height ~vertical center of the cab
  // Axis layout (from the GLB): doors at max.z, back wall at min.z, right wall (COP) at max.x,
  // left wall (handrail) at min.x.
  const doorZ = max.z;
  const backZ = min.z;
  const rightX = max.x;
  const leftX = min.x;

  return {
    // Front: stand at the back wall, look toward the doors → you see the doors.
    frontPos: localToWorldPoint(new THREE.Vector3(center.x, eyeY, backZ + inset)),
    frontTarget: localToWorldPoint(new THREE.Vector3(center.x, eyeY, doorZ)),
    // Back: stand just inside the doorway (the door/door-wall overhangs past max.z, so a small
    // inset would place the camera outside the cab — pull in ~16% of depth), look at the back wall.
    backPos: localToWorldPoint(new THREE.Vector3(center.x, eyeY, doorZ - size.z * 0.16)),
    backTarget: localToWorldPoint(new THREE.Vector3(center.x, eyeY, backZ)),
    // Left: stand at the right wall, look toward the left wall → you see the left side.
    leftPos: localToWorldPoint(new THREE.Vector3(rightX - inset, eyeY, center.z)),
    leftTarget: localToWorldPoint(new THREE.Vector3(leftX, eyeY, center.z)),
    // Right: stand at the left wall, look toward the right wall → you see the right side.
    rightPos: localToWorldPoint(new THREE.Vector3(leftX + inset, eyeY, center.z)),
    rightTarget: localToWorldPoint(new THREE.Vector3(rightX, eyeY, center.z)),
    // Center: stand in the middle of the cab. Target just faces the doors by default — the
    // drag-to-look controls (setupInteriorLookControls) let it turn to any side from here.
    centerPos: localToWorldPoint(new THREE.Vector3(center.x, eyeY, center.z)),
    centerTarget: localToWorldPoint(new THREE.Vector3(center.x, eyeY, doorZ)),
  };
}

// Bounding box over the meshes that are actually visible right now (effective visibility — an invisible
// ancestor hides its children). Excludes the hidden variant/door/COP geometry that bloats modelLocalBox,
// so the camera rig frames the real cab. Falls back to modelLocalBox if nothing is visible yet.
function visibleInteriorBox() {
  const box = new THREE.Box3();
  let any = false;
  modelRoot.traverse((o) => {
    if (!o.isMesh) return;
    for (let p = o; p; p = p.parent) if (!p.visible) return;
    box.expandByObject(o);
    any = true;
  });
  return any && !box.isEmpty() ? box : modelLocalBox;
}

// The cab interior shell: floor + the enclosing walls ONLY. Everything else — the outer shaft wall
// (Outerwall_GlassCOP), the glass panes, doors/gates, COPs, handrails, lights — is excluded because
// it sits outside or overhangs the cab and bloats the bounds, which threw the preset cameras out of
// the cab entirely (most visibly the Glass Cab, whose outer wall is metres behind the glass).
const INTERIOR_SHELL = new Set([
  "Base_wall",                                                   // floor
  "Back_wall", "COP_wall", "Handrail_wall", "Top_wall",         // base shell
  "COP_wall_RS", "Handrail_wall_RS", "Top_Wall_RS", "Back_wall_RS",   // recessed single
  "COP_wall_P4", "Handrail_wall_P4", "Top_Extra_P4", "Back_wall_P4",  // raised 4 panel
  "Recessed_4_Pannel", "Raised_Stripe",                          // panel overlays
  "Back_GW", "Handrail_wall_GW",                                 // glass-cab wood walls (NOT the outer wall/glass)
]);

// Bounds over the currently-visible interior-shell meshes. This is the true cab interior for every
// cab style, so the preset cameras always sit inside. Falls back to the older heuristics if empty.
function interiorShellBox() {
  const box = new THREE.Box3();
  let any = false;
  modelRoot.traverse((o) => {
    if (!o.isMesh || !INTERIOR_SHELL.has(o.name)) return;
    for (let p = o; p; p = p.parent) if (!p.visible) return; // effective visibility
    box.expandByObject(o);
    any = true;
  });
  if (any && !box.isEmpty()) return box;
  return geometryV2 ? visibleInteriorBox() : modelLocalBox;
}

function localToWorldPoint(point) {
  return loadedModel ? modelRoot.localToWorld(point) : point;
}

function syncInteriorLookFromCamera(position, target) {
  const direction = target.clone().sub(position).normalize();
  interiorLook.yaw = Math.atan2(direction.x, direction.z);
  interiorLook.pitch = Math.asin(clamp(direction.y, -1, 1));
}

function markActiveView(view) {
  document.querySelectorAll(".view-button").forEach((button) => {
    const isActive = button.dataset.view === view;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
}

function setupInteriorLookControls() {
  canvas.addEventListener("pointerdown", (event) => {
    interiorLook.dragging = true;
    interiorLook.lastX = event.clientX;
    interiorLook.lastY = event.clientY;
    canvas.setPointerCapture(event.pointerId);
  });

  canvas.addEventListener("pointermove", (event) => {
    if (!interiorLook.dragging) return;
    const dx = event.clientX - interiorLook.lastX;
    const dy = event.clientY - interiorLook.lastY;
    interiorLook.lastX = event.clientX;
    interiorLook.lastY = event.clientY;
    interiorLook.yaw -= dx * 0.006;
    interiorLook.pitch = clamp(interiorLook.pitch - dy * 0.004, -0.76, 0.32);
    updateCameraTargetFromLook(true);
    clearActiveView();
  });

  canvas.addEventListener("pointerup", (event) => {
    interiorLook.dragging = false;
    canvas.releasePointerCapture(event.pointerId);
  });

  canvas.addEventListener("pointercancel", () => {
    interiorLook.dragging = false;
  });

  canvas.addEventListener("wheel", (event) => {
    event.preventDefault();
    // Allow zooming in (lower fov) but cap zoom-out so the view can't pull way back.
    interiorLook.fov = clamp(interiorLook.fov + (event.deltaY > 0 ? 4 : -4), VIEW_FOV_MIN, VIEW_FOV_MAX);
    targetCamera.fov = interiorLook.fov; // animate() eases the fov for a smooth zoom
  }, { passive: false });
}

function updateCameraTargetFromLook(immediate = false) {
  const direction = new THREE.Vector3(
    Math.sin(interiorLook.yaw) * Math.cos(interiorLook.pitch),
    Math.sin(interiorLook.pitch),
    Math.cos(interiorLook.yaw) * Math.cos(interiorLook.pitch),
  );
  targetCamera.target.copy(targetCamera.position).add(direction.multiplyScalar(2));
  if (immediate) {
    camera.position.copy(targetCamera.position);
    cameraTarget.copy(targetCamera.target);
  }
}

function clearActiveView() {
  state.view = "custom";
  document.querySelectorAll(".view-button").forEach((button) => {
    button.classList.remove("active");
    button.setAttribute("aria-pressed", "false");
  });
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function updateSummary() {
  // Bottom summary panel removed; selection now reflected in accordion headers.
}

// ---- Step 2: review configuration + request a quote ----

function collectConfiguration() {
  return options.filter(isGroupVisible).map((group) => {
    const item = itemFor(group.id, state[group.id]);
    return {
      step: group.title.replace(/^\d+\.\s*/u, ""),
      value: item ? item.label : null,
    };
  });
}

function quoteThumb(group, item) {
  if (!item) return `<span class="summary-thumb is-icon" style="--step-icon:url('${stepIconFor(group.id)}')"></span>`;
  if (group.id === "handrailFinish" && HANDRAIL_FLAT_COLORS[item.id] !== undefined) {
    const hex = `#${HANDRAIL_FLAT_COLORS[item.id].toString(16).padStart(6, "0")}`;
    return `<span class="summary-thumb is-color" style="background:${hex}"></span>`;
  }
  if (item.texture) {
    return `<span class="summary-thumb is-texture" style="background-image:url('${item.texture}')"></span>`;
  }
  if (typeof item.color === "number") {
    const hex = `#${item.color.toString(16).padStart(6, "0")}`;
    return `<span class="summary-thumb is-color" style="background:${hex}"></span>`;
  }
  return `<span class="summary-thumb is-icon" style="--step-icon:url('${stepIconFor(group.id)}')"></span>`;
}

function buildQuoteSummary() {
  const container = document.getElementById("quoteSummary");
  if (!container) return;
  container.innerHTML = options
    .filter(isGroupVisible)
    .map((group) => {
      const item = itemFor(group.id, state[group.id]);
      const step = group.title.replace(/^\d+\.\s*/u, "");
      return `
      <div class="summary-line">
        ${quoteThumb(group, item)}
        <div class="summary-line__text">
          <span class="summary-line__label">${step}</span>
          <span class="summary-line__value">${item ? item.label : "—"}</span>
        </div>
      </div>`;
    })
    .join("");
}

function setupQuoteModal() {
  const modal = document.getElementById("quoteModal");
  const openBtn = document.getElementById("openQuote");
  const form = document.getElementById("quoteForm");
  const statusEl = document.getElementById("quoteStatus");
  if (!modal || !openBtn || !form) return;

  const open = () => {
    buildQuoteSummary();
    statusEl.textContent = "";
    statusEl.className = "quote-form__status";
    modal.hidden = false;
    document.body.style.overflow = "hidden";
    form.elements.name?.focus();
  };
  const close = () => {
    modal.hidden = true;
    document.body.style.overflow = "";
  };

  openBtn.addEventListener("click", open);
  modal.querySelectorAll("[data-quote-close]").forEach((el) => el.addEventListener("click", close));
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !modal.hidden) close();
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const fields = Object.fromEntries(new FormData(form).entries());
    let valid = true;
    const requireValid = (key, test) => {
      const input = form.elements[key];
      const ok = test(input.value.trim());
      input.classList.toggle("invalid", !ok);
      if (!ok) valid = false;
    };
    // Client, 2026-09-07: State/Province added, and every field except Company is now mandatory
    // (Company stays the only optional one, same as before).
    requireValid("name", (v) => v.length > 0);
    requireValid("state", (v) => v.length > 0);
    requireValid("email", (v) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/u.test(v));
    requireValid("phone", (v) => v.length > 0);
    if (!valid) {
      statusEl.textContent = "Please fill out all required fields (a valid email is required).";
      statusEl.className = "quote-form__status err";
      return;
    }

    const payload = {
      contact: {
        name: fields.name.trim(),
        state: fields.state.trim(),
        company: (fields.company || "").trim(),
        email: fields.email.trim(),
        phone: fields.phone.trim(),
      },
      configuration: collectConfiguration(),
    };
    // TODO: wire real delivery (email / CRM / webhook). For now expose the payload + confirm.
    window.__lastQuoteRequest = payload;
    document.body.dataset.lastQuote = JSON.stringify(payload);
    statusEl.textContent = "Thank you! Your request has been received.";
    statusEl.className = "quote-form__status ok";
    form.reset();
  });
}

function setText(id, text) {
  const element = document.getElementById(id);
  if (element) element.textContent = text.replace("&quot;", '"');
}

function itemFor(groupId, value) {
  return options.find((entry) => entry.id === groupId).items.find((item) => item.id === value);
}

function labelFor(groupId, value) {
  return itemFor(groupId, value).label;
}

function resize() {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  if (canvas.width !== Math.floor(width * renderer.getPixelRatio()) || canvas.height !== Math.floor(height * renderer.getPixelRatio())) {
    renderer.setSize(width, height, false);
    camera.aspect = width / Math.max(height, 1);
    camera.updateProjectionMatrix();
  }
}

function animate() {
  resize();
  // Ease the camera toward its target for smooth view-to-view transitions.
  // Snap (t=1) while dragging so manual look-around stays responsive.
  const t = interiorLook.dragging ? 1 : 0.14;
  camera.position.lerp(targetCamera.position, t);
  cameraTarget.lerp(targetCamera.target, t);
  if (Math.abs(targetCamera.fov - camera.fov) > 0.01) {
    camera.fov += (targetCamera.fov - camera.fov) * t;
    camera.updateProjectionMatrix();
  }
  camera.lookAt(cameraTarget);
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

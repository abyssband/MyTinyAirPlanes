export const STORAGE_UNLOCK_KEY = "tiny-airplanes.unlocked-route";
export const STORAGE_BEST_KEY = "tiny-airplanes.best-runs";
export const STORAGE_AUDIO_KEY = "tiny-airplanes.audio-enabled";
export const STORAGE_DEBUG_KEY = "tiny-airplanes.debug-enabled";
export const STORAGE_GHOSTS_KEY = "tiny-airplanes.ghost-runs";
export const STORAGE_GHOST_ENABLED_KEY = "tiny-airplanes.ghost-enabled";
export const STORAGE_STICKERS_KEY = "tiny-airplanes.orbit-stickers";
export const STORAGE_SAVE_VERSION_KEY = "tiny-airplanes.save-version";
export const CURRENT_SAVE_VERSION = 9;
export const SPACE_REFERENCE = {
  visualStartKm: 24,
  karmanLineKm: 100,
  lowEarthOrbitStartKm: 160,
  lowEarthOrbitMaxKm: 2000,
  issMinKm: 370,
  issMaxKm: 460,
};

const SEARCH_PARAMS = new URLSearchParams(window.location.search);
export const VEHICLE_PROFILES = {
  civilAirliner: {
    id: "civilAirliner",
    label: "一般民航機",
    badge: "Bluebird 320",
    profileTag: "civil-airliner",
    style: "airliner",
    blurb: "標準窄體民航機，起降節奏穩，巡航手感平均。",
    accent: "#f39c72",
    stripe: "#fff2ba",
    canopy: "#79a0c8",
    fuelCapacityMultiplier: 1,
    minAirSpeed: 1180,
    maxSpeed: 5050,
    rotateSpeed: 1340,
    takeoffSpeed: 1460,
    stallSpeed: 980,
    landingMaxTouchdownSpeed: 1520,
    takeoffAccel: 900,
    rollBrake: 360,
    landingBrakeBonus: 280,
    effects: {
      speedMultiplier: 1,
      launchBoost: 1,
      glideLift: 1,
      crashResistance: 1,
      sunsetPreservation: 1,
      sunReserve: 78,
    },
  },
  spaceplanePrototype: {
    id: "spaceplanePrototype",
    label: "太空飛機原型",
    badge: "Aurora S-1",
    profileTag: "spaceplane",
    style: "spaceplane",
    blurb: "火箭輔助的太空飛機測試機，爬升更積極，高空速度保持更好。",
    accent: "#8fc8ff",
    stripe: "#ffe8c2",
    canopy: "#9feaff",
    fuelCapacityMultiplier: 1.28,
    minAirSpeed: 1280,
    maxSpeed: 7600,
    rotateSpeed: 1480,
    takeoffSpeed: 1600,
    stallSpeed: 1020,
    landingMaxTouchdownSpeed: 1680,
    takeoffAccel: 1040,
    rollBrake: 330,
    landingBrakeBonus: 250,
    effects: {
      speedMultiplier: 1.08,
      launchBoost: 1.08,
      glideLift: 1.12,
      crashResistance: 1.05,
      sunsetPreservation: 1,
      sunReserve: 78,
    },
  },
  reusableShuttle: {
    id: "reusableShuttle",
    label: "可返回式穿梭機",
    badge: "Orbiter R-7",
    profileTag: "reusable-shuttle",
    style: "shuttle",
    blurb: "可返回式穿梭機，機身更重但滑翔效率高，適合長航段與高空回降。",
    accent: "#edf3ff",
    stripe: "#ffb36b",
    canopy: "#223451",
    fuelCapacityMultiplier: 1.36,
    minAirSpeed: 1240,
    maxSpeed: 7200,
    rotateSpeed: 1500,
    takeoffSpeed: 1640,
    stallSpeed: 995,
    landingMaxTouchdownSpeed: 1740,
    takeoffAccel: 980,
    rollBrake: 338,
    landingBrakeBonus: 238,
    effects: {
      speedMultiplier: 1.05,
      launchBoost: 1.03,
      glideLift: 1.2,
      crashResistance: 1.08,
      sunsetPreservation: 1,
      sunReserve: 78,
    },
  },
};
export const ACTIVE_VEHICLE_ID = VEHICLE_PROFILES[SEARCH_PARAMS.get("vehicle")] ? SEARCH_PARAMS.get("vehicle") : "reusableShuttle";
export const FORCE_DEBUG = ["1", "true", "on"].includes((SEARCH_PARAMS.get("debug") || "").toLowerCase());
export const FORCE_MUTE = ["1", "true", "on"].includes((SEARCH_PARAMS.get("mute") || "").toLowerCase());

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function projectGeoPoint(lon, lat) {
  const x = 0.05 + ((lon + 180) / 360) * 0.9;
  const y = clamp(0.52 - Math.sin((lat * Math.PI) / 180) * 0.34, 0.08, 0.92);
  return { x, y };
}

function projectPolygon(points) {
  return points.map(([lon, lat]) => projectGeoPoint(lon, lat));
}

export const MAP_LANDMASSES = [
  {
    id: "north-america",
    fill: "#d3e7ba",
    points: projectPolygon([
      [-168, 72], [-155, 61], [-145, 57], [-134, 55], [-126, 49], [-124, 42],
      [-117, 33], [-110, 28], [-100, 23], [-91, 19], [-84, 22], [-80, 28],
      [-75, 37], [-67, 44], [-58, 50], [-60, 58], [-72, 66], [-90, 72],
      [-118, 76], [-148, 75],
    ]),
  },
  {
    id: "greenland",
    fill: "#e6f1cf",
    points: projectPolygon([
      [-60, 80], [-45, 76], [-30, 70], [-40, 60], [-55, 58], [-64, 66],
    ]),
  },
  {
    id: "south-america",
    fill: "#bfe1b1",
    points: projectPolygon([
      [-81, 12], [-74, 7], [-70, -2], [-77, -15], [-74, -28], [-66, -40],
      [-58, -54], [-47, -53], [-39, -33], [-35, -12], [-44, 1], [-56, 8],
      [-68, 11],
    ]),
  },
  {
    id: "europe",
    fill: "#d9e1b4",
    points: projectPolygon([
      [-11, 36], [-6, 44], [2, 45], [11, 49], [18, 56], [30, 60],
      [42, 62], [52, 56], [42, 46], [29, 41], [18, 40], [7, 38], [-3, 37],
    ]),
  },
  {
    id: "british-isles",
    fill: "#e5efcf",
    points: projectPolygon([
      [-9, 58], [-3, 59], [0, 54], [-2, 50], [-8, 51],
    ]),
  },
  {
    id: "africa",
    fill: "#d7d09f",
    points: projectPolygon([
      [-18, 34], [-8, 24], [2, 13], [12, 7], [24, -2], [34, -6],
      [43, -17], [39, -33], [20, -35], [5, -30], [-6, -15], [-15, 6],
    ]),
  },
  {
    id: "asia",
    fill: "#d8e3b5",
    points: projectPolygon([
      [28, 38], [40, 48], [58, 55], [78, 72], [112, 70], [140, 62],
      [160, 52], [154, 38], [140, 26], [124, 21], [112, 4], [100, 8],
      [90, 20], [78, 24], [66, 24], [58, 28], [48, 30], [39, 33],
    ]),
  },
  {
    id: "japan",
    fill: "#e8f0d4",
    points: projectPolygon([
      [129, 33], [134, 35], [141, 42], [145, 39], [142, 33], [136, 31],
    ]),
  },
  {
    id: "taiwan",
    fill: "#edf5dd",
    points: projectPolygon([
      [120.0, 25.5], [121.8, 24.4], [121.3, 22.1], [120.0, 22.0], [119.6, 23.9],
    ]),
  },
  {
    id: "australia",
    fill: "#d8dcb4",
    points: projectPolygon([
      [112, -12], [126, -11], [141, -18], [153, -28], [146, -39], [132, -43],
      [116, -36], [111, -21],
    ]),
  },
  {
    id: "new-zealand",
    fill: "#e3ecd0",
    points: projectPolygon([
      [166, -35], [175, -34], [179, -39], [173, -46], [167, -44],
    ]),
  },
];

export const MAP_REGION_STICKERS = [
  { id: "north-america", label: "北美", note: "forest coast", x: 0.18, y: 0.2, accent: "#f2b57b", paper: "#fff5df", doodle: "pine" },
  { id: "south-america", label: "南美", note: "jungle swing", x: 0.28, y: 0.63, accent: "#8fcf9a", paper: "#eef9e8", doodle: "leaf" },
  { id: "europe", label: "歐洲", note: "city postcard", x: 0.49, y: 0.19, accent: "#ec9ab1", paper: "#fff0f4", doodle: "crown" },
  { id: "africa", label: "非洲", note: "golden safari", x: 0.52, y: 0.56, accent: "#e3ba73", paper: "#fff4de", doodle: "sun" },
  { id: "asia", label: "亞洲", note: "lantern hop", x: 0.73, y: 0.28, accent: "#f39b7c", paper: "#fff2ea", doodle: "lotus" },
  { id: "oceania", label: "大洋洲", note: "sea breeze", x: 0.86, y: 0.73, accent: "#7fc6ea", paper: "#eef9ff", doodle: "shell" },
];

const AIRPORT_LIST = [
  { code: "YVR", name: "溫哥華", lat: 49.196, lon: -123.181, color: "#f1b26e", region: "north-america", icon: "pine", backdrop: "mountains" },
  { code: "LAX", name: "洛杉磯", lat: 33.942, lon: -118.409, color: "#f59e77", region: "north-america", icon: "palm", backdrop: "coast" },
  { code: "MEX", name: "墨西哥城", lat: 19.436, lon: -99.072, color: "#f1c46d", region: "north-america", icon: "sun", backdrop: "aztec" },
  { code: "BOG", name: "波哥大", lat: 4.702, lon: -74.147, color: "#8bc9a1", region: "south-america", icon: "leaf", backdrop: "cloud-peaks" },
  { code: "GRU", name: "聖保羅", lat: -23.436, lon: -46.473, color: "#79c6b8", region: "south-america", icon: "heart", backdrop: "skyline" },
  { code: "LIS", name: "里斯本", lat: 38.774, lon: -9.135, color: "#ffb993", region: "europe", icon: "shell", backdrop: "tram-hill" },
  { code: "LHR", name: "倫敦", lat: 51.47, lon: -0.454, color: "#e79ab6", region: "europe", icon: "crown", backdrop: "clock" },
  { code: "FRA", name: "法蘭克福", lat: 50.038, lon: 8.563, color: "#bca2f5", region: "europe", icon: "star", backdrop: "skyline" },
  { code: "IST", name: "伊斯坦堡", lat: 41.275, lon: 28.752, color: "#f0ad84", region: "europe", icon: "tulip", backdrop: "bridge" },
  { code: "CAI", name: "開羅", lat: 30.122, lon: 31.406, color: "#e2b56b", region: "africa", icon: "pyramid", backdrop: "dunes" },
  { code: "JNB", name: "約翰尼斯堡", lat: -26.133, lon: 28.242, color: "#85c58c", region: "africa", icon: "fern", backdrop: "savanna" },
  { code: "DXB", name: "杜拜", lat: 25.253, lon: 55.366, color: "#ec9662", region: "asia", icon: "camel", backdrop: "spires" },
  { code: "DEL", name: "德里", lat: 28.556, lon: 77.1, color: "#f0bf68", region: "asia", icon: "lotus", backdrop: "arch" },
  { code: "SIN", name: "新加坡", lat: 1.364, lon: 103.991, color: "#72c8ff", region: "asia", icon: "wave", backdrop: "gardens" },
  { code: "HKG", name: "香港", lat: 22.308, lon: 113.919, color: "#ffd27b", region: "asia", icon: "star", backdrop: "harbor" },
  { code: "TPE", name: "台北", lat: 25.08, lon: 121.234, color: "#f3b46d", region: "asia", icon: "flower", backdrop: "taipei-tower" },
  { code: "ICN", name: "首爾", lat: 37.46, lon: 126.441, color: "#6fb4a8", region: "asia", icon: "ribbon", backdrop: "gate" },
  { code: "HND", name: "東京", lat: 35.549, lon: 139.78, color: "#f08c7d", region: "asia", icon: "blossom", backdrop: "torii" },
  { code: "PVG", name: "上海", lat: 31.144, lon: 121.808, color: "#7fb6f2", region: "asia", icon: "tower", backdrop: "bund" },
  { code: "SYD", name: "雪梨", lat: -33.94, lon: 151.175, color: "#89c3ff", region: "oceania", icon: "sail", backdrop: "opera" },
  { code: "AKL", name: "奧克蘭", lat: -37.008, lon: 174.785, color: "#99d7b4", region: "oceania", icon: "fern", backdrop: "volcano" },
];

export const AIRPORTS = Object.fromEntries(
  AIRPORT_LIST.map((airport) => [airport.code, { ...airport, ...projectGeoPoint(airport.lon, airport.lat) }]),
);

const PALETTES = {
  pacific: {
    skyTop: "#ffd7ad",
    skyMid: "#ffecc9",
    skyBottom: "#aee9f2",
    duskTop: "#f1ab83",
    duskBottom: "#7acfe4",
    sun: "#ffd374",
    glow: "rgba(255, 232, 179, 0.48)",
    paper: "rgba(255, 255, 255, 0.12)",
    hillBack: "#bfdab7",
    hillMid: "#93c8ac",
    hillFront: "#69a987",
    ground: "#4c7c69",
    cloud: "rgba(255, 255, 255, 0.85)",
    draft: "rgba(189, 240, 255, 0.54)",
    accent: "#f39c72",
    star: "#ffd166",
  },
  sunbelt: {
    skyTop: "#ffcda8",
    skyMid: "#ffe7c7",
    skyBottom: "#b8ebea",
    duskTop: "#e89c79",
    duskBottom: "#76c6cb",
    sun: "#ffd072",
    glow: "rgba(255, 226, 171, 0.46)",
    paper: "rgba(255, 255, 255, 0.12)",
    hillBack: "#d8e1b8",
    hillMid: "#acc89b",
    hillFront: "#6f9f7b",
    ground: "#4a745e",
    cloud: "rgba(255, 255, 255, 0.84)",
    draft: "rgba(188, 238, 252, 0.57)",
    accent: "#ef946d",
    star: "#ffd26f",
  },
  tropic: {
    skyTop: "#ffd0b4",
    skyMid: "#ffeadc",
    skyBottom: "#9ee5d9",
    duskTop: "#eb9477",
    duskBottom: "#66bcc4",
    sun: "#ffc96d",
    glow: "rgba(255, 223, 168, 0.45)",
    paper: "rgba(255, 255, 255, 0.13)",
    hillBack: "#cbe4bb",
    hillMid: "#8fc7a4",
    hillFront: "#4fa47c",
    ground: "#316d57",
    cloud: "rgba(255, 255, 255, 0.84)",
    draft: "rgba(176, 239, 248, 0.61)",
    accent: "#f19974",
    star: "#ffd367",
  },
  atlantic: {
    skyTop: "#ffd3b7",
    skyMid: "#ffe7d7",
    skyBottom: "#aeddf3",
    duskTop: "#e69d85",
    duskBottom: "#7fb6db",
    sun: "#ffd8a0",
    glow: "rgba(255, 227, 182, 0.44)",
    paper: "rgba(255, 255, 255, 0.12)",
    hillBack: "#d6dfbb",
    hillMid: "#a4c1a6",
    hillFront: "#6d9780",
    ground: "#4b6d5e",
    cloud: "rgba(255, 255, 255, 0.84)",
    draft: "rgba(192, 236, 255, 0.58)",
    accent: "#ec8a73",
    star: "#ffd46f",
  },
  europe: {
    skyTop: "#ffd0c2",
    skyMid: "#ffe7e7",
    skyBottom: "#bdddfd",
    duskTop: "#de8ea0",
    duskBottom: "#87b4ed",
    sun: "#ffd9a4",
    glow: "rgba(255, 227, 190, 0.44)",
    paper: "rgba(255, 255, 255, 0.12)",
    hillBack: "#d8e1ca",
    hillMid: "#a9beaf",
    hillFront: "#7a9484",
    ground: "#536d63",
    cloud: "rgba(255, 255, 255, 0.84)",
    draft: "rgba(202, 233, 255, 0.58)",
    accent: "#e59597",
    star: "#ffd96b",
  },
  mediterranean: {
    skyTop: "#ffd1b0",
    skyMid: "#ffe7cf",
    skyBottom: "#b2e3f6",
    duskTop: "#dd9375",
    duskBottom: "#71a9d5",
    sun: "#ffd079",
    glow: "rgba(255, 220, 165, 0.44)",
    paper: "rgba(255, 255, 255, 0.12)",
    hillBack: "#dfddb8",
    hillMid: "#b6c4a2",
    hillFront: "#819772",
    ground: "#59694f",
    cloud: "rgba(255, 255, 255, 0.84)",
    draft: "rgba(194, 233, 255, 0.58)",
    accent: "#e88e61",
    star: "#ffd36a",
  },
  africa: {
    skyTop: "#ffd2a8",
    skyMid: "#ffe6c8",
    skyBottom: "#c7e6dd",
    duskTop: "#e59b6b",
    duskBottom: "#7fb4aa",
    sun: "#ffca70",
    glow: "rgba(255, 216, 151, 0.46)",
    paper: "rgba(255, 255, 255, 0.13)",
    hillBack: "#ddd3aa",
    hillMid: "#b8bf92",
    hillFront: "#7f946e",
    ground: "#5c6b52",
    cloud: "rgba(255, 255, 255, 0.83)",
    draft: "rgba(190, 230, 240, 0.56)",
    accent: "#df915f",
    star: "#ffd26f",
  },
  desert: {
    skyTop: "#ffc7a6",
    skyMid: "#ffe1c9",
    skyBottom: "#b7def1",
    duskTop: "#dc8764",
    duskBottom: "#7fb0d1",
    sun: "#ffc56a",
    glow: "rgba(255, 212, 154, 0.45)",
    paper: "rgba(255, 255, 255, 0.13)",
    hillBack: "#e2d0a8",
    hillMid: "#c1b18f",
    hillFront: "#8a7f69",
    ground: "#645d4f",
    cloud: "rgba(255, 255, 255, 0.82)",
    draft: "rgba(201, 230, 250, 0.56)",
    accent: "#e68157",
    star: "#ffd06c",
  },
  southasia: {
    skyTop: "#ffcdb0",
    skyMid: "#ffe6d2",
    skyBottom: "#addfef",
    duskTop: "#e38e68",
    duskBottom: "#76b3d2",
    sun: "#ffcd72",
    glow: "rgba(255, 221, 168, 0.44)",
    paper: "rgba(255, 255, 255, 0.13)",
    hillBack: "#d9dfba",
    hillMid: "#a7bf9b",
    hillFront: "#728d75",
    ground: "#506657",
    cloud: "rgba(255, 255, 255, 0.83)",
    draft: "rgba(190, 236, 255, 0.58)",
    accent: "#ef8d69",
    star: "#ffd56f",
  },
  southeastasia: {
    skyTop: "#ffcfbe",
    skyMid: "#ffe8df",
    skyBottom: "#a0e4e8",
    duskTop: "#e88f7d",
    duskBottom: "#64c0c9",
    sun: "#ffcc76",
    glow: "rgba(255, 222, 170, 0.45)",
    paper: "rgba(255, 255, 255, 0.13)",
    hillBack: "#d0e3c0",
    hillMid: "#97c6a9",
    hillFront: "#5ea182",
    ground: "#3d725b",
    cloud: "rgba(255, 255, 255, 0.84)",
    draft: "rgba(179, 241, 252, 0.61)",
    accent: "#f39a75",
    star: "#ffd16b",
  },
  eastasia: {
    skyTop: "#ffd3c0",
    skyMid: "#ffe9e5",
    skyBottom: "#b9e3ff",
    duskTop: "#e7958b",
    duskBottom: "#8abbe8",
    sun: "#ffd7a7",
    glow: "rgba(255, 227, 191, 0.44)",
    paper: "rgba(255, 255, 255, 0.13)",
    hillBack: "#d5e1c8",
    hillMid: "#a0b8b0",
    hillFront: "#6f8fa1",
    ground: "#48677b",
    cloud: "rgba(255, 255, 255, 0.84)",
    draft: "rgba(193, 234, 255, 0.6)",
    accent: "#ef8e7c",
    star: "#ffd570",
  },
  oceania: {
    skyTop: "#ffd7bc",
    skyMid: "#ffefe3",
    skyBottom: "#b1e8ff",
    duskTop: "#eb9b84",
    duskBottom: "#7dc6ed",
    sun: "#ffd67b",
    glow: "rgba(255, 229, 181, 0.45)",
    paper: "rgba(255, 255, 255, 0.13)",
    hillBack: "#d2e1bc",
    hillMid: "#9fc6a8",
    hillFront: "#6fa38b",
    ground: "#4f7965",
    cloud: "rgba(255, 255, 255, 0.85)",
    draft: "rgba(185, 239, 255, 0.6)",
    accent: "#f29f74",
    star: "#ffd46b",
  },
};

const ROUTE_CHAIN = [
  { from: "YVR", to: "LAX", theme: "pacific", orbitTargetKm: 28, desc: "太平洋海岸線從森林一路鋪向暖陽海灣，是全球航線地圖的溫柔開場。" },
  { from: "LAX", to: "MEX", theme: "sunbelt", orbitTargetKm: 36, desc: "加州暖流轉進墨西哥高原，雲層節奏開始更活潑。" },
  { from: "MEX", to: "BOG", theme: "tropic", orbitTargetKm: 48, desc: "跨過中美洲與加勒比邊緣，氣流會在山海之間忽快忽慢。" },
  { from: "BOG", to: "GRU", theme: "tropic", orbitTargetKm: 60, desc: "安地斯餘影退到身後，南美洲的大陸雲河開始變寬。" },
  { from: "GRU", to: "LIS", theme: "atlantic", orbitTargetKm: 100, desc: "第一次真正的跨洋長程，夜色和耐心都會一起拉長。" },
  { from: "LIS", to: "LHR", theme: "europe", orbitTargetKm: 32, desc: "大西洋霧光轉成歐洲晨色，節奏更像繁忙國際航路。" },
  { from: "LHR", to: "FRA", theme: "europe", orbitTargetKm: 24, desc: "西歐樞紐之間的短程跳點，最適合練精準進場。" },
  { from: "FRA", to: "IST", theme: "mediterranean", orbitTargetKm: 72, desc: "阿爾卑斯到博斯普魯斯的轉場，風層會更立體。" },
  { from: "IST", to: "CAI", theme: "mediterranean", orbitTargetKm: 52, desc: "歐亞交界滑向尼羅河口，空氣開始帶點沙金色。" },
  { from: "CAI", to: "JNB", theme: "africa", orbitTargetKm: 100, desc: "非洲長距離南下，視覺和航程都會慢慢沉進大片大陸尺度。" },
  { from: "JNB", to: "DXB", theme: "desert", orbitTargetKm: 120, desc: "高原暮色接到沙漠夜航，是速度與穩定感的考驗。" },
  { from: "DXB", to: "DEL", theme: "southasia", orbitTargetKm: 64, desc: "阿拉伯海與印度次大陸交會，熱流和高度帶選擇變得更重要。" },
  { from: "DEL", to: "SIN", theme: "southasia", orbitTargetKm: 100, desc: "長程亞洲走廊從乾燥內陸一路轉進潮濕熱帶。" },
  { from: "SIN", to: "HKG", theme: "southeastasia", orbitTargetKm: 72, desc: "東南亞雲塔一路延伸，低空與中空的切換會很頻繁。" },
  { from: "HKG", to: "TPE", theme: "eastasia", orbitTargetKm: 40, desc: "南海邊緣風場切得細碎，適合練快節奏的高度切換。" },
  { from: "TPE", to: "ICN", theme: "eastasia", orbitTargetKm: 60, desc: "黑潮上空的海天視野很開，巡航和進場都要提早布局。" },
  { from: "ICN", to: "HND", theme: "eastasia", orbitTargetKm: 28, desc: "東北亞樞紐短航段，節奏俐落，操作也更要求乾淨。" },
  { from: "HND", to: "PVG", theme: "eastasia", orbitTargetKm: 44, desc: "東京灣飛向長江口，航線密度高，修正要早。" },
  { from: "PVG", to: "SYD", theme: "oceania", orbitTargetKm: 160, desc: "真正的跨緯度長程，天空顏色會一路換場到南半球。" },
  { from: "SYD", to: "AKL", theme: "oceania", orbitTargetKm: 100, desc: "穿過塔斯曼海，世界旅程在海風和跑道燈之間收尾。" },
];

function orbitChallengeProfile(targetKm) {
  if (targetKm >= SPACE_REFERENCE.issMinKm) {
    return {
      tier: "iss",
      badge: "ISS",
      label: "ISS 高度帶",
      shortLabel: `${targetKm} km`,
      detail: `把最高高度拉進 ISS 常見高度帶附近，挑戰 ${targetKm} km。`,
      reward: "極限高空",
    };
  }
  if (targetKm >= SPACE_REFERENCE.lowEarthOrbitStartKm) {
    return {
      tier: "leo",
      badge: "LEO",
      label: "低地球軌道",
      shortLabel: `${targetKm} km`,
      detail: `越過卡門線後再往上，朝低地球軌道參考高度 ${targetKm} km 逼近。`,
      reward: "軌道邊緣",
    };
  }
  if (targetKm >= SPACE_REFERENCE.karmanLineKm) {
    return {
      tier: "karman",
      badge: "KARMAN",
      label: "卡門線挑戰",
      shortLabel: `${targetKm} km`,
      detail: `把最高高度推到 ${targetKm} km，越過 ${SPACE_REFERENCE.karmanLineKm} km 的太空邊界。`,
      reward: "近太空",
    };
  }
  if (targetKm >= 48) {
    return {
      tier: "upper-atmosphere",
      badge: "UPPER",
      label: "高層大氣窗",
      shortLabel: `${targetKm} km`,
      detail: `巡航時把最高高度拉到 ${targetKm} km，讓天空開始轉成高層大氣色帶。`,
      reward: "高空視野",
    };
  }
  return {
    tier: "stratosphere",
    badge: "STRATO",
    label: "平流層窗",
    shortLabel: `${targetKm} km`,
    detail: `先把最高高度練到 ${targetKm} km，熟悉平流層前段的節奏與視覺變化。`,
    reward: "暖身爬升",
  };
}

function haversineKm(from, to) {
  const radius = 6371;
  const lat1 = (from.lat * Math.PI) / 180;
  const lat2 = (to.lat * Math.PI) / 180;
  const dLat = ((to.lat - from.lat) * Math.PI) / 180;
  const dLon = ((to.lon - from.lon) * Math.PI) / 180;
  const a = Math.sin(dLat * 0.5) ** 2
    + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon * 0.5) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(radius * c);
}

const REAL_WORLD_CRUISE_KMH = 820;
const GAME_WORLD_SPEED_TARGET = 3000;

function realFlightMinutes(realDistanceKm) {
  return Math.max(45, Math.round((realDistanceKm / REAL_WORLD_CRUISE_KMH) * 60));
}

function gameplayMinutes(realDistanceKm) {
  const realHours = realDistanceKm / REAL_WORLD_CRUISE_KMH;
  return Number(clamp(2.8 + realHours * 0.85 + Math.pow(realHours, 0.65) * 0.45, 3.2, 11.5).toFixed(1));
}

function gameDistanceUnits(playMinutes) {
  return Math.round(playMinutes * 60 * GAME_WORLD_SPEED_TARGET);
}

function routeDifficulty(index, realDistanceKm) {
  const stage = 1 + Math.floor(index / 4);
  const longHaulBoost = realDistanceKm > 7600 ? 1 : 0;
  return clamp(stage + longHaulBoost, 1, 5);
}

export const ROUTES = ROUTE_CHAIN.map((route, index) => {
  const from = AIRPORTS[route.from];
  const to = AIRPORTS[route.to];
  const realDistanceKm = haversineKm(from, to);
  const estimatedRealMinutes = realFlightMinutes(realDistanceKm);
  const estimatedGameMinutes = gameplayMinutes(realDistanceKm);
  const distance = gameDistanceUnits(estimatedGameMinutes);
  const difficulty = routeDifficulty(index, realDistanceKm);
  const orbitChallenge = orbitChallengeProfile(route.orbitTargetKm);
  return {
    id: `${route.from.toLowerCase()}-${route.to.toLowerCase()}`,
    from: route.from,
    to: route.to,
    distance,
    realDistanceKm,
    estimatedRealMinutes,
    estimatedGameMinutes,
    difficulty,
    desc: route.desc,
    orbitChallenge: {
      ...orbitChallenge,
      targetKm: route.orbitTargetKm,
    },
    sunsetDrain: 2.3 + difficulty * 0.34 + distance / 14000,
    palette: PALETTES[route.theme],
  };
});

export const MUSIC_PATTERN = [
  { freq: 392.0, beats: 0.5 },
  { freq: 523.25, beats: 0.5 },
  { freq: 659.25, beats: 1 },
  { freq: 587.33, beats: 1 },
  { freq: 523.25, beats: 0.5 },
  { freq: 440.0, beats: 0.5 },
  { freq: 392.0, beats: 1 },
  { freq: 329.63, beats: 1 },
  { freq: 349.23, beats: 0.5 },
  { freq: 440.0, beats: 0.5 },
  { freq: 523.25, beats: 1 },
  { freq: 493.88, beats: 1 },
  { freq: 392.0, beats: 1 },
  { freq: 0, beats: 1 },
];

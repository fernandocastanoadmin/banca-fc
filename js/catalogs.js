// js/catalogs.js - Parrilla Exacta de Sorteos (Venezuela y Colombia) en Formato 12h AM/PM
// Con Motor de Diccionarios Dinámicos por Operadora (OPERATOR_DICTIONARIES) y Cierre (-5 min)
// Sistema "Banca El Castaño (Seguro Te Paga)"

const ZODIAC_SIGNS = [
  { code: 'ARI', name: 'Aries', icon: '♈' },
  { code: 'TAU', name: 'Tauro', icon: '♉' },
  { code: 'GEM', name: 'Géminis', icon: '♊' },
  { code: 'CAN', name: 'Cáncer', icon: '♋' },
  { code: 'LEO', name: 'Leo', icon: '♌' },
  { code: 'VIR', name: 'Virgo', icon: '♍' },
  { code: 'LIB', name: 'Libra', icon: '♎' },
  { code: 'ESC', name: 'Escorpio', icon: '♏' },
  { code: 'SAG', name: 'Sagitario', icon: '♐' },
  { code: 'CAP', name: 'Capricornio', icon: '♑' },
  { code: 'ACU', name: 'Acuario', icon: '♒' },
  { code: 'PIS', name: 'Piscis', icon: '♓' }
];

// ============================================================================
// DICCIONARIOS OFICIALES EXACTOS POR OPERADORA (OPERATOR_DICTIONARIES)
// ============================================================================

// A. Base Clásica 38 Animalitos (0, 00 al 36)
const BASE_38 = {
  "0": "DELFÍN", "00": "BALLENA", "01": "CARNERO", "02": "TORO", "03": "CIEMPIÉS",
  "04": "ALACRÁN", "05": "LEÓN", "06": "RANA", "07": "PERICO", "08": "RATÓN",
  "09": "ÁGUILA", "10": "TIGRE", "11": "GATO", "12": "CABALLO", "13": "MONO",
  "14": "PALOMA", "15": "ZORRO", "16": "OSO", "17": "PAVO", "18": "BURRO",
  "19": "CHIVO", "20": "CERDO", "21": "GALLO", "22": "CAMELLO", "23": "CEBRA",
  "24": "IGUANA", "25": "GALLINA", "26": "VACA", "27": "PERRO", "28": "ZAMURO",
  "29": "ELEFANTE", "30": "CAIMÁN", "31": "LAPA", "32": "ARDILLA", "33": "PESCADO",
  "34": "VENADO", "35": "JIRAFA", "36": "CULEBRA"
};

// B. El Guacharito Millonario / Selva Plus (0, 00 al 99 - 101 animalitos)
const GUACHARITO_101 = {
  ...BASE_38,
  "37": "TORTUGA", "38": "BÚFALO", "39": "LECHUZA", "40": "AVISPA", "41": "CANGURO",
  "42": "TUCÁN", "43": "MARIPOSA", "44": "CHIGÜIRE", "45": "GARZA", "46": "PUMA",
  "47": "PAVO REAL", "48": "PUERCOESPÍN", "49": "PEREZA", "50": "CANARIO", "51": "PELÍCANO",
  "52": "PULPO", "53": "CARACOL", "54": "GRILLO", "55": "OSO HORMIGUERO", "56": "TIBURÓN",
  "57": "PATO", "58": "HORMIGA", "59": "PANTERA", "60": "CAMALEÓN", "61": "PANDA",
  "62": "CACHICAMO", "63": "CANGREJO", "64": "GAVILÁN", "65": "ARAÑA", "66": "LOBO",
  "67": "AVESTRUZ", "68": "JAGUAR", "69": "CONEJO", "70": "BISONTE", "71": "GUACAMAYA",
  "72": "GORILA", "73": "HIPOPÓTAMO", "74": "TURPIAL", "75": "GUÁCHARO", "76": "RINOCERONTE",
  "77": "PINGÜINO", "78": "ANTÍLOPE", "79": "CALAMAR", "80": "MURCIÉLAGO", "81": "CUERVO",
  "82": "CUCARACHA", "83": "BÚHO", "84": "CAMARÓN", "85": "HÁMSTER", "86": "BUEY",
  "87": "CABRA", "88": "ERIZO DE MAR", "89": "ANGUILA", "90": "HURÓN", "91": "MORROCOY",
  "92": "CISNE", "93": "GAVIOTA", "94": "PAUJIL", "95": "ESCARABAJO", "96": "CABALLITO DE MAR",
  "97": "LORO", "98": "COCODRILO", "99": "GUACHARITO"
};

// Subset helper para construir rangos exactos (0, 00 y 01..maxNum)
function _buildRangeDict(sourceDict, maxNum, overrides = {}) {
  const out = { "0": sourceDict["0"], "00": sourceDict["00"] };
  for (let i = 1; i <= maxNum; i++) {
    const k = String(i).padStart(2, '0');
    if (sourceDict[k]) out[k] = sourceDict[k];
  }
  return { ...out, ...overrides };
}

// C. Mega Animal 40 (0, 00 al 40 - 42 animalitos)
const MEGA_ANIMAL_42 = _buildRangeDict(GUACHARITO_101, 40);

// D. El Gatazo (0, 00 al 74 - 76 animalitos: 11 = GATAZO, 61 = COLIBRÍ)
const GATAZO_76 = _buildRangeDict(GUACHARITO_101, 74, {
  "11": "GATAZO",
  "61": "COLIBRÍ"
});

// E. Guácharo Activo (0, 00 al 75 - 77 animalitos: 75 = GUÁCHARO, 61 = PANDA)
const GUACHARO_77 = _buildRangeDict(GUACHARITO_101, 75, {
  "61": "PANDA",
  "75": "GUÁCHARO"
});

// F. Cóndor Gana (0, 00 al 75 - 77 animalitos: 75 = CÓNDOR)
const CONDOR_77 = _buildRangeDict(GUACHARITO_101, 75, {
  "75": "CÓNDOR"
});

// G. GM El Granjazo (0, 00 al 76 - 78 animalitos)
const GRANJAZO_78 = {
  ...BASE_38,
  "20": "COCHINO",
  "37": "MARIPOSA", "38": "CONEJO", "39": "RINOCERONTE", "40": "HIPOPÓTAMO",
  "41": "BÚFALO", "42": "MURCIÉLAGO", "43": "KOALA", "44": "PUMA",
  "45": "CANGURO", "46": "LOBO", "47": "TORTUGA", "48": "MORSA",
  "49": "HIENA", "50": "COMADREJA", "51": "DRAGÓN", "52": "CHACAL",
  "53": "JAGUAR", "54": "CAMALEÓN", "55": "FOCA", "56": "ARMIÑO",
  "57": "JABALÍ", "58": "CASTOR", "59": "GUACAMAYA", "60": "TIBURÓN",
  "61": "TURPIAL", "62": "TUCÁN", "63": "CACHICAMO", "64": "HORMIGA",
  "65": "GORILA", "66": "BISONTE", "67": "FLAMINGO", "68": "ARAÑA",
  "69": "PAVO REAL", "70": "CANGREJO", "71": "RABIPELAO", "72": "PELÍCANO",
  "73": "COLIBRÍ", "74": "ESCARABAJO", "75": "CODORNIZ", "76": "MANTIS"
};

// H. Fruta Gana (0, 00 al 36 - 38 frutas)
const FRUTA_GANA_38 = {
  "0": "GUANÁBANA", "00": "NÍSPERO", "01": "CIRUELA", "02": "GUAYABA", "03": "TAMARINDO",
  "04": "PISTACHO", "05": "MELÓN", "06": "MAMÓN", "07": "PATILLA", "08": "LIMÓN",
  "09": "KIWI / FRESA", "10": "MANZANA", "11": "PARCHITA", "12": "MANGO", "13": "CAMBUR",
  "14": "PIÑA", "15": "ZAPOTE", "16": "PERA", "17": "MELOCOTÓN", "18": "AGUACATE",
  "19": "GRANADA", "20": "TORONJA", "21": "UVA", "22": "AVELLANA", "23": "DURAZNO",
  "24": "PLÁTANO", "25": "MAÍZ", "26": "MORA", "27": "FRAMBUESA", "28": "COCO",
  "29": "NARANJA", "30": "MANDARINA", "31": "LECHOSA", "32": "NUEZ", "33": "POMARROSA",
  "34": "HIGO", "35": "CEREZA", "36": "KIWI"
};

const OPERATOR_DICTIONARIES = {
  BASE_38: { key: 'BASE_38', label: 'Clásico 38 Animalitos (0, 00 al 36)', maxNum: 36, dict: BASE_38 },
  MEGA_ANIMAL_42: { key: 'MEGA_ANIMAL_42', label: 'Mega Animal 40 (0, 00 al 40)', maxNum: 40, dict: MEGA_ANIMAL_42 },
  GATAZO_76: { key: 'GATAZO_76', label: 'El Gatazo (0, 00 al 74)', maxNum: 74, dict: GATAZO_76 },
  GUACHARO_77: { key: 'GUACHARO_77', label: 'Guácharo Activo (0, 00 al 75)', maxNum: 75, dict: GUACHARO_77 },
  CONDOR_77: { key: 'CONDOR_77', label: 'Cóndor Gana (0, 00 al 75)', maxNum: 75, dict: CONDOR_77 },
  GRANJAZO_78: { key: 'GRANJAZO_78', label: 'GM El Granjazo (0, 00 al 76)', maxNum: 76, dict: GRANJAZO_78 },
  GUACHARITO_101: { key: 'GUACHARITO_101', label: 'Guacharito Millonario (0, 00 al 99)', maxNum: 99, dict: GUACHARITO_101 },
  SELVA_PLUS_101: { key: 'SELVA_PLUS_101', label: 'Selva Plus (0, 00 al 99)', maxNum: 99, dict: GUACHARITO_101 },
  FRUTA_GANA_38: { key: 'FRUTA_GANA_38', label: 'Fruta Gana (0, 00 al 36)', maxNum: 36, dict: FRUTA_GANA_38, isFruta: true }
};

const FIGURE_EMOJIS = {
  "DELFÍN": "🐬", "BALLENA": "🐋", "CARNERO": "🐏", "TORO": "🐂", "CIEMPIÉS": "🐛",
  "ALACRÁN": "🦂", "LEÓN": "🦁", "RANA": "🐸", "PERICO": "🦜", "RATÓN": "🐭",
  "ÁGUILA": "🦅", "TIGRE": "🐅", "GATO": "🐱", "GATAZO": "🐱", "CABALLO": "🐎",
  "MONO": "🐒", "PALOMA": "🕊️", "ZORRO": "🦊", "OSO": "🐻", "PAVO": "🦃",
  "BURRO": "🫏", "CHIVO": "🐐", "CERDO": "🐖", "COCHINO": "🐖", "GALLO": "🐓",
  "CAMELLO": "🐪", "CEBRA": "🦓", "IGUANA": "🦎", "GALLINA": "🐔", "VACA": "🐄",
  "PERRO": "🐕", "ZAMURO": "🦅", "ELEFANTE": "🐘", "CAIMÁN": "🐊", "LAPA": "🦔",
  "ARDILLA": "🐿️", "PESCADO": "🐟", "VENADO": "🦌", "JIRAFA": "🦒", "CULEBRA": "🐍",
  "TORTUGA": "🐢", "BÚFALO": "🐃", "LECHUZA": "🦉", "AVISPA": "🐝", "CANGURO": "🦘",
  "TUCÁN": "🦜", "MARIPOSA": "🦋", "CHIGÜIRE": "🐹", "GARZA": "🦩", "PUMA": "🐆",
  "PAVO REAL": "🦚", "PUERCOESPÍN": "🦔", "PEREZA": "🦥", "CANARIO": "🐤", "PELÍCANO": "🦤",
  "PULPO": "🐙", "CARACOL": "🐌", "GRILLO": "🦗", "OSO HORMIGUERO": "🐜", "TIBURÓN": "🦈",
  "PATO": "🦆", "HORMIGA": "🐜", "PANTERA": "🐈‍⬛", "CAMALEÓN": "🦎", "PANDA": "🐼",
  "CACHICAMO": "🦔", "CANGREJO": "🦀", "GAVILÁN": "🦅", "ARAÑA": "🕷️", "LOBO": "🐺",
  "AVESTRUZ": "🦤", "JAGUAR": "🐆", "CONEJO": "🐰", "BISONTE": "🦬", "GUACAMAYA": "🦜",
  "GORILA": "🦍", "HIPOPÓTAMO": "🦛", "TURPIAL": "🐦", "GUÁCHARO": "🦇", "CÓNDOR": "🦅",
  "RINOCERONTE": "🦏", "PINGÜINO": "🐧", "ANTÍLOPE": "🦌", "CALAMAR": "🦑", "MURCIÉLAGO": "🦇",
  "CUERVO": "🐦‍⬛", "CUCARACHA": "🪳", "BÚHO": "🦉", "CAMARÓN": "🦐", "HÁMSTER": "🐹",
  "BUEY": "🐂", "CABRA": "🐐", "ERIZO DE MAR": "🦔", "ANGUILA": "🐍", "HURÓN": "🦦",
  "MORROCOY": "🐢", "CISNE": "🦢", "GAVIOTA": "🕊️", "PAUJIL": "🦃", "ESCARABAJO": "🪲",
  "CABALLITO DE MAR": "🐠", "LORO": "🦜", "COCODRILO": "🐊", "GUACHARITO": "🦇",
  "KOALA": "🐨", "MORSA": "🦭", "HIENA": "🐕", "COMADREJA": "🦦", "DRAGÓN": "🐉",
  "CHACAL": "🐕", "FOCA": "🦭", "ARMIÑO": "🦦", "JABALÍ": "🐗", "CASTOR": "🦫",
  "FLAMINGO": "🦩", "RABIPELAO": "🐀", "COLIBRÍ": "🐦", "CODORNIZ": "🐦", "MANTIS": "🦗",
  "GUANÁBANA": "🍈", "NÍSPERO": "🍑", "CIRUELA": "🍑", "GUAYABA": "🍐", "TAMARINDO": "🫘",
  "PISTACHO": "🥜", "MELÓN": "🍈", "MAMÓN": "🍈", "PATILLA": "🍉", "LIMÓN": "🍋",
  "KIWI / FRESA": "🍓", "MANZANA": "🍎", "PARCHITA": "🍋", "MANGO": "🥭", "CAMBUR": "🍌",
  "PIÑA": "🍍", "ZAPOTE": "🍑", "PERA": "🍐", "MELOCOTÓN": "🍑", "AGUACATE": "🥑",
  "GRANADA": "🍎", "TORONJA": "🍊", "UVA": "🍇", "AVELLANA": "🌰", "DURAZNO": "🍑",
  "PLÁTANO": "🍌", "MAÍZ": "🌽", "MORA": "🫐", "FRAMBUESA": "🍓", "COCO": "🥥",
  "NARANJA": "🍊", "MANDARINA": "🍊", "LECHOSA": "🍈", "NUEZ": "🌰", "POMARROSA": "🍎",
  "HIGO": "🌰", "CEREZA": "🍒", "KIWI": "🥝"
};

function getEmojiForFigureName(nameStr, isFruta = false) {
  const upper = String(nameStr || '').toUpperCase().trim();
  return FIGURE_EMOJIS[upper] || (isFruta ? '🍉' : '🐾');
}

// Resuelve el diccionario oficial exacto para cualquier sorteo u operadora
function getOperatorConfigForLottery(lotteryIdOrName = '') {
  const raw = String(lotteryIdOrName || '').toUpperCase();
  if (raw.includes('FRUTA_GANA') || raw.includes('FRUTA GANA') || raw.includes('FRUTA')) {
    return OPERATOR_DICTIONARIES.FRUTA_GANA_38;
  }
  if (raw.includes('GUACHARITO')) {
    return OPERATOR_DICTIONARIES.GUACHARITO_101;
  }
  if (raw.includes('SELVA_PLUS') || raw.includes('SELVA PLUS')) {
    return OPERATOR_DICTIONARIES.SELVA_PLUS_101;
  }
  if (raw.includes('GRANJAZO')) {
    return OPERATOR_DICTIONARIES.GRANJAZO_78;
  }
  if (raw.includes('GUACHARO_ACTIVO') || raw.includes('GUÁCHARO ACTIVO') || raw.includes('GUACHARO ACTIVO')) {
    return OPERATOR_DICTIONARIES.GUACHARO_77;
  }
  if (raw.includes('CONDOR_GANA') || raw.includes('CÓNDOR GANA') || raw.includes('CONDOR GANA')) {
    return OPERATOR_DICTIONARIES.CONDOR_77;
  }
  if (raw.includes('GATAZO')) {
    return OPERATOR_DICTIONARIES.GATAZO_76;
  }
  if (raw.includes('MEGA_ANIMAL') || raw.includes('MEGA ANIMAL')) {
    return OPERATOR_DICTIONARIES.MEGA_ANIMAL_42;
  }
  return OPERATOR_DICTIONARIES.BASE_38;
}

// Compatibilidad con código legacy que consulte ANIMALITOS_DICT o FRUTAS_DICT directamente
const ANIMALITOS_DICT = {};
Object.entries(GUACHARITO_101).forEach(([k, v]) => {
  ANIMALITOS_DICT[k] = { name: v, emoji: getEmojiForFigureName(v, false) };
  if (k.length === 2 && k.startsWith('0') && k !== '00') {
    ANIMALITOS_DICT[String(parseInt(k, 10))] = { name: v, emoji: getEmojiForFigureName(v, false) };
  }
});

const FRUTAS_DICT = {};
Object.entries(FRUTA_GANA_38).forEach(([k, v]) => {
  FRUTAS_DICT[k] = { name: v, emoji: getEmojiForFigureName(v, true) };
  if (k.length === 2 && k.startsWith('0') && k !== '00') {
    FRUTAS_DICT[String(parseInt(k, 10))] = { name: v, emoji: getEmojiForFigureName(v, true) };
  }
});

// Normaliza el código de animalito/fruta ('1' -> '01', preservando '0' y '00')
function normalizeAnimalCode(numberStr) {
  const clean = String(numberStr ?? '').trim();
  if (!clean) return '';
  if (clean === '0' || clean === '00') return clean;
  const n = parseInt(clean, 10);
  if (isNaN(n) || n < 0) return clean;
  return n < 10 ? `0${n}` : String(n);
}

// Verifica si un número es válido para la operadora indicada y devuelve { valid, code, name, emoji, maxNum, operatorLabel }
function validateAndResolveAnimalForLottery(numberStr, lotteryIdOrName = '') {
  const opCfg = getOperatorConfigForLottery(lotteryIdOrName);
  const code = normalizeAnimalCode(numberStr);
  if (!code || !/^\d{1,2}$/.test(code)) {
    return { valid: false, code, name: null, emoji: null, maxNum: opCfg.maxNum, operatorLabel: opCfg.label };
  }
  if (code !== '0' && code !== '00') {
    const n = parseInt(code, 10);
    if (isNaN(n) || n < 1 || n > opCfg.maxNum) {
      return { valid: false, code, name: null, emoji: null, maxNum: opCfg.maxNum, operatorLabel: opCfg.label };
    }
  }
  const figName = opCfg.dict[code];
  if (!figName) {
    return { valid: false, code, name: null, emoji: null, maxNum: opCfg.maxNum, operatorLabel: opCfg.label };
  }
  return {
    valid: true,
    code,
    name: figName,
    emoji: getEmojiForFigureName(figName, Boolean(opCfg.isFruta)),
    maxNum: opCfg.maxNum,
    operatorLabel: opCfg.label
  };
}

// Devuelve el animalito o fruta correspondiente según la operadora específica
function getAnimalOrFruitInfo(numberStr, lotteryIdOrName = '') {
  const res = validateAndResolveAnimalForLottery(numberStr, lotteryIdOrName);
  if (res.valid) {
    return { name: res.name, emoji: res.emoji, code: res.code, maxNum: res.maxNum, valid: true };
  }
  const opCfg = getOperatorConfigForLottery(lotteryIdOrName);
  return {
    name: opCfg.isFruta ? 'FUERA DE RANGO' : 'FUERA DE RANGO',
    emoji: '⛔',
    code: normalizeAnimalCode(numberStr),
    maxNum: opCfg.maxNum,
    valid: false
  };
}

// ============================================================================
// UTILIDADES DE PARSEO DE HORA 12H (AM/PM) Y REGLA DE CIERRE (-5 MINUTOS)
// ============================================================================
function parse12HourTime(time12Str) {
  const m = String(time12Str || '').trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!m) return { hour24: 23, minute: 59, formatted12: time12Str };
  let hr = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  const period = m[3].toUpperCase();
  if (period === 'PM' && hr < 12) hr += 12;
  if (period === 'AM' && hr === 12) hr = 0;
  return {
    hour24: hr,
    minute: min,
    formatted12: `${parseInt(m[1], 10)}:${String(min).padStart(2, '0')} ${period}`
  };
}

function buildHourlyDraws(prefixId, baseName, times12Array, extraProps = {}) {
  return times12Array.map(t12 => {
    const parsed = parse12HourTime(t12);
    const timeCode = `${String(parsed.hour24).padStart(2, '0')}${String(parsed.minute).padStart(2, '0')}`;
    return {
      id: `${prefixId}_${timeCode}`,
      baseName: baseName,
      name: `${baseName} ${parsed.formatted12}`,
      time: parsed.formatted12,
      time12: parsed.formatted12,
      drawHour24: parsed.hour24,
      drawMinute: parsed.minute,
      ...extraProps
    };
  });
}

function generateRangeHours12(startHour24, endHour24, minuteVal = 0) {
  const list = [];
  const mm = String(minuteVal).padStart(2, '0');
  for (let h = startHour24; h <= endHour24; h++) {
    const period = h >= 12 ? 'PM' : 'AM';
    const h12 = h === 0 ? 12 : (h > 12 ? h - 12 : h);
    list.push(`${h12}:${mm} ${period}`);
  }
  return list;
}

const HOURS_8AM_TO_7PM_00 = generateRangeHours12(8, 19, 0);
const HOURS_9AM_TO_7PM_00 = generateRangeHours12(9, 19, 0);
const HOURS_9AM_TO_8PM_00 = generateRangeHours12(9, 20, 0);
const HOURS_9AM_TO_9PM_00 = generateRangeHours12(9, 21, 0);
const HOURS_9AM_TO_6PM_00 = generateRangeHours12(9, 18, 0);

const HOURS_8AM_TO_7PM_05 = generateRangeHours12(8, 19, 5);
const HOURS_9AM_TO_7PM_10 = generateRangeHours12(9, 19, 10);
const HOURS_8AM_TO_8PM_15 = generateRangeHours12(8, 20, 15);
const HOURS_9AM_TO_6PM_15 = generateRangeHours12(9, 18, 15);

const HOURS_8AM_TO_7PM_30 = generateRangeHours12(8, 19, 30);
const HOURS_8AM_TO_8PM_30 = generateRangeHours12(8, 20, 30);
const HOURS_9AM_TO_8PM_30 = generateRangeHours12(9, 20, 30);
const HOURS_9AM_TO_6PM_30 = generateRangeHours12(9, 18, 30);

const HOURS_9AM_TO_7PM_40 = generateRangeHours12(9, 19, 40);

function singleDraw(id, baseName, time12, extraProps = {}) {
  const parsed = parse12HourTime(time12);
  return {
    id,
    baseName,
    name: `${baseName} ${parsed.formatted12}`,
    time: parsed.formatted12,
    time12: parsed.formatted12,
    drawHour24: parsed.hour24,
    drawMinute: parsed.minute,
    ...extraProps
  };
}

// ============================================================================
// CATÁLOGO MAESTRO DE SORTEOS (4 PESTAÑAS OFICIALES)
// ============================================================================
const LOTTERY_CATALOGS = {
  // 1. PESTAÑA 1: SIN SIGNO (TRIPLES Y TERMINALES VENEZUELA)
  sin_signo: [
    ...buildHourlyDraws('CHANCE_A', 'Chance A', HOURS_9AM_TO_7PM_00, { type: 'triple' }),
    ...buildHourlyDraws('CHANCE_B', 'Chance B', HOURS_9AM_TO_7PM_00, { type: 'triple' }),
    ...buildHourlyDraws('TACHIRA_A', 'Táchira A', ['1:15 PM', '4:45 PM', '10:10 PM'], { type: 'triple' }),
    ...buildHourlyDraws('TACHIRA_B', 'Táchira B', ['1:15 PM', '4:45 PM', '10:10 PM'], { type: 'triple' }),
    ...buildHourlyDraws('ZULIA_A', 'Zulia A', ['12:45 PM', '4:45 PM', '7:05 PM'], { type: 'triple' }),
    ...buildHourlyDraws('ZULIA_B', 'Zulia B', ['12:45 PM', '4:45 PM', '7:05 PM'], { type: 'triple' }),
    ...buildHourlyDraws('CALIENTE_A', 'Caliente A', ['1:00 PM', '4:30 PM', '7:10 PM'], { type: 'triple' }),
    ...buildHourlyDraws('CALIENTE_B', 'Caliente B', ['1:00 PM', '4:30 PM', '7:10 PM'], { type: 'triple' }),
    ...buildHourlyDraws('TRIPLE_LAGO_A', 'Triple Lago A', ['1:00 PM', '4:30 PM', '10:15 PM'], { type: 'triple' }),
    ...buildHourlyDraws('TRIPLE_LAGO_B', 'Triple Lago B', ['1:00 PM', '4:30 PM', '10:15 PM'], { type: 'triple' }),
    ...buildHourlyDraws('TRIPLE_GATO_A', 'Triple Gato A', ['12:45 PM', '4:45 PM', '5:00 PM', '7:45 PM'], { type: 'triple' }),
    ...buildHourlyDraws('TRIPLE_GATO_B', 'Triple Gato B', ['12:45 PM', '4:45 PM', '5:00 PM', '7:45 PM'], { type: 'triple' }),
    ...buildHourlyDraws('ARREJUNTAO_A', 'Arrejuntao A', ['10:00 AM', '1:00 PM', '4:00 PM', '7:00 PM', '11:00 PM'], { type: 'triple' }),
    ...buildHourlyDraws('ARREJUNTAO_B', 'Arrejuntao B', ['10:00 AM', '1:00 PM', '4:00 PM', '7:00 PM', '11:00 PM'], { type: 'triple' }),
    ...buildHourlyDraws('TRIPLE_ZAMORANO', 'Triple Zamorano', ['10:00 AM', '12:00 PM', '2:00 PM', '4:00 PM', '7:00 PM'], { type: 'triple' }),
    ...buildHourlyDraws('LA_RICACHONA', 'La Ricachona', HOURS_8AM_TO_7PM_05, { type: 'triple' }),
    ...buildHourlyDraws('TRIPLE_FACIL', 'Triple Fácil', HOURS_8AM_TO_7PM_00, { type: 'triple' }),
    ...buildHourlyDraws('TRIO_ACTIVO', 'Trío Activo', HOURS_8AM_TO_7PM_00, { type: 'triple' }),
    ...buildHourlyDraws('TRIPLE_POPULAR', 'Triple Popular', HOURS_9AM_TO_9PM_00, { type: 'triple' }),
    ...buildHourlyDraws('TRIPLE_DORADO', 'Triple Dorado', ['9:00 AM', '10:00 AM', '11:00 AM', '1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM', '5:00 PM', '6:00 PM'], { type: 'triple' }),
    ...buildHourlyDraws('TRIPLE_FORTUNA', 'Triple Fortuna', generateRangeHours12(10, 19, 0), { type: 'triple' }),
    ...buildHourlyDraws('NAPA_GANA', 'Ñapa Gana', ['9:00 AM', '10:30 AM', '11:30 AM', '12:00 PM', '1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM', '5:00 PM', '6:00 PM', '7:00 PM'], { type: 'terminal' }),
    ...buildHourlyDraws('CARACAS_A', 'Caracas A', ['1:00 PM', '4:30 PM', '7:00 PM'], { type: 'triple' }),
    ...buildHourlyDraws('CARACAS_B', 'Caracas B', ['1:00 PM', '4:30 PM', '7:00 PM'], { type: 'triple' })
  ],

  // 2. PESTAÑA 2: CON SIGNO (ZODIACALES VENEZUELA Y ASTROS COLOMBIA)
  con_signo: [
    ...buildHourlyDraws('CHANCE_ASTRAL', 'Chance Astral', HOURS_9AM_TO_7PM_00, { type: 'zodiac' }),
    ...buildHourlyDraws('TACHIRA_ZODIACAL', 'Táchira Zodiacal', ['1:15 PM', '4:45 PM', '10:10 PM'], { type: 'zodiac' }),
    ...buildHourlyDraws('ZODIACO_ZULIA', 'Zodiaco del Zulia', ['12:45 PM', '4:45 PM', '7:05 PM'], { type: 'zodiac' }),
    ...buildHourlyDraws('SIGNO_CALIENTE', 'Signo Caliente', ['1:00 PM', '4:30 PM', '7:10 PM'], { type: 'zodiac' }),
    ...buildHourlyDraws('ASTRO_ZAMORANO', 'Astro Zamorano', ['10:00 AM', '12:00 PM', '2:00 PM', '4:00 PM', '7:00 PM'], { type: 'zodiac' }),
    ...buildHourlyDraws('LAGO_ZODIACAL', 'Lago Zodiacal', ['1:00 PM', '4:30 PM', '10:15 PM'], { type: 'zodiac' }),
    ...buildHourlyDraws('TRIPLE_GANA_SIGNO', 'Triple Gana Signo', ['1:00 PM', '4:00 PM', '10:00 PM'], { type: 'zodiac' }),
    ...buildHourlyDraws('SUPER_GANA', 'Super Gana', ['1:00 PM', '4:00 PM', '10:00 PM'], { type: 'astro' }),
    ...buildHourlyDraws('TRIPLE_GATO_ZOD', 'Triple Gato Zodiacal', ['12:45 PM', '4:45 PM', '5:00 PM', '7:45 PM'], { type: 'zodiac' }),
    ...buildHourlyDraws('ARREJUNTAO_SIGNO', 'Arrejuntao Signo', ['10:00 AM', '1:00 PM', '4:00 PM', '7:00 PM', '11:00 PM'], { type: 'zodiac' }),
    ...buildHourlyDraws('TRIPLETAZO', 'Tripletazo', ['1:00 PM', '4:30 PM', '7:00 PM'], { type: 'zodiac' }),
    singleDraw('ASTRO_SOL_1430', 'Super Astro Sol', '2:30 PM', { type: 'astro', country: 'COL', daysOfWeek: [1, 2, 3, 4, 5, 6] }),
    singleDraw('ASTRO_LUNA_2230', 'Super Astro Luna', '10:30 PM', { type: 'astro', country: 'COL', daysOfWeek: [0, 1, 2, 3, 4, 5, 6] })
  ],

  // 3. PESTAÑA 3: 4 CIFRAS (LOTERÍAS Y CHANCES COLOMBIANOS + ESPECIALES)
  cuatro_cifras: [
    singleDraw('CUNDINAMARCA', 'Lotería de Cundinamarca', '10:30 PM', { has5ta: false, daysOfWeek: [1], dayLabel: 'Lunes' }),
    singleDraw('TOLIMA', 'Lotería del Tolima', '10:30 PM', { has5ta: false, daysOfWeek: [1], dayLabel: 'Lunes' }),
    singleDraw('CRUZ_ROJA', 'Lotería de la Cruz Roja', '10:55 PM', { has5ta: false, daysOfWeek: [2], dayLabel: 'Martes' }),
    singleDraw('HUILA', 'Lotería del Huila', '10:30 PM', { has5ta: false, daysOfWeek: [2], dayLabel: 'Martes' }),
    singleDraw('MANIZALES', 'Lotería de Manizales', '10:30 PM', { has5ta: false, daysOfWeek: [3], dayLabel: 'Miércoles' }),
    singleDraw('META', 'Lotería del Meta', '10:30 PM', { has5ta: false, daysOfWeek: [3], dayLabel: 'Miércoles' }),
    singleDraw('VALLE', 'Lotería del Valle', '10:30 PM', { has5ta: false, daysOfWeek: [3], dayLabel: 'Miércoles' }),
    singleDraw('BOGOTA', 'Lotería de Bogotá', '11:15 PM', { has5ta: false, daysOfWeek: [4], dayLabel: 'Jueves' }),
    singleDraw('QUINDIO', 'Lotería del Quindío', '10:30 PM', { has5ta: false, daysOfWeek: [4], dayLabel: 'Jueves' }),
    singleDraw('MEDELLIN', 'Lotería de Medellín', '11:00 PM', { has5ta: false, daysOfWeek: [5], dayLabel: 'Viernes' }),
    singleDraw('SANTANDER', 'Lotería de Santander', '11:00 PM', { has5ta: false, daysOfWeek: [5], dayLabel: 'Viernes' }),
    singleDraw('RISARALDA', 'Lotería de Risaralda', '11:00 PM', { has5ta: false, daysOfWeek: [5], dayLabel: 'Viernes' }),
    singleDraw('BOYACA', 'Lotería de Boyacá', '10:40 PM', { has5ta: false, daysOfWeek: [6], dayLabel: 'Sábado' }),
    singleDraw('CAUCA', 'Lotería del Cauca', '10:40 PM', { has5ta: false, daysOfWeek: [6], dayLabel: 'Sábado' }),
    singleDraw('DORADO_MANANA', 'Dorado Mañana', '10:55 AM', { has5ta: true, daysOfWeek: [1, 2, 3, 4, 5, 6] }),
    singleDraw('DORADO_TARDE', 'Dorado Tarde', '3:30 PM', { has5ta: true, daysOfWeek: [1, 2, 3, 4, 5, 6] }),
    singleDraw('DORADO_NOCHE', 'Dorado Noche', '10:05 PM', { has5ta: true, daysOfWeek: [0, 1, 2, 3, 4, 5, 6] }),
    singleDraw('SINUANO_DIA_LV', 'Sinuano Día', '2:30 PM', { has5ta: true, daysOfWeek: [1, 2, 3, 4, 5, 6] }),
    singleDraw('SINUANO_DIA_DOM', 'Sinuano Día (Dom)', '1:00 PM', { has5ta: true, daysOfWeek: [0] }),
    singleDraw('SINUANO_NOCHE_LV', 'Sinuano Noche', '10:30 PM', { has5ta: true, daysOfWeek: [1, 2, 3, 4, 5, 6] }),
    singleDraw('SINUANO_NOCHE_DOM', 'Sinuano Noche (Dom)', '8:30 PM', { has5ta: true, daysOfWeek: [0] }),
    singleDraw('ANTIOQUENITA_DIA', 'Antioqueñita Día', '10:00 AM', { has5ta: true }),
    singleDraw('ANTIOQUENITA_TARDE', 'Antioqueñita Tarde', '4:00 PM', { has5ta: true }),
    singleDraw('CAFETERITO_TARDE', 'Cafeterito Tarde', '12:00 PM', { has5ta: true }),
    singleDraw('CAFETERITO_NOCHE', 'Cafeterito Noche', '10:00 PM', { has5ta: true }),
    singleDraw('PAISITA_DIA', 'Paisita Día', '1:00 PM', { has5ta: true }),
    singleDraw('PAISITA_NOCHE', 'Paisita Noche', '6:00 PM', { has5ta: false }),
    singleDraw('PAISITA_3', 'Paisita 3', '9:00 PM', { has5ta: false }),
    singleDraw('CHONTICO_DIA', 'Chontico Día', '1:00 PM', { has5ta: true }),
    singleDraw('CHONTICO_NOCHE', 'Chontico Noche', '7:00 PM', { has5ta: true }),
    singleDraw('SAMAN_DIA', 'Samán Día', '1:00 PM', { has5ta: false }),
    singleDraw('FANTASTICA_DIA', 'Fantástica Día', '1:00 PM', { has5ta: true }),
    singleDraw('FANTASTICA_NOCHE', 'Fantástica Noche', '8:30 PM', { has5ta: true }),
    singleDraw('CASH_THREE_DIA', 'Cash Three Día', '1:00 PM', { has5ta: false }),
    singleDraw('CASH_THREE_NOCHE', 'Cash Three Noche', '10:00 PM', { has5ta: false }),
    singleDraw('PLAY_FOUR_DIA', 'Play Four Día', '1:00 PM', { has5ta: false }),
    singleDraw('PLAY_FOUR_NOCHE', 'Play Four Noche', '10:00 PM', { has5ta: false }),
    singleDraw('PIJAO_ORO', 'Pijao de Oro', '2:00 PM', { has5ta: true }),
    singleDraw('CARIBENA_DIA', 'Caribeña Día', '2:30 PM', { has5ta: true }),
    singleDraw('CARIBENA_NOCHE', 'Caribeña Noche', '10:30 PM', { has5ta: true }),
    singleDraw('CULONA_DIA', 'Culona Día', '2:30 PM', { has5ta: false }),
    singleDraw('CULONA_NOCHE', 'Culona Noche', '9:30 PM', { has5ta: false }),
    singleDraw('MOTILON_TARDE', 'Motilón Tarde', '3:00 PM', { has5ta: true }),
    singleDraw('MOTILON_NOCHE', 'Motilón Noche', '9:00 PM', { has5ta: true }),
    ...buildHourlyDraws('EL_ARRIMAO', 'El Arrimao', ['10:00 AM', '1:00 PM', '4:00 PM', '7:00 PM', '11:00 PM'], { has5ta: false }),
    ...buildHourlyDraws('EL_PEGADITO', 'El Pegadito', ['10:00 AM', '1:00 PM', '4:00 PM', '7:00 PM', '11:00 PM'], { has5ta: false })
  ],

  // 4. PESTAÑA 4: ANIMALITOS Y FRUTAS (CON RANGO Y DICCIONARIO OFICIAL POR OPERADORA)
  animalitos: [
    // Operadoras de 38 figuras (0, 00 al 36) y especiales en punto (:00)
    ...buildHourlyDraws('LOTTO_ACTIVO', 'Lotto Activo', HOURS_8AM_TO_7PM_00, { maxNum: 36, dictKey: 'BASE_38', type: 'animalito' }),
    ...buildHourlyDraws('LA_GRANJITA', 'La Granjita', HOURS_8AM_TO_7PM_00, { maxNum: 36, dictKey: 'BASE_38', type: 'animalito' }),
    ...buildHourlyDraws('GUACHARO_ACTIVO', 'Guácharo Activo', HOURS_8AM_TO_7PM_00, { maxNum: 75, dictKey: 'GUACHARO_77', type: 'animalito' }),
    ...buildHourlyDraws('CONDOR_GANA', 'Cóndor Gana', HOURS_9AM_TO_7PM_00, { maxNum: 75, dictKey: 'CONDOR_77', type: 'animalito' }),
    ...buildHourlyDraws('LOTO_CHAIMA', 'Loto Chaima', HOURS_8AM_TO_7PM_00, { maxNum: 36, dictKey: 'BASE_38', type: 'animalito' }),

    // Fruta Gana (0, 00 al 36 - 38 frutas)
    ...buildHourlyDraws('FRUTA_GANA', 'Fruta Gana', HOURS_9AM_TO_7PM_00, { maxNum: 36, dictKey: 'FRUTA_GANA_38', type: 'animalito', isFruta: true }),

    // Otras operadoras en punto (:00)
    ...buildHourlyDraws('GRANJA_MILLONARIA', 'Granja Millonaria', HOURS_9AM_TO_8PM_00, { maxNum: 36, dictKey: 'BASE_38', type: 'animalito' }),
    ...buildHourlyDraws('FIERAS_ORIENTE', 'Animalitos del Oriente - Fieras', HOURS_9AM_TO_6PM_00, { maxNum: 36, dictKey: 'BASE_38', type: 'animalito' }),
    ...buildHourlyDraws('CHANCE_ANIMALITOS', 'Chance con Animalitos', HOURS_9AM_TO_7PM_00, { maxNum: 36, dictKey: 'BASE_38', type: 'animalito' }),
    ...buildHourlyDraws('CHANCE_ANIMALITOS_B', 'Chance con Animalitos B', HOURS_9AM_TO_7PM_00, { maxNum: 36, dictKey: 'BASE_38', type: 'animalito' }),
    ...buildHourlyDraws('MEGA_ANIMAL_40', 'Mega Animal 40', HOURS_9AM_TO_8PM_00, { maxNum: 40, dictKey: 'MEGA_ANIMAL_42', type: 'animalito' }),
    ...buildHourlyDraws('TROPI_GANA', 'Tropi Gana', HOURS_9AM_TO_7PM_00, { maxNum: 36, dictKey: 'BASE_38', type: 'animalito' }),
    ...buildHourlyDraws('TRIPLE_POPULAR_ANM', 'Triple Popular Animalitos', HOURS_9AM_TO_9PM_00, { maxNum: 36, dictKey: 'BASE_38', type: 'animalito' }),

    // Sorteos a los :05 minutos
    ...buildHourlyDraws('MONJE_MILLONARIO', 'Monje Millonario', HOURS_8AM_TO_7PM_05, { maxNum: 36, dictKey: 'BASE_38', type: 'animalito' }),
    ...buildHourlyDraws('LA_RICACHONA_ANM', 'La Ricachona Animalitos', HOURS_8AM_TO_7PM_05, { maxNum: 36, dictKey: 'BASE_38', type: 'animalito' }),

    // Sorteos a los :10 minutos
    ...buildHourlyDraws('LOTTO_GATO', 'Lotto Gato', HOURS_9AM_TO_7PM_10, { maxNum: 36, dictKey: 'BASE_38', type: 'animalito' }),

    // Sorteos a los :15 minutos (Selva Plus: 0, 00 al 99)
    ...buildHourlyDraws('SELVA_PLUS', 'Selva Plus', HOURS_8AM_TO_8PM_15, { maxNum: 99, dictKey: 'SELVA_PLUS_101', type: 'animalito' }),
    ...buildHourlyDraws('BICHITOS_ORIENTE', 'Animalitos del Oriente - Bichitos', HOURS_9AM_TO_6PM_15, { maxNum: 36, dictKey: 'BASE_38', type: 'animalito' }),

    // Sorteos a los :30 minutos (Guacharito Millonario: 0..99, Granjazo: 0..76)
    ...buildHourlyDraws('GUACHARITO_MILL', 'El Guacharito Millonario', HOURS_8AM_TO_7PM_30, { maxNum: 99, dictKey: 'GUACHARITO_101', type: 'animalito' }),
    ...buildHourlyDraws('LOTTO_ACTIVO_RD', 'Lotto Activo RD', HOURS_8AM_TO_7PM_30, { maxNum: 36, dictKey: 'BASE_38', type: 'animalito' }),
    ...buildHourlyDraws('RULETA_ROYAL', 'Ruleta Royal', HOURS_8AM_TO_8PM_30, { maxNum: 36, dictKey: 'BASE_38', type: 'animalito' }),
    ...buildHourlyDraws('GRANJAZO', 'GM El Granjazo', HOURS_9AM_TO_8PM_30, { maxNum: 76, dictKey: 'GRANJAZO_78', type: 'animalito' }),
    ...buildHourlyDraws('MASCOTAS_ORIENTE', 'Animalitos del Oriente - Mascotas', HOURS_9AM_TO_6PM_30, { maxNum: 36, dictKey: 'BASE_38', type: 'animalito' }),

    // Sorteos a los :40 minutos (El Gatazo: 0, 00 al 74)
    ...buildHourlyDraws('GATAZO', 'El Gatazo', HOURS_9AM_TO_7PM_40, { maxNum: 74, dictKey: 'GATAZO_76', type: 'animalito' }),

    // Sorteos Especiales
    ...buildHourlyDraws('ARREJUNTAO_ANM', 'El Arrejuntao Animalitos', ['10:00 AM', '1:00 PM', '4:00 PM', '7:00 PM', '11:00 PM'], { maxNum: 36, dictKey: 'BASE_38', type: 'animalito' })
  ]
};

function getRemainingMinutesForLottery(lot, nowDate = new Date()) {
  if (!lot || typeof lot.drawHour24 !== 'number') return 999;
  const drawTotalMinutes = lot.drawHour24 * 60 + (lot.drawMinute || 0);
  const currentTotalMinutes = nowDate.getHours() * 60 + nowDate.getMinutes();
  return drawTotalMinutes - currentTotalMinutes;
}

function isLotteryOpenForSale(lot, nowDate = new Date(), showAllWeekDays = false) {
  if (!lot) return false;
  const currentDay = nowDate.getDay();
  if (!showAllWeekDays && Array.isArray(lot.daysOfWeek) && !lot.daysOfWeek.includes(currentDay)) {
    return false;
  }
  if (showAllWeekDays && Array.isArray(lot.daysOfWeek) && !lot.daysOfWeek.includes(currentDay)) {
    return true;
  }
  const remainingMinutes = getRemainingMinutesForLottery(lot, nowDate);
  if (remainingMinutes <= 5) {
    return false;
  }
  return true;
}

function findLotteryById(lotteryId) {
  for (const cat of Object.keys(LOTTERY_CATALOGS)) {
    const found = (LOTTERY_CATALOGS[cat] || []).find(l => l.id === lotteryId);
    if (found) return found;
  }
  return null;
}

const ANIMALITOS_DEFAULT_HOURS = HOURS_8AM_TO_7PM_00;

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    ZODIAC_SIGNS,
    BASE_38,
    GUACHARITO_101,
    MEGA_ANIMAL_42,
    GATAZO_76,
    GUACHARO_77,
    CONDOR_77,
    GRANJAZO_78,
    FRUTA_GANA_38,
    OPERATOR_DICTIONARIES,
    ANIMALITOS_DICT,
    FRUTAS_DICT,
    LOTTERY_CATALOGS,
    ANIMALITOS_DEFAULT_HOURS,
    normalizeAnimalCode,
    getOperatorConfigForLottery,
    validateAndResolveAnimalForLottery,
    getAnimalOrFruitInfo,
    getRemainingMinutesForLottery,
    isLotteryOpenForSale,
    findLotteryById
  };
}

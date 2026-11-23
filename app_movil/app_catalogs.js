// app_movil/app_catalogs.js - Catálogo Independiente con Diccionarios Dinámicos por Operadora
// App Móvil & Tablet "Banca El Castaño (Seguro Te Paga)"

const APP_ZODIAC_SIGNS = [
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

// A. Base Clásica 38 Animalitos (0, 00 al 36)
const APP_BASE_38 = {
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
const APP_GUACHARITO_101 = {
  ...APP_BASE_38,
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

function _appRangeDict(sourceDict, maxNum, overrides = {}) {
  const out = { "0": sourceDict["0"], "00": sourceDict["00"] };
  for (let i = 1; i <= maxNum; i++) {
    const k = String(i).padStart(2, '0');
    if (sourceDict[k]) out[k] = sourceDict[k];
  }
  return { ...out, ...overrides };
}

const APP_MEGA_ANIMAL_42 = _appRangeDict(APP_GUACHARITO_101, 40);
const APP_GATAZO_76 = _appRangeDict(APP_GUACHARITO_101, 74, { "11": "GATAZO", "61": "COLIBRÍ" });
const APP_GUACHARO_77 = _appRangeDict(APP_GUACHARITO_101, 75, { "61": "PANDA", "75": "GUÁCHARO" });
const APP_CONDOR_77 = _appRangeDict(APP_GUACHARITO_101, 75, { "75": "CÓNDOR" });

const APP_GRANJAZO_78 = {
  ...APP_BASE_38,
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

const APP_FRUTA_GANA_38 = {
  "0": "GUANÁBANA", "00": "NÍSPERO", "01": "CIRUELA", "02": "GUAYABA", "03": "TAMARINDO",
  "04": "PISTACHO", "05": "MELÓN", "06": "MAMÓN", "07": "PATILLA", "08": "LIMÓN",
  "09": "KIWI / FRESA", "10": "MANZANA", "11": "PARCHITA", "12": "MANGO", "13": "CAMBUR",
  "14": "PIÑA", "15": "ZAPOTE", "16": "PERA", "17": "MELOCOTÓN", "18": "AGUACATE",
  "19": "GRANADA", "20": "TORONJA", "21": "UVA", "22": "AVELLANA", "23": "DURAZNO",
  "24": "PLÁTANO", "25": "MAÍZ", "26": "MORA", "27": "FRAMBUESA", "28": "COCO",
  "29": "NARANJA", "30": "MANDARINA", "31": "LECHOSA", "32": "NUEZ", "33": "POMARROSA",
  "34": "HIGO", "35": "CEREZA", "36": "KIWI"
};

const APP_OPERATOR_DICTIONARIES = {
  BASE_38: { key: 'BASE_38', label: 'Clásico 38 Animalitos (0, 00 al 36)', maxNum: 36, dict: APP_BASE_38 },
  MEGA_ANIMAL_42: { key: 'MEGA_ANIMAL_42', label: 'Mega Animal 40 (0, 00 al 40)', maxNum: 40, dict: APP_MEGA_ANIMAL_42 },
  GATAZO_76: { key: 'GATAZO_76', label: 'El Gatazo (0, 00 al 74)', maxNum: 74, dict: APP_GATAZO_76 },
  GUACHARO_77: { key: 'GUACHARO_77', label: 'Guácharo Activo (0, 00 al 75)', maxNum: 75, dict: APP_GUACHARO_77 },
  CONDOR_77: { key: 'CONDOR_77', label: 'Cóndor Gana (0, 00 al 75)', maxNum: 75, dict: APP_CONDOR_77 },
  GRANJAZO_78: { key: 'GRANJAZO_78', label: 'GM El Granjazo (0, 00 al 76)', maxNum: 76, dict: APP_GRANJAZO_78 },
  GUACHARITO_101: { key: 'GUACHARITO_101', label: 'Guacharito Millonario (0, 00 al 99)', maxNum: 99, dict: APP_GUACHARITO_101 },
  SELVA_PLUS_101: { key: 'SELVA_PLUS_101', label: 'Selva Plus (0, 00 al 99)', maxNum: 99, dict: APP_GUACHARITO_101 },
  FRUTA_GANA_38: { key: 'FRUTA_GANA_38', label: 'Fruta Gana (0, 00 al 36)', maxNum: 36, dict: APP_FRUTA_GANA_38, isFruta: true }
};

const APP_FIGURE_EMOJIS = {
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

function appGetEmojiForFigure(nameStr, isFruta = false) {
  const upper = String(nameStr || '').toUpperCase().trim();
  return APP_FIGURE_EMOJIS[upper] || (isFruta ? '🍉' : '🐾');
}

function appGetOperatorConfig(lotteryIdOrName = '') {
  const raw = String(lotteryIdOrName || '').toUpperCase();
  if (raw.includes('FRUTA_GANA') || raw.includes('FRUTA GANA') || raw.includes('FRUTA')) {
    return APP_OPERATOR_DICTIONARIES.FRUTA_GANA_38;
  }
  if (raw.includes('GUACHARITO')) return APP_OPERATOR_DICTIONARIES.GUACHARITO_101;
  if (raw.includes('SELVA_PLUS') || raw.includes('SELVA PLUS')) return APP_OPERATOR_DICTIONARIES.SELVA_PLUS_101;
  if (raw.includes('GRANJAZO')) return APP_OPERATOR_DICTIONARIES.GRANJAZO_78;
  if (raw.includes('GUACHARO_ACTIVO') || raw.includes('GUÁCHARO ACTIVO')) return APP_OPERATOR_DICTIONARIES.GUACHARO_77;
  if (raw.includes('CONDOR_GANA') || raw.includes('CÓNDOR GANA')) return APP_OPERATOR_DICTIONARIES.CONDOR_77;
  if (raw.includes('GATAZO')) return APP_OPERATOR_DICTIONARIES.GATAZO_76;
  if (raw.includes('MEGA_ANIMAL') || raw.includes('MEGA ANIMAL')) return APP_OPERATOR_DICTIONARIES.BASE_38;
  return APP_OPERATOR_DICTIONARIES.BASE_38;
}

function appNormalizeAnimalCode(numberStr) {
  const clean = String(numberStr ?? '').trim();
  if (!clean) return '';
  if (clean === '0' || clean === '00') return clean;
  const n = parseInt(clean, 10);
  if (isNaN(n) || n < 0) return clean;
  return n < 10 ? `0${n}` : String(n);
}

function appValidateAndResolveAnimal(numberStr, lotteryIdOrName = '') {
  const opCfg = appGetOperatorConfig(lotteryIdOrName);
  const code = appNormalizeAnimalCode(numberStr);
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
    emoji: appGetEmojiForFigure(figName, Boolean(opCfg.isFruta)),
    maxNum: opCfg.maxNum,
    operatorLabel: opCfg.label
  };
}

function appGetAnimalOrFruitInfo(numberStr, lotteryIdOrName = '') {
  const res = appValidateAndResolveAnimal(numberStr, lotteryIdOrName);
  if (res.valid) {
    return { name: res.name, emoji: res.emoji, code: res.code, maxNum: res.maxNum, valid: true };
  }
  const opCfg = appGetOperatorConfig(lotteryIdOrName);
  return {
    name: 'FUERA DE RANGO',
    emoji: '⛔',
    code: appNormalizeAnimalCode(numberStr),
    maxNum: opCfg.maxNum,
    valid: false
  };
}

const APP_ANIMALITOS_DICT = {};
Object.entries(APP_GUACHARITO_101).forEach(([k, v]) => {
  APP_ANIMALITOS_DICT[k] = { name: v, emoji: appGetEmojiForFigure(v, false) };
});

const APP_FRUTAS_DICT = {};
Object.entries(APP_FRUTA_GANA_38).forEach(([k, v]) => {
  APP_FRUTAS_DICT[k] = { name: v, emoji: appGetEmojiForFigure(v, true) };
});

function _appParse12HourTime(time12Str) {
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

function _appGenHours(startH24, endH24, minVal = 0) {
  const list = [];
  const mm = String(minVal).padStart(2, '0');
  for (let h = startH24; h <= endH24; h++) {
    const period = h >= 12 ? 'PM' : 'AM';
    const h12 = h === 0 ? 12 : (h > 12 ? h - 12 : h);
    list.push(`${h12}:${mm} ${period}`);
  }
  return list;
}

function _appBuildDraws(prefixId, baseName, times12Array, extraProps = {}) {
  return times12Array.map(t12 => {
    const parsed = _appParse12HourTime(t12);
    const timeCode = `${String(parsed.hour24).padStart(2, '0')}${String(parsed.minute).padStart(2, '0')}`;
    return {
      id: `${prefixId}_${timeCode}`,
      baseName,
      name: `${baseName} ${parsed.formatted12}`,
      time: parsed.formatted12,
      time12: parsed.formatted12,
      drawHour24: parsed.hour24,
      drawMinute: parsed.minute,
      ...extraProps
    };
  });
}

function _appSingleDraw(id, baseName, time12, extraProps = {}) {
  const parsed = _appParse12HourTime(time12);
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

const _APP_H8_19_00 = _appGenHours(8, 19, 0);
const _APP_H9_19_00 = _appGenHours(9, 19, 0);
const _APP_H9_20_00 = _appGenHours(9, 20, 0);
const _APP_H9_21_00 = _appGenHours(9, 21, 0);
const _APP_H9_18_00 = _appGenHours(9, 18, 0);
const _APP_H8_19_05 = _appGenHours(8, 19, 5);
const _APP_H9_19_10 = _appGenHours(9, 19, 10);
const _APP_H8_20_15 = _appGenHours(8, 20, 15);
const _APP_H9_18_15 = _appGenHours(9, 18, 15);
const _APP_H8_19_30 = _appGenHours(8, 19, 30);
const _APP_H8_20_30 = _appGenHours(8, 20, 30);
const _APP_H9_20_30 = _appGenHours(9, 20, 30);
const _APP_H9_18_30 = _appGenHours(9, 18, 30);
const _APP_H9_19_40 = _appGenHours(9, 19, 40);

const APP_LOTTERY_CATALOGS = {
  sin_signo: [
    ..._appBuildDraws('CHANCE_A', 'Chance A', _APP_H9_19_00, { type: 'triple' }),
    ..._appBuildDraws('CHANCE_B', 'Chance B', _APP_H9_19_00, { type: 'triple' }),
    ..._appBuildDraws('TACHIRA_A', 'Táchira A', ['1:15 PM', '4:45 PM', '10:10 PM'], { type: 'triple' }),
    ..._appBuildDraws('TACHIRA_B', 'Táchira B', ['1:15 PM', '4:45 PM', '10:10 PM'], { type: 'triple' }),
    ..._appBuildDraws('ZULIA_A', 'Zulia A', ['12:45 PM', '4:45 PM', '7:05 PM'], { type: 'triple' }),
    ..._appBuildDraws('ZULIA_B', 'Zulia B', ['12:45 PM', '4:45 PM', '7:05 PM'], { type: 'triple' }),
    ..._appBuildDraws('CALIENTE_A', 'Caliente A', ['1:00 PM', '4:30 PM', '7:10 PM'], { type: 'triple' }),
    ..._appBuildDraws('CALIENTE_B', 'Caliente B', ['1:00 PM', '4:30 PM', '7:10 PM'], { type: 'triple' }),
    ..._appBuildDraws('TRIPLE_LAGO_A', 'Triple Lago A', ['1:00 PM', '4:30 PM', '10:15 PM'], { type: 'triple' }),
    ..._appBuildDraws('TRIPLE_LAGO_B', 'Triple Lago B', ['1:00 PM', '4:30 PM', '10:15 PM'], { type: 'triple' }),
    ..._appBuildDraws('TRIPLE_GATO_A', 'Triple Gato A', ['12:45 PM', '4:45 PM', '5:00 PM', '7:45 PM'], { type: 'triple' }),
    ..._appBuildDraws('TRIPLE_GATO_B', 'Triple Gato B', ['12:45 PM', '4:45 PM', '5:00 PM', '7:45 PM'], { type: 'triple' }),
    ..._appBuildDraws('ARREJUNTAO_A', 'Arrejuntao A', ['10:00 AM', '1:00 PM', '4:00 PM', '7:00 PM', '11:00 PM'], { type: 'triple' }),
    ..._appBuildDraws('ARREJUNTAO_B', 'Arrejuntao B', ['10:00 AM', '1:00 PM', '4:00 PM', '7:00 PM', '11:00 PM'], { type: 'triple' }),
    ..._appBuildDraws('TRIPLE_ZAMORANO', 'Triple Zamorano', ['10:00 AM', '12:00 PM', '2:00 PM', '4:00 PM', '7:00 PM'], { type: 'triple' }),
    ..._appBuildDraws('LA_RICACHONA', 'La Ricachona', _APP_H8_19_05, { type: 'triple' }),
    ..._appBuildDraws('TRIPLE_FACIL', 'Triple Fácil', _APP_H8_19_00, { type: 'triple' }),
    ..._appBuildDraws('TRIO_ACTIVO', 'Trío Activo', _APP_H8_19_00, { type: 'triple' }),
    ..._appBuildDraws('TRIPLE_POPULAR', 'Triple Popular', _APP_H9_21_00, { type: 'triple' }),
    ..._appBuildDraws('TRIPLE_DORADO', 'Triple Dorado', ['9:00 AM', '10:00 AM', '11:00 AM', '1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM', '5:00 PM', '6:00 PM'], { type: 'triple' }),
    ..._appBuildDraws('TRIPLE_FORTUNA', 'Triple Fortuna', _appGenHours(10, 19, 0), { type: 'triple' }),
    ..._appBuildDraws('NAPA_GANA', 'Ñapa Gana', ['9:00 AM', '10:30 AM', '11:30 AM', '12:00 PM', '1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM', '5:00 PM', '6:00 PM', '7:00 PM'], { type: 'terminal' }),
    ..._appBuildDraws('CARACAS_A', 'Caracas A', ['1:00 PM', '4:30 PM', '7:00 PM'], { type: 'triple' }),
    ..._appBuildDraws('CARACAS_B', 'Caracas B', ['1:00 PM', '4:30 PM', '7:00 PM'], { type: 'triple' })
  ],
  con_signo: [
    ..._appBuildDraws('CHANCE_ASTRAL', 'Chance Astral', _APP_H9_19_00, { type: 'zodiac' }),
    ..._appBuildDraws('TACHIRA_ZODIACAL', 'Táchira Zodiacal', ['1:15 PM', '4:45 PM', '10:10 PM'], { type: 'zodiac' }),
    ..._appBuildDraws('ZODIACO_ZULIA', 'Zodiaco del Zulia', ['12:45 PM', '4:45 PM', '7:05 PM'], { type: 'zodiac' }),
    ..._appBuildDraws('SIGNO_CALIENTE', 'Signo Caliente', ['1:00 PM', '4:30 PM', '7:10 PM'], { type: 'zodiac' }),
    ..._appBuildDraws('ASTRO_ZAMORANO', 'Astro Zamorano', ['10:00 AM', '12:00 PM', '2:00 PM', '4:00 PM', '7:00 PM'], { type: 'zodiac' }),
    ..._appBuildDraws('LAGO_ZODIACAL', 'Lago Zodiacal', ['1:00 PM', '4:30 PM', '10:15 PM'], { type: 'zodiac' }),
    ..._appBuildDraws('TRIPLE_GANA_SIGNO', 'Triple Gana Signo', ['1:00 PM', '4:00 PM', '10:00 PM'], { type: 'zodiac' }),
    ..._appBuildDraws('SUPER_GANA', 'Super Gana', ['1:00 PM', '4:00 PM', '10:00 PM'], { type: 'astro' }),
    ..._appBuildDraws('TRIPLE_GATO_ZOD', 'Triple Gato Zodiacal', ['12:45 PM', '4:45 PM', '5:00 PM', '7:45 PM'], { type: 'zodiac' }),
    ..._appBuildDraws('ARREJUNTAO_SIGNO', 'Arrejuntao Signo', ['10:00 AM', '1:00 PM', '4:00 PM', '7:00 PM', '11:00 PM'], { type: 'zodiac' }),
    ..._appBuildDraws('TRIPLETAZO', 'Tripletazo', ['1:00 PM', '4:30 PM', '7:00 PM'], { type: 'zodiac' }),
    _appSingleDraw('ASTRO_SOL_1430', 'Super Astro Sol', '2:30 PM', { type: 'astro', country: 'COL', daysOfWeek: [1, 2, 3, 4, 5, 6] }),
    _appSingleDraw('ASTRO_LUNA_2230', 'Super Astro Luna', '10:30 PM', { type: 'astro', country: 'COL', daysOfWeek: [0, 1, 2, 3, 4, 5, 6] })
  ],
  cuatro_cifras: [
    _appSingleDraw('CUNDINAMARCA', 'Lotería de Cundinamarca', '10:30 PM', { has5ta: false, daysOfWeek: [1], dayLabel: 'Lunes' }),
    _appSingleDraw('TOLIMA', 'Lotería del Tolima', '10:30 PM', { has5ta: false, daysOfWeek: [1], dayLabel: 'Lunes' }),
    _appSingleDraw('CRUZ_ROJA', 'Lotería de la Cruz Roja', '10:55 PM', { has5ta: false, daysOfWeek: [2], dayLabel: 'Martes' }),
    _appSingleDraw('HUILA', 'Lotería del Huila', '10:30 PM', { has5ta: false, daysOfWeek: [2], dayLabel: 'Martes' }),
    _appSingleDraw('MANIZALES', 'Lotería de Manizales', '10:30 PM', { has5ta: false, daysOfWeek: [3], dayLabel: 'Miércoles' }),
    _appSingleDraw('META', 'Lotería del Meta', '10:30 PM', { has5ta: false, daysOfWeek: [3], dayLabel: 'Miércoles' }),
    _appSingleDraw('VALLE', 'Lotería del Valle', '10:30 PM', { has5ta: false, daysOfWeek: [3], dayLabel: 'Miércoles' }),
    _appSingleDraw('BOGOTA', 'Lotería de Bogotá', '11:15 PM', { has5ta: false, daysOfWeek: [4], dayLabel: 'Jueves' }),
    _appSingleDraw('QUINDIO', 'Lotería del Quindío', '10:30 PM', { has5ta: false, daysOfWeek: [4], dayLabel: 'Jueves' }),
    _appSingleDraw('MEDELLIN', 'Lotería de Medellín', '11:00 PM', { has5ta: false, daysOfWeek: [5], dayLabel: 'Viernes' }),
    _appSingleDraw('SANTANDER', 'Lotería de Santander', '11:00 PM', { has5ta: false, daysOfWeek: [5], dayLabel: 'Viernes' }),
    _appSingleDraw('RISARALDA', 'Lotería de Risaralda', '11:00 PM', { has5ta: false, daysOfWeek: [5], dayLabel: 'Viernes' }),
    _appSingleDraw('BOYACA', 'Lotería de Boyacá', '10:40 PM', { has5ta: false, daysOfWeek: [6], dayLabel: 'Sábado' }),
    _appSingleDraw('CAUCA', 'Lotería del Cauca', '10:40 PM', { has5ta: false, daysOfWeek: [6], dayLabel: 'Sábado' }),
    _appSingleDraw('DORADO_MANANA', 'Dorado Mañana', '10:55 AM', { has5ta: true, daysOfWeek: [1, 2, 3, 4, 5, 6] }),
    _appSingleDraw('DORADO_TARDE', 'Dorado Tarde', '3:30 PM', { has5ta: true, daysOfWeek: [1, 2, 3, 4, 5, 6] }),
    _appSingleDraw('DORADO_NOCHE', 'Dorado Noche', '10:05 PM', { has5ta: true, daysOfWeek: [0, 1, 2, 3, 4, 5, 6] }),
    _appSingleDraw('SINUANO_DIA_LV', 'Sinuano Día', '2:30 PM', { has5ta: true, daysOfWeek: [1, 2, 3, 4, 5, 6] }),
    _appSingleDraw('SINUANO_DIA_DOM', 'Sinuano Día (Dom)', '1:00 PM', { has5ta: true, daysOfWeek: [0] }),
    _appSingleDraw('SINUANO_NOCHE_LV', 'Sinuano Noche', '10:30 PM', { has5ta: true, daysOfWeek: [1, 2, 3, 4, 5, 6] }),
    _appSingleDraw('SINUANO_NOCHE_DOM', 'Sinuano Noche (Dom)', '8:30 PM', { has5ta: true, daysOfWeek: [0] }),
    _appSingleDraw('ANTIOQUENITA_DIA', 'Antioqueñita Día', '10:00 AM', { has5ta: true }),
    _appSingleDraw('ANTIOQUENITA_TARDE', 'Antioqueñita Tarde', '4:00 PM', { has5ta: true }),
    _appSingleDraw('CAFETERITO_TARDE', 'Cafeterito Tarde', '12:00 PM', { has5ta: true }),
    _appSingleDraw('CAFETERITO_NOCHE', 'Cafeterito Noche', '10:00 PM', { has5ta: true }),
    _appSingleDraw('PAISITA_DIA', 'Paisita Día', '1:00 PM', { has5ta: true }),
    _appSingleDraw('PAISITA_NOCHE', 'Paisita Noche', '6:00 PM', { has5ta: false }),
    _appSingleDraw('PAISITA_3', 'Paisita 3', '9:00 PM', { has5ta: false }),
    _appSingleDraw('CHONTICO_DIA', 'Chontico Día', '1:00 PM', { has5ta: true }),
    _appSingleDraw('CHONTICO_NOCHE', 'Chontico Noche', '7:00 PM', { has5ta: true }),
    _appSingleDraw('SAMAN_DIA', 'Samán Día', '1:00 PM', { has5ta: false }),
    _appSingleDraw('FANTASTICA_DIA', 'Fantástica Día', '1:00 PM', { has5ta: true }),
    _appSingleDraw('FANTASTICA_NOCHE', 'Fantástica Noche', '8:30 PM', { has5ta: true }),
    _appSingleDraw('CASH_THREE_DIA', 'Cash Three Día', '1:00 PM', { has5ta: false }),
    _appSingleDraw('CASH_THREE_NOCHE', 'Cash Three Noche', '10:00 PM', { has5ta: false }),
    _appSingleDraw('PLAY_FOUR_DIA', 'Play Four Día', '1:00 PM', { has5ta: false }),
    _appSingleDraw('PLAY_FOUR_NOCHE', 'Play Four Noche', '10:00 PM', { has5ta: false }),
    _appSingleDraw('PIJAO_ORO', 'Pijao de Oro', '2:00 PM', { has5ta: true }),
    _appSingleDraw('CARIBENA_DIA', 'Caribeña Día', '2:30 PM', { has5ta: true }),
    _appSingleDraw('CARIBENA_NOCHE', 'Caribeña Noche', '10:30 PM', { has5ta: true }),
    _appSingleDraw('CULONA_DIA', 'Culona Día', '2:30 PM', { has5ta: false }),
    _appSingleDraw('CULONA_NOCHE', 'Culona Noche', '9:30 PM', { has5ta: false }),
    _appSingleDraw('MOTILON_TARDE', 'Motilón Tarde', '3:00 PM', { has5ta: true }),
    _appSingleDraw('MOTILON_NOCHE', 'Motilón Noche', '9:00 PM', { has5ta: true }),
    ..._appBuildDraws('EL_ARRIMAO', 'El Arrimao', ['10:00 AM', '1:00 PM', '4:00 PM', '7:00 PM', '11:00 PM'], { has5ta: false }),
    ..._appBuildDraws('EL_PEGADITO', 'El Pegadito', ['10:00 AM', '1:00 PM', '4:00 PM', '7:00 PM', '11:00 PM'], { has5ta: false })
  ],
  animalitos: [
    ..._appBuildDraws('LOTTO_ACTIVO', 'Lotto Activo', _APP_H8_19_00, { maxNum: 36, dictKey: 'BASE_38', type: 'animalito' }),
    ..._appBuildDraws('LA_GRANJITA', 'La Granjita', _APP_H8_19_00, { maxNum: 36, dictKey: 'BASE_38', type: 'animalito' }),
    ..._appBuildDraws('GUACHARO_ACTIVO', 'Guácharo Activo', _APP_H8_19_00, { maxNum: 75, dictKey: 'GUACHARO_77', type: 'animalito' }),
    ..._appBuildDraws('CONDOR_GANA', 'Cóndor Gana', _APP_H9_19_00, { maxNum: 75, dictKey: 'CONDOR_77', type: 'animalito' }),
    ..._appBuildDraws('LOTO_CHAIMA', 'Loto Chaima', _APP_H8_19_00, { maxNum: 36, dictKey: 'BASE_38', type: 'animalito' }),
    ..._appBuildDraws('FRUTA_GANA', 'Fruta Gana', _APP_H9_19_00, { maxNum: 36, dictKey: 'FRUTA_GANA_38', type: 'animalito', isFruta: true }),
    ..._appBuildDraws('GRANJA_MILLONARIA', 'Granja Millonaria', _APP_H9_20_00, { maxNum: 36, dictKey: 'BASE_38', type: 'animalito' }),
    ..._appBuildDraws('FIERAS_ORIENTE', 'Animalitos del Oriente - Fieras', _APP_H9_18_00, { maxNum: 36, dictKey: 'BASE_38', type: 'animalito' }),
    ..._appBuildDraws('CHANCE_ANIMALITOS', 'Chance con Animalitos', _APP_H9_19_00, { maxNum: 36, dictKey: 'BASE_38', type: 'animalito' }),
    ..._appBuildDraws('CHANCE_ANIMALITOS_B', 'Chance con Animalitos B', _APP_H9_19_00, { maxNum: 36, dictKey: 'BASE_38', type: 'animalito' }),
    ..._appBuildDraws('MEGA_ANIMAL_40', 'Mega Animal 40', _APP_H9_20_00, { maxNum: 36, dictKey: 'BASE_38', type: 'animalito' }),
    ..._appBuildDraws('TROPI_GANA', 'Tropi Gana', _APP_H9_19_00, { maxNum: 36, dictKey: 'BASE_38', type: 'animalito' }),
    ..._appBuildDraws('TRIPLE_POPULAR_ANM', 'Triple Popular Animalitos', _APP_H9_21_00, { maxNum: 36, dictKey: 'BASE_38', type: 'animalito' }),
    ..._appBuildDraws('MONJE_MILLONARIO', 'Monje Millonario', _APP_H8_19_05, { maxNum: 36, dictKey: 'BASE_38', type: 'animalito' }),
    ..._appBuildDraws('LA_RICACHONA_ANM', 'La Ricachona Animalitos', _APP_H8_19_05, { maxNum: 36, dictKey: 'BASE_38', type: 'animalito' }),
    ..._appBuildDraws('LOTTO_GATO', 'Lotto Gato', _APP_H9_19_10, { maxNum: 36, dictKey: 'BASE_38', type: 'animalito' }),
    ..._appBuildDraws('SELVA_PLUS', 'Selva Plus', _APP_H8_20_15, { maxNum: 99, dictKey: 'SELVA_PLUS_101', type: 'animalito' }),
    ..._appBuildDraws('BICHITOS_ORIENTE', 'Animalitos del Oriente - Bichitos', _APP_H9_18_15, { maxNum: 36, dictKey: 'BASE_38', type: 'animalito' }),
    ..._appBuildDraws('GUACHARITO_MILL', 'El Guacharito Millonario', _APP_H8_19_30, { maxNum: 99, dictKey: 'GUACHARITO_101', type: 'animalito' }),
    ..._appBuildDraws('LOTTO_ACTIVO_RD', 'Lotto Activo RD', _APP_H8_19_30, { maxNum: 36, dictKey: 'BASE_38', type: 'animalito' }),
    ..._appBuildDraws('RULETA_ROYAL', 'Ruleta Royal', _APP_H8_20_30, { maxNum: 36, dictKey: 'BASE_38', type: 'animalito' }),
    ..._appBuildDraws('GRANJAZO', 'GM El Granjazo', _APP_H9_20_30, { maxNum: 76, dictKey: 'GRANJAZO_78', type: 'animalito' }),
    ..._appBuildDraws('MASCOTAS_ORIENTE', 'Animalitos del Oriente - Mascotas', _APP_H9_18_30, { maxNum: 36, dictKey: 'BASE_38', type: 'animalito' }),
    ..._appBuildDraws('GATAZO', 'El Gatazo', _APP_H9_19_40, { maxNum: 74, dictKey: 'GATAZO_76', type: 'animalito' }),
    ..._appBuildDraws('ARREJUNTAO_ANM', 'El Arrejuntao Animalitos', ['10:00 AM', '1:00 PM', '4:00 PM', '7:00 PM', '11:00 PM'], { maxNum: 36, dictKey: 'BASE_38', type: 'animalito' })
  ]
};

function _appResolveTimeParts(nowInput) {
  if (nowInput && typeof nowInput.hour24 === 'number' && typeof nowInput.minute === 'number') {
    return {
      dayOfWeek: typeof nowInput.dayOfWeek === 'number' ? nowInput.dayOfWeek : 0,
      hour24: nowInput.hour24,
      minute: nowInput.minute
    };
  }
  if (typeof window !== 'undefined' && window.appCloud && typeof window.appCloud.getOfficialParts === 'function') {
    if (nowInput instanceof Date) {
      const p = window.appCloud.getOfficialParts(nowInput.getTime());
      return { dayOfWeek: p.dayOfWeek, hour24: p.hour24, minute: p.minute };
    }
    const off = window.appCloud.getOfficialNow();
    return { dayOfWeek: off.dayOfWeek, hour24: off.hour24, minute: off.minute };
  }
  const d = nowInput instanceof Date ? nowInput : new Date();
  return { dayOfWeek: d.getDay(), hour24: d.getHours(), minute: d.getMinutes() };
}

function appGetRemainingMinutes(lot, nowDate = null) {
  if (!lot || typeof lot.drawHour24 !== 'number') return 999;
  const p = _appResolveTimeParts(nowDate);
  const drawTotalMinutes = lot.drawHour24 * 60 + (lot.drawMinute || 0);
  const currentTotalMinutes = p.hour24 * 60 + p.minute;
  return drawTotalMinutes - currentTotalMinutes;
}

function appIsLotteryOpen(lot, nowDate = null, showAllWeekDays = false) {
  if (!lot) return false;
  const p = _appResolveTimeParts(nowDate);
  const currentDay = p.dayOfWeek;
  if (!showAllWeekDays && Array.isArray(lot.daysOfWeek) && !lot.daysOfWeek.includes(currentDay)) {
    return false;
  }
  if (showAllWeekDays && Array.isArray(lot.daysOfWeek) && !lot.daysOfWeek.includes(currentDay)) {
    return true;
  }
  return appGetRemainingMinutes(lot, nowDate) > 5;
}

function appFindLotteryById(lotteryId) {
  for (const cat of Object.keys(APP_LOTTERY_CATALOGS)) {
    const found = (APP_LOTTERY_CATALOGS[cat] || []).find(l => l.id === lotteryId);
    if (found) return found;
  }
  return null;
}

// js/catalogs.js - Parrilla Exacta de Sorteos (Venezuela y Colombia) en Formato 12h AM/PM
// Con Cierre y Eliminación Automática 5 Minutos Antes del Sorteo (-5 min)
// Sistema "Banca FC - Fernando Castaño (Seguro Te Paga)"

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

// Diccionario Oficial de Animalitos (0, 00 al 40)
const ANIMALITOS_DICT = {
  '0': { name: 'Delfín', emoji: '🐬' },
  '00': { name: 'Ballena', emoji: '🐋' },
  '01': { name: 'Carnero', emoji: '🐏' },
  '1': { name: 'Carnero', emoji: '🐏' },
  '02': { name: 'Toro', emoji: '🐂' },
  '2': { name: 'Toro', emoji: '🐂' },
  '03': { name: 'Ciempiés', emoji: '🐛' },
  '3': { name: 'Ciempiés', emoji: '🐛' },
  '04': { name: 'Alacrán', emoji: '🦂' },
  '4': { name: 'Alacrán', emoji: '🦂' },
  '05': { name: 'León', emoji: '🦁' },
  '5': { name: 'León', emoji: '🦁' },
  '06': { name: 'Rana', emoji: '🐸' },
  '6': { name: 'Rana', emoji: '🐸' },
  '07': { name: 'Perico', emoji: '🦜' },
  '7': { name: 'Perico', emoji: '🦜' },
  '08': { name: 'Ratón', emoji: '🐭' },
  '8': { name: 'Ratón', emoji: '🐭' },
  '09': { name: 'Águila', emoji: '🦅' },
  '9': { name: 'Águila', emoji: '🦅' },
  '10': { name: 'Tigre', emoji: '🐅' },
  '11': { name: 'Gato', emoji: '🐱' },
  '12': { name: 'Caballo', emoji: '🐎' },
  '13': { name: 'Mono', emoji: '🐒' },
  '14': { name: 'Paloma', emoji: '🕊️' },
  '15': { name: 'Zorro', emoji: '🦊' },
  '16': { name: 'Oso', emoji: '🐻' },
  '17': { name: 'Pavo', emoji: '🦃' },
  '18': { name: 'Burro', emoji: '🫏' },
  '19': { name: 'Chivo', emoji: '🐐' },
  '20': { name: 'Cochino', emoji: '🐖' },
  '21': { name: 'Gallo', emoji: '🐓' },
  '22': { name: 'Camello', emoji: '🐪' },
  '23': { name: 'Cebra', emoji: '🦓' },
  '24': { name: 'Iguana', emoji: '🦎' },
  '25': { name: 'Gallina', emoji: '🐔' },
  '26': { name: 'Vaca', emoji: '🐄' },
  '27': { name: 'Perro', emoji: '🐕' },
  '28': { name: 'Zamuro', emoji: '🦅' },
  '29': { name: 'Elefante', emoji: '🐘' },
  '30': { name: 'Caimán', emoji: '🐊' },
  '31': { name: 'Lapa', emoji: '🦔' },
  '32': { name: 'Ardilla', emoji: '🐿️' },
  '33': { name: 'Pescado', emoji: '🐟' },
  '34': { name: 'Venado', emoji: '🦌' },
  '35': { name: 'Jirafa', emoji: '🦒' },
  '36': { name: 'Culebra', emoji: '🐍' },
  '37': { name: 'Mariposa', emoji: '🦋' },
  '38': { name: 'Conejo', emoji: '🐰' },
  '39': { name: 'Culebra Real', emoji: '🐍' },
  '40': { name: 'Avispa', emoji: '🐝' }
};

// Diccionario Oficial de FRUTA GANA (0 y 00 al 36)
const FRUTAS_DICT = {
  '0': { name: 'Mango', emoji: '🥭' },
  '00': { name: 'Níspero', emoji: '🍑' },
  '01': { name: 'Mamón', emoji: '🍈' },
  '1': { name: 'Mamón', emoji: '🍈' },
  '02': { name: 'Guayaba', emoji: '🍐' },
  '2': { name: 'Guayaba', emoji: '🍐' },
  '03': { name: 'Melón', emoji: '🍈' },
  '3': { name: 'Melón', emoji: '🍈' },
  '04': { name: 'Pistacho', emoji: '🥜' },
  '4': { name: 'Pistacho', emoji: '🥜' },
  '05': { name: 'Mandarina', emoji: '🍊' },
  '5': { name: 'Mandarina', emoji: '🍊' },
  '06': { name: 'Durazno', emoji: '🍑' },
  '6': { name: 'Durazno', emoji: '🍑' },
  '07': { name: 'Patilla', emoji: '🍉' },
  '7': { name: 'Patilla', emoji: '🍉' },
  '08': { name: 'Limón', emoji: '🍋' },
  '8': { name: 'Limón', emoji: '🍋' },
  '09': { name: 'Fresa', emoji: '🍓' },
  '9': { name: 'Fresa', emoji: '🍓' },
  '10': { name: 'Uva', emoji: '🍇' },
  '11': { name: 'Parchita', emoji: '🍋' },
  '12': { name: 'Manzana', emoji: '🍎' },
  '13': { name: 'Cambur', emoji: '🍌' },
  '14': { name: 'Piña', emoji: '🍍' },
  '15': { name: 'Lechosa', emoji: '🍈' },
  '16': { name: 'Pera', emoji: '🍐' },
  '17': { name: 'Cereza', emoji: '🍒' },
  '18': { name: 'Aguacate', emoji: '🥑' },
  '19': { name: 'Mora', emoji: '🫐' },
  '20': { name: 'Toronja', emoji: '🍊' },
  '21': { name: 'Guanábana', emoji: '🍈' },
  '22': { name: 'Ciruela', emoji: '🍑' },
  '23': { name: 'Tomate', emoji: '🍅' },
  '24': { name: 'Higo', emoji: '🌰' },
  '25': { name: 'Maíz', emoji: '🌽' },
  '26': { name: 'Canela', emoji: '🪵' },
  '27': { name: 'Maní', emoji: '🥜' },
  '28': { name: 'Coco', emoji: '🥥' },
  '29': { name: 'Naranja', emoji: '🍊' },
  '30': { name: 'Tamarindo', emoji: '🫘' },
  '31': { name: 'Cotufa', emoji: '🍿' },
  '32': { name: 'Nuez', emoji: '🌰' },
  '33': { name: 'Garbanzo', emoji: '🫘' },
  '34': { name: 'Auyama', emoji: '🎃' },
  '35': { name: 'Cacao', emoji: '🍫' },
  '36': { name: 'Kiwi', emoji: '🥝' }
};

// Devuelve el animalito o fruta correspondiente según el sorteo
function getAnimalOrFruitInfo(numberStr, lotteryIdOrName = '') {
  const cleanNum = String(numberStr || '').trim();
  const isFruta = String(lotteryIdOrName || '').toUpperCase().includes('FRUTA');
  const dict = isFruta ? FRUTAS_DICT : ANIMALITOS_DICT;
  return dict[cleanNum] || (cleanNum.length === 1 ? dict['0' + cleanNum] : null) || {
    name: isFruta ? 'Fruta' : 'Animalito',
    emoji: isFruta ? '🍉' : '🐾'
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

// Genera una serie de sorteos individuales hora por hora
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

// Genera horas con minuto fijo entre startHour24 y endHour24 (inclusive)
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

// Horas comunes reutilizables
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

// Construye un ítem único con hora en formato 12h
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
  // --------------------------------------------------------------------------
  // 1. PESTAÑA 1: SIN SIGNO (TRIPLES Y TERMINALES VENEZUELA)
  // --------------------------------------------------------------------------
  sin_signo: [
    // 1. Chance (Chance A y Chance B): 9:00 AM a 7:00 PM
    ...buildHourlyDraws('CHANCE_A', 'Chance A', HOURS_9AM_TO_7PM_00, { type: 'triple' }),
    ...buildHourlyDraws('CHANCE_B', 'Chance B', HOURS_9AM_TO_7PM_00, { type: 'triple' }),

    // 2. Triple Táchira (Táchira A y Táchira B): 1:15 PM, 4:45 PM, 10:10 PM
    ...buildHourlyDraws('TACHIRA_A', 'Táchira A', ['1:15 PM', '4:45 PM', '10:10 PM'], { type: 'triple' }),
    ...buildHourlyDraws('TACHIRA_B', 'Táchira B', ['1:15 PM', '4:45 PM', '10:10 PM'], { type: 'triple' }),

    // 3. Triple Zulia (Zulia A y Zulia B): 12:45 PM, 4:45 PM, 7:05 PM
    ...buildHourlyDraws('ZULIA_A', 'Zulia A', ['12:45 PM', '4:45 PM', '7:05 PM'], { type: 'triple' }),
    ...buildHourlyDraws('ZULIA_B', 'Zulia B', ['12:45 PM', '4:45 PM', '7:05 PM'], { type: 'triple' }),

    // 4. Triple Caliente (Caliente A y Caliente B): 1:00 PM, 4:30 PM, 7:10 PM
    ...buildHourlyDraws('CALIENTE_A', 'Caliente A', ['1:00 PM', '4:30 PM', '7:10 PM'], { type: 'triple' }),
    ...buildHourlyDraws('CALIENTE_B', 'Caliente B', ['1:00 PM', '4:30 PM', '7:10 PM'], { type: 'triple' }),

    // 5. Triple Lago (Triple Lago A y Triple Lago B): 1:00 PM, 4:30 PM, 10:15 PM
    ...buildHourlyDraws('TRIPLE_LAGO_A', 'Triple Lago A', ['1:00 PM', '4:30 PM', '10:15 PM'], { type: 'triple' }),
    ...buildHourlyDraws('TRIPLE_LAGO_B', 'Triple Lago B', ['1:00 PM', '4:30 PM', '10:15 PM'], { type: 'triple' }),

    // 6. Triple Gato (Triple Gato A y Triple Gato B): 12:45 PM, 4:45 PM, 5:00 PM, 7:45 PM
    ...buildHourlyDraws('TRIPLE_GATO_A', 'Triple Gato A', ['12:45 PM', '4:45 PM', '5:00 PM', '7:45 PM'], { type: 'triple' }),
    ...buildHourlyDraws('TRIPLE_GATO_B', 'Triple Gato B', ['12:45 PM', '4:45 PM', '5:00 PM', '7:45 PM'], { type: 'triple' }),

    // 7. El Arrejuntao (Arrejuntao A y Arrejuntao B): 10:00 AM, 1:00 PM, 4:00 PM, 7:00 PM, 11:00 PM
    ...buildHourlyDraws('ARREJUNTAO_A', 'Arrejuntao A', ['10:00 AM', '1:00 PM', '4:00 PM', '7:00 PM', '11:00 PM'], { type: 'triple' }),
    ...buildHourlyDraws('ARREJUNTAO_B', 'Arrejuntao B', ['10:00 AM', '1:00 PM', '4:00 PM', '7:00 PM', '11:00 PM'], { type: 'triple' }),

    // 8. Triple Zamorano: 10:00 AM, 12:00 PM, 2:00 PM, 4:00 PM, 7:00 PM
    ...buildHourlyDraws('TRIPLE_ZAMORANO', 'Triple Zamorano', ['10:00 AM', '12:00 PM', '2:00 PM', '4:00 PM', '7:00 PM'], { type: 'triple' }),

    // 9. La Ricachona (Sorteos a los :05): 8:05 AM a 7:05 PM
    ...buildHourlyDraws('LA_RICACHONA', 'La Ricachona', HOURS_8AM_TO_7PM_05, { type: 'triple' }),

    // 10. Triple Fácil: 8:00 AM a 7:00 PM
    ...buildHourlyDraws('TRIPLE_FACIL', 'Triple Fácil', HOURS_8AM_TO_7PM_00, { type: 'triple' }),

    // 11. Trío Activo El Patronus: 8:00 AM a 7:00 PM
    ...buildHourlyDraws('TRIO_ACTIVO', 'Trío Activo', HOURS_8AM_TO_7PM_00, { type: 'triple' }),

    // 12. Triple Popular: 9:00 AM a 9:00 PM
    ...buildHourlyDraws('TRIPLE_POPULAR', 'Triple Popular', HOURS_9AM_TO_9PM_00, { type: 'triple' }),

    // 13. Triple Dorado Venezuela: 9:00 AM, 10:00 AM, 11:00 AM, 1:00 PM, 2:00 PM, 3:00 PM, 4:00 PM, 5:00 PM, 6:00 PM
    ...buildHourlyDraws('TRIPLE_DORADO', 'Triple Dorado', ['9:00 AM', '10:00 AM', '11:00 AM', '1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM', '5:00 PM', '6:00 PM'], { type: 'triple' }),

    // 14. Triple Fortuna: 10:00 AM a 7:00 PM
    ...buildHourlyDraws('TRIPLE_FORTUNA', 'Triple Fortuna', generateRangeHours12(10, 19, 0), { type: 'triple' }),

    // 15. Ñapa Gana (Terminal): 9:00 AM, 10:30 AM, 11:30 AM, 12:00 PM a 7:00 PM
    ...buildHourlyDraws('NAPA_GANA', 'Ñapa Gana', ['9:00 AM', '10:30 AM', '11:30 AM', '12:00 PM', '1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM', '5:00 PM', '6:00 PM', '7:00 PM'], { type: 'terminal' }),

    // 16. Triple Caracas (Caracas A y Caracas B): 1:00 PM, 4:30 PM, 7:00 PM
    ...buildHourlyDraws('CARACAS_A', 'Caracas A', ['1:00 PM', '4:30 PM', '7:00 PM'], { type: 'triple' }),
    ...buildHourlyDraws('CARACAS_B', 'Caracas B', ['1:00 PM', '4:30 PM', '7:00 PM'], { type: 'triple' })
  ],

  // --------------------------------------------------------------------------
  // 2. PESTAÑA 2: CON SIGNO (ZODIACALES VENEZUELA Y ASTROS COLOMBIA)
  // --------------------------------------------------------------------------
  con_signo: [
    // 1. Chance Astral: 9:00 AM a 7:00 PM
    ...buildHourlyDraws('CHANCE_ASTRAL', 'Chance Astral', HOURS_9AM_TO_7PM_00, { type: 'zodiac' }),

    // 2. Táchira Zodiacal: 1:15 PM, 4:45 PM, 10:10 PM
    ...buildHourlyDraws('TACHIRA_ZODIACAL', 'Táchira Zodiacal', ['1:15 PM', '4:45 PM', '10:10 PM'], { type: 'zodiac' }),

    // 3. Zodiaco del Zulia: 12:45 PM, 4:45 PM, 7:05 PM
    ...buildHourlyDraws('ZODIACO_ZULIA', 'Zodiaco del Zulia', ['12:45 PM', '4:45 PM', '7:05 PM'], { type: 'zodiac' }),

    // 4. Signo Caliente: 1:00 PM, 4:30 PM, 7:10 PM
    ...buildHourlyDraws('SIGNO_CALIENTE', 'Signo Caliente', ['1:00 PM', '4:30 PM', '7:10 PM'], { type: 'zodiac' }),

    // 5. Astro Zamorano: 10:00 AM, 12:00 PM, 2:00 PM, 4:00 PM, 7:00 PM
    ...buildHourlyDraws('ASTRO_ZAMORANO', 'Astro Zamorano', ['10:00 AM', '12:00 PM', '2:00 PM', '4:00 PM', '7:00 PM'], { type: 'zodiac' }),

    // 6. Lago Zodiacal: 1:00 PM, 4:30 PM, 10:15 PM
    ...buildHourlyDraws('LAGO_ZODIACAL', 'Lago Zodiacal', ['1:00 PM', '4:30 PM', '10:15 PM'], { type: 'zodiac' }),

    // 7. Triple Gana Signo: 1:00 PM, 4:00 PM, 10:00 PM
    ...buildHourlyDraws('TRIPLE_GANA_SIGNO', 'Triple Gana Signo', ['1:00 PM', '4:00 PM', '10:00 PM'], { type: 'zodiac' }),

    // 8. Super Gana (4 Cifras + Signo): 1:00 PM, 4:00 PM, 10:00 PM
    ...buildHourlyDraws('SUPER_GANA', 'Super Gana', ['1:00 PM', '4:00 PM', '10:00 PM'], { type: 'astro' }),

    // 9. Triple Gato Zodiacal: 12:45 PM, 4:45 PM, 5:00 PM, 7:45 PM
    ...buildHourlyDraws('TRIPLE_GATO_ZOD', 'Triple Gato Zodiacal', ['12:45 PM', '4:45 PM', '5:00 PM', '7:45 PM'], { type: 'zodiac' }),

    // 10. Arrejuntao Signo: 10:00 AM, 1:00 PM, 4:00 PM, 7:00 PM, 11:00 PM
    ...buildHourlyDraws('ARREJUNTAO_SIGNO', 'Arrejuntao Signo', ['10:00 AM', '1:00 PM', '4:00 PM', '7:00 PM', '11:00 PM'], { type: 'zodiac' }),

    // 11. Tripletazo (Caracas Zodiacal): 1:00 PM, 4:30 PM, 7:00 PM
    ...buildHourlyDraws('TRIPLETAZO', 'Tripletazo', ['1:00 PM', '4:30 PM', '7:00 PM'], { type: 'zodiac' }),

    // 12. Astros Colombia
    singleDraw('ASTRO_SOL_1430', 'Super Astro Sol', '2:30 PM', { type: 'astro', country: 'COL', daysOfWeek: [1, 2, 3, 4, 5, 6] }),
    singleDraw('ASTRO_LUNA_2230', 'Super Astro Luna', '10:30 PM', { type: 'astro', country: 'COL', daysOfWeek: [0, 1, 2, 3, 4, 5, 6] })
  ],

  // --------------------------------------------------------------------------
  // 3. PESTAÑA 3: 4 CIFRAS (LOTERÍAS Y CHANCES COLOMBIANOS + ESPECIALES)
  // --------------------------------------------------------------------------
  cuatro_cifras: [
    // A. Loterías Principales de Colombia por Día de Sorteo
    // Lunes (day === 1)
    singleDraw('CUNDINAMARCA', 'Lotería de Cundinamarca', '10:30 PM', { has5ta: false, daysOfWeek: [1], dayLabel: 'Lunes' }),
    singleDraw('TOLIMA', 'Lotería del Tolima', '10:30 PM', { has5ta: false, daysOfWeek: [1], dayLabel: 'Lunes' }),
    // Martes (day === 2)
    singleDraw('CRUZ_ROJA', 'Lotería de la Cruz Roja', '10:55 PM', { has5ta: false, daysOfWeek: [2], dayLabel: 'Martes' }),
    singleDraw('HUILA', 'Lotería del Huila', '10:30 PM', { has5ta: false, daysOfWeek: [2], dayLabel: 'Martes' }),
    // Miércoles (day === 3)
    singleDraw('MANIZALES', 'Lotería de Manizales', '10:30 PM', { has5ta: false, daysOfWeek: [3], dayLabel: 'Miércoles' }),
    singleDraw('META', 'Lotería del Meta', '10:30 PM', { has5ta: false, daysOfWeek: [3], dayLabel: 'Miércoles' }),
    singleDraw('VALLE', 'Lotería del Valle', '10:30 PM', { has5ta: false, daysOfWeek: [3], dayLabel: 'Miércoles' }),
    // Jueves (day === 4)
    singleDraw('BOGOTA', 'Lotería de Bogotá', '11:15 PM', { has5ta: false, daysOfWeek: [4], dayLabel: 'Jueves' }),
    singleDraw('QUINDIO', 'Lotería del Quindío', '10:30 PM', { has5ta: false, daysOfWeek: [4], dayLabel: 'Jueves' }),
    // Viernes (day === 5)
    singleDraw('MEDELLIN', 'Lotería de Medellín', '11:00 PM', { has5ta: false, daysOfWeek: [5], dayLabel: 'Viernes' }),
    singleDraw('SANTANDER', 'Lotería de Santander', '11:00 PM', { has5ta: false, daysOfWeek: [5], dayLabel: 'Viernes' }),
    singleDraw('RISARALDA', 'Lotería de Risaralda', '11:00 PM', { has5ta: false, daysOfWeek: [5], dayLabel: 'Viernes' }),
    // Sábados (day === 6)
    singleDraw('BOYACA', 'Lotería de Boyacá', '10:40 PM', { has5ta: false, daysOfWeek: [6], dayLabel: 'Sábado' }),
    singleDraw('CAUCA', 'Lotería del Cauca', '10:40 PM', { has5ta: false, daysOfWeek: [6], dayLabel: 'Sábado' }),

    // B. Chances y Juegos de Sorteo Diario Colombia (Con soporte para "La 5ta")
    singleDraw('DORADO_MANANA', 'Dorado Mañana', '10:55 AM', { has5ta: true, daysOfWeek: [1, 2, 3, 4, 5, 6] }),
    singleDraw('DORADO_TARDE', 'Dorado Tarde', '3:30 PM', { has5ta: true, daysOfWeek: [1, 2, 3, 4, 5, 6] }),
    singleDraw('DORADO_NOCHE', 'Dorado Noche', '10:05 PM', { has5ta: true, daysOfWeek: [0, 1, 2, 3, 4, 5, 6] }),

    // Sinuano Lunes a Sábado vs Domingo
    singleDraw('SINUANO_DIA_LV', 'Sinuano Día', '2:30 PM', { has5ta: true, daysOfWeek: [1, 2, 3, 4, 5, 6] }),
    singleDraw('SINUANO_DIA_DOM', 'Sinuano Día (Dom)', '1:00 PM', { has5ta: true, daysOfWeek: [0] }),
    singleDraw('SINUANO_NOCHE_LV', 'Sinuano Noche', '10:30 PM', { has5ta: true, daysOfWeek: [1, 2, 3, 4, 5, 6] }),
    singleDraw('SINUANO_NOCHE_DOM', 'Sinuano Noche (Dom)', '8:30 PM', { has5ta: true, daysOfWeek: [0] }),

    // Otros Sorteos Diarios de Colombia
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

    // Especiales 4 y 5 Cifras Venezuela
    ...buildHourlyDraws('EL_ARRIMAO', 'El Arrimao', ['10:00 AM', '1:00 PM', '4:00 PM', '7:00 PM', '11:00 PM'], { has5ta: false }),
    ...buildHourlyDraws('EL_PEGADITO', 'El Pegadito', ['10:00 AM', '1:00 PM', '4:00 PM', '7:00 PM', '11:00 PM'], { has5ta: false })
  ],

  // --------------------------------------------------------------------------
  // 4. PESTAÑA 4: ANIMALITOS (DESGLOSADOS POR HORA Y MINUTO EXACTO + FRUTA GANA)
  // --------------------------------------------------------------------------
  animalitos: [
    // Grupo 1: Sorteos en punto (:00) de 8:00 AM a 7:00 PM
    ...buildHourlyDraws('LOTTO_ACTIVO', 'Lotto Activo', HOURS_8AM_TO_7PM_00, { maxNum: 36, type: 'animalito' }),
    ...buildHourlyDraws('LA_GRANJITA', 'La Granjita', HOURS_8AM_TO_7PM_00, { maxNum: 36, type: 'animalito' }),
    ...buildHourlyDraws('GUACHARO_ACTIVO', 'Guácharo Activo', HOURS_8AM_TO_7PM_00, { maxNum: 36, type: 'animalito' }),
    ...buildHourlyDraws('LOTO_CHAIMA', 'Loto Chaima', HOURS_8AM_TO_7PM_00, { maxNum: 36, type: 'animalito' }),

    // Grupo 2: Sorteos en punto (:00) de 9:00 AM a 7:00 PM / 8:00 PM / 9:00 PM
    ...buildHourlyDraws('FRUTA_GANA', 'Fruta Gana', HOURS_9AM_TO_7PM_00, { maxNum: 36, type: 'animalito', isFruta: true }),
    ...buildHourlyDraws('GRANJA_MILLONARIA', 'Granja Millonaria', HOURS_9AM_TO_8PM_00, { maxNum: 36, type: 'animalito' }),
    ...buildHourlyDraws('FIERAS_ORIENTE', 'Animalitos del Oriente - Fieras', HOURS_9AM_TO_6PM_00, { maxNum: 36, type: 'animalito' }),
    ...buildHourlyDraws('CHANCE_ANIMALITOS', 'Chance con Animalitos', HOURS_9AM_TO_7PM_00, { maxNum: 36, type: 'animalito' }),
    ...buildHourlyDraws('CHANCE_ANIMALITOS_B', 'Chance con Animalitos B', HOURS_9AM_TO_7PM_00, { maxNum: 36, type: 'animalito' }),
    ...buildHourlyDraws('MEGA_ANIMAL_40', 'Mega Animal 40', HOURS_9AM_TO_8PM_00, { maxNum: 40, type: 'animalito' }),
    ...buildHourlyDraws('TROPI_GANA', 'Tropi Gana', HOURS_9AM_TO_7PM_00, { maxNum: 36, type: 'animalito' }),
    ...buildHourlyDraws('TRIPLE_POPULAR_ANM', 'Triple Popular Animalitos', HOURS_9AM_TO_9PM_00, { maxNum: 36, type: 'animalito' }),

    // Grupo 3: Sorteos a los :05 minutos
    ...buildHourlyDraws('MONJE_MILLONARIO', 'Monje Millonario', HOURS_8AM_TO_7PM_05, { maxNum: 36, type: 'animalito' }),

    // Grupo 4: Sorteos a los :10 minutos
    ...buildHourlyDraws('LOTTO_GATO', 'Lotto Gato', HOURS_9AM_TO_7PM_10, { maxNum: 36, type: 'animalito' }),

    // Grupo 5: Sorteos a los :15 minutos
    ...buildHourlyDraws('SELVA_PLUS', 'Selva Plus', HOURS_8AM_TO_8PM_15, { maxNum: 36, type: 'animalito' }),
    ...buildHourlyDraws('BICHITOS_ORIENTE', 'Animalitos del Oriente - Bichitos', HOURS_9AM_TO_6PM_15, { maxNum: 36, type: 'animalito' }),

    // Grupo 6: Sorteos a los :30 minutos (Media hora)
    ...buildHourlyDraws('GUACHARITO_MILL', 'El Guacharito Millonario', HOURS_8AM_TO_7PM_30, { maxNum: 36, type: 'animalito' }),
    ...buildHourlyDraws('LOTTO_ACTIVO_RD', 'Lotto Activo RD', HOURS_8AM_TO_7PM_30, { maxNum: 36, type: 'animalito' }),
    ...buildHourlyDraws('RULETA_ROYAL', 'Ruleta Royal', HOURS_8AM_TO_8PM_30, { maxNum: 36, type: 'animalito' }),
    ...buildHourlyDraws('GRANJAZO', 'Granja Millonaria - Granjazo', HOURS_9AM_TO_8PM_30, { maxNum: 36, type: 'animalito' }),
    ...buildHourlyDraws('MASCOTAS_ORIENTE', 'Animalitos del Oriente - Mascotas', HOURS_9AM_TO_6PM_30, { maxNum: 36, type: 'animalito' }),

    // Grupo 7: Sorteos a los :40 minutos
    ...buildHourlyDraws('GATAZO', 'Gatazo', HOURS_9AM_TO_7PM_40, { maxNum: 36, type: 'animalito' }),

    // Grupo 8: Sorteos Especiales (5 sorteos al día)
    ...buildHourlyDraws('ARREJUNTAO_ANM', 'El Arrejuntao Animalitos', ['10:00 AM', '1:00 PM', '4:00 PM', '7:00 PM', '11:00 PM'], { maxNum: 36, type: 'animalito' })
  ]
};

// Calcula cuántos minutos faltan desde la hora actual hasta el sorteo
function getRemainingMinutesForLottery(lot, nowDate = new Date()) {
  if (!lot || typeof lot.drawHour24 !== 'number') return 999;
  const drawTotalMinutes = lot.drawHour24 * 60 + (lot.drawMinute || 0);
  const currentTotalMinutes = nowDate.getHours() * 60 + nowDate.getMinutes();
  return drawTotalMinutes - currentTotalMinutes;
}

// Regla de Negocio Crítica:
// 1. Filtra loterías por día de la semana (a menos que showAllWeekDays = true)
// 2. Elimina cualquier sorteo cuando falten 5 minutos o menos (MinutosRestantes <= 5)
function isLotteryOpenForSale(lot, nowDate = new Date(), showAllWeekDays = false) {
  if (!lot) return false;
  const currentDay = nowDate.getDay(); // 0 = Domingo, 1 = Lunes ... 6 = Sábado

  if (!showAllWeekDays && Array.isArray(lot.daysOfWeek) && !lot.daysOfWeek.includes(currentDay)) {
    return false;
  }

  // Si es una lotería de otro día mostrada por "Ver Todas las Loterías de la Semana", permitir preventa
  if (showAllWeekDays && Array.isArray(lot.daysOfWeek) && !lot.daysOfWeek.includes(currentDay)) {
    return true;
  }

  const remainingMinutes = getRemainingMinutesForLottery(lot, nowDate);
  if (remainingMinutes <= 5) {
    return false;
  }
  return true;
}

// Busca un sorteo por su ID en cualquiera de las 4 categorías
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
    ANIMALITOS_DICT,
    FRUTAS_DICT,
    LOTTERY_CATALOGS,
    ANIMALITOS_DEFAULT_HOURS,
    getAnimalOrFruitInfo,
    getRemainingMinutesForLottery,
    isLotteryOpenForSale,
    findLotteryById
  };
}

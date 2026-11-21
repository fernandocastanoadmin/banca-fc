// lib/data/catalogs.dart - Catálogo Maestro y Diccionarios Dinámicos por Operadora
// Sistema "Banca El Castaño (Seguro Te Paga)"

class ZodiacSign {
  final String code;
  final String name;
  final String icon;

  const ZodiacSign({
    required this.code,
    required this.name,
    required this.icon,
  });
}

class AnimalOrFruitInfo {
  final String number;
  final String name;
  final String emoji;
  final int maxNum;
  final bool valid;
  final String operatorLabel;

  const AnimalOrFruitInfo({
    required this.number,
    required this.name,
    required this.emoji,
    this.maxNum = 36,
    this.valid = true,
    this.operatorLabel = '',
  });
}

class OperatorDictionaryConfig {
  final String key;
  final String label;
  final int maxNum;
  final Map<String, String> dict;
  final bool isFruta;

  const OperatorDictionaryConfig({
    required this.key,
    required this.label,
    required this.maxNum,
    required this.dict,
    this.isFruta = false,
  });
}

class LotteryDraw {
  final String id;
  final String categoryKey;
  final String baseName;
  final String name;
  final String time12;
  final int drawHour24;
  final int drawMinute;
  final String type;
  final bool has5ta;
  final bool isFruta;
  final int maxNum;
  final List<int>? daysOfWeek;
  final String? dayLabel;
  final String? country;

  const LotteryDraw({
    required this.id,
    required this.categoryKey,
    required this.baseName,
    required this.name,
    required this.time12,
    required this.drawHour24,
    required this.drawMinute,
    required this.type,
    this.has5ta = false,
    this.isFruta = false,
    this.maxNum = 36,
    this.daysOfWeek,
    this.dayLabel,
    this.country,
  });
}

const List<ZodiacSign> zodiacSigns = [
  ZodiacSign(code: 'ARI', name: 'Aries', icon: '♈'),
  ZodiacSign(code: 'TAU', name: 'Tauro', icon: '♉'),
  ZodiacSign(code: 'GEM', name: 'Géminis', icon: '♊'),
  ZodiacSign(code: 'CAN', name: 'Cáncer', icon: '♋'),
  ZodiacSign(code: 'LEO', name: 'Leo', icon: '♌'),
  ZodiacSign(code: 'VIR', name: 'Virgo', icon: '♍'),
  ZodiacSign(code: 'LIB', name: 'Libra', icon: '♎'),
  ZodiacSign(code: 'ESC', name: 'Escorpio', icon: '♏'),
  ZodiacSign(code: 'SAG', name: 'Sagitario', icon: '♐'),
  ZodiacSign(code: 'CAP', name: 'Capricornio', icon: '♑'),
  ZodiacSign(code: 'ACU', name: 'Acuario', icon: '♒'),
  ZodiacSign(code: 'PIS', name: 'Piscis', icon: '♓'),
];

const Map<String, String> base38Dict = {
  "0": "DELFÍN", "00": "BALLENA", "01": "CARNERO", "02": "TORO", "03": "CIEMPIÉS",
  "04": "ALACRÁN", "05": "LEÓN", "06": "RANA", "07": "PERICO", "08": "RATÓN",
  "09": "ÁGUILA", "10": "TIGRE", "11": "GATO", "12": "CABALLO", "13": "MONO",
  "14": "PALOMA", "15": "ZORRO", "16": "OSO", "17": "PAVO", "18": "BURRO",
  "19": "CHIVO", "20": "CERDO", "21": "GALLO", "22": "CAMELLO", "23": "CEBRA",
  "24": "IGUANA", "25": "GALLINA", "26": "VACA", "27": "PERRO", "28": "ZAMURO",
  "29": "ELEFANTE", "30": "CAIMÁN", "31": "LAPA", "32": "ARDILLA", "33": "PESCADO",
  "34": "VENADO", "35": "JIRAFA", "36": "CULEBRA"
};

const Map<String, String> guacharito101Dict = {
  ...base38Dict,
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

const Map<String, String> granjazo78Dict = {
  ...base38Dict,
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

const Map<String, String> frutaGana38Dict = {
  "0": "GUANÁBANA", "00": "NÍSPERO", "01": "CIRUELA", "02": "GUAYABA", "03": "TAMARINDO",
  "04": "PISTACHO", "05": "MELÓN", "06": "MAMÓN", "07": "PATILLA", "08": "LIMÓN",
  "09": "KIWI / FRESA", "10": "MANZANA", "11": "PARCHITA", "12": "MANGO", "13": "CAMBUR",
  "14": "PIÑA", "15": "ZAPOTE", "16": "PERA", "17": "MELOCOTÓN", "18": "AGUACATE",
  "19": "GRANADA", "20": "TORONJA", "21": "UVA", "22": "AVELLANA", "23": "DURAZNO",
  "24": "PLÁTANO", "25": "MAÍZ", "26": "MORA", "27": "FRAMBUESA", "28": "COCO",
  "29": "NARANJA", "30": "MANDARINA", "31": "LECHOSA", "32": "NUEZ", "33": "POMARROSA",
  "34": "HIGO", "35": "CEREZA", "36": "KIWI"
};

Map<String, String> _buildRangeMap(
  Map<String, String> source,
  int maxNum, [
  Map<String, String> overrides = const {},
]) {
  final out = <String, String>{
    '0': source['0'] ?? '',
    '00': source['00'] ?? '',
  };
  for (var i = 1; i <= maxNum; i++) {
    final k = i.toString().padLeft(2, '0');
    if (source.containsKey(k)) out[k] = source[k]!;
  }
  out.addAll(overrides);
  return out;
}

final Map<String, String> megaAnimal42Dict = _buildRangeMap(guacharito101Dict, 40);
final Map<String, String> gatazo76Dict = _buildRangeMap(
  guacharito101Dict,
  74,
  const {'11': 'GATAZO', '61': 'COLIBRÍ'},
);
final Map<String, String> guacharo77Dict = _buildRangeMap(
  guacharito101Dict,
  75,
  const {'61': 'PANDA', '75': 'GUÁCHARO'},
);
final Map<String, String> condor77Dict = _buildRangeMap(
  guacharito101Dict,
  75,
  const {'75': 'CÓNDOR'},
);

final Map<String, OperatorDictionaryConfig> operatorDictionaries = {
  'BASE_38': const OperatorDictionaryConfig(
    key: 'BASE_38',
    label: 'Clásico 38 Animalitos (0, 00 al 36)',
    maxNum: 36,
    dict: base38Dict,
  ),
  'MEGA_ANIMAL_42': OperatorDictionaryConfig(
    key: 'MEGA_ANIMAL_42',
    label: 'Mega Animal 40 (0, 00 al 40)',
    maxNum: 40,
    dict: megaAnimal42Dict,
  ),
  'GATAZO_76': OperatorDictionaryConfig(
    key: 'GATAZO_76',
    label: 'El Gatazo (0, 00 al 74)',
    maxNum: 74,
    dict: gatazo76Dict,
  ),
  'GUACHARO_77': OperatorDictionaryConfig(
    key: 'GUACHARO_77',
    label: 'Guácharo Activo (0, 00 al 75)',
    maxNum: 75,
    dict: guacharo77Dict,
  ),
  'CONDOR_77': OperatorDictionaryConfig(
    key: 'CONDOR_77',
    label: 'Cóndor Gana (0, 00 al 75)',
    maxNum: 75,
    dict: condor77Dict,
  ),
  'GRANJAZO_78': const OperatorDictionaryConfig(
    key: 'GRANJAZO_78',
    label: 'GM El Granjazo (0, 00 al 76)',
    maxNum: 76,
    dict: granjazo78Dict,
  ),
  'GUACHARITO_101': const OperatorDictionaryConfig(
    key: 'GUACHARITO_101',
    label: 'Guacharito Millonario (0, 00 al 99)',
    maxNum: 99,
    dict: guacharito101Dict,
  ),
  'SELVA_PLUS_101': const OperatorDictionaryConfig(
    key: 'SELVA_PLUS_101',
    label: 'Selva Plus (0, 00 al 99)',
    maxNum: 99,
    dict: guacharito101Dict,
  ),
  'FRUTA_GANA_38': const OperatorDictionaryConfig(
    key: 'FRUTA_GANA_38',
    label: 'Fruta Gana (0, 00 al 36)',
    maxNum: 36,
    dict: frutaGana38Dict,
    isFruta: true,
  ),
};

const Map<String, String> _figureEmojis = {
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

String getEmojiForFigureName(String name, {bool isFruta = false}) {
  return _figureEmojis[name.toUpperCase().trim()] ?? (isFruta ? '🍉' : '🐾');
}

OperatorDictionaryConfig getOperatorConfigForLottery(String lotteryIdOrName) {
  final raw = lotteryIdOrName.toUpperCase();
  if (raw.contains('FRUTA_GANA') || raw.contains('FRUTA GANA') || raw.contains('FRUTA')) {
    return operatorDictionaries['FRUTA_GANA_38']!;
  }
  if (raw.contains('GUACHARITO')) return operatorDictionaries['GUACHARITO_101']!;
  if (raw.contains('SELVA_PLUS') || raw.contains('SELVA PLUS')) {
    return operatorDictionaries['SELVA_PLUS_101']!;
  }
  if (raw.contains('GRANJAZO')) return operatorDictionaries['GRANJAZO_78']!;
  if (raw.contains('GUACHARO_ACTIVO') || raw.contains('GUÁCHARO ACTIVO')) {
    return operatorDictionaries['GUACHARO_77']!;
  }
  if (raw.contains('CONDOR_GANA') || raw.contains('CÓNDOR GANA')) {
    return operatorDictionaries['CONDOR_77']!;
  }
  if (raw.contains('GATAZO')) return operatorDictionaries['GATAZO_76']!;
  if (raw.contains('MEGA_ANIMAL') || raw.contains('MEGA ANIMAL')) {
    return operatorDictionaries['BASE_38']!;
  }
  return operatorDictionaries['BASE_38']!;
}

String normalizeAnimalCode(String numberStr) {
  final clean = numberStr.trim();
  if (clean.isEmpty) return '';
  if (clean == '0' || clean == '00') return clean;
  final n = int.tryParse(clean);
  if (n == null || n < 0) return clean;
  return n < 10 ? '0$n' : '$n';
}

AnimalOrFruitInfo getAnimalOrFruitInfo(String numberStr, {String lotteryIdOrName = ''}) {
  final opCfg = getOperatorConfigForLottery(lotteryIdOrName);
  final code = normalizeAnimalCode(numberStr);
  if (code.isEmpty || !RegExp(r'^\d{1,2}$').hasMatch(code)) {
    return AnimalOrFruitInfo(
      number: code,
      name: 'FUERA DE RANGO',
      emoji: '⛔',
      maxNum: opCfg.maxNum,
      valid: false,
      operatorLabel: opCfg.label,
    );
  }
  if (code != '0' && code != '00') {
    final n = int.tryParse(code);
    if (n == null || n < 1 || n > opCfg.maxNum) {
      return AnimalOrFruitInfo(
        number: code,
        name: 'FUERA DE RANGO',
        emoji: '⛔',
        maxNum: opCfg.maxNum,
        valid: false,
        operatorLabel: opCfg.label,
      );
    }
  }
  final figName = opCfg.dict[code];
  if (figName == null) {
    return AnimalOrFruitInfo(
      number: code,
      name: 'FUERA DE RANGO',
      emoji: '⛔',
      maxNum: opCfg.maxNum,
      valid: false,
      operatorLabel: opCfg.label,
    );
  }
  return AnimalOrFruitInfo(
    number: code,
    name: figName,
    emoji: getEmojiForFigureName(figName, isFruta: opCfg.isFruta),
    maxNum: opCfg.maxNum,
    valid: true,
    operatorLabel: opCfg.label,
  );
}

class _ParsedTime12 {
  final int hour24;
  final int minute;
  final String formatted12;
  const _ParsedTime12(this.hour24, this.minute, this.formatted12);
}

_ParsedTime12 _parse12HourTime(String time12Str) {
  final match = RegExp(r'^(\d{1,2}):(\d{2})\s*(AM|PM)$', caseSensitive: false)
      .firstMatch(time12Str.trim());
  if (match == null) {
    return _ParsedTime12(23, 59, time12Str);
  }
  var hr = int.parse(match.group(1)!);
  final min = int.parse(match.group(2)!);
  final period = match.group(3)!.toUpperCase();
  final hOrig = hr;
  if (period == 'PM' && hr < 12) hr += 12;
  if (period == 'AM' && hr == 12) hr = 0;
  return _ParsedTime12(
    hr,
    min,
    '$hOrig:${min.toString().padLeft(2, '0')} $period',
  );
}

List<String> _generateRangeHours12(int startHour24, int endHour24, [int minuteVal = 0]) {
  final list = <String>[];
  final mm = minuteVal.toString().padLeft(2, '0');
  for (var h = startHour24; h <= endHour24; h++) {
    final period = h >= 12 ? 'PM' : 'AM';
    final h12 = h == 0 ? 12 : (h > 12 ? h - 12 : h);
    list.add('$h12:$mm $period');
  }
  return list;
}

List<LotteryDraw> _buildHourlyDraws(
  String categoryKey,
  String prefixId,
  String baseName,
  List<String> times12Array, {
  String type = 'triple',
  bool has5ta = false,
  bool isFruta = false,
  int maxNum = 36,
}) {
  return times12Array.map((t12) {
    final parsed = _parse12HourTime(t12);
    final timeCode =
        '${parsed.hour24.toString().padLeft(2, '0')}${parsed.minute.toString().padLeft(2, '0')}';
    return LotteryDraw(
      id: '${prefixId}_$timeCode',
      categoryKey: categoryKey,
      baseName: baseName,
      name: '$baseName ${parsed.formatted12}',
      time12: parsed.formatted12,
      drawHour24: parsed.hour24,
      drawMinute: parsed.minute,
      type: type,
      has5ta: has5ta,
      isFruta: isFruta,
      maxNum: maxNum,
    );
  }).toList();
}

LotteryDraw _singleDraw(
  String categoryKey,
  String id,
  String baseName,
  String time12, {
  String type = 'cuatro_cifras',
  bool has5ta = false,
  List<int>? daysOfWeek,
  String? dayLabel,
  String? country,
}) {
  final parsed = _parse12HourTime(time12);
  return LotteryDraw(
    id: id,
    categoryKey: categoryKey,
    baseName: baseName,
    name: '$baseName ${parsed.formatted12}',
    time12: parsed.formatted12,
    drawHour24: parsed.hour24,
    drawMinute: parsed.minute,
    type: type,
    has5ta: has5ta,
    daysOfWeek: daysOfWeek,
    dayLabel: dayLabel,
    country: country,
  );
}

final List<String> _h8a7_00 = _generateRangeHours12(8, 19, 0);
final List<String> _h9a7_00 = _generateRangeHours12(9, 19, 0);
final List<String> _h9a8_00 = _generateRangeHours12(9, 20, 0);
final List<String> _h9a9_00 = _generateRangeHours12(9, 21, 0);
final List<String> _h9a6_00 = _generateRangeHours12(9, 18, 0);
final List<String> _h8a7_05 = _generateRangeHours12(8, 19, 5);
final List<String> _h9a7_10 = _generateRangeHours12(9, 19, 10);
final List<String> _h8a8_15 = _generateRangeHours12(8, 20, 15);
final List<String> _h9a6_15 = _generateRangeHours12(9, 18, 15);
final List<String> _h8a7_30 = _generateRangeHours12(8, 19, 30);
final List<String> _h8a8_30 = _generateRangeHours12(8, 20, 30);
final List<String> _h9a8_30 = _generateRangeHours12(9, 20, 30);
final List<String> _h9a6_30 = _generateRangeHours12(9, 18, 30);
final List<String> _h9a7_40 = _generateRangeHours12(9, 19, 40);

final Map<String, List<LotteryDraw>> lotteryCatalogs = {
  'sin_signo': [
    ..._buildHourlyDraws('sin_signo', 'CHANCE_A', 'Chance A', _h9a7_00),
    ..._buildHourlyDraws('sin_signo', 'CHANCE_B', 'Chance B', _h9a7_00),
    ..._buildHourlyDraws('sin_signo', 'TACHIRA_A', 'Táchira A', ['1:15 PM', '4:45 PM', '10:10 PM']),
    ..._buildHourlyDraws('sin_signo', 'TACHIRA_B', 'Táchira B', ['1:15 PM', '4:45 PM', '10:10 PM']),
    ..._buildHourlyDraws('sin_signo', 'ZULIA_A', 'Zulia A', ['12:45 PM', '4:45 PM', '7:05 PM']),
    ..._buildHourlyDraws('sin_signo', 'ZULIA_B', 'Zulia B', ['12:45 PM', '4:45 PM', '7:05 PM']),
    ..._buildHourlyDraws('sin_signo', 'CALIENTE_A', 'Caliente A', ['1:00 PM', '4:30 PM', '7:10 PM']),
    ..._buildHourlyDraws('sin_signo', 'CALIENTE_B', 'Caliente B', ['1:00 PM', '4:30 PM', '7:10 PM']),
    ..._buildHourlyDraws('sin_signo', 'TRIPLE_LAGO_A', 'Triple Lago A', ['1:00 PM', '4:30 PM', '10:15 PM']),
    ..._buildHourlyDraws('sin_signo', 'TRIPLE_LAGO_B', 'Triple Lago B', ['1:00 PM', '4:30 PM', '10:15 PM']),
    ..._buildHourlyDraws('sin_signo', 'TRIPLE_GATO_A', 'Triple Gato A', ['12:45 PM', '4:45 PM', '5:00 PM', '7:45 PM']),
    ..._buildHourlyDraws('sin_signo', 'TRIPLE_GATO_B', 'Triple Gato B', ['12:45 PM', '4:45 PM', '5:00 PM', '7:45 PM']),
    ..._buildHourlyDraws('sin_signo', 'ARREJUNTAO_A', 'Arrejuntao A', ['10:00 AM', '1:00 PM', '4:00 PM', '7:00 PM', '11:00 PM']),
    ..._buildHourlyDraws('sin_signo', 'ARREJUNTAO_B', 'Arrejuntao B', ['10:00 AM', '1:00 PM', '4:00 PM', '7:00 PM', '11:00 PM']),
    ..._buildHourlyDraws('sin_signo', 'TRIPLE_ZAMORANO', 'Triple Zamorano', ['10:00 AM', '12:00 PM', '2:00 PM', '4:00 PM', '7:00 PM']),
    ..._buildHourlyDraws('sin_signo', 'LA_RICACHONA', 'La Ricachona', _h8a7_05),
    ..._buildHourlyDraws('sin_signo', 'TRIPLE_FACIL', 'Triple Fácil', _h8a7_00),
    ..._buildHourlyDraws('sin_signo', 'TRIO_ACTIVO', 'Trío Activo', _h8a7_00),
    ..._buildHourlyDraws('sin_signo', 'TRIPLE_POPULAR', 'Triple Popular', _h9a9_00),
    ..._buildHourlyDraws('sin_signo', 'TRIPLE_DORADO', 'Triple Dorado', [
      '9:00 AM', '10:00 AM', '11:00 AM', '1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM', '5:00 PM', '6:00 PM',
    ]),
    ..._buildHourlyDraws('sin_signo', 'TRIPLE_FORTUNA', 'Triple Fortuna', _generateRangeHours12(10, 19, 0)),
    ..._buildHourlyDraws(
      'sin_signo',
      'NAPA_GANA',
      'Ñapa Gana',
      ['9:00 AM', '10:30 AM', '11:30 AM', '12:00 PM', '1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM', '5:00 PM', '6:00 PM', '7:00 PM'],
      type: 'terminal',
    ),
    ..._buildHourlyDraws('sin_signo', 'CARACAS_A', 'Caracas A', ['1:00 PM', '4:30 PM', '7:00 PM']),
    ..._buildHourlyDraws('sin_signo', 'CARACAS_B', 'Caracas B', ['1:00 PM', '4:30 PM', '7:00 PM']),
  ],
  'con_signo': [
    ..._buildHourlyDraws('con_signo', 'CHANCE_ASTRAL', 'Chance Astral', _h9a7_00, type: 'zodiac'),
    ..._buildHourlyDraws('con_signo', 'TACHIRA_ZODIACAL', 'Táchira Zodiacal', ['1:15 PM', '4:45 PM', '10:10 PM'], type: 'zodiac'),
    ..._buildHourlyDraws('con_signo', 'ZODIACO_ZULIA', 'Zodiaco del Zulia', ['12:45 PM', '4:45 PM', '7:05 PM'], type: 'zodiac'),
    ..._buildHourlyDraws('con_signo', 'SIGNO_CALIENTE', 'Signo Caliente', ['1:00 PM', '4:30 PM', '7:10 PM'], type: 'zodiac'),
    ..._buildHourlyDraws('con_signo', 'ASTRO_ZAMORANO', 'Astro Zamorano', ['10:00 AM', '12:00 PM', '2:00 PM', '4:00 PM', '7:00 PM'], type: 'zodiac'),
    ..._buildHourlyDraws('con_signo', 'LAGO_ZODIACAL', 'Lago Zodiacal', ['1:00 PM', '4:30 PM', '10:15 PM'], type: 'zodiac'),
    ..._buildHourlyDraws('con_signo', 'TRIPLE_GANA_SIGNO', 'Triple Gana Signo', ['1:00 PM', '4:00 PM', '10:00 PM'], type: 'zodiac'),
    ..._buildHourlyDraws('con_signo', 'SUPER_GANA', 'Super Gana', ['1:00 PM', '4:00 PM', '10:00 PM'], type: 'astro'),
    ..._buildHourlyDraws('con_signo', 'TRIPLE_GATO_ZOD', 'Triple Gato Zodiacal', ['12:45 PM', '4:45 PM', '5:00 PM', '7:45 PM'], type: 'zodiac'),
    ..._buildHourlyDraws('con_signo', 'ARREJUNTAO_SIGNO', 'Arrejuntao Signo', ['10:00 AM', '1:00 PM', '4:00 PM', '7:00 PM', '11:00 PM'], type: 'zodiac'),
    ..._buildHourlyDraws('con_signo', 'TRIPLETAZO', 'Tripletazo', ['1:00 PM', '4:30 PM', '7:00 PM'], type: 'zodiac'),
    _singleDraw('con_signo', 'ASTRO_SOL_1430', 'Super Astro Sol', '2:30 PM', type: 'astro', country: 'COL', daysOfWeek: [1, 2, 3, 4, 5, 6]),
    _singleDraw('con_signo', 'ASTRO_LUNA_2230', 'Super Astro Luna', '10:30 PM', type: 'astro', country: 'COL', daysOfWeek: [0, 1, 2, 3, 4, 5, 6]),
  ],
  'cuatro_cifras': [
    _singleDraw('cuatro_cifras', 'CUNDINAMARCA', 'Lotería de Cundinamarca', '10:30 PM', daysOfWeek: [1], dayLabel: 'Lunes'),
    _singleDraw('cuatro_cifras', 'TOLIMA', 'Lotería del Tolima', '10:30 PM', daysOfWeek: [1], dayLabel: 'Lunes'),
    _singleDraw('cuatro_cifras', 'CRUZ_ROJA', 'Lotería de la Cruz Roja', '10:55 PM', daysOfWeek: [2], dayLabel: 'Martes'),
    _singleDraw('cuatro_cifras', 'HUILA', 'Lotería del Huila', '10:30 PM', daysOfWeek: [2], dayLabel: 'Martes'),
    _singleDraw('cuatro_cifras', 'MANIZALES', 'Lotería de Manizales', '10:30 PM', daysOfWeek: [3], dayLabel: 'Miércoles'),
    _singleDraw('cuatro_cifras', 'META', 'Lotería del Meta', '10:30 PM', daysOfWeek: [3], dayLabel: 'Miércoles'),
    _singleDraw('cuatro_cifras', 'VALLE', 'Lotería del Valle', '10:30 PM', daysOfWeek: [3], dayLabel: 'Miércoles'),
    _singleDraw('cuatro_cifras', 'BOGOTA', 'Lotería de Bogotá', '11:15 PM', daysOfWeek: [4], dayLabel: 'Jueves'),
    _singleDraw('cuatro_cifras', 'QUINDIO', 'Lotería del Quindío', '10:30 PM', daysOfWeek: [4], dayLabel: 'Jueves'),
    _singleDraw('cuatro_cifras', 'MEDELLIN', 'Lotería de Medellín', '11:00 PM', daysOfWeek: [5], dayLabel: 'Viernes'),
    _singleDraw('cuatro_cifras', 'SANTANDER', 'Lotería de Santander', '11:00 PM', daysOfWeek: [5], dayLabel: 'Viernes'),
    _singleDraw('cuatro_cifras', 'RISARALDA', 'Lotería de Risaralda', '11:00 PM', daysOfWeek: [5], dayLabel: 'Viernes'),
    _singleDraw('cuatro_cifras', 'BOYACA', 'Lotería de Boyacá', '10:40 PM', daysOfWeek: [6], dayLabel: 'Sábado'),
    _singleDraw('cuatro_cifras', 'CAUCA', 'Lotería del Cauca', '10:40 PM', daysOfWeek: [6], dayLabel: 'Sábado'),
    _singleDraw('cuatro_cifras', 'DORADO_MANANA', 'Dorado Mañana', '10:55 AM', has5ta: true, daysOfWeek: [1, 2, 3, 4, 5, 6]),
    _singleDraw('cuatro_cifras', 'DORADO_TARDE', 'Dorado Tarde', '3:30 PM', has5ta: true, daysOfWeek: [1, 2, 3, 4, 5, 6]),
    _singleDraw('cuatro_cifras', 'DORADO_NOCHE', 'Dorado Noche', '10:05 PM', has5ta: true, daysOfWeek: [0, 1, 2, 3, 4, 5, 6]),
    _singleDraw('cuatro_cifras', 'SINUANO_DIA_LV', 'Sinuano Día', '2:30 PM', has5ta: true, daysOfWeek: [1, 2, 3, 4, 5, 6]),
    _singleDraw('cuatro_cifras', 'SINUANO_DIA_DOM', 'Sinuano Día (Dom)', '1:00 PM', has5ta: true, daysOfWeek: [0]),
    _singleDraw('cuatro_cifras', 'SINUANO_NOCHE_LV', 'Sinuano Noche', '10:30 PM', has5ta: true, daysOfWeek: [1, 2, 3, 4, 5, 6]),
    _singleDraw('cuatro_cifras', 'SINUANO_NOCHE_DOM', 'Sinuano Noche (Dom)', '8:30 PM', has5ta: true, daysOfWeek: [0]),
    _singleDraw('cuatro_cifras', 'ANTIOQUENITA_DIA', 'Antioqueñita Día', '10:00 AM', has5ta: true),
    _singleDraw('cuatro_cifras', 'ANTIOQUENITA_TARDE', 'Antioqueñita Tarde', '4:00 PM', has5ta: true),
    _singleDraw('cuatro_cifras', 'CAFETERITO_TARDE', 'Cafeterito Tarde', '12:00 PM', has5ta: true),
    _singleDraw('cuatro_cifras', 'CAFETERITO_NOCHE', 'Cafeterito Noche', '10:00 PM', has5ta: true),
    _singleDraw('cuatro_cifras', 'PAISITA_DIA', 'Paisita Día', '1:00 PM', has5ta: true),
    _singleDraw('cuatro_cifras', 'PAISITA_NOCHE', 'Paisita Noche', '6:00 PM'),
    _singleDraw('cuatro_cifras', 'PAISITA_3', 'Paisita 3', '9:00 PM'),
    _singleDraw('cuatro_cifras', 'CHONTICO_DIA', 'Chontico Día', '1:00 PM', has5ta: true),
    _singleDraw('cuatro_cifras', 'CHONTICO_NOCHE', 'Chontico Noche', '7:00 PM', has5ta: true),
    _singleDraw('cuatro_cifras', 'SAMAN_DIA', 'Samán Día', '1:00 PM'),
    _singleDraw('cuatro_cifras', 'FANTASTICA_DIA', 'Fantástica Día', '1:00 PM', has5ta: true),
    _singleDraw('cuatro_cifras', 'FANTASTICA_NOCHE', 'Fantástica Noche', '8:30 PM', has5ta: true),
    _singleDraw('cuatro_cifras', 'CASH_THREE_DIA', 'Cash Three Día', '1:00 PM'),
    _singleDraw('cuatro_cifras', 'CASH_THREE_NOCHE', 'Cash Three Noche', '10:00 PM'),
    _singleDraw('cuatro_cifras', 'PLAY_FOUR_DIA', 'Play Four Día', '1:00 PM'),
    _singleDraw('cuatro_cifras', 'PLAY_FOUR_NOCHE', 'Play Four Noche', '10:00 PM'),
    _singleDraw('cuatro_cifras', 'PIJAO_ORO', 'Pijao de Oro', '2:00 PM', has5ta: true),
    _singleDraw('cuatro_cifras', 'CARIBENA_DIA', 'Caribeña Día', '2:30 PM', has5ta: true),
    _singleDraw('cuatro_cifras', 'CARIBENA_NOCHE', 'Caribeña Noche', '10:30 PM', has5ta: true),
    _singleDraw('cuatro_cifras', 'CULONA_DIA', 'Culona Día', '2:30 PM'),
    _singleDraw('cuatro_cifras', 'CULONA_NOCHE', 'Culona Noche', '9:30 PM'),
    _singleDraw('cuatro_cifras', 'MOTILON_TARDE', 'Motilón Tarde', '3:00 PM', has5ta: true),
    _singleDraw('cuatro_cifras', 'MOTILON_NOCHE', 'Motilón Noche', '9:00 PM', has5ta: true),
    ..._buildHourlyDraws('cuatro_cifras', 'EL_ARRIMAO', 'El Arrimao', ['10:00 AM', '1:00 PM', '4:00 PM', '7:00 PM', '11:00 PM'], type: 'cuatro_cifras'),
    ..._buildHourlyDraws('cuatro_cifras', 'EL_PEGADITO', 'El Pegadito', ['10:00 AM', '1:00 PM', '4:00 PM', '7:00 PM', '11:00 PM'], type: 'cuatro_cifras'),
  ],
  'animalitos': [
    ..._buildHourlyDraws('animalitos', 'LOTTO_ACTIVO', 'Lotto Activo', _h8a7_00, type: 'animalito', maxNum: 36),
    ..._buildHourlyDraws('animalitos', 'LA_GRANJITA', 'La Granjita', _h8a7_00, type: 'animalito', maxNum: 36),
    ..._buildHourlyDraws('animalitos', 'GUACHARO_ACTIVO', 'Guácharo Activo', _h8a7_00, type: 'animalito', maxNum: 75),
    ..._buildHourlyDraws('animalitos', 'CONDOR_GANA', 'Cóndor Gana', _h9a7_00, type: 'animalito', maxNum: 75),
    ..._buildHourlyDraws('animalitos', 'LOTO_CHAIMA', 'Loto Chaima', _h8a7_00, type: 'animalito', maxNum: 36),
    ..._buildHourlyDraws('animalitos', 'FRUTA_GANA', 'Fruta Gana', _h9a7_00, type: 'animalito', isFruta: true, maxNum: 36),
    ..._buildHourlyDraws('animalitos', 'GRANJA_MILLONARIA', 'Granja Millonaria', _h9a8_00, type: 'animalito', maxNum: 36),
    ..._buildHourlyDraws('animalitos', 'FIERAS_ORIENTE', 'Animalitos del Oriente - Fieras', _h9a6_00, type: 'animalito', maxNum: 36),
    ..._buildHourlyDraws('animalitos', 'CHANCE_ANIMALITOS', 'Chance con Animalitos', _h9a7_00, type: 'animalito', maxNum: 36),
    ..._buildHourlyDraws('animalitos', 'CHANCE_ANIMALITOS_B', 'Chance con Animalitos B', _h9a7_00, type: 'animalito', maxNum: 36),
    ..._buildHourlyDraws('animalitos', 'MEGA_ANIMAL_40', 'Mega Animal 40', _h9a8_00, type: 'animalito', maxNum: 36),
    ..._buildHourlyDraws('animalitos', 'TROPI_GANA', 'Tropi Gana', _h9a7_00, type: 'animalito', maxNum: 36),
    ..._buildHourlyDraws('animalitos', 'TRIPLE_POPULAR_ANM', 'Triple Popular Animalitos', _h9a9_00, type: 'animalito', maxNum: 36),
    ..._buildHourlyDraws('animalitos', 'MONJE_MILLONARIO', 'Monje Millonario', _h8a7_05, type: 'animalito', maxNum: 36),
    ..._buildHourlyDraws('animalitos', 'LA_RICACHONA_ANM', 'La Ricachona Animalitos', _h8a7_05, type: 'animalito', maxNum: 36),
    ..._buildHourlyDraws('animalitos', 'LOTTO_GATO', 'Lotto Gato', _h9a7_10, type: 'animalito', maxNum: 36),
    ..._buildHourlyDraws('animalitos', 'SELVA_PLUS', 'Selva Plus', _h8a8_15, type: 'animalito', maxNum: 99),
    ..._buildHourlyDraws('animalitos', 'BICHITOS_ORIENTE', 'Animalitos del Oriente - Bichitos', _h9a6_15, type: 'animalito', maxNum: 36),
    ..._buildHourlyDraws('animalitos', 'GUACHARITO_MILL', 'El Guacharito Millonario', _h8a7_30, type: 'animalito', maxNum: 99),
    ..._buildHourlyDraws('animalitos', 'LOTTO_ACTIVO_RD', 'Lotto Activo RD', _h8a7_30, type: 'animalito', maxNum: 36),
    ..._buildHourlyDraws('animalitos', 'RULETA_ROYAL', 'Ruleta Royal', _h8a8_30, type: 'animalito', maxNum: 36),
    ..._buildHourlyDraws('animalitos', 'GRANJAZO', 'GM El Granjazo', _h9a8_30, type: 'animalito', maxNum: 76),
    ..._buildHourlyDraws('animalitos', 'MASCOTAS_ORIENTE', 'Animalitos del Oriente - Mascotas', _h9a6_30, type: 'animalito', maxNum: 36),
    ..._buildHourlyDraws('animalitos', 'GATAZO', 'El Gatazo', _h9a7_40, type: 'animalito', maxNum: 74),
    ..._buildHourlyDraws('animalitos', 'ARREJUNTAO_ANM', 'El Arrejuntao Animalitos', ['10:00 AM', '1:00 PM', '4:00 PM', '7:00 PM', '11:00 PM'], type: 'animalito', maxNum: 36),
  ],
};

int getRemainingMinutesForLottery(LotteryDraw lot, [DateTime? nowDate]) {
  final now = nowDate ?? DateTime.now();
  final drawTotalMinutes = lot.drawHour24 * 60 + lot.drawMinute;
  final currentTotalMinutes = now.hour * 60 + now.minute;
  return drawTotalMinutes - currentTotalMinutes;
}

bool isLotteryOpenForSale(
  LotteryDraw lot, {
  DateTime? nowDate,
  bool showAllWeekDays = false,
}) {
  final now = nowDate ?? DateTime.now();
  final currentDayJs = now.weekday % 7;

  if (lot.daysOfWeek != null && !lot.daysOfWeek!.contains(currentDayJs)) {
    return showAllWeekDays;
  }

  final remaining = getRemainingMinutesForLottery(lot, now);
  return remaining > 5;
}

LotteryDraw? findLotteryById(String lotteryId) {
  for (final list in lotteryCatalogs.values) {
    for (final lot in list) {
      if (lot.id == lotteryId) return lot;
    }
  }
  return null;
}

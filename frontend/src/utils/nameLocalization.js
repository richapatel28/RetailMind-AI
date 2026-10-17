/**
 * RetailMind AI - Multilingual Name Localization & Transliteration
 * Transliterates common customer and store names into Gujarati, Hindi, and Marathi
 * when the store owner selects those languages, while preserving English for official bills.
 */

const DICTIONARY = {
  // Suffixes and honorifics
  "bhai": { gu: "ભાઈ", hi: "भाई", mr: "भाई" },
  "ben": { gu: "બેન", hi: "बहन", mr: "बहीण" },
  "bahen": { gu: "બહેન", hi: "बहन", mr: "बहीण" },
  "kumar": { gu: "કુમાર", hi: "कुमार", mr: "कुमार" },
  "lal": { gu: "લાલ", hi: "लाल", mr: "लाल" },
  "chand": { gu: "ચંદ", hi: "चंद", mr: "चंद" },
  "singh": { gu: "સિંહ", hi: "सिंह", mr: "सिंह" },
  "devi": { gu: "દેવી", hi: "देवी", mr: "देवी" },
  "ji": { gu: "જી", hi: "जी", mr: "जी" },
  "seth": { gu: "શેઠ", hi: "सेठ", mr: "शेठ" },
  "sheth": { gu: "શેઠ", hi: "सेठ", mr: "शेठ" },
  "kaka": { gu: "કાકા", hi: "काका", mr: "काका" },
  "mama": { gu: "મામા", hi: "मामा", mr: "मामा" },

  // Common Indian first names
  "suresh": { gu: "સુરેશ", hi: "सुरेश", mr: "सुरेश" },
  "ramesh": { gu: "રમેશ", hi: "रमेश", mr: "रमेश" },
  "haresh": { gu: "હરેશ", hi: "हरेश", mr: "हरेश" },
  "naresh": { gu: "નરેશ", hi: "नरेश", mr: "नरेश" },
  "mahesh": { gu: "મહેશ", hi: "महेश", mr: "महेश" },
  "dinesh": { gu: "દિનેશ", hi: "दिनेश", mr: "दिनेश" },
  "rajesh": { gu: "રાજેશ", hi: "राजेश", mr: "राजेश" },
  "mukesh": { gu: "મુકેશ", hi: "મુકેશ", mr: "मुकेश" },
  "hitesh": { gu: "હિતેશ", hi: "हितेश", mr: "हितेश" },
  "jitesh": { gu: "જિતેશ", hi: "जितेश", mr: "जितेश" },
  "kamlesh": { gu: "કમલેશ", hi: "कमलेश", mr: "कमलेश" },
  "shailesh": { gu: "શૈલેષ", hi: "शैलेश", mr: "शैलेश" },
  "bhavesh": { gu: "ભાવેશ", hi: "भावेश", mr: "भावेश" },
  "paresh": { gu: "પરેશ", hi: "परेश", mr: "परेश" },
  "tupi": { gu: "તુપી", hi: "तुपी", mr: "तुपी" },
  "amit": { gu: "અમિત", hi: "अमित", mr: "अमित" },
  "sumit": { gu: "સુમિત", hi: "सुमित", mr: "सुमित" },
  "rahul": { gu: "રાહુલ", hi: "राहुल", mr: "राहुल" },
  "rohit": { gu: "રોહિત", hi: "रोहित", mr: "रोहित" },
  "mohit": { gu: "મોહિત", hi: "मोहित", mr: "मोहित" },
  "vikram": { gu: "વિક્રમ", hi: "विक्रम", mr: "विक्रम" },
  "vijay": { gu: "વિજય", hi: "विजय", mr: "विजय" },
  "ajay": { gu: "અજય", hi: "अजय", mr: "अजय" },
  "sanjay": { gu: "સંજય", hi: "संजय", mr: "संजय" },
  "anil": { gu: "અનિલ", hi: "अनिल", mr: "अनिल" },
  "sunil": { gu: "સુનિલ", hi: "सुनील", mr: "सुनील" },
  "manoj": { gu: "મનોજ", hi: "मनोज", mr: "मनोज" },
  "vinod": { gu: "વિનોદ", hi: "विनोद", mr: "विनोદ" },
  "pramod": { gu: "પ્રમોદ", hi: "प्रमोद", mr: "प्रमोद" },
  "ashok": { gu: "અશોક", hi: "अशोक", mr: "अशोक" },
  "alok": { gu: "આલોક", hi: "आलोक", mr: "आलोक" },
  "deepak": { gu: "દીપક", hi: "दीपक", mr: "दीपक" },
  "prakash": { gu: "પ્રકાશ", hi: "प्रकाश", mr: "प्रकाश" },
  "ravi": { gu: "રવિ", hi: "रवि", mr: "रवि" },
  "kishore": { gu: "કિશોર", hi: "किशोर", mr: "किशोर" },
  "santosh": { gu: "સંતોષ", hi: "संतोष", mr: "संतोष" },
  "gopal": { gu: "ગોપાલ", hi: "गोपाल", mr: "गोपाल" },
  "mohan": { gu: "મોહન", hi: "मोहन", mr: "मोहन" },
  "sohan": { gu: "સોહન", hi: "सोहन", mr: "सोहन" },
  "kiran": { gu: "કિરણ", hi: "किरण", mr: "किरण" },
  "ketan": { gu: "કેતન", hi: "केतन", mr: "केतन" },
  "chetan": { gu: "ચેતન", hi: "चेतन", mr: "चेतन" },
  "chirag": { gu: "ચિરાગ", hi: "चिराग", mr: "चिराग" },
  "anand": { gu: "આનંદ", hi: "आनंद", mr: "आनंद" },
  "bharat": { gu: "ભારત", hi: "भारत", mr: "भारत" },
  "jayesh": { gu: "જયેશ", hi: "जयेश", mr: "जयेश" },
  "mayur": { gu: "મયૂર", hi: "मयूर", mr: "मयूर" },
  "pankaj": { gu: "પંકજ", hi: "पंकज", mr: "पंकज" },

  // Common female names
  "kavita": { gu: "કવિતા", hi: "कविता", mr: "कविता" },
  "anita": { gu: "અનિતા", hi: "अनिता", mr: "अनिता" },
  "sunita": { gu: "સુનિતા", hi: "सुनीता", mr: "सुनीता" },
  "pooja": { gu: "પૂજા", hi: "पूजा", mr: "पूजा" },
  "puja": { gu: "પૂજા", hi: "पूजा", mr: "पूजा" },
  "priya": { gu: "પ્રિયા", hi: "प्रिया", mr: "प्रिया" },
  "neha": { gu: "નેહા", hi: "नेहा", mr: "नेहा" },
  "garvita": { gu: "ગર્વિતા", hi: "गर्विता", mr: "गर्विता" },
  "richa": { gu: "રીચા", hi: "ऋचा", mr: "ऋचा" },
  "rekha": { gu: "રેખા", hi: "रेखा", mr: "रेखा" },
  "geeta": { gu: "ગીતા", hi: "गीता", mr: "गीता" },
  "gita": { gu: "ગીતા", hi: "गीता", mr: "गीता" },
  "seeta": { gu: "સીતા", hi: "सीता", mr: "सीता" },
  "sita": { gu: "સીતા", hi: "सीता", mr: "सीता" },
  "radha": { gu: "રાધા", hi: "राधा", mr: "राधा" },
  "meena": { gu: "મીના", hi: "मीना", mr: "मीना" },
  "mina": { gu: "મીના", hi: "मीना", mr: "मीना" },
  "reena": { gu: "રીના", hi: "रीना", mr: "रीना" },
  "rina": { gu: "રીના", hi: "रीना", mr: "रीना" },
  "shobha": { gu: "શોભા", hi: "शोभा", mr: "शोभा" },

  // Common surnames / community names
  "patel": { gu: "પટેલ", hi: "पटेल", mr: "पटेल" },
  "shah": { gu: "શાહ", hi: "शाह", mr: "शाह" },
  "mehta": { gu: "મહેતા", hi: "मेहता", mr: "मेहता" },
  "joshi": { gu: "જોશી", hi: "जोशी", mr: "जोशी" },
  "sharma": { gu: "શર્મા", hi: "शर्मा", mr: "शर्मा" },
  "verma": { gu: "વર્મા", hi: "वर्मा", mr: "वर्मा" },
  "gupta": { gu: "ગુપ્તા", hi: "गुप्ता", mr: "गुप्ता" },
  "agarwal": { gu: "અગ્રવાલ", hi: "अग्रवाल", mr: "अग्रवाल" },
  "yadav": { gu: "યાદવ", hi: "यादव", mr: "यादव" },
  "prajapati": { gu: "પ્રજાપતિ", hi: "प्रजापति", mr: "प्रजापती" },
  "solanki": { gu: "સોલંકી", hi: "सोलंकी", mr: "सोलंकी" },
  "parmar": { gu: "પરમાર", hi: "परमार", mr: "परमार" },
  "rathod": { gu: "રાઠોડ", hi: "राठौड़", mr: "राठोड" },
  "chauhan": { gu: "ચૌહાણ", hi: "चौहान", mr: "चौहान" },
  "makwana": { gu: "મકવાણા", hi: "मकवाणा", mr: "मकवाणा" },
  "desai": { gu: "દેસાઈ", hi: "देसाई", mr: "देसाई" },
  "gandhi": { gu: "ગાંધી", hi: "गांधी", mr: "गांधी" },
  "pandya": { gu: "પંડ્યા", hi: "पंड्या", mr: "पंड्या" },
  "shukla": { gu: "શુક્લા", hi: "शुक्ला", mr: "शुक्ला" },
  "mishra": { gu: "મિશ્રા", hi: "मिश्रा", mr: "मिश्रा" }
};

/**
 * Phonetic letter-to-script mapping for words not found in the dictionary
 */
const PHONETIC_MAP = {
  gu: {
    bh: "ભ", ch: "ચ", chh: "છ", dh: "ધ", gh: "ઘ", jh: "ઝ", kh: "ખ", ph: "ફ", sh: "શ", th: "થ",
    b: "બ", c: "ક", d: "દ", f: "ફ", g: "ગ", h: "હ", j: "જ", k: "ક", l: "લ", m: "મ", n: "ન",
    p: "પ", r: "ર", s: "સ", t: "ત", v: "વ", w: "વ", y: "ય", z: "ઝ",
    a: "", aa: "ા", i: "િ", ee: "ી", u: "ુ", oo: "ૂ", e: "ે", ai: "ૈ", o: "ો", au: "ૌ"
  },
  hi: {
    bh: "भ", ch: "च", chh: "छ", dh: "ध", gh: "घ", jh: "झ", kh: "ख", ph: "फ", sh: "श", th: "थ",
    b: "ब", c: "क", d: "द", f: "फ", g: "ग", h: "ह", j: "ज", k: "क", l: "ल", m: "म", n: "न",
    p: "प", r: "र", s: "स", t: "त", v: "व", w: "व", y: "य", z: "ज़",
    a: "", aa: "ा", i: "ि", ee: "ी", u: "ु", oo: "ू", e: "े", ai: "ै", o: "ो", au: "ौ"
  },
  mr: {
    bh: "भ", ch: "च", chh: "छ", dh: "ध", gh: "घ", jh: "झ", kh: "ख", ph: "फ", sh: "श", th: "थ",
    b: "ब", c: "क", d: "द", f: "फ", g: "ग", h: "ह", j: "ज", k: "क", l: "ल", m: "म", n: "न",
    p: "प", r: "र", s: "स", t: "त", v: "व", w: "व", y: "य", z: "झ",
    a: "", aa: "ा", i: "ि", ee: "ी", u: "ु", oo: "ू", e: "े", ai: "ै", o: "ो", au: "ौ"
  }
};

/**
 * Phonetically transliterates a single English word into the target language.
 */
function transliterateWord(word, lang) {
  const clean = word.toLowerCase().trim();
  if (!clean) return "";

  // 1. Direct dictionary match
  if (DICTIONARY[clean]?.[lang]) {
    return DICTIONARY[clean][lang];
  }

  // 2. Fallback to original if English or unsupported
  if (!PHONETIC_MAP[lang]) {
    return word;
  }

  // 3. Simple phonetic mapping
  const map = PHONETIC_MAP[lang];
  let res = "";
  let i = 0;
  while (i < clean.length) {
    if (i + 3 <= clean.length && map[clean.slice(i, i + 3)]) {
      res += map[clean.slice(i, i + 3)];
      i += 3;
    } else if (i + 2 <= clean.length && map[clean.slice(i, i + 2)]) {
      res += map[clean.slice(i, i + 2)];
      i += 2;
    } else if (map[clean[i]]) {
      res += map[clean[i]];
      i += 1;
    } else {
      res += clean[i];
      i += 1;
    }
  }

  return res || word;
}

/**
 * Localizes a customer name according to the active store language.
 * When language is 'en', returns the original English string.
 * When language is 'gu', 'hi', or 'mr', translates/transliterates the name.
 * 
 * @param {string} rawName - The customer name in database (e.g. "Suresh Bhai", "Walk-in Customer")
 * @param {string} language - The active language code ("en", "gu", "hi", "mr")
 * @returns {string} - Localized customer name
 */
export function localizeCustomerName(rawName, language = "en") {
  if (!rawName || typeof rawName !== "string") {
    return language === "gu"
      ? "સામાન્ય ગ્રાહક (વૉક-ઇન)"
      : language === "hi"
      ? "सामान्य ग्राहक (वॉक-इन)"
      : language === "mr"
      ? "सामान्य ग्राहक (वॉक-इन)"
      : "Walk-in Customer";
  }

  const trimmed = rawName.trim();
  const lower = trimmed.toLowerCase();

  // Handle Walk-in Customer
  if (lower === "walk-in" || lower === "walk-in customer" || lower === "walk in" || lower.includes("walk-in")) {
    switch (language) {
      case "gu":
        return "સામાન્ય ગ્રાહક (વૉક-ઇન)";
      case "hi":
        return "सामान्य ग्राहक (वॉक-इन)";
      case "mr":
        return "सामान्य ग्राहक (वॉक-इन)";
      case "en":
      default:
        return "Walk-in Customer";
    }
  }

  // If language is English, keep Latin script exactly as entered
  if (language === "en" || !language) {
    return trimmed;
  }

  // Transliterate each token
  const tokens = trimmed.split(/\s+/);
  const localizedTokens = tokens.map((token) => transliterateWord(token, language));

  return localizedTokens.join(" ");
}

export default localizeCustomerName;

/**
 * CASEVAULT OCR Text Parser
 * 
 * Modular label-based entity extraction for official law enforcement, judicial, and administration ID cards.
 * Recognizes diverse card layouts, label spellings, and unstructured text lines.
 */

import { mapRankToCategoryAndRank } from './rankCategoryMapper.js';

/**
 * Normalizes and formats Indian phone numbers (+91 XXXXX XXXXX or 10-digit)
 */
export const normalizePhoneNumber = (rawPhone) => {
  if (!rawPhone) return '';
  const digits = rawPhone.replace(/[^0-9]/g, '');
  if (digits.length === 10) {
    return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
  }
  if (digits.length === 12 && digits.startsWith('91')) {
    const num = digits.slice(2);
    return `+91 ${num.slice(0, 5)} ${num.slice(5)}`;
  }
  if (digits.length > 10) {
    const num = digits.slice(-10);
    return `+91 ${num.slice(0, 5)} ${num.slice(5)}`;
  }
  return rawPhone.trim();
};

/**
 * Cleans string tokens from OCR noise & punctuation
 */
const cleanValue = (str) => {
  if (!str) return '';
  return str
    .replace(/^[:\s\-#|=]+|[:\s\-#|=]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
};

/**
 * Checks if a string is a decorative label token (to prevent capturing titles/watermarks)
 */
const isDecorativeOrHeaderTitle = (str) => {
  if (!str) return false;
  return /^(?:ADMINISTRATOR\s*IDENTITY\s*CARD|LEGAL\s*OFFICER\s*IDENTITY\s*CARD|OFFICE\s*IDENTITY\s*CARD|POLICE\s*IDENTITY\s*CARD|GOVERNMENT\s*OF\s*INDIA|IDENTITY\s*CARD|ID\s*CARD)$/i.test(str.trim());
};

/**
 * Main parser function: processes raw OCR text string and extracts structured fields
 */
export const parseIdCardText = (rawText) => {
  const defaultResult = {
    officerId: '',
    name: '',
    rank: '',
    designation: '',
    policeStation: '',
    email: '',
    phone: '',
    categoryKey: 'police_officer',
    categoryLabel: 'Officer',
    rawText: rawText || '',
    confidence: {
      officerId: false,
      name: false,
      rank: false,
      policeStation: false,
      email: false,
      phone: false
    }
  };

  if (!rawText || typeof rawText !== 'string' || !rawText.trim()) {
    return defaultResult;
  }

  const text = rawText.trim();
  const lines = text
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l.length > 0 && !isDecorativeOrHeaderTitle(l));

  const res = { ...defaultResult };

  // ================= 1. CARD TITLE & CATEGORY AUTO-DETECTION =================
  let isExplicitLegalOfficerCard = /LEGAL\s*OFFICER\s*(?:IDENTITY\s*CARD|CARD|DEPT)?/i.test(text);
  let isExplicitAdminCard = /ADMINISTRATOR\s*(?:IDENTITY\s*CARD|CARD|DEPT)?/i.test(text);

  // ================= 2. REGEX EXTRACTORS (FULL TEXT SEARCH) =================

  // 2A. Email Address Extraction (e.g. sureshkumarsah268@gmail.com)
  const emailRegex = /\b([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b/i;
  const emailMatch = text.match(emailRegex);
  if (emailMatch) {
    res.email = emailMatch[1].toLowerCase();
    res.confidence.email = true;
  }

  // 2B. Phone Number Extraction (e.g. +91 7478754133 or 7478754133)
  const phoneRegex = /(?:\+?91[\s-]?)?([6-9]\d{9})\b|\b([6-9]\d{4}[\s-]?\d{5})\b/;
  const phoneMatch = text.match(phoneRegex);
  if (phoneMatch) {
    res.phone = normalizePhoneNumber(phoneMatch[0]);
    res.confidence.phone = true;
  }

  // ================= 3. LINE-BY-LINE LABEL PARSING =================
  let rawExtractedDesignation = '';
  let rawExtractedRank = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const nextLine = i + 1 < lines.length ? lines[i + 1] : '';

    // --- A. OFFICER ID / ADMINISTRATOR ID / BADGE ID ---
    // Labels: "Administrator ID:", "Admin ID:", "Officer Batch ID:", "Batch ID:", "Officer ID:", "Badge ID:", "ID No:"
    if (!res.officerId) {
      const sameLineIdRx = /(?:Administrator\s*ID|Admin\s*ID|Officer\s*Batch\s*ID|Batch\s*ID|Officer\s*ID|Badge\s*ID|ID\s*No\.?)[\s.:#-]+([A-Z0-9][A-Z0-9/\s.-]{1,20})/i;
      const m = line.match(sameLineIdRx);
      if (m) {
        const candidate = cleanValue(m[1]).toUpperCase();
        if (candidate.length >= 2) {
          res.officerId = candidate.replace(/\s+/g, '-');
          res.confidence.officerId = true;
        }
      } else {
        const labelOnlyIdRx = /^(?:Administrator\s*ID|Admin\s*ID|Officer\s*Batch\s*ID|Batch\s*ID|Officer\s*ID|Badge\s*ID|ID\s*No\.?)[\s.:#-]*$/i;
        if (labelOnlyIdRx.test(line) && nextLine) {
          const candidate = cleanValue(nextLine).toUpperCase();
          if (candidate.length >= 2 && !/name|rank|designation|email|phone/i.test(candidate)) {
            res.officerId = candidate.replace(/\s+/g, '-');
            res.confidence.officerId = true;
          }
        }
      }
    }

    // --- B. OFFICER NAME ---
    // Labels: "Officer Name:", "Name of Officer:", "Name:"
    if (!res.name) {
      const sameLineNameRx = /(?:Officer\s*Name|Name\s*of\s*Officer|Name)[\s.:#-]+([A-Za-z\s.]{3,35})/i;
      const m = line.match(sameLineNameRx);
      if (m) {
        const candidate = cleanValue(m[1]);
        if (!/police|government|india|department|badge|rank|station|id|legal|officer|administrator/i.test(candidate)) {
          res.name = candidate;
          res.confidence.name = true;
        }
      } else {
        const labelOnlyNameRx = /^(?:Officer\s*Name|Name\s*of\s*Officer|Name)[\s.:#-]*$/i;
        if (labelOnlyNameRx.test(line) && nextLine) {
          const candidate = cleanValue(nextLine);
          if (candidate.length >= 3 && !/police|government|india|department|station|rank|designation/i.test(candidate)) {
            res.name = candidate;
            res.confidence.name = true;
          }
        }
      }
    }

    // --- C. DESIGNATION (Explicit) ---
    // Label: "Designation:" (e.g. System Administrator, Asst. Public Prosecutor (APP))
    if (!rawExtractedDesignation) {
      const desigRx = /(?:Designation|Desig|Post)[\s.:#-]+([A-Za-z0-9\s.()-]{2,45})/i;
      const m = line.match(desigRx);
      if (m) {
        rawExtractedDesignation = cleanValue(m[1]);
      }
    }

    // --- D. RANK (Explicit) ---
    // Label: "Rank:" (e.g. System Administrator, Legal officer)
    if (!rawExtractedRank) {
      const rankRx = /(?:Rank)[\s.:#-]+([A-Za-z0-9\s.-]{2,45})/i;
      const m = line.match(rankRx);
      if (m) {
        rawExtractedRank = cleanValue(m[1]);
      }
    }

    // --- E. POLICE STATION / DEPARTMENT / OFFICE LOCATION ---
    // Labels: "Department / Unit:", "Office / Location:", "Police Station / Unit:", "Police Station:"
    if (!res.policeStation) {
      const psRx = /(?:Police\s*Station\s*\/\s*Unit|Police\s*Station|Station|Thana|P\.?S\.?|Department\s*\/\s*Unit|Office\s*\/\s*Location|Department|Unit|Location)[\s.:#-]+([A-Za-z0-9\s.-]{3,45})/i;
      const m = line.match(psRx);
      if (m) {
        let candidate = cleanValue(m[1]);
        if (candidate && !/badge|id|name|rank|email|phone/i.test(candidate)) {
          res.policeStation = candidate;
          res.confidence.policeStation = true;
        }
      }
    }
  }

  // ================= 4. RANK & CATEGORY NORMALIZATION =================
  let chosenRankString = rawExtractedDesignation || rawExtractedRank || text;

  if (isExplicitAdminCard || /(?:system\s*administrator|system\s*admin|administrator)/i.test(chosenRankString)) {
    res.rank = 'System Administrator';
    res.designation = 'System Administrator';
    res.categoryKey = 'administrator';
    res.categoryLabel = 'Administrator';
    res.confidence.rank = true;
  } else if (/(?:asst\.?\s*public\s*prosecutor|assistant\s*public\s*prosecutor|\bapp\b)/i.test(chosenRankString) || (isExplicitLegalOfficerCard && /prosecutor/i.test(chosenRankString))) {
    res.rank = 'Assistant Public Prosecutor (APP)';
    res.designation = 'Assistant Public Prosecutor (APP)';
    res.categoryKey = 'legal_officer';
    res.categoryLabel = 'Legal Officer';
    res.confidence.rank = true;
  } else {
    const mapped = mapRankToCategoryAndRank(chosenRankString);
    res.categoryKey = isExplicitAdminCard ? 'administrator' : isExplicitLegalOfficerCard ? 'legal_officer' : mapped.categoryKey;
    res.categoryLabel = isExplicitAdminCard ? 'Administrator' : isExplicitLegalOfficerCard ? 'Legal Officer' : mapped.categoryLabel;
    res.rank = mapped.rank;
    res.designation = mapped.rank;
    if (res.rank) res.confidence.rank = true;
  }

  // ================= 5. BADGE ID FALLBACK =================
  if (!res.officerId) {
    const badgePattern = text.match(/\b([A-Z]{2,4}[- /]?[A-Z0-9]{2,5}[- /]?[0-9]{3,6})\b/i);
    if (badgePattern && !/^(?:ENG|JPG|PNG|PDF|GOVT|POLICE|LEGAL|ADM)$/i.test(badgePattern[1])) {
      res.officerId = badgePattern[1].toUpperCase().replace(/\s+/g, '-');
      res.confidence.officerId = true;
    }
  }

  return res;
};

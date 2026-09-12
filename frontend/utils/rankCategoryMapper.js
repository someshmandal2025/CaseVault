/**
 * CASEVAULT Rank & Category Mapper Utility
 * 
 * Maps law enforcement and judicial rank/designation titles to the four canonical
 * CASEVAULT top-level officer categories:
 * - OFFICER (police_officer)
 * - SENIOR OFFICER (senior_officer)
 * - LEGAL OFFICER (legal_officer)
 * - ADMINISTRATOR (administrator)
 */

export const CATEGORY_MAP = {
  police_officer: {
    label: 'Officer',
    badgeIcon: '👮',
    badgeClass: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    ranks: ['Constable', 'Head Constable', 'ASI', 'SI']
  },
  senior_officer: {
    label: 'Senior Officer',
    badgeIcon: '⭐',
    badgeClass: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
    ranks: ['Inspector', 'ACP / DSP', 'Addl. SP', 'SP / SSP', 'DIG', 'IG', 'ADGP', 'DGP']
  },
  legal_officer: {
    label: 'Legal Officer',
    badgeIcon: '⚖️',
    badgeClass: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    ranks: ['Legal Officer', 'Public Prosecutor', 'Legal Advisor', 'Law Officer']
  },
  administrator: {
    label: 'Administrator',
    badgeIcon: '🛡️',
    badgeClass: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    ranks: ['System Administrator', 'Administrative Officer', 'Department Administrator', 'IT / System Manager']
  }
};

/**
 * Normalizes category key from user input or DB value
 */
export const normalizeCategoryKey = (catInput) => {
  if (!catInput) return 'police_officer';
  const c = String(catInput).toLowerCase().trim().replace(/[\s_-]+/g, '');

  if (c.includes('senior')) return 'senior_officer';
  if (c.includes('legal') || c.includes('prosecutor') || c.includes('law')) return 'legal_officer';
  if (c.includes('admin') || c.includes('system') || c.includes('manager')) return 'administrator';
  if (c.includes('officer') || c.includes('police')) return 'police_officer';

  return 'police_officer';
};

/**
 * Returns permitted ranks for a given category key or category label
 */
export const getPermittedRanksForCategory = (categoryInput) => {
  const key = normalizeCategoryKey(categoryInput);
  if (key === 'police_officer') return ['Constable', 'Head Constable', 'ASI', 'SI'];
  if (key === 'senior_officer') return ['Inspector', 'ACP / DSP', 'Addl. SP', 'SP / SSP', 'DIG', 'IG', 'ADGP', 'DGP'];
  if (key === 'legal_officer') return ['Legal Officer', 'Public Prosecutor', 'Legal Advisor', 'Law Officer'];
  if (key === 'administrator') return ['System Administrator', 'Administrative Officer', 'Department Administrator', 'IT / System Manager'];
  return ['Constable', 'Head Constable', 'ASI', 'SI'];
};

/**
 * Automatically maps a raw or normalized rank string to the appropriate CASEVAULT Category and standard Rank.
 * Examples:
 * - DGP -> Senior Officer -> DGP
 * - Inspector -> Senior Officer -> Inspector
 * - SI -> Officer -> SI
 * - Constable -> Officer -> Constable
 * - Assistant Public Prosecutor (APP) -> Legal Officer -> Public Prosecutor
 * - System Administrator -> Administrator -> System Administrator
 */
export const mapRankToCategoryAndRank = (rawRank) => {
  if (!rawRank) {
    return {
      categoryKey: 'police_officer',
      categoryLabel: 'Officer',
      rank: 'Constable'
    };
  }

  const clean = String(rawRank).trim();
  const lower = clean.toLowerCase();

  // 1. ADMINISTRATOR Category
  if (/(?:system\s*admin(?:istrator)?|sys\s*admin)/i.test(lower)) {
    return { categoryKey: 'administrator', categoryLabel: 'Administrator', rank: 'System Administrator' };
  }
  if (/(?:admin(?:istrative)?\s*officer|admin\s*off)/i.test(lower)) {
    return { categoryKey: 'administrator', categoryLabel: 'Administrator', rank: 'Administrative Officer' };
  }
  if (/(?:dept|department)\s*admin(?:istrator)?/i.test(lower)) {
    return { categoryKey: 'administrator', categoryLabel: 'Administrator', rank: 'Department Administrator' };
  }
  if (/(?:it\s*manager|system\s*manager|it\s*\/\s*system\s*manager)/i.test(lower)) {
    return { categoryKey: 'administrator', categoryLabel: 'Administrator', rank: 'IT / System Manager' };
  }

  // 2. LEGAL OFFICER Category
  if (/(?:asst\.?\s*public\s*prosecutor|assistant\s*public\s*prosecutor|\bapp\b)/i.test(lower)) {
    return { categoryKey: 'legal_officer', categoryLabel: 'Legal Officer', rank: 'Public Prosecutor' };
  }
  if (/(?:public\s*prosecutor|\bpp\b)/i.test(lower)) {
    return { categoryKey: 'legal_officer', categoryLabel: 'Legal Officer', rank: 'Public Prosecutor' };
  }
  if (/(?:legal\s*advisor)/i.test(lower)) {
    return { categoryKey: 'legal_officer', categoryLabel: 'Legal Officer', rank: 'Legal Advisor' };
  }
  if (/(?:law\s*officer)/i.test(lower)) {
    return { categoryKey: 'legal_officer', categoryLabel: 'Legal Officer', rank: 'Law Officer' };
  }
  if (/(?:legal\s*officer)/i.test(lower)) {
    return { categoryKey: 'legal_officer', categoryLabel: 'Legal Officer', rank: 'Legal Officer' };
  }

  // 3. SENIOR OFFICER Category
  if (/\bips\b|indian\s*police\s*service/i.test(lower)) {
    return { categoryKey: 'senior_officer', categoryLabel: 'Senior Officer', rank: 'SP / SSP' };
  }
  if (/\bdgp\b|director\s*general/i.test(lower)) {
    return { categoryKey: 'senior_officer', categoryLabel: 'Senior Officer', rank: 'DGP' };
  }
  if (/\badgp\b|additional\s*director\s*general/i.test(lower)) {
    return { categoryKey: 'senior_officer', categoryLabel: 'Senior Officer', rank: 'ADGP' };
  }
  if (/\bigp?\b|inspector\s*general/i.test(lower)) {
    return { categoryKey: 'senior_officer', categoryLabel: 'Senior Officer', rank: 'IG' };
  }
  if (/\bdig\b|deputy\s*inspector\s*general/i.test(lower)) {
    return { categoryKey: 'senior_officer', categoryLabel: 'Senior Officer', rank: 'DIG' };
  }
  if (/\bssp\b|senior\s*superintendent/i.test(lower)) {
    return { categoryKey: 'senior_officer', categoryLabel: 'Senior Officer', rank: 'SP / SSP' };
  }
  if (/\bsp\b|superintendent\s*of\s*police/i.test(lower) && !/addl|additional|dy|deputy/i.test(lower)) {
    return { categoryKey: 'senior_officer', categoryLabel: 'Senior Officer', rank: 'SP / SSP' };
  }
  if (/\baddl\.?\s*sp\b|additional\s*superintendent/i.test(lower)) {
    return { categoryKey: 'senior_officer', categoryLabel: 'Senior Officer', rank: 'Addl. SP' };
  }
  if (/\b(?:acp|dsp|dy\.?\s*sp)\b|assistant\s*commissioner|deputy\s*superintendent/i.test(lower)) {
    return { categoryKey: 'senior_officer', categoryLabel: 'Senior Officer', rank: 'ACP / DSP' };
  }
  if (/\binsp(?:ector)?\b|police\s*inspector/i.test(lower)) {
    return { categoryKey: 'senior_officer', categoryLabel: 'Senior Officer', rank: 'Inspector' };
  }

  // 4. OFFICER Category
  if (/\bsi\b|sub[- ]?inspector|police\s*sub[- ]?inspector/i.test(lower)) {
    return { categoryKey: 'police_officer', categoryLabel: 'Officer', rank: 'SI' };
  }
  if (/\basi\b|assistant\s*sub[- ]?inspector/i.test(lower)) {
    return { categoryKey: 'police_officer', categoryLabel: 'Officer', rank: 'ASI' };
  }
  if (/\bhc\b|head\s*constable/i.test(lower)) {
    return { categoryKey: 'police_officer', categoryLabel: 'Officer', rank: 'Head Constable' };
  }
  if (/\bconstable\b|const\.?|pc\b/i.test(lower)) {
    return { categoryKey: 'police_officer', categoryLabel: 'Officer', rank: 'Constable' };
  }

  // Fallback default
  return { categoryKey: 'police_officer', categoryLabel: 'Officer', rank: 'Constable' };
};

/**
 * Validates whether a given rank is valid for a selected category key
 */
export const isValidCategoryRankPair = (categoryKey, rankStr) => {
  const validRanks = getPermittedRanksForCategory(categoryKey);
  if (!rankStr) return false;
  return validRanks.some(r => r.toLowerCase() === rankStr.toLowerCase() || rankStr.toLowerCase().includes(r.toLowerCase()));
};

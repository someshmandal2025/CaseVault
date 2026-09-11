/**
 * CASEVAULT OCR Field Validator
 * 
 * Validates image uploads, email/phone formats, and confidence indicators.
 */

export const SUPPORTED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
export const SUPPORTED_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp'];

/**
 * Validates whether uploaded file is a supported image format (PNG, JPG, JPEG, WEBP)
 */
export const isValidIdCardImage = (file) => {
  if (!file) {
    return { valid: false, message: 'Please select an official identity card image.' };
  }

  const name = file.name ? file.name.toLowerCase() : '';
  const type = file.type ? file.type.toLowerCase() : '';

  const isTypeSupported = SUPPORTED_IMAGE_TYPES.some(t => type === t || type.includes(t.replace('image/', '')));
  const isExtSupported = SUPPORTED_EXTENSIONS.some(ext => name.endsWith(ext));

  if (!isTypeSupported && !isExtSupported) {
    return {
      valid: false,
      message: 'Supported image formats: PNG, JPG, JPEG, WEBP.'
    };
  }

  // Size limit check (max 15MB)
  if (file.size && file.size > 15 * 1024 * 1024) {
    return {
      valid: false,
      message: 'Image size exceeds 15MB limit. Please upload a smaller image file.'
    };
  }

  return { valid: true, message: '' };
};

/**
 * Evaluates extracted OCR field values and returns warning status for low-confidence fields
 */
export const evaluateFieldConfidence = (extractedData) => {
  const LOW_CONFIDENCE_MSG = 'OCR could not confidently detect this field';

  const confidenceFlags = {
    officerId: Boolean(extractedData?.officerId && extractedData.officerId.length >= 2),
    name: Boolean(extractedData?.name && extractedData.name.length >= 2),
    rank: Boolean(extractedData?.rank),
    policeStation: Boolean(extractedData?.policeStation),
    email: Boolean(extractedData?.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(extractedData.email)),
    phone: Boolean(extractedData?.phone && extractedData.phone.length >= 10)
  };

  const fieldWarnings = {
    officerId: confidenceFlags.officerId ? '' : LOW_CONFIDENCE_MSG,
    name: confidenceFlags.name ? '' : LOW_CONFIDENCE_MSG,
    rank: confidenceFlags.rank ? '' : LOW_CONFIDENCE_MSG,
    policeStation: confidenceFlags.policeStation ? '' : LOW_CONFIDENCE_MSG,
    email: confidenceFlags.email ? '' : LOW_CONFIDENCE_MSG,
    phone: confidenceFlags.phone ? '' : LOW_CONFIDENCE_MSG
  };

  const lowConfidenceFieldsCount = Object.values(confidenceFlags).filter(flag => !flag).length;

  return {
    confidenceFlags,
    fieldWarnings,
    hasLowConfidenceFields: lowConfidenceFieldsCount > 0,
    lowConfidenceFieldsCount,
    LOW_CONFIDENCE_MSG
  };
};

/**
 * Validates mandatory registration fields before final submission
 */
export const validateRegistrationFields = (formData) => {
  const errors = {};

  if (!formData.categoryKey) errors.categoryKey = 'Category is required.';
  if (!formData.rank) errors.rank = 'Rank / Designation is required.';
  if (!formData.name || !formData.name.trim()) errors.name = 'Officer Name is required.';
  if (!formData.officerId || !formData.officerId.trim()) errors.officerId = 'Officer ID / Badge ID is required.';
  if (!formData.email || !formData.email.trim()) {
    errors.email = 'Official Email is required.';
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
    errors.email = 'Please enter a valid official email address.';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
};

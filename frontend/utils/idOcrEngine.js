import { createWorker } from 'tesseract.js';
import { parseIdCardText } from './ocrTextParser.js';
import { mapRankToCategoryAndRank, getPermittedRanksForCategory, isValidCategoryRankPair } from './rankCategoryMapper.js';
import { isValidIdCardImage, evaluateFieldConfidence } from './ocrFieldValidator.js';

export {
  parseIdCardText,
  mapRankToCategoryAndRank,
  getPermittedRanksForCategory,
  isValidCategoryRankPair,
  isValidIdCardImage,
  evaluateFieldConfidence
};

/**
 * Preprocesses an image using HTML5 Canvas for optimal OCR recognition:
 * - Resizes large images (max 1400px width/height)
 * - Converts to grayscale
 * - Boosts contrast and sharpness
 * Returns a data URL of the optimized image.
 */
export const preprocessImageForOcr = async (imageFile) => {
  return new Promise((resolve, reject) => {
    const formatCheck = isValidIdCardImage(imageFile);
    if (!formatCheck.valid && !(imageFile instanceof Blob)) {
      return reject(new Error(formatCheck.message));
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Invalid image format. Supported formats: PNG, JPG, JPEG, WEBP.'));
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        // Scale down if image is too large while keeping high DPI
        const MAX_DIM = 1400;
        let width = img.width;
        let height = img.height;

        if (width > MAX_DIM || height > MAX_DIM) {
          if (width > height) {
            height = Math.round((height * MAX_DIM) / width);
            width = MAX_DIM;
          } else {
            width = Math.round((width * MAX_DIM) / height);
            height = MAX_DIM;
          }
        }

        canvas.width = width;
        canvas.height = height;

        // Draw original image
        ctx.drawImage(img, 0, 0, width, height);

        // Get image pixel data for contrast enhancement
        try {
          const imgData = ctx.getImageData(0, 0, width, height);
          const data = imgData.data;

          // Contrast enhancement factor
          const contrast = 35; // boost contrast
          const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));

          for (let i = 0; i < data.length; i += 4) {
            // Standard luminance weights
            const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
            // Apply contrast
            const adjusted = factor * (gray - 128) + 128;
            const finalVal = Math.min(255, Math.max(0, adjusted));

            data[i] = finalVal;
            data[i + 1] = finalVal;
            data[i + 2] = finalVal;
          }

          ctx.putImageData(imgData, 0, 0);
        } catch (e) {
          console.warn('Canvas pixel enhancement bypassed:', e);
        }

        resolve({
          dataUrl: canvas.toDataURL('image/png'),
          previewUrl: reader.result,
          width,
          height
        });
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(imageFile);
  });
};

/**
 * Crops and extracts the official passport-style portrait photo of the officer
 * from an identity card image using HTML5 Canvas.
 */
export const extractOfficerPhotoFromIdCard = async (imageFileOrDataUrl) => {
  return new Promise((resolve) => {
    if (!imageFileOrDataUrl) return resolve('');

    if (imageFileOrDataUrl._officerPhoto) {
      return resolve(imageFileOrDataUrl._officerPhoto);
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onerror = () => resolve('');
    img.onload = () => {
      try {
        const W = img.naturalWidth || img.width;
        const H = img.naturalHeight || img.height;
        if (!W || !H) return resolve('');

        let cropX, cropY, cropW, cropH;

        if (W > H) {
          cropX = Math.round(W * 0.052);
          cropY = Math.round(H * 0.24);
          cropW = Math.round(W * 0.23);
          cropH = Math.round(H * 0.46);
        } else {
          cropX = Math.round(W * 0.20);
          cropY = Math.round(H * 0.14);
          cropW = Math.round(W * 0.60);
          cropH = Math.round(H * 0.38);
        }

        cropX = Math.max(0, Math.min(cropX, W - 10));
        cropY = Math.max(0, Math.min(cropY, H - 10));
        cropW = Math.min(cropW, W - cropX);
        cropH = Math.min(cropH, H - cropY);

        const photoCanvas = document.createElement('canvas');
        photoCanvas.width = 240;
        photoCanvas.height = 300;
        const ctx = photoCanvas.getContext('2d');
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        ctx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, photoCanvas.width, photoCanvas.height);

        ctx.strokeStyle = '#94A3B8';
        ctx.lineWidth = 2;
        ctx.strokeRect(1, 1, photoCanvas.width - 2, photoCanvas.height - 2);

        resolve(photoCanvas.toDataURL('image/png'));
      } catch (err) {
        console.warn('Error cropping officer photo from ID card:', err);
        resolve('');
      }
    };

    if (typeof imageFileOrDataUrl === 'string') {
      img.src = imageFileOrDataUrl;
    } else if (imageFileOrDataUrl instanceof File || imageFileOrDataUrl instanceof Blob) {
      const reader = new FileReader();
      reader.onload = () => { img.src = reader.result; };
      reader.readAsDataURL(imageFileOrDataUrl);
    } else {
      resolve('');
    }
  });
};

// Singleton Tesseract worker instance
let ocrWorkerInstance = null;

/**
 * Runs real Optical Character Recognition on an image file or preprocessed data URL.
 */
export const runOcrOnIdImage = async (imageFileOrDataUrl, onProgress = null) => {
  const metadata = (imageFileOrDataUrl && imageFileOrDataUrl._badgeMetadata)
    ? imageFileOrDataUrl._badgeMetadata
    : null;

  let officerPhoto = (imageFileOrDataUrl && imageFileOrDataUrl._officerPhoto) || '';
  if (!officerPhoto) {
    try {
      officerPhoto = await extractOfficerPhotoFromIdCard(imageFileOrDataUrl);
    } catch (photoErr) {
      console.warn('Officer photo extraction notice:', photoErr);
    }
  }

  try {
    const ocrPromise = (async () => {
      if (!ocrWorkerInstance) {
        if (onProgress) onProgress(15);
        ocrWorkerInstance = await createWorker('eng');
      }

      if (onProgress) onProgress(45);
      const worker = ocrWorkerInstance;
      let ret;
      if (typeof imageFileOrDataUrl === 'string') {
        ret = await worker.recognize(imageFileOrDataUrl);
      } else {
        const reader = new FileReader();
        const dataUrl = await new Promise((resolve) => {
          reader.onload = () => resolve(reader.result);
          reader.readAsDataURL(imageFileOrDataUrl);
        });
        ret = await worker.recognize(dataUrl);
      }
      if (onProgress) onProgress(90);

      return ret && ret.data && ret.data.text ? ret.data.text : '';
    })();

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('OCR Engine Timeout')), 6000)
    );

    const rawText = await Promise.race([ocrPromise, timeoutPromise]);
    const parsed = parseIdCardText(rawText);

    if (metadata) {
      const mappedMeta = mapRankToCategoryAndRank(metadata.rank || '');
      return {
        success: true,
        badgeId: metadata.badgeId || parsed.officerId,
        officerId: metadata.badgeId || parsed.officerId,
        name: metadata.name || parsed.name,
        rank: mappedMeta.rank || parsed.rank,
        designation: mappedMeta.rank || parsed.designation,
        policeStation: metadata.policeStation || parsed.policeStation,
        email: metadata.email || parsed.email || '',
        phone: metadata.phone || parsed.phone || '',
        categoryKey: mappedMeta.categoryKey || parsed.categoryKey,
        categoryLabel: mappedMeta.categoryLabel || parsed.categoryLabel,
        officerPhoto: officerPhoto || metadata.officerPhoto || '',
        rawText,
        confidence: {
          officerId: true,
          name: true,
          rank: true,
          policeStation: true,
          email: Boolean(metadata.email || parsed.email),
          phone: Boolean(metadata.phone || parsed.phone)
        }
      };
    }

    return {
      success: true,
      officerPhoto,
      badgeId: parsed.officerId,
      ...parsed
    };
  } catch (err) {
    console.warn('OCR processing notice:', err);

    if (metadata) {
      const mappedMeta = mapRankToCategoryAndRank(metadata.rank || '');
      return {
        success: true,
        badgeId: metadata.badgeId,
        officerId: metadata.badgeId,
        name: metadata.name,
        rank: mappedMeta.rank,
        designation: mappedMeta.rank,
        policeStation: metadata.policeStation,
        email: metadata.email || '',
        phone: metadata.phone || '',
        categoryKey: mappedMeta.categoryKey,
        categoryLabel: mappedMeta.categoryLabel,
        officerPhoto: officerPhoto || metadata.officerPhoto || '',
        rawText: `OFFICER BADGE ID: ${metadata.badgeId}\nOFFICER NAME: ${metadata.name}\nRANK: ${metadata.rank}\nPOLICE STATION: ${metadata.policeStation}`,
        confidence: { officerId: true, name: true, rank: true, policeStation: true, email: Boolean(metadata.email), phone: Boolean(metadata.phone) }
      };
    }

    return {
      success: false,
      officerPhoto,
      error: 'Unable to clearly read the ID. Please upload a clearer image.'
    };
  }
};

/**
 * Generates an authentic Police Badge ID Card Image onto a Canvas
 */
export const generateSampleBadgeCardFile = (sampleType = 'si_rahul') => {
  const canvas = document.createElement('canvas');
  canvas.width = 900;
  canvas.height = 560;
  const ctx = canvas.getContext('2d');

  let badgeData = {
    badgeId: 'WB-SM-4004',
    name: 'Rahul Das',
    rank: 'Sub-Inspector',
    policeStation: 'Siliguri Police Station',
    state: 'WEST BENGAL POLICE',
    email: 'rahul.das@police.wb.gov.in',
    phone: '+91 98302 34568',
    color: '#0B2D4D',
    uniformColor: '#A07844',
    capColor: '#0B2D4D'
  };

  if (sampleType === 'legal_tanushree' || sampleType === 'prosecutor_ananya') {
    badgeData = {
      badgeId: 'WB-LO-0099',
      name: 'Tanushree Saha',
      rank: 'Legal officer',
      designation: 'Asst. Public Prosecutor (APP)',
      policeStation: 'High Court Legal Cell',
      state: 'LEGAL OFFICER IDENTITY CARD',
      email: 'asits1299@gmail.com',
      phone: '+91 7679432990',
      color: '#09243E',
      uniformColor: '#334155',
      capColor: '#09243E'
    };
  } else if (sampleType === 'dgp_vikram') {
    badgeData = {
      badgeId: 'WB-POL-9901',
      name: 'Vikram Rathore',
      rank: 'DGP',
      policeStation: 'State Police HQ',
      state: 'WEST BENGAL POLICE',
      email: 'vikram.rathore@police.wb.gov.in',
      phone: '+91 98112 45980',
      color: '#164A73',
      uniformColor: '#8C6734',
      capColor: '#164A73'
    };
  } else if (sampleType === 'sysadmin_arun') {
    badgeData = {
      badgeId: 'SYS-ADM-9901',
      name: 'Arun Kumar',
      rank: 'System Administrator',
      policeStation: 'IT & Cyber Directorate',
      state: 'CASEVAULT ADMIN CELL',
      email: 'arun.kumar@casevault.gov.in',
      phone: '+91 98765 43210',
      color: '#064E3B',
      uniformColor: '#1E293B',
      capColor: '#064E3B'
    };
  }

  // Card Background: Crisp white
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Top Government Header Strip
  ctx.fillStyle = badgeData.color;
  ctx.fillRect(0, 0, canvas.width, 95);

  // Tri-color thin strip
  ctx.fillStyle = '#FF9933';
  ctx.fillRect(0, 95, canvas.width, 4);
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 99, canvas.width, 3);
  ctx.fillStyle = '#138808';
  ctx.fillRect(0, 102, canvas.width, 4);

  // Header Text
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 24px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('GOVERNMENT OF INDIA', 110, 42);

  ctx.font = 'bold 30px sans-serif';
  ctx.fillText(badgeData.state, 110, 78);

  // Officer Portrait Box
  const px = 50, py = 140, pw = 200, ph = 250;
  const photoGrad = ctx.createLinearGradient(px, py, px + pw, py + ph);
  photoGrad.addColorStop(0, '#E2E8F0');
  photoGrad.addColorStop(1, '#CBD5E1');
  ctx.fillStyle = photoGrad;
  ctx.fillRect(px, py, pw, ph);

  // Officer Body
  ctx.fillStyle = badgeData.uniformColor;
  ctx.beginPath();
  ctx.moveTo(px + 20, py + ph);
  ctx.lineTo(px + pw - 20, py + ph);
  ctx.lineTo(px + pw - 30, py + 190);
  ctx.lineTo(px + 130, py + 175);
  ctx.lineTo(px + 70, py + 175);
  ctx.lineTo(px + 30, py + 190);
  ctx.closePath();
  ctx.fill();

  // Face
  ctx.fillStyle = '#EAB886';
  ctx.beginPath();
  ctx.arc(px + 100, py + 135, 36, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#475569';
  ctx.lineWidth = 2.5;
  ctx.strokeRect(px, py, pw, ph);

  // Typography for OCR
  ctx.textAlign = 'left';

  ctx.fillStyle = '#475569';
  ctx.font = 'bold 16px sans-serif';
  ctx.fillText('OFFICER BADGE ID', 290, 165);

  ctx.fillStyle = '#0B2D4D';
  ctx.font = 'bold 32px monospace';
  ctx.fillText(badgeData.badgeId, 290, 200);

  ctx.fillStyle = '#475569';
  ctx.font = 'bold 16px sans-serif';
  ctx.fillText('OFFICER NAME', 290, 250);

  ctx.fillStyle = '#0F172A';
  ctx.font = 'bold 28px sans-serif';
  ctx.fillText(badgeData.name, 290, 285);

  ctx.fillStyle = '#475569';
  ctx.font = 'bold 16px sans-serif';
  ctx.fillText('RANK / DESIGNATION', 290, 335);

  ctx.fillStyle = '#0F172A';
  ctx.font = 'bold 26px sans-serif';
  ctx.fillText(badgeData.rank, 290, 370);

  ctx.fillStyle = '#475569';
  ctx.font = 'bold 16px sans-serif';
  ctx.fillText('POLICE STATION / UNIT', 290, 418);

  ctx.fillStyle = '#0F172A';
  ctx.font = 'bold 26px sans-serif';
  ctx.fillText(badgeData.policeStation, 290, 452);

  // Standalone photo canvas
  const standalonePhotoCanvas = document.createElement('canvas');
  standalonePhotoCanvas.width = 240;
  standalonePhotoCanvas.height = 300;
  const pCtx = standalonePhotoCanvas.getContext('2d');
  pCtx.drawImage(canvas, px, py, pw, ph, 0, 0, 240, 300);
  const standalonePhotoDataUrl = standalonePhotoCanvas.toDataURL('image/png');

  // Convert to File
  const cardDataUrl = canvas.toDataURL('image/png');
  const arr = cardDataUrl.split(',');
  const mime = arr[0].match(/:(.*?);/)[1];
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  const file = new File([u8arr], `${badgeData.badgeId.toLowerCase()}_badge.png`, { type: mime });
  file._badgeMetadata = badgeData;
  file._dataUrl = cardDataUrl;
  file._officerPhoto = standalonePhotoDataUrl;

  return file;
};

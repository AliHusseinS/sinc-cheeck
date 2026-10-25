/**
 * قاعدة بيانات فحص المجلات ودور النشر المفترسة والتجارية
 * تضم القوائم المعتمدة الـ 6 لوزارة التعليم العالي العراقية (RDD) وقوائم Beall's List و Predatory Journals
 */
const PREDATORY_VERIFICATION_SOURCES = [
  {
    "id": 1,
    "name": "Predatory Publishers (دور النشر المفترسة)",
    "url": "https://www.predatoryjournals.org/the-list/publishers"
  },
  {
    "id": 2,
    "name": "Predatory Journals (المجلات المفترسة)",
    "url": "https://www.predatoryjournals.org/the-list/journals"
  },
  {
    "id": 3,
    "name": "المجلات المزيفة والمرفوضة (وزارة التعليم العالي - RDD)",
    "url": "https://jor.rdd.edu.iq/dis.php"
  },
  {
    "id": 4,
    "name": "دور النشر المفترسة (قائمة بيل - Beall's List)",
    "url": "https://beallslist.net/"
  },
  {
    "id": 5,
    "name": "المجلات المنفردة المفترسة (قائمة بيل - Beall's List)",
    "url": "https://beallslist.net/standalone-journals/"
  },
  {
    "id": 6,
    "name": "دور النشر المفترسة والتجارية (وزارة التعليم العالي - RDD)",
    "url": "https://jor.rdd.edu.iq/dis_pub.php"
  }
];

// القائمة الثابتة أُزيلت - الفحص يعتمد كلياً على Google Sheets الديناميكي
const PREDATORY_MASTER_ENTRIES = [];

function normalizePredatoryText(str) {
  if (!str) return '';
  return str
    .replace(/[–—_\-\/\\()\[\]«»""'']/g, ' ')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[ًٌٍَُِّْ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function getCleanPredatoryVariants(text) {
  if (!text || typeof text !== 'string') return [];
  const res = new Set();
  
  const norm = normalizePredatoryText(text);
  if (norm) {
    res.add(norm);
    const withoutThe = norm.replace(/^the\s+/, '');
    if (withoutThe) res.add(withoutThe);
  }

  // استخراج ما بداخل الأقواس (مثل اسم دار النشر المكتوب بين قوسين أو الاسم المختصر)
  const matches = text.match(/\(([^)]+)\)|\[([^\]]+)\]/g);
  if (matches) {
    for (const m of matches) {
      const inside = m.replace(/[()[\]]/g, '').trim();
      const insideNorm = normalizePredatoryText(inside);
      if (insideNorm && insideNorm.length >= 4) {
        res.add(insideNorm);
        const insideNoThe = insideNorm.replace(/^the\s+/, '');
        if (insideNoThe) res.add(insideNoThe);
      }
    }
  }

  // إزالة الأقواس وما بداخلها لفحص عنوان المجلة منفرداً
  const noParens = text.replace(/\s*\([^)]*\)/g, '').replace(/\s*\[[^\]]*\]/g, '');
  const noParensNorm = normalizePredatoryText(noParens);
  if (noParensNorm) {
    res.add(noParensNorm);
    const noThe = noParensNorm.replace(/^the\s+/, '');
    if (noThe) res.add(noThe);
  }

  // تقسيم العناوين المركبة أو ثنائية اللغة أو المفصولة بـ / أو - أو : أو | أو ;
  const parts = noParens.split(/[\/\-–—:|;]/);
  for (let p of parts) {
    p = p.replace(/,\s*[A-Z0-9]{2,}\s*$/, '').trim();
    const pNorm = normalizePredatoryText(p);
    if (pNorm && pNorm.length >= 4) {
      res.add(pNorm);
      const pNoThe = pNorm.replace(/^the\s+/, '');
      if (pNoThe) res.add(pNoThe);
    }
  }

  return Array.from(res);
}

function checkPredatoryStatus(query) {
  if (!query || typeof query !== 'string') return null;
  const qNorm = normalizePredatoryText(query);
  if (qNorm.length < 3) return null;

  const qVariants = getCleanPredatoryVariants(query);

  // 0. التحقق أولاً من القوائم السحابية المحدثة ديناميكياً (عبر Google Apps Script أو LocalStorage)
  let customList = [];
  try {
    if (typeof window !== 'undefined' && Array.isArray(window.CUSTOM_PREDATORY_ENTRIES)) {
      customList = window.CUSTOM_PREDATORY_ENTRIES;
    } else if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem('uok_custom_predatory');
      if (stored) customList = JSON.parse(stored);
    }
  } catch (e) {}

  if (Array.isArray(customList) && customList.length > 0) {
    let customFound = customList.find(c => {
      const cName = typeof c === 'string' ? c : (c.name || c[0] || '');
      const cVariants = getCleanPredatoryVariants(cName);
      return qVariants.some(qv => cVariants.includes(qv));
    });
    if (customFound) {
      const name = typeof customFound === 'string' ? customFound : (customFound.name || customFound[0]);
      const sourceName = customFound.sourceName || customFound[1] || "تحديث سحابي معتمد (Google Sheets / الوزارة)";
      const sourceUrl = customFound.sourceUrl || customFound.url || customFound[2] || "https://jor.rdd.edu.iq/dis.php";
      return {
        isPredatory: true,
        name: name,
        sourceName: sourceName,
        sourceUrl: sourceUrl,
        matchType: 'قوائم محدثة سحابياً'
      };
    }
  }

  // لا يوجد فحص عبر قائمة ثابتة - يُعتمد فقط على Google Sheets
  return null;
}

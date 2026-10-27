import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export type Lang = 'ar' | 'en';
const D: Record<string, { ar: string; en: string }> = {
  tagline: { ar: 'حوّل فيديو الدرس إلى ملزمة مرتبة وملوّنة', en: 'Turn lesson videos into organised, illustrated study notes' },
  newLesson: { ar: 'درس جديد', en: 'New lesson' },
  lessonTitle: { ar: 'عنوان الدرس', en: 'Lesson title' },
  create: { ar: 'إنشاء', en: 'Create' },
  search: { ar: 'بحث…', en: 'Search…' },
  sortRecent: { ar: 'الأحدث تعديلًا', en: 'Recently edited' },
  sortName: { ar: 'الاسم', en: 'Name' },
  empty: { ar: 'لا توجد دروس بعد. أنشئ أول درس للبدء.', en: 'No lessons yet. Create your first one.' },
  open: { ar: 'فتح', en: 'Open' },
  rename: { ar: 'إعادة تسمية', en: 'Rename' },
  duplicate: { ar: 'نسخ', en: 'Duplicate' },
  del: { ar: 'حذف', en: 'Delete' },
  confirmDel: { ar: 'سيُحذف الدرس وجميع لقطاته من هذا المتصفح نهائيًا. متابعة؟', en: 'This permanently deletes the lesson and its frames from this browser. Continue?' },
  exportP: { ar: 'تصدير', en: 'Export' },
  importP: { ar: 'استيراد مشروع', en: 'Import project' },
  importErr: { ar: 'ملف مشروع غير صالح', en: 'Invalid project file' },
  storage: { ar: 'التخزين المحلي', en: 'Local storage' },
  quota: { ar: 'امتلأ تخزين المتصفح. احذف دروسًا أو لقطات ثم أعد المحاولة.', en: 'Browser storage is full. Delete lessons or frames and retry.' },
  settings: { ar: 'الإعدادات', en: 'Settings' },
  home: { ar: 'الرئيسية', en: 'Home' },
  privacy: { ar: 'تتم المعالجة محليًا في متصفحك. لا يُرسل أي شيء لخدمات الذكاء الاصطناعي إلا بإذنك الصريح.', en: 'Processing happens locally in your browser. Nothing is sent to AI providers without your explicit consent.' },
  tabSource: { ar: 'المصدر والالتقاط', en: 'Source & capture' },
  tabFrames: { ar: 'اللقطات والنص', en: 'Frames & text' },
  tabNotes: { ar: 'الملاحظات', en: 'Notes' },
  tabPdf: { ar: 'ملف PDF', en: 'PDF' },
  uploadVideo: { ar: 'رفع فيديو (MP4 / WebM)', en: 'Upload video (MP4 / WebM)' },
  videoErr: { ar: 'تعذّر تشغيل هذا الفيديو في المتصفح. جرّب MP4 (H.264) أو WebM، أو حوّله ثم أعد الرفع.', en: 'This browser cannot play this video. Try MP4 (H.264) or WebM, or convert it and re-upload.' },
  videoNote: { ar: 'الفيديو لا يُحفظ في المتصفح؛ أعد اختياره عند العودة للدرس. اللقطات تُحفظ.', en: 'The video itself is not stored; re-select it when you return. Frames are saved.' },
  ytUrl: { ar: 'رابط يوتيوب', en: 'YouTube URL' },
  ytBad: { ar: 'رابط يوتيوب غير صالح', en: 'Invalid YouTube URL' },
  ytLimit: { ar: 'مشغّل يوتيوب المضمّن لا يتيح قراءة الإطارات (قيود المتصفح و CORS)، ولا ينزّل DarsAI الفيديو. استخدم رفع ملف تملك حق استخدامه، أو أضف لقطات شاشة يدويًا.', en: 'The embedded YouTube player does not expose frames (browser/CORS restrictions) and DarsAI does not download videos. Upload a file you are allowed to use, or add screenshots manually.' },
  addImages: { ar: 'إضافة صور / لقطات شاشة', en: 'Add images / screenshots' },
  preset: { ar: 'نمط الأخذ', en: 'Sampling preset' },
  fast: { ar: 'سريع', en: 'Fast' },
  balanced: { ar: 'متوازن', en: 'Balanced' },
  detailed: { ar: 'مفصّل', en: 'Detailed' },
  interval: { ar: 'الفاصل (ث)', en: 'Interval (s)' },
  minGap: { ar: 'أقل مدة بين لقطتين (ث)', en: 'Min gap (s)' },
  threshold: { ar: 'حساسية التغيّر (٪)', en: 'Change sensitivity (%)' },
  start: { ar: 'البداية', en: 'Start' },
  end: { ar: 'النهاية', en: 'End' },
  setHere: { ar: 'من الموضع الحالي', en: 'Use current time' },
  extract: { ar: 'استخراج اللقطات', en: 'Extract frames' },
  cancel: { ar: 'إلغاء', en: 'Cancel' },
  capture: { ar: 'التقاط اللقطة الحالية', en: 'Capture current frame' },
  extracting: { ar: 'جارٍ الفحص', en: 'Scanning' },
  noFrames: { ar: 'لا توجد لقطات بعد.', en: 'No frames yet.' },
  ocr: { ar: 'OCR محلي', en: 'Local OCR' },
  aiRead: { ar: 'قراءة بالذكاء الاصطناعي', en: 'AI read' },
  aiConsent: { ar: 'سيتم إرسال هذه الصورة إلى مزوّد ذكاء اصطناعي خارجي مفعّل في الإعدادات. هل توافق؟', en: 'This image will be sent to an external AI provider enabled in Settings. Do you agree?' },
  uncertain: { ar: 'تحتاج مراجعة', en: 'Needs review' },
  confidence: { ar: 'الثقة', en: 'Confidence' },
  up: { ar: 'أعلى', en: 'Up' },
  down: { ar: 'أسفل', en: 'Down' },
  download: { ar: 'تنزيل الصورة', en: 'Download image' },
  time: { ar: 'الزمن (ث)', en: 'Time (s)' },
  ocrLang: { ar: 'لغات OCR', en: 'OCR languages' },
  ocrNote: { ar: 'يُحمَّل نموذج اللغة من الإنترنت عند أول استخدام. الخط اليدوي والمعادلات غالبًا غير دقيقة: راجع النص بجانب الصورة.', en: 'The language model downloads on first use. Handwriting and equations are often inaccurate: review the text beside the image.' },
  notesHelp: { ar: 'صيغة: # عنوان، ## عنوان فرعي، - نقطة، > تعريف/ملاحظة مهمة، $$ معادلة $$', en: 'Syntax: # heading, ## subheading, - bullet, > definition/key point, $$ equation $$' },
  organize: { ar: 'تنظيم الملاحظات بالذكاء الاصطناعي', en: 'Organise notes with AI' },
  aiTextConsent: { ar: 'سيُرسل نص اللقطات إلى مزوّد ذكاء اصطناعي خارجي. هل توافق؟', en: 'The frame text will be sent to an external AI provider. Do you agree?' },
  aiFail: { ar: 'فشل جميع المزوّدين. راجع السجل والإعدادات.', en: 'All providers failed. See the log and Settings.' },
  mode: { ar: 'نوع الملزمة', en: 'Document type' },
  mCompact: { ar: 'مختصرة', en: 'Compact notes' },
  mDetailed: { ar: 'مفصّلة', en: 'Detailed notes' },
  mImgNotes: { ar: 'صور السبورة مع الملاحظات', en: 'Board images with notes' },
  mImgOnly: { ar: 'صور السبورة فقط', en: 'Board images only' },
  mText: { ar: 'نص فقط', en: 'Text only' },
  paper: { ar: 'حجم الورق', en: 'Paper size' },
  preview: { ar: 'معاينة', en: 'Preview' },
  downloadPdf: { ar: 'تنزيل PDF', en: 'Download PDF' },
  rendering: { ar: 'جارٍ إنشاء الصفحات…', en: 'Rendering pages…' },
  saved: { ar: 'تم الحفظ', en: 'Saved' },
  saving: { ar: 'جارٍ الحفظ…', en: 'Saving…' },
  title: { ar: 'العنوان', en: 'Title' },
  subject: { ar: 'المادة', en: 'Subject' },
  notFound: { ar: 'الدرس غير موجود.', en: 'Lesson not found.' },
  enabled: { ar: 'مفعّل', en: 'Enabled' },
  apiKey: { ar: 'مفتاح API', en: 'API key' },
  textModel: { ar: 'نموذج النص', en: 'Text model' },
  visionModel: { ar: 'نموذج الرؤية (اتركه فارغًا لتعطيل الرؤية)', en: 'Vision model (empty = no vision)' },
  priority: { ar: 'الأولوية', en: 'Priority' },
  test: { ar: 'اختبار الاتصال', en: 'Test connection' },
  preferred: { ar: 'المزوّد المفضّل', en: 'Preferred provider' },
  auto: { ar: 'تلقائي (حسب الأولوية)', en: 'Automatic (by priority)' },
  persistKeys: { ar: 'حفظ المفاتيح في هذا المتصفح (غير مستحسن)', en: 'Remember keys in this browser (not recommended)' },
  keyWarn: { ar: 'مفاتيح API في تطبيق ثابت على GitHub Pages ليست سرية: يستطيع أي شخص يصل إلى هذا المتصفح أو يفحص الطلبات رؤيتها. تُحفظ في الذاكرة فقط افتراضيًا وتُمسح عند إغلاق الصفحة.', en: 'API keys in a static GitHub Pages app are not secret: anyone with access to this browser or its network requests can see them. By default they live in memory only and vanish when the page closes.' },
  clearKeys: { ar: 'مسح كل المفاتيح', en: 'Clear all keys' },
  testOk: { ar: 'نجح الاتصال', en: 'Connection OK' },
  needKeyModel: { ar: 'أدخل المفتاح واسم النموذج أولًا', en: 'Enter a key and a model name first' },
  modelHint: { ar: 'أسماء النماذج وتوفرها تتغير؛ انسخ الاسم من لوحة المزوّد. لا نفترض أي خطة مجانية.', en: 'Model names and availability change; copy the name from the provider dashboard. No free tier is assumed.' },
  log: { ar: 'سجل الذكاء الاصطناعي', en: 'AI log' },
};

interface Ctx {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (k: string) => string;
}
const I18n = createContext<Ctx>({ lang: 'ar', setLang: () => {}, t: (k) => k });

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(() => (localStorage.getItem('darsai.lang') === 'en' ? 'en' : 'ar'));
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    localStorage.setItem('darsai.lang', lang);
  }, [lang]);
  const t = (k: string) => D[k]?.[lang] ?? k;
  return <I18n.Provider value={{ lang, setLang, t }}>{children}</I18n.Provider>;
}
export const useI18n = () => useContext(I18n);

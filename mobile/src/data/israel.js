// Israeli market data shared across mobile screens (mirror of server/src/data/israel.js).
export const TRADES = [
  'חשמלאי',
  'אינסטלטור',
  'טייח',
  'גבס',
  'ריצוף',
  'צבע',
  'נגר',
  'מסגר',
  'איטום',
  'שלדים / ברזל',
  'מיזוג אוויר',
  'אלומיניום',
  'שיש ואבן',
  'גינון',
  'הריסה ופינוי',
  'עבודות עפר',
  'זגג',
  'דוד שמש / סולארי',
  'פירוק והרכבה',
  'עובד כללי / שיפוצים',
];

export const CITIES = [
  'תל אביב-יפו',
  'ירושלים',
  'חיפה',
  'ראשון לציון',
  'פתח תקווה',
  'אשדוד',
  'נתניה',
  'באר שבע',
  'בני ברק',
  'חולון',
  'רמת גן',
  'אשקלון',
  'רחובות',
  'בת ים',
  'הרצליה',
  'כפר סבא',
  'חדרה',
  'מודיעין',
  'נצרת',
  'רעננה',
  'אילת',
  'עפולה',
  'טבריה',
  'קריות',
  'ראש העין',
];

export function isValidIsraeliMobile(value) {
  if (!value) return false;
  const digits = String(value).replace(/[\s-]/g, '');
  return /^05\d{8}$/.test(digits);
}

export const VAT_RATE = 0.18;

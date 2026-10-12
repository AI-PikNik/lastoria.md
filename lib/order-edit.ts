/**
 * Пересчёт заказа после редактирования в админке (чистые функции, покрыты тестами).
 *
 * - У существующих позиций сохраняется цена на момент заказа и скидка за
 *   единицу (промо), меняется только количество.
 * - Новые позиции добавляются по текущей цене товара (+ надбавка варианта),
 *   без промо-скидки.
 */
export interface ExistingLine {
  id: string;
  qty: number;
  unitPrice: number;
  lineTotal: number;
}

export interface EditedLineInput {
  /** id существующей позиции; пусто — новая позиция */
  id?: string | null;
  qty: number;
  /** для новых позиций — цена за единицу из каталога */
  unitPrice?: number;
}

export interface RecalculatedLine {
  id: string | null;
  qty: number;
  unitPrice: number;
  lineTotal: number;
}

const round2 = (v: number) => Math.round((v + Number.EPSILON) * 100) / 100;

export function recalcOrderLines(existing: ExistingLine[], edited: EditedLineInput[]): RecalculatedLine[] {
  const byId = new Map(existing.map((l) => [l.id, l]));
  return edited.map((line) => {
    const qty = Math.max(1, Math.trunc(line.qty));
    const old = line.id ? byId.get(line.id) : undefined;
    if (old) {
      const discountPerUnit = old.qty > 0 ? (old.unitPrice * old.qty - old.lineTotal) / old.qty : 0;
      return {
        id: old.id,
        qty,
        unitPrice: old.unitPrice,
        lineTotal: round2(Math.max(old.unitPrice * qty - discountPerUnit * qty, 0)),
      };
    }
    const unitPrice = Math.max(line.unitPrice ?? 0, 0);
    return { id: null, qty, unitPrice, lineTotal: round2(unitPrice * qty) };
  });
}

export function orderTotals(lines: RecalculatedLine[], deliveryFee: number) {
  const subtotal = round2(lines.reduce((s, l) => s + l.unitPrice * l.qty, 0));
  const itemsTotal = round2(lines.reduce((s, l) => s + l.lineTotal, 0));
  const fee = round2(Math.max(deliveryFee, 0));
  return {
    subtotal,
    discountTotal: round2(subtotal - itemsTotal),
    deliveryFee: fee,
    total: round2(itemsTotal + fee),
  };
}

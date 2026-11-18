import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { ReceiptData } from "@/lib/receipts/receipt-data";

const currency = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 });
const formatMoney = (value: number) => `Rp ${currency.format(value)}`;
const pdfSafe = (value: string) => value.replace(/[^\u0000-\u00ff]/g, "?");

export async function createReceiptPdf(receipt: ReceiptData) {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const pageSize: [number, number] = [595.28, 841.89];
  let page = pdf.addPage(pageSize);
  let y = page.getHeight() - 54;
  const left = 48;
  const lineHeight = 18;

  const line = (
    text: string,
    options: {
      bold?: boolean;
      size?: number;
      color?: ReturnType<typeof rgb>;
    } = {},
  ) => {
    const face = options.bold ? bold : font;
    const size = options.size ?? 10;
    const color = options.color ?? rgb(0.15, 0.15, 0.15);
    const maxWidth = page.getWidth() - left * 2;
    const words = pdfSafe(text).split(/\s+/);
    let current = "";
    const draw = (value: string) => {
      if (y < 60) {
        page = pdf.addPage(pageSize);
        y = page.getHeight() - 54;
      }
      page.drawText(value, { x: left, y, size, font: face, color });
      y -= lineHeight;
    };
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (face.widthOfTextAtSize(candidate, size) <= maxWidth) {
        current = candidate;
        continue;
      }
      if (current) draw(current);
      current = "";
      let segment = "";
      for (const character of word) {
        const next = segment + character;
        if (segment && face.widthOfTextAtSize(next, size) > maxWidth) {
          draw(segment);
          segment = character;
        } else segment = next;
      }
      current = segment;
    }
    if (current || !words.length) draw(current);
  };

  line("STRUK PEMBAYARAN", { bold: true, size: 18 });
  line(`Pesanan ${receipt.order_number}`, { bold: true, size: 12 });
  line(`Meja ${receipt.table_number_snapshot}`);
  if (receipt.customer_name) line(`Pelanggan: ${receipt.customer_name}`);
  line(
    `Waktu pembayaran: ${new Date(receipt.paid_at ?? "").toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })} WIB`,
  );
  line(`Metode pembayaran: ${receipt.payment_method ?? "QRIS"}`);
  y -= 8;
  line("RINCIAN PESANAN", { bold: true, size: 12 });
  for (const item of receipt.items) {
    line(
      `${item.quantity} x ${item.menu_name_snapshot}  ·  ${formatMoney(item.line_total)}`,
      { bold: true },
    );
    const variants = Array.isArray(item.variant_snapshot)
      ? (item.variant_snapshot as Array<{
          groupName?: string;
          group?: string;
          optionName?: string;
          option?: string;
          name?: string;
        }>)
      : [];
    for (const choice of variants)
      line(
        `  ${choice.groupName ?? choice.group ?? "Varian"}: ${choice.optionName ?? choice.option ?? choice.name ?? ""}`,
        { size: 9 },
      );
    const addons = Array.isArray(item.addon_snapshot)
      ? (item.addon_snapshot as Array<{
          groupName?: string;
          group?: string;
          optionName?: string;
          option?: string;
          name?: string;
          quantity?: number;
        }>)
      : [];
    for (const addon of addons)
      line(
        `  ${addon.quantity && addon.quantity > 1 ? `${addon.quantity} x ` : ""}${addon.groupName ?? addon.group ?? "Add-on"}: ${addon.optionName ?? addon.option ?? addon.name ?? ""}`,
        { size: 9 },
      );
    if (item.item_note) line(`  Catatan: ${item.item_note}`, { size: 9 });
  }
  if (receipt.order_notes)
    line(`Catatan pesanan: ${receipt.order_notes}`, { size: 9 });
  y -= 8;
  line(`Subtotal: ${formatMoney(receipt.subtotal)}`);
  if (receipt.discount_amount > 0)
    line(`Diskon: -${formatMoney(receipt.discount_amount)}`);
  line(`Total dibayar: ${formatMoney(receipt.total_amount)}`, {
    bold: true,
    size: 13,
  });
  line("Terima kasih telah memesan.", {
    size: 9,
    color: rgb(0.35, 0.35, 0.35),
  });

  return pdf.save();
}

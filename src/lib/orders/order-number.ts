export function formatOperationalOrderNumber(operationalDate: string, sequence: number) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(operationalDate) || !Number.isSafeInteger(sequence) || sequence < 1) {
    throw new Error("Nomor urut operasional tidak valid.");
  }
  const [year, month, day] = operationalDate.split("-");
  return `ORD-${day}${month}${year.slice(-2)}${String(sequence).padStart(3, "0")}`;
}

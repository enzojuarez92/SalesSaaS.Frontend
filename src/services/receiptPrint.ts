import { money } from "./format";

export type PrintFormat = "a4" | "thermal-80" | "thermal-58";

export interface ReceiptLine {
  product: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

export interface ReceiptPrintData {
  tenantId: string;
  printFormat?: PrintFormat;
  businessName: string;
  businessTaxId?: string;
  receiptNumber: string;
  date: string;
  customer: string;
  customerDocument?: string;
  seller?: string;
  paymentMethod: string;
  total: number;
  items: ReceiptLine[];
  fiscalLabel?: string;
}

type SavedBusiness = { name?: string; taxId?: string };
const formatKey = (tenantId: string) => `salessaas.print-format.${tenantId}`;
const businessKey = (tenantId: string) => `salessaas.print-business.${tenantId}`;

export function getPrintFormat(tenantId: string): PrintFormat {
  const value = localStorage.getItem(formatKey(tenantId));
  return value === "thermal-80" || value === "thermal-58" || value === "a4" ? value : "a4";
}

export function savePrintFormat(tenantId: string, value: PrintFormat) {
  localStorage.setItem(formatKey(tenantId), value);
}

export function savePrintBusiness(tenantId: string, business: SavedBusiness) {
  localStorage.setItem(businessKey(tenantId), JSON.stringify(business));
}

export function getPrintBusiness(tenantId: string): SavedBusiness {
  try { return JSON.parse(localStorage.getItem(businessKey(tenantId)) || "{}"); }
  catch { return {}; }
}

function escapeHtml(value: unknown) {
  return String(value ?? "").replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
  })[character] ?? character);
}

function a4Document(receipt: ReceiptPrintData) {
  const rows = receipt.items.map(item => `<tr><td>${escapeHtml(item.product)}</td><td>${item.quantity}</td><td>${escapeHtml(money(item.unitPrice))}</td><td>${escapeHtml(money(item.subtotal))}</td></tr>`).join("");
  return `<main class="receipt a4"><header><div><h1>${escapeHtml(receipt.businessName)}</h1>${receipt.businessTaxId ? `<p>CUIT: ${escapeHtml(receipt.businessTaxId)}</p>` : ""}</div><div class="document"><h2>TICKET / COMPROBANTE</h2><p>N.º ${escapeHtml(receipt.receiptNumber)}<br>${escapeHtml(new Date(receipt.date).toLocaleString("es-AR"))}</p></div></header><hr><section class="customer"><h3>Cliente</h3><p>${escapeHtml(receipt.customer)}${receipt.customerDocument ? `<br>${escapeHtml(receipt.customerDocument)}` : ""}${receipt.seller ? `<br>Vendedor: ${escapeHtml(receipt.seller)}` : ""}<br>Pago: ${escapeHtml(receipt.paymentMethod)}</p></section><table><thead><tr><th>Descripción</th><th>Cant.</th><th>Unitario</th><th>Importe</th></tr></thead><tbody>${rows}</tbody></table><p class="total">TOTAL&nbsp; ${escapeHtml(money(receipt.total))}</p><p class="fiscal">${escapeHtml(receipt.fiscalLabel || "DOCUMENTO NO FISCAL")}</p></main>`;
}

function thermalDocument(receipt: ReceiptPrintData, width: "80mm" | "58mm") {
  const rows = receipt.items.map(item => `<div class="line"><span>${escapeHtml(`${item.quantity} x ${item.product}`)}</span><strong>${escapeHtml(money(item.subtotal))}</strong></div>`).join("");
  return `<main class="receipt thermal ${width === "58mm" ? "thermal-58" : "thermal-80"}"><header><h1>${escapeHtml(receipt.businessName)}</h1>${receipt.businessTaxId ? `<p>CUIT: ${escapeHtml(receipt.businessTaxId)}</p>` : ""}<p>N.º ${escapeHtml(receipt.receiptNumber)}<br>${escapeHtml(new Date(receipt.date).toLocaleString("es-AR"))}</p></header><div class="separator">--------------------------------</div><p>Cliente: ${escapeHtml(receipt.customer)}${receipt.customerDocument ? `<br>${escapeHtml(receipt.customerDocument)}` : ""}${receipt.seller ? `<br>Vendedor: ${escapeHtml(receipt.seller)}` : ""}<br>Pago: ${escapeHtml(receipt.paymentMethod)}</p><div class="separator">--------------------------------</div><section class="items">${rows}</section><div class="separator">--------------------------------</div><p class="total">TOTAL ${escapeHtml(money(receipt.total))}</p><p class="fiscal">${escapeHtml(receipt.fiscalLabel || "DOCUMENTO NO FISCAL")}</p></main>`;
}

export function printReceipt(receipt: ReceiptPrintData) {
  const format = receipt.printFormat || getPrintFormat(receipt.tenantId);
  const body = format === "a4" ? a4Document(receipt) : thermalDocument(receipt, format === "thermal-58" ? "58mm" : "80mm");
  const pageSize = format === "a4" ? "A4" : format === "thermal-58" ? "58mm auto" : "80mm auto";
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${escapeHtml(receipt.receiptNumber)}</title><style>@page{size:${pageSize};margin:${format === "a4" ? "16mm" : "4mm"}}*{box-sizing:border-box}body{margin:0;color:#172033;background:#fff;font-family:Arial,sans-serif}.receipt{margin:0 auto}.a4{max-width:178mm;font-size:14px}.a4 header{display:flex;justify-content:space-between;gap:24px}.a4 h1{margin:0;color:#c2185b;font-size:29px}.a4 h2{margin:0;font-size:24px}.a4 p{margin:4px 0;line-height:1.45}.a4 .document{text-align:left;min-width:260px}.a4 hr{border:0;border-top:2px solid #f3a4c6;margin:20px 0 32px}.a4 .customer h3{margin:0 0 18px;font-size:18px}.a4 .customer{margin-bottom:25px}.a4 table{width:100%;border-collapse:collapse}.a4 th{padding:10px;text-align:left;background:#f5bfd4;font-weight:700}.a4 th:nth-child(n+2),.a4 td:nth-child(n+2){text-align:right}.a4 td{padding:11px 10px;border-bottom:1px solid #d8d8d8}.a4 .total{text-align:right;color:#c2185b;font-size:27px;font-weight:700;margin:33px 0 24px}.fiscal{color:#e11d48;font-weight:700}.thermal{width:100%;max-width:80mm;font-family:"Courier New",monospace;font-size:12px;color:#000}.thermal-58{max-width:58mm;font-size:10px}.thermal header{text-align:center}.thermal h1{margin:0 0 5px;font-size:16px}.thermal p{margin:8px 0;line-height:1.45}.thermal .separator{overflow:hidden;white-space:nowrap}.thermal .items{display:grid;gap:7px}.thermal .line{display:flex;justify-content:space-between;gap:8px}.thermal .line span{min-width:0}.thermal .line strong{white-space:nowrap}.thermal .total{text-align:right;font-size:15px;font-weight:700}@media print{body{background:#fff}.a4 h1,.a4 .total{color:#c2185b!important}}</style></head><body>${body}<script>window.addEventListener("load",()=>{window.focus();window.print();});<\/script></body></html>`;
  const url = URL.createObjectURL(new Blob([html], { type: "text/html;charset=utf-8" }));
  const popup = window.open(url, "_blank", "noopener,noreferrer");
  if (!popup) {
    URL.revokeObjectURL(url);
    return false;
  }
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return true;
}

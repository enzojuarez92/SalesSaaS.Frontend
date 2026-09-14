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
  businessLegalName?: string;
  businessTaxCondition?: string;
  businessAddress?: string;
  businessPhone?: string;
  businessLogoUrl?: string;
  receiptNumber: string;
  date: string;
  customer: string;
  customerDocument?: string;
  seller?: string;
  paymentMethod: string;
  total: number;
  items: ReceiptLine[];
  documentTitle?: string;
  fiscalLabel?: string;
  cae?: string;
  caeExpirationDate?: string | null;
  verificationUrl?: string | null;
}

export type SavedBusiness = {
  name?: string;
  taxId?: string;
  legalName?: string;
  taxCondition?: string;
  address?: string;
  phone?: string;
  logoUrl?: string;
};
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

function printableLogo(value?: string) {
  if (!value) return "";
  const isDataImage = /^data:image\/(png|jpeg|webp);base64,[a-z0-9+/=\s]+$/i.test(value);
  const isRemoteImage = /^https?:\/\/[^\s"'<>]+$/i.test(value);
  return isDataImage || isRemoteImage ? `<img class="logo" src="${escapeHtml(value)}" alt="Logo del negocio">` : "";
}

function localDate(value: string) {
  return new Date(value).toLocaleString("es-AR");
}

function localDateOnly(value: string) {
  return new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString("es-AR");
}

function businessDetails(receipt: ReceiptPrintData) {
  return [
    receipt.businessLegalName && receipt.businessLegalName !== receipt.businessName ? receipt.businessLegalName : "",
    receipt.businessTaxId ? `CUIT: ${receipt.businessTaxId}` : "",
    receipt.businessTaxCondition || "",
    receipt.businessAddress || "",
    receipt.businessPhone ? `Tel.: ${receipt.businessPhone}` : "",
  ].filter(Boolean).map(value => `<p>${escapeHtml(value)}</p>`).join("");
}

function fiscalFooter(receipt: ReceiptPrintData) {
  const cae = receipt.cae ? `<div class="cae"><strong>CAE: ${escapeHtml(receipt.cae)}</strong>${receipt.caeExpirationDate ? `<span>Vto. CAE: ${escapeHtml(localDateOnly(receipt.caeExpirationDate))}</span>` : ""}</div>` : "";
  const verification = receipt.verificationUrl ? `<p class="verification">Referencia electrónica disponible para consultar el comprobante.</p>` : "";
  return `${cae}${verification}<p class="fiscal">${escapeHtml(receipt.fiscalLabel || "DOCUMENTO NO FISCAL")}</p>`;
}

function a4Document(receipt: ReceiptPrintData) {
  const rows = receipt.items.map(item => `<tr><td>${escapeHtml(item.product)}</td><td>${item.quantity}</td><td>${escapeHtml(money(item.unitPrice))}</td><td>${escapeHtml(money(item.subtotal))}</td></tr>`).join("");
  const customer = `${escapeHtml(receipt.customer)}${receipt.customerDocument ? `<br>${escapeHtml(receipt.customerDocument)}` : ""}`;
  return `<main class="receipt a4">
    <header>
      <div class="brand">${printableLogo(receipt.businessLogoUrl)}<div><h1>${escapeHtml(receipt.businessName)}</h1>${businessDetails(receipt)}</div></div>
      <div class="document"><h2>${escapeHtml(receipt.documentTitle || "COMPROBANTE")}</h2><p><strong>N.º ${escapeHtml(receipt.receiptNumber)}</strong><br>Fecha de emisión: ${escapeHtml(localDate(receipt.date))}</p></div>
    </header>
    <div class="rule"></div>
    <section class="customer"><div><h3>Cliente</h3><p>${customer}</p></div><div><h3>Condición de venta</h3><p>${escapeHtml(receipt.paymentMethod)}${receipt.seller ? `<br>Vendedor: ${escapeHtml(receipt.seller)}` : ""}</p></div></section>
    <table><thead><tr><th>Descripción</th><th>Cant.</th><th>Precio unitario</th><th>Importe</th></tr></thead><tbody>${rows}</tbody></table>
    <section class="totals"><p>Subtotal <strong>${escapeHtml(money(receipt.total))}</strong></p><p class="grand-total">TOTAL <strong>${escapeHtml(money(receipt.total))}</strong></p></section>
    ${fiscalFooter(receipt)}
  </main>`;
}

function thermalDocument(receipt: ReceiptPrintData, width: "80mm" | "58mm") {
  const rows = receipt.items.map(item => `<article class="item"><strong>${escapeHtml(item.product)}</strong><div><span>${item.quantity} x ${escapeHtml(money(item.unitPrice))}</span><b>${escapeHtml(money(item.subtotal))}</b></div></article>`).join("");
  const title = receipt.documentTitle || "TICKET";
  return `<main class="receipt thermal ${width === "58mm" ? "thermal-58" : "thermal-80"}">
    <header>${printableLogo(receipt.businessLogoUrl)}<h1>${escapeHtml(receipt.businessName)}</h1>${businessDetails(receipt)}</header>
    <div class="separator"></div>
    <section class="document"><h2>${escapeHtml(title)}</h2><p>N.º ${escapeHtml(receipt.receiptNumber)}<br>${escapeHtml(localDate(receipt.date))}</p></section>
    <div class="separator"></div>
    <p>Cliente: ${escapeHtml(receipt.customer)}${receipt.customerDocument ? `<br>${escapeHtml(receipt.customerDocument)}` : ""}<br>Cond. venta: ${escapeHtml(receipt.paymentMethod)}</p>
    <div class="separator"></div>
    <section class="items"><div class="line heading"><span>Cant. x Precio / Descripción</span><b>Importe</b></div>${rows}</section>
    <div class="separator"></div>
    <p class="total"><span>TOTAL</span><strong>${escapeHtml(money(receipt.total))}</strong></p>
    ${fiscalFooter(receipt)}
  </main>`;
}

export function printReceipt(receipt: ReceiptPrintData) {
  const format = receipt.printFormat || getPrintFormat(receipt.tenantId);
  const body = format === "a4" ? a4Document(receipt) : thermalDocument(receipt, format === "thermal-58" ? "58mm" : "80mm");
  const pageSize = format === "a4" ? "A4" : format === "thermal-58" ? "58mm auto" : "80mm auto";
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${escapeHtml(receipt.receiptNumber)}</title><style>
    @page{size:${pageSize};margin:${format === "a4" ? "15mm" : "3mm"}}*{box-sizing:border-box}body{margin:0;color:#1b1b1b;background:#fff;font-family:Arial,sans-serif}.receipt{margin:0 auto}.logo{display:block;object-fit:contain}.a4{max-width:180mm;font-size:12px}.a4 header{display:flex;justify-content:space-between;gap:20px}.a4 .brand{display:flex;gap:14px;align-items:flex-start}.a4 .brand .logo{width:64px;height:64px}.a4 h1{margin:0 0 6px;font-size:24px;color:#172033}.a4 h2{margin:0;font-size:17px;letter-spacing:.05em}.a4 p{margin:3px 0;line-height:1.35}.a4 .document{min-width:235px;border:1px solid #1b1b1b;padding:12px;text-align:center}.rule,.separator{border-top:1px dashed #555;margin:16px 0}.a4 .customer{display:grid;grid-template-columns:1fr 1fr;gap:30px;margin-bottom:20px}.a4 h3{font-size:12px;text-transform:uppercase;margin:0 0 4px}.a4 table{width:100%;border-collapse:collapse}.a4 th{padding:9px 7px;border-top:1px solid #1b1b1b;border-bottom:1px solid #1b1b1b;text-align:left;font-size:11px;text-transform:uppercase}.a4 th:nth-child(n+2),.a4 td:nth-child(n+2){text-align:right}.a4 td{padding:9px 7px;border-bottom:1px solid #ddd}.totals{margin:18px 0 14px;margin-left:auto;width:300px}.totals p{display:flex;justify-content:space-between;padding:5px 0}.totals .grand-total{border-top:2px solid #1b1b1b;border-bottom:2px solid #1b1b1b;padding:9px 0;font-size:17px;letter-spacing:.08em}.fiscal{font-size:10px;text-align:center;font-weight:700;margin-top:14px!important}.cae{display:flex;justify-content:space-between;gap:12px;border-top:1px dashed #555;padding-top:10px;font-size:11px}.verification{font-size:10px;text-align:center;color:#555}.thermal{width:100%;max-width:80mm;font-family:"Courier New",monospace;font-size:11px;color:#000}.thermal-58{max-width:58mm;font-size:9px}.thermal header{text-align:center}.thermal .logo{width:56px;height:56px;margin:0 auto 5px}.thermal h1{margin:0 0 3px;font-size:15px}.thermal header p{margin:1px 0;line-height:1.2}.thermal p{margin:7px 0;line-height:1.35}.thermal .separator{border-top:1px dashed #000;margin:8px 0}.thermal .document{text-align:center}.thermal .document h2{margin:0;font-size:14px;text-decoration:underline}.thermal .items{display:grid;gap:7px}.thermal .line,.thermal .item div{display:flex;justify-content:space-between;gap:6px}.thermal .heading{font-size:.92em}.thermal .item strong{display:block;overflow-wrap:anywhere;margin-bottom:2px}.thermal .total{display:flex;justify-content:space-between;font-size:15px;font-weight:700}.thermal .fiscal{font-size:.9em}.thermal .cae{display:block;font-size:.9em}.thermal .cae span{display:block;margin-top:2px}@media print{body{background:#fff}}
  </style></head><body>${body}<script>window.addEventListener("load",()=>{window.focus();window.print();});<\/script></body></html>`;
  const url = URL.createObjectURL(new Blob([html], { type: "text/html;charset=utf-8" }));
  const popup = window.open(url, "_blank", "noopener,noreferrer");
  if (!popup) { URL.revokeObjectURL(url); return false; }
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return true;
}

const byId = (id) => document.getElementById(id);
const textValue = (id) => byId(id).value.trim();
const numberValue = (id) => byId(id).valueAsNumber || 0;

const form = byId('receipt-form');
const receipt = byId('receipt');
const itemsContainer = byId('items-container');
const itemTemplate = byId('item-template');
const templateSections = document.querySelectorAll('[data-template]');
const formatButtons = form.querySelectorAll('button[type="submit"]');
const paperField = (attribute) => receipt.querySelector('[data-' + attribute + ']');
const preview = {
  passenger: paperField('preview-passenger'),
  route: paperField('preview-route'),
  pickup: paperField('preview-pickup'),
  dropoff: paperField('preview-dropoff'),
  driver: paperField('preview-driver'),
  vehicle: paperField('preview-vehicle'),
  basefare: paperField('preview-basefare'),
  distanceCharge: paperField('preview-distance-charge'),
  distanceMeta: paperField('preview-distance-meta'),
  extras: paperField('preview-extras'),
  taxiSubtotal: paperField('preview-taxi-subtotal'),
  tip: paperField('preview-tip'),
  total: paperField('preview-total'),
  rideNote: paperField('preview-ride-note'),
  storeName: paperField('store-name'),
  storeTagline: paperField('store-tagline'),
  storeAddress: paperField('store-address'),
  storePhone: paperField('store-phone'),
  receipt: paperField('preview-receipt'),
  register: paperField('preview-register'),
  cashier: paperField('preview-cashier'),
  date: paperField('preview-date'),
  payment: paperField('preview-payment'),
  footer: paperField('preview-footer'),
  thanks: paperField('preview-thanks'),
  subtotal: paperField('preview-subtotal'),
  taxLabel: paperField('tax-label'),
  tax: paperField('preview-tax'),
  discount: paperField('preview-discount'),
};

const currencyFormatter = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' });
const dateFormatter = new Intl.DateTimeFormat(undefined, {
  year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
});
const currency = (value) => currencyFormatter.format(value);
const hundredths = (value) => Math.round(value * 100);
const lineAmount = (item) => item.qty * hundredths(item.price) / 100;

const defaultItems = [
  { description: 'Cold Brew', qty: 1, price: 4.5 },
  { description: 'Sesame Bagel', qty: 2, price: 2.25 },
  { description: 'Granola Bar', qty: 1, price: 1.75 },
];

// Swap example text with the template. Keep anything the user has customized.
const taxiExamples = {
  'store-name': 'Harbor City Taxi',
  'store-tagline': 'City cab service',
  'store-address': '18 Station Road, Springfield',
  'store-phone': '(555) 013-4200',
  'receipt-id': 'T104829',
  'footer-message': 'Please keep this receipt for your records.',
  'closing-message': 'Thank you for riding with us!',
};

let activeTemplate = 'retail';
let isGenerating = false;

const toInputDateTime = (date = new Date()) => {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
};

const readableDate = (value) => {
  if (!value) return '—';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '—' : dateFormatter.format(parsed);
};

const setActiveTemplate = () => {
  const next = document.querySelector('input[name="receipt-type"]:checked').value;
  if (next !== activeTemplate) {
    for (const [id, taxiExample] of Object.entries(taxiExamples)) {
      const input = byId(id);
      const previousExample = activeTemplate === 'taxi' ? taxiExample : input.defaultValue;
      if (input.value === previousExample) {
        input.value = next === 'taxi' ? taxiExample : input.defaultValue;
      }
    }
  }
  activeTemplate = next;
  templateSections.forEach((section) => {
    const inactive = section.dataset.template !== next;
    section.hidden = inactive;
    section.querySelectorAll('input, button').forEach((control) => { control.disabled = inactive; });
  });
  byId('receipt-id-label').textContent = next === 'taxi' ? 'Trip ID' : 'Receipt number';
  byId('paper-id-label').textContent = next === 'taxi' ? 'Trip ID' : 'Receipt #';
};

const labelItemRows = () => {
  Array.from(itemsContainer.children).forEach((row, index) => {
    const number = index + 1;
    row.querySelector('[data-field="description"]').setAttribute('aria-label', 'Item ' + number + ' description');
    row.querySelector('[data-field="qty"]').setAttribute('aria-label', 'Item ' + number + ' quantity');
    row.querySelector('[data-field="price"]').setAttribute('aria-label', 'Item ' + number + ' unit price in dollars');
    const remove = row.querySelector('button');
    remove.setAttribute('aria-label', 'Remove item ' + number);
    remove.title = 'Remove item ' + number;
  });
};

const addItemRow = ({ description = '', qty = 1, price = 0 } = {}) => {
  const row = itemTemplate.content.firstElementChild.cloneNode(true);
  row.querySelector('[data-field="description"]').value = description;
  row.querySelector('[data-field="qty"]').value = qty;
  row.querySelector('[data-field="price"]').value = price.toFixed(2);
  row.querySelector('button').addEventListener('click', () => {
    const neighbor = row.nextElementSibling || row.previousElementSibling;
    row.remove();
    labelItemRows();
    renderPreview();
    (neighbor?.querySelector('button') || byId('add-item')).focus();
  });
  itemsContainer.appendChild(row);
  labelItemRows();
  return row;
};

const collectItems = () => {
  const items = [];
  for (const row of itemsContainer.children) {
    const description = row.querySelector('[data-field="description"]').value.trim();
    const qty = row.querySelector('[data-field="qty"]');
    const price = row.querySelector('[data-field="price"]');
    const used = Boolean(description) || price.valueAsNumber > 0;
    qty.required = used;
    price.required = used;
    if (used) items.push({ description, qty: qty.valueAsNumber || 0, price: price.valueAsNumber || 0 });
  }
  return items;
};

const getFormData = () => ({
  type: activeTemplate,
  storeName: textValue('store-name'),
  tagline: textValue('store-tagline'),
  address: textValue('store-address'),
  phone: textValue('store-phone'),
  receiptId: textValue('receipt-id'),
  register: textValue('register-id'),
  cashier: textValue('cashier-name'),
  datetime: textValue('purchase-datetime'),
  taxRate: numberValue('tax-rate'),
  discount: numberValue('discount-amount'),
  paymentMethod: textValue('payment-method'),
  footerMessage: textValue('footer-message'),
  closingMessage: textValue('closing-message'),
  showFooter: byId('show-footer-message').checked,
  showClosing: byId('show-thankyou-line').checked,
  taxiRide: {
    passenger: textValue('taxi-passenger'),
    pickupLocation: textValue('taxi-pickup'),
    dropoffLocation: textValue('taxi-dropoff'),
    pickupTime: textValue('taxi-pickup-time'),
    dropoffTime: textValue('taxi-dropoff-time'),
    driver: textValue('taxi-driver'),
    vehicle: textValue('taxi-vehicle'),
    note: textValue('taxi-notes'),
  },
  taxiCharges: {
    baseFare: numberValue('taxi-base-fare'),
    distanceMiles: numberValue('taxi-distance'),
    ratePerMile: numberValue('taxi-rate'),
    extras: numberValue('taxi-extras'),
    tip: numberValue('taxi-tip'),
  },
  items: collectItems(),
});

const computeRetailTotals = (items, taxRate, discount) => {
  const subtotal = items.reduce((sum, item) => sum + item.qty * hundredths(item.price), 0);
  // Round tax once to the cent, then apply the after-tax discount shown in the editor.
  const tax = Math.round(subtotal * hundredths(taxRate) / 10000);
  const appliedDiscount = Math.min(hundredths(discount), subtotal + tax);
  return {
    subtotal: subtotal / 100,
    tax: tax / 100,
    discount: appliedDiscount / 100,
    total: (subtotal + tax - appliedDiscount) / 100,
  };
};

const computeTaxiTotals = (charges) => {
  const distanceCharge = Math.round(hundredths(charges.distanceMiles) * hundredths(charges.ratePerMile) / 100);
  const subtotal = hundredths(charges.baseFare) + distanceCharge + hundredths(charges.extras);
  return {
    distanceCharge: distanceCharge / 100,
    subtotal: subtotal / 100,
    total: (subtotal + hundredths(charges.tip)) / 100,
  };
};

const renderItemsPreview = (items) => {
  const list = byId('preview-items');
  list.replaceChildren();
  if (!items.length) {
    const message = document.createElement('p');
    message.className = 'empty-items';
    message.textContent = 'Add a line item to begin.';
    list.append(message);
  }
  for (const item of items) {
    const row = document.createElement('div');
    row.className = 'paper-row';
    for (const value of [item.description || 'Item', item.qty, currency(lineAmount(item))]) {
      const cell = document.createElement('span');
      cell.textContent = value;
      row.append(cell);
    }
    list.append(row);
  }
};

const renderTaxiPreview = (data) => {
  const { taxiRide: ride, taxiCharges: charges } = data;
  const totals = computeTaxiTotals(charges);
  preview.passenger.textContent = ride.passenger || '—';
  preview.route.textContent = [ride.pickupLocation, ride.dropoffLocation].filter(Boolean).join(' → ') || '—';
  preview.pickup.textContent = readableDate(ride.pickupTime);
  preview.dropoff.textContent = readableDate(ride.dropoffTime);
  preview.driver.textContent = ride.driver || '—';
  preview.vehicle.textContent = ride.vehicle || '—';
  preview.basefare.textContent = currency(charges.baseFare);
  preview.distanceCharge.textContent = currency(totals.distanceCharge);
  preview.distanceMeta.textContent = charges.distanceMiles + ' mi × ' + currency(charges.ratePerMile) + '/mi';
  preview.extras.textContent = currency(charges.extras);
  preview.taxiSubtotal.textContent = currency(totals.subtotal);
  preview.tip.textContent = currency(charges.tip);
  preview.total.textContent = currency(totals.total);
  preview.rideNote.textContent = ride.note;
  preview.rideNote.hidden = !ride.note;
  byId('taxi-dropoff-time').min = ride.pickupTime;
};

const renderPreview = () => {
  const data = getFormData();
  byId('store-name').setCustomValidity(data.storeName ? '' : 'Enter a business name.');
  preview.storeName.textContent = data.storeName || (data.type === 'taxi' ? 'Taxi service' : 'Store');
  preview.storeTagline.textContent = data.tagline;
  preview.storeAddress.textContent = data.address;
  preview.storePhone.textContent = data.phone;
  preview.receipt.textContent = data.receiptId || '—';
  preview.register.textContent = data.register || '—';
  preview.cashier.textContent = data.cashier || '—';
  preview.date.textContent = readableDate(data.datetime);
  preview.payment.textContent = data.paymentMethod;
  preview.payment.parentElement.hidden = !data.paymentMethod;
  byId('transaction-summary').textContent = data.receiptId;
  byId('footer-setting').hidden = !data.showFooter;
  byId('closing-setting').hidden = !data.showClosing;
  preview.footer.textContent = data.footerMessage;
  preview.footer.hidden = !(data.showFooter && data.footerMessage);
  preview.thanks.textContent = data.closingMessage;
  preview.thanks.hidden = !(data.showClosing && data.closingMessage);

  if (data.type === 'taxi') {
    renderTaxiPreview(data);
  } else {
    const totals = computeRetailTotals(data.items, data.taxRate, data.discount);
    preview.subtotal.textContent = currency(totals.subtotal);
    preview.taxLabel.textContent = 'Tax (' + data.taxRate + '%)';
    preview.tax.textContent = currency(totals.tax);
    preview.discount.textContent = currency(-totals.discount);
    preview.discount.parentElement.hidden = totals.discount === 0;
    preview.total.textContent = currency(totals.total);
    renderItemsPreview(data.items);
  }
};

const slugify = (value) => value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

const buildFileBase = (data) => {
  const prefix = [data.storeName, data.receiptId].map(slugify).filter(Boolean).join('-') || 'receipt';
  const stamp = (data.datetime || toInputDateTime()).slice(0, 10);
  return prefix + '-' + stamp;
};

const captureReceipt = () => {
  const paperWidth = receipt.getBoundingClientRect().width;
  return window.html2canvas(receipt, {
    scale: 2,
    backgroundColor: '#ffffff',
    logging: false,
    onclone: (doc, paper) => {
      // Capture the entire paper even when its preview is scrolled or clipped.
      doc.body.appendChild(paper);
      Object.assign(paper.style, { position: 'absolute', top: '0', left: '0', width: paperWidth + 'px' });
    },
  });
};

const downloadPng = (dataUrl, fileBase) => {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = fileBase + '.png';
  document.body.appendChild(link);
  link.click();
  link.remove();
};

const downloadPdf = (dataUrl, fileBase, canvas) => {
  const width = 80;
  const height = width * canvas.height / canvas.width;
  // jsPDF supports up to 14,400 points per page. Split only unusually long rolls.
  const pageLimit = 5080;
  const pageSize = (offset) => [width, Math.min(pageLimit, height - offset)];
  const orientation = (size) => size[1] >= size[0] ? 'portrait' : 'landscape';
  const first = pageSize(0);
  const pdf = new window.jspdf.jsPDF({ unit: 'mm', format: first, orientation: orientation(first), compress: true });
  for (let offset = 0; offset < height; offset += pageLimit) {
    if (offset) {
      const size = pageSize(offset);
      pdf.addPage(size, orientation(size));
    }
    pdf.addImage(dataUrl, 'PNG', 0, -offset, width, height, 'receipt', 'FAST');
  }
  pdf.save(fileBase + '.pdf');
};

const persistReceipt = async (imageData, fileBase, data) => {
  const totals = data.type === 'taxi'
    ? computeTaxiTotals(data.taxiCharges)
    : computeRetailTotals(data.items, data.taxRate, data.discount);
  const response = await fetch('api/receipts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: window.AbortSignal?.timeout?.(30000),
    body: JSON.stringify({
      imageData, fileName: fileBase,
      meta: { storeName: data.storeName, receiptId: data.receiptId, type: data.type, total: totals.total },
    }),
  });
  if (!response.ok) throw new Error('Server save failed');
  return response.json();
};

const checkServerAvailability = async () => {
  // Pages is static. It should never need to probe the account's /api route.
  if (location.protocol === 'file:' || location.hostname.endsWith('.github.io')) return;
  try {
    const response = await fetch('api/health', { cache: 'no-store', signal: window.AbortSignal?.timeout?.(4000) });
    if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) return;
    const health = await response.json();
    if (health?.status === 'ok') {
      byId('enable-server-save').disabled = false;
      byId('server-option').hidden = false;
    }
  } catch {
    // Downloads work offline and on static hosts.
  }
};

const showStatus = (message, { error = false, downloads = false } = {}) => {
  byId('output-panel').hidden = false;
  byId('output-panel').toggleAttribute('data-error', error);
  byId('save-status').textContent = message;
  byId('repeat-downloads').hidden = !downloads;
};

const handleGenerate = async (event) => {
  event.preventDefault();
  if (isGenerating) return;
  const data = getFormData();
  if (data.type === 'retail' && !data.items.length) {
    showStatus('Add a line item before exporting.', { error: true });
    byId('add-item').focus();
    return;
  }
  if (data.type === 'taxi' && computeTaxiTotals(data.taxiCharges).total <= 0) {
    showStatus('Enter a fare or tip before exporting.', { error: true });
    byId('taxi-base-fare').focus();
    return;
  }

  const direct = event.submitter?.name === 'format' ? event.submitter.value : null;
  const png = direct ? direct === 'png' : byId('auto-download-png').checked;
  const pdf = direct ? direct === 'pdf' : byId('auto-download-pdf').checked;
  const save = !direct && !byId('enable-server-save').disabled && byId('enable-server-save').checked;
  isGenerating = true;
  formatButtons.forEach((button) => { button.disabled = true; });
  byId('generate-btn').textContent = 'Exporting…';
  byId('output-panel').hidden = true;

  try {
    const canvas = await captureReceipt();
    const dataUrl = canvas.toDataURL('image/png');
    if (!dataUrl.startsWith('data:image/png;')) throw new Error('The browser could not create the image');
    const fileBase = buildFileBase(data);
    if (png) downloadPng(dataUrl, fileBase);
    if (pdf) downloadPdf(dataUrl, fileBase, canvas);
    let message = 'Receipt ready.';
    if (png || pdf) message = png && pdf ? 'PNG and PDF downloads started.' : (png ? 'PNG' : 'PDF') + ' download started.';
    if (save) {
      try {
        const saved = await persistReceipt(dataUrl, fileBase, data);
        message += ' Server copy saved to ' + saved.relativePath + '.';
      } catch {
        showStatus(message + ' Could not confirm the server copy.', { error: true, downloads: true });
        return;
      }
    }
    showStatus(message, { downloads: true });
  } catch (error) {
    console.error('Receipt export failed', error);
    showStatus('Export failed. Please try again.', { error: true });
  } finally {
    isGenerating = false;
    formatButtons.forEach((button) => { button.disabled = false; });
    byId('generate-btn').textContent = 'Export receipt';
  }
};

const now = new Date();
byId('purchase-datetime').value = toInputDateTime(now);
byId('taxi-pickup-time').value = toInputDateTime(now);
byId('taxi-dropoff-time').value = toInputDateTime(new Date(now.getTime() + 20 * 60 * 1000));
defaultItems.forEach(addItemRow);
setActiveTemplate();
renderPreview();

byId('add-item').addEventListener('click', () => {
  const row = addItemRow();
  row.querySelector('input').focus();
  renderPreview();
});
byId('receipt-type').addEventListener('change', () => {
  setActiveTemplate();
  renderPreview();
});
form.addEventListener('input', renderPreview);
form.addEventListener('invalid', (event) => {
  const section = event.target.closest('details');
  if (section) section.open = true;
}, true);
form.addEventListener('submit', handleGenerate);
checkServerAvailability();

const html2canvas = window.html2canvas;
const { jsPDF } = window.jspdf;

const dom = {
  form: document.getElementById('receipt-form'),
  itemsContainer: document.getElementById('items-container'),
  addItem: document.getElementById('add-item'),
  purchaseDate: document.getElementById('purchase-datetime'),
  receiptType: document.getElementById('receipt-type'),
  receipt: document.getElementById('receipt'),
  previewItems: document.getElementById('preview-items'),
  autoPng: document.getElementById('auto-download-png'),
  autoPdf: document.getElementById('auto-download-pdf'),
  showFooter: document.getElementById('show-footer-message'),
  showThanks: document.getElementById('show-thankyou-line'),
  generateBtn: document.getElementById('generate-btn'),
  outputPanel: document.getElementById('output-panel'),
  saveStatus: document.getElementById('save-status'),
  downloadPngBtn: document.getElementById('download-png-btn'),
  downloadPdfBtn: document.getElementById('download-pdf-btn'),
};

const previewFields = {
  storeName: document.querySelector('[data-store-name]'),
  tagline: document.querySelector('[data-store-tagline]'),
  meta: document.querySelector('[data-store-meta]'),
  receipt: document.querySelector('[data-preview-receipt]'),
  register: document.querySelector('[data-preview-register]'),
  cashier: document.querySelector('[data-preview-cashier]'),
  date: document.querySelector('[data-preview-date]'),
  subtotal: document.querySelector('[data-preview-subtotal]'),
  tax: document.querySelector('[data-preview-tax]'),
  discount: document.querySelector('[data-preview-discount]'),
  total: document.querySelector('[data-preview-total]'),
  payment: document.querySelector('[data-preview-payment]'),
  ridePassenger: document.querySelector('[data-preview-passenger]'),
  rideRoute: document.querySelector('[data-preview-route]'),
  ridePickup: document.querySelector('[data-preview-pickup]'),
  rideDropoff: document.querySelector('[data-preview-dropoff]'),
  rideDriver: document.querySelector('[data-preview-driver]'),
  rideVehicle: document.querySelector('[data-preview-vehicle]'),
  rideBasefare: document.querySelector('[data-preview-basefare]'),
  rideDistanceCharge: document.querySelector('[data-preview-distance-charge]'),
  rideDistanceMeta: document.querySelector('[data-preview-distance-meta]'),
  rideExtras: document.querySelector('[data-preview-extras]'),
  rideSubtotal: document.querySelector('[data-preview-taxi-subtotal]'),
  tip: document.querySelector('[data-preview-tip]'),
  rideNote: document.querySelector('[data-preview-ride-note]'),
  thanks: document.querySelector('[data-preview-thanks]'),
  footer: document.querySelector('[data-preview-footer]'),
};

const templateSections = document.querySelectorAll('[data-template]');
let activeTemplate = null;

const currencyFormatter = new Intl.NumberFormat(undefined, {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
});

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

const getInputValue = (id) => {
  const el = document.getElementById(id);
  return el ? el.value.trim() : '';
};

const getNumberValue = (id) => {
  const el = document.getElementById(id);
  if (!el) return 0;
  const parsed = parseFloat(el.value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatRoute = (pickup, dropoff) => {
  if (pickup && dropoff) {
    return `${pickup} → ${dropoff}`;
  }
  return pickup || dropoff || 'Route pending';
};

const setActiveTemplate = (template) => {
  if (activeTemplate === template) {
    return;
  }
  activeTemplate = template;
  templateSections.forEach((element) => {
    const targets = element.dataset.template
      .split(',')
      .map((entry) => entry.trim());
    element.hidden = !targets.includes(template);
  });
  dom.receipt.classList.toggle('receipt--taxi', template === 'taxi');
};
let lastImageDataUrl = null;
let lastCanvasDimensions = { width: 0, height: 0 };
let lastFileBase = 'receipt';
let isGenerating = false;

const defaultItems = [
  { description: 'Cold Brew', qty: 1, price: 4.5 },
  { description: 'Sesame Bagel', qty: 2, price: 2.25 },
  { description: 'Granola Bar', qty: 1, price: 1.75 },
];

const setTaxiDefaults = () => {
  const pickupInput = document.getElementById('taxi-pickup-time');
  const dropoffInput = document.getElementById('taxi-dropoff-time');
  const now = new Date();
  if (pickupInput && !pickupInput.value) {
    pickupInput.value = toInputDateTime(now);
  }
  if (dropoffInput && !dropoffInput.value) {
    const later = new Date(now.getTime() + 20 * 60 * 1000);
    dropoffInput.value = toInputDateTime(later);
  }
};

const getTaxiRideData = () => ({
  passenger: getInputValue('taxi-passenger'),
  pickupLocation: getInputValue('taxi-pickup'),
  dropoffLocation: getInputValue('taxi-dropoff'),
  pickupTime: document.getElementById('taxi-pickup-time')?.value || '',
  dropoffTime: document.getElementById('taxi-dropoff-time')?.value || '',
  driver: getInputValue('taxi-driver'),
  vehicle: getInputValue('taxi-vehicle'),
  note: getInputValue('taxi-notes'),
});

const getTaxiCharges = () => ({
  baseFare: getNumberValue('taxi-base-fare'),
  distanceMiles: getNumberValue('taxi-distance'),
  ratePerMile: getNumberValue('taxi-rate'),
  extras: getNumberValue('taxi-extras'),
  tip: getNumberValue('taxi-tip'),
});

const slugify = (value = '') =>
  value
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const currency = (value) => currencyFormatter.format(value || 0);

const toInputDateTime = (date = new Date()) => {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
};

const readableDate = (value) => {
  if (!value) return dateFormatter.format(new Date());
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return dateFormatter.format(new Date());
  return dateFormatter.format(parsed);
};

const addItemRow = (item = {}) => {
  const row = document.createElement('div');
  row.className = 'item-row';
  row.innerHTML = `
    <input type="text" placeholder="Description" value="${item.description || ''}" data-field="description" />
    <input type="number" min="1" step="1" value="${item.qty ?? 1}" data-field="qty" />
    <input type="number" min="0" step="0.01" value="${item.price ?? 0}" data-field="price" />
    <button type="button" title="Remove item">&times;</button>
  `;

  row.querySelectorAll('input').forEach((el) => el.addEventListener('input', renderPreview));
  row.querySelector('button').addEventListener('click', () => {
    row.remove();
    renderPreview();
  });

  dom.itemsContainer.appendChild(row);
};

const collectItems = () =>
  Array.from(dom.itemsContainer.querySelectorAll('.item-row'))
    .map((row) => {
      const description = row.querySelector('[data-field="description"]').value.trim();
      const qty = parseFloat(row.querySelector('[data-field="qty"]').value) || 0;
      const price = parseFloat(row.querySelector('[data-field="price"]').value) || 0;
      return { description, qty, price };
    })
    .filter((item) => item.description || item.price > 0);

const getFormData = () => {
  const items = collectItems();
  const type = dom.receiptType.value;
  return {
    type,
    storeName: document.getElementById('store-name').value.trim() || 'Store',
    tagline: document.getElementById('store-tagline').value.trim(),
    address: document.getElementById('store-address').value.trim(),
    phone: document.getElementById('store-phone').value.trim(),
    receiptId: document.getElementById('receipt-id').value.trim(),
    register: document.getElementById('register-id').value.trim(),
    cashier: document.getElementById('cashier-name').value.trim(),
    datetime: document.getElementById('purchase-datetime').value || new Date().toISOString(),
    taxRate: parseFloat(document.getElementById('tax-rate').value) || 0,
    discount: parseFloat(document.getElementById('discount-amount').value) || 0,
    paymentMethod: document.getElementById('payment-method').value.trim(),
    footerMessage: document.getElementById('footer-message').value.trim(),
    closingMessage: document.getElementById('closing-message').value.trim(),
    showFooter: !!dom.showFooter?.checked,
    showClosing: !!dom.showThanks?.checked,
    taxiRide: getTaxiRideData(),
    taxiCharges: getTaxiCharges(),
    items,
  };
};

const computeRetailTotals = (items, taxRate, discount) => {
  const subtotal = items.reduce((sum, item) => sum + item.qty * item.price, 0);
  const tax = subtotal * (taxRate / 100);
  const safeDiscount = Math.min(discount, subtotal + tax);
  const total = subtotal + tax - safeDiscount;
  return { subtotal, tax, discount: safeDiscount, total };
};

const computeTaxiTotals = (charges) => {
  const distanceCharge = charges.distanceMiles * charges.ratePerMile;
  const subtotal = charges.baseFare + distanceCharge + charges.extras;
  const total = subtotal + charges.tip;
  return {
    distanceCharge,
    subtotal,
    total,
  };
};

const hasTaxiCharges = (charges) => {
  if (!charges) return false;
  if (charges.baseFare > 0) return true;
  if (charges.extras > 0) return true;
  if (charges.tip > 0) return true;
  if (charges.distanceMiles > 0 && charges.ratePerMile >= 0) return true;
  return false;
};

const renderItemsPreview = (items) => {
  dom.previewItems.innerHTML = '';
  if (!items.length) {
    const placeholder = document.createElement('div');
    placeholder.textContent = 'Add items to build your receipt';
    placeholder.style.opacity = '0.6';
    dom.previewItems.appendChild(placeholder);
    return;
  }

  items.forEach((item) => {
    const row = document.createElement('div');
    row.innerHTML = `
      <span>${item.description || 'Item'}</span>
      <span>${item.qty.toFixed(0)}</span>
      <span>${currency(item.qty * item.price)}</span>
    `;
    dom.previewItems.appendChild(row);
  });
};

const renderPreview = () => {
  const data = getFormData();
  const isTaxi = data.type === 'taxi';
  setActiveTemplate(isTaxi ? 'taxi' : 'retail');

  previewFields.storeName.textContent =
    data.storeName || (isTaxi ? 'City Taxi Service' : 'Store');
  previewFields.tagline.textContent =
    data.tagline || (isTaxi ? 'Licensed & Insured Rides' : '—');
  previewFields.meta.textContent = [data.address, data.phone].filter(Boolean).join(' • ') || '';
  previewFields.receipt.textContent = data.receiptId || '—';
  previewFields.register.textContent = data.register || '—';
  previewFields.cashier.textContent = data.cashier || '—';
  const primaryDate =
    isTaxi && data.taxiRide.pickupTime ? data.taxiRide.pickupTime : data.datetime;
  previewFields.date.textContent = readableDate(primaryDate);
  previewFields.payment.textContent = data.paymentMethod || '';
  const shouldShowFooter = data.showFooter && data.footerMessage;
  previewFields.footer.textContent = data.footerMessage || '';
  previewFields.footer.hidden = !shouldShowFooter;

  const closingFallback = isTaxi ? 'Thank you for riding with us!' : 'Thank you for shopping!';
  const closingText = data.closingMessage || closingFallback;
  if (previewFields.thanks) {
    previewFields.thanks.textContent = closingText;
    previewFields.thanks.hidden = !data.showClosing;
  }

  if (isTaxi) {
    const totals = computeTaxiTotals(data.taxiCharges);
    renderTaxiPreview(data, totals);
  } else {
    const totals = computeRetailTotals(data.items, data.taxRate, data.discount);
    previewFields.subtotal.textContent = currency(totals.subtotal);
    previewFields.tax.textContent = `${currency(totals.tax)} (${(data.taxRate || 0).toFixed(
      2
    )}%)`;
    previewFields.discount.textContent = currency(totals.discount);
    previewFields.total.textContent = currency(totals.total);
    renderItemsPreview(data.items);
  }
};

const renderTaxiPreview = (data, totals) => {
  const ride = data.taxiRide;
  const charges = data.taxiCharges;

  previewFields.ridePassenger.textContent = ride.passenger || 'Walk-up passenger';
  previewFields.rideRoute.textContent = formatRoute(ride.pickupLocation, ride.dropoffLocation);
  previewFields.ridePickup.textContent = ride.pickupTime ? readableDate(ride.pickupTime) : '—';
  previewFields.rideDropoff.textContent = ride.dropoffTime ? readableDate(ride.dropoffTime) : '—';
  previewFields.rideDriver.textContent = ride.driver || data.cashier || '—';
  previewFields.rideVehicle.textContent = ride.vehicle || data.register || '—';
  previewFields.rideBasefare.textContent = currency(charges.baseFare);
  previewFields.rideDistanceCharge.textContent = currency(totals.distanceCharge);
  previewFields.rideDistanceMeta.textContent =
    charges.distanceMiles > 0 && charges.ratePerMile > 0
      ? `${charges.distanceMiles.toFixed(2)} mi @ ${currency(charges.ratePerMile)}/mi`
      : '—';
  previewFields.rideExtras.textContent = currency(charges.extras);
  previewFields.rideSubtotal.textContent = currency(totals.subtotal);
  previewFields.tip.textContent = currency(charges.tip);
  previewFields.total.textContent = currency(totals.total);

  if (previewFields.rideNote) {
    previewFields.rideNote.textContent = ride.note;
    previewFields.rideNote.hidden = !ride.note;
  }
};

const downloadPng = (dataUrl, fileBase) => {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = `${fileBase}.png`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

const downloadPdf = (dataUrl, fileBase, width, height) => {
  if (!width || !height) return;
  const orientation = height >= width ? 'portrait' : 'landscape';
  const pdf = new jsPDF({
    orientation,
    unit: 'px',
    format: [width, height],
  });
  pdf.addImage(dataUrl, 'PNG', 0, 0, width, height);
  pdf.save(`${fileBase}.pdf`);
};

const persistReceipt = async (imageData, fileBase, meta) => {
  const payload = {
    imageData,
    fileName: fileBase,
    meta: {
      storeName: meta.storeName,
      receiptId: meta.receiptId,
      total: meta.total,
      type: meta.type,
    },
  };

  const response = await fetch('/api/receipts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message);
  }

  return response.json();
};

const buildFileBase = (data) => {
  const parts = [data.storeName, data.receiptId].map(slugify).filter(Boolean);
  const stamp = new Date().toISOString().slice(0, 10);
  return parts.length ? `${parts.join('-')}-${stamp}` : `receipt-${stamp}`;
};

const handleGenerate = async (event) => {
  event.preventDefault();
  if (isGenerating) return;

  const data = getFormData();
  const isTaxi = data.type === 'taxi';
  const hasContent = isTaxi ? hasTaxiCharges(data.taxiCharges) : data.items.length > 0;

  if (!hasContent) {
    alert(
      isTaxi
        ? 'Add fare details before generating a taxi receipt.'
        : 'Add at least one line item before generating a receipt.'
    );
    return;
  }
  const totals = isTaxi
    ? computeTaxiTotals(data.taxiCharges)
    : computeRetailTotals(data.items, data.taxRate, data.discount);

  isGenerating = true;
  dom.generateBtn.disabled = true;
  dom.generateBtn.textContent = 'Generating...';
  dom.saveStatus.textContent = '';

  try {
    const canvas = await html2canvas(dom.receipt, {
      scale: window.devicePixelRatio < 2 ? 2 : window.devicePixelRatio,
      backgroundColor: '#ffffff',
    });

    const dataUrl = canvas.toDataURL('image/png');
    const fileBase = buildFileBase({
      storeName: data.storeName,
      receiptId: data.receiptId,
    });
    lastImageDataUrl = dataUrl;
    lastCanvasDimensions = { width: canvas.width, height: canvas.height };
    lastFileBase = fileBase;

    if (dom.autoPng.checked) {
      downloadPng(dataUrl, fileBase);
    }
    if (dom.autoPdf.checked) {
      downloadPdf(dataUrl, fileBase, canvas.width, canvas.height);
    }

    try {
      const response = await persistReceipt(dataUrl, fileBase, {
        storeName: data.storeName,
        receiptId: data.receiptId,
        total: totals.total,
        type: data.type,
      });
      dom.saveStatus.textContent = `Saved copy inside container as /${response.relativePath}`;
    } catch (saveError) {
      console.error('Failed to save receipt to disk', saveError);
      dom.saveStatus.textContent = 'Generated receipt, but failed to save a copy to disk.';
    }

    dom.outputPanel.hidden = false;
  } catch (error) {
    console.error(error);
    dom.saveStatus.textContent = 'Generation failed. Check console for details.';
    dom.outputPanel.hidden = false;
  } finally {
    isGenerating = false;
    dom.generateBtn.disabled = false;
    dom.generateBtn.textContent = 'Generate receipt';
  }
};

const init = () => {
  dom.purchaseDate.value = toInputDateTime(new Date());
  setTaxiDefaults();
  setActiveTemplate(dom.receiptType.value || 'retail');
  defaultItems.forEach((item) => addItemRow(item));
  renderPreview();

  dom.addItem.addEventListener('click', () => addItemRow({ qty: 1, price: 0 }));
  dom.receiptType.addEventListener('change', renderPreview);
  dom.form.addEventListener('input', renderPreview);
  dom.form.addEventListener('submit', handleGenerate);

  dom.downloadPngBtn.addEventListener('click', () => {
    if (!lastImageDataUrl) return alert('Generate a receipt first.');
    downloadPng(lastImageDataUrl, lastFileBase);
  });

  dom.downloadPdfBtn.addEventListener('click', () => {
    if (!lastImageDataUrl) return alert('Generate a receipt first.');
    downloadPdf(
      lastImageDataUrl,
      lastFileBase,
      lastCanvasDimensions.width,
      lastCanvasDimensions.height
    );
  });
};

init();

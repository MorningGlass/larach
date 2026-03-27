/* =============================================
   Coigach Heritage Map — app.js
   Data: data/sites.geojson
   Images: data/photo/<filename>
   ============================================= */

const IMG_PATH = './data/photo/';

const PIN_COLOUR = '#C0AE9E';

function makeSvgIcon() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="26" height="34" viewBox="0 0 26 34">
    <path d="M13 0C5.8 0 0 5.8 0 13c0 9.6 13 21 13 21s13-11.4 13-21C26 5.8 20.2 0 13 0z"
      fill="${PIN_COLOUR}" stroke="white" stroke-width="1.5"/>
    <circle cx="13" cy="13" r="5" fill="white"/>
  </svg>`;
  return L.divIcon({
    html: `<div class="marker-icon">${svg}</div>`,
    className: '',
    iconSize: [26, 34],
    iconAnchor: [13, 34],
    popupAnchor: [0, -36]
  });
}

/* ---- State ---- */
let map, layerGroup;
let allFeatures = [];
let activeId = null;

// Lightbox state
let lbImages = [];
let lbIndex = 0;

/* ---- Map init ---- */
function initMap() {
  map = L.map('map', {
    center: [58.03, -5.38],
    zoom: 12,
    zoomControl: false
  });

  L.control.zoom({ position: 'topright' }).addTo(map);

  const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19
  });

  const satellite = L.tileLayer(
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Tiles &copy; Esri',
    maxZoom: 18
  });

  const topo = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://opentopomap.org">OpenTopoMap</a>',
    maxZoom: 17
  });

  osm.addTo(map);

  L.control.layers(
    { 'Street': osm, 'Satellite': satellite, 'Topographic': topo },
    {},
    { position: 'topright', collapsed: true }
  ).addTo(map);

  layerGroup = L.layerGroup().addTo(map);
}

/* ---- Load data ---- */
async function loadData() {
  const res = await fetch('./data/sites.geojson');
  if (!res.ok) throw new Error('Could not load sites.geojson');
  const geojson = await res.json();
  return geojson.features;
}

/* ---- Populate filters ---- */
function populateFilters(features) {
  const cats = [...new Set(features.map(f => f.properties.category))].sort();
  const townships = [...new Set(features.map(f => f.properties.township))].sort();

  const catSel = document.getElementById('filter-category');
  cats.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c; opt.textContent = c;
    catSel.appendChild(opt);
  });

  const twnSel = document.getElementById('filter-township');
  townships.forEach(t => {
    const opt = document.createElement('option');
    opt.value = t; opt.textContent = t;
    twnSel.appendChild(opt);
  });
}

/* ---- Filter logic ---- */
function getFiltered() {
  const q = document.getElementById('search-input').value.toLowerCase().trim();
  const cat = document.getElementById('filter-category').value;
  const twn = document.getElementById('filter-township').value;

  return allFeatures.filter(f => {
    const p = f.properties;
    const matchQ = !q ||
      p.name.toLowerCase().includes(q) ||
      p.township.toLowerCase().includes(q) ||
      p.caption.toLowerCase().includes(q);
    const matchCat = !cat || p.category === cat;
    const matchTwn = !twn || p.township === twn;
    return matchQ && matchCat && matchTwn;
  });
}

/* ---- Build markers ---- */
function buildMarkers(features) {
  layerGroup.clearLayers();

  features.forEach(feature => {
    const p = feature.properties;
    const [lng, lat] = feature.geometry.coordinates;
    const icon = makeSvgIcon();

    const marker = L.marker([lat, lng], { icon })
      .on('click', () => {
        setActive(p.name);
        openDetail(feature);
      });

    marker._siteName = p.name;
    layerGroup.addLayer(marker);
  });
}


/* ---- Sidebar list ---- */
function buildList(features) {
  const list = document.getElementById('location-list');
  const count = document.getElementById('list-count');

  list.innerHTML = features.map(f => {
    const p = f.properties;
    const thumb = p.images && p.images.length
      ? `<img class="location-thumb" src="${IMG_PATH}${p.images[0].file}" alt="" loading="lazy" onerror="this.outerHTML='<div class=location-thumb-ph>🏚</div>'">`
      : `<div class="location-thumb-ph">🏚</div>`;
    const isActive = activeId === p.name;
    return `
      <div class="location-item${isActive ? ' active' : ''}" data-name="${p.name}" onclick="selectFromList('${p.name.replace(/'/g, "\\'")}')">
        ${thumb}
        <div class="location-info">
          <div class="location-name">${p.township} · ${p.name}</div>
          <div class="location-sub">${p.caption}</div>
          <span class="location-tag">${p.category}</span>
        </div>
      </div>`;
  }).join('');

  count.textContent = `${features.length} site${features.length !== 1 ? 's' : ''}`;
}

/* ---- Selection ---- */
function setActive(name) {
  activeId = name;
  document.querySelectorAll('.location-item').forEach(el => {
    el.classList.toggle('active', el.dataset.name === name);
  });
  const el = document.querySelector(`.location-item[data-name="${name}"]`);
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function selectFromList(name) {
  const feature = allFeatures.find(f => f.properties.name === name);
  if (!feature) return;
  setActive(name);
  openDetail(feature);
}

/* ---- Helpers ---- */
function toDMS(decimal, isLat) {
  const dir = isLat ? (decimal >= 0 ? 'N' : 'S') : (decimal >= 0 ? 'E' : 'W');
  const abs = Math.abs(decimal);
  const d = Math.floor(abs);
  const minFloat = (abs - d) * 60;
  const m = Math.floor(minFloat);
  const s = Math.round((minFloat - m) * 60);
  return `${d}°${m}'${s}"${dir}`;
}

function formatDate(str) {
  if (!str) return '';
  const [y, m, d] = str.split('-');
  return `${d}/${m}/${y}`;
}

/* ---- Pan so pin is centred with card above it ---- */
function panForCard(lat, lng) {
  const zoom = Math.max(map.getZoom(), 15);
  if (window.innerWidth > 680) {
    // Sidebar is 300px + padding. Centre pin in remaining area, offset down so card appears above
    const sidebarWidth = 324;
    const mapW = map.getSize().x;
    const mapH = map.getSize().y;
    // Offset X: centre in visible area to right of sidebar
    const offsetX = sidebarWidth / 2;
    // Offset Y: move pin down so there's room for card above (card is ~400px tall)
    const offsetY = -mapH * 0.5;
    const targetPx = map.project([lat, lng], zoom).subtract([offsetX, offsetY]);
    map.setView(map.unproject(targetPx, zoom), zoom, { animate: true });
  } else {
    // Mobile: offset pin down to make room for card
    const mapH = map.getSize().y;
    const offsetY = -mapH * 0.3;
    const targetPx = map.project([lat, lng], zoom).subtract([0, offsetY]);
    map.setView(map.unproject(targetPx, zoom), zoom, { animate: true });
  }
}

/* ---- Site card ---- */
let cardImgIndex = 0;

function openDetail(feature) {
  const p = feature.properties;
  const lat = feature.geometry.coordinates[1];
  const lng = feature.geometry.coordinates[0];
  const imgs = p.images || [];

  panForCard(lat, lng);

  lbImages = imgs;
  cardImgIndex = 0;

  // Title - use first image caption if available, otherwise site caption/name
  const firstImgCaption = imgs.length > 0 && imgs[0].caption ? imgs[0].caption : null;
  document.getElementById('card-title').textContent = firstImgCaption || p.caption || p.name;

  // Metadata rows
  const dms = `${toDMS(lat, true)}, ${toDMS(lng, false)}`;
  document.getElementById('card-meta').innerHTML = `
    ${p.township ? `<div class="card-meta-row"><strong>Township:</strong> ${p.township}</div>` : ''}
    <div class="card-meta-row"><strong>OS Grid Ref:</strong> ${p.os_grid}</div>
    <div class="card-meta-row"><strong>Location:</strong> ${dms}</div>
    ${p.photo_date ? `<div class="card-meta-row"><strong>Date photographed:</strong> ${formatDate(p.photo_date)}</div>` : ''}
    ${p.altitude !== undefined && p.altitude !== '' ? `<div class="card-meta-row"><strong>Altitude:</strong> ${p.altitude}m</div>` : ''}
  `;

  // Image
  renderCardImage(imgs, 0);

  document.getElementById('site-card-overlay').classList.add('open');
}

function renderCardImage(imgs, idx) {
  const wrap = document.getElementById('card-img-wrap');
  if (!imgs.length) {
    wrap.innerHTML = `<div class="card-img-ph">🏚</div>`;
    return;
  }
  const img = imgs[idx];
  const counter = imgs.length > 1 ? `<div class="card-img-counter">${idx + 1} / ${imgs.length}</div>` : '';
  const prevBtn = imgs.length > 1 ? `<button class="card-img-btn prev" onclick="cardImgNav(-1)">&#8249;</button>` : '';
  const nextBtn = imgs.length > 1 ? `<button class="card-img-btn next" onclick="cardImgNav(1)">&#8250;</button>` : '';

  wrap.innerHTML = `
    ${prevBtn}
    <img class="card-img" src="${IMG_PATH}${img.file}" alt="${img.caption}"
         onclick="openLightbox(${idx})"
         onerror="this.outerHTML='<div class=card-img-ph>🏚</div>'">
    ${nextBtn}
    ${counter}
  `;
}

window.cardImgNav = function(dir) {
  cardImgIndex = (cardImgIndex + dir + lbImages.length) % lbImages.length;
  renderCardImage(lbImages, cardImgIndex);
  // Update title with current image caption
  if (lbImages[cardImgIndex] && lbImages[cardImgIndex].caption) {
    document.getElementById('card-title').textContent = lbImages[cardImgIndex].caption;
  }
};

function closeDetail() {
  document.getElementById('site-card-overlay').classList.remove('open');
}
window.closeDetail = closeDetail;

/* ---- Lightbox ---- */
window.openLightbox = function(idx) {
  lbIndex = idx;
  renderLightbox();
  document.getElementById('lightbox').classList.add('open');
  document.addEventListener('keydown', lightboxKey);
};

function renderLightbox() {
  const img = lbImages[lbIndex];
  if (!img) return;
  document.getElementById('lightbox-img').src = IMG_PATH + img.file;
  document.getElementById('lightbox-caption').textContent =
    img.caption + (lbImages.length > 1 ? `  (${lbIndex + 1} / ${lbImages.length})` : '');
  // Hide nav if only one image
  document.getElementById('lightbox-prev').style.display = lbImages.length > 1 ? '' : 'none';
  document.getElementById('lightbox-next').style.display = lbImages.length > 1 ? '' : 'none';
}

window.lightboxNav = function(dir) {
  lbIndex = (lbIndex + dir + lbImages.length) % lbImages.length;
  renderLightbox();
};

window.closeLightbox = function() {
  document.getElementById('lightbox').classList.remove('open');
  document.removeEventListener('keydown', lightboxKey);
};

function lightboxKey(e) {
  if (e.key === 'ArrowRight') lightboxNav(1);
  if (e.key === 'ArrowLeft')  lightboxNav(-1);
  if (e.key === 'Escape')     closeLightbox();
}

/* ---- Sidebar toggle ---- */
window.toggleSidebar = function() {
  const sb = document.getElementById('sidebar');
  if (window.innerWidth <= 680) {
    sb.classList.toggle('mobile-open');
  } else {
    sb.classList.toggle('hidden');
  }
};

/* ---- About modal ---- */
window.openAbout  = () => document.getElementById('about-modal').classList.add('open');
window.closeAbout = () => document.getElementById('about-modal').classList.remove('open');

/* ---- Apply filters ---- */
function applyFilters() {
  const filtered = getFiltered();
  buildMarkers(filtered);
  buildList(filtered);
}

/* ---- Fit bounds ---- */
function fitBounds(features) {
  if (!features.length) return;
  const coords = features.map(f => [
    f.geometry.coordinates[1],
    f.geometry.coordinates[0]
  ]);
  map.fitBounds(L.latLngBounds(coords), { padding: [40, 40] });
}

/* ---- Close sidebar on mobile when map is tapped ---- */
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('map').addEventListener('click', () => {
    if (window.innerWidth <= 680) {
      document.getElementById('sidebar').classList.remove('mobile-open');
    }
  });
});

/* ---- Entry point ---- */
async function init() {
  initMap();
  try {
    allFeatures = await loadData();
    populateFilters(allFeatures);
    buildMarkers(allFeatures);
    buildList(allFeatures);
    fitBounds(allFeatures);

    const searchInput = document.getElementById('search-input');
    const catFilter   = document.getElementById('filter-category');
    const twnFilter   = document.getElementById('filter-township');

    function updateListVisibility() {
      const active = searchInput.value.trim() || catFilter.value || twnFilter.value;
      document.getElementById('location-list').classList.toggle('list-hidden', !active);
      document.getElementById('list-count').classList.toggle('list-hidden', !active);
    }

    searchInput.addEventListener('focus', () => {
      document.getElementById('location-list').classList.remove('list-hidden');
      document.getElementById('list-count').classList.remove('list-hidden');
    });

    searchInput.addEventListener('input', () => { applyFilters(); updateListVisibility(); });
    catFilter.addEventListener('change', () => { applyFilters(); updateListVisibility(); });
    twnFilter.addEventListener('change', () => { applyFilters(); updateListVisibility(); });
  } catch (err) {
    console.error(err);
    document.getElementById('list-count').textContent = 'Error loading data';
  }
  document.getElementById('loading').style.display = 'none';
}

init();

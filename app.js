const apiBaseInput = document.getElementById("api-base");
const statusBanner = document.getElementById("status-banner");
const cardsGrid = document.getElementById("cards-grid");
const resultCount = document.getElementById("result-count");
const deckList = document.getElementById("deck-list");
const deckTotal = document.getElementById("deck-total");
const deckUnique = document.getElementById("deck-unique");
const exportBtn = document.getElementById("export-deck");
const importBtn = document.getElementById("import-deck");
const importFile = document.getElementById("import-file");
const exportImageBtn = document.getElementById("export-deck-image");
const envApiBase = (window.__API_URL__ || "").trim();

const filtersForm = document.getElementById("filters-form");
const searchText = document.getElementById("search-text");
const rarityFilter = document.getElementById("rarity-filter");
const featureFilter = document.getElementById("feature-filter");
const typeFilter = document.getElementById("type-filter");
const levelFilter = document.getElementById("level-filter");
const roundFilter = document.getElementById("round-filter");
const characterFilter = document.getElementById("character-filter");
const numberFilter = document.getElementById("number-filter");
const setFilter = document.getElementById("set-filter");
const yearFilter = document.getElementById("year-filter");
const errataFilter = document.getElementById("errata-filter");

// Override per-card copy limits here by card number/id (default is 4)
const cardCopyOverrides = {
  // "BP01-001": 8,
  // "SP99-777": 6,
  "PR-036": 50,
  "PR-107": 8
};

const state = {
  apiBase: envApiBase,
  deck: loadDeck(),
  cards: [],
  cardIndex: new Map(),
};

function cardKey(card) {
  return String(card.number || card.id);
}

function perCardLimit(card) {
  if (!card) return 4;
  return cardCopyOverrides[cardKey(card)] || 4;
}

function loadDeck() {
  try {
    const stored = localStorage.getItem("nebula_deck");
    return stored ? JSON.parse(stored) : {};
  } catch (err) {
    console.warn("Failed to read deck from storage", err);
    return {};
  }
}

function persistDeck() {
  localStorage.setItem("nebula_deck", JSON.stringify(state.deck));
}

function updateStatus(message, tone = "info") {
  statusBanner.textContent = message;
  statusBanner.classList.remove("warn", "error");
  if (tone === "warn") statusBanner.classList.add("warn");
  if (tone === "error") statusBanner.classList.add("error");
}

function getCardSet(card) {
  if (!card || !card.number) return null;
  const num = card.number;
  if (num.startsWith("PR")) return "PR";
  const match = num.match(/^([A-Z]+)(\d+)-/);
  if (!match) return null;
  return `${match[1]}${match[2].padStart(2, '0')}`;
}

function updateFilterOptionsFromCards(cards) {
  const raritySet = new Set();
  const featureSet = new Set();
  const typeSet = new Set();
  const yearSet = new Set();
  const setSet = new Set();

  cards.forEach((card) => {
    if (card.rarity) raritySet.add(card.rarity);
    if (card.feature) featureSet.add(card.feature);
    if (card.type) typeSet.add(card.type);
    if (card.publication_year) yearSet.add(card.publication_year);
    const cardSet = getCardSet(card);
    if (cardSet) setSet.add(cardSet);
  });

  applyOptions(rarityFilter, Array.from(raritySet).sort());
  applyOptions(featureFilter, Array.from(featureSet).sort());
  applyOptions(typeFilter, Array.from(typeSet).sort());
  applyOptions(yearFilter, Array.from(yearSet).sort((a, b) => a - b));
  applyOptions(setFilter, Array.from(setSet).sort());
}

function sanitizeBase(base) {
  return base.endsWith("/") ? base.slice(0, -1) : base;
}

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error (${res.status}): ${text}`);
  }
  return res.json();
}

function applyOptions(selectEl, options) {
  const current = selectEl.value;
  selectEl.innerHTML = '<option value="">Any</option>';
  options.forEach((option) => {
    const opt = document.createElement("option");
    opt.value = option;
    opt.textContent = option;
    selectEl.appendChild(opt);
  });
  selectEl.value = current;
}

async function fetchCards() {
  if (!state.apiBase) {
    updateStatus("Set the API base URL first.", "warn");
    return;
  }

  updateStatus("Fetching cards from the API...");
  cardsGrid.innerHTML = "";

  const params = new URLSearchParams();
  let endpoint = "cards";
  const text = searchText.value.trim();

  if (text) {
    endpoint = "search";
    params.set("q", text);
  } else {
    if (rarityFilter.value) params.set("rarity", rarityFilter.value);
    if (featureFilter.value) params.set("feature", featureFilter.value);
    if (typeFilter.value) params.set("type", typeFilter.value);
    if (levelFilter.value) params.set("level", levelFilter.value);
    if (roundFilter.value) params.set("round", roundFilter.value);
    if (characterFilter.value) params.set("character_name", characterFilter.value);
    if (numberFilter.value) params.set("number", numberFilter.value);
    if (yearFilter.value) params.set("publication_year", yearFilter.value);
    if (errataFilter.checked) params.set("errata_enable", "true");
  }

  try {
    const url = `${sanitizeBase(state.apiBase)}/${endpoint}?${params.toString()}`;
    let cards = await fetchJson(url);
    
    const selectedSet = setFilter.value;
    if (selectedSet) {
      cards = cards.filter(card => getCardSet(card) === selectedSet);
    }

    state.cards = cards;
    state.cardIndex = new Map(cards.map((card) => [cardKey(card), card]));
    updateFilterOptionsFromCards(cards);
    renderCards(cards);
    updateStatus(`Loaded ${cards.length} cards.`);
  } catch (err) {
    console.error(err);
    updateStatus(err.message, "error");
  }
}

function renderCards(cards) {
  const total = cards.length;
  const limitedCards = cards.slice(0, 20);
  resultCount.textContent =
    total > limitedCards.length
      ? `Showing ${limitedCards.length} of ${total} cards`
      : `${total} card${total === 1 ? "" : "s"}`;
  cardsGrid.innerHTML = "";

  if (!total) {
    const empty = document.createElement("div");
    empty.className = "status";
    empty.textContent = "No cards matched these filters. Try broadening your search.";
    cardsGrid.appendChild(empty);
    return;
  }

  limitedCards.forEach((card) => {
    const cardEl = document.createElement("div");
    cardEl.className = "card";

    const img = document.createElement("img");
    img.src = card.thumbnail_image_url || card.image_url || "";
    img.alt = card.name || "Card";
    img.onerror = () => {
      img.src = "https://via.placeholder.com/400x240/0f1629/ffffff?text=No+Image";
    };
    cardEl.appendChild(img);

    const content = document.createElement("div");
    content.className = "card-content";

    const title = document.createElement("h3");
    title.className = "card-title";
    title.textContent = card.name || "Unnamed Card";
    content.appendChild(title);

    const meta = document.createElement("div");
    meta.className = "card-meta";
    meta.appendChild(makeBadge(card.number || "N/A"));
    if (card.rarity) meta.appendChild(makeBadge(card.rarity));
    if (card.feature) meta.appendChild(makeBadge(card.feature));
    if (card.type) meta.appendChild(makeBadge(card.type));
    if (card.level) meta.appendChild(makeBadge(`Level ${card.level}`));
    if (card.round) meta.appendChild(makeBadge(`Round ${card.round}`));
    content.appendChild(meta);

    cardEl.dataset.effect = card.effect || "No effect text.";
    cardEl.dataset.key = cardKey(card);

    const actions = document.createElement("div");
    actions.className = "card-actions";
    const addBtn = document.createElement("button");
    addBtn.className = "add-btn";
    addBtn.textContent = "Add to deck";
    addBtn.addEventListener("click", () => addCardToDeck(cardKey(card)));
    actions.appendChild(addBtn);
    content.appendChild(actions);

    cardEl.appendChild(content);
    cardsGrid.appendChild(cardEl);
  });
}

function makeBadge(text) {
  const span = document.createElement("span");
  span.className = "badge";
  span.textContent = text;
  return span;
}

function truncate(str, max) {
  if (!str) return "";
  return str.length > max ? `${str.slice(0, max)}…` : str;
}

function clampCanvasText(ctx, text, maxWidth) {
  if (!text) return "";
  const ellipsis = "...";
  if (ctx.measureText(text).width <= maxWidth) return text;
  let left = 0;
  let right = text.length;
  let result = ellipsis;
  while (left < right) {
    const mid = Math.floor((left + right) / 2);
    const candidate = `${text.slice(0, mid)}${ellipsis}`;
    if (ctx.measureText(candidate).width <= maxWidth) {
      result = candidate;
      left = mid + 1;
    } else {
      right = mid;
    }
  }
  return result;
}

async function addCardToDeck(cardKeyValue) {
  const key = String(cardKeyValue);
  let card = state.cardIndex.get(key) || state.deck[key]?.card;
  if (!card && state.apiBase) {
    try {
      card = await fetchJson(`${sanitizeBase(state.apiBase)}/card/${encodeURIComponent(key)}`);
      if (card?.error) card = null;
      if (card) state.cardIndex.set(key, card);
    } catch (err) {
      console.warn("Card lookup failed for add", key, err);
    }
  }
  if (!card) return updateStatus("Card not found. Try refreshing results first.", "warn");

  const totalCount = deckCount();
  if (totalCount >= 50) {
    updateStatus("Deck is full (50 card limit). Remove a card first.", "warn");
    return;
  }

  const current = state.deck[key] || { card, count: 0 };
  const limit = perCardLimit(card);
  if (current.count >= limit) {
    updateStatus(`You can only run ${limit} copies of this card.`, "warn");
    return;
  }

  state.deck[key] = { card, count: current.count + 1 };
  persistDeck();
  renderDeck();
  updateStatus(`Added ${card.name} (${current.count + 1}/${limit}).`);
}

function changeDeckCount(cardKeyValue, delta) {
  const key = String(cardKeyValue);
  const entry = state.deck[key];
  if (!entry) return;
  entry.count += delta;

  if (entry.count <= 0) {
    delete state.deck[key];
  } else {
    state.deck[key] = entry;
  }

  persistDeck();
  renderDeck();
}

function clearDeck() {
  state.deck = {};
  persistDeck();
  renderDeck();
  updateStatus("Deck cleared.");
}

function deckCount() {
  return Object.values(state.deck).reduce((sum, entry) => sum + entry.count, 0);
}

function renderDeck() {
  const entries = Object.values(state.deck);
  if (!entries.length) {
    deckList.className = "deck-list empty";
    deckList.textContent = "No cards yet. Add from the results to start building.";
  } else {
    deckList.className = "deck-list";
    deckList.innerHTML = "";
    entries.forEach(({ card, count }) => {
      if (!card) return;
      const row = document.createElement("div");
      row.className = "deck-row";

      const title = document.createElement("div");
      title.className = "deck-title";
      const name = document.createElement("div");
      name.textContent = card.name || "Card";
      const meta = document.createElement("div");
      meta.className = "card-meta";
      meta.textContent = `${card.number || "N/A"} • ${card.rarity || "?"} • ${card.feature || "?"}`;
      title.appendChild(name);
      title.appendChild(meta);

      const controls = document.createElement("div");
      controls.className = "deck-controls";

      const minus = document.createElement("button");
      minus.className = "ghost small";
      minus.textContent = "−";
      minus.addEventListener("click", () => changeDeckCount(cardKey(card), -1));

      const counter = document.createElement("div");
      counter.className = "counter";
      counter.textContent = `${count}/${perCardLimit(card)}`;

      const plus = document.createElement("button");
      plus.className = "ghost small";
      plus.textContent = "+";
      plus.addEventListener("click", () => addCardToDeck(cardKey(card)));

      controls.appendChild(minus);
      controls.appendChild(counter);
      controls.appendChild(plus);

      const remove = document.createElement("button");
      remove.className = "ghost small";
      remove.textContent = "Remove";
      remove.addEventListener("click", () => changeDeckCount(cardKey(card), -count));

      row.appendChild(title);
      row.appendChild(controls);
      row.appendChild(remove);
      deckList.appendChild(row);
    });
  }

  deckTotal.textContent = `${deckCount()} / 50`;
  deckUnique.textContent = `${Object.keys(state.deck).length} unique`;
}

function resetFilters() {
  filtersForm.reset();
  rarityFilter.value = "";
  featureFilter.value = "";
  typeFilter.value = "";
  setFilter.value = "";
  yearFilter.value = "";
}

function restoreApiBase() {
  const envValue = envApiBase;
  const stored = localStorage.getItem("nebula_api_base");
  const value = (stored && stored.trim()) || envValue || "";
  state.apiBase = value;
  apiBaseInput.value = value;
}

function saveApiBase(value) {
  state.apiBase = value;
  localStorage.setItem("nebula_api_base", value);
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

function snapshotCard(card) {
  if (!card) return null;
  const fields = [
    "name",
    "type_name",
    "character_name",
    "number",
    "rarity",
    "feature",
    "type",
    "level",
    "round",
    "effect",
    "battle_power_1",
    "battle_power_2",
    "battle_power_3",
    "battle_power_4",
    "battle_power_ex",
    "image_url",
  ];
  const copy = {};
  fields.forEach((f) => {
    if (card[f] !== undefined) copy[f] = card[f];
  });
  return copy;
}

function exportDeck() {
  const entries = Object.entries(state.deck).map(([key, { card, count }]) => ({
    key,
    count,
    card: snapshotCard(card),
  }));
  const payload = {
    version: 1,
    generatedAt: new Date().toISOString(),
    cards: entries,
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `nebula-deck-${Date.now()}.json`;
  link.click();
  URL.revokeObjectURL(url);
  updateStatus("Deck exported as JSON.");
}

async function handleImportData(data) {
  if (!data || !Array.isArray(data.cards)) {
    updateStatus("Invalid deck file format.", "error");
    return;
  }

  const imported = {};
  let remaining = 50;
  let truncated = false;
  for (const entry of data.cards) {
    const key = entry?.key ? String(entry.key) : null;
    const desiredCount = Number(entry?.count) || 0;
    if (!key || desiredCount <= 0) continue;
    if (remaining <= 0) {
      truncated = true;
      break;
    }

    let card = entry.card;
    if (!card && state.apiBase) {
      try {
        card = await fetchJson(`${sanitizeBase(state.apiBase)}/card/${encodeURIComponent(key)}`);
        if (card?.error) card = null;
      } catch (err) {
        console.warn("Card fetch failed for import", key, err);
      }
    }
    if (!card) continue;

    const limit = perCardLimit(card);
    const allowedForCard = Math.min(limit, desiredCount);
    const allowed = Math.min(allowedForCard, remaining);
    remaining -= allowed;
    imported[key] = { card, count: allowed };
    state.cardIndex.set(key, card);
    if (allowed < desiredCount) truncated = true;
  }

  state.deck = imported;
  persistDeck();
  renderDeck();
  updateStatus(truncated ? "Deck imported with truncation to fit limits." : "Deck imported from JSON.");
}

function handleImportFile(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const parsed = JSON.parse(e.target.result);
      await handleImportData(parsed);
    } catch (err) {
      console.error(err);
      updateStatus("Failed to import deck. Ensure it's valid JSON.", "error");
    } finally {
      importFile.value = "";
    }
  };
  reader.readAsText(file);
}

async function exportDeckImage() {
  const entries = Object.values(state.deck);
  if (!entries.length) {
    updateStatus("No cards to export. Add cards to the deck first.", "warn");
    return;
  }

  const perRow = 4;
  const cardW = 220;
  const cardH = 320;
  const gap = 16;
  const rows = Math.ceil(entries.length / perRow);

  const baseWidth = gap + perRow * (cardW + gap);
  const baseHeight = gap + rows * (cardH + gap);
  const scale = window.devicePixelRatio > 1 ? 2 : 1;

  const canvas = document.createElement("canvas");
  canvas.width = baseWidth * scale;
  canvas.height = baseHeight * scale;
  const ctx = canvas.getContext("2d");
  ctx.scale(scale, scale);

  // Background
  ctx.fillStyle = "#0b1020";
  ctx.fillRect(0, 0, baseWidth, baseHeight);

  for (let i = 0; i < entries.length; i += 1) {
    const { card, count } = entries[i];
    const col = i % perRow;
    const row = Math.floor(i / perRow);
    const x = gap + col * (cardW + gap);
    const y = gap + row * (cardH + gap);
    // eslint-disable-next-line no-await-in-loop
    await drawCardTile(ctx, card, count, x, y, cardW, cardH);
  }

  const dataUrl = canvas.toDataURL("image/png");
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = `nebula-deck-${Date.now()}.png`;
  link.click();
  updateStatus("Deck exported as an image.");
}

async function drawCardTile(ctx, card, count, x, y, w, h) {
  ctx.save();
  ctx.fillStyle = "#11182d";
  ctx.strokeStyle = "rgba(255,255,255,0.1)";
  roundRect(ctx, x, y, w, h, 12);
  ctx.fill();
  ctx.stroke();

  const imgUrl = card?.thumbnail_image_url || card?.image_url;
  const padding = 10;
  const imgAreaW = w - padding * 2;
  const imgAreaH = h - 90;

  if (imgUrl) {
    try {
      const img = await loadImage(imgUrl);
      const ratio = Math.min(imgAreaW / img.width, imgAreaH / img.height);
      const drawW = img.width * ratio;
      const drawH = img.height * ratio;
      const dx = x + (w - drawW) / 2;
      const dy = y + padding;
      ctx.drawImage(img, dx, dy, drawW, drawH);
    } catch (err) {
      console.warn("Image load failed", imgUrl, err);
      drawPlaceholder(ctx, x + padding, y + padding, imgAreaW, imgAreaH);
    }
  } else {
    drawPlaceholder(ctx, x + padding, y + padding, imgAreaW, imgAreaH);
  }

  const textMaxWidth = w - 24;
  const detailMaxWidth = w - 72;

  // Gradient overlay
  const grad = ctx.createLinearGradient(x, y + h - 110, x, y + h);
  grad.addColorStop(0, "rgba(12,18,36,0.8)");
  grad.addColorStop(1, "rgba(12,18,36,0.95)");
  ctx.fillStyle = grad;
  ctx.fillRect(x, y + h - 110, w, 110);

  // Text
  ctx.fillStyle = "#e8f0ff";
  ctx.font = "700 18px 'Archivo', 'Space Grotesk', sans-serif";
  ctx.textBaseline = "top";
  ctx.textAlign = "left";
  ctx.fillText(clampCanvasText(ctx, card?.name || "Card", textMaxWidth), x + 12, y + h - 102);

  ctx.fillStyle = "#9fb3d9";
  ctx.font = "13px 'Archivo', 'Space Grotesk', sans-serif";
  const metaLine = [card?.number || "N/A", card?.rarity || "?", card?.feature || "?"].join(" | ");
  ctx.fillText(clampCanvasText(ctx, metaLine, textMaxWidth), x + 12, y + h - 76);
  if (card?.type) {
    ctx.fillText(clampCanvasText(ctx, `Type: ${card.type}`, detailMaxWidth), x + 60, y + h - 58);
  }
  if (card?.level) {
    ctx.fillText(clampCanvasText(ctx, `Level: ${card.level}`, textMaxWidth), x + 12, y + h - 58);
  }
  if (card?.round) {
    ctx.fillText(clampCanvasText(ctx, `Round: ${card.round}`, textMaxWidth), x + 12, y + h - 58);
  }
  // if (card?.effect) {
  //   ctx.fillText(truncate(card.effect, 60), x + 12, y + h - 56);
  // }

  // Quantity badge
  const badgeW = 46;
  const badgeH = 26;
  ctx.fillStyle = "rgba(99,255,214,0.18)";
  ctx.strokeStyle = "rgba(99,255,214,0.5)";
  roundRect(ctx, x + w - badgeW - 10, y + 10, badgeW, badgeH, 8);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#63ffd6";
  ctx.font = "700 14px 'Archivo', 'Space Grotesk', sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(`x${count}`, x + w - badgeW / 2 - 10, y + 10 + badgeH / 2);

  ctx.restore();
}

function drawPlaceholder(ctx, x, y, w, h) {
  ctx.save();
  ctx.fillStyle = "rgba(255,255,255,0.04)";
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  roundRect(ctx, x, y, w, h, 10);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "rgba(200,220,255,0.5)";
  ctx.font = "12px 'Archivo', 'Space Grotesk', sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("No image", x + w / 2, y + h / 2);
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function createTooltip() {
  const tooltip = document.createElement("div");
  tooltip.id = "tooltip";
  tooltip.className = "tooltip";
  document.body.appendChild(tooltip);

  let currentCard = null;

  cardsGrid.addEventListener("mouseover", (e) => {
    const cardEl = e.target.closest(".card");
    if (!cardEl) return;

    const card = state.cardIndex.get(cardEl.dataset.key);
    if (!card) return;

    const effect = card.effect || "No effect text.";
    
    let bpTable = '';
    const bpStats = {
      "BP1": card.battle_power_1,
      "BP2": card.battle_power_2,
      "BP3": card.battle_power_3,
      "BP4": card.battle_power_4,
      "BPEX": card.battle_power_ex,
    };

    const validBpStats = Object.entries(bpStats).some(([, value]) => value !== undefined && value !== null);

    if (validBpStats) {
      bpTable = '<table class="bp-table">';
      for (const [key, value] of Object.entries(bpStats)) {
        if (value !== undefined && value !== null) {
          bpTable += `<tr><td>${key}</td><td>${value}</td></tr>`;
        }
      }
      bpTable += '</table>';
    }

    tooltip.innerHTML = `${bpTable}<p>${effect}</p>`;
    tooltip.style.display = "block";
    currentCard = cardEl;
    
    // Initial position
    tooltip.style.left = `${e.pageX + 10}px`;
    tooltip.style.top = `${e.pageY + 10}px`;
  });

  cardsGrid.addEventListener("mousemove", (e) => {
    if (currentCard && tooltip.style.display === "block") {
      tooltip.style.left = `${e.pageX + 10}px`;
      tooltip.style.top = `${e.pageY + 10}px`;
    }
  });

  cardsGrid.addEventListener("mouseout", (e) => {
    // Check if the mouse is still within a card or entering a child element of the current card
    // Use `relatedTarget` to determine where the mouse moved to
    if (currentCard && e.relatedTarget && currentCard.contains(e.relatedTarget)) {
      return;
    }
    tooltip.style.display = "none";
    currentCard = null;
  });
}

function init() {
  restoreApiBase();
  renderDeck();
  createTooltip();
  fetchCards();
}

filtersForm.addEventListener("submit", (e) => {
  e.preventDefault();
  fetchCards();
});

document.getElementById("reset-filters").addEventListener("click", () => {
  resetFilters();
  fetchCards();
});

document.getElementById("refresh-btn").addEventListener("click", () => {
  fetchCards();
});

document.getElementById("clear-deck").addEventListener("click", clearDeck);

apiBaseInput.addEventListener("change", (e) => {
  const value = e.target.value.trim();
  saveApiBase(value);
  fetchCards();
});

exportBtn.addEventListener("click", exportDeck);
importBtn.addEventListener("click", () => importFile.click());
importFile.addEventListener("change", handleImportFile);
exportImageBtn.addEventListener("click", exportDeckImage);

init();

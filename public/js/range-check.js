// Range page: one daily_stats row per calendar day.

const RANGE_PAGE_SIZE = 25;

let rangePage = 1;
let rangeTotal = 0;
let rangeLoading = false;
let rangeDays = [];
let rangeOpenDate = '';
/** Sorted games for the open day modal: { name, spins }[] */
let rangeModalGamesList = [];
let rangeDayGamesRequestId = 0;

function rangeDates() {
  return {
    from: $('rangeFrom')?.value || '',
    to: $('rangeTo')?.value || '',
  };
}

function rangeDayGames(item) {
  return apiField(item, 'spinsByGame', []) || [];
}

function rangeCountCell(value) {
  return '<td class="num">' + fmtInt(value) + '</td>';
}

function rangeMoneyCell(value) {
  return '<td class="num">' + escHtml('$' + fmtMoney(value)) + '</td>';
}

function rangeDayField(item, camelKey, pascalKey, fallback) {
  return apiField(item, camelKey, apiField(item, pascalKey, fallback));
}

function rangeDaysTable(items) {
  const rows = items.map((item) => {
    const date = apiField(item, 'date', '');
    const open = date && date === rangeOpenDate;
    return '<tr class="is-clickable' + (open ? ' is-open' : '') + '" data-range-date="' + escAttr(date) + '"><td>' +
      escHtml(formatDayLabel(date)) + '</td>' +
      rangeCountCell(rangeDaySpinCount(item)) +
      rangeMoneyCell(rangeDayField(item, 'totalBetAmount', 'TotalBetAmount', 0)) +
      rangeMoneyCell(rangeDayField(item, 'totalWinAmount', 'TotalWinAmount', 0)) +
      rangeCountCell(rangeDayField(item, 'totalWinCount', 'TotalWinCount', 0)) +
      rangeCountCell(rangeDayField(item, 'totalLossCount', 'TotalLossCount', 0)) +
      rangeCountCell(rangeDayField(item, 'logins', 'totalDailyLoginCount', 0)) +
      rangeCountCell(rangeDayField(item, 'newAccounts', 'dailyNewAccountLoginCount', 0)) +
      rangeCountCell(rangeDayField(item, 'deleted', 'dailyPlayerDeleteCount', 0)) +
      rangeCountCell(rangeDayField(item, 'recharge', 'totalRechargeCount', 0)) +
      rangeCountCell(rangeDayField(item, 'redeem', 'totalRedeemCount', 0)) +
      '</tr>';
  }).join('');
  return '<div class="range-table-wrap"><table class="range-table"><thead><tr>' +
    '<th>Date</th><th>Spins</th><th>Total bet</th><th>Total win</th><th>Win spins</th><th>Loss spins</th>' +
    '<th>Logins</th><th>New accounts</th><th>Deleted</th><th>Recharge</th><th>Redeem</th>' +
    '</tr></thead><tbody>' + rows + '</tbody></table></div>';
}

function syncRangeDayRowHighlight() {
  $('rangeDays')?.querySelectorAll('[data-range-date]').forEach((row) => {
    row.classList.toggle('is-open', row.getAttribute('data-range-date') === rangeOpenDate);
  });
}

/** Fixed list area height for this open day — search filters rows only, card size stays put. */
function lockRangeDayGamesScrollHeight() {
  const modal = $('rangeDayGamesModal');
  const scroll = $('rangeDayGamesScroll');
  const card = modal?.querySelector('.modal-card');
  if (!modal || !scroll || !card || modal.classList.contains('hidden')) return;

  const head = card.querySelector('.modal-head');
  const toolbar = card.querySelector('.range-day-modal-toolbar');
  const chrome = (head?.offsetHeight || 0) + (toolbar?.offsetHeight || 0) + 36;
  const listHeight = Math.max(220, window.innerHeight * 0.88 - chrome);

  scroll.style.height = listHeight + 'px';
  scroll.style.maxHeight = listHeight + 'px';
  scroll.style.minHeight = listHeight + 'px';
  scroll.style.overflowY = 'auto';
  scroll.classList.add('is-height-locked');
}

function resetRangeDayGamesModalSize() {
  const scroll = $('rangeDayGamesScroll');
  if (scroll) {
    scroll.style.height = '';
    scroll.style.maxHeight = '';
    scroll.style.minHeight = '';
    scroll.style.overflowY = '';
    scroll.classList.remove('is-height-locked');
  }
}

function closeRangeDayModal() {
  rangeOpenDate = '';
  rangeModalGamesList = [];
  syncRangeDayRowHighlight();
  resetRangeDayGamesModalSize();
  show($('rangeDayGamesModal'), false);
  setHtml('rangeDayGamesTable', '');
  if ($('rangeDayGamesMeta')) setText('rangeDayGamesMeta', '');
  if ($('rangeDayGamesDate')) setText('rangeDayGamesDate', '');
  const search = $('rangeDayGamesSearch');
  if (search) search.value = '';
}

function filteredRangeModalGames() {
  const q = ($('rangeDayGamesSearch')?.value || '').trim().toLowerCase();
  if (!q) return rangeModalGamesList;
  return rangeModalGamesList.filter((g) => g.name.toLowerCase().includes(q));
}

function rangeDayGamesRowKind(spins, min, max, nextLow, uniqueLen) {
  if (uniqueLen < 2) return '';
  if (spins === max) return ' is-max';
  if (spins === min) return ' is-min';
  if (spins === nextLow) return ' is-next';
  return '';
}

function rangeDayGamesTableHtml(games) {
  if (!games.length) {
    return '<p class="card-sub">' +
      (rangeModalGamesList.length ? 'No games match your search.' : 'No spins recorded for this day.') +
      '</p>';
  }
  const counts = games.map((g) => g.spins);
  const unique = [...new Set(counts)].sort((a, b) => a - b);
  const min = unique[0];
  const max = unique[unique.length - 1];
  const nextLow = unique.length > 2 ? unique[1] : null;
  const rows = games.map((g, index) => {
    const kind = rangeDayGamesRowKind(g.spins, min, max, nextLow, unique.length);
    return '<tr class="range-day-game-row' + kind + '">' +
      '<td class="range-day-game-num">' + fmtInt(index + 1) + '</td>' +
      '<td class="range-day-game-name" title="' + escAttr(g.name) + '">' + escHtml(g.name) + '</td>' +
      '<td class="num range-day-game-metric range-day-game-spins">' + fmtInt(g.spins) + '</td>' +
      '<td class="num range-day-game-metric range-day-game-win">' + fmtInt(g.winSpins) + '</td>' +
      '<td class="num range-day-game-metric range-day-game-loss">' + fmtInt(g.lossSpins) + '</td>' +
      '</tr>';
  }).join('');
  return '<table class="range-table range-day-games-table"><thead><tr>' +
    '<th>#</th><th>Game</th><th class="num">Spins</th><th class="num">Win spins</th><th class="num">Loss spins</th>' +
    '</tr></thead><tbody>' + rows + '</tbody></table>';
}

function updateRangeDayGamesMeta() {
  const all = rangeModalGamesList;
  const visible = filteredRangeModalGames();
  const totalSpinsAll = all.reduce((sum, g) => sum + g.spins, 0);
  const totalSpinsVisible = visible.reduce((sum, g) => sum + g.spins, 0);
  if (!$('rangeDayGamesMeta')) return;
  if (!all.length) {
    setText('rangeDayGamesMeta', 'No spin data for this day.');
    return;
  }
  if (visible.length === all.length) {
    setText(
      'rangeDayGamesMeta',
      fmtInt(all.length) + ' game' + (all.length === 1 ? '' : 's') + ' · ' + fmtInt(totalSpinsAll) + ' spins total',
    );
    return;
  }
  setText(
    'rangeDayGamesMeta',
    'Showing ' + fmtInt(visible.length) + ' of ' + fmtInt(all.length) + ' games · ' +
    fmtInt(totalSpinsVisible) + ' spins in results',
  );
}

function renderRangeDayGamesTable() {
  setHtml('rangeDayGamesTable', rangeDayGamesTableHtml(filteredRangeModalGames()));
  updateRangeDayGamesMeta();
}

function rangeDayGamesHasWinLoss(games) {
  if (!games.length) return false;
  const sample = games[0];
  return sample && ('winSpins' in sample || 'WinSpins' in sample);
}

function patchRangeDaySpinsByGame(date, games) {
  const item = rangeDays.find((day) => apiField(day, 'date', '') === date);
  if (!item) return;
  item.spinsByGame = games;
  if (item.SpinsByGame !== undefined) item.SpinsByGame = games;
}

function renderRangeDayGames(date) {
  const item = rangeDays.find((day) => apiField(day, 'date', '') === date);
  const games = rangeDayGames(item || {}).slice().sort((a, b) => {
    const diff = Number(apiField(b, 'spins', 0)) - Number(apiField(a, 'spins', 0));
    if (diff) return diff;
    return String(apiField(a, 'gameName', '')).localeCompare(String(apiField(b, 'gameName', '')));
  });
  rangeModalGamesList = games.map((game) => ({
    name: apiField(game, 'gameName', '') || 'Unknown',
    spins: Number(apiField(game, 'spins', 0)),
    winSpins: Number(apiField(game, 'winSpins', apiField(game, 'WinSpins', 0))),
    lossSpins: Number(apiField(game, 'lossSpins', apiField(game, 'LossSpins', 0))),
  }));
  const dayLabel = date ? formatDayLabel(date) : '';
  if ($('rangeDayGamesDate')) setText('rangeDayGamesDate', dayLabel || '—');
  const search = $('rangeDayGamesSearch');
  if (search) search.value = '';
  renderRangeDayGamesTable();
  requestAnimationFrame(() => lockRangeDayGamesScrollHeight());
}

async function loadRangeDayGames(date) {
  if (!date) return;
  const item = rangeDays.find((day) => apiField(day, 'date', '') === date);
  const cached = rangeDayGames(item || []);
  if (cached.length && rangeDayGamesHasWinLoss(cached)) {
    renderRangeDayGames(date);
    return;
  }

  const requestId = ++rangeDayGamesRequestId;
  setHtml('rangeDayGamesTable', '<p class="card-sub">Loading spins by game…</p>');
  if ($('rangeDayGamesMeta')) setText('rangeDayGamesMeta', 'Loading…');
  try {
    const payload = (await fetchApiJson(
      '/daily-stats/spins-by-game?date=' + encodeURIComponent(date)
    )).data || {};
    if (requestId !== rangeDayGamesRequestId || rangeOpenDate !== date) return;
    const raw = apiField(payload, 'games', apiField(payload, 'spinsByGame', [])) || [];
    patchRangeDaySpinsByGame(date, raw);
    renderRangeDayGames(date);
  } catch (err) {
    if (requestId !== rangeDayGamesRequestId || rangeOpenDate !== date) return;
    setHtml('rangeDayGamesTable', '<p class="card-sub">' + escHtml(err?.message || 'Could not load games for this day.') + '</p>');
    if ($('rangeDayGamesMeta')) setText('rangeDayGamesMeta', 'Load failed');
  }
}

function openRangeDay(date) {
  if (!date) return;
  if (rangeOpenDate === date && !$('rangeDayGamesModal')?.classList.contains('hidden')) {
    closeRangeDayModal();
    return;
  }
  rangeOpenDate = date;
  syncRangeDayRowHighlight();
  show($('rangeDayGamesModal'), true);
  if ($('rangeDayGamesDate')) setText('rangeDayGamesDate', formatDayLabel(date));
  loadRangeDayGames(date);
}

function rangeDaySpinCount(item) {
  const games = rangeDayGames(item);
  if (games.length) return games.reduce((sum, game) => sum + Number(apiField(game, 'spins', 0)), 0);
  return Number(apiField(item, 'spins', apiField(item, 'totalDailySpinCount', 0)));
}

function setRangeWarning(message) {
  const el = $('rangeWarning');
  if (!el) return;
  const text = (message || '').trim();
  if (!text) {
    el.textContent = '';
    show(el, false);
    return;
  }
  el.textContent = text;
  show(el, true);
}

function renderRangeCheck(data) {
  const items = apiField(data, 'days', apiField(data, 'items', [])) || [];
  setRangeWarning(apiField(data, 'warning', ''));
  const from = apiField(data, 'from', '') || '';
  const to = apiField(data, 'to', '') || '';
  const page = Number(apiField(data, 'page', 1)) || 1;
  const pageSize = Number(apiField(data, 'pageSize', RANGE_PAGE_SIZE)) || RANGE_PAGE_SIZE;
  const total = Number(apiField(data, 'totalCount', items.length)) || 0;
  rangePage = page;
  rangeTotal = total;
  rangeDays = items;
  if (rangeOpenDate && !items.some((item) => apiField(item, 'date', '') === rangeOpenDate)) rangeOpenDate = '';

  setText('rangeHint', (from && to ? from + ' – ' + to + ' · ' : '') +
    fmtInt(items.length) + ' day' + (items.length === 1 ? '' : 's') + ' on this page');
  show($('rangeDaysLabel'), items.length > 0);
  setHtml('rangeDays', items.length ? rangeDaysTable(items) : '<p class="card-sub">No daily stats in this range.</p>');
  if (rangeOpenDate && items.some((item) => apiField(item, 'date', '') === rangeOpenDate)) {
    show($('rangeDayGamesModal'), true);
    syncRangeDayRowHighlight();
    loadRangeDayGames(rangeOpenDate);
  } else if (rangeOpenDate) {
    closeRangeDayModal();
  }

  const pages = pageCount(total, pageSize);
  setHtml('rangePager', total
    ? renderPagerHtml({
      dataAttr: 'data-range-page',
      page,
      pageSize,
      total,
      totalPages: pages,
      jumpInputId: 'rangePageJump',
    })
    : '');
}

async function loadRangeCheck(page) {
  const { from, to } = rangeDates();
  if (!from || !to) {
    setText('rangeHint', 'Pick a from and to date, then load.');
    return;
  }
  if (to < from) {
    setText('rangeHint', 'To must be on or after from.');
    return;
  }
  if (rangeLoading) return;
  rangeLoading = true;
  setText('rangeHint', 'Loading…');
  try {
    const envelope = await fetchApiJson(
      '/daily-stats?from=' + encodeURIComponent(from) +
      '&to=' + encodeURIComponent(to) +
      '&page=' + page +
      '&pageSize=' + RANGE_PAGE_SIZE
    );
    const data = envelope.data || {};
    renderRangeCheck(data);
    const warn = apiField(data, 'warning', '') || (envelope.message && envelope.message !== 'Daily stats loaded successfully.' ? envelope.message : '');
    if (warn) showToast(warn, 'warn');
  } catch (err) {
    const msg = err?.message || 'Could not load this range.';
    if (/daily_stats|Invalid column|migration|AddDailyStatsBetWin/i.test(msg)) {
      setRangeWarning(msg);
      setText('rangeHint', 'Range loaded with warnings — see message above the table.');
      show($('rangeDaysLabel'), false);
      setHtml('rangeDays', '<p class="card-sub">No daily stats rows could be loaded.</p>');
      showToast(msg, 'warn');
    } else {
      setRangeWarning('');
      setText('rangeHint', msg);
      show($('rangeDaysLabel'), false);
      setHtml('rangeDays', '');
    }
    setHtml('rangePager', '');
    rangeDays = [];
    closeRangeDayModal();
  } finally {
    rangeLoading = false;
  }
}

function bindRangeCheckEvents() {
  $('rangeDays')?.addEventListener('click', (e) => {
    const row = e.target.closest('[data-range-date]');
    if (!row) return;
    openRangeDay(row.getAttribute('data-range-date') || '');
  });
  $('rangeLoadBtn')?.addEventListener('click', () => loadRangeCheck(1));
  $('rangeDayGamesClose')?.addEventListener('click', () => closeRangeDayModal());
  $('rangeDayGamesModal')?.addEventListener('click', (e) => {
    if (e.target === $('rangeDayGamesModal')) closeRangeDayModal();
  });
  $('rangeDayGamesSearch')?.addEventListener('input', () => renderRangeDayGamesTable());
  let rangeModalResizeTimer = 0;
  window.addEventListener('resize', () => {
    if ($('rangeDayGamesModal')?.classList.contains('hidden')) return;
    clearTimeout(rangeModalResizeTimer);
    rangeModalResizeTimer = setTimeout(() => lockRangeDayGamesScrollHeight(), 80);
  });
  for (const id of ['rangeFrom', 'rangeTo']) {
    $(id)?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') loadRangeCheck(1);
    });
  }
  $('rangePager')?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-range-page]');
    if (!btn || btn.disabled) return;
    const pages = pageCount(rangeTotal, RANGE_PAGE_SIZE);
    const action = btn.getAttribute('data-range-page');
    let next = rangePage;
    if (action === 'first') next = 1;
    else if (action === 'prev') next = rangePage - 1;
    else if (action === 'next') next = rangePage + 1;
    else if (action === 'last') next = pages;
    else if (action === 'goto') next = Number($('rangePageJump')?.value);
    if (!Number.isFinite(next) || next < 1 || next > pages || next === rangePage) return;
    loadRangeCheck(next);
  });
  $('rangePager')?.addEventListener('keydown', (e) => {
    if (e.target?.id === 'rangePageJump' && e.key === 'Enter') {
      e.preventDefault();
      const pages = pageCount(rangeTotal, RANGE_PAGE_SIZE);
      const next = Number(e.target.value);
      if (next >= 1 && next <= pages && next !== rangePage) loadRangeCheck(next);
    }
  });
}

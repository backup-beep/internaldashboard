// Range page: one daily_stats row per calendar day.

const RANGE_PAGE_SIZE = 25;

let rangePage = 1;
let rangeTotal = 0;
let rangeLoading = false;
let rangeJobRunning = false;
let rangeDays = [];
let rangeOpenDate = '';

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

function rangeDaysTable(items) {
  const rows = items.map((item) => {
    const date = apiField(item, 'date', '');
    const open = date && date === rangeOpenDate;
    return '<tr class="is-clickable' + (open ? ' is-open' : '') + '" data-range-date="' + escAttr(date) + '"><td>' +
      escHtml(formatDayLabel(date)) + '</td>' +
      rangeCountCell(rangeDaySpinCount(item)) +
      rangeCountCell(apiField(item, 'logins', apiField(item, 'totalDailyLoginCount', 0))) +
      rangeCountCell(apiField(item, 'newAccounts', apiField(item, 'dailyNewAccountLoginCount', 0))) +
      rangeCountCell(apiField(item, 'deleted', apiField(item, 'dailyPlayerDeleteCount', 0))) +
      rangeCountCell(apiField(item, 'recharge', apiField(item, 'totalRechargeCount', 0))) +
      rangeCountCell(apiField(item, 'redeem', apiField(item, 'totalRedeemCount', 0))) +
      '</tr>';
  }).join('');
  return '<table class="range-table"><thead><tr>' +
    '<th>Date</th><th>Spins</th><th>Logins</th><th>New accounts</th><th>Deleted</th><th>Recharge</th><th>Redeem</th>' +
    '</tr></thead><tbody>' + rows + '</tbody></table>';
}

function rangeGameCard(name, count, kind) {
  const mark = kind === 'max' ? 'Highest' : kind === 'min' ? 'Lowest' : kind === 'next' ? 'Low' : '';
  return '<article class="range-game' + (kind ? ' is-' + kind : '') + '">' +
    '<span class="range-game-name">' + escHtml(name) + '</span>' +
    '<strong>' + fmtInt(count) + '</strong>' +
    '<span class="range-game-unit">spins</span>' +
    (mark ? '<span class="range-badge">' + mark + '</span>' : '') +
    '</article>';
}

function renderRangeDayGames(date) {
  const item = rangeDays.find((day) => apiField(day, 'date', '') === date);
  const games = rangeDayGames(item || {}).slice().sort((a, b) => {
    const diff = Number(apiField(b, 'spins', 0)) - Number(apiField(a, 'spins', 0));
    if (diff) return diff;
    return String(apiField(a, 'gameName', '')).localeCompare(String(apiField(b, 'gameName', '')));
  });
  const counts = games.map((game) => Number(apiField(game, 'spins', 0)));
  const unique = [...new Set(counts)].sort((a, b) => a - b);
  const min = unique[0];
  const max = unique[unique.length - 1];
  const nextLow = unique.length > 2 ? unique[1] : null;
  const label = date ? 'Spins by game · ' + formatDayLabel(date) : 'Spins by game';
  show($('rangeGamesLabel'), games.length > 0);
  if ($('rangeGamesLabel')) setText('rangeGamesLabel', label);
  setHtml('rangeGames', games.length
    ? games.map((game) => {
      const count = Number(apiField(game, 'spins', 0));
      const kind = unique.length < 2 ? '' : count === max ? 'max' : count === min ? 'min' : count === nextLow ? 'next' : '';
      return rangeGameCard(apiField(game, 'gameName', '') || 'Unknown', count, kind);
    }).join('')
    : '');
}

function openRangeDay(date) {
  rangeOpenDate = rangeOpenDate === date ? '' : date;
  $('rangeDays')?.querySelectorAll('[data-range-date]').forEach((row) => {
    row.classList.toggle('is-open', row.getAttribute('data-range-date') === rangeOpenDate);
  });
  if (!rangeOpenDate) {
    show($('rangeGamesLabel'), false);
    setHtml('rangeGames', '');
    return;
  }
  renderRangeDayGames(rangeOpenDate);
}

function rangeDaySpinCount(item) {
  const games = rangeDayGames(item);
  if (games.length) return games.reduce((sum, game) => sum + Number(apiField(game, 'spins', 0)), 0);
  return Number(apiField(item, 'spins', apiField(item, 'totalDailySpinCount', 0)));
}

function renderRangeCheck(data) {
  const items = apiField(data, 'days', apiField(data, 'items', [])) || [];
  const overview = apiField(data, 'overview', null);
  const spins = items.map((item) => rangeDaySpinCount(item));
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
  const overviewLogins = overview ? Number(apiField(overview, 'loggedInUsers', 0)) : null;
  const overviewSpins = overview ? Number(apiField(overview, 'totalSpins', 0)) : null;
  setHtml('rangeStats',
    statHtml('Logged-in users', fmtInt(overviewLogins == null ? 0 : overviewLogins), 'info') +
    statHtml('Total spins', fmtInt(overviewSpins == null ? spins.reduce((sum, n) => sum + n, 0) : overviewSpins), 'bet'));
  show($('rangeDaysLabel'), items.length > 0);
  setHtml('rangeDays', items.length ? rangeDaysTable(items) : '<p class="card-sub">No daily stats in this range.</p>');
  if (rangeOpenDate) renderRangeDayGames(rangeOpenDate);
  else {
    show($('rangeGamesLabel'), false);
    setHtml('rangeGames', '');
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

function demoRangeCheck(from, to, page) {
  const days = page === 1 ? [
    {
      date: to || '2026-10-04',
      spins: 80,
      logins: 150,
      newAccounts: 8,
      deleted: 1,
      recharge: 10,
      redeem: 3,
      spinsByGame: [
        { gameName: 'Ocean King', spins: 50 },
        { gameName: 'Cash Vault', spins: 30 },
      ],
    },
    {
      date: from || '2026-10-03',
      spins: 40,
      logins: 132,
      newAccounts: 5,
      deleted: 0,
      recharge: 7,
      redeem: 2,
      spinsByGame: [
        { gameName: 'Ocean King', spins: 40 },
      ],
    },
  ] : [];
  return {
    page,
    pageSize: RANGE_PAGE_SIZE,
    totalCount: days.length,
    totalPages: 1,
    from,
    to,
    overview: { loggedInUsers: 12, totalSpins: days.reduce((sum, day) => sum + day.spins, 0) },
    days,
  };
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
  if (rangeLoading || rangeJobRunning) return;
  rangeLoading = true;
  setText('rangeHint', 'Loading…');
  try {
    const data = isDemoMode()
      ? demoRangeCheck(from, to, page)
      : (await fetchApiJson(
        '/daily-stats?from=' + encodeURIComponent(from) +
        '&to=' + encodeURIComponent(to) +
        '&page=' + page +
        '&pageSize=' + RANGE_PAGE_SIZE
      )).data;
    renderRangeCheck(data || {});
  } catch (err) {
    setText('rangeHint', err?.message || 'Could not load this range.');
    setHtml('rangeStats', '');
    show($('rangeDaysLabel'), false);
    show($('rangeGamesLabel'), false);
    setHtml('rangeDays', '');
    setHtml('rangeGames', '');
    setHtml('rangePager', '');
    rangeDays = [];
    rangeOpenDate = '';
  } finally {
    rangeLoading = false;
  }
}

async function runDailyStatsJob() {
  if (rangeJobRunning || rangeLoading) return;
  if (isDemoMode()) {
    showToast('Demo mode does not run the stats job.', 'info');
    return;
  }
  rangeJobRunning = true;
  const btn = $('rangeRunBtn');
  if (btn) btn.disabled = true;
  setText('rangeHint', 'Running daily stats…');
  let finishedMessage = '';
  try {
    const { from, to } = rangeDates();
    const rangeQuery = from && to && to >= from
      ? '&from=' + encodeURIComponent(from) + '&to=' + encodeURIComponent(to)
      : '';
    const res = await fetch(apiUrl(INTERNAL_API + '/daily-stats/run?includeToday=true' + rangeQuery), {
      method: 'POST',
      headers: { Accept: 'application/json', 'Cache-Control': 'no-cache' },
      cache: 'no-store',
      signal: AbortSignal.timeout(120000),
    });
    const json = parseApiResponse(res, await res.text());
    finishedMessage = json.message || 'Daily stats job finished.';
    showToast(finishedMessage, 'ok');
  } catch (err) {
    const message = err?.name === 'TimeoutError'
      ? 'Stats job timed out.'
      : (err?.message || 'Job failed');
    setText('rangeHint', message);
    showToast(message, 'err');
  } finally {
    rangeJobRunning = false;
    if (btn) btn.disabled = false;
  }
  if (!finishedMessage) return;
  const { from, to } = rangeDates();
  if (from && to && to >= from) loadRangeCheck(1);
  else setText('rangeHint', finishedMessage + ' Pick a from and to date, then load.');
}

function bindRangeCheckEvents() {
  $('rangeDays')?.addEventListener('click', (e) => {
    const row = e.target.closest('[data-range-date]');
    if (!row) return;
    openRangeDay(row.getAttribute('data-range-date') || '');
  });
  $('rangeLoadBtn')?.addEventListener('click', () => loadRangeCheck(1));
  $('rangeRunBtn')?.addEventListener('click', () => runDailyStatsJob());
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

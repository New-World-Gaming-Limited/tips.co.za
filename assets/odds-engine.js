/**
 * odds-engine.js — Shared odds data layer for tips.co.za
 *
 * Fetches live odds from /api/ proxy, resolves event IDs to team names,
 * calculates value bets, detects dropping odds, builds accumulators.
 * Each page calls the methods it needs and renders its own UI.
 *
 * API base: /api/ (Cloudflare Worker proxying to api.odds-api.io/v3)
 * Fallback: direct to api.odds-api.io/v3 (for dev/preview)
 */

(function(window) {
  'use strict';

  // ── Config ──────────────────────────────────────────────────
  var API_KEY = 'fb60a483e7d3f726e3f9d9836e06dc504e22d07a64873094c46a4e29fc2fb57c';
  var PROXY_BASE = '/api';
  var DIRECT_BASE = 'https://api.odds-api.io/v3';

  // Affiliate links
  var AFFILIATE = {
    tictacbets: {
      name: 'TicTacBets',
      url: 'https://trackrt.tictacbets.co.za/o/Ss5uJL',
      color: '#cc0100'
    },
    betway: {
      name: 'Betway',
      url: 'https://new.betway.co.za/reg/?btag=P56088-PR27125-CM92449-TS1997077&signupcode=BETS',
      color: '#00a826'
    }
  };

  // Map API bookmaker names to our affiliate partners
  var BOOKMAKER_MAP = {
    'Stake': 'tictacbets',  // Stake odds → TicTacBets CTA
    'Betway': 'betway'
  };

  // Sports we display (skip niche/low-interest leagues)
  var PRIORITY_LEAGUES = [
    'premier-league', 'la-liga', 'bundesliga', 'serie-a', 'ligue-1',
    'champions-league', 'europa-league', 'conference-league',
    'south-africa-premier-soccer-league', 'south-africa',
    'international', 'world-cup', 'copa-america',
    'mls', 'eredivisie', 'primeira-liga', 'scottish-premiership',
    'championship', 'rugby', 'cricket', 'tennis'
  ];

  // Commentary templates by market type
  var COMMENTARY = {
    'ML': {
      'home': function(h, a, odds, ev) {
        return h + ' are ' + (odds < 1.5 ? 'heavy favourites' : odds < 2.0 ? 'favoured' : 'slight favourites') +
          ' against ' + a + (ev ? ' with a ' + ev.toFixed(1) + '% edge' : '') + '.';
      },
      'away': function(h, a, odds, ev) {
        return a + ' ' + (odds < 1.5 ? 'are strongly backed' : odds < 2.5 ? 'offer value' : 'are outsiders worth watching') +
          ' away at ' + h + (ev ? ', showing a ' + ev.toFixed(1) + '% edge' : '') + '.';
      },
      'draw': function(h, a, odds, ev) {
        return h + ' vs ' + a + ' looks tight' +
          (ev ? ', the draw at ' + odds.toFixed(2) + ' shows a ' + ev.toFixed(1) + '% edge' : '') + '.';
      }
    },
    'Spread': {
      'home': function(h, a, odds, ev) {
        return h + ' on the handicap against ' + a + (ev ? ', ' + ev.toFixed(1) + '% edge' : '') + '.';
      },
      'away': function(h, a, odds, ev) {
        return a + ' with the spread at ' + h + (ev ? ', ' + ev.toFixed(1) + '% edge' : '') + '.';
      }
    },
    'OU': {
      'over': function(h, a, odds, ev) {
        return 'Over looks likely in ' + h + ' vs ' + a + (ev ? ', ' + ev.toFixed(1) + '% edge' : '') + '.';
      },
      'under': function(h, a, odds, ev) {
        return 'Under has value in ' + h + ' vs ' + a + (ev ? ', ' + ev.toFixed(1) + '% edge' : '') + '.';
      }
    }
  };

  // ── Event cache ─────────────────────────────────────────────
  var eventCache = {};

  // ── API helpers ─────────────────────────────────────────────

  function apiUrl(path, params) {
    params = params || {};
    // Try proxy first, fall back to direct
    var base = PROXY_BASE;
    var qs = [];
    for (var k in params) {
      if (params.hasOwnProperty(k)) qs.push(k + '=' + encodeURIComponent(params[k]));
    }
    return base + '/' + path + (qs.length ? '?' + qs.join('&') : '');
  }

  function directUrl(path, params) {
    params = params || {};
    params.apiKey = API_KEY;
    var qs = [];
    for (var k in params) {
      if (params.hasOwnProperty(k)) qs.push(k + '=' + encodeURIComponent(params[k]));
    }
    return DIRECT_BASE + '/' + path + (qs.length ? '?' + qs.join('&') : '');
  }

  function apiFetch(path, params) {
    var proxyUrl = apiUrl(path, params);
    return fetch(proxyUrl)
      .then(function(r) {
        if (!r.ok) throw new Error('Proxy ' + r.status);
        return r.json();
      })
      .catch(function() {
        // Fallback to direct API
        return fetch(directUrl(path, params))
          .then(function(r) {
            if (!r.ok) throw new Error('Direct ' + r.status);
            return r.json();
          });
      });
  }

  // ── Event resolution ────────────────────────────────────────

  function resolveEvent(eventId) {
    if (eventCache[eventId]) return Promise.resolve(eventCache[eventId]);
    return apiFetch('events/' + eventId)
      .then(function(ev) {
        eventCache[eventId] = ev;
        return ev;
      })
      .catch(function() {
        return null;
      });
  }

  function resolveEvents(ids) {
    var unique = [];
    var seen = {};
    ids.forEach(function(id) {
      if (!seen[id]) { seen[id] = true; unique.push(id); }
    });
    return Promise.all(unique.map(resolveEvent));
  }

  // ── Filtering ───────────────────────────────────────────────

  function isValidEvent(ev) {
    if (!ev) return false;
    if (!ev.home || !ev.away) return false;
    // Filter out events where names look like IDs
    if (/^\d+$/.test(ev.home) || /^\d+$/.test(ev.away)) return false;
    // Filter out settled events
    if (ev.status === 'settled' || ev.status === 'cancelled') return false;
    return true;
  }

  function isInterestingLeague(ev) {
    if (!ev || !ev.league) return true; // Allow if no league info
    var slug = (ev.league.slug || '').toLowerCase();
    // Allow everything for now, but deprioritize obscure leagues
    return true;
  }

  function leaguePriority(ev) {
    if (!ev || !ev.league) return 50;
    var slug = (ev.league.slug || '').toLowerCase();
    for (var i = 0; i < PRIORITY_LEAGUES.length; i++) {
      if (slug.indexOf(PRIORITY_LEAGUES[i]) !== -1) return i;
    }
    return 50;
  }

  // ── Commentary generation ───────────────────────────────────

  function generateCommentary(home, away, market, betSide, odds, ev) {
    var marketName = market || 'ML';
    var templates = COMMENTARY[marketName];
    if (!templates) {
      return home + ' vs ' + away + (ev ? ', ' + ev.toFixed(1) + '% value edge detected.' : '.');
    }
    var fn = templates[betSide];
    if (!fn) {
      return home + ' vs ' + away + (ev ? ', ' + ev.toFixed(1) + '% value edge detected.' : '.');
    }
    return fn(home, away, parseFloat(odds) || 0, ev);
  }

  // ── Affiliate link helper ───────────────────────────────────

  function getAffiliate(bookmakerName) {
    var key = BOOKMAKER_MAP[bookmakerName];
    if (key && AFFILIATE[key]) return AFFILIATE[key];
    // Default to TicTacBets
    return AFFILIATE.tictacbets;
  }

  function betLink(bookmakerName, directHref) {
    // Always use our affiliate link, never the bookmaker's direct link
    var aff = getAffiliate(bookmakerName);
    return aff.url;
  }

  // ── Data fetchers ───────────────────────────────────────────

  /**
   * Fetch value bets for a bookmaker, resolve event names
   * Returns: [{eventId, home, away, league, date, market, betSide, odds, ev, bookmaker, affiliate, commentary}]
   */
  function fetchValueBets(bookmaker) {
    bookmaker = bookmaker || 'Betway';
    return apiFetch('value-bets', { sport: 'football', bookmaker: bookmaker })
      .then(function(data) {
        if (!Array.isArray(data)) return [];
        var ids = data.map(function(d) { return d.eventId; });
        return resolveEvents(ids).then(function() {
          return data.map(function(d) {
            var ev = eventCache[d.eventId];
            if (!isValidEvent(ev)) return null;
            var odds = d.bookmakerOdds || {};
            var currentOdds = odds[d.betSide] || 0;
            var edgeVal = d.expectedValue ? (d.expectedValue - 100) : 0;
            var aff = getAffiliate(bookmaker);
            return {
              eventId: d.eventId,
              home: ev.home,
              away: ev.away,
              league: ev.league ? ev.league.name : '',
              leagueSlug: ev.league ? ev.league.slug : '',
              date: ev.date,
              sport: ev.sport ? ev.sport.name : 'Football',
              market: d.market ? d.market.name : 'ML',
              betSide: d.betSide,
              odds: parseFloat(currentOdds),
              ev: edgeVal,
              bookmaker: bookmaker,
              affiliate: aff,
              commentary: generateCommentary(ev.home, ev.away, d.market ? d.market.name : 'ML', d.betSide, currentOdds, edgeVal),
              marketOdds: {
                home: d.market ? d.market.home : null,
                draw: d.market ? d.market.draw : null,
                away: d.market ? d.market.away : null
              }
            };
          }).filter(Boolean)
            .sort(function(a, b) { return b.ev - a.ev; });
        });
      })
      .catch(function(err) {
        console.warn('Value bets fetch failed:', err);
        return [];
      });
  }

  /**
   * Fetch dropping odds, resolve event names
   * Returns: [{eventId, home, away, league, date, market, betSide, opening, current, dropPct, commentary}]
   */
  function fetchDroppingOdds(sport) {
    sport = sport || 'football';
    return apiFetch('dropping-odds', { sport: sport })
      .then(function(data) {
        if (!Array.isArray(data)) return [];
        var ids = data.map(function(d) { return d.eventId; });
        return resolveEvents(ids).then(function() {
          return data.map(function(d) {
            var ev = eventCache[d.eventId];
            if (!isValidEvent(ev)) return null;
            var opening = d.odds ? d.odds.opening : 0;
            var current = d.odds ? d.odds.current : 0;
            var dropPct = d.odds && d.odds.drop ? d.odds.drop.sinceOpening : 0;
            return {
              eventId: d.eventId,
              home: ev.home,
              away: ev.away,
              league: ev.league ? ev.league.name : '',
              leagueSlug: ev.league ? ev.league.slug : '',
              date: ev.date,
              sport: ev.sport ? ev.sport.name : 'Football',
              market: d.market ? d.market.name : 'ML',
              betSide: d.betSide,
              opening: opening,
              current: current,
              dropPct: dropPct,
              commentary: generateCommentary(ev.home, ev.away, d.market ? d.market.name : 'ML', d.betSide, current, null)
            };
          }).filter(Boolean)
            .sort(function(a, b) { return b.dropPct - a.dropPct; });
        });
      })
      .catch(function(err) {
        console.warn('Dropping odds fetch failed:', err);
        return [];
      });
  }

  /**
   * Build accumulator suggestions from value bets
   * Groups: Safe Treble (top 3 by EV, low odds), Value 4-Fold, Bold 6-Fold
   */
  function buildAccumulators(valueBetsAll) {
    // Deduplicate by eventId (one pick per match)
    var seen = {};
    var unique = [];
    valueBetsAll.forEach(function(b) {
      if (!seen[b.eventId]) {
        seen[b.eventId] = true;
        unique.push(b);
      }
    });

    // Sort by EV descending
    unique.sort(function(a, b) { return b.ev - a.ev; });

    var accas = [];

    // Safe Treble: top 3 picks with odds under 2.5 (more likely to land)
    var safePicks = unique.filter(function(b) { return b.odds < 2.5 && b.ev > 0; }).slice(0, 3);
    if (safePicks.length === 3) {
      var safeTotal = safePicks.reduce(function(acc, b) { return acc * b.odds; }, 1);
      accas.push({
        name: 'Safe Treble',
        type: 'safe',
        description: 'Three strong-value selections at shorter odds. Lower risk, steady returns.',
        picks: safePicks,
        combinedOdds: safeTotal,
        potentialReturn: (safeTotal * 50).toFixed(0) // R50 stake
      });
    }

    // Value 4-Fold: top 4 picks by EV
    var valuePicks = unique.filter(function(b) { return b.ev > 0; }).slice(0, 4);
    if (valuePicks.length === 4) {
      var valueTotal = valuePicks.reduce(function(acc, b) { return acc * b.odds; }, 1);
      accas.push({
        name: 'Value 4-Fold',
        type: 'value',
        description: 'Four picks selected purely on expected value edge. Higher risk, higher reward.',
        picks: valuePicks,
        combinedOdds: valueTotal,
        potentialReturn: (valueTotal * 50).toFixed(0)
      });
    }

    // Bold 6-Fold: top 6 picks, mixing odds ranges
    var boldPicks = unique.filter(function(b) { return b.ev > 0; }).slice(0, 6);
    if (boldPicks.length >= 5) {
      var boldTotal = boldPicks.reduce(function(acc, b) { return acc * b.odds; }, 1);
      accas.push({
        name: boldPicks.length === 6 ? 'Bold 6-Fold' : 'Bold 5-Fold',
        type: 'bold',
        description: 'Our biggest accumulator. High variance, but each leg carries a positive expected value edge.',
        picks: boldPicks,
        combinedOdds: boldTotal,
        potentialReturn: (boldTotal * 50).toFixed(0)
      });
    }

    return accas;
  }

  // ── Formatting helpers ──────────────────────────────────────

  function formatOdds(n) {
    return parseFloat(n).toFixed(2);
  }

  function formatDate(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    var day = d.getDate();
    var mon = months[d.getMonth()];
    var hrs = d.getHours().toString().padStart(2, '0');
    var min = d.getMinutes().toString().padStart(2, '0');
    return day + ' ' + mon + ', ' + hrs + ':' + min;
  }

  function formatBetSide(side, home, away, market) {
    if (side === 'home') return home;
    if (side === 'away') return away;
    if (side === 'draw') return 'Draw';
    if (side === 'over' || side === 'under') {
      // Extract the line from the market name, e.g. "Over/Under 2.5" -> "2.5"
      var line = '';
      if (market) {
        var m = market.match(/([\d]+\.?[\d]*)/);
        if (m) line = ' ' + m[1];
      }
      var label = side === 'over' ? 'Over' : 'Under';
      return label + line + (line ? ' Goals' : '');
    }
    return side;
  }

  function evBadgeClass(ev) {
    if (ev >= 5) return 'ev-high';
    if (ev >= 2) return 'ev-medium';
    return 'ev-low';
  }

  function dropBadgeClass(pct) {
    if (pct >= 30) return 'drop-high';
    if (pct >= 15) return 'drop-medium';
    return 'drop-low';
  }

  // ── Public API ──────────────────────────────────────────────

  window.OddsEngine = {
    fetchValueBets: fetchValueBets,
    fetchDroppingOdds: fetchDroppingOdds,
    buildAccumulators: buildAccumulators,
    resolveEvent: resolveEvent,
    getAffiliate: getAffiliate,
    betLink: betLink,
    formatOdds: formatOdds,
    formatDate: formatDate,
    formatBetSide: formatBetSide,
    generateCommentary: generateCommentary,
    evBadgeClass: evBadgeClass,
    dropBadgeClass: dropBadgeClass,
    AFFILIATE: AFFILIATE
  };

})(window);

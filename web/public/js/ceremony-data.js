/**
 * ceremony-data.js — Shared story data client for all visualizations.
 *
 * Usage in any viz HTML page:
 *
 *   <script src="/the-ceremony/js/ceremony-data.js"></script>
 *   <script>
 *     CeremonyData.load({ slice: 'relationships' }).then(function(graph) {
 *       // graph.nodes, graph.edges, graph.meta
 *       renderMyVisualization(graph);
 *     });
 *
 *     // Auto-update when data changes:
 *     CeremonyData.subscribe(function(updatedGraph) {
 *       renderMyVisualization(updatedGraph);
 *     });
 *   </script>
 *
 * Slices:
 *   'all'           — everything
 *   'relationships' — nodes + edges (relationship-map)
 *   'narrative'     — sessions + locations + threads (story-skeleton)
 *   'fog'           — fog matrix data
 *
 * The module handles:
 *   - Fetching from /api/story-data with caching (ETag/304)
 *   - Subscribing to SSE for live updates
 *   - Diffing to only re-render when data actually changed
 *   - Retry/reconnect on SSE disconnect
 */

(function (root) {
  'use strict';

  var API_BASE = '/the-ceremony/api/story-data';
  // Auto-detect SSE endpoint: rigging's story-watcher broadcasts changes
  // Direct access (:3006) uses /api/story-events, Caddy-proxied uses /sandbox/rigging/api/story-events
  var SSE_URL = (window.location.port === '3006')
    ? '/api/story-events'
    : '/sandbox/rigging/api/story-events';

  var _cache = null;
  var _cacheHash = null;
  var _slice = 'all';
  var _listeners = [];
  var _eventSource = null;
  var _reconnectTimer = null;
  var _reconnectDelay = 1000;
  var _maxReconnectDelay = 30000;
  var _token = null;

  // ── Public API ───────────────────────────────────────

  var CeremonyData = {

    /**
     * Load story data from the API.
     * @param {Object} opts
     * @param {string} opts.slice - 'all', 'relationships', 'narrative', 'fog'
     * @param {string} opts.token - Auth token for SSE subscription
     * @param {boolean} opts.subscribe - Auto-subscribe to changes (default: true)
     * @returns {Promise<Object>} The story data graph
     */
    load: function (opts) {
      opts = opts || {};
      _slice = opts.slice || 'all';
      _token = opts.token || _getTokenFromUrl();

      return _fetch().then(function (graph) {
        if (opts.subscribe !== false) {
          _connectSSE();
        }
        return graph;
      });
    },

    /**
     * Register a callback for when data changes.
     * @param {Function} fn - Called with updated graph
     * @returns {Function} Unsubscribe function
     */
    subscribe: function (fn) {
      _listeners.push(fn);
      return function () {
        _listeners = _listeners.filter(function (l) { return l !== fn; });
      };
    },

    /**
     * Force a refresh from the API.
     * @returns {Promise<Object>}
     */
    refresh: function () {
      _cacheHash = null; // bypass 304
      return _fetch();
    },

    /**
     * Get the current cached graph without fetching.
     * @returns {Object|null}
     */
    current: function () {
      return _cache;
    },

    /**
     * Disconnect SSE and clean up.
     */
    disconnect: function () {
      if (_eventSource) {
        _eventSource.close();
        _eventSource = null;
      }
      if (_reconnectTimer) {
        clearTimeout(_reconnectTimer);
        _reconnectTimer = null;
      }
      _listeners = [];
    },

    // ── Derived accessors (convenience) ────────────────

    /** Get all nodes of a given type */
    nodesOfType: function (type) {
      if (!_cache || !_cache.nodes) return [];
      return _cache.nodes.filter(function (n) { return n.type === type; });
    },

    /** Get all edges connected to a node */
    edgesFor: function (nodeId) {
      if (!_cache || !_cache.edges) return [];
      return _cache.edges.filter(function (e) {
        return e.source === nodeId || e.target === nodeId;
      });
    },

    /** Get a node by ID */
    node: function (id) {
      if (!_cache || !_cache.nodes) return null;
      return _cache.nodes.find(function (n) { return n.id === id; }) || null;
    },

    /** Get thread nodes sorted by status progression */
    threads: function () {
      var order = ['dormant', 'planted', 'growing', 'ripe', 'resolved'];
      return CeremonyData.nodesOfType('thread').sort(function (a, b) {
        return order.indexOf(a.status || 'dormant') - order.indexOf(b.status || 'dormant');
      });
    },

    /** Build the D3-compatible { nodes, links } format */
    forceGraph: function () {
      if (!_cache) return { nodes: [], links: [] };
      return {
        nodes: _cache.nodes.map(function (n) {
          return Object.assign({}, n);
        }),
        links: _cache.edges.map(function (e) {
          return { source: e.source, target: e.target, type: e.type, desc: e.desc };
        })
      };
    }
  };

  // ── Internal ─────────────────────────────────────────

  function _fetch() {
    var url = API_BASE + '?slice=' + encodeURIComponent(_slice);
    if (_cacheHash) {
      url += '&version=' + encodeURIComponent(_cacheHash);
    }

    return fetch(url, {
      headers: _token ? { 'Authorization': 'Bearer ' + _token } : {}
    }).then(function (res) {
      if (res.status === 304) {
        // Data unchanged
        return _cache;
      }
      if (!res.ok) {
        throw new Error('story-data fetch failed: ' + res.status);
      }
      return res.json();
    }).then(function (graph) {
      if (graph && graph.meta) {
        _cache = graph;
        _cacheHash = graph.meta.hash;
      }
      return _cache;
    });
  }

  function _connectSSE() {
    if (_eventSource) return;
    if (typeof EventSource === 'undefined') return;

    var url = SSE_URL;
    if (_token) url += '?token=' + encodeURIComponent(_token);

    _eventSource = new EventSource(url);
    _reconnectDelay = 1000;

    _eventSource.addEventListener('story-data-changed', function (e) {
      // The event may carry a hash; if it matches our cache, skip
      var data = {};
      try { data = JSON.parse(e.data); } catch (err) { /* ignore */ }

      if (data.hash && data.hash === _cacheHash) return;

      // Refetch the full slice
      _fetch().then(function (graph) {
        _notify(graph);
      });
    });

    // Also listen for memory-write and config-change events (existing SSE types)
    // These are more granular — we refetch on any of them
    ['memory-write', 'config-change', 'preset-loaded', 'npc-state-change'].forEach(function (evt) {
      _eventSource.addEventListener(evt, function () {
        _fetch().then(function (graph) {
          if (graph) _notify(graph);
        });
      });
    });

    _eventSource.onerror = function () {
      _eventSource.close();
      _eventSource = null;

      // Exponential backoff reconnect
      _reconnectTimer = setTimeout(function () {
        _connectSSE();
      }, _reconnectDelay);

      _reconnectDelay = Math.min(_reconnectDelay * 2, _maxReconnectDelay);
    };
  }

  function _notify(graph) {
    for (var i = 0; i < _listeners.length; i++) {
      try {
        _listeners[i](graph);
      } catch (err) {
        console.error('[ceremony-data] listener error:', err);
      }
    }
  }

  function _getTokenFromUrl() {
    try {
      var params = new URLSearchParams(window.location.search);
      return params.get('token') || null;
    } catch (e) {
      return null;
    }
  }

  // ── Export ────────────────────────────────────────────

  root.CeremonyData = CeremonyData;

})(typeof window !== 'undefined' ? window : this);

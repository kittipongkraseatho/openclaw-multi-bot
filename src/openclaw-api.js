/**
 * openclaw-api.js — connector to OpenClaw Gateway WebSocket
 *
 * วิธีใช้:
 *   1. ตั้งค่า window.OPENCLAW_WS_URL เองถ้าต้องการ override auto-detect
 *   2. เรียก OpenClawAPI.connect() หลังจาก DOM โหลดเสร็จ
 *   3. ส่งคำสั่งด้วย OpenClawAPI.send(agentId, command)
 *
 * Local default: ws://127.0.0.1:18789
 */

function resolveOpenClawWsUrl() {
  if (typeof window === 'undefined' || !window.location) {
    return 'ws://127.0.0.1:18789';
  }

  var protocol = window.location.protocol;
  var hostname = window.location.hostname;
  var isLocalhost = hostname === '127.0.0.1' || hostname === 'localhost';

  if (protocol !== 'http:' && protocol !== 'https:') {
    return 'ws://127.0.0.1:18789';
  }

  if (isLocalhost) {
    return 'ws://127.0.0.1:18789';
  }

  return (protocol === 'https:' ? 'wss://' : 'ws://') + window.location.host + '/ws';
}

var OPENCLAW_WS_URL = (
  typeof window !== 'undefined' && window.OPENCLAW_WS_URL
) || resolveOpenClawWsUrl();

var OpenClawAPI = (function () {
  var _ws = null;
  var _handlers = {};
  var _runtimeStore = null;

  function setRuntimeStore(runtimeStore) {
    _runtimeStore = runtimeStore;
  }

  function connect() {
    try {
      _ws = new WebSocket(OPENCLAW_WS_URL);
      _ws.onopen = function () {
        console.log('[OpenClaw] Connected to gateway');
        _emit('connect');
      };
      _ws.onmessage = function (ev) {
        try {
          var data = JSON.parse(ev.data);
          _emit('message', data);
          // Update agent stats if payload matches
          if (_runtimeStore && data.agent && _runtimeStore.getAgent(data.agent)) {
            if (data.status) {
              _runtimeStore.updateAgent(data.agent, {
                status: data.status.toUpperCase()
              });
            }
            if (data.log) {
              _runtimeStore.addLog(_runtimeStore.getAgent(data.agent).name, data.log);
            }
          }
        } catch (e) {
          console.warn('[OpenClaw] Unrecognised message', ev.data);
        }
      };
      _ws.onerror = function () { console.warn('[OpenClaw] WebSocket error'); };
      _ws.onclose = function () {
        console.log('[OpenClaw] Disconnected — reconnect in 5s');
        setTimeout(connect, 5000);
      };
    } catch (e) {
      console.warn('[OpenClaw] Cannot connect:', e.message);
    }
  }

  function send(agentId, command) {
    if (!_ws || _ws.readyState !== WebSocket.OPEN) {
      console.warn('[OpenClaw] Not connected — command dropped:', command);
      return false;
    }
    _ws.send(JSON.stringify({ agent: agentId, command: command }));
    return true;
  }

  function on(event, handler) { _handlers[event] = handler; }

  function _emit(event, data) {
    if (_handlers[event]) _handlers[event](data);
  }

  function _statusClass(status) {
    var s = (status || '').toLowerCase();
    if (s === 'working') return 'st-working';
    if (s === 'busy')    return 'st-busy';
    return 'st-idle';
  }

  return {
    connect: connect,
    send: send,
    on: on,
    setRuntimeStore: setRuntimeStore
  };
})();

/*
 * ── Docker stats via openclaw CLI REST (port 18790) ──────────────────────
 *
 * เปิดใช้บรรทัดนี้ถ้า openclaw gateway รันอยู่:
 *
 * setInterval(function () {
 *   fetch('http://127.0.0.1:18790/api/docker/stats')
 *     .then(function (r) { return r.json(); })
 *     .then(function (d) {
 *       if (d.cpu !== undefined) {
 *         document.getElementById('d-cpu').textContent  = Math.round(d.cpu) + '%';
 *         document.getElementById('cpu-bar').style.width = Math.round(d.cpu) + '%';
 *       }
 *       if (d.ram !== undefined) {
 *         document.getElementById('d-ram').textContent  = d.ram.toFixed(1) + ' GB';
 *         document.getElementById('ram-bar').style.width = Math.round(d.ram / d.ramTotal * 100) + '%';
 *       }
 *     })
 *     .catch(function () {});
 * }, 3000);
 *
 * // Connect to gateway WebSocket on page load:
 * window.addEventListener('DOMContentLoaded', function () {
 *   OpenClawAPI.connect();
 * });
 */

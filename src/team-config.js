/**
 * team-config.js — TeamConfig loader, schema helpers, and validation
   *
 * Source of truth for team and agent definitions now lives in team-config.json.
 */

var DEFAULT_TEAM_CONFIG = {
  team: 'openclaw-office',
  title: 'OpenClaw Office',
  agents: [
    {
      id: 'gm',
      name: 'GM',
      kind: 'orchestrator',
      role: 'General Manager',
      persona:
        'Receives tasks from users via Discord or Web UI. Triage complexity, delegate to Worker agents in parallel, synthesize results, and respond. Load team skills from /root/.openclaw/skills/${TEAM_NAME}/ including SKILL.md, KM.md, WORKFLOW.md, and COMMUNICATION.md. Route knowledge lookups through the shared Obsidian KM vault at disks/km/ before workers rely on the open web.',
      workspace: '~/.openclaw/agents/gm/workspace',
      ai: {
        provider: 'gemini',
        model: 'gemini-2.5-pro',
        apiKeyEnv: 'GEMINI_API_KEY'
      },
      status: 'WORKING',
      stats: { tasks: 0, up: '0m', msg: 0, err: 0 },
      channels: [
        { name: 'Discord', color: '#5865f2' },
        { name: 'Web UI', color: '#90caf9' }
      ],
      sprite: { hair: '#37474f', skin: '#ffcc80', shirt: '#1565c0', pants: '#263238' }
    },
    {
      id: 'w1',
      name: 'RESEARCH',
      kind: 'worker',
      role: 'Research & synthesis',
      persona:
        'Runs research and evidence gathering concurrently with other workers. Isolated tool stack under this workspace only, with SOUL.md, AGENTS.md, TOOLS.md, and IDENTITY.md defining local behavior. Persist outcomes to the shared Obsidian KM vault (disks/km/); search disks/km/ before hitting the web so knowledge compounds every session.',
      workspace: '~/.openclaw/agents/w1/workspace',
      ai: {
        provider: 'gemini',
        model: 'gemini-2.5-flash',
        apiKeyEnv: 'GEMINI_API_KEY'
      },
      status: 'IDLE',
      stats: { tasks: 0, up: '0m', msg: 0, err: 0 },
      channels: [{ name: 'Internal', color: '#78909c' }],
      sprite: { hair: '#4e342e', skin: '#ffe0b2', shirt: '#2e7d32', pants: '#1b5e20' }
    },
    {
      id: 'w2',
      name: 'CODE',
      kind: 'worker',
      role: 'Code & implementation',
      persona:
        'Runs coding and repo tasks in parallel with other workers. Dedicated isolated tool stack, governed locally by SOUL.md, AGENTS.md, TOOLS.md, and IDENTITY.md so workers never interfere with each other. Document reusable snippets or runbooks into disks/km/ when they become team knowledge.',
      workspace: '~/.openclaw/agents/w2/workspace',
      ai: {
        provider: 'deepseek',
        model: 'deepseek-chat',
        apiKeyEnv: 'DEEPSEEK_API_KEY'
      },
      status: 'IDLE',
      stats: { tasks: 0, up: '0m', msg: 0, err: 0 },
      channels: [{ name: 'Internal', color: '#78909c' }],
      sprite: { hair: '#212121', skin: '#ffcc80', shirt: '#4a148c', pants: '#311b92' }
    },
    {
      id: 'w3',
      name: 'DATA',
      kind: 'worker',
      role: 'Data extraction & web tasks',
      persona:
        'Runs structured data extraction, scraping, and web-side tasks alongside other workers. Isolated tool stack per workspace, with SOUL.md, AGENTS.md, TOOLS.md, and IDENTITY.md anchoring role and routing. Writes normalized findings and datasets into disks/km/ for future retrieval before broad web passes.',
      workspace: '~/.openclaw/agents/w3/workspace',
      ai: {
        provider: 'gemini',
        model: 'gemini-2.5-flash',
        apiKeyEnv: 'GEMINI_API_KEY'
      },
      status: 'IDLE',
      stats: { tasks: 0, up: '0m', msg: 0, err: 0 },
      channels: [{ name: 'Internal', color: '#78909c' }],
      sprite: { hair: '#e65100', skin: '#ffd54f', shirt: '#006064', pants: '#004d40' }
    },
    {
      id: 'n8n',
      name: 'N8N',
      kind: 'automation',
      role: 'Workflows & schedules',
      persona:
        'Handles scheduled reports, data sync, and webhook triggers. GM and Workers offload recurring, deterministic work to n8n so they stay available for triage, research, coding, and synthesis. This agent still follows the same per-agent workspace contract with SOUL.md, AGENTS.md, TOOLS.md, and IDENTITY.md.',
      workspace: '~/.openclaw/agents/n8n/workspace',
      ai: {
        provider: 'gemini',
        model: 'gemini-2.5-flash',
        apiKeyEnv: 'GEMINI_API_KEY'
      },
      status: 'IDLE',
      stats: { tasks: 0, up: '0m', msg: 0, err: 0 },
      channels: [
        { name: 'Webhook', color: '#ff6d5a' },
        { name: 'Schedule', color: '#546e7a' }
      ],
      sprite: { hair: '#455a64', skin: '#cfd8dc', shirt: '#d84315', pants: '#37474f' }
    }
  ],
  schedules: [
    {
      id: 'daily-summary',
      name: 'Daily reports & sync (n8n)',
      enabled: false,
      cron: '0 18 * * *',
      target: 'n8n'
    }
  ]
};

function _clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function _normalizeStatus(status) {
  return String(status || 'IDLE').toUpperCase();
}

function _normalizeAiConfig(agentConfig) {
  var ai = agentConfig && agentConfig.ai;
  if (ai && typeof ai === 'object') {
    return {
      provider: String(ai.provider || '').toLowerCase(),
      model: String(ai.model || ''),
      apiKeyEnv: String(ai.apiKeyEnv || '')
    };
  }
  return {
    provider: '',
    model: '',
    apiKeyEnv: ''
  };
}

function _statusClass(status) {
  var lower = String(status || 'idle').toLowerCase();
  if (lower === 'working') return 'st-working';
  if (lower === 'busy') return 'st-busy';
  return 'st-idle';
}

function validateTeamConfig(config) {
  var errors = [];
  var seen = {};
  var team = config && config.team;
  var agents = config && config.agents;
  var allowedProviders = { deepseek: true, gemini: true };

  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    errors.push('Config must be an object.');
    return { valid: false, errors: errors };
  }

  if (!team || typeof team !== 'string') {
    errors.push('Config must include a string "team".');
  }

  if (!Array.isArray(agents) || agents.length === 0) {
    errors.push('Config must include at least one agent.');
  } else {
    agents.forEach(function (agent, index) {
      var prefix = 'agents[' + index + ']';
      if (!agent || typeof agent !== 'object') {
        errors.push(prefix + ' must be an object.');
        return;
      }
      if (!agent.id || typeof agent.id !== 'string') {
        errors.push(prefix + '.id is required.');
      } else if (seen[agent.id]) {
        errors.push('Agent ids must be unique. Duplicate id: ' + agent.id);
      } else {
        seen[agent.id] = true;
      }
      if (!agent.name || typeof agent.name !== 'string') {
        errors.push(prefix + '.name is required.');
      }
      if (!agent.role || typeof agent.role !== 'string') {
        errors.push(prefix + '.role is required.');
      }
      if (!Array.isArray(agent.channels) || agent.channels.length === 0) {
        errors.push(prefix + '.channels must contain at least one channel.');
      }
      if (!agent.sprite || typeof agent.sprite !== 'object') {
        errors.push(prefix + '.sprite is required.');
      }
      if (!agent.ai || typeof agent.ai !== 'object' || Array.isArray(agent.ai)) {
        errors.push(prefix + '.ai is required.');
      } else {
        if (!agent.ai.provider || typeof agent.ai.provider !== 'string') {
          errors.push(prefix + '.ai.provider is required.');
        } else if (!allowedProviders[String(agent.ai.provider).toLowerCase()]) {
          errors.push(prefix + '.ai.provider must be one of: deepseek, gemini.');
        }
        if (!agent.ai.model || typeof agent.ai.model !== 'string') {
          errors.push(prefix + '.ai.model is required.');
        }
        if (!agent.ai.apiKeyEnv || typeof agent.ai.apiKeyEnv !== 'string') {
          errors.push(prefix + '.ai.apiKeyEnv is required.');
        }
      }
    });
  }

  return { valid: errors.length === 0, errors: errors };
}

function buildAgentRecord(agentConfig) {
  var stats = agentConfig.stats || {};
  var status = _normalizeStatus(agentConfig.status);
  var ai = _normalizeAiConfig(agentConfig);
  return {
    id: agentConfig.id,
    name: agentConfig.name,
    kind: agentConfig.kind || 'worker',
    role: agentConfig.role,
    persona: agentConfig.persona || '',
    workspace: agentConfig.workspace || '',
    ai: ai,
    model: ai.model,
    status: status,
    stClass: _statusClass(status),
    tasks: stats.tasks || 0,
    up: stats.up || '0m',
    msg: stats.msg || 0,
    err: stats.err || 0,
    channels: (agentConfig.channels || []).map(function (channel) {
      return {
        name: channel.name,
        color: channel.color
      };
    }),
    sprite: _clone(agentConfig.sprite || {})
  };
}

function buildAgentMap(config) {
  var map = {};
  (config.agents || []).forEach(function (agent) {
    map[agent.id] = buildAgentRecord(agent);
  });
  return map;
}

function createAgentConfig(input, sprite) {
  var id = input.id || 'ag_' + Date.now();
  return {
    id: String(id).toLowerCase(),
    name: String(input.name || 'AGENT').toUpperCase(),
    kind: input.kind || 'worker',
    role: input.role || 'Custom agent',
    persona: input.persona || '',
    workspace: input.workspace || '',
    ai: {
      provider: String(input.aiProvider || 'gemini').toLowerCase(),
      model: input.aiModel || 'gemini-2.5-flash',
      apiKeyEnv: input.aiApiKeyEnv || 'GEMINI_API_KEY'
    },
    status: 'IDLE',
    stats: { tasks: 0, up: '0m', msg: 0, err: 0 },
    channels: [
      {
        name: input.channelName || 'Telegram',
        color: input.channelColor || '#4fc3f7'
      }
    ],
    sprite: _clone(sprite || {})
  };
}

function normalizeLoadedConfig(config) {
  var result = validateTeamConfig(config);
  if (!result.valid) {
    throw new Error(result.errors.join(' '));
  }
  return _clone(config);
}

function loadConfig(fetchImpl) {
  if (!fetchImpl) {
    return Promise.resolve(_clone(DEFAULT_TEAM_CONFIG));
  }
  return fetchImpl('team-config.json')
    .then(function (response) {
      if (!response.ok) {
        throw new Error('Failed to load team-config.json');
      }
      return response.json();
    })
    .then(function (config) {
      return normalizeLoadedConfig(config);
    })
    .catch(function () {
      return _clone(DEFAULT_TEAM_CONFIG);
    });
}

var TeamConfig = {
  DEFAULT_TEAM_CONFIG: DEFAULT_TEAM_CONFIG,
  validateTeamConfig: validateTeamConfig,
  normalizeLoadedConfig: normalizeLoadedConfig,
  buildAgentRecord: buildAgentRecord,
  buildAgentMap: buildAgentMap,
  createAgentConfig: createAgentConfig,
  loadConfig: loadConfig,
  statusClass: _statusClass
};

if (typeof window !== 'undefined') {
  window.TeamConfig = TeamConfig;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = TeamConfig;
}

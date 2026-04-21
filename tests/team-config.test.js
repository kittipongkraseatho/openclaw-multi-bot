var test = require('node:test');
var assert = require('node:assert/strict');
var TeamConfig = require('../src/team-config.js');

test('validateTeamConfig accepts the default config', function () {
  var result = TeamConfig.validateTeamConfig(TeamConfig.DEFAULT_TEAM_CONFIG);
  assert.equal(result.valid, true);
  assert.deepEqual(result.errors, []);
});

test('validateTeamConfig rejects duplicate agent ids', function () {
  var config = {
    team: 'duplicate-team',
    agents: [
      {
        id: 'dup',
        name: 'One',
        role: 'Worker',
        ai: { provider: 'gemini', model: 'gemini-2.5-pro', apiKeyEnv: 'GEMINI_API_KEY' },
        channels: [{ name: 'Slack', color: '#111111' }],
        sprite: { hair: '#111111', skin: '#222222', shirt: '#333333', pants: '#444444' }
      },
      {
        id: 'dup',
        name: 'Two',
        role: 'Worker',
        ai: { provider: 'gemini', model: 'gemini-2.5-pro', apiKeyEnv: 'GEMINI_API_KEY' },
        channels: [{ name: 'Slack', color: '#111111' }],
        sprite: { hair: '#111111', skin: '#222222', shirt: '#333333', pants: '#444444' }
      }
    ]
  };
  var result = TeamConfig.validateTeamConfig(config);

  assert.equal(result.valid, false);
  assert.match(result.errors.join(' '), /Duplicate id: dup/);
});

test('buildAgentMap converts config agents into runtime records', function () {
  var agents = TeamConfig.buildAgentMap(TeamConfig.DEFAULT_TEAM_CONFIG);

  assert.equal(agents.gm.name, 'GM');
  assert.equal(agents.gm.stClass, 'st-working');
  assert.equal(agents.gm.channels[0].name, 'Discord');
  assert.equal(agents.gm.ai.provider, 'gemini');
  assert.equal(agents.w2.ai.provider, 'deepseek');
  assert.equal(agents.n8n.status, 'IDLE');
});

test('createAgentConfig returns a normalized worker config', function () {
  var agent = TeamConfig.createAgentConfig({
    id: 'Finance',
    name: 'Finance',
    role: 'Budget tracking',
    workspace: '/tmp/finance',
    channelName: 'Discord',
    aiProvider: 'deepseek',
    aiModel: 'deepseek-chat',
    aiApiKeyEnv: 'DEEPSEEK_API_KEY'
  }, {
    hair: '#123456',
    skin: '#abcdef',
    shirt: '#111111',
    pants: '#222222'
  });

  assert.equal(agent.id, 'finance');
  assert.equal(agent.name, 'FINANCE');
  assert.equal(agent.channels[0].name, 'Discord');
  assert.equal(agent.ai.provider, 'deepseek');
  assert.equal(agent.ai.model, 'deepseek-chat');
  assert.equal(agent.stats.tasks, 0);
});

test('validateTeamConfig rejects unsupported AI provider', function () {
  var config = {
    team: 'bad-provider',
    agents: [
      {
        id: 'bad',
        name: 'Bad',
        role: 'Worker',
        ai: { provider: 'openai', model: 'gpt-4o', apiKeyEnv: 'OPENAI_API_KEY' },
        channels: [{ name: 'Slack', color: '#111111' }],
        sprite: { hair: '#111111', skin: '#222222', shirt: '#333333', pants: '#444444' }
      }
    ]
  };
  var result = TeamConfig.validateTeamConfig(config);

  assert.equal(result.valid, false);
  assert.match(result.errors.join(' '), /deepseek, gemini/);
});

test('validateTeamConfig rejects missing AI fields', function () {
  var config = {
    team: 'missing-ai-fields',
    agents: [
      {
        id: 'bad',
        name: 'Bad',
        role: 'Worker',
        ai: { provider: 'gemini', model: '', apiKeyEnv: '' },
        channels: [{ name: 'Slack', color: '#111111' }],
        sprite: { hair: '#111111', skin: '#222222', shirt: '#333333', pants: '#444444' }
      }
    ]
  };
  var result = TeamConfig.validateTeamConfig(config);

  assert.equal(result.valid, false);
  assert.match(result.errors.join(' '), /ai\.model is required/);
  assert.match(result.errors.join(' '), /ai\.apiKeyEnv is required/);
});

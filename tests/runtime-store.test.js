var test = require('node:test');
var assert = require('node:assert/strict');
var TeamConfig = require('../src/team-config.js');
var OfficeRuntimeStore = require('../src/runtime-store.js');

function freshStore() {
  OfficeRuntimeStore.init(TeamConfig.DEFAULT_TEAM_CONFIG, []);
}

test('init creates agent state from TeamConfig', function () {
  freshStore();

  assert.equal(OfficeRuntimeStore.getSelectedAgentId(), 'gm');
  assert.equal(OfficeRuntimeStore.getAgent('w2').role, 'Code & implementation');
  assert.equal(OfficeRuntimeStore.getAgent('w2').ai.provider, 'deepseek');
});

test('normalizeTaskInput maps UI commands into canonical task shape', function () {
  freshStore();
  var task = OfficeRuntimeStore.normalizeTaskInput({
    sourceType: 'chat-ops',
    sourceLabel: 'Discord',
    command: 'summarize today',
    requestedAgentId: 'w2',
    metadata: { channel: 'ops-room' }
  });

  assert.equal(task.sourceType, 'chat-ops');
  assert.equal(task.sourceLabel, 'Discord');
  assert.equal(task.command, 'summarize today');
  assert.equal(task.requestedAgentId, 'w2');
  assert.equal(task.ai.provider, 'deepseek');
  assert.equal(task.ai.model, 'deepseek-chat');
  assert.equal(task.metadata.channel, 'ops-room');
});

test('submitTask creates a completed run with lifecycle history', function () {
  freshStore();
  var run = OfficeRuntimeStore.submitTask({
    sourceType: 'web-ui',
    command: 'status report all agents',
    requestedAgentId: 'gm'
  });
  var latestRun = OfficeRuntimeStore.getLatestRun();

  assert.equal(run.agentId, 'gm');
  assert.equal(run.status, 'completed');
  assert.equal(run.ai.provider, 'gemini');
  assert.equal(run.ai.model, 'gemini-2.5-pro');
  assert.deepEqual(run.history.map(function (entry) { return entry.status; }), [
    'received',
    'planned',
    'running',
    'completed'
  ]);
  assert.equal(latestRun.id, run.id);
  assert.match(run.summary, /gemini\/gemini-2.5-pro/);
  assert.equal(OfficeRuntimeStore.getAgent('gm').tasks, 1);
});

test('addAgent extends runtime config and agent map', function () {
  freshStore();
  OfficeRuntimeStore.addAgent(TeamConfig.createAgentConfig({
    id: 'ops2',
    name: 'OPS_TWO',
    role: 'Secondary ops',
    workspace: '/tmp/ops2',
    channelName: 'Slack',
    aiProvider: 'gemini',
    aiModel: 'gemini-2.5-flash',
    aiApiKeyEnv: 'GEMINI_API_KEY'
  }, {
    hair: '#000000',
    skin: '#ffffff',
    shirt: '#111111',
    pants: '#222222'
  }));

  assert.equal(OfficeRuntimeStore.getTeamConfig().agents.length, 6);
  assert.equal(OfficeRuntimeStore.getAgent('ops2').name, 'OPS_TWO');
  assert.equal(OfficeRuntimeStore.getAgent('ops2').ai.apiKeyEnv, 'GEMINI_API_KEY');
  assert.equal(OfficeRuntimeStore.getSelectedAgentId(), 'ops2');
});

test('updateAgent keeps runtime and team config AI settings aligned', function () {
  freshStore();
  OfficeRuntimeStore.updateAgent('gm', {
    ai: {
      provider: 'deepseek',
      model: 'deepseek-reasoner',
      apiKeyEnv: 'DEEPSEEK_API_KEY'
    }
  });

  assert.equal(OfficeRuntimeStore.getAgent('gm').ai.provider, 'deepseek');
  assert.equal(OfficeRuntimeStore.getTeamConfig().agents[0].ai.model, 'deepseek-reasoner');
});

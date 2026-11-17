import test from 'node:test';
import assert from 'node:assert/strict';
import { readTvWidgetState, buildTvStatusItems, classifyForeground } from '../src/widget-tv.js';

const deviceWith = (features) => ({
  name: 'Salon',
  external_id: 'ext:lg:tv:1',
  features: features.map((f) => ({ external_id: `ext:lg:tv:1:${f.key}`, ...f })),
});

test('reads volume, mute and maps the source id to its label', () => {
  const device = deviceWith([
    { key: 'volume', last_value: 12 },
    { key: 'volume-mute', last_value: 1 },
    { key: 'current-app', last_value_string: 'Netflix' },
    {
      key: 'source',
      last_value_string: 'HDMI_1',
      supported_options: [{ value: 'HDMI_1', label: 'Lecteur Blu-ray' }],
    },
  ]);

  const state = readTvWidgetState(device);

  assert.equal(state.tvName, 'Salon');
  assert.equal(state.volume, 12);
  assert.equal(state.muted, true);
  assert.equal(state.application, 'Netflix');
  assert.equal(state.source, 'Lecteur Blu-ray');
  assert.equal(state.channel, '');
});

test('falls back to the raw source id when no option matches', () => {
  const device = deviceWith([{ key: 'source', last_value_string: 'HDMI_2' }]);

  assert.equal(readTvWidgetState(device).source, 'HDMI_2');
});

test('builds only the status rows that have a value (HDMI: source, no channel)', () => {
  const items = buildTvStatusItems({
    volume: 12,
    muted: false,
    application: 'HDMI 1',
    channel: '',
    source: 'HDMI 1',
  });

  const labels = items.map((item) => item.label.en);
  assert.deepEqual(labels, ['Volume', 'Source', 'App']);
  assert.equal(items[0].value, 12);
});

test('marks a muted volume', () => {
  const [volumeRow] = buildTvStatusItems({ volume: 20, muted: true });
  assert.equal(volumeRow.value, '20 🔇');
});

test('tolerates a missing device', () => {
  const state = readTvWidgetState(undefined);
  assert.equal(state.tvName, 'TV');
  assert.equal(state.volume, undefined);
  assert.deepEqual(buildTvStatusItems(state), []);
});

test('classifies the foreground app into source / channel / application', () => {
  assert.equal(classifyForeground('com.webos.app.hdmi2'), 'source');
  assert.equal(classifyForeground('com.webos.app.externalinput.av1'), 'source');
  assert.equal(classifyForeground('com.webos.app.livetv'), 'channel');
  assert.equal(classifyForeground('netflix'), 'application');
  assert.equal(classifyForeground(''), '');
  assert.equal(classifyForeground(undefined), '');
});

test('puts a green dot only on the active row', () => {
  const items = buildTvStatusItems(
    {
      volume: 12,
      muted: false,
      source: 'Playstation 5',
      channel: '1 - TF1',
      application: 'Netflix',
    },
    'source',
  );

  const byLabel = Object.fromEntries(items.map((item) => [item.label.en, item.color]));
  assert.equal(byLabel.Source, 'success');
  assert.equal(byLabel.Channel, undefined);
  assert.equal(byLabel.App, undefined);
  assert.equal(byLabel.Volume, undefined);
});

test('no active row → no green dot anywhere', () => {
  const items = buildTvStatusItems({ volume: 5, application: 'Netflix' });
  assert.ok(items.every((item) => item.color === undefined));
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readTvWidgetState, buildTvStatusItems } from '../src/widget-tv.js';

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

import { randomUUID } from 'node:crypto';
import { mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createState, replaceScene, goToStep, setCamera } from './state.js';

const HISTORY_LIMIT = 50;
const HISTORY_BYTES = 16 * 1024 * 1024;
export function validateSessionId(id) {
  if (typeof id !== 'string' || !/^[a-zA-Z0-9_-]{1,64}$/.test(id))
    throw new Error('Session ID must be 1–64 letters, numbers, underscores, or hyphens');
  return id;
}

/** Owns isolation and bounded durable history, independently of HTTP and rendering. */
export class SessionStore {
  constructor(directory = null) {
    this.directory = directory;
    this.records = new Map();
    this.queues = new Map();
    this.creating = new Set();
  }

  async initialize() {
    if (this.directory) {
      await mkdir(this.directory, { recursive: true });
      for (const file of await readdir(this.directory)) {
        if (!file.endsWith('.json')) continue;
        const record = JSON.parse(await readFile(join(this.directory, file), 'utf8'));
        validateSessionId(record.session.id);
        // Validate persisted geometry rather than trusting disk content as executable input.
        const restored = replaceScene(createState(), record.state.scene);
        record.state = { ...restored, ...record.state, scene: restored.scene };
        let groupId;
        for (const entry of record.history) {
          if (entry.step < 0 || !groupId) groupId = entry.group_id || randomUUID();
          entry.group_id ||= groupId;
          entry.scene_title ||= entry.scene.title;
        }
        record.currentGroupId ||= groupId;
        this.records.set(record.session.id, record);
      }
    }
    if (!this.records.has('local')) await this.create({ id: 'local', name: 'Local canvas' });
  }

  get(id) {
    validateSessionId(id);
    const record = this.records.get(id);
    if (!record) throw new Error('Unknown session. Create a session first.');
    return record;
  }

  state(id) {
    const record = this.get(id);
    return {
      ...record.state,
      session: record.session,
      history: record.history.map(({ scene, camera, ...summary }) => summary),
      current_history_id: record.currentHistoryId,
    };
  }

  list() {
    return [...this.records.values()].map((record) => ({
      ...record.session,
      title: record.state.scene.title,
      history_count: record.history.length,
    }));
  }

  async save(record) {
    if (!this.directory) return;
    const path = join(this.directory, `${record.session.id}.json`);
    const temporary = `${path}.tmp`;
    await writeFile(temporary, JSON.stringify(record));
    await rename(temporary, path);
  }

  async create({ id = randomUUID(), name = 'Agent canvas' } = {}) {
    validateSessionId(id);
    if (typeof name !== 'string' || !name.trim() || name.length > 120)
      throw new Error('Session name must contain 1–120 characters');
    if (this.records.has(id) || this.creating.has(id))
      throw new Error('Session already exists. Resume it explicitly.');
    const record = {
      session: { id, name, created_at: new Date().toISOString() },
      state: createState(),
      history: [],
      currentHistoryId: null,
    };
    this.creating.add(id);
    try {
      await this.save(record);
      this.records.set(id, record);
      return this.state(id);
    } finally {
      this.creating.delete(id);
    }
  }

  mutate(id, handler, { recordHistory = true, restoreId = null } = {}) {
    const pending = (this.queues.get(id) || Promise.resolve()).then(async () => {
      const previous = this.get(id);
      const state = handler(previous.state, previous);
      const record = { ...previous, state, history: [...previous.history] };
      if (state.scene !== previous.state.scene) record.currentGroupId = randomUUID();
      if (recordHistory && state.scene_revision !== previous.state.scene_revision) {
        const snapshot = state.step < 0 ? state.scene : state.scene.steps[state.step];
        const entry = {
          id: randomUUID(),
          title: snapshot.title,
          at: new Date().toISOString(),
          step: state.step,
          object_count: snapshot.objects.length,
          scene: state.scene,
          camera: state.camera,
          group_id: record.currentGroupId,
          scene_title: state.scene.title,
        };
        record.history.push(entry);
        record.currentHistoryId = entry.id;
        while (
          record.history.length > HISTORY_LIMIT ||
          (record.history.length > 1 &&
            Buffer.byteLength(JSON.stringify(record.history)) > HISTORY_BYTES)
        )
          record.history.shift();
      }
      if (restoreId) {
        record.currentHistoryId = restoreId;
        record.currentGroupId = record.history.find((entry) => entry.id === restoreId).group_id;
      }
      await this.save(record);
      this.records.set(id, record);
      return this.state(id);
    });
    const settled = pending.catch(() => {});
    this.queues.set(id, settled);
    settled.finally(() => {
      if (this.queues.get(id) === settled) this.queues.delete(id);
    });
    return pending;
  }

  restore(id, historyId) {
    return this.mutate(
      id,
      (state, record) => {
        const entry = record.history.find((item) => item.id === historyId);
        if (!entry) throw new Error('Unknown history entry');
        let next = replaceScene(state, entry.scene);
        if (entry.step >= 0) next = goToStep(next, entry.step);
        return setCamera(next, entry.camera);
      },
      { recordHistory: false, restoreId: historyId },
    );
  }
}

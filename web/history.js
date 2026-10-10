/** Compact session-local history; snapshots stay on the server until selected. */
export function createHistory({ button, panel, list, sessionList, sessionLabel, send }) {
  button.onclick = async () => {
    panel.hidden = !panel.hidden;
    button.setAttribute('aria-expanded', String(!panel.hidden));
    if (!panel.hidden) {
      const response = await fetch('/api/sessions');
      const data = await response.json();
      sessionList.replaceChildren();
      for (const session of data.sessions) {
        const link = document.createElement('a');
        link.textContent = session.name;
        link.href = `/?session=${encodeURIComponent(session.id)}`;
        sessionList.append(link);
      }
    }
  };
  function render(state) {
    sessionLabel.textContent = state.session?.name || 'Local canvas';
    button.textContent = `History (${state.history?.length || 0})`;
    list.replaceChildren();
    const entries = state.history || [];
    if (!entries.length) {
      const empty = document.createElement('p');
      empty.textContent = 'Your canvas starts empty. Scenes will appear here as you build.';
      list.append(empty);
    }
    for (const entry of [...entries].reverse()) {
      const item = document.createElement('button');
      item.textContent = entry.title;
      item.dataset.historyId = entry.id;
      item.setAttribute('aria-current', String(entry.id === state.current_history_id));
      item.title = `${new Date(entry.at).toLocaleTimeString()} · ${entry.object_count} objects`;
      item.onclick = async () => {
        item.disabled = true;
        try {
          await send('restore', { id: entry.id });
        } finally {
          item.disabled = false;
        }
      };
      list.append(item);
    }
  }
  return { render };
}

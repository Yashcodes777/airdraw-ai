const updateState = async (patch) => {
  await fetch('/state', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
};

const setActive = (selector, key, value) => {
  document.querySelectorAll(selector).forEach((el) => {
    el.classList.toggle('active', el.dataset[key] === value);
  });
};

document.querySelectorAll('[data-color]').forEach((button) => {
  button.addEventListener('click', async () => {
    const color = button.dataset.color;
    await updateState({ color });
    setActive('[data-color]', 'color', color);
  });
});

document.querySelectorAll('[data-mode]').forEach((button) => {
  button.addEventListener('click', async () => {
    const mode = button.dataset.mode;
    await updateState({ mode });
    setActive('[data-mode]', 'mode', mode);
  });
});

document.getElementById('clear-canvas')?.addEventListener('click', async () => {
  await updateState({ clear: true });
});

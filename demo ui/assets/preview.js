const storage = {
  get(key, fallback = null) {
    try {
      return JSON.parse(localStorage.getItem(`mini-connecta:${key}`)) ?? fallback;
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    localStorage.setItem(`mini-connecta:${key}`, JSON.stringify(value));
  }
};

const page = document.body.dataset.page;
const profile = storage.get('profile');
const signedIn = storage.get('signed-in', false);
const portraits = {
  strawberry: { src: 'assets/strawberry.png', label: 'Strawberry character' },
  matcha: { src: 'assets/matcha.png', label: 'Matcha character' }
};

const byId = (id) => document.getElementById(id);
const go = (url) => window.location.replace(url);
const roomKey = 'mini-connecta:joined-study-room';

const index = 'index.html';
const character = 'login-character.html';
const discover = 'discover.html';

function showNotice(id, text) {
  const notice = byId(id);
  notice.textContent = text;
  notice.hidden = !text;
}

function setPending(button, pending, busy, ready) {
  button.disabled = pending;
  button.textContent = pending ? busy : ready;
}

function scenario() {
  const selector = byId('preview-scenario');
  const value = selector.value;
  selector.value = '';
  return value;
}

const systemTheme = matchMedia('(prefers-color-scheme: dark)');
const themeSelect = byId('preview-theme');
function applyTheme() {
  const selected = themeSelect.value;
  document.documentElement.dataset.theme =
    selected === 'system' ? (systemTheme.matches ? 'dark' : 'light') : selected;
}
const defaultTheme = page === 'discover' || page === 'room' ? 'dark' : 'system';
themeSelect.value = storage.get('theme', defaultTheme);
applyTheme();
systemTheme.addEventListener('change', applyTheme);
themeSelect.addEventListener('change', () => {
  applyTheme();
  try {
    storage.set('theme', themeSelect.value);
  } catch {
    // The current preview can still change themes without persistent storage.
  }
});

function signInPage() {
  const button = byId('sign-in');
  const label = button.querySelector('span');
  const cancel = byId('cancel-sign-in');
  let timer;

  function finish(message) {
    clearTimeout(timer);
    button.disabled = false;
    label.textContent = 'Continue with Google';
    cancel.hidden = true;
    showNotice('auth-error', message);
    button.focus();
  }

  cancel.addEventListener('click', () => finish('Sign-in cancelled. Continue with Google to try again.'));
  button.addEventListener('click', () => {
    const example = scenario();
    showNotice('auth-error', '');
    button.disabled = true;
    cancel.hidden = false;
    label.textContent = 'Signing in…';
    timer = setTimeout(() => {
      if (example === 'auth-cancel') {
        finish('Sign-in cancelled. Continue with Google to try again.');
        return;
      }
      if (example === 'auth-error') {
        finish('Sign-in failed. Continue with Google to try again.');
        return;
      }
      try {
        storage.set('signed-in', true);
        go(profile ? discover : character);
      } catch {
        finish('Allow browser storage and try signing in again.');
      }
    }, 700);
  });
}

function characterPage() {
  const form = byId('character-form');
  const displayName = byId('display-name');
  const saveButton = byId('save-character');
  const art = byId('character-art');

  form.addEventListener('change', () => {
    const portrait = portraits[form.elements.preset.value];
    art.src = portrait.src;
    art.alt = portrait.label;
  });
  displayName.addEventListener('input', () => {
    displayName.removeAttribute('aria-invalid');
    showNotice('save-error', '');
  });
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const name = displayName.value.trim();
    if (!name) {
      displayName.setAttribute('aria-invalid', 'true');
      showNotice('save-error', 'Enter a display name before continuing.');
      displayName.focus();
      return;
    }

    const preset = form.elements.preset.value;
    const example = scenario();
    showNotice('save-error', '');
    setPending(saveButton, true, 'Saving…', 'Save & continue');
    setTimeout(() => {
      try {
        if (example === 'save-error') {
          showNotice('save-error', 'Your character couldn’t be saved. Try saving again.');
        } else {
          storage.set('profile', { name, preset });
          go(discover);
          return;
        }
      } catch {
        showNotice('save-error', 'Allow browser storage and try saving again.');
      }
      setPending(saveButton, false, 'Saving…', 'Save & continue');
      saveButton.focus();
    }, 450);
  });
}

function discoverPage() {
  byId('account-name').textContent = profile.name;
  byId('account-avatar').src = portraits[profile.preset].src;

  byId('sign-out').addEventListener('click', () => {
    storage.set('signed-in', false);
    sessionStorage.removeItem(roomKey);
    go(index);
  });

  const search = byId('open-room-search');
  search.addEventListener('input', () => {
    byId('open-rooms-status').textContent = search.value.trim()
      ? 'No open rooms match your search.'
      : 'No open rooms yet.';
  });

  const join = byId('join-room');
  join.addEventListener('click', () => {
    const example = scenario();
    showNotice('join-error', '');
    setPending(join, true, 'Joining…', 'Walk in');
    setTimeout(() => {
      if (example === 'room-full' || example === 'join-error') {
        showNotice(
          'join-error',
          example === 'room-full'
            ? 'Study Room is full. Wait for a spot to open, then try again.'
            : 'Couldn’t connect to the Study Room. Try joining again.'
        );
        setPending(join, false, 'Joining…', 'Walk in');
        join.focus();
        return;
      }
      sessionStorage.setItem(roomKey, 'true');
      go('walk-library.html');
    }, 650);
  });
}

function roomPage() {
  const selfAvatar = byId('room-avatar-self');
  selfAvatar.textContent = Array.from(profile.name)[0].toLocaleUpperCase();
  selfAvatar.title = profile.name + ' (you)';

  const mic = byId('toggle-mic');
  const reconnect = byId('reconnect-panel');
  const retry = byId('retry-room');
  let micOn = false;
  let disconnectTimer;

  function setMic(on, status = on ? 'Mic on' : 'Mic off') {
    micOn = on;
    mic.setAttribute('aria-pressed', String(on));
    mic.querySelector('[data-mic-on]').toggleAttribute('hidden', !on);
    mic.querySelector('[data-mic-off]').toggleAttribute('hidden', on);
    byId('mic-label').textContent = on ? 'Turn mic off' : 'Turn mic on';
    byId('voice-status').textContent = status;
  }

  function disconnect() {
    clearTimeout(disconnectTimer);
    setMic(false, 'Room disconnected');
    mic.disabled = true;
    showNotice('voice-error', '');
    reconnect.hidden = false;
    retry.focus();
  }

  setMic(false);
  byId('leave-room').addEventListener('click', () => {
    sessionStorage.removeItem(roomKey);
    go(discover);
  });

  byId('simulate-disconnect').addEventListener('click', () => {
    document.querySelector('.preview-controls').open = false;
    disconnect();
  });

  retry.addEventListener('click', () => {
    setPending(retry, true, 'Reconnecting…', 'Reconnect');
    byId('reconnect-detail').textContent = 'Connecting to the Study Room.';
    disconnectTimer = setTimeout(() => {
      reconnect.hidden = true;
      mic.disabled = false;
      setMic(false);
      setPending(retry, false, 'Reconnecting…', 'Reconnect');
      byId('reconnect-detail').textContent = 'Try again to return to the Study Room.';
      mic.focus();
    }, 700);
  });

  mic.addEventListener('click', () => {
    showNotice('voice-error', '');
    if (micOn) {
      setMic(false);
      return;
    }

    const example = scenario();
    if (example === 'mic-denied') {
      setMic(false, 'Mic blocked');
      showNotice('voice-error', 'Microphone access is blocked. Allow it in site settings, then try again.');
    } else if (example === 'voice-error') {
      setMic(false, 'Voice unavailable');
      showNotice('voice-error', 'Voice couldn’t connect. You can stay in the room and try the mic again.');
    } else {
      setMic(true);
    }
  });
}

if (!signedIn && page !== 'signIn') {
  go(index);
} else if (signedIn && page === 'signIn') {
  go(profile ? discover : character);
} else if (signedIn && !profile && (page === 'discover' || page === 'room')) {
  go(character);
} else if (profile && page === 'character') {
  go(discover);
} else if (page === 'room' && !sessionStorage.getItem(roomKey)) {
  go(discover);
} else {
  const pages = { signIn: signInPage, character: characterPage, discover: discoverPage, room: roomPage };
  pages[page]();
}

// ---------------------------------------------------------------------------------------------- //
// UPDATER
// ---------------------------------------------------------------------------------------------- //

(async () => {
  const VERSION_KEY = 'current-version';
  const PRECACHE = 'precache-v1';

  let github;
  try {
    // TODO: cache and check every 30m
    const req = await window.fetch('github.json', { cache: 'no-cache' });
    github = await req.json();
  } catch (e) {
    console.warn('Failed to check for update', e);
    return;
  }

  // We are up to date!
  if (github.version === window.localStorage.getItem(VERSION_KEY)) return;

  // We're not... delete the old
  await window.caches.delete(PRECACHE);
  window.localStorage.setItem(VERSION_KEY, github.version);

  const sw = window.navigator.serviceWorker;
  if (!sw || !sw.controller) return;

  sw.addEventListener('message', (event) => {
    if (event.data && event.data.action === 'CACHE_CLEARED') {
      document.querySelector('.update').classList.add('active');
    }
  });

  // And update!
  sw.controller.postMessage({ action: 'CLEAR_CACHE' });
})();

// ---------------------------------------------------------------------------------------------- //
// BACKGROUND
// ---------------------------------------------------------------------------------------------- //

(async () => {
  const PERIOD = 88500;
  const CYCLE = 60000;

  const background = document.querySelector('.background');

  const gradient = hue => `radial-gradient(ellipse at center -60px, ${[
    `hsl(${hue}, 35%, 50%)`, `hsl(${hue}, 80%, 20%)`,
  ].join(', ')})`;

  let opaqueLayer = null;

  (function render() {
    const from = Date.now() - (Date.now() % CYCLE);
    const to = from + CYCLE;
    const progress = (Date.now() % CYCLE) / CYCLE;

    const fromColor = ((from % PERIOD) * 360 / PERIOD).toFixed();
    const toColor = ((to % PERIOD) * 360 / PERIOD).toFixed();

    if (!opaqueLayer) {
      opaqueLayer = document.createElement('div');
      opaqueLayer.classList.add('bg');
      opaqueLayer.style.opacity = 1;
      opaqueLayer.style.background = gradient(fromColor);
      background.appendChild(opaqueLayer);
    }

    const bg = document.createElement('div');
    bg.classList.add('bg');
    bg.style.opacity = progress;
    bg.style.background = gradient(toColor);
    background.appendChild(bg);

    setTimeout(() => {
      bg.style.opacity = 1;
      bg.style.transitionDuration = `${to - Date.now()}ms`;
      bg.addEventListener('transitionend', () => {
      // FIXME: sometimes this event seems to be never fired
        render();
        opaqueLayer.remove();
        opaqueLayer = bg;
      });
    });
  }());
})();

// ---------------------------------------------------------------------------------------------- //
// PARTICLES
// ---------------------------------------------------------------------------------------------- //

(async () => {
  const particles = document.querySelector('.particles');
  const WEIGHT = [2, 12];
  const OPACITY = [0.01, 0.4];

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) particles.innerHTML = '';
  });

  setInterval(() => {
    if (document.hidden) return;

    const weight = WEIGHT[0] + Math.random() * (WEIGHT[1] - WEIGHT[0]);

    const particle = document.createElement('div');
    particle.classList.add('particle');
    const position = Math.random > 0.75 ? Math.random() : Math.random() * 0.8 + 0.1;
    particle.style.left = `${(position * 100).toFixed(2)}%`;

    const size = `${Math.round(weight)}px`;
    particle.style.width = size;
    particle.style.height = size;
    particle.style.transitionDuration = `${(10 + weight * 10).toFixed(2)}s`;
    particle.style.opacity = (
      OPACITY[0]
      + (WEIGHT[1] - weight) / WEIGHT[1] * (OPACITY[1] - OPACITY[0])
    ).toFixed(2);

    particle.addEventListener('transitionend', () => {
      particle.remove();
    });

    setTimeout(() => {
      particle.style.transform = `translateY(${-WEIGHT[1]}px) translateZ(0)`;
    }, 50);

    particles.appendChild(particle);
  }, 5000);
})();

// ---------------------------------------------------------------------------------------------- //
// CLOCK & DATE
// ---------------------------------------------------------------------------------------------- //

(async () => {
  // To render the date only once per day
  let currentDate = -1;

  const clock = document.querySelector('.clock');

  // Render the clock digits
  const render = (onlySecond = false) => {
    [...(onlySecond ? [] : ['Hours', 'Minutes']), 'Seconds'].forEach((x) => {
      const text = new Date()[`get${x}`]().toString().padStart(2, '0');
      clock.querySelector(`.${x.toLowerCase()}`).textContent = text;
    });
    const hours = new Date().getHours();
    let text;
    if (hours >= 5 && hours < 12) text = 'Good morning';
    else if (hours >= 12 && hours < 18) text = 'Good afternoon';
    else text = 'Good evening';
    document.querySelector('.welcome-text').textContent = text;

    if (!onlySecond) {
      if (new Date().getDate() === currentDate) return;
      currentDate = new Date().getDate();
      document.querySelector('.calendar').textContent = new Date()
        .toLocaleString('default', { weekday: 'long', month: 'long', day: 'numeric' });
    }
  };

  // Keep it sync with real time
  const renderEveryMinute = () => {
    render(false);
    const nextMinute = new Date().setSeconds(60, 0) - Date.now();
    // Big timeout can be unprecise, so we will adjust to the millisecond one second before
    setTimeout(renderEveryMinute, nextMinute > 1500 ? nextMinute - 1000 : nextMinute);
  };

  renderEveryMinute();
  window.addEventListener('focus', render);

  // Show seconds on hover
  let renderNextSecond = false;
  const renderEverySecond = () => {
    // Render again, even if renderNextSecond = false, as mouse may leave few millis before rerender
    // So we want to update second during it's transition to opacity = 0
    render(true);
    if (!renderNextSecond) return;
    setTimeout(renderEverySecond, 1000 - (new Date().getTime() % 1000));
  };

  clock.addEventListener('mouseenter', () => {
    renderNextSecond = true;
    renderEverySecond();
  });

  clock.addEventListener('mouseleave', () => {
    renderNextSecond = false;
  });

  // And some milliseconds stuff
  let shouldRenderMilliseconds = false;
  let stopRenderingTimeout = null;

  const millis = clock.querySelector('.milliseconds');
  const renderMilliseconds = () => {
    if (!shouldRenderMilliseconds) return;
    window.requestAnimationFrame(renderMilliseconds);
    millis.textContent = (Date.now() % 1000).toString().padStart(3, '0');
  };

  clock.querySelector('.show-seconds').addEventListener('mouseenter', () => {
    clearTimeout(stopRenderingTimeout);
    if (shouldRenderMilliseconds) return;
    shouldRenderMilliseconds = true;
    renderMilliseconds();
  });

  clock.querySelector('.show-seconds').addEventListener('mouseleave', () => {
    stopRenderingTimeout = setTimeout(() => {
      shouldRenderMilliseconds = false;
    }, 200);
  });
})();

// ---------------------------------------------------------------------------------------------- //
// SEARCH
// ---------------------------------------------------------------------------------------------- //

(async () => {
  const search = document.querySelector('.search');
  const input = search.querySelector('.search-input');
  const form = search.querySelector('.search-form');
  const suggestions = search.querySelector('.search-suggestions');

  const URL_WITH_PROTOCOL = /^https?:\/\/\S+$/;
  const LOOKS_LIKE_URL = /^\S+\.\S{2,}\/\S*$/;

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Meta') form.target = '_blank';
    if (e.key === 'Enter') form.submit();
  });

  window.addEventListener('keyup', (e) => {
    if (e.key === 'Meta') form.target = '';
  });

  input.addEventListener('focus', () => {
    search.classList.add('active');
  });

  document.addEventListener('click', (e) => {
    if (!search.contains(e.target)) {
      search.classList.remove('active');
    }
  });

  window.addEventListener('pageshow', (e) => {
    if (!e.persisted) return;
    // Loaded from cache, so form is no longer submitted
    search.classList.remove('submitted-from-suggestion');
    search.classList.remove('submitted-from-input');
  });

  form.addEventListener('submit', (e) => {
    const link = suggestions.querySelector('a.search-suggestion.active');
    if (link) {
      // Follow selected suggestion
      e.preventDefault();
      link.click();
      search.classList.add('submitted-from-suggestion');
      return;
    }

    search.classList.add('submitted-from-input');

    if ([URL_WITH_PROTOCOL, LOOKS_LIKE_URL].some(re => re.test(input.value))) {
      // Go to link directly
      e.preventDefault();
      window.location = URL_WITH_PROTOCOL.test(input.value) ? input.value : `http://${input.value}`;
    }
  });

  let cleanup = null;

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      input.blur();
      search.classList.remove('active');
      cleanup = setTimeout(() => {
        // Clear input when it's hidden
        input.value = '';
        cleanup = null;
      }, 150);
    }
  });

  document.addEventListener('paste', () => {
    // Will paste directly in the search input
    input.focus();
  });

  document.addEventListener('keydown', (e) => {
    if (cleanup && e.key !== 'Escape') {
      // If we press "Escape" then another key, clean input now (before keyup)
      clearTimeout(cleanup);
      input.value = '';
      cleanup = null;
    }
    // As length of `A` `É` = 1, and `Meta` `ShiftLeft` > 1
    if (document.activeElement !== input && e.key.length === 1) {
      // But ignore special action
      if (e.metaKey) return;
      input.focus();
    }
  });

  // Autocomplete
  const cacheIcons = {};
  const addFavicon = (container, url) => {
    // This whole thing is about adding favicon right next to the line
    const a = document.createElement('a');
    a.href = url;
    const { hostname } = a;
    if (!hostname) {
      container.classList.add('fallback-icon');
      return;
    }
    // HTTP cache will still take some ms and flicker each time we type a letter
    // So let's cache some DOM
    if (!cacheIcons[hostname]) {
      const img = document.createElement('img');
      img.classList.add('suggest-icon');
      img.src = `https://www.google.com/s2/favicons?sz=64&domain=${hostname}`;
      const cacheIcon = { img, failed: false, clones: [] };
      cacheIcons[hostname] = cacheIcon;
      img.addEventListener('error', () => {
        cacheIcon.failed = true;
        cacheIcon.clones.forEach((clone) => {
          clone.parentNode.classList.add('fallback-icon');
          clone.remove();
        });
      });
    }
    const cacheIcon = cacheIcons[hostname];
    if (cacheIcon.failed) {
      container.classList.add('fallback-icon');
    } else {
      const clone = cacheIcon.img.cloneNode();
      cacheIcon.clones.push(clone);
      container.appendChild(clone);
    }
  };

  let suggestionsData = [];
  let latestDataRendered = [null, null];
  const refreshSuggestions = () => {
    // No change, no render
    if (input.value === latestDataRendered[0] && suggestionsData === latestDataRendered[1]) return;
    latestDataRendered = [input.value, suggestionsData];

    // No input or no suggestion => hide this stuff
    if (input.value.length === 0 || !suggestionsData[1] || !suggestionsData[1].length) {
      search.classList.remove('with-suggestions');
      return;
    }

    // Now let's work
    const suggestionsRows = suggestionsData[1].map((_, ix) => ({
      text: suggestionsData[1][ix],
      title: suggestionsData[2][ix],
      type: suggestionsData[4]['google:suggesttype'][ix],
    }));

    const suggestLines = suggestionsRows.map((suggestion) => {
      const a = document.createElement('a');
      a.classList.add('search-suggestion');
      const div = document.createElement('div');
      div.classList.add('suggestion-inner');
      a.appendChild(div);

      const isLink = suggestion.type === 'NAVIGATION';
      const separator = isLink ? '.' : ' ';
      const suggestLine = isLink
        ? suggestion.text.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')
        : suggestion.text;

      // This needs to be re-generated for each suggestion (see REF_INPUT_WORDS)
      const inputWords = input.value.toLowerCase().split(isLink ? /[ .]/ : ' ');
      const nodes = suggestLine.split(separator)
        .map((suggestWord, ix, all) => {
          const prefix = (first, last) => {
            let index = 0;
            while (index < first.length && first[index] === last[index]) index += 1;
            return index;
          };

          const len = inputWords
            .reduce((max, inputWord) => Math.max(max, prefix(inputWord, suggestWord)), 0);

          // Common prefix = normal font
          const span = document.createElement('span');
          span.textContent = suggestWord.slice(0, len);

          // Completion = bold font
          const b = document.createElement('b');
          b.textContent = `${suggestWord.slice(len)}${ix < all.length - 1 ? separator : ''}`;

          if (suggestWord.length === len) {
            // [REF_INPUT_WORDS] Full match! Can't be used for next completions
            inputWords.splice(inputWords.indexOf(suggestWord), 1);
          }

          return [span, b];
        })
        .filter(Boolean)
        .reduce((x, y) => ([...x, ...y]), []);

      if (isLink) {
        a.href = suggestion.text;
        a.classList.add('suggest-navigation');
        addFavicon(a, a.href);
      } else {
        a.href = '#';
        a.classList.add('suggest-query');
        a.addEventListener('click', (e) => {
          e.preventDefault();
          input.value = suggestion.text;
          input.focus();
        });
      }

      nodes.forEach(node => div.appendChild(node));

      return a;
    });

    // Clear previous suggestions
    [...suggestions.children].forEach(node => node.remove());

    // Then add new ones
    suggestLines.forEach(node => suggestions.appendChild(node));

    // And show them to the world
    search.classList.add('with-suggestions');
  };

  let latest = -1;
  const cacheSuggestions = {};
  const askSuggestions = (text) => {
    // Too long text = too precise to be suggested
    if (text.length === 0 || text.length > 32) {
      suggestionsData = [];
      refreshSuggestions();
      return;
    }

    // We may have it in cache already
    if (cacheSuggestions[text]) {
      suggestionsData = cacheSuggestions[text];
      refreshSuggestions();
      return;
    }

    // Let's call Google
    const script = document.createElement('script');
    const q = encodeURIComponent(text);
    const now = Date.now();
    const callback = `_${Math.random().toString(36).slice(2)}_${now}`;
    script.src = `https://www.google.com/complete/search?client=chrome&callback=${callback}&q=${q}`;
    document.body.appendChild(script);
    // And handle response
    window[callback] = (args) => {
      script.remove();
      cacheSuggestions[text] = args;
      if (now < latest) return; // Already outdated
      latest = now;
      suggestionsData = args;
      refreshSuggestions();
    };
  };

  const updateSearchIcon = (value) => {
    const isLink = [URL_WITH_PROTOCOL, LOOKS_LIKE_URL].some(re => re.test(value));

    const wrapper = document.querySelector('.search-input-wrapper');
    wrapper.classList.toggle('has-icon', isLink);
    wrapper.classList.remove('fallback-icon');
    [...wrapper.querySelectorAll('.suggest-icon')].forEach(x => x.remove());

    if (isLink) {
      addFavicon(wrapper, URL_WITH_PROTOCOL.test(value) ? value : `http://${value}`);
    }
  };

  let lastValue = '';
  const inputChanged = () => {
    setTimeout(() => {
      if (lastValue === input.value) return;
      lastValue = input.value;
      askSuggestions(lastValue.toLowerCase());
      // Immediate feedback
      refreshSuggestions();
      // Show whether we gonna search or open that link
      updateSearchIcon(lastValue);
    });
  };

  input.addEventListener('keypress', (e) => {
    // Exclude Enter key, we don't want to change suggestions when submitting
    if (e.key !== 'Enter' && !e.metaKey && !e.ctrlKey) inputChanged();
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Backspace') inputChanged();
  });

  input.addEventListener('mousedown', inputChanged);

  input.addEventListener('cut', inputChanged);

  // As paste won't trigger input.change or such
  document.addEventListener('paste', inputChanged);

  window.addEventListener('pageshow', (e) => {
    if (!e.persisted) return;
    // Loaded from cache, so input may be empty now
    inputChanged();
  });

  // We can choose autocomplete suggestion using arrows
  const unactive = () => {
    const selected = suggestions.querySelector('.search-suggestion.active');
    if (selected) selected.classList.remove('active');
    return selected;
  };

  let selected = -1;
  document.addEventListener('keydown', (e) => {
    let move = 0;
    if (e.key === 'ArrowUp') move = -1;
    if (e.key === 'ArrowDown') move = +1;
    if (!move) return;

    // We can go back to input, so it is selectable
    const selectables = [
      input,
      ...suggestions.querySelectorAll('.search-suggestion'),
    ];

    selected = unactive() || input;
    selected = selectables.indexOf(selected);
    if (selected === -1) selected = 0;

    const toSelect = selectables[(selectables.length + selected + move) % selectables.length];
    if (toSelect.classList.contains('search-suggestion')) {
      toSelect.classList.add('active');
      input.value = toSelect.textContent;
    } else {
      input.value = lastValue;
    }
    e.preventDefault();

    updateSearchIcon(toSelect.classList.contains('suggest-navigation')
      ? toSelect.href
      : input.value);
  });

  suggestions.addEventListener('mouseout', unactive);

  suggestions.addEventListener('mouseover', (e) => {
    const toSelect = [...suggestions.querySelectorAll('.search-suggestion')]
      .find(s => s.contains(e.target));
    if (!toSelect) return;
    unactive();
    toSelect.classList.add('active');
  });
})();

// ---------------------------------------------------------------------------------------------- //
// WEATHER
// ---------------------------------------------------------------------------------------------- //

(async () => {
  const weather = document.querySelector('.weather');
  const storageKey = 'weather-forecast';

  let forecast = window.localStorage.getItem(storageKey);
  if (forecast) {
    forecast = JSON.parse(forecast);
    if (forecast.expire < Date.now()) forecast = null;
    else ({ forecast } = forecast);
  }

  if (!forecast) {
    // TODO: handle errors
    forecast = (await (await window.fetch('https://wttr.in/?format=%l|%c|%t')).text())
      .split('|');
    window.localStorage.setItem(storageKey, JSON.stringify({
      forecast,
      expire: Date.now() + 15 * 60 * 1000,
    }));
  }

  weather.textContent = [
    forecast[1],
    forecast[2].replace(/(^\+|C$)/g, ''),
    '–',
    forecast[0].split(',')[0],
  ].join(' ');
})();

// ---------------------------------------------------------------------------------------------- //
// QUOTE
// ---------------------------------------------------------------------------------------------- //

(async () => {
  const quote = document.querySelector('.quote');
  const quoteText = quote.querySelector('.text');
  const quoteAuthor = quote.querySelector('.author');
  const storageKey = 'quote-of-the-day';

  let qotd = window.localStorage.getItem(storageKey);
  if (qotd) {
    qotd = JSON.parse(qotd);
    if (qotd.expire < Date.now()) qotd = null;
    else ({ qotd } = qotd);
  }

  if (!qotd) {
    // TODO: handle errors
    qotd = (await (
      await window.fetch('https://raw.githubusercontent.com/dwyl/quotes/master/quotes.json')
    ).json());
    qotd = qotd.filter(({ text, author }) => author && text.length < 90);
    qotd = qotd[Math.floor(qotd.length * Math.random())];
    window.localStorage.setItem(storageKey, JSON.stringify({
      qotd,
      expire: Date.now() + 12 * 3600 * 1000,
    }));
  }

  quoteText.textContent = /\w$/.test(qotd.text) ? `${qotd.text}.` : qotd.text;
  quoteAuthor.textContent = qotd.author;
})();

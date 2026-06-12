(function () {
  const config = window.MVP_CONFIG || {};
  const sessionEvents = [];

  function $(selector, root = document) {
    return root.querySelector(selector);
  }

  function $all(selector, root = document) {
    return Array.from(root.querySelectorAll(selector));
  }

  function setText(selector, value) {
    const node = $(selector);
    if (node && value) node.textContent = value;
  }

  function track(eventName, payload = {}) {
    const event = {
      eventName,
      productSlug: config.slug || 'mvp-template',
      path: window.location.pathname,
      referrer: document.referrer,
      payload,
      createdAt: new Date().toISOString()
    };
    sessionEvents.unshift(event);
    renderEvents();
    updateAnalyticsCount();
    return fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event)
    }).catch(() => undefined);
  }

  function updateAnalyticsCount() {
    setText('[data-analytics-count]', String(sessionEvents.length));
  }

  function renderEvents() {
    const table = $('[data-event-table]');
    if (!table) return;
    const rows = sessionEvents.slice(0, 8);
    table.innerHTML = rows.map(event => `
      <div class="event-row">
        <strong>${event.eventName}</strong>
        <span>${event.payload?.label || event.payload?.email || 'Recorded interaction'}</span>
        <span>${new Date(event.createdAt).toLocaleTimeString()}</span>
      </div>
    `).join('');
  }

  function renderActivityLog(score) {
    const items = [
      'User submitted a new idea',
      `Signal score calculated: ${score}`,
      'Top themes extracted',
      'Added to early signals board'
    ];
    const log = $('[data-activity-log]');
    if (!log) return;
    log.innerHTML = items.map(item => `<li>${item}</li>`).join('');
  }

  function renderDemo(output = config.demo?.defaultOutput) {
    const safeOutput = output || { summary: '', signals: [], score: 0 };
    setText('[data-demo-summary]', safeOutput.summary);
    setText('[data-demo-score]', String(safeOutput.score));
    const list = $('[data-demo-signals]');
    if (list) list.innerHTML = (safeOutput.signals || []).map(signal => `<li>${signal}</li>`).join('');
    const json = $('[data-demo-json]');
    if (json) json.textContent = JSON.stringify(safeOutput, null, 2);
    renderActivityLog(safeOutput.score);
  }

  function analyzeText(value) {
    const text = value.trim();
    const lengthBonus = Math.min(20, Math.round(text.length / 12));
    const problemWords = ['manual', 'slow', 'expensive', 'hard', 'pain', 'waste', 'confusing', 'repeat', 'cost'];
    const score = Math.min(98, 58 + lengthBonus + problemWords.filter(word => text.toLowerCase().includes(word)).length * 5);
    const summary = text
      ? `Users describe a concrete problem: "${text.slice(0, 120)}${text.length > 120 ? '...' : ''}"`
      : config.demo.defaultOutput.summary;
    return {
      summary,
      signals: [
        'Problem is specific enough to test',
        'Can be validated with a landing page',
        'Next step: ask for email or interview'
      ],
      score
    };
  }

  function bindDemo() {
    const run = $('[data-demo-run]');
    const input = $('[data-demo-input]');
    const secondaryRun = $('[data-demo-run-secondary]');
    const secondaryInput = $('[data-demo-input-secondary]');

    run?.addEventListener('click', () => {
      const output = analyzeText(input?.value || '');
      renderDemo(output);
      track('demo_run', { label: 'Hero demo', score: output.score });
    });

    secondaryRun?.addEventListener('click', () => {
      const output = analyzeText(secondaryInput?.value || '');
      renderDemo(output);
      track('demo_run', { label: 'Section demo', score: output.score });
    });
  }

  function bindWaitlist() {
    $all('[data-waitlist-form]').forEach(form => {
      form.addEventListener('submit', async event => {
        event.preventDefault();
        const formData = new FormData(form);
        const email = String(formData.get('email') || '').trim();
        const message = $('[data-form-message]');
        if (!email) return;
        const payload = {
          email,
          productSlug: config.slug || 'mvp-template',
          sourcePath: window.location.pathname,
          referrer: document.referrer,
          createdAt: new Date().toISOString()
        };

        try {
          const response = await fetch('/api/waitlist', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          if (!response.ok) throw new Error('Request failed');
          form.reset();
          if (message) message.textContent = 'You are on the waitlist. Thank you.';
          track('waitlist_submit', { email });
        } catch (error) {
          if (message) message.textContent = 'Could not submit right now. Please try again.';
        }
      });
    });
  }

  function bindClicks() {
    $all('[data-track-click]').forEach(node => {
      node.addEventListener('click', () => {
        track('cta_click', { label: node.getAttribute('data-track-click') });
      });
    });
  }

  function renderConfig() {
    document.title = `${config.productName || 'MVP'} - validation page`;
    setText('[data-product-name]', config.productName);
    setText('[data-headline]', config.headline);
    setText('[data-pain]', config.pain);
    setText('[data-solution]', config.solution);
    setText('[data-cta-helper]', config.cta?.helper);
    setText('[data-cta-helper-final]', config.cta?.helper);
    const input = $('[data-demo-input]');
    if (input && config.demo?.inputPlaceholder) input.placeholder = config.demo.inputPlaceholder;

    const users = $('[data-target-users]');
    if (users) {
      users.innerHTML = (config.targetUsers || []).map((user, index) => `
        <article class="user-card">
          <div class="icon" aria-hidden="true">${['○', '◎', '△'][index % 3]}</div>
          <h3>${user.title}</h3>
          <p>${user.body}</p>
        </article>
      `).join('');
    }

    const values = $('[data-core-values]');
    if (values) {
      values.innerHTML = (config.coreValues || []).map(value => `<li>${value}</li>`).join('');
    }
  }

  renderConfig();
  renderDemo();
  bindDemo();
  bindWaitlist();
  bindClicks();
  track('page_view');
})();

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
    sendPostHogEvent(eventName, event);
    return fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event)
    }).catch(() => undefined);
  }

  function sendPostHogEvent(eventName, event) {
    if (window.posthog && typeof window.posthog.capture === 'function') {
      window.posthog.capture(eventName, event);
    }
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
        <span>${event.payload?.label || event.payload?.email || '已记录一次互动'}</span>
        <span>${new Date(event.createdAt).toLocaleTimeString()}</span>
      </div>
    `).join('');
  }

  function renderActivityLog(score) {
    const items = [
      '用户提交了一个新问题',
      `已计算信号评分：${score}`,
      '已提取关键信号',
      '已加入早期验证看板'
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
    const problemWords = ['手动', '慢', '贵', '困难', '痛点', '浪费', '混乱', '重复', '成本', 'manual', 'slow', 'expensive', 'hard', 'pain', 'waste', 'confusing', 'repeat', 'cost'];
    const score = Math.min(98, 58 + lengthBonus + problemWords.filter(word => text.toLowerCase().includes(word)).length * 5);
    const summary = text
      ? `用户描述了一个具体问题：“${text.slice(0, 120)}${text.length > 120 ? '...' : ''}”`
      : config.demo.defaultOutput.summary;
    return {
      summary,
      signals: [
        '问题足够具体，可以测试',
        '可以先用落地页验证需求',
        '下一步：收集邮箱或约访谈'
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
      track('demo_run', { label: '首屏演示', score: output.score });
    });

    secondaryRun?.addEventListener('click', () => {
      const output = analyzeText(secondaryInput?.value || '');
      renderDemo(output);
      track('demo_run', { label: '功能区演示', score: output.score });
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
          if (!response.ok) throw new Error('提交失败');
          form.reset();
          if (message) message.textContent = '已加入等候名单，谢谢。';
          track('waitlist_submit', { email });
        } catch (error) {
          if (message) message.textContent = '暂时无法提交，请稍后再试。';
        }
      });
    });
  }

  function bindFeedback() {
    const form = $('[data-feedback-form]');
    if (!form) return;

    form.addEventListener('submit', async event => {
      event.preventDefault();
      const formData = new FormData(form);
      const payload = {
        rating: Number(formData.get('rating') || 0),
        message: String(formData.get('message') || '').trim(),
        email: String(formData.get('email') || '').trim(),
        productSlug: config.slug || 'mvp-template',
        sourcePath: window.location.pathname,
        referrer: document.referrer,
        createdAt: new Date().toISOString()
      };
      const message = $('[data-feedback-message]');
      if (!payload.message) return;

      try {
        const response = await fetch('/api/feedback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (!response.ok) throw new Error('反馈提交失败');
        form.reset();
        if (message) message.textContent = '反馈已记录，谢谢。';
        track('feedback_submit', { rating: payload.rating, label: '用户反馈' });
      } catch (error) {
        if (message) message.textContent = '暂时无法提交反馈，请稍后再试。';
      }
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
    document.title = `${config.productName || 'MVP'} - 产品验证页`;
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
          <div class="icon" aria-hidden="true">${index + 1}</div>
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
  bindFeedback();
  bindClicks();
  track('page_view');
})();

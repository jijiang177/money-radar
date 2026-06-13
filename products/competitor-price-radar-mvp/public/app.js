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
    table.innerHTML = sessionEvents.slice(0, 8).map(event => `
      <div class="event-row">
        <strong>${event.eventName}</strong>
        <span>${event.payload?.label || event.payload?.email || '已记录一次互动'}</span>
        <span>${new Date(event.createdAt).toLocaleTimeString()}</span>
      </div>
    `).join('');
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

  function renderActivityLog(score) {
    const items = [
      '已读取竞品 URL 或用户描述',
      `已生成机会强度评分：${score}`,
      '已提取价格、套餐、功能变化信号',
      '下一步：收集邮箱，验证是否有人愿意持续使用'
    ];
    const log = $('[data-activity-log]');
    if (log) log.innerHTML = items.map(item => `<li>${item}</li>`).join('');
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
    const lower = text.toLowerCase();
    const urlCount = (text.match(/https?:\/\/[^\s，,]+/g) || []).length;
    const signalWords = ['price', 'pricing', 'plan', 'competitor', 'saas', '功能', '价格', '套餐', '竞品', '手动', '每周', '监控', '变化'];
    const signalScore = signalWords.filter(word => lower.includes(word.toLowerCase())).length * 4;
    const score = Math.min(98, 62 + Math.min(16, urlCount * 6) + signalScore + Math.min(12, Math.round(text.length / 30)));

    if (!text) return config.demo.defaultOutput;

    return {
      summary: `这像是一个适合先做验证的竞品监控场景：用户提供了 ${urlCount || '若干'} 个竞品线索，需要把价格、套餐和功能变化整理成可读报告。`,
      signals: [
        urlCount >= 2 ? '已经出现多个竞品 URL，适合生成对比表' : '还需要用户补充 2-5 个竞品 URL',
        lower.includes('每周') || lower.includes('weekly') ? '存在固定频率需求，适合做邮件提醒' : '可先验证一次性报告是否有吸引力',
        lower.includes('价格') || lower.includes('pricing') ? '价格变化是明确痛点，具备付费可能' : '建议继续确认用户最关心价格、套餐还是功能变化'
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
      track('demo_run', { label: '首屏报告演示', score: output.score });
    });

    secondaryRun?.addEventListener('click', () => {
      const output = analyzeText(secondaryInput?.value || '');
      renderDemo(output);
      track('demo_run', { label: '功能区报告演示', score: output.score });
    });
  }

  function bindWaitlist() {
    $all('[data-waitlist-form]').forEach(form => {
      form.addEventListener('submit', async event => {
        event.preventDefault();
        const email = String(new FormData(form).get('email') || '').trim();
        const message = $('[data-form-message]');
        if (!email) return;

        try {
          const response = await fetch('/api/waitlist', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email,
              productSlug: config.slug || 'mvp-template',
              sourcePath: window.location.pathname,
              referrer: document.referrer,
              createdAt: new Date().toISOString()
            })
          });
          if (!response.ok) throw new Error('submit failed');
          form.reset();
          if (message) message.textContent = '已加入早期名单，谢谢。';
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
        if (!response.ok) throw new Error('feedback failed');
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

    const heroInput = $('[data-demo-input]');
    const secondaryInput = $('[data-demo-input-secondary]');
    if (heroInput && config.demo?.inputPlaceholder) heroInput.placeholder = config.demo.inputPlaceholder;
    if (secondaryInput && config.demo?.inputPlaceholder) secondaryInput.placeholder = config.demo.inputPlaceholder;

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

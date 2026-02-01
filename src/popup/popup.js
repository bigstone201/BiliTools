document.addEventListener('DOMContentLoaded', () => {
  // === DOM 元素获取 ===
  const views = {
    main: document.getElementById('mainView'),
    settings: document.getElementById('settingsView')
  };
  const footers = {
    main: document.getElementById('mainFooter'),
    settings: document.getElementById('settingFooter')
  };
  const nav = {
    back: document.getElementById('backBtn'),
    setting: document.getElementById('settingBtn'),
    title: document.getElementById('pageTitle')
  };
  const longPressInput = document.getElementById('longPressInput');
  const input = document.getElementById('speedInput');
  const addBtn = document.getElementById('addBtn');
  const list = document.getElementById('speedList');
  const saveBtn = document.getElementById('saveBtn');
  const resetBtn = document.getElementById('resetBtn');
  const status = document.getElementById('status');
  const quickAddContainer = document.getElementById('quickAddContainer');

  const chipmunkToggle = document.getElementById('chipmunkToggle');
  const saveSettingBtn = document.getElementById('saveSettingBtn');

  // === 配置常量 ===
  const QUICK_RATES = [2.0, 3.0, 4.0, 5.0];
  const DEFAULT_RATES = [2.0, 1.5, 1.25, 1.0, 0.75, 0.5];

  // === 状态变量 ===
  let userSettings = {
    enableChipmunk: true,
    longPressSpeed: 3.0 // 默认值
  };

  init();

  function init() {
    chrome.storage.sync.get(['customSpeeds', 'settings'], (result) => {
      // 1. 加载倍数列表
      if (result.customSpeeds && result.customSpeeds.length > 0) {
        currentSpeeds = result.customSpeeds;
      } else {
        currentSpeeds = [...DEFAULT_RATES];
      }

      // 2. 加载设置
      if (result.settings) {
        userSettings = { ...userSettings, ...result.settings };
      }
      // 同步开关UI状态
      chipmunkToggle.checked = userSettings.enableChipmunk;
      longPressInput.value = userSettings.longPressSpeed || 3.0; // 回显

      renderAll();
    });
  }

  // === 视图切换逻辑 ===
  nav.setting.addEventListener('click', () => switchView('settings'));
  nav.back.addEventListener('click', () => switchView('main'));

  function switchView(viewName) {
    if (viewName === 'settings') {
      views.main.classList.add('hidden');
      footers.main.classList.add('hidden');
      views.settings.classList.remove('hidden');
      footers.settings.classList.remove('hidden');

      nav.back.classList.remove('hidden');
      nav.setting.classList.add('hidden');
      nav.title.textContent = '扩展设置';
      showStatus('');
    } else {
      views.settings.classList.add('hidden');
      footers.settings.classList.add('hidden');
      views.main.classList.remove('hidden');
      footers.main.classList.remove('hidden');

      nav.setting.classList.remove('hidden');
      nav.back.classList.add('hidden');
      nav.title.textContent = '倍速管理';
      showStatus('');
    }
  }

  // === 倍数增删逻辑 ===

  function addSpeed(rate) {
    // 校验：是否为数字
    if (!rate || isNaN(rate)) {
      showStatus('请输入有效的数字', true);
      return;
    }
    // 校验：范围限制
    if (rate <= 0) {
      showStatus('倍数必须大于 0', true);
      return;
    }
    if (rate > 16) {
      showStatus('浏览器限制最大倍数为 16.0', true);
      return;
    }

    if (!currentSpeeds.includes(rate)) {
      currentSpeeds.push(rate);
      renderAll();
      input.value = '';
      showStatus('');
    } else {
      showStatus('该倍数已存在', true);
    }
  }

  function renderAll() {
    currentSpeeds.sort((a, b) => b - a);
    renderQuickAdd();
    renderList();
  }

  function renderQuickAdd() {
    quickAddContainer.innerHTML = '';
    QUICK_RATES.forEach(rate => {
      if (!currentSpeeds.includes(rate)) {
        const btn = document.createElement('div');
        btn.className = 'quick-btn';
        btn.textContent = `+ ${rate}x`;
        btn.onclick = () => addSpeed(rate);
        quickAddContainer.appendChild(btn);
      }
    });
  }

  function renderList() {
    list.innerHTML = '';
    currentSpeeds.forEach(rate => {
      const item = document.createElement('div');
      item.className = 'speed-item';
      if (rate === 1.0) {
        item.classList.add('locked');
        item.innerHTML = `<span>${rate}x</span>`;
      } else {
        item.innerHTML = `<span>${rate}x</span><button class="delete-btn">×</button>`;
        item.querySelector('.delete-btn').onclick = () => removeSpeed(rate);
      }
      list.appendChild(item);
    });
  }

  function removeSpeed(rate) {
    if (rate === 1.0) return;
    currentSpeeds = currentSpeeds.filter(s => s !== rate);
    renderAll();
  }

  // === 事件绑定 ===
  addBtn.addEventListener('click', () => addSpeed(parseFloat(input.value)));
  input.addEventListener('keypress', (e) => { if (e.key === 'Enter') addBtn.click(); });

  // 保存倍数列表
  saveBtn.addEventListener('click', () => {
    if (!currentSpeeds.includes(1.0)) currentSpeeds.push(1.0);
    chrome.storage.sync.set({ customSpeeds: currentSpeeds }, () => {
      showStatus('✅ 倍数列表已保存，请刷新B站');
    });
  });

  // 恢复默认
  resetBtn.addEventListener('click', () => {
    if (confirm('确定要恢复到初始倍数列表吗？')) {
      currentSpeeds = [...DEFAULT_RATES];
      renderAll();
      showStatus('已恢复默认，请点击保存生效');
    }
  });

  // === 设置保存逻辑 ===
  saveSettingBtn.addEventListener('click', () => {
    userSettings.enableChipmunk = chipmunkToggle.checked;

    // 获取输入的数值，做简单的有效性检查
    let lpSpeed = parseFloat(longPressInput.value);
    if (!lpSpeed || lpSpeed <= 0) lpSpeed = 3.0; // 兜底
    userSettings.longPressSpeed = lpSpeed;

    chrome.storage.sync.set({ settings: userSettings }, () => {
      showStatus('✅ 设置已保存');
      setTimeout(() => switchView('main'), 800);
    });
  });

  function showStatus(msg, isError = false) {
    status.textContent = msg;
    status.style.color = isError ? '#FF6666' : '#00AEEC';
    if (!isError && msg) setTimeout(() => status.textContent = '', 3000);
  }
});
document.addEventListener('DOMContentLoaded', () => {
  // === DOM 元素获取 (保持不变) ===
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

  const input = document.getElementById('speedInput');
  const addBtn = document.getElementById('addBtn');
  const list = document.getElementById('speedList');
  const saveBtn = document.getElementById('saveBtn');
  const resetBtn = document.getElementById('resetBtn');
  const status = document.getElementById('status');
  const quickAddContainer = document.getElementById('quickAddContainer');

  const chipmunkToggle = document.getElementById('chipmunkToggle');
  const longPressInput = document.getElementById('longPressInput'); // 记得这里可能有长按输入的元素
  const saveSettingBtn = document.getElementById('saveSettingBtn');
  // 获取手势开关元素
  const gestureToggle = document.getElementById('gestureToggle');

  // === 配置常量 ===
  const QUICK_RATES = [2.0, 3.0, 4.0, 5.0];
  const DEFAULT_RATES = [2.0, 1.5, 1.25, 1.0, 0.75, 0.5];

  // === 状态变量 ===
  let currentSpeeds = [];
  let userSettings = {
    enableChipmunk: true,
    longPressSpeed: 3.0,
    enableGesture: true // 默认开启
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
      if (longPressInput) longPressInput.value = userSettings.longPressSpeed || 3.0;

      gestureToggle.checked = userSettings.enableGesture !== false;

      renderAll();
    });
  }

  // === 核心工具函数：检测并刷新 B站 ===
  function reloadIfBilibili() {
    // 查询当前激活的标签页
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs.length === 0) return;
      const tab = tabs[0];

      // 检查 URL 是否包含 bilibili.com
      // 注意：因为我们在 manifest 里配置了 host_permissions，所以我们可以访问 B站 的 URL
      if (tab.url && tab.url.includes('bilibili.com')) {
        // 执行刷新
        chrome.tabs.reload(tab.id);

        // 可选：刷新后自动关闭 Popup 窗口，体验更流畅
        // window.close();
      }
    });
  }

  // === 视图切换逻辑 (保持不变) ===
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

  // === 倍数增删逻辑 (保持不变) ===
  function addSpeed(rate) {
    if (!rate || isNaN(rate)) { showStatus('请输入有效的数字', true); return; }
    if (rate <= 0) { showStatus('倍数必须大于 0', true); return; }
    if (rate > 16) { showStatus('浏览器限制最大倍数为 16.0', true); return; }

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

  // 【修改】保存倍数列表 -> 自动刷新
  saveBtn.addEventListener('click', () => {
    if (!currentSpeeds.includes(1.0)) currentSpeeds.push(1.0);

    chrome.storage.sync.set({ customSpeeds: currentSpeeds }, () => {
      showStatus('✅ 保存成功，正在刷新页面...');
      // 延迟 500ms 让用户看到提示，然后刷新
      setTimeout(() => reloadIfBilibili(), 500);
    });
  });

  resetBtn.addEventListener('click', () => {
    if (confirm('确定要恢复到初始倍数列表吗？')) {
      currentSpeeds = [...DEFAULT_RATES];
      renderAll();
      showStatus('已恢复默认，请点击保存生效');
    }
  });

  // 【修改】保存设置 -> 自动刷新
  saveSettingBtn.addEventListener('click', () => {
    userSettings.enableChipmunk = chipmunkToggle.checked;

    // 【新增】读取手势开关状态
    userSettings.enableGesture = gestureToggle.checked;

    if (longPressInput) {
      let lpSpeed = parseFloat(longPressInput.value);
      if (!lpSpeed || lpSpeed <= 0) lpSpeed = 3.0;
      userSettings.longPressSpeed = lpSpeed;
    }

    chrome.storage.sync.set({ settings: userSettings }, () => {
      showStatus('✅ 设置已保存，正在刷新...');
      setTimeout(() => {
        reloadIfBilibili();
        switchView('main');
      }, 500);
    });
  });

  function showStatus(msg, isError = false) {
    status.textContent = msg;
    status.style.color = isError ? '#FF6666' : '#00AEEC';
    if (!isError && msg) setTimeout(() => status.textContent = '', 3000);
  }
});
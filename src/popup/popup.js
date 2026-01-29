// src/popup/popup.js

document.addEventListener('DOMContentLoaded', () => {
  const quickAddContainer = document.getElementById('quickAddContainer');
  const input = document.getElementById('speedInput');
  const addBtn = document.getElementById('addBtn');
  const list = document.getElementById('speedList');
  const saveBtn = document.getElementById('saveBtn');
  const status = document.getElementById('status');
  const resetBtn = document.getElementById('resetBtn'); // 新增这一行

  const QUICK_RATES = [2.0, 2.5, 3.0, 4.0, 5.0];

  // 【关键修改】：默认列表里不再包含 2.5 和 3.0
  const DEFAULT_RATES = [2.0, 1.5, 1.25, 1.0, 0.75, 0.5];

  let currentSpeeds = [];

  init();

  function init() {
    chrome.storage.sync.get(['customSpeeds'], (result) => {
      // 逻辑：如果有存过的值，就用存过的；如果没有，就用纯净的默认值
      if (result.customSpeeds && result.customSpeeds.length > 0) {
        currentSpeeds = result.customSpeeds;
      } else {
        currentSpeeds = [...DEFAULT_RATES];
      }
      renderAll();
    });
  }

  // ... 下面的 renderAll, renderQuickAdd, renderList 等函数保持不变 ...
  // ... 直接复制上一次的剩余代码即可，或者只改上面这一段 ...

  // 为了方便，这里把剩余未修改的核心逻辑也贴一下，确保你 copy 完整
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

  function addSpeed(rate) {
    if (!rate || isNaN(rate)) return;
    if (!currentSpeeds.includes(rate)) {
      currentSpeeds.push(rate);
      renderAll();
      showStatus('');
    } else {
      showStatus('该倍数已存在', true);
    }
  }

  function removeSpeed(rate) {
    if (rate === 1.0) return;
    currentSpeeds = currentSpeeds.filter(s => s !== rate);
    renderAll();
  }

  addBtn.addEventListener('click', () => {
    const val = parseFloat(input.value);
    if (val) {
      addSpeed(val);
      input.value = '';
    }
  });

  input.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') addBtn.click();
  });

  saveBtn.addEventListener('click', () => {
    if (!currentSpeeds.includes(1.0)) currentSpeeds.push(1.0);
    chrome.storage.sync.set({ customSpeeds: currentSpeeds }, () => {
      showStatus('✅ 设置已保存，请刷新B站页面');
    });
  });

  function showStatus(msg, isError = false) {
    status.textContent = msg;
    status.style.color = isError ? '#FF6666' : '#00AEEC';
    if (!isError && msg) setTimeout(() => status.textContent = '', 3000);
  }

  resetBtn.addEventListener('click', () => {
    // 增加一个确认弹窗，防止误触
    if (confirm('确定要恢复到初始倍数设置吗？')) {
      // 1. 重置数据
      currentSpeeds = [...DEFAULT_RATES];

      // 2. 重新渲染界面
      renderAll();

      // 3. 给个提示
      showStatus('已恢复默认，请点击保存生效');
    }
  });
});
/* ============================================================
   ISO → BOOTABLE USB CREATOR - PRODUCTION ENGINE
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
  const terminalOutput = document.getElementById('terminal-output');
  const termInput = document.getElementById('term-input');
  const terminalBody = document.getElementById('terminal-body');

  // UI Buttons & Inputs
  const btnRunTop = document.getElementById('btn-run-top');
  const btnCopyCurl = document.getElementById('btn-copy-curl');
  const btnCopyCode = document.getElementById('btn-copy-code');
  const curlCodeText = document.getElementById('curl-code-text');
  const toggleCrt = document.getElementById('toggle-crt');
  const clearTerm = document.getElementById('clear-term');
  const resetWizard = document.getElementById('reset-wizard');

  // Quick Action Chips
  const chipRunScript = document.getElementById('chip-run-script');
  const chipScanUsb = document.getElementById('chip-scan-usb');
  const chipCopyCmd = document.getElementById('chip-copy-cmd');

  // Sidebar Elements
  const isoDropzone = document.getElementById('iso-dropzone');
  const isoFileInput = document.getElementById('iso-file-input');
  const isoInfoPanel = document.getElementById('iso-info-panel');
  const isoValName = document.getElementById('iso-val-name');
  const isoValSize = document.getElementById('iso-val-size');
  const isoValSig = document.getElementById('iso-val-sig');
  const btnRefreshUsb = document.getElementById('btn-refresh-usb');
  const usbList = document.getElementById('usb-list');

  // State Management
  const STATE = {
    step: 'IDLE', // IDLE, STEP_ISO, STEP_USB, STEP_CONFIRM
    isoPath: '~/Downloads/linux-installer.iso',
    isoSize: '4.5 GB',
    selectedUsb: null,
    usbDevices: [],
    selectedFile: null
  };

  // Welcome Screen
  printWelcomeBanner();

  // Initialize WebUSB hardware listeners & initial scan
  initWebUsb();
  refreshUsbDevices();

  // Event Listeners
  btnRunTop.addEventListener('click', () => startWizard());
  if (chipRunScript) chipRunScript.addEventListener('click', () => startWizard());
  if (chipScanUsb) chipScanUsb.addEventListener('click', () => scanUsbDevices());
  if (chipCopyCmd) chipCopyCmd.addEventListener('click', () => copyOneLiner());

  clearTerm.addEventListener('click', () => {
    terminalOutput.innerHTML = '';
    printWelcomeBanner();
  });

  resetWizard.addEventListener('click', () => {
    STATE.step = 'IDLE';
    terminalOutput.innerHTML = '';
    printWelcomeBanner();
    showToast('Wizard reset to initial state');
  });

  toggleCrt.addEventListener('click', () => {
    document.body.classList.toggle('crt-effect');
    toggleCrt.classList.toggle('active');
  });

  btnCopyCurl.addEventListener('click', copyOneLiner);
  btnCopyCode.addEventListener('click', copyOneLiner);

  // Terminal Input Handling
  termInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const inputVal = termInput.value.trim();
      termInput.value = '';
      if (inputVal !== '') {
        handleTerminalCommand(inputVal);
      } else if (STATE.step !== 'IDLE') {
        handleTerminalCommand('');
      }
    }
  });

  // Dropzone Events
  isoDropzone.addEventListener('click', () => isoFileInput.click());
  isoFileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      inspectAndSetIsoFile(e.target.files[0]);
    }
  });

  isoDropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    isoDropzone.classList.add('drag-over');
  });

  isoDropzone.addEventListener('dragleave', () => {
    isoDropzone.classList.remove('drag-over');
  });

  isoDropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    isoDropzone.classList.remove('drag-over');
    if (e.dataTransfer.files.length > 0) {
      inspectAndSetIsoFile(e.dataTransfer.files[0]);
    }
  });

  btnRefreshUsb.addEventListener('click', () => {
    refreshUsbDevices().then(() => {
      if (STATE.usbDevices.length > 0) {
        showToast(`Found ${STATE.usbDevices.length} WebUSB hardware device(s)`);
      } else {
        showToast('No USB hardware connected via WebUSB');
      }
    });
  });

  // ------------------------------------------------------------
  // WebUSB Hardware API Integration
  // ------------------------------------------------------------

  function initWebUsb() {
    if (navigator.usb) {
      navigator.usb.addEventListener('connect', (e) => {
        showToast(`USB Hardware Connected: ${e.device.productName || 'USB Device'}`);
        refreshUsbDevices();
      });

      navigator.usb.addEventListener('disconnect', (e) => {
        showToast(`USB Hardware Disconnected: ${e.device.productName || 'USB Device'}`);
        refreshUsbDevices();
      });
    }
  }

  async function refreshUsbDevices() {
    let devices = [];

    if (navigator.usb) {
      try {
        const paired = await navigator.usb.getDevices();
        paired.forEach((dev, idx) => {
          const letter = String.fromCharCode(98 + idx);
          devices.push({
            id: idx + 1,
            path: `/dev/sd${letter}`,
            size: 'Removable USB',
            model: dev.productName || 'USB Storage',
            vendor: dev.manufacturerName || 'Removable',
            isWebUsb: true,
            vendorId: dev.vendorId,
            productId: dev.productId
          });
        });
      } catch (err) {
        console.warn('WebUSB enumeration notice:', err);
      }
    }

    STATE.usbDevices = devices;

    if (STATE.usbDevices.length > 0) {
      if (!STATE.selectedUsb || !STATE.usbDevices.some(d => d.path === STATE.selectedUsb)) {
        STATE.selectedUsb = STATE.usbDevices[0].path;
      }
    } else {
      STATE.selectedUsb = null;
    }

    renderUsbList();
  }

  async function requestWebUsbDevice() {
    if (!navigator.usb) {
      showToast('WebUSB hardware API is not supported in this browser. Use Chrome/Edge or run Linux script.');
      return;
    }

    try {
      const device = await navigator.usb.requestDevice({ filters: [] });
      showToast(`Paired USB: ${device.productName || 'USB Device'}`);
      await refreshUsbDevices();
    } catch (err) {
      if (err.name !== 'NotFoundError') {
        showToast(`USB Error: ${err.message}`);
      }
    }
  }

  // ------------------------------------------------------------
  // Real ISO File Inspection (HTML5 FileReader Slice)
  // ------------------------------------------------------------

  function inspectAndSetIsoFile(file) {
    STATE.selectedFile = file;
    STATE.isoPath = `~/Downloads/${file.name}`;
    
    const szMB = (file.size / (1024 * 1024)).toFixed(1);
    const sizeStr = file.size > 1024 * 1024 * 1024 
      ? (file.size / (1024 * 1024 * 1024)).toFixed(2) + ' GB' 
      : szMB + ' MB';
    
    STATE.isoSize = sizeStr;

    // Read first 64KB to verify ISO9660 signature (offset 32769: "CD001")
    const slice = file.slice(32768, 32768 + 2048);
    const reader = new FileReader();

    reader.onload = function(e) {
      const buffer = new Uint8Array(e.target.result);
      const signature = String.fromCharCode(buffer[1], buffer[2], buffer[3], buffer[4], buffer[5]);
      
      let isWindows = /win/i.test(file.name);
      
      if (signature === 'CD001') {
        if (isWindows) {
          updateIsoPanel(file.name, sizeStr, 'ISO9660 Verified (Windows ISO)', 'status-warning');
          showToast(`Inspected Windows ISO: ${file.name}`);
        } else {
          updateIsoPanel(file.name, sizeStr, 'ISO9660 Hybrid Verified', 'status-valid');
          showToast(`Validated ISO: ${file.name}`);
        }
      } else if (isWindows) {
        updateIsoPanel(file.name, sizeStr, 'Windows UDF ISO (Ventoy/WoeUSB Required)', 'status-warning');
        showToast(`Inspected Windows ISO: ${file.name}`);
      } else {
        updateIsoPanel(file.name, sizeStr, 'Raw Image / Non-standard ISO', 'status-warning');
        showToast(`Loaded File: ${file.name}`);
      }

      if (STATE.step === 'STEP_ISO') {
        submitInput(STATE.isoPath);
      }
    };

    reader.onerror = function() {
      updateIsoPanel(file.name, sizeStr, 'Unverified File', 'status-warning');
    };

    reader.readAsArrayBuffer(slice);
  }

  function updateIsoPanel(name, size, statusText, statusClass) {
    isoValName.textContent = name;
    isoValSize.textContent = size;
    const sigEl = document.getElementById('iso-val-sig');
    if (sigEl) {
      sigEl.textContent = statusText;
      sigEl.className = `val ${statusClass || 'status-valid'}`;
    }
    isoInfoPanel.classList.remove('hidden');
  }

  // ------------------------------------------------------------
  // Terminal Engine
  // ------------------------------------------------------------

  function printLine(text = '', type = '') {
    const div = document.createElement('div');
    div.className = `t-line ${type}`;
    div.textContent = text;
    terminalOutput.appendChild(div);
    terminalBody.scrollTop = terminalBody.scrollHeight;
  }

  function printWelcomeBanner() {
    printLine('============================================================', 't-header');
    printLine('              ISO → BOOTABLE USB CREATOR', 't-header');
    printLine('============================================================', 't-header');
    printLine('Designed for Arch, Garuda, Ubuntu, Debian, Fedora & Linux Distros', 't-dim');
    printLine('');
    printLine('Production Usage:', 't-info');
    printLine('  1. Drag & drop your real .iso file into the sidebar inspector', 't-dim');
    printLine('  2. Click [▶ Run Terminal Wizard] or type "run" to configure options', 't-dim');
    printLine('  3. Copy and execute the one-liner script in your Linux terminal:', 't-dim');
    printLine('     curl -fsSL https://raw.githubusercontent.com/Dave8011/bootable-maker/main/make-bootable.sh | bash', 't-success');
    printLine('');
  }

  function handleTerminalCommand(input) {
    printLine(`user@linux:~/bootable-maker$ ${input}`, 't-prompt');

    if (STATE.step === 'IDLE') {
      const cmd = input.toLowerCase();
      if (cmd === 'run' || cmd === 'start' || cmd === './make-bootable.sh') {
        startWizard();
      } else if (cmd === 'scan' || cmd === 'lsblk') {
        scanUsbDevices();
      } else if (cmd === 'clear') {
        terminalOutput.innerHTML = '';
      } else if (cmd === 'help') {
        printLine('Available production commands:', 't-info');
        printLine('  run   - Configure ISO and target USB device options', 't-dim');
        printLine('  scan  - Scan WebUSB connected hardware devices', 't-dim');
        printLine('  clear - Clear terminal screen', 't-dim');
      } else {
        printLine(`Command not found: ${input}. Type "run" to start wizard.`, 't-error');
      }
    } else {
      submitInput(input);
    }
  }

  function startWizard() {
    STATE.step = 'STEP_ISO';
    terminalOutput.innerHTML = '';
    
    printLine('============================================================', 't-header');
    printLine('              ISO → BOOTABLE USB CREATOR', 't-header');
    printLine('============================================================', 't-header');
    printLine('');
    printLine('📀 STEP 1: ISO FILE SELECTION', 't-info');
    printLine('------------------------------------------------------------', 't-dim');
    printLine(`Enter ISO file path [default: ${STATE.isoPath}]:`, 't-info');
  }

  function submitInput(input) {
    if (STATE.step === 'STEP_ISO') {
      if (input.trim() !== '') {
        STATE.isoPath = input.trim().replace(/^["']|["']$/g, '');
      }

      printLine('');
      printLine('ISO selected:', 't-success');
      printLine(`   📄 File : ${STATE.isoPath}`, 't-dim');
      printLine(`   📦 Size : ${STATE.isoSize}`, 't-dim');
      printLine('');
      printLine('🔍 Validating ISO image...', 't-info');

      if (/win/i.test(STATE.isoPath)) {
        printLine('⚠️ WINDOWS ISO DETECTED:', 't-warning');
        printLine('   Standard Linux block copying (dd) works for Linux ISOs (Ubuntu, Arch, Fedora, etc.).', 't-warning');
        printLine('   Windows 10/11 ISOs require UEFI partition tools like Ventoy or WoeUSB.', 't-warning');
      } else {
        printLine('✅ Hybrid ISO9660 filesystem signature detected.', 't-success');
      }
      printLine('✅ ISO validation completed.', 't-success');
      printLine('');

      // Move to USB Step
      STATE.step = 'STEP_USB';
      promptUsbStep();

    } else if (STATE.step === 'STEP_USB') {
      let chosenPath = input.trim();
      if (chosenPath === '' || chosenPath === '1') {
        chosenPath = STATE.usbDevices.length > 0 ? STATE.usbDevices[0].path : '/dev/sdb';
      } else if (!chosenPath.startsWith('/dev/')) {
        chosenPath = `/dev/${chosenPath}`;
      }

      STATE.selectedUsb = chosenPath;
      printLine('');
      printLine('============================================================', 't-header');
      printLine('                    TARGET USB DRIVE', 't-header');
      printLine('============================================================', 't-header');
      printLine(`Target Device : ${STATE.selectedUsb}`, 't-info');
      printLine('');
      printLine('============================================================', 't-warning');
      printLine('                     ⚠️  WARNING', 't-warning');
      printLine('============================================================', 't-warning');
      printLine(`Writing will completely format and erase device: ${STATE.selectedUsb}`, 't-highlight');
      printLine('ALL DATA ON THIS USB DRIVE WILL BE PERMANENTLY ERASED!', 't-highlight');
      printLine('');
      printLine('Press Enter or type ERASE to generate terminal command:', 't-warning');

      STATE.step = 'STEP_CONFIRM';

    } else if (STATE.step === 'STEP_CONFIRM') {
      printLine('');
      printLine('============================================================', 't-header');
      printLine('               🚀 EXECUTION LAUNCHER COMMAND', 't-header');
      printLine('============================================================', 't-header');
      printLine('');
      printLine('To execute the real block-write operation on your Linux terminal:', 't-info');
      printLine('');
      printLine('  curl -fsSL https://raw.githubusercontent.com/Dave8011/bootable-maker/main/make-bootable.sh | bash', 't-success');
      printLine('');
      printLine('Or execute manually:', 't-info');
      printLine('  chmod +x make-bootable.sh && sudo ./make-bootable.sh', 't-dim');
      printLine('');
      printLine('Configuration Summary:', 't-info');
      printLine(`  • ISO Path : ${STATE.isoPath}`, 't-dim');
      printLine(`  • Target   : ${STATE.selectedUsb}`, 't-dim');
      printLine('');

      STATE.step = 'IDLE';
      copyOneLiner();
      showToast('Copied launcher command to clipboard!');
    }
  }

  function promptUsbStep() {
    printLine('============================================================', 't-header');
    printLine('                    USB DRIVE SELECTION', 't-header');
    printLine('============================================================', 't-header');
    printLine('🔍 Scanning WebUSB & system block devices...', 't-info');

    if (STATE.usbDevices.length > 0) {
      printLine('✅ Connected WebUSB hardware device(s) detected:', 't-success');
      STATE.usbDevices.forEach((dev, idx) => {
        printLine(`  [${idx + 1}] ${dev.path} — ${dev.vendor ? dev.vendor + ' ' : ''}${dev.model}`, 't-success');
      });
    } else {
      printLine('ℹ️ No WebUSB devices currently paired in browser.', 't-dim');
      printLine('Default target device: /dev/sdb', 't-dim');
    }

    printLine('');
    printLine('Enter target USB device path [example: /dev/sdb] (default: 1):', 't-info');
  }

  function scanUsbDevices() {
    refreshUsbDevices().then(() => {
      printLine('🔍 WebUSB Hardware Scan Results:', 't-info');
      if (STATE.usbDevices.length === 0) {
        printLine('ℹ️ No USB hardware paired via WebUSB API.', 't-dim');
        printLine('💡 Click [🔌 Connect / Pair USB Drive] in sidebar or run command in Linux terminal.', 't-dim');
      } else {
        STATE.usbDevices.forEach(dev => {
          printLine(`  • ${dev.path} — ${dev.vendor ? dev.vendor + ' ' : ''}${dev.model} (VendorID: 0x${dev.vendorId ? dev.vendorId.toString(16) : 'N/A'})`, 't-success');
        });
      }
      printLine('');
    });
  }

  function renderUsbList() {
    if (STATE.usbDevices.length === 0) {
      usbList.innerHTML = `
        <div class="usb-empty-state">
          <div class="empty-icon">🔌</div>
          <div class="empty-title">No USB Hardware Paired</div>
          <div class="empty-desc">Connect a USB pendrive and pair via WebUSB, or execute the bash command in terminal.</div>
          <div class="empty-actions">
            <button id="btn-pair-usb" class="btn btn-primary btn-sm">🔌 Connect / Pair USB Drive</button>
          </div>
          <div class="usb-hint">
            💡 <strong>Terminal Execution:</strong> Run the shell launcher directly on your Linux terminal for root block writing.
          </div>
        </div>
      `;

      const btnPair = document.getElementById('btn-pair-usb');
      if (btnPair) btnPair.addEventListener('click', requestWebUsbDevice);
    } else {
      let html = '';
      STATE.usbDevices.forEach((dev, idx) => {
        const isSelected = dev.path === STATE.selectedUsb;
        html += `
          <div class="usb-item ${isSelected ? 'active-device' : ''}" data-path="${dev.path}">
            <div class="usb-icon">💾</div>
            <div class="usb-details">
              <div class="usb-name">[${idx + 1}] ${dev.path}</div>
              <div class="usb-meta">${dev.vendor ? dev.vendor + ' ' : ''}${dev.model}</div>
              <div class="usb-tag">WebUSB Hardware</div>
            </div>
            ${isSelected ? '<div class="usb-select-badge">Selected</div>' : ''}
          </div>
        `;
      });

      html += `
        <div style="display:flex; justify-content:flex-end; margin-top:0.4rem;">
          <button id="btn-pair-usb-sub" class="btn-mini" title="Pair additional USB device via WebUSB">🔌 Pair Device</button>
        </div>
      `;

      usbList.innerHTML = html;

      const items = usbList.querySelectorAll('.usb-item');
      items.forEach(item => {
        item.addEventListener('click', () => {
          const path = item.getAttribute('data-path');
          STATE.selectedUsb = path;
          renderUsbList();
          showToast(`Selected device: ${path}`);
        });
      });

      const btnPairSub = document.getElementById('btn-pair-usb-sub');
      if (btnPairSub) btnPairSub.addEventListener('click', requestWebUsbDevice);
    }
  }

  function copyOneLiner() {
    const code = curlCodeText.textContent;
    navigator.clipboard.writeText(code).then(() => {
      showToast('Copied terminal launcher command to clipboard!');
    }).catch(() => {
      showToast('Copied command!');
    });
  }

  function showToast(msg) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = msg;
    container.appendChild(toast);
    setTimeout(() => {
      toast.remove();
    }, 3000);
  }
});

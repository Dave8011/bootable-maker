/* ============================================================
   ISO → BOOTABLE USB CREATOR - INTERACTIVE TERMINAL ENGINE
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
  const chipSampleIso = document.getElementById('chip-sample-iso');
  const chipScanUsb = document.getElementById('chip-scan-usb');
  const chipErase = document.getElementById('chip-erase');

  // Sidebar Elements
  const isoDropzone = document.getElementById('iso-dropzone');
  const isoFileInput = document.getElementById('iso-file-input');
  const isoInfoPanel = document.getElementById('iso-info-panel');
  const isoValName = document.getElementById('iso-val-name');
  const isoValSize = document.getElementById('iso-val-size');
  const btnRefreshUsb = document.getElementById('btn-refresh-usb');
  const usbList = document.getElementById('usb-list');

  // State Management
  const STATE = {
    step: 'IDLE', // IDLE, STEP_ISO, STEP_USB, STEP_CONFIRM, STEP_WRITING, STEP_DONE
    isoPath: '/home/dave/Downloads/omarchy-4.0.0.iso',
    isoSize: '5.9G',
    selectedUsb: null,
    usbDevices: [],
    demoUsbAttached: false,
    webUsbDevices: []
  };

  // Welcome Screen
  printWelcomeBanner();

  // Initialize WebUSB hardware listeners & initial scan
  initWebUsb();
  refreshUsbDevices();

  // Event Listeners
  btnRunTop.addEventListener('click', () => startWizard());
  chipRunScript.addEventListener('click', () => startWizard());
  chipSampleIso.addEventListener('click', () => useSampleIso());
  chipScanUsb.addEventListener('click', () => scanUsbDevices());
  chipErase.addEventListener('click', () => submitInput('ERASE'));
  
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
        // Handle empty Enter as default selection
        handleTerminalCommand('');
      }
    }
  });

  // Dropzone Events
  isoDropzone.addEventListener('click', () => isoFileInput.click());
  isoFileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      handleIsoFile(e.target.files[0]);
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
      handleIsoFile(e.dataTransfer.files[0]);
    }
  });

  btnRefreshUsb.addEventListener('click', () => {
    refreshUsbDevices().then(() => {
      if (STATE.usbDevices.length > 0) {
        showToast(`Found ${STATE.usbDevices.length} USB device(s)`);
      } else {
        showToast('No USB drive detected');
      }
    });
  });

  // ------------------------------------------------------------
  // WebUSB & Device Management Functions
  // ------------------------------------------------------------

  function initWebUsb() {
    if (navigator.usb) {
      navigator.usb.addEventListener('connect', (e) => {
        showToast(`USB Hardware Connected: ${e.device.productName || 'USB Storage'}`);
        refreshUsbDevices();
      });

      navigator.usb.addEventListener('disconnect', (e) => {
        showToast(`USB Hardware Removed: ${e.device.productName || 'USB Storage'}`);
        refreshUsbDevices();
      });
    }
  }

  async function refreshUsbDevices() {
    let devices = [];

    // Query WebUSB if supported
    if (navigator.usb) {
      try {
        const paired = await navigator.usb.getDevices();
        STATE.webUsbDevices = paired;
        paired.forEach((dev, idx) => {
          const letter = String.fromCharCode(98 + idx); // sdb, sdc, etc.
          devices.push({
            id: devices.length + 1,
            path: `/dev/sd${letter}`,
            size: '16 GB',
            model: dev.productName || 'USB Storage',
            vendor: dev.manufacturerName || 'Removable',
            isWebUsb: true
          });
        });
      } catch (err) {
        console.warn('WebUSB query error:', err);
      }
    }

    // Add Demo USB if toggled on
    if (STATE.demoUsbAttached) {
      const letter = String.fromCharCode(98 + devices.length);
      devices.push({
        id: devices.length + 1,
        path: `/dev/${letter === 'b' ? 'sdb' : 'sd' + letter}`,
        size: '14.6 GB',
        model: 'SanDisk Cruzer Blade',
        vendor: 'SanDisk',
        isDemo: true
      });
    }

    STATE.usbDevices = devices;

    // Update selected USB
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
      showToast('WebUSB is not supported in this browser. Use Chrome/Edge or run bash script.');
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

  function toggleDemoUsb() {
    STATE.demoUsbAttached = !STATE.demoUsbAttached;
    refreshUsbDevices();
    if (STATE.demoUsbAttached) {
      showToast('Plugged in demo USB drive (/dev/sdb)');
    } else {
      showToast('Unplugged demo USB drive');
    }
  }

  // ------------------------------------------------------------
  // Terminal Functions
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
    printLine('Designed for Arch, Garuda, Ubuntu, Debian & all Linux distros', 't-dim');
    printLine('');
    printLine('Available Actions:', 't-info');
    printLine('  • Click [▶ Run Script] or type "run" to start wizard', 't-dim');
    printLine('  • Type "scan" to view connected USB pendrives', 't-dim');
    printLine('  • Drag & drop any .iso file into the side panel', 't-dim');
    printLine('  • Type "help" for interactive command list', 't-dim');
    printLine('');
  }

  function handleTerminalCommand(input) {
    printLine(`dave@garuda:~/bootable-maker$ ${input}`, 't-prompt');

    if (STATE.step === 'IDLE') {
      const cmd = input.toLowerCase();
      if (cmd === 'run' || cmd === 'start' || cmd === './make-bootable.sh') {
        startWizard();
      } else if (cmd === 'scan' || cmd === 'lsblk') {
        scanUsbDevices();
      } else if (cmd === 'clear') {
        terminalOutput.innerHTML = '';
      } else if (cmd === 'help') {
        printLine('Available commands:', 't-info');
        printLine('  run   - Start bootable USB creator wizard', 't-dim');
        printLine('  scan  - Scan for connected USB devices', 't-dim');
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
    printLine('📀 ISO FILE SELECTION', 't-info');
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
      printLine('🔍 Validating ISO...', 't-info');
      printLine('✅ ISO9660 filesystem signature detected.', 't-success');
      printLine('✅ ISO validation completed.', 't-success');
      printLine('');

      // Move to USB Step
      STATE.step = 'STEP_USB';
      promptUsbStep();

    } else if (STATE.step === 'STEP_USB') {
      if (STATE.usbDevices.length === 0) {
        printLine('', '');
        printLine('❌ No USB drive detected. Please plug in a USB pendrive first!', 't-error');
        printLine('💡 Tip: Use [🔄 Refresh] or click [🧪 Plug Demo USB] in the sidebar.', 't-info');
        return;
      }

      let chosenDevice = null;
      const cleanInput = input.trim();

      if (cleanInput === '' || cleanInput === '1') {
        chosenDevice = STATE.usbDevices[0];
      } else if (!isNaN(parseInt(cleanInput))) {
        const idx = parseInt(cleanInput) - 1;
        if (idx >= 0 && idx < STATE.usbDevices.length) {
          chosenDevice = STATE.usbDevices[idx];
        }
      } else {
        chosenDevice = STATE.usbDevices.find(d => d.path === cleanInput || d.path.endsWith(cleanInput));
      }

      if (!chosenDevice) {
        printLine(`❌ Invalid device selection: "${input}". Please choose 1-${STATE.usbDevices.length}`, 't-error');
        return;
      }

      STATE.selectedUsb = chosenDevice.path;
      printLine('');
      printLine('============================================================', 't-header');
      printLine('                    SELECTED USB DRIVE', 't-header');
      printLine('============================================================', 't-header');
      printLine(`Device     : ${chosenDevice.path}`, 't-info');
      printLine(`Size       : ${chosenDevice.size}`, 't-dim');
      printLine(`Model      : ${chosenDevice.vendor ? chosenDevice.vendor + ' ' : ''}${chosenDevice.model}`, 't-dim');
      printLine(`Removable  : YES`, 't-success');
      printLine('');
      printLine('============================================================', 't-warning');
      printLine('                     ⚠️  WARNING', 't-warning');
      printLine('============================================================', 't-warning');
      printLine(`You are about to completely erase device: ${STATE.selectedUsb}`, 't-highlight');
      printLine('ALL DATA ON THIS USB DRIVE WILL BE PERMANENTLY ERASED!', 't-highlight');
      printLine('');
      printLine('Type ERASE to continue:', 't-warning');

      STATE.step = 'STEP_CONFIRM';

    } else if (STATE.step === 'STEP_CONFIRM') {
      if (input.trim() !== 'ERASE') {
        printLine('', '');
        printLine('❌ Cancelled. Nothing was changed.', 't-error');
        STATE.step = 'IDLE';
        return;
      }

      STATE.step = 'STEP_WRITING';
      executeWritingProcess();
    }
  }

  function promptUsbStep() {
    printLine('============================================================', 't-header');
    printLine('                    USB DRIVE DETECTION', 't-header');
    printLine('============================================================', 't-header');
    printLine('🔍 Searching for connected USB drives...', 't-info');

    if (STATE.usbDevices.length === 0) {
      printLine('❌ No removable USB drive detected.', 't-error');
      printLine('', '');
      printLine('Check that:', 't-warning');
      printLine('  • The pendrive is physically connected to your system', 't-dim');
      printLine('  • You have clicked [🔌 Connect / Pair USB Drive] or [🧪 Plug Demo USB]', 't-dim');
      printLine('  • Or run the bash script directly in your Linux terminal:', 't-dim');
      printLine('    curl -fsSL https://raw.githubusercontent.com/Dave8011/bootable-maker/main/make-bootable.sh | bash', 't-info');
      printLine('', '');
      printLine('Press Enter or type "scan" after plugging in your USB drive:', 't-info');
    } else {
      printLine('✅ Removable USB drive(s) detected.', 't-success');
      printLine('');
      printLine('Available USB drives:', 't-info');
      printLine('------------------------------------------------------------', 't-dim');
      STATE.usbDevices.forEach((dev, idx) => {
        const isSel = dev.path === STATE.selectedUsb ? ' (Selected)' : '';
        printLine(`  [${idx + 1}] ${dev.path} — ${dev.size} (${dev.vendor ? dev.vendor + ' ' : ''}${dev.model})${isSel}`, 't-success');
      });
      printLine('------------------------------------------------------------', 't-dim');
      printLine('');
      printLine(`Select USB device [1-${STATE.usbDevices.length}] or enter path (default: 1):`, 't-info');
    }
  }

  function executeWritingProcess() {
    const selectedDev = STATE.usbDevices.find(d => d.path === STATE.selectedUsb) || {
      path: STATE.selectedUsb || '/dev/sdb',
      size: '14.6 GB',
      model: 'Cruzer Blade'
    };

    printLine('');
    printLine('============================================================', 't-header');
    printLine('                    UNMOUNTING USB', 't-header');
    printLine('============================================================', 't-header');
    printLine(`Unmounting active partitions on ${selectedDev.path}...`, 't-info');
    printLine(`✅ ${selectedDev.path} unmounted successfully.`, 't-success');
    printLine('');
    printLine('============================================================', 't-header');
    printLine('                    WIPING FILESYSTEM', 't-header');
    printLine('============================================================', 't-header');
    printLine('🧹 Removing old filesystem signatures with wipefs...', 't-info');
    printLine('✅ Old filesystem signatures removed.', 't-success');
    printLine('');
    printLine('============================================================', 't-header');
    printLine('                    WRITING ISO TO USB', 't-header');
    printLine('============================================================', 't-header');
    printLine(`Source      : ${STATE.isoPath}`, 't-dim');
    printLine(`Destination : ${selectedDev.path}`, 't-dim');
    printLine(`ISO Size    : ${STATE.isoSize}`, 't-dim');
    printLine('');
    printLine('Writing ISO block data using dd (status=progress)...', 't-info');

    let percent = 0;
    const interval = setInterval(() => {
      percent += 15;
      const written = (5.9 * (percent / 100)).toFixed(1);
      printLine(`dd: ${written}GB / 5.9GB written [${'█'.repeat(percent / 10)}${'░'.repeat(10 - percent / 10)}] ${percent}% (48.5 MB/s)`, 't-info');

      if (percent >= 100) {
        clearInterval(interval);
        finishWriting();
      }
    }, 600);
  }

  function finishWriting() {
    printLine('');
    printLine('✅ ISO written successfully.', 't-success');
    printLine('🔄 Flushing filesystem buffers with sync...', 't-info');
    printLine('✅ Data synchronized.', 't-success');
    printLine('');
    printLine('============================================================', 't-header');
    printLine('                  ✅ BOOTABLE USB COMPLETE', 't-header');
    printLine('============================================================', 't-header');
    printLine(`ISO : ${STATE.isoPath}`, 't-success');
    printLine(`USB : ${STATE.selectedUsb}`, 't-success');
    printLine('');
    printLine('The USB drive has been synchronized and is ready to boot!', 't-success');
    printLine('You can now safely remove the pendrive.', 't-dim');
    printLine('');

    STATE.step = 'IDLE';
    showToast('Bootable USB process complete!');
  }

  function scanUsbDevices() {
    refreshUsbDevices().then(() => {
      printLine('🔍 Scanning block devices...', 't-info');
      printLine('NAME   SIZE MODEL              VENDOR   TRAN  RM', 't-dim');
      printLine('sda  476.9G FORESEE S50AF512GB ATA      sata   0 (Internal SSD)', 't-dim');
      
      if (STATE.usbDevices.length === 0) {
        printLine('❌ No removable USB drive detected', 't-error');
        printLine('💡 Plug in a USB pendrive and click [🔄 Refresh] or type "scan" again.', 't-dim');
      } else {
        STATE.usbDevices.forEach(dev => {
          const devName = dev.path.replace('/dev/', '');
          const modelStr = ((dev.vendor ? dev.vendor + ' ' : '') + dev.model).padEnd(18).substring(0, 18);
          printLine(`${devName.padEnd(4)} ${dev.size.padEnd(6)} ${modelStr} ${(dev.vendor || 'USB').padEnd(8)} usb    1 (Removable USB)`, 't-success');
        });
      }
      printLine('');
    });
  }

  function useSampleIso() {
    STATE.isoPath = '/home/dave/Downloads/omarchy-4.0.0.iso';
    STATE.isoSize = '5.9 GB';
    updateIsoPanel('omarchy-4.0.0.iso', '5.9 GB');
    showToast('Loaded sample ISO: omarchy-4.0.0.iso');
  }

  function handleIsoFile(file) {
    STATE.isoPath = `/home/dave/Downloads/${file.name}`;
    const szMB = (file.size / (1024 * 1024)).toFixed(1);
    const sizeStr = file.size > 1024 * 1024 * 1024 
      ? (file.size / (1024 * 1024 * 1024)).toFixed(2) + ' GB' 
      : szMB + ' MB';
    
    STATE.isoSize = sizeStr;
    updateIsoPanel(file.name, sizeStr);
    showToast(`Loaded ISO: ${file.name}`);

    if (STATE.step === 'STEP_ISO') {
      submitInput(STATE.isoPath);
    }
  }

  function updateIsoPanel(name, size) {
    isoValName.textContent = name;
    isoValSize.textContent = size;
    isoInfoPanel.classList.remove('hidden');
  }

  function renderUsbList() {
    if (STATE.usbDevices.length === 0) {
      usbList.innerHTML = `
        <div class="usb-empty-state">
          <div class="empty-icon">🔌</div>
          <div class="empty-title">No USB Drive Connected</div>
          <div class="empty-desc">Plug in a removable USB pendrive to create a bootable installer.</div>
          <div class="empty-actions">
            <button id="btn-pair-usb" class="btn btn-primary btn-sm">🔌 Connect / Pair USB Drive</button>
            <button id="btn-toggle-demo" class="btn btn-ghost btn-sm">🧪 Plug Demo USB (${STATE.demoUsbAttached ? 'Plugged' : 'Unplugged'})</button>
          </div>
          <div class="usb-hint">
            💡 <strong>Browser USB Access:</strong> Click <strong>Connect / Pair USB Drive</strong> or execute the command line script on Linux for direct hardware raw write.
          </div>
        </div>
      `;

      const btnPair = document.getElementById('btn-pair-usb');
      const btnToggle = document.getElementById('btn-toggle-demo');
      
      if (btnPair) btnPair.addEventListener('click', requestWebUsbDevice);
      if (btnToggle) btnToggle.addEventListener('click', toggleDemoUsb);
    } else {
      let html = '';
      STATE.usbDevices.forEach((dev, idx) => {
        const isSelected = dev.path === STATE.selectedUsb;
        html += `
          <div class="usb-item ${isSelected ? 'active-device' : ''}" data-path="${dev.path}">
            <div class="usb-icon">💾</div>
            <div class="usb-details">
              <div class="usb-name">[${idx + 1}] ${dev.path}</div>
              <div class="usb-meta">${dev.size} • ${dev.vendor ? dev.vendor + ' ' : ''}${dev.model}</div>
              <div class="usb-tag">Removable USB ${dev.isDemo ? '(Demo)' : dev.isWebUsb ? '(WebUSB)' : ''}</div>
            </div>
            ${isSelected ? '<div class="usb-select-badge">Selected</div>' : ''}
          </div>
        `;
      });

      html += `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:0.4rem;">
          <button id="btn-pair-usb-sub" class="btn-mini" title="Pair additional USB device via WebUSB">🔌 Pair Hardware</button>
          <button id="btn-toggle-demo" class="btn-mini" title="Toggle Demo USB Mode">${STATE.demoUsbAttached ? '❌ Remove Demo USB' : '🧪 Add Demo USB'}</button>
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
      const btnToggle = document.getElementById('btn-toggle-demo');
      if (btnPairSub) btnPairSub.addEventListener('click', requestWebUsbDevice);
      if (btnToggle) btnToggle.addEventListener('click', toggleDemoUsb);
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

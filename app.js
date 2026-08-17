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
    selectedUsb: '/dev/sdb',
    usbDevices: [
      { id: 1, path: '/dev/sdb', size: '14.6 GB', model: 'SanDisk Cruzer Blade', vendor: 'SanDisk' }
    ]
  };

  // Welcome Screen
  printWelcomeBanner();

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
    renderUsbList();
    showToast('Refreshed USB device list');
  });

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
    // Print user's entered command to buffer
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
      let chosenPath = '/dev/sdb';

      if (input === '1' || input === '' || input === 'sdb' || input === '/dev/sdb') {
        chosenPath = '/dev/sdb';
      } else if (input === '2' || input === 'sdc' || input === '/dev/sdc') {
        chosenPath = '/dev/sdc';
      } else {
        printLine(`❌ Invalid device selection: "${input}". Please enter 1 or /dev/sdb`, 't-error');
        return;
      }

      STATE.selectedUsb = chosenPath;
      printLine('');
      printLine('============================================================', 't-header');
      printLine('                    SELECTED USB DRIVE', 't-header');
      printLine('============================================================', 't-header');
      printLine(`Device     : ${STATE.selectedUsb}`, 't-info');
      printLine(`Size       : 14.6 GB`, 't-dim');
      printLine(`Model      : SanDisk Cruzer Blade`, 't-dim');
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
    printLine('✅ Removable USB drive(s) detected.', 't-success');
    printLine('');
    printLine('Available USB drives:', 't-info');
    printLine('------------------------------------------------------------', 't-dim');
    printLine('  [1] /dev/sdb — 14.6 GB (SanDisk Cruzer Blade)', 't-success');
    printLine('------------------------------------------------------------', 't-dim');
    printLine('');
    printLine('Select USB device [1-1] or enter path (default: 1):', 't-info');
  }

  function executeWritingProcess() {
    printLine('');
    printLine('============================================================', 't-header');
    printLine('                    UNMOUNTING USB', 't-header');
    printLine('============================================================', 't-header');
    printLine(`Unmounting active partitions on ${STATE.selectedUsb}...`, 't-info');
    printLine(`✅ ${STATE.selectedUsb} unmounted successfully.`, 't-success');
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
    printLine(`Destination : ${STATE.selectedUsb}`, 't-dim');
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
    printLine(`USB : ${STATE.selectedUsb} (14.6 GB)`, 't-success');
    printLine('');
    printLine('The USB drive has been synchronized and is ready to boot!', 't-success');
    printLine('You can now safely remove the pendrive.', 't-dim');
    printLine('');

    STATE.step = 'IDLE';
    showToast('Bootable USB process complete!');
  }

  function scanUsbDevices() {
    printLine('🔍 Scanning block devices...', 't-info');
    printLine('NAME   SIZE MODEL              VENDOR   TRAN  RM', 't-dim');
    printLine('sda  476.9G FORESEE S50AF512GB ATA      sata   0 (Internal SSD)', 't-dim');
    printLine('sdb   14.6G Cruzer Blade       SanDisk  usb    1 (Removable USB)', 't-success');
    printLine('');
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
    usbList.innerHTML = `
      <div class="usb-item active-device" data-index="1" data-path="/dev/sdb">
        <div class="usb-icon">💾</div>
        <div class="usb-details">
          <div class="usb-name">[1] /dev/sdb</div>
          <div class="usb-meta">14.6 GB • SanDisk Cruzer Blade</div>
          <div class="usb-tag">Removable USB</div>
        </div>
        <div class="usb-select-badge">Selected</div>
      </div>
    `;
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

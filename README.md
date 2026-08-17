# 📀 ISO → Bootable USB Creator

A robust, safe, and interactive Bash script designed for Arch, Garuda, Ubuntu, Debian, Fedora, and other Linux distributions to write ISO images to removable USB pendrives.

---

## 🚀 Quick Launch (One-Liner)

You can run the bootable USB creator instantly on any Linux terminal:

```bash
curl -fsSL https://raw.githubusercontent.com/Dave8011/bootable-maker/main/make-bootable.sh | bash
```

Or download and run manually:

```bash
curl -O https://raw.githubusercontent.com/Dave8011/bootable-maker/main/make-bootable.sh
chmod +x make-bootable.sh
./make-bootable.sh
```

---

## ✨ Key Features

- **Smart USB Detection**: Automatically scans for USB storage devices using `lsblk` (`RM=1` or `TRAN=usb`).
- **Numbered Menu Selection**: Presents detected drives in a clean numbered menu (`[1] /dev/sdb — 14.6G (SanDisk Cruzer Blade)`). Simply type `1` or press `Enter`.
- **Safety Protection**: Prevents accidental selection or overwriting of internal system drives (e.g. `/dev/sda`).
- **ISO Validation**: Validates the ISO image size and ISO9660 boot signature before writing.
- **Auto-Unmount**: Automatically detects and unmounts active partitions or mountpoints on the USB drive before writing.
- **Progress Tracking**: Uses `dd` with live progress status (`status=progress` and `conv=fsync`) and syncs filesystem buffers cleanly.

---

## 📋 Requirements

- Linux OS (Arch Linux, Garuda, Ubuntu, Debian, Fedora, Manjaro, Pop!_OS, etc.)
- Basic core utilities: `lsblk`, `dd`, `wipefs`, `sync`, `awk`, `sed`, `grep`, `stat`, `du`, `mountpoint`, `sudo`

---

## 💻 Local Usage

```bash
git clone https://github.com/Dave8011/bootable-maker.git
cd bootable-maker
chmod +x make-bootable.sh
./make-bootable.sh
```

Follow the on-screen prompts:
1. Enter the path to your ISO file (e.g., `/home/user/Downloads/omarchy-4.0.0.iso`).
2. Select your USB drive by typing its menu number (e.g., `1`).
3. Type `ERASE` to confirm writing.

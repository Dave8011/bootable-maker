#!/usr/bin/env bash

set -u
set -o pipefail

# ============================================================
#              ISO → BOOTABLE USB CREATOR
# ============================================================
#
# Designed for Arch/Garuda Linux
#
# Features:
#   • ISO path prompt
#   • ISO validation
#   • Removable USB detection
#   • USB detection retry
#   • Internal disk protection
#   • USB information display
#   • Explicit ERASE confirmation
#   • Automatic unmount
#   • wipefs
#   • dd ISO writing
#   • sync
#   • filesystem/label detection
#   • optional USB label
#   • final verification
#
# ============================================================

# Ensure interactive terminal input works when script is run via `curl ... | bash`
if [[ ! -t 0 && -c /dev/tty ]]; then
    exec </dev/tty
fi

clear

SCRIPT_NAME="ISO → BOOTABLE USB CREATOR"

echo "============================================================"
echo "              $SCRIPT_NAME"
echo "============================================================"
echo

# ============================================================
# COLORS
# ============================================================

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RESET='\033[0m'

info() {
    echo -e "${BLUE}ℹ️  $1${RESET}"
}

success() {
    echo -e "${GREEN}✅ $1${RESET}"
}

warning() {
    echo -e "${YELLOW}⚠️  $1${RESET}"
}

error() {
    echo -e "${RED}❌ $1${RESET}"
}

# ============================================================
# CHECK ROOT/SUDO
# ============================================================

if ! command -v sudo >/dev/null 2>&1; then
    error "sudo is not installed."
    exit 1
fi

# ============================================================
# CHECK REQUIRED COMMANDS
# ============================================================

REQUIRED_COMMANDS=(
    lsblk
    dd
    wipefs
    sync
    awk
    sed
    grep
    stat
    du
    mountpoint
)

for CMD in "${REQUIRED_COMMANDS[@]}"; do
    if ! command -v "$CMD" >/dev/null 2>&1; then
        error "Required command not found: $CMD"
        exit 1
    fi
done

# ============================================================
# ISO FILE
# ============================================================

echo "📀 ISO FILE"
echo "------------------------------------------------------------"

read -rp "Enter ISO file path: " ISO

# Remove accidental quotes
ISO="${ISO#\"}"
ISO="${ISO%\"}"
ISO="${ISO#\'}"
ISO="${ISO%\'}"

# Expand leading ~ to $HOME
if [[ "${ISO:0:1}" == "~" ]]; then
    ISO="${ISO/#~/$HOME}"
fi

if [[ ! -f "$ISO" ]]; then
    echo
    error "ISO file does not exist:"
    echo "   $ISO"
    exit 1
fi

if [[ ! -r "$ISO" ]]; then
    echo
    error "ISO file is not readable:"
    echo "   $ISO"
    exit 1
fi

ISO_SIZE=$(du -h "$ISO" | cut -f1)
ISO_BYTES=$(stat -c%s "$ISO")

echo
echo "ISO selected:"
echo "   📄 File : $ISO"
echo "   📦 Size : $ISO_SIZE"
echo

# ============================================================
# ISO VALIDATION
# ============================================================

echo "🔍 Validating ISO..."

if [[ "$ISO_BYTES" -lt 1000000 ]]; then
    error "ISO file appears to be invalid or too small."
    exit 1
fi

# Check ISO9660 signature
ISO_SIGNATURE=$(dd \
    if="$ISO" \
    bs=1 \
    skip=32769 \
    count=5 \
    status=none \
    2>/dev/null || true)

if [[ "$ISO_SIGNATURE" == "CD001" ]]; then
    success "ISO9660 filesystem signature detected."
else
    warning "ISO9660 signature was not detected."
    echo
    echo "The file may still be a valid hybrid boot image."
    echo
    read -rp "Continue anyway? [y/N]: " CONTINUE

    if [[ ! "$CONTINUE" =~ ^[Yy]$ ]]; then
        echo
        error "Cancelled."
        exit 1
    fi
fi

# Check if ISO filename indicates Windows (e.g. win11-pro.iso)
ISO_LOWER=$(echo "$ISO" | tr '[:upper:]' '[:lower:]')
if [[ "$ISO_LOWER" =~ win1[01] || "$ISO_LOWER" =~ windows ]]; then
    echo
    warning "WINDOWS ISO DETECTED: $ISO"
    echo "   Windows 10/11 ISOs use UDF non-hybrid partition structures and require"
    echo "   UEFI partition tools like Ventoy or WoeUSB to boot on PC hardware."
    echo "   Standard block writing (dd) works for Linux ISOs (Ubuntu, Arch, Fedora, etc.)."
    echo
    read -rp "Continue with dd writing anyway? [y/N]: " WIN_CONTINUE
    if [[ ! "$WIN_CONTINUE" =~ ^[Yy]$ ]]; then
        error "Cancelled. For Windows USB creation, please use Ventoy (https://www.ventoy.net) or WoeUSB."
        exit 1
    fi
fi

success "ISO validation completed."
echo

# ============================================================
# USB DETECTION FUNCTION
# ============================================================

find_usb_devices() {

    # IMPORTANT:
    # We place TRAN before MODEL and VENDOR so that spaces in
    # MODEL or VENDOR names do not shift column positions in awk.
    #
    # We accept devices where RM==1 OR TRAN=="usb".

    lsblk -dpno NAME,RM,SIZE,TRAN,MODEL,VENDOR 2>/dev/null |
        awk '$2 == "1" || $4 == "usb"'
}

# ============================================================
# WAIT FOR USB
# ============================================================

echo "============================================================"
echo "                    USB DRIVE DETECTION"
echo "============================================================"
echo

info "Searching for removable USB drives..."
echo

USB_DEVICES=""

for ((i=1; i<=20; i++)); do

    USB_DEVICES=$(find_usb_devices)

    if [[ -n "$USB_DEVICES" ]]; then
        break
    fi

    if (( i == 1 )); then
        echo "⏳ Waiting for USB device..."
    else
        echo "⏳ Still waiting... ($i/20)"
    fi

    sleep 1
done

if [[ -z "$USB_DEVICES" ]]; then
    echo
    error "No removable USB drive detected."
    echo
    echo "Check that:"
    echo "  • The pendrive is physically connected"
    echo "  • The USB port is working"
    echo "  • The pendrive is not repeatedly disconnecting"
    echo
    echo "You can check manually with:"
    echo
    echo "  lsblk -o NAME,SIZE,MODEL,VENDOR,TRAN,RM,TYPE,FSTYPE,LABEL"
    echo
    exit 1
fi

success "Removable USB drive(s) detected."
echo

mapfile -t DETECTED_DEV_PATHS < <(echo "$USB_DEVICES" | awk '{print $1}')

echo "Available USB drives:"
echo "------------------------------------------------------------"

idx=1
for dev in "${DETECTED_DEV_PATHS[@]}"; do
    dev_size=$(lsblk -dnro SIZE "$dev" 2>/dev/null || echo "Unknown")
    dev_model=$(lsblk -dnro MODEL "$dev" 2>/dev/null | sed 's/\\x20/ /g; s/x20/ /g' | xargs || true)
    dev_vendor=$(lsblk -dnro VENDOR "$dev" 2>/dev/null | sed 's/\\x20/ /g; s/x20/ /g' | xargs || true)
    dev_info="${dev_vendor:+$dev_vendor }${dev_model}"

    echo "  [$idx] $dev — $dev_size ${dev_info:+($dev_info)}"
    ((idx++))
done

echo "------------------------------------------------------------"
echo

# ============================================================
# SELECT USB
# ============================================================

if [[ ${#DETECTED_DEV_PATHS[@]} -eq 1 ]]; then
    DEFAULT_CHOICE="1"
    PROMPT_TEXT="Select USB device [1-${#DETECTED_DEV_PATHS[@]}] or enter path (default: 1): "
else
    DEFAULT_CHOICE=""
    PROMPT_TEXT="Select USB device number [1-${#DETECTED_DEV_PATHS[@]}] or enter path (example: /dev/sdb): "
fi

read -rp "$PROMPT_TEXT" INPUT_USB

INPUT_USB="$(echo "$INPUT_USB" | xargs)"

if [[ -z "$INPUT_USB" && -n "$DEFAULT_CHOICE" ]]; then
    INPUT_USB="$DEFAULT_CHOICE"
fi

if [[ "$INPUT_USB" =~ ^[0-9]+$ ]]; then
    NUM_VAL=$((INPUT_USB - 1))
    if (( NUM_VAL >= 0 && NUM_VAL < ${#DETECTED_DEV_PATHS[@]} )); then
        USB="${DETECTED_DEV_PATHS[$NUM_VAL]}"
    else
        echo
        error "Invalid selection index: $INPUT_USB"
        exit 1
    fi
elif [[ "$INPUT_USB" =~ ^sd[a-z]$ || "$INPUT_USB" =~ ^nvme[0-9]+n[0-9]+$ ]]; then
    USB="/dev/$INPUT_USB"
elif [[ "$INPUT_USB" =~ ^/dev/ ]]; then
    USB="$INPUT_USB"
else
    echo
    error "Invalid device input: '$INPUT_USB'"
    echo "Please enter a selection number (e.g., 1) or device path (e.g., /dev/sdb)."
    exit 1
fi

if [[ ! -b "$USB" ]]; then
    echo
    error "Device does not exist:"
    echo "   $USB"
    exit 1
fi

# ============================================================
# VERIFY REMOVABLE / USB TRANSPORT
# ============================================================

REMOVABLE=$(lsblk -dnro RM "$USB" 2>/dev/null || echo "0")
USB_TRAN_VERIFY=$(lsblk -dnro TRAN "$USB" 2>/dev/null | xargs || true)

if [[ "$REMOVABLE" != "1" && "$USB_TRAN_VERIFY" != "usb" ]]; then

    echo
    echo "============================================================"
    error "                    SAFETY STOP"
    echo "============================================================"
    echo
    echo "$USB is NOT identified as a removable drive or USB transport device."
    echo
    echo "For safety, the script will NOT modify it."
    exit 1
fi

# Check if device contains active system root (/) or critical system mount points
SYS_MOUNTS=$(lsblk -lnpo MOUNTPOINTS "$USB" 2>/dev/null | grep -E '^/($|boot|home|etc|usr|var)' || true)
if [[ -n "$SYS_MOUNTS" ]]; then
    echo
    echo "============================================================"
    error "                CRITICAL SAFETY STOP"
    echo "============================================================"
    echo
    echo "$USB contains active system mount point(s): $SYS_MOUNTS"
    echo "Overwriting your primary operating system drive is strictly forbidden."
    exit 1
fi

# ============================================================
# DEVICE INFORMATION
# ============================================================

USB_SIZE=$(lsblk -dnro SIZE "$USB" 2>/dev/null || echo "Unknown")
USB_MODEL=$(lsblk -dnro MODEL "$USB" 2>/dev/null | xargs || true)
USB_VENDOR=$(lsblk -dnro VENDOR "$USB" 2>/dev/null | xargs || true)
USB_TRAN=$(lsblk -dnro TRAN "$USB" 2>/dev/null | xargs || true)

echo
echo "============================================================"
echo "                    SELECTED USB"
echo "============================================================"
echo

echo "Device     : $USB"
echo "Size       : $USB_SIZE"
echo "Vendor     : ${USB_VENDOR:-Unknown}"
echo "Model      : ${USB_MODEL:-Unknown}"
echo "Transport  : ${USB_TRAN:-Unknown}"
echo "Removable  : YES"

echo
echo "Current partition layout:"
echo

lsblk -o NAME,SIZE,MODEL,FSTYPE,LABEL,TYPE,MOUNTPOINTS "$USB"

echo

# ============================================================
# IMPORTANT SAFETY CHECK
# ============================================================

echo "============================================================"
echo "                     ⚠️  WARNING"
echo "============================================================"
echo

echo "You are about to completely erase:"
echo
echo "   Device : $USB"
echo "   Size   : $USB_SIZE"
echo "   Model  : ${USB_MODEL:-Unknown}"
echo
echo "ALL DATA ON THIS USB WILL BE LOST."
echo
echo "Your internal drive should normally appear as /dev/sda"
echo "and is NOT removable."
echo

read -rp "Type ERASE to continue: " CONFIRM

if [[ "$CONFIRM" != "ERASE" ]]; then
    echo
    error "Cancelled. Nothing was changed."
    exit 0
fi

echo

# ============================================================
# USB LABEL
# ============================================================

echo "============================================================"
echo "                    USB LABEL / NAME"
echo "============================================================"
echo

echo "You can give the USB a name."
echo
echo "Examples:"
echo "   OMARCHY-4"
echo "   OMARCHY-USB"
echo "   LINUX-INSTALLER"
echo

read -rp "Enter USB name (leave empty for default): " USB_LABEL

# Replace spaces with -
USB_LABEL="${USB_LABEL// /-}"

# Remove unsafe characters
USB_LABEL=$(echo "$USB_LABEL" | tr -cd 'A-Za-z0-9._-')

if [[ -n "$USB_LABEL" ]]; then
    echo
    echo "Requested USB label:"
    echo "   📛 $USB_LABEL"
else
    echo
    info "No custom USB label requested."
fi

# ============================================================
# UNMOUNT USB
# ============================================================

echo
echo "============================================================"
echo "                    UNMOUNTING USB"
echo "============================================================"
echo

mapfile -t MOUNTPOINTS < <(
    lsblk -lnpo MOUNTPOINTS "$USB" 2>/dev/null | grep -v '^$'
)

if [[ ${#MOUNTPOINTS[@]} -gt 0 ]]; then
    for MP in "${MOUNTPOINTS[@]}"; do
        echo "Unmounting mount point $MP..."
        if ! sudo umount "$MP"; then
            error "Could not unmount $MP."
            echo
            echo "Close any file manager windows using the USB"
            echo "and try again."
            exit 1
        fi
        success "$MP unmounted."
    done
fi

mapfile -t ALL_NODES < <(
    lsblk -lnpo NAME "$USB" 2>/dev/null
)

for NODE in "${ALL_NODES[@]}"; do
    if findmnt -n "$NODE" >/dev/null 2>&1; then
        echo "Unmounting device node $NODE..."
        if ! sudo umount "$NODE"; then
            error "Could not unmount $NODE."
            exit 1
        fi
        success "$NODE unmounted."
    fi
done

# ============================================================
# WIPE FILESYSTEM SIGNATURES
# ============================================================

echo
echo "============================================================"
echo "                    WIPING USB"
echo "============================================================"
echo

echo "🧹 Removing old filesystem signatures..."

if ! sudo wipefs -a "$USB"; then
    error "Failed to wipe filesystem signatures."
    exit 1
fi

success "Old filesystem signatures removed."

# ============================================================
# WRITE ISO
# ============================================================

echo
echo "============================================================"
echo "                    WRITING ISO"
echo "============================================================"
echo

echo "Source:"
echo "   $ISO"
echo
echo "Destination:"
echo "   $USB"
echo
echo "ISO size:"
echo "   $ISO_SIZE"
echo
echo "Writing..."
echo

if ! sudo dd \
    if="$ISO" \
    of="$USB" \
    bs=4M \
    status=progress \
    conv=fsync; then

    echo
    error "ISO writing failed."
    exit 1
fi

echo
success "ISO written successfully."

# ============================================================
# SYNC
# ============================================================

echo
echo "🔄 Flushing pending writes..."

if ! sudo sync; then
    error "sync failed."
    exit 1
fi

sync

success "Data synchronized."

# ============================================================
# REREAD PARTITION TABLE
# ============================================================

echo
echo "🔄 Refreshing partition table..."

if command -v partprobe >/dev/null 2>&1; then
    sudo partprobe "$USB" 2>/dev/null || true
fi

if command -v blockdev >/dev/null 2>&1; then
    sudo blockdev --rereadpt "$USB" 2>/dev/null || true
fi

sleep 3

# ============================================================
# SHOW RESULT
# ============================================================

echo
echo "============================================================"
echo "                 USB AFTER ISO WRITE"
echo "============================================================"
echo

lsblk -o NAME,SIZE,MODEL,FSTYPE,LABEL,TYPE,MOUNTPOINTS "$USB"

# ============================================================
# LABEL ATTEMPT
# ============================================================

if [[ -n "$USB_LABEL" ]]; then

    echo
    echo "============================================================"
    echo "                  APPLYING USB LABEL"
    echo "============================================================"
    echo

    LABEL_SET=false

    mapfile -t NEW_PARTITIONS < <(
        lsblk -lnpo NAME,TYPE "$USB" |
        awk '$2 == "part" {print $1}'
    )

    if [[ ${#NEW_PARTITIONS[@]} -eq 0 ]]; then

        warning "No filesystem partition detected."
        warning "This ISO may use a special hybrid layout."

    else

        for PART in "${NEW_PARTITIONS[@]}"; do

            FSTYPE=$(lsblk -no FSTYPE "$PART" 2>/dev/null | xargs || true)

            if [[ -z "$FSTYPE" ]]; then
                continue
            fi

            echo "Partition : $PART"
            echo "Filesystem: $FSTYPE"

            case "$FSTYPE" in

                vfat|fat|fat16|fat32)

                    if command -v fatlabel >/dev/null 2>&1; then

                        if sudo fatlabel "$PART" "$USB_LABEL" 2>/dev/null; then
                            LABEL_SET=true
                            success "Label applied to $PART."
                            break
                        fi

                    fi

                    ;;

                exfat)

                    if command -v exfatlabel >/dev/null 2>&1; then

                        if sudo exfatlabel "$PART" "$USB_LABEL" 2>/dev/null; then
                            LABEL_SET=true
                            success "Label applied to $PART."
                            break
                        fi

                    fi

                    ;;

                ntfs)

                    if command -v ntfslabel >/dev/null 2>&1; then

                        if sudo ntfslabel "$PART" "$USB_LABEL" 2>/dev/null; then
                            LABEL_SET=true
                            success "Label applied to $PART."
                            break
                        fi

                    fi

                    ;;

                ext2|ext3|ext4)

                    if command -v e2label >/dev/null 2>&1; then

                        if sudo e2label "$PART" "$USB_LABEL" 2>/dev/null; then
                            LABEL_SET=true
                            success "Label applied to $PART."
                            break
                        fi

                    fi

                    ;;

                iso9660)

                    warning "ISO9660 is read-only."
                    warning "The ISO label cannot normally be changed after writing."

                    ;;

                *)

                    warning "Unsupported filesystem for automatic labeling: $FSTYPE"

                    ;;

            esac

        done

    fi

    if [[ "$LABEL_SET" == false ]]; then

        echo
        warning "Custom USB label could not be applied."
        echo
        echo "This is usually expected with hybrid Linux ISO images."
        echo "The bootable USB is still valid."
        echo

    fi

fi

# ============================================================
# FINAL SYNC
# ============================================================

echo
echo "🔄 Performing final sync..."

sudo sync
sync

sleep 2

# ============================================================
# FINAL VERIFICATION
# ============================================================

echo
echo "============================================================"
echo "                    FINAL VERIFICATION"
echo "============================================================"
echo

echo "USB device:"
echo "   $USB"

echo
echo "Final USB layout:"
echo

lsblk -o NAME,SIZE,MODEL,FSTYPE,LABEL,TYPE,MOUNTPOINTS "$USB"

echo
echo "Filesystem signatures:"
echo

sudo wipefs "$USB" || true

# ============================================================
# VERIFY ISO SIGNATURE ON USB
# ============================================================

echo
echo "Checking boot media signature..."

USB_SIGNATURE=$(sudo dd \
    if="$USB" \
    bs=1 \
    skip=32769 \
    count=5 \
    status=none \
    2>/dev/null || true)

if [[ "$USB_SIGNATURE" == "CD001" ]]; then

    success "ISO9660 signature found on USB."

else

    warning "ISO9660 signature was not found at the expected location."
    echo
    echo "This does not necessarily mean the USB is invalid."
    echo "Some hybrid boot images use a different layout."

fi

# ============================================================
# FINAL MESSAGE
# ============================================================

echo
echo "============================================================"
echo "                  ✅ BOOTABLE USB COMPLETE"
echo "============================================================"
echo

echo "ISO:"
echo "   $ISO"

echo
echo "USB:"
echo "   $USB"

echo
echo "USB Size:"
echo "   $USB_SIZE"

if [[ -n "$USB_LABEL" ]]; then
    echo
    echo "Requested USB Name:"
    echo "   $USB_LABEL"
fi

echo
echo "The USB has been synchronized."
echo
echo "You can now safely remove it."
echo
echo "============================================================"
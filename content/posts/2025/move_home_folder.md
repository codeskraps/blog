+++
title = 'Move /home Folder'
date = 2025-01-29T14:30:17+01:00
tags = ['linux']
draft = false
+++
You can move the `/home` folder on Ubuntu, but you must do it carefully to avoid breaking your system. Below are the steps to safely move `/home` to a new location.
<!--more-->

---

## **1. Create a Backup (Recommended)**
Before proceeding, create a backup of your home folder in case anything goes wrong.

{{<highlight bash>}}
sudo tar -czvf /home_backup.tar.gz /home
{{</highlight>}}

## **2. Create a New Partition or Mount Point (If Needed)**
If you're moving /home to a different partition or disk, make sure it's properly formatted and mounted.

For example, if you want to use a new disk (e.g., `/dev/sdb1`):

{{<highlight bash>}}
sudo mkfs.ext4 /dev/sdb1
sudo mkdir /mnt/newhome
sudo mount /dev/sdb1 /mnt/newhome
{{</highlight>}}

## **3. Copy the Home Folder**
Copy all user data to the new location while preserving permissions:

{{<highlight bash>}}
sudo rsync -aXS /home/ /mnt/newhome/
{{</highlight>}}

---

## **4. Update fstab**
Edit /etc/fstab to mount the new home directory at boot.

{{<highlight bash>}}
sudo nano /etc/fstab
{{</highlight>}}

Add this line at the end (adjust the path accordingly):

{{<highlight bash>}}
/dev/sdb1  /home  ext4  defaults  0  2
{{</highlight>}}

If you prefer using the UUID, first find it:

{{<highlight bash>}}
sudo blkid
{{</highlight>}}

Then, add this line instead:

{{<highlight arduino>}}
UUID=your-uuid /home ext4 defaults 0 2
{{</highlight>}}

---

## **5. Unmount Old Home and Mount New One**
Switch to a different session (e.g., TTY):

{{<highlight bash>}}
Ctrl + Alt + F3
{{</highlight>}}

Log in and stop processes using `/home`:

{{<highlight bash>}}
sudo systemctl stop gdm  # For GNOME (or use sddm/lightdm if applicable)
{{</highlight>}}

Unmount and remount:

{{<highlight bash>}}
sudo umount /home
sudo mount /home
{{</highlight>}}

---

## **6. Verify and Reboot**
Check that everything is in place:

{{<highlight bash>}}
ls /home
{{</highlight>}}

If everything looks good, reboot:

{{<highlight bash>}}
sudo reboot
{{</highlight>}}

---

# Things to Keep in Mind
* If you're logged in as a regular user, switch to a root shell (sudo -i) or use a temporary user with administrative privileges.

* If you face permission issues, you might need to reapply ownership:

{{<highlight bash>}}
sudo chown -R username:username /home/username
{{</highlight>}}
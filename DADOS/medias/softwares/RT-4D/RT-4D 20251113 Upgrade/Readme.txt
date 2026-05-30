▲▲▲▲▲▲Important Notes:

After this update, you must use the new CPS to re-edit the frequency points and write them to the walkie-talkie. Previous archive files cannot be used.

1. Unicode Download

This tool is required to load Unicode encoding after the firmware update; otherwise, SMS text may be garbled.

2. DMR Upgrade V1.2.0.24 251010

1. Improved VBLC superframe detection time to address the issue of potential disconnection after repeater reception.

2. Fixed the issue of being unable to enter sleep mode.

3. Walkie-talkie Firmware

V3.18 251111

1. Added automatic recovery of abnormal data and adjusted some data storage locations to avoid data loss due to frequent data changes.

2. Expanded the basic contacts to 10,000.

3. Changed the receiving group list to 250 groups, with a maximum of 32 group call contacts per group.

4. Changed the area list to 250 areas, each with 250 channels. The current channel for channels A and B in different areas can be set individually. 5. Drafts, Inbox, and Outbox are all locked to 128 messages.

6. Radio now features 80 independent channels, no longer divided into zones. Use the * key to switch radio input options; press the Menu key to edit the channel name.

7. Spectrum function changed: spectrum step input range increased from 0-9.99999MHz; spectrum scan points increased from 81 to 105. The three indicators on the left, from top to bottom, are RSSI, Noise, and Glitch.

8. APO, FM Stanby, etc. menus moved to the Basic Set menu; FM Radio and Time Manage menus removed.

9. DMR Version, Flash IC, and battery voltage display menus moved to the Version menu. Use the up and down keys to navigate to the corresponding items.

10. Refined frequency step settings (8.33kHz selectable).

11. Adjusted contrast settings to prevent the display from being too dark due to excessively high or low contrast. 12. Adjusted the dual-frequency standby processing. In dual-frequency standby mode, if a signal is received on the digital channel, the standby will wait for 2 seconds on that channel after the signal ends before continuing dual-frequency standby.

13. Reduced the scanning speed back to the earlier version (excessive scanning speed may cause some customers to be unable to scan for valid signals). Waiting time after carrier loss (Scan Interval menu) in CO mode adjustment:

14. Optimized communication between DMR baseband and MCU, optimized some communication commands.

15. Removed color code scanning function.

16. Digital and analog channel settings are no longer separate; digital or analog channel parameters can be set under the Channel Set menu, and digital or analog operating modes can be switched.

17. Offset Freq and Offset Dir menus are merged into the Offset Freq menu. The + or - key can be used to switch between them. This menu is linked to the TX Freq menu; changing one will change the other. Only one needs to be used.

18. Added a timer for Single Tone transmission; transmission will stop when the timer expires.

19. Fixed the issue of transmission freezing during reception.

20. Fixed the issue of potential reception failure after prolonged dual-mode (digital and analog) monitoring.

V3.19 251113

1. Fixed the issue of the Receiver Group List (TG List) not working. 2. Fixed the issue where backup debugging was not invoked when debugging data errors occurred.

4. CPS

V2.01 251111 (Incompatible with all previous versions; please re-edit the frequency point writing process)

1. Read/write frequency rates can be selected as 115200 (default) or 256000. If using 256000, the walkie-talkie needs to be powered on by holding down the # key (some customers' writing cables do not support 256000; please downgrade to 115200).

2. Interface layout adjustments.

3. VFO channels moved to the front; digital and analog channels are merged; in channel mode, a right-click menu (Copy/Cut/Paste/Insert/Delete) has been added; channels can be queried by frequency or name; channels can be sorted by frequency/mode/name.

4. The working area has been changed to 250 areas, each with 250 channels. Channels now allow vertical movement and sorting by channel number/channel name. Each area now has two current channels, corresponding to the current channels of channel A and channel B respectively. 5. Increased the number of contacts to 10,000; added sorting options by type/ID/name.

7. Changed the TG List to 250 lists, each with 32 group call contacts.

8. Radio is now a separate list with 80 channels; regional divisions are no longer available.

V2.02 251113

1. Fixed the issue where the ID in the TG List did not update when the contact ID changed.
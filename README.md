<hr />

![Supports aarch64 Architecture][aarch64-shield] ![Supports amd64 Architecture][amd64-shield] ![Supports armhf Architecture][armhf-shield] ![Supports armv7 Architecture][armv7-shield] ![Supports i386 Architecture][i386-shield]
<hr />

# Tesla CPO Inventory Tracker

This add-on monitors Tesla's CPO (Certified Pre-Owned) inventory for specific VIN(s). 

If a matching vin is found, it'll store that car's current price and will send a push notification when the car's price is changed; tapping on the received push notification will take you directly to the vehicle's listing on www.tesla.com.

- [Checkout the source code][proj-repo]
- [Report a bug][proj-bug-report]

## Why use this instead of Tesla-Info or other Telegram bots
- You're tech-savy, clearly
- You've already got Home Assistant installed
- You've (likely) got push notifications configured and enabled in Home Assistant
- You're privacy focused
- This is the _only_ Tesla CPO inventory tracker that watches specific VINs

## Configuration
Since this add-on calls Tesla's Inventory API directly (which is not publicly documented), you have to provide a couple values in a not-so-user-friendly way.

Please see the **Documentation** tab at the top to see how to configure this addon.

## About
I created this add-on as a Home Assistant learning exercise. It isn't perfect, but it does exactly what it says.

[proj-repo]: https://github.com/mwood77/ha-tesla-inventory-tracker
[proj-bug-report]: https://github.com/mwood77/ha-tesla-inventory-tracker/issues

[aarch64-shield]: https://img.shields.io/badge/aarch64-yes-green.svg
[amd64-shield]: https://img.shields.io/badge/amd64-yes-green.svg
[armhf-shield]: https://img.shields.io/badge/armhf-yes-green.svg
[armv7-shield]: https://img.shields.io/badge/armv7-yes-green.svg
[i386-shield]: https://img.shields.io/badge/i386-yes-green.svg
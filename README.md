# Tesla CPO Inventory Tracker

[![Open your Home Assistant instance and show the add add-on repository dialog with a specific repository URL pre-filled.](https://my.home-assistant.io/badges/supervisor_add_addon_repository.svg)](https://my.home-assistant.io/redirect/supervisor_add_addon_repository/?repository_url=https%3A%2F%2Fgithub.com%2Fmwood77%2Fha-tesla-inventory-tracker)

This add-on monitors Tesla's CPO (Certified Pre-Owned) inventory for specific VIN(s). 

If a matching vin is found, it'll store that car's current price and will send a push notification when the car's price is changed; tapping on the received push notification will take you directly to the vehicle's listing on [tesla.com][tesla].

- [Checkout the source code][proj-repo]
- [Report a bug][proj-bug-report]

This code is free and contains no referral links (Tesla or otherwise). If you want to show support, please consider buying me a coffee!

<a href='https://ko-fi.com/F1F475GK7' target='_blank'><img height='36' style='border:0px;height:36px;' src='https://storage.ko-fi.com/cdn/kofi6.png?v=6' border='0' alt='Buy Me a Coffee at ko-fi.com' /></a>

## Why use this instead of Tesla-Info or other Telegram bots
- You're tech-savy, clearly
- You've already got Home Assistant installed
- You've (likely) got push notifications configured and enabled in Home Assistant
- You're privacy focused
- This is the _only_ Tesla CPO inventory tracker that monitors specific VINs

## Configuration
Please see the **Documentation** tab at the top to see how to configure this addon.

Since this add-on calls Tesla's Inventory API directly (which is not publicly documented), you have to provide a couple values in a not-so-user-friendly way. This is spelled out in a pretty friendly manner in the documentation tab.

## About
I created this add-on as a Home Assistant learning exercise. It isn't perfect, but it does exactly what it says.

[proj-repo]: https://github.com/mwood77/ha-tesla-inventory-tracker
[proj-bug-report]: https://github.com/mwood77/ha-tesla-inventory-tracker/issues
[tesla]: https://tesla.com

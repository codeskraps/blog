+++
title = 'FreqDroid: Manage Your FreqTrade Bots From Your Phone'
date = 2026-03-04T10:00:00+01:00
tags = ['android', 'kotlin', 'open-source', 'cryptocurrency', 'development']
draft = false
+++

I'm excited to announce that [FreqDroid](https://freqdroid.com/) is now available on the Google Play Store. FreqDroid is a mobile client for [FreqTrade](https://www.freqtrade.io/), the popular open-source cryptocurrency trading bot framework, bringing full bot management to your pocket.

{{< responsive-image src="bot_comparison.png" alt="FreqDroid multi-bot comparison dashboard" maxWidth="400" >}}

<!--more-->

## What is FreqDroid?

If you run FreqTrade bots, you know the pain of having to sit at your computer to check on your trades. FreqDroid solves this by giving you a dedicated mobile app to monitor and manage all your bots from anywhere.

Whether you're running a single bot or managing a fleet of them across different strategies, FreqDroid aggregates everything into a clean, intuitive interface.

## Key Features

### Multi-Bot Dashboard

FreqDroid's standout feature is its ability to aggregate data from multiple trading bots into a single view. Open trades, profit charts, and performance metrics across every bot — all on one screen. No more switching between browser tabs or SSH sessions.

### Detailed Analytics

Dive deep into individual bot performance with:

- Trade logs and history
- Pair-by-pair breakdowns
- Balance history
- Cumulative profit charts
- Candlestick charts with technical indicator overlays (supporting both Standard and Heikin-Ashi candle types)

{{< responsive-image src="profit_over_time.png" alt="FreqDroid profit over time chart" maxWidth="400" >}}

### Flexible Navigation

The app offers two interface modes to suit your workflow:

- **Aggregate**: A flat, all-in-one view that combines everything into a single scrollable dashboard
- **Classic**: A sectioned layout with a bot picker, giving you a more traditional dashboard-and-trade experience

### Push Notifications via ntfy

FreqDroid integrates with [ntfy](https://ntfy.sh/) for self-hosted push notifications. Configure your FreqTrade webhooks to publish to ntfy topics and get instant trade alerts on your phone — with support for both live streaming and scheduled polling. Your server, your data.

{{< responsive-image src="indicators.png" alt="FreqDroid candlestick chart with technical indicators" maxWidth="400" >}}

### Customization

- Full HSL color picker for accent colors
- Material You dynamic theming on Android
- Light, dark, and system theme options

## Tech Stack

FreqDroid is built with [Kotlin Multiplatform](https://kotlinlang.org/docs/multiplatform.html) and [Compose Multiplatform](https://www.jetbrains.com/compose-multiplatform/), sharing code across platforms while maintaining native performance. The stack includes:

- **Ktor** for networking
- **SQLDelight** for local persistence
- **Koin** for dependency injection
- **Voyager** for navigation

The project follows a multi-module architecture with dedicated packages for domain, core, and feature layers.

## Open Source

FreqDroid is fully open-source under the MIT License. You can browse the code, open issues, or contribute on the [project repository](https://git.codeskraps.com/codeskraps/FreqDroid).

## Get It

FreqDroid is available now on [Google Play](https://play.google.com/store/apps/details?id=com.codeskraps.freqdroid), with iOS coming soon.

<a href="https://play.google.com/store/apps/details?id=com.codeskraps.freqdroid">
  <img alt="Get it on Google Play" src="https://play.google.com/intl/en_us/badges/static/images/badges/en_badge_web_generic.png" width="200">
</a>

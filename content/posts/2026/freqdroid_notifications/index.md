+++
title = 'FreqDroid 1.2: Rich Exit Notifications and Notification History'
date = 2026-03-05T12:00:00+01:00
tags = ['android', 'kotlin', 'open-source', 'cryptocurrency', 'freqtrade', 'notifications']
draft = false
+++

FreqDroid 1.2 is out with two notification upgrades: a new in-app notification history screen and support for rich exit notifications via FreqTrade's strategy callback — giving you Telegram-style trade alerts without Telegram.

<!--more-->

## The Problem with Built-in Webhooks

FreqTrade's built-in `exit_fill` webhook is functional but limited. You get the pair, the profit amount, and the ratio. That's it. If you've ever used FreqTrade's Telegram integration, you know the exit messages there are far richer — emoji indicators, trade duration, exit reason, partial exit handling, leverage info. Useful context that helps you glance at a notification and immediately understand what happened.

FreqDroid's ntfy integration initially used the same basic webhook templates. They worked, but the exit messages felt bare compared to what Telegram users get. So I wanted to close that gap.

## Rich Exit Notifications via Strategy Callback

The solution uses FreqTrade's `order_filled()` callback combined with `self.dp.send_msg()`. Instead of relying on the built-in `exit_fill` webhook, you remove it from your config and handle exit notifications directly in your strategy code. Messages sent via `dp.send_msg()` are delivered through the `strategy_msg` webhook type — ntfy receives them the same way.

The approach:

1. Remove `exit_fill` from your webhook config
2. Add `"allow_custom_messages": true` to the webhook block
3. In your strategy's `order_filled()` method, detect exit orders and format a rich message

Here's what the webhook config looks like without `exit_fill`:

```json
"webhook": {
    "enabled": true,
    "url": "https://ntfy.example.com/freqdroid-mybot",
    "format": "raw",
    "retries": 3,
    "retry_delay": 0.2,
    "allow_custom_messages": true,
    "entry_fill": {
        "data": "Trade opened (#{trade_id})\n{pair} @ {open_rate:.6f} | stake {stake_amount:.2f} {stake_currency}"
    },
    "entry_cancel": {
        "data": "Entry cancelled (#{trade_id})\n{pair} entry order cancelled"
    },
    "exit_cancel": {
        "data": "Exit cancelled (#{trade_id})\n{pair} exit order cancelled"
    },
    "status": {
        "data": "Status: {status}"
    }
}
```

And the strategy callback that replaces it:

```python
from freqtrade.persistence import Trade, Order

def order_filled(self, pair, trade: Trade, order: Order,
                 current_time, **kwargs):
    if order.side != trade.exit_side:
        return

    bot_name = self.config.get('bot_name', 'Bot')
    direction = "Short" if trade.is_short else "Long"

    def emoji(r):
        if r >= 0.05:   return "🤑"   # 5%+
        elif r >= 0.02: return "🚀"   # 2-5%
        elif r >= 0:    return "✳️"   # 0-2%
        elif r >= -0.02: return "⚠️"  # 0 to -2%
        else:           return "🔴"   # worse than -2%

    if trade.is_open:
        # Partial exit
        ratio = trade.calc_profit_ratio(order.safe_price)
        amt = trade.calc_profit(order.safe_price)
        msg = (f"{emoji(ratio)} *{bot_name}:* Partial Exit "
               f"{trade.pair} (#{trade.id})\n"
               f"*Profit:* `{ratio:.2%}` (`${amt:.2f}`)\n"
               f"*Direction:* {direction}\n"
               f"*Remaining Stake:* `${trade.stake_amount:.2f}`")
    else:
        # Final close
        ratio = trade.close_profit or 0
        amt = trade.close_profit_abs or 0
        dur = (trade.close_date or current_time) - trade.open_date
        secs = int(dur.total_seconds())
        dur_str = f"{secs // 86400}d " * (secs >= 86400)
        dur_str += f"{(secs % 86400) // 3600}h {(secs % 3600) // 60}m"
        msg = (f"{emoji(ratio)} *{bot_name}:* Closed "
               f"{trade.pair} (#{trade.id})\n"
               f"*Profit:* `{ratio:.2%}` (`${amt:.2f}`)\n"
               f"*Direction:* {direction}\n"
               f"*Duration:* {dur_str}\n"
               f"*Exit Reason:* `{trade.exit_reason}`")

    self.dp.send_msg(msg)
```

This gives you profit-based emoji tiers so you can tell at a glance whether a trade was a winner, trade duration so you know if it was a scalp or a swing, exit reason (stoploss, ROI, trailing stop, etc.), and proper handling for partial exits when using DCA strategies. The `(#{trade.id})` in the message is important — FreqDroid parses that to enable tap-to-navigate, opening the trade detail screen directly from the notification.

## Notification History

The other addition in 1.2 is a notification history screen. Previously, if you dismissed a notification or missed it, it was gone. Now every ntfy message is persisted to a local SQLDelight database when received — whether via the live SSE stream or scheduled polling.

A bell icon with an unread badge appears on the bot comparison screen (only when ntfy is enabled). Tapping it opens a paginated list of all past notifications. Opening the screen marks everything as read and clears the system notification tray. The table auto-prunes at 1,000 rows to keep the database lean.

## Update

FreqDroid 1.2 is available now on [Google Play](https://play.google.com/store/apps/details?id=com.codeskraps.freqdroid). The full notification setup guide — including the strategy callback approach — is documented on the [FreqDroid website](https://freqdroid.com/) and in the project's [docs](https://git.codeskraps.com/codeskraps/FreqDroid).

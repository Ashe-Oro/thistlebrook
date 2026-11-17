# Economy interface placeholder

`createEconomy()` returns `record(kind)`, `reset()`, `counters`, `getWallet(id)` and `inventory(id)`. Counters are `{buy:0,sell:0,payBill:0}`. `record` increments recognized kinds and returns a copy; unknown kinds do nothing. Wallet reads return zero; inventory reads return an empty array.

The three transaction tools only record intent. They do not price goods, transfer money, mint tokens, decrement stock, settle bills, or persist anything. `__life.economy()` returns a counter snapshot. Seeking resets counters so the same hour reconstructs the same state.

A future economy can implement validated transactions behind tools while preserving `{ok,error,action}` results and JSON-safe context. That is an interface extension for another milestone, not an implemented token economy.
